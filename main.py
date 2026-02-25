import io
import json
import math
import os
import re
import traceback
import base64

import numpy as np
import pypdf
from PIL import Image, ImageDraw, ImageFont
from docx import Document as DocxDocument
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from pptx import Presentation

# ─── Environment ────────────────────────────────────────────────────────────────
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is not set in the .env file")

client = Groq(api_key=GROQ_API_KEY)
MODEL  = "llama-3.3-70b-versatile"   # fast, free-tier Groq model

# ─── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="LearnAI AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8069"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Constants ──────────────────────────────────────────────────────────────────
SUPPORTED_FILE_TYPES = {"PDF", "DOCX", "PPTX", "IMAGE"}
MIN_TEXT_LENGTH      = 50
CHUNK_WORD_SIZE      = 800
MAX_CHUNKS           = 10

os.makedirs("uploads/recap-videos", exist_ok=True)


# ─── Text Extraction ────────────────────────────────────────────────────────────
def extract_text_pdf(file_bytes: bytes) -> str:
    reader = pypdf.PdfReader(io.BytesIO(file_bytes))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages).strip()


def extract_text_docx(file_bytes: bytes) -> str:
    doc = DocxDocument(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs).strip()


def extract_text_pptx(file_bytes: bytes) -> str:
    prs = Presentation(io.BytesIO(file_bytes))
    lines = []
    for slide in prs.slides:
        for shape in slide.shapes:
            if shape.has_text_frame:
                for para in shape.text_frame.paragraphs:
                    text = para.text.strip()
                    if text:
                        lines.append(text)
    return "\n".join(lines).strip()


def extract_text_image(file_bytes: bytes, filename: str = "") -> str:
    """Use Groq vision model for image text extraction."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    mime_map = {
        "jpg":  "image/jpeg",
        "jpeg": "image/jpeg",
        "png":  "image/png",
        "webp": "image/webp",
    }
    mime_type = mime_map.get(ext, "image/jpeg")
    b64_image = base64.b64encode(file_bytes).decode("utf-8")

    response = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime_type};base64,{b64_image}"},
                },
                {
                    "type": "text",
                    "text": (
                        "Extract all visible text from this image exactly as it appears. "
                        "Return only the extracted text with no commentary or formatting."
                    ),
                },
            ],
        }],
        max_tokens=4096,
    )
    content = response.choices[0].message.content.strip()
    if len(content) < 10:
        raise ValueError(
            "Vision model returned empty content. The image may not contain readable text "
            "or the model could not process it."
        )
    return content


def extract_text(file_bytes: bytes, file_type: str, filename: str = "") -> str:
    if file_type == "PDF":
        return extract_text_pdf(file_bytes)
    elif file_type == "DOCX":
        return extract_text_docx(file_bytes)
    elif file_type == "PPTX":
        return extract_text_pptx(file_bytes)
    elif file_type == "IMAGE":
        return extract_text_image(file_bytes, filename)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


# ─── Text Chunking ──────────────────────────────────────────────────────────────
def split_into_chunks(text: str) -> list[str]:
    words  = text.split()
    chunks = []
    for i in range(0, len(words), CHUNK_WORD_SIZE):
        chunk = " ".join(words[i: i + CHUNK_WORD_SIZE])
        chunks.append(chunk)
        if len(chunks) >= MAX_CHUNKS:
            break
    return chunks


# ─── Groq Helpers ───────────────────────────────────────────────────────────────
def clean_json_response(raw: str) -> str:
    """Strip markdown code fences and sanitize control characters inside JSON strings."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    raw = raw.strip()

    # Replace literal newlines/tabs inside JSON string values with escaped versions
    # so that json.loads does not fail on invalid control characters.
    def replace_control_chars(m: re.Match) -> str:
        s = m.group(0)
        s = s.replace('\r\n', '\\n').replace('\r', '\\n').replace('\n', '\\n')
        s = s.replace('\t', '\\t')
        return s

    # Match everything between pairs of quotes (JSON string values)
    raw = re.sub(r'"(?:[^"\\]|\\.)*"', replace_control_chars, raw, flags=re.DOTALL)
    return raw


def groq_chat(prompt: str) -> str:
    """Single chat completion call to Groq."""
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        max_tokens=8192,
    )
    return response.choices[0].message.content.strip()


def generate_course_title(text_preview: str) -> str:
    prompt = (
        "Based on the following document excerpt, generate a short, clear, "
        "and descriptive course title (maximum 8 words). "
        "Return only the title text, nothing else.\n\n"
        f"Document excerpt:\n{text_preview[:600]}"
    )
    return groq_chat(prompt)


def detect_category(text_preview: str) -> str:
    predefined = (
        "Informatique, Mathématiques, Physique, Chimie, Biologie, "
        "Langues, Gestion, Droit, Électronique, Mécanique"
    )
    prompt = (
        f"You are a document classifier. Read the following text excerpt and determine its academic or professional category.\n\n"
        f"First, try to match the document to one of these predefined categories:\n{predefined}\n\n"
        f"If the document clearly belongs to one of those categories, return that exact category name.\n"
        f"If the document does not match any of those predefined categories, invent the single most appropriate category name "
        f"based on the content (for example: Psychologie, Marketing, Architecture, Histoire, Philosophie, etc.).\n\n"
        f"Rules:\n"
        f"- Return ONLY the category name as plain text.\n"
        f"- No explanation, no punctuation around it, no extra words.\n"
        f"- Maximum 2 words.\n\n"
        f"Document excerpt:\n{text_preview[:500]}"
    )
    return groq_chat(prompt).strip().strip('."\'')


def generate_lesson(chunk: str, lesson_number: int, previous_titles: list[str]) -> dict:

    prior_context = ""
    if previous_titles:
        titles_list = "\n".join(f"  - Lesson {i+1}: {t}" for i, t in enumerate(previous_titles))
        prior_context = f"""
PREVIOUS LESSONS ALREADY TAUGHT (do NOT repeat or re-explain any concept or definition covered there):
{titles_list}

This lesson must build forward on those lessons. Assume the student already knows everything covered in the lessons above.
"""

    prompt = f"""You are a university professor creating a structured e-learning lesson. Your job is to TEACH, not to summarize.

Return ONLY a valid JSON object. No markdown, no code fences, no text outside the JSON.

LANGUAGE RULE: Detect the language of the text content below and write ALL fields (title, summary, content, questions, explanations, flashcards) in that SAME language. If the text is in French, respond in French. If in English, respond in English.
- If the source is French: write in pure, correct French. Do NOT mix in Spanish, English, or any other language. If a technical term has no French equivalent, write that term in English but keep all surrounding text in French.
{prior_context}
FIELD DEFINITIONS — follow these strictly:

"summary":
- Write exactly 3 to 4 sentences in PAST TENSE, as a conclusion of what was just taught.
- It must reflect what the student now understands after completing this lesson.
- NEVER start with phrases like "this lesson covers", "we will explore", "students will learn", "ce cours couvre", "nous allons explorer", "les étudiants apprendront", or any forward-looking introduction.
- Start directly with what was explained — for example: "This lesson explored...", "We examined...", "Cette leçon a mis en lumière...", "Nous avons vu que..."
- Do NOT teach or explain anything here. Only conclude.

"content":
- This is the main teaching section. Write it as a professor explaining to a student who has never seen this topic before.
- For EVERY concept in the text: explain WHAT it is, WHY it exists or matters, HOW it works in practice, and give a CONCRETE real-world example to illustrate it.
- Do NOT paraphrase or copy the source text. Teach the ideas from scratch using your own explanations.
- Do NOT re-explain or redefine any concept already covered in previous lessons listed above. If a concept was already taught, only reference it briefly and move forward.
- Structure the content in clear paragraphs with smooth transitions between ideas.
- The student must be able to fully understand and remember every concept after reading this field alone, without referring to the original document.
- Default minimum length: 5 full paragraphs, 600 words. EXCEPTION: if the source text chunk does not contain enough distinct concepts to fill 5 meaningful paragraphs, write 3 solid paragraphs of real content instead. Never repeat or rephrase the same idea multiple times just to reach a length target. Quality over quantity.
- The content field MUST be completely different from the summary field. Never copy the summary into content.

JSON structure:
{{
  "lessonNumber": {lesson_number},
  "title": "Descriptive lesson title",
  "summary": "Past-tense conclusion of what this lesson taught and what the student now understands.",
  "content": "Paragraph 1: Introduce the topic from scratch — what is it, where does it come from, why does it matter...\\n\\nParagraph 2: Explain the first key concept in depth — what it is, why it exists, how it works, with a real-world example...\\n\\nParagraph 3: Explain the second key concept in depth — what it is, why it exists, how it works, with a real-world example...\\n\\nParagraph 4: Explain the third key concept or go deeper into relationships between concepts, with comparisons or analogies...\\n\\nParagraph 5: Synthesize everything — how the concepts connect, what a student should take away, practical implications...",
  "estimatedReadTime": 8,
  "flashcards": [
    {{
      "term": "Key term",
      "definition": "Clear and concise definition."
    }}
  ]
}}

Rules:
- "summary" MUST be in past tense — it is a conclusion, not an introduction
- "summary" MUST NOT start with forward-looking phrases (covers, will learn, allons explorer, etc.)
- "summary" and "content" MUST be completely different texts — never copy one into the other
- "content" MUST NOT re-explain concepts already covered in previous lessons
- "content" = professor-style teaching, every new concept explained with what/why/how/example; 5 paragraphs if the source has enough distinct concepts, otherwise 3 solid paragraphs — never pad with repeated ideas
- If source language is French: write in pure French only — no Spanish, no mixing; technical terms with no French equivalent may stay in English
- "estimatedReadTime" = estimated reading time in minutes for the content field (integer, minimum 1). Calculate it as: word count of the content field divided by 200, rounded up.
- Do NOT include literal newline characters inside JSON string values; use \\n for paragraph breaks
- Return ONLY the JSON object, nothing else

Text content to teach from:
{chunk}"""

    raw     = groq_chat(prompt)
    cleaned = clean_json_response(raw)
    lesson  = json.loads(cleaned)

    # ── Generate recap video ──────────────────────────────────────────────────
    try:
        flashcard_terms_v = [fc.get("term", "") for fc in (lesson.get("flashcards") or [])[:6]]
        read_time_v       = lesson.get("estimatedReadTime") or math.ceil(
            len((lesson.get("content") or "").split()) / 200
        )
        print(f"[generate_lesson] generating video script for lesson {lesson_number}...")

        # Ask Groq to write the 4-slide video script
        video_script = generate_video_script(
            lesson_title   = lesson.get("title", f"Lesson {lesson_number}"),
            lesson_content = lesson.get("content", ""),
            lesson_summary = lesson.get("summary", ""),
            flashcards     = lesson.get("flashcards") or [],
        )

        print(f"[generate_lesson] starting video render for lesson {lesson_number}...")
        video_path = generate_recap_video(
            lesson_number       = lesson_number,
            lesson_title        = lesson.get("title", f"Lesson {lesson_number}"),
            video_script        = video_script,
            estimated_read_time = read_time_v,
            flashcard_count     = len(lesson.get("flashcards") or []),
            quiz_count          = len(lesson.get("quiz") or []),
        )
        print(f"[generate_lesson] video result: {video_path}")
        lesson["recapVideoPath"] = video_path
    except Exception as _ve:
        print(f"[generate_lesson] video outer exception: {_ve}")
        traceback.print_exc()
        lesson["recapVideoPath"] = None

    return lesson


# ─── Video Script Generation (Groq) ──────────────────────────────────────────────
def generate_video_script(
    lesson_title: str,
    lesson_content: str,
    lesson_summary: str,
    flashcards: list,
) -> dict:
    """
    Ask Groq to write a 4-slide educational video script for the lesson.
    Returns a dict with keys: hook, concept, steps, takeaway.
    Falls back to sensible defaults if the LLM call fails.
    """
    terms = [fc.get("term", "") for fc in flashcards[:6]]
    terms_str = ", ".join(terms) if terms else "see lesson content"

    prompt = f"""You are an expert instructional designer creating a short educational recap video for students.

Given the lesson below, write a concise 4-slide video script. Each slide is shown for 7 seconds.
The goal is to genuinely TEACH — not just repeat the lesson title. Give students new understanding or a fresh angle.

Lesson title: {lesson_title}
Key terms: {terms_str}
Summary: {lesson_summary[:400]}

Return ONLY a valid JSON object with these exact keys:
{{
  "hook": "1–2 sentences: Why does this topic matter in the real world? Give a concrete real-life example or analogy.",
  "concept": "2–3 sentences: Explain the single most important concept from this lesson in simple terms a beginner can understand.",
  "steps": ["step 1 text (max 12 words)", "step 2 text (max 12 words)", "step 3 text (max 12 words)", "step 4 text (max 12 words)"],
  "takeaway": "1 sentence: The most important thing to remember from this lesson."
}}

Rules:
- Use plain language, no jargon without explanation
- steps must be 3–4 items, each max 12 words
- No markdown, no code blocks, ONLY the JSON object"""

    try:
        raw     = groq_chat(prompt)
        cleaned = clean_json_response(raw)
        script  = json.loads(cleaned)
        # Validate required keys
        for key in ("hook", "concept", "steps", "takeaway"):
            if key not in script:
                raise ValueError(f"Missing key: {key}")
        if not isinstance(script["steps"], list) or len(script["steps"]) < 2:
            raise ValueError("steps must be a list with at least 2 items")
        return script
    except Exception as e:
        print(f"[generate_video_script] fallback due to: {e}")
        return {
            "hook":     f"Understanding {lesson_title} is essential for modern software development.",
            "concept":  lesson_summary[:200] if lesson_summary else f"This lesson covers {lesson_title}.",
            "steps":    [f"Study the key concept: {t}" for t in terms[:4]] or ["Review the lesson content"],
            "takeaway": f"Master the concepts in {lesson_title} to build strong foundations.",
        }


# ─── Recap Video Generation ────────────────────────────────────────────────────
def generate_recap_video(
    lesson_number: int,
    lesson_title: str,
    video_script: dict,
    estimated_read_time: int,
    flashcard_count: int = 0,
    quiz_count: int = 0,
) -> str | None:
    """
    Render a 28-second MP4 recap video (4 slides × 7 s) using Pillow + MoviePy.
    Slide content comes from the AI-generated video_script dict.
    """
    print(f"[generate_recap_video] called for lesson {lesson_number}: '{lesson_title}'")
    try:
        from moviepy import ImageClip, concatenate_videoclips

        W, H      = 1280, 720
        SLIDE_DUR = 7.0
        BG        = (15,  20,  40)
        INDIGO    = (99,  102, 241)
        WHITE     = (248, 250, 252)
        GOLD      = (245, 158, 11)
        GRAY      = (148, 163, 184)
        GREEN     = (52,  211, 153)

        _WIN = r"C:\Windows\Fonts"
        def _f(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
            names = (["arialbd.ttf","calibrib.ttf","segoeuib.ttf"] if bold
                     else ["arial.ttf","calibri.ttf","segoeui.ttf"])
            for n in names:
                p = os.path.join(_WIN, n)
                if os.path.exists(p):
                    try:
                        return ImageFont.truetype(p, size)
                    except Exception:
                        continue
            return ImageFont.load_default(size=size)

        def wrap_draw(draw, text, font, color, x, y, max_w, spacing=10, centre=False):
            words, lines, cur = text.split(), [], ""
            for w in words:
                test = (cur + " " + w).strip()
                if draw.textlength(test, font=font) <= max_w:
                    cur = test
                else:
                    if cur: lines.append(cur)
                    cur = w
            if cur: lines.append(cur)
            _, _, _, lh = draw.textbbox((0,0), "Ag", font=font)
            for line in lines:
                lx = x + (max_w - draw.textlength(line, font=font)) / 2 if centre else x
                draw.text((lx, y), line, font=font, fill=color)
                y += lh + spacing
            return y

        def divider(draw, y, color=INDIGO):
            draw.line([(80, y), (W-80, y)], fill=color, width=2)

        def new_slide():
            img = Image.new("RGB", (W, H), BG)
            return img, ImageDraw.Draw(img)

        def brand(draw):
            f = _f(20)
            t = "LearnAI Platform"
            draw.text(((W - draw.textlength(t, font=f)) / 2, H-50), t, font=f, fill=GRAY)

        # ── Slide 1 — WHY IT MATTERS (hook) ──────────────────────────────────────
        img1, d1 = new_slide()
        # Top label
        lbl = f"LESSON {lesson_number}  ·  WHY IT MATTERS"
        d1.text(((W - d1.textlength(lbl, font=_f(22,True)))/2, 50), lbl, font=_f(22,True), fill=INDIGO)
        divider(d1, 92)
        # Lesson title
        wrap_draw(d1, lesson_title, _f(46,True), WHITE, 80, 110, W-160, spacing=8, centre=True)
        divider(d1, 240, color=GRAY)
        # Hook text
        wrap_draw(d1, video_script.get("hook",""), _f(30), GOLD, 80, 265, W-160, spacing=12, centre=True)
        brand(d1)

        # ── Slide 2 — CORE CONCEPT ────────────────────────────────────────────────
        img2, d2 = new_slide()
        lbl2 = "CORE CONCEPT"
        d2.text(((W - d2.textlength(lbl2, font=_f(24,True)))/2, 50), lbl2, font=_f(24,True), fill=INDIGO)
        divider(d2, 94)
        # Big concept icon area
        d2.ellipse([(W//2-45, 115), (W//2+45, 205)], fill=INDIGO)
        star = "💡"  # will render as box with PIL, use text fallback
        d2.text((W//2-10, 128), "?", font=_f(50,True), fill=WHITE)
        # Concept explanation
        wrap_draw(d2, video_script.get("concept",""), _f(32), WHITE, 80, 225, W-160, spacing=14, centre=True)
        brand(d2)

        # ── Slide 3 — HOW IT WORKS (steps) ───────────────────────────────────────
        img3, d3 = new_slide()
        lbl3 = "HOW IT WORKS"
        d3.text(((W - d3.textlength(lbl3, font=_f(24,True)))/2, 50), lbl3, font=_f(24,True), fill=GOLD)
        divider(d3, 94, color=GOLD)
        steps = video_script.get("steps", [])[:4]
        y3 = 120
        for i, step in enumerate(steps):
            # Number circle
            d3.ellipse([(80, y3), (120, y3+40)], fill=INDIGO)
            d3.text((92, y3+4), str(i+1), font=_f(22,True), fill=WHITE)
            # Step text
            y3 = wrap_draw(d3, step, _f(30), WHITE, 140, y3+4, W-200, spacing=6)
            y3 += 18
        brand(d3)

        # ── Slide 4 — KEY TAKEAWAY ────────────────────────────────────────────────
        img4, d4 = new_slide()
        lbl4 = "KEY TAKEAWAY"
        d4.text(((W - d4.textlength(lbl4, font=_f(24,True)))/2, 50), lbl4, font=_f(24,True), fill=GREEN)
        divider(d4, 94, color=GREEN)
        # Large takeaway quote
        wrap_draw(d4, f'"{video_script.get("takeaway","")}"', _f(36,True), WHITE,
                  80, 160, W-160, spacing=16, centre=True)
        divider(d4, 480, color=GRAY)
        # Stats row
        real_fc = flashcard_count or 0
        real_qc = quiz_count or 5
        stats = [(str(real_fc),"Flashcards"), (str(real_qc),"Quiz Questions"),
                 (f"{estimated_read_time} min","Read Time")]
        bw = (W-160) // 3
        for i,(val,lbl) in enumerate(stats):
            cx = 80 + bw*i + bw//2
            d4.text((cx - d4.textlength(val,font=_f(42,True))//2, 500),
                    val, font=_f(42,True), fill=INDIGO)
            d4.text((cx - d4.textlength(lbl,font=_f(22))//2, 555),
                    lbl, font=_f(22), fill=GRAY)
        brand(d4)

        # ── Assemble ──────────────────────────────────────────────────────────────
        def to_clip(img): return ImageClip(np.array(img), duration=SLIDE_DUR)
        final = concatenate_videoclips([to_clip(img1), to_clip(img2),
                                        to_clip(img3), to_clip(img4)], method="compose")

        safe = re.sub(r"[^\w]", "_", lesson_title.encode("ascii","ignore").decode())[:30]
        out  = os.path.abspath(os.path.join("uploads","recap-videos",
                                            f"lesson_{lesson_number}_{safe}.mp4"))
        print(f"[generate_recap_video] writing → {out}")
        final.write_videofile(out, codec="libx264", audio=False, fps=24,
                              preset="ultrafast", logger=None)
        final.close()
        print(f"[generate_recap_video] done  {os.path.getsize(out):,} bytes")
        return out

    except Exception as exc:
        print(f"[generate_recap_video] ERROR: {exc}")
        traceback.print_exc()
        return None


# ─── Recap Video Generation ───────────────────────────────────────────────────


# ─── On-demand Quiz Generation ──────────────────────────────────────────────────
def generate_quiz_questions(lesson_content: str) -> list:
    """Generate exactly 5 fresh quiz questions from lesson content using high-temperature sampling."""
    prompt = f"""You are a quiz generator for an e-learning platform. Your task is to generate exactly 5 quiz questions based on the lesson content provided.

CRITICAL INSTRUCTION — ANGLE OF APPROACH:
Every time you are called you must approach the lesson from a completely different angle.
Do NOT generate questions about the most obvious or prominent concepts — instead pick less obvious facts, edge cases, nuances, or relationships between concepts that a student might overlook or take for granted.
Force the student to think deeply, not just recall headline facts.

LANGUAGE RULE: Detect the language of the lesson content and write ALL questions, options, answers, and explanations in that SAME language. If content is in French, respond in French. If in English, respond in English.

Generate EXACTLY 5 questions in this order and distribution:
- Questions 1–2: questionType "TRUE_FALSE", difficulty "EASY"
  * options must be exactly ["Vrai", "Faux"] if content is in French, or ["True", "False"] if in English
  * correctAnswer must be exactly one of the two option values
  * Write ORIGINAL statements in your own words — NEVER copy a sentence from the lesson and flip one word
  * Test conceptual understanding, not surface-level recall of wording
- Questions 3–4: questionType "MCQ", difficulty "MEDIUM"
  * Exactly 4 options — all plausible, wrong ones are related to the topic and wrong for a specific reason
  * correctAnswer must exactly match one of the 4 options
  * Require reasoning: compare concepts, identify correct use case/context, apply concept to scenario, or identify a consequence/implication
  * NEVER ask a question whose answer is a single isolated fact that can be read directly from one sentence
- Question 5: questionType "FILL_BLANK", difficulty "HARD"
  * options must be an empty array []
  * question text MUST contain "____" as the blank placeholder
  * correctAnswer is the exact word or short phrase that fills the blank
  * Target a key technical term that requires genuine understanding — NOT a term that appears verbatim in an almost identical sentence in the lesson
  * Construct the sentence around the concept, not around a sentence already in the lesson

Return ONLY a valid JSON array of exactly 5 question objects. No markdown, no code fences, no text outside the JSON array.

Each question object must have these fields:
- "questionType": "TRUE_FALSE" | "MCQ" | "FILL_BLANK"
- "question": the question or statement text (string)
- "options": array of strings (2 for TRUE_FALSE, 4 for MCQ, empty [] for FILL_BLANK)
- "correctAnswer": the correct answer string (must exactly match one option for TRUE_FALSE and MCQ)
- "explanation": why this answer is correct (and for MCQ why the other options are wrong)
- "difficulty": "EASY" | "MEDIUM" | "HARD"

Lesson content:
{lesson_content}"""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.9,
        max_tokens=4096,
    )
    raw     = response.choices[0].message.content.strip()
    cleaned = clean_json_response(raw)
    return json.loads(cleaned)


class GenerateQuizRequest(BaseModel):
    lessonContent: str


class GenerateExamRequest(BaseModel):
    lessonContents: list[str]
    courseTitle: str


# ─── On-demand Exam Generation ──────────────────────────────────────────────────
def generate_exam_questions(lesson_contents: list[str], course_title: str) -> list:
    """
    Generate 75 exam questions via 4 separate Groq calls:
      Section 1 — 30 TRUE_FALSE  EASY      (1 pt each)   → 1 call
      Section 2 — 30 MCQ         MEDIUM    (2 pts each)  → 2 calls of 15
      Section 3 — 15 FILL_BLANK  HARD      (3 pts each)  → 1 call
    Returns a flat list of ≥75 question dicts.
    """
    combined_content = "\n\n---\n\n".join(lesson_contents)
    content_preview = combined_content[:10000]  # keep well within token budget

    def _call(section_prompt: str) -> list:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": section_prompt}],
            temperature=0.7,
            max_tokens=6000,
        )
        raw = response.choices[0].message.content.strip()
        cleaned = clean_json_response(raw)
        # Try normal parse first
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Attempt to recover a partial array by truncating at the last complete object
            last_brace = cleaned.rfind("},")
            if last_brace != -1:
                partial = cleaned[:last_brace + 1] + "]"
                try:
                    return json.loads(partial)
                except json.JSONDecodeError:
                    pass
            raise

    base_rules = f"""LANGUAGE RULE: Detect the language of the content and write ALL questions, answers, and explanations in that SAME language.
QUALITY RULES:
- NEVER copy a sentence directly from the content — rephrase and test understanding
- Test conceptual understanding, real-world application, or relationships between concepts
- No duplicate questions
- Every correctAnswer must be unambiguous and defensible

Course title: {course_title}
Course content (all lessons combined):
{content_preview}"""

    # ── Section 1: TRUE_FALSE (30 questions, 1 call) ──────────────────────────
    tf_prompt = f"""You are an expert exam question writer for a university e-learning platform.

{base_rules}

Generate EXACTLY 30 TRUE_FALSE questions, difficulty EASY, sectionNumber 1.

Rules:
- option1 must be "Vrai" and option2 must be "Faux" if content is in French, OR "True" and "False" if in English
- option3 and option4 must be null
- correctAnswer must exactly match option1 or option2
- Write ORIGINAL statements that test conceptual understanding

Return ONLY a valid JSON array of exactly 30 objects with these fields:
{{"questionType":"TRUE_FALSE","questionText":"...","option1":"Vrai","option2":"Faux","option3":null,"option4":null,"correctAnswer":"Vrai","explanation":"...","difficulty":"EASY","sectionNumber":1,"pointsWorth":1}}

No markdown, no code fences, ONLY the JSON array."""

    # ── Section 2a: MCQ first 15 ──────────────────────────────────────────────
    mcq_prompt_a = f"""You are an expert exam question writer for a university e-learning platform.

{base_rules}

Generate EXACTLY 15 MCQ questions, difficulty MEDIUM, sectionNumber 2.

Rules:
- Exactly 4 options, all plausible
- correctAnswer must exactly match one of the 4 option values
- Test reasoning: comparisons, application, consequences — not isolated facts
- Keep explanations concise (1–2 sentences)

Return ONLY a valid JSON array of exactly 15 objects with these fields:
{{"questionType":"MCQ","questionText":"...","option1":"...","option2":"...","option3":"...","option4":"...","correctAnswer":"...","explanation":"...","difficulty":"MEDIUM","sectionNumber":2,"pointsWorth":2}}

No markdown, no code fences, ONLY the JSON array."""

    # ── Section 2b: MCQ next 15 ───────────────────────────────────────────────
    mcq_prompt_b = f"""You are an expert exam question writer for a university e-learning platform.

{base_rules}

Generate EXACTLY 15 MORE MCQ questions, difficulty MEDIUM, sectionNumber 2.
These must be DIFFERENT from any questions already generated — cover different concepts and aspects of the course.

Rules:
- Exactly 4 options, all plausible
- correctAnswer must exactly match one of the 4 option values
- Test reasoning: comparisons, application, consequences — not isolated facts
- Keep explanations concise (1–2 sentences)

Return ONLY a valid JSON array of exactly 15 objects with these fields:
{{"questionType":"MCQ","questionText":"...","option1":"...","option2":"...","option3":"...","option4":"...","correctAnswer":"...","explanation":"...","difficulty":"MEDIUM","sectionNumber":2,"pointsWorth":2}}

No markdown, no code fences, ONLY the JSON array."""

    # ── Section 3: FILL_BLANK (15 questions, 1 call) ─────────────────────────
    fb_prompt = f"""You are an expert exam question writer for a university e-learning platform.

{base_rules}

Generate EXACTLY 15 FILL_BLANK questions, difficulty HARD, sectionNumber 3.

Rules:
- The questionText MUST contain "____" as the blank placeholder
- option1, option2, option3, option4 must ALL be null
- correctAnswer is the exact word or short phrase that fills the blank
- Target key technical terms that require deep understanding
- Keep explanations concise (1–2 sentences)

Return ONLY a valid JSON array of exactly 15 objects with these fields:
{{"questionType":"FILL_BLANK","questionText":"The ____ is responsible for...","option1":null,"option2":null,"option3":null,"option4":null,"correctAnswer":"exact answer","explanation":"...","difficulty":"HARD","sectionNumber":3,"pointsWorth":3}}

No markdown, no code fences, ONLY the JSON array."""

    def _generate_all() -> list:
        print("[generate_exam_questions] Generating Section 1 (TRUE_FALSE, 30)...")
        section1 = _call(tf_prompt)

        print("[generate_exam_questions] Generating Section 2a (MCQ, 15)...")
        section2a = _call(mcq_prompt_a)

        print("[generate_exam_questions] Generating Section 2b (MCQ, 15)...")
        section2b = _call(mcq_prompt_b)

        print("[generate_exam_questions] Generating Section 3 (FILL_BLANK, 15)...")
        section3 = _call(fb_prompt)

        all_q = section1 + section2a + section2b + section3
        print(f"[generate_exam_questions] Total questions generated: {len(all_q)}")
        return all_q

    try:
        return _generate_all()
    except Exception as e:
        print(f"[generate_exam_questions] First attempt failed: {e}, retrying...")
        try:
            return _generate_all()
        except Exception as retry_err:
            raise RuntimeError(f"Exam generation failed after retry: {retry_err}")


# ─── Endpoints ──────────────────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "learnai-ai-service", "model": MODEL}


@app.post("/api/generate-quiz")
async def generate_quiz(request: GenerateQuizRequest):
    """Generate 5 fresh quiz questions on demand from lesson content."""
    if not request.lessonContent or len(request.lessonContent.strip()) < 50:
        raise HTTPException(status_code=400, detail="lessonContent is too short to generate questions.")
    try:
        questions = generate_quiz_questions(request.lessonContent)
    except (json.JSONDecodeError, Exception):
        # Retry once on parse failure
        try:
            questions = generate_quiz_questions(request.lessonContent)
        except Exception as retry_err:
            raise HTTPException(status_code=502, detail=f"Quiz generation failed: {str(retry_err)}")
    return questions


@app.post("/api/generate-exam")
async def generate_exam(request: GenerateExamRequest):
    """Generate 75 exam questions (30 TF + 30 MCQ + 15 FB) from all lesson contents."""
    if not request.lessonContents or all(len(c.strip()) < 50 for c in request.lessonContents):
        raise HTTPException(status_code=400, detail="lessonContents is empty or too short.")
    try:
        questions = generate_exam_questions(request.lessonContents, request.courseTitle)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Exam generation failed: {str(e)}")
    return questions


@app.post("/process-document")
async def process_document(
    file: UploadFile = File(...),
    fileType: str    = Query(..., description="PDF | DOCX | PPTX | IMAGE"),
):
    # ── Validate file type ──────────────────────────────────────────────────────
    file_type = fileType.upper()
    if file_type not in SUPPORTED_FILE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{fileType}'. Supported: {', '.join(SUPPORTED_FILE_TYPES)}",
        )

    # ── Read file bytes ─────────────────────────────────────────────────────────
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty or unreadable.")

    # ── Extract text ────────────────────────────────────────────────────────────
    print(f"[1/4] Extracting text from {file_type} file: {file.filename}")
    try:
        text = extract_text(file_bytes, file_type, file.filename or "")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=422, detail=f"Text extraction failed: {str(e)}")

    if len(text) < MIN_TEXT_LENGTH:
        raise HTTPException(
            status_code=422,
            detail="Document does not contain enough readable content to generate a course (minimum 50 characters).",
        )
    print(f"    Extracted {len(text)} characters of text.")

    # ── Chunk text ──────────────────────────────────────────────────────────────
    chunks = split_into_chunks(text)
    print(f"[2/4] Split into {len(chunks)} chunk(s) (max {MAX_CHUNKS}, ~{CHUNK_WORD_SIZE} words each).")

    # ── Category detection ───────────────────────────────────────────────────────
    print("[3/4] Detecting document category...")
    try:
        category = detect_category(text)
    except Exception as e:
        category = "Général"
    print(f"    Category: \"{category}\"")

    # ── Course title ────────────────────────────────────────────────────────────
    print("[4/4] Generating course title...")
    try:
        course_title = generate_course_title(text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Groq API error (title): {str(e)}")
    print(f"    Title: \"{course_title}\"")

    # ── Lessons ─────────────────────────────────────────────────────────────────
    lessons = []
    previous_titles: list[str] = []
    print(f"[5/5] Generating {len(chunks)} lesson(s)...")
    for idx, chunk in enumerate(chunks, start=1):
        print(f"    Lesson {idx}/{len(chunks)}...")
        try:
            lesson = generate_lesson(chunk, idx, previous_titles)
        except (json.JSONDecodeError, Exception):
            print(f"    Lesson {idx} parse failed, retrying...")
            try:
                lesson = generate_lesson(chunk, idx, previous_titles)
            except Exception as retry_err:
                raise HTTPException(
                    status_code=502,
                    detail=f"Groq API error on lesson {idx}: {str(retry_err)}",
                )
        lessons.append(lesson)
        previous_titles.append(lesson.get("title", f"Lesson {idx}"))

    result = {
        "courseTitle":  course_title,
        "category":     category,
        "totalLessons": len(lessons),
        "lessons":      lessons,
    }
    print(f"Done. Course \"{course_title}\" — category: \"{category}\" — {len(lessons)} lesson(s).")
    return result


# ─── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

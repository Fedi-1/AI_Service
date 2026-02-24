import io
import json
import os
import re
import traceback
import base64

import pypdf
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
    return json.loads(cleaned)


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

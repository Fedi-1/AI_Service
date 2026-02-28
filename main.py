import io
import json
import math
import os
import re
import traceback
import base64
import glob
import requests

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

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")

# ElevenLabs voice IDs
ELEVENLABS_VOICE_FR = "nPczCjzI2devNBz1zQrb"   # Brian — calm professional male (French)
ELEVENLABS_VOICE_EN = "21m00Tcm4TlvDq8ikWAM"   # Rachel — clear professional female (English)

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


def groq_chat(prompt: str, temperature: float = 0.4, max_tokens: int = 8192) -> str:
    """Single chat completion call to Groq."""
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        max_tokens=max_tokens,
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


def generate_course_description(text_preview: str) -> str:
    prompt = (
        "Based on the following document excerpt, write a clear and informative course description "
        "in 2 to 3 sentences that explains what topics this course covers, what the student will learn, "
        "and why this knowledge is useful. "
        "Detect the language of the text and write the description in that same language. "
        "Return only the description text with no extra formatting or labels.\n\n"
        f"Document excerpt:\n{text_preview[:800]}"
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
      "definition": "Clear and concise definition.",
      "difficulty": "EASY | MEDIUM | HARD"
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
- For each flashcard "difficulty": assign EASY for basic definitions any beginner understands after one read; MEDIUM for concepts requiring understanding of relationships or how a mechanism works in practice; HARD for concepts requiring deep understanding, involving multiple interrelated ideas, or likely to be confused with similar concepts. You MUST distribute difficulty realistically — do not assign MEDIUM to all flashcards. A typical lesson must have a mix of EASY, MEDIUM, and HARD flashcards proportional to content complexity.
- Do NOT include literal newline characters inside JSON string values; use \\n for paragraph breaks
- Return ONLY the JSON object, nothing else

Text content to teach from:
{chunk}"""

    raw     = groq_chat(prompt)
    cleaned = clean_json_response(raw)
    lesson  = json.loads(cleaned)

    return lesson


# ─── Recap Video — Script Generation ─────────────────────────────────────────
def generate_video_script(
    lesson_title: str,
    real_world_hook: str,
    key_takeaway: str,
    practical_tip: str,
    challenge_question: str,
    language: str,
) -> dict:
    """
    Generates narration scripts for all 4 slides via a single Llama 3.3 call.
    Returns dict with keys: slide1, slide2, slide3, slide4.
    """
    lang_name = "French" if language.lower().startswith("fr") else "English"
    prompt = f"""You are writing a narration script for a short educational video about "{lesson_title}". The video has 4 slides. Write the narrator text for each slide in {lang_name}. The narrator speaks in a calm, clear, professor-like tone. Use simple academic language appropriate for university students.

Slide 1 is about why this lesson matters in the real world. Base it on this hook: {real_world_hook}. Expand it into 3 sentences that explain the real-world importance naturally as if speaking to a student. Do not list facts — speak conversationally.

Slide 2 is about key concepts to remember. Base it on: {key_takeaway}. Write 3 to 4 sentences that introduce each key point conversationally, connecting them together naturally.

Slide 3 is about practical application. Base it on: {practical_tip}. Write 3 sentences that guide the student through what to do next, using encouraging and actionable language.

Slide 4 is a challenge question to prepare the student for the quiz. Use this question: {challenge_question}. Write 2 sentences: first tell the student to think carefully about the question, then state the question clearly.

Return ONLY a valid JSON object with exactly 4 fields: slide1, slide2, slide3, slide4. Each field contains the narrator text as a plain string with no formatting."""

    try:
        raw     = groq_chat(prompt, temperature=0.6, max_tokens=600)
        cleaned = clean_json_response(raw)
        scripts = json.loads(cleaned)
        for key in ("slide1", "slide2", "slide3", "slide4"):
            if key not in scripts or not isinstance(scripts[key], str):
                raise ValueError(f"Missing or invalid key: {key}")
        return scripts
    except Exception as e:
        print(f"[generate_video_script] fallback due to: {e}")
        if language.lower().startswith("fr"):
            return {
                "slide1": f"{real_world_hook} Ce concept joue un rôle fondamental dans de nombreuses technologies modernes que vous utilisez au quotidien.",
                "slide2": f"{key_takeaway} Ces points essentiels forment la base de votre compréhension de ce sujet.",
                "slide3": f"{practical_tip} Appliquer ces étapes vous aidera à consolider votre apprentissage.",
                "slide4": f"Prenez un moment pour réfléchir attentivement à cette question avant de passer au quiz. {challenge_question}",
            }
        else:
            return {
                "slide1": f"{real_world_hook} This concept plays a fundamental role in many modern technologies you use every day.",
                "slide2": f"{key_takeaway} These essential points form the foundation of your understanding of this topic.",
                "slide3": f"{practical_tip} Applying these steps will help you consolidate your learning.",
                "slide4": f"Take a moment to think carefully about this question before moving on to the quiz. {challenge_question}",
            }


# ─── Recap Video — ElevenLabs Audio Generation ───────────────────────────────
def generate_slide_audio(
    slide_text: str,
    language: str,
    slide_index: int,
) -> tuple[str, list[dict]]:
    """
    Calls ElevenLabs TTS with word-level timestamps.
    Returns (mp3_path, word_timestamps_list).
    Falls back to silent audio on any error.
    """
    os.makedirs(os.path.join("uploads", "recap-videos"), exist_ok=True)
    mp3_path = os.path.abspath(
        os.path.join("uploads", "recap-videos", f"temp_slide_{slide_index}.mp3")
    )

    def _silent_fallback() -> tuple[str, list]:
        """Write 20 s of silent MP3 using a minimal WAV→MP3 trick via numpy."""
        # Write a 20-second silent WAV, convert via moviepy/ffmpeg
        try:
            import wave, struct
            silent_wav = mp3_path.replace(".mp3", "_silent.wav")
            sample_rate = 22050
            num_samples = sample_rate * 20
            with wave.open(silent_wav, "w") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(sample_rate)
                wf.writeframes(struct.pack("<" + "h" * num_samples, *([0] * num_samples)))
            # Convert WAV → MP3 with ffmpeg (moviepy bundles it)
            from moviepy import AudioFileClip as AFC
            afc = AFC(silent_wav)
            afc.write_audiofile(mp3_path, logger=None)
            afc.close()
            os.remove(silent_wav)
        except Exception as ex:
            print(f"[generate_slide_audio] silent fallback failed: {ex}")
            # Last resort: write empty bytes so MoviePy can still open it
            open(mp3_path, "wb").close()
        return mp3_path, []

    if not ELEVENLABS_API_KEY:
        print(f"[generate_slide_audio] ELEVENLABS_API_KEY not set — using silent fallback")
        return _silent_fallback()

    voice_id = ELEVENLABS_VOICE_FR if language.lower().startswith("fr") else ELEVENLABS_VOICE_EN
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }
    body = {
        "model_id": "eleven_multilingual_v2",
        "text": slide_text,
        "voice_settings": {
            "stability": 0.75,
            "similarity_boost": 0.85,
            "style": 0.3,
            "use_speaker_boost": True,
        },
    }

    try:
        resp = requests.post(url, headers=headers, json=body, timeout=60)
        resp.raise_for_status()
        data = resp.json()

        # Decode audio
        audio_bytes = base64.b64decode(data["audio_base64"])
        with open(mp3_path, "wb") as f:
            f.write(audio_bytes)

        # Parse word-level timestamps from character alignment
        alignment  = data.get("alignment", {})
        chars      = alignment.get("characters", [])
        starts     = alignment.get("character_start_times_seconds", [])
        ends       = alignment.get("character_end_times_seconds", [])

        word_timestamps: list[dict] = []
        current_word = ""
        word_start   = 0.0
        word_end     = 0.0

        for i, ch in enumerate(chars):
            char_start = starts[i] if i < len(starts) else 0.0
            char_end   = ends[i]   if i < len(ends)   else 0.0
            if ch == " " or ch == "\n":
                if current_word:
                    word_timestamps.append({
                        "word":  current_word,
                        "start": word_start,
                        "end":   word_end,
                    })
                    current_word = ""
            else:
                if not current_word:
                    word_start = char_start
                current_word += ch
                word_end = char_end
        if current_word:
            word_timestamps.append({
                "word":  current_word,
                "start": word_start,
                "end":   word_end,
            })

        print(f"[generate_slide_audio] slide {slide_index}: {len(word_timestamps)} words, "
              f"audio {os.path.getsize(mp3_path):,} bytes")
        return mp3_path, word_timestamps

    except Exception as e:
        print(f"[generate_slide_audio] ElevenLabs error for slide {slide_index}: {e}")
        traceback.print_exc()
        return _silent_fallback()


# ─── Recap Video — Audio Duration Helper ─────────────────────────────────────
def _audio_duration_seconds(mp3_path: str) -> float:
    """Return duration of an MP3 file in seconds using mutagen, or estimate from file size."""
    try:
        from mutagen.mp3 import MP3
        return MP3(mp3_path).info.length
    except Exception:
        pass
    try:
        size = os.path.getsize(mp3_path)
        # Rough estimate: 128 kbps → ~16000 bytes/sec
        return max(1.0, size / 16000)
    except Exception:
        return 10.0


# ─── Recap Video Generation ────────────────────────────────────────────────────
def generate_recap_video(
    lesson_number: int,
    lesson_title: str,
    flashcard_terms: list[str],
    lesson_summary: str,
    estimated_read_time: int,
    course_title: str,
    language: str,
) -> str | None:
    """
    Render a narrated MP4 recap video (4 slides with ElevenLabs TTS + word-by-word
    text animation). Returns the absolute path to the saved file, or None on failure.
    """
    print(f"[generate_recap_video] called for lesson {lesson_number}: '{lesson_title}'")
    try:
        is_fr = (language or "").lower().startswith("fr")

        # ── Content generation (Groq) ──────────────────────────────────────────
        try:
            hook_prompt = (
                f"Donne 2 à 3 phrases expliquant des applications du monde réel où \"{lesson_title}\" est utilisé. "
                f"Pour chaque application mentionne une app ou technologie bien connue et explique comment ce concept s'y applique. "
                f"Maximum 50 mots au total. Réponds en français."
                if is_fr else
                f"Give 2 to 3 sentences explaining real-world applications where \"{lesson_title}\" is used. "
                f"For each application mention a specific well-known app or technology and explain how this concept applies to it. "
                f"Total maximum 50 words. Respond in English."
            )
            real_world_hook = groq_chat(hook_prompt, temperature=0.7, max_tokens=200).strip()
        except Exception:
            real_world_hook = (
                "Ce concept est utilisé dans de nombreuses applications modernes comme les bases de données et les frameworks web."
                if is_fr else
                "This concept is used in modern applications like databases and web frameworks."
            )

        try:
            takeaway_prompt = (
                f"Liste exactement 3 points clés qu'un étudiant doit retenir d'une leçon sur \"{lesson_title}\". "
                f"Format : 3 courtes affirmations commençant chacune par un tiret. Maximum 12 mots par point. Réponds en français."
                if is_fr else
                f"List exactly 3 key points a student must remember from a lesson about \"{lesson_title}\". "
                f"Format as 3 short statements each starting with a dash character. Each point maximum 12 words. Respond in English."
            )
            key_takeaway = groq_chat(takeaway_prompt, temperature=0.7, max_tokens=200).strip()
        except Exception:
            key_takeaway = (
                "- Maîtrisez les concepts fondamentaux avant d'avancer.\n- Pratiquez régulièrement avec des exemples concrets.\n- Reliez ce concept aux notions déjà apprises."
                if is_fr else
                "- Master the fundamentals before moving forward.\n- Practice regularly with concrete examples.\n- Connect this concept to what you already know."
            )

        try:
            tip_prompt = (
                f"Donne exactement 3 étapes pratiques qu'un étudiant peut suivre pour pratiquer et appliquer les concepts "
                f"d'une leçon sur \"{lesson_title}\". Format : 3 étapes numérotées courtes. Maximum 15 mots par étape. Réponds en français."
                if is_fr else
                f"Give exactly 3 practical steps a student can follow to practice and apply the concepts from a lesson "
                f"about \"{lesson_title}\". Format as 3 short numbered steps. Each step maximum 15 words. Respond in English."
            )
            practical_tip = groq_chat(tip_prompt, temperature=0.7, max_tokens=200).strip()
        except Exception:
            practical_tip = (
                "1. Lisez le résumé et identifiez les concepts clés.\n2. Créez un exemple simple.\n3. Expliquez le concept à voix haute."
                if is_fr else
                "1. Read the summary and identify the key concepts.\n2. Build a simple example.\n3. Explain the concept out loud."
            )

        try:
            challenge_prompt = (
                f"Formule une question de réflexion ouverte sur \"{lesson_title}\" pour préparer un étudiant à un quiz. "
                f"La question doit tester la compréhension profonde, pas la mémorisation. Maximum 25 mots. Réponds en français."
                if is_fr else
                f"Write one open-ended thinking question about \"{lesson_title}\" to prepare a student for a quiz. "
                f"The question should test deep understanding, not memorisation. Maximum 25 words. Respond in English."
            )
            challenge_question = groq_chat(challenge_prompt, temperature=0.7, max_tokens=100).strip()
        except Exception:
            challenge_question = (
                f"Comment appliqueriez-vous les concepts de \"{lesson_title}\" pour résoudre un problème concret ?"
                if is_fr else
                f"How would you apply the concepts of \"{lesson_title}\" to solve a real-world problem?"
            )

        # ── Narration scripts (Groq) ───────────────────────────────────────────
        scripts = generate_video_script(
            lesson_title=lesson_title,
            real_world_hook=real_world_hook,
            key_takeaway=key_takeaway,
            practical_tip=practical_tip,
            challenge_question=challenge_question,
            language=language,
        )

        # ── Slide configurations ───────────────────────────────────────────────
        GOLD_HEX   = "#f59e0b"
        INDIGO_HEX = "#6366f1"

        slide_configs = [
            {
                "title":      "Pourquoi apprendre ceci ?" if is_fr else "Why does this matter?",
                "accentColor": GOLD_HEX,
                "script":     scripts["slide1"],
            },
            {
                "title":      "À retenir" if is_fr else "Key Takeaway",
                "accentColor": INDIGO_HEX,
                "script":     scripts["slide2"],
            },
            {
                "title":      "Dans la pratique" if is_fr else "In Practice",
                "accentColor": GOLD_HEX,
                "script":     scripts["slide3"],
            },
            {
                "title":      "Défi avant le quiz" if is_fr else "Challenge before the quiz",
                "accentColor": "#a78bfa",
                "script":     scripts["slide4"],
            },
        ]

        # ── Generate audio for all 4 slides ───────────────────────────────────
        slide_audio_data = []
        for i, cfg in enumerate(slide_configs):
            slide_num = i + 1
            print(f"[generate_recap_video] generating audio for slide {slide_num}...")
            audio_path, word_ts = generate_slide_audio(
                slide_text=cfg["script"],
                language=language,
                slide_index=slide_num,
            )
            duration = _audio_duration_seconds(audio_path)
            slide_audio_data.append({
                "audioFilePath": audio_path,
                "words":         word_ts,
                "audioDurationSeconds": duration,
            })

        # ── Build VideoData JSON for Remotion ─────────────────────────────────
        video_data = {
            "lessonTitle":     lesson_title,
            "language":        "fr" if is_fr else "en",
            "flashcardCount":  len(flashcard_terms),
            "quizCount":       5,
            "estimatedReadTime": estimated_read_time,
            "slides": [
                {
                    "title":               slide_configs[i]["title"],
                    "accentColor":         slide_configs[i]["accentColor"],
                    "script":              slide_configs[i]["script"],
                    "words":               slide_audio_data[i]["words"],
                    "audioDurationSeconds": slide_audio_data[i]["audioDurationSeconds"],
                    "audioFilePath":       slide_audio_data[i]["audioFilePath"],
                }
                for i in range(4)
            ],
        }

        safe = re.sub(r"[^\w]", "_", lesson_title.encode("ascii", "ignore").decode())[:30]
        os.makedirs(os.path.join("uploads", "recap-videos"), exist_ok=True)

        json_path = os.path.abspath(
            os.path.join("uploads", "recap-videos", f"data_{lesson_number}_{safe}.json")
        )
        out = os.path.abspath(
            os.path.join("uploads", "recap-videos", f"lesson_{lesson_number}_{safe}.mp4")
        )

        with open(json_path, "w", encoding="utf-8") as jf:
            json.dump(video_data, jf, ensure_ascii=False, indent=2)

        # ── Call Remotion renderer ─────────────────────────────────────────────
        import subprocess
        project_dir = os.path.abspath(os.path.dirname(__file__))
        render_script = os.path.join(project_dir, "remotion-renderer", "render.mjs")

        print(f"[generate_recap_video] calling Remotion renderer → {out}")
        result = subprocess.run(
            ["node", render_script, "--data", json_path, "--output", out],
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=600,
        )

        if result.returncode != 0:
            print(f"[generate_recap_video] Remotion stderr:\n{result.stderr}")
            print(f"[generate_recap_video] Remotion stdout:\n{result.stdout}")
            return None

        print(result.stdout)

        # ── Cleanup ────────────────────────────────────────────────────────────
        try:
            os.remove(json_path)
        except Exception:
            pass
        for tmp in glob.glob(os.path.join("uploads", "recap-videos", "temp_slide_*.mp3")):
            try:
                os.remove(tmp)
            except Exception:
                pass

        print(f"[generate_recap_video] done — {os.path.getsize(out):,} bytes")
        return out

    except Exception as exc:
        print(f"[generate_recap_video] ERROR: {exc}")
        traceback.print_exc()
        return None



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


class GenerateLessonRecapRequest(BaseModel):
    lessonId: int
    lessonNumber: int
    lessonTitle: str
    flashcardTerms: list[str]
    lessonSummary: str
    estimatedReadTime: int
    courseTitle: str
    language: str  # "fr" or "en"


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


@app.post("/api/generate-lesson-recap")
async def generate_lesson_recap_endpoint(request: GenerateLessonRecapRequest):
    """Generate (or return cached) a recap video for a single lesson."""
    safe = re.sub(r"[^\w]", "_", request.lessonTitle.encode("ascii", "ignore").decode())[:30]
    expected_path = os.path.abspath(
        os.path.join("uploads", "recap-videos", f"lesson_{request.lessonNumber}_{safe}.mp4")
    )
    # Return cached file if it already exists
    if os.path.exists(expected_path):
        print(f"[generate-lesson-recap] cache hit: {expected_path}")
        return {"recapVideoPath": expected_path}
    # Generate
    try:
        path = generate_recap_video(
            lesson_number      = request.lessonNumber,
            lesson_title       = request.lessonTitle,
            flashcard_terms    = request.flashcardTerms,
            lesson_summary     = request.lessonSummary,
            estimated_read_time= request.estimatedReadTime,
            course_title       = request.courseTitle,
            language           = request.language,
        )
        return {"recapVideoPath": path}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Video generation failed: {str(e)}")


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

    # ── Course description ───────────────────────────────────────────────────────
    try:
        course_description = generate_course_description(text)
    except Exception:
        course_description = ""

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
        "courseTitle":       course_title,
        "courseDescription": course_description,
        "category":          category,
        "totalLessons":      len(lessons),
        "lessons":           lessons,
    }
    print(f"Done. Course \"{course_title}\" — category: \"{category}\" — {len(lessons)} lesson(s).")
    return result


# ─── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

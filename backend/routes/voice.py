"""Voice routes: transcribe, chat, tts, voice, voice/stream, voices."""
import asyncio
import base64
import binascii
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from services.language_detect import resolve_language
from services.stt import transcribe, transcribe_with_language
from services.tts import TTSError, get_tts_fallback_info, stream_tts, synthesize
from services.llm import LLMError, iter_sentences, stream_chat_completion
from config import diagnose
from my_agents.voice_agent import (
    BASE_INSTRUCTIONS,
    run_voice_agent,
    system_prompt_for_language,
)
from my_agents.teacher_agent import run_teacher_agent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["voice"])

# ---------------------------------------------------------------------------
# System prompts for the streaming voice loop.
#
# The non-streaming /chat and /voice routes delegate to the agents, which build
# their prompt from the selected language. The streamed route talks to Groq
# directly, so it needs the prompts here. INSTRUCTIONS is the default English
# prompt; URDU_INSTRUCTIONS makes the model answer in fluent Urdu script.
# ---------------------------------------------------------------------------
INSTRUCTIONS = system_prompt_for_language("en")

URDU_INSTRUCTIONS = system_prompt_for_language("ur")

TEACHER_INSTRUCTIONS = (
    "You are a patient, encouraging voice tutor. Explain one idea simply, "
    "correct mistakes kindly and keep the answer to 1-2 short spoken "
    "sentences. Always respond strictly in fluent English.\n" + BASE_INSTRUCTIONS
)

URDU_TEACHER_INSTRUCTIONS = (
    "آپ ایک صابر اور حوصلہ افزا وائس ٹیوٹر ہیں۔ ایک وقت میں صرف ایک بات سادہ انداز میں "
    "سمجھائیں، غلطی کی نرمی سے اصلاح کریں اور جواب 1-2 مختصر بولے جانے والے جملوں تک "
    "محدود رکھیں۔ جواب صرف اور صرف روان اردو میں دیں۔\n" + BASE_INSTRUCTIONS
)


def _system_prompt(mode: str, language: str) -> str:
    """Return the system prompt for the selected mode and language."""
    if language == "ur":
        return URDU_TEACHER_INSTRUCTIONS if mode == "teacher" else URDU_INSTRUCTIONS
    return TEACHER_INSTRUCTIONS if mode == "teacher" else INSTRUCTIONS


# The frontend sends "English"/"Urdu" labels (or "en"/"ur"/"auto"); accept
# both spellings and normalize to the short code the rest of the backend uses.
_LANGUAGE_ALIASES = {
    "en": "en",
    "english": "en",
    "ur": "ur",
    "urdu": "ur",
    "auto": "auto",
}


def normalize_language(raw: object) -> object:
    """Map a language label/code (any case) to 'en', 'ur' or 'auto'."""
    if not isinstance(raw, str):
        return raw
    return _LANGUAGE_ALIASES.get(raw.strip().lower(), raw)


class LanguageRequest(BaseModel):
    """Shared language field so every request accepts labels and codes.

    The default is "auto": the language is detected from the transcript, so a
    client that sends nothing still gets Urdu answers to Urdu speech.
    """

    language: str = Field(default="auto", pattern="^(en|ur|auto)$")

    @field_validator("language", mode="before")
    @classmethod
    def _normalize_language_field(cls, value: object) -> object:
        return normalize_language(value)


class ChatRequest(LanguageRequest):
    message: str = Field(..., min_length=1, max_length=4000)
    history: list[dict[str, str]] | None = None
    mode: str = Field(default="assistant", pattern="^(assistant|teacher)$")


class ChatResponse(BaseModel):
    reply: str


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    voice_id: str | None = None


class VoiceRequest(LanguageRequest):
    audio_base64: str = Field(..., min_length=1)
    # MIME type of the recording (e.g. "audio/webm;codecs=opus"), used so
    # Whisper receives a correctly named file.
    audio_mime: str | None = Field(default=None, max_length=120)
    history: list[dict[str, str]] | None = None
    mode: str = Field(default="assistant", pattern="^(assistant|teacher)$")


class VoiceResponse(BaseModel):
    transcript: str
    reply: str


class VoiceStreamRequest(VoiceRequest):
    """Same input as /voice, but the reply is streamed sentence by sentence."""

    voice_id: str | None = Field(default=None, max_length=80)


class ErrorResponse(BaseModel):
    detail: str
    error_code: str | None = None


def _parse_history(history: list[dict[str, str]] | None) -> list[dict[str, str]]:
    if not history:
        return []
    cleaned: list[dict[str, str]] = []
    for item in history:
        if not isinstance(item, dict):
            continue
        role = item.get("role", "user")
        content = item.get("content", "")
        if role not in ("user", "agent"):
            role = "user"
        if not isinstance(content, str) or not content.strip():
            continue
        cleaned.append({"role": role, "content": content.strip()})
    return cleaned


@router.get("/health")
async def health():
    """Health check endpoint with configuration diagnostics.

    Keys are returned as masked fingerprints, never in full.
    """
    report = diagnose()
    problems = list(report["problems"])
    return {
        "status": "ok" if not problems else "degraded",
        "service": "voice-agent-api",
        "env_file": report["env_file"],
        "groq_configured": report["groq_configured"],
        "groq_key": report["groq_key"],
        "groq_model": report["groq_model"],
        "elevenlabs_configured": report["elevenlabs_configured"],
        "elevenlabs_key": report["elevenlabs_key"],
        "elevenlabs_voice_id": report["elevenlabs_voice_id"],
        "elevenlabs_model": report["elevenlabs_model"],
        "warnings": [*problems, *report["warnings"]],
    }


@router.post(
    "/transcribe",
    response_model=dict[str, str],
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def api_transcribe(audio: UploadFile = File(...)):
    """Transcribe audio to text using Groq Whisper.

    Upload an audio file (WAV, MP3, M4A, etc.). Returns {"text": "..."}.
    """
    if not audio.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No audio file provided",
            headers={"X-Error-Code": "NO_AUDIO"},
        )

    try:
        audio_bytes = await audio.read()
        if not audio_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty audio file",
                headers={"X-Error-Code": "EMPTY_AUDIO"},
            )

        text = await transcribe(audio_bytes, mime_type=audio.content_type)
        if not text:
            return {"text": ""}
        return {"text": text}
    except RuntimeError as e:
        logger.warning(f"Transcribe runtime error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
            headers={"X-Error-Code": "TRANSCRIPTION_FAILED"},
        ) from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected transcribe error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Transcription failed unexpectedly",
            headers={"X-Error-Code": "TRANSCRIPTION_ERROR"},
        ) from e


@router.post(
    "/chat",
    response_model=ChatResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def api_chat(body: ChatRequest):
    """Chat with the agent. Returns {"reply": "..."}.

    Supports conversation history and language selection.
    """
    history = _parse_history(body.history)

    agent_lang = resolve_language(body.language, body.message)

    try:
        if body.mode == "teacher":
            reply = await run_teacher_agent(
                message=body.message,
                history=history,
                language=agent_lang,
            )
        else:
            reply = await run_voice_agent(
                message=body.message,
                history=history,
                language=agent_lang,
            )

        if not reply:
            reply = "I'm here! Ask me anything."

        return ChatResponse(reply=reply)
    except RuntimeError as e:
        logger.warning(f"Chat runtime error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
            headers={"X-Error-Code": "CHAT_FAILED"},
        ) from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected chat error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Chat request failed unexpectedly",
            headers={"X-Error-Code": "CHAT_ERROR"},
        ) from e


@router.post(
    "/tts",
    response_class=StreamingResponse,
    responses={
        400: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        429: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
async def api_tts(body: TTSRequest):
    """Text-to-speech streaming from ElevenLabs.

    Returns audio/mpeg stream. Falls back to 503 if key missing (frontend uses SpeechSynthesis).
    """
    try:
        response = await stream_tts(text=body.text, voice_id=body.voice_id)
        return response
    except TTSError as e:
        # Logged at error level (with the ElevenLabs request id) so the exact
        # cause is visible in the uvicorn terminal.
        logger.error("TTS failed [%s] (%s): %s", e.code, e.status_code, e.message)
        raise HTTPException(
            status_code=e.status_code,
            detail=e.message,
            headers={"X-Error-Code": e.code},
        ) from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected TTS error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="TTS request failed unexpectedly",
            headers={"X-Error-Code": "TTS_ERROR"},
        ) from e


@router.get("/tts/fallback-info")
async def tts_fallback_info():
    """Returns TTS availability info for frontend."""
    return get_tts_fallback_info()


@router.post(
    "/voice",
    response_model=VoiceResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def api_voice(body: VoiceRequest):
    """Voice interaction endpoint: transcribe audio then respond.

    Expects base64-encoded audio in the request body.
    Returns {"transcript": "...", "reply": "..."}.
    """
    import base64
    import binascii

    try:
        audio_bytes = base64.b64decode(body.audio_base64, validate=True)
    except (binascii.Error, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid base64 audio data",
            headers={"X-Error-Code": "INVALID_BASE64"},
        ) from e

    if not audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty audio data",
            headers={"X-Error-Code": "EMPTY_AUDIO"},
        )

    history = _parse_history(body.history)

    if body.language == "auto":
        lang_hint = None
    else:
        lang_hint = body.language

    try:
        transcript = await transcribe_with_language(
            audio_bytes,
            language=lang_hint,
            mime_type=body.audio_mime,
        )
    except RuntimeError as e:
        logger.warning(f"Transcribe in /voice failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
            headers={"X-Error-Code": "TRANSCRIPTION_FAILED"},
        ) from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected transcription error in /voice")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Transcription failed unexpectedly",
            headers={"X-Error-Code": "TRANSCRIPTION_ERROR"},
        ) from e

    history_for_agent = history + [{"role": "user", "content": transcript}]

    agent_lang = resolve_language(body.language, transcript)

    try:
        if body.mode == "teacher":
            reply = await run_teacher_agent(
                message=transcript,
                history=history_for_agent,
                language=agent_lang,
            )
        else:
            reply = await run_voice_agent(
                message=transcript,
                history=history_for_agent,
                language=agent_lang,
            )
    except RuntimeError as e:
        logger.warning(f"Voice agent in /voice failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
            headers={"X-Error-Code": "CHAT_FAILED"},
        ) from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected agent error in /voice")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Agent request failed unexpectedly",
            headers={"X-Error-Code": "CHAT_ERROR"},
        ) from e

    if not reply:
        reply = "I'm here! Ask me anything."

    return VoiceResponse(transcript=transcript, reply=reply)


def _ndjson(event: dict) -> str:
    """One newline-delimited JSON event for the streaming voice endpoint."""
    return json.dumps(event, ensure_ascii=False) + "\n"


async def _voice_event_stream(
    transcript: str,
    conversation: list[dict[str, str]],
    mode: str,
    voice_id: str | None,
    language: str,
) -> AsyncGenerator[str, None]:
    """Emit transcript + one audio chunk per sentence as the reply is written.

    The language model streams into sentences; each finished sentence is sent
    to ElevenLabs immediately, so playback starts after the first sentence
    instead of after the whole reply plus a full TTS round trip.

    ``language`` is the client's choice ("en", "ur" or "auto"); "auto" is
    resolved from the transcript. It selects the Groq system prompt (English
    or Urdu) and the TTS model (Urdu script needs the multilingual model).
    """
    reply_language = resolve_language(language, transcript)
    prompt = _system_prompt(mode, reply_language)
    logger.info(
        "Streaming turn | mode=%s requested=%s resolved=%s",
        mode,
        language,
        reply_language,
    )

    yield _ndjson(
        {"type": "transcript", "text": transcript, "language": reply_language}
    )

    sentences: asyncio.Queue[str | None] = asyncio.Queue()
    chunks: asyncio.Queue[tuple[int, str, bytes | None, str | None]] = asyncio.Queue()
    reply_parts: list[str] = []

    async def produce() -> None:
        try:
            async for sentence in iter_sentences(
                stream_chat_completion(prompt, transcript, conversation)
            ):
                reply_parts.append(sentence)
                await sentences.put(sentence)
        finally:
            await sentences.put(None)

    async def synthesize_all() -> None:
        index = 0
        while True:
            sentence = await sentences.get()
            if sentence is None:
                break
            audio: bytes | None = None
            error: str | None = None
            try:
                audio = await synthesize(
                    sentence, voice_id=voice_id, language=reply_language
                )
            except TTSError as e:
                logger.error("Sentence TTS failed [%s]: %s", e.code, e.message)
                error = e.message
            except Exception as e:  # pragma: no cover - defensive
                logger.exception("Unexpected sentence TTS error")
                error = f"Text to speech failed: {e}"
            await chunks.put((index, sentence, audio, error))
            index += 1
        await chunks.put((-1, "", None, None))

    producer = asyncio.create_task(produce())
    worker = asyncio.create_task(synthesize_all())

    try:
        while True:
            index, sentence, audio, error = await chunks.get()
            if index < 0:
                break
            event: dict[str, object] = {
                "type": "sentence",
                "index": index,
                "text": sentence,
            }
            if audio is not None:
                event["audio"] = base64.b64encode(audio).decode("ascii")
            if error:
                event["error"] = error
            yield _ndjson(event)

        results = await asyncio.gather(producer, return_exceptions=True)
        failure = results[0]
        if isinstance(failure, BaseException) and not isinstance(
            failure, asyncio.CancelledError
        ):
            logger.error("Streaming chat failed: %s", failure)
            message = (
                str(failure)
                if isinstance(failure, LLMError)
                else "The assistant could not reply. Please try again."
            )
            yield _ndjson({"type": "error", "detail": message, "code": "LLM_FAILED"})
            return

        reply = " ".join(part for part in reply_parts if part).strip()
        logger.info("Streamed reply | chars=%s sentences=%s", len(reply), len(reply_parts))
        yield _ndjson({"type": "done", "reply": reply})
    finally:
        for task in (producer, worker):
            if not task.done():
                task.cancel()


@router.post(
    "/voice/stream",
    responses={
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
async def api_voice_stream(body: VoiceStreamRequest):
    """Voice turn streamed as newline-delimited JSON.

    Events, in order:
    ``{"type": "transcript", "text": ..., "language": "en"|"ur"}`` once
    Whisper finishes (``language`` is the detected reply language when the
    request asked for ``"auto"``), then one
    ``{"type": "sentence", "index": n, "text": ..., "audio": <base64 mp3>}``
    per sentence as soon as it is synthesized (``error`` instead of ``audio``
    when ElevenLabs fails for that sentence), then ``{"type": "done",
    "reply": ...}``.

    Transcription still happens before the stream starts, so its failures are
    returned as normal HTTP errors.
    """
    try:
        audio_bytes = base64.b64decode(body.audio_base64, validate=True)
    except (binascii.Error, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid base64 audio data",
            headers={"X-Error-Code": "INVALID_BASE64"},
        ) from e

    if not audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty audio data",
            headers={"X-Error-Code": "EMPTY_AUDIO"},
        )

    history = _parse_history(body.history)
    lang_hint = None if body.language == "auto" else body.language

    try:
        transcript = await transcribe_with_language(
            audio_bytes,
            language=lang_hint,
            mime_type=body.audio_mime,
        )
    except RuntimeError as e:
        logger.warning("Transcribe in /voice/stream failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
            headers={"X-Error-Code": "TRANSCRIPTION_FAILED"},
        ) from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected transcription error in /voice/stream")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Transcription failed unexpectedly",
            headers={"X-Error-Code": "TRANSCRIPTION_ERROR"},
        ) from e

    if not transcript:
        logger.info("Streaming turn had no speech, nothing to answer")
        return StreamingResponse(
            iter(
                [
                    _ndjson({"type": "transcript", "text": ""}),
                    _ndjson({"type": "done", "reply": ""}),
                ]
            ),
            media_type="application/x-ndjson",
            headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
        )

    conversation = history + [{"role": "user", "content": transcript}]

    return StreamingResponse(
        _voice_event_stream(
            transcript, conversation, body.mode, body.voice_id, body.language
        ),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@router.get("/voices", response_model=list[dict[str, str]])
async def list_voices():
    """List available ElevenLabs voices (id, name, preview_url).

    Returns cached/stale list on error; frontend can still select from known voices.
    """
    if not __import__(
        "my_config.elevenlabs_config", fromlist=["ELEVENLABS_API_KEY"]
    ).ELEVENLABS_API_KEY:
        return _default_voices()

    from my_config.elevenlabs_config import ELEVENLABS_API_KEY, ELEVENLABS_BASE_URL

    import httpx

    url = f"{ELEVENLABS_BASE_URL}/voices"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                url,
                headers={"xi-api-key": ELEVENLABS_API_KEY},
            )
            if response.status_code != 200:
                logger.warning(
                    "ElevenLabs voices list returned %s: %s (using default list)",
                    response.status_code,
                    response.text[:200],
                )
                return _default_voices()
            data = response.json()
    except Exception as e:
        logger.warning(f"Failed to fetch ElevenLabs voices: {e}")
        return _default_voices()

    voices: list[dict[str, str]] = []
    items = data.get("voices", [])
    for item in items:
        if not isinstance(item, dict):
            continue
        voice_id = item.get("voice_id")
        name = item.get("name", voice_id or "Unknown")
        preview_url = item.get("preview_url")
        if voice_id:
            voices.append(
                {
                    "id": voice_id,
                    "name": name,
                    "preview_url": preview_url or "",
                }
            )

    if not voices:
        return _default_voices()

    voices.sort(key=lambda v: v["name"].lower())
    return voices


def _default_voices() -> list[dict[str, str]]:
    """Default voice list when ElevenLabs API is unavailable or key missing."""
    from my_config.elevenlabs_config import ELEVENLABS_VOICE_ID
    return [
        {
            "id": ELEVENLABS_VOICE_ID,
            "name": "Rachel",
            "preview_url": "",
        },
        {
            "id": "EXAVITQu4vr4xnSDxMaL",
            "name": "Adam",
            "preview_url": "",
        },
        {
            "id": "VR6AewLTigWG4xSOukaG",
            "name": "Bella",
            "preview_url": "",
        },
        {
            "id": "pNInz6obpgDQGcFmaJgB",
            "name": "Arnold",
            "preview_url": "",
        },
    ]

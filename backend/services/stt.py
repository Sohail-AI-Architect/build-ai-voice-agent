"""STT service using Groq Whisper via OpenAI-compatible endpoint."""
import logging
from typing import Optional

from my_config.groq_config import groq_client

logger = logging.getLogger(__name__)

# Groq Whisper accepts these container/codec combinations.
# The browser MediaRecorder usually produces audio/webm (Chrome, Firefox) or
# audio/mp4 (Safari), so the file name/extension must match the real bytes.
_MIME_TO_FILE = {
    "audio/webm": ("webm", "audio/webm"),
    "video/webm": ("webm", "audio/webm"),
    "audio/ogg": ("ogg", "audio/ogg"),
    "audio/oga": ("ogg", "audio/ogg"),
    "audio/mp4": ("m4a", "audio/mp4"),
    "audio/m4a": ("m4a", "audio/mp4"),
    "audio/x-m4a": ("m4a", "audio/mp4"),
    "audio/mpeg": ("mp3", "audio/mpeg"),
    "audio/mp3": ("mp3", "audio/mpeg"),
    "audio/wav": ("wav", "audio/wav"),
    "audio/x-wav": ("wav", "audio/wav"),
    "audio/wave": ("wav", "audio/wav"),
    "audio/flac": ("flac", "audio/flac"),
}


def audio_file(audio_bytes: bytes, mime_type: Optional[str] = None) -> tuple[str, bytes, str]:
    """Build the (filename, bytes, content_type) tuple Whisper expects.

    Falls back to WAV naming when the MIME type is unknown.
    """
    base_mime = (mime_type or "").split(";")[0].strip().lower()
    extension, content_type = _MIME_TO_FILE.get(base_mime, ("wav", "audio/wav"))
    return (f"audio.{extension}", audio_bytes, content_type)


def _extract_text(response: object) -> str:
    """Whisper returns a plain string for response_format="text".

    Older/newer SDK versions may instead return an object with a `.text`
    attribute, so handle both.
    """
    if isinstance(response, str):
        return response.strip()
    text = getattr(response, "text", "") or ""
    return str(text).strip()


async def transcribe(audio_bytes: bytes, mime_type: Optional[str] = None) -> str:
    """Transcribe audio bytes using Groq Whisper (whisper-large-v3-turbo).

    Args:
        audio_bytes: Raw audio bytes (typically WEBM/MP4/WAV from the browser).
        mime_type: MIME type of the recording, used to pick the right file name.

    Returns:
        Transcribed text string.

    Raises:
        RuntimeError: If transcription fails.
    """
    if groq_client is None:
        raise RuntimeError(
            "Groq client not configured. Set GROQ_API_KEY in backend/.env and restart."
        )
    if not audio_bytes:
        raise RuntimeError("Empty audio recording received")

    try:
        response = await groq_client.audio.transcriptions.create(
            model="whisper-large-v3-turbo",
            file=audio_file(audio_bytes, mime_type),
            language=None,  # Auto-detect
            temperature=0.0,
            response_format="text",
        )
        return _extract_text(response)
    except Exception as e:
        logger.error("Whisper transcription failed: %s", e)
        raise RuntimeError(f"Transcription failed: {e}") from e


async def transcribe_with_language(
    audio_bytes: bytes,
    language: Optional[str] = None,
    mime_type: Optional[str] = None,
) -> str:
    """Transcribe with optional language hint.

    Args:
        audio_bytes: Raw audio bytes.
        language: Optional language code (e.g., "ur" for Urdu).
        mime_type: MIME type of the recording.

    Returns:
        Transcribed text string.

    Raises:
        RuntimeError: If transcription fails.
    """
    if groq_client is None:
        raise RuntimeError(
            "Groq client not configured. Set GROQ_API_KEY in backend/.env and restart."
        )
    if not audio_bytes:
        raise RuntimeError("Empty audio recording received")

    try:
        response = await groq_client.audio.transcriptions.create(
            model="whisper-large-v3-turbo",
            file=audio_file(audio_bytes, mime_type),
            language=language,
            temperature=0.0,
            response_format="text",
        )
        return _extract_text(response)
    except Exception as e:
        logger.error("Whisper transcription failed: %s", e)
        raise RuntimeError(f"Transcription failed: {e}") from e

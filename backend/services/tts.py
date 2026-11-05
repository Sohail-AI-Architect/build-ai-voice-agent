"""TTS service: ElevenLabs text-to-speech streaming over httpx.

ElevenLabs failures are logged with the request id and surfaced with an
accurate message (invalid key vs. missing key permissions vs. bad voice id),
because a 401 from ElevenLabs does *not* always mean the key is invalid.
"""
import json
import logging
import time
from typing import AsyncGenerator, Optional

import httpx
from fastapi.responses import StreamingResponse

from my_config.elevenlabs_config import (
    ELEVENLABS_API_KEY,
    ELEVENLABS_BASE_URL,
    ELEVENLABS_MODEL_ID,
    ELEVENLABS_MULTILINGUAL_MODEL_ID,
    ELEVENLABS_OUTPUT_FORMAT,
    ELEVENLABS_TTS_STREAM_ENDPOINT,
    ELEVENLABS_VOICE_SETTINGS,
    ELEVENLABS_VOICE_ID,
    mask_key,
)

logger = logging.getLogger(__name__)

# Required scope for the TTS endpoint, used in permission error messages.
_TTS_PERMISSION = "text_to_speech"


class TTSError(Exception):
    """Base TTS error with an HTTP status code and machine-readable code."""

    def __init__(self, message: str, status_code: int = 500, code: str = "TTS_ERROR"):
        self.message = message
        self.status_code = status_code
        self.code = code
        super().__init__(message)


def _extract_error(body: str) -> tuple[Optional[int], dict]:
    """Pull the ElevenLabs error object out of a response body.

    ElevenLabs returns ``{"detail": {"code": "...", "message": "...",
    "request_id": "..."}}`` for API errors and ``{"detail": "..."}`` or
    ``{"message": "..."}`` for some older endpoints.
    """
    try:
        data = json.loads(body)
    except (ValueError, TypeError):
        return None, {}

    if isinstance(data, dict):
        detail = data.get("detail")
        if isinstance(detail, dict):
            return None, detail
        if isinstance(detail, str):
            return None, {"message": detail}
        if isinstance(data.get("message"), str):
            return None, {"message": data["message"]}
    return None, {}


def _permission_from_message(message: str) -> Optional[str]:
    marker = "missing the permission"
    if marker not in message:
        return None
    tail = message.split(marker, 1)[1]
    token = tail.strip().split()[0] if tail.strip() else ""
    return token.strip(".,'\"") or None


def build_tts_error(status_code: int, body: str) -> TTSError:
    """Translate an ElevenLabs error response into an actionable TTSError."""
    _, detail = _extract_error(body)
    api_code = str(detail.get("code") or detail.get("status") or "")
    api_message = str(detail.get("message") or "").strip()
    request_id = detail.get("request_id") or "unknown"

    logger.error(
        "ElevenLabs TTS failed | status=%s code=%s request_id=%s key=%s message=%s",
        status_code,
        api_code or "n/a",
        request_id,
        mask_key(ELEVENLABS_API_KEY),
        api_message or body[:200],
    )

    if status_code == 401:
        permission = _permission_from_message(api_message)
        if permission:
            return TTSError(
                "ElevenLabs rejected the request: this API key is valid but is "
                f"missing the '{permission}' permission. In ElevenLabs -> "
                "Developers -> API keys, edit the key (or create a new one) and "
                "enable text_to_speech (plus voices_read and user_read), then "
                "paste it into backend/.env and restart the server.",
                status_code=401,
                code="ELEVENLABS_MISSING_PERMISSION",
            )
        if "quota" in api_message.lower() or api_code == "quota_exceeded":
            return TTSError(
                "ElevenLabs quota exceeded for this API key.",
                status_code=402,
                code="ELEVENLABS_QUOTA",
            )
        return TTSError(
            "ElevenLabs rejected the API key (invalid or disabled). Check "
            f"ELEVENLABS_API_KEY in backend/.env. Key in use: "
            f"{mask_key(ELEVENLABS_API_KEY)}.",
            status_code=401,
            code="ELEVENLABS_INVALID_KEY",
        )

    if status_code == 402:
        return TTSError(
            "ElevenLabs quota exceeded for this API key. Check your plan usage.",
            status_code=402,
            code="ELEVENLABS_QUOTA",
        )
    if status_code == 404:
        return TTSError(
            f"ElevenLabs could not find voice '{ELEVENLABS_VOICE_ID}' or model "
            f"'{ELEVENLABS_MODEL_ID}'. Set ELEVENLABS_VOICE_ID to a voice your "
            "account can use.",
            status_code=404,
            code="ELEVENLABS_NOT_FOUND",
        )
    if status_code == 422:
        return TTSError(
            "ElevenLabs rejected the request parameters (text, model or voice "
            f"settings): {api_message or 'invalid payload'}",
            status_code=422,
            code="ELEVENLABS_BAD_REQUEST",
        )
    if status_code == 429:
        return TTSError(
            "ElevenLabs rate limit exceeded. Wait a moment and try again.",
            status_code=429,
            code="ELEVENLABS_RATE_LIMIT",
        )

    return TTSError(
        f"ElevenLabs error {status_code}: {api_message or body[:200]}",
        status_code=status_code if 400 <= status_code < 600 else 502,
        code="ELEVENLABS_ERROR",
    )


def _tts_secret_headers() -> dict[str, str]:
    return {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }


def model_id_for_language(language: Optional[str]) -> str:
    """Return the ElevenLabs model that can pronounce the given language.

    Urdu is written in Arabic script, which the English-only flash/turbo
    models mispronounce, so Urdu always uses ``eleven_multilingual_v2``.
    Everything else keeps the model configured via ``ELEVENLABS_MODEL_ID``.
    """
    if language == "ur":
        return ELEVENLABS_MULTILINGUAL_MODEL_ID
    return ELEVENLABS_MODEL_ID


def _tts_url(voice_id: Optional[str]) -> tuple[str, str]:
    vid = voice_id or ELEVENLABS_VOICE_ID
    url = ELEVENLABS_TTS_STREAM_ENDPOINT.format(
        base=ELEVENLABS_BASE_URL, voice_id=vid
    )
    return vid, url


async def synthesize(
    text: str,
    voice_id: Optional[str] = None,
    language: Optional[str] = None,
) -> bytes:
    """Synthesize one short text chunk and return the complete MP3 bytes.

    Used by the sentence-streaming voice endpoint: each sentence is spoken as
    soon as the language model finishes it, instead of waiting for the whole
    reply.

    Args:
        text: Text to speak.
        voice_id: Optional voice id, defaults to ELEVENLABS_VOICE_ID.
        language: Reply language ('en'/'ur'); Urdu forces the multilingual model.

    Raises:
        TTSError: On missing key or any ElevenLabs API error.
    """
    if not ELEVENLABS_API_KEY:
        raise TTSError(
            "ElevenLabs API key not configured. Add ELEVENLABS_API_KEY=... to "
            "backend/.env and restart the server.",
            status_code=503,
            code="ELEVENLABS_NO_KEY",
        )

    vid, url = _tts_url(voice_id)
    model_id = model_id_for_language(language)
    payload = {
        "text": text,
        "model_id": model_id,
        "voice_settings": ELEVENLABS_VOICE_SETTINGS,
    }
    started = time.perf_counter()

    try:
        async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
            response = await client.post(
                url,
                params={"output_format": ELEVENLABS_OUTPUT_FORMAT},
                json=payload,
                headers=_tts_secret_headers(),
            )
    except httpx.TimeoutException as e:
        logger.error("ElevenLabs TTS chunk timed out after %.1fs", time.perf_counter() - started)
        raise TTSError(
            "ElevenLabs request timed out. Try a shorter reply.",
            status_code=504,
            code="ELEVENLABS_TIMEOUT",
        ) from e
    except httpx.RequestError as e:
        logger.error("ElevenLabs TTS chunk connection error: %s", e)
        raise TTSError(
            f"Could not connect to ElevenLabs: {e}",
            status_code=502,
            code="ELEVENLABS_UNREACHABLE",
        ) from e

    if response.status_code != 200:
        raise build_tts_error(
            response.status_code, response.content.decode("utf-8", errors="replace")
        )

    audio = response.content
    if not audio:
        raise TTSError(
            "ElevenLabs returned empty audio for a sentence.",
            status_code=502,
            code="ELEVENLABS_EMPTY_AUDIO",
        )

    logger.info(
        "ElevenLabs TTS chunk complete | voice=%s model=%s chars=%s bytes=%s "
        "duration=%.2fs",
        vid,
        model_id,
        len(text),
        len(audio),
        time.perf_counter() - started,
    )
    return audio


async def stream_tts(
    text: str,
    voice_id: Optional[str] = None,
) -> StreamingResponse:
    """Stream MP3 audio from ElevenLabs.

    Args:
        text: Text to synthesize.
        voice_id: Optional voice id, defaults to ELEVENLABS_VOICE_ID.

    Returns:
        StreamingResponse with audio/mpeg media type.

    Raises:
        TTSError: On missing key or any ElevenLabs API error.
    """
    if not ELEVENLABS_API_KEY:
        raise TTSError(
            "ElevenLabs API key not configured. Add ELEVENLABS_API_KEY=... to "
            "backend/.env and restart the server.",
            status_code=503,
            code="ELEVENLABS_NO_KEY",
        )

    vid, url = _tts_url(voice_id)
    params = {"output_format": ELEVENLABS_OUTPUT_FORMAT}
    payload = {
        "text": text,
        "model_id": ELEVENLABS_MODEL_ID,
        "voice_settings": ELEVENLABS_VOICE_SETTINGS,
    }
    headers = _tts_secret_headers()

    logger.info(
        "ElevenLabs TTS request | voice=%s model=%s format=%s chars=%s key=%s",
        vid,
        ELEVENLABS_MODEL_ID,
        ELEVENLABS_OUTPUT_FORMAT,
        len(text),
        mask_key(ELEVENLABS_API_KEY),
    )
    started = time.perf_counter()

    client = httpx.AsyncClient(timeout=60.0, follow_redirects=True)

    try:
        request = client.build_request(
            "POST", url, params=params, json=payload, headers=headers
        )
        response = await client.send(request, stream=True)
    except httpx.TimeoutException as e:
        await client.aclose()
        logger.error("ElevenLabs TTS timed out after %.1fs", time.perf_counter() - started)
        raise TTSError(
            "ElevenLabs request timed out. Try a shorter reply.",
            status_code=504,
            code="ELEVENLABS_TIMEOUT",
        ) from e
    except httpx.RequestError as e:
        await client.aclose()
        logger.error("ElevenLabs TTS connection error: %s", e)
        raise TTSError(
            f"Could not connect to ElevenLabs: {e}", status_code=502, code="ELEVENLABS_UNREACHABLE"
        ) from e

    if response.status_code != 200:
        body = (await response.aread()).decode("utf-8", errors="replace")
        await response.aclose()
        await client.aclose()
        raise build_tts_error(response.status_code, body)

    request_id = response.headers.get("request-id") or response.headers.get(
        "x-request-id", "n/a"
    )
    logger.info(
        "ElevenLabs TTS streaming | status=200 request_id=%s content_type=%s",
        request_id,
        response.headers.get("content-type", "unknown"),
    )

    async def audio_stream() -> AsyncGenerator[bytes, None]:
        total = 0
        try:
            async for chunk in response.aiter_bytes():
                total += len(chunk)
                yield chunk
            logger.info(
                "ElevenLabs TTS complete | bytes=%s duration=%.2fs request_id=%s",
                total,
                time.perf_counter() - started,
                request_id,
            )
        except Exception as e:  # pragma: no cover - client disconnect etc.
            logger.warning("ElevenLabs TTS stream interrupted after %s bytes: %s", total, e)
        finally:
            await response.aclose()
            await client.aclose()

    return StreamingResponse(
        audio_stream(),
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline; filename=speech.mp3",
            "Cache-Control": "no-store",
        },
    )


def get_tts_fallback_info() -> dict:
    """Return TTS availability info for the frontend."""
    return {
        "has_key": bool(ELEVENLABS_API_KEY),
        "key_hint": mask_key(ELEVENLABS_API_KEY),
        "voice_id": ELEVENLABS_VOICE_ID,
        "model_id": ELEVENLABS_MODEL_ID,
        "output_format": ELEVENLABS_OUTPUT_FORMAT,
    }

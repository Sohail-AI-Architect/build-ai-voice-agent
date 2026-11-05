"""Groq client configuration (OpenAI-compatible endpoint)."""
import logging

from agents import AsyncOpenAI

from config import GROQ_API_KEY, GROQ_BASE_URL, GROQ_MODEL_NAME, mask_key

logger = logging.getLogger(__name__)

groq_client: AsyncOpenAI | None = None

if GROQ_API_KEY:
    groq_client = AsyncOpenAI(api_key=GROQ_API_KEY, base_url=GROQ_BASE_URL)
    logger.debug(
        "Groq client ready (key %s, base_url %s)", mask_key(GROQ_API_KEY), GROQ_BASE_URL
    )
else:
    logger.warning(
        "GROQ_API_KEY is empty. Transcription and chat are disabled until it is "
        "added to backend/.env."
    )

__all__ = ["GROQ_API_KEY", "GROQ_BASE_URL", "GROQ_MODEL_NAME", "groq_client"]

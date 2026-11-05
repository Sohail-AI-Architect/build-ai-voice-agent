"""Central environment loader for the voice agent backend.

Why this module exists
----------------------
`python-decouple` searches for `.env` starting from the *importing module's*
directory, so values can silently differ depending on how the server is
started (``uvicorn main:app`` vs ``python main.py`` vs a test run). It also
keeps surrounding quotes/spaces exactly as typed, which produces the classic
"401 Invalid API key" when a key is pasted as ``KEY="sk_..."`` (with a space
before the quote) or contains a zero-width character.

This module fixes both problems:

* ``backend/.env`` is loaded by absolute path with ``python-dotenv``, so it is
  found regardless of the current working directory.
* every value goes through :func:`clean_value`, which strips BOM / zero-width
  characters, surrounding quotes, accidental ``Bearer``/``xi-api-key:``
  prefixes and whitespace.
* :func:`diagnose` reports *why* a key looks wrong without ever printing it.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parent
ENV_PATH = BACKEND_DIR / ".env"

# Load .env once, by absolute path. `override=False` keeps real environment
# variables (Docker/CI/shell exports) authoritative over the file.
if ENV_PATH.is_file():
    load_dotenv(dotenv_path=ENV_PATH, override=False, encoding="utf-8-sig")
else:  # pragma: no cover - informational only
    logger.warning(
        "No .env file found at %s. Falling back to process environment "
        "variables. Copy backend/.env.example to backend/.env and add keys.",
        ENV_PATH,
    )

# Characters that are invisible in an editor but break HTTP headers.
_INVISIBLE_CHARS = {
    ord(c): None
    for c in (
        "\u200b",  # zero width space
        "\u200c",  # zero width non-joiner
        "\u200d",  # zero width joiner
        "\u2060",  # word joiner
        "\ufeff",  # BOM
        "\u00a0",  # non-breaking space
    )
}

# Prefixes users accidentally paste along with the key itself.
_PREFIX_JUNK = re.compile(
    r"^(?:xi-api-key|api[-_]?key|authorization|bearer|token)\s*[:=]?\s*",
    re.IGNORECASE,
)


def clean_value(raw: str | None) -> str:
    """Normalize an env value: no BOM, quotes, invisible chars or padding.

    ``' \"sk_abc\" '`` -> ``sk_abc``
    """
    if raw is None:
        return ""

    value = str(raw).strip().lstrip("\ufeff")
    value = value.translate(_INVISIBLE_CHARS)
    value = value.strip()

    # Remove one or more pairs of matching surrounding quotes. Handles
    # KEY="sk_abc" and KEY='"sk_abc"' and KEY='sk_abc ' .
    while len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1].strip()

    # Drop a pasted header prefix ("xi-api-key: sk_..." / "Bearer sk_...").
    stripped = _PREFIX_JUNK.sub("", value, count=1)
    if stripped != value:
        value = stripped.strip().strip("\"'").strip()

    return value


def _env(name: str, default: str = "") -> str:
    """Read, clean and validate a single environment variable."""
    raw = os.environ.get(name)
    if raw is None:
        return clean_value(default)

    value = clean_value(raw)
    if value != raw.strip():
        logger.warning(
            "Environment variable %s contained stray whitespace, quotes or "
            "invisible characters. The cleaned value is being used.",
            name,
        )
    return value or clean_value(default)


def _env_bool(name: str, default: bool = False) -> bool:
    value = _env(name, "true" if default else "false").lower()
    return value in {"1", "true", "yes", "on", "y"}


def _env_int(name: str, default: int) -> int:
    value = _env(name, str(default))
    try:
        return int(value)
    except ValueError:
        logger.warning("Invalid integer for %s=%r, using %s", name, value, default)
        return default


def mask_key(value: str) -> str:
    """Return a log-safe fingerprint such as ``sk_7...31cd (51 chars)``."""
    if not value:
        return "(not set)"
    if len(value) <= 8:
        return f"{value[:2]}...{value[-2:]} ({len(value)} chars)"
    return f"{value[:4]}...{value[-4:]} ({len(value)} chars)"


@dataclass(frozen=True)
class Settings:
    """Typed, sanitized application configuration."""

    groq_api_key: str
    groq_base_url: str
    groq_model_name: str

    elevenlabs_api_key: str
    elevenlabs_voice_id: str
    elevenlabs_model_id: str
    elevenlabs_base_url: str
    elevenlabs_output_format: str

    host: str
    port: int
    reload: bool

    frontend_origins: tuple[str, ...]
    cors_allow_all_origins: bool

    @property
    def groq_configured(self) -> bool:
        return bool(self.groq_api_key)

    @property
    def elevenlabs_configured(self) -> bool:
        return bool(self.elevenlabs_api_key)


def _load_settings() -> Settings:
    origins = tuple(
        clean_value(origin)
        for origin in _env("FRONTEND_ORIGINS").split(",")
        if clean_value(origin)
    )
    return Settings(
        groq_api_key=_env("GROQ_API_KEY"),
        groq_base_url=_env("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
        # A fast, instruction-following model keeps replies in English and
        # starts audio playback sooner. allam-2-7b drifts into Arabic.
        groq_model_name=_env("GROQ_MODEL_NAME", "openai/gpt-oss-20b"),
        elevenlabs_api_key=_env("ELEVENLABS_API_KEY"),
        elevenlabs_voice_id=_env(
            "ELEVENLABS_VOICE_ID", "21m00Tcm4FMlY31M2d8D"
        ),
        # Multilingual model: Urdu is spoken in Arabic script, which the
        # English-only flash/turbo models mispronounce.
        elevenlabs_model_id=_env(
            "ELEVENLABS_MODEL_ID", "eleven_multilingual_v2"
        ),
        elevenlabs_base_url=_env(
            "ELEVENLABS_BASE_URL", "https://api.elevenlabs.io/v1"
        ).rstrip("/"),
        elevenlabs_output_format=_env(
            "ELEVENLABS_OUTPUT_FORMAT", "mp3_44100_128"
        ),
        host=_env("HOST", "0.0.0.0"),
        port=_env_int("PORT", 8000),
        reload=_env_bool("RELOAD", False),
        frontend_origins=origins,
        # Local development defaults to allow-all (the requested behaviour).
        # Set CORS_ALLOW_ALL_ORIGINS=false to lock CORS down to localhost.
        cors_allow_all_origins=_env_bool("CORS_ALLOW_ALL_ORIGINS", True),
    )


settings = _load_settings()

# Convenience module-level constants (same names the rest of the code uses).
GROQ_API_KEY = settings.groq_api_key
GROQ_BASE_URL = settings.groq_base_url
GROQ_MODEL_NAME = settings.groq_model_name

ELEVENLABS_API_KEY = settings.elevenlabs_api_key
ELEVENLABS_VOICE_ID = settings.elevenlabs_voice_id
ELEVENLABS_MODEL_ID = settings.elevenlabs_model_id
ELEVENLABS_BASE_URL = settings.elevenlabs_base_url
ELEVENLABS_OUTPUT_FORMAT = settings.elevenlabs_output_format

# Browsers treat localhost and 127.0.0.1 as different origins, and Next.js
# switches to 3001 when 3000 is taken, so all four are allowed by default.
DEFAULT_FRONTEND_ORIGINS: tuple[str, ...] = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
)


def allowed_origins() -> list[str]:
    """Return the CORS origin list.

    ``CORS_ALLOW_ALL_ORIGINS=true`` (or ``FRONTEND_ORIGINS=*``) yields ``["*"]``.
    Starlette mirrors the request Origin when ``*`` is combined with
    ``allow_credentials=True``, because browsers reject a literal ``*`` on
    credentialed responses.
    """
    if settings.cors_allow_all_origins or "*" in settings.frontend_origins:
        return ["*"]
    return list(dict.fromkeys((*DEFAULT_FRONTEND_ORIGINS, *settings.frontend_origins)))


def diagnose() -> dict[str, object]:
    """Return a log-safe configuration report used at startup and by /api/health."""
    problems: list[str] = []
    warnings: list[str] = []

    groq = settings.groq_api_key
    if not groq:
        problems.append("GROQ_API_KEY is not set (STT and chat will fail).")
    elif not groq.startswith("gsk_"):
        warnings.append(
            "GROQ_API_KEY does not start with 'gsk_'. Copy the full key from "
            "https://console.groq.com/keys."
        )

    eleven = settings.elevenlabs_api_key
    if not eleven:
        problems.append(
            "ELEVENLABS_API_KEY is not set (TTS falls back to the browser voice)."
        )

    return {
        "env_file": str(ENV_PATH),
        "env_file_loaded": ENV_PATH.is_file(),
        "groq_configured": bool(groq),
        "groq_key": mask_key(groq),
        "groq_model": settings.groq_model_name,
        "elevenlabs_configured": bool(eleven),
        "elevenlabs_key": mask_key(eleven),
        "elevenlabs_voice_id": settings.elevenlabs_voice_id,
        "elevenlabs_model": settings.elevenlabs_model_id,
        "problems": problems,
        "warnings": warnings,
    }

"""FastAPI application for the AI Voice Agent.

Configuration comes from backend/config.py, which loads backend/.env by
absolute path and sanitizes every value (quotes, trailing spaces, BOM).
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import allowed_origins, diagnose, settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("voice-agent")

# CORS allow-list. Defaults to the local development origins; the Vercel
# frontend is added explicitly so production CORS works without "*"+
# allow_credentials=True.
ALLOWED_ORIGINS = allowed_origins()
_VERCEL_FRONTEND_ORIGIN = settings.vercel_frontend_origin
if _VERCEL_FRONTEND_ORIGIN not in ALLOWED_ORIGINS:
    if ALLOWED_ORIGINS == ["*"]:
        # allow-all already covers everything; append the Vercel origin so the
        # deploy log can name it and a narrow config can still see it.
        ALLOWED_ORIGINS = ["*", _VERCEL_FRONTEND_ORIGIN]
    else:
        ALLOWED_ORIGINS = list(dict.fromkeys(
            ALLOWED_ORIGINS + [_VERCEL_FRONTEND_ORIGIN]
        ))


def _log_config_status() -> None:
    """Log the effective configuration, with masked keys, at startup."""
    report = diagnose()

    logger.info("Loading configuration from %s (found: %s)", report["env_file"], report["env_file_loaded"])

    logger.info("GROQ_API_KEY: %s", report["groq_key"])
    logger.info("GROQ model: %s", report["groq_model"])
    logger.info("ELEVENLABS_API_KEY: %s", report["elevenlabs_key"])
    logger.info(
        "ElevenLabs voice: %s | model: %s",
        report["elevenlabs_voice_id"],
        report["elevenlabs_model"],
    )

    for problem in report["problems"]:  # type: ignore[union-attr]
        logger.error(problem)
    for warning in report["warnings"]:  # type: ignore[union-attr]
        logger.warning(warning)

    if ALLOWED_ORIGINS == ["*"]:
        logger.info(
            "CORS: allowing all origins with credentials (Starlette mirrors the "
            "request Origin). Set CORS_ALLOW_ALL_ORIGINS=false to restrict to "
            "localhost:3000/3001."
        )
    else:
        logger.info("CORS allowed origins: %s", ", ".join(ALLOWED_ORIGINS))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan handler for startup/shutdown."""
    logger.info("Voice Agent API starting up...")
    _log_config_status()
    yield
    logger.info("Voice Agent API shutting down...")


app = FastAPI(
    title="AI Voice Agent API",
    description="Voice agent backend with STT, TTS, and chat capabilities",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for the Next.js frontend on http://localhost:3000 (or 3001 if 3000 is
# taken). With allow_origins=["*"] + allow_credentials=True, Starlette echoes
# the request's Origin header instead of a literal "*", which is what browsers
# require for credentialed requests.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Import routes after app creation to avoid circular imports.
from routes.voice import router as voice_router  # noqa: E402

app.include_router(voice_router)


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "AI Voice Agent API",
        "version": "1.0.0",
        "docs": "/docs",
    }


def main():
    """Run the server with uvicorn."""
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level="info",
    )


if __name__ == "__main__":
    main()

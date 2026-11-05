"""ElevenLabs TTS configuration."""
from config import (
    ELEVENLABS_API_KEY,
    ELEVENLABS_BASE_URL,
    ELEVENLABS_MODEL_ID,
    ELEVENLABS_OUTPUT_FORMAT,
    ELEVENLABS_VOICE_ID,
    mask_key,
)

# Endpoint shapes documented at
# https://elevenlabs.io/docs/api-reference/text-to-speech/convert
# Streaming variant is used by services/tts.py so audio starts playing before
# the whole clip has been synthesised.
ELEVENLABS_TTS_ENDPOINT = "{base}/text-to-speech/{voice_id}"
ELEVENLABS_TTS_STREAM_ENDPOINT = "{base}/text-to-speech/{voice_id}/stream"

# Urdu (and other non-English) scripts must be voiced by the multilingual
# model; the flash/turbo models are English-only and mangle the script.
ELEVENLABS_MULTILINGUAL_MODEL_ID = "eleven_multilingual_v2"

# Voice settings for TTS
ELEVENLABS_VOICE_SETTINGS = {
    "stability": 0.5,
    "similarity_boost": 0.75,
}

__all__ = [
    "ELEVENLABS_API_KEY",
    "ELEVENLABS_BASE_URL",
    "ELEVENLABS_MODEL_ID",
    "ELEVENLABS_MULTILINGUAL_MODEL_ID",
    "ELEVENLABS_OUTPUT_FORMAT",
    "ELEVENLABS_VOICE_SETTINGS",
    "ELEVENLABS_VOICE_ID",
    "ELEVENLABS_TTS_ENDPOINT",
    "ELEVENLABS_TTS_STREAM_ENDPOINT",
    "mask_key",
]

"""Transcript-based language detection for the voice and chat agents.

The frontend no longer asks the user to pick a language: it sends ``"auto"``
and the reply language is inferred from the text Whisper produced (or the text
the user typed). Urdu is written in Arabic script, so counting script
characters is enough and costs no extra model call.
"""
import re

_ARABIC_SCRIPT = re.compile(
    r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]"
)
_LATIN_LETTER = re.compile(r"[A-Za-z]")

# Urdu only needs a modest share of the text: a mixed sentence such as
# "میں ٹھیک ہوں thanks" should still be answered in Urdu.
_URDU_RATIO = 0.2


def detect_language(text: str | None) -> str:
    """Return "ur" for Arabic-script (Urdu) text, otherwise "en"."""
    if not text:
        return "en"
    arabic = len(_ARABIC_SCRIPT.findall(text))
    if not arabic:
        return "en"
    latin = len(_LATIN_LETTER.findall(text))
    return "ur" if arabic / (arabic + latin) >= _URDU_RATIO else "en"


def resolve_language(requested: str | None, text: str | None) -> str:
    """Honour an explicit "en"/"ur" choice, otherwise detect it from ``text``."""
    if requested in ("en", "ur"):
        return requested
    return detect_language(text)

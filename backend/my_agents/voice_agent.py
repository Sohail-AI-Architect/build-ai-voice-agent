"""Voice agent - dynamic-language conversational assistant for voice calls."""

import logging

from services.llm import LLMError, chat_completion

logger = logging.getLogger(__name__)


# Language-neutral base instructions: the style rules that apply in every
# language. These are appended after the language instruction.
BASE_INSTRUCTIONS = """You are a helpful, natural AI voice assistant. Respond naturally and conversationally. Keep answers short (1-2 sentences), fluent and spoken-style for fast audio playback.
TONE: Warm, calm and helpful, like a friendly person on a phone call.
If you don't know something, say so in one sentence and offer one next step.
STYLE (strict):
- Plain spoken prose only: no markdown, no **bold**, no *italics*, no `code`.
- No emojis, no smileys, no bullet points, no numbered lists, no URLs.
- If the user asks for a list, name at most two items inside one sentence.
- Use simple, everyday words and natural contractions."""


def _english_instructions(base_prompt: str) -> str:
    """Wrap a base prompt so the agent replies in English."""
    return (
        "You are a helpful, natural AI voice assistant. "
        "Always respond strictly in fluent English in 1-2 short conversational sentences. "
        + base_prompt
    )


def _urdu_instructions(base_prompt: str) -> str:
    """Wrap a base prompt so the agent replies in Urdu."""
    return (
        "آپ ایک ماہر AI وائس اسسٹنٹ ہیں۔ آپ کو صارف کے تمام سوالات کے جوابات صرف اور صرف روان اردو زبان میں دینے ہیں۔ "
        "اپنے جوابات مختصر، گفتگو کے انداز میں اور 1-2 جملوں تک محدود رکھیں۔ "
        + base_prompt
    )


def system_prompt_for_language(language: str) -> str:
    """Return the exact system prompt for the user-selected language.

    * 'en' -> English prompt (spoken in English).
    * 'ur' -> Urdu prompt (spoken in Urdu).
    * anything else (incl. 'auto' / '') -> language-neutral prompt, so the
      model follows the user's own language.
    """
    if language == "ur":
        return _urdu_instructions(BASE_INSTRUCTIONS)
    if language == "en":
        return _english_instructions(BASE_INSTRUCTIONS)
    return BASE_INSTRUCTIONS


async def run_voice_agent(
    message: str,
    history: list[dict[str, str]] | None = None,
    language: str = "en",
) -> str:
    """Run the voice assistant on one message.

    The system prompt is resolved from ``language`` before being passed to the
    language model, so ``language="ur"`` produces Urdu replies and
    ``language="en"`` produces English replies. ``language="auto"`` follows the
    user's language.
    """
    try:
        prompt = system_prompt_for_language(language)
        return await chat_completion(prompt, message, history)
    except LLMError as e:
        logger.error("Voice agent failed: %s", e)
        return "Sorry, I had trouble processing that. Could you try again?"


async def run_teacher_agent(
    message: str,
    history: list[dict[str, str]] | None = None,
    language: str = "en",
) -> str:
    """Run the tutor assistant on one message.

    The system prompt is resolved from ``language`` before being passed to the
    language model, so ``language="ur"`` produces Urdu replies and
    ``language="en"`` produces English replies. ``language="auto"`` follows the
    user's language.
    """
    try:
        prompt = system_prompt_for_language(language)
        return await chat_completion(prompt, message, history)
    except LLMError as e:
        logger.error("Teacher agent failed: %s", e)
        return "Sorry, I had trouble with that. Can you try asking again?"


__all__ = [
    "system_prompt_for_language",
    "run_voice_agent",
    "run_teacher_agent",
]

"""Teacher agent - dynamic-language voice tutor."""

import logging

from my_agents.voice_agent import system_prompt_for_language
from services.llm import LLMError, chat_completion

logger = logging.getLogger(__name__)


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


__all__ = ["run_teacher_agent"]

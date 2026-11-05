"""Minimal Groq chat-completions client.

The OpenAI Agents SDK strips provider prefixes such as ``openai/`` from model
names, so ``openai/gpt-oss-20b`` became ``gpt-oss-20b`` and Groq answered 404.
Calling the OpenAI-compatible endpoint directly keeps the model id intact and
gives the system instruction full control over the reply language.
"""
from __future__ import annotations

import json
import logging
import re
from typing import AsyncGenerator

import httpx

from config import GROQ_API_KEY, GROQ_BASE_URL, GROQ_MODEL_NAME, mask_key

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Raised when the Groq chat request cannot be completed."""


def _resolved_system_prompt(base_prompt: str, effective_language: str) -> str:
    """Return the system prompt with a dynamic language section for the user.

    * ``"ur"`` -> the Urdu prompt from the user request (spoken in Urdu).
    * ``"en"`` -> the English prompt (spoken in English).
    * anything else (including empty) -> base prompt unchanged; the model
      follows the user's input language.
    """
    if effective_language == "ur":
        return _URDU_SYSTEM_PROMPT(base_prompt)
    if effective_language == "en":
        return _ENGLISH_SYSTEM_PROMPT(base_prompt)
    return base_prompt


def _ENGLISH_SYSTEM_PROMPT(base_prompt: str) -> str:
    """Wrap the base prompt so answers stay in English."""
    return (
        "You are a helpful, natural AI voice assistant. ALWAYS respond strictly "
        "in fluent English in 1-2 short conversational sentences."
        + base_prompt
    )


def _URDU_SYSTEM_PROMPT(base_prompt: str) -> str:
    """Wrap the base prompt so answers stay in Urdu."""
    return (
        "آپ ایک ماہر AI وائس اسسٹنٹ ہیں۔ آپ کو صارف کے تمام سوالات کے جوابات صرف اور صرف روان اردو زبان میں دینے ہیں۔ "
        "اپنے جوابات مختصر، گفتگو کے انداز میں اور 1-2 جملوں تک محدود رکھیں۔"
        + base_prompt
    )


def build_messages(
    system_prompt: str,
    message: str,
    history: list[dict[str, str]] | None = None,
) -> list[dict[str, str]]:
    """Build an OpenAI-style message list: system, last 10 turns, new message."""
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]

    for item in (history or [])[-10:]:
        if not isinstance(item, dict):
            continue
        content = item.get("content", "")
        if not isinstance(content, str) or not content.strip():
            continue
        role = item.get("role", "user")
        messages.append(
            {
                "role": "assistant" if role in ("agent", "assistant") else "user",
                "content": content.strip(),
            }
        )

    messages.append({"role": "user", "content": message})
    return messages


async def chat_completion(
    system_prompt: str,
    message: str,
    history: list[dict[str, str]] | None = None,
    max_tokens: int = 300,
    temperature: float = 0.4,
) -> str:
    """Return the assistant's reply text from Groq."""
    if not GROQ_API_KEY:
        raise LLMError(
            "Groq API key not configured. Set GROQ_API_KEY in backend/.env and restart."
        )

    payload = {
        "model": GROQ_MODEL_NAME,
        "messages": build_messages(system_prompt, message, history),
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    logger.info(
        "Groq chat request | model=%s messages=%s key=%s",
        GROQ_MODEL_NAME,
        len(payload["messages"]),
        mask_key(GROQ_API_KEY),
    )

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                f"{GROQ_BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
            )
    except httpx.TimeoutException as e:
        logger.error("Groq chat request timed out")
        raise LLMError("The language model timed out. Please try again.") from e
    except httpx.RequestError as e:
        logger.error("Groq chat connection error: %s", e)
        raise LLMError(f"Could not reach Groq: {e}") from e

    if response.status_code != 200:
        body = response.text[:400]
        logger.error(
            "Groq chat failed | status=%s model=%s body=%s",
            response.status_code,
            GROQ_MODEL_NAME,
            body,
        )
        raise LLMError(
            f"Groq returned {response.status_code} for model '{GROQ_MODEL_NAME}'. "
            "Check GROQ_MODEL_NAME and your Groq access."
        )

    try:
        data = response.json()
        content = data["choices"][0]["message"].get("content") or ""
    except (ValueError, KeyError, IndexError, TypeError) as e:
        logger.error("Unexpected Groq response shape: %s", response.text[:300])
        raise LLMError("Groq returned an unexpected response.") from e

    reply = content.strip()
    logger.info("Groq chat reply | chars=%s", len(reply))
    return reply


async def stream_chat_completion(
    system_prompt: str,
    message: str,
    history: list[dict[str, str]] | None = None,
    max_tokens: int = 300,
    temperature: float = 0.4,
) -> AsyncGenerator[str, None]:
    """Yield the assistant's reply as incremental text deltas from Groq.

    Sentences can be spoken as soon as they arrive instead of waiting for the
    whole reply, which is most of the time-to-first-audio on a voice call.
    """
    if not GROQ_API_KEY:
        raise LLMError(
            "Groq API key not configured. Set GROQ_API_KEY in backend/.env and restart."
        )

    payload = {
        "model": GROQ_MODEL_NAME,
        "messages": build_messages(system_prompt, message, history),
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    logger.info(
        "Groq chat stream request | model=%s messages=%s key=%s",
        GROQ_MODEL_NAME,
        len(payload["messages"]),
        mask_key(GROQ_API_KEY),
    )

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{GROQ_BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
            ) as response:
                if response.status_code != 200:
                    body = (await response.aread()).decode("utf-8", errors="replace")
                    logger.error(
                        "Groq chat stream failed | status=%s model=%s body=%s",
                        response.status_code,
                        GROQ_MODEL_NAME,
                        body[:400],
                    )
                    raise LLMError(
                        f"Groq returned {response.status_code} for model "
                        f"'{GROQ_MODEL_NAME}'. Check GROQ_MODEL_NAME and your "
                        "Groq access."
                    )

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if not data or data == "[DONE]":
                        continue
                    try:
                        chunk = json.loads(data)
                    except ValueError:
                        continue
                    choices = chunk.get("choices") or []
                    if not choices or not isinstance(choices[0], dict):
                        continue
                    delta = choices[0].get("delta") or {}
                    content = delta.get("content")
                    if isinstance(content, str) and content:
                        yield content
    except httpx.TimeoutException as e:
        logger.error("Groq chat stream timed out")
        raise LLMError("The language model timed out. Please try again.") from e
    except httpx.RequestError as e:
        logger.error("Groq chat stream connection error: %s", e)
        raise LLMError(f"Could not reach Groq: {e}") from e


# End of sentence: punctuation followed by whitespace (so "3.14" never splits).
# Includes the Urdu/Arabic full stop (۔) and question mark (؟), so Urdu replies
# are also spoken sentence by sentence instead of in one long chunk.
_SENTENCE_END = re.compile(r"(?<=[.!?…۔؟])\s+")


async def iter_sentences(
    deltas: AsyncGenerator[str, None],
    max_chars: int = 180,
) -> AsyncGenerator[str, None]:
    """Group streamed text deltas into speakable sentences.

    A long run-on sentence is cut at the last word boundary once it exceeds
    ``max_chars``, so the first audio chunk never waits on a whole paragraph.
    """
    buffer = ""

    async for delta in deltas:
        buffer += delta

        while True:
            match = _SENTENCE_END.search(buffer)
            if not match:
                break
            piece = buffer[: match.end()].strip()
            buffer = buffer[match.end():]
            if piece:
                yield piece

        if len(buffer) > max_chars:
            cut = buffer.rfind(" ", 0, max_chars)
            if cut < 40:
                cut = max_chars
            piece = buffer[:cut].strip()
            buffer = buffer[cut:]
            if piece:
                yield piece

    rest = buffer.strip()
    if rest:
        yield rest


__all__ = [
    "LLMError",
    "build_messages",
    "chat_completion",
    "iter_sentences",
    "stream_chat_completion",
]

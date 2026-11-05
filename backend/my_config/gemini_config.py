from decouple import config
from agents import AsyncOpenAI, OpenAIChatCompletionsModel

key = config("GEMINI_API_KEY", default="")
model_name = config("GEMINI_MODEL", default="gemini-2.0-flash-exp")

gemini_client: AsyncOpenAI | None = None
gemini_model: OpenAIChatCompletionsModel | None = None

if key:
    gemini_client = AsyncOpenAI(
        api_key=key,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai",
    )
    gemini_model = OpenAIChatCompletionsModel(
        model=model_name,
        openai_client=gemini_client,
    )

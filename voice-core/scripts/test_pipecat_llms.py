import asyncio

from dotenv import load_dotenv
from pipecat.frames.frames import LLMMessagesFrame

from pipecat.services.google import GoogleLLMService
from pipecat.services.openai import OpenAILLMService


async def run_google() -> None:
    service = GoogleLLMService(api_key=None, model="gemini-2.5-flash")
    frame = LLMMessagesFrame(messages=[{"role": "user", "content": "ping"}])
    async for _ in service.process_frame(frame, None):
        pass
    print("google llm ok")


async def run_openai() -> None:
    service = OpenAILLMService(api_key=None, model="gpt-4.1")
    frame = LLMMessagesFrame(messages=[{"role": "user", "content": "ping"}])
    async for _ in service.process_frame(frame, None):
        pass
    print("openai llm ok")


async def main() -> None:
    load_dotenv(".env")
    await run_google()
    await run_openai()


if __name__ == "__main__":
    asyncio.run(main())

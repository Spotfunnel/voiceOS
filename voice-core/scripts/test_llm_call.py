import asyncio

from dotenv import load_dotenv
from pipecat.frames.frames import LLMMessagesFrame

from src.llm.multi_provider_llm import MultiProviderLLM


async def main() -> None:
    load_dotenv(".env")
    llm = MultiProviderLLM.from_env()
    frame = LLMMessagesFrame(messages=[{"role": "user", "content": "ping"}])
    async for _ in llm.process_frame(frame, None):
        pass
    print("llm ok")


if __name__ == "__main__":
    asyncio.run(main())

import json
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Any

import httpx
from sqlmodel import Session

from database import engine
from models.inventory import LocalInventory


DEFAULT_RUNNER_ENDPOINTS: dict[str, str] = {
    "ollama": "http://localhost:11434",
    "llama_cpp": "http://localhost:8080",
    "lm_studio": "http://localhost:1234",
}


def _guess_model_name(item: LocalInventory) -> str:
    """Best-effort model name for Ollama based on filename."""
    name = Path(item.local_path).stem.lower().replace(" ", "-").replace("_", "-")
    # Strip common quant suffixes for a cleaner Ollama tag.
    for suffix in ("-q4_0", "-q4_k_m", "-q5_k_m", "-q8_0", "-fp16"):
        if name.endswith(suffix):
            name = name[: -len(suffix)]
    return name


def _inventory_item(item_id: int) -> LocalInventory | None:
    with Session(engine) as session:
        return session.get(LocalInventory, item_id)


async def ollama_generate_stream(
    model: str,
    prompt: str,
    base_url: str = DEFAULT_RUNNER_ENDPOINTS["ollama"],
) -> AsyncGenerator[str, None]:
    url = f"{base_url}/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": True,
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", url, json=payload) as response:
            if response.status_code != 200:
                text = await response.aread()
                raise RuntimeError(f"Ollama error {response.status_code}: {text.decode()}")
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if "response" in data:
                    yield data["response"]
                if data.get("done"):
                    break


async def openai_chat_stream(
    model: str,
    prompt: str,
    base_url: str,
) -> AsyncGenerator[str, None]:
    url = f"{base_url}/v1/chat/completions"
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": True,
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", url, json=payload) as response:
            if response.status_code != 200:
                text = await response.aread()
                raise RuntimeError(f"Runner error {response.status_code}: {text.decode()}")
            async for line in response.aiter_lines():
                if not line.strip() or not line.startswith("data: "):
                    continue
                json_str = line[len("data: "):].strip()
                if json_str == "[DONE]":
                    break
                try:
                    data = json.loads(json_str)
                except json.JSONDecodeError:
                    continue
                delta = data.get("choices", [{}])[0].get("delta", {}).get("content")
                if delta:
                    yield delta


async def chat_stream(
    inventory_item_id: int,
    runner: str,
    prompt: str,
) -> AsyncGenerator[str, None]:
    item = _inventory_item(inventory_item_id)
    if not item:
        raise RuntimeError("Inventory item not found")

    if runner == "ollama":
        model_name = _guess_model_name(item)
        base_url = DEFAULT_RUNNER_ENDPOINTS["ollama"]
        async for chunk in ollama_generate_stream(model_name, prompt, base_url=base_url):
            yield chunk
    elif runner in ("llama_cpp", "lm_studio"):
        base_url = DEFAULT_RUNNER_ENDPOINTS.get(runner, DEFAULT_RUNNER_ENDPOINTS["llama_cpp"])
        model_name = Path(item.local_path).name
        async for chunk in openai_chat_stream(model_name, prompt, base_url=base_url):
            yield chunk
    else:
        raise RuntimeError(f"Runner '{runner}' is not supported for in-app chat")

import os
import re
from typing import Any

import httpx
from huggingface_hub import HfApi, hf_hub_url

from providers.base import BaseProvider

SUPPORTED_EXTENSIONS = {".gguf", ".safetensors", ".bin", ".onnx", ".mlx", ".exl2"}

CAPABILITY_TAGS = {
    "llm": "LLM",
    "text-generation-inference": "LLM",
    "text-generation": "LLM",
    "image-to-text": "Vision",
    "visual-question-answering": "Vision",
    "text-to-image": "Vision",
    "vision": "Vision",
    "code": "Coding",
    "tool-use": "Tool Use",
    "tooluse": "Tool Use",
    "tools": "Tool Use",
    "function-calling": "Tool Use",
    "function_calling": "Tool Use",
    "reasoning": "Reasoning",
    "chain-of-thought": "Reasoning",
    "chain_of_thought": "Reasoning",
    "cot": "Reasoning",
    "math": "Reasoning",
    "embedding": "Embedding",
    "sentence-similarity": "Embedding",
    "feature-extraction": "Embedding",
    "audio-to-text": "Audio",
    "automatic-speech-recognition": "Audio",
    "text-to-speech": "Audio",
    "multimodal": "Multimodal",
}


def _parse_quant_method(filename: str) -> str | None:
    if filename.lower().endswith(".gguf"):
        match = re.search(r"[-_.]((?:IQ|Q)[0-9][A-Za-z0-9_]*?)(?:\.gguf)$", filename, re.IGNORECASE)
        if match:
            return match.group(1).upper()
    if ".exl2" in filename.lower():
        match = re.search(r"[-_](?:(?:bpw|w)\d+(?:\.\d+)?|4bit|8bit)", filename, re.IGNORECASE)
        if match:
            return match.group(0).lstrip("-_").upper()
    return None


def _detect_format(filename: str, repo_id: str = "") -> str:
    ext = os.path.splitext(filename)[1].lower()
    fmt = {
        ".gguf": "GGUF",
        ".safetensors": "Safetensors",
        ".bin": "Pickled",
        ".onnx": "ONNX",
        ".mlx": "MLX",
        ".exl2": "EXL2",
    }.get(ext, ext.lstrip(".").upper() or "Unknown")

    repo_lower = repo_id.lower()
    if fmt in ("Safetensors", "Pickled", "Unknown"):
        if "exl2" in repo_lower:
            return "EXL2"
        if "mlx" in repo_lower:
            return "MLX"
    return fmt


def _infer_capability(tags: list[str]) -> str:
    matched: set[str] = set()
    for tag in tags:
        normalized = tag.lower()
        if normalized in CAPABILITY_TAGS:
            matched.add(CAPABILITY_TAGS[normalized])
    if "Vision" in matched and "LLM" in matched:
        matched.discard("LLM")
    return ", ".join(sorted(matched)) if matched else "LLM"


def _extract_description(model) -> str | None:
    card_data = getattr(model, "cardData", None) or {}
    if isinstance(card_data, dict):
        for key in ("description", "summary", "model_description"):
            value = card_data.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None


def _fetch_readme_summary(repo_id: str) -> str | None:
    url = f"https://huggingface.co/{repo_id}/raw/main/README.md"
    try:
        with httpx.Client(timeout=10) as client:
            response = client.get(url, headers={"Range": "bytes=0-2047"})
            response.raise_for_status()
            text = response.text
    except Exception:
        return None

    # Strip YAML frontmatter
    if text.startswith("---"):
        end = text.find("---", 3)
        if end != -1:
            text = text[end + 3 :]

    # Extract first non-empty paragraph, stripping markdown links/images
    for line in text.split("\n"):
        line = line.strip()
        if not line or line.startswith("#") or line == "---":
            continue
        # Remove markdown link text, keep label
        cleaned = re.sub(r"!\[.*?\]\(.*?\)", "", line)
        cleaned = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", cleaned)
        cleaned = cleaned.strip(" -*")
        if cleaned:
            return cleaned[:240] + ("..." if len(cleaned) > 240 else "")
    return None


class HuggingFaceProvider(BaseProvider):
    def __init__(self):
        self.api = HfApi()

    def search(
        self,
        query: str,
        capability: str | None = None,
        format: str | None = None,
        limit: int = 20,
        sort: str = "downloads",
    ) -> list[dict[str, Any]]:
        # Empty query + sort="downloads" returns the most popular models;
        # sort="trendingScore" returns the currently trending models.
        models = self.api.list_models(
            search=query,
            limit=limit,
            sort=sort,
            full=True,
            fetch_config=False,
        )

        results: list[dict[str, Any]] = []
        for model in models:
            if not model.modelId:
                continue

            inferred_capability = _infer_capability(model.tags or [])
            if capability and capability not in inferred_capability.split(", "):
                continue

            files = self._list_model_files(model.modelId)
            if not files:
                continue

            if format and not any(file["format"] == format for file in files):
                continue

            description = _extract_description(model)
            if not description:
                description = _fetch_readme_summary(model.modelId)

            results.append({
                "id": model.modelId,
                "name": model.modelId.split("/")[-1],
                "author": model.modelId.split("/")[0],
                "architecture": None,
                "params_billions": None,
                "context_length": None,
                "capabilities": inferred_capability,
                "description": description,
                "downloads": getattr(model, "downloads", 0) or 0,
                "likes": getattr(model, "likes", 0) or 0,
                "files": files,
            })
        return results

    def _list_model_files(self, repo_id: str) -> list[dict[str, Any]]:
        try:
            info = self.api.model_info(repo_id, files_metadata=True)
        except Exception:
            return []

        files: list[dict[str, Any]] = []
        for sibling in getattr(info, "siblings", []) or []:
            path = getattr(sibling, "rfilename", None)
            if not path:
                continue
            filename = path.split("/")[-1]
            ext = os.path.splitext(filename)[1].lower()
            if ext not in SUPPORTED_EXTENSIONS:
                continue
            if "/" in path:
                continue

            size = getattr(sibling, "size", 0) or 0
            download_url = hf_hub_url(repo_id, filename=path, repo_type="model")
            files.append({
                "filename": filename,
                "format": _detect_format(filename, repo_id),
                "quant_method": _parse_quant_method(filename),
                "size_bytes": size,
                "download_url": download_url,
                "estimated_vram_mb": round(size / (1024 ** 2) * 1.15, 2) if size else None,
            })
        return files

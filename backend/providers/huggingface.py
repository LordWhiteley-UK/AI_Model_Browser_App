import os
import re
from typing import Any

from huggingface_hub import HfApi, hf_hub_url

from providers.base import BaseProvider

SUPPORTED_EXTENSIONS = {".gguf", ".safetensors", ".bin", ".onnx", ".mlx", ".exl2"}

CAPABILITY_TAGS = {
    "llm": "LLM",
    "text-generation-inference": "LLM",
    "image-to-text": "Vision",
    "visual-question-answering": "Vision",
    "text-to-image": "Vision",
    "code": "Coding",
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


def _detect_format(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    return {
        ".gguf": "GGUF",
        ".safetensors": "Safetensors",
        ".bin": "Pickled",
        ".onnx": "ONNX",
        ".mlx": "MLX",
        ".exl2": "EXL2",
    }.get(ext, ext.lstrip(".").upper() or "Unknown")


def _infer_capability(tags: list[str]) -> str:
    matched: set[str] = set()
    for tag in tags:
        normalized = tag.lower()
        if normalized in CAPABILITY_TAGS:
            matched.add(CAPABILITY_TAGS[normalized])
    if "Vision" in matched and "LLM" in matched:
        matched.discard("LLM")
    return ", ".join(sorted(matched)) if matched else "LLM"


class HuggingFaceProvider(BaseProvider):
    def __init__(self):
        self.api = HfApi()

    def search(
        self,
        query: str,
        capability: str | None = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        # An empty query with sort="downloads" returns the most popular models on the Hub.
        models = self.api.list_models(
            search=query,
            limit=limit,
            sort="downloads",
            direction=-1,
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

            results.append({
                "id": model.modelId,
                "name": model.modelId.split("/")[-1],
                "author": model.modelId.split("/")[0],
                "architecture": None,
                "params_billions": None,
                "context_length": None,
                "capabilities": inferred_capability,
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
                "format": _detect_format(filename),
                "quant_method": _parse_quant_method(filename),
                "size_bytes": size,
                "download_url": download_url,
                "estimated_vram_mb": round(size / (1024 ** 2) * 1.15, 2) if size else None,
            })
        return files

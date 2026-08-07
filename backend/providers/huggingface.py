import os
import re
from typing import Any

import httpx
import requests
from huggingface_hub import HfApi, configure_http_backend, hf_hub_url

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


def _parse_params_billions(repo_id: str, filename: str | None = None) -> float | None:
    """Infer parameter count from common naming patterns like 7B, 13B, 70B."""
    text = f"{repo_id} {filename or ''}"
    # Match patterns like 7B, 7.5B, 70B, 8x7B, 405B.
    match = re.search(r"\b(\d+(?:\.\d+)?)\s?[bB]\b", text)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass
    return None


def _quant_bits_from_method(quant_method: str | None) -> int | None:
    if not quant_method:
        return None
    q = quant_method.upper()
    if q.startswith("Q4") or q.startswith("IQ4") or "4BIT" in q:
        return 4
    if q.startswith("Q5") or q.startswith("IQ5"):
        return 5
    if q.startswith("Q6") or q.startswith("IQ6"):
        return 6
    if q.startswith("Q8") or q.startswith("IQ8"):
        return 8
    if q.startswith("Q2") or q.startswith("IQ2"):
        return 2
    if "16" in q or "F16" in q or "FP16" in q:
        return 16
    if "BF16" in q:
        return 16
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


def _model_languages(model) -> list[str]:
    """Extract declared language tag(s) from the model card, if any."""
    card_data = getattr(model, "cardData", None) or {}
    if not isinstance(card_data, dict):
        return []
    languages = card_data.get("language")
    if languages is None:
        return []
    if isinstance(languages, str):
        return [languages]
    if isinstance(languages, (list, tuple)):
        return [str(lang) for lang in languages]
    return []


def _matches_language(model, language: str | None) -> bool:
    """Return True if the model matches the requested language filter.

    Models with no declared language metadata are kept so that language-agnostic
    checkpoints (embeddings, vision, general models) are not excluded.
    Multilingual models are also kept when English is requested.
    """
    if not language:
        return True

    # Hugging Face model tags are the primary source for language metadata.
    tags = [str(t).lower() for t in getattr(model, "tags", []) or []]
    if language in tags or "multilingual" in tags:
        return True

    card_languages = _model_languages(model)
    if not card_languages:
        return True
    if "multilingual" in card_languages:
        return True
    return any(language.lower() in lang.lower() for lang in card_languages)


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


def _http_backend_factory() -> requests.Session:
    session = requests.Session()
    session.headers["Accept-Encoding"] = "identity"
    return session


configure_http_backend(_http_backend_factory)


class HuggingFaceProvider(BaseProvider):
    # Format keywords used to target quantized/converted model repositories.
    FORMAT_KEYWORDS: dict[str, str] = {
        "GGUF": "gguf",
        "EXL2": "exl2",
        "MLX": "mlx",
    }

    def __init__(self):
        self.api = HfApi()

    def _build_effective_query(self, query: str, format: str | None) -> str:
        keyword = self.FORMAT_KEYWORDS.get(format or "")
        if not keyword:
            return query
        query = query.strip()
        keyword_lower = keyword.lower()
        if keyword_lower in query.lower():
            return query
        return f"{query} {keyword}".strip() if query else keyword

    def search(
        self,
        query: str,
        capability: str | None = None,
        format: str | None = None,
        limit: int = 20,
        sort: str = "downloads",
        language: str | None = None,
    ) -> list[dict[str, Any]]:
        # Some formats (GGUF, EXL2, MLX) usually live in dedicated quantized
        # repos. Searching the global top downloads for them almost always
        # returns nothing, so append the format keyword to the query.
        effective_query = self._build_effective_query(query, format)
        models = self.api.list_models(
            search=effective_query,
            filter=language,
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

            if not _matches_language(model, language):
                continue

            files = self._list_model_files(model.modelId)
            if not files:
                continue

            if format and not any(file["format"] == format for file in files):
                continue

            description = _extract_description(model)
            if not description:
                description = _fetch_readme_summary(model.modelId)

            created_at = None
            raw_created = getattr(model, "created_at", None) or getattr(model, "createdAt", None)
            if isinstance(raw_created, str):
                created_at = raw_created
            elif hasattr(raw_created, "isoformat"):
                created_at = raw_created.isoformat()

            results.append({
                "id": model.modelId,
                "name": model.modelId.split("/")[-1],
                "author": model.modelId.split("/")[0],
                "architecture": None,
                "params_billions": _parse_params_billions(model.modelId),
                "context_length": None,
                "capabilities": inferred_capability,
                "description": description,
                "languages": _model_languages(model),
                "downloads": getattr(model, "downloads", 0) or 0,
                "likes": getattr(model, "likes", 0) or 0,
                "created_at": created_at,
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
            quant_method = _parse_quant_method(filename)
            files.append({
                "filename": filename,
                "format": _detect_format(filename, repo_id),
                "quant_method": quant_method,
                "size_bytes": size,
                "download_url": download_url,
                "estimated_vram_mb": round(size / (1024 ** 2) * 1.15, 2) if size else None,
                "params_billions": _parse_params_billions(repo_id, filename),
                "quant_bits": _quant_bits_from_method(quant_method),
            })
        return files

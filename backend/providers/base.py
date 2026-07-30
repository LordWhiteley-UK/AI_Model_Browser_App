from abc import ABC, abstractmethod
from typing import Any


class BaseProvider(ABC):
    @abstractmethod
    def search(
        self,
        query: str,
        capability: str | None = None,
        limit: int = 20,
        sort: str = "downloads",
    ) -> list[dict[str, Any]]:
        raise NotImplementedError

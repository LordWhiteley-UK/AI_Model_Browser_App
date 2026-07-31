from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class LocalInventory(SQLModel, table=True):
    __tablename__ = "localinventory"

    id: Optional[int] = Field(default=None, primary_key=True)
    family_id: Optional[str] = Field(default=None, foreign_key="modelfamily.id")
    local_path: str = Field(nullable=False, unique=True)
    filename: str = Field(nullable=False)
    detected_format: str = Field(nullable=False)
    detected_capability: Optional[str] = Field(default="LLM", nullable=True)
    size_bytes: int = Field(default=0, nullable=False)
    preferred_runner: Optional[str] = Field(default=None, nullable=True)
    added_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

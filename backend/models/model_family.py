from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class ModelFamily(SQLModel, table=True):
    __tablename__ = "modelfamily"

    id: str = Field(primary_key=True, nullable=False)
    name: str = Field(nullable=False)
    author: str = Field(nullable=False)
    architecture: Optional[str] = Field(default=None, nullable=True)
    params_billions: Optional[float] = Field(default=None, nullable=True)
    context_length: Optional[int] = Field(default=None, nullable=True)
    capabilities: Optional[str] = Field(default="LLM", nullable=True)
    downloads: int = Field(default=0, nullable=False)
    likes: int = Field(default=0, nullable=False)
    updated_at: Optional[datetime] = Field(default=None, nullable=True)

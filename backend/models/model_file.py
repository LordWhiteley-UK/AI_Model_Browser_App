from typing import Optional

from sqlmodel import Field, SQLModel


class ModelFile(SQLModel, table=True):
    __tablename__ = "modelfile"

    id: Optional[int] = Field(default=None, primary_key=True)
    family_id: str = Field(nullable=False, foreign_key="modelfamily.id")
    filename: str = Field(nullable=False)
    format: str = Field(nullable=False)
    quant_method: Optional[str] = Field(default=None, nullable=True)
    size_bytes: int = Field(nullable=False)
    download_url: str = Field(nullable=False)
    estimated_vram_mb: Optional[float] = Field(default=None, nullable=True)

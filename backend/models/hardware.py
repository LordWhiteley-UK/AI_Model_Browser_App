from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class HardwareProfile(SQLModel, table=True):
    __tablename__ = "hardwareprofile"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, nullable=False)
    is_active: bool = Field(default=False, nullable=False)
    os: str = Field(nullable=False)
    cpu_name: Optional[str] = Field(default=None, nullable=True)
    total_ram_gb: float = Field(nullable=False)
    total_vram_gb: float = Field(default=0.0, nullable=False)
    is_unified_memory: bool = Field(default=False, nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

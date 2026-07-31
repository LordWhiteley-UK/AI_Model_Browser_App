from typing import Optional

from sqlmodel import Field, SQLModel


class RunnerPathOverride(SQLModel, table=True):
    __tablename__ = "runnerpathoverride"

    runner_id: str = Field(primary_key=True, nullable=False)
    binary_path: Optional[str] = Field(default=None, nullable=True)
    model_path: Optional[str] = Field(default=None, nullable=True)

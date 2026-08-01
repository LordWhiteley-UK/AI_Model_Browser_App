from typing import Optional

from sqlmodel import Field, SQLModel


class AppSetting(SQLModel, table=True):
    __tablename__ = "appsetting"

    key: str = Field(primary_key=True)
    value: Optional[str] = Field(default=None, nullable=True)

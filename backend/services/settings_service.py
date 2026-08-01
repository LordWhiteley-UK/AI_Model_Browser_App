from typing import Optional
from sqlmodel import Session, select
from database import engine
from models.app_settings import AppSetting

DEFAULT_DOWNLOAD_DIR = "download_dir"
OLLAMA_PATH = "ollama_path"
LM_STUDIO_PATH = "lm_studio_path"
HUGGINGFACE_TOKEN = "huggingface_token"
THEME = "theme"


def get_setting(key: str) -> Optional[str]:
    with Session(engine) as session:
        setting = session.get(AppSetting, key)
        return setting.value if setting else None


def set_setting(key: str, value: Optional[str]) -> None:
    with Session(engine) as session:
        existing = session.get(AppSetting, key)
        if existing:
            existing.value = value
        else:
            session.add(AppSetting(key=key, value=value))
        session.commit()


def get_all_settings() -> dict[str, Optional[str]]:
    keys = [DEFAULT_DOWNLOAD_DIR, OLLAMA_PATH, LM_STUDIO_PATH, HUGGINGFACE_TOKEN, THEME]
    return {key: get_setting(key) for key in keys}

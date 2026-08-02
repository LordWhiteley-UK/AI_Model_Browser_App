import os
from pathlib import Path

from sqlmodel import SQLModel, Session, create_engine

from models.app_settings import AppSetting
from models.hardware import HardwareProfile
from models.inventory import LocalInventory
from models.model_family import ModelFamily
from models.model_file import ModelFile
from models.runner_settings import RunnerPathOverride

DEFAULT_DB_DIR = Path.home() / ".ai_model_browser"
DEFAULT_DB_PATH = DEFAULT_DB_DIR / "models.db"

DATABASE_URL = os.environ.get(
    "AI_MODEL_BROWSER_DB_URL",
    f"sqlite:///{DEFAULT_DB_PATH.as_posix()}",
)


def _ensure_db_dir():
    if DATABASE_URL.startswith("sqlite:///"):
        # Strip the three-slash prefix and reconstruct an OS-native path.
        raw_path = DATABASE_URL.replace("sqlite:///", "", 1)
        path = Path(raw_path)
        path.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    DATABASE_URL, echo=False, connect_args={"check_same_thread": False}
)


def init_db():
    SQLModel.metadata.create_all(engine)
    _migrate_hardware_profile_columns()


def _migrate_hardware_profile_columns():
    """Add columns added after the initial schema creation."""
    from sqlalchemy import text

    with engine.connect() as conn:
        columns = {
            row[1]
            for row in conn.exec_driver_sql(
                "PRAGMA table_info(hardwareprofile)"
            ).fetchall()
        }
        if "gpu_name" not in columns:
            conn.exec_driver_sql(
                "ALTER TABLE hardwareprofile ADD COLUMN gpu_name VARCHAR"
            )
        if "ram_type" not in columns:
            conn.exec_driver_sql(
                "ALTER TABLE hardwareprofile ADD COLUMN ram_type VARCHAR"
            )
        conn.commit()


def _migrate_inventory_columns():
    """Add columns added after the initial schema creation."""
    with engine.connect() as conn:
        columns = {
            row[1]
            for row in conn.exec_driver_sql(
                "PRAGMA table_info(localinventory)"
            ).fetchall()
        }
        if "preferred_runner" not in columns:
            conn.exec_driver_sql(
                "ALTER TABLE localinventory ADD COLUMN preferred_runner VARCHAR"
            )
        conn.commit()


def init_db():
    _ensure_db_dir()
    SQLModel.metadata.create_all(engine)
    _migrate_hardware_profile_columns()
    _migrate_inventory_columns()


def get_session():
    with Session(engine) as session:
        yield session

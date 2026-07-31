from sqlmodel import SQLModel, Session, create_engine

from models.hardware import HardwareProfile
from models.inventory import LocalInventory
from models.model_family import ModelFamily
from models.model_file import ModelFile
from models.runner_settings import RunnerPathOverride

DATABASE_URL = "sqlite:///models.db"

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
    SQLModel.metadata.create_all(engine)
    _migrate_hardware_profile_columns()
    _migrate_inventory_columns()


def get_session():
    with Session(engine) as session:
        yield session

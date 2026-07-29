from sqlmodel import SQLModel, Session, create_engine

from models.hardware import HardwareProfile
from models.inventory import LocalInventory
from models.model_family import ModelFamily
from models.model_file import ModelFile

DATABASE_URL = "sqlite:///models.db"

engine = create_engine(
    DATABASE_URL, echo=False, connect_args={"check_same_thread": False}
)


def init_db():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session

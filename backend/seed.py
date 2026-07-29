from sqlmodel import Session, select

from database import engine
from models.hardware import HardwareProfile

DEFAULT_PROFILES = [
    HardwareProfile(
        name="MacBook Air 2024",
        is_active=False,
        os="macOS",
        total_ram_gb=24.0,
        total_vram_gb=0.0,
        is_unified_memory=True,
    ),
    HardwareProfile(
        name="Mac Mini M4 Pro",
        is_active=False,
        os="macOS",
        total_ram_gb=64.0,
        total_vram_gb=0.0,
        is_unified_memory=True,
    ),
    HardwareProfile(
        name="Gaming Rig",
        is_active=False,
        os="Windows 11",
        total_ram_gb=128.0,
        total_vram_gb=16.0,
        is_unified_memory=False,
    ),
]


def seed_profiles():
    with Session(engine) as session:
        for profile in DEFAULT_PROFILES:
            existing = session.exec(
                select(HardwareProfile).where(HardwareProfile.name == profile.name)
            ).first()
            if existing:
                continue
            session.add(profile)
        session.commit()


def ensure_active_profile():
    with Session(engine) as session:
        active = session.exec(
            select(HardwareProfile).where(HardwareProfile.is_active == True)
        ).first()
        if active:
            return
        first = session.exec(select(HardwareProfile)).first()
        if first:
            first.is_active = True
            session.add(first)
            session.commit()

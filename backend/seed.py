from sqlmodel import Session, select

from database import engine
from models.hardware import HardwareProfile

DEFAULT_PROFILES = [
    HardwareProfile(
        name="MacBook Air 2024",
        is_active=False,
        os="macOS",
        cpu_name="Apple M3",
        gpu_name="Apple M3 GPU",
        ram_type="LPDDR5X",
        total_ram_gb=24.0,
        total_vram_gb=0.0,
        is_unified_memory=True,
    ),
    HardwareProfile(
        name="Mac Mini M4 Pro",
        is_active=False,
        os="macOS",
        cpu_name="Apple M4 Pro",
        gpu_name="Apple M4 Pro GPU",
        ram_type="LPDDR5X",
        total_ram_gb=64.0,
        total_vram_gb=0.0,
        is_unified_memory=True,
    ),
    HardwareProfile(
        name="Gaming Rig",
        is_active=False,
        os="Windows 11",
        cpu_name="Intel Core i9-14900K",
        gpu_name="NVIDIA RTX 5080",
        ram_type="DDR5",
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
                # Keep existing profiles up to date with seed defaults for new fields.
                if not existing.cpu_name and profile.cpu_name:
                    existing.cpu_name = profile.cpu_name
                if not existing.gpu_name and profile.gpu_name:
                    existing.gpu_name = profile.gpu_name
                if not existing.ram_type and profile.ram_type:
                    existing.ram_type = profile.ram_type
                session.add(existing)
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

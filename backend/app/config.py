"""
Configuration settings for the drone simulation backend.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True

    # CORS settings
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Physics constants
    AIR_DENSITY: float = 1.225  # kg/m³ at sea level
    GRAVITY: float = 9.81  # m/s²

    # Simulation settings
    SIMULATION_TIMESTEP: float = 0.02  # 50 Hz physics update
    MAX_SIMULATION_TIME: float = 60.0  # Maximum simulation duration in seconds

    # Socket.IO settings
    SOCKETIO_ASYNC_MODE: str = "asgi"
    SOCKETIO_PING_TIMEOUT: int = 60
    SOCKETIO_PING_INTERVAL: int = 25

    # Component database path (for future use)
    COMPONENT_DB_PATH: Optional[str] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Global settings instance
settings = Settings()


# Physics constants as module-level for convenience
AIR_DENSITY = settings.AIR_DENSITY
GRAVITY = settings.GRAVITY

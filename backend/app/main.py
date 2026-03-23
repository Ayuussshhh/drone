"""
Drone Design & Failure Prediction System - Main Application

FastAPI application entry point with Socket.IO integration.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from .config import settings
from .api.routes import router
from .api.websocket import setup_socketio

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Starting Drone Simulation Backend...")
    logger.info(f"Debug mode: {settings.DEBUG}")
    logger.info(f"CORS origins: {settings.CORS_ORIGINS}")
    yield
    logger.info("Shutting down Drone Simulation Backend...")


# Create FastAPI application
app = FastAPI(
    title="Drone Design & Failure Prediction System",
    description="""
    Backend API for drone physics simulation, stability analysis, and failure prediction.

    ## Features
    - Real-time physics simulation
    - Thrust, drag, wind, and tether force calculations
    - Stability analysis and scoring
    - Flight envelope prediction
    - WebSocket streaming for live updates

    ## Endpoints
    - `/api/simulate` - Run full physics simulation
    - `/api/validate` - Validate drone configuration
    - `/api/quick-analysis` - Get instant metrics
    - `/api/components` - List component schema
    - `/api/sample-config` - Get sample configuration

    ## WebSocket (Socket.IO)
    Connect to the root path for real-time simulation:
    - `start_simulation` - Start simulation with config
    - `stop_simulation` - Stop current simulation
    - `update_throttles` - Update motor throttles
    - `set_wind` - Update wind parameters
    """,
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router)


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "Drone Design & Failure Prediction System",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "redoc": "/redoc",
        "api": "/api",
        "websocket": "Socket.IO at root path",
    }


# Export the Socket.IO wrapped app
socketio_app = setup_socketio(app)


def get_app():
    """Get the Socket.IO wrapped ASGI app."""
    return socketio_app

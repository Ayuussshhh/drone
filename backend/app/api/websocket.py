"""
Socket.IO handlers for real-time simulation communication.

Provides real-time bidirectional communication for:
- Streaming simulation state
- Receiving control inputs
- Managing simulation lifecycle
"""

import asyncio
from typing import Dict, Optional
import socketio
import logging

from ..models.drone import DroneConfiguration, Vector3
from ..models.simulation import SimulationParameters, SimulationState
from ..physics import PhysicsEngine
from ..config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.CORS_ORIGINS,
    ping_timeout=settings.SOCKETIO_PING_TIMEOUT,
    ping_interval=settings.SOCKETIO_PING_INTERVAL,
    logger=True,
    engineio_logger=True,
)


class SimulationSession:
    """Manages a single client's simulation session."""

    def __init__(self, sid: str):
        self.sid = sid
        self.engine: Optional[PhysicsEngine] = None
        self.running = False
        self.task: Optional[asyncio.Task] = None
        self.config: Optional[DroneConfiguration] = None
        self.parameters: Optional[SimulationParameters] = None

    async def start(
        self,
        config: DroneConfiguration,
        parameters: SimulationParameters,
        update_rate: float = 50.0,
    ):
        """Start the simulation loop."""
        self.config = config
        self.parameters = parameters
        self.engine = PhysicsEngine(config, parameters)
        self.engine.initialize()
        self.running = True

        interval = 1.0 / update_rate

        while self.running:
            try:
                # Perform physics step
                result = self.engine.step()

                # Emit state to client
                await sio.emit(
                    "simulation_state",
                    {
                        "state": result.state.model_dump(),
                        "metrics": result.metrics.model_dump(),
                        "stability": result.stability.model_dump(),
                    },
                    room=self.sid,
                )

                await asyncio.sleep(interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Simulation error for {self.sid}: {e}")
                await sio.emit(
                    "simulation_error",
                    {"error": str(e)},
                    room=self.sid,
                )
                break

        self.running = False

    def stop(self):
        """Stop the simulation."""
        self.running = False
        if self.task and not self.task.done():
            self.task.cancel()

    def update_parameters(self, parameters: SimulationParameters):
        """Update simulation parameters in real-time."""
        self.parameters = parameters
        if self.engine:
            self.engine.set_parameters(parameters)

    def update_throttles(self, throttles: list[float]):
        """Update motor throttles in real-time."""
        if self.parameters:
            self.parameters.motor_throttles = throttles
            if self.engine:
                self.engine.set_parameters(self.parameters)


# Store active sessions
sessions: Dict[str, SimulationSession] = {}


def setup_socketio(app):
    """
    Setup Socket.IO with the FastAPI app.

    Returns the ASGI app wrapping both FastAPI and Socket.IO.
    """
    return socketio.ASGIApp(sio, app)


# ============== Event Handlers ==============


@sio.event
async def connect(sid, environ):
    """Handle client connection."""
    logger.info(f"Client connected: {sid}")
    sessions[sid] = SimulationSession(sid)
    await sio.emit("connected", {"sid": sid}, room=sid)


@sio.event
async def disconnect(sid):
    """Handle client disconnection."""
    logger.info(f"Client disconnected: {sid}")
    if sid in sessions:
        sessions[sid].stop()
        del sessions[sid]


@sio.event
async def start_simulation(sid, data):
    """
    Start a new simulation.

    Expected data:
    {
        "config": DroneConfiguration dict,
        "parameters": SimulationParameters dict (optional),
        "update_rate": float (optional, default 50 Hz)
    }
    """
    try:
        session = sessions.get(sid)
        if not session:
            await sio.emit("error", {"message": "Session not found"}, room=sid)
            return

        # Parse configuration
        config = DroneConfiguration(**data["config"])

        # Parse parameters (optional)
        params_data = data.get("parameters", {})
        parameters = SimulationParameters(**params_data)

        # Update rate (default 50 Hz)
        update_rate = data.get("update_rate", 50.0)

        # Stop any existing simulation
        session.stop()

        # Start new simulation in background task
        session.task = asyncio.create_task(
            session.start(config, parameters, update_rate)
        )

        await sio.emit(
            "simulation_started",
            {"message": "Simulation started", "update_rate": update_rate},
            room=sid,
        )

        logger.info(f"Simulation started for {sid}")

    except Exception as e:
        logger.error(f"Error starting simulation for {sid}: {e}")
        await sio.emit("error", {"message": str(e)}, room=sid)


@sio.event
async def stop_simulation(sid):
    """Stop the current simulation."""
    session = sessions.get(sid)
    if session:
        session.stop()
        await sio.emit(
            "simulation_stopped",
            {"message": "Simulation stopped"},
            room=sid,
        )
        logger.info(f"Simulation stopped for {sid}")


@sio.event
async def pause_simulation(sid):
    """Pause the current simulation."""
    session = sessions.get(sid)
    if session:
        session.running = False
        await sio.emit(
            "simulation_paused",
            {"message": "Simulation paused"},
            room=sid,
        )


@sio.event
async def resume_simulation(sid):
    """Resume a paused simulation."""
    session = sessions.get(sid)
    if session and session.engine and not session.running:
        # Restart the simulation loop
        session.task = asyncio.create_task(
            session.start(
                session.config,
                session.parameters,
                50.0,  # Default rate
            )
        )
        await sio.emit(
            "simulation_resumed",
            {"message": "Simulation resumed"},
            room=sid,
        )


@sio.event
async def update_parameters(sid, data):
    """
    Update simulation parameters in real-time.

    Expected data:
    {
        "parameters": SimulationParameters dict
    }
    """
    try:
        session = sessions.get(sid)
        if not session:
            return

        parameters = SimulationParameters(**data.get("parameters", {}))
        session.update_parameters(parameters)

        await sio.emit(
            "parameters_updated",
            {"message": "Parameters updated"},
            room=sid,
        )

    except Exception as e:
        logger.error(f"Error updating parameters for {sid}: {e}")
        await sio.emit("error", {"message": str(e)}, room=sid)


@sio.event
async def update_throttles(sid, data):
    """
    Update motor throttles in real-time.

    Expected data:
    {
        "throttles": [float, float, float, float]  # One per motor
    }
    """
    try:
        session = sessions.get(sid)
        if not session:
            return

        throttles = data.get("throttles", [])
        session.update_throttles(throttles)

    except Exception as e:
        logger.error(f"Error updating throttles for {sid}: {e}")


@sio.event
async def set_wind(sid, data):
    """
    Set wind parameters.

    Expected data:
    {
        "velocity": {"x": float, "y": float, "z": float},
        "turbulence": float (0-1)
    }
    """
    try:
        session = sessions.get(sid)
        if not session or not session.parameters:
            return

        velocity_data = data.get("velocity", {})
        session.parameters.wind_velocity = Vector3(**velocity_data)
        session.parameters.wind_turbulence = data.get("turbulence", 0.0)

        if session.engine:
            session.engine.set_parameters(session.parameters)

        await sio.emit(
            "wind_updated",
            {"message": "Wind parameters updated"},
            room=sid,
        )

    except Exception as e:
        logger.error(f"Error setting wind for {sid}: {e}")


@sio.event
async def get_state(sid):
    """Get current simulation state."""
    session = sessions.get(sid)
    if session and session.engine:
        state = session.engine.get_current_state()
        if state:
            await sio.emit(
                "current_state",
                {"state": state.model_dump()},
                room=sid,
            )


@sio.event
async def reset_simulation(sid):
    """Reset simulation to initial state."""
    session = sessions.get(sid)
    if session and session.engine:
        session.engine.reset()
        session.engine.initialize()
        await sio.emit(
            "simulation_reset",
            {"message": "Simulation reset to initial state"},
            room=sid,
        )


# ============== Gesture Control Events ==============


@sio.event
async def gesture_command(sid, data):
    """
    Handle gesture control commands.

    Expected data:
    {
        "gesture": "pinch" | "swipe" | "rotate",
        "parameters": {
            // Gesture-specific parameters
        }
    }
    """
    try:
        gesture = data.get("gesture")
        params = data.get("parameters", {})

        session = sessions.get(sid)
        if not session:
            return

        if gesture == "pinch":
            # Select component (handled by frontend)
            await sio.emit(
                "gesture_ack",
                {"gesture": "pinch", "action": "select"},
                room=sid,
            )

        elif gesture == "swipe":
            # Change parameter value
            direction = params.get("direction", "right")
            value_change = 0.1 if direction in ["right", "up"] else -0.1

            # Apply to throttle as example
            if session.parameters and session.parameters.motor_throttles:
                new_throttles = [
                    max(0, min(1, t + value_change))
                    for t in session.parameters.motor_throttles
                ]
                session.update_throttles(new_throttles)

            await sio.emit(
                "gesture_ack",
                {"gesture": "swipe", "direction": direction},
                room=sid,
            )

        elif gesture == "rotate":
            # Rotate view (handled by Unity)
            angle = params.get("angle", 0)
            await sio.emit(
                "rotate_view",
                {"angle": angle},
                room=sid,
            )

    except Exception as e:
        logger.error(f"Error handling gesture for {sid}: {e}")


# ============== Unity Communication Events ==============


@sio.event
async def unity_ready(sid):
    """Unity client signals it's ready to receive data."""
    logger.info(f"Unity client ready: {sid}")
    await sio.emit(
        "server_ready",
        {"message": "Server ready for Unity communication"},
        room=sid,
    )


@sio.event
async def unity_state_update(sid, data):
    """
    Receive state update from Unity simulation.

    This allows Unity to send its physics state for validation
    or hybrid simulation modes.
    """
    # Store Unity state for comparison/validation
    # Could be used for physics reconciliation
    pass

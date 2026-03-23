"""
REST API routes for drone simulation.

Provides endpoints for:
- Running simulations
- Validating configurations
- Listing available components
- Health checks
- Gesture control
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import Optional, List
from pydantic import BaseModel
import time
import asyncio

from ..models.drone import DroneConfiguration
from ..models.simulation import (
    SimulationRequest,
    SimulationParameters,
    SimulationState,
    FlightStatus,
)
from ..models.responses import (
    SimulationResponse,
    ValidationResponse,
    ComponentListResponse,
    HealthResponse,
    ErrorResponse,
    PhysicsMetrics,
    StabilityReport,
    ComponentInfo,
)
from ..physics import PhysicsEngine
from ..config import settings, GRAVITY


# Create router
router = APIRouter(prefix="/api", tags=["simulation"])

# Track active simulations and start time
_active_simulations = 0
_start_time = time.time()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """API health check endpoint."""
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        uptime=time.time() - _start_time,
        active_simulations=_active_simulations,
    )


@router.post("/simulate", response_model=SimulationResponse)
async def run_simulation(request: SimulationRequest):
    """
    Run a physics simulation with the provided drone configuration.

    Returns simulation results including flight status prediction,
    physics metrics, and stability analysis.
    """
    global _active_simulations

    try:
        _active_simulations += 1

        # Create physics engine
        engine = PhysicsEngine(request.drone_config, request.parameters)

        # Validate configuration first
        is_valid, errors, warnings = engine.validate_configuration()

        if not is_valid:
            return SimulationResponse(
                success=False,
                status="failed",
                message=f"Invalid configuration: {'; '.join(errors)}",
                can_fly=False,
                flight_status=FlightStatus.GROUNDED,
                metrics=_create_empty_metrics(request.drone_config),
                stability=_create_empty_stability(),
            )

        # Set initial state if provided
        if request.initial_state:
            engine.initialize(request.initial_state)
        else:
            engine.initialize()

        # Run simulation
        duration = request.parameters.max_duration if request.parameters else 10.0
        result = engine.run_simulation(duration=min(duration, 30.0))

        # Run a single step to get current metrics
        engine.initialize(request.initial_state)
        step_result = engine.step()

        # Determine if drone can fly
        can_fly = request.drone_config.thrust_to_weight_ratio >= 1.0
        flight_status = FlightStatus.FLYING if can_fly else FlightStatus.GROUNDED

        # Adjust based on simulation outcome
        if result.outcome == "crash":
            flight_status = FlightStatus.CRASHED
        elif result.outcome == "unstable":
            flight_status = FlightStatus.UNSTABLE

        return SimulationResponse(
            success=result.outcome == "success",
            status="completed",
            message=result.outcome_reason,
            can_fly=can_fly,
            flight_status=flight_status,
            metrics=step_result.metrics,
            stability=step_result.stability,
            result=result,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        _active_simulations -= 1


@router.post("/validate", response_model=ValidationResponse)
async def validate_configuration(config: DroneConfiguration):
    """
    Validate a drone configuration without running full simulation.

    Returns quick metrics and viability assessment.
    """
    try:
        engine = PhysicsEngine(config)
        is_valid, errors, warnings = engine.validate_configuration()

        # Calculate quick metrics
        total_mass = config.total_mass
        max_thrust = config.max_thrust
        twr = config.thrust_to_weight_ratio
        weight = total_mass * GRAVITY

        # Can it fly?
        can_fly = twr >= 1.0

        # Calculate hover throttle
        hover_throttle = (1.0 / twr * 100) if twr > 0 else 100.0

        # Calculate payload capacity (with 30% safety margin)
        usable_thrust = max_thrust * 0.7
        extra_capacity = max(0, (usable_thrust - weight) / GRAVITY)

        # Generate summary
        if not is_valid:
            summary = f"Invalid configuration: {errors[0]}"
        elif not can_fly:
            summary = f"Cannot fly: insufficient thrust (T/W = {twr:.2f})"
        elif twr < 1.5:
            summary = f"Flight possible but marginal (T/W = {twr:.2f}). Consider upgrades."
        else:
            summary = f"Good configuration (T/W = {twr:.2f}). Max payload: {extra_capacity:.2f} kg"

        return ValidationResponse(
            valid=is_valid,
            can_fly=can_fly,
            errors=errors,
            warnings=warnings,
            total_mass=total_mass,
            max_thrust=max_thrust,
            thrust_to_weight_ratio=twr,
            min_throttle_to_hover=min(100, hover_throttle),
            max_payload_capacity=extra_capacity,
            summary=summary,
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/quick-analysis", response_model=dict)
async def quick_analysis(config: DroneConfiguration):
    """
    Perform quick physics analysis without full simulation.

    Returns instantaneous metrics at hover condition.
    """
    try:
        engine = PhysicsEngine(config)
        engine.initialize()

        # Single step at hover throttle
        hover_throttle = engine.thrust_calc.calculate_hover_throttle(config)
        throttles = [min(1.0, hover_throttle)] * len(config.motors)

        params = SimulationParameters(motor_throttles=throttles)
        engine.set_parameters(params)

        result = engine.step()

        # Get flight envelope
        envelope = engine.stability_analyzer.predict_flight_envelope(config)

        return {
            "can_fly": config.thrust_to_weight_ratio >= 1.0,
            "hover_throttle_percent": hover_throttle * 100,
            "metrics": result.metrics.model_dump(),
            "stability": result.stability.model_dump(),
            "flight_envelope": envelope,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/components", response_model=ComponentListResponse)
async def list_components():
    """
    List available components from the component database.

    Note: This is a placeholder - populate with your own component data.
    """
    # Return empty schema - user populates their own data
    return ComponentListResponse(
        motors=[
            ComponentInfo(
                id="motor_template",
                name="Motor Template",
                category="motor",
                specs={
                    "required_fields": [
                        "mass (kg)",
                        "kv_rating",
                        "thrust_constant (N/(rad/s)^2)",
                        "max_rpm",
                        "max_current (A)",
                    ],
                    "optional_fields": [
                        "min_rpm",
                        "resistance (Ohms)",
                        "efficiency (0-1)",
                    ],
                },
            )
        ],
        propellers=[
            ComponentInfo(
                id="propeller_template",
                name="Propeller Template",
                category="propeller",
                specs={
                    "required_fields": [
                        "diameter (m)",
                        "pitch (m)",
                        "mass (kg)",
                    ],
                    "optional_fields": [
                        "blade_count",
                        "thrust_coefficient",
                        "power_coefficient",
                    ],
                },
            )
        ],
        batteries=[
            ComponentInfo(
                id="battery_template",
                name="Battery Template",
                category="battery",
                specs={
                    "required_fields": [
                        "cell_count",
                        "capacity_mah",
                        "mass (kg)",
                        "max_discharge_rate (C)",
                    ],
                    "optional_fields": [
                        "voltage_per_cell",
                        "internal_resistance",
                    ],
                },
            )
        ],
        frames=[
            ComponentInfo(
                id="frame_template",
                name="Frame Template",
                category="frame",
                specs={
                    "required_fields": [
                        "mass (kg)",
                        "arm_length (m)",
                        "diagonal_distance (m)",
                        "frontal_area (m^2)",
                    ],
                    "optional_fields": [
                        "frame_type",
                        "drag_coefficient",
                    ],
                },
            )
        ],
        payloads=[
            ComponentInfo(
                id="payload_template",
                name="Payload Template",
                category="payload",
                specs={
                    "required_fields": ["mass (kg)"],
                    "optional_fields": [
                        "position (x, y, z)",
                        "frontal_area (m^2)",
                        "drag_coefficient",
                    ],
                },
            )
        ],
        tethers=[
            ComponentInfo(
                id="tether_template",
                name="Tether Template",
                category="tether",
                specs={
                    "required_fields": [
                        "length (m)",
                        "mass_per_meter (kg/m)",
                        "diameter (m)",
                        "stiffness (N/m)",
                        "breaking_strength (N)",
                    ],
                    "optional_fields": [
                        "damping (N*s/m)",
                        "drag_coefficient",
                    ],
                },
            )
        ],
    )


@router.get("/sample-config", response_model=DroneConfiguration)
async def get_sample_configuration():
    """
    Get a sample drone configuration for testing.

    Returns a basic quadcopter configuration.
    """
    from ..models.drone import (
        Motor,
        MotorType,
        Propeller,
        PropellerType,
        Battery,
        BatteryType,
        Frame,
        FrameType,
        Vector3,
    )

    return DroneConfiguration(
        id="sample_quad",
        name="Sample Quadcopter",
        motors=[
            Motor(
                id=f"motor_{i}",
                name=f"Sample Motor {i+1}",
                motor_type=MotorType.BRUSHLESS,
                mass=0.05,
                kv_rating=920,
                thrust_constant=1.5e-5,
                max_rpm=12000,
                max_current=20,
                position=Vector3(
                    x=0.15 * (1 if i in [0, 3] else -1),
                    y=0,
                    z=0.15 * (1 if i in [0, 1] else -1),
                ),
                rotation_direction=1 if i in [0, 2] else -1,
            )
            for i in range(4)
        ],
        propellers=[
            Propeller(
                id=f"prop_{i}",
                name="10x4.5 Propeller",
                diameter=0.254,
                pitch=0.114,
                mass=0.015,
                blade_count=PropellerType.TWO_BLADE,
            )
            for i in range(4)
        ],
        battery=Battery(
            id="battery_1",
            name="4S 5000mAh LiPo",
            battery_type=BatteryType.LIPO,
            cell_count=4,
            capacity_mah=5000,
            mass=0.5,
            max_discharge_rate=50,
        ),
        frame=Frame(
            id="frame_1",
            name="450mm Quadcopter Frame",
            frame_type=FrameType.QUADCOPTER_X,
            mass=0.3,
            arm_length=0.225,
            diagonal_distance=0.45,
            frontal_area=0.04,
        ),
    )


def _create_empty_metrics(config: DroneConfiguration) -> PhysicsMetrics:
    """Create empty metrics for failed simulation."""
    from ..models.drone import Vector3

    return PhysicsMetrics(
        total_thrust=0,
        thrust_per_motor=[0] * len(config.motors),
        thrust_to_weight_ratio=config.thrust_to_weight_ratio,
        total_weight=config.total_mass * GRAVITY,
        total_mass=config.total_mass,
        drag_force=0,
        drag_coefficient=config.frame.drag_coefficient,
        wind_force=Vector3(),
        wind_speed=0,
        tether_tension=0,
        tether_angle=0,
        power_consumption=0,
        estimated_flight_time=0,
    )


def _create_empty_stability() -> StabilityReport:
    """Create empty stability report for failed simulation."""
    from ..models.drone import Vector3

    return StabilityReport(
        stability_score=0,
        stability_class="critical",
        com_position=Vector3(),
        com_offset_from_center=0,
        net_torque=Vector3(),
        torque_imbalance=0,
        current_tilt=0,
        max_safe_tilt=45,
        tilt_margin=45,
        roll_authority=0,
        pitch_authority=0,
        yaw_authority=0,
        altitude_authority=0,
        warnings=[],
        critical_issues=["Configuration validation failed"],
    )


# ============== Gesture Control Endpoints ==============


class GestureContextRequest(BaseModel):
    """Request to set gesture context."""
    context: str


class GestureStatusResponse(BaseModel):
    """Gesture detection status response."""
    running: bool
    context: str
    available_gestures: List[str]
    help_text: str


class GestureMappingInfo(BaseModel):
    """Information about a gesture mapping."""
    gesture: str
    action: str
    description: str
    min_confidence: float


# Gesture detection state
_gesture_controller = None
_gesture_running = False


@router.get("/gesture/status", response_model=GestureStatusResponse)
async def get_gesture_status():
    """Get the current gesture detection status."""
    try:
        from ..gesture import (
            get_gesture_controller,
            GestureType,
        )

        controller = get_gesture_controller()
        mappings = controller.mapper.get_mappings_for_context()

        return GestureStatusResponse(
            running=controller.running,
            context=controller.mapper.context.value,
            available_gestures=[m.gesture.value for m in mappings],
            help_text=controller.mapper.get_help_text(),
        )

    except ImportError as e:
        return GestureStatusResponse(
            running=False,
            context="default",
            available_gestures=[],
            help_text=f"Gesture detection not available: {e}",
        )


@router.post("/gesture/start")
async def start_gesture_detection(show_preview: bool = False):
    """
    Start gesture detection.

    Args:
        show_preview: Whether to show camera preview window
    """
    global _gesture_controller, _gesture_running

    try:
        from ..gesture import get_gesture_controller

        if _gesture_running:
            return {"status": "already_running", "message": "Gesture detection is already running"}

        controller = get_gesture_controller()
        success = controller.start(show_preview=show_preview)

        if success:
            _gesture_controller = controller
            _gesture_running = True
            return {"status": "started", "message": "Gesture detection started"}
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to start gesture detection. Check camera connection."
            )

    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=f"MediaPipe not installed: {e}. Install with: pip install mediapipe opencv-python"
        )


@router.post("/gesture/stop")
async def stop_gesture_detection():
    """Stop gesture detection."""
    global _gesture_controller, _gesture_running

    try:
        from ..gesture import cleanup_gesture_controller

        cleanup_gesture_controller()
        _gesture_controller = None
        _gesture_running = False

        return {"status": "stopped", "message": "Gesture detection stopped"}

    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/gesture/context")
async def set_gesture_context(request: GestureContextRequest):
    """
    Set the gesture interpretation context.

    Available contexts:
    - default
    - component_selection
    - parameter_adjustment
    - simulation_running
    - view_control
    """
    try:
        from ..gesture import get_gesture_controller, GestureContext

        controller = get_gesture_controller()

        # Map string to enum
        context_map = {
            "default": GestureContext.DEFAULT,
            "component_selection": GestureContext.COMPONENT_SELECTION,
            "parameter_adjustment": GestureContext.PARAMETER_ADJUSTMENT,
            "simulation_running": GestureContext.SIMULATION_RUNNING,
            "view_control": GestureContext.VIEW_CONTROL,
        }

        context = context_map.get(request.context.lower())
        if not context:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid context. Available: {list(context_map.keys())}"
            )

        controller.set_context(context)

        return {
            "status": "updated",
            "context": context.value,
            "help_text": controller.mapper.get_help_text(),
        }

    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Gesture module not available: {e}")


@router.get("/gesture/mappings")
async def get_gesture_mappings(context: Optional[str] = None):
    """
    Get available gesture mappings for a context.

    Args:
        context: Optional context to get mappings for (uses current if not specified)
    """
    try:
        from ..gesture import get_gesture_controller, GestureContext

        controller = get_gesture_controller()

        # Get context enum if specified
        target_context = None
        if context:
            context_map = {
                "default": GestureContext.DEFAULT,
                "component_selection": GestureContext.COMPONENT_SELECTION,
                "parameter_adjustment": GestureContext.PARAMETER_ADJUSTMENT,
                "simulation_running": GestureContext.SIMULATION_RUNNING,
                "view_control": GestureContext.VIEW_CONTROL,
            }
            target_context = context_map.get(context.lower())

        mappings = controller.mapper.get_mappings_for_context(target_context)

        return {
            "context": (target_context or controller.mapper.context).value,
            "mappings": [
                GestureMappingInfo(
                    gesture=m.gesture.value,
                    action=m.action.value,
                    description=m.description,
                    min_confidence=m.min_confidence,
                ).model_dump()
                for m in mappings
            ],
        }

    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Gesture module not available: {e}")


@router.get("/gesture/frame")
async def get_gesture_frame():
    """
    Get the current camera frame as JPEG.

    Useful for debugging gesture detection.
    """
    try:
        from ..gesture import get_gesture_detector

        detector = get_gesture_detector()

        if not detector.running:
            raise HTTPException(status_code=400, detail="Gesture detection not running")

        # Process a frame
        detector.process_frame()

        # Get frame as JPEG
        jpeg_data = detector.get_frame_jpeg()
        if jpeg_data is None:
            raise HTTPException(status_code=500, detail="Failed to get frame")

        return StreamingResponse(
            iter([jpeg_data]),
            media_type="image/jpeg",
        )

    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Gesture module not available: {e}")


async def generate_frames():
    """Generator for video streaming."""
    from ..gesture import get_gesture_detector

    detector = get_gesture_detector()

    while detector.running:
        detector.process_frame()
        jpeg_data = detector.get_frame_jpeg()

        if jpeg_data:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + jpeg_data + b"\r\n"
            )

        await asyncio.sleep(1 / 30)  # 30 fps


@router.get("/gesture/stream")
async def stream_gesture_video():
    """
    Stream video feed with gesture annotations.

    Returns: MJPEG stream
    """
    try:
        from ..gesture import get_gesture_detector

        detector = get_gesture_detector()

        if not detector.running:
            raise HTTPException(status_code=400, detail="Gesture detection not running")

        return StreamingResponse(
            generate_frames(),
            media_type="multipart/x-mixed-replace; boundary=frame",
        )

    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Gesture module not available: {e}")


@router.get("/gesture/contexts")
async def list_gesture_contexts():
    """List all available gesture contexts."""
    try:
        from ..gesture import GestureContext

        return {
            "contexts": [
                {
                    "id": ctx.value,
                    "name": ctx.name.replace("_", " ").title(),
                    "description": _get_context_description(ctx),
                }
                for ctx in GestureContext
            ]
        }

    except ImportError:
        return {"contexts": []}


def _get_context_description(context) -> str:
    """Get description for a gesture context."""
    from ..gesture import GestureContext

    descriptions = {
        GestureContext.DEFAULT: "Default gestures for general navigation",
        GestureContext.COMPONENT_SELECTION: "Gestures for selecting and browsing drone components",
        GestureContext.PARAMETER_ADJUSTMENT: "Gestures for adjusting simulation parameters",
        GestureContext.SIMULATION_RUNNING: "Gestures for controlling active simulation",
        GestureContext.VIEW_CONTROL: "Gestures for manipulating the 3D view",
    }
    return descriptions.get(context, "Custom context")

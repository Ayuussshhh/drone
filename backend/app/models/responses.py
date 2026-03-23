"""
Pydantic models for API responses.

These models define the structure of data returned by API endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from .drone import Vector3, DroneConfiguration
from .simulation import SimulationState, SimulationResult, FlightStatus


class PhysicsMetrics(BaseModel):
    """
    Real-time physics metrics for dashboard display.
    """

    # Thrust metrics
    total_thrust: float = Field(..., description="Total thrust in Newtons")
    thrust_per_motor: list[float] = Field(..., description="Thrust per motor")
    thrust_to_weight_ratio: float = Field(..., description="Current T/W ratio")

    # Weight metrics
    total_weight: float = Field(..., description="Total weight (N)")
    total_mass: float = Field(..., description="Total mass (kg)")

    # Drag metrics
    drag_force: float = Field(..., description="Total drag force (N)")
    drag_coefficient: float = Field(..., description="Effective drag coefficient")

    # Wind metrics
    wind_force: Vector3 = Field(..., description="Wind force vector")
    wind_speed: float = Field(..., description="Wind speed (m/s)")

    # Tether metrics
    tether_tension: float = Field(default=0.0, description="Tether tension (N)")
    tether_angle: float = Field(default=0.0, description="Tether angle from vertical")

    # Power metrics
    power_consumption: float = Field(..., description="Power consumption (W)")
    estimated_flight_time: float = Field(
        ..., description="Estimated remaining flight time (s)"
    )


class StabilityReport(BaseModel):
    """
    Stability analysis report.
    """

    # Overall stability score (0-100)
    stability_score: float = Field(
        ..., ge=0, le=100, description="Overall stability score"
    )

    # Stability classification
    stability_class: Literal["stable", "marginal", "unstable", "critical"] = Field(
        ..., description="Stability classification"
    )

    # Center of mass analysis
    com_position: Vector3 = Field(..., description="Center of mass position")
    com_offset_from_center: float = Field(
        ..., description="CoM offset from geometric center"
    )

    # Torque analysis
    net_torque: Vector3 = Field(..., description="Net torque vector")
    torque_imbalance: float = Field(..., description="Torque imbalance magnitude")

    # Tilt analysis
    current_tilt: float = Field(..., description="Current tilt angle (degrees)")
    max_safe_tilt: float = Field(..., description="Maximum safe tilt angle")
    tilt_margin: float = Field(..., description="Margin to max safe tilt")

    # Oscillation analysis
    oscillation_amplitude: float = Field(
        default=0.0, description="Oscillation amplitude"
    )
    oscillation_frequency: float = Field(
        default=0.0, description="Oscillation frequency (Hz)"
    )
    is_oscillating: bool = Field(default=False, description="Whether drone is oscillating")

    # Control authority
    roll_authority: float = Field(..., description="Roll control authority (0-100)")
    pitch_authority: float = Field(..., description="Pitch control authority (0-100)")
    yaw_authority: float = Field(..., description="Yaw control authority (0-100)")
    altitude_authority: float = Field(
        ..., description="Altitude control authority (0-100)"
    )

    # Warnings
    warnings: list[str] = Field(default_factory=list)
    critical_issues: list[str] = Field(default_factory=list)


class SimulationResponse(BaseModel):
    """
    Response from simulation endpoint.
    """

    # Status
    success: bool = Field(..., description="Whether simulation completed successfully")
    status: Literal["completed", "failed", "timeout", "error"] = Field(
        ..., description="Simulation status"
    )
    message: str = Field(default="", description="Status message")

    # Prediction
    can_fly: bool = Field(..., description="Whether the drone can fly")
    flight_status: FlightStatus = Field(..., description="Predicted flight status")

    # Metrics
    metrics: PhysicsMetrics = Field(..., description="Physics metrics")
    stability: StabilityReport = Field(..., description="Stability report")

    # Full result (optional, for detailed analysis)
    result: Optional[SimulationResult] = Field(
        default=None, description="Full simulation result"
    )


class ValidationResponse(BaseModel):
    """
    Response from configuration validation endpoint.
    """

    # Validation status
    valid: bool = Field(..., description="Whether configuration is valid")
    can_fly: bool = Field(..., description="Whether drone can theoretically fly")

    # Issues found
    errors: list[str] = Field(default_factory=list, description="Critical errors")
    warnings: list[str] = Field(default_factory=list, description="Warnings")

    # Quick metrics
    total_mass: float = Field(..., description="Total drone mass (kg)")
    max_thrust: float = Field(..., description="Maximum thrust (N)")
    thrust_to_weight_ratio: float = Field(..., description="T/W ratio at max throttle")

    # Recommendations
    min_throttle_to_hover: float = Field(
        ..., description="Minimum throttle percentage to hover"
    )
    max_payload_capacity: float = Field(
        ..., description="Maximum additional payload capacity (kg)"
    )

    # Summary
    summary: str = Field(..., description="Human-readable summary")


class ComponentInfo(BaseModel):
    """
    Information about a component in the database.
    """

    id: str
    name: str
    category: str
    specs: dict


class ComponentListResponse(BaseModel):
    """
    Response from component list endpoint.
    """

    motors: list[ComponentInfo] = Field(default_factory=list)
    propellers: list[ComponentInfo] = Field(default_factory=list)
    batteries: list[ComponentInfo] = Field(default_factory=list)
    frames: list[ComponentInfo] = Field(default_factory=list)
    payloads: list[ComponentInfo] = Field(default_factory=list)
    tethers: list[ComponentInfo] = Field(default_factory=list)


class HealthResponse(BaseModel):
    """
    API health check response.
    """

    status: Literal["healthy", "degraded", "unhealthy"] = Field(
        default="healthy", description="Service health status"
    )
    version: str = Field(..., description="API version")
    uptime: float = Field(..., description="Uptime in seconds")
    active_simulations: int = Field(default=0, description="Number of active simulations")


class ErrorResponse(BaseModel):
    """
    Standard error response.
    """

    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[dict] = Field(default=None, description="Additional error details")

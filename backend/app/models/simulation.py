"""
Pydantic models for simulation state and parameters.

These models define the runtime state of the physics simulation
and the parameters that can be adjusted during simulation.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum
from .drone import Vector3, DroneConfiguration


class SimulationStatus(str, Enum):
    """Current simulation status."""

    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"


class FlightStatus(str, Enum):
    """Drone flight status classification."""

    GROUNDED = "grounded"
    FLYING = "flying"
    HOVERING = "hovering"
    UNSTABLE = "unstable"
    CRASHED = "crashed"


class ForceVector(BaseModel):
    """
    Represents a force vector with its application point and metadata.
    """

    force: Vector3 = Field(..., description="Force vector in Newtons")
    application_point: Vector3 = Field(
        default_factory=Vector3, description="Point of force application"
    )
    name: str = Field(default="unnamed", description="Force identifier")

    @property
    def magnitude(self) -> float:
        """Force magnitude."""
        return self.force.magnitude()

    def calculate_torque(self, pivot: Vector3) -> Vector3:
        """
        Calculate torque about a pivot point.

        Args:
            pivot: The pivot point (usually center of mass)

        Returns:
            Torque vector (N*m)
        """
        # r = application_point - pivot
        r = self.application_point - pivot
        # τ = r × F
        return r.cross(self.force)


class SimulationParameters(BaseModel):
    """
    Adjustable simulation parameters.

    These can be modified during runtime to test different conditions.
    """

    # Time parameters
    timestep: float = Field(default=0.02, gt=0, le=0.1, description="Physics timestep in seconds")
    max_duration: float = Field(default=60.0, gt=0, description="Maximum simulation duration")

    # Environmental parameters
    wind_velocity: Vector3 = Field(
        default_factory=Vector3, description="Wind velocity vector (m/s)"
    )
    wind_turbulence: float = Field(
        default=0.0, ge=0, le=1.0, description="Wind turbulence intensity (0-1)"
    )
    air_density: float = Field(default=1.225, gt=0, description="Air density (kg/m³)")

    # Control inputs (throttle for each motor, 0-1)
    motor_throttles: list[float] = Field(
        default_factory=list, description="Throttle values for each motor (0-1)"
    )

    # Target state (for PID control, optional)
    target_position: Optional[Vector3] = Field(
        default=None, description="Target position for autonomous control"
    )
    target_altitude: Optional[float] = Field(
        default=None, description="Target altitude for altitude hold"
    )

    # Simulation mode
    use_auto_stabilization: bool = Field(
        default=True, description="Enable automatic stabilization"
    )
    enable_tether: bool = Field(default=True, description="Enable tether simulation")
    enable_wind: bool = Field(default=True, description="Enable wind simulation")


class SimulationState(BaseModel):
    """
    Current state of the drone simulation.

    Updated every physics timestep and streamed to clients.
    """

    # Time
    timestamp: float = Field(default=0.0, description="Simulation time in seconds")

    # Position and orientation
    position: Vector3 = Field(
        default_factory=lambda: Vector3(x=0, y=1, z=0), description="World position"
    )
    velocity: Vector3 = Field(
        default_factory=Vector3, description="Linear velocity (m/s)"
    )
    acceleration: Vector3 = Field(
        default_factory=Vector3, description="Linear acceleration (m/s²)"
    )

    # Rotation (Euler angles in radians)
    rotation: Vector3 = Field(
        default_factory=Vector3, description="Rotation (roll, pitch, yaw) in radians"
    )
    angular_velocity: Vector3 = Field(
        default_factory=Vector3, description="Angular velocity (rad/s)"
    )

    # Forces acting on the drone
    net_force: Vector3 = Field(
        default_factory=Vector3, description="Net force vector"
    )
    net_torque: Vector3 = Field(
        default_factory=Vector3, description="Net torque vector"
    )

    # Component states
    motor_rpms: list[float] = Field(
        default_factory=list, description="Current RPM for each motor"
    )
    motor_thrusts: list[float] = Field(
        default_factory=list, description="Current thrust for each motor (N)"
    )

    # Tether state
    tether_tension: float = Field(default=0.0, description="Tether tension in Newtons")
    tether_angle: float = Field(default=0.0, description="Tether angle from vertical")

    # Battery state
    battery_voltage: float = Field(default=0.0, description="Current battery voltage")
    battery_percentage: float = Field(
        default=100.0, description="Battery charge percentage"
    )
    power_consumption: float = Field(
        default=0.0, description="Current power consumption (W)"
    )

    # Status
    flight_status: FlightStatus = Field(default=FlightStatus.GROUNDED)
    status_message: str = Field(default="", description="Status message")

    # Metrics
    altitude: float = Field(default=0.0, description="Current altitude (m)")
    ground_speed: float = Field(default=0.0, description="Horizontal speed (m/s)")
    air_speed: float = Field(default=0.0, description="Speed relative to air (m/s)")

    def update_derived_values(self):
        """Update derived values from primary state."""
        self.altitude = self.position.y
        self.ground_speed = (
            Vector3(x=self.velocity.x, y=0, z=self.velocity.z).magnitude()
        )
        self.air_speed = self.velocity.magnitude()


class SimulationResult(BaseModel):
    """
    Complete simulation result including final state and analysis.
    """

    # Final state
    final_state: SimulationState = Field(..., description="Final simulation state")

    # Time series data (sampled)
    state_history: list[SimulationState] = Field(
        default_factory=list, description="Sampled state history"
    )

    # Summary metrics
    max_altitude: float = Field(default=0.0, description="Maximum altitude reached")
    max_velocity: float = Field(default=0.0, description="Maximum velocity")
    max_acceleration: float = Field(default=0.0, description="Maximum acceleration")
    flight_duration: float = Field(default=0.0, description="Total flight duration")

    # Stability metrics
    average_tilt_angle: float = Field(
        default=0.0, description="Average tilt angle during flight"
    )
    max_tilt_angle: float = Field(default=0.0, description="Maximum tilt angle")

    # Energy metrics
    total_energy_consumed: float = Field(
        default=0.0, description="Total energy consumed (Wh)"
    )
    average_power: float = Field(default=0.0, description="Average power consumption (W)")

    # Classification
    outcome: Literal["success", "unstable", "crash", "timeout"] = Field(
        default="success", description="Simulation outcome"
    )
    outcome_reason: str = Field(default="", description="Reason for outcome")

    # Warnings and recommendations
    warnings: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class SimulationRequest(BaseModel):
    """
    Request model for starting a simulation.
    """

    drone_config: DroneConfiguration = Field(..., description="Drone configuration")
    parameters: SimulationParameters = Field(
        default_factory=SimulationParameters, description="Simulation parameters"
    )
    initial_state: Optional[SimulationState] = Field(
        default=None, description="Optional initial state"
    )


class SimulationCommand(BaseModel):
    """
    Real-time command for controlling simulation.
    """

    command: Literal["start", "stop", "pause", "resume", "reset", "update"] = Field(
        ..., description="Command type"
    )
    parameters: Optional[SimulationParameters] = Field(
        default=None, description="Updated parameters (for 'update' command)"
    )

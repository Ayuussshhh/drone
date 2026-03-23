"""
Pydantic models for drone components and configuration.

This module defines the data structures for all drone components including:
- Motors with thrust curves
- Propellers with aerodynamic properties
- Batteries with capacity and discharge characteristics
- Frame geometry and mass properties
- Payload specifications
- Tether physics parameters

The schema is designed for user-populated component databases.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from enum import Enum
import math


class Vector3(BaseModel):
    """3D vector for position, velocity, force, etc."""

    x: float = 0.0
    y: float = 0.0
    z: float = 0.0

    def magnitude(self) -> float:
        """Calculate vector magnitude."""
        return math.sqrt(self.x**2 + self.y**2 + self.z**2)

    def normalized(self) -> "Vector3":
        """Return normalized vector."""
        mag = self.magnitude()
        if mag == 0:
            return Vector3(x=0, y=0, z=0)
        return Vector3(x=self.x / mag, y=self.y / mag, z=self.z / mag)

    def __add__(self, other: "Vector3") -> "Vector3":
        return Vector3(x=self.x + other.x, y=self.y + other.y, z=self.z + other.z)

    def __sub__(self, other: "Vector3") -> "Vector3":
        return Vector3(x=self.x - other.x, y=self.y - other.y, z=self.z - other.z)

    def __mul__(self, scalar: float) -> "Vector3":
        return Vector3(x=self.x * scalar, y=self.y * scalar, z=self.z * scalar)

    def __rmul__(self, scalar: float) -> "Vector3":
        return self.__mul__(scalar)

    def dot(self, other: "Vector3") -> float:
        """Dot product."""
        return self.x * other.x + self.y * other.y + self.z * other.z

    def cross(self, other: "Vector3") -> "Vector3":
        """Cross product."""
        return Vector3(
            x=self.y * other.z - self.z * other.y,
            y=self.z * other.x - self.x * other.z,
            z=self.x * other.y - self.y * other.x,
        )

    def to_tuple(self) -> tuple[float, float, float]:
        """Convert to tuple."""
        return (self.x, self.y, self.z)

    @classmethod
    def up(cls) -> "Vector3":
        """Unit vector pointing up (Y-axis)."""
        return cls(x=0, y=1, z=0)

    @classmethod
    def forward(cls) -> "Vector3":
        """Unit vector pointing forward (Z-axis)."""
        return cls(x=0, y=0, z=1)

    @classmethod
    def right(cls) -> "Vector3":
        """Unit vector pointing right (X-axis)."""
        return cls(x=1, y=0, z=0)


class MotorType(str, Enum):
    """Motor type classification."""

    BRUSHLESS = "brushless"
    BRUSHED = "brushed"


class Motor(BaseModel):
    """
    Motor component model.

    The thrust is calculated using: T = k_t * omega^2
    where k_t is the thrust constant and omega is the angular velocity (RPM).

    For custom components, populate these fields with real motor specifications.
    """

    id: str = Field(..., description="Unique motor identifier")
    name: str = Field(..., description="Motor model name")
    motor_type: MotorType = Field(default=MotorType.BRUSHLESS)

    # Physical properties
    mass: float = Field(..., gt=0, description="Motor mass in kg")
    kv_rating: float = Field(..., gt=0, description="KV rating (RPM per volt)")

    # Thrust characteristics
    thrust_constant: float = Field(
        ..., gt=0, description="Thrust constant k_t (N/(rad/s)^2)"
    )
    max_rpm: float = Field(..., gt=0, description="Maximum RPM")
    min_rpm: float = Field(default=0, ge=0, description="Minimum RPM (idle)")

    # Electrical properties
    max_current: float = Field(..., gt=0, description="Maximum current draw in Amps")
    resistance: float = Field(default=0.1, gt=0, description="Internal resistance in Ohms")

    # Efficiency
    efficiency: float = Field(default=0.85, gt=0, le=1.0, description="Motor efficiency")

    # Position on drone frame (relative to center of mass)
    position: Vector3 = Field(
        default_factory=Vector3, description="Position relative to drone CoM"
    )

    # Rotation direction (1 = CW, -1 = CCW)
    rotation_direction: Literal[1, -1] = Field(
        default=1, description="1 for CW, -1 for CCW"
    )

    def calculate_thrust(self, throttle: float) -> float:
        """
        Calculate thrust at given throttle (0-1).

        Args:
            throttle: Throttle value between 0 and 1

        Returns:
            Thrust in Newtons
        """
        throttle = max(0.0, min(1.0, throttle))
        rpm = self.min_rpm + throttle * (self.max_rpm - self.min_rpm)
        omega = rpm * 2 * math.pi / 60  # Convert to rad/s
        return self.thrust_constant * omega**2

    def calculate_torque(self, throttle: float) -> float:
        """
        Calculate reaction torque at given throttle.

        Args:
            throttle: Throttle value between 0 and 1

        Returns:
            Torque in N*m (sign depends on rotation direction)
        """
        thrust = self.calculate_thrust(throttle)
        # Approximate torque as proportional to thrust (simplified model)
        torque_constant = 0.01  # Typical ratio for quadcopter motors
        return thrust * torque_constant * self.rotation_direction

    def calculate_power(self, throttle: float) -> float:
        """
        Calculate power consumption at given throttle.

        Returns:
            Power in Watts
        """
        thrust = self.calculate_thrust(throttle)
        # P = T * omega / efficiency
        rpm = self.min_rpm + throttle * (self.max_rpm - self.min_rpm)
        omega = rpm * 2 * math.pi / 60
        if omega == 0:
            return 0
        return (thrust * omega / self.thrust_constant**0.5) / self.efficiency


class PropellerType(str, Enum):
    """Propeller blade configuration."""

    TWO_BLADE = "2-blade"
    THREE_BLADE = "3-blade"
    FOUR_BLADE = "4-blade"


class Propeller(BaseModel):
    """
    Propeller component model.

    Propeller nomenclature: diameter x pitch (e.g., 10x4.5 = 10" diameter, 4.5" pitch)
    """

    id: str = Field(..., description="Unique propeller identifier")
    name: str = Field(..., description="Propeller model name")

    # Dimensions (in meters)
    diameter: float = Field(..., gt=0, description="Propeller diameter in meters")
    pitch: float = Field(..., gt=0, description="Propeller pitch in meters")

    # Physical properties
    mass: float = Field(..., gt=0, description="Propeller mass in kg")
    blade_count: PropellerType = Field(default=PropellerType.TWO_BLADE)

    # Aerodynamic coefficients
    thrust_coefficient: float = Field(
        default=0.1, gt=0, description="Thrust coefficient Ct"
    )
    power_coefficient: float = Field(
        default=0.04, gt=0, description="Power coefficient Cp"
    )
    drag_coefficient: float = Field(
        default=0.01, gt=0, description="Profile drag coefficient"
    )

    # Material properties affecting inertia
    moment_of_inertia: float = Field(
        default=1e-5, gt=0, description="Moment of inertia in kg*m^2"
    )

    @property
    def area(self) -> float:
        """Propeller disk area in m^2."""
        return math.pi * (self.diameter / 2) ** 2


class BatteryType(str, Enum):
    """Battery chemistry type."""

    LIPO = "LiPo"
    LIION = "Li-Ion"
    LIHV = "LiHV"


class Battery(BaseModel):
    """
    Battery component model.

    Standard LiPo cell voltage: 3.7V nominal, 4.2V max, 3.0V min
    """

    id: str = Field(..., description="Unique battery identifier")
    name: str = Field(..., description="Battery model name")
    battery_type: BatteryType = Field(default=BatteryType.LIPO)

    # Configuration
    cell_count: int = Field(..., gt=0, description="Number of cells (S rating)")
    capacity_mah: float = Field(..., gt=0, description="Capacity in mAh")

    # Physical properties
    mass: float = Field(..., gt=0, description="Battery mass in kg")

    # Electrical characteristics
    voltage_per_cell: float = Field(default=3.7, description="Nominal voltage per cell")
    max_discharge_rate: float = Field(
        ..., gt=0, description="Max discharge rate (C rating)"
    )
    internal_resistance: float = Field(
        default=0.01, description="Internal resistance per cell in Ohms"
    )

    @property
    def nominal_voltage(self) -> float:
        """Total nominal voltage."""
        return self.cell_count * self.voltage_per_cell

    @property
    def capacity_wh(self) -> float:
        """Capacity in Watt-hours."""
        return (self.capacity_mah / 1000) * self.nominal_voltage

    @property
    def max_current(self) -> float:
        """Maximum discharge current in Amps."""
        return (self.capacity_mah / 1000) * self.max_discharge_rate

    def calculate_voltage_under_load(self, current: float) -> float:
        """
        Calculate voltage under load considering internal resistance.

        Args:
            current: Current draw in Amps

        Returns:
            Voltage under load
        """
        total_resistance = self.internal_resistance * self.cell_count
        voltage_drop = current * total_resistance
        return max(self.nominal_voltage - voltage_drop, self.cell_count * 3.0)


class FrameType(str, Enum):
    """Drone frame configuration."""

    QUADCOPTER_X = "quad_x"  # X configuration
    QUADCOPTER_PLUS = "quad_plus"  # + configuration
    HEXACOPTER = "hexa"
    OCTOCOPTER = "octo"


class Frame(BaseModel):
    """
    Drone frame component model.

    Defines the structural properties and motor mounting positions.
    """

    id: str = Field(..., description="Unique frame identifier")
    name: str = Field(..., description="Frame model name")
    frame_type: FrameType = Field(default=FrameType.QUADCOPTER_X)

    # Physical properties
    mass: float = Field(..., gt=0, description="Frame mass in kg (without motors)")
    arm_length: float = Field(..., gt=0, description="Motor arm length in meters")

    # Geometry
    diagonal_distance: float = Field(
        ..., gt=0, description="Motor-to-motor diagonal distance in meters"
    )

    # Aerodynamic properties
    frontal_area: float = Field(
        ..., gt=0, description="Frontal cross-sectional area in m^2"
    )
    drag_coefficient: float = Field(default=1.0, description="Frame drag coefficient")

    # Center of mass offset from geometric center (if any)
    com_offset: Vector3 = Field(
        default_factory=Vector3, description="Center of mass offset from geometric center"
    )

    def get_motor_positions(self) -> list[Vector3]:
        """
        Calculate motor positions based on frame type and arm length.

        Returns:
            List of Vector3 positions for each motor
        """
        positions = []

        if self.frame_type == FrameType.QUADCOPTER_X:
            # X configuration: motors at 45, 135, 225, 315 degrees
            angle_offset = math.pi / 4
            for i in range(4):
                angle = angle_offset + i * (math.pi / 2)
                x = self.arm_length * math.cos(angle)
                z = self.arm_length * math.sin(angle)
                positions.append(Vector3(x=x, y=0, z=z))

        elif self.frame_type == FrameType.QUADCOPTER_PLUS:
            # + configuration: motors at 0, 90, 180, 270 degrees
            for i in range(4):
                angle = i * (math.pi / 2)
                x = self.arm_length * math.cos(angle)
                z = self.arm_length * math.sin(angle)
                positions.append(Vector3(x=x, y=0, z=z))

        elif self.frame_type == FrameType.HEXACOPTER:
            # 6 motors at 60 degree intervals
            for i in range(6):
                angle = i * (math.pi / 3)
                x = self.arm_length * math.cos(angle)
                z = self.arm_length * math.sin(angle)
                positions.append(Vector3(x=x, y=0, z=z))

        elif self.frame_type == FrameType.OCTOCOPTER:
            # 8 motors at 45 degree intervals
            for i in range(8):
                angle = i * (math.pi / 4)
                x = self.arm_length * math.cos(angle)
                z = self.arm_length * math.sin(angle)
                positions.append(Vector3(x=x, y=0, z=z))

        return positions


class Payload(BaseModel):
    """
    Payload component model (e.g., window cleaning equipment).
    """

    id: str = Field(..., description="Unique payload identifier")
    name: str = Field(..., description="Payload name")

    # Physical properties
    mass: float = Field(..., gt=0, description="Payload mass in kg")

    # Position relative to drone center
    position: Vector3 = Field(
        default_factory=Vector3, description="Payload position relative to drone CoM"
    )

    # Aerodynamic properties
    frontal_area: float = Field(
        default=0.01, gt=0, description="Frontal area in m^2"
    )
    drag_coefficient: float = Field(default=1.2, description="Payload drag coefficient")


class TetherType(str, Enum):
    """Tether material type."""

    STEEL_CABLE = "steel"
    SYNTHETIC_ROPE = "synthetic"
    POWER_CABLE = "power"  # Combined power + data


class Tether(BaseModel):
    """
    Tether component model for window-cleaning drone.

    Implements spring-damper physics model: F = -k*x - c*v
    where k is stiffness, x is extension, c is damping, v is velocity
    """

    id: str = Field(..., description="Unique tether identifier")
    name: str = Field(..., description="Tether name")
    tether_type: TetherType = Field(default=TetherType.SYNTHETIC_ROPE)

    # Physical properties
    length: float = Field(..., gt=0, description="Tether length in meters")
    mass_per_meter: float = Field(..., gt=0, description="Mass per meter in kg/m")
    diameter: float = Field(..., gt=0, description="Tether diameter in meters")

    # Mechanical properties
    stiffness: float = Field(
        ..., gt=0, description="Spring stiffness k in N/m"
    )
    damping: float = Field(
        default=10.0, gt=0, description="Damping coefficient c in N*s/m"
    )
    breaking_strength: float = Field(
        ..., gt=0, description="Breaking strength in Newtons"
    )

    # Aerodynamic properties (for wind effects on tether)
    drag_coefficient: float = Field(
        default=1.2, description="Tether drag coefficient"
    )

    # Attachment point on drone (relative to CoM)
    attachment_point: Vector3 = Field(
        default_factory=lambda: Vector3(x=0, y=-0.1, z=0),
        description="Attachment point on drone",
    )

    # Anchor point in world coordinates
    anchor_point: Vector3 = Field(
        default_factory=Vector3, description="Fixed anchor point in world coordinates"
    )

    @property
    def total_mass(self) -> float:
        """Total tether mass."""
        return self.length * self.mass_per_meter

    @property
    def frontal_area(self) -> float:
        """Frontal area for drag calculation (diameter * length)."""
        return self.diameter * self.length

    def calculate_tension(
        self, drone_position: Vector3, drone_velocity: Vector3
    ) -> tuple[float, Vector3]:
        """
        Calculate tether tension force.

        Args:
            drone_position: Current drone position in world coordinates
            drone_velocity: Current drone velocity

        Returns:
            Tuple of (tension magnitude, force direction vector)
        """
        # Vector from anchor to attachment point
        attachment_world = drone_position + self.attachment_point
        tether_vector = attachment_world - self.anchor_point
        current_length = tether_vector.magnitude()

        if current_length == 0:
            return (0.0, Vector3())

        # Direction from drone toward anchor
        direction = (self.anchor_point - attachment_world).normalized()

        # Extension (positive when stretched beyond natural length)
        extension = current_length - self.length

        if extension <= 0:
            # Tether is slack
            return (0.0, Vector3())

        # Spring force
        spring_force = self.stiffness * extension

        # Damping force (velocity component along tether)
        velocity_along_tether = drone_velocity.dot(direction.normalized())
        damping_force = self.damping * abs(velocity_along_tether)

        # Total tension
        tension = spring_force + damping_force

        # Clamp to breaking strength
        if tension > self.breaking_strength:
            tension = self.breaking_strength

        return (tension, direction)


class DroneConfiguration(BaseModel):
    """
    Complete drone configuration combining all components.

    This is the main model for defining a drone design.
    """

    id: str = Field(default="drone_1", description="Configuration identifier")
    name: str = Field(default="Custom Drone", description="Configuration name")

    # Components
    motors: list[Motor] = Field(..., min_length=1, description="List of motors")
    propellers: list[Propeller] = Field(
        ..., min_length=1, description="List of propellers (matched to motors)"
    )
    battery: Battery = Field(..., description="Battery configuration")
    frame: Frame = Field(..., description="Frame configuration")
    payload: Optional[Payload] = Field(default=None, description="Optional payload")
    tether: Optional[Tether] = Field(
        default=None, description="Optional tether for window cleaning"
    )

    @field_validator("propellers")
    @classmethod
    def propellers_match_motors(cls, v, info):
        """Ensure number of propellers matches motors."""
        motors = info.data.get("motors", [])
        if motors and len(v) != len(motors):
            raise ValueError(
                f"Number of propellers ({len(v)}) must match motors ({len(motors)})"
            )
        return v

    @property
    def total_mass(self) -> float:
        """Calculate total drone mass including all components."""
        mass = self.frame.mass + self.battery.mass
        mass += sum(m.mass for m in self.motors)
        mass += sum(p.mass for p in self.propellers)
        if self.payload:
            mass += self.payload.mass
        if self.tether:
            # Include portion of tether mass (approximately half)
            mass += self.tether.total_mass * 0.5
        return mass

    @property
    def total_frontal_area(self) -> float:
        """Calculate total frontal area for drag."""
        area = self.frame.frontal_area
        if self.payload:
            area += self.payload.frontal_area
        return area

    @property
    def max_thrust(self) -> float:
        """Calculate maximum possible thrust (all motors at 100%)."""
        return sum(m.calculate_thrust(1.0) for m in self.motors)

    @property
    def thrust_to_weight_ratio(self) -> float:
        """Calculate thrust-to-weight ratio at max throttle."""
        from ..config import GRAVITY

        weight = self.total_mass * GRAVITY
        if weight == 0:
            return 0
        return self.max_thrust / weight

    def calculate_center_of_mass(self) -> Vector3:
        """
        Calculate the center of mass of the entire drone.

        Returns:
            Vector3 representing the CoM position relative to frame center
        """
        total_mass = self.total_mass
        if total_mass == 0:
            return Vector3()

        # Weighted sum of component positions
        com = Vector3()

        # Frame CoM (at geometric center plus offset)
        com = com + self.frame.com_offset * self.frame.mass

        # Motors
        for motor in self.motors:
            com = com + motor.position * motor.mass

        # Battery (assumed at center)
        # com += Vector3() * self.battery.mass  # No contribution if at center

        # Payload
        if self.payload:
            com = com + self.payload.position * self.payload.mass

        # Divide by total mass
        return com * (1.0 / total_mass)

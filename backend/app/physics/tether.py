"""
Tether physics module for window-cleaning drone simulation.

This module implements tether mechanics including:
- Spring-damper force model
- Tension and slack states
- Catenary approximation for hanging tether
- Breaking strength and safety limits

Tether Model (Spring-Damper):
    F = -k * x - c * v

Where:
    F = Tether force (N) - pulls drone toward anchor
    k = Stiffness (N/m)
    x = Extension beyond natural length (m)
    c = Damping coefficient (N*s/m)
    v = Rate of extension (m/s)
"""

import math
from typing import Tuple, Optional
from dataclasses import dataclass

from ..models.drone import Vector3, Tether
from ..config import GRAVITY


@dataclass
class TetherState:
    """Current state of the tether."""

    # Geometry
    current_length: float  # Current length from anchor to attachment
    extension: float  # Amount stretched beyond natural length
    angle_from_vertical: float  # Angle in radians

    # Forces
    tension: float  # Tension magnitude (N)
    force_on_drone: Vector3  # Force vector applied to drone

    # Status
    is_taut: bool  # Whether tether is stretched
    is_broken: bool  # Whether tether has exceeded breaking strength
    safety_factor: float  # Current_strength / tension

    # Catenary
    sag: float  # Maximum sag of hanging tether


class TetherPhysics:
    """
    Physics simulation for tethered drone.
    """

    def __init__(self, gravity: float = GRAVITY):
        """
        Initialize tether physics.

        Args:
            gravity: Gravitational acceleration (m/s²)
        """
        self.gravity = gravity
        self._previous_length = None  # For velocity calculation

    def calculate_tether_state(
        self,
        tether: Tether,
        drone_position: Vector3,
        drone_velocity: Vector3,
        dt: float,
    ) -> TetherState:
        """
        Calculate complete tether state.

        Args:
            tether: Tether configuration
            drone_position: Current drone position in world coordinates
            drone_velocity: Current drone velocity
            dt: Time step for velocity calculation

        Returns:
            TetherState with all computed values
        """
        # Calculate attachment point in world coordinates
        attachment_world = drone_position + tether.attachment_point

        # Vector from anchor to attachment
        tether_vector = attachment_world - tether.anchor_point
        current_length = tether_vector.magnitude()

        # Calculate extension (positive when stretched)
        extension = current_length - tether.length

        # Calculate angle from vertical
        if current_length > 0.001:
            # Vertical component vs total length
            vertical = Vector3(x=0, y=1, z=0)
            cos_angle = abs(tether_vector.normalized().dot(vertical))
            angle_from_vertical = math.acos(max(-1, min(1, cos_angle)))
        else:
            angle_from_vertical = 0.0

        # Calculate rate of extension (stretch velocity)
        if self._previous_length is not None and dt > 0:
            extension_rate = (current_length - self._previous_length) / dt
        else:
            # Approximate from drone velocity component along tether
            if current_length > 0.001:
                tether_direction = tether_vector.normalized()
                extension_rate = drone_velocity.dot(tether_direction)
            else:
                extension_rate = 0.0

        self._previous_length = current_length

        # Check if tether is taut (stretched beyond natural length)
        is_taut = extension > 0

        # Calculate tension and force
        if is_taut:
            tension, force_on_drone = self._calculate_tension_force(
                tether, tether_vector, extension, extension_rate
            )
        else:
            tension = 0.0
            force_on_drone = Vector3()

        # Check breaking strength
        is_broken = tension > tether.breaking_strength

        # Safety factor
        safety_factor = (
            tether.breaking_strength / tension if tension > 0 else float("inf")
        )

        # Calculate catenary sag (for visualization and aerodynamics)
        sag = self._calculate_catenary_sag(tether, current_length, tension)

        return TetherState(
            current_length=current_length,
            extension=max(0, extension),
            angle_from_vertical=angle_from_vertical,
            tension=tension,
            force_on_drone=force_on_drone,
            is_taut=is_taut,
            is_broken=is_broken,
            safety_factor=safety_factor,
            sag=sag,
        )

    def _calculate_tension_force(
        self,
        tether: Tether,
        tether_vector: Vector3,
        extension: float,
        extension_rate: float,
    ) -> Tuple[float, Vector3]:
        """
        Calculate tether tension and force using spring-damper model.

        Args:
            tether: Tether configuration
            tether_vector: Vector from anchor to attachment
            extension: Amount stretched beyond natural length
            extension_rate: Rate of extension (positive = stretching)

        Returns:
            Tuple of (tension magnitude, force vector on drone)
        """
        # Spring force (proportional to extension)
        spring_force = tether.stiffness * extension

        # Damping force (proportional to extension rate)
        # Only apply damping when pulling (stretching), not when releasing
        damping_force = tether.damping * max(0, extension_rate)

        # Total tension
        tension = spring_force + damping_force

        # Clamp to non-negative (tether can't push)
        tension = max(0, tension)

        # Force direction: from drone toward anchor
        length = tether_vector.magnitude()
        if length > 0.001:
            force_direction = (tether_vector * -1).normalized()
            force_on_drone = force_direction * tension
        else:
            force_on_drone = Vector3()

        return tension, force_on_drone

    def _calculate_catenary_sag(
        self, tether: Tether, horizontal_distance: float, tension: float
    ) -> float:
        """
        Calculate catenary sag for a hanging tether.

        When the tether is slack, it hangs in a catenary curve.
        This calculates the maximum sag (dip) at the center.

        Args:
            tether: Tether configuration
            horizontal_distance: Horizontal distance from anchor to attachment
            tension: Current tension (used to detect slack)

        Returns:
            Maximum sag in meters
        """
        if tension > 0.1:
            # Tether is taut, minimal sag
            return 0.01

        # Weight per unit length
        w = tether.mass_per_meter * self.gravity

        if horizontal_distance <= 0.01 or w <= 0:
            return 0.0

        # For small sag/span ratios, catenary approximates parabola
        # sag = w * L^2 / (8 * H)
        # where H is horizontal tension (estimated from tether weight)

        # Estimate horizontal tension as half the tether weight
        # (very rough approximation for slack tether)
        H = tether.total_mass * self.gravity * 0.5

        if H > 0:
            sag = w * horizontal_distance**2 / (8 * H)
        else:
            sag = tether.length * 0.3  # Maximum sag estimate

        return min(sag, tether.length * 0.5)  # Cap at half the length

    def calculate_torque(
        self,
        tether: Tether,
        drone_position: Vector3,
        center_of_mass: Vector3,
        tether_state: TetherState,
    ) -> Vector3:
        """
        Calculate torque on drone due to tether force.

        Args:
            tether: Tether configuration
            drone_position: Drone position
            center_of_mass: Center of mass in drone local frame
            tether_state: Current tether state

        Returns:
            Torque vector in world frame
        """
        if not tether_state.is_taut or tether_state.tension < 0.01:
            return Vector3()

        # Moment arm: from CoM to attachment point
        moment_arm = tether.attachment_point - center_of_mass

        # Torque = r × F
        torque = moment_arm.cross(tether_state.force_on_drone)

        return torque

    def calculate_constraint_force(
        self,
        tether: Tether,
        drone_position: Vector3,
        drone_velocity: Vector3,
        drone_mass: float,
        dt: float,
    ) -> Vector3:
        """
        Calculate constraint force to prevent tether from exceeding max length.

        This is an alternative to spring-damper model - implements a hard
        length constraint that prevents the drone from moving beyond tether length.

        Args:
            tether: Tether configuration
            drone_position: Current drone position
            drone_velocity: Current drone velocity
            drone_mass: Total drone mass
            dt: Time step

        Returns:
            Constraint force to apply to drone
        """
        attachment_world = drone_position + tether.attachment_point
        tether_vector = attachment_world - tether.anchor_point
        current_length = tether_vector.magnitude()

        max_length = tether.length * 1.05  # Allow 5% stretch

        if current_length < max_length:
            return Vector3()

        # Tether direction (from anchor toward drone)
        tether_dir = tether_vector.normalized()

        # Velocity component along tether (away from anchor)
        velocity_along = drone_velocity.dot(tether_dir)

        if velocity_along <= 0:
            # Moving toward or perpendicular to tether, no constraint needed
            return Vector3()

        # Calculate force to stop outward motion and pull back
        # F = m * a, where a brings velocity to zero and pulls back

        # Position correction
        position_error = current_length - max_length
        position_correction = tether.stiffness * position_error

        # Velocity correction
        velocity_correction = drone_mass * velocity_along / dt

        # Total constraint force (inward, toward anchor)
        constraint_magnitude = position_correction + velocity_correction

        return tether_dir * -constraint_magnitude

    def calculate_pendulum_frequency(
        self, tether: Tether, drone_mass: float
    ) -> float:
        """
        Calculate natural pendulum frequency of tethered drone.

        This is useful for stability analysis - the drone will tend
        to oscillate at this frequency when disturbed.

        Args:
            tether: Tether configuration
            drone_mass: Drone mass in kg

        Returns:
            Natural frequency in Hz
        """
        if tether.length <= 0:
            return 0.0

        # Simple pendulum: f = (1/2π) * sqrt(g/L)
        omega = math.sqrt(self.gravity / tether.length)
        frequency = omega / (2 * math.pi)

        return frequency

    def calculate_max_swing_angle(
        self, tether: Tether, drone_mass: float, horizontal_force: float
    ) -> float:
        """
        Calculate maximum swing angle given a horizontal force.

        In equilibrium, the horizontal force component of tension
        equals the applied horizontal force.

        Args:
            tether: Tether configuration
            drone_mass: Drone mass in kg
            horizontal_force: Applied horizontal force (e.g., wind) in N

        Returns:
            Equilibrium swing angle in radians
        """
        weight = drone_mass * self.gravity

        if weight <= 0:
            return 0.0

        # tan(theta) = F_horizontal / Weight
        angle = math.atan2(horizontal_force, weight)

        return angle

    def get_operating_envelope(
        self, tether: Tether, drone_mass: float
    ) -> dict:
        """
        Calculate safe operating envelope for tethered drone.

        Args:
            tether: Tether configuration
            drone_mass: Drone mass in kg

        Returns:
            Dictionary with operating limits
        """
        weight = drone_mass * self.gravity

        # Maximum operating radius (horizontal distance from anchor)
        # Limited by tether length and minimum safe altitude
        min_altitude = 2.0  # meters
        max_radius = math.sqrt(max(0, tether.length**2 - min_altitude**2))

        # Maximum safe tension (60% of breaking strength)
        max_safe_tension = tether.breaking_strength * 0.6

        # Maximum horizontal force before exceeding safe tension
        # F_h = T * sin(theta), T_max at theta = 45 degrees gives F_h_max ≈ T_max * 0.7
        max_horizontal_force = max_safe_tension * 0.7

        # Maximum wind speed (rough estimate)
        # F = 0.5 * rho * v^2 * Cd * A
        # Assuming typical drone: Cd*A ≈ 0.05 m²
        rho = 1.225
        CdA = 0.05
        max_wind_speed = math.sqrt(2 * max_horizontal_force / (rho * CdA))

        return {
            "max_operating_radius": max_radius,
            "max_altitude": tether.length,
            "min_altitude": min_altitude,
            "max_safe_tension": max_safe_tension,
            "breaking_strength": tether.breaking_strength,
            "max_horizontal_force": max_horizontal_force,
            "max_wind_speed": max_wind_speed,
            "pendulum_frequency": self.calculate_pendulum_frequency(tether, drone_mass),
        }

    def reset(self):
        """Reset internal state (call when starting new simulation)."""
        self._previous_length = None

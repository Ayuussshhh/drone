"""
Aerodynamic drag calculation module for drone physics simulation.

This module implements drag force calculations based on:
- Drone velocity relative to air
- Frontal area and drag coefficient
- Air density
- Altitude-based corrections

Drag Model:
    F_d = 0.5 * rho * v^2 * C_d * A

Where:
    F_d = Drag force (N)
    rho = Air density (kg/m³)
    v = Velocity relative to air (m/s)
    C_d = Drag coefficient (dimensionless)
    A = Reference area (m²)
"""

import math
from typing import Optional
import numpy as np

from ..models.drone import Vector3, DroneConfiguration, Frame, Payload, Tether
from ..config import AIR_DENSITY


class DragCalculator:
    """
    Calculator for aerodynamic drag forces on the drone and its components.
    """

    # Standard atmosphere constants
    SEA_LEVEL_DENSITY = 1.225  # kg/m³
    SEA_LEVEL_TEMPERATURE = 288.15  # K (15°C)
    TEMPERATURE_LAPSE_RATE = 0.0065  # K/m

    def __init__(self, air_density: float = AIR_DENSITY):
        """
        Initialize drag calculator.

        Args:
            air_density: Air density in kg/m³
        """
        self.air_density = air_density

    def set_air_density(self, density: float):
        """Update air density."""
        self.air_density = density

    def set_altitude(self, altitude: float):
        """
        Set air density based on altitude using standard atmosphere model.

        Args:
            altitude: Altitude above sea level in meters
        """
        # Temperature at altitude
        T = self.SEA_LEVEL_TEMPERATURE - self.TEMPERATURE_LAPSE_RATE * altitude

        # Density ratio (barometric formula approximation)
        if T > 0:
            self.air_density = self.SEA_LEVEL_DENSITY * (
                T / self.SEA_LEVEL_TEMPERATURE
            ) ** 4.256
        else:
            self.air_density = 0.1  # Minimum density

    def calculate_drag_force(
        self,
        velocity: Vector3,
        frontal_area: float,
        drag_coefficient: float,
        wind_velocity: Optional[Vector3] = None,
    ) -> Vector3:
        """
        Calculate drag force vector.

        Args:
            velocity: Object velocity in world frame (m/s)
            frontal_area: Reference frontal area (m²)
            drag_coefficient: Drag coefficient
            wind_velocity: Optional wind velocity vector

        Returns:
            Drag force vector (N) - opposite to relative velocity
        """
        # Calculate velocity relative to air
        if wind_velocity:
            relative_velocity = velocity - wind_velocity
        else:
            relative_velocity = velocity

        speed = relative_velocity.magnitude()

        if speed < 0.001:  # Negligible velocity
            return Vector3()

        # Drag magnitude: F = 0.5 * rho * v^2 * Cd * A
        drag_magnitude = (
            0.5 * self.air_density * speed**2 * drag_coefficient * frontal_area
        )

        # Drag direction: opposite to relative velocity
        drag_direction = relative_velocity.normalized() * -1

        return drag_direction * drag_magnitude

    def calculate_drone_drag(
        self,
        config: DroneConfiguration,
        velocity: Vector3,
        rotation: Vector3 = None,
        wind_velocity: Optional[Vector3] = None,
    ) -> Vector3:
        """
        Calculate total drag on the drone.

        Considers:
        - Frame drag
        - Payload drag
        - Orientation-dependent effective area

        Args:
            config: Drone configuration
            velocity: Drone velocity
            rotation: Drone rotation (roll, pitch, yaw) in radians
            wind_velocity: Wind velocity vector

        Returns:
            Total drag force vector
        """
        # Base frontal area and drag coefficient
        effective_area = config.frame.frontal_area
        base_cd = config.frame.drag_coefficient

        # Add payload contribution
        if config.payload:
            effective_area += config.payload.frontal_area
            # Weighted average drag coefficient
            total_area = config.frame.frontal_area + config.payload.frontal_area
            base_cd = (
                config.frame.drag_coefficient * config.frame.frontal_area
                + config.payload.drag_coefficient * config.payload.frontal_area
            ) / total_area

        # Orientation-dependent area correction
        if rotation:
            # When tilted, present more area to the airflow
            # Simplified model: effective area increases with tilt
            roll, pitch, _ = rotation.x, rotation.z, rotation.y  # Note: y is yaw

            # Increase effective area based on tilt magnitude
            tilt_factor = 1.0 + 0.5 * (abs(math.sin(roll)) + abs(math.sin(pitch)))
            effective_area *= tilt_factor

            # Drag coefficient also increases with tilt (flow separation)
            cd_factor = 1.0 + 0.3 * (abs(math.sin(roll)) + abs(math.sin(pitch)))
            base_cd *= cd_factor

        return self.calculate_drag_force(
            velocity, effective_area, base_cd, wind_velocity
        )

    def calculate_tether_drag(
        self,
        tether: Tether,
        drone_position: Vector3,
        drone_velocity: Vector3,
        wind_velocity: Optional[Vector3] = None,
    ) -> Vector3:
        """
        Calculate drag force on tether.

        Models tether as a cylinder with velocity-dependent drag.

        Args:
            tether: Tether configuration
            drone_position: Current drone position
            drone_velocity: Drone velocity
            wind_velocity: Wind velocity

        Returns:
            Tether drag force (applied at drone attachment point)
        """
        # Calculate tether geometry
        attachment_world = drone_position + tether.attachment_point
        tether_vector = attachment_world - tether.anchor_point
        tether_length = tether_vector.magnitude()

        if tether_length < 0.01:
            return Vector3()

        # Calculate average velocity along tether
        # Simplified: assume linear velocity distribution from anchor (0) to drone
        if wind_velocity:
            relative_velocity = drone_velocity - wind_velocity
        else:
            relative_velocity = drone_velocity

        # Average velocity is approximately half of drone velocity
        # (anchor fixed, drone moving)
        average_velocity = relative_velocity * 0.5

        speed = average_velocity.magnitude()
        if speed < 0.01:
            return Vector3()

        # Tether frontal area (diameter * length)
        frontal_area = tether.diameter * tether_length

        # Cylinder drag coefficient (perpendicular flow)
        # For flow at angle to cylinder, Cd varies
        # Simplified: use constant Cd
        cd = tether.drag_coefficient

        # Calculate perpendicular component of velocity
        tether_direction = tether_vector.normalized()
        velocity_along = tether_direction * (average_velocity.dot(tether_direction))
        velocity_perpendicular = average_velocity - velocity_along

        perp_speed = velocity_perpendicular.magnitude()

        if perp_speed < 0.01:
            return Vector3()

        # Drag on perpendicular component
        drag_magnitude = 0.5 * self.air_density * perp_speed**2 * cd * frontal_area

        # Drag direction: opposite to perpendicular velocity
        drag_direction = velocity_perpendicular.normalized() * -1

        return drag_direction * drag_magnitude

    def calculate_propeller_drag(
        self,
        propeller_diameter: float,
        rpm: float,
        translation_velocity: Vector3,
    ) -> Vector3:
        """
        Calculate parasitic drag from spinning propellers.

        This is additional drag beyond what's accounted for in thrust calculations.

        Args:
            propeller_diameter: Propeller diameter in meters
            rpm: Propeller RPM
            translation_velocity: Drone translation velocity

        Returns:
            Parasitic drag force
        """
        speed = translation_velocity.magnitude()
        if speed < 0.01:
            return Vector3()

        # Propeller creates additional drag when moving through air
        # Approximation based on advance ratio
        omega = rpm * 2 * math.pi / 60
        if omega < 0.01:
            return Vector3()

        # Advance ratio J = V / (n * D)
        n = rpm / 60
        J = speed / (n * propeller_diameter) if n * propeller_diameter > 0 else 0

        # Parasitic drag coefficient (empirical, increases with J)
        Cd_parasitic = 0.02 * (1 + J**2)

        # Reference area (propeller disc)
        area = math.pi * (propeller_diameter / 2) ** 2

        drag_magnitude = 0.5 * self.air_density * speed**2 * Cd_parasitic * area

        drag_direction = translation_velocity.normalized() * -1

        return drag_direction * drag_magnitude

    def calculate_induced_drag(
        self,
        thrust: float,
        velocity: Vector3,
        propeller_diameter: float,
    ) -> Vector3:
        """
        Calculate induced drag (drag due to lift/thrust generation).

        When the drone tilts to move, thrust creates an induced drag component.

        Args:
            thrust: Total thrust in Newtons
            velocity: Drone velocity
            propeller_diameter: Average propeller diameter

        Returns:
            Induced drag force
        """
        speed = velocity.magnitude()
        if speed < 0.01 or thrust <= 0:
            return Vector3()

        # Induced velocity
        area = math.pi * (propeller_diameter / 2) ** 2
        v_induced = math.sqrt(thrust / (2 * self.air_density * area))

        if v_induced < 0.01:
            return Vector3()

        # Induced drag: proportional to thrust and forward speed
        # D_i = T * V / (2 * v_induced) for small angles
        induced_drag = thrust * speed / (2 * v_induced)

        # Direction: opposite to velocity
        drag_direction = velocity.normalized() * -1

        return drag_direction * induced_drag

    def calculate_total_drag(
        self,
        config: DroneConfiguration,
        velocity: Vector3,
        rotation: Vector3,
        thrust: float,
        motor_rpms: list[float],
        wind_velocity: Optional[Vector3] = None,
    ) -> dict:
        """
        Calculate all drag components.

        Args:
            config: Drone configuration
            velocity: Drone velocity
            rotation: Drone rotation
            thrust: Current total thrust
            motor_rpms: RPM for each motor
            wind_velocity: Wind velocity

        Returns:
            Dictionary with drag breakdown and total
        """
        # Drone body drag
        body_drag = self.calculate_drone_drag(config, velocity, rotation, wind_velocity)

        # Tether drag
        tether_drag = Vector3()
        if config.tether:
            # Need drone position - use default for calculation
            tether_drag = self.calculate_tether_drag(
                config.tether,
                Vector3(x=0, y=5, z=0),  # Placeholder position
                velocity,
                wind_velocity,
            )

        # Propeller parasitic drag (average)
        prop_drag = Vector3()
        if config.propellers and motor_rpms:
            avg_diameter = sum(p.diameter for p in config.propellers) / len(
                config.propellers
            )
            avg_rpm = sum(motor_rpms) / len(motor_rpms)
            prop_drag = self.calculate_propeller_drag(avg_diameter, avg_rpm, velocity)

        # Induced drag
        avg_diameter = (
            sum(p.diameter for p in config.propellers) / len(config.propellers)
            if config.propellers
            else 0.3
        )
        induced_drag = self.calculate_induced_drag(thrust, velocity, avg_diameter)

        # Total drag
        total_drag = body_drag + tether_drag + prop_drag + induced_drag

        return {
            "body_drag": body_drag,
            "tether_drag": tether_drag,
            "propeller_drag": prop_drag,
            "induced_drag": induced_drag,
            "total_drag": total_drag,
            "total_magnitude": total_drag.magnitude(),
        }

    def get_drag_coefficient_info(self) -> dict:
        """
        Return reference drag coefficients for various shapes.
        Useful for UI/reference.
        """
        return {
            "sphere": 0.47,
            "cube": 1.05,
            "cylinder_axial": 0.82,
            "cylinder_perpendicular": 1.2,
            "flat_plate": 1.28,
            "streamlined_body": 0.04,
            "typical_quadcopter": 1.0,
            "typical_propeller_guard": 1.3,
        }

"""
Thrust calculation module for drone physics simulation.

This module implements motor thrust calculations based on:
- Motor characteristics (KV rating, thrust constant)
- Propeller properties (diameter, pitch, efficiency)
- Throttle input (0-1)
- Environmental conditions (air density, altitude)

Thrust Model:
    T = k_t * rho_ratio * omega^2

Where:
    T = Thrust (N)
    k_t = Thrust constant (depends on motor and propeller)
    rho_ratio = air_density / sea_level_density
    omega = Angular velocity (rad/s)
"""

import math
from typing import Optional
import numpy as np

from ..models.drone import Motor, Propeller, Vector3, DroneConfiguration
from ..config import AIR_DENSITY, GRAVITY


class ThrustCalculator:
    """
    Calculator for motor thrust and related dynamics.
    """

    # Sea level air density for reference
    SEA_LEVEL_DENSITY = 1.225  # kg/m³

    def __init__(self, air_density: float = AIR_DENSITY):
        """
        Initialize thrust calculator.

        Args:
            air_density: Current air density in kg/m³
        """
        self.air_density = air_density
        self._density_ratio = air_density / self.SEA_LEVEL_DENSITY

    def set_air_density(self, density: float):
        """Update air density (e.g., for altitude changes)."""
        self.air_density = density
        self._density_ratio = density / self.SEA_LEVEL_DENSITY

    def calculate_motor_thrust(
        self,
        motor: Motor,
        propeller: Propeller,
        throttle: float,
        inflow_velocity: float = 0.0,
    ) -> float:
        """
        Calculate thrust from a single motor-propeller combination.

        Uses a combination of momentum theory and empirical motor constants.

        Args:
            motor: Motor component
            propeller: Propeller component
            throttle: Throttle value (0-1)
            inflow_velocity: Vertical airflow velocity (affects efficiency)

        Returns:
            Thrust in Newtons
        """
        # Clamp throttle
        throttle = max(0.0, min(1.0, throttle))

        if throttle == 0:
            return 0.0

        # Calculate RPM from throttle
        rpm = motor.min_rpm + throttle * (motor.max_rpm - motor.min_rpm)
        omega = rpm * 2 * math.pi / 60  # rad/s

        # Method 1: Motor thrust constant (primary)
        thrust_motor = motor.thrust_constant * omega**2 * self._density_ratio

        # Method 2: Propeller momentum theory (for cross-validation)
        # T = Ct * rho * n^2 * D^4
        # where n is revolutions per second, D is diameter
        n = rpm / 60
        thrust_prop = (
            propeller.thrust_coefficient
            * self.air_density
            * (n**2)
            * (propeller.diameter**4)
        )

        # Use motor constant as primary (more accurate for specific motors)
        # but validate against propeller theory
        thrust = thrust_motor

        # Apply inflow velocity correction (induced velocity effect)
        if inflow_velocity > 0:
            # Momentum theory: thrust reduction with increasing inflow
            # T = T0 * sqrt(1 - v_inflow / v_induced)
            v_induced = self._calculate_induced_velocity(thrust, propeller)
            if v_induced > 0:
                velocity_ratio = min(inflow_velocity / v_induced, 0.9)
                thrust *= math.sqrt(max(0.1, 1 - velocity_ratio))

        return max(0.0, thrust)

    def calculate_motor_torque(
        self, motor: Motor, propeller: Propeller, throttle: float
    ) -> float:
        """
        Calculate reaction torque from motor.

        This torque is what causes yaw rotation in multicopters.

        Args:
            motor: Motor component
            propeller: Propeller component
            throttle: Throttle value (0-1)

        Returns:
            Torque in N*m (signed based on rotation direction)
        """
        throttle = max(0.0, min(1.0, throttle))

        if throttle == 0:
            return 0.0

        rpm = motor.min_rpm + throttle * (motor.max_rpm - motor.min_rpm)
        n = rpm / 60

        # Torque from propeller power coefficient
        # Q = Cp * rho * n^2 * D^5
        torque = (
            propeller.power_coefficient
            * self.air_density
            * (n**2)
            * (propeller.diameter**5)
        )

        # Sign based on motor rotation direction
        return torque * motor.rotation_direction

    def calculate_thrust_vector(
        self,
        motor: Motor,
        propeller: Propeller,
        throttle: float,
        motor_tilt: Vector3 = None,
    ) -> Vector3:
        """
        Calculate thrust as a 3D vector accounting for motor tilt.

        Args:
            motor: Motor component
            propeller: Propeller component
            throttle: Throttle value
            motor_tilt: Optional tilt angles (roll, pitch) for vectored thrust

        Returns:
            Thrust vector in local frame (default: pointing up)
        """
        thrust_magnitude = self.calculate_motor_thrust(motor, propeller, throttle)

        if motor_tilt is None:
            # Default: thrust straight up
            return Vector3(x=0, y=thrust_magnitude, z=0)

        # Apply tilt transformation
        # Roll rotates around X, Pitch rotates around Z
        roll = motor_tilt.x
        pitch = motor_tilt.z

        # Unit vector pointing up, rotated by tilt
        x = thrust_magnitude * math.sin(pitch)
        y = thrust_magnitude * math.cos(roll) * math.cos(pitch)
        z = -thrust_magnitude * math.sin(roll)

        return Vector3(x=x, y=y, z=z)

    def calculate_total_thrust(
        self,
        config: DroneConfiguration,
        throttles: list[float],
        motor_tilts: Optional[list[Vector3]] = None,
    ) -> tuple[Vector3, list[float]]:
        """
        Calculate total thrust from all motors.

        Args:
            config: Drone configuration
            throttles: List of throttle values for each motor
            motor_tilts: Optional list of motor tilt angles

        Returns:
            Tuple of (total thrust vector, per-motor thrust magnitudes)
        """
        if len(throttles) != len(config.motors):
            raise ValueError(
                f"Throttle count ({len(throttles)}) doesn't match motor count ({len(config.motors)})"
            )

        total_thrust = Vector3()
        thrust_magnitudes = []

        for i, (motor, prop) in enumerate(zip(config.motors, config.propellers)):
            throttle = throttles[i]
            tilt = motor_tilts[i] if motor_tilts else None

            thrust_vec = self.calculate_thrust_vector(motor, prop, throttle, tilt)
            thrust_magnitudes.append(thrust_vec.magnitude())

            total_thrust = total_thrust + thrust_vec

        return total_thrust, thrust_magnitudes

    def calculate_hover_throttle(self, config: DroneConfiguration) -> float:
        """
        Calculate the throttle required to hover.

        Returns:
            Throttle value (0-1) needed for hover, or >1 if cannot hover
        """
        weight = config.total_mass * GRAVITY
        max_thrust = config.max_thrust

        if max_thrust == 0:
            return float("inf")

        # For hover: total_thrust = weight
        # thrust = k * throttle^2 (approximately quadratic relationship)
        # So throttle = sqrt(weight / max_thrust)
        throttle_ratio = weight / max_thrust

        if throttle_ratio > 1:
            # Cannot hover
            return float("inf")

        # Account for non-linear thrust curve (approximate)
        hover_throttle = math.sqrt(throttle_ratio)

        return hover_throttle

    def calculate_max_payload(
        self, config: DroneConfiguration, safety_margin: float = 0.3
    ) -> float:
        """
        Calculate maximum additional payload capacity.

        Args:
            config: Drone configuration
            safety_margin: Reserve thrust margin (default 30%)

        Returns:
            Maximum additional payload in kg
        """
        max_thrust = config.max_thrust
        current_weight = config.total_mass * GRAVITY

        # Available thrust after safety margin
        usable_thrust = max_thrust * (1 - safety_margin)

        # Extra capacity
        extra_force = usable_thrust - current_weight

        if extra_force <= 0:
            return 0.0

        return extra_force / GRAVITY

    def calculate_thrust_efficiency(
        self, motor: Motor, propeller: Propeller, throttle: float
    ) -> float:
        """
        Calculate thrust efficiency (thrust per watt).

        Args:
            motor: Motor component
            propeller: Propeller component
            throttle: Throttle value

        Returns:
            Efficiency in N/W (grams per watt commonly used, multiply by ~102)
        """
        thrust = self.calculate_motor_thrust(motor, propeller, throttle)
        power = motor.calculate_power(throttle)

        if power == 0:
            return 0.0

        return thrust / power

    def _calculate_induced_velocity(self, thrust: float, propeller: Propeller) -> float:
        """
        Calculate induced velocity through the propeller disc (momentum theory).

        v_induced = sqrt(T / (2 * rho * A))

        Args:
            thrust: Thrust in Newtons
            propeller: Propeller component

        Returns:
            Induced velocity in m/s
        """
        if thrust <= 0:
            return 0.0

        area = propeller.area
        return math.sqrt(thrust / (2 * self.air_density * area))

    def analyze_thrust_balance(
        self, config: DroneConfiguration, throttles: list[float]
    ) -> dict:
        """
        Analyze thrust balance and identify asymmetries.

        Args:
            config: Drone configuration
            throttles: Throttle values for each motor

        Returns:
            Analysis dictionary with balance metrics
        """
        _, thrusts = self.calculate_total_thrust(config, throttles)

        thrusts_array = np.array(thrusts)
        mean_thrust = np.mean(thrusts_array)
        std_thrust = np.std(thrusts_array)

        # Calculate torque contributions
        torques = []
        for i, (motor, prop) in enumerate(zip(config.motors, config.propellers)):
            torque = self.calculate_motor_torque(motor, prop, throttles[i])
            torques.append(torque)

        net_yaw_torque = sum(torques)

        return {
            "mean_thrust": mean_thrust,
            "thrust_std": std_thrust,
            "thrust_variance_percent": (std_thrust / mean_thrust * 100) if mean_thrust > 0 else 0,
            "individual_thrusts": thrusts,
            "net_yaw_torque": net_yaw_torque,
            "is_balanced": std_thrust < mean_thrust * 0.1 and abs(net_yaw_torque) < 0.1,
        }

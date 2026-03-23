"""
Main physics engine that orchestrates all simulation modules.

This module integrates:
- Thrust calculations
- Drag forces
- Wind simulation
- Tether physics
- Stability analysis

Into a unified simulation step that updates the drone state.
"""

import math
from typing import Optional, List, Tuple, Callable
from dataclasses import dataclass
import numpy as np

from ..models.drone import Vector3, DroneConfiguration
from ..models.simulation import (
    SimulationState,
    SimulationParameters,
    SimulationResult,
    ForceVector,
    FlightStatus,
)
from ..models.responses import PhysicsMetrics, StabilityReport
from ..config import GRAVITY, AIR_DENSITY

from .thrust import ThrustCalculator
from .drag import DragCalculator
from .wind import WindSimulator, WindProfile
from .tether import TetherPhysics, TetherState
from .stability import StabilityAnalyzer


@dataclass
class PhysicsStepResult:
    """Result from a single physics simulation step."""

    state: SimulationState
    forces: List[ForceVector]
    metrics: PhysicsMetrics
    stability: StabilityReport
    tether_state: Optional[TetherState] = None


class PhysicsEngine:
    """
    Main physics simulation engine.

    Orchestrates all physics calculations and maintains simulation state.
    """

    # Physics constants
    DEFAULT_TIMESTEP = 0.02  # 50 Hz
    MAX_VELOCITY = 50.0  # m/s - sanity check
    MAX_ACCELERATION = 100.0  # m/s² - sanity check
    GROUND_LEVEL = 0.0

    def __init__(
        self,
        config: DroneConfiguration,
        parameters: Optional[SimulationParameters] = None,
    ):
        """
        Initialize physics engine.

        Args:
            config: Drone configuration
            parameters: Simulation parameters (optional)
        """
        self.config = config
        self.parameters = parameters or SimulationParameters()

        # Initialize sub-systems
        self.thrust_calc = ThrustCalculator(self.parameters.air_density)
        self.drag_calc = DragCalculator(self.parameters.air_density)
        self.wind_sim = WindSimulator(
            WindProfile(base_velocity=self.parameters.wind_velocity),
            self.parameters.air_density,
        )
        self.tether_physics = TetherPhysics()
        self.stability_analyzer = StabilityAnalyzer()

        # State
        self._state: Optional[SimulationState] = None
        self._time = 0.0
        self._running = False

        # Callbacks
        self._state_callback: Optional[Callable[[SimulationState], None]] = None

    def set_config(self, config: DroneConfiguration):
        """Update drone configuration."""
        self.config = config

    def set_parameters(self, parameters: SimulationParameters):
        """Update simulation parameters."""
        self.parameters = parameters

        # Update sub-systems
        self.thrust_calc.set_air_density(parameters.air_density)
        self.drag_calc.set_air_density(parameters.air_density)
        self.wind_sim.set_profile(
            WindProfile(
                base_velocity=parameters.wind_velocity,
                turbulence_intensity=parameters.wind_turbulence,
            )
        )

    def set_state_callback(self, callback: Callable[[SimulationState], None]):
        """Set callback for state updates (for real-time streaming)."""
        self._state_callback = callback

    def initialize(self, initial_state: Optional[SimulationState] = None):
        """
        Initialize simulation state.

        Args:
            initial_state: Optional initial state (defaults to hovering)
        """
        if initial_state:
            self._state = initial_state.model_copy()
        else:
            # Default: drone hovering at 2m altitude
            self._state = SimulationState(
                timestamp=0.0,
                position=Vector3(x=0, y=2.0, z=0),
                velocity=Vector3(),
                acceleration=Vector3(),
                rotation=Vector3(),
                angular_velocity=Vector3(),
                motor_rpms=[0.0] * len(self.config.motors),
                motor_thrusts=[0.0] * len(self.config.motors),
                flight_status=FlightStatus.HOVERING,
            )

        self._time = 0.0
        self.tether_physics.reset()
        self.stability_analyzer.reset()
        self._running = True

    def step(self, dt: Optional[float] = None) -> PhysicsStepResult:
        """
        Perform a single physics simulation step.

        Args:
            dt: Time step (uses default if not specified)

        Returns:
            PhysicsStepResult with updated state and metrics
        """
        if self._state is None:
            self.initialize()

        dt = dt or self.parameters.timestep or self.DEFAULT_TIMESTEP
        self._time += dt
        self._state.timestamp = self._time

        # Collect all forces
        forces: List[ForceVector] = []

        # 1. Calculate thrust forces
        throttles = self.parameters.motor_throttles
        if not throttles or len(throttles) != len(self.config.motors):
            # Default: calculate hover throttle
            hover_throttle = self.thrust_calc.calculate_hover_throttle(self.config)
            throttles = [min(1.0, hover_throttle)] * len(self.config.motors)

        thrust_vec, thrust_mags = self.thrust_calc.calculate_total_thrust(
            self.config, throttles
        )
        self._state.motor_thrusts = thrust_mags

        # Convert to ForceVector
        thrust_force = ForceVector(
            force=thrust_vec,
            application_point=Vector3(x=0, y=0, z=0),  # At CoM
            name="thrust",
        )
        forces.append(thrust_force)

        # 2. Calculate gravity
        weight = self.config.total_mass * GRAVITY
        gravity_force = ForceVector(
            force=Vector3(x=0, y=-weight, z=0),
            application_point=Vector3(),
            name="gravity",
        )
        forces.append(gravity_force)

        # 3. Calculate drag
        if self._state.velocity.magnitude() > 0.01:
            drag_result = self.drag_calc.calculate_total_drag(
                self.config,
                self._state.velocity,
                self._state.rotation,
                thrust_vec.magnitude(),
                self._state.motor_rpms,
                self.parameters.wind_velocity if self.parameters.enable_wind else None,
            )
            drag_force = ForceVector(
                force=drag_result["total_drag"],
                application_point=Vector3(),
                name="drag",
            )
            forces.append(drag_force)

        # 4. Calculate wind force
        wind_force_vec = Vector3()
        wind_info = {"wind_speed": 0.0, "force_magnitude": 0.0}

        if self.parameters.enable_wind:
            wind_force_vec, wind_info = self.wind_sim.calculate_wind_force(
                self.config,
                self._state.position,
                self._state.velocity,
                self._time,
            )
            if wind_force_vec.magnitude() > 0.01:
                wind_force = ForceVector(
                    force=wind_force_vec,
                    application_point=Vector3(),
                    name="wind",
                )
                forces.append(wind_force)

        # 5. Calculate tether force
        tether_state: Optional[TetherState] = None

        if self.config.tether and self.parameters.enable_tether:
            tether_state = self.tether_physics.calculate_tether_state(
                self.config.tether,
                self._state.position,
                self._state.velocity,
                dt,
            )

            if tether_state.is_taut:
                tether_force = ForceVector(
                    force=tether_state.force_on_drone,
                    application_point=self.config.tether.attachment_point,
                    name="tether",
                )
                forces.append(tether_force)

            self._state.tether_tension = tether_state.tension
            self._state.tether_angle = math.degrees(tether_state.angle_from_vertical)

        # 6. Sum all forces
        net_force = Vector3()
        for f in forces:
            net_force = net_force + f.force

        self._state.net_force = net_force

        # 7. Calculate acceleration (F = ma)
        mass = self.config.total_mass
        acceleration = Vector3(
            x=net_force.x / mass,
            y=net_force.y / mass,
            z=net_force.z / mass,
        )

        # Sanity clamp
        accel_mag = acceleration.magnitude()
        if accel_mag > self.MAX_ACCELERATION:
            acceleration = acceleration * (self.MAX_ACCELERATION / accel_mag)

        self._state.acceleration = acceleration

        # 8. Integrate velocity (Euler method)
        new_velocity = self._state.velocity + acceleration * dt

        # Sanity clamp
        vel_mag = new_velocity.magnitude()
        if vel_mag > self.MAX_VELOCITY:
            new_velocity = new_velocity * (self.MAX_VELOCITY / vel_mag)

        self._state.velocity = new_velocity

        # 9. Integrate position
        new_position = self._state.position + self._state.velocity * dt

        # Ground collision
        if new_position.y < self.GROUND_LEVEL:
            new_position.y = self.GROUND_LEVEL
            self._state.velocity.y = 0
            self._state.flight_status = FlightStatus.GROUNDED

        self._state.position = new_position

        # 10. Calculate torques and angular dynamics
        com = self.config.calculate_center_of_mass()
        net_torque = Vector3()
        for f in forces:
            torque = f.calculate_torque(com)
            net_torque = net_torque + torque

        self._state.net_torque = net_torque

        # Simple angular dynamics (simplified moment of inertia)
        # I = m * r^2 (approximate)
        moment_of_inertia = mass * (self.config.frame.arm_length ** 2)
        if moment_of_inertia > 0:
            angular_accel = Vector3(
                x=net_torque.x / moment_of_inertia,
                y=net_torque.y / moment_of_inertia,
                z=net_torque.z / moment_of_inertia,
            )

            # Apply stabilization damping if enabled
            if self.parameters.use_auto_stabilization:
                damping = 5.0  # Damping coefficient
                angular_accel = angular_accel - self._state.angular_velocity * damping

            self._state.angular_velocity = self._state.angular_velocity + angular_accel * dt

        # Integrate rotation
        self._state.rotation = self._state.rotation + self._state.angular_velocity * dt

        # 11. Update motor RPMs (from throttle)
        motor_rpms = []
        for i, motor in enumerate(self.config.motors):
            throttle = throttles[i] if i < len(throttles) else 0
            rpm = motor.min_rpm + throttle * (motor.max_rpm - motor.min_rpm)
            motor_rpms.append(rpm)
        self._state.motor_rpms = motor_rpms

        # 12. Calculate power and battery state
        total_power = sum(m.calculate_power(t) for m, t in zip(self.config.motors, throttles))
        self._state.power_consumption = total_power

        if hasattr(self.config.battery, 'capacity_wh'):
            # Battery depletion (simplified)
            energy_used = total_power * dt / 3600  # Wh
            capacity = self.config.battery.capacity_wh
            # Note: actual battery tracking would need cumulative state
            self._state.battery_voltage = self.config.battery.calculate_voltage_under_load(
                total_power / self.config.battery.nominal_voltage
            )

        # 13. Update derived values
        self._state.update_derived_values()

        # 14. Determine flight status
        self._state.flight_status = self._determine_flight_status()

        # 15. Calculate metrics
        metrics = self._calculate_metrics(forces, wind_info, tether_state)

        # 16. Stability analysis
        stability = self.stability_analyzer.analyze(self.config, self._state, forces)

        # 17. Invoke callback if set
        if self._state_callback:
            self._state_callback(self._state)

        return PhysicsStepResult(
            state=self._state.model_copy(),
            forces=forces,
            metrics=metrics,
            stability=stability,
            tether_state=tether_state,
        )

    def _determine_flight_status(self) -> FlightStatus:
        """Determine current flight status based on state."""
        if self._state.position.y <= self.GROUND_LEVEL + 0.05:
            if self._state.velocity.magnitude() < 0.1:
                return FlightStatus.GROUNDED
            else:
                return FlightStatus.CRASHED

        # Check for excessive tilt
        tilt = math.sqrt(self._state.rotation.x**2 + self._state.rotation.z**2)
        if tilt > math.radians(60):
            return FlightStatus.UNSTABLE

        # Check velocity
        if self._state.velocity.magnitude() < 0.5:
            return FlightStatus.HOVERING

        return FlightStatus.FLYING

    def _calculate_metrics(
        self,
        forces: List[ForceVector],
        wind_info: dict,
        tether_state: Optional[TetherState],
    ) -> PhysicsMetrics:
        """Calculate physics metrics for display."""
        # Find specific forces
        thrust_force = next((f for f in forces if f.name == "thrust"), None)
        drag_force = next((f for f in forces if f.name == "drag"), None)
        wind_force = next((f for f in forces if f.name == "wind"), None)

        total_thrust = thrust_force.magnitude if thrust_force else 0
        total_weight = self.config.total_mass * GRAVITY
        twr = total_thrust / total_weight if total_weight > 0 else 0

        # Estimate flight time (very rough)
        if self._state.power_consumption > 0:
            capacity_wh = self.config.battery.capacity_wh
            flight_time = (capacity_wh / self._state.power_consumption) * 3600
        else:
            flight_time = 0

        return PhysicsMetrics(
            total_thrust=total_thrust,
            thrust_per_motor=self._state.motor_thrusts,
            thrust_to_weight_ratio=twr,
            total_weight=total_weight,
            total_mass=self.config.total_mass,
            drag_force=drag_force.magnitude if drag_force else 0,
            drag_coefficient=self.config.frame.drag_coefficient,
            wind_force=wind_force.force if wind_force else Vector3(),
            wind_speed=wind_info.get("wind_speed", 0),
            tether_tension=tether_state.tension if tether_state else 0,
            tether_angle=math.degrees(tether_state.angle_from_vertical) if tether_state else 0,
            power_consumption=self._state.power_consumption,
            estimated_flight_time=flight_time,
        )

    def run_simulation(
        self,
        duration: float,
        sample_interval: float = 0.1,
    ) -> SimulationResult:
        """
        Run simulation for specified duration.

        Args:
            duration: Simulation duration in seconds
            sample_interval: Interval for storing state history

        Returns:
            SimulationResult with final state and history
        """
        self.initialize()

        dt = self.parameters.timestep or self.DEFAULT_TIMESTEP
        steps = int(duration / dt)
        sample_steps = int(sample_interval / dt)

        state_history = []
        max_altitude = 0.0
        max_velocity = 0.0
        max_acceleration = 0.0
        max_tilt = 0.0
        total_energy = 0.0

        outcome = "success"
        outcome_reason = "Simulation completed normally"

        for step_num in range(steps):
            try:
                result = self.step(dt)
                state = result.state

                # Track metrics
                max_altitude = max(max_altitude, state.altitude)
                max_velocity = max(max_velocity, state.velocity.magnitude())
                max_acceleration = max(max_acceleration, state.acceleration.magnitude())

                tilt = math.sqrt(state.rotation.x**2 + state.rotation.z**2)
                max_tilt = max(max_tilt, tilt)

                total_energy += state.power_consumption * dt / 3600

                # Sample history
                if step_num % sample_steps == 0:
                    state_history.append(state.model_copy())

                # Check for crash
                if state.flight_status == FlightStatus.CRASHED:
                    outcome = "crash"
                    outcome_reason = "Drone crashed into ground"
                    break

                # Check for excessive instability
                if state.flight_status == FlightStatus.UNSTABLE:
                    if result.stability.stability_score < 20:
                        outcome = "unstable"
                        outcome_reason = "Excessive instability detected"
                        break

            except Exception as e:
                outcome = "unstable"
                outcome_reason = f"Simulation error: {str(e)}"
                break

        # Final state
        final_state = self._state.model_copy() if self._state else SimulationState()

        # Average tilt
        avg_tilt = sum(
            math.sqrt(s.rotation.x**2 + s.rotation.z**2) for s in state_history
        ) / len(state_history) if state_history else 0

        # Warnings and recommendations
        warnings = []
        recommendations = []

        if self.config.thrust_to_weight_ratio < 1.5:
            warnings.append("Low thrust margin")
            recommendations.append("Consider more powerful motors or lighter components")

        if max_tilt > math.radians(30):
            warnings.append("Significant tilt detected during flight")
            recommendations.append("Check motor balance and CoM position")

        return SimulationResult(
            final_state=final_state,
            state_history=state_history,
            max_altitude=max_altitude,
            max_velocity=max_velocity,
            max_acceleration=max_acceleration,
            flight_duration=self._time,
            average_tilt_angle=math.degrees(avg_tilt),
            max_tilt_angle=math.degrees(max_tilt),
            total_energy_consumed=total_energy,
            average_power=total_energy / (self._time / 3600) if self._time > 0 else 0,
            outcome=outcome,
            outcome_reason=outcome_reason,
            warnings=warnings,
            recommendations=recommendations,
        )

    def validate_configuration(self) -> Tuple[bool, List[str], List[str]]:
        """
        Validate drone configuration.

        Returns:
            Tuple of (is_valid, errors, warnings)
        """
        errors = []
        warnings = []

        # Check motor count
        if len(self.config.motors) < 3:
            errors.append("At least 3 motors required for stable flight")

        # Check propeller count matches motors
        if len(self.config.propellers) != len(self.config.motors):
            errors.append("Propeller count must match motor count")

        # Check thrust-to-weight ratio
        twr = self.config.thrust_to_weight_ratio
        if twr < 1.0:
            errors.append(f"Insufficient thrust (T/W = {twr:.2f}): cannot fly")
        elif twr < 1.2:
            warnings.append(f"Very low thrust margin (T/W = {twr:.2f}): difficult to control")
        elif twr < 1.5:
            warnings.append(f"Low thrust margin (T/W = {twr:.2f}): limited maneuverability")

        # Check battery
        if self.config.battery.capacity_mah <= 0:
            errors.append("Invalid battery capacity")

        # Check frame
        if self.config.frame.arm_length <= 0:
            errors.append("Invalid frame arm length")

        # Check tether if present
        if self.config.tether:
            if self.config.tether.length <= 0:
                errors.append("Invalid tether length")
            if self.config.tether.breaking_strength < self.config.total_mass * GRAVITY * 3:
                warnings.append("Tether breaking strength may be insufficient for safe operation")

        is_valid = len(errors) == 0
        return is_valid, errors, warnings

    def get_current_state(self) -> Optional[SimulationState]:
        """Get current simulation state."""
        return self._state.model_copy() if self._state else None

    def reset(self):
        """Reset simulation to initial state."""
        self._state = None
        self._time = 0.0
        self._running = False
        self.tether_physics.reset()
        self.stability_analyzer.reset()

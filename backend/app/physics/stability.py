"""
Stability analysis module for drone physics simulation.

This module implements stability calculations including:
- Center of mass analysis
- Torque balance assessment
- Tilt angle monitoring
- Oscillation detection
- Control authority estimation
- Overall stability scoring

Stability Criteria:
- Thrust-to-weight ratio > 1.2 for controllability
- CoM within frame bounds
- Torque imbalance < threshold
- Tilt angle < critical angle
- No sustained oscillations
"""

import math
from typing import List, Optional, Tuple
from dataclasses import dataclass, field
from collections import deque

from ..models.drone import Vector3, DroneConfiguration
from ..models.simulation import SimulationState, ForceVector
from ..models.responses import StabilityReport
from ..config import GRAVITY


@dataclass
class ControlAuthority:
    """Control authority metrics for each axis."""

    roll: float = 0.0  # 0-100%
    pitch: float = 0.0
    yaw: float = 0.0
    altitude: float = 0.0


@dataclass
class OscillationMetrics:
    """Oscillation detection metrics."""

    is_oscillating: bool = False
    amplitude: float = 0.0  # degrees
    frequency: float = 0.0  # Hz
    axis: str = ""  # "roll", "pitch", "yaw", or "mixed"


class StabilityAnalyzer:
    """
    Analyzes drone stability in real-time.
    """

    # Stability thresholds
    MAX_SAFE_TILT = math.radians(45)  # radians
    CRITICAL_TILT = math.radians(60)
    MAX_TORQUE_IMBALANCE = 1.0  # N*m
    MIN_TWR_CONTROLLABLE = 1.2  # Thrust-to-weight ratio
    OSCILLATION_THRESHOLD = 5.0  # degrees amplitude

    def __init__(self, history_size: int = 100):
        """
        Initialize stability analyzer.

        Args:
            history_size: Number of samples for oscillation detection
        """
        self.history_size = history_size
        self._roll_history: deque = deque(maxlen=history_size)
        self._pitch_history: deque = deque(maxlen=history_size)
        self._yaw_history: deque = deque(maxlen=history_size)
        self._time_history: deque = deque(maxlen=history_size)

    def analyze(
        self,
        config: DroneConfiguration,
        state: SimulationState,
        forces: List[ForceVector],
    ) -> StabilityReport:
        """
        Perform complete stability analysis.

        Args:
            config: Drone configuration
            state: Current simulation state
            forces: List of forces acting on drone

        Returns:
            StabilityReport with all metrics
        """
        # Update history for oscillation detection
        self._update_history(state)

        # Calculate center of mass
        com = config.calculate_center_of_mass()
        com_offset = com.magnitude()

        # Calculate net torque
        net_torque = self._calculate_net_torque(forces, com)
        torque_imbalance = net_torque.magnitude()

        # Calculate current tilt angle
        current_tilt = self._calculate_tilt_angle(state.rotation)
        tilt_margin = self.MAX_SAFE_TILT - current_tilt

        # Analyze oscillations
        oscillation = self._analyze_oscillations()

        # Calculate control authority
        authority = self._calculate_control_authority(config, state)

        # Generate warnings and issues
        warnings, critical_issues = self._generate_warnings(
            config, state, current_tilt, torque_imbalance, oscillation, authority
        )

        # Calculate overall stability score
        stability_score = self._calculate_stability_score(
            config, current_tilt, torque_imbalance, oscillation, authority, com_offset
        )

        # Determine stability class
        stability_class = self._classify_stability(
            stability_score, critical_issues
        )

        return StabilityReport(
            stability_score=stability_score,
            stability_class=stability_class,
            com_position=com,
            com_offset_from_center=com_offset,
            net_torque=net_torque,
            torque_imbalance=torque_imbalance,
            current_tilt=math.degrees(current_tilt),
            max_safe_tilt=math.degrees(self.MAX_SAFE_TILT),
            tilt_margin=math.degrees(tilt_margin),
            oscillation_amplitude=oscillation.amplitude,
            oscillation_frequency=oscillation.frequency,
            is_oscillating=oscillation.is_oscillating,
            roll_authority=authority.roll,
            pitch_authority=authority.pitch,
            yaw_authority=authority.yaw,
            altitude_authority=authority.altitude,
            warnings=warnings,
            critical_issues=critical_issues,
        )

    def _update_history(self, state: SimulationState):
        """Update angle history for oscillation detection."""
        self._roll_history.append(math.degrees(state.rotation.x))
        self._pitch_history.append(math.degrees(state.rotation.z))
        self._yaw_history.append(math.degrees(state.rotation.y))
        self._time_history.append(state.timestamp)

    def _calculate_net_torque(
        self, forces: List[ForceVector], com: Vector3
    ) -> Vector3:
        """Calculate net torque from all forces about center of mass."""
        net_torque = Vector3()

        for force_vec in forces:
            torque = force_vec.calculate_torque(com)
            net_torque = net_torque + torque

        return net_torque

    def _calculate_tilt_angle(self, rotation: Vector3) -> float:
        """
        Calculate total tilt angle from vertical.

        Args:
            rotation: Euler angles (roll, pitch, yaw) in radians

        Returns:
            Total tilt angle in radians
        """
        roll = rotation.x
        pitch = rotation.z

        # Combined tilt angle (small angle approximation)
        # For larger angles, use proper rotation matrix
        tilt = math.sqrt(roll**2 + pitch**2)

        return tilt

    def _analyze_oscillations(self) -> OscillationMetrics:
        """Analyze recent angle history for oscillations."""
        if len(self._roll_history) < 20:
            return OscillationMetrics()

        # Convert to lists for analysis
        roll = list(self._roll_history)
        pitch = list(self._pitch_history)
        times = list(self._time_history)

        # Calculate amplitude (peak-to-peak / 2)
        roll_amp = (max(roll) - min(roll)) / 2
        pitch_amp = (max(pitch) - min(pitch)) / 2
        max_amp = max(roll_amp, pitch_amp)

        # Determine oscillating axis
        if max_amp < self.OSCILLATION_THRESHOLD:
            return OscillationMetrics()

        axis = "roll" if roll_amp > pitch_amp else "pitch"
        if abs(roll_amp - pitch_amp) < 2.0:
            axis = "mixed"

        # Estimate frequency using zero crossings
        data = roll if axis == "roll" else pitch
        mean_val = sum(data) / len(data)
        zero_crossings = 0

        for i in range(1, len(data)):
            if (data[i-1] - mean_val) * (data[i] - mean_val) < 0:
                zero_crossings += 1

        # Time span
        time_span = times[-1] - times[0] if times else 1.0
        if time_span > 0 and zero_crossings > 0:
            frequency = zero_crossings / (2 * time_span)  # Each cycle has 2 crossings
        else:
            frequency = 0.0

        return OscillationMetrics(
            is_oscillating=True,
            amplitude=max_amp,
            frequency=frequency,
            axis=axis,
        )

    def _calculate_control_authority(
        self, config: DroneConfiguration, state: SimulationState
    ) -> ControlAuthority:
        """
        Estimate control authority on each axis.

        Control authority is the ability to generate corrective torques/forces.
        """
        # Thrust-to-weight ratio determines altitude authority
        twr = config.thrust_to_weight_ratio
        altitude_authority = min(100, (twr - 1.0) * 100) if twr > 1 else 0

        # For roll/pitch/yaw authority, estimate based on motor configuration
        # A balanced quad with good TWR has full authority

        # Base authority from TWR
        base_authority = min(100, twr * 50) if twr > 0 else 0

        # Reduce authority based on current tilt (less authority when tilted)
        tilt = self._calculate_tilt_angle(state.rotation)
        tilt_factor = max(0, 1 - tilt / self.CRITICAL_TILT)

        # Motor count affects redundancy
        motor_count = len(config.motors)
        redundancy_factor = min(1.0, motor_count / 4)

        roll_authority = base_authority * tilt_factor * redundancy_factor
        pitch_authority = base_authority * tilt_factor * redundancy_factor

        # Yaw authority depends on motor rotation patterns
        # Assumed adequate for balanced configuration
        yaw_authority = base_authority * 0.8  # Typically less than roll/pitch

        return ControlAuthority(
            roll=roll_authority,
            pitch=pitch_authority,
            yaw=yaw_authority,
            altitude=altitude_authority,
        )

    def _generate_warnings(
        self,
        config: DroneConfiguration,
        state: SimulationState,
        current_tilt: float,
        torque_imbalance: float,
        oscillation: OscillationMetrics,
        authority: ControlAuthority,
    ) -> Tuple[List[str], List[str]]:
        """Generate warning and critical issue lists."""
        warnings = []
        critical_issues = []

        # Tilt warnings
        if current_tilt > self.MAX_SAFE_TILT:
            critical_issues.append(
                f"Tilt angle ({math.degrees(current_tilt):.1f}°) exceeds safe limit"
            )
        elif current_tilt > self.MAX_SAFE_TILT * 0.7:
            warnings.append(
                f"Tilt angle ({math.degrees(current_tilt):.1f}°) approaching limit"
            )

        # Thrust-to-weight warnings
        twr = config.thrust_to_weight_ratio
        if twr < 1.0:
            critical_issues.append(
                f"Insufficient thrust (T/W = {twr:.2f}) - cannot fly"
            )
        elif twr < self.MIN_TWR_CONTROLLABLE:
            warnings.append(
                f"Low thrust margin (T/W = {twr:.2f}) - limited maneuverability"
            )

        # Torque imbalance
        if torque_imbalance > self.MAX_TORQUE_IMBALANCE * 2:
            critical_issues.append(
                f"Severe torque imbalance ({torque_imbalance:.2f} N·m)"
            )
        elif torque_imbalance > self.MAX_TORQUE_IMBALANCE:
            warnings.append(f"Torque imbalance ({torque_imbalance:.2f} N·m)")

        # Oscillation
        if oscillation.is_oscillating:
            if oscillation.amplitude > self.OSCILLATION_THRESHOLD * 2:
                critical_issues.append(
                    f"Severe {oscillation.axis} oscillation "
                    f"({oscillation.amplitude:.1f}° at {oscillation.frequency:.1f} Hz)"
                )
            else:
                warnings.append(
                    f"{oscillation.axis.capitalize()} oscillation detected "
                    f"({oscillation.amplitude:.1f}°)"
                )

        # Control authority
        if authority.altitude < 20:
            critical_issues.append("Insufficient altitude control authority")
        elif authority.altitude < 50:
            warnings.append("Limited altitude control authority")

        if min(authority.roll, authority.pitch) < 30:
            warnings.append("Reduced attitude control authority")

        # Altitude warnings
        if state.position.y < 0.5:
            warnings.append("Low altitude - ground proximity warning")
        elif state.position.y < 0:
            critical_issues.append("Below ground level - crash detected")

        return warnings, critical_issues

    def _calculate_stability_score(
        self,
        config: DroneConfiguration,
        current_tilt: float,
        torque_imbalance: float,
        oscillation: OscillationMetrics,
        authority: ControlAuthority,
        com_offset: float,
    ) -> float:
        """
        Calculate overall stability score (0-100).

        Higher is more stable.
        """
        score = 100.0

        # Tilt penalty (max -40 points)
        tilt_ratio = current_tilt / self.MAX_SAFE_TILT
        score -= min(40, tilt_ratio * 40)

        # Torque imbalance penalty (max -20 points)
        torque_ratio = torque_imbalance / self.MAX_TORQUE_IMBALANCE
        score -= min(20, torque_ratio * 10)

        # Oscillation penalty (max -20 points)
        if oscillation.is_oscillating:
            osc_severity = oscillation.amplitude / self.OSCILLATION_THRESHOLD
            score -= min(20, osc_severity * 10)

        # Control authority bonus/penalty (max ±10 points)
        avg_authority = (authority.roll + authority.pitch + authority.altitude) / 3
        score += (avg_authority - 50) / 5  # ±10 based on authority

        # CoM offset penalty (max -10 points)
        # Assume >0.1m offset is problematic
        com_penalty = min(10, com_offset * 100)
        score -= com_penalty

        # TWR bonus
        twr = config.thrust_to_weight_ratio
        if twr > 2.0:
            score += 5  # Bonus for good thrust margin

        return max(0, min(100, score))

    def _classify_stability(
        self, score: float, critical_issues: List[str]
    ) -> str:
        """Classify stability based on score and issues."""
        if critical_issues:
            return "critical"
        elif score >= 80:
            return "stable"
        elif score >= 50:
            return "marginal"
        else:
            return "unstable"

    def can_fly(self, config: DroneConfiguration) -> Tuple[bool, str]:
        """
        Quick check if drone configuration can fly.

        Args:
            config: Drone configuration

        Returns:
            Tuple of (can_fly, reason)
        """
        twr = config.thrust_to_weight_ratio

        if twr < 1.0:
            return False, f"Insufficient thrust (T/W = {twr:.2f})"

        if twr < self.MIN_TWR_CONTROLLABLE:
            return True, f"Can fly but limited control (T/W = {twr:.2f})"

        if len(config.motors) < 3:
            return False, "Need at least 3 motors for stable flight"

        return True, f"Flight capable (T/W = {twr:.2f})"

    def predict_flight_envelope(self, config: DroneConfiguration) -> dict:
        """
        Predict flight envelope and limits.

        Args:
            config: Drone configuration

        Returns:
            Dictionary with flight limits
        """
        twr = config.thrust_to_weight_ratio
        total_mass = config.total_mass
        max_thrust = config.max_thrust

        # Maximum acceleration (vertical)
        max_accel = (max_thrust / total_mass) - GRAVITY if twr > 1 else 0

        # Hover throttle
        hover_throttle = 1.0 / twr if twr > 0 else 1.0

        # Maximum tilt angle for stable flight
        # Limited by remaining thrust for altitude
        if twr > 1:
            # At tilt angle θ, vertical thrust = T * cos(θ)
            # Need cos(θ) > 1/TWR for altitude hold
            max_tilt_rad = math.acos(1.0 / twr) if twr > 1 else 0
            max_tilt_rad = min(max_tilt_rad, math.radians(60))
        else:
            max_tilt_rad = 0

        # Maximum horizontal acceleration
        if max_tilt_rad > 0:
            # F_h = T * sin(θ)
            max_horizontal_force = max_thrust * math.sin(max_tilt_rad)
            max_horizontal_accel = max_horizontal_force / total_mass
        else:
            max_horizontal_accel = 0

        # Estimate max speed (limited by drag)
        # Drag = 0.5 * rho * v^2 * Cd * A = F_h
        rho = 1.225
        CdA = config.total_frontal_area * config.frame.drag_coefficient
        if CdA > 0 and max_horizontal_force > 0:
            max_speed = math.sqrt(2 * max_horizontal_force / (rho * CdA))
        else:
            max_speed = 0

        return {
            "thrust_to_weight_ratio": twr,
            "max_vertical_acceleration": max_accel,
            "max_horizontal_acceleration": max_horizontal_accel,
            "hover_throttle_percent": hover_throttle * 100,
            "max_tilt_angle_degrees": math.degrees(max_tilt_rad),
            "estimated_max_speed": max_speed,
            "total_mass_kg": total_mass,
            "max_thrust_n": max_thrust,
        }

    def reset(self):
        """Reset history buffers."""
        self._roll_history.clear()
        self._pitch_history.clear()
        self._yaw_history.clear()
        self._time_history.clear()

"""
Wind simulation module for drone physics.

This module implements wind force calculations including:
- Steady-state wind velocity
- Turbulence (Perlin noise-based gusts)
- Wind shear (altitude-dependent wind)
- Building effects (simplified urban wind patterns)

Wind Model:
    F_wind = 0.5 * rho * v_wind^2 * C_d * A * direction

With turbulence:
    v_wind(t) = v_base + v_turbulence(t)
    v_turbulence = turbulence_intensity * perlin_noise(t, position)
"""

import math
from typing import Optional, Tuple
import numpy as np
from dataclasses import dataclass

from ..models.drone import Vector3, DroneConfiguration
from ..config import AIR_DENSITY


@dataclass
class WindProfile:
    """Configuration for wind simulation."""

    # Base wind velocity (m/s)
    base_velocity: Vector3

    # Turbulence parameters
    turbulence_intensity: float = 0.2  # 0-1, fraction of base speed
    turbulence_frequency: float = 0.5  # Hz, how fast gusts change
    turbulence_scale: float = 10.0  # m, spatial scale of turbulence

    # Wind shear (altitude effect)
    enable_wind_shear: bool = True
    reference_altitude: float = 10.0  # m, altitude for base velocity
    shear_exponent: float = 0.143  # Typical for open terrain

    # Gust parameters
    enable_gusts: bool = True
    gust_probability: float = 0.1  # Probability of gust per second
    gust_magnitude_factor: float = 1.5  # Max gust as fraction of base
    gust_duration: float = 2.0  # seconds


class PerlinNoise:
    """
    Simple 1D/3D Perlin noise implementation for wind turbulence.
    """

    def __init__(self, seed: int = 42):
        """Initialize with random permutation table."""
        np.random.seed(seed)
        self.perm = np.arange(256, dtype=int)
        np.random.shuffle(self.perm)
        self.perm = np.stack([self.perm, self.perm]).flatten()

    def _fade(self, t: np.ndarray) -> np.ndarray:
        """Fade function for smooth interpolation."""
        return t * t * t * (t * (t * 6 - 15) + 10)

    def _lerp(self, a: float, b: float, t: float) -> float:
        """Linear interpolation."""
        return a + t * (b - a)

    def _grad(self, hash_val: int, x: float, y: float = 0, z: float = 0) -> float:
        """Calculate gradient."""
        h = hash_val & 15
        u = x if h < 8 else y
        v = y if h < 4 else (x if h in (12, 14) else z)
        return (u if (h & 1) == 0 else -u) + (v if (h & 2) == 0 else -v)

    def noise_1d(self, x: float) -> float:
        """1D Perlin noise."""
        X = int(math.floor(x)) & 255
        x -= math.floor(x)
        u = self._fade(np.array([x]))[0]

        a = self.perm[X]
        b = self.perm[X + 1]

        return self._lerp(self._grad(a, x), self._grad(b, x - 1), u)

    def noise_3d(self, x: float, y: float, z: float) -> float:
        """3D Perlin noise."""
        X = int(math.floor(x)) & 255
        Y = int(math.floor(y)) & 255
        Z = int(math.floor(z)) & 255

        x -= math.floor(x)
        y -= math.floor(y)
        z -= math.floor(z)

        coords = np.array([x, y, z])
        u, v, w = self._fade(coords)

        A = self.perm[X] + Y
        AA = self.perm[A] + Z
        AB = self.perm[A + 1] + Z
        B = self.perm[X + 1] + Y
        BA = self.perm[B] + Z
        BB = self.perm[B + 1] + Z

        return self._lerp(
            self._lerp(
                self._lerp(
                    self._grad(self.perm[AA], x, y, z),
                    self._grad(self.perm[BA], x - 1, y, z),
                    u,
                ),
                self._lerp(
                    self._grad(self.perm[AB], x, y - 1, z),
                    self._grad(self.perm[BB], x - 1, y - 1, z),
                    u,
                ),
                v,
            ),
            self._lerp(
                self._lerp(
                    self._grad(self.perm[AA + 1], x, y, z - 1),
                    self._grad(self.perm[BA + 1], x - 1, y, z - 1),
                    u,
                ),
                self._lerp(
                    self._grad(self.perm[AB + 1], x, y - 1, z - 1),
                    self._grad(self.perm[BB + 1], x - 1, y - 1, z - 1),
                    u,
                ),
                v,
            ),
            w,
        )


class WindSimulator:
    """
    Simulates wind forces on the drone.
    """

    def __init__(
        self,
        profile: Optional[WindProfile] = None,
        air_density: float = AIR_DENSITY,
        seed: int = 42,
    ):
        """
        Initialize wind simulator.

        Args:
            profile: Wind profile configuration
            air_density: Air density in kg/m³
            seed: Random seed for reproducibility
        """
        self.profile = profile or WindProfile(base_velocity=Vector3())
        self.air_density = air_density
        self.perlin = PerlinNoise(seed)
        self.rng = np.random.default_rng(seed)

        # Gust state
        self._active_gust = False
        self._gust_start_time = 0.0
        self._gust_velocity = Vector3()

    def set_profile(self, profile: WindProfile):
        """Update wind profile."""
        self.profile = profile

    def set_base_velocity(self, velocity: Vector3):
        """Update base wind velocity."""
        self.profile.base_velocity = velocity

    def set_turbulence(self, intensity: float):
        """Set turbulence intensity (0-1)."""
        self.profile.turbulence_intensity = max(0.0, min(1.0, intensity))

    def get_wind_velocity(
        self, time: float, position: Vector3 = None
    ) -> Vector3:
        """
        Get wind velocity at a given time and position.

        Args:
            time: Simulation time in seconds
            position: Position in world coordinates (for spatial variation)

        Returns:
            Wind velocity vector (m/s)
        """
        # Start with base velocity
        wind = Vector3(
            x=self.profile.base_velocity.x,
            y=self.profile.base_velocity.y,
            z=self.profile.base_velocity.z,
        )
        base_speed = wind.magnitude()

        # Apply wind shear if position is provided
        if position and self.profile.enable_wind_shear:
            altitude = max(0.1, position.y)  # Avoid zero/negative altitudes
            shear_factor = (altitude / self.profile.reference_altitude) ** self.profile.shear_exponent
            wind = wind * shear_factor

        # Add turbulence
        if self.profile.turbulence_intensity > 0 and base_speed > 0:
            turbulence = self._calculate_turbulence(time, position)
            wind = wind + turbulence

        # Add gusts
        if self.profile.enable_gusts:
            gust = self._calculate_gust(time)
            wind = wind + gust

        return wind

    def _calculate_turbulence(
        self, time: float, position: Optional[Vector3]
    ) -> Vector3:
        """Calculate turbulence component using Perlin noise."""
        base_speed = self.profile.base_velocity.magnitude()
        if base_speed == 0:
            return Vector3()

        # Time-based noise coordinate
        t = time * self.profile.turbulence_frequency

        # Position-based noise coordinates (if available)
        if position:
            px = position.x / self.profile.turbulence_scale
            py = position.y / self.profile.turbulence_scale
            pz = position.z / self.profile.turbulence_scale

            # 3D noise for each component
            noise_x = self.perlin.noise_3d(t, py, pz)
            noise_y = self.perlin.noise_3d(px, t, pz)
            noise_z = self.perlin.noise_3d(px, py, t)
        else:
            # 1D time-based noise
            noise_x = self.perlin.noise_1d(t)
            noise_y = self.perlin.noise_1d(t + 100)
            noise_z = self.perlin.noise_1d(t + 200)

        # Scale by turbulence intensity and base speed
        magnitude = base_speed * self.profile.turbulence_intensity

        return Vector3(
            x=noise_x * magnitude,
            y=noise_y * magnitude * 0.5,  # Less vertical turbulence
            z=noise_z * magnitude,
        )

    def _calculate_gust(self, time: float) -> Vector3:
        """Calculate gust component."""
        base_speed = self.profile.base_velocity.magnitude()
        if base_speed == 0:
            return Vector3()

        # Check if current gust has ended
        if self._active_gust:
            if time - self._gust_start_time > self.profile.gust_duration:
                self._active_gust = False

        # Check for new gust
        if not self._active_gust:
            # Probability check (adjusted for typical timestep)
            if self.rng.random() < self.profile.gust_probability * 0.02:
                self._active_gust = True
                self._gust_start_time = time

                # Random gust direction (biased toward base wind direction)
                base_dir = self.profile.base_velocity.normalized()
                random_dir = Vector3(
                    x=self.rng.normal(0, 0.5),
                    y=self.rng.normal(0, 0.2),
                    z=self.rng.normal(0, 0.5),
                )
                gust_dir = (base_dir + random_dir).normalized()

                # Gust magnitude
                gust_speed = base_speed * self.profile.gust_magnitude_factor * self.rng.random()
                self._gust_velocity = gust_dir * gust_speed

        if not self._active_gust:
            return Vector3()

        # Gust envelope (ramp up, hold, ramp down)
        gust_time = time - self._gust_start_time
        duration = self.profile.gust_duration
        ramp_time = duration * 0.2

        if gust_time < ramp_time:
            # Ramp up
            envelope = gust_time / ramp_time
        elif gust_time > duration - ramp_time:
            # Ramp down
            envelope = (duration - gust_time) / ramp_time
        else:
            # Hold
            envelope = 1.0

        return self._gust_velocity * envelope

    def calculate_wind_force(
        self,
        config: DroneConfiguration,
        position: Vector3,
        velocity: Vector3,
        time: float,
    ) -> Tuple[Vector3, dict]:
        """
        Calculate wind force on the drone.

        Args:
            config: Drone configuration
            position: Drone position
            velocity: Drone velocity
            time: Simulation time

        Returns:
            Tuple of (wind force vector, wind info dict)
        """
        # Get wind velocity at drone position
        wind_velocity = self.get_wind_velocity(time, position)
        wind_speed = wind_velocity.magnitude()

        # Relative velocity (wind effect on drone)
        relative_wind = wind_velocity - velocity
        relative_speed = relative_wind.magnitude()

        if relative_speed < 0.01:
            return Vector3(), {
                "wind_velocity": wind_velocity,
                "wind_speed": wind_speed,
                "relative_speed": 0.0,
                "force_magnitude": 0.0,
            }

        # Calculate wind force: F = 0.5 * rho * v^2 * Cd * A
        frontal_area = config.total_frontal_area
        drag_coefficient = config.frame.drag_coefficient

        force_magnitude = (
            0.5
            * self.air_density
            * relative_speed**2
            * drag_coefficient
            * frontal_area
        )

        # Force direction: same as relative wind
        force_direction = relative_wind.normalized()
        wind_force = force_direction * force_magnitude

        return wind_force, {
            "wind_velocity": wind_velocity,
            "wind_speed": wind_speed,
            "relative_speed": relative_speed,
            "force_magnitude": force_magnitude,
            "force_direction": force_direction,
        }

    def calculate_tether_wind_load(
        self,
        tether_start: Vector3,
        tether_end: Vector3,
        tether_diameter: float,
        tether_cd: float,
        time: float,
    ) -> Vector3:
        """
        Calculate wind load on tether.

        Uses trapezoidal integration along tether length.

        Args:
            tether_start: Anchor point
            tether_end: Drone attachment point
            tether_diameter: Tether diameter (m)
            tether_cd: Tether drag coefficient
            time: Simulation time

        Returns:
            Total wind force on tether
        """
        # Number of segments for integration
        n_segments = 10

        total_force = Vector3()
        tether_vector = tether_end - tether_start
        tether_length = tether_vector.magnitude()

        if tether_length < 0.01:
            return Vector3()

        segment_length = tether_length / n_segments
        segment_area = tether_diameter * segment_length

        for i in range(n_segments):
            # Position along tether
            t = (i + 0.5) / n_segments
            pos = tether_start + tether_vector * t

            # Wind at this position
            wind = self.get_wind_velocity(time, pos)

            # Perpendicular component (wind perpendicular to tether)
            tether_dir = tether_vector.normalized()
            wind_parallel = tether_dir * wind.dot(tether_dir)
            wind_perpendicular = wind - wind_parallel

            perp_speed = wind_perpendicular.magnitude()
            if perp_speed < 0.01:
                continue

            # Force on segment
            force_mag = (
                0.5 * self.air_density * perp_speed**2 * tether_cd * segment_area
            )
            force_dir = wind_perpendicular.normalized()

            total_force = total_force + force_dir * force_mag

        return total_force

    @staticmethod
    def beaufort_to_velocity(beaufort_scale: int) -> float:
        """
        Convert Beaufort scale to wind velocity (m/s).

        Args:
            beaufort_scale: Beaufort number (0-12)

        Returns:
            Approximate wind speed in m/s
        """
        # Beaufort to m/s conversion (approximate midpoints)
        scale_to_speed = {
            0: 0.0,    # Calm
            1: 0.8,    # Light air
            2: 2.4,    # Light breeze
            3: 4.4,    # Gentle breeze
            4: 6.7,    # Moderate breeze
            5: 9.4,    # Fresh breeze
            6: 12.3,   # Strong breeze
            7: 15.5,   # Near gale
            8: 18.9,   # Gale
            9: 22.6,   # Strong gale
            10: 26.5,  # Storm
            11: 30.6,  # Violent storm
            12: 33.0,  # Hurricane
        }
        return scale_to_speed.get(min(12, max(0, beaufort_scale)), 0.0)

    @staticmethod
    def velocity_to_beaufort(velocity: float) -> int:
        """
        Convert wind velocity to Beaufort scale.

        Args:
            velocity: Wind speed in m/s

        Returns:
            Beaufort scale number
        """
        v = abs(velocity)
        if v < 0.3:
            return 0
        elif v < 1.6:
            return 1
        elif v < 3.4:
            return 2
        elif v < 5.5:
            return 3
        elif v < 8.0:
            return 4
        elif v < 10.8:
            return 5
        elif v < 13.9:
            return 6
        elif v < 17.2:
            return 7
        elif v < 20.8:
            return 8
        elif v < 24.5:
            return 9
        elif v < 28.5:
            return 10
        elif v < 32.7:
            return 11
        else:
            return 12

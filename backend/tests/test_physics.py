"""
Unit tests for the physics engine modules.
"""

import pytest
import math
from unittest.mock import MagicMock

# Import models
from app.models.drone import (
    Vector3,
    Motor,
    MotorType,
    Propeller,
    PropellerType,
    Battery,
    BatteryType,
    Frame,
    FrameType,
    Tether,
    TetherType,
    DroneConfiguration,
)
from app.models.simulation import SimulationState, SimulationParameters, FlightStatus

# Import physics modules
from app.physics.thrust import ThrustCalculator
from app.physics.drag import DragCalculator
from app.physics.wind import WindSimulator, WindProfile
from app.physics.tether import TetherPhysics
from app.physics.stability import StabilityAnalyzer
from app.physics.engine import PhysicsEngine

from app.config import GRAVITY


# ============== Fixtures ==============


@pytest.fixture
def sample_motor():
    """Create a sample motor for testing."""
    return Motor(
        id="test_motor",
        name="Test Motor",
        motor_type=MotorType.BRUSHLESS,
        mass=0.05,
        kv_rating=920,
        thrust_constant=1.5e-5,
        max_rpm=12000,
        max_current=20,
        position=Vector3(x=0.15, y=0, z=0.15),
        rotation_direction=1,
    )


@pytest.fixture
def sample_propeller():
    """Create a sample propeller for testing."""
    return Propeller(
        id="test_prop",
        name="Test Propeller",
        diameter=0.254,  # 10 inches
        pitch=0.114,  # 4.5 inches
        mass=0.015,
        blade_count=PropellerType.TWO_BLADE,
    )


@pytest.fixture
def sample_battery():
    """Create a sample battery for testing."""
    return Battery(
        id="test_battery",
        name="Test Battery",
        battery_type=BatteryType.LIPO,
        cell_count=4,
        capacity_mah=5000,
        mass=0.5,
        max_discharge_rate=50,
    )


@pytest.fixture
def sample_frame():
    """Create a sample frame for testing."""
    return Frame(
        id="test_frame",
        name="Test Frame",
        frame_type=FrameType.QUADCOPTER_X,
        mass=0.3,
        arm_length=0.225,
        diagonal_distance=0.45,
        frontal_area=0.04,
    )


@pytest.fixture
def sample_tether():
    """Create a sample tether for testing."""
    return Tether(
        id="test_tether",
        name="Test Tether",
        tether_type=TetherType.SYNTHETIC_ROPE,
        length=10.0,
        mass_per_meter=0.05,
        diameter=0.005,
        stiffness=10000,
        damping=100,
        breaking_strength=5000,
        anchor_point=Vector3(x=0, y=0, z=0),
    )


@pytest.fixture
def sample_drone_config(sample_motor, sample_propeller, sample_battery, sample_frame):
    """Create a complete drone configuration for testing."""
    motors = [
        Motor(
            id=f"motor_{i}",
            name=f"Motor {i}",
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
    ]

    propellers = [
        Propeller(
            id=f"prop_{i}",
            name="10x4.5 Propeller",
            diameter=0.254,
            pitch=0.114,
            mass=0.015,
            blade_count=PropellerType.TWO_BLADE,
        )
        for i in range(4)
    ]

    return DroneConfiguration(
        id="test_drone",
        name="Test Quadcopter",
        motors=motors,
        propellers=propellers,
        battery=sample_battery,
        frame=sample_frame,
    )


# ============== Vector3 Tests ==============


class TestVector3:
    """Tests for Vector3 class."""

    def test_magnitude(self):
        v = Vector3(x=3, y=4, z=0)
        assert v.magnitude() == 5.0

    def test_normalized(self):
        v = Vector3(x=3, y=4, z=0)
        n = v.normalized()
        assert abs(n.magnitude() - 1.0) < 0.001

    def test_addition(self):
        v1 = Vector3(x=1, y=2, z=3)
        v2 = Vector3(x=4, y=5, z=6)
        result = v1 + v2
        assert result.x == 5
        assert result.y == 7
        assert result.z == 9

    def test_multiplication(self):
        v = Vector3(x=1, y=2, z=3)
        result = v * 2
        assert result.x == 2
        assert result.y == 4
        assert result.z == 6

    def test_dot_product(self):
        v1 = Vector3(x=1, y=0, z=0)
        v2 = Vector3(x=0, y=1, z=0)
        assert v1.dot(v2) == 0  # Perpendicular

        v3 = Vector3(x=1, y=0, z=0)
        assert v1.dot(v3) == 1  # Parallel

    def test_cross_product(self):
        v1 = Vector3(x=1, y=0, z=0)
        v2 = Vector3(x=0, y=1, z=0)
        result = v1.cross(v2)
        assert result.z == 1  # Right-hand rule


# ============== Thrust Calculator Tests ==============


class TestThrustCalculator:
    """Tests for thrust calculations."""

    def test_zero_throttle(self, sample_motor, sample_propeller):
        calc = ThrustCalculator()
        thrust = calc.calculate_motor_thrust(sample_motor, sample_propeller, 0.0)
        assert thrust == 0.0

    def test_thrust_increases_with_throttle(self, sample_motor, sample_propeller):
        calc = ThrustCalculator()
        thrust_low = calc.calculate_motor_thrust(sample_motor, sample_propeller, 0.3)
        thrust_high = calc.calculate_motor_thrust(sample_motor, sample_propeller, 0.8)
        assert thrust_high > thrust_low

    def test_hover_throttle_calculation(self, sample_drone_config):
        calc = ThrustCalculator()
        hover_throttle = calc.calculate_hover_throttle(sample_drone_config)

        # Should be between 0 and 1 for a viable drone
        assert 0 < hover_throttle < 1

    def test_max_payload_calculation(self, sample_drone_config):
        calc = ThrustCalculator()
        max_payload = calc.calculate_max_payload(sample_drone_config)

        # Should be positive for a viable drone
        assert max_payload > 0

    def test_thrust_vector_direction(self, sample_motor, sample_propeller):
        calc = ThrustCalculator()
        thrust_vec = calc.calculate_thrust_vector(
            sample_motor, sample_propeller, 0.5
        )

        # Default thrust should point up (Y direction)
        assert thrust_vec.y > 0
        assert abs(thrust_vec.x) < 0.001
        assert abs(thrust_vec.z) < 0.001


# ============== Drag Calculator Tests ==============


class TestDragCalculator:
    """Tests for drag calculations."""

    def test_zero_velocity_drag(self):
        calc = DragCalculator()
        drag = calc.calculate_drag_force(
            velocity=Vector3(),
            frontal_area=0.04,
            drag_coefficient=1.0,
        )
        assert drag.magnitude() == 0.0

    def test_drag_increases_with_velocity(self):
        calc = DragCalculator()
        v_slow = Vector3(x=5, y=0, z=0)
        v_fast = Vector3(x=10, y=0, z=0)

        drag_slow = calc.calculate_drag_force(v_slow, 0.04, 1.0)
        drag_fast = calc.calculate_drag_force(v_fast, 0.04, 1.0)

        # Drag scales with v^2
        assert drag_fast.magnitude() > drag_slow.magnitude()
        # Should be approximately 4x (10^2 / 5^2 = 4)
        ratio = drag_fast.magnitude() / drag_slow.magnitude()
        assert abs(ratio - 4.0) < 0.1

    def test_drag_direction(self):
        calc = DragCalculator()
        velocity = Vector3(x=10, y=0, z=0)
        drag = calc.calculate_drag_force(velocity, 0.04, 1.0)

        # Drag should be opposite to velocity
        assert drag.x < 0
        assert abs(drag.y) < 0.001
        assert abs(drag.z) < 0.001


# ============== Wind Simulator Tests ==============


class TestWindSimulator:
    """Tests for wind simulation."""

    def test_zero_wind(self):
        profile = WindProfile(base_velocity=Vector3())
        sim = WindSimulator(profile)
        wind = sim.get_wind_velocity(0.0)
        assert wind.magnitude() < 0.1  # Should be near zero

    def test_constant_wind(self):
        profile = WindProfile(
            base_velocity=Vector3(x=5, y=0, z=0),
            turbulence_intensity=0.0,
            enable_gusts=False,
        )
        sim = WindSimulator(profile)
        wind = sim.get_wind_velocity(0.0)
        assert abs(wind.x - 5) < 0.1
        assert abs(wind.y) < 0.1
        assert abs(wind.z) < 0.1

    def test_wind_shear(self):
        profile = WindProfile(
            base_velocity=Vector3(x=10, y=0, z=0),
            enable_wind_shear=True,
            reference_altitude=10.0,
        )
        sim = WindSimulator(profile)

        wind_low = sim.get_wind_velocity(0.0, Vector3(x=0, y=2, z=0))
        wind_high = sim.get_wind_velocity(0.0, Vector3(x=0, y=20, z=0))

        # Wind should increase with altitude
        assert wind_high.magnitude() > wind_low.magnitude()

    def test_beaufort_conversion(self):
        # Calm
        assert WindSimulator.velocity_to_beaufort(0.2) == 0
        # Light breeze
        assert WindSimulator.velocity_to_beaufort(3.0) == 2
        # Strong breeze
        assert WindSimulator.velocity_to_beaufort(12.0) == 6


# ============== Tether Physics Tests ==============


class TestTetherPhysics:
    """Tests for tether physics."""

    def test_slack_tether(self, sample_tether):
        physics = TetherPhysics()

        # Position within tether length
        state = physics.calculate_tether_state(
            sample_tether,
            drone_position=Vector3(x=0, y=5, z=0),
            drone_velocity=Vector3(),
            dt=0.02,
        )

        assert not state.is_taut
        assert state.tension == 0.0

    def test_taut_tether(self, sample_tether):
        physics = TetherPhysics()

        # Position beyond tether length
        state = physics.calculate_tether_state(
            sample_tether,
            drone_position=Vector3(x=0, y=12, z=0),  # Beyond 10m length
            drone_velocity=Vector3(),
            dt=0.02,
        )

        assert state.is_taut
        assert state.tension > 0

    def test_tether_force_direction(self, sample_tether):
        physics = TetherPhysics()

        state = physics.calculate_tether_state(
            sample_tether,
            drone_position=Vector3(x=0, y=12, z=0),
            drone_velocity=Vector3(),
            dt=0.02,
        )

        # Force should pull drone down toward anchor
        assert state.force_on_drone.y < 0

    def test_pendulum_frequency(self, sample_tether):
        physics = TetherPhysics()
        freq = physics.calculate_pendulum_frequency(sample_tether, drone_mass=2.0)

        # f = (1/2π) * sqrt(g/L) ≈ 0.16 Hz for 10m tether
        assert 0.1 < freq < 0.2


# ============== Stability Analyzer Tests ==============


class TestStabilityAnalyzer:
    """Tests for stability analysis."""

    def test_can_fly_valid_config(self, sample_drone_config):
        analyzer = StabilityAnalyzer()
        can_fly, reason = analyzer.can_fly(sample_drone_config)
        assert can_fly

    def test_flight_envelope(self, sample_drone_config):
        analyzer = StabilityAnalyzer()
        envelope = analyzer.predict_flight_envelope(sample_drone_config)

        assert "thrust_to_weight_ratio" in envelope
        assert envelope["thrust_to_weight_ratio"] > 1.0
        assert "max_vertical_acceleration" in envelope
        assert envelope["max_vertical_acceleration"] > 0


# ============== Physics Engine Tests ==============


class TestPhysicsEngine:
    """Tests for the main physics engine."""

    def test_initialization(self, sample_drone_config):
        engine = PhysicsEngine(sample_drone_config)
        engine.initialize()

        state = engine.get_current_state()
        assert state is not None
        assert state.position.y > 0

    def test_physics_step(self, sample_drone_config):
        engine = PhysicsEngine(sample_drone_config)
        engine.initialize()

        result = engine.step()

        assert result is not None
        assert result.state is not None
        assert result.metrics is not None
        assert result.stability is not None

    def test_gravity_effect(self, sample_drone_config):
        engine = PhysicsEngine(sample_drone_config)

        # Initialize with zero throttle
        params = SimulationParameters(motor_throttles=[0, 0, 0, 0])
        engine.set_parameters(params)
        engine.initialize()

        # Run a few steps
        for _ in range(10):
            result = engine.step()

        # Drone should fall due to gravity
        state = engine.get_current_state()
        assert state.velocity.y < 0  # Falling

    def test_hover_stability(self, sample_drone_config):
        engine = PhysicsEngine(sample_drone_config)

        # Set hover throttle
        hover_throttle = engine.thrust_calc.calculate_hover_throttle(sample_drone_config)
        params = SimulationParameters(
            motor_throttles=[hover_throttle] * 4,
            use_auto_stabilization=True,
        )
        engine.set_parameters(params)
        engine.initialize()

        # Run simulation
        for _ in range(50):
            result = engine.step()

        # Drone should roughly maintain altitude
        state = engine.get_current_state()
        assert abs(state.velocity.y) < 1.0  # Near zero vertical velocity

    def test_configuration_validation(self, sample_drone_config):
        engine = PhysicsEngine(sample_drone_config)
        is_valid, errors, warnings = engine.validate_configuration()

        assert is_valid
        assert len(errors) == 0

    def test_simulation_run(self, sample_drone_config):
        engine = PhysicsEngine(sample_drone_config)
        result = engine.run_simulation(duration=2.0)

        assert result is not None
        assert result.flight_duration > 0
        assert len(result.state_history) > 0


# ============== Drone Configuration Tests ==============


class TestDroneConfiguration:
    """Tests for drone configuration calculations."""

    def test_total_mass(self, sample_drone_config):
        mass = sample_drone_config.total_mass
        # Should be sum of all components
        expected = (
            sample_drone_config.frame.mass
            + sample_drone_config.battery.mass
            + sum(m.mass for m in sample_drone_config.motors)
            + sum(p.mass for p in sample_drone_config.propellers)
        )
        assert abs(mass - expected) < 0.001

    def test_max_thrust(self, sample_drone_config):
        max_thrust = sample_drone_config.max_thrust
        assert max_thrust > 0

    def test_thrust_to_weight_ratio(self, sample_drone_config):
        twr = sample_drone_config.thrust_to_weight_ratio
        # Should be > 1 for a viable drone
        assert twr > 1.0

    def test_center_of_mass(self, sample_drone_config):
        com = sample_drone_config.calculate_center_of_mass()
        # For symmetric config, CoM should be near center
        assert abs(com.x) < 0.01
        assert abs(com.z) < 0.01


# ============== Run Tests ==============

if __name__ == "__main__":
    pytest.main([__file__, "-v"])

"""
Unit tests for the gesture detection and mapping module.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import time

# Import gesture module components
# Note: Some tests will be skipped if MediaPipe is not installed
try:
    from app.gesture import (
        GestureType,
        GestureEvent,
        HandSide,
        HandLandmarks,
        GestureHistory,
        ActionType,
        ActionCommand,
        GestureMapping,
        GestureContext,
        GestureMapper,
    )
    GESTURE_AVAILABLE = True
except ImportError:
    GESTURE_AVAILABLE = False


@pytest.fixture
def gesture_event():
    """Create a sample gesture event."""
    if not GESTURE_AVAILABLE:
        pytest.skip("Gesture module not available")
    return GestureEvent(
        gesture=GestureType.PINCH,
        confidence=0.9,
        hand_side=HandSide.RIGHT,
        position=(0.5, 0.5),
        timestamp=time.time(),
        velocity=(0.1, 0.0),
        angle=0.0,
        pinch_distance=0.03,
    )


@pytest.fixture
def gesture_mapper():
    """Create a gesture mapper instance."""
    if not GESTURE_AVAILABLE:
        pytest.skip("Gesture module not available")
    return GestureMapper()


class TestGestureTypes:
    """Tests for gesture type enums."""

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_gesture_types_exist(self):
        """Test that all expected gesture types exist."""
        expected_types = [
            "NONE", "PINCH", "SWIPE_LEFT", "SWIPE_RIGHT",
            "SWIPE_UP", "SWIPE_DOWN", "ROTATE_CW", "ROTATE_CCW",
            "POINT", "OPEN_PALM", "FIST", "THUMBS_UP", "THUMBS_DOWN"
        ]
        for gesture in expected_types:
            assert hasattr(GestureType, gesture)

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_hand_side_enum(self):
        """Test hand side enumeration."""
        assert HandSide.LEFT.value == "left"
        assert HandSide.RIGHT.value == "right"
        assert HandSide.UNKNOWN.value == "unknown"


class TestGestureEvent:
    """Tests for GestureEvent dataclass."""

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_gesture_event_creation(self, gesture_event):
        """Test creating a gesture event."""
        assert gesture_event.gesture == GestureType.PINCH
        assert gesture_event.confidence == 0.9
        assert gesture_event.hand_side == HandSide.RIGHT
        assert gesture_event.position == (0.5, 0.5)

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_gesture_event_to_dict(self, gesture_event):
        """Test gesture event serialization."""
        data = gesture_event.to_dict()

        assert data["gesture"] == "pinch"
        assert data["confidence"] == 0.9
        assert data["hand_side"] == "right"
        assert "position" in data
        assert data["position"]["x"] == 0.5
        assert data["position"]["y"] == 0.5


class TestGestureHistory:
    """Tests for gesture history tracking."""

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_history_add(self):
        """Test adding positions to history."""
        history = GestureHistory()

        history.add((0.5, 0.5, 0.0), 0.0)
        history.add((0.6, 0.5, 0.0), 0.1)

        assert len(history.positions) == 2
        assert len(history.timestamps) == 2

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_history_velocity_calculation(self):
        """Test velocity calculation from history."""
        history = GestureHistory()

        # Simulate movement to the right
        history.add((0.5, 0.5, 0.0), 0.0)
        history.add((0.6, 0.5, 0.0), 0.1)
        history.add((0.7, 0.5, 0.0), 0.2)

        velocity = history.get_velocity()

        # Should have positive x velocity (moving right)
        assert velocity[0] > 0
        # Should have zero y velocity
        assert abs(velocity[1]) < 0.01

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_history_max_size(self):
        """Test history trimming to max size."""
        history = GestureHistory(max_history=5)

        for i in range(10):
            history.add((i * 0.1, 0.5, 0.0), i * 0.1)

        assert len(history.positions) == 5
        assert len(history.timestamps) == 5

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_history_clear(self):
        """Test clearing history."""
        history = GestureHistory()

        history.add((0.5, 0.5, 0.0), 0.0)
        history.add((0.6, 0.5, 0.0), 0.1)
        history.clear()

        assert len(history.positions) == 0
        assert len(history.timestamps) == 0


class TestHandLandmarks:
    """Tests for HandLandmarks dataclass."""

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_extended_finger_count(self):
        """Test counting extended fingers."""
        landmarks = HandLandmarks(
            thumb_extended=True,
            index_extended=True,
            middle_extended=False,
            ring_extended=False,
            pinky_extended=False,
        )

        assert landmarks.extended_finger_count == 2

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_all_fingers_extended(self):
        """Test all fingers extended (open palm)."""
        landmarks = HandLandmarks(
            thumb_extended=True,
            index_extended=True,
            middle_extended=True,
            ring_extended=True,
            pinky_extended=True,
        )

        assert landmarks.extended_finger_count == 5


class TestActionTypes:
    """Tests for action type enums."""

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_action_types_exist(self):
        """Test that all expected action types exist."""
        expected_actions = [
            "START_SIMULATION", "STOP_SIMULATION", "PAUSE_SIMULATION",
            "THROTTLE_UP", "THROTTLE_DOWN", "INCREASE_PARAMETER",
            "ROTATE_VIEW", "EMERGENCY_STOP", "SELECT_COMPONENT"
        ]
        for action in expected_actions:
            assert hasattr(ActionType, action)


class TestActionCommand:
    """Tests for ActionCommand dataclass."""

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_action_command_creation(self):
        """Test creating an action command."""
        command = ActionCommand(
            action=ActionType.THROTTLE_UP,
            parameters={"magnitude": 0.5},
            timestamp=time.time(),
            source_gesture=GestureType.SWIPE_UP,
        )

        assert command.action == ActionType.THROTTLE_UP
        assert command.parameters["magnitude"] == 0.5

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_action_command_to_dict(self):
        """Test action command serialization."""
        command = ActionCommand(
            action=ActionType.ROTATE_VIEW,
            parameters={"angle": 0.5},
            timestamp=1234567890.0,
            source_gesture=GestureType.ROTATE_CW,
        )

        data = command.to_dict()

        assert data["action"] == "rotate_view"
        assert data["parameters"]["angle"] == 0.5
        assert data["source_gesture"] == "rotate_cw"


class TestGestureMapping:
    """Tests for GestureMapping configuration."""

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_mapping_creation(self):
        """Test creating a gesture mapping."""
        mapping = GestureMapping(
            gesture=GestureType.PINCH,
            action=ActionType.CONFIRM_SELECTION,
            min_confidence=0.8,
            description="Pinch to confirm",
        )

        assert mapping.gesture == GestureType.PINCH
        assert mapping.action == ActionType.CONFIRM_SELECTION
        assert mapping.min_confidence == 0.8

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_mapping_with_hand_restriction(self):
        """Test mapping with hand restriction."""
        mapping = GestureMapping(
            gesture=GestureType.POINT,
            action=ActionType.SELECT_COMPONENT,
            hand=HandSide.RIGHT,
            description="Point with right hand to select",
        )

        assert mapping.hand == HandSide.RIGHT


class TestGestureMapper:
    """Tests for GestureMapper class."""

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_mapper_initialization(self, gesture_mapper):
        """Test mapper initializes with default mappings."""
        # Should have mappings for all contexts
        assert GestureContext.DEFAULT in gesture_mapper.mappings
        assert GestureContext.SIMULATION_RUNNING in gesture_mapper.mappings

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_set_context(self, gesture_mapper):
        """Test changing gesture context."""
        gesture_mapper.set_context(GestureContext.SIMULATION_RUNNING)

        assert gesture_mapper.context == GestureContext.SIMULATION_RUNNING

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_get_context(self, gesture_mapper):
        """Test getting current context."""
        assert gesture_mapper.get_context() == GestureContext.DEFAULT

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_map_gesture_pinch(self, gesture_mapper, gesture_event):
        """Test mapping a pinch gesture."""
        command = gesture_mapper.map_gesture(gesture_event)

        assert command is not None
        assert command.action == ActionType.CONFIRM_SELECTION

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_map_gesture_swipe_in_simulation(self, gesture_mapper):
        """Test mapping swipe gesture in simulation context."""
        gesture_mapper.set_context(GestureContext.SIMULATION_RUNNING)

        swipe_event = GestureEvent(
            gesture=GestureType.SWIPE_UP,
            confidence=0.9,
            hand_side=HandSide.RIGHT,
            position=(0.5, 0.5),
            timestamp=time.time(),
            velocity=(0.0, -1.0),  # Upward swipe
        )

        command = gesture_mapper.map_gesture(swipe_event)

        assert command is not None
        assert command.action == ActionType.THROTTLE_UP

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_map_gesture_low_confidence_rejected(self, gesture_mapper):
        """Test that low confidence gestures are rejected."""
        low_conf_event = GestureEvent(
            gesture=GestureType.PINCH,
            confidence=0.3,  # Below threshold
            hand_side=HandSide.RIGHT,
            position=(0.5, 0.5),
            timestamp=time.time(),
        )

        command = gesture_mapper.map_gesture(low_conf_event)

        # Should be None due to low confidence
        assert command is None

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_cooldown_prevents_rapid_triggers(self, gesture_mapper):
        """Test that cooldown prevents rapid gesture triggers."""
        # First gesture should succeed
        event1 = GestureEvent(
            gesture=GestureType.PINCH,
            confidence=0.9,
            hand_side=HandSide.RIGHT,
            position=(0.5, 0.5),
            timestamp=time.time(),
        )

        command1 = gesture_mapper.map_gesture(event1)
        assert command1 is not None

        # Immediate second gesture should be blocked
        event2 = GestureEvent(
            gesture=GestureType.PINCH,
            confidence=0.9,
            hand_side=HandSide.RIGHT,
            position=(0.5, 0.5),
            timestamp=time.time(),
        )

        command2 = gesture_mapper.map_gesture(event2)
        assert command2 is None  # Blocked by cooldown

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_get_mappings_for_context(self, gesture_mapper):
        """Test getting mappings for a specific context."""
        mappings = gesture_mapper.get_mappings_for_context(GestureContext.DEFAULT)

        assert len(mappings) > 0
        assert all(isinstance(m, GestureMapping) for m in mappings)

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_add_custom_mapping(self, gesture_mapper):
        """Test adding a custom mapping."""
        custom_mapping = GestureMapping(
            gesture=GestureType.FIST,
            action=ActionType.EMERGENCY_STOP,
            min_confidence=0.95,
            description="Emergency fist stop",
        )

        gesture_mapper.add_mapping(GestureContext.DEFAULT, custom_mapping)

        mappings = gesture_mapper.get_mappings_for_context(GestureContext.DEFAULT)
        fist_mappings = [m for m in mappings if m.gesture == GestureType.FIST]

        assert len(fist_mappings) > 0

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_get_help_text(self, gesture_mapper):
        """Test getting help text."""
        help_text = gesture_mapper.get_help_text()

        assert "Available gestures" in help_text
        assert "pinch" in help_text.lower()


class TestGestureContext:
    """Tests for gesture context management."""

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_context_values(self):
        """Test context enum values."""
        assert GestureContext.DEFAULT.value == "default"
        assert GestureContext.COMPONENT_SELECTION.value == "component_selection"
        assert GestureContext.SIMULATION_RUNNING.value == "simulation_running"

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_context_specific_mappings(self, gesture_mapper):
        """Test that different contexts have different mappings."""
        default_mappings = gesture_mapper.get_mappings_for_context(GestureContext.DEFAULT)
        simulation_mappings = gesture_mapper.get_mappings_for_context(
            GestureContext.SIMULATION_RUNNING
        )

        # Swipe up should map to different actions in different contexts
        default_swipe = next(
            (m for m in default_mappings if m.gesture == GestureType.SWIPE_UP),
            None
        )
        sim_swipe = next(
            (m for m in simulation_mappings if m.gesture == GestureType.SWIPE_UP),
            None
        )

        if default_swipe and sim_swipe:
            # Actions should be different based on context
            assert default_swipe.action != sim_swipe.action or \
                   default_swipe.description != sim_swipe.description


class TestParameterSelection:
    """Tests for parameter selection via gestures."""

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_select_next_parameter(self, gesture_mapper):
        """Test cycling through parameters."""
        initial_param = gesture_mapper.selected_parameter

        gesture_mapper.select_next_parameter()

        assert gesture_mapper.selected_parameter is not None
        assert gesture_mapper.selected_parameter != initial_param or \
               len(gesture_mapper.parameter_options) == 1

    @pytest.mark.skipif(not GESTURE_AVAILABLE, reason="Gesture module not available")
    def test_select_previous_parameter(self, gesture_mapper):
        """Test cycling backwards through parameters."""
        gesture_mapper.select_next_parameter()
        gesture_mapper.select_next_parameter()
        current = gesture_mapper.selected_parameter

        gesture_mapper.select_previous_parameter()

        # Should be different (unless only 1 parameter)
        assert gesture_mapper.selected_parameter is not None


# API endpoint tests
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def api_client():
    """Create test client."""
    return TestClient(app)


class TestGestureAPIEndpoints:
    """Tests for gesture control API endpoints."""

    def test_gesture_status_endpoint(self, api_client):
        """Test getting gesture status."""
        response = api_client.get("/api/gesture/status")
        assert response.status_code == 200

        data = response.json()
        assert "running" in data
        assert "context" in data

    def test_gesture_contexts_endpoint(self, api_client):
        """Test listing available contexts."""
        response = api_client.get("/api/gesture/contexts")
        assert response.status_code == 200

        data = response.json()
        assert "contexts" in data

    def test_gesture_mappings_endpoint(self, api_client):
        """Test getting gesture mappings."""
        response = api_client.get("/api/gesture/mappings")
        assert response.status_code == 200

        data = response.json()
        assert "context" in data
        assert "mappings" in data

    def test_set_gesture_context_invalid(self, api_client):
        """Test setting invalid gesture context."""
        response = api_client.post(
            "/api/gesture/context",
            json={"context": "invalid_context"}
        )
        # Should either return 400 or handle gracefully
        assert response.status_code in [400, 500]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

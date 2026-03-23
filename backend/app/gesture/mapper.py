"""
Gesture to Action Mapper.

Maps detected gestures to drone control actions and simulation commands.
Provides configurable mappings and action execution.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Callable, Dict, List, Any
import asyncio
import logging
import time

from .detector import GestureType, GestureEvent, HandSide

logger = logging.getLogger(__name__)


class ActionType(str, Enum):
    """Types of actions that can be triggered by gestures."""
    # Simulation Control
    START_SIMULATION = "start_simulation"
    STOP_SIMULATION = "stop_simulation"
    PAUSE_SIMULATION = "pause_simulation"
    RESUME_SIMULATION = "resume_simulation"
    RESET_SIMULATION = "reset_simulation"

    # Throttle Control
    THROTTLE_UP = "throttle_up"
    THROTTLE_DOWN = "throttle_down"
    THROTTLE_SET = "throttle_set"

    # Parameter Adjustment
    INCREASE_PARAMETER = "increase_parameter"
    DECREASE_PARAMETER = "decrease_parameter"
    SELECT_PARAMETER = "select_parameter"
    CONFIRM_VALUE = "confirm_value"

    # Component Selection
    SELECT_COMPONENT = "select_component"
    NEXT_COMPONENT = "next_component"
    PREVIOUS_COMPONENT = "previous_component"
    CONFIRM_SELECTION = "confirm_selection"
    CANCEL_SELECTION = "cancel_selection"

    # View Control
    ROTATE_VIEW = "rotate_view"
    ZOOM_IN = "zoom_in"
    ZOOM_OUT = "zoom_out"
    RESET_VIEW = "reset_view"

    # Navigation
    NAVIGATE_UP = "navigate_up"
    NAVIGATE_DOWN = "navigate_down"
    NAVIGATE_LEFT = "navigate_left"
    NAVIGATE_RIGHT = "navigate_right"

    # Special
    EMERGENCY_STOP = "emergency_stop"
    NO_ACTION = "no_action"


@dataclass
class ActionCommand:
    """A command to be executed."""
    action: ActionType
    parameters: Dict[str, Any] = field(default_factory=dict)
    timestamp: float = 0.0
    source_gesture: Optional[GestureType] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "action": self.action.value,
            "parameters": self.parameters,
            "timestamp": self.timestamp,
            "source_gesture": self.source_gesture.value if self.source_gesture else None,
        }


@dataclass
class GestureMapping:
    """Mapping configuration for a gesture to action."""
    gesture: GestureType
    action: ActionType
    # Optional hand restriction
    hand: Optional[HandSide] = None
    # Minimum confidence required
    min_confidence: float = 0.7
    # Parameter modifiers based on gesture properties
    use_velocity: bool = False  # Use gesture velocity for parameter magnitude
    use_angle: bool = False  # Use gesture angle for rotation amount
    use_position: bool = False  # Use screen position for targeting
    # Custom parameter values
    parameters: Dict[str, Any] = field(default_factory=dict)
    # Action cooldown (seconds)
    cooldown: float = 0.3
    # Description for UI
    description: str = ""


class GestureContext(str, Enum):
    """
    Context modes that change how gestures are interpreted.

    Different screens/modes may need different gesture mappings.
    """
    DEFAULT = "default"
    COMPONENT_SELECTION = "component_selection"
    PARAMETER_ADJUSTMENT = "parameter_adjustment"
    SIMULATION_RUNNING = "simulation_running"
    VIEW_CONTROL = "view_control"


class GestureMapper:
    """
    Maps gestures to actions based on context and configuration.

    Usage:
        mapper = GestureMapper()
        mapper.set_context(GestureContext.SIMULATION_RUNNING)

        command = mapper.map_gesture(gesture_event)
        if command:
            await execute_command(command)
    """

    def __init__(self):
        """Initialize with default mappings."""
        self.context = GestureContext.DEFAULT
        self.mappings: Dict[GestureContext, List[GestureMapping]] = {}
        self.last_action_time: Dict[ActionType, float] = {}
        self.action_callbacks: Dict[ActionType, Callable] = {}

        # Selected parameter for adjustment
        self.selected_parameter: Optional[str] = None
        self.parameter_options = [
            "throttle",
            "wind_speed",
            "wind_direction",
            "turbulence",
        ]
        self.parameter_index = 0

        # Initialize default mappings
        self._setup_default_mappings()

    def _setup_default_mappings(self):
        """Set up default gesture-to-action mappings for all contexts."""

        # Default context mappings
        self.mappings[GestureContext.DEFAULT] = [
            GestureMapping(
                gesture=GestureType.PINCH,
                action=ActionType.CONFIRM_SELECTION,
                min_confidence=0.7,
                description="Pinch to select/confirm",
            ),
            GestureMapping(
                gesture=GestureType.SWIPE_RIGHT,
                action=ActionType.NAVIGATE_RIGHT,
                use_velocity=True,
                description="Swipe right to navigate",
            ),
            GestureMapping(
                gesture=GestureType.SWIPE_LEFT,
                action=ActionType.NAVIGATE_LEFT,
                use_velocity=True,
                description="Swipe left to navigate",
            ),
            GestureMapping(
                gesture=GestureType.SWIPE_UP,
                action=ActionType.NAVIGATE_UP,
                use_velocity=True,
                description="Swipe up to scroll",
            ),
            GestureMapping(
                gesture=GestureType.SWIPE_DOWN,
                action=ActionType.NAVIGATE_DOWN,
                use_velocity=True,
                description="Swipe down to scroll",
            ),
            GestureMapping(
                gesture=GestureType.OPEN_PALM,
                action=ActionType.EMERGENCY_STOP,
                min_confidence=0.9,
                cooldown=1.0,
                description="Open palm for emergency stop",
            ),
            GestureMapping(
                gesture=GestureType.FIST,
                action=ActionType.RESET_VIEW,
                cooldown=0.5,
                description="Fist to reset view",
            ),
            GestureMapping(
                gesture=GestureType.THUMBS_UP,
                action=ActionType.START_SIMULATION,
                cooldown=1.0,
                description="Thumbs up to start simulation",
            ),
            GestureMapping(
                gesture=GestureType.THUMBS_DOWN,
                action=ActionType.STOP_SIMULATION,
                cooldown=1.0,
                description="Thumbs down to stop simulation",
            ),
        ]

        # Component selection context
        self.mappings[GestureContext.COMPONENT_SELECTION] = [
            GestureMapping(
                gesture=GestureType.PINCH,
                action=ActionType.SELECT_COMPONENT,
                use_position=True,
                description="Pinch to select component",
            ),
            GestureMapping(
                gesture=GestureType.SWIPE_RIGHT,
                action=ActionType.NEXT_COMPONENT,
                description="Swipe right for next component",
            ),
            GestureMapping(
                gesture=GestureType.SWIPE_LEFT,
                action=ActionType.PREVIOUS_COMPONENT,
                description="Swipe left for previous component",
            ),
            GestureMapping(
                gesture=GestureType.THUMBS_UP,
                action=ActionType.CONFIRM_SELECTION,
                description="Thumbs up to confirm",
            ),
            GestureMapping(
                gesture=GestureType.OPEN_PALM,
                action=ActionType.CANCEL_SELECTION,
                description="Open palm to cancel",
            ),
            GestureMapping(
                gesture=GestureType.ROTATE_CW,
                action=ActionType.ROTATE_VIEW,
                use_angle=True,
                parameters={"direction": 1},
                description="Rotate view clockwise",
            ),
            GestureMapping(
                gesture=GestureType.ROTATE_CCW,
                action=ActionType.ROTATE_VIEW,
                use_angle=True,
                parameters={"direction": -1},
                description="Rotate view counter-clockwise",
            ),
        ]

        # Parameter adjustment context
        self.mappings[GestureContext.PARAMETER_ADJUSTMENT] = [
            GestureMapping(
                gesture=GestureType.PINCH,
                action=ActionType.SELECT_PARAMETER,
                description="Pinch to select parameter",
            ),
            GestureMapping(
                gesture=GestureType.SWIPE_UP,
                action=ActionType.INCREASE_PARAMETER,
                use_velocity=True,
                description="Swipe up to increase value",
            ),
            GestureMapping(
                gesture=GestureType.SWIPE_DOWN,
                action=ActionType.DECREASE_PARAMETER,
                use_velocity=True,
                description="Swipe down to decrease value",
            ),
            GestureMapping(
                gesture=GestureType.SWIPE_RIGHT,
                action=ActionType.NEXT_COMPONENT,
                parameters={"target": "parameter"},
                description="Swipe right for next parameter",
            ),
            GestureMapping(
                gesture=GestureType.SWIPE_LEFT,
                action=ActionType.PREVIOUS_COMPONENT,
                parameters={"target": "parameter"},
                description="Swipe left for previous parameter",
            ),
            GestureMapping(
                gesture=GestureType.THUMBS_UP,
                action=ActionType.CONFIRM_VALUE,
                description="Thumbs up to confirm value",
            ),
        ]

        # Simulation running context
        self.mappings[GestureContext.SIMULATION_RUNNING] = [
            GestureMapping(
                gesture=GestureType.SWIPE_UP,
                action=ActionType.THROTTLE_UP,
                use_velocity=True,
                description="Swipe up to increase throttle",
            ),
            GestureMapping(
                gesture=GestureType.SWIPE_DOWN,
                action=ActionType.THROTTLE_DOWN,
                use_velocity=True,
                description="Swipe down to decrease throttle",
            ),
            GestureMapping(
                gesture=GestureType.OPEN_PALM,
                action=ActionType.EMERGENCY_STOP,
                min_confidence=0.9,
                cooldown=0.5,
                description="Open palm for emergency stop",
            ),
            GestureMapping(
                gesture=GestureType.FIST,
                action=ActionType.PAUSE_SIMULATION,
                cooldown=0.5,
                description="Fist to pause simulation",
            ),
            GestureMapping(
                gesture=GestureType.THUMBS_UP,
                action=ActionType.RESUME_SIMULATION,
                cooldown=0.5,
                description="Thumbs up to resume",
            ),
            GestureMapping(
                gesture=GestureType.ROTATE_CW,
                action=ActionType.ROTATE_VIEW,
                use_angle=True,
                parameters={"direction": 1},
                description="Rotate view clockwise",
            ),
            GestureMapping(
                gesture=GestureType.ROTATE_CCW,
                action=ActionType.ROTATE_VIEW,
                use_angle=True,
                parameters={"direction": -1},
                description="Rotate view counter-clockwise",
            ),
            GestureMapping(
                gesture=GestureType.PINCH,
                action=ActionType.ZOOM_IN,
                description="Pinch to zoom in",
            ),
        ]

        # View control context
        self.mappings[GestureContext.VIEW_CONTROL] = [
            GestureMapping(
                gesture=GestureType.ROTATE_CW,
                action=ActionType.ROTATE_VIEW,
                use_angle=True,
                parameters={"direction": 1},
                description="Rotate view clockwise",
            ),
            GestureMapping(
                gesture=GestureType.ROTATE_CCW,
                action=ActionType.ROTATE_VIEW,
                use_angle=True,
                parameters={"direction": -1},
                description="Rotate view counter-clockwise",
            ),
            GestureMapping(
                gesture=GestureType.PINCH,
                action=ActionType.ZOOM_IN,
                description="Pinch to zoom in",
            ),
            GestureMapping(
                gesture=GestureType.OPEN_PALM,
                action=ActionType.ZOOM_OUT,
                description="Open palm to zoom out",
            ),
            GestureMapping(
                gesture=GestureType.FIST,
                action=ActionType.RESET_VIEW,
                description="Fist to reset view",
            ),
            GestureMapping(
                gesture=GestureType.POINT,
                action=ActionType.SELECT_COMPONENT,
                use_position=True,
                description="Point to select",
            ),
        ]

    def set_context(self, context: GestureContext):
        """
        Set the current gesture context.

        Args:
            context: The new context to use for gesture mapping
        """
        if context != self.context:
            logger.info(f"Gesture context changed: {self.context} -> {context}")
            self.context = context

    def get_context(self) -> GestureContext:
        """Get the current gesture context."""
        return self.context

    def map_gesture(self, gesture: GestureEvent) -> Optional[ActionCommand]:
        """
        Map a gesture event to an action command.

        Args:
            gesture: The detected gesture event

        Returns:
            ActionCommand if a mapping exists, None otherwise
        """
        if gesture.gesture == GestureType.NONE:
            return None

        # Get mappings for current context
        context_mappings = self.mappings.get(self.context, [])

        # Also check default mappings as fallback
        default_mappings = self.mappings.get(GestureContext.DEFAULT, [])

        all_mappings = context_mappings + default_mappings

        for mapping in all_mappings:
            if self._matches_mapping(gesture, mapping):
                # Check cooldown
                if not self._can_execute(mapping.action, mapping.cooldown):
                    continue

                # Create command
                command = self._create_command(gesture, mapping)

                # Update last action time
                self.last_action_time[mapping.action] = time.time()

                logger.debug(
                    f"Gesture {gesture.gesture.value} mapped to "
                    f"action {command.action.value}"
                )

                return command

        return None

    def _matches_mapping(
        self,
        gesture: GestureEvent,
        mapping: GestureMapping,
    ) -> bool:
        """Check if a gesture matches a mapping."""
        # Check gesture type
        if gesture.gesture != mapping.gesture:
            return False

        # Check confidence threshold
        if gesture.confidence < mapping.min_confidence:
            return False

        # Check hand restriction
        if mapping.hand and gesture.hand_side != mapping.hand:
            return False

        return True

    def _can_execute(self, action: ActionType, cooldown: float) -> bool:
        """Check if an action can be executed (cooldown check)."""
        last_time = self.last_action_time.get(action, 0)
        return (time.time() - last_time) >= cooldown

    def _create_command(
        self,
        gesture: GestureEvent,
        mapping: GestureMapping,
    ) -> ActionCommand:
        """Create an action command from gesture and mapping."""
        parameters = dict(mapping.parameters)

        # Add gesture-based parameters
        if mapping.use_velocity:
            # Scale velocity to parameter change
            speed = abs(gesture.velocity[0]) + abs(gesture.velocity[1])
            parameters["magnitude"] = min(1.0, speed / 2.0)
            parameters["velocity_x"] = gesture.velocity[0]
            parameters["velocity_y"] = gesture.velocity[1]

        if mapping.use_angle:
            parameters["angle"] = gesture.angle
            parameters["angle_degrees"] = gesture.angle * 180 / 3.14159

        if mapping.use_position:
            parameters["position_x"] = gesture.position[0]
            parameters["position_y"] = gesture.position[1]

        # Add hand side
        parameters["hand"] = gesture.hand_side.value

        # Add selected parameter for parameter adjustment actions
        if mapping.action in [
            ActionType.INCREASE_PARAMETER,
            ActionType.DECREASE_PARAMETER,
            ActionType.SELECT_PARAMETER,
        ]:
            parameters["parameter"] = self.selected_parameter or "throttle"

        return ActionCommand(
            action=mapping.action,
            parameters=parameters,
            timestamp=gesture.timestamp,
            source_gesture=gesture.gesture,
        )

    def register_callback(
        self,
        action: ActionType,
        callback: Callable[[ActionCommand], Any],
    ):
        """
        Register a callback for an action type.

        Args:
            action: The action type to register for
            callback: Function to call when action is triggered
        """
        self.action_callbacks[action] = callback

    async def execute_command(self, command: ActionCommand) -> Any:
        """
        Execute an action command.

        Args:
            command: The command to execute

        Returns:
            Result from callback if registered, None otherwise
        """
        callback = self.action_callbacks.get(command.action)
        if callback:
            if asyncio.iscoroutinefunction(callback):
                return await callback(command)
            else:
                return callback(command)

        logger.debug(f"No callback registered for action: {command.action}")
        return None

    def select_next_parameter(self):
        """Move to next parameter in the parameter list."""
        self.parameter_index = (
            (self.parameter_index + 1) % len(self.parameter_options)
        )
        self.selected_parameter = self.parameter_options[self.parameter_index]

    def select_previous_parameter(self):
        """Move to previous parameter in the parameter list."""
        self.parameter_index = (
            (self.parameter_index - 1) % len(self.parameter_options)
        )
        self.selected_parameter = self.parameter_options[self.parameter_index]

    def get_mappings_for_context(
        self,
        context: Optional[GestureContext] = None,
    ) -> List[GestureMapping]:
        """
        Get all mappings for a context.

        Args:
            context: Context to get mappings for (uses current if None)

        Returns:
            List of gesture mappings
        """
        ctx = context or self.context
        return self.mappings.get(ctx, [])

    def add_mapping(
        self,
        context: GestureContext,
        mapping: GestureMapping,
    ):
        """
        Add a custom mapping for a context.

        Args:
            context: The context to add the mapping to
            mapping: The mapping to add
        """
        if context not in self.mappings:
            self.mappings[context] = []
        self.mappings[context].append(mapping)

    def remove_mapping(
        self,
        context: GestureContext,
        gesture: GestureType,
    ):
        """
        Remove a mapping for a gesture in a context.

        Args:
            context: The context to remove from
            gesture: The gesture type to remove
        """
        if context in self.mappings:
            self.mappings[context] = [
                m for m in self.mappings[context]
                if m.gesture != gesture
            ]

    def get_help_text(self, context: Optional[GestureContext] = None) -> str:
        """
        Get help text describing available gestures.

        Args:
            context: Context to get help for (uses current if None)

        Returns:
            Human-readable help text
        """
        mappings = self.get_mappings_for_context(context)

        if not mappings:
            return "No gestures available in this context."

        lines = [f"Available gestures ({(context or self.context).value}):"]
        for mapping in mappings:
            hand_text = f" ({mapping.hand.value} hand)" if mapping.hand else ""
            lines.append(f"  - {mapping.gesture.value}{hand_text}: {mapping.description}")

        return "\n".join(lines)


class GestureController:
    """
    High-level controller that combines detection and mapping.

    Provides a simple interface for gesture-controlled applications.
    """

    def __init__(self):
        """Initialize the gesture controller."""
        from .detector import GestureDetector

        self.detector = GestureDetector()
        self.mapper = GestureMapper()
        self.running = False

        # Connect detector events to mapper
        self.detector.on_gesture = self._on_gesture

        # Command queue for async processing
        self._command_queue: asyncio.Queue[ActionCommand] = asyncio.Queue()

    def _on_gesture(self, gesture: GestureEvent):
        """Handle gesture detected by detector."""
        command = self.mapper.map_gesture(gesture)
        if command:
            try:
                self._command_queue.put_nowait(command)
            except asyncio.QueueFull:
                logger.warning("Command queue full, dropping command")

    def start(self, show_preview: bool = False) -> bool:
        """
        Start the gesture controller.

        Args:
            show_preview: Whether to show camera preview

        Returns:
            True if started successfully
        """
        if self.running:
            return True

        success = self.detector.start(show_preview=show_preview)
        if success:
            self.running = True

        return success

    def stop(self):
        """Stop the gesture controller."""
        self.running = False
        self.detector.stop()

    async def run(self, show_preview: bool = False):
        """
        Run the gesture control loop.

        Args:
            show_preview: Whether to show camera preview
        """
        if not self.start(show_preview):
            raise RuntimeError("Failed to start gesture controller")

        try:
            while self.running:
                self.detector.process_frame()
                await asyncio.sleep(1 / 30)  # 30 fps
        finally:
            self.stop()

    async def get_next_command(
        self,
        timeout: Optional[float] = None,
    ) -> Optional[ActionCommand]:
        """
        Get the next command from the queue.

        Args:
            timeout: Maximum time to wait (None = forever)

        Returns:
            ActionCommand or None if timeout
        """
        try:
            if timeout is not None:
                return await asyncio.wait_for(
                    self._command_queue.get(),
                    timeout=timeout,
                )
            else:
                return await self._command_queue.get()
        except asyncio.TimeoutError:
            return None

    def set_context(self, context: GestureContext):
        """Set the gesture context."""
        self.mapper.set_context(context)

    def register_action(
        self,
        action: ActionType,
        callback: Callable[[ActionCommand], Any],
    ):
        """Register a callback for an action."""
        self.mapper.register_callback(action, callback)


# Singleton instance
_controller_instance: Optional[GestureController] = None


def get_gesture_controller() -> GestureController:
    """Get or create the singleton gesture controller."""
    global _controller_instance
    if _controller_instance is None:
        _controller_instance = GestureController()
    return _controller_instance


def cleanup_gesture_controller():
    """Clean up the singleton instance."""
    global _controller_instance
    if _controller_instance:
        _controller_instance.stop()
        _controller_instance = None

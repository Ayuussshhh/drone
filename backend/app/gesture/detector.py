"""
Gesture Detection using MediaPipe.

Implements real-time hand gesture recognition for drone control:
- Pinch: Select/confirm actions
- Swipe: Adjust parameter values
- Rotate: Rotate drone view
- Point: Navigate/select UI elements
- Open palm: Stop/reset
"""

import asyncio
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Callable, List, Tuple
import time
import math
import logging

import cv2
import numpy as np

try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    mp = None

logger = logging.getLogger(__name__)


class GestureType(str, Enum):
    """Recognized gesture types."""
    NONE = "none"
    PINCH = "pinch"
    SWIPE_LEFT = "swipe_left"
    SWIPE_RIGHT = "swipe_right"
    SWIPE_UP = "swipe_up"
    SWIPE_DOWN = "swipe_down"
    ROTATE_CW = "rotate_cw"
    ROTATE_CCW = "rotate_ccw"
    POINT = "point"
    OPEN_PALM = "open_palm"
    FIST = "fist"
    THUMBS_UP = "thumbs_up"
    THUMBS_DOWN = "thumbs_down"


class HandSide(str, Enum):
    """Which hand is detected."""
    LEFT = "left"
    RIGHT = "right"
    UNKNOWN = "unknown"


@dataclass
class HandLandmarks:
    """Processed hand landmark data."""
    # Key points (normalized 0-1 coordinates)
    wrist: Tuple[float, float, float] = (0, 0, 0)
    thumb_tip: Tuple[float, float, float] = (0, 0, 0)
    thumb_ip: Tuple[float, float, float] = (0, 0, 0)
    thumb_mcp: Tuple[float, float, float] = (0, 0, 0)
    index_tip: Tuple[float, float, float] = (0, 0, 0)
    index_pip: Tuple[float, float, float] = (0, 0, 0)
    index_mcp: Tuple[float, float, float] = (0, 0, 0)
    middle_tip: Tuple[float, float, float] = (0, 0, 0)
    middle_mcp: Tuple[float, float, float] = (0, 0, 0)
    ring_tip: Tuple[float, float, float] = (0, 0, 0)
    ring_mcp: Tuple[float, float, float] = (0, 0, 0)
    pinky_tip: Tuple[float, float, float] = (0, 0, 0)
    pinky_mcp: Tuple[float, float, float] = (0, 0, 0)

    # Palm center (average of MCP joints)
    palm_center: Tuple[float, float, float] = (0, 0, 0)

    # Hand characteristics
    hand_side: HandSide = HandSide.UNKNOWN

    # Finger states (True = extended)
    thumb_extended: bool = False
    index_extended: bool = False
    middle_extended: bool = False
    ring_extended: bool = False
    pinky_extended: bool = False

    @property
    def extended_finger_count(self) -> int:
        """Count of extended fingers."""
        return sum([
            self.thumb_extended,
            self.index_extended,
            self.middle_extended,
            self.ring_extended,
            self.pinky_extended,
        ])


@dataclass
class GestureEvent:
    """A detected gesture event."""
    gesture: GestureType
    confidence: float  # 0-1
    hand_side: HandSide
    position: Tuple[float, float]  # Screen position (normalized)
    timestamp: float
    # Gesture-specific data
    velocity: Tuple[float, float] = (0, 0)  # For swipes
    angle: float = 0  # For rotations (radians)
    pinch_distance: float = 0  # For pinch gestures

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "gesture": self.gesture.value,
            "confidence": self.confidence,
            "hand_side": self.hand_side.value,
            "position": {"x": self.position[0], "y": self.position[1]},
            "timestamp": self.timestamp,
            "velocity": {"x": self.velocity[0], "y": self.velocity[1]},
            "angle": self.angle,
            "pinch_distance": self.pinch_distance,
        }


@dataclass
class GestureHistory:
    """Tracks gesture history for temporal analysis."""
    positions: List[Tuple[float, float, float]] = field(default_factory=list)
    timestamps: List[float] = field(default_factory=list)
    max_history: int = 30  # ~1 second at 30fps

    def add(self, position: Tuple[float, float, float], timestamp: float):
        """Add a position to history."""
        self.positions.append(position)
        self.timestamps.append(timestamp)

        # Trim old entries
        while len(self.positions) > self.max_history:
            self.positions.pop(0)
            self.timestamps.pop(0)

    def get_velocity(self) -> Tuple[float, float]:
        """Calculate velocity from recent positions."""
        if len(self.positions) < 2:
            return (0, 0)

        # Use last few frames for smoothing
        n = min(5, len(self.positions))
        dx = self.positions[-1][0] - self.positions[-n][0]
        dy = self.positions[-1][1] - self.positions[-n][1]
        dt = self.timestamps[-1] - self.timestamps[-n]

        if dt < 0.001:
            return (0, 0)

        return (dx / dt, dy / dt)

    def clear(self):
        """Clear history."""
        self.positions.clear()
        self.timestamps.clear()


class GestureDetector:
    """
    Main gesture detection class using MediaPipe Hands.

    Usage:
        detector = GestureDetector()
        detector.start()

        while True:
            gesture = detector.get_gesture()
            if gesture:
                handle_gesture(gesture)

        detector.stop()
    """

    # Detection thresholds
    PINCH_THRESHOLD = 0.05  # Max distance for pinch (normalized)
    SWIPE_MIN_VELOCITY = 0.5  # Min velocity for swipe detection
    SWIPE_MIN_DISTANCE = 0.15  # Min travel for swipe
    ROTATION_THRESHOLD = 15  # Degrees for rotation detection
    GESTURE_COOLDOWN = 0.3  # Seconds between gesture triggers

    def __init__(
        self,
        camera_id: int = 0,
        min_detection_confidence: float = 0.7,
        min_tracking_confidence: float = 0.5,
        max_hands: int = 2,
    ):
        """
        Initialize the gesture detector.

        Args:
            camera_id: Camera device ID (0 = default)
            min_detection_confidence: MediaPipe detection confidence
            min_tracking_confidence: MediaPipe tracking confidence
            max_hands: Maximum number of hands to track
        """
        if not MEDIAPIPE_AVAILABLE:
            raise ImportError(
                "MediaPipe is required for gesture detection. "
                "Install with: pip install mediapipe"
            )

        self.camera_id = camera_id
        self.min_detection_confidence = min_detection_confidence
        self.min_tracking_confidence = min_tracking_confidence
        self.max_hands = max_hands

        # MediaPipe components
        self.mp_hands = mp.solutions.hands
        self.mp_drawing = mp.solutions.drawing_utils
        self.hands: Optional[mp.solutions.hands.Hands] = None

        # Video capture
        self.cap: Optional[cv2.VideoCapture] = None
        self.frame_width = 640
        self.frame_height = 480

        # State tracking
        self.running = False
        self.last_gesture_time = 0
        self.last_landmarks: Optional[HandLandmarks] = None
        self.gesture_history: dict[HandSide, GestureHistory] = {
            HandSide.LEFT: GestureHistory(),
            HandSide.RIGHT: GestureHistory(),
        }

        # Event callback
        self.on_gesture: Optional[Callable[[GestureEvent], None]] = None

        # Current frame (for visualization)
        self.current_frame: Optional[np.ndarray] = None
        self.show_preview = False

        # Pinch state tracking
        self._pinch_active: dict[HandSide, bool] = {
            HandSide.LEFT: False,
            HandSide.RIGHT: False,
        }
        self._pinch_start_pos: dict[HandSide, Tuple[float, float]] = {
            HandSide.LEFT: (0, 0),
            HandSide.RIGHT: (0, 0),
        }

        # Rotation tracking
        self._last_wrist_angle: dict[HandSide, float] = {
            HandSide.LEFT: 0,
            HandSide.RIGHT: 0,
        }

    def start(self, show_preview: bool = False) -> bool:
        """
        Start the gesture detection.

        Args:
            show_preview: Whether to show camera preview window

        Returns:
            True if successfully started
        """
        if self.running:
            return True

        try:
            # Initialize MediaPipe Hands
            self.hands = self.mp_hands.Hands(
                static_image_mode=False,
                max_num_hands=self.max_hands,
                min_detection_confidence=self.min_detection_confidence,
                min_tracking_confidence=self.min_tracking_confidence,
            )

            # Open camera
            self.cap = cv2.VideoCapture(self.camera_id)
            if not self.cap.isOpened():
                logger.error(f"Failed to open camera {self.camera_id}")
                return False

            # Set camera properties
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.frame_width)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.frame_height)
            self.cap.set(cv2.CAP_PROP_FPS, 30)

            self.running = True
            self.show_preview = show_preview
            logger.info("Gesture detection started")
            return True

        except Exception as e:
            logger.error(f"Failed to start gesture detection: {e}")
            self.stop()
            return False

    def stop(self):
        """Stop gesture detection and release resources."""
        self.running = False

        if self.cap:
            self.cap.release()
            self.cap = None

        if self.hands:
            self.hands.close()
            self.hands = None

        if self.show_preview:
            cv2.destroyAllWindows()

        logger.info("Gesture detection stopped")

    def process_frame(self) -> Optional[GestureEvent]:
        """
        Process a single frame and detect gestures.

        Returns:
            GestureEvent if a gesture is detected, None otherwise
        """
        if not self.running or not self.cap:
            return None

        # Read frame
        ret, frame = self.cap.read()
        if not ret:
            return None

        # Flip for mirror effect
        frame = cv2.flip(frame, 1)
        self.current_frame = frame

        # Convert to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Process with MediaPipe
        results = self.hands.process(rgb_frame)

        gesture_event = None

        if results.multi_hand_landmarks:
            for hand_idx, hand_landmarks in enumerate(results.multi_hand_landmarks):
                # Get hand side
                handedness = results.multi_handedness[hand_idx]
                hand_side = self._get_hand_side(handedness)

                # Extract landmarks
                landmarks = self._extract_landmarks(hand_landmarks, hand_side)
                self.last_landmarks = landmarks

                # Update history
                current_time = time.time()
                self.gesture_history[hand_side].add(
                    landmarks.palm_center,
                    current_time,
                )

                # Detect gestures
                gesture = self._detect_gesture(landmarks, hand_side, current_time)

                if gesture and self._can_trigger_gesture(current_time):
                    gesture_event = gesture
                    self.last_gesture_time = current_time

                    # Trigger callback
                    if self.on_gesture:
                        self.on_gesture(gesture_event)

                # Draw landmarks on preview
                if self.show_preview:
                    self.mp_drawing.draw_landmarks(
                        frame,
                        hand_landmarks,
                        self.mp_hands.HAND_CONNECTIONS,
                    )

        # Show preview window
        if self.show_preview:
            self._draw_debug_info(frame, gesture_event)
            cv2.imshow("Gesture Detection", frame)
            cv2.waitKey(1)

        return gesture_event

    async def run_async(self):
        """Run gesture detection asynchronously."""
        self.start()

        try:
            while self.running:
                gesture = self.process_frame()
                await asyncio.sleep(1 / 30)  # 30 fps
        finally:
            self.stop()

    def _get_hand_side(self, handedness) -> HandSide:
        """Determine which hand is detected."""
        # MediaPipe labels are mirrored
        label = handedness.classification[0].label
        if label == "Left":
            return HandSide.RIGHT  # Mirrored
        elif label == "Right":
            return HandSide.LEFT  # Mirrored
        return HandSide.UNKNOWN

    def _extract_landmarks(
        self,
        hand_landmarks,
        hand_side: HandSide,
    ) -> HandLandmarks:
        """Extract and process landmark data."""
        lm = hand_landmarks.landmark

        # Extract key points
        def to_tuple(idx):
            return (lm[idx].x, lm[idx].y, lm[idx].z)

        landmarks = HandLandmarks(
            wrist=to_tuple(0),
            thumb_tip=to_tuple(4),
            thumb_ip=to_tuple(3),
            thumb_mcp=to_tuple(2),
            index_tip=to_tuple(8),
            index_pip=to_tuple(6),
            index_mcp=to_tuple(5),
            middle_tip=to_tuple(12),
            middle_mcp=to_tuple(9),
            ring_tip=to_tuple(16),
            ring_mcp=to_tuple(13),
            pinky_tip=to_tuple(20),
            pinky_mcp=to_tuple(17),
            hand_side=hand_side,
        )

        # Calculate palm center
        palm_points = [
            landmarks.wrist,
            landmarks.index_mcp,
            landmarks.middle_mcp,
            landmarks.ring_mcp,
            landmarks.pinky_mcp,
        ]
        landmarks.palm_center = (
            sum(p[0] for p in palm_points) / len(palm_points),
            sum(p[1] for p in palm_points) / len(palm_points),
            sum(p[2] for p in palm_points) / len(palm_points),
        )

        # Determine finger extension states
        landmarks.thumb_extended = self._is_thumb_extended(landmarks)
        landmarks.index_extended = self._is_finger_extended(
            landmarks.index_tip, landmarks.index_pip, landmarks.index_mcp
        )
        landmarks.middle_extended = self._is_finger_extended(
            landmarks.middle_tip, lm[10], landmarks.middle_mcp
        )
        landmarks.ring_extended = self._is_finger_extended(
            landmarks.ring_tip, lm[14], landmarks.ring_mcp
        )
        landmarks.pinky_extended = self._is_finger_extended(
            landmarks.pinky_tip, lm[18], landmarks.pinky_mcp
        )

        return landmarks

    def _is_thumb_extended(self, landmarks: HandLandmarks) -> bool:
        """Check if thumb is extended."""
        # Thumb is extended if tip is far from palm center
        dx = landmarks.thumb_tip[0] - landmarks.palm_center[0]
        dy = landmarks.thumb_tip[1] - landmarks.palm_center[1]
        distance = math.sqrt(dx * dx + dy * dy)
        return distance > 0.15

    def _is_finger_extended(self, tip, pip, mcp) -> bool:
        """Check if a finger is extended based on landmark positions."""
        if hasattr(pip, 'y'):
            pip_y = pip.y
        else:
            pip_y = pip[1]

        if hasattr(mcp, 'y'):
            mcp_y = mcp.y
        else:
            mcp_y = mcp[1]

        tip_y = tip[1] if isinstance(tip, tuple) else tip.y

        # Finger is extended if tip is above PIP and MCP (lower y = higher on screen)
        return tip_y < pip_y and tip_y < mcp_y

    def _detect_gesture(
        self,
        landmarks: HandLandmarks,
        hand_side: HandSide,
        current_time: float,
    ) -> Optional[GestureEvent]:
        """Detect gesture from landmarks."""

        # Check for pinch gesture
        pinch_gesture = self._detect_pinch(landmarks, hand_side, current_time)
        if pinch_gesture:
            return pinch_gesture

        # Check for swipe gestures
        swipe_gesture = self._detect_swipe(landmarks, hand_side, current_time)
        if swipe_gesture:
            return swipe_gesture

        # Check for rotation
        rotation_gesture = self._detect_rotation(landmarks, hand_side, current_time)
        if rotation_gesture:
            return rotation_gesture

        # Check for static gestures
        static_gesture = self._detect_static_gesture(landmarks, hand_side, current_time)
        if static_gesture:
            return static_gesture

        return None

    def _detect_pinch(
        self,
        landmarks: HandLandmarks,
        hand_side: HandSide,
        current_time: float,
    ) -> Optional[GestureEvent]:
        """Detect pinch gesture (thumb + index finger)."""
        # Calculate distance between thumb and index tips
        dx = landmarks.thumb_tip[0] - landmarks.index_tip[0]
        dy = landmarks.thumb_tip[1] - landmarks.index_tip[1]
        dz = landmarks.thumb_tip[2] - landmarks.index_tip[2]
        distance = math.sqrt(dx * dx + dy * dy + dz * dz)

        is_pinching = distance < self.PINCH_THRESHOLD
        was_pinching = self._pinch_active[hand_side]

        if is_pinching and not was_pinching:
            # Pinch started
            self._pinch_active[hand_side] = True
            self._pinch_start_pos[hand_side] = (
                landmarks.palm_center[0],
                landmarks.palm_center[1],
            )

            return GestureEvent(
                gesture=GestureType.PINCH,
                confidence=1.0 - (distance / self.PINCH_THRESHOLD),
                hand_side=hand_side,
                position=self._pinch_start_pos[hand_side],
                timestamp=current_time,
                pinch_distance=distance,
            )

        elif not is_pinching and was_pinching:
            # Pinch released
            self._pinch_active[hand_side] = False

        return None

    def _detect_swipe(
        self,
        landmarks: HandLandmarks,
        hand_side: HandSide,
        current_time: float,
    ) -> Optional[GestureEvent]:
        """Detect swipe gestures."""
        # Need pointing gesture (index extended, others closed)
        if not (landmarks.index_extended and
                not landmarks.middle_extended and
                not landmarks.ring_extended and
                not landmarks.pinky_extended):
            return None

        history = self.gesture_history[hand_side]
        velocity = history.get_velocity()

        speed = math.sqrt(velocity[0] ** 2 + velocity[1] ** 2)
        if speed < self.SWIPE_MIN_VELOCITY:
            return None

        # Check total distance traveled
        if len(history.positions) < 5:
            return None

        start_pos = history.positions[0]
        end_pos = history.positions[-1]
        dx = end_pos[0] - start_pos[0]
        dy = end_pos[1] - start_pos[1]
        distance = math.sqrt(dx * dx + dy * dy)

        if distance < self.SWIPE_MIN_DISTANCE:
            return None

        # Determine swipe direction
        if abs(dx) > abs(dy):
            gesture = GestureType.SWIPE_RIGHT if dx > 0 else GestureType.SWIPE_LEFT
        else:
            gesture = GestureType.SWIPE_DOWN if dy > 0 else GestureType.SWIPE_UP

        # Clear history after swipe
        history.clear()

        return GestureEvent(
            gesture=gesture,
            confidence=min(1.0, speed / (self.SWIPE_MIN_VELOCITY * 2)),
            hand_side=hand_side,
            position=(landmarks.index_tip[0], landmarks.index_tip[1]),
            timestamp=current_time,
            velocity=velocity,
        )

    def _detect_rotation(
        self,
        landmarks: HandLandmarks,
        hand_side: HandSide,
        current_time: float,
    ) -> Optional[GestureEvent]:
        """Detect wrist rotation gestures."""
        # Calculate wrist angle based on thumb position relative to wrist
        dx = landmarks.thumb_mcp[0] - landmarks.wrist[0]
        dy = landmarks.thumb_mcp[1] - landmarks.wrist[1]
        current_angle = math.degrees(math.atan2(dy, dx))

        last_angle = self._last_wrist_angle[hand_side]
        self._last_wrist_angle[hand_side] = current_angle

        # Check for significant rotation
        angle_diff = current_angle - last_angle

        # Handle angle wrap-around
        if angle_diff > 180:
            angle_diff -= 360
        elif angle_diff < -180:
            angle_diff += 360

        if abs(angle_diff) > self.ROTATION_THRESHOLD:
            gesture = GestureType.ROTATE_CW if angle_diff > 0 else GestureType.ROTATE_CCW

            return GestureEvent(
                gesture=gesture,
                confidence=min(1.0, abs(angle_diff) / 45),
                hand_side=hand_side,
                position=(landmarks.palm_center[0], landmarks.palm_center[1]),
                timestamp=current_time,
                angle=math.radians(angle_diff),
            )

        return None

    def _detect_static_gesture(
        self,
        landmarks: HandLandmarks,
        hand_side: HandSide,
        current_time: float,
    ) -> Optional[GestureEvent]:
        """Detect static hand poses."""
        # Open palm (all fingers extended)
        if landmarks.extended_finger_count == 5:
            return GestureEvent(
                gesture=GestureType.OPEN_PALM,
                confidence=0.9,
                hand_side=hand_side,
                position=(landmarks.palm_center[0], landmarks.palm_center[1]),
                timestamp=current_time,
            )

        # Fist (no fingers extended)
        if landmarks.extended_finger_count == 0:
            return GestureEvent(
                gesture=GestureType.FIST,
                confidence=0.9,
                hand_side=hand_side,
                position=(landmarks.palm_center[0], landmarks.palm_center[1]),
                timestamp=current_time,
            )

        # Point (only index extended)
        if (landmarks.index_extended and
            not landmarks.middle_extended and
            not landmarks.ring_extended and
            not landmarks.pinky_extended):
            return GestureEvent(
                gesture=GestureType.POINT,
                confidence=0.9,
                hand_side=hand_side,
                position=(landmarks.index_tip[0], landmarks.index_tip[1]),
                timestamp=current_time,
            )

        # Thumbs up
        if (landmarks.thumb_extended and
            not landmarks.index_extended and
            not landmarks.middle_extended and
            not landmarks.ring_extended and
            not landmarks.pinky_extended and
            landmarks.thumb_tip[1] < landmarks.wrist[1]):  # Thumb above wrist
            return GestureEvent(
                gesture=GestureType.THUMBS_UP,
                confidence=0.9,
                hand_side=hand_side,
                position=(landmarks.thumb_tip[0], landmarks.thumb_tip[1]),
                timestamp=current_time,
            )

        # Thumbs down
        if (landmarks.thumb_extended and
            not landmarks.index_extended and
            not landmarks.middle_extended and
            not landmarks.ring_extended and
            not landmarks.pinky_extended and
            landmarks.thumb_tip[1] > landmarks.wrist[1]):  # Thumb below wrist
            return GestureEvent(
                gesture=GestureType.THUMBS_DOWN,
                confidence=0.9,
                hand_side=hand_side,
                position=(landmarks.thumb_tip[0], landmarks.thumb_tip[1]),
                timestamp=current_time,
            )

        return None

    def _can_trigger_gesture(self, current_time: float) -> bool:
        """Check if enough time has passed since last gesture."""
        return (current_time - self.last_gesture_time) >= self.GESTURE_COOLDOWN

    def _draw_debug_info(
        self,
        frame: np.ndarray,
        gesture: Optional[GestureEvent],
    ):
        """Draw debug information on frame."""
        # Draw gesture name
        if gesture:
            text = f"Gesture: {gesture.gesture.value}"
            cv2.putText(
                frame, text, (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2,
            )

            conf_text = f"Confidence: {gesture.confidence:.2f}"
            cv2.putText(
                frame, conf_text, (10, 60),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2,
            )

        # Draw FPS
        fps_text = "Press 'q' to quit"
        cv2.putText(
            frame, fps_text, (10, frame.shape[0] - 10),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1,
        )

    def get_current_frame(self) -> Optional[np.ndarray]:
        """Get the current camera frame with annotations."""
        return self.current_frame

    def get_frame_jpeg(self) -> Optional[bytes]:
        """Get current frame as JPEG bytes for streaming."""
        if self.current_frame is None:
            return None

        ret, buffer = cv2.imencode('.jpg', self.current_frame)
        if ret:
            return buffer.tobytes()
        return None


# Singleton instance for easy access
_detector_instance: Optional[GestureDetector] = None


def get_gesture_detector() -> GestureDetector:
    """Get or create the singleton gesture detector instance."""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = GestureDetector()
    return _detector_instance


def cleanup_gesture_detector():
    """Clean up the singleton instance."""
    global _detector_instance
    if _detector_instance:
        _detector_instance.stop()
        _detector_instance = None

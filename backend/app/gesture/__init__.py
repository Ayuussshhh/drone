"""
Gesture recognition and control module.

Provides hand gesture detection and mapping to drone control actions
using MediaPipe for real-time hand tracking.

Components:
- GestureDetector: Hand tracking and gesture recognition
- GestureMapper: Maps gestures to actions
- GestureController: High-level controller combining detection and mapping
"""

from .detector import (
    GestureType,
    GestureEvent,
    HandSide,
    HandLandmarks,
    GestureDetector,
    GestureHistory,
    get_gesture_detector,
    cleanup_gesture_detector,
)

from .mapper import (
    ActionType,
    ActionCommand,
    GestureMapping,
    GestureContext,
    GestureMapper,
    GestureController,
    get_gesture_controller,
    cleanup_gesture_controller,
)

__all__ = [
    # Detector types
    "GestureType",
    "GestureEvent",
    "HandSide",
    "HandLandmarks",
    "GestureHistory",
    "GestureDetector",
    "get_gesture_detector",
    "cleanup_gesture_detector",
    # Mapper types
    "ActionType",
    "ActionCommand",
    "GestureMapping",
    "GestureContext",
    "GestureMapper",
    "GestureController",
    "get_gesture_controller",
    "cleanup_gesture_controller",
]

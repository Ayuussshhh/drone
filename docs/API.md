# API Reference

## Base URL

```
http://localhost:8000
```

## Authentication

Currently no authentication required. Add JWT/API key for production.

---

## REST Endpoints

### Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 123.45,
  "active_simulations": 0
}
```

---

### Validate Configuration

```http
POST /api/validate
Content-Type: application/json
```

**Request Body:** `DroneConfiguration`

**Response:**
```json
{
  "valid": true,
  "can_fly": true,
  "errors": [],
  "warnings": ["Low thrust margin"],
  "total_mass": 1.2,
  "max_thrust": 25.0,
  "thrust_to_weight_ratio": 2.1,
  "min_throttle_to_hover": 47.6,
  "max_payload_capacity": 0.8,
  "summary": "Good configuration (T/W = 2.1)"
}
```

---

### Run Simulation

```http
POST /api/simulate
Content-Type: application/json
```

**Request Body:**
```json
{
  "drone_config": { ... },
  "parameters": {
    "timestep": 0.02,
    "max_duration": 30.0,
    "wind_velocity": {"x": 5, "y": 0, "z": 0},
    "wind_turbulence": 0.2,
    "motor_throttles": [0.5, 0.5, 0.5, 0.5],
    "enable_wind": true,
    "enable_tether": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "status": "completed",
  "message": "Simulation completed normally",
  "can_fly": true,
  "flight_status": "flying",
  "metrics": { ... },
  "stability": { ... },
  "result": { ... }
}
```

---

### Quick Analysis

```http
POST /api/quick-analysis
Content-Type: application/json
```

Returns instant metrics without full simulation.

---

### List Components

```http
GET /api/components
```

Returns component schema templates.

---

### Get Sample Configuration

```http
GET /api/sample-config
```

Returns a working sample quadcopter configuration.

---

## Socket.IO Events

Connect to: `ws://localhost:8000/`

### Client → Server

#### start_simulation
```json
{
  "config": { DroneConfiguration },
  "parameters": { SimulationParameters },
  "update_rate": 50
}
```

#### stop_simulation
No payload.

#### update_throttles
```json
{
  "throttles": [0.5, 0.52, 0.48, 0.5]
}
```

#### set_wind
```json
{
  "velocity": {"x": 5, "y": 0, "z": 0},
  "turbulence": 0.2
}
```

### Server → Client

#### simulation_state
```json
{
  "state": {
    "timestamp": 1.234,
    "position": {"x": 0, "y": 5.2, "z": 0},
    "velocity": {"x": 0.1, "y": 0.05, "z": 0},
    "rotation": {"x": 0.01, "y": 0, "z": 0.02},
    "motor_thrusts": [3.1, 3.0, 3.1, 3.0],
    "tether_tension": 5.2,
    "flight_status": "flying"
  },
  "metrics": { ... },
  "stability": { ... }
}
```

#### simulation_started
```json
{
  "message": "Simulation started",
  "update_rate": 50
}
```

#### error
```json
{
  "message": "Error description"
}
```

---

## Data Models

### DroneConfiguration

```typescript
{
  id: string;
  name: string;
  motors: Motor[];
  propellers: Propeller[];
  battery: Battery;
  frame: Frame;
  payload?: Payload;
  tether?: Tether;
}
```

### Motor

```typescript
{
  id: string;
  name: string;
  motor_type: "brushless" | "brushed";
  mass: number;           // kg
  kv_rating: number;
  thrust_constant: number; // N/(rad/s)^2
  max_rpm: number;
  min_rpm?: number;
  max_current: number;    // A
  position: Vector3;
  rotation_direction: 1 | -1;
}
```

### SimulationParameters

```typescript
{
  timestep?: number;        // seconds, default 0.02
  max_duration?: number;    // seconds
  wind_velocity?: Vector3;
  wind_turbulence?: number; // 0-1
  air_density?: number;     // kg/m³
  motor_throttles?: number[]; // 0-1 each
  enable_wind?: boolean;
  enable_tether?: boolean;
  use_auto_stabilization?: boolean;
}
```

### Vector3

```typescript
{
  x: number;
  y: number;
  z: number;
}
```

---

## Gesture Control API

### Get Gesture Status

```http
GET /api/gesture/status
```

**Response:**
```json
{
  "running": false,
  "context": "default",
  "available_gestures": ["pinch", "swipe_up", "swipe_down", "open_palm"],
  "help_text": "Available gestures (default):\n  - pinch: Pinch to select/confirm\n  ..."
}
```

---

### Start Gesture Detection

```http
POST /api/gesture/start?show_preview=false
```

**Query Parameters:**
- `show_preview` (bool): Show camera preview window (default: false)

**Response:**
```json
{
  "status": "started",
  "message": "Gesture detection started"
}
```

---

### Stop Gesture Detection

```http
POST /api/gesture/stop
```

**Response:**
```json
{
  "status": "stopped",
  "message": "Gesture detection stopped"
}
```

---

### Set Gesture Context

```http
POST /api/gesture/context
Content-Type: application/json
```

**Request Body:**
```json
{
  "context": "simulation_running"
}
```

**Available Contexts:**
- `default` - General navigation
- `component_selection` - Component browsing
- `parameter_adjustment` - Value adjustment
- `simulation_running` - Active simulation control
- `view_control` - 3D view manipulation

**Response:**
```json
{
  "status": "updated",
  "context": "simulation_running",
  "help_text": "Available gestures (simulation_running):\n  ..."
}
```

---

### Get Gesture Mappings

```http
GET /api/gesture/mappings?context=default
```

**Query Parameters:**
- `context` (string, optional): Context to get mappings for

**Response:**
```json
{
  "context": "default",
  "mappings": [
    {
      "gesture": "pinch",
      "action": "confirm_selection",
      "description": "Pinch to select/confirm",
      "min_confidence": 0.7
    },
    {
      "gesture": "swipe_up",
      "action": "navigate_up",
      "description": "Swipe up to scroll",
      "min_confidence": 0.7
    }
  ]
}
```

---

### List Gesture Contexts

```http
GET /api/gesture/contexts
```

**Response:**
```json
{
  "contexts": [
    {
      "id": "default",
      "name": "Default",
      "description": "Default gestures for general navigation"
    },
    {
      "id": "simulation_running",
      "name": "Simulation Running",
      "description": "Gestures for controlling active simulation"
    }
  ]
}
```

---

### Get Camera Frame (Debug)

```http
GET /api/gesture/frame
```

Returns current camera frame as JPEG image with gesture annotations.

**Response:** `image/jpeg`

---

### Video Stream (Debug)

```http
GET /api/gesture/stream
```

Returns MJPEG video stream with real-time gesture annotations.

**Response:** `multipart/x-mixed-replace; boundary=frame`

Open in browser for live preview.

---

## Gesture Socket.IO Events

### Client → Server

#### gesture_command
```json
{
  "gesture": "pinch",
  "parameters": {
    "direction": "up",
    "angle": 0.5
  }
}
```

### Server → Client

#### gesture_ack
```json
{
  "gesture": "pinch",
  "action": "select"
}
```

#### rotate_view
```json
{
  "angle": 15.5
}
```

---

## Gesture Data Models

### GestureEvent

```typescript
{
  gesture: GestureType;      // "pinch", "swipe_up", etc.
  confidence: number;        // 0-1
  hand_side: "left" | "right" | "unknown";
  position: { x: number; y: number };  // Normalized 0-1
  timestamp: number;
  velocity?: { x: number; y: number };  // For swipes
  angle?: number;            // For rotations (radians)
  pinch_distance?: number;   // For pinch gestures
}
```

### ActionCommand

```typescript
{
  action: ActionType;        // "throttle_up", "confirm_selection", etc.
  parameters: Record<string, any>;
  timestamp: number;
  source_gesture: GestureType | null;
}
```

### GestureType

```typescript
type GestureType =
  | "none"
  | "pinch"
  | "swipe_left"
  | "swipe_right"
  | "swipe_up"
  | "swipe_down"
  | "rotate_cw"
  | "rotate_ccw"
  | "point"
  | "open_palm"
  | "fist"
  | "thumbs_up"
  | "thumbs_down";
```

### ActionType

```typescript
type ActionType =
  | "start_simulation"
  | "stop_simulation"
  | "pause_simulation"
  | "resume_simulation"
  | "reset_simulation"
  | "throttle_up"
  | "throttle_down"
  | "throttle_set"
  | "increase_parameter"
  | "decrease_parameter"
  | "select_parameter"
  | "confirm_value"
  | "select_component"
  | "next_component"
  | "previous_component"
  | "confirm_selection"
  | "cancel_selection"
  | "rotate_view"
  | "zoom_in"
  | "zoom_out"
  | "reset_view"
  | "navigate_up"
  | "navigate_down"
  | "navigate_left"
  | "navigate_right"
  | "emergency_stop"
  | "no_action";
```

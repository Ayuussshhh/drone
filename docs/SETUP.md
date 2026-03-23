# Setup Guide

Complete setup instructions for the Drone Design & Failure Prediction System.

## Prerequisites

### Required Software

- **Python 3.11+** - Backend server
- **Node.js 18+** - Dashboard (Phase 4)
- **Unity 2022.3 LTS** - 3D Simulation (Phase 2)
- **Git** - Version control

### Optional

- **Docker** - Containerized deployment
- **Webcam** - Gesture control (Phase 5)

---

## Phase 1: Backend Setup

### 1. Clone/Navigate to Project

```bash
cd drone
```

### 2. Create Virtual Environment

```bash
cd backend
python -m venv venv
```

### 3. Activate Virtual Environment

**Windows:**
```bash
.\venv\Scripts\activate
```

**Linux/macOS:**
```bash
source venv/bin/activate
```

### 4. Install Dependencies

```bash
pip install -r requirements.txt
```

### 5. Configure Environment

```bash
# Copy example config
cp .env.example .env

# Edit as needed
# Default settings work for development
```

### 6. Run Server

```bash
python run.py
```

Or with options:
```bash
python run.py --host 0.0.0.0 --port 8000 --reload
```

### 7. Verify Installation

Open in browser: http://localhost:8000/docs

Try the sample configuration:
```bash
curl http://localhost:8000/api/sample-config
```

### 8. Run Tests

```bash
pytest -v
```

---

## Phase 2 & 3: Unity Setup

### 1. Install Unity Hub

Download from: https://unity.com/download

### 2. Install Unity 2022.3 LTS

Via Unity Hub, install version 2022.3.x with modules:
- Windows Build Support (IL2CPP) - for Windows builds
- WebGL Build Support - for browser deployment

### 3. Open Project

1. Open Unity Hub
2. Click "Add" → "Add project from disk"
3. Navigate to `drone/unity/DroneSimulator`
4. Open the project

### 4. Import Dependencies

The project requires these packages (install via Package Manager):
- TextMeshPro (for UI)
- Newtonsoft JSON (for Socket.IO serialization)

For WebSocket support, the project includes custom Socket.IO client:
- `Scripts/Network/SocketIOClient.cs` - HTTP polling-based Socket.IO client

### 5. Configure Connection

Edit `DroneController.cs` or use the Unity Inspector:
```
Backend URL: http://localhost:8000
Update Rate: 50 Hz
Sync Mode: Bidirectional (recommended)
```

### 6. Project Structure

```
Assets/
├── Scenes/
│   └── Main.unity            # Main simulation scene
├── Scripts/
│   ├── Drone/
│   │   ├── DroneController.cs     # Main drone orchestrator
│   │   ├── MotorController.cs     # Individual motor physics
│   │   ├── PropellerController.cs # Visual propeller rotation
│   │   └── TetherController.cs    # Tether spring-damper physics
│   ├── Physics/
│   │   ├── WindSimulator.cs       # Perlin noise wind
│   │   ├── ForceApplicator.cs     # Force visualization
│   │   └── StabilitySystem.cs     # Stability scoring
│   ├── Network/
│   │   ├── SocketIOClient.cs      # Socket.IO HTTP polling
│   │   └── SimulationSync.cs      # State synchronization
│   └── UI/
│       └── DebugOverlay.cs        # Runtime debug display
├── Prefabs/
│   └── DroneQuadcopter.prefab     # Configured drone prefab
└── Materials/
    └── Drone/                      # Drone materials
```

### 7. Run Simulation

1. Open `Scenes/Main.unity`
2. Ensure backend is running (`python run.py`)
3. Press Play in Unity
4. Check Console for "Connected to backend" message

### 8. Key Features

- **Custom Physics**: Full thrust, drag, wind, and tether calculations
- **Auto-Stabilization**: PD controller maintains hover
- **Real-time Sync**: Bidirectional state synchronization with backend
- **Wind Effects**: Perlin noise turbulence and random gusts
- **Tether Physics**: Spring-damper model with catenary visualization
- **Debug Visuals**: Force vectors, stability indicators, wind direction

---

## Phase 4: Dashboard Setup

### 1. Navigate to Dashboard

```bash
cd dashboard
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Project Structure

```
dashboard/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Main dashboard page
│   │   ├── layout.tsx        # Root layout with fonts
│   │   └── globals.css       # Global styles
│   ├── components/
│   │   ├── StatusIndicator.tsx     # Connection & flight status
│   │   ├── MetricsDashboard.tsx    # Real-time physics metrics
│   │   ├── SimulationControls.tsx  # Start/stop, throttle, wind
│   │   ├── RealTimeGraphs.tsx      # Live data charts
│   │   └── ComponentSelector.tsx   # Drone configuration
│   ├── hooks/
│   │   └── useSocket.ts      # Socket.IO connection hook
│   ├── lib/
│   │   ├── types.ts          # TypeScript definitions
│   │   └── api.ts            # REST API client
│   └── store/
│       └── simulationStore.ts # Zustand state management
├── package.json
├── tailwind.config.js        # Custom engineering color palette
├── next.config.js            # API proxy configuration
└── tsconfig.json
```

### 4. Configure Environment

The dashboard connects to the backend via Next.js rewrites (see `next.config.js`).

Default backend URL: `http://localhost:8000`

To change, edit `next.config.js`:
```javascript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://your-backend:8000/api/:path*',
    },
  ];
}
```

### 5. Run Development Server

```bash
npm run dev
```

### 6. Open Dashboard

http://localhost:3000

### 7. Dashboard Features

#### Left Sidebar
- Connection status indicator
- Simulation controls (Start/Stop/Pause/Reset)
- Throttle sliders for each motor
- Wind configuration
- Warnings and critical issues display

#### Main Panel (Tabbed)
- **Metrics**: Real-time physics values (thrust, drag, power)
- **Charts**: Live graphs (altitude, velocity, orientation)
- **Config**: Drone component configuration

#### Right Sidebar
- Quick stats display
- Altitude, airspeed, thrust
- Thrust-to-weight ratio
- Power consumption
- Stability score

### 8. Build for Production

```bash
npm run build
npm start
```

---

## Phase 5: Gesture Control Setup

### 1. Webcam Requirements

- USB webcam or integrated camera
- 720p minimum resolution
- Good lighting (avoid backlighting)
- Clear view of hands

### 2. Install MediaPipe

Already included in backend requirements:
```bash
pip install mediapipe opencv-python
```

### 3. Grant Camera Permissions

**Windows:** Settings → Privacy → Camera → Allow apps to access camera
**macOS:** System Preferences → Security & Privacy → Camera
**Linux:** Usually automatic; may need user to be in `video` group

### 4. Test Camera

```bash
python -c "import cv2; cap = cv2.VideoCapture(0); print('Camera OK' if cap.isOpened() else 'Camera not found')"
```

### 5. Project Structure

```
backend/app/gesture/
├── __init__.py           # Module exports
├── detector.py           # MediaPipe hand tracking
└── mapper.py             # Gesture to action mapping
```

### 6. Start Gesture Detection

**Via API:**
```bash
# Start with camera preview
curl -X POST "http://localhost:8000/api/gesture/start?show_preview=true"

# Check status
curl http://localhost:8000/api/gesture/status

# Stop detection
curl -X POST http://localhost:8000/api/gesture/stop
```

**Via Python:**
```python
from app.gesture import get_gesture_controller, GestureContext

controller = get_gesture_controller()
controller.start(show_preview=True)

# Change context based on current UI
controller.set_context(GestureContext.SIMULATION_RUNNING)

# Process frames (in a loop)
while controller.running:
    command = await controller.get_next_command(timeout=0.1)
    if command:
        await handle_command(command)
```

### 7. Supported Gestures

| Gesture | Description | Detection |
|---------|-------------|-----------|
| **Pinch** | Thumb + index finger tips touch | Distance < 0.05 |
| **Swipe** | Index finger extended, quick movement | Velocity > 0.5 |
| **Rotate** | Wrist rotation while palm visible | Angle > 15° |
| **Open Palm** | All 5 fingers extended | All extended |
| **Fist** | All fingers closed | None extended |
| **Point** | Only index finger extended | 1 extended |
| **Thumbs Up** | Thumb up, others closed | Thumb above wrist |
| **Thumbs Down** | Thumb down, others closed | Thumb below wrist |

### 8. Gesture Contexts

Different UI states use different gesture mappings:

**Default Context:**
- Pinch → Confirm selection
- Swipe → Navigate
- Open palm → Emergency stop
- Thumbs up → Start simulation

**Simulation Running Context:**
- Swipe up → Increase throttle
- Swipe down → Decrease throttle
- Open palm → Emergency stop
- Fist → Pause simulation

**Component Selection Context:**
- Pinch → Select component
- Swipe left/right → Browse components
- Rotate → Rotate 3D view

**Parameter Adjustment Context:**
- Swipe up/down → Increase/decrease value
- Pinch → Select parameter
- Thumbs up → Confirm value

### 9. Set Context via API

```bash
curl -X POST http://localhost:8000/api/gesture/context \
  -H "Content-Type: application/json" \
  -d '{"context": "simulation_running"}'
```

### 10. View Camera Stream (Debug)

Open in browser: http://localhost:8000/api/gesture/stream

Shows annotated video feed with detected landmarks and gestures.

### 11. Get Available Mappings

```bash
curl "http://localhost:8000/api/gesture/mappings?context=simulation_running"
```

### 12. Tips for Best Recognition

- **Lighting**: Even, frontal lighting works best
- **Background**: Solid, contrasting background
- **Distance**: 0.5-1m from camera
- **Speed**: Medium speed for swipes (not too fast)
- **Clarity**: Keep fingers clearly separated for extended detection

---

## Troubleshooting

### Backend won't start

1. Check Python version: `python --version` (need 3.11+)
2. Reinstall dependencies: `pip install -r requirements.txt --force-reinstall`
3. Check port availability: `netstat -an | grep 8000`

### CORS errors in browser

Add your frontend URL to `CORS_ORIGINS` in `.env`:
```env
CORS_ORIGINS=["http://localhost:3000", "http://your-domain.com"]
```

### Socket.IO connection fails

1. Verify backend is running
2. Check firewall settings
3. Try different browser
4. Check console for specific errors

### Unity WebSocket disconnect

1. Ensure backend URL is correct in Unity settings
2. Check for firewall blocking
3. Verify Socket.IO compatibility

### Tests fail

1. Run with verbose output: `pytest -v`
2. Check for missing dependencies
3. Ensure no other instance running on same port

---

## Production Deployment

### Using Docker (Recommended)

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY backend/ .
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8000
CMD ["python", "run.py", "--host", "0.0.0.0"]
```

```bash
docker build -t drone-backend .
docker run -p 8000:8000 drone-backend
```

### Using systemd (Linux)

```ini
# /etc/systemd/system/drone-backend.service
[Unit]
Description=Drone Simulation Backend
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/drone/backend
ExecStart=/opt/drone/backend/venv/bin/python run.py
Restart=always

[Install]
WantedBy=multi-user.target
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## Next Steps

After completing Phase 1 setup:

1. Explore the API at `/docs`
2. Test with the sample configuration
3. Create your own drone configurations
4. Proceed to Phase 2 (Unity) when available

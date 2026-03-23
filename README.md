# Drone Design & Failure Prediction System

## Overview

A production-level tethered window-cleaning drone simulation system with:
- Real-time physics simulation (thrust, drag, wind, tether forces)
- Stability analysis and failure prediction
- Professional engineering dashboard
- Gesture control interface using MediaPipe
- Socket.IO real-time communication

## System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                           ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    Socket.IO    ┌─────────────────────────┐   │
│  │   Next.js   │◄───────────────►│    Python Backend       │   │
│  │  Dashboard  │    REST API     │      (FastAPI)          │   │
│  └─────────────┘                 │                         │   │
│                                  │  - Physics Engine       │   │
│  ┌─────────────┐    Socket.IO    │  - Stability Analysis   │   │
│  │    Unity    │◄───────────────►│  - Failure Prediction   │   │
│  │  Simulation │                 │                         │   │
│  └─────────────┘                 │  ┌───────────────────┐  │   │
│                                  │  │ Gesture Control   │  │   │
│       ┌─────────┐               │  │ (MediaPipe)       │  │   │
│       │ Webcam  │──────────────►│  └───────────────────┘  │   │
│       └─────────┘               └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Backend (Python)

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/macOS
pip install -r requirements.txt
python run.py
```

API available at: http://localhost:8000/docs

### 2. Dashboard (Next.js)

```bash
cd dashboard
npm install
npm run dev
```

Dashboard available at: http://localhost:3000

### 3. Unity Simulation

Open `unity/DroneSimulator` in Unity 2022.3 LTS

### 4. Gesture Control

```bash
# Start gesture detection (requires webcam)
curl -X POST "http://localhost:8000/api/gesture/start?show_preview=true"
```

## Project Structure

```
drone/
├── backend/              # Python FastAPI backend
│   ├── app/
│   │   ├── physics/      # Physics simulation modules
│   │   │   ├── engine.py      # Main physics orchestrator
│   │   │   ├── thrust.py      # Motor thrust calculations
│   │   │   ├── drag.py        # Aerodynamic drag
│   │   │   ├── wind.py        # Wind force simulation
│   │   │   ├── tether.py      # Spring-damper tether
│   │   │   └── stability.py   # Stability analysis
│   │   ├── models/       # Pydantic data models
│   │   ├── api/          # REST & WebSocket handlers
│   │   └── gesture/      # MediaPipe gesture recognition
│   │       ├── detector.py    # Hand tracking
│   │       └── mapper.py      # Gesture to action mapping
│   └── tests/
├── dashboard/            # Next.js frontend
│   └── src/
│       ├── app/          # Main pages
│       ├── components/   # React components
│       ├── hooks/        # Socket.IO hooks
│       └── store/        # Zustand state management
├── unity/                # Unity simulation
│   └── DroneSimulator/
│       └── Assets/
│           └── Scripts/
│               ├── Drone/     # Drone physics
│               ├── Physics/   # Wind, stability
│               └── Network/   # Socket.IO client
└── docs/                 # Documentation
```

## Implementation Phases

- [x] **Phase 1**: Core Physics Engine (Python) - Complete
  - Thrust, drag, wind, tether calculations
  - Stability analysis and scoring
  - REST API and Socket.IO

- [x] **Phase 2**: Unity Simulation Foundation - Complete
  - Rigidbody-based physics
  - Motor and propeller controllers
  - Network synchronization

- [x] **Phase 3**: Advanced Physics - Complete
  - Perlin noise wind turbulence
  - Spring-damper tether physics
  - Real-time stability scoring

- [x] **Phase 4**: Next.js Dashboard - Complete
  - Component selector
  - Real-time metrics and graphs
  - Simulation controls

- [x] **Phase 5**: Gesture Control - Complete
  - MediaPipe hand tracking
  - Gesture to action mapping
  - Context-aware gestures

- [x] **Phase 6**: Integration & Optimization - Complete
  - API documentation
  - Test suites
  - Setup documentation

## Features

### Physics Simulation
- **Thrust**: `T = k_t × ω² × (ρ / ρ₀)` with altitude density correction
- **Drag**: `F_d = ½ × ρ × v² × C_d × A` for aerodynamic forces
- **Wind**: Perlin noise turbulence with gusts and wind shear
- **Tether**: Spring-damper model `F = -k×x - c×v` with break detection

### Stability Analysis
- 0-100 stability score
- Stability classification (Stable/Marginal/Unstable/Critical)
- Center of mass tracking
- Control authority estimation
- Warning and critical issue detection

### Gesture Controls
| Gesture | Default Action |
|---------|---------------|
| Pinch | Confirm/Select |
| Swipe Up | Throttle up / Increase |
| Swipe Down | Throttle down / Decrease |
| Open Palm | Emergency stop |
| Thumbs Up | Start simulation |
| Thumbs Down | Stop simulation |
| Fist | Pause / Reset view |
| Rotate | Rotate 3D view |

## Documentation

- [Setup Guide](./docs/SETUP.md) - Installation and configuration
- [API Reference](./docs/API.md) - REST and Socket.IO endpoints
- [Physics Models](./docs/PHYSICS.md) - Mathematical models used

## Requirements

- Python 3.11+
- Node.js 18+
- Unity 2022.3 LTS
- Webcam (for gesture control)

## License

MIT

# Drone Builder & Simulation IDE

## Overview

A production-grade, enterprise-level cloud-based Drone Builder & Simulation IDE with:
- Real-time physics simulation (thrust, drag, wind, tether forces)
- 3D drone visualization with Three.js
- Modular drone builder with drag-and-drop components
- Stability analysis and failure prediction
- Professional engineering dashboard
- JWT authentication with SMTP email verification
- Gesture control interface using MediaPipe
- Socket.IO real-time communication
- Unity engine integration for advanced simulation

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (Dashboard)                          │
│                     Next.js 14 + Three.js + React                   │
│                           Port: 3000                                 │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         │ REST API + WebSocket
                         ▼
┌────────────────────────────────────────────────────────────────────┐
│                     Node.js Backend                                  │
│              Express + Socket.IO + PostgreSQL                        │
│                      Port: 3001                                      │
│  - Authentication (JWT + Refresh Tokens)                            │
│  - User/Drone/Component CRUD                                        │
│  - SMTP Email Verification                                          │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         │ HTTP Proxy + WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Python Physics Engine                             │
│                  FastAPI + NumPy + MediaPipe                         │
│                         Port: 8000                                   │
│  - Advanced Physics Simulation                                       │
│  - Stability Analysis                                                │
│  - Gesture Control                                                   │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         │ WebSocket (Socket.IO)
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Unity Simulation                              │
│                  Unity 6.2 + C# + Physics                           │
│                     (Visual Simulation Client)                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14, React 18, Three.js, Tailwind CSS |
| 3D Rendering | @react-three/fiber, @react-three/drei |
| State Management | Zustand, React Context |
| Node Backend | Express.js, Socket.IO, pg-promise |
| Python Backend | FastAPI, NumPy, SciPy |
| Gesture Control | MediaPipe, OpenCV |
| Game Engine | Unity 6.2 (6000.2.2f1) |
| Database | PostgreSQL |
| Authentication | JWT + Refresh Tokens, Nodemailer |

## Quick Start

### Prerequisites

- Node.js 18+ & npm
- Python 3.10+
- PostgreSQL 14+
- Unity 6.2 (optional, for visual simulation)

### 1. Database Setup

```bash
# Create PostgreSQL database
createdb drone_simulation

# Or using psql
psql -U postgres -c "CREATE DATABASE drone_simulation;"
```

### 2. Node.js Backend

```bash
cd backend-node

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Initialize database schema
npm run db:init

# Seed with sample data
npm run db:seed

# Start server
npm run dev
```

Server runs on `http://localhost:3001`

### 3. Python Physics Engine

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/macOS
pip install -r requirements.txt
python run.py
```

Physics API available at: http://localhost:8000/docs

### 4. Dashboard (Next.js)

```bash
cd dashboard
npm install
cp .env.example .env.local
npm run dev
```

Dashboard available at: http://localhost:3000

### 5. Unity Simulation (Optional)

1. Open `unity/DroneSimulator` in Unity 6.2
2. Open the `MainScene` scene
3. Press Play - automatically connects to physics engine

### 6. Gesture Control

```bash
# Start gesture detection (requires webcam)
curl -X POST "http://localhost:8000/api/gesture/start?show_preview=true"
```

## Project Structure

```
drone/
├── backend-node/             # Node.js API server
│   ├── src/
│   │   ├── config/           # Configuration files
│   │   ├── database/         # PostgreSQL schema & seeds
│   │   │   ├── schema.ts     # 6 tables with triggers
│   │   │   └── seed.ts       # Sample data
│   │   ├── middleware/       # Auth & validation
│   │   ├── models/           # TypeScript interfaces
│   │   ├── routes/           # REST API routes
│   │   ├── services/         # Business logic
│   │   ├── websocket/        # Socket.IO handlers
│   │   └── tests/            # Jest tests
│   └── package.json
│
├── backend/                  # Python physics engine
│   ├── app/
│   │   ├── physics/          # Physics simulation modules
│   │   │   ├── engine.py     # Main physics orchestrator
│   │   │   ├── thrust.py     # Motor thrust calculations
│   │   │   ├── drag.py       # Aerodynamic drag
│   │   │   ├── wind.py       # Wind force simulation
│   │   │   ├── tether.py     # Spring-damper tether
│   │   │   └── stability.py  # Stability analysis
│   │   ├── models/           # Pydantic data models
│   │   ├── api/              # REST & WebSocket handlers
│   │   └── gesture/          # MediaPipe gesture recognition
│   │       ├── detector.py   # Hand tracking
│   │       └── mapper.py     # Gesture to action mapping
│   └── tests/
│
├── dashboard/                # Next.js frontend
│   └── src/
│       ├── app/              # App Router pages
│       │   ├── page.tsx      # Landing page
│       │   ├── builder/      # Drone builder
│       │   ├── simulation/   # Real-time simulation
│       │   ├── login/        # Auth pages
│       │   └── register/
│       ├── components/       # React components
│       │   ├── three/        # Three.js components
│       │   │   └── DroneViewer.tsx
│       │   └── builder/      # Builder components
│       ├── contexts/         # React contexts
│       ├── hooks/            # Custom hooks
│       │   └── useSocket.ts  # Socket.IO hook
│       ├── lib/              # Utilities & types
│       ├── services/         # API client
│       └── store/            # Zustand state
│
├── unity/                    # Unity simulation
│   └── DroneSimulator/
│       └── Assets/
│           └── Scripts/
│               ├── Drone/    # Drone physics
│               ├── Physics/  # Wind, stability
│               └── Network/  # Socket.IO client
└── docs/                     # Documentation
```

## Implementation Phases

- [x] **Phase 1**: Node.js Backend with Auth/API
  - JWT authentication with refresh tokens
  - SMTP email verification via Nodemailer
  - PostgreSQL database with 6 tables
  - Full REST API for components, drones, users

- [x] **Phase 2**: Next.js Dashboard with Three.js
  - 3D drone visualization with Three.js
  - Drag-and-drop component builder
  - Real-time metrics panels
  - Authentication pages

- [x] **Phase 3**: Python Physics Engine
  - Thrust, drag, wind, tether calculations
  - Stability analysis and scoring
  - REST API and Socket.IO

- [x] **Phase 4**: Unity Simulation Integration
  - Rigidbody-based physics
  - Motor and propeller controllers
  - Network synchronization via Socket.IO

- [x] **Phase 5**: Real-Time Data Loop
  - Socket.IO real-time state updates
  - Live metrics and graphs
  - Bidirectional sync between components

- [x] **Phase 6**: Gesture Control
  - MediaPipe hand tracking
  - 12+ recognized gestures
  - Context-aware gesture mapping

- [x] **Phase 7**: Optimization & Polish
  - Comprehensive documentation
  - Environment configurations
  - Production-ready codebase

## API Endpoints

### Node.js Backend (Port 3001)

#### Authentication
```
POST /api/auth/register    - Create new account
POST /api/auth/login       - Get JWT tokens
POST /api/auth/refresh     - Refresh access token
POST /api/auth/logout      - Invalidate tokens
GET  /api/auth/me          - Get current user
```

#### Components
```
GET  /api/components       - List all components
GET  /api/components/:id   - Get component by ID
POST /api/components       - Create component (admin)
```

#### Drones
```
GET  /api/drones           - List user's drones
POST /api/drones           - Create new drone
GET  /api/drones/:id       - Get drone details
PUT  /api/drones/:id       - Update drone
DELETE /api/drones/:id     - Delete drone
```

### Python Physics Engine (Port 8000)

```
POST /api/simulate         - Run physics simulation
POST /api/validate         - Validate configuration
GET  /api/health           - Health check
POST /api/gesture/start    - Start gesture detection
POST /api/gesture/stop     - Stop gesture detection
GET  /api/gesture/status   - Get gesture status
```

### WebSocket Events (Socket.IO)

```
# Client -> Server
start_simulation    - Start real-time simulation
stop_simulation     - Stop simulation
update_throttles    - Update motor throttles
set_wind            - Update wind parameters
gesture_command     - Send gesture command

# Server -> Client
simulation_state    - Real-time state update (50Hz)
simulation_started  - Confirmation
simulation_stopped  - Confirmation
error               - Error message
```

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

- Node.js 18+
- Python 3.10+
- PostgreSQL 14+
- Unity 6.2 (optional, for visual simulation)
- Webcam (optional, for gesture control)

## License

MIT

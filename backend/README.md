# Drone Design & Failure Prediction System - Backend

Physics simulation backend for the tethered window-cleaning drone system.

## Features

- **Physics Engine**: Complete physics simulation including thrust, drag, wind, and tether forces
- **Stability Analysis**: Real-time stability scoring and failure prediction
- **REST API**: Full REST API for simulation and validation
- **Socket.IO**: Real-time simulation streaming for live dashboards
- **Modular Design**: Easily extensible component system

## Quick Start

### Prerequisites

- Python 3.11+
- pip

### Installation

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Running the Server

```bash
# Development mode with auto-reload
python run.py --reload

# Or directly with uvicorn
uvicorn app.main:socketio_app --host 0.0.0.0 --port 8000 --reload
```

### API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/simulate` | POST | Run full simulation |
| `/api/validate` | POST | Validate configuration |
| `/api/quick-analysis` | POST | Get instant metrics |
| `/api/components` | GET | List component schema |
| `/api/sample-config` | GET | Get sample drone config |

### Socket.IO Events

**Client → Server:**
- `start_simulation` - Start simulation with config
- `stop_simulation` - Stop current simulation
- `update_throttles` - Update motor throttles
- `set_wind` - Update wind parameters
- `gesture_command` - Handle gesture input

**Server → Client:**
- `simulation_state` - Real-time state updates
- `simulation_started` - Confirmation
- `simulation_stopped` - Confirmation
- `error` - Error notification

## Example Usage

### Validate a Configuration

```python
import requests

config = {
    "id": "my_drone",
    "name": "My Quadcopter",
    "motors": [...],  # 4 motors
    "propellers": [...],  # 4 propellers
    "battery": {...},
    "frame": {...}
}

response = requests.post(
    "http://localhost:8000/api/validate",
    json=config
)
print(response.json())
```

### Real-time Simulation with Socket.IO

```python
import socketio

sio = socketio.Client()

@sio.on('simulation_state')
def on_state(data):
    print(f"Position: {data['state']['position']}")
    print(f"Stability: {data['stability']['stability_score']}")

sio.connect('http://localhost:8000')
sio.emit('start_simulation', {
    'config': {...},
    'update_rate': 50
})
```

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration
│   ├── physics/
│   │   ├── engine.py        # Main physics orchestrator
│   │   ├── thrust.py        # Thrust calculations
│   │   ├── drag.py          # Drag calculations
│   │   ├── wind.py          # Wind simulation
│   │   ├── tether.py        # Tether physics
│   │   └── stability.py     # Stability analysis
│   ├── models/
│   │   ├── drone.py         # Drone component models
│   │   ├── simulation.py    # Simulation state models
│   │   └── responses.py     # API response models
│   └── api/
│       ├── routes.py        # REST endpoints
│       └── websocket.py     # Socket.IO handlers
├── tests/
│   ├── test_physics.py
│   └── test_api.py
├── requirements.txt
└── run.py
```

## Running Tests

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_physics.py

# Run with coverage
pytest --cov=app
```

## Physics Models

### Thrust Model
```
T = k_t * omega^2 * (rho / rho_0)
```

### Drag Model
```
F_d = 0.5 * rho * v^2 * C_d * A
```

### Tether Model (Spring-Damper)
```
F = -k * x - c * v
```

### Stability Score
Composite score (0-100) based on:
- Tilt angle penalty
- Torque imbalance
- Oscillation detection
- Control authority

## Configuration

Environment variables (or `.env` file):

```env
HOST=0.0.0.0
PORT=8000
DEBUG=True
CORS_ORIGINS=["http://localhost:3000"]
```

## Custom Components

The system uses a schema-based approach for components. See `/api/components` for the required fields. Populate your own component database by extending the models.

## License

MIT

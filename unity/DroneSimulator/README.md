# Drone Simulator - Unity Project

3D drone simulation with physics-based flight dynamics.

## Requirements

- Unity 2022.3 LTS or newer
- .NET Standard 2.1

## Setup

1. Open Unity Hub
2. Click "Add" → "Add project from disk"
3. Navigate to `unity/DroneSimulator`
4. Open the project

## Scene Setup

To create a working scene:

1. Create a new scene (File → New Scene)
2. Create an empty GameObject named "Drone"
3. Add components to "Drone":
   - `DroneController`
   - `StabilitySystem`
   - `DroneInputController`
   - `SocketIOClient`
   - `SimulationSync`
   - `DebugOverlay`
   - `Rigidbody` (auto-added)

4. Create 4 child objects for motors:
   - Position at: (0.15, 0, 0.15), (-0.15, 0, 0.15), (-0.15, 0, -0.15), (0.15, 0, -0.15)
   - Add `MotorController` to each
   - Set rotation directions: CW, CCW, CW, CCW

5. Create "WindSimulator" object:
   - Add `WindSimulator` component

6. (Optional) Create "Tether" as child of Drone:
   - Add `TetherController` component
   - Create anchor point at (0, 0, 0)

## Quick Prefab Setup

```
Drone (DroneController, StabilitySystem, Rigidbody)
├── Motor_FR (MotorController) @ (0.15, 0, 0.15)
├── Motor_FL (MotorController) @ (-0.15, 0, 0.15)
├── Motor_RL (MotorController) @ (-0.15, 0, -0.15)
├── Motor_RR (MotorController) @ (0.15, 0, -0.15)
└── TetherAttachment (TetherController)
```

## Controls

| Key | Action |
|-----|--------|
| W/S | Pitch Forward/Back |
| A/D | Roll Left/Right |
| Q/E | Yaw Left/Right |
| Space | Throttle Up |
| Left Shift | Throttle Down |
| R | Reset Drone |
| F1 | Toggle Debug UI |

## Scripts Overview

### Drone/
- `DroneController.cs` - Main orchestrator
- `MotorController.cs` - Individual motor control
- `TetherController.cs` - Tether physics
- `DroneInputController.cs` - Keyboard input

### Physics/
- `WindSimulator.cs` - Wind with turbulence
- `StabilitySystem.cs` - Stability analysis

### Network/
- `SocketIOClient.cs` - Socket.IO client
- `SimulationSync.cs` - Backend synchronization

### UI/
- `DebugOverlay.cs` - Debug display

## Backend Connection

1. Start the Python backend:
   ```bash
   cd backend
   python run.py
   ```

2. In Unity, the `SocketIOClient` will auto-connect to `http://localhost:8000`

3. Use the Network panel in debug UI to control simulation

## Sync Modes

- **SendOnly**: Unity sends state to backend
- **ReceiveOnly**: Backend drives Unity physics
- **Bidirectional**: Both directions (comparison mode)

## Physics Parameters

Key values to tune in `DroneController`:
- `totalMass`: 1.5 kg default
- `maxThrustPerMotor`: 10 N default
- `dragCoefficient`: 1.0 default
- `stabilizationStrength`: 5.0 default

## Troubleshooting

**Drone flips immediately:**
- Check motor rotation directions (should alternate CW/CCW)
- Verify motor positions are correct

**Can't connect to backend:**
- Ensure Python server is running on port 8000
- Check firewall settings
- Verify CORS settings in backend

**Unstable flight:**
- Increase `stabilizationStrength`
- Check thrust-to-weight ratio (should be > 1.5)

## Performance Tips

- Use FixedUpdate for physics (50 Hz)
- Disable `showForceGizmos` in builds
- Reduce line renderer segments for tether

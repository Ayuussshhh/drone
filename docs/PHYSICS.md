# Physics Models

This document describes the physics models used in the drone simulation.

## Coordinate System

- **X**: Right (positive)
- **Y**: Up (positive)
- **Z**: Forward (positive)
- Uses right-hand coordinate system

---

## Thrust Model

### Motor Thrust

```
T = k_t × ω² × (ρ / ρ₀)
```

Where:
- `T` = Thrust (N)
- `k_t` = Thrust constant (N/(rad/s)²)
- `ω` = Angular velocity (rad/s)
- `ρ` = Current air density (kg/m³)
- `ρ₀` = Sea level air density (1.225 kg/m³)

### RPM to Angular Velocity

```
ω = RPM × (2π / 60)
```

### Throttle to RPM

```
RPM = RPM_min + throttle × (RPM_max - RPM_min)
```

### Motor Torque (Reaction)

```
Q = C_p × ρ × n² × D⁵ × direction
```

Where:
- `Q` = Torque (N·m)
- `C_p` = Power coefficient
- `n` = Revolutions per second
- `D` = Propeller diameter (m)
- `direction` = ±1 (CW/CCW)

---

## Drag Model

### Aerodynamic Drag

```
F_d = ½ × ρ × v² × C_d × A
```

Where:
- `F_d` = Drag force (N)
- `ρ` = Air density (kg/m³)
- `v` = Velocity relative to air (m/s)
- `C_d` = Drag coefficient
- `A` = Reference area (m²)

### Typical Drag Coefficients

| Shape | C_d |
|-------|-----|
| Sphere | 0.47 |
| Cube | 1.05 |
| Flat plate | 1.28 |
| Quadcopter | 1.0 |
| Streamlined | 0.04 |

### Induced Drag

```
D_i = T × V / (2 × v_induced)
```

Where `v_induced = √(T / (2 × ρ × A))`

---

## Wind Model

### Steady Wind

```
F_wind = ½ × ρ × v_wind² × C_d × A × direction
```

### Wind Shear (Altitude Effect)

```
v(h) = v_ref × (h / h_ref)^α
```

Where:
- `h` = Altitude (m)
- `h_ref` = Reference altitude (typically 10m)
- `α` = Shear exponent (0.143 for open terrain)

### Turbulence

Modeled using Perlin noise:

```
v_turbulence = intensity × base_speed × perlin(t, position)
```

### Gusts

Random discrete events with:
- Probability per second
- Magnitude factor (relative to base wind)
- Duration with ramp-up/ramp-down envelope

---

## Tether Model

### Spring-Damper System

```
F = -k × x - c × v
```

Where:
- `F` = Tether force (N)
- `k` = Stiffness (N/m)
- `x` = Extension beyond natural length (m)
- `c` = Damping coefficient (N·s/m)
- `v` = Rate of extension (m/s)

### Tether States

1. **Slack**: `current_length < natural_length` → No force
2. **Taut**: `current_length ≥ natural_length` → Spring-damper force
3. **Broken**: `tension > breaking_strength`

### Tether Drag

```
F_tether_drag = ½ × ρ × v_perp² × C_d × (diameter × length)
```

### Pendulum Frequency

```
f = (1/2π) × √(g/L)
```

---

## Stability Analysis

### Tilt Angle

```
θ_total = √(roll² + pitch²)
```

### Stability Score (0-100)

Computed from:

```
score = 100.0
score -= tilt_penalty         (max 40)
score -= torque_penalty       (max 20)
score -= oscillation_penalty  (max 20)
score += authority_bonus      (±10)
score -= com_offset_penalty   (max 10)
```

### Stability Classification

| Score | Class |
|-------|-------|
| 80-100 | Stable |
| 50-79 | Marginal |
| 20-49 | Unstable |
| 0-19 | Critical |

### Control Authority

Estimated percentage of available control:

- **Altitude**: Based on thrust-to-weight ratio
- **Roll/Pitch**: Based on TWR and current tilt
- **Yaw**: Based on motor torque differential

---

## Integration Method

Uses Euler integration:

```
v(t+dt) = v(t) + a(t) × dt
x(t+dt) = x(t) + v(t) × dt
```

Default timestep: 0.02s (50 Hz)

### Sanity Limits

- Max velocity: 50 m/s
- Max acceleration: 100 m/s²
- Ground level: 0 m

---

## Units Summary

| Quantity | Unit |
|----------|------|
| Mass | kg |
| Length | m |
| Time | s |
| Force | N |
| Torque | N·m |
| Velocity | m/s |
| Acceleration | m/s² |
| Angular velocity | rad/s |
| Angle | radians (internal), degrees (API) |
| Power | W |
| Energy | Wh |

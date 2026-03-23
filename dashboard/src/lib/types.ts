/**
 * TypeScript type definitions for the Drone Simulation Dashboard.
 * Matches the Python backend Pydantic models.
 */

// ============== Vector Types ==============

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

// ============== Component Types ==============

export type MotorType = 'brushless' | 'brushed';
export type PropellerType = '2-blade' | '3-blade' | '4-blade';
export type BatteryType = 'LiPo' | 'Li-Ion' | 'LiHV';
export type FrameType = 'quad_x' | 'quad_plus' | 'hexa' | 'octo';
export type TetherType = 'steel' | 'synthetic' | 'power';

export interface Motor {
  id: string;
  name: string;
  motor_type: MotorType;
  mass: number;
  kv_rating: number;
  thrust_constant: number;
  max_rpm: number;
  min_rpm?: number;
  max_current: number;
  resistance?: number;
  efficiency?: number;
  position: Vector3;
  rotation_direction: 1 | -1;
}

export interface Propeller {
  id: string;
  name: string;
  diameter: number;
  pitch: number;
  mass: number;
  blade_count: PropellerType;
  thrust_coefficient?: number;
  power_coefficient?: number;
  drag_coefficient?: number;
}

export interface Battery {
  id: string;
  name: string;
  battery_type: BatteryType;
  cell_count: number;
  capacity_mah: number;
  mass: number;
  voltage_per_cell?: number;
  max_discharge_rate: number;
  internal_resistance?: number;
}

export interface Frame {
  id: string;
  name: string;
  frame_type: FrameType;
  mass: number;
  arm_length: number;
  diagonal_distance: number;
  frontal_area: number;
  drag_coefficient?: number;
  com_offset?: Vector3;
}

export interface Payload {
  id: string;
  name: string;
  mass: number;
  position?: Vector3;
  frontal_area?: number;
  drag_coefficient?: number;
}

export interface Tether {
  id: string;
  name: string;
  tether_type: TetherType;
  length: number;
  mass_per_meter: number;
  diameter: number;
  stiffness: number;
  damping?: number;
  breaking_strength: number;
  drag_coefficient?: number;
  attachment_point?: Vector3;
  anchor_point?: Vector3;
}

export interface DroneConfiguration {
  id: string;
  name: string;
  motors: Motor[];
  propellers: Propeller[];
  battery: Battery;
  frame: Frame;
  payload?: Payload;
  tether?: Tether;
}

// ============== Simulation Types ==============

export type FlightStatus = 'grounded' | 'flying' | 'hovering' | 'unstable' | 'crashed';
export type SimulationStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';
export type StabilityClass = 'stable' | 'marginal' | 'unstable' | 'critical';

export interface SimulationParameters {
  timestep?: number;
  max_duration?: number;
  wind_velocity?: Vector3;
  wind_turbulence?: number;
  air_density?: number;
  motor_throttles?: number[];
  target_position?: Vector3;
  target_altitude?: number;
  use_auto_stabilization?: boolean;
  enable_tether?: boolean;
  enable_wind?: boolean;
}

export interface SimulationState {
  timestamp: number;
  position: Vector3;
  velocity: Vector3;
  acceleration: Vector3;
  rotation: Vector3;
  angular_velocity: Vector3;
  net_force: Vector3;
  net_torque: Vector3;
  motor_rpms: number[];
  motor_thrusts: number[];
  tether_tension: number;
  tether_angle: number;
  battery_voltage: number;
  battery_percentage: number;
  power_consumption: number;
  flight_status: FlightStatus;
  status_message: string;
  altitude: number;
  ground_speed: number;
  air_speed: number;
}

// ============== Metrics Types ==============

export interface PhysicsMetrics {
  total_thrust: number;
  thrust_per_motor: number[];
  thrust_to_weight_ratio: number;
  total_weight: number;
  total_mass: number;
  drag_force: number;
  drag_coefficient: number;
  wind_force: Vector3;
  wind_speed: number;
  tether_tension: number;
  tether_angle: number;
  power_consumption: number;
  estimated_flight_time: number;
}

export interface StabilityReport {
  stability_score: number;
  stability_class: StabilityClass;
  com_position: Vector3;
  com_offset_from_center: number;
  net_torque: Vector3;
  torque_imbalance: number;
  current_tilt: number;
  max_safe_tilt: number;
  tilt_margin: number;
  oscillation_amplitude: number;
  oscillation_frequency: number;
  is_oscillating: boolean;
  roll_authority: number;
  pitch_authority: number;
  yaw_authority: number;
  altitude_authority: number;
  warnings: string[];
  critical_issues: string[];
}

// ============== API Response Types ==============

export interface SimulationResponse {
  success: boolean;
  status: 'completed' | 'failed' | 'timeout' | 'error';
  message: string;
  can_fly: boolean;
  flight_status: FlightStatus;
  metrics: PhysicsMetrics;
  stability: StabilityReport;
  result?: SimulationResult;
}

export interface SimulationResult {
  final_state: SimulationState;
  state_history: SimulationState[];
  max_altitude: number;
  max_velocity: number;
  max_acceleration: number;
  flight_duration: number;
  average_tilt_angle: number;
  max_tilt_angle: number;
  total_energy_consumed: number;
  average_power: number;
  outcome: 'success' | 'unstable' | 'crash' | 'timeout';
  outcome_reason: string;
  warnings: string[];
  recommendations: string[];
}

export interface ValidationResponse {
  valid: boolean;
  can_fly: boolean;
  errors: string[];
  warnings: string[];
  total_mass: number;
  max_thrust: number;
  thrust_to_weight_ratio: number;
  min_throttle_to_hover: number;
  max_payload_capacity: number;
  summary: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  active_simulations: number;
}

// ============== Socket.IO Event Types ==============

export interface SocketStateUpdate {
  state: SimulationState;
  metrics: PhysicsMetrics;
  stability: StabilityReport;
}

export interface GestureCommand {
  gesture: 'pinch' | 'swipe' | 'rotate';
  parameters: Record<string, unknown>;
}

// ============== UI State Types ==============

export interface ComponentSelection {
  motor: Motor | null;
  propeller: Propeller | null;
  battery: Battery | null;
  frame: Frame | null;
  payload: Payload | null;
  tether: Tether | null;
}

export interface TimeSeriesDataPoint {
  timestamp: number;
  altitude: number;
  airSpeed: number;
  thrust: number;
  stability: number;
  tetherTension: number;
}

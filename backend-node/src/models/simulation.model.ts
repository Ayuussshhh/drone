/**
 * Simulation Model and Types
 */

import { Vector3 } from './drone-frame.model';

export type SimulationType =
  | 'flight_test'
  | 'stress_test'
  | 'wind_test'
  | 'endurance_test'
  | 'payload_test'
  | 'tether_test';

export type SimulationStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface Simulation {
  id: string;
  user_id: string;
  drone_id: string;
  name?: string;
  simulation_type: SimulationType;
  environment_config: EnvironmentConfig;
  initial_state?: SimulationState;
  settings: SimulationSettings;
  status: SimulationStatus;
  started_at?: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface EnvironmentConfig {
  gravity: number;
  air_density: number;
  wind: {
    velocity: Vector3;
    turbulence: number;
  };
  temperature_celsius: number;
  altitude_base_m: number;
}

export interface SimulationState {
  position: Vector3;
  velocity: Vector3;
  orientation: {
    roll: number;
    pitch: number;
    yaw: number;
  };
  throttles: number[];
}

export interface SimulationSettings {
  duration_seconds: number;
  time_step_ms: number;
  record_interval_ms: number;
  enable_failures: boolean;
  failure_scenarios: string[];
}

export interface CreateSimulationDTO {
  drone_id: string;
  name?: string;
  simulation_type?: SimulationType;
  environment_config?: Partial<EnvironmentConfig>;
  initial_state?: Partial<SimulationState>;
  settings?: Partial<SimulationSettings>;
}

// Simulation Results
export interface SimulationResult {
  id: string;
  simulation_id: string;
  state_history: SimulationStateRecord[];
  summary_metrics: SimulationSummaryMetrics;
  analysis?: SimulationAnalysis;
  events: SimulationEvent[];
  created_at: Date;
}

export interface SimulationStateRecord {
  timestamp: number;
  position: Vector3;
  velocity: Vector3;
  acceleration: Vector3;
  orientation: {
    roll: number;
    pitch: number;
    yaw: number;
  };
  angular_velocity: {
    roll: number;
    pitch: number;
    yaw: number;
  };
  motor_rpms: number[];
  battery_voltage: number;
  power_draw: number;
  tether_tension?: number;
}

export interface SimulationSummaryMetrics {
  max_altitude_m: number;
  max_speed_mps: number;
  total_distance_m: number;
  flight_duration_s: number;
  avg_power_consumption_w: number;
  total_energy_wh: number;
  max_tilt_degrees: number;
  stability_score: number;
  efficiency_score: number;
}

export interface SimulationAnalysis {
  stability_analysis: {
    score: number;
    class: 'stable' | 'marginal' | 'unstable';
    warnings: string[];
    critical_issues: string[];
  };
  failure_predictions: {
    component_type: string;
    probability: number;
    reason: string;
  }[];
  flight_envelope: {
    max_safe_altitude_m: number;
    max_safe_speed_mps: number;
    max_safe_wind_mps: number;
  };
  recommendations: string[];
}

export interface SimulationEvent {
  timestamp: number;
  type: 'info' | 'warning' | 'critical';
  category: 'stability' | 'power' | 'tether' | 'collision' | 'general';
  message: string;
  data?: Record<string, any>;
}

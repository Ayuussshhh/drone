/**
 * API client functions for communicating with the Python backend.
 */

import type {
  DroneConfiguration,
  SimulationParameters,
  SimulationResponse,
  ValidationResponse,
  HealthResponse,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Generic fetch wrapper with error handling.
 */
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `API Error: ${response.status}`);
  }

  return response.json();
}

/**
 * Check API health.
 */
export async function checkHealth(): Promise<HealthResponse> {
  return fetchAPI<HealthResponse>('/api/health');
}

/**
 * Validate a drone configuration.
 */
export async function validateConfiguration(
  config: DroneConfiguration
): Promise<ValidationResponse> {
  return fetchAPI<ValidationResponse>('/api/validate', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

/**
 * Run a full simulation.
 */
export async function runSimulation(
  config: DroneConfiguration,
  parameters?: SimulationParameters
): Promise<SimulationResponse> {
  return fetchAPI<SimulationResponse>('/api/simulate', {
    method: 'POST',
    body: JSON.stringify({
      drone_config: config,
      parameters: parameters || {},
    }),
  });
}

/**
 * Get quick analysis (instant metrics without full simulation).
 */
export async function quickAnalysis(
  config: DroneConfiguration
): Promise<{
  can_fly: boolean;
  hover_throttle_percent: number;
  metrics: unknown;
  stability: unknown;
  flight_envelope: unknown;
}> {
  return fetchAPI('/api/quick-analysis', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

/**
 * Get sample drone configuration.
 */
export async function getSampleConfiguration(): Promise<DroneConfiguration> {
  return fetchAPI<DroneConfiguration>('/api/sample-config');
}

/**
 * Get component schema templates.
 */
export async function getComponentTemplates(): Promise<{
  motors: unknown[];
  propellers: unknown[];
  batteries: unknown[];
  frames: unknown[];
  payloads: unknown[];
  tethers: unknown[];
}> {
  return fetchAPI('/api/components');
}

/**
 * Create a default drone configuration.
 */
export function createDefaultConfiguration(): DroneConfiguration {
  return {
    id: 'custom_drone',
    name: 'Custom Quadcopter',
    motors: [
      {
        id: 'motor_0',
        name: 'Motor 1 (FR)',
        motor_type: 'brushless',
        mass: 0.05,
        kv_rating: 920,
        thrust_constant: 1.5e-5,
        max_rpm: 12000,
        max_current: 20,
        position: { x: 0.15, y: 0, z: 0.15 },
        rotation_direction: 1,
      },
      {
        id: 'motor_1',
        name: 'Motor 2 (FL)',
        motor_type: 'brushless',
        mass: 0.05,
        kv_rating: 920,
        thrust_constant: 1.5e-5,
        max_rpm: 12000,
        max_current: 20,
        position: { x: -0.15, y: 0, z: 0.15 },
        rotation_direction: -1,
      },
      {
        id: 'motor_2',
        name: 'Motor 3 (RL)',
        motor_type: 'brushless',
        mass: 0.05,
        kv_rating: 920,
        thrust_constant: 1.5e-5,
        max_rpm: 12000,
        max_current: 20,
        position: { x: -0.15, y: 0, z: -0.15 },
        rotation_direction: 1,
      },
      {
        id: 'motor_3',
        name: 'Motor 4 (RR)',
        motor_type: 'brushless',
        mass: 0.05,
        kv_rating: 920,
        thrust_constant: 1.5e-5,
        max_rpm: 12000,
        max_current: 20,
        position: { x: 0.15, y: 0, z: -0.15 },
        rotation_direction: -1,
      },
    ],
    propellers: [
      { id: 'prop_0', name: '10x4.5 Prop', diameter: 0.254, pitch: 0.114, mass: 0.015, blade_count: '2-blade' },
      { id: 'prop_1', name: '10x4.5 Prop', diameter: 0.254, pitch: 0.114, mass: 0.015, blade_count: '2-blade' },
      { id: 'prop_2', name: '10x4.5 Prop', diameter: 0.254, pitch: 0.114, mass: 0.015, blade_count: '2-blade' },
      { id: 'prop_3', name: '10x4.5 Prop', diameter: 0.254, pitch: 0.114, mass: 0.015, blade_count: '2-blade' },
    ],
    battery: {
      id: 'battery_1',
      name: '4S 5000mAh LiPo',
      battery_type: 'LiPo',
      cell_count: 4,
      capacity_mah: 5000,
      mass: 0.5,
      max_discharge_rate: 50,
    },
    frame: {
      id: 'frame_1',
      name: '450mm X-Frame',
      frame_type: 'quad_x',
      mass: 0.3,
      arm_length: 0.225,
      diagonal_distance: 0.45,
      frontal_area: 0.04,
    },
  };
}

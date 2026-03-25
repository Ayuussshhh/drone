/**
 * Physics Service
 * Proxy to Python physics engine
 */

import axios from 'axios';
import config from '../config';
import logger from '../config/logger';
import { DroneConfiguration } from '../models/drone-frame.model';
import { DroneMetrics } from '../models/user-drone.model';
import {
  EnvironmentConfig,
  SimulationState,
  SimulationStateRecord,
} from '../models/simulation.model';

const physicsClient = axios.create({
  baseURL: config.physicsEngineUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
physicsClient.interceptors.request.use(
  (req) => {
    logger.debug('Physics engine request', {
      method: req.method,
      url: req.url,
    });
    return req;
  },
  (error) => {
    logger.error('Physics engine request error', { error: error.message });
    return Promise.reject(error);
  }
);

// Response interceptor for logging
physicsClient.interceptors.response.use(
  (res) => {
    logger.debug('Physics engine response', {
      status: res.status,
      url: res.config.url,
    });
    return res;
  },
  (error) => {
    logger.error('Physics engine response error', {
      message: error.message,
      status: error.response?.status,
    });
    return Promise.reject(error);
  }
);

/**
 * Check if physics engine is available
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await physicsClient.get('/');
    return response.status === 200;
  } catch (error) {
    logger.warn('Physics engine health check failed');
    return false;
  }
}

/**
 * Calculate drone metrics from configuration
 */
export async function calculateDroneMetrics(
  configuration: DroneConfiguration
): Promise<DroneMetrics> {
  try {
    const response = await physicsClient.post('/api/quick-analysis', {
      configuration,
    });

    return response.data.metrics;
  } catch (error: any) {
    logger.error('Failed to calculate drone metrics', { error: error.message });

    // Return default metrics on failure
    return {
      total_weight_grams: 0,
      max_thrust_grams: 0,
      thrust_to_weight_ratio: 0,
      estimated_flight_time_minutes: 0,
      power_consumption_watts: 0,
      center_of_mass: { x: 0, y: 0, z: 0 },
      moment_of_inertia: { xx: 0, yy: 0, zz: 0 },
    };
  }
}

/**
 * Validate drone configuration
 */
export async function validateConfiguration(
  configuration: DroneConfiguration
): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  try {
    const response = await physicsClient.post('/api/validate', {
      configuration,
    });

    return response.data;
  } catch (error: any) {
    logger.error('Failed to validate configuration', { error: error.message });

    return {
      valid: false,
      errors: ['Failed to connect to physics engine'],
      warnings: [],
    };
  }
}

/**
 * Run simulation step
 */
export async function runSimulationStep(
  configuration: DroneConfiguration,
  currentState: SimulationState,
  environment: EnvironmentConfig,
  throttles: number[],
  deltaTime: number
): Promise<SimulationStateRecord> {
  try {
    const response = await physicsClient.post('/api/simulate-step', {
      configuration,
      state: currentState,
      environment,
      throttles,
      delta_time: deltaTime,
    });

    return response.data.state;
  } catch (error: any) {
    logger.error('Failed to run simulation step', { error: error.message });
    throw error;
  }
}

/**
 * Run full simulation
 */
export async function runFullSimulation(
  configuration: DroneConfiguration,
  initialState: SimulationState,
  environment: EnvironmentConfig,
  durationSeconds: number,
  timeStepMs: number
): Promise<{
  stateHistory: SimulationStateRecord[];
  summaryMetrics: any;
}> {
  try {
    const response = await physicsClient.post('/api/simulate', {
      configuration,
      initial_state: initialState,
      environment,
      duration_seconds: durationSeconds,
      time_step_ms: timeStepMs,
    });

    return {
      stateHistory: response.data.state_history,
      summaryMetrics: response.data.summary_metrics,
    };
  } catch (error: any) {
    logger.error('Failed to run full simulation', { error: error.message });
    throw error;
  }
}

/**
 * Calculate thrust for given motor configuration
 */
export async function calculateThrust(motors: any[], throttles: number[]): Promise<number> {
  try {
    const response = await physicsClient.post('/api/calculate-thrust', {
      motors,
      throttles,
    });

    return response.data.total_thrust;
  } catch (error: any) {
    logger.error('Failed to calculate thrust', { error: error.message });
    return 0;
  }
}

/**
 * Calculate stability analysis
 */
export async function analyzeStability(
  configuration: DroneConfiguration,
  state: SimulationState
): Promise<{
  score: number;
  class: 'stable' | 'marginal' | 'unstable';
  warnings: string[];
  critical_issues: string[];
}> {
  try {
    const response = await physicsClient.post('/api/analyze-stability', {
      configuration,
      state,
    });

    return response.data;
  } catch (error: any) {
    logger.error('Failed to analyze stability', { error: error.message });

    return {
      score: 0,
      class: 'unstable',
      warnings: [],
      critical_issues: ['Unable to analyze stability'],
    };
  }
}

/**
 * Get sample drone configuration
 */
export async function getSampleConfiguration(): Promise<any> {
  try {
    const response = await physicsClient.get('/api/sample-config');
    return response.data;
  } catch (error: any) {
    logger.error('Failed to get sample configuration', { error: error.message });
    throw error;
  }
}

export default {
  healthCheck,
  calculateDroneMetrics,
  validateConfiguration,
  runSimulationStep,
  runFullSimulation,
  calculateThrust,
  analyzeStability,
  getSampleConfiguration,
};

/**
 * Simulation Service
 * Manages simulation lifecycle and results
 */

import db from '../database/connection';
import logger from '../config/logger';
import {
  Simulation,
  CreateSimulationDTO,
  SimulationStatus,
  SimulationResult,
  EnvironmentConfig,
  SimulationSettings,
  SimulationState,
} from '../models/simulation.model';
import { PaginationParams, PaginatedResponse } from '../models';
import userDroneService from './user-drone.service';

// Default environment configuration
const DEFAULT_ENVIRONMENT: EnvironmentConfig = {
  gravity: 9.81,
  air_density: 1.225,
  wind: {
    velocity: { x: 0, y: 0, z: 0 },
    turbulence: 0,
  },
  temperature_celsius: 20,
  altitude_base_m: 0,
};

// Default simulation settings
const DEFAULT_SETTINGS: SimulationSettings = {
  duration_seconds: 60,
  time_step_ms: 20,
  record_interval_ms: 100,
  enable_failures: false,
  failure_scenarios: [],
};

// Default initial state
const DEFAULT_INITIAL_STATE: SimulationState = {
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  orientation: { roll: 0, pitch: 0, yaw: 0 },
  throttles: [0.5, 0.5, 0.5, 0.5],
};

/**
 * Get user's simulations
 */
export async function getUserSimulations(
  userId: string,
  pagination: PaginationParams = {}
): Promise<PaginatedResponse<Simulation>> {
  const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' } = pagination;
  const offset = (page - 1) * limit;

  const validSortColumns = ['created_at', 'status', 'simulation_type'];
  const actualSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
  const actualSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countResult = await db.one(
    'SELECT COUNT(*) FROM simulations WHERE user_id = $1',
    [userId]
  );
  const total = parseInt(countResult.count);

  const data = await db.manyOrNone<Simulation>(
    `SELECT s.*, ud.name as drone_name
     FROM simulations s
     JOIN user_drones ud ON s.drone_id = ud.id
     WHERE s.user_id = $1
     ORDER BY s.${actualSortBy} ${actualSortOrder}
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get simulation by ID
 */
export async function getSimulationById(simulationId: string): Promise<Simulation | null> {
  return db.oneOrNone<Simulation>('SELECT * FROM simulations WHERE id = $1', [
    simulationId,
  ]);
}

/**
 * Get simulation with ownership check
 */
export async function getUserSimulationById(
  simulationId: string,
  userId: string
): Promise<Simulation | null> {
  return db.oneOrNone<Simulation>(
    'SELECT * FROM simulations WHERE id = $1 AND user_id = $2',
    [simulationId, userId]
  );
}

/**
 * Create new simulation
 */
export async function createSimulation(
  userId: string,
  data: CreateSimulationDTO
): Promise<Simulation> {
  // Verify drone ownership
  const drone = await userDroneService.getUserDroneById(data.drone_id, userId);
  if (!drone) {
    throw new Error('Drone not found or not owned by user');
  }

  // Merge defaults with provided config
  const environmentConfig = {
    ...DEFAULT_ENVIRONMENT,
    ...data.environment_config,
    wind: {
      ...DEFAULT_ENVIRONMENT.wind,
      ...data.environment_config?.wind,
    },
  };

  const settings = {
    ...DEFAULT_SETTINGS,
    ...data.settings,
  };

  const initialState = {
    ...DEFAULT_INITIAL_STATE,
    ...data.initial_state,
    orientation: {
      ...DEFAULT_INITIAL_STATE.orientation,
      ...data.initial_state?.orientation,
    },
  };

  const simulation = await db.one<Simulation>(
    `INSERT INTO simulations (
      user_id, drone_id, name, simulation_type,
      environment_config, initial_state, settings, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
    RETURNING *`,
    [
      userId,
      data.drone_id,
      data.name || `Simulation ${new Date().toISOString()}`,
      data.simulation_type || 'flight_test',
      JSON.stringify(environmentConfig),
      JSON.stringify(initialState),
      JSON.stringify(settings),
    ]
  );

  logger.info('Simulation created', { simulationId: simulation.id, userId });
  return simulation;
}

/**
 * Update simulation status
 */
export async function updateSimulationStatus(
  simulationId: string,
  status: SimulationStatus
): Promise<Simulation | null> {
  const statusFields: string[] = ['status = $1'];
  const params: any[] = [status];

  if (status === 'running') {
    statusFields.push('started_at = NOW()');
  } else if (['completed', 'failed', 'cancelled'].includes(status)) {
    statusFields.push('completed_at = NOW()');
  }

  params.push(simulationId);

  const simulation = await db.oneOrNone<Simulation>(
    `UPDATE simulations SET ${statusFields.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );

  if (simulation) {
    logger.info('Simulation status updated', { simulationId, status });
  }

  return simulation;
}

/**
 * Save simulation results
 */
export async function saveSimulationResults(
  simulationId: string,
  stateHistory: any[],
  summaryMetrics: any,
  analysis?: any,
  events?: any[]
): Promise<SimulationResult> {
  const result = await db.one<SimulationResult>(
    `INSERT INTO simulation_results (
      simulation_id, state_history, summary_metrics, analysis, events
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [
      simulationId,
      JSON.stringify(stateHistory),
      JSON.stringify(summaryMetrics),
      analysis ? JSON.stringify(analysis) : null,
      JSON.stringify(events || []),
    ]
  );

  // Update simulation as completed
  await updateSimulationStatus(simulationId, 'completed');

  logger.info('Simulation results saved', { simulationId, resultId: result.id });
  return result;
}

/**
 * Get simulation results
 */
export async function getSimulationResults(
  simulationId: string
): Promise<SimulationResult | null> {
  return db.oneOrNone<SimulationResult>(
    'SELECT * FROM simulation_results WHERE simulation_id = $1',
    [simulationId]
  );
}

/**
 * Delete simulation
 */
export async function deleteSimulation(
  simulationId: string,
  userId: string
): Promise<boolean> {
  const result = await db.result(
    'DELETE FROM simulations WHERE id = $1 AND user_id = $2',
    [simulationId, userId]
  );

  if (result.rowCount > 0) {
    logger.info('Simulation deleted', { simulationId, userId });
    return true;
  }

  return false;
}

/**
 * Get simulations for a specific drone
 */
export async function getDroneSimulations(
  droneId: string,
  userId: string
): Promise<Simulation[]> {
  return db.manyOrNone<Simulation>(
    `SELECT * FROM simulations
     WHERE drone_id = $1 AND user_id = $2
     ORDER BY created_at DESC`,
    [droneId, userId]
  );
}

/**
 * Cancel running simulation
 */
export async function cancelSimulation(
  simulationId: string,
  userId: string
): Promise<boolean> {
  const result = await db.result(
    `UPDATE simulations SET status = 'cancelled', completed_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'running', 'paused')`,
    [simulationId, userId]
  );

  if (result.rowCount > 0) {
    logger.info('Simulation cancelled', { simulationId });
    return true;
  }

  return false;
}

export default {
  getUserSimulations,
  getSimulationById,
  getUserSimulationById,
  createSimulation,
  updateSimulationStatus,
  saveSimulationResults,
  getSimulationResults,
  deleteSimulation,
  getDroneSimulations,
  cancelSimulation,
};

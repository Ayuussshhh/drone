/**
 * User Drone Service
 * CRUD operations for user's drone designs
 */

import db from '../database/connection';
import logger from '../config/logger';
import {
  UserDrone,
  CreateUserDroneDTO,
  UpdateUserDroneDTO,
  UserDroneFilter,
  DroneMetrics,
} from '../models/user-drone.model';
import { PaginationParams, PaginatedResponse } from '../models';
import physicsService from './physics.service';

/**
 * Get user's drones
 */
export async function getUserDrones(
  userId: string,
  pagination: PaginationParams = {}
): Promise<PaginatedResponse<UserDrone>> {
  const { page = 1, limit = 20, sortBy = 'updated_at', sortOrder = 'desc' } = pagination;
  const offset = (page - 1) * limit;

  const validSortColumns = ['name', 'created_at', 'updated_at'];
  const actualSortBy = validSortColumns.includes(sortBy) ? sortBy : 'updated_at';
  const actualSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countResult = await db.one(
    'SELECT COUNT(*) FROM user_drones WHERE user_id = $1',
    [userId]
  );
  const total = parseInt(countResult.count);

  const data = await db.manyOrNone<UserDrone>(
    `SELECT * FROM user_drones
     WHERE user_id = $1
     ORDER BY ${actualSortBy} ${actualSortOrder}
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
 * Get public drones (community designs)
 */
export async function getPublicDrones(
  filter: UserDroneFilter = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResponse<UserDrone>> {
  const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' } = pagination;
  const offset = (page - 1) * limit;

  const conditions = ['is_public = true'];
  const params: any[] = [];
  let paramIndex = 1;

  if (filter.search) {
    conditions.push(
      `(LOWER(name) LIKE $${paramIndex} OR LOWER(description) LIKE $${paramIndex})`
    );
    params.push(`%${filter.search.toLowerCase()}%`);
    paramIndex++;
  }

  if (filter.tags && filter.tags.length > 0) {
    conditions.push(`tags && $${paramIndex++}`);
    params.push(filter.tags);
  }

  const whereClause = conditions.join(' AND ');
  const validSortColumns = ['name', 'created_at', 'updated_at'];
  const actualSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
  const actualSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countResult = await db.one(
    `SELECT COUNT(*) FROM user_drones WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.count);

  const data = await db.manyOrNone<UserDrone>(
    `SELECT ud.*, u.username as owner_username
     FROM user_drones ud
     JOIN users u ON ud.user_id = u.id
     WHERE ${whereClause}
     ORDER BY ${actualSortBy} ${actualSortOrder}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
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
 * Get drone by ID
 */
export async function getDroneById(droneId: string): Promise<UserDrone | null> {
  return db.oneOrNone<UserDrone>('SELECT * FROM user_drones WHERE id = $1', [droneId]);
}

/**
 * Get drone by ID with ownership check
 */
export async function getUserDroneById(
  droneId: string,
  userId: string
): Promise<UserDrone | null> {
  return db.oneOrNone<UserDrone>(
    'SELECT * FROM user_drones WHERE id = $1 AND user_id = $2',
    [droneId, userId]
  );
}

/**
 * Create new drone design
 */
export async function createDrone(
  userId: string,
  data: CreateUserDroneDTO
): Promise<UserDrone> {
  // Calculate metrics if configuration is provided
  let calculatedMetrics: DroneMetrics | null = null;

  if (data.configuration) {
    try {
      calculatedMetrics = await physicsService.calculateDroneMetrics(data.configuration);
    } catch (error) {
      logger.warn('Failed to calculate drone metrics', { error });
    }
  }

  const drone = await db.one<UserDrone>(
    `INSERT INTO user_drones (
      user_id, name, description, frame_id, configuration,
      calculated_metrics, is_public, tags
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      userId,
      data.name,
      data.description || null,
      data.frame_id || null,
      JSON.stringify(data.configuration),
      calculatedMetrics ? JSON.stringify(calculatedMetrics) : null,
      data.is_public ?? false,
      data.tags || null,
    ]
  );

  logger.info('User drone created', { droneId: drone.id, userId });
  return drone;
}

/**
 * Update drone design
 */
export async function updateDrone(
  droneId: string,
  userId: string,
  data: UpdateUserDroneDTO
): Promise<UserDrone | null> {
  // Verify ownership
  const existing = await getUserDroneById(droneId, userId);
  if (!existing) {
    return null;
  }

  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    params.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    params.push(data.description);
  }
  if (data.frame_id !== undefined) {
    updates.push(`frame_id = $${paramIndex++}`);
    params.push(data.frame_id);
  }
  if (data.configuration !== undefined) {
    updates.push(`configuration = $${paramIndex++}`);
    params.push(JSON.stringify(data.configuration));

    // Recalculate metrics
    try {
      const metrics = await physicsService.calculateDroneMetrics(data.configuration);
      updates.push(`calculated_metrics = $${paramIndex++}`);
      params.push(JSON.stringify(metrics));
    } catch (error) {
      logger.warn('Failed to calculate drone metrics on update', { error });
    }
  }
  if (data.is_public !== undefined) {
    updates.push(`is_public = $${paramIndex++}`);
    params.push(data.is_public);
  }
  if (data.tags !== undefined) {
    updates.push(`tags = $${paramIndex++}`);
    params.push(data.tags);
  }

  // Increment version
  updates.push(`version = version + 1`);

  if (updates.length === 1) {
    // Only version update, nothing else changed
    return existing;
  }

  params.push(droneId);

  const drone = await db.oneOrNone<UserDrone>(
    `UPDATE user_drones SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  if (drone) {
    logger.info('User drone updated', { droneId, userId });
  }

  return drone;
}

/**
 * Delete drone design
 */
export async function deleteDrone(droneId: string, userId: string): Promise<boolean> {
  const result = await db.result(
    'DELETE FROM user_drones WHERE id = $1 AND user_id = $2',
    [droneId, userId]
  );

  if (result.rowCount > 0) {
    logger.info('User drone deleted', { droneId, userId });
    return true;
  }

  return false;
}

/**
 * Clone a drone (copy public or own design)
 */
export async function cloneDrone(
  droneId: string,
  userId: string,
  newName?: string
): Promise<UserDrone | null> {
  // Get original drone (must be public or owned by user)
  const original = await db.oneOrNone<UserDrone>(
    'SELECT * FROM user_drones WHERE id = $1 AND (is_public = true OR user_id = $2)',
    [droneId, userId]
  );

  if (!original) {
    return null;
  }

  // Create clone
  const clone = await db.one<UserDrone>(
    `INSERT INTO user_drones (
      user_id, name, description, frame_id, configuration,
      calculated_metrics, is_public, tags
    ) VALUES ($1, $2, $3, $4, $5, $6, false, $7)
    RETURNING *`,
    [
      userId,
      newName || `${original.name} (Copy)`,
      original.description,
      original.frame_id,
      JSON.stringify(original.configuration),
      original.calculated_metrics ? JSON.stringify(original.calculated_metrics) : null,
      original.tags,
    ]
  );

  logger.info('User drone cloned', {
    originalId: droneId,
    cloneId: clone.id,
    userId,
  });

  return clone;
}

/**
 * Recalculate metrics for a drone
 */
export async function recalculateMetrics(
  droneId: string,
  userId: string
): Promise<UserDrone | null> {
  const drone = await getUserDroneById(droneId, userId);
  if (!drone) {
    return null;
  }

  const metrics = await physicsService.calculateDroneMetrics(drone.configuration);

  const updated = await db.one<UserDrone>(
    `UPDATE user_drones SET calculated_metrics = $1 WHERE id = $2 RETURNING *`,
    [JSON.stringify(metrics), droneId]
  );

  logger.info('Drone metrics recalculated', { droneId });
  return updated;
}

export default {
  getUserDrones,
  getPublicDrones,
  getDroneById,
  getUserDroneById,
  createDrone,
  updateDrone,
  deleteDrone,
  cloneDrone,
  recalculateMetrics,
};

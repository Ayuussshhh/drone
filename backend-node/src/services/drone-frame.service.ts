/**
 * Drone Frame Service
 * CRUD operations for drone frames
 */

import db from '../database/connection';
import logger from '../config/logger';
import { DroneFrame, CreateFrameDTO, FrameType } from '../models/drone-frame.model';
import { PaginationParams, PaginatedResponse } from '../models';

/**
 * Get all frames with pagination
 */
export async function getFrames(
  frameType?: FrameType,
  pagination: PaginationParams = {}
): Promise<PaginatedResponse<DroneFrame>> {
  const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = pagination;
  const offset = (page - 1) * limit;

  const conditions = ['is_active = true'];
  const params: any[] = [];
  let paramIndex = 1;

  if (frameType) {
    conditions.push(`frame_type = $${paramIndex++}`);
    params.push(frameType);
  }

  const whereClause = conditions.join(' AND ');
  const validSortColumns = ['name', 'frame_type', 'diagonal_mm', 'arm_count', 'created_at'];
  const actualSortBy = validSortColumns.includes(sortBy) ? sortBy : 'name';
  const actualSortOrder = sortOrder === 'desc' ? 'DESC' : 'ASC';

  const countResult = await db.one(
    `SELECT COUNT(*) FROM drone_frames WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.count);

  const data = await db.manyOrNone<DroneFrame>(
    `SELECT * FROM drone_frames
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
 * Get frame by ID
 */
export async function getFrameById(id: string): Promise<DroneFrame | null> {
  return db.oneOrNone<DroneFrame>(
    'SELECT * FROM drone_frames WHERE id = $1 AND is_active = true',
    [id]
  );
}

/**
 * Get frames by type
 */
export async function getFramesByType(type: FrameType): Promise<DroneFrame[]> {
  return db.manyOrNone<DroneFrame>(
    `SELECT * FROM drone_frames
     WHERE frame_type = $1 AND is_active = true
     ORDER BY name`,
    [type]
  );
}

/**
 * Create new frame (admin only)
 */
export async function createFrame(data: CreateFrameDTO): Promise<DroneFrame> {
  const frame = await db.one<DroneFrame>(
    `INSERT INTO drone_frames (
      name, description, frame_type, arm_count, diagonal_mm,
      arm_positions, center_mount_positions, frame_weight_grams,
      max_payload_grams, material
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      data.name,
      data.description || null,
      data.frame_type,
      data.arm_count,
      data.diagonal_mm,
      JSON.stringify(data.arm_positions),
      data.center_mount_positions ? JSON.stringify(data.center_mount_positions) : null,
      data.frame_weight_grams,
      data.max_payload_grams || null,
      data.material || null,
    ]
  );

  logger.info('Drone frame created', { frameId: frame.id });
  return frame;
}

/**
 * Update frame (admin only)
 */
export async function updateFrame(
  id: string,
  data: Partial<CreateFrameDTO>
): Promise<DroneFrame | null> {
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
  if (data.frame_type !== undefined) {
    updates.push(`frame_type = $${paramIndex++}`);
    params.push(data.frame_type);
  }
  if (data.arm_count !== undefined) {
    updates.push(`arm_count = $${paramIndex++}`);
    params.push(data.arm_count);
  }
  if (data.diagonal_mm !== undefined) {
    updates.push(`diagonal_mm = $${paramIndex++}`);
    params.push(data.diagonal_mm);
  }
  if (data.arm_positions !== undefined) {
    updates.push(`arm_positions = $${paramIndex++}`);
    params.push(JSON.stringify(data.arm_positions));
  }
  if (data.center_mount_positions !== undefined) {
    updates.push(`center_mount_positions = $${paramIndex++}`);
    params.push(JSON.stringify(data.center_mount_positions));
  }
  if (data.frame_weight_grams !== undefined) {
    updates.push(`frame_weight_grams = $${paramIndex++}`);
    params.push(data.frame_weight_grams);
  }
  if (data.max_payload_grams !== undefined) {
    updates.push(`max_payload_grams = $${paramIndex++}`);
    params.push(data.max_payload_grams);
  }
  if (data.material !== undefined) {
    updates.push(`material = $${paramIndex++}`);
    params.push(data.material);
  }

  if (updates.length === 0) {
    return getFrameById(id);
  }

  params.push(id);

  const frame = await db.oneOrNone<DroneFrame>(
    `UPDATE drone_frames SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  if (frame) {
    logger.info('Drone frame updated', { frameId: id });
  }

  return frame;
}

/**
 * Delete frame (soft delete, admin only)
 */
export async function deleteFrame(id: string): Promise<boolean> {
  const result = await db.result(
    'UPDATE drone_frames SET is_active = false WHERE id = $1',
    [id]
  );

  if (result.rowCount > 0) {
    logger.info('Drone frame deleted', { frameId: id });
    return true;
  }

  return false;
}

export default {
  getFrames,
  getFrameById,
  getFramesByType,
  createFrame,
  updateFrame,
  deleteFrame,
};

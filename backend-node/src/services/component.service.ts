/**
 * Component Service
 * CRUD operations for drone components
 */

import db from '../database/connection';
import logger from '../config/logger';
import {
  Component,
  ComponentType,
  CreateComponentDTO,
  ComponentFilter,
} from '../models/component.model';
import { PaginationParams, PaginatedResponse } from '../models';

/**
 * Get all components with filtering and pagination
 */
export async function getComponents(
  filter: ComponentFilter = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResponse<Component>> {
  const { page = 1, limit = 50, sortBy = 'name', sortOrder = 'asc' } = pagination;
  const offset = (page - 1) * limit;

  // Build WHERE clause
  const conditions: string[] = ['is_active = true'];
  const params: any[] = [];
  let paramIndex = 1;

  if (filter.type) {
    conditions.push(`type = $${paramIndex++}`);
    params.push(filter.type);
  }

  if (filter.manufacturer) {
    conditions.push(`LOWER(manufacturer) = LOWER($${paramIndex++})`);
    params.push(filter.manufacturer);
  }

  if (filter.minWeight !== undefined) {
    conditions.push(`weight_grams >= $${paramIndex++}`);
    params.push(filter.minWeight);
  }

  if (filter.maxWeight !== undefined) {
    conditions.push(`weight_grams <= $${paramIndex++}`);
    params.push(filter.maxWeight);
  }

  if (filter.minPrice !== undefined) {
    conditions.push(`price_usd >= $${paramIndex++}`);
    params.push(filter.minPrice);
  }

  if (filter.maxPrice !== undefined) {
    conditions.push(`price_usd <= $${paramIndex++}`);
    params.push(filter.maxPrice);
  }

  if (filter.search) {
    conditions.push(
      `(LOWER(name) LIKE $${paramIndex} OR LOWER(description) LIKE $${paramIndex} OR LOWER(manufacturer) LIKE $${paramIndex})`
    );
    params.push(`%${filter.search.toLowerCase()}%`);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  // Validate sort column
  const validSortColumns = ['name', 'type', 'weight_grams', 'price_usd', 'created_at'];
  const actualSortBy = validSortColumns.includes(sortBy) ? sortBy : 'name';
  const actualSortOrder = sortOrder === 'desc' ? 'DESC' : 'ASC';

  // Get total count
  const countResult = await db.one(
    `SELECT COUNT(*) FROM components WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.count);

  // Get data
  const data = await db.manyOrNone<Component>(
    `SELECT * FROM components
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
 * Get component by ID
 */
export async function getComponentById(id: string): Promise<Component | null> {
  return db.oneOrNone<Component>(
    'SELECT * FROM components WHERE id = $1 AND is_active = true',
    [id]
  );
}

/**
 * Get components by type
 */
export async function getComponentsByType(type: ComponentType): Promise<Component[]> {
  return db.manyOrNone<Component>(
    'SELECT * FROM components WHERE type = $1 AND is_active = true ORDER BY name',
    [type]
  );
}

/**
 * Create new component (admin only)
 */
export async function createComponent(data: CreateComponentDTO): Promise<Component> {
  const component = await db.one<Component>(
    `INSERT INTO components (
      name, type, manufacturer, model_number, description,
      weight_grams, dimensions_mm, specifications,
      thumbnail_url, model_3d_url, compatible_with, price_usd
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      data.name,
      data.type,
      data.manufacturer || null,
      data.model_number || null,
      data.description || null,
      data.weight_grams,
      JSON.stringify(data.dimensions_mm),
      JSON.stringify(data.specifications),
      data.thumbnail_url || null,
      data.model_3d_url || null,
      data.compatible_with ? JSON.stringify(data.compatible_with) : null,
      data.price_usd || null,
    ]
  );

  logger.info('Component created', { componentId: component.id, type: data.type });
  return component;
}

/**
 * Update component (admin only)
 */
export async function updateComponent(
  id: string,
  data: Partial<CreateComponentDTO>
): Promise<Component | null> {
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    params.push(data.name);
  }
  if (data.type !== undefined) {
    updates.push(`type = $${paramIndex++}`);
    params.push(data.type);
  }
  if (data.manufacturer !== undefined) {
    updates.push(`manufacturer = $${paramIndex++}`);
    params.push(data.manufacturer);
  }
  if (data.model_number !== undefined) {
    updates.push(`model_number = $${paramIndex++}`);
    params.push(data.model_number);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    params.push(data.description);
  }
  if (data.weight_grams !== undefined) {
    updates.push(`weight_grams = $${paramIndex++}`);
    params.push(data.weight_grams);
  }
  if (data.dimensions_mm !== undefined) {
    updates.push(`dimensions_mm = $${paramIndex++}`);
    params.push(JSON.stringify(data.dimensions_mm));
  }
  if (data.specifications !== undefined) {
    updates.push(`specifications = $${paramIndex++}`);
    params.push(JSON.stringify(data.specifications));
  }
  if (data.thumbnail_url !== undefined) {
    updates.push(`thumbnail_url = $${paramIndex++}`);
    params.push(data.thumbnail_url);
  }
  if (data.model_3d_url !== undefined) {
    updates.push(`model_3d_url = $${paramIndex++}`);
    params.push(data.model_3d_url);
  }
  if (data.compatible_with !== undefined) {
    updates.push(`compatible_with = $${paramIndex++}`);
    params.push(JSON.stringify(data.compatible_with));
  }
  if (data.price_usd !== undefined) {
    updates.push(`price_usd = $${paramIndex++}`);
    params.push(data.price_usd);
  }

  if (updates.length === 0) {
    return getComponentById(id);
  }

  params.push(id);

  const component = await db.oneOrNone<Component>(
    `UPDATE components SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  if (component) {
    logger.info('Component updated', { componentId: id });
  }

  return component;
}

/**
 * Delete component (soft delete, admin only)
 */
export async function deleteComponent(id: string): Promise<boolean> {
  const result = await db.result(
    'UPDATE components SET is_active = false WHERE id = $1',
    [id]
  );

  if (result.rowCount > 0) {
    logger.info('Component deleted', { componentId: id });
    return true;
  }

  return false;
}

/**
 * Get unique manufacturers
 */
export async function getManufacturers(): Promise<string[]> {
  const result = await db.manyOrNone<{ manufacturer: string }>(
    `SELECT DISTINCT manufacturer FROM components
     WHERE manufacturer IS NOT NULL AND is_active = true
     ORDER BY manufacturer`
  );

  return result.map((r) => r.manufacturer);
}

/**
 * Get component types with counts
 */
export async function getComponentTypeCounts(): Promise<
  { type: ComponentType; count: number }[]
> {
  return db.manyOrNone(
    `SELECT type, COUNT(*) as count
     FROM components WHERE is_active = true
     GROUP BY type ORDER BY type`
  );
}

export default {
  getComponents,
  getComponentById,
  getComponentsByType,
  createComponent,
  updateComponent,
  deleteComponent,
  getManufacturers,
  getComponentTypeCounts,
};

/**
 * User Drone Routes
 */

import { Router, Request, Response } from 'express';
import { userDroneService } from '../services';
import {
  asyncHandler,
  authenticate,
  optionalAuth,
  validate,
  createDroneValidation,
  updateDroneValidation,
  uuidParamValidation,
  paginationValidation,
} from '../middleware';

const router = Router();

/**
 * GET /api/drones
 * Get current user's drones
 */
router.get(
  '/',
  authenticate,
  validate(paginationValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const pagination = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as 'asc' | 'desc',
    };

    const result = await userDroneService.getUserDrones(req.userId!, pagination);

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  })
);

/**
 * GET /api/drones/public
 * Get public/community drones
 */
router.get(
  '/public',
  optionalAuth,
  validate(paginationValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const filter = {
      search: req.query.search as string | undefined,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
    };

    const pagination = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as 'asc' | 'desc',
    };

    const result = await userDroneService.getPublicDrones(filter, pagination);

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  })
);

/**
 * GET /api/drones/:id
 * Get drone by ID (owner or if public)
 */
router.get(
  '/:id',
  optionalAuth,
  validate(uuidParamValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const drone = await userDroneService.getDroneById(req.params.id);

    if (!drone) {
      res.status(404).json({
        success: false,
        message: 'Drone not found',
      });
      return;
    }

    // Check access
    if (!drone.is_public && drone.user_id !== req.userId) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    res.json({
      success: true,
      data: drone,
    });
  })
);

/**
 * POST /api/drones
 * Create new drone design
 */
router.post(
  '/',
  authenticate,
  validate(createDroneValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const drone = await userDroneService.createDrone(req.userId!, req.body);

    res.status(201).json({
      success: true,
      message: 'Drone created successfully',
      data: drone,
    });
  })
);

/**
 * PUT /api/drones/:id
 * Update drone design
 */
router.put(
  '/:id',
  authenticate,
  validate([...uuidParamValidation, ...updateDroneValidation]),
  asyncHandler(async (req: Request, res: Response) => {
    const drone = await userDroneService.updateDrone(req.params.id, req.userId!, req.body);

    if (!drone) {
      res.status(404).json({
        success: false,
        message: 'Drone not found or not owned by you',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Drone updated successfully',
      data: drone,
    });
  })
);

/**
 * DELETE /api/drones/:id
 * Delete drone design
 */
router.delete(
  '/:id',
  authenticate,
  validate(uuidParamValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const deleted = await userDroneService.deleteDrone(req.params.id, req.userId!);

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: 'Drone not found or not owned by you',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Drone deleted successfully',
    });
  })
);

/**
 * POST /api/drones/:id/clone
 * Clone a drone design
 */
router.post(
  '/:id/clone',
  authenticate,
  validate(uuidParamValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.body;

    const clone = await userDroneService.cloneDrone(req.params.id, req.userId!, name);

    if (!clone) {
      res.status(404).json({
        success: false,
        message: 'Drone not found or not accessible',
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: 'Drone cloned successfully',
      data: clone,
    });
  })
);

/**
 * POST /api/drones/:id/recalculate
 * Recalculate drone metrics
 */
router.post(
  '/:id/recalculate',
  authenticate,
  validate(uuidParamValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const drone = await userDroneService.recalculateMetrics(req.params.id, req.userId!);

    if (!drone) {
      res.status(404).json({
        success: false,
        message: 'Drone not found or not owned by you',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Metrics recalculated',
      data: drone,
    });
  })
);

export default router;

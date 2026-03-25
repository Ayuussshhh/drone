/**
 * Drone Frame Routes
 */

import { Router, Request, Response } from 'express';
import { droneFrameService } from '../services';
import {
  asyncHandler,
  authenticate,
  requireAdmin,
  validate,
  uuidParamValidation,
  paginationValidation,
} from '../middleware';
import { FrameType } from '../models/drone-frame.model';

const router = Router();

/**
 * GET /api/frames
 * Get all drone frames
 */
router.get(
  '/',
  validate(paginationValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const frameType = req.query.frame_type as FrameType | undefined;
    const pagination = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as 'asc' | 'desc',
    };

    const result = await droneFrameService.getFrames(frameType, pagination);

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
 * GET /api/frames/type/:type
 * Get frames by type
 */
router.get(
  '/type/:type',
  asyncHandler(async (req: Request, res: Response) => {
    const validTypes = [
      'quadcopter', 'hexacopter', 'octocopter',
      'tricopter', 'fixed_wing', 'vtol',
    ];

    const type = req.params.type as FrameType;

    if (!validTypes.includes(type)) {
      res.status(400).json({
        success: false,
        message: 'Invalid frame type',
      });
      return;
    }

    const frames = await droneFrameService.getFramesByType(type);

    res.json({
      success: true,
      data: frames,
    });
  })
);

/**
 * GET /api/frames/:id
 * Get frame by ID
 */
router.get(
  '/:id',
  validate(uuidParamValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const frame = await droneFrameService.getFrameById(req.params.id);

    if (!frame) {
      res.status(404).json({
        success: false,
        message: 'Frame not found',
      });
      return;
    }

    res.json({
      success: true,
      data: frame,
    });
  })
);

/**
 * POST /api/frames
 * Create new frame (admin only)
 */
router.post(
  '/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const frame = await droneFrameService.createFrame(req.body);

    res.status(201).json({
      success: true,
      message: 'Frame created successfully',
      data: frame,
    });
  })
);

/**
 * PUT /api/frames/:id
 * Update frame (admin only)
 */
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  validate(uuidParamValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const frame = await droneFrameService.updateFrame(req.params.id, req.body);

    if (!frame) {
      res.status(404).json({
        success: false,
        message: 'Frame not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Frame updated successfully',
      data: frame,
    });
  })
);

/**
 * DELETE /api/frames/:id
 * Delete frame (admin only)
 */
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  validate(uuidParamValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const deleted = await droneFrameService.deleteFrame(req.params.id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: 'Frame not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Frame deleted successfully',
    });
  })
);

export default router;

/**
 * Component Routes
 */

import { Router, Request, Response } from 'express';
import { componentService } from '../services';
import {
  asyncHandler,
  authenticate,
  requireAdmin,
  validate,
  componentFilterValidation,
  createComponentValidation,
  uuidParamValidation,
  paginationValidation,
} from '../middleware';
import { ComponentType } from '../models/component.model';

const router = Router();

/**
 * GET /api/components
 * Get all components with optional filtering
 */
router.get(
  '/',
  validate([...componentFilterValidation, ...paginationValidation]),
  asyncHandler(async (req: Request, res: Response) => {
    const filter = {
      type: req.query.type as ComponentType | undefined,
      manufacturer: req.query.manufacturer as string | undefined,
      minWeight: req.query.minWeight ? parseFloat(req.query.minWeight as string) : undefined,
      maxWeight: req.query.maxWeight ? parseFloat(req.query.maxWeight as string) : undefined,
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
      search: req.query.search as string | undefined,
    };

    const pagination = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as 'asc' | 'desc',
    };

    const result = await componentService.getComponents(filter, pagination);

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
 * GET /api/components/types
 * Get component type counts
 */
router.get(
  '/types',
  asyncHandler(async (_req: Request, res: Response) => {
    const counts = await componentService.getComponentTypeCounts();

    res.json({
      success: true,
      data: counts,
    });
  })
);

/**
 * GET /api/components/manufacturers
 * Get list of manufacturers
 */
router.get(
  '/manufacturers',
  asyncHandler(async (_req: Request, res: Response) => {
    const manufacturers = await componentService.getManufacturers();

    res.json({
      success: true,
      data: manufacturers,
    });
  })
);

/**
 * GET /api/components/type/:type
 * Get components by type
 */
router.get(
  '/type/:type',
  asyncHandler(async (req: Request, res: Response) => {
    const validTypes = [
      'frame', 'motor', 'propeller', 'battery', 'esc',
      'flight_controller', 'camera', 'gps', 'sensor', 'payload', 'tether',
    ];

    const type = req.params.type as ComponentType;

    if (!validTypes.includes(type)) {
      res.status(400).json({
        success: false,
        message: 'Invalid component type',
      });
      return;
    }

    const components = await componentService.getComponentsByType(type);

    res.json({
      success: true,
      data: components,
    });
  })
);

/**
 * GET /api/components/:id
 * Get component by ID
 */
router.get(
  '/:id',
  validate(uuidParamValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const component = await componentService.getComponentById(req.params.id);

    if (!component) {
      res.status(404).json({
        success: false,
        message: 'Component not found',
      });
      return;
    }

    res.json({
      success: true,
      data: component,
    });
  })
);

/**
 * POST /api/components
 * Create new component (admin only)
 */
router.post(
  '/',
  authenticate,
  requireAdmin,
  validate(createComponentValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const component = await componentService.createComponent(req.body);

    res.status(201).json({
      success: true,
      message: 'Component created successfully',
      data: component,
    });
  })
);

/**
 * PUT /api/components/:id
 * Update component (admin only)
 */
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  validate(uuidParamValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const component = await componentService.updateComponent(req.params.id, req.body);

    if (!component) {
      res.status(404).json({
        success: false,
        message: 'Component not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Component updated successfully',
      data: component,
    });
  })
);

/**
 * DELETE /api/components/:id
 * Delete component (admin only)
 */
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  validate(uuidParamValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const deleted = await componentService.deleteComponent(req.params.id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: 'Component not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Component deleted successfully',
    });
  })
);

export default router;

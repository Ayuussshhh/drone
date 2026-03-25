/**
 * Simulation Routes
 */

import { Router, Request, Response } from 'express';
import { simulationService, physicsService } from '../services';
import {
  asyncHandler,
  authenticate,
  validate,
  createSimulationValidation,
  uuidParamValidation,
  paginationValidation,
} from '../middleware';

const router = Router();

/**
 * GET /api/simulations
 * Get user's simulations
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

    const result = await simulationService.getUserSimulations(req.userId!, pagination);

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
 * GET /api/simulations/:id
 * Get simulation by ID
 */
router.get(
  '/:id',
  authenticate,
  validate(uuidParamValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const simulation = await simulationService.getUserSimulationById(
      req.params.id,
      req.userId!
    );

    if (!simulation) {
      res.status(404).json({
        success: false,
        message: 'Simulation not found',
      });
      return;
    }

    res.json({
      success: true,
      data: simulation,
    });
  })
);

/**
 * GET /api/simulations/:id/results
 * Get simulation results
 */
router.get(
  '/:id/results',
  authenticate,
  validate(uuidParamValidation),
  asyncHandler(async (req: Request, res: Response) => {
    // Verify ownership
    const simulation = await simulationService.getUserSimulationById(
      req.params.id,
      req.userId!
    );

    if (!simulation) {
      res.status(404).json({
        success: false,
        message: 'Simulation not found',
      });
      return;
    }

    const results = await simulationService.getSimulationResults(req.params.id);

    if (!results) {
      res.status(404).json({
        success: false,
        message: 'Results not yet available',
      });
      return;
    }

    res.json({
      success: true,
      data: results,
    });
  })
);

/**
 * POST /api/simulations
 * Create new simulation
 */
router.post(
  '/',
  authenticate,
  validate(createSimulationValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const simulation = await simulationService.createSimulation(req.userId!, req.body);

    res.status(201).json({
      success: true,
      message: 'Simulation created successfully',
      data: simulation,
    });
  })
);

/**
 * POST /api/simulations/:id/start
 * Start a pending simulation
 */
router.post(
  '/:id/start',
  authenticate,
  validate(uuidParamValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const simulation = await simulationService.getUserSimulationById(
      req.params.id,
      req.userId!
    );

    if (!simulation) {
      res.status(404).json({
        success: false,
        message: 'Simulation not found',
      });
      return;
    }

    if (simulation.status !== 'pending') {
      res.status(400).json({
        success: false,
        message: 'Simulation is not in pending state',
      });
      return;
    }

    // Update status to running
    const updated = await simulationService.updateSimulationStatus(
      req.params.id,
      'running'
    );

    // Start simulation will be handled by WebSocket for real-time updates

    res.json({
      success: true,
      message: 'Simulation started. Connect to WebSocket for real-time updates.',
      data: updated,
    });
  })
);

/**
 * POST /api/simulations/:id/cancel
 * Cancel a running simulation
 */
router.post(
  '/:id/cancel',
  authenticate,
  validate(uuidParamValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const cancelled = await simulationService.cancelSimulation(
      req.params.id,
      req.userId!
    );

    if (!cancelled) {
      res.status(400).json({
        success: false,
        message: 'Could not cancel simulation',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Simulation cancelled',
    });
  })
);

/**
 * DELETE /api/simulations/:id
 * Delete simulation
 */
router.delete(
  '/:id',
  authenticate,
  validate(uuidParamValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const deleted = await simulationService.deleteSimulation(
      req.params.id,
      req.userId!
    );

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: 'Simulation not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Simulation deleted successfully',
    });
  })
);

/**
 * GET /api/simulations/drone/:droneId
 * Get simulations for a specific drone
 */
router.get(
  '/drone/:droneId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const simulations = await simulationService.getDroneSimulations(
      req.params.droneId,
      req.userId!
    );

    res.json({
      success: true,
      data: simulations,
    });
  })
);

/**
 * POST /api/simulations/quick-analysis
 * Run quick analysis without creating simulation
 */
router.post(
  '/quick-analysis',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { configuration } = req.body;

    if (!configuration) {
      res.status(400).json({
        success: false,
        message: 'Configuration is required',
      });
      return;
    }

    const metrics = await physicsService.calculateDroneMetrics(configuration);

    res.json({
      success: true,
      data: { metrics },
    });
  })
);

/**
 * POST /api/simulations/validate
 * Validate drone configuration
 */
router.post(
  '/validate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { configuration } = req.body;

    if (!configuration) {
      res.status(400).json({
        success: false,
        message: 'Configuration is required',
      });
      return;
    }

    const validation = await physicsService.validateConfiguration(configuration);

    res.json({
      success: true,
      data: validation,
    });
  })
);

/**
 * GET /api/simulations/physics/health
 * Check physics engine health
 */
router.get(
  '/physics/health',
  asyncHandler(async (_req: Request, res: Response) => {
    const isHealthy = await physicsService.healthCheck();

    res.json({
      success: true,
      data: {
        physics_engine: isHealthy ? 'connected' : 'disconnected',
      },
    });
  })
);

export default router;

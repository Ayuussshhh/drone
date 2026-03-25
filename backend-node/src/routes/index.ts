/**
 * Routes Index
 * Combines all API routes
 */

import { Router } from 'express';
import authRoutes from './auth.routes';
import componentRoutes from './component.routes';
import droneFrameRoutes from './drone-frame.routes';
import userDroneRoutes from './user-drone.routes';
import simulationRoutes from './simulation.routes';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/components', componentRoutes);
router.use('/frames', droneFrameRoutes);
router.use('/drones', userDroneRoutes);
router.use('/simulations', simulationRoutes);

export default router;

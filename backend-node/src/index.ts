/**
 * Drone Simulation Backend - Main Entry Point
 * Production-grade Express server with Socket.IO
 */

import express, { Application } from 'express';
import { createServer, Server as HttpServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import config from './config';
import logger from './config/logger';
import routes from './routes';
import { notFoundHandler, errorHandler } from './middleware';
import { testConnection, initializeDatabase, seedDatabase } from './database';
import { setupWebSocket } from './websocket';

// Create Express app
const app: Application = express();
const httpServer: HttpServer = createServer(app);

// ==================== MIDDLEWARE ====================

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });

  next();
});

// ==================== ROUTES ====================

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Drone Simulation Backend',
    version: '1.0.0',
    status: 'running',
    documentation: '/api/docs',
    healthCheck: '/api/health',
  });
});

// API routes
app.use('/api', routes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// ==================== WEBSOCKET ====================

const io = setupWebSocket(httpServer);

// ==================== SERVER STARTUP ====================

async function startServer(): Promise<void> {
  try {
    // Test database connection
    logger.info('Testing database connection...');
    const dbConnected = await testConnection();

    if (!dbConnected) {
      logger.warn('Database connection failed. Some features may not work.');
      // Continue anyway for development
    } else {
      // Initialize database tables if needed
      if (config.isDevelopment) {
        try {
          await initializeDatabase(false);
          await seedDatabase();
        } catch (error: any) {
          logger.warn('Database initialization skipped', { error: error.message });
        }
      }
    }

    // Start HTTP server
    httpServer.listen(config.port, () => {
      logger.info(`
========================================
  Drone Simulation Backend Started
========================================
  Environment: ${config.env}
  Port: ${config.port}
  API URL: http://localhost:${config.port}/api
  WebSocket: ws://localhost:${config.port}

  Endpoints:
    - Health: GET /api/health
    - Auth: POST /api/auth/*
    - Components: GET /api/components
    - Frames: GET /api/frames
    - Drones: GET /api/drones
    - Simulations: GET /api/simulations
========================================
      `);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received. Shutting down gracefully...`);

      httpServer.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error: any) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Start the server
startServer();

export { app, httpServer, io };

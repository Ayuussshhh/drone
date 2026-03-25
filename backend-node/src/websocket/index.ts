/**
 * WebSocket Handler using Socket.IO
 * Handles real-time simulation and Unity communication
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config';
import logger from '../config/logger';
import { JWTPayload } from '../models/user.model';
import { physicsService, simulationService, userDroneService } from '../services';

// Socket with user data
interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

// Active simulation state
interface SimulationRoom {
  simulationId: string;
  droneId: string;
  ownerId: string;
  isRunning: boolean;
  isPaused: boolean;
  currentState: any;
  environmentConfig: any;
  throttles: number[];
  intervalId?: NodeJS.Timeout;
}

// Store active simulations
const activeSimulations = new Map<string, SimulationRoom>();

export function setupWebSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      // Allow unauthenticated connections for public viewing
      next();
      return;
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      logger.warn('WebSocket auth failed', { error });
      next(new Error('Authentication failed'));
    }
  });

  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info('WebSocket client connected', {
      socketId: socket.id,
      userId: socket.userId,
    });

    // Join user's room if authenticated
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // ==================== SIMULATION EVENTS ====================

    /**
     * Start a new simulation
     */
    socket.on('start_simulation', async (data: {
      simulationId?: string;
      droneId: string;
      environment?: any;
      initialState?: any;
      timeStepMs?: number;
    }) => {
      if (!socket.userId) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }

      try {
        // Verify drone ownership
        const drone = await userDroneService.getUserDroneById(data.droneId, socket.userId);
        if (!drone) {
          socket.emit('error', { message: 'Drone not found or not owned by you' });
          return;
        }

        // Create simulation room
        const roomId = `sim:${socket.userId}:${Date.now()}`;
        const roomState: SimulationRoom = {
          simulationId: data.simulationId || roomId,
          droneId: data.droneId,
          ownerId: socket.userId,
          isRunning: true,
          isPaused: false,
          currentState: data.initialState || {
            timestamp: 0,
            position: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            acceleration: { x: 0, y: 0, z: 0 },
            orientation: { roll: 0, pitch: 0, yaw: 0 },
            angular_velocity: { roll: 0, pitch: 0, yaw: 0 },
          },
          environmentConfig: data.environment || {
            gravity: 9.81,
            air_density: 1.225,
            wind: { velocity: { x: 0, y: 0, z: 0 }, turbulence: 0 },
            temperature_celsius: 20,
            altitude_base_m: 0,
          },
          throttles: [0.5, 0.5, 0.5, 0.5],
        };

        // Join simulation room
        socket.join(roomId);
        activeSimulations.set(roomId, roomState);

        // Start simulation loop
        const timeStepMs = data.timeStepMs || 50; // 20 Hz default
        const timeStepS = timeStepMs / 1000;

        roomState.intervalId = setInterval(async () => {
          if (!roomState.isRunning || roomState.isPaused) return;

          try {
            // Call physics engine
            const newState = await physicsService.runSimulationStep(
              drone.configuration,
              {
                position: roomState.currentState.position,
                velocity: roomState.currentState.velocity,
                orientation: roomState.currentState.orientation,
                throttles: roomState.throttles,
              },
              roomState.environmentConfig,
              roomState.throttles,
              timeStepS
            );

            // Update state
            roomState.currentState = {
              ...newState,
              timestamp: roomState.currentState.timestamp + timeStepS,
            };

            // Calculate metrics and stability
            const metrics = await physicsService.calculateDroneMetrics(drone.configuration);
            const stability = await physicsService.analyzeStability(
              drone.configuration,
              {
                position: roomState.currentState.position,
                velocity: roomState.currentState.velocity,
                orientation: roomState.currentState.orientation,
                throttles: roomState.throttles,
              }
            );

            // Emit state update
            io.to(roomId).emit('state_update', {
              state: roomState.currentState,
              metrics,
              stability,
            });

          } catch (error: any) {
            logger.error('Simulation step error', { error: error.message });
            socket.emit('simulation_error', { message: error.message });
          }
        }, timeStepMs);

        socket.emit('simulation_started', { roomId, state: roomState.currentState });
        logger.info('Simulation started', { roomId, userId: socket.userId });

      } catch (error: any) {
        logger.error('Start simulation error', { error: error.message });
        socket.emit('error', { message: error.message });
      }
    });

    /**
     * Stop simulation
     */
    socket.on('stop_simulation', (data: { roomId: string }) => {
      const room = activeSimulations.get(data.roomId);

      if (!room || room.ownerId !== socket.userId) {
        socket.emit('error', { message: 'Simulation not found' });
        return;
      }

      if (room.intervalId) {
        clearInterval(room.intervalId);
      }

      room.isRunning = false;
      activeSimulations.delete(data.roomId);
      socket.leave(data.roomId);

      socket.emit('simulation_stopped', { roomId: data.roomId });
      logger.info('Simulation stopped', { roomId: data.roomId });
    });

    /**
     * Pause simulation
     */
    socket.on('pause_simulation', (data: { roomId: string }) => {
      const room = activeSimulations.get(data.roomId);

      if (!room || room.ownerId !== socket.userId) {
        socket.emit('error', { message: 'Simulation not found' });
        return;
      }

      room.isPaused = true;
      socket.emit('simulation_paused', { roomId: data.roomId });
    });

    /**
     * Resume simulation
     */
    socket.on('resume_simulation', (data: { roomId: string }) => {
      const room = activeSimulations.get(data.roomId);

      if (!room || room.ownerId !== socket.userId) {
        socket.emit('error', { message: 'Simulation not found' });
        return;
      }

      room.isPaused = false;
      socket.emit('simulation_resumed', { roomId: data.roomId });
    });

    /**
     * Update throttles
     */
    socket.on('update_throttles', (data: { roomId: string; throttles: number[] }) => {
      const room = activeSimulations.get(data.roomId);

      if (!room || room.ownerId !== socket.userId) {
        socket.emit('error', { message: 'Simulation not found' });
        return;
      }

      // Clamp throttles to 0-1
      room.throttles = data.throttles.map((t) => Math.max(0, Math.min(1, t)));
    });

    /**
     * Update wind
     */
    socket.on('set_wind', (data: {
      roomId: string;
      velocity: { x: number; y: number; z: number };
      turbulence?: number;
    }) => {
      const room = activeSimulations.get(data.roomId);

      if (!room || room.ownerId !== socket.userId) {
        socket.emit('error', { message: 'Simulation not found' });
        return;
      }

      room.environmentConfig.wind = {
        velocity: data.velocity,
        turbulence: data.turbulence ?? room.environmentConfig.wind.turbulence,
      };
    });

    /**
     * Reset simulation
     */
    socket.on('reset_simulation', (data: { roomId: string }) => {
      const room = activeSimulations.get(data.roomId);

      if (!room || room.ownerId !== socket.userId) {
        socket.emit('error', { message: 'Simulation not found' });
        return;
      }

      room.currentState = {
        timestamp: 0,
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        orientation: { roll: 0, pitch: 0, yaw: 0 },
        angular_velocity: { roll: 0, pitch: 0, yaw: 0 },
      };
      room.throttles = [0.5, 0.5, 0.5, 0.5];
      room.isPaused = false;

      socket.emit('simulation_reset', { roomId: data.roomId, state: room.currentState });
    });

    // ==================== UNITY EVENTS ====================

    /**
     * Unity client registers
     */
    socket.on('unity_register', (data: { clientId: string }) => {
      socket.join('unity_clients');
      logger.info('Unity client registered', { clientId: data.clientId, socketId: socket.id });
      socket.emit('unity_registered', { success: true });
    });

    /**
     * Forward state to Unity
     */
    socket.on('forward_to_unity', (data: any) => {
      io.to('unity_clients').emit('simulation_state', data);
    });

    /**
     * Unity sends back results
     */
    socket.on('unity_result', (data: any) => {
      // Forward to appropriate user
      if (data.userId) {
        io.to(`user:${data.userId}`).emit('unity_feedback', data);
      }
    });

    // ==================== DISCONNECT ====================

    socket.on('disconnect', () => {
      logger.info('WebSocket client disconnected', { socketId: socket.id });

      // Clean up any active simulations
      for (const [roomId, room] of activeSimulations.entries()) {
        if (room.ownerId === socket.userId) {
          if (room.intervalId) {
            clearInterval(room.intervalId);
          }
          activeSimulations.delete(roomId);
          logger.info('Cleaned up simulation on disconnect', { roomId });
        }
      }
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

export default { setupWebSocket };

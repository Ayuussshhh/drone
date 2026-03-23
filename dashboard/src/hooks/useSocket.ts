/**
 * Socket.IO hook for real-time communication with backend.
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  DroneConfiguration,
  SimulationParameters,
  SocketStateUpdate,
  Vector3,
} from '@/lib/types';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000';

export interface UseSocketOptions {
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  onStateUpdate?: (data: SocketStateUpdate) => void;
}

export interface UseSocketReturn {
  isConnected: boolean;
  isSimulationActive: boolean;
  connect: () => void;
  disconnect: () => void;
  startSimulation: (config: DroneConfiguration, updateRate?: number) => void;
  stopSimulation: () => void;
  pauseSimulation: () => void;
  resumeSimulation: () => void;
  resetSimulation: () => void;
  updateThrottles: (throttles: number[]) => void;
  updateParameters: (params: SimulationParameters) => void;
  setWind: (velocity: Vector3, turbulence: number) => void;
  sendGestureCommand: (gesture: string, parameters: Record<string, unknown>) => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const {
    autoConnect = true,
    onConnect,
    onDisconnect,
    onError,
    onStateUpdate,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSimulationActive, setIsSimulationActive] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setIsConnected(true);
      onConnect?.();
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setIsConnected(false);
      setIsSimulationActive(false);
      onDisconnect?.();
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      onError?.(error.message);
    });

    socket.on('error', (data: { message: string }) => {
      console.error('[Socket] Error:', data.message);
      onError?.(data.message);
    });

    socket.on('simulation_state', (data: SocketStateUpdate) => {
      onStateUpdate?.(data);
    });

    socket.on('simulation_started', () => {
      console.log('[Socket] Simulation started');
      setIsSimulationActive(true);
    });

    socket.on('simulation_stopped', () => {
      console.log('[Socket] Simulation stopped');
      setIsSimulationActive(false);
    });

    socket.on('simulation_paused', () => {
      console.log('[Socket] Simulation paused');
    });

    socket.on('simulation_resumed', () => {
      console.log('[Socket] Simulation resumed');
    });

    socket.on('simulation_reset', () => {
      console.log('[Socket] Simulation reset');
    });

    socket.on('parameters_updated', () => {
      console.log('[Socket] Parameters updated');
    });

    socket.on('wind_updated', () => {
      console.log('[Socket] Wind updated');
    });

    socket.on('gesture_ack', (data) => {
      console.log('[Socket] Gesture acknowledged:', data);
    });

    socketRef.current = socket;
  }, [onConnect, onDisconnect, onError, onStateUpdate]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setIsSimulationActive(false);
    }
  }, []);

  const startSimulation = useCallback(
    (config: DroneConfiguration, updateRate: number = 50) => {
      if (!socketRef.current?.connected) {
        console.warn('[Socket] Not connected');
        return;
      }

      socketRef.current.emit('start_simulation', {
        config,
        parameters: {
          enable_wind: true,
          enable_tether: !!config.tether,
          use_auto_stabilization: true,
        },
        update_rate: updateRate,
      });
    },
    []
  );

  const stopSimulation = useCallback(() => {
    socketRef.current?.emit('stop_simulation');
  }, []);

  const pauseSimulation = useCallback(() => {
    socketRef.current?.emit('pause_simulation');
  }, []);

  const resumeSimulation = useCallback(() => {
    socketRef.current?.emit('resume_simulation');
  }, []);

  const resetSimulation = useCallback(() => {
    socketRef.current?.emit('reset_simulation');
  }, []);

  const updateThrottles = useCallback((throttles: number[]) => {
    socketRef.current?.emit('update_throttles', { throttles });
  }, []);

  const updateParameters = useCallback((params: SimulationParameters) => {
    socketRef.current?.emit('update_parameters', { parameters: params });
  }, []);

  const setWind = useCallback((velocity: Vector3, turbulence: number) => {
    socketRef.current?.emit('set_wind', { velocity, turbulence });
  }, []);

  const sendGestureCommand = useCallback(
    (gesture: string, parameters: Record<string, unknown>) => {
      socketRef.current?.emit('gesture_command', { gesture, parameters });
    },
    []
  );

  return {
    isConnected,
    isSimulationActive,
    connect,
    disconnect,
    startSimulation,
    stopSimulation,
    pauseSimulation,
    resumeSimulation,
    resetSimulation,
    updateThrottles,
    updateParameters,
    setWind,
    sendGestureCommand,
  };
}

/**
 * Zustand store for simulation state management.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  DroneConfiguration,
  SimulationState,
  SimulationParameters,
  PhysicsMetrics,
  StabilityReport,
  TimeSeriesDataPoint,
  Vector3,
} from '@/lib/types';
import { createDefaultConfiguration } from '@/lib/api';

const MAX_HISTORY_LENGTH = 200;

interface SimulationStore {
  // Connection state
  isConnected: boolean;
  isSimulationActive: boolean;

  // Configuration
  droneConfig: DroneConfiguration;
  parameters: SimulationParameters;

  // Real-time state
  currentState: SimulationState | null;
  metrics: PhysicsMetrics | null;
  stability: StabilityReport | null;

  // History for charts
  stateHistory: TimeSeriesDataPoint[];

  // UI state
  selectedPanel: 'config' | 'metrics' | 'stability' | 'charts';
  showAdvancedSettings: boolean;

  // Actions
  setConnected: (connected: boolean) => void;
  setSimulationActive: (active: boolean) => void;
  setDroneConfig: (config: DroneConfiguration) => void;
  updateMotor: (index: number, updates: Partial<DroneConfiguration['motors'][0]>) => void;
  setParameters: (params: Partial<SimulationParameters>) => void;
  updateState: (state: SimulationState, metrics: PhysicsMetrics, stability: StabilityReport) => void;
  setSelectedPanel: (panel: SimulationStore['selectedPanel']) => void;
  toggleAdvancedSettings: () => void;
  resetHistory: () => void;
  resetConfig: () => void;
}

export const useSimulationStore = create<SimulationStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isConnected: false,
    isSimulationActive: false,
    droneConfig: createDefaultConfiguration(),
    parameters: {
      timestep: 0.02,
      max_duration: 60,
      wind_velocity: { x: 0, y: 0, z: 0 },
      wind_turbulence: 0.2,
      motor_throttles: [0.5, 0.5, 0.5, 0.5],
      use_auto_stabilization: true,
      enable_wind: true,
      enable_tether: false,
    },
    currentState: null,
    metrics: null,
    stability: null,
    stateHistory: [],
    selectedPanel: 'metrics',
    showAdvancedSettings: false,

    // Actions
    setConnected: (connected) => set({ isConnected: connected }),

    setSimulationActive: (active) => set({ isSimulationActive: active }),

    setDroneConfig: (config) => set({ droneConfig: config }),

    updateMotor: (index, updates) =>
      set((state) => {
        const motors = [...state.droneConfig.motors];
        motors[index] = { ...motors[index], ...updates };
        return {
          droneConfig: { ...state.droneConfig, motors },
        };
      }),

    setParameters: (params) =>
      set((state) => ({
        parameters: { ...state.parameters, ...params },
      })),

    updateState: (newState, metrics, stability) =>
      set((state) => {
        // Add to history
        const historyPoint: TimeSeriesDataPoint = {
          timestamp: newState.timestamp,
          altitude: newState.altitude,
          airSpeed: newState.air_speed,
          thrust: metrics.total_thrust,
          stability: stability.stability_score,
          tetherTension: newState.tether_tension,
        };

        let newHistory = [...state.stateHistory, historyPoint];
        if (newHistory.length > MAX_HISTORY_LENGTH) {
          newHistory = newHistory.slice(-MAX_HISTORY_LENGTH);
        }

        return {
          currentState: newState,
          metrics,
          stability,
          stateHistory: newHistory,
        };
      }),

    setSelectedPanel: (panel) => set({ selectedPanel: panel }),

    toggleAdvancedSettings: () =>
      set((state) => ({ showAdvancedSettings: !state.showAdvancedSettings })),

    resetHistory: () => set({ stateHistory: [] }),

    resetConfig: () =>
      set({
        droneConfig: createDefaultConfiguration(),
        currentState: null,
        metrics: null,
        stability: null,
        stateHistory: [],
      }),
  }))
);

// Selectors for optimized re-renders
export const selectIsConnected = (state: SimulationStore) => state.isConnected;
export const selectIsSimulationActive = (state: SimulationStore) => state.isSimulationActive;
export const selectDroneConfig = (state: SimulationStore) => state.droneConfig;
export const selectCurrentState = (state: SimulationStore) => state.currentState;
export const selectMetrics = (state: SimulationStore) => state.metrics;
export const selectStability = (state: SimulationStore) => state.stability;
export const selectStateHistory = (state: SimulationStore) => state.stateHistory;

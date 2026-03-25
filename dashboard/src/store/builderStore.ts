/**
 * Drone Builder Store
 * State management for the drone builder
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface DroneComponent {
  id: string;
  name: string;
  type: string;
  weight: number;
  position?: Vector3;
  specifications?: Record<string, any>;
}

interface DroneConfig {
  id?: string;
  name: string;
  frame: DroneComponent | null;
  motors: DroneComponent[];
  propellers: DroneComponent[];
  battery: DroneComponent | null;
  esc: DroneComponent | null;
  flightController: DroneComponent | null;
  payload: DroneComponent | null;
  tether: {
    enabled: boolean;
    component: DroneComponent | null;
    length: number;
    anchorPoint: Vector3;
  };
}

interface DroneMetrics {
  totalWeight: number;
  maxThrust: number;
  thrustToWeightRatio: number;
  estimatedFlightTime: number;
  powerConsumption: number;
  centerOfMass: Vector3;
}

interface ValidationResult {
  valid: boolean;
  canFly: boolean;
  errors: string[];
  warnings: string[];
}

interface BuilderState {
  // Current configuration
  config: DroneConfig;

  // Calculated metrics
  metrics: DroneMetrics | null;

  // Validation
  validation: ValidationResult | null;

  // UI State
  selectedComponent: string | null;
  isSimulating: boolean;
  showGrid: boolean;
  showAxes: boolean;

  // History for undo/redo
  history: DroneConfig[];
  historyIndex: number;

  // Actions
  setConfig: (config: Partial<DroneConfig>) => void;
  setFrame: (frame: DroneComponent | null) => void;
  addMotor: (motor: DroneComponent) => void;
  removeMotor: (index: number) => void;
  addPropeller: (propeller: DroneComponent, motorIndex: number) => void;
  setBattery: (battery: DroneComponent | null) => void;
  setEsc: (esc: DroneComponent | null) => void;
  setFlightController: (fc: DroneComponent | null) => void;
  setPayload: (payload: DroneComponent | null) => void;
  setTether: (tether: Partial<DroneConfig['tether']>) => void;
  setMetrics: (metrics: DroneMetrics | null) => void;
  setValidation: (validation: ValidationResult | null) => void;
  setSelectedComponent: (id: string | null) => void;
  setSimulating: (simulating: boolean) => void;
  toggleGrid: () => void;
  toggleAxes: () => void;
  resetConfig: () => void;
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
}

const defaultConfig: DroneConfig = {
  name: 'New Drone',
  frame: null,
  motors: [],
  propellers: [],
  battery: null,
  esc: null,
  flightController: null,
  payload: null,
  tether: {
    enabled: false,
    component: null,
    length: 50,
    anchorPoint: { x: 0, y: 0, z: 0 },
  },
};

export const useBuilderStore = create<BuilderState>()(
  subscribeWithSelector((set, get) => ({
    config: { ...defaultConfig },
    metrics: null,
    validation: null,
    selectedComponent: null,
    isSimulating: false,
    showGrid: true,
    showAxes: false,
    history: [{ ...defaultConfig }],
    historyIndex: 0,

    setConfig: (updates) =>
      set((state) => ({
        config: { ...state.config, ...updates },
      })),

    setFrame: (frame) => {
      const state = get();
      state.saveToHistory();

      // When frame changes, reset motors based on arm count
      const armCount = frame?.specifications?.armCount || 4;
      const motors: DroneComponent[] = [];

      set({
        config: {
          ...state.config,
          frame,
          motors,
          propellers: [],
        },
      });
    },

    addMotor: (motor) =>
      set((state) => {
        state.saveToHistory();
        const maxMotors = state.config.frame?.specifications?.armCount || 4;
        if (state.config.motors.length >= maxMotors) {
          return state;
        }
        return {
          config: {
            ...state.config,
            motors: [...state.config.motors, motor],
          },
        };
      }),

    removeMotor: (index) =>
      set((state) => {
        state.saveToHistory();
        const motors = state.config.motors.filter((_, i) => i !== index);
        const propellers = state.config.propellers.filter((p) => p.specifications?.motorIndex !== index);
        return {
          config: { ...state.config, motors, propellers },
        };
      }),

    addPropeller: (propeller, motorIndex) =>
      set((state) => {
        state.saveToHistory();
        const newPropeller = {
          ...propeller,
          specifications: { ...propeller.specifications, motorIndex },
        };
        return {
          config: {
            ...state.config,
            propellers: [...state.config.propellers, newPropeller],
          },
        };
      }),

    setBattery: (battery) =>
      set((state) => {
        state.saveToHistory();
        return {
          config: { ...state.config, battery },
        };
      }),

    setEsc: (esc) =>
      set((state) => {
        state.saveToHistory();
        return {
          config: { ...state.config, esc },
        };
      }),

    setFlightController: (flightController) =>
      set((state) => {
        state.saveToHistory();
        return {
          config: { ...state.config, flightController },
        };
      }),

    setPayload: (payload) =>
      set((state) => {
        state.saveToHistory();
        return {
          config: { ...state.config, payload },
        };
      }),

    setTether: (tetherUpdates) =>
      set((state) => ({
        config: {
          ...state.config,
          tether: { ...state.config.tether, ...tetherUpdates },
        },
      })),

    setMetrics: (metrics) => set({ metrics }),

    setValidation: (validation) => set({ validation }),

    setSelectedComponent: (selectedComponent) => set({ selectedComponent }),

    setSimulating: (isSimulating) => set({ isSimulating }),

    toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

    toggleAxes: () => set((state) => ({ showAxes: !state.showAxes })),

    resetConfig: () =>
      set({
        config: { ...defaultConfig },
        metrics: null,
        validation: null,
        history: [{ ...defaultConfig }],
        historyIndex: 0,
      }),

    saveToHistory: () =>
      set((state) => {
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push({ ...state.config });
        return {
          history: newHistory.slice(-50), // Keep last 50 states
          historyIndex: newHistory.length - 1,
        };
      }),

    undo: () =>
      set((state) => {
        if (state.historyIndex > 0) {
          const newIndex = state.historyIndex - 1;
          return {
            config: { ...state.history[newIndex] },
            historyIndex: newIndex,
          };
        }
        return state;
      }),

    redo: () =>
      set((state) => {
        if (state.historyIndex < state.history.length - 1) {
          const newIndex = state.historyIndex + 1;
          return {
            config: { ...state.history[newIndex] },
            historyIndex: newIndex,
          };
        }
        return state;
      }),
  }))
);

// Selectors
export const selectConfig = (state: BuilderState) => state.config;
export const selectMetrics = (state: BuilderState) => state.metrics;
export const selectValidation = (state: BuilderState) => state.validation;
export const selectIsSimulating = (state: BuilderState) => state.isSimulating;

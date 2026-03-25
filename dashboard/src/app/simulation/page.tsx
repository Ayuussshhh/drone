/**
 * Simulation Page
 * Real-time drone simulation with live metrics and controls
 */

'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Plane,
  Play,
  Pause,
  RotateCcw,
  Settings,
  Wifi,
  WifiOff,
  Activity,
  Wind,
  Gauge,
  Battery,
  ArrowLeft,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/hooks/useSocket';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// Dynamic import for Three.js viewer
const DroneViewer = dynamic(() => import('@/components/three/DroneViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900">
      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
    </div>
  ),
});

// Types
interface SimulationState {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  motorRpms: number[];
  motorThrusts: number[];
  altitude: number;
  flightStatus: string;
  tetherTension?: number;
  tetherAngle?: number;
  timestamp: number;
}

interface SimulationMetrics {
  thrustToWeightRatio: number;
  totalThrust: number;
  totalWeight: number;
  powerConsumption: number;
  estimatedFlightTime: number;
  stabilityScore: number;
  windSpeed: number;
  dragForce: number;
}

// Default drone configuration
const DEFAULT_CONFIG = {
  id: 'sim_drone',
  name: 'Simulation Drone',
  motors: [
    {
      id: 'motor_0',
      name: 'Motor 1',
      motor_type: 'brushless',
      mass: 0.05,
      kv_rating: 920,
      thrust_constant: 1.5e-5,
      max_rpm: 12000,
      max_current: 20,
      position: { x: 0.159, y: 0, z: 0.159 },
      rotation_direction: 1,
    },
    {
      id: 'motor_1',
      name: 'Motor 2',
      motor_type: 'brushless',
      mass: 0.05,
      kv_rating: 920,
      thrust_constant: 1.5e-5,
      max_rpm: 12000,
      max_current: 20,
      position: { x: -0.159, y: 0, z: 0.159 },
      rotation_direction: -1,
    },
    {
      id: 'motor_2',
      name: 'Motor 3',
      motor_type: 'brushless',
      mass: 0.05,
      kv_rating: 920,
      thrust_constant: 1.5e-5,
      max_rpm: 12000,
      max_current: 20,
      position: { x: -0.159, y: 0, z: -0.159 },
      rotation_direction: 1,
    },
    {
      id: 'motor_3',
      name: 'Motor 4',
      motor_type: 'brushless',
      mass: 0.05,
      kv_rating: 920,
      thrust_constant: 1.5e-5,
      max_rpm: 12000,
      max_current: 20,
      position: { x: 0.159, y: 0, z: -0.159 },
      rotation_direction: -1,
    },
  ],
  propellers: [
    { id: 'prop_0', name: '10x4.5 Propeller', diameter: 0.254, pitch: 0.114, mass: 0.015, blade_count: '2-blade' },
    { id: 'prop_1', name: '10x4.5 Propeller', diameter: 0.254, pitch: 0.114, mass: 0.015, blade_count: '2-blade' },
    { id: 'prop_2', name: '10x4.5 Propeller', diameter: 0.254, pitch: 0.114, mass: 0.015, blade_count: '2-blade' },
    { id: 'prop_3', name: '10x4.5 Propeller', diameter: 0.254, pitch: 0.114, mass: 0.015, blade_count: '2-blade' },
  ],
  battery: { id: 'battery_1', name: '4S 5000mAh LiPo', battery_type: 'LiPo', cell_count: 4, capacity_mah: 5000, mass: 0.5, max_discharge_rate: 50 },
  frame: { id: 'frame_1', name: '450mm Quadcopter Frame', frame_type: 'quad_x', mass: 0.3, arm_length: 0.225, diagonal_distance: 0.45, frontal_area: 0.04 },
};

export default function SimulationPage() {
  // Socket connection
  const {
    isConnected,
    isSimulationActive,
    startSimulation,
    stopSimulation,
    pauseSimulation,
    resumeSimulation,
    resetSimulation,
    updateThrottles,
    setWind,
  } = useSocket({
    autoConnect: true,
    onConnect: () => toast.success('Connected to simulation server'),
    onDisconnect: () => toast.error('Disconnected from server'),
    onError: (error) => toast.error(`Error: ${error}`),
    onStateUpdate: handleStateUpdate,
  });

  // State
  const [simulationState, setSimulationState] = useState<SimulationState | null>(null);
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);
  const [throttle, setThrottle] = useState(50);
  const [windEnabled, setWindEnabled] = useState(false);
  const [windSpeed, setWindSpeed] = useState(5);
  const [windDirection, setWindDirection] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [metricsHistory, setMetricsHistory] = useState<{ time: number; altitude: number; thrust: number }[]>([]);

  // Refs
  const throttleRef = useRef(throttle);
  throttleRef.current = throttle;

  // Handle socket state updates
  function handleStateUpdate(data: any) {
    if (data.state) {
      setSimulationState({
        position: data.state.position || { x: 0, y: 0, z: 0 },
        velocity: data.state.velocity || { x: 0, y: 0, z: 0 },
        rotation: data.state.rotation || { x: 0, y: 0, z: 0 },
        motorRpms: data.state.motor_rpms || [0, 0, 0, 0],
        motorThrusts: data.state.motor_thrusts || [0, 0, 0, 0],
        altitude: data.state.altitude || 0,
        flightStatus: data.state.flight_status || 'unknown',
        tetherTension: data.state.tether_tension,
        tetherAngle: data.state.tether_angle,
        timestamp: data.state.timestamp || Date.now() / 1000,
      });
    }

    if (data.metrics) {
      setMetrics({
        thrustToWeightRatio: data.metrics.thrust_to_weight_ratio || 0,
        totalThrust: data.metrics.total_thrust || 0,
        totalWeight: data.metrics.total_weight || 0,
        powerConsumption: data.metrics.power_consumption || 0,
        estimatedFlightTime: data.metrics.estimated_flight_time || 0,
        stabilityScore: data.stability?.stability_score || 0,
        windSpeed: data.metrics.wind_speed || 0,
        dragForce: data.metrics.drag_force || 0,
      });

      // Update history
      setMetricsHistory(prev => {
        const newEntry = {
          time: Date.now(),
          altitude: data.state?.altitude || 0,
          thrust: data.metrics?.total_thrust || 0,
        };
        const updated = [...prev, newEntry].slice(-100); // Keep last 100 entries
        return updated;
      });
    }
  }

  // Handle throttle change
  const handleThrottleChange = useCallback((value: number) => {
    setThrottle(value);
    if (isSimulationActive) {
      const normalized = value / 100;
      updateThrottles([normalized, normalized, normalized, normalized]);
    }
  }, [isSimulationActive, updateThrottles]);

  // Handle wind update
  useEffect(() => {
    if (isSimulationActive && windEnabled) {
      const radians = (windDirection * Math.PI) / 180;
      setWind(
        {
          x: Math.cos(radians) * windSpeed,
          y: 0,
          z: Math.sin(radians) * windSpeed
        },
        0.2
      );
    } else if (isSimulationActive && !windEnabled) {
      setWind({ x: 0, y: 0, z: 0 }, 0);
    }
  }, [windEnabled, windSpeed, windDirection, isSimulationActive, setWind]);

  // Start/Stop simulation
  const handleToggleSimulation = () => {
    if (isSimulationActive) {
      stopSimulation();
      toast.success('Simulation stopped');
    } else {
      startSimulation(DEFAULT_CONFIG as any, 50);
      toast.success('Simulation started');
    }
  };

  // Build viewer config
  const viewerConfig = {
    frame: {
      type: 'quadcopter' as const,
      armLength: 0.225,
      armCount: 4,
    },
    motors: [
      { id: 'motor_0', position: { x: 0.159, y: 0, z: 0.159 }, thrust: simulationState?.motorThrusts[0] || 0 },
      { id: 'motor_1', position: { x: -0.159, y: 0, z: 0.159 }, thrust: simulationState?.motorThrusts[1] || 0 },
      { id: 'motor_2', position: { x: -0.159, y: 0, z: -0.159 }, thrust: simulationState?.motorThrusts[2] || 0 },
      { id: 'motor_3', position: { x: 0.159, y: 0, z: -0.159 }, thrust: simulationState?.motorThrusts[3] || 0 },
    ],
    propellers: [
      { id: 'prop_0', motorIndex: 0, direction: 'CW' as const, spinning: isSimulationActive },
      { id: 'prop_1', motorIndex: 1, direction: 'CCW' as const, spinning: isSimulationActive },
      { id: 'prop_2', motorIndex: 2, direction: 'CW' as const, spinning: isSimulationActive },
      { id: 'prop_3', motorIndex: 3, direction: 'CCW' as const, spinning: isSimulationActive },
    ],
    battery: { position: { x: 0, y: -0.02, z: 0 } },
  };

  const droneState = simulationState ? {
    position: simulationState.position,
    rotation: {
      roll: simulationState.rotation.x,
      pitch: simulationState.rotation.z,
      yaw: simulationState.rotation.y,
    },
    motorRpms: simulationState.motorRpms,
  } : undefined;

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {/* Header */}
      <header className="h-14 bg-slate-900 border-b border-slate-700 px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">Real-Time Simulation</h1>
              <p className="text-xs text-slate-400">Physics-based drone simulation</p>
            </div>
          </div>
        </div>

        {/* Connection status and controls */}
        <div className="flex items-center gap-4">
          {/* Connection status */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm",
            isConnected ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"
          )}>
            {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>

          {/* Settings toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              showSettings ? "bg-slate-700 text-white" : "hover:bg-slate-800 text-slate-400"
            )}
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Simulation control */}
          <button
            onClick={handleToggleSimulation}
            disabled={!isConnected}
            className={cn(
              "px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors",
              isSimulationActive
                ? "bg-red-600 hover:bg-red-500 text-white"
                : "bg-cyan-600 hover:bg-cyan-500 text-white",
              !isConnected && "opacity-50 cursor-not-allowed"
            )}
          >
            {isSimulationActive ? (
              <>
                <Pause className="w-4 h-4" />
                Stop
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel - Controls */}
        <aside className="w-80 bg-slate-900 border-r border-slate-700 p-4 space-y-4 overflow-y-auto">
          {/* Throttle Control */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-cyan-400" />
              Throttle Control
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Power</span>
                <span className="text-sm font-mono text-cyan-400">{throttle}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={throttle}
                onChange={(e) => handleThrottleChange(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleThrottleChange(0)}
                  className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 rounded transition-colors"
                >
                  0%
                </button>
                <button
                  onClick={() => handleThrottleChange(50)}
                  className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 rounded transition-colors"
                >
                  50%
                </button>
                <button
                  onClick={() => handleThrottleChange(100)}
                  className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 rounded transition-colors"
                >
                  100%
                </button>
              </div>
            </div>
          </div>

          {/* Wind Control */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Wind className="w-4 h-4 text-cyan-400" />
              Wind Simulation
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Enable Wind</span>
                <button
                  onClick={() => setWindEnabled(!windEnabled)}
                  className={cn(
                    "w-10 h-5 rounded-full transition-colors relative",
                    windEnabled ? "bg-cyan-500" : "bg-slate-600"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform",
                    windEnabled ? "translate-x-5" : "translate-x-0.5"
                  )} />
                </button>
              </div>
              {windEnabled && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">Speed</span>
                      <span className="text-xs font-mono text-white">{windSpeed} m/s</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={windSpeed}
                      onChange={(e) => setWindSpeed(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">Direction</span>
                      <span className="text-xs font-mono text-white">{windDirection}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={windDirection}
                      onChange={(e) => setWindDirection(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-white mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={resetSimulation}
                disabled={!isConnected}
                className="py-2 bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 rounded flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <button
                onClick={() => isSimulationActive ? pauseSimulation() : resumeSimulation()}
                disabled={!isConnected || !isSimulationActive}
                className="py-2 bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 rounded flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
              >
                <Pause className="w-3 h-3" />
                Pause
              </button>
            </div>
          </div>
        </aside>

        {/* Center - 3D Viewer */}
        <main className="flex-1 relative min-w-0">
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center bg-slate-900">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              </div>
            }
          >
            <DroneViewer
              config={viewerConfig}
              isSimulating={isSimulationActive}
              droneState={droneState}
              showGrid={true}
              showAxes={true}
            />
          </Suspense>

          {/* Status Overlay */}
          <AnimatePresence>
            {isSimulationActive && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-green-900/80 border border-green-500 rounded-lg flex items-center gap-2"
              >
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-sm text-green-300">
                  {simulationState?.flightStatus || 'Simulation Running'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Right Panel - Metrics */}
        <aside className="w-80 bg-slate-900 border-l border-slate-700 p-4 space-y-4 overflow-y-auto">
          {/* Flight Status */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Flight Status
            </h3>
            <div className="space-y-2">
              <MetricRow
                label="Altitude"
                value={`${(simulationState?.altitude || 0).toFixed(2)} m`}
              />
              <MetricRow
                label="Speed"
                value={`${Math.sqrt(
                  (simulationState?.velocity.x || 0) ** 2 +
                  (simulationState?.velocity.y || 0) ** 2 +
                  (simulationState?.velocity.z || 0) ** 2
                ).toFixed(2)} m/s`}
              />
              <MetricRow
                label="Status"
                value={simulationState?.flightStatus || 'Unknown'}
                status={
                  simulationState?.flightStatus === 'hovering' ? 'good' :
                  simulationState?.flightStatus === 'flying' ? 'good' :
                  simulationState?.flightStatus === 'unstable' ? 'warning' :
                  simulationState?.flightStatus === 'crashed' ? 'error' : undefined
                }
              />
            </div>
          </div>

          {/* Physics Metrics */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-cyan-400" />
              Physics Metrics
            </h3>
            <div className="space-y-2">
              <MetricRow
                label="T/W Ratio"
                value={(metrics?.thrustToWeightRatio || 0).toFixed(2)}
                status={
                  (metrics?.thrustToWeightRatio || 0) >= 2 ? 'good' :
                  (metrics?.thrustToWeightRatio || 0) >= 1.5 ? 'warning' : 'error'
                }
              />
              <MetricRow
                label="Total Thrust"
                value={`${(metrics?.totalThrust || 0).toFixed(1)} N`}
              />
              <MetricRow
                label="Weight"
                value={`${(metrics?.totalWeight || 0).toFixed(1)} N`}
              />
              <MetricRow
                label="Drag Force"
                value={`${(metrics?.dragForce || 0).toFixed(2)} N`}
              />
              <MetricRow
                label="Wind Speed"
                value={`${(metrics?.windSpeed || 0).toFixed(1)} m/s`}
              />
            </div>
          </div>

          {/* Power & Battery */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Battery className="w-4 h-4 text-cyan-400" />
              Power
            </h3>
            <div className="space-y-2">
              <MetricRow
                label="Consumption"
                value={`${(metrics?.powerConsumption || 0).toFixed(1)} W`}
              />
              <MetricRow
                label="Est. Flight Time"
                value={`${Math.floor((metrics?.estimatedFlightTime || 0) / 60)}:${String(Math.floor((metrics?.estimatedFlightTime || 0) % 60)).padStart(2, '0')}`}
              />
              <MetricRow
                label="Stability"
                value={`${(metrics?.stabilityScore || 0).toFixed(0)}%`}
                status={
                  (metrics?.stabilityScore || 0) >= 70 ? 'good' :
                  (metrics?.stabilityScore || 0) >= 40 ? 'warning' : 'error'
                }
              />
            </div>
          </div>

          {/* Motor Outputs */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-white mb-3">Motor Thrusts</h3>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="p-2 bg-slate-700 rounded">
                  <div className="text-xs text-slate-400 mb-1">Motor {i + 1}</div>
                  <div className="h-2 bg-slate-600 rounded overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 transition-all duration-200"
                      style={{
                        width: `${Math.min(100, (simulationState?.motorThrusts[i] || 0) / 15 * 100)}%`
                      }}
                    />
                  </div>
                  <div className="text-xs font-mono text-white mt-1">
                    {(simulationState?.motorThrusts[i] || 0).toFixed(2)} N
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// Metric Row Component
function MetricRow({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: 'good' | 'warning' | 'error';
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <span
        className={cn(
          'text-sm font-mono',
          status === 'good' && 'text-green-400',
          status === 'warning' && 'text-yellow-400',
          status === 'error' && 'text-red-400',
          !status && 'text-white'
        )}
      >
        {value}
      </span>
    </div>
  );
}

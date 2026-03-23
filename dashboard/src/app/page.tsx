/**
 * Main dashboard page for Drone Design & Failure Prediction System.
 */

'use client';

import React, { useEffect, useCallback } from 'react';
import { Plane, Activity, Settings, BarChart3 } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { useSimulationStore } from '@/store/simulationStore';
import { StatusIndicator } from '@/components/StatusIndicator';
import { MetricsDashboard } from '@/components/MetricsDashboard';
import { SimulationControls } from '@/components/SimulationControls';
import { RealTimeGraphs } from '@/components/RealTimeGraphs';
import { ComponentSelector } from '@/components/ComponentSelector';
import type { SocketStateUpdate } from '@/lib/types';

export default function DashboardPage() {
  // Store state
  const {
    isConnected,
    isSimulationActive,
    droneConfig,
    parameters,
    currentState,
    metrics,
    stability,
    stateHistory,
    selectedPanel,
    setConnected,
    setSimulationActive,
    setDroneConfig,
    setParameters,
    updateState,
    setSelectedPanel,
    resetHistory,
  } = useSimulationStore();

  // Handle state updates from socket
  const handleStateUpdate = useCallback(
    (data: SocketStateUpdate) => {
      updateState(data.state, data.metrics, data.stability);
    },
    [updateState]
  );

  // Socket connection
  const socket = useSocket({
    autoConnect: true,
    onConnect: () => setConnected(true),
    onDisconnect: () => {
      setConnected(false);
      setSimulationActive(false);
    },
    onStateUpdate: handleStateUpdate,
    onError: (error) => console.error('Socket error:', error),
  });

  // Update simulation active state
  useEffect(() => {
    setSimulationActive(socket.isSimulationActive);
  }, [socket.isSimulationActive, setSimulationActive]);

  // Handlers
  const handleStart = () => {
    resetHistory();
    socket.startSimulation(droneConfig, 50);
  };

  const handleStop = () => {
    socket.stopSimulation();
  };

  const handlePause = () => {
    socket.pauseSimulation();
  };

  const handleResume = () => {
    socket.resumeSimulation();
  };

  const handleReset = () => {
    resetHistory();
    socket.resetSimulation();
  };

  const handleUpdateThrottles = (throttles: number[]) => {
    socket.updateThrottles(throttles);
  };

  const handleUpdateParameters = (params: Partial<typeof parameters>) => {
    setParameters(params);
    socket.updateParameters({ ...parameters, ...params });
  };

  const handleSetWind = (
    velocity: { x: number; y: number; z: number },
    turbulence: number
  ) => {
    socket.setWind(velocity, turbulence);
  };

  // Navigation tabs
  const tabs = [
    { id: 'metrics', label: 'Metrics', icon: Activity },
    { id: 'charts', label: 'Charts', icon: BarChart3 },
    { id: 'config', label: 'Config', icon: Settings },
  ] as const;

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Header */}
      <header className="bg-surface-900 border-b border-surface-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <Plane className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-surface-100">
                Drone Design & Failure Prediction
              </h1>
              <p className="text-sm text-surface-400">
                Real-time physics simulation and stability analysis
              </p>
            </div>
          </div>

          {/* Connection indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-400' : 'bg-red-400'
              }`}
            />
            <span className="text-sm text-surface-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Sidebar - Status & Controls */}
        <aside className="w-80 bg-surface-900 border-r border-surface-800 p-4 space-y-4 overflow-y-auto">
          <StatusIndicator
            isConnected={isConnected}
            isSimulationActive={isSimulationActive}
            flightStatus={currentState?.flight_status}
            stabilityClass={stability?.stability_class}
            stabilityScore={stability?.stability_score ?? 100}
          />

          <SimulationControls
            isConnected={isConnected}
            isSimulationActive={isSimulationActive}
            parameters={parameters}
            onStart={handleStart}
            onStop={handleStop}
            onPause={handlePause}
            onResume={handleResume}
            onReset={handleReset}
            onUpdateThrottles={handleUpdateThrottles}
            onUpdateParameters={handleUpdateParameters}
            onSetWind={handleSetWind}
          />

          {/* Warnings Display */}
          {stability && stability.warnings.length > 0 && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-yellow-400 mb-2">
                Warnings
              </h4>
              <ul className="text-xs text-yellow-300 space-y-1">
                {stability.warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {stability && stability.critical_issues.length > 0 && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-red-400 mb-2">
                Critical Issues
              </h4>
              <ul className="text-xs text-red-300 space-y-1">
                {stability.critical_issues.map((issue, index) => (
                  <li key={index}>• {issue}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* Main Panel */}
        <main className="flex-1 overflow-y-auto">
          {/* Tab Navigation */}
          <div className="bg-surface-900 border-b border-surface-800 px-6">
            <nav className="flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedPanel(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    selectedPanel === tab.id
                      ? 'text-primary-400 border-primary-400'
                      : 'text-surface-400 border-transparent hover:text-surface-200'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Panel Content */}
          <div className="p-6">
            {selectedPanel === 'metrics' && (
              <MetricsDashboard metrics={metrics} state={currentState} />
            )}

            {selectedPanel === 'charts' && (
              <RealTimeGraphs data={stateHistory} />
            )}

            {selectedPanel === 'config' && (
              <ComponentSelector
                config={droneConfig}
                onUpdateConfig={setDroneConfig}
              />
            )}
          </div>
        </main>

        {/* Right Sidebar - Quick Stats */}
        <aside className="w-64 bg-surface-900 border-l border-surface-800 p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">
            Quick Stats
          </h3>

          <div className="space-y-4">
            <QuickStat
              label="Altitude"
              value={currentState?.altitude ?? 0}
              unit="m"
              color="text-green-400"
            />
            <QuickStat
              label="Air Speed"
              value={currentState?.air_speed ?? 0}
              unit="m/s"
              color="text-blue-400"
            />
            <QuickStat
              label="Thrust"
              value={metrics?.total_thrust ?? 0}
              unit="N"
              color="text-cyan-400"
            />
            <QuickStat
              label="T/W Ratio"
              value={metrics?.thrust_to_weight_ratio ?? 0}
              unit=""
              color={
                (metrics?.thrust_to_weight_ratio ?? 0) >= 1.5
                  ? 'text-green-400'
                  : (metrics?.thrust_to_weight_ratio ?? 0) >= 1.0
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }
            />
            <QuickStat
              label="Power"
              value={metrics?.power_consumption ?? 0}
              unit="W"
              color="text-yellow-400"
            />
            <QuickStat
              label="Tether"
              value={currentState?.tether_tension ?? 0}
              unit="N"
              color="text-orange-400"
            />
            <QuickStat
              label="Stability"
              value={stability?.stability_score ?? 100}
              unit="%"
              color="text-purple-400"
            />
          </div>

          {/* Timestamp */}
          <div className="mt-6 text-xs text-surface-500 text-center">
            Sim Time: {(currentState?.timestamp ?? 0).toFixed(2)}s
          </div>
        </aside>
      </div>
    </div>
  );
}

// Quick stat component
interface QuickStatProps {
  label: string;
  value: number;
  unit: string;
  color: string;
}

function QuickStat({ label, value, unit, color }: QuickStatProps) {
  return (
    <div className="bg-surface-800 rounded-lg p-3">
      <div className="text-xs text-surface-500 mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-bold font-mono ${color}`}>
          {value.toFixed(2)}
        </span>
        <span className="text-xs text-surface-500">{unit}</span>
      </div>
    </div>
  );
}

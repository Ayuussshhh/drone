/**
 * Status indicator component showing connection and flight status.
 */

'use client';

import React from 'react';
import { Wifi, WifiOff, Plane, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { FlightStatus, StabilityClass } from '@/lib/types';

interface StatusIndicatorProps {
  isConnected: boolean;
  isSimulationActive: boolean;
  flightStatus?: FlightStatus;
  stabilityClass?: StabilityClass;
  stabilityScore?: number;
}

export function StatusIndicator({
  isConnected,
  isSimulationActive,
  flightStatus = 'grounded',
  stabilityClass = 'stable',
  stabilityScore = 100,
}: StatusIndicatorProps) {
  const getFlightStatusConfig = () => {
    switch (flightStatus) {
      case 'flying':
        return { icon: Plane, color: 'text-green-400', bg: 'bg-green-400/20', label: 'Flying' };
      case 'hovering':
        return { icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-400/20', label: 'Hovering' };
      case 'unstable':
        return { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-400/20', label: 'Unstable' };
      case 'crashed':
        return { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/20', label: 'Crashed' };
      default:
        return { icon: Plane, color: 'text-gray-400', bg: 'bg-gray-400/20', label: 'Grounded' };
    }
  };

  const getStabilityConfig = () => {
    switch (stabilityClass) {
      case 'stable':
        return { color: 'text-green-400', barColor: 'bg-green-400' };
      case 'marginal':
        return { color: 'text-yellow-400', barColor: 'bg-yellow-400' };
      case 'unstable':
        return { color: 'text-orange-400', barColor: 'bg-orange-400' };
      case 'critical':
        return { color: 'text-red-400', barColor: 'bg-red-400' };
      default:
        return { color: 'text-gray-400', barColor: 'bg-gray-400' };
    }
  };

  const flightConfig = getFlightStatusConfig();
  const stabilityConfig = getStabilityConfig();
  const FlightIcon = flightConfig.icon;

  return (
    <div className="bg-surface-800 rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">
        System Status
      </h3>

      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="w-5 h-5 text-green-400" />
          ) : (
            <WifiOff className="w-5 h-5 text-red-400" />
          )}
          <span className="text-sm text-surface-300">Backend</span>
        </div>
        <span
          className={`text-sm font-medium ${
            isConnected ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Simulation Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isSimulationActive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
            }`}
          />
          <span className="text-sm text-surface-300">Simulation</span>
        </div>
        <span
          className={`text-sm font-medium ${
            isSimulationActive ? 'text-green-400' : 'text-surface-500'
          }`}
        >
          {isSimulationActive ? 'Running' : 'Stopped'}
        </span>
      </div>

      {/* Flight Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlightIcon className={`w-5 h-5 ${flightConfig.color}`} />
          <span className="text-sm text-surface-300">Flight</span>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${flightConfig.bg} ${flightConfig.color}`}
        >
          {flightConfig.label}
        </span>
      </div>

      {/* Stability Score */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-surface-300">Stability</span>
          <span className={`text-sm font-bold ${stabilityConfig.color}`}>
            {stabilityScore.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${stabilityConfig.barColor} transition-all duration-300`}
            style={{ width: `${stabilityScore}%` }}
          />
        </div>
        <div className="text-xs text-center text-surface-500 capitalize">
          {stabilityClass}
        </div>
      </div>
    </div>
  );
}

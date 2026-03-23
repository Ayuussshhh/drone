/**
 * Simulation control panel component.
 */

'use client';

import React, { useState } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Settings,
  Wind,
  Sliders,
} from 'lucide-react';
import type { SimulationParameters, Vector3 } from '@/lib/types';

interface SimulationControlsProps {
  isConnected: boolean;
  isSimulationActive: boolean;
  parameters: SimulationParameters;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onUpdateThrottles: (throttles: number[]) => void;
  onUpdateParameters: (params: Partial<SimulationParameters>) => void;
  onSetWind: (velocity: Vector3, turbulence: number) => void;
}

export function SimulationControls({
  isConnected,
  isSimulationActive,
  parameters,
  onStart,
  onStop,
  onPause,
  onResume,
  onReset,
  onUpdateThrottles,
  onUpdateParameters,
  onSetWind,
}: SimulationControlsProps) {
  const [showWindSettings, setShowWindSettings] = useState(false);
  const [throttle, setThrottle] = useState(50);
  const [windSpeed, setWindSpeed] = useState(0);
  const [windDirection, setWindDirection] = useState(0);
  const [turbulence, setTurbulence] = useState(20);

  const handleThrottleChange = (value: number) => {
    setThrottle(value);
    const throttleValue = value / 100;
    onUpdateThrottles([throttleValue, throttleValue, throttleValue, throttleValue]);
  };

  const handleWindApply = () => {
    const dirRad = (windDirection * Math.PI) / 180;
    const velocity: Vector3 = {
      x: Math.sin(dirRad) * windSpeed,
      y: 0,
      z: Math.cos(dirRad) * windSpeed,
    };
    onSetWind(velocity, turbulence / 100);
  };

  return (
    <div className="bg-surface-900 rounded-xl p-6 space-y-6">
      <h2 className="text-lg font-semibold text-surface-200 flex items-center gap-2">
        <Sliders className="w-5 h-5 text-primary-400" />
        Simulation Controls
      </h2>

      {/* Main Controls */}
      <div className="flex flex-wrap gap-3">
        {!isSimulationActive ? (
          <button
            onClick={onStart}
            disabled={!isConnected}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-surface-700 disabled:text-surface-500 rounded-lg font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            Start
          </button>
        ) : (
          <>
            <button
              onClick={onPause}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-medium transition-colors"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
            <button
              onClick={onStop}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-medium transition-colors"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          </>
        )}

        <button
          onClick={onReset}
          disabled={!isConnected}
          className="flex items-center gap-2 px-4 py-2 bg-surface-700 hover:bg-surface-600 disabled:bg-surface-800 disabled:text-surface-500 rounded-lg font-medium transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>

        <button
          onClick={() => setShowWindSettings(!showWindSettings)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            showWindSettings
              ? 'bg-primary-600 text-white'
              : 'bg-surface-700 hover:bg-surface-600'
          }`}
        >
          <Wind className="w-4 h-4" />
          Wind
        </button>
      </div>

      {/* Throttle Control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-surface-300">Master Throttle</label>
          <span className="text-sm font-mono text-primary-400">{throttle}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={throttle}
          onChange={(e) => handleThrottleChange(Number(e.target.value))}
          className="w-full h-2 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
        />
        <div className="flex justify-between text-xs text-surface-500">
          <span>0%</span>
          <span>Hover ~{Math.round(Math.sqrt(1 / 2.1) * 100)}%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Wind Settings */}
      {showWindSettings && (
        <div className="bg-surface-800 rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-semibold text-surface-300">
            Wind Settings
          </h3>

          {/* Wind Speed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-surface-400">Speed</label>
              <span className="text-sm font-mono text-cyan-400">
                {windSpeed} m/s
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              step="0.5"
              value={windSpeed}
              onChange={(e) => setWindSpeed(Number(e.target.value))}
              className="w-full h-2 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          {/* Wind Direction */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-surface-400">Direction</label>
              <span className="text-sm font-mono text-cyan-400">
                {windDirection}°
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={windDirection}
              onChange={(e) => setWindDirection(Number(e.target.value))}
              className="w-full h-2 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          {/* Turbulence */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-surface-400">Turbulence</label>
              <span className="text-sm font-mono text-cyan-400">
                {turbulence}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={turbulence}
              onChange={(e) => setTurbulence(Number(e.target.value))}
              className="w-full h-2 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          <button
            onClick={handleWindApply}
            className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-medium transition-colors"
          >
            Apply Wind
          </button>
        </div>
      )}

      {/* Quick Toggles */}
      <div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-2 text-sm text-surface-300">
          <input
            type="checkbox"
            checked={parameters.use_auto_stabilization}
            onChange={(e) =>
              onUpdateParameters({ use_auto_stabilization: e.target.checked })
            }
            className="w-4 h-4 rounded bg-surface-700 border-surface-600"
          />
          Auto Stabilization
        </label>

        <label className="flex items-center gap-2 text-sm text-surface-300">
          <input
            type="checkbox"
            checked={parameters.enable_wind}
            onChange={(e) =>
              onUpdateParameters({ enable_wind: e.target.checked })
            }
            className="w-4 h-4 rounded bg-surface-700 border-surface-600"
          />
          Enable Wind
        </label>

        <label className="flex items-center gap-2 text-sm text-surface-300">
          <input
            type="checkbox"
            checked={parameters.enable_tether}
            onChange={(e) =>
              onUpdateParameters({ enable_tether: e.target.checked })
            }
            className="w-4 h-4 rounded bg-surface-700 border-surface-600"
          />
          Enable Tether
        </label>
      </div>
    </div>
  );
}

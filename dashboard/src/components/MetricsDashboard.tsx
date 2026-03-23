/**
 * Real-time metrics dashboard component.
 */

'use client';

import React from 'react';
import {
  Gauge,
  Weight,
  Wind,
  Zap,
  Timer,
  ArrowUp,
  RotateCcw,
  Anchor,
} from 'lucide-react';
import type { PhysicsMetrics, SimulationState } from '@/lib/types';

interface MetricsDashboardProps {
  metrics: PhysicsMetrics | null;
  state: SimulationState | null;
}

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  unit: string;
  color?: string;
  subValue?: string;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  color = 'text-primary-400',
  subValue,
}: MetricCardProps) {
  return (
    <div className="bg-surface-800/50 rounded-lg p-4 border border-surface-700">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-surface-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold font-mono ${color}`}>
          {typeof value === 'number' ? value.toFixed(2) : value}
        </span>
        <span className="text-sm text-surface-500">{unit}</span>
      </div>
      {subValue && (
        <div className="text-xs text-surface-500 mt-1">{subValue}</div>
      )}
    </div>
  );
}

export function MetricsDashboard({ metrics, state }: MetricsDashboardProps) {
  if (!metrics || !state) {
    return (
      <div className="bg-surface-900 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-surface-200 mb-4">
          Physics Metrics
        </h2>
        <div className="text-center text-surface-500 py-8">
          Start simulation to see metrics
        </div>
      </div>
    );
  }

  const twrColor =
    metrics.thrust_to_weight_ratio >= 1.5
      ? 'text-green-400'
      : metrics.thrust_to_weight_ratio >= 1.2
      ? 'text-yellow-400'
      : metrics.thrust_to_weight_ratio >= 1.0
      ? 'text-orange-400'
      : 'text-red-400';

  return (
    <div className="bg-surface-900 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-surface-200 mb-4 flex items-center gap-2">
        <Gauge className="w-5 h-5 text-primary-400" />
        Physics Metrics
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Thrust */}
        <MetricCard
          icon={ArrowUp}
          label="Total Thrust"
          value={metrics.total_thrust}
          unit="N"
          color="text-blue-400"
        />

        {/* Weight */}
        <MetricCard
          icon={Weight}
          label="Weight"
          value={metrics.total_weight}
          unit="N"
          subValue={`Mass: ${metrics.total_mass.toFixed(2)} kg`}
        />

        {/* T/W Ratio */}
        <MetricCard
          icon={Gauge}
          label="T/W Ratio"
          value={metrics.thrust_to_weight_ratio}
          unit=""
          color={twrColor}
          subValue={
            metrics.thrust_to_weight_ratio >= 1.0 ? 'Can fly' : 'Cannot fly'
          }
        />

        {/* Altitude */}
        <MetricCard
          icon={ArrowUp}
          label="Altitude"
          value={state.altitude}
          unit="m"
          color="text-cyan-400"
        />

        {/* Air Speed */}
        <MetricCard
          icon={Wind}
          label="Air Speed"
          value={state.air_speed}
          unit="m/s"
          color="text-teal-400"
        />

        {/* Wind */}
        <MetricCard
          icon={Wind}
          label="Wind Speed"
          value={metrics.wind_speed}
          unit="m/s"
          color="text-purple-400"
        />

        {/* Power */}
        <MetricCard
          icon={Zap}
          label="Power"
          value={metrics.power_consumption}
          unit="W"
          color="text-yellow-400"
        />

        {/* Flight Time */}
        <MetricCard
          icon={Timer}
          label="Est. Flight Time"
          value={Math.round(metrics.estimated_flight_time / 60)}
          unit="min"
          color="text-green-400"
        />

        {/* Tether */}
        {metrics.tether_tension > 0 && (
          <MetricCard
            icon={Anchor}
            label="Tether Tension"
            value={metrics.tether_tension}
            unit="N"
            color="text-orange-400"
            subValue={`Angle: ${metrics.tether_angle.toFixed(1)}°`}
          />
        )}

        {/* Drag */}
        <MetricCard
          icon={RotateCcw}
          label="Drag Force"
          value={metrics.drag_force}
          unit="N"
          color="text-red-400"
        />
      </div>

      {/* Motor Thrusts */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-surface-300 mb-3">
          Motor Thrusts
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {metrics.thrust_per_motor.map((thrust, index) => (
            <div
              key={index}
              className="bg-surface-800 rounded-lg p-3 text-center"
            >
              <div className="text-xs text-surface-500 mb-1">M{index + 1}</div>
              <div className="text-lg font-mono font-bold text-primary-400">
                {thrust.toFixed(1)}
              </div>
              <div className="text-xs text-surface-500">N</div>
              {/* Thrust bar */}
              <div className="mt-2 h-1 bg-surface-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 transition-all duration-150"
                  style={{
                    width: `${Math.min(100, (thrust / 10) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Position & Velocity */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="bg-surface-800 rounded-lg p-4">
          <h4 className="text-xs text-surface-400 uppercase mb-2">Position</h4>
          <div className="grid grid-cols-3 gap-2 text-sm font-mono">
            <div>
              <span className="text-surface-500">X:</span>{' '}
              <span className="text-cyan-400">{state.position.x.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-surface-500">Y:</span>{' '}
              <span className="text-green-400">{state.position.y.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-surface-500">Z:</span>{' '}
              <span className="text-blue-400">{state.position.z.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-800 rounded-lg p-4">
          <h4 className="text-xs text-surface-400 uppercase mb-2">Velocity</h4>
          <div className="grid grid-cols-3 gap-2 text-sm font-mono">
            <div>
              <span className="text-surface-500">X:</span>{' '}
              <span className="text-cyan-400">{state.velocity.x.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-surface-500">Y:</span>{' '}
              <span className="text-green-400">{state.velocity.y.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-surface-500">Z:</span>{' '}
              <span className="text-blue-400">{state.velocity.z.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

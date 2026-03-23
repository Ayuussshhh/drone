/**
 * Real-time charts component using Recharts.
 */

'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { Activity, TrendingUp, Gauge } from 'lucide-react';
import type { TimeSeriesDataPoint } from '@/lib/types';

interface RealTimeGraphsProps {
  data: TimeSeriesDataPoint[];
}

export function RealTimeGraphs({ data }: RealTimeGraphsProps) {
  // Format data for display
  const formattedData = data.map((point) => ({
    ...point,
    time: point.timestamp.toFixed(1),
  }));

  // Show last 100 points
  const displayData = formattedData.slice(-100);

  if (displayData.length === 0) {
    return (
      <div className="bg-surface-900 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-surface-200 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary-400" />
          Real-Time Data
        </h2>
        <div className="text-center text-surface-500 py-8">
          Start simulation to see graphs
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface-800 border border-surface-600 rounded-lg p-3 shadow-xl">
          <p className="text-xs text-surface-400 mb-1">Time: {label}s</p>
          {payload.map((entry: any, index: number) => (
            <p
              key={index}
              className="text-sm"
              style={{ color: entry.color }}
            >
              {entry.name}: {entry.value.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-surface-900 rounded-xl p-6 space-y-6">
      <h2 className="text-lg font-semibold text-surface-200 flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary-400" />
        Real-Time Data
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Altitude & Speed Chart */}
        <div className="bg-surface-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-surface-300 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            Altitude & Speed
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  vertical={false}
                />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="altitude"
                  name="Altitude (m)"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="airSpeed"
                  name="Speed (m/s)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Thrust Chart */}
        <div className="bg-surface-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-surface-300 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            Thrust
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  vertical={false}
                />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="thrust"
                  name="Thrust (N)"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.3}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stability Score Chart */}
        <div className="bg-surface-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-surface-300 mb-3 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-purple-400" />
            Stability Score
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  vertical={false}
                />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  width={40}
                  domain={[0, 100]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="stability"
                  name="Stability (%)"
                  stroke="#a855f7"
                  fill="#a855f7"
                  fillOpacity={0.3}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tether Tension Chart */}
        <div className="bg-surface-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-surface-300 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-orange-400" />
            Tether Tension
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  vertical={false}
                />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="tetherTension"
                  name="Tension (N)"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

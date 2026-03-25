/**
 * Professional Drone Configuration Panel
 * Redesigned with proper data access and beautiful UI
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Trash2,
  Edit2,
  Save,
  X,
  Zap,
  Battery,
  Box,
  Anchor,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  Fan,
  Cpu,
  Radio,
  Package,
  TrendingUp,
  Weight,
  Gauge,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DroneConfig {
  name: string;
  frame: any;
  motors: any[];
  propellers: any[];
  battery: any;
  esc: any;
  flightController: any;
  payload?: any;
  tether?: any;
}

interface ConfigurationPanelProps {
  config: DroneConfig;
  metrics?: {
    totalWeight: number;
    maxThrust: number;
    thrustToWeightRatio: number;
    estimatedFlightTime: number;
  };
  validation?: {
    valid: boolean;
    canFly?: boolean;
    errors: string[];
    warnings: string[];
  };
  onUpdateConfig: (updates: Partial<DroneConfig>) => void;
  onRemoveComponent: (type: string, index?: number) => void;
  onSave: () => void;
}

export default function ConfigurationPanel({
  config,
  metrics,
  validation,
  onUpdateConfig,
  onRemoveComponent,
  onSave,
}: ConfigurationPanelProps) {
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(config.name);

  const handleSaveName = () => {
    onUpdateConfig({ name: newName });
    setEditingName(false);
  };

  const components = [
    { key: 'frame', label: 'Frame', icon: Box, data: config.frame, count: config.frame ? 1 : 0 },
    { key: 'motors', label: 'Motors', icon: Zap, data: config.motors, count: config.motors?.length || 0 },
    { key: 'propellers', label: 'Propellers', icon: Fan, data: config.propellers, count: config.propellers?.length || 0 },
    { key: 'battery', label: 'Battery', icon: Battery, data: config.battery, count: config.battery ? 1 : 0 },
    { key: 'esc', label: 'ESC', icon: Cpu, data: config.esc, count: config.esc ? 1 : 0 },
    { key: 'flight_controller', label: 'Flight Controller', icon: Radio, data: config.flightController, count: config.flightController ? 1 : 0 },
    { key: 'payload', label: 'Payload', icon: Package, data: config.payload, count: config.payload ? 1 : 0 },
    { key: 'tether', label: 'Tether', icon: Anchor, data: config.tether, count: config.tether?.enabled ? 1 : 0 },
  ];

  const totalComponents = components.reduce((acc, comp) => acc + comp.count, 0);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
      {/* Modern Header */}
      <div className="p-6 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 px-4 py-2 bg-slate-800/50 border border-cyan-500/50 rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
            />
            <button
              onClick={handleSaveName}
              className="p-2 hover:bg-green-500/10 text-green-400 rounded-lg transition-colors"
            >
              <Save className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setNewName(config.name);
                setEditingName(false);
              }}
              className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setEditingName(true)}
              className="flex items-center gap-2 group"
            >
              <h2 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">
                {config.name}
              </h2>
              <Edit2 className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
            </button>
          </div>
        )}

        {/* Status Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-full">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-medium text-slate-300">{totalComponents} Components</span>
          </div>

          {validation && (
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium',
                validation.canFly
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-red-500/10 text-red-400'
              )}
            >
              {validation.canFly ? (
                <>
                  <CheckCircle className="w-3 h-3" />
                  Flight Ready
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3" />
                  Not Ready
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      {metrics && (
        <div className="p-6 grid grid-cols-2 gap-3 border-b border-slate-700/50">
          <MetricCard
            icon={Weight}
            label="Total Mass"
            value={`${(metrics.totalWeight / 1000).toFixed(2)} kg`}
            color="text-blue-400"
          />
          <MetricCard
            icon={TrendingUp}
            label="Max Thrust"
            value={`${(metrics.maxThrust / 1000).toFixed(2)} kg`}
            color="text-purple-400"
          />
          <MetricCard
            icon={Gauge}
            label="T/W Ratio"
            value={metrics.thrustToWeightRatio.toFixed(2)}
            color={
              metrics.thrustToWeightRatio >= 2
                ? 'text-green-400'
                : metrics.thrustToWeightRatio >= 1.5
                ? 'text-yellow-400'
                : 'text-red-400'
            }
          />
          <MetricCard
            icon={Battery}
            label="Flight Time"
            value={`${metrics.estimatedFlightTime.toFixed(0)}m`}
            color="text-cyan-400"
          />
        </div>
      )}

      {/* Components List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        {components.map((comp) => (
          <ComponentSection
            key={comp.key}
            label={comp.label}
            icon={comp.icon}
            count={comp.count}
            data={comp.data}
            type={comp.key}
            onRemove={onRemoveComponent}
          />
        ))}

        {/* Validation Messages */}
        {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
          <div className="mt-4 space-y-2">
            {validation.errors.map((error, i) => (
              <div
                key={`error-${i}`}
                className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
              >
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-red-300">{error}</span>
              </div>
            ))}
            {validation.warnings.map((warning, i) => (
              <div
                key={`warning-${i}`}
                className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"
              >
                <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-yellow-300">{warning}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="p-4 border-t border-slate-700/50 bg-slate-900/80 backdrop-blur-sm space-y-2">
        <button
          onClick={onSave}
          disabled={!validation?.valid}
          className={cn(
            'w-full py-3 rounded-xl font-semibold text-white transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2',
            validation?.valid
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-lg hover:shadow-cyan-500/50'
              : 'bg-slate-700 cursor-not-allowed opacity-50'
          )}
        >
          <Save className="w-5 h-5" />
          Save Configuration
        </button>
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3 hover:bg-slate-800/50 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('w-4 h-4', color)} />
        <span className="text-xs text-slate-400 font-medium">{label}</span>
      </div>
      <div className={cn('text-xl font-bold', color)}>{value}</div>
    </div>
  );
}

// Component Section
function ComponentSection({
  label,
  icon: Icon,
  count,
  data,
  type,
  onRemove,
}: {
  label: string;
  icon: React.ElementType;
  count: number;
  data: any;
  type: string;
  onRemove: (type: string, index?: number) => void;
}) {
  const [expanded, setExpanded] = useState(count > 0);

  React.useEffect(() => {
    if (count > 0) setExpanded(true);
  }, [count]);

  const renderComponent = (item: any, index?: number) => {
    if (!item) return null;

    let details: string[] = [];
    let name = item.name || 'Unknown';

    // Extract details based on type
    if (type === 'frame') {
      details = [
        item.specifications?.type || item.specifications?.frame_type || 'Quad',
        item.specifications?.armCount ? `${item.specifications.armCount} arms` : '',
        item.weight ? `${item.weight}g` : '',
      ].filter(Boolean);
    } else if (type === 'motors') {
      details = [
        `Motor ${(index || 0) + 1}`,
        item.specifications?.kv_rating ? `${item.specifications.kv_rating}KV` : '',
        item.weight ? `${item.weight}g` : '',
      ].filter(Boolean);
    } else if (type === 'propellers') {
      details = [
        `Prop ${(index || 0) + 1}`,
        item.specifications?.diameter ? `${(item.specifications.diameter * 39.37).toFixed(1)}"` : '',
        item.weight ? `${item.weight}g` : '',
      ].filter(Boolean);
    } else if (type === 'battery') {
      details = [
        item.specifications?.cell_count ? `${item.specifications.cell_count}S` : '',
        item.specifications?.capacity_mah ? `${item.specifications.capacity_mah}mAh` : '',
        item.weight ? `${item.weight}g` : '',
      ].filter(Boolean);
    } else if (type === 'esc') {
      details = [
        item.specifications?.max_current ? `${item.specifications.max_current}A` : '',
        item.weight ? `${item.weight}g` : '',
      ].filter(Boolean);
    } else if (type === 'flight_controller') {
      details = [
        item.specifications?.processor || '',
        item.weight ? `${item.weight}g` : '',
      ].filter(Boolean);
    } else if (type === 'payload') {
      details = [item.weight ? `${item.weight}g` : ''].filter(Boolean);
    } else if (type === 'tether') {
      details = [
        item.component?.specifications?.length_m ? `${item.component.specifications.length_m}m` : `${item.length || 0}m`,
        item.component?.specifications?.max_tension_n ? `${item.component.specifications.max_tension_n}N` : '',
      ].filter(Boolean);
      name = item.component?.name || 'Tether System';
    }

    return (
      <div
        key={`${type}-${index}`}
        className="group flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 rounded-lg transition-all"
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{name}</div>
          {details.length > 0 && (
            <div className="text-xs text-slate-400 mt-1">{details.join(' • ')}</div>
          )}
        </div>
        <button
          onClick={() => onRemove(type, index)}
          className="ml-2 p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-400 rounded-lg transition-all"
          title="Remove component"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="bg-slate-800/20 border border-slate-700/30 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-cyan-400" />
          <span className="text-sm font-semibold text-white">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'px-2 py-1 rounded-full text-xs font-bold',
              count > 0
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'bg-slate-700/50 text-slate-400'
            )}
          >
            {count}
          </span>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-slate-400 transition-transform duration-200',
              expanded && 'transform rotate-180'
            )}
          />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              {count === 0 ? (
                <div className="p-4 border-2 border-dashed border-slate-700/50 rounded-lg text-center">
                  <span className="text-xs text-slate-500">
                    No {label.toLowerCase()} added yet
                  </span>
                </div>
              ) : Array.isArray(data) ? (
                data.map((item, index) => renderComponent(item, index))
              ) : (
                renderComponent(data)
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

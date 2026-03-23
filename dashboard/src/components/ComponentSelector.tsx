/**
 * Component selector panel for configuring drone components.
 */

'use client';

import React, { useState } from 'react';
import {
  Cog,
  Disc,
  Battery,
  Box,
  Anchor,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { DroneConfiguration, Motor, Frame } from '@/lib/types';

interface ComponentSelectorProps {
  config: DroneConfiguration;
  onUpdateConfig: (config: DroneConfiguration) => void;
}

export function ComponentSelector({
  config,
  onUpdateConfig,
}: ComponentSelectorProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('motors');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const updateMotor = (index: number, field: keyof Motor, value: number) => {
    const newMotors = [...config.motors];
    newMotors[index] = { ...newMotors[index], [field]: value };
    onUpdateConfig({ ...config, motors: newMotors });
  };

  const updateFrame = (field: keyof Frame, value: number) => {
    onUpdateConfig({
      ...config,
      frame: { ...config.frame, [field]: value },
    });
  };

  const updateBattery = (field: string, value: number) => {
    onUpdateConfig({
      ...config,
      battery: { ...config.battery, [field]: value },
    });
  };

  return (
    <div className="bg-surface-900 rounded-xl p-4 space-y-2">
      <h2 className="text-lg font-semibold text-surface-200 px-2 pb-2">
        Configuration
      </h2>

      {/* Motors Section */}
      <CollapsibleSection
        title="Motors"
        icon={Cog}
        expanded={expandedSection === 'motors'}
        onToggle={() => toggleSection('motors')}
      >
        <div className="space-y-4">
          {config.motors.map((motor, index) => (
            <div key={motor.id} className="bg-surface-800 rounded-lg p-3">
              <div className="text-sm font-medium text-surface-300 mb-2">
                Motor {index + 1}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumberInput
                  label="Mass (kg)"
                  value={motor.mass}
                  onChange={(v) => updateMotor(index, 'mass', v)}
                  step={0.01}
                  min={0.01}
                  max={0.5}
                />
                <NumberInput
                  label="Max RPM"
                  value={motor.max_rpm}
                  onChange={(v) => updateMotor(index, 'max_rpm', v)}
                  step={100}
                  min={1000}
                  max={30000}
                />
                <NumberInput
                  label="KV Rating"
                  value={motor.kv_rating}
                  onChange={(v) => updateMotor(index, 'kv_rating', v)}
                  step={10}
                  min={100}
                  max={5000}
                />
                <NumberInput
                  label="Max Current (A)"
                  value={motor.max_current}
                  onChange={(v) => updateMotor(index, 'max_current', v)}
                  step={1}
                  min={1}
                  max={100}
                />
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Frame Section */}
      <CollapsibleSection
        title="Frame"
        icon={Box}
        expanded={expandedSection === 'frame'}
        onToggle={() => toggleSection('frame')}
      >
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            label="Mass (kg)"
            value={config.frame.mass}
            onChange={(v) => updateFrame('mass', v)}
            step={0.05}
            min={0.1}
            max={2}
          />
          <NumberInput
            label="Arm Length (m)"
            value={config.frame.arm_length}
            onChange={(v) => updateFrame('arm_length', v)}
            step={0.01}
            min={0.05}
            max={0.5}
          />
          <NumberInput
            label="Frontal Area (m²)"
            value={config.frame.frontal_area}
            onChange={(v) => updateFrame('frontal_area', v)}
            step={0.01}
            min={0.01}
            max={0.2}
          />
          <NumberInput
            label="Drag Coefficient"
            value={config.frame.drag_coefficient || 1.0}
            onChange={(v) => updateFrame('drag_coefficient', v)}
            step={0.1}
            min={0.1}
            max={2}
          />
        </div>
      </CollapsibleSection>

      {/* Battery Section */}
      <CollapsibleSection
        title="Battery"
        icon={Battery}
        expanded={expandedSection === 'battery'}
        onToggle={() => toggleSection('battery')}
      >
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            label="Cell Count (S)"
            value={config.battery.cell_count}
            onChange={(v) => updateBattery('cell_count', v)}
            step={1}
            min={1}
            max={12}
          />
          <NumberInput
            label="Capacity (mAh)"
            value={config.battery.capacity_mah}
            onChange={(v) => updateBattery('capacity_mah', v)}
            step={100}
            min={500}
            max={20000}
          />
          <NumberInput
            label="Mass (kg)"
            value={config.battery.mass}
            onChange={(v) => updateBattery('mass', v)}
            step={0.05}
            min={0.1}
            max={2}
          />
          <NumberInput
            label="Discharge Rate (C)"
            value={config.battery.max_discharge_rate}
            onChange={(v) => updateBattery('max_discharge_rate', v)}
            step={5}
            min={10}
            max={150}
          />
        </div>
      </CollapsibleSection>

      {/* Propellers Section */}
      <CollapsibleSection
        title="Propellers"
        icon={Disc}
        expanded={expandedSection === 'propellers'}
        onToggle={() => toggleSection('propellers')}
      >
        <div className="text-sm text-surface-400">
          <p>Diameter: {(config.propellers[0]?.diameter * 39.37).toFixed(1)}" ({config.propellers[0]?.diameter.toFixed(3)} m)</p>
          <p>Pitch: {(config.propellers[0]?.pitch * 39.37).toFixed(1)}" ({config.propellers[0]?.pitch.toFixed(3)} m)</p>
          <p>Type: {config.propellers[0]?.blade_count}</p>
        </div>
      </CollapsibleSection>

      {/* Tether Section */}
      <CollapsibleSection
        title="Tether"
        icon={Anchor}
        expanded={expandedSection === 'tether'}
        onToggle={() => toggleSection('tether')}
      >
        {config.tether ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="text-sm text-surface-400">
              <p>Length: {config.tether.length} m</p>
              <p>Stiffness: {config.tether.stiffness} N/m</p>
              <p>Breaking: {config.tether.breaking_strength} N</p>
            </div>
          </div>
        ) : (
          <div className="text-sm text-surface-500">No tether configured</div>
        )}
      </CollapsibleSection>

      {/* Summary */}
      <div className="bg-surface-800 rounded-lg p-4 mt-4">
        <h3 className="text-sm font-semibold text-surface-300 mb-2">Summary</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-surface-400">Total Mass:</div>
          <div className="text-surface-200 font-mono">
            {calculateTotalMass(config).toFixed(2)} kg
          </div>
          <div className="text-surface-400">Motor Count:</div>
          <div className="text-surface-200 font-mono">{config.motors.length}</div>
          <div className="text-surface-400">Battery:</div>
          <div className="text-surface-200 font-mono">
            {config.battery.cell_count}S {config.battery.capacity_mah}mAh
          </div>
        </div>
      </div>
    </div>
  );
}

// Collapsible section component
interface CollapsibleSectionProps {
  title: string;
  icon: React.ElementType;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon: Icon,
  expanded,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="border border-surface-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-800 hover:bg-surface-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary-400" />
          <span className="text-sm font-medium text-surface-200">{title}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-surface-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-surface-400" />
        )}
      </button>
      {expanded && <div className="p-4 bg-surface-850">{children}</div>}
    </div>
  );
}

// Number input component
interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

function NumberInput({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: NumberInputProps) {
  return (
    <div>
      <label className="text-xs text-surface-500">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        step={step}
        min={min}
        max={max}
        className="w-full mt-1 px-2 py-1 bg-surface-700 border border-surface-600 rounded text-sm text-surface-200 font-mono focus:outline-none focus:border-primary-500"
      />
    </div>
  );
}

// Helper function
function calculateTotalMass(config: DroneConfiguration): number {
  let mass = config.frame.mass + config.battery.mass;
  mass += config.motors.reduce((sum, m) => sum + m.mass, 0);
  mass += config.propellers.reduce((sum, p) => sum + p.mass, 0);
  if (config.payload) mass += config.payload.mass;
  if (config.tether) mass += config.tether.mass_per_meter * config.tether.length * 0.5;
  return mass;
}

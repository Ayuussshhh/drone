/**
 * Drone Builder Page
 * Main page for building and configuring drones
 */

'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import {
  Plane,
  Save,
  Play,
  Pause,
  RotateCcw,
  Grid3X3,
  Axis3D,
  Undo2,
  Redo2,
  Settings,
  Download,
  Upload,
  Share2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useBuilderStore } from '@/store/builderStore';
import ComponentLibrary from '@/components/builder/ComponentLibrary';
import ConfigurationPanel from '@/components/builder/ConfigurationPanel';
import { cn } from '@/lib/utils';
import { dronesApi, simulationsApi } from '@/services/api';
import toast from 'react-hot-toast';

// Dynamic import for Three.js viewer (no SSR)
const DroneViewer = dynamic(() => import('@/components/three/DroneViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900">
      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
    </div>
  ),
});

export default function DroneBuilderPage() {
  const {
    config,
    metrics,
    validation,
    isSimulating,
    showGrid,
    showAxes,
    setConfig,
    setFrame,
    addMotor,
    removeMotor,
    addPropeller,
    setBattery,
    setEsc,
    setFlightController,
    setPayload,
    setTether,
    setMetrics,
    setValidation,
    setSimulating,
    toggleGrid,
    toggleAxes,
    resetConfig,
    undo,
    redo,
  } = useBuilderStore();

  const [isSaving, setIsSaving] = useState(false);
  const [droneState, setDroneState] = useState<{
    position: { x: number; y: number; z: number };
    rotation: { roll: number; pitch: number; yaw: number };
    motorRpms: number[];
  } | null>(null);

  // Calculate metrics when config changes
  useEffect(() => {
    const calculateMetrics = async () => {
      if (!config.frame || config.motors.length === 0) {
        setMetrics(null);
        setValidation(null);
        return;
      }

      try {
        // Build configuration object for API
        const apiConfig = buildApiConfiguration();

        // Call quick analysis
        const response = await simulationsApi.quickAnalysis(apiConfig);

        if (response.data?.metrics) {
          setMetrics({
            totalWeight: response.data.metrics.total_weight_grams || 0,
            maxThrust: response.data.metrics.max_thrust_grams || 0,
            thrustToWeightRatio: response.data.metrics.thrust_to_weight_ratio || 0,
            estimatedFlightTime: response.data.metrics.estimated_flight_time_minutes || 0,
            powerConsumption: response.data.metrics.power_consumption_watts || 0,
            centerOfMass: response.data.metrics.center_of_mass || { x: 0, y: 0, z: 0 },
          });
        }

        // Validate configuration
        const validationResponse = await simulationsApi.validate(apiConfig);
        setValidation(validationResponse.data);
      } catch (error) {
        console.error('Failed to calculate metrics:', error);
        // Set fallback metrics
        calculateFallbackMetrics();
      }
    };

    const timeoutId = setTimeout(calculateMetrics, 500);
    return () => clearTimeout(timeoutId);
  }, [config]);

  // Build API configuration from current config
  const buildApiConfiguration = () => {
    return {
      frame: config.frame ? {
        id: config.frame.id,
        type: config.frame.specifications?.type || 'quadcopter',
        armCount: config.frame.specifications?.armCount || 4,
        armLength: config.frame.specifications?.armLength || 0.15,
      } : undefined,
      motors: config.motors.map((m, i) => ({
        id: m.id,
        position: getMotorPosition(i, config.frame?.specifications?.armCount || 4),
        thrust: m.specifications?.maxThrust || 1000,
      })),
      propellers: config.propellers.map((p, i) => ({
        id: p.id,
        motorIndex: i,
        direction: i % 2 === 0 ? 'CW' : 'CCW',
      })),
      battery: config.battery ? {
        id: config.battery.id,
        position: { x: 0, y: -0.02, z: 0 },
        capacity: config.battery.specifications?.capacity || 1500,
      } : undefined,
      payload: config.payload ? {
        id: config.payload.id,
        position: { x: 0, y: -0.03, z: 0 },
        weight: config.payload.weight,
      } : undefined,
      tether: config.tether.enabled && config.tether.component ? {
        id: config.tether.component.id,
        enabled: true,
        length: config.tether.length,
        anchorPoint: config.tether.anchorPoint,
      } : undefined,
    };
  };

  // Get motor position based on index and arm count
  const getMotorPosition = (index: number, armCount: number) => {
    const angle = (index * 2 * Math.PI) / armCount + Math.PI / 4;
    const armLength = config.frame?.specifications?.armLength || 0.15;
    return {
      x: Math.cos(angle) * armLength,
      y: 0,
      z: Math.sin(angle) * armLength,
    };
  };

  // Calculate fallback metrics locally
  const calculateFallbackMetrics = () => {
    const frameWeight = config.frame?.weight || 0;
    const motorsWeight = config.motors.reduce((sum, m) => sum + (m.weight || 0), 0);
    const batteryWeight = config.battery?.weight || 0;
    const payloadWeight = config.payload?.weight || 0;
    const totalWeight = frameWeight + motorsWeight + batteryWeight + payloadWeight;

    const maxThrust = config.motors.reduce(
      (sum, m) => sum + (m.specifications?.maxThrust || 0),
      0
    );

    setMetrics({
      totalWeight,
      maxThrust,
      thrustToWeightRatio: totalWeight > 0 ? maxThrust / totalWeight : 0,
      estimatedFlightTime: config.battery?.specifications?.capacity
        ? (config.battery.specifications.capacity / 1000) * 5
        : 0,
      powerConsumption: config.motors.length * 50,
      centerOfMass: { x: 0, y: 0, z: 0 },
    });
  };

  // Handle component selection from library
  const handleComponentSelect = useCallback((component: any) => {
    switch (component.type) {
      case 'frame':
        setFrame({
          id: component.id,
          name: component.name,
          type: 'frame',
          weight: component.weight_grams,
          specifications: {
            type: 'quadcopter',
            armCount: 4,
            armLength: 0.15,
            ...component.specifications,
          },
        });
        toast.success(`Frame "${component.name}" added`);
        break;

      case 'motor':
        addMotor({
          id: component.id,
          name: component.name,
          type: 'motor',
          weight: component.weight_grams,
          specifications: component.specifications,
        });
        toast.success(`Motor "${component.name}" added`);
        break;

      case 'propeller':
        if (config.motors.length > config.propellers.length) {
          addPropeller(
            {
              id: component.id,
              name: component.name,
              type: 'propeller',
              weight: component.weight_grams,
              specifications: component.specifications,
            },
            config.propellers.length
          );
          toast.success(`Propeller "${component.name}" added  to Motor ${config.propellers.length + 1}`);
        } else {
          toast.error('Add motors first before propellers');
        }
        break;

      case 'battery':
        setBattery({
          id: component.id,
          name: component.name,
          type: 'battery',
          weight: component.weight_grams,
          specifications: component.specifications,
        });
        toast.success(`Battery "${component.name}" added`);
        break;

      case 'esc':
        setEsc({
          id: component.id,
          name: component.name,
          type: 'esc',
          weight: component.weight_grams,
          specifications: component.specifications,
        });
        toast.success(`ESC "${component.name}" added`);
        break;

      case 'flight_controller':
        setFlightController({
          id: component.id,
          name: component.name,
          type: 'flight_controller',
          weight: component.weight_grams,
          specifications: component.specifications,
        });
        toast.success(`Flight Controller "${component.name}" added`);
        break;

      case 'payload':
        setPayload({
          id: component.id,
          name: component.name,
          type: 'payload',
          weight: component.weight_grams,
          specifications: component.specifications,
        });
        toast.success(`Payload "${component.name}" added`);
        break;

      case 'tether':
        setTether({
          enabled: true,
          component: {
            id: component.id,
            name: component.name,
            type: 'tether',
            weight: component.weight_grams,
            specifications: component.specifications,
          },
          length: component.specifications?.length_m || 50,
        });
        toast.success(`Tether "${component.name}" added`);
        break;

      default:
        toast.error(`Unknown component type: ${component.type}`);
    }
  }, [setFrame, addMotor, addPropeller, setBattery, setEsc, setFlightController, setPayload, setTether, config.motors.length, config.propellers.length]);

  // Handle component removal
  const handleRemoveComponent = useCallback((type: string, index?: number) => {
    switch (type) {
      case 'frame':
        setFrame(null);
        toast.success('Frame removed');
        break;
      case 'motor':
        if (typeof index === 'number') {
          removeMotor(index);
          toast.success('Motor removed');
        }
        break;
      case 'battery':
        setBattery(null);
        toast.success('Battery removed');
        break;
      case 'payload':
        setPayload(null);
        toast.success('Payload removed');
        break;
      case 'tether':
        setTether({ enabled: false, component: null });
        toast.success('Tether removed');
        break;
    }
  }, [setFrame, removeMotor, setBattery, setPayload, setTether]);

  // Save drone configuration
  const handleSave = async () => {
    if (!validation?.valid) {
      toast.error('Please fix configuration errors before saving');
      return;
    }

    setIsSaving(true);
    try {
      const apiConfig = buildApiConfiguration();

      if (config.id) {
        await dronesApi.update(config.id, {
          name: config.name,
          configuration: apiConfig,
        });
        toast.success('Drone updated successfully');
      } else {
        const response = await dronesApi.create({
          name: config.name,
          configuration: apiConfig,
        });
        setConfig({ id: response.data.id });
        toast.success('Drone saved successfully');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save drone');
    } finally {
      setIsSaving(false);
    }
  };

  // Start simulation
  const handleStartSimulation = () => {
    if (!validation?.canFly) {
      toast.error('Drone cannot fly. Check configuration.');
      return;
    }

    setSimulating(true);
    setDroneState({
      position: { x: 0, y: 0.1, z: 0 },
      rotation: { roll: 0, pitch: 0, yaw: 0 },
      motorRpms: config.motors.map(() => 5000),
    });

    toast.success('Simulation started');
  };

  // Stop simulation
  const handleStopSimulation = () => {
    setSimulating(false);
    setDroneState(null);
    toast.success('Simulation stopped');
  };

  // Build viewer config from current config
  const viewerConfig = {
    frame: {
      type: (config.frame?.specifications?.type || 'quadcopter') as 'quadcopter' | 'hexacopter' | 'octocopter',
      armLength: config.frame?.specifications?.armLength || 0.15,
      armCount: config.frame?.specifications?.armCount || 4,
    },
    motors: config.motors.map((m, i) => ({
      id: m.id,
      position: getMotorPosition(i, config.frame?.specifications?.armCount || 4),
      thrust: isSimulating ? 75 : 50,
    })),
    propellers: config.motors.map((_, i) => ({
      id: `prop-${i}`,
      motorIndex: i,
      direction: (i % 2 === 0 ? 'CW' : 'CCW') as 'CW' | 'CCW',
      spinning: isSimulating,
    })),
    battery: config.battery ? { position: { x: 0, y: -0.02, z: 0 } } : undefined,
    payload: config.payload
      ? { position: { x: 0, y: -0.03, z: 0 }, weight: config.payload.weight }
      : undefined,
    tether: config.tether.enabled
      ? {
          enabled: true,
          length: config.tether.length,
          anchorPoint: config.tether.anchorPoint,
        }
      : undefined,
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {/* Header */}
      <header className="h-14 bg-slate-900 border-b border-slate-700 px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Plane className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Drone Builder</h1>
            <p className="text-xs text-slate-400">{config.name}</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <div className="flex items-center gap-1 mr-2">
            <ToolbarButton icon={Undo2} onClick={undo} tooltip="Undo" />
            <ToolbarButton icon={Redo2} onClick={redo} tooltip="Redo" />
          </div>

          {/* View Controls */}
          <div className="flex items-center gap-1 mr-2 border-l border-slate-700 pl-2">
            <ToolbarButton
              icon={Grid3X3}
              onClick={toggleGrid}
              active={showGrid}
              tooltip="Toggle Grid"
            />
            <ToolbarButton
              icon={Axis3D}
              onClick={toggleAxes}
              active={showAxes}
              tooltip="Toggle Axes"
            />
          </div>

          {/* Simulation Controls */}
          <div className="flex items-center gap-1 mr-2 border-l border-slate-700 pl-2">
            {isSimulating ? (
              <ToolbarButton
                icon={Pause}
                onClick={handleStopSimulation}
                variant="danger"
                tooltip="Stop Simulation"
              />
            ) : (
              <ToolbarButton
                icon={Play}
                onClick={handleStartSimulation}
                variant="success"
                tooltip="Start Simulation"
                disabled={!validation?.canFly}
              />
            )}
            <ToolbarButton icon={RotateCcw} onClick={resetConfig} tooltip="Reset" />
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={isSaving || !validation?.valid}
            className={cn(
              'px-4 py-1.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors',
              validation?.valid
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            )}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel - Component Library */}
        <aside className="w-72 flex-shrink-0 overflow-hidden">
          <ComponentLibrary onComponentSelect={handleComponentSelect} />
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
              isSimulating={isSimulating}
              droneState={droneState || undefined}
              showGrid={showGrid}
              showAxes={showAxes}
              onComponentClick={(id, type) => {
                console.log('Clicked:', id, type);
              }}
            />
          </Suspense>

          {/* Status Overlay */}
          {isSimulating && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-green-900/80 border border-green-500 rounded-lg flex items-center gap-2"
            >
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm text-green-300">Simulation Running</span>
            </motion.div>
          )}

          {/* Metrics Overlay */}
          {metrics && (
            <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-700 rounded-lg p-3 space-y-2">
              <MetricDisplay label="Weight" value={`${metrics.totalWeight.toFixed(0)}g`} />
              <MetricDisplay label="Max Thrust" value={`${metrics.maxThrust.toFixed(0)}g`} />
              <MetricDisplay
                label="T/W Ratio"
                value={metrics.thrustToWeightRatio.toFixed(2)}
                status={
                  metrics.thrustToWeightRatio >= 2
                    ? 'good'
                    : metrics.thrustToWeightRatio >= 1.5
                    ? 'warning'
                    : 'error'
                }
              />
            </div>
          )}
        </main>

        {/* Right Panel - Configuration */}
        <aside className="w-80 flex-shrink-0 overflow-hidden">
          <ConfigurationPanel
            config={{
              name: config.name,
              frame: config.frame,
              motors: config.motors,
              propellers: config.propellers,
              battery: config.battery,
              esc: config.esc,
              flightController: config.flightController,
              payload: config.payload,
              tether: config.tether.enabled ? {
                name: config.tether.component?.name || 'Tether',
                enabled: true,
                length: config.tether.length,
                maxTension: config.tether.component?.specifications?.max_tension_n || 200,
              } : undefined,
            }}
            metrics={metrics ? {
              totalWeight: metrics.totalWeight,
              maxThrust: metrics.maxThrust,
              thrustToWeightRatio: metrics.thrustToWeightRatio,
              estimatedFlightTime: metrics.estimatedFlightTime,
            } : undefined}
            validation={validation || undefined}
            onUpdateConfig={(updates) => setConfig(updates as any)}
            onRemoveComponent={handleRemoveComponent}
            onSave={handleSave}
          />
        </aside>
      </div>
    </div>
  );
}

// Toolbar Button Component
function ToolbarButton({
  icon: Icon,
  onClick,
  active,
  disabled,
  variant,
  tooltip,
}: {
  icon: React.ElementType;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  variant?: 'success' | 'danger';
  tooltip?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={cn(
        'p-2 rounded-lg transition-colors',
        active && 'bg-slate-700',
        disabled && 'opacity-50 cursor-not-allowed',
        variant === 'success' && 'hover:bg-green-900/50 text-green-400',
        variant === 'danger' && 'hover:bg-red-900/50 text-red-400',
        !variant && !active && 'hover:bg-slate-700 text-slate-300'
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

// Metric Display Component
function MetricDisplay({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: 'good' | 'warning' | 'error';
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-slate-400">{label}</span>
      <span
        className={cn(
          'text-sm font-mono font-medium',
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

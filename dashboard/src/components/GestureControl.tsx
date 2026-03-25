/**
 * Gesture Control Component
 * Interface for MediaPipe gesture control
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Hand,
  Camera,
  CameraOff,
  Activity,
  Info,
  Settings,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_PHYSICS_API_URL || 'http://localhost:8000';

interface GestureMapping {
  gesture: string;
  action: string;
  description: string;
  min_confidence: number;
}

interface GestureStatus {
  running: boolean;
  context: string;
  available_gestures: string[];
  help_text: string;
}

interface GestureControlProps {
  onGestureCommand?: (gesture: string, action: string, parameters: Record<string, any>) => void;
  compact?: boolean;
}

export default function GestureControl({ onGestureCommand, compact = false }: GestureControlProps) {
  const [status, setStatus] = useState<GestureStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expanded, setExpanded] = useState(!compact);
  const [mappings, setMappings] = useState<GestureMapping[]>([]);
  const [showMappings, setShowMappings] = useState(false);

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/gesture/status`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch gesture status:', error);
    }
  }, []);

  // Fetch mappings
  const fetchMappings = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/gesture/mappings`);
      if (response.ok) {
        const data = await response.json();
        setMappings(data.mappings || []);
      }
    } catch (error) {
      console.error('Failed to fetch gesture mappings:', error);
    }
  }, []);

  // Start gesture detection
  const startGestureDetection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/gesture/start`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Gesture detection started');
        await fetchStatus();
        await fetchMappings();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to start gesture detection');
      }
    } catch (error) {
      toast.error('Failed to connect to gesture service');
    } finally {
      setIsLoading(false);
    }
  };

  // Stop gesture detection
  const stopGestureDetection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/gesture/stop`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Gesture detection stopped');
        await fetchStatus();
      } else {
        toast.error('Failed to stop gesture detection');
      }
    } catch (error) {
      toast.error('Failed to connect to gesture service');
    } finally {
      setIsLoading(false);
    }
  };

  // Change context
  const changeContext = async (context: string) => {
    try {
      const response = await fetch(`${API_URL}/api/gesture/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      });

      if (response.ok) {
        toast.success(`Context changed to ${context}`);
        await fetchStatus();
        await fetchMappings();
      }
    } catch (error) {
      toast.error('Failed to change context');
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll status when running
  useEffect(() => {
    if (status?.running) {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [status?.running, fetchStatus]);

  // Gesture icon mapping
  const gestureIcons: Record<string, string> = {
    pinch: '🤏',
    swipe_left: '👈',
    swipe_right: '👉',
    swipe_up: '☝️',
    swipe_down: '👇',
    open_palm: '🖐️',
    fist: '✊',
    point: '👆',
    thumbs_up: '👍',
    thumbs_down: '👎',
    rotate_cw: '🔄',
    rotate_ccw: '🔃',
  };

  if (compact && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
          status?.running
            ? "bg-green-900/30 text-green-400"
            : "bg-slate-800 text-slate-400 hover:bg-slate-700"
        )}
      >
        <Hand className="w-4 h-4" />
        <span className="text-sm">Gestures {status?.running ? 'On' : 'Off'}</span>
      </button>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        onClick={() => compact && setExpanded(!expanded)}
        className={cn(
          "flex items-center justify-between p-4",
          compact && "cursor-pointer hover:bg-slate-700/50"
        )}
      >
        <div className="flex items-center gap-2">
          <Hand className={cn(
            "w-5 h-5",
            status?.running ? "text-green-400" : "text-slate-400"
          )} />
          <h3 className="text-sm font-medium text-white">Gesture Control</h3>
          {status?.running && (
            <span className="px-2 py-0.5 bg-green-900/50 text-green-400 text-xs rounded-full">
              Active
            </span>
          )}
        </div>
        {compact && (
          <button className="text-slate-400">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-700"
          >
            {/* Controls */}
            <div className="p-4 space-y-4">
              {/* Start/Stop Button */}
              <button
                onClick={status?.running ? stopGestureDetection : startGestureDetection}
                disabled={isLoading}
                className={cn(
                  "w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors",
                  status?.running
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : "bg-cyan-600 hover:bg-cyan-500 text-white",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : status?.running ? (
                  <>
                    <CameraOff className="w-4 h-4" />
                    Stop Camera
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    Start Camera
                  </>
                )}
              </button>

              {/* Status Info */}
              {status?.running && (
                <div className="space-y-3">
                  {/* Current Context */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Context</span>
                    <select
                      value={status.context}
                      onChange={(e) => changeContext(e.target.value)}
                      className="bg-slate-700 text-white text-xs rounded px-2 py-1 border-none outline-none"
                    >
                      <option value="default">Default</option>
                      <option value="component_selection">Component Selection</option>
                      <option value="parameter_adjustment">Parameter Adjustment</option>
                      <option value="simulation_running">Simulation</option>
                      <option value="view_control">View Control</option>
                    </select>
                  </div>

                  {/* Available Gestures */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400">Available Gestures</span>
                      <button
                        onClick={() => setShowMappings(!showMappings)}
                        className="text-xs text-cyan-400 hover:text-cyan-300"
                      >
                        {showMappings ? 'Hide' : 'Show'} Details
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {status.available_gestures.map((gesture) => (
                        <span
                          key={gesture}
                          className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300"
                          title={gesture}
                        >
                          {gestureIcons[gesture] || '👋'} {gesture.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Gesture Mappings */}
                  <AnimatePresence>
                    {showMappings && mappings.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-2"
                      >
                        {mappings.map((mapping, index) => (
                          <div
                            key={index}
                            className="p-2 bg-slate-700/50 rounded text-xs"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-white font-medium">
                                {gestureIcons[mapping.gesture] || '👋'} {mapping.gesture.replace('_', ' ')}
                              </span>
                              <span className="text-cyan-400">{mapping.action.replace('_', ' ')}</span>
                            </div>
                            <p className="text-slate-400">{mapping.description}</p>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Info */}
              {!status?.running && (
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-slate-400">
                      Gesture control uses your camera to detect hand gestures for controlling the drone simulation.
                      Requires MediaPipe and camera access.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Compact gesture indicator for inline use
export function GestureIndicator({ onClick }: { onClick?: () => void }) {
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/api/gesture/status`);
        if (response.ok) {
          const data = await response.json();
          setIsRunning(data.running);
        }
      } catch {
        setIsRunning(false);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
        isRunning
          ? "bg-green-900/30 text-green-400"
          : "bg-slate-800 text-slate-500 hover:bg-slate-700"
      )}
    >
      <Hand className="w-3 h-3" />
      {isRunning ? 'Gestures On' : 'Gestures'}
    </button>
  );
}

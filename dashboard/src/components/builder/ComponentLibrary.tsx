/**
 * Professional Component Library
 * Modern card-based component selector with beautiful UI
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu,
  CircleDot,
  Battery,
  Box,
  Anchor,
  Camera,
  Navigation,
  Search,
  Plus,
  Loader2,
  Filter,
  Grid3x3,
  List,
  X,
  Zap,
  Package,
  Weight,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { componentsApi, framesApi } from '@/services/api';
import toast from 'react-hot-toast';

interface ComponentItem {
  id: string;
  name: string;
  type: string;
  manufacturer?: string;
  weight_grams: number;
  specifications: Record<string, any>;
  price_usd?: number;
}

interface ComponentLibraryProps {
  onComponentSelect: (component: ComponentItem) => void;
  selectedType?: string;
}

const COMPONENT_TYPES = [
  { id: 'motor', label: 'Motors', icon: Zap, color: 'from-green-500 to-emerald-600', textColor: 'text-green-400', borderColor: 'border-green-500/20' },
  { id: 'propeller', label: 'Propellers', icon: CircleDot, color: 'from-blue-500 to-cyan-600', textColor: 'text-blue-400', borderColor: 'border-blue-500/20' },
  { id: 'battery', label: 'Batteries', icon: Battery, color: 'from-yellow-500 to-orange-600', textColor: 'text-yellow-400', borderColor: 'border-yellow-500/20' },
  { id: 'esc', label: 'ESCs', icon: Cpu, color: 'from-purple-500 to-violet-600', textColor: 'text-purple-400', borderColor: 'border-purple-500/20' },
  { id: 'flight_controller', label: 'Flight Controllers', icon: Navigation, color: 'from-cyan-500 to-blue-600', textColor: 'text-cyan-400', borderColor: 'border-cyan-500/20' },
  { id: 'payload', label: 'Payloads', icon: Package, color: 'from-pink-500 to-rose-600', textColor: 'text-pink-400', borderColor: 'border-pink-500/20' },
  { id: 'tether', label: 'Tethers', icon: Anchor, color: 'from-orange-500 to-amber-600', textColor: 'text-orange-400', borderColor: 'border-orange-500/20' },
  { id: 'camera', label: 'Cameras', icon: Camera, color: 'from-red-500 to-pink-600', textColor: 'text-red-400', borderColor: 'border-red-500/20' },
];

export default function ComponentLibrary({ onComponentSelect, selectedType }: ComponentLibraryProps) {
  const [activeTab, setActiveTab] = useState<string>('motor');
  const [searchQuery, setSearchQuery] = useState('');
  const [components, setComponents] = useState<Record<string, ComponentItem[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Load components for a type
  const loadComponents = async (type: string) => {
    if (components[type] || loading[type]) return;

    setLoading((prev) => ({ ...prev, [type]: true }));
    try {
      const response = await componentsApi.getByType(type);
      setComponents((prev) => ({ ...prev, [type]: response.data }));
    } catch (error) {
      console.error(`Failed to load ${type} components:`, error);
      setComponents((prev) => ({ ...prev, [type]: [] }));
      toast.error(`Failed to load ${type}s`);
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  // Load active tab components
  useEffect(() => {
    if (activeTab) {
      loadComponents(activeTab);
    }
  }, [activeTab]);

  // Filter components by search
  const filterComponents = (items: ComponentItem[]) => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.manufacturer?.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query)
    );
  };

  const activeTypeData = COMPONENT_TYPES.find((t) => t.id === activeTab);
  const filteredComponents = filterComponents(components[activeTab] || []);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
      {/* Professional Header with Gradient */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 backdrop-blur-sm" />
        <div className="relative p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Component Library</h2>
                <p className="text-xs text-slate-400">Select components for your drone</p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 p-1 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 rounded transition-all',
                  viewMode === 'grid'
                    ? 'bg-cyan-500 text-white'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-2 rounded transition-all',
                  viewMode === 'list'
                    ? 'bg-cyan-500 text-white'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search components, manufacturers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Component Type Tabs */}
      <div className="border-b border-slate-700/50 bg-slate-900/50">
        <div className="flex overflow-x-auto custom-scrollbar px-2 py-2 gap-2">
          {COMPONENT_TYPES.map((type) => {
            const Icon = type.icon;
            const isActive = activeTab === type.id;
            const count = components[type.id]?.length || 0;

            return (
              <button
                key={type.id}
                onClick={() => setActiveTab(type.id)}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all',
                  isActive
                    ? 'bg-gradient-to-r ' + type.color + ' text-white shadow-lg'
                    : 'bg-slate-800/30 text-slate-400 hover:text-white hover:bg-slate-800/50'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{type.label}</span>
                {count > 0 && (
                  <div className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-bold',
                    isActive ? 'bg-white/20' : 'bg-slate-700'
                  )}>
                    {count}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Components Grid/List */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {loading[activeTab] ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
            <p className="text-sm text-slate-400">Loading {activeTypeData?.label}...</p>
          </div>
        ) : filteredComponents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-3">
              <Filter className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-sm text-slate-400">
              {searchQuery ? 'No components match your search' : 'No components available'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div
            className={cn(
              'gap-3',
              viewMode === 'grid'
                ? 'grid grid-cols-1 xl:grid-cols-2'
                : 'flex flex-col'
            )}
          >
            {filteredComponents.map((component) => (
              <ComponentCard
                key={component.id}
                component={component}
                typeData={activeTypeData!}
                onSelect={() => {
                  onComponentSelect(component);
                  toast.success(
                    <div>
                      <p className="font-semibold">{component.name}</p>
                      <p className="text-xs text-slate-300">Added to configuration</p>
                    </div>
                  );
                }}
                viewMode={viewMode}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {filteredComponents.length > 0 && (
        <div className="p-3 border-t border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing <span className="text-white font-semibold">{filteredComponents.length}</span> {activeTypeData?.label.toLowerCase()}
            </span>
            {searchQuery && (
              <span className="text-cyan-400">Filtered results</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Professional Component Card
function ComponentCard({
  component,
  typeData,
  onSelect,
  viewMode,
}: {
  component: ComponentItem;
  typeData: typeof COMPONENT_TYPES[0];
  onSelect: () => void;
  viewMode: 'grid' | 'list';
}) {
  const [showDetails, setShowDetails] = useState(false);
  const Icon = typeData.icon;

  // Extract key specs based on type
  const getKeySpecs = () => {
    const specs = component.specifications;
    const type = component.type;

    if (type === 'motor') {
      return [
        { label: 'KV', value: specs.kv_rating, icon: Zap },
        { label: 'Max Current', value: `${specs.max_current}A`, icon: Cpu },
      ];
    } else if (type === 'battery') {
      return [
        { label: 'Cells', value: `${specs.cell_count}S`, icon: Battery },
        { label: 'Capacity', value: `${specs.capacity_mah}mAh`, icon: Zap },
      ];
    } else if (type === 'propeller') {
      return [
        { label: 'Diameter', value: `${(specs.diameter * 39.37).toFixed(1)}"`, icon: CircleDot },
        { label: 'Pitch', value: `${(specs.pitch * 39.37).toFixed(1)}"`, icon: Navigation },
      ];
    } else if (type === 'esc') {
      return [
        { label: 'Max Current', value: `${specs.max_current}A`, icon: Zap },
        { label: 'Voltage', value: `${specs.voltage_range_min}-${specs.voltage_range_max}V`, icon: Battery },
      ];
    }
    return [];
  };

  const keySpecs = getKeySpecs();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="group relative"
    >
      <button
        onClick={onSelect}
        onMouseEnter={() => setShowDetails(true)}
        onMouseLeave={() => setShowDetails(false)}
        className={cn(
          'w-full text-left transition-all duration-300',
          'bg-slate-800/30 backdrop-blur-sm border rounded-xl',
          'hover:bg-slate-800/50 hover:shadow-xl hover:shadow-cyan-500/10',
          typeData.borderColor,
          viewMode === 'grid' ? 'p-4' : 'p-3'
        )}
      >
        <div className={cn(
          'flex gap-3',
          viewMode === 'grid' ? 'flex-col' : 'flex-row items-center'
        )}>
          {/* Icon Badge */}
          <div className={cn(
            'flex-shrink-0 rounded-lg flex items-center justify-center bg-gradient-to-br',
            typeData.color,
            viewMode === 'grid' ? 'w-12 h-12' : 'w-10 h-10'
          )}>
            <Icon className="w-6 h-6 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            {/* Name & Manufacturer */}
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-white truncate group-hover:text-cyan-400 transition-colors">
                {component.name}
              </h3>
              {component.manufacturer && (
                <p className="text-xs text-slate-400 truncate">{component.manufacturer}</p>
              )}
            </div>

            {/* Key Specs */}
            {keySpecs.length > 0 && viewMode === 'grid' && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {keySpecs.map((spec, i) => {
                  const SpecIcon = spec.icon;
                  return (
                    <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-slate-900/50 rounded-lg">
                      <SpecIcon className={cn('w-3 h-3', typeData.textColor)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-slate-500 uppercase">{spec.label}</div>
                        <div className="text-xs text-white font-medium truncate">{spec.value}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Row: Weight, Price, Add Button */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1 text-slate-400">
                  <Weight className="w-3 h-3" />
                  <span>{component.weight_grams}g</span>
                </div>
                {component.price_usd && (
                  <div className="flex items-center gap-1 text-slate-400">
                    <DollarSign className="w-3 h-3" />
                    <span>{component.price_usd}</span>
                  </div>
                )}
              </div>

              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center',
                  'bg-gradient-to-r ' + typeData.color,
                  'opacity-0 group-hover:opacity-100 transition-opacity'
                )}
              >
                <Plus className="w-4 h-4 text-white" />
              </motion.div>
            </div>
          </div>
        </div>
      </button>

      {/* Hover Details Panel */}
      <AnimatePresence>
        {showDetails && viewMode === 'grid' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              'absolute left-0 right-0 top-full mt-2 p-3 z-10',
              'bg-slate-800 border rounded-lg shadow-xl',
              typeData.borderColor
            )}
          >
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Specifications
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {Object.entries(component.specifications).slice(0, 6).map(([key, value]) => (
                  <div key={key} className="flex justify-between px-2 py-1 bg-slate-900/50 rounded">
                    <span className="text-slate-400 truncate">{key.replace(/_/g, ' ')}</span>
                    <span className="text-white font-medium ml-2">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Component Model and Types
 */

export type ComponentType =
  | 'frame'
  | 'motor'
  | 'propeller'
  | 'battery'
  | 'esc'
  | 'flight_controller'
  | 'camera'
  | 'gps'
  | 'sensor'
  | 'payload'
  | 'tether';

export interface Component {
  id: string;
  name: string;
  type: ComponentType;
  manufacturer?: string;
  model_number?: string;
  description?: string;
  weight_grams: number;
  dimensions_mm: Dimensions;
  specifications: ComponentSpecifications;
  thumbnail_url?: string;
  model_3d_url?: string;
  compatible_with?: string[];
  price_usd?: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Dimensions {
  length?: number;
  width?: number;
  height?: number;
  diameter?: number;
  pitch?: number;
}

// Specification types for different components
export interface MotorSpecs {
  kv_rating: number;
  max_thrust_grams: number;
  max_current_amps: number;
  voltage_range: { min: number; max: number };
  efficiency?: number;
}

export interface PropellerSpecs {
  diameter_inches: number;
  pitch: number;
  blade_count: number;
  material: string;
  direction: 'CW' | 'CCW';
}

export interface BatterySpecs {
  capacity_mah: number;
  voltage: number;
  cell_count: number;
  c_rating: number;
  discharge_rate: number;
  wh?: number;
}

export interface ESCSpecs {
  max_current: number;
  protocols: string[];
  voltage_range: { min: number; max: number };
  firmware?: string;
}

export interface TetherSpecs {
  length_m: number;
  material: string;
  max_tension_n: number;
  cable_type: 'power_data' | 'structural' | 'hybrid';
  power_capacity_w?: number;
  data_bandwidth_mbps?: number;
}

export type ComponentSpecifications =
  | MotorSpecs
  | PropellerSpecs
  | BatterySpecs
  | ESCSpecs
  | TetherSpecs
  | Record<string, any>;

export interface CreateComponentDTO {
  name: string;
  type: ComponentType;
  manufacturer?: string;
  model_number?: string;
  description?: string;
  weight_grams: number;
  dimensions_mm: Dimensions;
  specifications: ComponentSpecifications;
  thumbnail_url?: string;
  model_3d_url?: string;
  compatible_with?: string[];
  price_usd?: number;
}

export interface ComponentFilter {
  type?: ComponentType;
  manufacturer?: string;
  minWeight?: number;
  maxWeight?: number;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
}

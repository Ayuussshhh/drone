/**
 * User Drone Model and Types
 */

import { DroneConfiguration, Vector3 } from './drone-frame.model';

export interface UserDrone {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  frame_id?: string;
  configuration: DroneConfiguration;
  calculated_metrics?: DroneMetrics;
  thumbnail_url?: string;
  version: number;
  is_public: boolean;
  tags?: string[];
  created_at: Date;
  updated_at: Date;
}

export interface DroneMetrics {
  total_weight_grams: number;
  max_thrust_grams: number;
  thrust_to_weight_ratio: number;
  estimated_flight_time_minutes: number;
  power_consumption_watts: number;
  center_of_mass: Vector3;
  moment_of_inertia: {
    xx: number;
    yy: number;
    zz: number;
  };
}

export interface CreateUserDroneDTO {
  name: string;
  description?: string;
  frame_id?: string;
  configuration: DroneConfiguration;
  is_public?: boolean;
  tags?: string[];
}

export interface UpdateUserDroneDTO {
  name?: string;
  description?: string;
  frame_id?: string;
  configuration?: DroneConfiguration;
  is_public?: boolean;
  tags?: string[];
}

export interface UserDroneFilter {
  user_id?: string;
  is_public?: boolean;
  frame_type?: string;
  tags?: string[];
  search?: string;
}

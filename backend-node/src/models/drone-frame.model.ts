/**
 * Drone Frame Model and Types
 */

export type FrameType =
  | 'quadcopter'
  | 'hexacopter'
  | 'octocopter'
  | 'tricopter'
  | 'fixed_wing'
  | 'vtol';

export interface ArmPosition {
  x: number;
  y: number;
  z: number;
  angle: number;
}

export interface MountPosition {
  x: number;
  y: number;
  z: number;
  type: string;
}

export interface DroneFrame {
  id: string;
  name: string;
  description?: string;
  frame_type: FrameType;
  arm_count: number;
  diagonal_mm: number;
  arm_positions: ArmPosition[];
  center_mount_positions?: MountPosition[];
  frame_weight_grams: number;
  max_payload_grams?: number;
  material?: string;
  thumbnail_url?: string;
  model_3d_url?: string;
  preview_config?: DroneConfiguration;
  compatible_motor_mounts?: string[];
  compatible_propeller_sizes?: { min: number; max: number };
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateFrameDTO {
  name: string;
  description?: string;
  frame_type: FrameType;
  arm_count: number;
  diagonal_mm: number;
  arm_positions: ArmPosition[];
  center_mount_positions?: MountPosition[];
  frame_weight_grams: number;
  max_payload_grams?: number;
  material?: string;
}

// Drone Configuration (used in user_drones)
export interface DroneConfiguration {
  frame?: {
    id: string;
    position: Vector3;
    rotation: Vector3;
  };
  motors: {
    id: string;
    position: Vector3;
    rotation: Vector3;
    arm_index: number;
  }[];
  propellers: {
    id: string;
    motor_index: number;
    direction: 'CW' | 'CCW';
  }[];
  battery?: {
    id: string;
    position: Vector3;
  };
  esc?: {
    id: string;
    motor_index?: number;
  }[];
  flight_controller?: {
    id: string;
    position: Vector3;
  };
  payload?: {
    id: string;
    position: Vector3;
    weight?: number;
  };
  tether?: {
    id: string;
    enabled: boolean;
    anchor_point: Vector3;
    length: number;
  };
  additional?: {
    id: string;
    type: string;
    position: Vector3;
  }[];
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

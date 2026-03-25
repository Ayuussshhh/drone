/**
 * Database Seed Script
 * Populates database with initial component and frame data
 */

import db from './connection';
import logger from '../config/logger';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// Sample drone components
const sampleComponents = [
  // Motors
  {
    name: 'T-Motor F40 Pro IV',
    type: 'motor',
    manufacturer: 'T-Motor',
    model_number: 'F40-PRO-IV-2400KV',
    description: 'High-performance brushless motor for FPV racing',
    weight_grams: 32,
    dimensions_mm: { length: 27, width: 27, height: 16 },
    specifications: {
      kv_rating: 2400,
      max_thrust_grams: 1600,
      max_current_amps: 38,
      voltage_range: { min: 14.8, max: 25.2 },
      efficiency: 0.85,
    },
    price_usd: 24.99,
  },
  {
    name: 'EMAX RS2205',
    type: 'motor',
    manufacturer: 'EMAX',
    model_number: 'RS2205-2300KV',
    description: 'Popular brushless motor for 5-inch quads',
    weight_grams: 28,
    dimensions_mm: { length: 27, width: 27, height: 14 },
    specifications: {
      kv_rating: 2300,
      max_thrust_grams: 1250,
      max_current_amps: 30,
      voltage_range: { min: 11.1, max: 22.2 },
      efficiency: 0.82,
    },
    price_usd: 14.99,
  },
  {
    name: 'BetaFlight 2806.5',
    type: 'motor',
    manufacturer: 'BetaFlight',
    model_number: 'BF2806.5-1300KV',
    description: 'Long-range motor for efficiency',
    weight_grams: 45,
    dimensions_mm: { length: 32, width: 32, height: 18 },
    specifications: {
      kv_rating: 1300,
      max_thrust_grams: 1800,
      max_current_amps: 28,
      voltage_range: { min: 14.8, max: 25.2 },
      efficiency: 0.88,
    },
    price_usd: 32.99,
  },

  // Propellers
  {
    name: 'HQProp 5x4.5x3 V1S',
    type: 'propeller',
    manufacturer: 'HQProp',
    model_number: '5045V1S',
    description: 'Tri-blade propeller for smooth flight',
    weight_grams: 4.5,
    dimensions_mm: { diameter: 127, pitch: 114 },
    specifications: {
      diameter_inches: 5,
      pitch: 4.5,
      blade_count: 3,
      material: 'PC',
      direction: 'CW',
    },
    price_usd: 3.99,
  },
  {
    name: 'Gemfan Hurricane 51466',
    type: 'propeller',
    manufacturer: 'Gemfan',
    model_number: '51466-3',
    description: 'High-efficiency tri-blade for freestyle',
    weight_grams: 5.2,
    dimensions_mm: { diameter: 130, pitch: 117 },
    specifications: {
      diameter_inches: 5.1,
      pitch: 4.66,
      blade_count: 3,
      material: 'PC',
      direction: 'CW',
    },
    price_usd: 4.49,
  },

  // Batteries
  {
    name: 'Tattu R-Line 1550mAh 4S',
    type: 'battery',
    manufacturer: 'Tattu',
    model_number: 'RL-1550-4S-100C',
    description: 'High-performance LiPo for racing',
    weight_grams: 185,
    dimensions_mm: { length: 75, width: 35, height: 35 },
    specifications: {
      capacity_mah: 1550,
      voltage: 14.8,
      cell_count: 4,
      c_rating: 100,
      discharge_rate: 155,
      wh: 22.94,
    },
    price_usd: 39.99,
  },
  {
    name: 'CNHL 2200mAh 6S',
    type: 'battery',
    manufacturer: 'CNHL',
    model_number: 'CNHL-2200-6S-100C',
    description: 'High-capacity 6S pack for long flights',
    weight_grams: 320,
    dimensions_mm: { length: 140, width: 42, height: 38 },
    specifications: {
      capacity_mah: 2200,
      voltage: 22.2,
      cell_count: 6,
      c_rating: 100,
      discharge_rate: 220,
      wh: 48.84,
    },
    price_usd: 54.99,
  },

  // ESCs
  {
    name: 'Hobbywing XRotor 40A',
    type: 'esc',
    manufacturer: 'Hobbywing',
    model_number: 'XRotor-40A-4in1',
    description: '4-in-1 ESC with BLHeli_32',
    weight_grams: 14,
    dimensions_mm: { length: 36, width: 36, height: 8 },
    specifications: {
      max_current: 40,
      protocols: ['DShot600', 'DShot300', 'PWM'],
      voltage_range: { min: 11.1, max: 25.2 },
      firmware: 'BLHeli_32',
    },
    price_usd: 49.99,
  },

  // Flight Controllers
  {
    name: 'Betaflight F7 AIO',
    type: 'flight_controller',
    manufacturer: 'SpeedyBee',
    model_number: 'F7-AIO-V3',
    description: 'All-in-one flight controller with OSD',
    weight_grams: 8,
    dimensions_mm: { length: 36, width: 36, height: 5 },
    specifications: {
      processor: 'STM32F722',
      gyro: 'BMI270',
      osd: true,
      barometer: true,
      uart_count: 6,
      firmware: 'Betaflight',
    },
    price_usd: 44.99,
  },

  // Payload
  {
    name: 'Standard Payload Mount',
    type: 'payload',
    manufacturer: 'Generic',
    model_number: 'PLM-100',
    description: 'Universal payload mounting system',
    weight_grams: 25,
    dimensions_mm: { length: 50, width: 50, height: 20 },
    specifications: {
      max_payload_grams: 500,
      mount_type: 'universal',
      vibration_damping: true,
    },
    price_usd: 15.99,
  },

  // Tether
  {
    name: 'PowerLink Tether 50m',
    type: 'tether',
    manufacturer: 'PowerLink',
    model_number: 'PL-T50',
    description: 'Power and data tether system',
    weight_grams: 500,
    dimensions_mm: { length: 50000, diameter: 3 },
    specifications: {
      length_m: 50,
      material: 'Kevlar-reinforced',
      max_tension_n: 200,
      cable_type: 'power_data',
      power_capacity_w: 500,
      data_bandwidth_mbps: 100,
    },
    price_usd: 299.99,
  },
  {
    name: 'LiteTether 30m',
    type: 'tether',
    manufacturer: 'AeroTech',
    model_number: 'LT-30',
    description: 'Lightweight tether for short range',
    weight_grams: 200,
    dimensions_mm: { length: 30000, diameter: 2 },
    specifications: {
      length_m: 30,
      material: 'UHMWPE',
      max_tension_n: 150,
      cable_type: 'structural',
    },
    price_usd: 89.99,
  },

  // Camera
  {
    name: 'Caddx Ratel 2',
    type: 'camera',
    manufacturer: 'Caddx',
    model_number: 'Ratel2',
    description: 'Micro FPV camera with starlight sensor',
    weight_grams: 8,
    dimensions_mm: { length: 19, width: 19, height: 19 },
    specifications: {
      sensor: '1/1.8" Starlight',
      resolution: '1200TVL',
      fov: 165,
      min_illumination: 0.0001,
      voltage_range: { min: 4.5, max: 20 },
    },
    price_usd: 32.99,
  },

  // GPS
  {
    name: 'BN-880 GPS Module',
    type: 'gps',
    manufacturer: 'Beitian',
    model_number: 'BN-880',
    description: 'GPS/GLONASS with compass',
    weight_grams: 12,
    dimensions_mm: { length: 22, width: 22, height: 8 },
    specifications: {
      systems: ['GPS', 'GLONASS'],
      update_rate_hz: 10,
      accuracy_m: 2.5,
      compass: true,
      sensitivity_dbm: -167,
    },
    price_usd: 19.99,
  },
];

// Sample drone frames
const sampleFrames = [
  {
    name: 'Freestyle X5',
    description: 'Versatile 5-inch freestyle frame with excellent durability',
    frame_type: 'quadcopter',
    arm_count: 4,
    diagonal_mm: 220,
    arm_positions: [
      { x: 0.11, y: 0.11, z: 0, angle: 45 },
      { x: -0.11, y: 0.11, z: 0, angle: 135 },
      { x: -0.11, y: -0.11, z: 0, angle: 225 },
      { x: 0.11, y: -0.11, z: 0, angle: 315 },
    ],
    center_mount_positions: [
      { x: 0, y: 0, z: 0.02, type: 'battery' },
      { x: 0, y: 0.02, z: 0.01, type: 'flight_controller' },
    ],
    frame_weight_grams: 120,
    max_payload_grams: 300,
    material: 'Carbon Fiber 4mm',
    compatible_propeller_sizes: { min: 4, max: 5.1 },
  },
  {
    name: 'LongRange X7',
    description: '7-inch long range cruiser for efficiency',
    frame_type: 'quadcopter',
    arm_count: 4,
    diagonal_mm: 295,
    arm_positions: [
      { x: 0.15, y: 0.15, z: 0, angle: 45 },
      { x: -0.15, y: 0.15, z: 0, angle: 135 },
      { x: -0.15, y: -0.15, z: 0, angle: 225 },
      { x: 0.15, y: -0.15, z: 0, angle: 315 },
    ],
    center_mount_positions: [
      { x: 0, y: 0, z: 0.025, type: 'battery' },
      { x: 0, y: 0.02, z: 0.01, type: 'flight_controller' },
    ],
    frame_weight_grams: 180,
    max_payload_grams: 500,
    material: 'Carbon Fiber 5mm',
    compatible_propeller_sizes: { min: 6, max: 7.5 },
  },
  {
    name: 'HexaLift Pro',
    description: 'Heavy-lift hexacopter for professional payloads',
    frame_type: 'hexacopter',
    arm_count: 6,
    diagonal_mm: 680,
    arm_positions: [
      { x: 0.34, y: 0, z: 0, angle: 0 },
      { x: 0.17, y: 0.294, z: 0, angle: 60 },
      { x: -0.17, y: 0.294, z: 0, angle: 120 },
      { x: -0.34, y: 0, z: 0, angle: 180 },
      { x: -0.17, y: -0.294, z: 0, angle: 240 },
      { x: 0.17, y: -0.294, z: 0, angle: 300 },
    ],
    center_mount_positions: [
      { x: 0, y: 0, z: 0.04, type: 'battery' },
      { x: 0, y: 0, z: 0.02, type: 'payload' },
    ],
    frame_weight_grams: 850,
    max_payload_grams: 2000,
    material: 'Carbon Fiber 6mm',
    compatible_propeller_sizes: { min: 13, max: 18 },
  },
  {
    name: 'TetherPro Industrial',
    description: 'Industrial frame designed for tethered operations',
    frame_type: 'quadcopter',
    arm_count: 4,
    diagonal_mm: 450,
    arm_positions: [
      { x: 0.225, y: 0.225, z: 0, angle: 45 },
      { x: -0.225, y: 0.225, z: 0, angle: 135 },
      { x: -0.225, y: -0.225, z: 0, angle: 225 },
      { x: 0.225, y: -0.225, z: 0, angle: 315 },
    ],
    center_mount_positions: [
      { x: 0, y: 0, z: 0.03, type: 'battery' },
      { x: 0, y: -0.05, z: -0.02, type: 'tether_mount' },
    ],
    frame_weight_grams: 450,
    max_payload_grams: 1000,
    material: 'Carbon Fiber + Aluminum',
    compatible_propeller_sizes: { min: 10, max: 15 },
  },
];

export async function seedDatabase(): Promise<void> {
  try {
    logger.info('Starting database seeding...');

    // Check if already seeded
    const componentCount = await db.one('SELECT COUNT(*) FROM components');
    if (parseInt(componentCount.count) > 0) {
      logger.info('Database already seeded, skipping...');
      return;
    }

    // Seed components
    logger.info('Seeding components...');
    for (const component of sampleComponents) {
      await db.none(
        `INSERT INTO components (
          name, type, manufacturer, model_number, description,
          weight_grams, dimensions_mm, specifications, price_usd
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          component.name,
          component.type,
          component.manufacturer,
          component.model_number,
          component.description,
          component.weight_grams,
          JSON.stringify(component.dimensions_mm),
          JSON.stringify(component.specifications),
          component.price_usd,
        ]
      );
    }
    logger.info(`Seeded ${sampleComponents.length} components`);

    // Seed frames
    logger.info('Seeding drone frames...');
    for (const frame of sampleFrames) {
      await db.none(
        `INSERT INTO drone_frames (
          name, description, frame_type, arm_count, diagonal_mm,
          arm_positions, center_mount_positions, frame_weight_grams,
          max_payload_grams, material, compatible_propeller_sizes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          frame.name,
          frame.description,
          frame.frame_type,
          frame.arm_count,
          frame.diagonal_mm,
          JSON.stringify(frame.arm_positions),
          JSON.stringify(frame.center_mount_positions),
          frame.frame_weight_grams,
          frame.max_payload_grams,
          frame.material,
          JSON.stringify(frame.compatible_propeller_sizes),
        ]
      );
    }
    logger.info(`Seeded ${sampleFrames.length} drone frames`);

    // Create admin user
    logger.info('Creating admin user...');
    const adminPassword = await bcrypt.hash('admin123', 12);
    await db.none(
      `INSERT INTO users (
        email, password_hash, username, first_name, last_name,
        is_verified, role
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO NOTHING`,
      [
        'admin@dronesim.com',
        adminPassword,
        'admin',
        'System',
        'Administrator',
        true,
        'admin',
      ]
    );
    logger.info('Admin user created (admin@dronesim.com / admin123)');

    logger.info('Database seeding completed successfully');
  } catch (error: any) {
    logger.error('Database seeding failed', { error: error.message });
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      logger.info('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seeding failed', { error });
      process.exit(1);
    });
}

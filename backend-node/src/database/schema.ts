/**
 * Database Schema Definitions
 * Complete PostgreSQL schema for Drone Simulation System
 */

export const CREATE_TABLES_SQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    profile_image_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    verification_token VARCHAR(255),
    verification_token_expires TIMESTAMP WITH TIME ZONE,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);

-- ============================================
-- REFRESH TOKENS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL,
    device_info TEXT,
    ip_address INET,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- ============================================
-- COMPONENTS TABLE (Prebuilt drone parts)
-- ============================================
CREATE TABLE IF NOT EXISTS components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL CHECK (type IN (
        'frame', 'motor', 'propeller', 'battery',
        'esc', 'flight_controller', 'camera',
        'gps', 'sensor', 'payload', 'tether'
    )),
    manufacturer VARCHAR(255),
    model_number VARCHAR(100),
    description TEXT,

    -- Physical properties
    weight_grams DECIMAL(10, 2) NOT NULL,
    dimensions_mm JSONB, -- {length, width, height}

    -- Performance specifications (varies by type)
    specifications JSONB NOT NULL,
    /*
    For motors: {kv_rating, max_thrust_grams, max_current_amps, voltage_range}
    For propellers: {diameter_inches, pitch, blade_count, material}
    For batteries: {capacity_mah, voltage, cell_count, c_rating, discharge_rate}
    For frames: {arm_count, material, diagonal_mm, mount_pattern}
    For ESC: {max_current, protocols, voltage_range}
    For tether: {length_m, material, max_tension_n, cable_type}
    */

    -- Visual assets
    thumbnail_url TEXT,
    model_3d_url TEXT, -- URL to 3D model file (GLB/GLTF)

    -- Compatibility
    compatible_with JSONB, -- Array of component type IDs

    -- Pricing
    price_usd DECIMAL(10, 2),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_components_type ON components(type);
CREATE INDEX IF NOT EXISTS idx_components_active ON components(is_active);

-- ============================================
-- DRONE FRAMES TABLE (Frame templates)
-- ============================================
CREATE TABLE IF NOT EXISTS drone_frames (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    frame_type VARCHAR(50) NOT NULL CHECK (frame_type IN (
        'quadcopter', 'hexacopter', 'octocopter',
        'tricopter', 'fixed_wing', 'vtol'
    )),

    -- Frame geometry
    arm_count INTEGER NOT NULL,
    diagonal_mm DECIMAL(10, 2) NOT NULL,
    arm_positions JSONB NOT NULL, -- Array of {x, y, z, angle} for motor mounts
    center_mount_positions JSONB, -- Positions for central components

    -- Physical properties
    frame_weight_grams DECIMAL(10, 2) NOT NULL,
    max_payload_grams DECIMAL(10, 2),
    material VARCHAR(100),

    -- Visual
    thumbnail_url TEXT,
    model_3d_url TEXT,
    preview_config JSONB, -- Default component configuration for preview

    -- Compatibility
    compatible_motor_mounts JSONB, -- Mount patterns supported
    compatible_propeller_sizes JSONB, -- Min/max prop sizes

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_drone_frames_type ON drone_frames(frame_type);

-- ============================================
-- USER DRONES TABLE (User's drone designs)
-- ============================================
CREATE TABLE IF NOT EXISTS user_drones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Base frame
    frame_id UUID REFERENCES drone_frames(id),

    -- Component configuration (full drone specification)
    configuration JSONB NOT NULL,
    /*
    {
        frame: {id, position, rotation},
        motors: [{id, position, rotation, arm_index}],
        propellers: [{id, motor_index, direction}],
        battery: {id, position},
        esc: [{id, motor_index}],
        flight_controller: {id, position},
        payload: {id, position, weight},
        tether: {id, enabled, anchor_point, length},
        additional: [{id, type, position}]
    }
    */

    -- Calculated metrics (from physics engine)
    calculated_metrics JSONB,
    /*
    {
        total_weight_grams,
        max_thrust_grams,
        thrust_to_weight_ratio,
        estimated_flight_time_minutes,
        power_consumption_watts,
        center_of_mass: {x, y, z},
        moment_of_inertia: {xx, yy, zz}
    }
    */

    -- Preview image (auto-generated)
    thumbnail_url TEXT,

    -- Versioning
    version INTEGER DEFAULT 1,
    is_public BOOLEAN DEFAULT FALSE,

    -- Tags for organization
    tags TEXT[],

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_drones_user ON user_drones(user_id);
CREATE INDEX IF NOT EXISTS idx_user_drones_public ON user_drones(is_public) WHERE is_public = TRUE;

-- ============================================
-- SIMULATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS simulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    drone_id UUID NOT NULL REFERENCES user_drones(id) ON DELETE CASCADE,

    -- Simulation parameters
    name VARCHAR(255),
    simulation_type VARCHAR(50) DEFAULT 'flight_test' CHECK (simulation_type IN (
        'flight_test', 'stress_test', 'wind_test',
        'endurance_test', 'payload_test', 'tether_test'
    )),

    -- Environment settings
    environment_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    /*
    {
        gravity: 9.81,
        air_density: 1.225,
        wind: {velocity: {x, y, z}, turbulence: 0.1},
        temperature_celsius: 20,
        altitude_base_m: 0
    }
    */

    -- Initial conditions
    initial_state JSONB,
    /*
    {
        position: {x, y, z},
        velocity: {x, y, z},
        orientation: {roll, pitch, yaw},
        throttles: [0.5, 0.5, 0.5, 0.5]
    }
    */

    -- Simulation settings
    settings JSONB DEFAULT '{}'::jsonb,
    /*
    {
        duration_seconds: 60,
        time_step_ms: 20,
        record_interval_ms: 100,
        enable_failures: false,
        failure_scenarios: []
    }
    */

    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'running', 'paused', 'completed', 'failed', 'cancelled'
    )),

    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_simulations_user ON simulations(user_id);
CREATE INDEX IF NOT EXISTS idx_simulations_drone ON simulations(drone_id);
CREATE INDEX IF NOT EXISTS idx_simulations_status ON simulations(status);

-- ============================================
-- SIMULATION RESULTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS simulation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,

    -- Time series data (compressed)
    state_history JSONB NOT NULL,
    /*
    Array of states at each recorded timestep:
    [{
        timestamp,
        position: {x, y, z},
        velocity: {x, y, z},
        acceleration: {x, y, z},
        orientation: {roll, pitch, yaw},
        angular_velocity: {roll, pitch, yaw},
        motor_rpms: [],
        battery_voltage,
        power_draw,
        tether_tension
    }]
    */

    -- Summary metrics
    summary_metrics JSONB NOT NULL,
    /*
    {
        max_altitude_m,
        max_speed_mps,
        total_distance_m,
        flight_duration_s,
        avg_power_consumption_w,
        total_energy_wh,
        max_tilt_degrees,
        stability_score,
        efficiency_score
    }
    */

    -- Analysis results
    analysis JSONB,
    /*
    {
        stability_analysis: {...},
        failure_predictions: [{...}],
        flight_envelope: {...},
        recommendations: [...]
    }
    */

    -- Anomalies and events detected
    events JSONB DEFAULT '[]'::jsonb,
    /*
    [{
        timestamp,
        type: 'warning' | 'critical' | 'info',
        category: 'stability' | 'power' | 'tether' | 'collision',
        message,
        data: {...}
    }]
    */

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_results_simulation ON simulation_results(simulation_id);

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.columns
        WHERE column_name = 'updated_at'
        AND table_schema = 'public'
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
            CREATE TRIGGER update_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', t, t, t, t);
    END LOOP;
END;
$$ language 'plpgsql';
`;

export const DROP_TABLES_SQL = `
DROP TABLE IF EXISTS simulation_results CASCADE;
DROP TABLE IF EXISTS simulations CASCADE;
DROP TABLE IF EXISTS user_drones CASCADE;
DROP TABLE IF EXISTS drone_frames CASCADE;
DROP TABLE IF EXISTS components CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
`;

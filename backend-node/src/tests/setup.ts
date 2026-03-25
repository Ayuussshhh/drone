/**
 * Test Setup File
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_testing_purposes_only';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_for_testing_purposes';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'drone_simulation_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres';

// Increase timeout for async tests
jest.setTimeout(30000);

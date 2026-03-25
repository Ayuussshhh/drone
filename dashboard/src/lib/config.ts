/**
 * Environment Configuration
 */

export const config = {
  // API URLs
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001',
  physicsUrl: process.env.NEXT_PUBLIC_PHYSICS_URL || 'http://localhost:8000',

  // Auth
  tokenKey: 'drone_access_token',
  refreshTokenKey: 'drone_refresh_token',

  // App
  appName: 'Drone Simulation IDE',
  version: '1.0.0',
};

export default config;

/**
 * PostgreSQL Database Connection using pg-promise
 * Production-ready database configuration with connection pooling
 */

import pgPromise, { IInitOptions, IDatabase, IMain } from 'pg-promise';
import config from '../config';
import logger from '../config/logger';

// pg-promise initialization options
const initOptions: IInitOptions = {
  // Connection events
  connect({ client, dc, useCount }: { client: any; dc: any; useCount: number }) {
    const cp = client.connectionParameters;
    logger.debug(`Database connection established`, {
      host: cp.host,
      database: cp.database,
      useCount,
    });
  },

  disconnect({ client, dc }: { client: any; dc: any }) {
    const cp = client.connectionParameters;
    logger.debug(`Database connection released`, {
      host: cp.host,
      database: cp.database,
    });
  },

  error(err: any, e: any) {
    if (e.cn) {
      logger.error('Database connection error', { error: err.message });
    }
    if (e.query) {
      logger.error('Database query error', {
        query: e.query,
        params: e.params,
        error: err.message,
      });
    }
    if (e.ctx) {
      logger.error('Database context error', { error: err.message });
    }
  },

  query(e: any) {
    if (config.isDevelopment) {
      logger.debug('Database query', { query: e.query });
    }
  },
};

// Create pg-promise instance
const pgp: IMain = pgPromise(initOptions);

// Database connection config
const dbConfig = {
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: config.database.maxConnections, // Max connections in pool
  idleTimeoutMillis: 30000, // Remove idle connections after 30s
  connectionTimeoutMillis: 2000, // Connection timeout
};

// Create database instance
const db: IDatabase<{}> = pgp(dbConfig);

// Test connection
export async function testConnection(): Promise<boolean> {
  try {
    const result = await db.one('SELECT NOW() as now');
    logger.info('Database connection successful', { serverTime: result.now });
    return true;
  } catch (error: any) {
    logger.error('Database connection failed', { error: error.message });
    return false;
  }
}

// Graceful shutdown
export async function closeConnection(): Promise<void> {
  logger.info('Closing database connections...');
  pgp.end();
}

export { db, pgp };
export default db;

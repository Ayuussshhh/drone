/**
 * Database Initialization Script
 * Creates all required tables and extensions
 */

import db from './connection';
import { CREATE_TABLES_SQL, DROP_TABLES_SQL } from './schema';
import logger from '../config/logger';

export async function initializeDatabase(dropExisting = false): Promise<void> {
  try {
    logger.info('Starting database initialization...');

    if (dropExisting) {
      logger.warn('Dropping existing tables...');
      await db.none(DROP_TABLES_SQL);
      logger.info('Existing tables dropped');
    }

    logger.info('Creating tables...');
    await db.none(CREATE_TABLES_SQL);
    logger.info('Database tables created successfully');

    // Verify tables exist
    const tables = await db.many(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    logger.info('Created tables:', {
      tables: tables.map((t: { table_name: string }) => t.table_name),
    });
  } catch (error: any) {
    logger.error('Database initialization failed', { error: error.message });
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  const dropExisting = process.argv.includes('--drop');

  initializeDatabase(dropExisting)
    .then(() => {
      logger.info('Database initialization completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Database initialization failed', { error });
      process.exit(1);
    });
}

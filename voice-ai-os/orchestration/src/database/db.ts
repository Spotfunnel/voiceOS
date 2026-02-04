/**
 * Database Connection Module - Layer 2: Orchestration
 * 
 * PostgreSQL connection pool for Orchestration service.
 * Following backend-development patterns for connection management.
 */

import { Pool, PoolClient, QueryResult } from 'pg';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number; // Max pool size
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * Database connection pool singleton
 */
class Database {
  private pool: Pool | null = null;

  /**
   * Initialize database connection pool
   */
  initialize(config: DatabaseConfig): void {
    if (this.pool) {
      throw new Error('Database pool already initialized');
    }

    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: config.max || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  /**
   * Get database connection pool
   */
  getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  /**
   * Execute a query
   */
  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const pool = this.getPool();
    return pool.query<T>(text, params);
  }

  /**
   * Get a client from the pool (for transactions)
   */
  async getClient(): Promise<PoolClient> {
    const pool = this.getPool();
    return pool.connect();
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  /**
   * Health check - test database connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      return result.rows.length > 0;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
export const db = new Database();

/**
 * Initialize database from environment variables
 */
export function initializeDatabase(): void {
  const config: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'voice_ai',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
  };

  db.initialize(config);
}

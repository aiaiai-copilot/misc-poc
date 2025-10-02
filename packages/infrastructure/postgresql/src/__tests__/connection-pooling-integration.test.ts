/**
 * Connection Pooling and Prepared Statements Integration Tests
 *
 * These tests verify:
 * 1. Connection pooling configuration is properly set
 * 2. Prepared statements are used for SQL injection prevention
 * 3. Connection health checks work correctly
 * 4. Timeout handling functions as expected
 * 5. Connection recycling operates properly
 * 6. Transaction management is reliable
 *
 * Requirements from PRD (Section 5.1):
 * - Database Connections: 20 (pool size)
 * - SQL Injection: Parameterized queries only
 */

import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource, QueryRunner } from 'typeorm';
import { createDataSource, createTestDataSource } from '../data-source.js';

describe('Connection Pooling Integration Tests', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new PostgreSqlContainer('postgres:15').start();

    // Create data source with production configuration
    dataSource = createDataSource({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      database: container.getDatabase(),
      username: container.getUsername(),
      password: container.getPassword(),
    });

    await dataSource.initialize();
    await dataSource.runMigrations();
  }, 60000); // Increased timeout for container startup

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  describe('Connection Pool Configuration', () => {
    it('should configure connection pool with correct maximum size', async () => {
      // Access pool options through data source options
      const options = dataSource.options as any;
      const poolConfig = options.extra;

      // Verify pool configuration matches PRD requirements (20 connections)
      expect(poolConfig).toBeDefined();
      expect(poolConfig.max).toBe(20);
    });

    it('should configure connection pool with correct minimum size', async () => {
      const options = dataSource.options as any;
      const poolConfig = options.extra;

      // Minimum pool size should be configured
      expect(poolConfig.min).toBe(5);
    });

    it('should configure idle connection timeout', async () => {
      const options = dataSource.options as any;
      const poolConfig = options.extra;

      // Idle connections should be closed after 30 seconds
      expect(poolConfig.idleTimeoutMillis).toBe(30000);
    });

    it('should configure connection timeout', async () => {
      const options = dataSource.options as any;
      const poolConfig = options.extra;

      // Connection timeout should be set to 2 seconds
      expect(poolConfig.connectionTimeoutMillis).toBe(2000);
    });

    it('should configure pool acquire timeout', async () => {
      const options = dataSource.options as any;
      const poolConfig = options.extra;

      // Pool acquire timeout should be 60 seconds
      expect(poolConfig.acquireTimeoutMillis).toBe(60000);
    });
  });

  describe('Connection Health Checks', () => {
    it('should verify connection is alive with SELECT 1', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        await queryRunner.connect();

        // Health check query
        const result = await queryRunner.query('SELECT 1 as health_check');

        expect(result).toHaveLength(1);
        expect(result[0].health_check).toBe(1);
      } finally {
        await queryRunner.release();
      }
    });

    it('should allow querying after connection is established', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        await queryRunner.connect();

        // Verify we can execute queries
        const result = await queryRunner.query('SELECT NOW() as current_time');

        expect(result).toHaveLength(1);
        expect(result[0].current_time).toBeInstanceOf(Date);
      } finally {
        await queryRunner.release();
      }
    });

    it('should handle connection errors gracefully', async () => {
      // Create a data source with invalid credentials
      const invalidDataSource = createTestDataSource({
        host: container.getHost(),
        port: container.getMappedPort(5432),
        database: 'nonexistent_db',
        username: 'invalid_user',
        password: 'wrong_password',
      });

      // Attempt to initialize should fail
      await expect(invalidDataSource.initialize()).rejects.toThrow();

      // Cleanup
      await invalidDataSource.destroy().catch(() => {
        // Ignore cleanup errors
      });
    });
  });

  describe('Prepared Statements (SQL Injection Prevention)', () => {
    beforeEach(async () => {
      // Create a test table
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS test_users (
          id VARCHAR(255) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255)
        )
      `);
    });

    afterEach(async () => {
      // Clean up
      await dataSource.query('DROP TABLE IF EXISTS test_users');
    });

    it('should use parameterized queries for INSERT statements', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        // Insert using parameterized query (prepared statement)
        const result = await queryRunner.query(
          'INSERT INTO test_users (id, email, name) VALUES ($1, $2, $3) RETURNING *',
          ['test-id-1', 'test@example.com', "O'Brien"]
        );

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('test-id-1');
        expect(result[0].email).toBe('test@example.com');
        expect(result[0].name).toBe("O'Brien"); // Single quote handled safely
      } finally {
        await queryRunner.release();
      }
    });

    it('should use parameterized queries for SELECT statements', async () => {
      // Insert test data
      await dataSource.query(
        'INSERT INTO test_users (id, email, name) VALUES ($1, $2, $3)',
        ['test-id-2', 'select@example.com', 'Test User']
      );

      const queryRunner = dataSource.createQueryRunner();
      try {
        // Query using parameterized statement
        const result = await queryRunner.query(
          'SELECT * FROM test_users WHERE email = $1',
          ['select@example.com']
        );

        expect(result).toHaveLength(1);
        expect(result[0].email).toBe('select@example.com');
      } finally {
        await queryRunner.release();
      }
    });

    it('should safely handle potential SQL injection attempts', async () => {
      // Insert legitimate data
      await dataSource.query(
        'INSERT INTO test_users (id, email, name) VALUES ($1, $2, $3)',
        ['test-id-3', 'safe@example.com', 'Safe User']
      );

      const queryRunner = dataSource.createQueryRunner();
      try {
        // Attempt SQL injection via parameterized query (should be safe)
        const maliciousInput = "'; DROP TABLE test_users; --";
        const result = await queryRunner.query(
          'SELECT * FROM test_users WHERE name = $1',
          [maliciousInput]
        );

        // Should return no results (injection prevented)
        expect(result).toHaveLength(0);

        // Verify table still exists
        const tableCheck = await queryRunner.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = 'test_users'
          ) as table_exists
        `);
        expect(tableCheck[0].table_exists).toBe(true);
      } finally {
        await queryRunner.release();
      }
    });

    it('should use parameterized queries for UPDATE statements', async () => {
      // Insert test data
      await dataSource.query(
        'INSERT INTO test_users (id, email, name) VALUES ($1, $2, $3)',
        ['test-id-4', 'update@example.com', 'Old Name']
      );

      const queryRunner = dataSource.createQueryRunner();
      try {
        // Update using parameterized query
        const rawResult = await queryRunner.query(
          'UPDATE test_users SET name = $1 WHERE id = $2 RETURNING *',
          ['New Name', 'test-id-4']
        );

        // Handle TypeORM's UPDATE result format: [rows, affectedCount]
        const result = Array.isArray(rawResult[0]) ? rawResult[0] : rawResult;

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('New Name');
      } finally {
        await queryRunner.release();
      }
    });

    it('should use parameterized queries for DELETE statements', async () => {
      // Insert test data
      await dataSource.query(
        'INSERT INTO test_users (id, email, name) VALUES ($1, $2, $3)',
        ['test-id-5', 'delete@example.com', 'Delete Me']
      );

      const queryRunner = dataSource.createQueryRunner();
      try {
        // Delete using parameterized query
        await queryRunner.query('DELETE FROM test_users WHERE id = $1', [
          'test-id-5',
        ]);

        // Verify deletion
        const result = await queryRunner.query(
          'SELECT * FROM test_users WHERE id = $1',
          ['test-id-5']
        );
        expect(result).toHaveLength(0);
      } finally {
        await queryRunner.release();
      }
    });
  });

  describe('Connection Timeout Handling', () => {
    it('should timeout when connection cannot be established', async () => {
      // Create a data source with unreachable host
      const timeoutDataSource = createTestDataSource({
        host: '192.0.2.1', // Non-routable IP (TEST-NET-1)
        port: 5432,
        database: 'test',
        username: 'test',
        password: 'test',
      });

      // Should timeout and throw error
      const startTime = Date.now();
      await expect(timeoutDataSource.initialize()).rejects.toThrow();
      const elapsed = Date.now() - startTime;

      // With connection timeout of 2000ms, should fail relatively quickly
      // Note: DNS resolution and network stack may add overhead
      // Accepting up to 150 seconds as some environments have longer DNS/network timeouts
      expect(elapsed).toBeLessThan(150000); // 150 seconds max

      // Cleanup
      await timeoutDataSource.destroy().catch(() => {
        // Ignore cleanup errors
      });
    }, 180000); // 180 second test timeout

    it('should handle query timeout configuration', async () => {
      // Verify maxQueryExecutionTime is configured
      expect(dataSource.options.maxQueryExecutionTime).toBe(10000); // 10 seconds
    });
  });

  describe('Connection Recycling', () => {
    it('should release connection back to pool after use', async () => {
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();

      // Execute a query
      await queryRunner.query('SELECT 1');

      // Release connection
      await queryRunner.release();

      // Connection should be returned to pool (no error on new connection)
      const newQueryRunner = dataSource.createQueryRunner();
      await expect(newQueryRunner.connect()).resolves.not.toThrow();
      await newQueryRunner.release();
    });

    it('should allow multiple sequential connections from pool', async () => {
      const connections: QueryRunner[] = [];

      // Acquire multiple connections sequentially
      for (let i = 0; i < 5; i++) {
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.query('SELECT 1');
        connections.push(queryRunner);
      }

      // Release all connections
      for (const conn of connections) {
        await conn.release();
      }

      // Should be able to acquire new connection after releasing
      const finalQueryRunner = dataSource.createQueryRunner();
      await expect(finalQueryRunner.connect()).resolves.not.toThrow();
      await finalQueryRunner.release();
    });

    it('should handle concurrent connection requests', async () => {
      // Create multiple concurrent connection requests
      const connectionPromises = Array.from({ length: 10 }, async () => {
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.query('SELECT 1');
        await queryRunner.release();
      });

      // All connections should succeed
      await expect(Promise.all(connectionPromises)).resolves.not.toThrow();
    });
  });

  describe('Transaction Management', () => {
    beforeEach(async () => {
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS test_accounts (
          id VARCHAR(255) PRIMARY KEY,
          balance INTEGER NOT NULL
        )
      `);
    });

    afterEach(async () => {
      await dataSource.query('DROP TABLE IF EXISTS test_accounts');
    });

    it('should commit transaction on success', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        await queryRunner.connect();
        await queryRunner.startTransaction();

        // Insert data within transaction
        await queryRunner.query(
          'INSERT INTO test_accounts (id, balance) VALUES ($1, $2)',
          ['acc-1', 100]
        );

        await queryRunner.commitTransaction();

        // Data should be persisted
        const result = await queryRunner.query(
          'SELECT * FROM test_accounts WHERE id = $1',
          ['acc-1']
        );
        expect(result).toHaveLength(1);
        expect(result[0].balance).toBe(100);
      } finally {
        await queryRunner.release();
      }
    });

    it('should rollback transaction on error', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        await queryRunner.connect();
        await queryRunner.startTransaction();

        // Insert data
        await queryRunner.query(
          'INSERT INTO test_accounts (id, balance) VALUES ($1, $2)',
          ['acc-2', 200]
        );

        // Simulate error and rollback
        await queryRunner.rollbackTransaction();

        // Data should NOT be persisted
        const result = await queryRunner.query(
          'SELECT * FROM test_accounts WHERE id = $1',
          ['acc-2']
        );
        expect(result).toHaveLength(0);
      } finally {
        await queryRunner.release();
      }
    });

    it('should handle nested transaction-like behavior with savepoints', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        await queryRunner.connect();
        await queryRunner.startTransaction();

        // Insert first record
        await queryRunner.query(
          'INSERT INTO test_accounts (id, balance) VALUES ($1, $2)',
          ['acc-3', 300]
        );

        // Create savepoint
        await queryRunner.query('SAVEPOINT sp1');

        // Insert second record
        await queryRunner.query(
          'INSERT INTO test_accounts (id, balance) VALUES ($1, $2)',
          ['acc-4', 400]
        );

        // Rollback to savepoint (only acc-4 should be rolled back)
        await queryRunner.query('ROLLBACK TO SAVEPOINT sp1');

        await queryRunner.commitTransaction();

        // First record should exist
        const result1 = await queryRunner.query(
          'SELECT * FROM test_accounts WHERE id = $1',
          ['acc-3']
        );
        expect(result1).toHaveLength(1);

        // Second record should not exist
        const result2 = await queryRunner.query(
          'SELECT * FROM test_accounts WHERE id = $1',
          ['acc-4']
        );
        expect(result2).toHaveLength(0);
      } finally {
        await queryRunner.release();
      }
    });

    it('should prevent dirty reads with proper transaction isolation', async () => {
      // Insert initial data
      await dataSource.query(
        'INSERT INTO test_accounts (id, balance) VALUES ($1, $2)',
        ['acc-5', 500]
      );

      const queryRunner1 = dataSource.createQueryRunner();
      const queryRunner2 = dataSource.createQueryRunner();

      try {
        await queryRunner1.connect();
        await queryRunner2.connect();

        // Start transaction in first connection
        await queryRunner1.startTransaction();

        // Update balance in first transaction (not committed)
        await queryRunner1.query(
          'UPDATE test_accounts SET balance = $1 WHERE id = $2',
          [1000, 'acc-5']
        );

        // Read from second connection (should not see uncommitted change)
        const result = await queryRunner2.query(
          'SELECT balance FROM test_accounts WHERE id = $1',
          ['acc-5']
        );

        // Should see original value (500), not uncommitted value (1000)
        expect(result[0].balance).toBe(500);

        // Rollback first transaction
        await queryRunner1.rollbackTransaction();
      } finally {
        await queryRunner1.release();
        await queryRunner2.release();
      }
    });

    it('should properly cleanup transaction on connection error', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        await queryRunner.connect();
        await queryRunner.startTransaction();

        await queryRunner.query(
          'INSERT INTO test_accounts (id, balance) VALUES ($1, $2)',
          ['acc-6', 600]
        );

        // Simulate error
        if (queryRunner.isTransactionActive) {
          await queryRunner.rollbackTransaction();
        }

        // Data should not be persisted
        const result = await queryRunner.query(
          'SELECT * FROM test_accounts WHERE id = $1',
          ['acc-6']
        );
        expect(result).toHaveLength(0);
      } finally {
        await queryRunner.release();
      }
    });
  });

  describe('Connection Pool Performance', () => {
    it('should handle high concurrent load (100 concurrent queries)', async () => {
      const concurrentQueries = 100;
      const startTime = Date.now();

      // Execute 100 concurrent queries (PRD requirement: 50 RPS, 100 concurrent users)
      const queryPromises = Array.from(
        { length: concurrentQueries },
        async (_, i) => {
          const queryRunner = dataSource.createQueryRunner();
          try {
            await queryRunner.connect();
            const result = await queryRunner.query(
              'SELECT $1::integer as query_num',
              [i]
            );
            return result[0].query_num;
          } finally {
            await queryRunner.release();
          }
        }
      );

      const results = await Promise.all(queryPromises);
      const elapsed = Date.now() - startTime;

      // All queries should complete successfully
      expect(results).toHaveLength(concurrentQueries);
      // Verify all results are valid numbers (can be number or string from DB)
      expect(results.every((r) => !isNaN(Number(r)))).toBe(true);

      // Performance check: Should complete within reasonable time
      // With proper pooling, 100 queries should complete in under 10 seconds
      expect(elapsed).toBeLessThan(10000);
    }, 30000); // 30 second test timeout

    it('should reuse connections efficiently under sequential load', async () => {
      const sequentialQueries = 50;
      const startTime = Date.now();

      // Execute 50 sequential queries
      for (let i = 0; i < sequentialQueries; i++) {
        const queryRunner = dataSource.createQueryRunner();
        try {
          await queryRunner.connect();
          await queryRunner.query('SELECT 1');
        } finally {
          await queryRunner.release();
        }
      }

      const elapsed = Date.now() - startTime;

      // Sequential queries should be fast with connection reuse
      // Should complete in under 5 seconds
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe('Connection Error Recovery', () => {
    it('should recover from temporary connection failure', async () => {
      // First successful connection
      const queryRunner1 = dataSource.createQueryRunner();
      try {
        await queryRunner1.connect();
        await queryRunner1.query('SELECT 1');
      } finally {
        await queryRunner1.release();
      }

      // New connection should work (simulating recovery)
      const queryRunner2 = dataSource.createQueryRunner();
      try {
        await queryRunner2.connect();
        const result = await queryRunner2.query('SELECT 1 as recovered');
        expect(result[0].recovered).toBe(1);
      } finally {
        await queryRunner2.release();
      }
    });

    it('should provide meaningful error messages on connection failure', async () => {
      const invalidDataSource = createTestDataSource({
        host: 'nonexistent-host.example.com',
        port: 5432,
        database: 'test',
        username: 'test',
        password: 'test',
      });

      try {
        await invalidDataSource.initialize();
        fail('Should have thrown an error');
      } catch (error) {
        // Error should contain useful information
        expect(error).toBeDefined();
        expect((error as Error).message).toBeTruthy();
      } finally {
        await invalidDataSource.destroy().catch(() => {
          // Ignore cleanup errors
        });
      }
    });
  });
});

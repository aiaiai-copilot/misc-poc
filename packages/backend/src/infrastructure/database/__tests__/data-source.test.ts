import { DataSource } from 'typeorm';
import {
  AppDataSource,
  TestDataSource,
  getDataSource,
} from '../data-source.js';

describe('TypeORM DataSource Configuration', () => {
  describe('AppDataSource', () => {
    it('should be configured for migrations-only mode', () => {
      expect(AppDataSource.options.synchronize).toBe(false);
      expect(AppDataSource.options.dropSchema).toBe(false);
      expect(AppDataSource.options.migrationsRun).toBe(false);
    });

    it('should have correct database type and connection settings', () => {
      expect(AppDataSource.options.type).toBe('postgres');
      expect(AppDataSource.options.host).toBe('localhost');
      expect(AppDataSource.options.port).toBe(5432);
    });

    it('should have migration configuration', () => {
      expect(AppDataSource.options.migrations).toBeDefined();
      expect(Array.isArray(AppDataSource.options.migrations)).toBe(true);
      expect(AppDataSource.options.migrationsTableName).toBe(
        'migration_history'
      );
    });

    it('should have connection pool settings', () => {
      const extra = AppDataSource.options.extra as any;
      expect(extra).toBeDefined();
      expect(extra.max).toBeDefined();
      expect(extra.min).toBeDefined();
      expect(extra.connectionTimeoutMillis).toBeDefined();
    });

    it('should have appropriate logging configuration', () => {
      expect(AppDataSource.options.logging).toBeDefined();
      if (process.env.NODE_ENV === 'development') {
        expect(AppDataSource.options.logging).toEqual([
          'query',
          'error',
          'schema',
          'warn',
          'info',
          'log',
        ]);
      } else {
        expect(AppDataSource.options.logging).toEqual(['error']);
      }
    });
  });

  describe('TestDataSource', () => {
    it('should be configured for test environment', () => {
      expect(TestDataSource.options.synchronize).toBe(false);
      expect(TestDataSource.options.dropSchema).toBe(false);
      expect(TestDataSource.options.migrationsRun).toBe(false);
    });

    it('should use test database settings', () => {
      expect(TestDataSource.options.port).toBe(5433);
      expect(TestDataSource.options.database).toBe('misc_poc_test');
      expect(TestDataSource.options.username).toBe('postgres_test');
    });

    it('should have minimal logging for tests', () => {
      expect(TestDataSource.options.logging).toEqual(['error']);
    });

    it('should have reduced connection pool for testing', () => {
      const extra = TestDataSource.options.extra as any;
      expect(extra.max).toBe(5);
      expect(extra.min).toBe(1);
    });
  });

  describe('getDataSource', () => {
    it('should return TestDataSource when NODE_ENV is test', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const dataSource = getDataSource();
      expect(dataSource).toBe(TestDataSource);

      process.env.NODE_ENV = originalEnv;
    });

    it('should return AppDataSource when NODE_ENV is not test', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const dataSource = getDataSource();
      expect(dataSource).toBe(AppDataSource);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('DataSource instances', () => {
    it('should be instances of DataSource', () => {
      expect(AppDataSource).toBeInstanceOf(DataSource);
      expect(TestDataSource).toBeInstanceOf(DataSource);
    });

    it('should not be initialized by default', () => {
      expect(AppDataSource.isInitialized).toBe(false);
      expect(TestDataSource.isInitialized).toBe(false);
    });
  });
});

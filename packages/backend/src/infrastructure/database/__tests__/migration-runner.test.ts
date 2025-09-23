import { DataSource } from 'typeorm';
import { MigrationRunner } from '../migration-runner.js';

// Mock TypeORM DataSource
const mockDataSource = {
  isInitialized: false,
  initialize: jest.fn(),
  destroy: jest.fn(),
  runMigrations: jest.fn(),
  undoLastMigration: jest.fn(),
  createQueryRunner: jest.fn(),
  migrations: [],
  options: {
    migrationsTableName: 'migration_history',
  },
} as unknown as DataSource;

const mockQueryRunner = {
  query: jest.fn(),
  release: jest.fn(),
};

describe('MigrationRunner', () => {
  let migrationRunner: MigrationRunner;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockDataSource.createQueryRunner as jest.Mock).mockReturnValue(
      mockQueryRunner
    );
    migrationRunner = new MigrationRunner(mockDataSource);
  });

  describe('initialization', () => {
    it('should initialize DataSource when not already initialized', async () => {
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);

      await migrationRunner.initialize();

      expect(mockDataSource.initialize).toHaveBeenCalledTimes(1);
    });

    it('should not initialize DataSource when already initialized', async () => {
      (mockDataSource as any).isInitialized = true;

      await migrationRunner.initialize();

      expect(mockDataSource.initialize).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should destroy DataSource when initialized', async () => {
      (mockDataSource as any).isInitialized = true;
      (mockDataSource.destroy as jest.Mock).mockResolvedValue(undefined);

      await migrationRunner.destroy();

      expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
    });

    it('should not destroy DataSource when not initialized', async () => {
      (mockDataSource as any).isInitialized = false;

      await migrationRunner.destroy();

      expect(mockDataSource.destroy).not.toHaveBeenCalled();
    });
  });

  describe('runMigrations', () => {
    it('should run migrations and return migration names', async () => {
      const mockMigrations = [{ name: 'Migration1' }, { name: 'Migration2' }];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockDataSource.runMigrations as jest.Mock).mockResolvedValue(
        mockMigrations
      );

      const result = await migrationRunner.runMigrations();

      expect(mockDataSource.initialize).toHaveBeenCalled();
      expect(mockDataSource.runMigrations).toHaveBeenCalledWith({
        transaction: 'all',
      });
      expect(result).toEqual(['Migration1', 'Migration2']);
    });

    it('should handle migration execution errors', async () => {
      const error = new Error('Migration failed');
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockDataSource.runMigrations as jest.Mock).mockRejectedValue(error);

      await expect(migrationRunner.runMigrations()).rejects.toThrow(
        'Migration failed'
      );
    });
  });

  describe('revertLastMigration', () => {
    it('should revert migration and return migration name', async () => {
      const mockExecutedMigrations = [
        { id: 1, timestamp: 123456789, name: 'LastMigration' },
      ];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockQueryRunner.query as jest.Mock).mockResolvedValue(
        mockExecutedMigrations
      );
      (mockDataSource.undoLastMigration as jest.Mock).mockResolvedValue(
        undefined
      );

      const result = await migrationRunner.revertLastMigration();

      expect(mockDataSource.initialize).toHaveBeenCalled();
      expect(mockDataSource.undoLastMigration).toHaveBeenCalledWith({
        transaction: 'all',
      });
      expect(result).toBe('LastMigration');
    });

    it('should return null when no migrations to revert', async () => {
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockQueryRunner.query as jest.Mock).mockResolvedValue([]);

      const result = await migrationRunner.revertLastMigration();

      expect(result).toBeNull();
      expect(mockDataSource.undoLastMigration).not.toHaveBeenCalled();
    });
  });

  describe('getExecutedMigrations', () => {
    it('should return executed migrations', async () => {
      const mockMigrations = [
        { id: 1, timestamp: 123456789, name: 'Migration1' },
        { id: 2, timestamp: 123456790, name: 'Migration2' },
      ];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockQueryRunner.query as jest.Mock).mockResolvedValue(mockMigrations);

      const result = await migrationRunner.getExecutedMigrations();

      expect(result).toEqual(mockMigrations);
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT id, timestamp, name FROM migration_history ORDER BY timestamp DESC`
      );
    });

    it('should return empty array when migration table does not exist', async () => {
      const error = { code: '42P01' };
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockQueryRunner.query as jest.Mock).mockRejectedValue(error);

      const result = await migrationRunner.getExecutedMigrations();

      expect(result).toEqual([]);
    });
  });

  describe('getPendingMigrations', () => {
    it('should return pending migration names', async () => {
      const mockExecutedMigrations = [
        { id: 1, timestamp: 123456789, name: 'Migration1' },
      ];
      const mockAllMigrations = [
        { name: 'Migration1' },
        { name: 'Migration2' },
        { name: 'Migration3' },
      ];

      (mockDataSource as any).isInitialized = false;
      (mockDataSource as any).migrations = mockAllMigrations;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockQueryRunner.query as jest.Mock).mockResolvedValue(
        mockExecutedMigrations
      );

      const result = await migrationRunner.getPendingMigrations();

      expect(result).toEqual(['Migration2', 'Migration3']);
    });
  });

  describe('isUpToDate', () => {
    it('should return true when no pending migrations', async () => {
      const mockExecutedMigrations = [
        { id: 1, timestamp: 123456789, name: 'Migration1' },
      ];
      const mockAllMigrations = [{ name: 'Migration1' }];

      (mockDataSource as any).isInitialized = false;
      (mockDataSource as any).migrations = mockAllMigrations;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockQueryRunner.query as jest.Mock).mockResolvedValue(
        mockExecutedMigrations
      );

      const result = await migrationRunner.isUpToDate();

      expect(result).toBe(true);
    });

    it('should return false when there are pending migrations', async () => {
      const mockExecutedMigrations = [];
      const mockAllMigrations = [{ name: 'Migration1' }];

      (mockDataSource as any).isInitialized = false;
      (mockDataSource as any).migrations = mockAllMigrations;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockQueryRunner.query as jest.Mock).mockResolvedValue(
        mockExecutedMigrations
      );

      const result = await migrationRunner.isUpToDate();

      expect(result).toBe(false);
    });
  });

  describe('validateConnection', () => {
    it('should return true for successful connection', async () => {
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockQueryRunner.query as jest.Mock).mockResolvedValue([
        { '?column?': 1 },
      ]);

      const result = await migrationRunner.validateConnection();

      expect(result).toBe(true);
      expect(mockQueryRunner.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return false for failed connection', async () => {
      const error = new Error('Connection failed');
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await migrationRunner.validateConnection();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Database connection validation failed:',
        error
      );

      consoleSpy.mockRestore();
    });
  });
});

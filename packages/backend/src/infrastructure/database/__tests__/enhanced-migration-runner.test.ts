import { DataSource } from 'typeorm';
import { EnhancedMigrationRunner } from '../enhanced-migration-runner.js';

/**
 * TDD Contract Tests for Enhanced Migration Runner
 * Following PRD section 4.2.2 - Database Migration Strategy
 *
 * This test suite defines the contract for task 3.5:
 * - Migration execution system with rollback functionality
 * - Transaction wrapping and error logging
 * - State tracking for migration operations
 * - CLI commands for migration management
 */

// Mock TypeORM DataSource with enhanced capabilities
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
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  isTransactionActive: false,
};

describe('Enhanced Migration Runner Contract Tests', () => {
  let migrationRunner: EnhancedMigrationRunner;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockDataSource.createQueryRunner as jest.Mock).mockReturnValue(
      mockQueryRunner
    );
    migrationRunner = new EnhancedMigrationRunner(mockDataSource);
  });

  describe('Migration Execution with Transaction Support', () => {
    it('should wrap migration execution in transaction', async () => {
      // Arrange
      const mockMigrations = [{ name: 'Migration1' }, { name: 'Migration2' }];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockDataSource.runMigrations as jest.Mock).mockResolvedValue(
        mockMigrations
      );

      // Act
      const result = await migrationRunner.runMigrationsWithTransaction();

      // Assert
      expect(mockDataSource.initialize).toHaveBeenCalled();
      expect(mockDataSource.runMigrations).toHaveBeenCalledWith({
        transaction: 'all',
      });
      expect(result.success).toBe(true);
      expect(result.executedMigrations).toEqual(['Migration1', 'Migration2']);
      expect(result.errors).toHaveLength(0);
    });

    it('should rollback transaction on migration failure', async () => {
      // Arrange
      const error = new Error('Migration execution failed');
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockDataSource.runMigrations as jest.Mock).mockRejectedValue(error);

      // Act
      const result = await migrationRunner.runMigrationsWithTransaction();

      // Assert
      expect(result.success).toBe(false);
      expect(result.executedMigrations).toHaveLength(0);
      expect(result.errors).toContain('Migration execution failed');
    });

    it('should log migration progress and results', async () => {
      // Arrange
      const mockMigrations = [{ name: 'Migration1' }];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockDataSource.runMigrations as jest.Mock).mockResolvedValue(
        mockMigrations
      );
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await migrationRunner.runMigrationsWithTransaction();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting migration execution')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Migration completed successfully')
      );

      consoleSpy.mockRestore();
    });

    it('should handle partial migration failures gracefully', async () => {
      // Arrange
      const mockExecutedMigrations = [
        { id: 1, timestamp: 123456789, name: 'Migration1' },
      ];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockQueryRunner.query as jest.Mock).mockResolvedValue(
        mockExecutedMigrations
      );
      (mockDataSource.runMigrations as jest.Mock).mockImplementation(() => {
        throw new Error('Partial failure after Migration1');
      });

      // Act
      const result = await migrationRunner.runMigrationsWithTransaction();

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Partial failure after Migration1');
    });
  });

  describe('Enhanced Rollback Functionality', () => {
    it('should rollback to specific migration version', async () => {
      // Arrange
      const targetMigration = 'Migration1';
      const mockExecutedMigrations = [
        { id: 3, timestamp: 123456791, name: 'Migration3' },
        { id: 2, timestamp: 123456790, name: 'Migration2' },
        { id: 1, timestamp: 123456789, name: 'Migration1' },
      ];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockQueryRunner.query as jest.Mock).mockResolvedValue(
        mockExecutedMigrations
      );
      (mockDataSource.undoLastMigration as jest.Mock).mockResolvedValue(
        undefined
      );

      // Act
      const result = await migrationRunner.rollbackToMigration(targetMigration);

      // Assert
      expect(result.success).toBe(true);
      expect(result.rolledBackMigrations).toEqual(['Migration3', 'Migration2']);
      expect(result.currentMigration).toBe(targetMigration);
      expect(mockDataSource.undoLastMigration).toHaveBeenCalledTimes(2);
    });

    it('should validate rollback target before execution', async () => {
      // Arrange
      const invalidTarget = 'NonExistentMigration';
      const mockExecutedMigrations = [
        { id: 1, timestamp: 123456789, name: 'Migration1' },
      ];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockQueryRunner.query as jest.Mock).mockResolvedValue(
        mockExecutedMigrations
      );

      // Act
      const result = await migrationRunner.rollbackToMigration(invalidTarget);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Target migration NonExistentMigration not found in executed migrations'
      );
      expect(mockDataSource.undoLastMigration).not.toHaveBeenCalled();
    });

    it('should handle rollback failures with proper cleanup', async () => {
      // Arrange
      const targetMigration = 'Migration1';
      const mockExecutedMigrations = [
        { id: 2, timestamp: 123456790, name: 'Migration2' },
        { id: 1, timestamp: 123456789, name: 'Migration1' },
      ];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockQueryRunner.query as jest.Mock).mockResolvedValue(
        mockExecutedMigrations
      );
      (mockDataSource.undoLastMigration as jest.Mock).mockRejectedValue(
        new Error('Rollback failed')
      );

      // Act
      const result = await migrationRunner.rollbackToMigration(targetMigration);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Rollback failed');
    });

    it('should create backup before destructive rollback', async () => {
      // Arrange
      const targetMigration = 'Migration1';
      const mockExecutedMigrations = [
        { id: 2, timestamp: 123456790, name: 'Migration2' },
        { id: 1, timestamp: 123456789, name: 'Migration1' },
      ];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockQueryRunner.query as jest.Mock).mockResolvedValue(
        mockExecutedMigrations
      );
      (mockDataSource.undoLastMigration as jest.Mock).mockResolvedValue(
        undefined
      );

      // Act
      const result = await migrationRunner.rollbackToMigration(
        targetMigration,
        { createBackup: true }
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.backupCreated).toBe(true);
    });
  });

  describe('Migration State Tracking', () => {
    it('should track migration execution state', async () => {
      // Arrange
      const mockMigrations = [{ name: 'Migration1' }];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockDataSource.runMigrations as jest.Mock).mockResolvedValue(
        mockMigrations
      );

      // Act
      const result = await migrationRunner.runMigrationsWithTransaction();

      // Assert
      expect(result.state).toBeDefined();
      expect(result.state.executionStartTime).toBeDefined();
      expect(result.state.executionEndTime).toBeDefined();
      expect(result.state.totalDuration).toBeGreaterThan(0);
    });

    it('should provide detailed migration status', async () => {
      // Arrange
      const mockExecutedMigrations = [
        { id: 1, timestamp: 123456789, name: 'Migration1' },
      ];
      const mockAllMigrations = [
        { name: 'Migration1' },
        { name: 'Migration2' },
      ];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource as any).migrations = mockAllMigrations;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockQueryRunner.query as jest.Mock).mockResolvedValue(
        mockExecutedMigrations
      );

      // Act
      const status = await migrationRunner.getDetailedStatus();

      // Assert
      expect(status.isUpToDate).toBe(false);
      expect(status.executedCount).toBe(1);
      expect(status.pendingCount).toBe(1);
      expect(status.executedMigrations).toEqual(['Migration1']);
      expect(status.pendingMigrations).toEqual(['Migration2']);
      expect(status.lastMigrationDate).toBeDefined();
    });

    it('should track migration performance metrics', async () => {
      // Arrange
      const mockMigrations = [{ name: 'Migration1' }];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockDataSource.runMigrations as jest.Mock).mockResolvedValue(
        mockMigrations
      );

      // Act
      const result = await migrationRunner.runMigrationsWithTransaction();

      // Assert
      expect(result.performance).toBeDefined();
      expect(result.performance.migrationCount).toBe(1);
      expect(result.performance.averageExecutionTime).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should provide detailed error information', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockRejectedValue(error);

      // Act
      const result = await migrationRunner.runMigrationsWithTransaction();

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(result.errorDetails.message).toBe('Database connection failed');
      expect(result.errorDetails.timestamp).toBeDefined();
    });

    it('should support dry-run mode for safe testing', async () => {
      // Arrange
      const mockExecutedMigrations = [
        { id: 1, timestamp: 123456789, name: 'Migration1' },
      ];
      const mockAllMigrations = [
        { name: 'Migration1' },
        { name: 'Migration2' },
      ];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource as any).migrations = mockAllMigrations;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockQueryRunner.query as jest.Mock).mockResolvedValue(
        mockExecutedMigrations
      );

      // Act
      const result = await migrationRunner.runMigrationsWithTransaction({
        dryRun: true,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.plannedMigrations).toEqual(['Migration2']);
      expect(mockDataSource.runMigrations).not.toHaveBeenCalled();
    });

    it('should handle database connection failures gracefully', async () => {
      // Arrange
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockRejectedValue(
        new Error('Connection timeout')
      );

      // Act
      const result = await migrationRunner.validateDatabaseConnection();

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Connection timeout');
    });
  });

  describe('Migration History Management', () => {
    it('should export migration history for backup', async () => {
      // Arrange
      const mockMigrations = [
        { id: 1, timestamp: 123456789, name: 'Migration1' },
        { id: 2, timestamp: 123456790, name: 'Migration2' },
      ];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockQueryRunner.query as jest.Mock).mockResolvedValue(mockMigrations);

      // Act
      const history = await migrationRunner.exportMigrationHistory();

      // Assert
      expect(history.migrations).toHaveLength(2);
      expect(history.exportDate).toBeDefined();
      expect(history.version).toBe('2.0');
    });

    it('should validate migration history integrity', async () => {
      // Arrange
      const mockMigrations = [
        { id: 1, timestamp: 123456789, name: 'Migration1' },
        { id: 2, timestamp: 123456790, name: 'Migration2' },
      ];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockQueryRunner.query as jest.Mock).mockResolvedValue(mockMigrations);

      // Act
      const validation = await migrationRunner.validateMigrationHistory();

      // Assert
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });
  });

  describe('CLI Integration Support', () => {
    it('should provide CLI-friendly output format', async () => {
      // Arrange
      const mockMigrations = [{ name: 'Migration1' }];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockDataSource.runMigrations as jest.Mock).mockResolvedValue(
        mockMigrations
      );

      // Act
      const result = await migrationRunner.runMigrationsWithTransaction({
        outputFormat: 'cli',
      });

      // Assert
      expect(result.cliOutput).toBeDefined();
      expect(result.cliOutput.summary).toContain('1 migration executed');
      expect(result.cliOutput.details).toHaveLength(1);
    });

    it('should support progress reporting for CLI', async () => {
      // Arrange
      const mockMigrations = [{ name: 'Migration1' }, { name: 'Migration2' }];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockDataSource.runMigrations as jest.Mock).mockResolvedValue(
        mockMigrations
      );

      const progressCallback = jest.fn();

      // Act
      await migrationRunner.runMigrationsWithTransaction({
        progressCallback,
      });

      // Assert
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'starting',
          message: expect.any(String),
        })
      );
    });
  });

  describe('Checksum Validation Integration', () => {
    beforeEach(() => {
      // Mock MigrationChecksumValidator methods
      jest.doMock('../migration-checksum-validator.js', () => ({
        MigrationChecksumValidator: jest.fn().mockImplementation(() => ({
          analyzeMigrationFile: jest.fn(),
          validateMigrationChecksum: jest.fn(),
          generateChecksumForFile: jest.fn(),
        })),
      }));
    });

    it('should validate migration checksums before execution', async () => {
      // Arrange
      const mockMigrations = [{ name: 'Migration1' }];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockDataSource.runMigrations as jest.Mock).mockResolvedValue(
        mockMigrations
      );

      // Mock checksum validation to pass
      const mockValidateChecksums = jest.fn().mockResolvedValue({
        isValid: true,
        validationResults: [
          {
            migrationName: 'Migration1',
            filePath: '/path/to/Migration1.ts',
            isValid: true,
            actualChecksum: 'abc123',
          },
        ],
        totalChecked: 1,
        validCount: 1,
        invalidCount: 0,
      });
      migrationRunner.validateMigrationChecksums = mockValidateChecksums;

      const progressCallback = jest.fn();

      // Act
      const result = await migrationRunner.runMigrationsWithTransaction({
        progressCallback,
      });

      // Assert
      expect(mockValidateChecksums).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'validating',
          message: 'Validating migration file integrity...',
        })
      );
      expect(result.success).toBe(true);
    });

    it('should fail migration execution if checksum validation fails', async () => {
      // Arrange
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);

      // Mock checksum validation to fail
      const mockValidateChecksums = jest.fn().mockResolvedValue({
        isValid: false,
        validationResults: [
          {
            migrationName: 'Migration1',
            filePath: '/path/to/Migration1.ts',
            isValid: false,
            expectedChecksum: 'abc123',
            actualChecksum: 'def456',
            error: 'checksum mismatch',
          },
        ],
        totalChecked: 1,
        validCount: 0,
        invalidCount: 1,
      });
      migrationRunner.validateMigrationChecksums = mockValidateChecksums;

      // Act
      const result = await migrationRunner.runMigrationsWithTransaction();

      // Assert
      expect(mockValidateChecksums).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Migration integrity check failed');
      expect(mockDataSource.runMigrations).not.toHaveBeenCalled();
    });

    it('should update checksums after successful migration execution', async () => {
      // Arrange
      const mockMigrations = [{ name: 'Migration1' }, { name: 'Migration2' }];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockDataSource.runMigrations as jest.Mock).mockResolvedValue(
        mockMigrations
      );

      // Mock checksum validation and update methods
      const mockValidateChecksums = jest.fn().mockResolvedValue({
        isValid: true,
        validationResults: [],
        totalChecked: 0,
        validCount: 0,
        invalidCount: 0,
      });
      const mockUpdateChecksums = jest.fn().mockResolvedValue(undefined);
      migrationRunner.validateMigrationChecksums = mockValidateChecksums;
      migrationRunner.updateMigrationChecksums = mockUpdateChecksums;

      const progressCallback = jest.fn();

      // Act
      const result = await migrationRunner.runMigrationsWithTransaction({
        progressCallback,
      });

      // Assert
      expect(mockUpdateChecksums).toHaveBeenCalledWith([
        'Migration1',
        'Migration2',
      ]);
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'updating-checksums',
          message: 'Updating migration checksums...',
        })
      );
      expect(result.success).toBe(true);
    });

    it('should not fail migration if checksum update fails', async () => {
      // Arrange
      const mockMigrations = [{ name: 'Migration1' }];
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);
      (mockDataSource.runMigrations as jest.Mock).mockResolvedValue(
        mockMigrations
      );

      // Mock checksum validation to pass but update to fail
      const mockValidateChecksums = jest.fn().mockResolvedValue({
        isValid: true,
        validationResults: [],
        totalChecked: 0,
        validCount: 0,
        invalidCount: 0,
      });
      const mockUpdateChecksums = jest
        .fn()
        .mockRejectedValue(new Error('Update failed'));
      migrationRunner.validateMigrationChecksums = mockValidateChecksums;
      migrationRunner.updateMigrationChecksums = mockUpdateChecksums;

      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      // Act
      const result = await migrationRunner.runMigrationsWithTransaction();

      // Assert
      expect(result.success).toBe(true); // Migration should still succeed
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to update migration checksums:',
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });

    it('should validate individual migration checksums against stored values', async () => {
      // Arrange
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);

      // Mock filesystem and database calls
      const mockGetMigrationFiles = jest
        .fn()
        .mockResolvedValue([
          '/path/to/Migration1.ts',
          '/path/to/Migration2.ts',
        ]);
      const mockGetStoredChecksums = jest.fn().mockResolvedValue(
        new Map([
          ['Migration1', 'abc123'],
          ['Migration2', 'def456'],
        ])
      );

      migrationRunner['getMigrationFiles'] = mockGetMigrationFiles;
      migrationRunner['getStoredChecksums'] = mockGetStoredChecksums;

      // Mock checksum validator
      const mockAnalyzeMigrationFile = jest
        .fn()
        .mockResolvedValueOnce({
          name: 'Migration1',
          checksum: 'abc123',
        })
        .mockResolvedValueOnce({
          name: 'Migration2',
          checksum: 'def456',
        });
      const mockValidateChecksum = jest.fn().mockResolvedValue(true);

      migrationRunner['checksumValidator'] = {
        analyzeMigrationFile: mockAnalyzeMigrationFile,
        validateMigrationChecksum: mockValidateChecksum,
      } as any;

      // Act
      const result = await migrationRunner.validateMigrationChecksums();

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.totalChecked).toBe(2);
      expect(result.validCount).toBe(2);
      expect(result.invalidCount).toBe(0);
      expect(mockValidateChecksum).toHaveBeenCalledTimes(2);
    });

    it('should handle checksum validation errors gracefully', async () => {
      // Arrange
      (mockDataSource as any).isInitialized = false;
      (mockDataSource.initialize as jest.Mock).mockResolvedValue(undefined);

      // Mock filesystem call to return files
      const mockGetMigrationFiles = jest
        .fn()
        .mockResolvedValue(['/path/to/Migration1.ts']);
      const mockGetStoredChecksums = jest
        .fn()
        .mockResolvedValue(new Map([['Migration1', 'abc123']]));

      migrationRunner['getMigrationFiles'] = mockGetMigrationFiles;
      migrationRunner['getStoredChecksums'] = mockGetStoredChecksums;

      // Mock checksum validator to throw error
      const mockAnalyzeMigrationFile = jest
        .fn()
        .mockRejectedValue(new Error('File not readable'));

      migrationRunner['checksumValidator'] = {
        analyzeMigrationFile: mockAnalyzeMigrationFile,
      } as any;

      // Act
      const result = await migrationRunner.validateMigrationChecksums();

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.totalChecked).toBe(1);
      expect(result.validCount).toBe(0);
      expect(result.invalidCount).toBe(1);
      expect(result.validationResults[0].error).toBe('File not readable');
    });
  });
});

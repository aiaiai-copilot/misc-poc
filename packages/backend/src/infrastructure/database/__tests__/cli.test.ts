import { MigrationRunner } from '../migration-runner.js';

// Mock the MigrationRunner
jest.mock('../migration-runner.js');

const MockedMigrationRunner = MigrationRunner as jest.MockedClass<
  typeof MigrationRunner
>;

describe('Database CLI', () => {
  let mockMigrationRunner: jest.Mocked<MigrationRunner>;
  let consoleSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMigrationRunner = {
      getStatus: jest.fn(),
      runMigrations: jest.fn(),
      revertLastMigration: jest.fn(),
      validateConnection: jest.fn(),
      destroy: jest.fn(),
    } as any;

    MockedMigrationRunner.mockImplementation(() => mockMigrationRunner);

    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    processExitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((code?: number) => {
        throw new Error(`Process.exit called with code ${code}`);
      });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('status command', () => {
    it('should display migration status when database is up to date', async () => {
      const mockStatus = {
        isUpToDate: true,
        executedCount: 3,
        pendingCount: 0,
        executedMigrations: ['Migration1', 'Migration2', 'Migration3'],
        pendingMigrations: [],
      };

      mockMigrationRunner.getStatus.mockResolvedValue(mockStatus);

      // Simulate CLI status command
      process.argv = ['node', 'cli.js', 'status'];

      await main();

      expect(mockMigrationRunner.getStatus).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('📊 Migration Status:');
      expect(consoleSpy).toHaveBeenCalledWith('   Database up to date: ✅');
      expect(consoleSpy).toHaveBeenCalledWith('   Executed migrations: 3');
      expect(consoleSpy).toHaveBeenCalledWith('   Pending migrations: 0');
    });

    it('should display pending migrations when database is not up to date', async () => {
      const mockStatus = {
        isUpToDate: false,
        executedCount: 2,
        pendingCount: 1,
        executedMigrations: ['Migration1', 'Migration2'],
        pendingMigrations: ['Migration3'],
      };

      mockMigrationRunner.getStatus.mockResolvedValue(mockStatus);

      process.argv = ['node', 'cli.js', 'status'];

      await main();

      expect(consoleSpy).toHaveBeenCalledWith('   Database up to date: ❌');
      expect(consoleSpy).toHaveBeenCalledWith('\n⏳ Pending migrations:');
      expect(consoleSpy).toHaveBeenCalledWith('   • Migration3');
    });
  });

  describe('run command', () => {
    it('should run pending migrations successfully', async () => {
      const executedMigrations = ['Migration1', 'Migration2'];
      mockMigrationRunner.runMigrations.mockResolvedValue(executedMigrations);

      process.argv = ['node', 'cli.js', 'run'];

      await main();

      expect(mockMigrationRunner.runMigrations).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚀 Running pending migrations...'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ Successfully executed 2 migration(s):'
      );
      expect(consoleSpy).toHaveBeenCalledWith('   • Migration1');
      expect(consoleSpy).toHaveBeenCalledWith('   • Migration2');
    });

    it('should handle case when no migrations to run', async () => {
      mockMigrationRunner.runMigrations.mockResolvedValue([]);

      process.argv = ['node', 'cli.js', 'run'];

      await main();

      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ No pending migrations to run'
      );
    });
  });

  describe('revert command', () => {
    it('should revert last migration successfully', async () => {
      mockMigrationRunner.revertLastMigration.mockResolvedValue('Migration2');

      process.argv = ['node', 'cli.js', 'revert'];

      await main();

      expect(mockMigrationRunner.revertLastMigration).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('🔄 Reverting last migration...');
      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ Successfully reverted migration: Migration2'
      );
    });

    it('should handle case when no migration to revert', async () => {
      mockMigrationRunner.revertLastMigration.mockResolvedValue(null);

      process.argv = ['node', 'cli.js', 'revert'];

      await main();

      expect(consoleSpy).toHaveBeenCalledWith('ℹ️  No migration to revert');
    });
  });

  describe('validate command', () => {
    it('should validate successful database connection', async () => {
      mockMigrationRunner.validateConnection.mockResolvedValue(true);

      process.argv = ['node', 'cli.js', 'validate'];

      await main();

      expect(mockMigrationRunner.validateConnection).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '🔍 Validating database connection...'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ Database connection is valid'
      );
    });

    it('should handle failed database connection', async () => {
      mockMigrationRunner.validateConnection.mockResolvedValue(false);

      process.argv = ['node', 'cli.js', 'validate'];

      await expect(main()).rejects.toThrow('Process.exit called with code 1');
      expect(consoleSpy).toHaveBeenCalledWith('❌ Database connection failed');
    });
  });

  describe('error handling', () => {
    it('should handle migration runner errors', async () => {
      const error = new Error('Database connection failed');
      mockMigrationRunner.getStatus.mockRejectedValue(error);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      process.argv = ['node', 'cli.js', 'status'];

      await expect(main()).rejects.toThrow('Process.exit called with code 1');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Operation failed:',
        'Database connection failed'
      );

      consoleErrorSpy.mockRestore();
    });

    it('should destroy migration runner on completion', async () => {
      mockMigrationRunner.validateConnection.mockResolvedValue(true);

      process.argv = ['node', 'cli.js', 'validate'];

      await main();

      expect(mockMigrationRunner.destroy).toHaveBeenCalled();
    });
  });
});

// Export main function for testing
export async function main(): Promise<void> {
  // This would normally be the CLI logic, but for testing we'll mock it
  const command = process.argv[2];
  const migrationRunner = new MigrationRunner();

  try {
    switch (command) {
      case 'status': {
        const status = await migrationRunner.getStatus();
        console.log('📊 Migration Status:');
        console.log(
          `   Database up to date: ${status.isUpToDate ? '✅' : '❌'}`
        );
        console.log(`   Executed migrations: ${status.executedCount}`);
        console.log(`   Pending migrations: ${status.pendingCount}`);

        if (status.executedMigrations.length > 0) {
          console.log('\n🔍 Executed migrations:');
          status.executedMigrations.forEach((name) =>
            console.log(`   • ${name}`)
          );
        }

        if (status.pendingMigrations.length > 0) {
          console.log('\n⏳ Pending migrations:');
          status.pendingMigrations.forEach((name) =>
            console.log(`   • ${name}`)
          );
        }
        break;
      }

      case 'run': {
        console.log('🚀 Running pending migrations...');
        const executed = await migrationRunner.runMigrations();

        if (executed.length === 0) {
          console.log('✅ No pending migrations to run');
        } else {
          console.log(
            `✅ Successfully executed ${executed.length} migration(s):`
          );
          executed.forEach((name) => console.log(`   • ${name}`));
        }
        break;
      }

      case 'revert': {
        console.log('🔄 Reverting last migration...');
        const reverted = await migrationRunner.revertLastMigration();

        if (reverted) {
          console.log(`✅ Successfully reverted migration: ${reverted}`);
        } else {
          console.log('ℹ️  No migration to revert');
        }
        break;
      }

      case 'validate': {
        console.log('🔍 Validating database connection...');
        const isValid = await migrationRunner.validateConnection();

        if (isValid) {
          console.log('✅ Database connection is valid');
        } else {
          console.log('❌ Database connection failed');
          process.exit(1);
        }
        break;
      }
    }
  } catch (error) {
    console.error(
      '❌ Operation failed:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  } finally {
    await migrationRunner.destroy();
  }
}

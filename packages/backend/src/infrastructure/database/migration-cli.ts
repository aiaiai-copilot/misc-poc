import {
  EnhancedMigrationRunner,
  RollbackOptions,
} from './enhanced-migration-runner.js';
import { writeFileSync } from 'fs';

/**
 * CLI interface for migration operations
 * Following PRD section 4.2.2 - CLI commands for migration operations
 *
 * Provides command-line interface for:
 * - Running migrations (migrate:up)
 * - Rolling back migrations (migrate:down, migrate:rollback)
 * - Checking status (migrate:status)
 * - Viewing history (migrate:history)
 * - Validating database (migrate:validate)
 */

export interface CLIResult {
  success: boolean;
  output: string;
  exitCode: number;
}

export class MigrationCLI {
  private migrationRunner: EnhancedMigrationRunner;

  constructor(migrationRunner: EnhancedMigrationRunner) {
    this.migrationRunner = migrationRunner;
  }

  /**
   * Execute a migration command
   */
  async executeCommand(
    command: string,
    args: string[] = []
  ): Promise<CLIResult> {
    try {
      switch (command) {
        case 'migrate:up':
          return await this.executeMigrateUp(args);
        case 'migrate:down':
          return await this.executeMigrateDown(args);
        case 'migrate:rollback':
          return await this.executeMigrateRollback(args);
        case 'migrate:status':
          return await this.executeMigrateStatus(args);
        case 'migrate:history':
          return await this.executeMigrateHistory(args);
        case 'migrate:validate':
          return await this.executeMigrateValidate(args);
        case 'migrate:help':
          return this.executeHelp();
        case 'migrate:interactive':
          return await this.executeInteractive();
        default:
          return {
            success: false,
            output: `Unknown command: ${command}\n\nRun "migrate:help" for available commands.`,
            exitCode: 1,
          };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: `Command execution failed: ${errorMessage}`,
        exitCode: 1,
      };
    }
  }

  /**
   * Execute migrate:up command
   */
  private async executeMigrateUp(args: string[]): Promise<CLIResult> {
    // Check database connection first
    const connectionValidation =
      await this.migrationRunner.validateDatabaseConnection();
    if (!connectionValidation.isValid) {
      return {
        success: false,
        output: `Database connection failed: ${connectionValidation.error}`,
        exitCode: 2,
      };
    }

    const isDryRun = args.includes('--dry-run');
    const isVerbose = args.includes('--verbose');
    const showProgress = args.includes('--progress');

    let output = '';
    const progressCallback = showProgress
      ? (progress: { phase: string; message: string }): void => {
          output += `${progress.message}\n`;
        }
      : undefined;

    const result = await this.migrationRunner.runMigrationsWithTransaction({
      dryRun: isDryRun,
      outputFormat: 'cli',
      progressCallback,
    });

    if (result.success) {
      if (result.dryRun) {
        output += '--- DRY RUN MODE ---\n';
        output += `Would execute ${result.plannedMigrations?.length || 0} migrations:\n`;
        result.plannedMigrations?.forEach((name) => {
          output += `  - ${name}\n`;
        });
      } else {
        output += `${result.executedMigrations.length} migration${
          result.executedMigrations.length !== 1 ? 's' : ''
        } executed successfully:\n`;
        result.executedMigrations.forEach((name) => {
          output += `  ✓ ${name}\n`;
        });

        if (isVerbose && result.state) {
          output += `\nExecution Details:\n`;
          output += `  Start time: ${result.state.executionStartTime.toISOString()}\n`;
          output += `  End time: ${result.state.executionEndTime.toISOString()}\n`;
          output += `  Execution time: ${result.state.totalDuration}ms\n`;
          if (result.performance) {
            output += `  Average execution time: ${result.performance.averageExecutionTime}ms\n`;
          }
        }
      }

      return { success: true, output: output.trim(), exitCode: 0 };
    } else {
      output += 'Migration failed:\n';
      result.errors.forEach((error) => {
        output += `  ✗ ${error}\n`;
      });

      if (result.errorDetails) {
        output += `\nError Details:\n`;
        output += `  Message: ${result.errorDetails.message}\n`;
        output += `  Time: ${result.errorDetails.timestamp.toISOString()}\n`;
      }

      return { success: false, output: output.trim(), exitCode: 1 };
    }
  }

  /**
   * Execute migrate:down command (rollback one migration)
   */
  private async executeMigrateDown(_args: string[]): Promise<CLIResult> {
    // Check database connection first
    const connectionValidation =
      await this.migrationRunner.validateDatabaseConnection();
    if (!connectionValidation.isValid) {
      return {
        success: false,
        output: `Database connection failed: ${connectionValidation.error}`,
        exitCode: 2,
      };
    }

    // Get the last executed migration to rollback
    const status = await this.migrationRunner.getDetailedStatus();
    if (status.executedMigrations.length === 0) {
      return {
        success: false,
        output: 'No migrations to rollback.',
        exitCode: 1,
      };
    }

    const targetMigration = status.executedMigrations[1] || null;

    const result = await this.migrationRunner.rollbackToMigration(
      targetMigration ?? '',
      { createBackup: true }
    );

    let output = '';
    if (result.success) {
      output += `Rolled back ${result.rolledBackMigrations.length} migration${
        result.rolledBackMigrations.length !== 1 ? 's' : ''
      }:\n`;
      result.rolledBackMigrations.forEach((name) => {
        output += `  ✓ ${name}\n`;
      });

      if (result.currentMigration) {
        output += `\nCurrent migration: ${result.currentMigration}`;
      } else {
        output += `\nNo migrations remaining.`;
      }

      if (result.backupCreated) {
        output += `\nBackup created successfully.`;
      }

      return { success: true, output: output.trim(), exitCode: 0 };
    } else {
      output += 'Rollback failed:\n';
      result.errors.forEach((error) => {
        output += `  ✗ ${error}\n`;
      });
      return { success: false, output: output.trim(), exitCode: 1 };
    }
  }

  /**
   * Execute migrate:rollback command (rollback to specific migration)
   */
  private async executeMigrateRollback(args: string[]): Promise<CLIResult> {
    if (args.length === 0 || (args[0] && args[0].startsWith('--'))) {
      return {
        success: false,
        output: 'Target migration name is required for rollback command.',
        exitCode: 1,
      };
    }

    // Check database connection first
    const connectionValidation =
      await this.migrationRunner.validateDatabaseConnection();
    if (!connectionValidation.isValid) {
      return {
        success: false,
        output: `Database connection failed: ${connectionValidation.error}`,
        exitCode: 2,
      };
    }

    const targetMigration = args[0];
    if (!targetMigration) {
      return {
        success: false,
        output: 'Target migration name is required for rollback command.',
        exitCode: 1,
      };
    }

    const force = args.includes('--force');

    const rollbackOptions: RollbackOptions = {
      createBackup: true,
    };

    if (force) {
      rollbackOptions.force = true;
    } else {
      rollbackOptions.force = false;
    }

    const result = await this.migrationRunner.rollbackToMigration(
      targetMigration,
      rollbackOptions
    );

    let output = '';
    if (result.success) {
      output += `Rolled back to ${targetMigration}\n`;
      output += `${result.rolledBackMigrations.length} migrations rolled back:\n`;
      result.rolledBackMigrations.forEach((name) => {
        output += `  ✓ ${name}\n`;
      });

      if (result.backupCreated) {
        output += `\nBackup created successfully.`;
      }

      return { success: true, output: output.trim(), exitCode: 0 };
    } else {
      output += 'Rollback failed:\n';
      result.errors.forEach((error) => {
        output += `  ✗ ${error}\n`;
      });
      return { success: false, output: output.trim(), exitCode: 1 };
    }
  }

  /**
   * Execute migrate:status command
   */
  private async executeMigrateStatus(_args: string[]): Promise<CLIResult> {
    // Check database connection first
    const connectionValidation =
      await this.migrationRunner.validateDatabaseConnection();
    if (!connectionValidation.isValid) {
      return {
        success: false,
        output: `Database connection failed: ${connectionValidation.error}`,
        exitCode: 2,
      };
    }

    const status = await this.migrationRunner.getDetailedStatus();

    let output = '';
    output += '=== Migration Status ===\n\n';

    if (status.isUpToDate) {
      output += '✓ Database is up to date\n';
      output += 'All migrations have been executed.\n\n';
    } else {
      output += '⚠ Database is NOT up to date\n';
      output += `${status.pendingCount} migration${status.pendingCount !== 1 ? 's' : ''} pending.\n\n`;
    }

    output += `Executed migrations: ${status.executedCount}\n`;
    output += `Pending migrations: ${status.pendingCount}\n`;

    if (status.lastMigrationDate) {
      output += `Last migration: ${status.lastMigrationDate.toISOString().split('T')[0]}\n`;
    }

    if (status.executedMigrations.length > 0) {
      output += '\nExecuted Migrations:\n';
      status.executedMigrations.forEach((name) => {
        output += `  ✓ ${name}\n`;
      });
    }

    if (status.pendingMigrations.length > 0) {
      output += '\nPending Migrations:\n';
      status.pendingMigrations.forEach((name) => {
        output += `  ○ ${name}\n`;
      });
    }

    return { success: true, output: output.trim(), exitCode: 0 };
  }

  /**
   * Execute migrate:history command
   */
  private async executeMigrateHistory(args: string[]): Promise<CLIResult> {
    // Check database connection first
    const connectionValidation =
      await this.migrationRunner.validateDatabaseConnection();
    if (!connectionValidation.isValid) {
      return {
        success: false,
        output: `Database connection failed: ${connectionValidation.error}`,
        exitCode: 2,
      };
    }

    const history = await this.migrationRunner.exportMigrationHistory();
    const exportFile = args.find(
      (_arg, index) => args[index - 1] === '--export'
    );

    let output = '';
    output += '=== Migration History ===\n\n';

    if (history.migrations.length === 0) {
      output += 'No migrations have been executed yet.\n';
    } else {
      output += `Total migrations executed: ${history.migrations.length}\n`;
      output += `Export date: ${history.exportDate.toISOString()}\n`;
      output += `Format version: ${history.version}\n\n`;

      history.migrations.forEach((migration) => {
        const isoString = migration.executedAt.toISOString();
        const parts = isoString.split('T');
        const date = parts[0];
        const time = parts[1]?.split('.')[0] || '00:00:00';
        output += `  ${migration.id}. ${migration.name}\n`;
        output += `     Executed: ${date} ${time}\n\n`;
      });
    }

    // Export to file if requested
    if (exportFile && typeof exportFile === 'string') {
      try {
        writeFileSync(exportFile, JSON.stringify(history, null, 2));
        output += `\nMigration history exported to ${exportFile}`;
      } catch (error) {
        return {
          success: false,
          output: `Failed to export history: ${error instanceof Error ? error.message : String(error)}`,
          exitCode: 1,
        };
      }
    }

    return { success: true, output: output.trim(), exitCode: 0 };
  }

  /**
   * Execute migrate:validate command
   */
  private async executeMigrateValidate(_args: string[]): Promise<CLIResult> {
    let output = '';
    output += '=== Migration Validation ===\n\n';

    // Check database connection
    const connectionValidation =
      await this.migrationRunner.validateDatabaseConnection();
    if (connectionValidation.isValid) {
      output += '✓ Database connection: OK\n';
    } else {
      output += `✗ Database connection: Failed (${connectionValidation.error})\n`;
      return { success: false, output: output.trim(), exitCode: 2 };
    }

    // Validate migration history
    const historyValidation =
      await this.migrationRunner.validateMigrationHistory();
    if (historyValidation.isValid) {
      output += '✓ Migration history: Valid\n';
      output += '✓ No issues found\n';
      return { success: true, output: output.trim(), exitCode: 0 };
    } else {
      output += '✗ Migration history: Invalid\n';
      output += '\nIssues found:\n';
      historyValidation.issues.forEach((issue) => {
        output += `  ✗ ${issue}\n`;
      });
      return { success: false, output: output.trim(), exitCode: 1 };
    }
  }

  /**
   * Execute migrate:help command
   */
  private executeHelp(): CLIResult {
    const output = `
=== Migration Commands ===

Available commands:

  migrate:up [--dry-run] [--verbose] [--progress]
    Run all pending migrations
    --dry-run    Show what would be executed without running
    --verbose    Show detailed execution information
    --progress   Show progress indicators

  migrate:down
    Rollback the last migration

  migrate:rollback <migration-name> [--force]
    Rollback to a specific migration
    --force      Skip confirmation prompts

  migrate:status
    Show current migration status

  migrate:history [--export <file>]
    Show migration execution history
    --export     Export history to JSON file

  migrate:validate
    Validate database connection and migration integrity

  migrate:help
    Show this help message

  migrate:interactive
    Interactive migration manager

Examples:
  migrate:up --dry-run
  migrate:rollback CreateUsersTable --force
  migrate:history --export migration-backup.json
    `.trim();

    return { success: true, output, exitCode: 0 };
  }

  /**
   * Execute migrate:interactive command
   */
  private async executeInteractive(): Promise<CLIResult> {
    // This would implement an interactive menu in a real CLI
    // For now, just show the concept
    const output = `
=== Interactive Migration Manager ===

This feature would provide an interactive menu for:
- Selecting migrations to run
- Choosing rollback targets
- Viewing detailed status
- Managing migration history

[Feature placeholder - interactive mode would be implemented here]
    `.trim();

    return { success: true, output, exitCode: 0 };
  }
}

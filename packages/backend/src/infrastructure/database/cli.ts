#!/usr/bin/env node
import 'reflect-metadata';
import { MigrationRunner } from './migration-runner.js';
import { EnhancedMigrationRunner } from './enhanced-migration-runner.js';

/**
 * CLI utility for database migration management
 * Following PRD section 4.2.2 - Enhanced migration capabilities with checksum validation
 *
 * Usage:
 *   node cli.js status              - Show migration status
 *   node cli.js run                 - Run pending migrations with checksum validation
 *   node cli.js revert              - Revert last migration
 *   node cli.js validate            - Validate database connection
 *   node cli.js validate-checksums  - Validate migration file integrity
 *   node cli.js export-history      - Export migration history for backup
 *   node cli.js validate-history    - Validate migration history integrity
 */

async function main(): Promise<void> {
  const command = process.argv[2];
  const migrationRunner = new MigrationRunner();
  const enhancedRunner = new EnhancedMigrationRunner();

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
        console.log(
          '🚀 Running pending migrations with enhanced validation...'
        );

        const progressCallback = (progress: {
          phase: string;
          message: string;
        }): void => {
          console.log(`   📋 ${progress.phase}: ${progress.message}`);
        };

        const result = await enhancedRunner.runMigrationsWithTransaction({
          outputFormat: 'cli',
          progressCallback,
        });

        if (result.success) {
          if (result.executedMigrations.length === 0) {
            console.log('✅ No pending migrations to run');
          } else {
            console.log(
              result.cliOutput?.summary ||
                `✅ Successfully executed ${result.executedMigrations.length} migration(s)`
            );
            result.executedMigrations.forEach((name) =>
              console.log(`   • ${name}`)
            );
          }
        } else {
          console.log('❌ Migration execution failed:');
          result.errors.forEach((error) => console.log(`   • ${error}`));
          process.exit(1);
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

      case 'create-db': {
        console.log('🏗️  Creating database...');

        try {
          await enhancedRunner.initialize();

          // Try to create the database if it doesn't exist
          const queryRunner = enhancedRunner['dataSource'].createQueryRunner();
          await queryRunner.connect();

          try {
            await queryRunner.createDatabase(
              process.env.POSTGRES_DB || 'misc_poc_dev',
              true
            );
            console.log('✅ Database created successfully');
          } catch (error: unknown) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            if (errorMessage?.includes('already exists')) {
              console.log('ℹ️  Database already exists');
            } else {
              throw error;
            }
          } finally {
            await queryRunner.release();
          }
        } catch {
          console.log(
            '❌ Failed to create database. Trying alternative approach...'
          );

          // Alternative: Connect to default database and create our database
          const { DataSource } = await import('typeorm');
          const tempDataSource = new DataSource({
            type: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            username: process.env.POSTGRES_USER || 'postgres',
            password: process.env.POSTGRES_PASSWORD || 'postgres',
            database: 'postgres', // Connect to default postgres database
          });

          try {
            await tempDataSource.initialize();
            await tempDataSource.query(
              `CREATE DATABASE "${process.env.POSTGRES_DB || 'misc_poc_dev'}"`
            );
            console.log('✅ Database created successfully');
            await tempDataSource.destroy();
          } catch (dbError: unknown) {
            const errorMessage =
              dbError instanceof Error ? dbError.message : String(dbError);
            if (errorMessage?.includes('already exists')) {
              console.log('ℹ️  Database already exists');
            } else {
              console.log('❌ Failed to create database:', errorMessage);
              process.exit(1);
            }
            await tempDataSource.destroy();
          }
        }
        break;
      }

      case 'validate-checksums': {
        console.log('🔍 Validating migration file checksums...');
        const validation = await enhancedRunner.validateMigrationChecksums();

        console.log(`📊 Checksum Validation Results:`);
        console.log(`   Total files checked: ${validation.totalChecked}`);
        console.log(`   Valid checksums: ${validation.validCount}`);
        console.log(`   Invalid checksums: ${validation.invalidCount}`);

        if (validation.isValid) {
          console.log('✅ All migration checksums are valid');
        } else {
          console.log('❌ Migration integrity issues detected:');
          validation.validationResults
            .filter((r) => !r.isValid)
            .forEach((r) => {
              console.log(
                `   • ${r.migrationName}: ${r.error || 'checksum mismatch'}`
              );
              if (r.expectedChecksum && r.actualChecksum) {
                console.log(`     Expected: ${r.expectedChecksum}`);
                console.log(`     Actual:   ${r.actualChecksum}`);
              }
            });
          process.exit(1);
        }
        break;
      }

      case 'export-history': {
        console.log('📦 Exporting migration history...');
        const history = await enhancedRunner.exportMigrationHistory();

        console.log(`📊 Migration History Export:`);
        console.log(`   Export date: ${history.exportDate.toISOString()}`);
        console.log(`   Version: ${history.version}`);
        console.log(`   Total migrations: ${history.migrations.length}`);

        if (history.migrations.length > 0) {
          console.log('\n📝 Migration History:');
          history.migrations.forEach((migration) => {
            console.log(
              `   • ${migration.name} (executed: ${migration.executedAt.toISOString()})`
            );
          });
        }

        // Export to file for backup purposes
        const fs = await import('fs/promises');
        const exportPath = `migration-history-${Date.now()}.json`;
        await fs.writeFile(exportPath, JSON.stringify(history, null, 2));
        console.log(`\n💾 History exported to: ${exportPath}`);
        break;
      }

      case 'validate-history': {
        console.log('🔍 Validating migration history integrity...');
        const validation = await enhancedRunner.validateMigrationHistory();

        if (validation.isValid) {
          console.log('✅ Migration history is valid');
        } else {
          console.log('❌ Migration history issues detected:');
          validation.issues.forEach((issue) => {
            console.log(`   • ${issue}`);
          });
          process.exit(1);
        }
        break;
      }

      default:
        console.log(`
📚 Database Migration CLI

Usage:
  npm run db:create-db          - Create database if it doesn't exist
  npm run db:status             - Show migration status
  npm run db:run                - Run pending migrations with checksum validation
  npm run db:revert             - Revert last migration
  npm run db:validate           - Validate database connection

Checksum & Integrity Commands:
  npm run db:validate-checksums - Validate migration file integrity
  npm run db:export-history     - Export migration history for backup
  npm run db:validate-history   - Validate migration history integrity

Examples:
  yarn workspace @misc-poc/backend db:status
  yarn workspace @misc-poc/backend db:run
  yarn workspace @misc-poc/backend db:validate-checksums
  yarn workspace @misc-poc/backend db:export-history
        `);
        break;
    }
  } catch (error) {
    console.error(
      '❌ Operation failed:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  } finally {
    await migrationRunner.destroy();
    await enhancedRunner.destroy();
  }
}

// Run CLI if this file is executed directly
if (
  process.argv[1]?.endsWith('cli.ts') ||
  process.argv[1]?.endsWith('cli.js')
) {
  main().catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

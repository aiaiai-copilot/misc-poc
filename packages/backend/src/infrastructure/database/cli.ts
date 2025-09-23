#!/usr/bin/env node
import 'reflect-metadata';
import { MigrationRunner } from './migration-runner.js';

/**
 * CLI utility for database migration management
 *
 * Usage:
 *   node cli.js status    - Show migration status
 *   node cli.js run       - Run pending migrations
 *   node cli.js revert    - Revert last migration
 *   node cli.js validate  - Validate database connection
 */

async function main(): Promise<void> {
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

      default:
        console.log(`
📚 Database Migration CLI

Usage:
  npm run db:status    - Show migration status
  npm run db:run       - Run pending migrations
  npm run db:revert    - Revert last migration
  npm run db:validate  - Validate database connection

Examples:
  yarn workspace @misc-poc/backend db:status
  yarn workspace @misc-poc/backend db:run
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

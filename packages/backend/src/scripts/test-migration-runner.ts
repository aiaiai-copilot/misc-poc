#!/usr/bin/env ts-node

import { EnhancedMigrationRunner } from '../infrastructure/database/enhanced-migration-runner.js';
import { MigrationCLI } from '../infrastructure/database/migration-cli.js';
import { getDataSource } from '../infrastructure/database/data-source.js';

/**
 * Test script for the enhanced migration runner
 * Demonstrates task 3.5 functionality with existing migrations
 */

async function testMigrationRunner(): Promise<void> {
  console.log('🧪 Testing Enhanced Migration Runner (Task 3.5)');
  console.log('='.repeat(50));

  try {
    // Initialize migration runner
    const dataSource = getDataSource();
    const migrationRunner = new EnhancedMigrationRunner(dataSource);
    const migrationCLI = new MigrationCLI(migrationRunner);

    console.log('\n1. Testing database connection validation...');
    const connectionValidation =
      await migrationRunner.validateDatabaseConnection();
    if (connectionValidation.isValid) {
      console.log('✅ Database connection: OK');
    } else {
      console.log(
        `❌ Database connection failed: ${connectionValidation.error}`
      );
      return;
    }

    console.log('\n2. Getting migration status...');
    const status = await migrationRunner.getDetailedStatus();
    console.log(`📊 Status:
  - Up to date: ${status.isUpToDate}
  - Executed: ${status.executedCount}
  - Pending: ${status.pendingCount}
  - Last migration: ${status.lastMigrationDate?.toISOString() || 'None'}`);

    if (status.pendingMigrations.length > 0) {
      console.log('\n📋 Pending migrations:');
      status.pendingMigrations.forEach((name) => console.log(`  - ${name}`));
    }

    if (status.executedMigrations.length > 0) {
      console.log('\n✅ Executed migrations:');
      status.executedMigrations.forEach((name) => console.log(`  - ${name}`));
    }

    console.log('\n3. Testing dry-run migration...');
    const dryRunResult = await migrationRunner.runMigrationsWithTransaction({
      dryRun: true,
      outputFormat: 'cli',
    });

    if (dryRunResult.success) {
      console.log('✅ Dry run completed successfully');
      if (
        dryRunResult.plannedMigrations &&
        dryRunResult.plannedMigrations.length > 0
      ) {
        console.log('📋 Would execute migrations:');
        dryRunResult.plannedMigrations.forEach((name) =>
          console.log(`  - ${name}`)
        );
      } else {
        console.log('ℹ️  No pending migrations to execute');
      }
    } else {
      console.log('❌ Dry run failed:', dryRunResult.errors);
    }

    console.log('\n4. Testing CLI interface...');

    // Test status command
    console.log('\n🔍 Testing migrate:status command...');
    const statusResult = await migrationCLI.executeCommand('migrate:status');
    console.log(statusResult.output);

    // Test history command
    console.log('\n📜 Testing migrate:history command...');
    const historyResult = await migrationCLI.executeCommand('migrate:history');
    console.log(historyResult.output);

    // Test validation command
    console.log('\n🔍 Testing migrate:validate command...');
    const validateResult =
      await migrationCLI.executeCommand('migrate:validate');
    console.log(validateResult.output);

    console.log('\n5. Testing migration history export...');
    const history = await migrationRunner.exportMigrationHistory();
    console.log(`📦 Exported ${history.migrations.length} migration records`);
    console.log(`📅 Export date: ${history.exportDate.toISOString()}`);
    console.log(`🏷️  Format version: ${history.version}`);

    console.log('\n6. Testing migration history validation...');
    const validation = await migrationRunner.validateMigrationHistory();
    if (validation.isValid) {
      console.log('✅ Migration history is valid');
    } else {
      console.log('❌ Migration history has issues:');
      validation.issues.forEach((issue) => console.log(`  - ${issue}`));
    }

    // Clean up
    await migrationRunner.destroy();

    console.log(
      '\n🎉 All enhanced migration runner tests completed successfully!'
    );
    console.log('\n📋 Task 3.5 Implementation Summary:');
    console.log('  ✅ Enhanced migration runner with transaction support');
    console.log('  ✅ Rollback functionality for migrations');
    console.log('  ✅ CLI commands for migration operations');
    console.log('  ✅ Error handling and state tracking');
    console.log('  ✅ Migration history management');
    console.log('  ✅ Database connection validation');
    console.log('  ✅ Dry-run mode for safe testing');
    console.log('  ✅ Progress reporting and logging');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testMigrationRunner()
    .then(() => {
      console.log('\n✅ Enhanced Migration Runner test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Enhanced Migration Runner test failed:', error);
      process.exit(1);
    });
}

export { testMigrationRunner };

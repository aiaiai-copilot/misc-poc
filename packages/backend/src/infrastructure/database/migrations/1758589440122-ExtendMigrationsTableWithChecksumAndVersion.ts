import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

/**
 * Extend Migrations Table with Checksum and Version Control
 * Following PRD section 4.2.2 - Migration integrity checking and version tracking
 *
 * Adds to TypeORM migrations table:
 * - checksum field for file integrity validation
 * - version field for migration version tracking
 * - executed_at timestamp for better audit trail
 * - file_path for tracking source file location
 */

export class ExtendMigrationsTableWithChecksumAndVersion1758589440122
  implements MigrationInterface
{
  name = 'ExtendMigrationsTableWithChecksumAndVersion1758589440122';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if migration_history table exists (configured as migrationsTableName)
    const migrationsTableExists =
      await queryRunner.hasTable('migration_history');

    if (!migrationsTableExists) {
      // If migration_history table doesn't exist, TypeORM will create it automatically
      // when the first migration runs. We'll run this after that happens.
      console.log(
        'Migration history table does not exist yet, will be created by TypeORM'
      );
      return;
    }

    // Add checksum column for file integrity validation
    await queryRunner.addColumn(
      'migration_history',
      new TableColumn({
        name: 'checksum',
        type: 'varchar',
        length: '64', // SHA-256 produces 64-character hex string
        isNullable: true, // Allow null for existing migrations
        comment:
          'SHA-256 checksum of migration file content for integrity validation',
      })
    );

    // Add version column for migration version tracking
    await queryRunner.addColumn(
      'migration_history',
      new TableColumn({
        name: 'version',
        type: 'varchar',
        length: '20',
        isNullable: true, // Allow null for existing migrations
        default: "'1.0.0'",
        comment: 'Migration version for tracking migration file versions',
      })
    );

    // Add executed_at timestamp for better audit trail
    await queryRunner.addColumn(
      'migration_history',
      new TableColumn({
        name: 'executed_at',
        type: 'timestamp',
        default: 'CURRENT_TIMESTAMP',
        isNullable: false,
        comment: 'Timestamp when migration was executed',
      })
    );

    // Add file_path for tracking source file location
    await queryRunner.addColumn(
      'migration_history',
      new TableColumn({
        name: 'file_path',
        type: 'varchar',
        length: '500',
        isNullable: true, // Allow null for existing migrations
        comment: 'Path to migration source file for integrity checking',
      })
    );

    // Create index on checksum for fast integrity validation
    await queryRunner.createIndex(
      'migration_history',
      new TableIndex({
        name: 'IDX_migrations_checksum',
        columnNames: ['checksum'],
      })
    );

    // Create index on executed_at for audit queries
    await queryRunner.createIndex(
      'migration_history',
      new TableIndex({
        name: 'IDX_migrations_executed_at',
        columnNames: ['executed_at'],
      })
    );

    // Create composite index for version tracking
    await queryRunner.createIndex(
      'migration_history',
      new TableIndex({
        name: 'IDX_migrations_name_version',
        columnNames: ['name', 'version'],
      })
    );

    // Update existing migration records with default values
    await queryRunner.query(`
      UPDATE migration_history
      SET
        version = '1.0.0',
        executed_at = COALESCE(TO_TIMESTAMP(timestamp / 1000), CURRENT_TIMESTAMP)
      WHERE version IS NULL
    `);

    console.log(
      '✅ Extended migrations table with checksum and version control fields'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.dropIndex('migration_history', 'IDX_migrations_checksum');
    await queryRunner.dropIndex(
      'migration_history',
      'IDX_migrations_executed_at'
    );
    await queryRunner.dropIndex(
      'migration_history',
      'IDX_migrations_name_version'
    );

    // Drop added columns
    await queryRunner.dropColumn('migration_history', 'checksum');
    await queryRunner.dropColumn('migration_history', 'version');
    await queryRunner.dropColumn('migration_history', 'executed_at');
    await queryRunner.dropColumn('migration_history', 'file_path');

    console.log('✅ Reverted migrations table to original TypeORM structure');
  }
}

import { MigrationInterface, QueryRunner, TableColumn, Index } from 'typeorm';

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
    // Check if migrations table exists (TypeORM creates it automatically)
    const migrationsTableExists = await queryRunner.hasTable('migrations');

    if (!migrationsTableExists) {
      // If migrations table doesn't exist, TypeORM will create it automatically
      // when the first migration runs. We'll run this after that happens.
      console.log(
        'Migrations table does not exist yet, will be created by TypeORM'
      );
      return;
    }

    // Add checksum column for file integrity validation
    await queryRunner.addColumn(
      'migrations',
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
      'migrations',
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
      'migrations',
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
      'migrations',
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
      'migrations',
      new Index({
        name: 'IDX_migrations_checksum',
        columnNames: ['checksum'],
      })
    );

    // Create index on executed_at for audit queries
    await queryRunner.createIndex(
      'migrations',
      new Index({
        name: 'IDX_migrations_executed_at',
        columnNames: ['executed_at'],
      })
    );

    // Create composite index for version tracking
    await queryRunner.createIndex(
      'migrations',
      new Index({
        name: 'IDX_migrations_name_version',
        columnNames: ['name', 'version'],
      })
    );

    // Update existing migration records with default values
    await queryRunner.query(`
      UPDATE migrations
      SET
        version = '1.0.0',
        executed_at = COALESCE(timestamp::timestamp, CURRENT_TIMESTAMP)
      WHERE version IS NULL
    `);

    console.log(
      '✅ Extended migrations table with checksum and version control fields'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.dropIndex('migrations', 'IDX_migrations_checksum');
    await queryRunner.dropIndex('migrations', 'IDX_migrations_executed_at');
    await queryRunner.dropIndex('migrations', 'IDX_migrations_name_version');

    // Drop added columns
    await queryRunner.dropColumn('migrations', 'checksum');
    await queryRunner.dropColumn('migrations', 'version');
    await queryRunner.dropColumn('migrations', 'executed_at');
    await queryRunner.dropColumn('migrations', 'file_path');

    console.log('✅ Reverted migrations table to original TypeORM structure');
  }
}

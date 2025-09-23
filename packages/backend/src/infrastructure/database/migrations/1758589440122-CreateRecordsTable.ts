import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
  TableUnique,
} from 'typeorm';

export class CreateRecordsTable1758589440122 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create records table with fields as specified in PRD
    await queryRunner.createTable(
      new Table({
        name: 'records',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
            comment: 'Unique identifier for the record',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
            comment: 'Foreign key reference to users table',
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
            comment: 'Content as entered by user',
          },
          {
            name: 'tags',
            type: 'text',
            isArray: true,
            isNullable: false,
            comment: 'Array of tags extracted from content',
          },
          {
            name: 'normalized_tags',
            type: 'text',
            isArray: true,
            isNullable: false,
            comment: 'Normalized tags array for searching',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
            comment: 'Record creation timestamp',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
            comment: 'Record last update timestamp',
          },
        ],
        uniques: [
          new TableUnique({
            name: 'UQ_records_user_normalized_tags',
            columnNames: ['user_id', 'normalized_tags'],
          }),
        ],
      }),
      true
    );

    // Create foreign key constraint to users table
    await queryRunner.createForeignKey(
      'records',
      new TableForeignKey({
        name: 'FK_records_user_id',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      })
    );

    // Create indexes for optimized query patterns as specified in PRD

    // Index on user_id for data isolation and user-specific queries
    await queryRunner.createIndex(
      'records',
      new TableIndex({
        name: 'IDX_records_user_id',
        columnNames: ['user_id'],
      })
    );

    // GIN index on normalized_tags array for PostgreSQL full-text search capabilities
    await queryRunner.createIndex(
      'records',
      new TableIndex({
        name: 'IDX_records_normalized_tags_gin',
        columnNames: ['normalized_tags'],
        // Note: TypeORM doesn't directly support GIN specification in TableIndex
        // This would need to be handled differently for PostgreSQL-specific features
      })
    );

    // Index on created_at for chronological ordering
    await queryRunner.createIndex(
      'records',
      new TableIndex({
        name: 'IDX_records_created_at',
        columnNames: ['created_at'],
      })
    );

    // Composite index for common query patterns (user + chronological)
    await queryRunner.createIndex(
      'records',
      new TableIndex({
        name: 'IDX_records_user_id_created_at',
        columnNames: ['user_id', 'created_at'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first (in reverse order)
    await queryRunner.dropIndex('records', 'IDX_records_user_id_created_at');
    await queryRunner.dropIndex('records', 'IDX_records_created_at');
    await queryRunner.dropIndex('records', 'IDX_records_normalized_tags_gin');
    await queryRunner.dropIndex('records', 'IDX_records_user_id');

    // Drop foreign key constraint
    await queryRunner.dropForeignKey('records', 'FK_records_user_id');

    // Drop the table
    await queryRunner.dropTable('records');
  }
}

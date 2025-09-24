import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateMiscSchema1704067200000 implements MigrationInterface {
  name = 'CreateMiscSchema1704067200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'google_id',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'display_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'avatar_url',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'NOW()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'NOW()',
            isNullable: false,
          },
          {
            name: 'last_login_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Create records table
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
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'tags',
            type: 'text',
            isArray: true,
            isNullable: false,
          },
          {
            name: 'normalized_tags',
            type: 'text',
            isArray: true,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'NOW()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'NOW()',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        uniques: [
          {
            name: 'UQ_records_user_normalized_tags',
            columnNames: ['user_id', 'normalized_tags'],
          },
        ],
      }),
      true
    );

    // Create user_settings table
    await queryRunner.createTable(
      new Table({
        name: 'user_settings',
        columns: [
          {
            name: 'user_id',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'case_sensitive',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'remove_accents',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'max_tag_length',
            type: 'integer',
            default: 100,
            isNullable: false,
          },
          {
            name: 'max_tags_per_record',
            type: 'integer',
            default: 50,
            isNullable: false,
          },
          {
            name: 'ui_language',
            type: 'varchar',
            length: '10',
            default: "'en'",
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'NOW()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'NOW()',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create performance indexes for records table using raw SQL for better control
    await queryRunner.query(
      'CREATE INDEX idx_records_user_id ON records(user_id);'
    );
    await queryRunner.query(
      'CREATE INDEX idx_records_created_at ON records(created_at DESC);'
    );
    await queryRunner.query(
      'CREATE INDEX idx_records_normalized_tags_gin ON records USING GIN(normalized_tags);'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first using raw SQL
    await queryRunner.query('DROP INDEX IF EXISTS idx_records_created_at;');
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_records_normalized_tags_gin;'
    );
    await queryRunner.query('DROP INDEX IF EXISTS idx_records_user_id;');

    // Drop tables in reverse order (foreign key dependencies)
    await queryRunner.dropTable('user_settings');
    await queryRunner.dropTable('records');
    await queryRunner.dropTable('users');
  }
}

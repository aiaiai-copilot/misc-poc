import { MigrationInterface, QueryRunner, Table, Index, Check } from 'typeorm';

/**
 * Create Users Table Migration
 * Following PRD section 4.2.1 - Users table migration requirements
 *
 * Creates users table with:
 * - Primary key (UUID)
 * - Google OAuth integration fields
 * - Email and name with validation
 * - Audit timestamps
 * - Proper indexes for performance
 * - Data integrity constraints
 */

export class CreateUsersTable1758589440121 implements MigrationInterface {
  name = 'CreateUsersTable1758589440121';

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
            name: 'google_id',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'profile_picture_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true // ifNotExist
    );

    // Create indexes for performance
    await queryRunner.createIndex(
      'users',
      new Index({
        name: 'IDX_users_google_id',
        columnNames: ['google_id'],
        isUnique: true,
      })
    );

    await queryRunner.createIndex(
      'users',
      new Index({
        name: 'IDX_users_email',
        columnNames: ['email'],
      })
    );

    await queryRunner.createIndex(
      'users',
      new Index({
        name: 'IDX_users_created_at',
        columnNames: ['created_at'],
      })
    );

    // Add data integrity constraints
    await queryRunner.createCheckConstraint(
      'users',
      new Check({
        name: 'CHK_users_email_format',
        expression:
          "email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'",
      })
    );

    await queryRunner.createCheckConstraint(
      'users',
      new Check({
        name: 'CHK_users_google_id_not_empty',
        expression: "google_id != ''",
      })
    );

    await queryRunner.createCheckConstraint(
      'users',
      new Check({
        name: 'CHK_users_name_not_empty',
        expression: "name != ''",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop constraints first
    await queryRunner.dropCheckConstraint('users', 'CHK_users_email_format');
    await queryRunner.dropCheckConstraint(
      'users',
      'CHK_users_google_id_not_empty'
    );
    await queryRunner.dropCheckConstraint('users', 'CHK_users_name_not_empty');

    // Drop indexes
    await queryRunner.dropIndex('users', 'IDX_users_google_id');
    await queryRunner.dropIndex('users', 'IDX_users_email');
    await queryRunner.dropIndex('users', 'IDX_users_created_at');

    // Drop table
    await queryRunner.dropTable('users');
  }
}

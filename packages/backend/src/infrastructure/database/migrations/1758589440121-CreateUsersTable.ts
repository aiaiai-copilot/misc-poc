import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

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
    // Create users table with OAuth fields
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
            comment: 'Unique identifier for the user',
          },
          {
            name: 'google_id',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
            comment: 'Google OAuth unique identifier',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '320', // RFC 5321 compliant email length
            isNullable: false,
            comment: "User's email address from Google OAuth",
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
            comment: "User's display name from Google OAuth",
          },
          {
            name: 'profile_picture_url',
            type: 'text',
            isNullable: true,
            comment: "URL to user's profile picture from Google",
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
        checks: [
          {
            name: 'CHK_users_email_format',
            expression:
              "email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'",
          },
          {
            name: 'CHK_users_google_id_not_empty',
            expression: "google_id IS NOT NULL AND google_id != ''",
          },
          {
            name: 'CHK_users_name_not_empty',
            expression: "name IS NOT NULL AND name != ''",
          },
        ],
      }),
      true
    );

    // Create indexes for optimized queries
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_users_google_id',
        columnNames: ['google_id'],
        isUnique: true,
      })
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_users_email',
        columnNames: ['email'],
      })
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_users_created_at',
        columnNames: ['created_at'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.dropIndex('users', 'IDX_users_created_at');
    await queryRunner.dropIndex('users', 'IDX_users_email');
    await queryRunner.dropIndex('users', 'IDX_users_google_id');

    // Drop the table
    await queryRunner.dropTable('users');
  }
}

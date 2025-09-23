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
    // Check if table already exists
    const hasUsersTable = await queryRunner.hasTable('users');
    if (!hasUsersTable) {
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
    } else {
      console.log('Users table already exists, skipping table creation');
    }

    // Create indexes for optimized queries (only if columns exist)
    // Note: google_id unique constraint is auto-created by TypeORM due to isUnique: true

    // Get table to check if columns exist
    const table = await queryRunner.getTable('users');
    if (!table) {
      return; // Table doesn't exist, nothing to index
    }

    // Create email index if column exists and index doesn't exist
    const hasEmailColumn = table.columns.some((col) => col.name === 'email');
    if (hasEmailColumn) {
      try {
        await queryRunner.createIndex(
          'users',
          new TableIndex({
            name: 'IDX_users_email',
            columnNames: ['email'],
          })
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (!errorMessage?.includes('already exists')) {
          throw error;
        }
      }
    }

    // Create created_at index if column exists and index doesn't exist
    const hasCreatedAtColumn = table.columns.some(
      (col) => col.name === 'created_at'
    );
    if (hasCreatedAtColumn) {
      try {
        await queryRunner.createIndex(
          'users',
          new TableIndex({
            name: 'IDX_users_created_at',
            columnNames: ['created_at'],
          })
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (!errorMessage?.includes('already exists')) {
          throw error;
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if table exists before attempting to drop
    const hasUsersTable = await queryRunner.hasTable('users');
    if (!hasUsersTable) {
      return;
    }

    // Drop explicitly created indexes first (ignore errors if they don't exist)
    try {
      await queryRunner.dropIndex('users', 'IDX_users_created_at');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn('Could not drop IDX_users_created_at:', errorMessage);
    }

    try {
      await queryRunner.dropIndex('users', 'IDX_users_email');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn('Could not drop IDX_users_email:', errorMessage);
    }

    // Note: google_id unique constraint is auto-dropped when table is dropped

    // Drop the table (this will automatically drop all constraints and indexes)
    await queryRunner.dropTable('users');
  }
}

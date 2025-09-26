import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Create Refresh Tokens Table Migration
 *
 * Implements refresh token rotation mechanism as specified in PRD section 4.1.2
 * Session Management - Refresh token rotation for enhanced security.
 *
 * This migration creates the refresh_tokens table with:
 * - Cryptographically secure token storage
 * - User and device association
 * - Expiration and revocation tracking
 * - Security monitoring fields
 * - Proper indexes for performance and cleanup operations
 */

export class CreateRefreshTokensTable1758589440123
  implements MigrationInterface
{
  name = 'CreateRefreshTokensTable1758589440123';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'refresh_tokens',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
            comment: 'Unique identifier for the refresh token record',
          },
          {
            name: 'token',
            type: 'varchar',
            length: '128',
            isUnique: true,
            isNullable: false,
            comment:
              'Cryptographically secure random token string (at least 32 chars)',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
            comment: 'User ID this refresh token belongs to',
          },
          {
            name: 'device_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
            comment: 'Device/client identifier for this token',
          },
          {
            name: 'expires_at',
            type: 'timestamp with time zone',
            isNullable: false,
            comment:
              'When this refresh token expires (default: 30 days from creation)',
          },
          {
            name: 'is_revoked',
            type: 'boolean',
            default: false,
            isNullable: false,
            comment: 'Whether this token has been revoked (blacklisted)',
          },
          {
            name: 'revoked_at',
            type: 'timestamp with time zone',
            isNullable: true,
            comment: 'When this token was revoked (if applicable)',
          },
          {
            name: 'revocation_reason',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: 'Reason for revocation (for security auditing)',
          },
          {
            name: 'last_used_ip',
            type: 'inet',
            isNullable: true,
            comment:
              'Last IP address that used this token (for security monitoring)',
          },
          {
            name: 'user_agent',
            type: 'text',
            isNullable: true,
            comment: 'User agent of the client that last used this token',
          },
          {
            name: 'last_used_at',
            type: 'timestamp with time zone',
            isNullable: true,
            comment: 'When this token was last used (updated on each rotation)',
          },
          {
            name: 'usage_count',
            type: 'integer',
            default: 0,
            isNullable: false,
            comment: 'Number of times this token has been used for rotation',
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
            comment: 'When this record was created',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
            comment: 'When this record was last updated',
          },
        ],
        comment:
          'Stores refresh tokens for JWT token rotation mechanism with security features',
      }),
      true
    );

    // Create indexes for performance and cleanup operations

    // Index on token for fast lookups during token rotation
    await queryRunner.createIndex(
      'refresh_tokens',
      new TableIndex({
        name: 'IDX_refresh_tokens_token',
        columnNames: ['token'],
        isUnique: true,
      })
    );

    // Composite index on user_id and device_id for device-specific queries
    await queryRunner.createIndex(
      'refresh_tokens',
      new TableIndex({
        name: 'IDX_refresh_tokens_user_device',
        columnNames: ['user_id', 'device_id'],
      })
    );

    // Index on expires_at for cleanup operations
    await queryRunner.createIndex(
      'refresh_tokens',
      new TableIndex({
        name: 'IDX_refresh_tokens_expires_at',
        columnNames: ['expires_at'],
      })
    );

    // Composite index on is_revoked and revoked_at for revoked token queries and cleanup
    await queryRunner.createIndex(
      'refresh_tokens',
      new TableIndex({
        name: 'IDX_refresh_tokens_revoked',
        columnNames: ['is_revoked', 'revoked_at'],
      })
    );

    // Index on user_id for user-specific operations (logout, security breach response)
    await queryRunner.createIndex(
      'refresh_tokens',
      new TableIndex({
        name: 'IDX_refresh_tokens_user_id',
        columnNames: ['user_id'],
      })
    );

    // Index on created_at for audit and analytics queries
    await queryRunner.createIndex(
      'refresh_tokens',
      new TableIndex({
        name: 'IDX_refresh_tokens_created_at',
        columnNames: ['created_at'],
      })
    );

    // Create a partial index for active (non-revoked, non-expired) tokens
    // This is PostgreSQL-specific but provides excellent performance for common queries
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IDX_refresh_tokens_active
      ON refresh_tokens (user_id, device_id, expires_at)
      WHERE is_revoked = false AND expires_at > now()
    `);

    console.log(
      '✅ Created refresh_tokens table with security features and performance indexes'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the partial index first
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_refresh_tokens_active`);

    // Drop all indexes
    await queryRunner.dropIndex('refresh_tokens', 'IDX_refresh_tokens_token');
    await queryRunner.dropIndex(
      'refresh_tokens',
      'IDX_refresh_tokens_user_device'
    );
    await queryRunner.dropIndex(
      'refresh_tokens',
      'IDX_refresh_tokens_expires_at'
    );
    await queryRunner.dropIndex('refresh_tokens', 'IDX_refresh_tokens_revoked');
    await queryRunner.dropIndex('refresh_tokens', 'IDX_refresh_tokens_user_id');
    await queryRunner.dropIndex(
      'refresh_tokens',
      'IDX_refresh_tokens_created_at'
    );

    // Drop the table
    await queryRunner.dropTable('refresh_tokens');

    console.log('✅ Reverted refresh_tokens table creation');
  }
}

import { DataSource } from 'typeorm';
import { Result, Ok, Err, RecordId } from '@misc-poc/shared';
import { User, GoogleId, UserSettings, DomainError } from '@misc-poc/domain';
import { UserRepository } from '@misc-poc/application';

/**
 * PostgreSQL implementation of User Repository
 *
 * This implementation follows the same patterns as PostgreSQLRecordRepository:
 * - Uses pg (node-postgres) via TypeORM DataSource
 * - Uses parameterized queries for SQL injection prevention
 * - Handles proper connection management with QueryRunner
 * - Returns Result types for error handling
 * - Manages both users and user_settings tables
 */
export class PostgreSQLUserRepository implements UserRepository {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Find a user by their Google OAuth ID
   * Returns null if user not found
   */
  async findByGoogleId(
    googleId: GoogleId
  ): Promise<Result<User | null, DomainError>> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      // Query user by Google ID with a join to get settings
      const result = await queryRunner.query(
        `
        SELECT
          u.id, u.email, u.google_id, u.display_name, u.avatar_url,
          u.created_at, u.updated_at, u.last_login_at,
          s.case_sensitive, s.remove_accents, s.max_tag_length,
          s.max_tags_per_record, s.ui_language
        FROM users u
        LEFT JOIN user_settings s ON u.id = s.user_id
        WHERE u.google_id = $1
        `,
        [googleId.toString()]
      );

      if (result.length === 0) {
        return Ok(null);
      }

      const row = result[0];
      const user = this.mapRowToUser(row);
      return Ok(user);
    } catch (error) {
      return Err(
        new DomainError(
          'USER_FIND_ERROR',
          `Failed to find user by Google ID: ${(error as Error).message}`
        )
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Create a new user with Google profile information
   * Also creates associated user_settings record
   */
  async create(user: User): Promise<Result<User, DomainError>> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Insert user
      const userResult = await queryRunner.query(
        `
        INSERT INTO users (
          id, email, google_id, display_name, avatar_url,
          created_at, updated_at, last_login_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, email, google_id, display_name, avatar_url,
                  created_at, updated_at, last_login_at
        `,
        [
          user.id.toString(),
          user.email,
          user.googleId.toString(),
          user.displayName,
          user.avatarUrl,
          user.createdAt,
          user.updatedAt,
          user.lastLoginAt,
        ]
      );

      // Insert user settings
      await queryRunner.query(
        `
        INSERT INTO user_settings (
          user_id, case_sensitive, remove_accents, max_tag_length,
          max_tags_per_record, ui_language, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          user.id.toString(),
          user.settings.caseSensitive,
          user.settings.removeAccents,
          user.settings.maxTagLength,
          user.settings.maxTagsPerRecord,
          user.settings.uiLanguage,
          user.createdAt,
          user.updatedAt,
        ]
      );

      await queryRunner.commitTransaction();

      // Return created user by mapping the database result
      const createdRow = userResult[0];
      const createdUser = new User(
        new RecordId(createdRow.id),
        createdRow.email,
        GoogleId.create(createdRow.google_id),
        createdRow.display_name,
        createdRow.avatar_url,
        user.settings,
        new Date(createdRow.created_at),
        new Date(createdRow.updated_at),
        createdRow.last_login_at ? new Date(createdRow.last_login_at) : null
      );

      return Ok(createdUser);
    } catch (error) {
      // Only rollback if transaction was started
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      // Handle unique constraint violations
      const errorMessage = (error as Error).message;
      if (
        errorMessage.includes('duplicate key') ||
        errorMessage.includes('unique')
      ) {
        if (errorMessage.includes('email')) {
          return Err(
            new DomainError(
              'DUPLICATE_EMAIL',
              'A user with this email already exists'
            )
          );
        }
        if (errorMessage.includes('google_id')) {
          return Err(
            new DomainError(
              'DUPLICATE_GOOGLE_ID',
              'A user with this Google ID already exists'
            )
          );
        }
      }

      return Err(
        new DomainError(
          'USER_CREATE_ERROR',
          `Failed to create user: ${errorMessage}`
        )
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Update user settings
   * Only updates the user_settings table and updated_at timestamp
   */
  async updateSettings(user: User): Promise<Result<User, DomainError>> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      // Update user_settings
      const settingsResult = await queryRunner.query(
        `
        UPDATE user_settings
        SET
          case_sensitive = $1,
          remove_accents = $2,
          max_tag_length = $3,
          max_tags_per_record = $4,
          ui_language = $5,
          updated_at = $6
        WHERE user_id = $7
        RETURNING *
        `,
        [
          user.settings.caseSensitive,
          user.settings.removeAccents,
          user.settings.maxTagLength,
          user.settings.maxTagsPerRecord,
          user.settings.uiLanguage,
          user.updatedAt,
          user.id.toString(),
        ]
      );

      if (settingsResult.length === 0) {
        return Err(new DomainError('USER_NOT_FOUND', 'User not found'));
      }

      // Update users.updated_at
      await queryRunner.query(
        `
        UPDATE users
        SET updated_at = $1
        WHERE id = $2
        `,
        [user.updatedAt, user.id.toString()]
      );

      // Fetch the complete user with updated settings
      const result = await queryRunner.query(
        `
        SELECT
          u.id, u.email, u.google_id, u.display_name, u.avatar_url,
          u.created_at, u.updated_at, u.last_login_at,
          s.case_sensitive, s.remove_accents, s.max_tag_length,
          s.max_tags_per_record, s.ui_language
        FROM users u
        LEFT JOIN user_settings s ON u.id = s.user_id
        WHERE u.id = $1
        `,
        [user.id.toString()]
      );

      if (result.length === 0) {
        return Err(new DomainError('USER_NOT_FOUND', 'User not found'));
      }

      const updatedUser = this.mapRowToUser(result[0]);
      return Ok(updatedUser);
    } catch (error) {
      return Err(
        new DomainError(
          'USER_UPDATE_ERROR',
          `Failed to update user settings: ${(error as Error).message}`
        )
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Update the last login timestamp for a user
   * Updates both last_login_at and updated_at
   */
  async updateLastLogin(user: User): Promise<Result<User, DomainError>> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      const result = await queryRunner.query(
        `
        UPDATE users
        SET
          last_login_at = $1,
          updated_at = $2
        WHERE id = $3
        RETURNING id, email, google_id, display_name, avatar_url,
                  created_at, updated_at, last_login_at
        `,
        [user.lastLoginAt, user.updatedAt, user.id.toString()]
      );

      // TypeORM/pg returns UPDATE results as [rows[], affectedCount]
      const rows = Array.isArray(result[0]) ? result[0] : result;

      if (rows.length === 0) {
        return Err(new DomainError('USER_NOT_FOUND', 'User not found'));
      }

      // Fetch settings to reconstruct complete user
      const settingsResult = await queryRunner.query(
        `
        SELECT *
        FROM user_settings
        WHERE user_id = $1
        `,
        [user.id.toString()]
      );

      if (settingsResult.length === 0) {
        return Err(
          new DomainError('USER_SETTINGS_NOT_FOUND', 'User settings not found')
        );
      }

      const userRow = rows[0];
      const settingsRow = settingsResult[0];

      const updatedUser = new User(
        new RecordId(userRow.id),
        userRow.email,
        GoogleId.create(userRow.google_id),
        userRow.display_name,
        userRow.avatar_url,
        new UserSettings(
          settingsRow.case_sensitive,
          settingsRow.remove_accents,
          settingsRow.max_tag_length,
          settingsRow.max_tags_per_record,
          settingsRow.ui_language
        ),
        new Date(userRow.created_at),
        new Date(userRow.updated_at),
        userRow.last_login_at ? new Date(userRow.last_login_at) : null
      );

      return Ok(updatedUser);
    } catch (error) {
      return Err(
        new DomainError(
          'USER_LOGIN_UPDATE_ERROR',
          `Failed to update last login: ${(error as Error).message}`
        )
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Map database row to User domain entity
   * Handles the reconstruction of User with settings
   */
  private mapRowToUser(row: {
    id: string;
    email: string;
    google_id: string;
    display_name: string | null;
    avatar_url: string | null;
    created_at: Date | string;
    updated_at: Date | string;
    last_login_at: Date | string | null;
    case_sensitive: boolean | null;
    remove_accents: boolean | null;
    max_tag_length: number | null;
    max_tags_per_record: number | null;
    ui_language: string | null;
  }): User {
    const settings = new UserSettings(
      row.case_sensitive ?? false,
      row.remove_accents ?? true,
      row.max_tag_length ?? 100,
      row.max_tags_per_record ?? 50,
      row.ui_language ?? 'en'
    );

    return new User(
      new RecordId(row.id),
      row.email,
      GoogleId.create(row.google_id),
      row.display_name ?? '',
      row.avatar_url ?? '',
      settings,
      new Date(row.created_at),
      new Date(row.updated_at),
      row.last_login_at ? new Date(row.last_login_at) : null
    );
  }
}

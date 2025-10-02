import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { PostgreSQLUserRepository } from '../postgresql-user-repository';
import { User, GoogleId, UserSettings } from '@misc-poc/domain';
import { RecordId } from '@misc-poc/shared';
import {
  classifyPostgresError,
  isTransientError,
  isConstraintViolation,
} from '../errors';
import { maskSensitiveData } from '../logger';
import { randomUUID } from 'crypto';

/**
 * Error Handling and Logging Tests (Task 6.6)
 *
 * Tests the implemented error handling, logging, and retry logic.
 */

describe('Error Handling and Logging', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let repository: PostgreSQLUserRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15')
      .withStartupTimeout(120000)
      .start();

    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      database: container.getDatabase(),
      username: container.getUsername(),
      password: container.getPassword(),
      synchronize: false,
      logging: false,
    });

    await dataSource.initialize();

    // Run migrations
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        google_id VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_login_at TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        case_sensitive BOOLEAN DEFAULT FALSE,
        remove_accents BOOLEAN DEFAULT TRUE,
        max_tag_length INTEGER DEFAULT 100,
        max_tags_per_record INTEGER DEFAULT 50,
        ui_language VARCHAR(10) DEFAULT 'en',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  }, 180000);

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users CASCADE');
    repository = new PostgreSQLUserRepository(dataSource);
  });

  describe('Error Classification', () => {
    it('should classify duplicate key errors as DUPLICATE_EMAIL', () => {
      const error = new Error(
        'duplicate key value violates unique constraint "users_email_key"'
      );
      const classified = classifyPostgresError(error);

      expect(classified.code).toBe('DUPLICATE_EMAIL');
      expect(classified.message).toContain('email');
    });

    it('should classify duplicate Google ID errors as DUPLICATE_GOOGLE_ID', () => {
      const error = new Error(
        'duplicate key value violates unique constraint "users_google_id_key"'
      );
      const classified = classifyPostgresError(error);

      expect(classified.code).toBe('DUPLICATE_GOOGLE_ID');
      expect(classified.message).toContain('Google ID');
    });

    it('should classify connection errors as DATABASE_CONNECTION_ERROR', () => {
      const error = new Error('connect ECONNREFUSED 127.0.0.1:5432');
      (error as any).code = 'ECONNREFUSED';
      const classified = classifyPostgresError(error);

      expect(classified.code).toBe('DATABASE_CONNECTION_ERROR');
      expect(classified.message).toContain('connection');
    });
  });

  describe('Transient Error Detection', () => {
    it('should identify connection errors as transient', () => {
      const error = new Error('connection failed');
      (error as any).code = 'ECONNREFUSED';
      const classified = classifyPostgresError(error);

      expect(isTransientError(classified)).toBe(true);
    });

    it('should identify constraint violations as non-transient', () => {
      const error = new Error('duplicate key');
      const classified = classifyPostgresError(error);

      expect(isConstraintViolation(classified)).toBe(true);
      expect(isTransientError(classified)).toBe(false);
    });
  });

  describe('Sensitive Data Masking', () => {
    it('should mask email addresses', () => {
      const masked = maskSensitiveData('test@example.com', 'email');
      // Format: first char + *** + last char @ domain
      expect(masked).toBe('t***t@example.com');
      expect(masked).not.toContain('test@');
    });

    it('should mask IDs', () => {
      const masked = maskSensitiveData('1234567890abcdef', 'id');
      expect(masked).toBe('123***def');
    });

    it('should handle short IDs', () => {
      const masked = maskSensitiveData('abc', 'id');
      expect(masked).toBe('***');
    });
  });

  describe('Repository Error Handling', () => {
    it('[perf] should handle duplicate email with proper error code', async () => {
      const user1 = new User(
        new RecordId(randomUUID()),
        'duplicate@example.com',
        GoogleId.create('googleid1234567890'),
        'User 1',
        'https://avatar.url',
        new UserSettings(false, true, 100, 50, 'en'),
        new Date(),
        new Date(),
        null
      );

      await repository.create(user1);

      const user2 = new User(
        new RecordId(randomUUID()),
        'duplicate@example.com',
        GoogleId.create('googleid0987654321'),
        'User 2',
        'https://avatar.url',
        new UserSettings(false, true, 100, 50, 'en'),
        new Date(),
        new Date(),
        null
      );

      const result = await repository.create(user2);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.unwrapErr().code).toBe('DUPLICATE_EMAIL');
      }
    });

    it('[perf] should handle duplicate Google ID with proper error code', async () => {
      const user1 = new User(
        new RecordId(randomUUID()),
        'user1@example.com',
        GoogleId.create('duplicategoogle12345'),
        'User 1',
        'https://avatar.url',
        new UserSettings(false, true, 100, 50, 'en'),
        new Date(),
        new Date(),
        null
      );

      await repository.create(user1);

      const user2 = new User(
        new RecordId(randomUUID()),
        'user2@example.com',
        GoogleId.create('duplicategoogle12345'),
        'User 2',
        'https://avatar.url',
        new UserSettings(false, true, 100, 50, 'en'),
        new Date(),
        new Date(),
        null
      );

      const result = await repository.create(user2);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.unwrapErr().code).toBe('DUPLICATE_GOOGLE_ID');
      }
    });

    it('[perf] should return null when user not found', async () => {
      const result = await repository.findByGoogleId(
        GoogleId.create('nonexistentgoogle123')
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.unwrap()).toBeNull();
      }
    });

    it('[perf] should handle non-existent user updates with proper error', async () => {
      const nonExistentUser = new User(
        new RecordId('550e8400-e29b-41d4-a716-446655440000'),
        'notfound@example.com',
        GoogleId.create('googlenotfound1234567890'),
        'Not Found',
        'https://avatar.url',
        new UserSettings(true, false, 150, 100, 'ru'),
        new Date(),
        new Date(),
        null
      );

      const result = await repository.updateSettings(nonExistentUser);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.unwrapErr().code).toBe('USER_NOT_FOUND');
      }
    });

    it('[perf] should successfully create and retrieve user', async () => {
      const user = new User(
        new RecordId(randomUUID()),
        'success@example.com',
        GoogleId.create('googlesuccess1234567890'),
        'Success User',
        'https://avatar.url',
        new UserSettings(false, true, 100, 50, 'en'),
        new Date(),
        new Date(),
        null
      );

      const createResult = await repository.create(user);
      expect(createResult.isOk()).toBe(true);

      if (createResult.isOk()) {
        const createdUser = createResult.unwrap();
        const findResult = await repository.findByGoogleId(
          createdUser.googleId
        );

        expect(findResult.isOk()).toBe(true);
        if (findResult.isOk()) {
          const foundUser = findResult.unwrap();
          expect(foundUser).not.toBeNull();
          expect(foundUser?.email).toBe('success@example.com');
        }
      }
    });
  });

  describe('Logging Integration', () => {
    it('[perf] should complete operations with logging enabled', async () => {
      // This test verifies that operations complete successfully with logging
      // The actual log output is verified through manual inspection in development
      const user = new User(
        new RecordId(randomUUID()),
        'logging@example.com',
        GoogleId.create('googlelogging1234567890'),
        'Logging User',
        'https://avatar.url',
        new UserSettings(false, true, 100, 50, 'en'),
        new Date(),
        new Date(),
        null
      );

      const result = await repository.create(user);
      expect(result.isOk()).toBe(true);

      // Operation should complete successfully with structured logging
    });
  });

  describe('Retry Logic Integration', () => {
    it('[perf] should not retry constraint violations', async () => {
      const user1 = new User(
        new RecordId(randomUUID()),
        'retry@example.com',
        GoogleId.create('googleretry1234567890'),
        'User',
        'https://avatar.url',
        new UserSettings(false, true, 100, 50, 'en'),
        new Date(),
        new Date(),
        null
      );

      await repository.create(user1);

      // Duplicate should fail immediately without retries
      const user2 = new User(
        new RecordId(randomUUID()),
        'retry@example.com',
        GoogleId.create('googleretry0987654321'),
        'User',
        'https://avatar.url',
        new UserSettings(false, true, 100, 50, 'en'),
        new Date(),
        new Date(),
        null
      );

      const startTime = Date.now();
      const result = await repository.create(user2);
      const duration = Date.now() - startTime;

      expect(result.isErr()).toBe(true);
      // Should fail quickly (< 1 second) without retries
      expect(duration).toBeLessThan(1000);
    });
  });
});

import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { RecordId } from '@misc-poc/shared';
import { User, GoogleId, UserSettings } from '@misc-poc/domain';
import { PostgreSQLUserRepository } from '../postgresql-user-repository';

/**
 * User Repository Contract Tests
 *
 * Tests from PRD Section 4.4.2 - Repository Contracts
 * These tests define the complete contract for User Repository implementation
 * following the Batch TDD approach (all tests written first, RED phase)
 */
describe('[perf] User Repository Contract', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let repository: PostgreSQLUserRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15').start();
    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      database: container.getDatabase(),
      username: container.getUsername(),
      password: container.getPassword(),
    });
    await dataSource.initialize();

    // Create tables matching the migration schema
    await dataSource.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        google_id VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_login_at TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE user_settings (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        case_sensitive BOOLEAN DEFAULT FALSE NOT NULL,
        remove_accents BOOLEAN DEFAULT TRUE NOT NULL,
        max_tag_length INTEGER DEFAULT 100 NOT NULL,
        max_tags_per_record INTEGER DEFAULT 50 NOT NULL,
        ui_language VARCHAR(10) DEFAULT 'en' NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_users_google_id ON users(google_id);
      CREATE INDEX idx_users_email ON users(email);
    `);

    repository = new PostgreSQLUserRepository(dataSource);
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  beforeEach(async () => {
    // Clean up before each test
    await dataSource.query('DELETE FROM user_settings');
    await dataSource.query('DELETE FROM users');
  });

  /**
   * findByGoogleId Tests
   * PRD Requirement: should find user by Google OAuth ID
   * PRD Requirement: should return null for non-existent user
   * PRD Requirement: should include user settings
   */
  describe('findByGoogleId', () => {
    it('should find user by Google OAuth ID', async () => {
      // Arrange: Create a user in the database
      const googleId = GoogleId.create('1234567890123');
      const user = User.create(
        'test@example.com',
        googleId,
        'Test User',
        'https://example.com/avatar.jpg'
      );

      // Save user to database
      await repository.create(user);

      // Act: Find user by Google ID
      const result = await repository.findByGoogleId(googleId);

      // Assert
      expect(result.isOk()).toBe(true);
      const foundUser = result.unwrap();
      expect(foundUser).not.toBeNull();
      expect(foundUser!.googleId.toString()).toBe(googleId.toString());
      expect(foundUser!.email).toBe('test@example.com');
      expect(foundUser!.displayName).toBe('Test User');
      expect(foundUser!.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('should return null for non-existent user', async () => {
      // Arrange: A Google ID that doesn't exist in database
      const nonExistentGoogleId = GoogleId.create('9999999999999');

      // Act: Try to find non-existent user
      const result = await repository.findByGoogleId(nonExistentGoogleId);

      // Assert
      expect(result.isOk()).toBe(true);
      const foundUser = result.unwrap();
      expect(foundUser).toBeNull();
    });

    it('should include user settings', async () => {
      // Arrange: Create a user with custom settings
      const googleId = GoogleId.create('1234567890124');
      const customSettings = new UserSettings(true, false, 200, 100, 'fr');
      const now = new Date();
      const user = new User(
        RecordId.generate(),
        'test2@example.com',
        googleId,
        'Test User 2',
        'https://example.com/avatar2.jpg',
        customSettings,
        now,
        now,
        null
      );

      await repository.create(user);

      // Act: Find user and verify settings are included
      const result = await repository.findByGoogleId(googleId);

      // Assert
      expect(result.isOk()).toBe(true);
      const foundUser = result.unwrap();
      expect(foundUser).not.toBeNull();
      expect(foundUser!.settings.caseSensitive).toBe(true);
      expect(foundUser!.settings.removeAccents).toBe(false);
      expect(foundUser!.settings.maxTagLength).toBe(200);
      expect(foundUser!.settings.maxTagsPerRecord).toBe(100);
      expect(foundUser!.settings.uiLanguage).toBe('fr');
    });

    it('should handle Google ID with special format', async () => {
      // Arrange: Google IDs can be alphanumeric
      const googleId = GoogleId.create('Abc123XYZ456def');
      const user = User.create(
        'special@example.com',
        googleId,
        'Special User',
        ''
      );

      await repository.create(user);

      // Act
      const result = await repository.findByGoogleId(googleId);

      // Assert
      expect(result.isOk()).toBe(true);
      const foundUser = result.unwrap();
      expect(foundUser).not.toBeNull();
      expect(foundUser!.googleId.toString()).toBe('Abc123XYZ456def');
    });
  });

  /**
   * create Tests
   * PRD Requirement: should create new user with Google profile
   * PRD Requirement: should initialize default settings
   * PRD Requirement: should handle duplicate email gracefully
   * PRD Requirement: should set creation timestamp
   */
  describe('create', () => {
    it('should create new user with Google profile', async () => {
      // Arrange: Create a new User entity
      const googleId = GoogleId.create('1234567890125');
      const user = User.create(
        'newuser@example.com',
        googleId,
        'New User',
        'https://example.com/new-avatar.jpg'
      );

      // Act: Save user to database
      const result = await repository.create(user);

      // Assert
      expect(result.isOk()).toBe(true);
      const createdUser = result.unwrap();
      expect(createdUser.id).toEqual(user.id);
      expect(createdUser.email).toBe('newuser@example.com');
      expect(createdUser.googleId.toString()).toBe(googleId.toString());
      expect(createdUser.displayName).toBe('New User');
      expect(createdUser.avatarUrl).toBe('https://example.com/new-avatar.jpg');
      expect(createdUser.createdAt).toBeInstanceOf(Date);
      expect(createdUser.updatedAt).toBeInstanceOf(Date);
      expect(createdUser.lastLoginAt).toBeNull();
    });

    it('should initialize default settings', async () => {
      // Arrange: Create user with default settings
      const googleId = GoogleId.create('1234567890126');
      const user = User.create(
        'default@example.com',
        googleId,
        'Default User',
        ''
      );

      // Act
      const result = await repository.create(user);

      // Assert: Verify default settings are persisted
      expect(result.isOk()).toBe(true);
      const createdUser = result.unwrap();
      expect(createdUser.settings.caseSensitive).toBe(false);
      expect(createdUser.settings.removeAccents).toBe(true);
      expect(createdUser.settings.maxTagLength).toBe(100);
      expect(createdUser.settings.maxTagsPerRecord).toBe(50);
      expect(createdUser.settings.uiLanguage).toBe('en');
    });

    it('should handle duplicate email gracefully', async () => {
      // Arrange: Create first user
      const googleId1 = GoogleId.create('1234567890127');
      const user1 = User.create(
        'duplicate@example.com',
        googleId1,
        'User One',
        ''
      );
      await repository.create(user1);

      // Act: Try to create second user with same email but different Google ID
      const googleId2 = GoogleId.create('9876543210987');
      const user2 = User.create(
        'duplicate@example.com',
        googleId2,
        'User Two',
        ''
      );
      const result = await repository.create(user2);

      // Assert: Should return error
      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error.message).toContain('email');
    });

    it('should set creation timestamp', async () => {
      // Arrange
      const googleId = GoogleId.create('1234567890128');
      const beforeCreate = new Date();
      const user = User.create('timestamp@example.com', googleId, 'Test', '');

      // Act
      const result = await repository.create(user);

      // Assert: Creation timestamp should be recent
      expect(result.isOk()).toBe(true);
      const createdUser = result.unwrap();
      const afterCreate = new Date();

      expect(createdUser.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime() - 1000
      ); // 1 second tolerance
      expect(createdUser.createdAt.getTime()).toBeLessThanOrEqual(
        afterCreate.getTime() + 1000
      );
      expect(createdUser.updatedAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime() - 1000
      );
      expect(createdUser.updatedAt.getTime()).toBeLessThanOrEqual(
        afterCreate.getTime() + 1000
      );
    });

    it('should handle duplicate Google ID gracefully', async () => {
      // Arrange: Create first user
      const googleId = GoogleId.create('1234567890129');
      const user1 = User.create('user1@example.com', googleId, 'User One', '');
      await repository.create(user1);

      // Act: Try to create second user with same Google ID
      const user2 = User.create('user2@example.com', googleId, 'User Two', '');
      const result = await repository.create(user2);

      // Assert: Should return error
      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error.message).toContain('Google ID');
    });

    it('should persist custom settings provided at creation', async () => {
      // Arrange: Create user with custom settings
      const googleId = GoogleId.create('1234567890130');
      const customSettings = new UserSettings(true, true, 150, 75, 'de');
      const now = new Date();
      const user = new User(
        RecordId.generate(),
        'custom@example.com',
        googleId,
        'Custom User',
        '',
        customSettings,
        now,
        now,
        null
      );

      // Act
      const result = await repository.create(user);

      // Assert: Custom settings should be persisted
      expect(result.isOk()).toBe(true);
      const createdUser = result.unwrap();
      expect(createdUser.settings.caseSensitive).toBe(true);
      expect(createdUser.settings.removeAccents).toBe(true);
      expect(createdUser.settings.maxTagLength).toBe(150);
      expect(createdUser.settings.maxTagsPerRecord).toBe(75);
      expect(createdUser.settings.uiLanguage).toBe('de');
    });

    it('should handle empty display name and avatar URL', async () => {
      // Arrange: User with minimal information
      const googleId = GoogleId.create('1234567890131');
      const user = User.create('minimal@example.com', googleId, '', '');

      // Act
      const result = await repository.create(user);

      // Assert: Should create successfully
      expect(result.isOk()).toBe(true);
      const createdUser = result.unwrap();
      expect(createdUser.displayName).toBe('');
      expect(createdUser.avatarUrl).toBe('');
    });
  });

  /**
   * updateSettings Tests
   * PRD Requirement: should persist user preference changes
   * PRD Requirement: should validate setting constraints
   * PRD Requirement: should update modification timestamp
   */
  describe('updateSettings', () => {
    it('should persist user preference changes', async () => {
      // Arrange: Create user with default settings
      const googleId = GoogleId.create('1234567890132');
      const user = User.create('settings@example.com', googleId, 'Test', '');
      await repository.create(user);

      // Act: Update settings
      const newSettings = new UserSettings(true, false, 200, 100, 'es');
      const updatedUser = user.updateSettings(newSettings);
      const result = await repository.updateSettings(updatedUser);

      // Assert: Settings should be updated
      expect(result.isOk()).toBe(true);
      const savedUser = result.unwrap();
      expect(savedUser.settings.caseSensitive).toBe(true);
      expect(savedUser.settings.removeAccents).toBe(false);
      expect(savedUser.settings.maxTagLength).toBe(200);
      expect(savedUser.settings.maxTagsPerRecord).toBe(100);
      expect(savedUser.settings.uiLanguage).toBe('es');
    });

    it('should validate setting constraints', async () => {
      // Arrange: Create user
      const googleId = GoogleId.create('1234567890133');
      const user = User.create('validate@example.com', googleId, 'Test', '');
      await repository.create(user);

      // Act & Assert: Invalid maxTagLength (caught by UserSettings validation)
      expect(() => {
        new UserSettings(false, true, 0, 50, 'en'); // maxTagLength = 0 is invalid
      }).toThrow();

      // Act & Assert: Invalid maxTagsPerRecord
      expect(() => {
        new UserSettings(false, true, 100, 0, 'en'); // maxTagsPerRecord = 0 is invalid
      }).toThrow();

      // Act & Assert: Invalid uiLanguage
      expect(() => {
        new UserSettings(false, true, 100, 50, 'invalid'); // Not ISO 639-1
      }).toThrow();
    });

    it('should update modification timestamp', async () => {
      // Arrange: Create user and wait a moment
      const googleId = GoogleId.create('1234567890134');
      const user = User.create('timestamp@example.com', googleId, 'Test', '');
      const createResult = await repository.create(user);
      const createdUser = createResult.unwrap();
      const originalUpdatedAt = createdUser.updatedAt;

      // Wait to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Act: Update settings
      const newSettings = new UserSettings(true, true, 100, 50, 'en');
      const updatedUser = createdUser.updateSettings(newSettings);
      const result = await repository.updateSettings(updatedUser);

      // Assert: Updated timestamp should be newer
      expect(result.isOk()).toBe(true);
      const savedUser = result.unwrap();
      expect(savedUser.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      );
      expect(savedUser.createdAt).toEqual(createdUser.createdAt);
    });

    it('should handle partial settings updates', async () => {
      // Arrange: Create user with default settings
      const googleId = GoogleId.create('1234567890135');
      const user = User.create('partial@example.com', googleId, 'Test', '');
      await repository.create(user);

      // Act: Update only some settings using withUpdatedSettings
      const partiallyUpdatedSettings = user.settings.withUpdatedSettings({
        caseSensitive: true,
        maxTagLength: 150,
      });
      const updatedUser = user.updateSettings(partiallyUpdatedSettings);
      const result = await repository.updateSettings(updatedUser);

      // Assert: Only specified settings should change
      expect(result.isOk()).toBe(true);
      const savedUser = result.unwrap();
      expect(savedUser.settings.caseSensitive).toBe(true);
      expect(savedUser.settings.maxTagLength).toBe(150);
      expect(savedUser.settings.removeAccents).toBe(true); // unchanged
      expect(savedUser.settings.maxTagsPerRecord).toBe(50); // unchanged
      expect(savedUser.settings.uiLanguage).toBe('en'); // unchanged
    });

    it('should return error for non-existent user', async () => {
      // Arrange: Create a user entity that doesn't exist in database
      const googleId = GoogleId.create('9999999999999');
      const nonExistentUser = User.create(
        'nonexistent@example.com',
        googleId,
        'Ghost',
        ''
      );

      // Act: Try to update settings for non-existent user
      const newSettings = new UserSettings(true, true, 100, 50, 'en');
      const updatedUser = nonExistentUser.updateSettings(newSettings);
      const result = await repository.updateSettings(updatedUser);

      // Assert: Should return error
      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error.message).toContain('not found');
    });
  });

  /**
   * updateLastLogin Tests
   * Additional test for user login tracking functionality
   */
  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      // Arrange: Create user
      const googleId = GoogleId.create('1234567890136');
      const user = User.create('login@example.com', googleId, 'Test', '');
      const createResult = await repository.create(user);
      const createdUser = createResult.unwrap();

      // Initially last login should be null
      expect(createdUser.lastLoginAt).toBeNull();

      // Act: Record a login
      const loginTime = new Date();
      const userWithLogin = createdUser.recordLogin(loginTime);
      const result = await repository.updateLastLogin(userWithLogin);

      // Assert: Last login should be set
      expect(result.isOk()).toBe(true);
      const updatedUser = result.unwrap();
      expect(updatedUser.lastLoginAt).not.toBeNull();
      expect(updatedUser.lastLoginAt!.getTime()).toBeCloseTo(
        loginTime.getTime(),
        -2
      ); // Within 100ms
    });

    it('should update last login multiple times', async () => {
      // Arrange: Create user and record first login
      const googleId = GoogleId.create('1234567890137');
      const user = User.create('multilogin@example.com', googleId, 'Test', '');
      await repository.create(user);

      const firstLogin = new Date();
      const userWithFirstLogin = user.recordLogin(firstLogin);
      await repository.updateLastLogin(userWithFirstLogin);

      // Wait to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Act: Record second login
      const secondLogin = new Date();
      const userWithSecondLogin = userWithFirstLogin.recordLogin(secondLogin);
      const result = await repository.updateLastLogin(userWithSecondLogin);

      // Assert: Last login should be the most recent
      expect(result.isOk()).toBe(true);
      const updatedUser = result.unwrap();
      expect(updatedUser.lastLoginAt!.getTime()).toBeGreaterThan(
        firstLogin.getTime()
      );
      expect(updatedUser.lastLoginAt!.getTime()).toBeCloseTo(
        secondLogin.getTime(),
        -2
      );
    });

    it('should return error for non-existent user', async () => {
      // Arrange: Create a user entity that doesn't exist in database
      const googleId = GoogleId.create('8888888888888');
      const nonExistentUser = User.create(
        'ghost@example.com',
        googleId,
        'Ghost',
        ''
      );

      // Act: Try to update last login for non-existent user
      const loginTime = new Date();
      const userWithLogin = nonExistentUser.recordLogin(loginTime);
      const result = await repository.updateLastLogin(userWithLogin);

      // Assert: Should return error
      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error.message).toContain('not found');
    });
  });

  /**
   * Integration Tests - Testing interactions between methods
   */
  describe('Integration Tests', () => {
    it('should complete full user lifecycle', async () => {
      // Arrange & Act: Create user
      const googleId = GoogleId.create('1234567890138');
      const user = User.create('lifecycle@example.com', googleId, 'Test', '');
      const createResult = await repository.create(user);
      expect(createResult.isOk()).toBe(true);

      // Act: Find user by Google ID
      const findResult = await repository.findByGoogleId(googleId);
      expect(findResult.isOk()).toBe(true);
      const foundUser = findResult.unwrap();
      expect(foundUser).not.toBeNull();

      // Act: Update settings
      const newSettings = new UserSettings(true, false, 200, 100, 'fr');
      const userWithNewSettings = foundUser!.updateSettings(newSettings);
      const updateResult = await repository.updateSettings(userWithNewSettings);
      expect(updateResult.isOk()).toBe(true);

      // Act: Record login
      const loginTime = new Date();
      const userWithLogin = userWithNewSettings.recordLogin(loginTime);
      const loginResult = await repository.updateLastLogin(userWithLogin);
      expect(loginResult.isOk()).toBe(true);

      // Assert: Verify all changes persisted
      const finalFindResult = await repository.findByGoogleId(googleId);
      expect(finalFindResult.isOk()).toBe(true);
      const finalUser = finalFindResult.unwrap();

      expect(finalUser).not.toBeNull();
      expect(finalUser!.settings.caseSensitive).toBe(true);
      expect(finalUser!.settings.removeAccents).toBe(false);
      expect(finalUser!.settings.maxTagLength).toBe(200);
      expect(finalUser!.settings.maxTagsPerRecord).toBe(100);
      expect(finalUser!.settings.uiLanguage).toBe('fr');
      expect(finalUser!.lastLoginAt).not.toBeNull();
    });

    it('should maintain data isolation between users', async () => {
      // Arrange: Create two users
      const googleId1 = GoogleId.create('1234567890139');
      const user1 = User.create('user1@example.com', googleId1, 'User 1', '');
      await repository.create(user1);

      const googleId2 = GoogleId.create('9876543210988');
      const user2 = User.create('user2@example.com', googleId2, 'User 2', '');
      await repository.create(user2);

      // Act: Update settings for user 1
      const newSettings1 = new UserSettings(true, true, 200, 100, 'fr');
      const updatedUser1 = user1.updateSettings(newSettings1);
      await repository.updateSettings(updatedUser1);

      // Assert: User 2 settings should remain unchanged
      const user2FindResult = await repository.findByGoogleId(googleId2);
      expect(user2FindResult.isOk()).toBe(true);
      const foundUser2 = user2FindResult.unwrap();

      expect(foundUser2).not.toBeNull();
      expect(foundUser2!.settings.caseSensitive).toBe(false);
      expect(foundUser2!.settings.removeAccents).toBe(true);
      expect(foundUser2!.settings.maxTagLength).toBe(100);
      expect(foundUser2!.settings.maxTagsPerRecord).toBe(50);
      expect(foundUser2!.settings.uiLanguage).toBe('en');
    });
  });
});

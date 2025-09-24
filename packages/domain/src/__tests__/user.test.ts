import { User } from '../user';
import { GoogleId } from '../google-id';
import { UserSettings } from '../user-settings';
import { RecordId } from '@misc-poc/shared';

describe('User Domain Entity', () => {
  const validGoogleId = GoogleId.create('123456789012345678901');
  const validEmail = 'test@example.com';
  const validDisplayName = 'Test User';
  const validAvatarUrl = 'https://example.com/avatar.jpg';
  const validSettings = UserSettings.createDefault();

  describe('constructor', () => {
    it('should create user with all required fields', () => {
      const id = RecordId.generate();
      const now = new Date();
      const user = new User(
        id,
        validEmail,
        validGoogleId,
        validDisplayName,
        validAvatarUrl,
        validSettings,
        now,
        now,
        null
      );

      expect(user.id).toBe(id);
      expect(user.email).toBe(validEmail);
      expect(user.googleId).toBe(validGoogleId);
      expect(user.displayName).toBe(validDisplayName);
      expect(user.avatarUrl).toBe(validAvatarUrl);
      expect(user.settings).toBe(validSettings);
      expect(user.createdAt).toBe(now);
      expect(user.updatedAt).toBe(now);
      expect(user.lastLoginAt).toBeNull();
    });

    it('should throw error when ID is null', () => {
      expect(
        () =>
          new User(
            null as any,
            validEmail,
            validGoogleId,
            validDisplayName,
            validAvatarUrl,
            validSettings,
            new Date(),
            new Date(),
            null
          )
      ).toThrow('User ID cannot be null or undefined');
    });

    it('should throw error when email is null', () => {
      expect(
        () =>
          new User(
            RecordId.generate(),
            null as any,
            validGoogleId,
            validDisplayName,
            validAvatarUrl,
            validSettings,
            new Date(),
            new Date(),
            null
          )
      ).toThrow('Email cannot be null or undefined');
    });

    it('should throw error when email is invalid', () => {
      expect(
        () =>
          new User(
            RecordId.generate(),
            'invalid-email',
            validGoogleId,
            validDisplayName,
            validAvatarUrl,
            validSettings,
            new Date(),
            new Date(),
            null
          )
      ).toThrow('Invalid email format');
    });

    it('should throw error when Google ID is null', () => {
      expect(
        () =>
          new User(
            RecordId.generate(),
            validEmail,
            null as any,
            validDisplayName,
            validAvatarUrl,
            validSettings,
            new Date(),
            new Date(),
            null
          )
      ).toThrow('Google ID cannot be null or undefined');
    });

    it('should throw error when settings are null', () => {
      expect(
        () =>
          new User(
            RecordId.generate(),
            validEmail,
            validGoogleId,
            validDisplayName,
            validAvatarUrl,
            null as any,
            new Date(),
            new Date(),
            null
          )
      ).toThrow('User settings cannot be null or undefined');
    });

    it('should throw error when created date is null', () => {
      expect(
        () =>
          new User(
            RecordId.generate(),
            validEmail,
            validGoogleId,
            validDisplayName,
            validAvatarUrl,
            validSettings,
            null as any,
            new Date(),
            null
          )
      ).toThrow('Created date cannot be null or undefined');
    });

    it('should throw error when updated date is null', () => {
      expect(
        () =>
          new User(
            RecordId.generate(),
            validEmail,
            validGoogleId,
            validDisplayName,
            validAvatarUrl,
            validSettings,
            new Date(),
            null as any,
            null
          )
      ).toThrow('Updated date cannot be null or undefined');
    });

    it('should throw error when updated date is before created date', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 1000);

      expect(
        () =>
          new User(
            RecordId.generate(),
            validEmail,
            validGoogleId,
            validDisplayName,
            validAvatarUrl,
            validSettings,
            now,
            past,
            null
          )
      ).toThrow('Updated date cannot be before created date');
    });
  });

  describe('create', () => {
    it('should create new user with Google profile data', () => {
      const user = User.create(
        validEmail,
        validGoogleId,
        validDisplayName,
        validAvatarUrl
      );

      expect(user.email).toBe(validEmail);
      expect(user.googleId).toBe(validGoogleId);
      expect(user.displayName).toBe(validDisplayName);
      expect(user.avatarUrl).toBe(validAvatarUrl);
      expect(user.settings).toEqual(UserSettings.createDefault());
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
      expect(user.lastLoginAt).toBeNull();
    });

    it('should create user with default settings', () => {
      const user = User.create(
        validEmail,
        validGoogleId,
        validDisplayName,
        validAvatarUrl
      );
      const defaultSettings = UserSettings.createDefault();

      expect(user.settings.caseSensitive).toBe(defaultSettings.caseSensitive);
      expect(user.settings.removeAccents).toBe(defaultSettings.removeAccents);
      expect(user.settings.maxTagLength).toBe(defaultSettings.maxTagLength);
      expect(user.settings.maxTagsPerRecord).toBe(
        defaultSettings.maxTagsPerRecord
      );
    });
  });

  describe('updateSettings', () => {
    it('should update user settings and modification timestamp', () => {
      const user = User.create(
        validEmail,
        validGoogleId,
        validDisplayName,
        validAvatarUrl
      );
      const newSettings = new UserSettings(true, false, 200, 100, 'es');
      const originalUpdatedAt = user.updatedAt;

      // Wait a small amount to ensure timestamp difference
      setTimeout(() => {
        const updatedUser = user.updateSettings(newSettings);

        expect(updatedUser.settings).toBe(newSettings);
        expect(updatedUser.updatedAt.getTime()).toBeGreaterThan(
          originalUpdatedAt.getTime()
        );
        expect(updatedUser.createdAt).toBe(user.createdAt);
        expect(updatedUser.id).toBe(user.id);
      }, 1);
    });

    it('should preserve all other fields when updating settings', () => {
      const user = User.create(
        validEmail,
        validGoogleId,
        validDisplayName,
        validAvatarUrl
      );
      const newSettings = new UserSettings(true, false, 200, 100, 'fr');

      const updatedUser = user.updateSettings(newSettings);

      expect(updatedUser.email).toBe(user.email);
      expect(updatedUser.googleId).toBe(user.googleId);
      expect(updatedUser.displayName).toBe(user.displayName);
      expect(updatedUser.avatarUrl).toBe(user.avatarUrl);
      expect(updatedUser.lastLoginAt).toBe(user.lastLoginAt);
    });
  });

  describe('recordLogin', () => {
    it('should update last login timestamp', () => {
      const user = User.create(
        validEmail,
        validGoogleId,
        validDisplayName,
        validAvatarUrl
      );
      const loginTime = new Date();

      const updatedUser = user.recordLogin(loginTime);

      expect(updatedUser.lastLoginAt).toBe(loginTime);
      expect(updatedUser.updatedAt.getTime()).toBeGreaterThanOrEqual(
        loginTime.getTime()
      );
    });

    it('should preserve all other fields when recording login', () => {
      const user = User.create(
        validEmail,
        validGoogleId,
        validDisplayName,
        validAvatarUrl
      );
      const loginTime = new Date();

      const updatedUser = user.recordLogin(loginTime);

      expect(updatedUser.email).toBe(user.email);
      expect(updatedUser.googleId).toBe(user.googleId);
      expect(updatedUser.displayName).toBe(user.displayName);
      expect(updatedUser.avatarUrl).toBe(user.avatarUrl);
      expect(updatedUser.settings).toBe(user.settings);
      expect(updatedUser.createdAt).toBe(user.createdAt);
    });
  });

  describe('equals', () => {
    it('should return true for users with same ID', () => {
      const id = RecordId.generate();
      const user1 = new User(
        id,
        validEmail,
        validGoogleId,
        validDisplayName,
        validAvatarUrl,
        validSettings,
        new Date(),
        new Date(),
        null
      );
      const user2 = new User(
        id,
        'different@email.com',
        GoogleId.create('987654321098765432109'),
        'Different Name',
        'https://different.com/avatar.jpg',
        new UserSettings(true, false, 200, 100, 'es'),
        new Date(),
        new Date(),
        null
      );

      expect(user1.equals(user2)).toBe(true);
    });

    it('should return false for users with different IDs', () => {
      const user1 = User.create(
        validEmail,
        validGoogleId,
        validDisplayName,
        validAvatarUrl
      );
      const user2 = User.create(
        validEmail,
        validGoogleId,
        validDisplayName,
        validAvatarUrl
      );

      expect(user1.equals(user2)).toBe(false);
    });

    it('should return false for null or undefined', () => {
      const user = User.create(
        validEmail,
        validGoogleId,
        validDisplayName,
        validAvatarUrl
      );

      expect(user.equals(null as any)).toBe(false);
      expect(user.equals(undefined as any)).toBe(false);
    });
  });

  describe('business rules', () => {
    it('should enforce unique Google ID constraint in domain', () => {
      const googleId = GoogleId.create('123456789012345678901');
      const user1 = User.create(
        validEmail,
        googleId,
        validDisplayName,
        validAvatarUrl
      );

      // Domain should accept same Google ID (uniqueness enforced at repository level)
      expect(() => {
        const user2 = User.create(
          'other@example.com',
          googleId,
          'Other User',
          validAvatarUrl
        );
      }).not.toThrow();
    });

    it('should maintain immutability of user entity', () => {
      const user = User.create(
        validEmail,
        validGoogleId,
        validDisplayName,
        validAvatarUrl
      );
      const originalSettings = user.settings;

      // Attempt to mutate (should not affect original)
      const newSettings = new UserSettings(true, false, 200, 100, 'de');
      const updatedUser = user.updateSettings(newSettings);

      expect(user.settings).toBe(originalSettings);
      expect(updatedUser.settings).toBe(newSettings);
      expect(user).not.toBe(updatedUser);
    });
  });
});

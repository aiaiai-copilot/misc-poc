import passport from 'passport';
import {
  configureGoogleStrategy,
  GoogleProfile,
  GoogleAuthCallback,
} from '../google.js';
import { AuthConfig } from '../../config.js';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

// Mock passport
jest.mock('passport');
const mockPassport = jest.mocked(passport);

describe('Google OAuth Strategy Configuration', () => {
  const mockAuthConfig: AuthConfig = {
    jwt: {
      secret: 'test-jwt-secret',
      expiresIn: '24h',
      issuer: 'misc-poc-backend',
    },
    google: {
      clientId: 'test-google-client-id',
      clientSecret: 'test-google-client-secret',
      callbackUrl: '/auth/google/callback',
    },
    session: {
      secret: 'test-session-secret',
      name: 'misc-poc-session',
      maxAge: 86400000,
    },
  };

  let mockCallback: jest.MockedFunction<GoogleAuthCallback>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCallback = jest.fn();
  });

  describe('configureGoogleStrategy', () => {
    it('should configure Google OAuth strategy with correct settings', () => {
      configureGoogleStrategy(mockAuthConfig, mockCallback);

      expect(mockPassport.use).toHaveBeenCalledTimes(1);
      expect(mockPassport.use).toHaveBeenCalledWith(expect.any(GoogleStrategy));
    });

    it('should configure strategy with correct client credentials', () => {
      configureGoogleStrategy(mockAuthConfig, mockCallback);

      const strategyCall = mockPassport.use.mock.calls[0][0];
      expect(strategyCall).toBeInstanceOf(GoogleStrategy);

      // Access the strategy options via the internal _oauth2 property
      const strategy = strategyCall as any;
      expect(strategy._oauth2._clientId).toBe('test-google-client-id');
      expect(strategy._oauth2._clientSecret).toBe('test-google-client-secret');
    });

    it('should configure strategy with correct callback URL and scope', () => {
      configureGoogleStrategy(mockAuthConfig, mockCallback);

      const strategyCall = mockPassport.use.mock.calls[0][0];
      const strategy = strategyCall as any;

      expect(strategy._callbackURL).toBe('/auth/google/callback');
      expect(strategy._scope).toContain('profile');
      expect(strategy._scope).toContain('email');
    });
  });

  describe('Google Strategy Callback Handling', () => {
    let strategyCallback: Function;

    beforeEach(() => {
      configureGoogleStrategy(mockAuthConfig, mockCallback);
      const strategy = mockPassport.use.mock.calls[0][0] as any;
      strategyCallback = strategy._verify;
    });

    it('should extract user email and profile from Google token', async () => {
      const mockGoogleProfile = {
        id: 'google123',
        emails: [{ value: 'test@example.com' }],
        name: {
          givenName: 'John',
          familyName: 'Doe',
        },
        displayName: 'John Doe',
        photos: [{ value: 'https://photo.url' }],
      };

      const mockUser = { id: 'user123', email: 'test@example.com' };
      mockCallback.mockResolvedValue(mockUser);

      const doneMock = jest.fn();
      await strategyCallback(
        'access-token',
        'refresh-token',
        mockGoogleProfile,
        doneMock
      );

      expect(mockCallback).toHaveBeenCalledWith(
        'access-token',
        'refresh-token',
        {
          id: 'google123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          displayName: 'John Doe',
          photo: 'https://photo.url',
        }
      );
      expect(doneMock).toHaveBeenCalledWith(null, mockUser);
    });

    it('should handle Google profile with missing optional fields', async () => {
      const mockGoogleProfile = {
        id: 'google123',
        emails: [],
        name: {},
        displayName: 'John Doe',
        photos: [],
      };

      const mockUser = { id: 'user123', email: '' };
      mockCallback.mockResolvedValue(mockUser);

      const doneMock = jest.fn();
      await strategyCallback(
        'access-token',
        'refresh-token',
        mockGoogleProfile,
        doneMock
      );

      expect(mockCallback).toHaveBeenCalledWith(
        'access-token',
        'refresh-token',
        {
          id: 'google123',
          email: '',
          firstName: '',
          lastName: '',
          displayName: 'John Doe',
          photo: undefined,
        }
      );
      expect(doneMock).toHaveBeenCalledWith(null, mockUser);
    });

    it('should handle callback errors gracefully', async () => {
      const mockGoogleProfile = {
        id: 'google123',
        emails: [{ value: 'test@example.com' }],
        name: { givenName: 'John', familyName: 'Doe' },
        displayName: 'John Doe',
        photos: [],
      };

      const callbackError = new Error('Database connection failed');
      mockCallback.mockRejectedValue(callbackError);

      const doneMock = jest.fn();
      await strategyCallback(
        'access-token',
        'refresh-token',
        mockGoogleProfile,
        doneMock
      );

      expect(doneMock).toHaveBeenCalledWith(callbackError, false);
    });

    it('should reject invalid Google token with appropriate error', async () => {
      const mockGoogleProfile = null; // Simulate invalid token scenario

      const doneMock = jest.fn();
      await strategyCallback(
        'invalid-token',
        null,
        mockGoogleProfile,
        doneMock
      );

      expect(doneMock).toHaveBeenCalledWith(expect.any(Error), false);
    });
  });

  describe('Google Profile Type Safety', () => {
    it('should properly type Google profile interface', () => {
      const profile: GoogleProfile = {
        id: 'google123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        photo: 'https://photo.url',
      };

      expect(profile.id).toBe('google123');
      expect(profile.email).toBe('test@example.com');
      expect(profile.firstName).toBe('John');
      expect(profile.lastName).toBe('Doe');
      expect(profile.displayName).toBe('John Doe');
      expect(profile.photo).toBe('https://photo.url');
    });

    it('should allow optional photo field', () => {
      const profile: GoogleProfile = {
        id: 'google123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
      };

      expect(profile.photo).toBeUndefined();
    });
  });

  describe('Authentication Callback Type Safety', () => {
    it('should properly type authentication callback', () => {
      const callback: GoogleAuthCallback = async (
        _accessToken: string,
        _refreshToken: string,
        profile: GoogleProfile
      ) => {
        return { id: 'user123', email: profile.email };
      };

      expect(typeof callback).toBe('function');
    });
  });
});

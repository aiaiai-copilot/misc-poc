/**
 * Tests for authentication validation schemas
 */
import {
  loginRequestSchema,
  registrationRequestSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  jwtPayloadSchema,
  userProfileSchema,
  oauthProviderSchema,
  oauthCallbackSchema,
} from '../auth.js';

describe('Authentication Validation Schemas', () => {
  describe('loginRequestSchema', () => {
    it('should validate valid login request', () => {
      const validLogin = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: true,
      };
      expect(() => loginRequestSchema.parse(validLogin)).not.toThrow();
    });

    it('should apply default rememberMe value', () => {
      const login = {
        email: 'test@example.com',
        password: 'password123',
      };
      const result = loginRequestSchema.parse(login);
      expect(result.rememberMe).toBe(false);
    });

    it('should reject invalid email', () => {
      const invalidLogin = {
        email: 'invalid-email',
        password: 'password123',
      };
      expect(() => loginRequestSchema.parse(invalidLogin)).toThrow();
    });

    it('should reject empty password', () => {
      const invalidLogin = {
        email: 'test@example.com',
        password: '',
      };
      expect(() => loginRequestSchema.parse(invalidLogin)).toThrow();
    });
  });

  describe('registrationRequestSchema', () => {
    it('should validate valid registration request', () => {
      const validRegistration = {
        email: 'test@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
        firstName: 'John',
        lastName: 'Doe',
        acceptTerms: true,
      };
      expect(() =>
        registrationRequestSchema.parse(validRegistration)
      ).not.toThrow();
    });

    it('should reject weak passwords', () => {
      const invalidRegistration = {
        email: 'test@example.com',
        password: 'weak',
        confirmPassword: 'weak',
        firstName: 'John',
        lastName: 'Doe',
        acceptTerms: true,
      };
      expect(() =>
        registrationRequestSchema.parse(invalidRegistration)
      ).toThrow();
    });

    it('should reject password without uppercase', () => {
      const invalidRegistration = {
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        acceptTerms: true,
      };
      expect(() =>
        registrationRequestSchema.parse(invalidRegistration)
      ).toThrow();
    });

    it('should reject mismatched passwords', () => {
      const invalidRegistration = {
        email: 'test@example.com',
        password: 'Password123',
        confirmPassword: 'Password456',
        firstName: 'John',
        lastName: 'Doe',
        acceptTerms: true,
      };
      expect(() =>
        registrationRequestSchema.parse(invalidRegistration)
      ).toThrow();
    });

    it('should reject when terms not accepted', () => {
      const invalidRegistration = {
        email: 'test@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
        firstName: 'John',
        lastName: 'Doe',
        acceptTerms: false,
      };
      expect(() =>
        registrationRequestSchema.parse(invalidRegistration)
      ).toThrow();
    });
  });

  describe('passwordResetRequestSchema', () => {
    it('should validate valid password reset request', () => {
      const validRequest = { email: 'test@example.com' };
      expect(() =>
        passwordResetRequestSchema.parse(validRequest)
      ).not.toThrow();
    });

    it('should reject invalid email', () => {
      const invalidRequest = { email: 'invalid-email' };
      expect(() => passwordResetRequestSchema.parse(invalidRequest)).toThrow();
    });
  });

  describe('jwtPayloadSchema', () => {
    it('should validate valid JWT payload', () => {
      const validPayload = {
        sub: 'user-id',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'test-issuer',
      };
      expect(() => jwtPayloadSchema.parse(validPayload)).not.toThrow();
    });
  });

  describe('oauthProviderSchema', () => {
    it('should validate supported providers', () => {
      expect(oauthProviderSchema.parse('google')).toBe('google');
      expect(oauthProviderSchema.parse('github')).toBe('github');
      expect(oauthProviderSchema.parse('facebook')).toBe('facebook');
    });

    it('should reject unsupported providers', () => {
      expect(() => oauthProviderSchema.parse('twitter')).toThrow();
    });
  });

  describe('oauthCallbackSchema', () => {
    it('should validate valid OAuth callback', () => {
      const validCallback = {
        code: 'auth-code',
        state: 'state-value',
      };
      expect(() => oauthCallbackSchema.parse(validCallback)).not.toThrow();
    });

    it('should validate error callback', () => {
      const errorCallback = {
        error: 'access_denied',
        error_description: 'User denied access',
      };
      expect(() => oauthCallbackSchema.parse(errorCallback)).toThrow();
    });
  });
});

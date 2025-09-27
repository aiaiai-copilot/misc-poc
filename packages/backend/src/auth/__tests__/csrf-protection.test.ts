import {
  CSRFProtectionLevel,
  getCSRFProtectionConfig,
  validateCSRFProtection,
  generateCSRFProtectionReport,
} from '../csrf-protection.js';
import { AuthConfig } from '../config.js';

describe('CSRF Protection', () => {
  let mockConfig: AuthConfig;

  beforeEach(() => {
    mockConfig = {
      jwt: {
        secret: 'test-secret',
        expiresIn: '1h',
        issuer: 'test-issuer',
      },
      google: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        callbackUrl: '/test/callback',
      },
      session: {
        secret: 'test-session-secret',
        name: 'test-session',
        maxAge: 3600000,
        domain: '.example.com',
        path: '/api',
      },
    };

    process.env.NODE_ENV = 'test';
  });

  describe('getCSRFProtectionConfig', () => {
    it('should return lax protection for test environment', () => {
      const config = getCSRFProtectionConfig(mockConfig);

      expect(config).toEqual({
        sameSite: CSRFProtectionLevel.LAX,
        secure: false, // test environment
        httpOnly: true,
        signed: true,
        domain: '.example.com',
        path: '/api',
        maxAge: 3600000,
      });
    });

    it('should return strict protection for production environment', () => {
      process.env.NODE_ENV = 'production';
      const config = getCSRFProtectionConfig(mockConfig);

      expect(config).toEqual({
        sameSite: CSRFProtectionLevel.STRICT,
        secure: true, // production
        httpOnly: true,
        signed: true,
        domain: '.example.com',
        path: '/api',
        maxAge: 3600000,
      });
    });
  });

  describe('validateCSRFProtection', () => {
    it('should validate secure cookie configuration', () => {
      const cookieConfig = {
        sameSite: 'lax',
        secure: false, // test environment
        httpOnly: true,
        signed: true,
        domain: '.example.com',
      };

      const result = validateCSRFProtection(cookieConfig);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about missing sameSite protection', () => {
      const cookieConfig = {
        secure: true,
        httpOnly: true,
        signed: true,
      };

      const result = validateCSRFProtection(cookieConfig);

      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain(
        'SameSite attribute not set or set to "none" - primary CSRF protection missing'
      );
    });

    it('should warn about sameSite none', () => {
      const cookieConfig = {
        sameSite: 'none',
        secure: true,
        httpOnly: true,
        signed: true,
      };

      const result = validateCSRFProtection(cookieConfig);

      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain(
        'SameSite attribute not set or set to "none" - primary CSRF protection missing'
      );
    });

    it('should warn about missing secure flag in production', () => {
      process.env.NODE_ENV = 'production';
      const cookieConfig = {
        sameSite: 'strict',
        secure: false, // This should trigger warning in production
        httpOnly: true,
        signed: true,
      };

      const result = validateCSRFProtection(cookieConfig);

      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain(
        'Secure flag not set in production - cookies may be sent over HTTP'
      );
    });

    it('should warn about missing httpOnly flag', () => {
      const cookieConfig = {
        sameSite: 'strict',
        secure: true,
        httpOnly: false, // This should trigger warning
        signed: true,
      };

      const result = validateCSRFProtection(cookieConfig);

      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain(
        'HttpOnly flag not set - cookies vulnerable to XSS attacks'
      );
    });

    it('should recommend strict sameSite in production', () => {
      process.env.NODE_ENV = 'production';
      const cookieConfig = {
        sameSite: 'lax', // Should recommend strict in production
        secure: true,
        httpOnly: true,
        signed: true,
      };

      const result = validateCSRFProtection(cookieConfig);

      expect(result.isValid).toBe(true);
      expect(result.recommendations).toContain(
        'Consider using "strict" SameSite in production for maximum CSRF protection'
      );
    });

    it('should recommend cookie signing', () => {
      const cookieConfig = {
        sameSite: 'strict',
        secure: true,
        httpOnly: true,
        signed: false, // Should recommend signing
      };

      const result = validateCSRFProtection(cookieConfig);

      expect(result.recommendations).toContain(
        'Consider enabling cookie signing for integrity protection'
      );
    });

    it('should recommend domain restriction in production', () => {
      process.env.NODE_ENV = 'production';
      const cookieConfig = {
        sameSite: 'strict',
        secure: true,
        httpOnly: true,
        signed: true,
        // domain not set - should trigger recommendation
      };

      const result = validateCSRFProtection(cookieConfig);

      expect(result.recommendations).toContain(
        'Consider setting cookie domain restriction in production'
      );
    });
  });

  describe('generateCSRFProtectionReport', () => {
    it('should generate comprehensive security report', () => {
      const report = generateCSRFProtectionReport(mockConfig);

      expect(report).toContain('CSRF Protection Analysis Report');
      expect(report).toContain('Current Configuration:');
      expect(report).toContain('Security Status:');
      expect(report).toContain('CSRF Protection Strategy:');
      expect(report).toContain('SameSite Cookies (Primary Defense)');
      expect(report).toContain('Additional Considerations:');
    });

    it('should include configuration values in report', () => {
      const report = generateCSRFProtectionReport(mockConfig);

      expect(report).toContain('SameSite: lax');
      expect(report).toContain('Secure: false');
      expect(report).toContain('HttpOnly: true');
      expect(report).toContain('Signed: true');
      expect(report).toContain('Domain: .example.com');
      expect(report).toContain('Path: /api');
    });

    it('should show secure status for valid configuration', () => {
      const report = generateCSRFProtectionReport(mockConfig);

      expect(report).toContain('✓ SECURE');
    });

    it('should include warning sections in report structure', () => {
      const report = generateCSRFProtectionReport(mockConfig);

      // Verify the report structure includes all necessary sections
      expect(report).toContain('Current Configuration:');
      expect(report).toContain('Security Status:');
      expect(report).toContain('CSRF Protection Strategy:');
      expect(report).toContain('Additional Considerations:');

      // The validation logic is already tested in individual validateCSRFProtection tests
      // This test just ensures the report generation works correctly
    });
  });

  describe('CSRFProtectionLevel enum', () => {
    it('should define protection levels', () => {
      expect(CSRFProtectionLevel.STRICT).toBe('strict');
      expect(CSRFProtectionLevel.LAX).toBe('lax');
      expect(CSRFProtectionLevel.DISABLED).toBe('none');
    });
  });
});

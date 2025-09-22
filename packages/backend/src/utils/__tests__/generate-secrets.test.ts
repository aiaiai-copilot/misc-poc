import {
  generateSecureSecret,
  generateDatabasePassword,
  generateJWTSecret,
  generateEnvTemplate,
} from '../generate-secrets';

describe('Secret Generation Utilities', () => {
  describe('generateSecureSecret', () => {
    test('should generate secret of specified length', () => {
      const secret = generateSecureSecret(32);
      expect(secret).toHaveLength(32);
    });

    test('should generate different secrets on each call', () => {
      const secret1 = generateSecureSecret(32);
      const secret2 = generateSecureSecret(32);
      expect(secret1).not.toBe(secret2);
    });

    test('should use only characters from provided charset', () => {
      const charset = 'ABC123';
      const secret = generateSecureSecret(100, charset);

      for (const char of secret) {
        expect(charset).toContain(char);
      }
    });

    test('should generate default length of 64 characters', () => {
      const secret = generateSecureSecret();
      expect(secret).toHaveLength(64);
    });
  });

  describe('generateDatabasePassword', () => {
    test('should generate alphanumeric password', () => {
      const password = generateDatabasePassword();
      expect(password).toMatch(/^[A-Za-z0-9]+$/);
    });

    test('should generate password of specified length', () => {
      const password = generateDatabasePassword(16);
      expect(password).toHaveLength(16);
    });

    test('should generate default length of 32 characters', () => {
      const password = generateDatabasePassword();
      expect(password).toHaveLength(32);
    });
  });

  describe('generateJWTSecret', () => {
    test('should generate JWT secret with special characters', () => {
      const secret = generateJWTSecret();
      expect(secret).toHaveLength(64);
      expect(typeof secret).toBe('string');
    });

    test('should generate secret of specified length', () => {
      const secret = generateJWTSecret(128);
      expect(secret).toHaveLength(128);
    });
  });

  describe('generateEnvTemplate', () => {
    test('should generate complete .env template with defaults', () => {
      const template = generateEnvTemplate();

      expect(template).toContain('NODE_ENV="development"');
      expect(template).toContain('PORT=3000');
      expect(template).toContain('HOST="localhost"');
      expect(template).toContain('POSTGRES_DB="misc_poc_dev"');
      expect(template).toContain('POSTGRES_USER="postgres"');
      expect(template).toContain('POSTGRES_PASSWORD=');
      expect(template).toContain('DATABASE_URL="postgresql://');
      expect(template).toContain('JWT_SECRET=');
      expect(template).toContain('JWT_REFRESH_SECRET=');
    });

    test('should use custom options', () => {
      const options = {
        nodeEnv: 'production',
        port: 8080,
        host: '0.0.0.0',
        databaseName: 'app_prod',
        databaseUser: 'app_user',
      };

      const template = generateEnvTemplate(options);

      expect(template).toContain('NODE_ENV="production"');
      expect(template).toContain('PORT=8080');
      expect(template).toContain('HOST="0.0.0.0"');
      expect(template).toContain('POSTGRES_DB="app_prod"');
      expect(template).toContain('POSTGRES_USER="app_user"');
      expect(template).toContain('DATABASE_URL="postgresql://app_user:');
      expect(template).toContain('@localhost:5432/app_prod"');
      expect(template).toContain(
        'GOOGLE_REDIRECT_URI="http://localhost:8080/auth/google/callback"'
      );
    });

    test('should generate unique passwords and secrets', () => {
      const template1 = generateEnvTemplate();
      const template2 = generateEnvTemplate();

      // Extract passwords/secrets using regex
      const extractSecret = (template: string, key: string): string | null => {
        const match = template.match(new RegExp(`${key}="([^"]+)"`));
        return match ? match[1] : null;
      };

      const password1 = extractSecret(template1, 'POSTGRES_PASSWORD');
      const password2 = extractSecret(template2, 'POSTGRES_PASSWORD');
      const jwt1 = extractSecret(template1, 'JWT_SECRET');
      const jwt2 = extractSecret(template2, 'JWT_SECRET');

      expect(password1).not.toBe(password2);
      expect(jwt1).not.toBe(jwt2);
      expect(password1).toHaveLength(32);
      expect(jwt1).toHaveLength(64);
    });

    test('should include all required environment sections', () => {
      const template = generateEnvTemplate();

      expect(template).toContain('# Environment Configuration');
      expect(template).toContain('# PostgreSQL Database Configuration');
      expect(template).toContain('# Database Connection Pool Settings');
      expect(template).toContain('# JWT Authentication Configuration');
      expect(template).toContain('# Google OAuth Configuration');
    });
  });
});

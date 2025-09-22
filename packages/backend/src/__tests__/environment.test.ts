import * as fs from 'fs';
import * as path from 'path';

describe('Environment Variables Configuration', () => {
  const projectRoot = path.join(__dirname, '../../../..');
  const envExamplePath = path.join(projectRoot, '.env.example');
  const gitignorePath = path.join(projectRoot, '.gitignore');

  test('should have .env.example file in project root', () => {
    expect(fs.existsSync(envExamplePath)).toBe(true);
  });

  test('should include PostgreSQL environment variables in .env.example', () => {
    const envExample = fs.readFileSync(envExamplePath, 'utf8');

    // Check for PostgreSQL database variables
    expect(envExample).toMatch(/POSTGRES_DB/);
    expect(envExample).toMatch(/POSTGRES_USER/);
    expect(envExample).toMatch(/POSTGRES_PASSWORD/);
    expect(envExample).toMatch(/DATABASE_URL/);
  });

  test('should include database connection pool settings in .env.example', () => {
    const envExample = fs.readFileSync(envExamplePath, 'utf8');

    // Check for connection pool configuration
    expect(envExample).toMatch(/DB_POOL_MIN/);
    expect(envExample).toMatch(/DB_POOL_MAX/);
    expect(envExample).toMatch(/DB_CONNECTION_TIMEOUT/);
  });

  test('should ensure .env is properly gitignored', () => {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');

    // Check that .env is gitignored but .env.example is not
    expect(gitignore).toMatch(/^\.env$/m);
    expect(gitignore).not.toMatch(/\.env\.example/);
  });

  test('should have secure default values in .env.example', () => {
    const envExample = fs.readFileSync(envExamplePath, 'utf8');

    // Ensure no actual secrets are in the example file
    expect(envExample).not.toMatch(/password123/i);
    expect(envExample).not.toMatch(/admin123/i);
    expect(envExample).not.toMatch(/secret123/i);

    // Check for placeholder patterns
    expect(envExample).toMatch(/your_.*_here|example_.*|change_me/i);

    // Ensure JWT secrets are placeholders not actual values
    expect(envExample).toMatch(
      /JWT_SECRET="your_super_secret_jwt_key_change_me"/
    );
    expect(envExample).toMatch(
      /JWT_REFRESH_SECRET="your_refresh_secret_change_me"/
    );
  });

  test('should include JWT configuration variables', () => {
    const envExample = fs.readFileSync(envExamplePath, 'utf8');

    expect(envExample).toMatch(/JWT_SECRET/);
    expect(envExample).toMatch(/JWT_EXPIRES_IN/);
    expect(envExample).toMatch(/JWT_REFRESH_SECRET/);
    expect(envExample).toMatch(/JWT_REFRESH_EXPIRES_IN/);
  });

  test('should include environment-specific variables', () => {
    const envExample = fs.readFileSync(envExamplePath, 'utf8');

    expect(envExample).toMatch(/NODE_ENV/);
    expect(envExample).toMatch(/PORT/);
    expect(envExample).toMatch(/HOST/);
  });

  test('should have proper variable documentation format', () => {
    const envExample = fs.readFileSync(envExamplePath, 'utf8');
    const lines = envExample.split('\n');

    // Check for comments explaining variables
    const hasComments = lines.some((line) => line.trim().startsWith('#'));
    expect(hasComments).toBe(true);

    // Check for grouped sections (PostgreSQL, JWT, etc.)
    expect(envExample).toMatch(/#.*PostgreSQL|#.*Database/i);
    expect(envExample).toMatch(/#.*JWT|#.*Authentication/i);
  });
});

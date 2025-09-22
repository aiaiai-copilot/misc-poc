import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

describe('Docker Compose Test Configuration', () => {
  const dockerComposeTestPath = path.join(
    __dirname,
    '../../../../docker-compose.test.yml'
  );

  beforeAll(() => {
    // Ensure docker-compose.test.yml exists
    expect(fs.existsSync(dockerComposeTestPath)).toBe(true);
  });

  test('should have valid YAML syntax', () => {
    const content = fs.readFileSync(dockerComposeTestPath, 'utf8');
    expect(() => yaml.load(content)).not.toThrow();
  });

  test('should contain PostgreSQL test service with required configuration', () => {
    const content = fs.readFileSync(dockerComposeTestPath, 'utf8');
    const config = yaml.load(content) as any;

    // Check service exists
    expect(config.services).toBeDefined();
    expect(config.services['postgres-test']).toBeDefined();

    const postgresTest = config.services['postgres-test'];

    // Check image
    expect(postgresTest.image).toBe('postgres:15');

    // Check container name
    expect(postgresTest.container_name).toBe('misc-poc-postgres-test');

    // Check restart policy (should be "no" for tests)
    expect(postgresTest.restart).toBe('no');

    // Check port mapping (different from dev)
    expect(postgresTest.ports).toContain('5433:5432');

    // Check test environment variables
    expect(postgresTest.environment).toBeDefined();
    expect(postgresTest.environment.POSTGRES_DB).toBeDefined();
    expect(postgresTest.environment.POSTGRES_USER).toBeDefined();
    expect(postgresTest.environment.POSTGRES_PASSWORD).toBeDefined();

    // Check test-specific optimizations
    expect(postgresTest.environment.POSTGRES_FSYNC).toBe('off');
    expect(postgresTest.environment.POSTGRES_SYNCHRONOUS_COMMIT).toBe('off');
    expect(postgresTest.environment.POSTGRES_FULL_PAGE_WRITES).toBe('off');

    // Check volumes
    expect(postgresTest.volumes).toBeDefined();
    expect(postgresTest.volumes).toContain(
      'postgres_test_data:/var/lib/postgresql/data'
    );

    // Check networks
    expect(postgresTest.networks).toBeDefined();
    expect(postgresTest.networks).toContain('misc-poc-test-network');

    // Check health check (faster for tests)
    expect(postgresTest.healthcheck).toBeDefined();
    expect(postgresTest.healthcheck.test).toBeDefined();
    expect(postgresTest.healthcheck.interval).toBe('5s');
    expect(postgresTest.healthcheck.timeout).toBe('3s');
    expect(postgresTest.healthcheck.retries).toBe(3);
    expect(postgresTest.healthcheck.start_period).toBe('10s');
  });

  test('should define test volumes with tmpfs for performance', () => {
    const content = fs.readFileSync(dockerComposeTestPath, 'utf8');
    const config = yaml.load(content) as any;

    expect(config.volumes).toBeDefined();
    expect(config.volumes.postgres_test_data).toBeDefined();
    expect(config.volumes.postgres_test_data.driver).toBe('local');

    // Check tmpfs configuration for test performance
    expect(config.volumes.postgres_test_data.driver_opts).toBeDefined();
    expect(config.volumes.postgres_test_data.driver_opts.type).toBe('tmpfs');
  });

  test('should define test network with different subnet', () => {
    const content = fs.readFileSync(dockerComposeTestPath, 'utf8');
    const config = yaml.load(content) as any;

    expect(config.networks).toBeDefined();
    expect(config.networks['misc-poc-test-network']).toBeDefined();
    expect(config.networks['misc-poc-test-network'].driver).toBe('bridge');

    // Check different subnet from development
    expect(config.networks['misc-poc-test-network'].ipam).toBeDefined();
    expect(config.networks['misc-poc-test-network'].ipam.config).toBeDefined();
    expect(config.networks['misc-poc-test-network'].ipam.config[0].subnet).toBe(
      '172.21.0.0/16'
    );
    expect(
      config.networks['misc-poc-test-network'].ipam.config[0].gateway
    ).toBe('172.21.0.1');
  });

  test('should have performance optimizations for fast testing', () => {
    const content = fs.readFileSync(dockerComposeTestPath, 'utf8');
    const config = yaml.load(content) as any;

    const postgresTest = config.services['postgres-test'];

    // Check performance settings in environment
    expect(postgresTest.environment.POSTGRES_SHARED_BUFFERS).toBe('128MB');
    expect(postgresTest.environment.POSTGRES_MAX_CONNECTIONS).toBe(20);
    expect(postgresTest.environment.POSTGRES_EFFECTIVE_CACHE_SIZE).toBe(
      '256MB'
    );

    // Check fast startup command settings
    expect(postgresTest.command).toBeDefined();
    expect(postgresTest.command).toContain('fsync=off');
    expect(postgresTest.command).toContain('synchronous_commit=off');
    expect(postgresTest.command).toContain('log_statement=none');
  });

  test('should validate with docker compose config', () => {
    // This test requires Docker to be installed and running
    // Skip if Docker is not available
    try {
      execSync('docker --version', { stdio: 'ignore' });
      // Try newer 'docker compose' command first, fall back to 'docker-compose'
      try {
        execSync('docker compose version', { stdio: 'ignore' });
      } catch {
        execSync('docker-compose --version', { stdio: 'ignore' });
      }
    } catch (error) {
      console.warn(
        'Docker or docker compose not available, skipping validation test'
      );
      return;
    }

    const projectRoot = path.join(__dirname, '../../../..');

    expect(() => {
      try {
        // Try newer 'docker compose' command first
        execSync('docker compose -f docker-compose.test.yml config', {
          cwd: projectRoot,
          stdio: 'ignore',
        });
      } catch {
        // Fall back to older 'docker-compose' command
        execSync('docker-compose -f docker-compose.test.yml config', {
          cwd: projectRoot,
          stdio: 'ignore',
        });
      }
    }).not.toThrow();
  });

  test('should have test initialization scripts directory', () => {
    const testInitDbPath = path.join(
      __dirname,
      '../../../../scripts/test-init-db'
    );
    expect(fs.existsSync(testInitDbPath)).toBe(true);

    const initScriptPath = path.join(testInitDbPath, '01-init-test-db.sql');
    expect(fs.existsSync(initScriptPath)).toBe(true);
  });

  test('should have test cleanup and management scripts', () => {
    const testCleanupPath = path.join(
      __dirname,
      '../../../../scripts/test-db-cleanup.sql'
    );
    expect(fs.existsSync(testCleanupPath)).toBe(true);

    const testSetupPath = path.join(
      __dirname,
      '../../../../scripts/test-db-setup.sh'
    );
    expect(fs.existsSync(testSetupPath)).toBe(true);

    // Check if script is executable (cross-platform)
    const stats = fs.statSync(testSetupPath);

    // On Windows, all files are considered executable if they exist
    // On Unix systems, check actual execute permissions
    if (process.platform === 'win32') {
      // On Windows, just verify the file exists and has content
      expect(stats.size).toBeGreaterThan(0);
    } else {
      // On Unix systems, check execute permissions
      expect(stats.mode & parseInt('111', 8)).toBeTruthy();
    }
  });
});

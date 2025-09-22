import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

describe('Docker Compose Configuration', () => {
  const dockerComposePath = path.join(
    __dirname,
    '../../../../docker-compose.yml'
  );

  beforeAll(() => {
    // Ensure docker-compose.yml exists
    expect(fs.existsSync(dockerComposePath)).toBe(true);
  });

  test('should have valid YAML syntax', () => {
    const content = fs.readFileSync(dockerComposePath, 'utf8');
    expect(() => yaml.load(content)).not.toThrow();
  });

  test('should contain PostgreSQL service with required configuration', () => {
    const content = fs.readFileSync(dockerComposePath, 'utf8');
    const config = yaml.load(content) as any;

    // Check service exists
    expect(config.services).toBeDefined();
    expect(config.services.postgres).toBeDefined();

    const postgres = config.services.postgres;

    // Check image
    expect(postgres.image).toBe('postgres:15');

    // Check container name
    expect(postgres.container_name).toBe('misc-poc-postgres');

    // Check restart policy
    expect(postgres.restart).toBe('unless-stopped');

    // Check port mapping
    expect(postgres.ports).toContain('5432:5432');

    // Check environment variables
    expect(postgres.environment).toBeDefined();
    expect(postgres.environment.POSTGRES_DB).toBeDefined();
    expect(postgres.environment.POSTGRES_USER).toBeDefined();
    expect(postgres.environment.POSTGRES_PASSWORD).toBeDefined();

    // Check volumes
    expect(postgres.volumes).toBeDefined();
    expect(postgres.volumes).toContain(
      'postgres_data:/var/lib/postgresql/data'
    );

    // Check networks
    expect(postgres.networks).toContain('misc-poc-network');

    // Check health check
    expect(postgres.healthcheck).toBeDefined();
    expect(postgres.healthcheck.test).toBeDefined();
    expect(postgres.healthcheck.interval).toBe('10s');
    expect(postgres.healthcheck.timeout).toBe('5s');
    expect(postgres.healthcheck.retries).toBe(5);
    expect(postgres.healthcheck.start_period).toBe('30s');
  });

  test('should define required volumes', () => {
    const content = fs.readFileSync(dockerComposePath, 'utf8');
    const config = yaml.load(content) as any;

    expect(config.volumes).toBeDefined();
    expect(config.volumes.postgres_data).toBeDefined();
    expect(config.volumes.postgres_data.driver).toBe('local');
  });

  test('should define required networks', () => {
    const content = fs.readFileSync(dockerComposePath, 'utf8');
    const config = yaml.load(content) as any;

    expect(config.networks).toBeDefined();
    expect(config.networks['misc-poc-network']).toBeDefined();
    expect(config.networks['misc-poc-network'].driver).toBe('bridge');
  });

  test('should have performance and development settings', () => {
    const content = fs.readFileSync(dockerComposePath, 'utf8');
    const config = yaml.load(content) as any;

    const postgres = config.services.postgres;

    // Check performance settings in environment
    expect(postgres.environment.POSTGRES_SHARED_PRELOAD_LIBRARIES).toBe(
      'pg_stat_statements'
    );
    expect(postgres.environment.POSTGRES_MAX_CONNECTIONS).toBe(100);
    expect(postgres.environment.POSTGRES_SHARED_BUFFERS).toBe('256MB');
    expect(postgres.environment.POSTGRES_EFFECTIVE_CACHE_SIZE).toBe('1GB');

    // Check development command settings
    expect(postgres.command).toBeDefined();
    expect(postgres.command).toContain('log_statement=all');
    expect(postgres.command).toContain('log_connections=on');
  });

  test('should validate with docker-compose config', () => {
    // This test requires Docker to be installed and running
    // Skip if Docker is not available
    try {
      execSync('docker --version', { stdio: 'ignore' });
      execSync('docker-compose --version', { stdio: 'ignore' });
    } catch (error) {
      console.warn(
        'Docker or docker-compose not available, skipping validation test'
      );
      return;
    }

    const projectRoot = path.join(__dirname, '../../../..');

    expect(() => {
      execSync('docker-compose config', {
        cwd: projectRoot,
        stdio: 'ignore',
      });
    }).not.toThrow();
  });
});

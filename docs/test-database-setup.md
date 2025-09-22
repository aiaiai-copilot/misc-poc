# Test Database Setup

This document describes the test database configuration for the misc-poc project.

## Overview

The project includes a separate PostgreSQL test database configuration designed for:

- **Isolation**: Complete separation from development data
- **Performance**: Optimized for fast test execution
- **CI/CD**: Quick startup and teardown for automated testing
- **Data Safety**: Automatic cleanup between test runs

## Configuration Files

### docker-compose.test.yml

Main test database configuration with:

- **Service**: `postgres-test` running on port 5433
- **Network**: Isolated test network (172.21.0.0/16)
- **Volumes**: tmpfs for maximum performance
- **Optimizations**: Disabled fsync, reduced logging, smaller buffers

### Environment Variables

Add to your `.env` file:

```bash
# Test Database Configuration
POSTGRES_TEST_DB="misc_poc_test"
POSTGRES_TEST_USER="postgres_test"
POSTGRES_TEST_PASSWORD="test_password"
TEST_DATABASE_URL="postgresql://postgres_test:test_password@localhost:5433/misc_poc_test"
```

## Usage

### NPM Scripts

```bash
# Start test database
yarn db:test:start

# Stop and cleanup test database
yarn db:test:stop

# Restart test database
yarn db:test:restart

# Reset test data (cleanup between test runs)
yarn db:test:reset

# Check test database status
yarn db:test:status
```

### Manual Script Usage

```bash
# Direct script usage
./scripts/test-db-setup.sh start
./scripts/test-db-setup.sh stop
./scripts/test-db-setup.sh reset
./scripts/test-db-setup.sh status

# Run custom SQL against test database
./scripts/test-db-setup.sh sql scripts/custom-test-script.sql
```

## Test Database Features

### Performance Optimizations

- **tmpfs volumes**: Data stored in memory for maximum speed
- **Disabled fsync**: No disk synchronization for faster writes
- **Reduced logging**: Minimal logging to improve performance
- **Smaller buffers**: Optimized memory usage for testing
- **Fast health checks**: 5-second intervals vs 10 seconds for development

### Security & Isolation

- **Separate network**: 172.21.0.0/16 subnet (vs 172.20.0.0/16 for dev)
- **Different port**: 5433 (vs 5432 for development)
- **No restart policy**: Containers don't restart automatically
- **Isolated credentials**: Separate test user and database

### Data Management

- **Automatic cleanup**: tmpfs volumes are automatically cleaned on container stop
- **Test schema**: Dedicated `test_schema` for organized test data
- **Cleanup procedures**: SQL scripts for resetting test data between runs
- **Fast initialization**: Optimized startup for CI/CD environments

## File Structure

```
scripts/
├── test-init-db/
│   └── 01-init-test-db.sql    # Test database initialization
├── test-db-cleanup.sql        # Data cleanup procedures
└── test-db-setup.sh          # Database management script

docker-compose.test.yml        # Test database configuration
```

## Initialization Scripts

### 01-init-test-db.sql

- Creates `test_schema` for organized test data
- Sets up test-specific database configuration
- Configures performance optimizations
- Creates test user roles and permissions

### test-db-cleanup.sql

- Truncates all tables in `test_schema`
- Resets sequences to start values
- Performs VACUUM ANALYZE for performance
- Provides clean state between test runs

## CI/CD Integration

The test database is optimized for CI/CD environments:

1. **Fast Startup**: Typically ready in 10-15 seconds
2. **Memory Storage**: No disk I/O for maximum speed
3. **Auto Cleanup**: Containers and data are automatically removed
4. **Health Checks**: Fast readiness detection for test execution

### Example CI Workflow

```yaml
- name: Start Test Database
  run: yarn db:test:start

- name: Wait for Database
  run: yarn db:test:status

- name: Run Tests
  run: yarn test

- name: Cleanup
  run: yarn db:test:stop
  if: always()
```

## Development Workflow

### Before Running Tests

```bash
# Start test database
yarn db:test:start

# Verify it's running
yarn db:test:status
```

### Between Test Runs

```bash
# Reset test data
yarn db:test:reset
```

### After Testing

```bash
# Stop and cleanup
yarn db:test:stop
```

## Troubleshooting

### Database Won't Start

1. Check if port 5433 is available
2. Ensure Docker is running
3. Check for existing containers: `docker ps -a`
4. Remove old containers: `yarn db:test:stop`

### Connection Issues

1. Verify database is running: `yarn db:test:status`
2. Check environment variables in `.env`
3. Ensure correct port (5433) in connection string
4. Wait for health check to pass

### Performance Issues

1. Ensure tmpfs is being used for volumes
2. Check available system memory
3. Verify performance optimizations are active
4. Monitor Docker resource usage

## Best Practices

1. **Always use test database for tests**: Never run tests against development database
2. **Reset between test suites**: Use `yarn db:test:reset` for clean state
3. **Use transactions in tests**: Wrap test cases in transactions for isolation
4. **Monitor resource usage**: tmpfs uses system RAM
5. **Clean up after CI**: Always stop test database in CI cleanup steps

## Configuration Comparison

| Feature      | Development    | Test                |
| ------------ | -------------- | ------------------- |
| Port         | 5432           | 5433                |
| Network      | 172.20.0.0/16  | 172.21.0.0/16       |
| Storage      | Bind mount     | tmpfs (memory)      |
| Restart      | unless-stopped | no                  |
| Logging      | Full           | Minimal             |
| Performance  | Balanced       | Optimized for speed |
| Fsync        | Enabled        | Disabled            |
| Health Check | 10s intervals  | 5s intervals        |

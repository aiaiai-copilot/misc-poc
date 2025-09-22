# PostgreSQL Database Setup Guide

This guide covers the complete PostgreSQL database setup using Docker Compose for the misc-poc project.

## 📋 Quick Start

```bash
# Start the database
docker-compose up -d postgres

# Wait for initialization to complete
./scripts/wait-for-db.sh

# Verify setup
docker-compose exec postgres psql -U postgres -d misc_poc_dev -c "SELECT 'Database ready!' AS status;"
```

## 🏗️ Architecture Overview

### Services

- **postgres**: Main development database (PostgreSQL 15)
- **postgres-test**: Isolated test database (PostgreSQL 15)

### Key Features

- ✅ Automatic initialization scripts
- ✅ Data persistence with Docker volumes
- ✅ Health checks and connection validation
- ✅ Separate test database configuration
- ✅ Security-hardened permissions
- ✅ Backup and restore capabilities
- ✅ Database reset functionality

## 🚀 Getting Started

### Prerequisites

- Docker and Docker Compose
- `.env` file with database configuration (see `.env.example`)

### Initial Setup

1. **Copy environment configuration:**

   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   ```

2. **Start the database:**

   ```bash
   docker-compose up -d postgres
   ```

3. **Verify initialization:**
   ```bash
   ./scripts/wait-for-db.sh
   ./scripts/db-health-check.sh
   ```

## 📁 Directory Structure

```
scripts/
├── init-db/                    # Main database initialization scripts
│   ├── 01-init-main-db.sql    # Schema and extensions setup
│   └── 02-permissions.sql     # User roles and permissions
├── test-init-db/              # Test database initialization scripts
│   └── 01-init-test-db.sql    # Test-specific configuration
├── db-backup.sh               # Backup and restore script
├── db-reset.sh                # Database reset script
├── db-health-check.sh         # Health check script
└── wait-for-db.sh             # Connection wait script

data/
├── postgres/                  # Main database data (persisted)
└── backups/                   # Database backups
```

## 🔧 Configuration

### Environment Variables

| Variable               | Default           | Description           |
| ---------------------- | ----------------- | --------------------- |
| `POSTGRES_DB`          | `misc_poc_dev`    | Main database name    |
| `POSTGRES_USER`        | `postgres`        | Database superuser    |
| `POSTGRES_PASSWORD`    | `postgres`        | Database password     |
| `POSTGRES_DATA_PATH`   | `./data/postgres` | Data directory path   |
| `POSTGRES_BACKUP_PATH` | `./data/backups`  | Backup directory path |

### Test Database Variables

| Variable                 | Default         | Description            |
| ------------------------ | --------------- | ---------------------- |
| `POSTGRES_TEST_DB`       | `misc_poc_test` | Test database name     |
| `POSTGRES_TEST_USER`     | `postgres_test` | Test database user     |
| `POSTGRES_TEST_PASSWORD` | `test_password` | Test database password |

## 🗄️ Database Schema

### Initialization Process

1. **01-init-main-db.sql**: Creates the main application schema
   - Creates `app` schema for application data
   - Installs extensions (`uuid-ossp`, `pg_stat_statements`)
   - Creates `app_user` role for application connections
   - Sets up audit logging table
   - Configures development-optimized settings

2. **02-permissions.sql**: Configures security and permissions
   - Sets up role-based access control
   - Creates read-only user for reporting
   - Configures default privileges
   - Implements security best practices

### Database Users

- **postgres**: Superuser (for administration)
- **app_user**: Application user (limited permissions)
- **read_only_user**: Read-only access (for reporting/analytics)

## 🛠️ Management Scripts

### Health Checks

```bash
# Check database health
./scripts/db-health-check.sh

# Wait for database to be ready
./scripts/wait-for-db.sh
```

### Backup and Restore

```bash
# Create backup
./scripts/db-backup.sh

# Create compressed backup
./scripts/db-backup.sh backup --compress

# List existing backups
./scripts/db-backup.sh list

# Restore from backup
./scripts/db-backup.sh restore backup_misc_poc_dev_20241022_143022.sql
```

### Database Reset

```bash
# Reset database to initial state (removes all data!)
./scripts/db-reset.sh
```

## 🧪 Testing

### Test Database

The test database is optimized for fast startup and execution:

```bash
# Start test database
docker-compose -f docker-compose.test.yml up -d postgres-test

# Run tests (example)
npm test

# Stop test database
docker-compose -f docker-compose.test.yml down
```

### Test Database Features

- Isolated from development data
- Optimized for speed (disabled fsync, etc.)
- Automatic cleanup between test runs
- Separate network and port (5433)

## 🔒 Security

### Security Features

- Non-root database user (postgres:999)
- Security options (`no-new-privileges`)
- Read-only filesystem where possible
- Network isolation
- Minimal privileges for application users

### Connection Security

- Limited connection pools
- Role-based access control
- Audit logging enabled
- Password-based authentication

## 📊 Monitoring and Logging

### Health Checks

- Container health checks via `pg_isready`
- Custom health check script
- Connection validation

### Logging

- SQL statement logging (development)
- Connection/disconnection logging
- Performance monitoring via `pg_stat_statements`

## 🚨 Troubleshooting

### Common Issues

**Database won't start:**

```bash
# Check logs
docker-compose logs postgres

# Verify permissions
ls -la data/postgres/

# Reset if needed
./scripts/db-reset.sh
```

**Connection refused:**

```bash
# Check if service is running
docker-compose ps postgres

# Test connection
docker-compose exec postgres pg_isready -U postgres
```

**Initialization scripts not running:**

```bash
# Scripts run only on first start or after data removal
docker-compose down -v  # Remove volumes
docker-compose up -d postgres
```

**Permission denied errors:**

```bash
# Check file permissions
ls -la scripts/
chmod +x scripts/*.sh
```

### Performance Issues

**Slow queries in development:**

```bash
# Check slow query log
docker-compose exec postgres psql -U postgres -d misc_poc_dev -c "
  SELECT query, mean_time, calls
  FROM pg_stat_statements
  ORDER BY mean_time DESC
  LIMIT 10;
"
```

**High memory usage:**

- Adjust `shared_buffers` and `effective_cache_size` in docker-compose.yml
- Monitor with `docker stats postgres`

## 🔄 Maintenance

### Regular Tasks

**Weekly:**

- Review database logs
- Check backup integrity
- Monitor disk usage

**Monthly:**

- Clean old backups (auto-cleanup after 7 days)
- Review user permissions
- Update PostgreSQL version if needed

### Backup Strategy

- Automatic cleanup after 7 days (configurable)
- Compressed backups available
- Full database dumps with schema and data
- Restore testing recommended

## 📚 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [pg_dump Documentation](https://www.postgresql.org/docs/current/app-pgdump.html)

## 🤝 Contributing

When modifying database setup:

1. Test changes with test database first
2. Update initialization scripts as needed
3. Document any new environment variables
4. Test backup/restore functionality
5. Update this documentation

---

For questions or issues, please refer to the main project README or create an issue in the project repository.

# MISC MVP Database Design

## Overview

This document describes the PostgreSQL database design for MISC MVP, transitioning from localStorage-based prototype to a multi-user server application. The design preserves all business logic from the prototype while adding user isolation and authentication.

## Core Principles

1. **Data Isolation** - Each user sees only their own records
2. **Performance** - Optimized for search operations on 10K+ records
3. **Simplicity** - Minimal schema matching MISC philosophy
4. **Migration Ready** - Easy import from prototype's localStorage format
5. **ACID Compliance** - Transactional integrity for multi-user operations

## Database Schema

### Users Table

```sql
-- Users table: Core user identity from Google OAuth
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  google_id VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
```

**Design Decisions:**
- UUID for future distributed system compatibility
- Google ID as unique identifier for OAuth
- Email for user identification and communication
- Timestamps in UTC with timezone for global usage

### Records Table

```sql
-- Records table: Core data entity
CREATE TABLE records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tags TEXT[] NOT NULL,
  normalized_tags TEXT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique content per user (based on normalized tags)
  UNIQUE(user_id, normalized_tags)
);

-- Performance indexes
CREATE INDEX idx_records_user_id ON records(user_id);
CREATE GIN INDEX idx_records_normalized_tags ON records USING GIN(normalized_tags);
CREATE INDEX idx_records_created_at ON records(created_at DESC);
CREATE INDEX idx_records_updated_at ON records(updated_at DESC);
```

**Design Decisions:**
- `content`: Original user input preserving tag order
- `tags[]`: Array of tags as entered by user
- `normalized_tags[]`: Lowercase, accent-removed tags for search
- GIN index for fast array contains operations
- Unique constraint on normalized tags prevents duplicates
- CASCADE DELETE for user data cleanup

### User Settings Table

```sql
-- User settings: Personalization and preferences
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  case_sensitive BOOLEAN DEFAULT FALSE,
  remove_accents BOOLEAN DEFAULT TRUE,
  max_tag_length INTEGER DEFAULT 100,
  max_tags_per_record INTEGER DEFAULT 50,
  ui_language VARCHAR(10) DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Design Decisions:**
- One-to-one with users table
- Defaults match prototype behavior
- Configurable normalization rules per user
- Extensible for future settings

### Sessions Table (Optional for JWT blacklist)

```sql
-- Sessions table: For JWT token management and revocation
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_jti VARCHAR(255) UNIQUE NOT NULL, -- JWT ID
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for token validation
CREATE INDEX idx_sessions_token_jti ON sessions(token_jti);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Cleanup expired sessions periodically
CREATE INDEX idx_sessions_cleanup ON sessions(expires_at) 
  WHERE revoked_at IS NULL;
```

## Index Strategy

### Primary Indexes

| Index | Table | Purpose | Type |
|-------|-------|---------|------|
| `idx_records_normalized_tags` | records | Tag-based search | GIN |
| `idx_records_user_id` | records | User data isolation | B-tree |
| `idx_records_created_at` | records | Sorting by date | B-tree |

### Why GIN Index?

```sql
-- GIN (Generalized Inverted Index) is optimal for array contains queries
-- Example query that benefits from GIN:
SELECT * FROM records 
WHERE user_id = $1 
  AND normalized_tags @> ARRAY['todo', 'meeting']  -- Contains all tags
ORDER BY created_at DESC;
```

**Performance characteristics:**
- Search 10K records: <200ms with GIN index
- Without GIN: >2s (sequential scan)
- Index size: ~30% of table size (acceptable trade-off)

## Query Patterns

### Search Records (AND logic)

```sql
-- Find records containing ALL specified tags
WITH search_tags AS (
  SELECT ARRAY['todo', 'meeting', 'important'] AS tags
)
SELECT 
  id,
  content,
  tags,
  created_at,
  updated_at
FROM records
WHERE 
  user_id = $1
  AND normalized_tags @> (SELECT tags FROM search_tags)
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;
```

### Tag Statistics

```sql
-- Get tag frequency for tag cloud
SELECT 
  unnest(normalized_tags) AS tag,
  COUNT(*) as frequency
FROM records
WHERE user_id = $1
GROUP BY tag
ORDER BY frequency DESC
LIMIT 100;
```

### Duplicate Detection

```sql
-- Check for duplicate before insert
SELECT EXISTS (
  SELECT 1 FROM records
  WHERE user_id = $1
    AND normalized_tags = $2::text[]
    AND ($3::uuid IS NULL OR id != $3)  -- Exclude self for updates
) AS is_duplicate;
```

## Migration Strategy

### TypeORM Configuration

```typescript
// ormconfig.ts
export default {
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER || "misc",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "misc",
  
  // Migration settings
  migrations: ["src/migrations/*.ts"],
  migrationsTableName: "schema_migrations",
  migrationsTransactionMode: "each",
  
  // Safety settings
  synchronize: false,  // Never auto-sync in production
  logging: ["error", "warn", "migration"],
  
  // Connection pool
  extra: {
    max: 20,                 // Max connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }
};
```

### Migration Files

```typescript
// 1704067200000-CreateUsersTable.ts
export class CreateUsersTable1704067200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        google_id VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_login_at TIMESTAMP WITH TIME ZONE
      )
    `);
    
    // Add indexes
    await queryRunner.query(`CREATE INDEX idx_users_email ON users(email)`);
    await queryRunner.query(`CREATE INDEX idx_users_google_id ON users(google_id)`);
  }
  
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS users CASCADE`);
  }
}
```

### Data Import from Prototype

```sql
-- Import process for user's JSON data
-- Step 1: Temporary import table
CREATE TEMP TABLE import_records (
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Step 2: Load JSON data (handled by application)
-- Step 3: Process and insert with tag extraction
INSERT INTO records (user_id, content, tags, normalized_tags, created_at, updated_at)
SELECT 
  $1 as user_id,  -- Current user's ID
  content,
  string_to_array(content, ' ') as tags,
  string_to_array(lower(unaccent(content)), ' ') as normalized_tags,
  created_at,
  updated_at
FROM import_records
ON CONFLICT (user_id, normalized_tags) 
DO NOTHING;  -- Skip duplicates

-- Step 4: Return import statistics
SELECT 
  COUNT(*) FILTER (WHERE true) as total,
  COUNT(*) FILTER (WHERE id IS NOT NULL) as imported,
  COUNT(*) FILTER (WHERE id IS NULL) as skipped
FROM import_records;
```

## Performance Optimization

### Connection Pooling

```javascript
// Database connection pool configuration
const poolConfig = {
  max: 20,                    // Maximum connections
  min: 5,                     // Minimum connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Timeout for new connections
  
  // Reuse prepared statements
  statement_timeout: 5000,    // 5s max query time
  query_timeout: 5000,
  
  // Health check
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
};
```

### Query Optimization Tips

1. **Always filter by user_id first** - Uses index, reduces dataset
2. **Use LIMIT/OFFSET** - Paginate large result sets
3. **Prepared statements** - Prevent SQL injection, improve performance
4. **Batch inserts** - Use single INSERT with multiple VALUES
5. **Vacuum regularly** - Maintain index efficiency

### Monitoring Queries

```sql
-- Find slow queries
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- Queries slower than 100ms
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan;
```

## Backup Strategy

### Automated Backups

```bash
# Daily backup script (cron)
#!/bin/bash
BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="misc"

# Create backup
pg_dump -h localhost -U misc -d $DB_NAME -Fc \
  -f "$BACKUP_DIR/misc_$DATE.dump"

# Keep only last 30 days
find $BACKUP_DIR -name "*.dump" -mtime +30 -delete

# Upload to S3 (optional)
aws s3 cp "$BACKUP_DIR/misc_$DATE.dump" \
  s3://misc-backups/daily/
```

### Restore Process

```bash
# Restore from backup
pg_restore -h localhost -U misc -d misc_restore \
  -j 4  # Parallel jobs
  -c    # Clean before restore
  /backups/postgres/misc_20250101_120000.dump
```

## Security Considerations

### SQL Injection Prevention

```typescript
// NEVER do this:
const query = `SELECT * FROM records WHERE content LIKE '%${userInput}%'`;

// ALWAYS use parameterized queries:
const query = `SELECT * FROM records WHERE user_id = $1 AND content LIKE $2`;
const params = [userId, `%${userInput}%`];
```

### Row Level Security (Optional Enhancement)

```sql
-- Enable RLS for additional security layer
ALTER TABLE records ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own records
CREATE POLICY user_records_policy ON records
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::UUID);

-- Set user context in application
SET LOCAL app.current_user_id = 'user-uuid-here';
```

## Monitoring and Maintenance

### Health Checks

```sql
-- Database health check endpoint query
SELECT 
  pg_database_size('misc') as db_size,
  (SELECT count(*) FROM users) as user_count,
  (SELECT count(*) FROM records) as record_count,
  (SELECT max(created_at) FROM records) as last_record,
  pg_postmaster_start_time() as server_start_time;
```

### Regular Maintenance Tasks

| Task | Frequency | Command |
|------|-----------|---------|
| VACUUM ANALYZE | Daily | `VACUUM ANALYZE records;` |
| REINDEX | Weekly | `REINDEX TABLE records;` |
| Update statistics | Daily | `ANALYZE records;` |
| Clear old sessions | Hourly | `DELETE FROM sessions WHERE expires_at < NOW();` |

## Future Considerations

### Scaling Options

1. **Read Replicas** - Separate search queries from writes
2. **Partitioning** - Partition records by user_id or date
3. **Caching Layer** - Redis for frequently accessed data
4. **Full-Text Search** - PostgreSQL FTS or Elasticsearch
5. **Time-Series** - TimescaleDB for activity tracking

### Schema Evolution

```sql
-- Future: Add full-text search
ALTER TABLE records ADD COLUMN tsv tsvector;
CREATE INDEX idx_records_tsv ON records USING GIN(tsv);

-- Future: Add soft delete
ALTER TABLE records 
  ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN version INTEGER DEFAULT 1;

-- Future: Add collaboration
CREATE TABLE shared_records (
  record_id UUID REFERENCES records(id),
  shared_with_user_id UUID REFERENCES users(id),
  permission VARCHAR(20) CHECK (permission IN ('read', 'write')),
  PRIMARY KEY (record_id, shared_with_user_id)
);
```

## References

- [PostgreSQL Arrays Documentation](https://www.postgresql.org/docs/15/arrays.html)
- [GIN Index Documentation](https://www.postgresql.org/docs/15/gin.html)
- [TypeORM Migrations Guide](https://typeorm.io/migrations)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
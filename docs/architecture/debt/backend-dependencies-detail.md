# Backend Package Dependencies - Detailed Analysis

## Overview

The **backend** package (`@misc-poc/backend`) is the Express.js API server that depends on three internal monorepo packages:

```
backend
├── @misc-poc/application
├── @misc-poc/domain
└── @misc-poc/infrastructure-cache
```

## Dependency Analysis

### 1. @misc-poc/domain

**Purpose**: Access to domain entities, value objects, and business rules

**Current Usage**:

- **Limited** - The backend currently does NOT import from domain directly in the main codebase
- This is expected as the backend follows Clean Architecture where infrastructure should depend on application layer contracts, not directly on domain

**Expected Future Usage**:

- Domain entities for type safety in API responses
- Value objects for validation
- Domain events for event-driven architecture

**Files**: Currently none (checked via grep - no imports found)

---

### 2. @misc-poc/application

**Purpose**: Access to use case interfaces, repository contracts, and application services

**Current Usage**:

- **Limited** - The backend currently does NOT import from application directly
- This suggests the backend might be implementing its own logic rather than using application use cases

**Expected Future Usage**:

- `IRecordRepository` - Repository interface for record operations
- `IUserRepository` - Repository interface for user operations
- Use case handlers (e.g., `CreateRecordUseCase`, `AuthenticateUserUseCase`)
- Application service interfaces

**Architecture Note**:
The backend SHOULD be using application layer use cases rather than implementing business logic directly. This is a potential architectural improvement area.

---

### 3. @misc-poc/infrastructure-cache

**Purpose**: Redis caching for API performance optimization

**Current Usage**: ✅ **Active**

#### Imports in `app.ts` (lines 12-15):

```typescript
import {
  RedisCacheService,
  getCacheConfig,
} from '@misc-poc/infrastructure-cache';
```

#### Usage Pattern:

**1. Cache Service Initialization** (lines 220-237):

```typescript
// Initialize cache service
let cacheService: RedisCacheService | null = null;
if (config?.cacheService) {
  cacheService = config.cacheService;
} else if (process.env.NODE_ENV !== 'test') {
  // Only initialize Redis cache in non-test environments
  try {
    const cacheConfig = getCacheConfig();
    cacheService = new RedisCacheService(cacheConfig);
    // Connect to Redis in background - don't block app startup
    cacheService.connect().catch((error: Error) => {
      console.warn('Failed to connect to Redis cache:', error);
      cacheService = null;
    });
  } catch (error) {
    console.warn('Failed to initialize cache service:', error);
  }
}
```

**2. Tag Statistics Caching** (lines 688-738):

```typescript
app.get('/api/tags', requireAuth, async (req: Request, res: Response) => {
  const user = req.user as { userId: string; email: string };

  // Try to get from cache first
  if (cacheService) {
    const cachedStats = await cacheService.getTagStatistics(user.userId);
    if (cachedStats !== null) {
      return res.json(cachedStats);
    }
  }

  // Query database...
  const tagStats = await dataSource.query(/* ... */);

  // Cache the result for next time
  if (cacheService) {
    await cacheService.setTagStatistics(user.userId, formattedTags);
  }

  res.json(formattedTags);
});
```

**3. Tag Suggestions Caching** (lines 741-841):

```typescript
app.get('/api/tags/suggest', requireAuth, async (req: Request, res: Response) => {
  const user = req.user as { userId: string; email: string };
  const query = req.query.q as string;
  const limit = /* ... */;

  // Try to get from cache first
  if (cacheService) {
    const cachedSuggestions = await cacheService.getTagSuggestions(
      user.userId,
      trimmedQuery,
      limit
    );
    if (cachedSuggestions !== null) {
      return res.json(cachedSuggestions);
    }
  }

  // Query database...
  const tagSuggestions = await dataSource.query(/* ... */);

  // Cache the result for next time
  if (cacheService) {
    await cacheService.setTagSuggestions(
      user.userId,
      trimmedQuery,
      limit,
      suggestions
    );
  }

  res.json(suggestions);
});
```

#### Cache Service Methods Used:

- `getTagStatistics(userId: string)` - Get cached tag frequency statistics
- `setTagStatistics(userId: string, stats: TagStats[])` - Cache tag statistics
- `getTagSuggestions(userId: string, query: string, limit: number)` - Get cached tag suggestions
- `setTagSuggestions(userId: string, query: string, limit: number, suggestions: string[])` - Cache suggestions

#### Caching Strategy:

- **Read-through caching**: Try cache first, fallback to database
- **Write-through caching**: Update cache after database query
- **User isolation**: Cache keys include userId for multi-tenancy
- **Graceful degradation**: App works even if Redis is unavailable

---

### 4. @misc-poc/shared (via streaming-import)

**Current Usage**: ✅ **Active**

#### Imports in API handlers:

```typescript
// packages/backend/src/api/streaming-import.ts
import { validateExportFormat } from '@misc-poc/shared';

// packages/backend/src/api/streaming-import-with-progress.ts
import { validateExportFormat } from '@misc-poc/shared';

// packages/backend/src/api/streaming-import-with-recovery.ts
import { validateExportFormat } from '@misc-poc/shared';
```

#### Usage:

- Data format validation for import/export operations
- Ensures data consistency across the monorepo

**Note**: This is a transitive dependency (not declared in package.json) which might need to be made explicit.

---

## External Dependencies

The backend also depends on many external packages:

### Core Framework

- `express@5.1.0` - Web framework
- `typeorm@0.3.27` - Database ORM for migrations
- `pg@8.12.0` - PostgreSQL client

### Authentication

- `passport@0.7.0` - Authentication middleware
- `passport-google-oauth20@2.0.0` - Google OAuth strategy
- `passport-jwt@4.0.1` - JWT strategy
- `jsonwebtoken@9.0.2` - JWT token generation/validation

### Security & Middleware

- `cors@2.8.5` - CORS middleware
- `cookie-parser@1.4.7` - Cookie parsing
- `express-rate-limit@8.1.0` - Rate limiting
- `express-session@1.18.2` - Session management

### Data Processing

- `zod@4.1.11` - Schema validation
- `stream-json@1.9.1` - Streaming JSON parsing

### Caching

- `redis@5.8.2` - Redis client
- `@types/redis@4.0.11` - Redis TypeScript types

---

## Architectural Analysis

### Current Architecture Pattern

```
┌─────────────────────────────────────┐
│         Backend Package             │
│                                     │
│  ┌─────────────────────────────┐  │
│  │  Express Routes & Middleware│  │
│  │   - Auth (OAuth, JWT)       │  │
│  │   - API endpoints           │  │
│  │   - Rate limiting           │  │
│  └──────────┬──────────────────┘  │
│             │                      │
│             ├──> TypeORM (direct   │
│             │     database queries)│
│             │                      │
│             └──> RedisCacheService │
│                  (via infra-cache) │
└─────────────────────────────────────┘
```

### Issues Identified

1. **Missing Application Layer Usage**
   - Backend does NOT use `@misc-poc/application` use cases
   - Business logic is implemented directly in route handlers
   - Violates Clean Architecture principles

2. **Direct Database Queries**
   - Using `dataSource.query()` directly in routes
   - Should use repository interfaces from application layer

3. **Implicit Shared Dependency**
   - Using `@misc-poc/shared` but not declared in dependencies
   - Should be explicitly added to package.json

### Recommended Architecture

```
┌─────────────────────────────────────────────────┐
│              Backend Package                    │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │   Express Routes & Middleware           │  │
│  └──────────┬──────────────────────────────┘  │
│             │                                  │
│             ↓                                  │
│  ┌─────────────────────────────────────────┐  │
│  │   Application Layer Use Cases           │  │
│  │   (@misc-poc/application)              │  │
│  │   - CreateRecordUseCase                │  │
│  │   - GetTagStatisticsUseCase            │  │
│  │   - AuthenticateUserUseCase            │  │
│  └──────────┬──────────────────────────────┘  │
│             │                                  │
│             ↓                                  │
│  ┌─────────────────────────────────────────┐  │
│  │   Repository Implementations            │  │
│  │   (@misc-poc/infrastructure-postgresql)│  │
│  │   - PostgreSqlRecordRepository         │  │
│  │   - PostgreSqlUserRepository           │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │   Caching Layer                         │  │
│  │   (@misc-poc/infrastructure-cache)     │  │
│  │   - RedisCacheService                  │  │
│  └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## Dependency Summary

| Package                        | Declared | Actually Used | Usage Level                         |
| ------------------------------ | -------- | ------------- | ----------------------------------- |
| @misc-poc/application          | ✅ Yes   | ❌ No         | **0% - Not used**                   |
| @misc-poc/domain               | ✅ Yes   | ❌ No         | **0% - Not used**                   |
| @misc-poc/infrastructure-cache | ✅ Yes   | ✅ Yes        | **High - Critical for performance** |
| @misc-poc/shared               | ❌ No    | ✅ Yes        | **Medium - Import validation**      |

---

## Recommendations

### 1. Add Application Layer Usage

```typescript
// Current (Direct database query)
app.get('/api/tags', requireAuth, async (req, res) => {
  const tagStats = await dataSource.query(/* SQL */);
  res.json(tagStats);
});

// Recommended (Use case pattern)
app.get('/api/tags', requireAuth, async (req, res) => {
  const getTagStats = new GetTagStatisticsUseCase(recordRepository);
  const tagStats = await getTagStats.execute({ userId: req.user.userId });
  res.json(tagStats);
});
```

### 2. Declare Shared Dependency

Add to `packages/backend/package.json`:

```json
{
  "dependencies": {
    "@misc-poc/shared": "workspace:*"
  }
}
```

### 3. Use Repository Pattern

Instead of direct TypeORM queries, inject repositories:

```typescript
import { IRecordRepository } from '@misc-poc/application';
import { PostgreSqlRecordRepository } from '@misc-poc/infrastructure-postgresql';

const recordRepository: IRecordRepository = new PostgreSqlRecordRepository(
  dataSource
);
```

---

## Cache Service Integration Details

### Configuration

```typescript
// From @misc-poc/infrastructure-cache
interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  ttl: {
    tagStatistics: number; // TTL for tag stats cache
    tagSuggestions: number; // TTL for tag suggestions cache
  };
}

const config = getCacheConfig(); // Reads from environment variables
```

### Environment Variables Used

- `REDIS_HOST` - Redis server host
- `REDIS_PORT` - Redis server port
- `REDIS_PASSWORD` - Redis password (optional)
- `REDIS_DB` - Redis database number

### Cache Keys Pattern

```
tag:stats:{userId}                           - Tag statistics for user
tag:suggestions:{userId}:{query}:{limit}     - Tag suggestions for query
```

---

## File Organization

```
packages/backend/src/
├── app.ts                              # Main Express app (uses infrastructure-cache)
├── auth/                               # Authentication logic
├── api/
│   ├── streaming-import.ts            # Uses @misc-poc/shared
│   ├── streaming-import-with-progress.ts  # Uses @misc-poc/shared
│   └── streaming-import-with-recovery.ts  # Uses @misc-poc/shared
├── services/
│   └── cache-warmup-service.ts        # Uses infrastructure-cache
└── infrastructure/
    └── database/                       # TypeORM migrations (not using application layer)
```

---

## Conclusion

The backend package currently has a **shallow integration** with the monorepo packages:

- ✅ **Infrastructure-cache**: Well-integrated, used for performance optimization
- ❌ **Application layer**: Declared but not used - architectural gap
- ❌ **Domain layer**: Declared but not used - architectural gap
- ⚠️ **Shared**: Used but not declared - dependency management gap

**Next Steps**: Refactor backend to properly use Clean Architecture by leveraging application layer use cases and repository interfaces.

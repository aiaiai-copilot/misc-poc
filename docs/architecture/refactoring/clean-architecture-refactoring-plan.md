# Clean Architecture Refactoring Plan

## Executive Summary

This document outlines a comprehensive refactoring plan to migrate the `@misc-poc/backend` package from its current **architecture violation state** to a **true Clean Architecture implementation**.

**Target Audience**: Claude Code AI Agent (self-referential implementation guide)

### Current State Assessment

**Critical Issues Identified:**

| Layer                        | Issue                     | Impact                                                  |
| ---------------------------- | ------------------------- | ------------------------------------------------------- |
| **Backend → Application**    | ❌ Declared but 0% usage  | Business logic in route handlers instead of use cases   |
| **Backend → Domain**         | ❌ Declared but 0% usage  | No domain entity usage for validation or business rules |
| **Backend → Shared**         | ⚠️ Used but not declared  | Implicit dependency on `validateExportFormat`           |
| **Backend → Infrastructure** | ❌ Direct TypeORM queries | Bypasses repository pattern, violates DI principle      |

**Architecture Violations:**

- ✅ Backend correctly uses `@misc-poc/infrastructure-cache` (RedisCacheService)
- ❌ Backend bypasses application layer completely
- ❌ Business logic mixed with HTTP concerns
- ❌ Direct database queries via `dataSource.query()` instead of repositories
- ❌ No dependency injection for repositories
- ❌ No use of domain entities for validation

---

## Mandatory Project Rules (MUST FOLLOW)

### 🔴 CRITICAL: Batch TDD Approach (MANDATORY - NOT EXPERIMENTAL)

**This project REQUIRES Batch TDD - this is NOT traditional TDD and NOT optional!**

**Batch TDD is the ONLY accepted approach for this project. This is a mandatory requirement, not an experimental practice.**

1. **RED Phase (Batch)**: Write ALL tests for the entire feature at once
   - Contract tests comparing old vs. new behavior
   - Edge cases and error scenarios
   - Integration tests with real PostgreSQL (Testcontainers)
   - ALL tests should be RED initially

2. **GREEN Phase (Implementation)**: Implement code to pass ALL tests
   - See the complete contract upfront
   - Work until 100% tests are GREEN

3. **REFACTOR Phase**: Clean up while keeping ALL tests GREEN

### 🔴 CRITICAL: Real Database Testing

- ✅ **MUST use Testcontainers with PostgreSQL** for all database tests
- ❌ **NEVER mock** database operations, migrations, or queries
- ✅ Integration tests MUST use actual database connections

**Integration Test Template:**

```typescript
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

describe('Endpoint Migration Integration Tests', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15').start();
    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      database: container.getDatabase(),
      username: container.getUsername(),
      password: container.getPassword(),
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  // Real integration tests here
});
```

### 🔴 CRITICAL: Validation Rules

Since this refactoring involves:

- ❌ Database queries (repository layer)
- ❌ Repository implementations
- ❌ API contracts with database interactions

**YOU MUST run `yarn validate:all` before EVERY commit!**

```bash
yarn validate:all  # Includes ALL tests (regular + performance + integration)
```

**NOT just:**

```bash
yarn validate  # This excludes performance/integration tests - NOT SUFFICIENT!
```

### 🔴 CRITICAL: Test Completion Requirements

**A task can ONLY be marked complete when:**

- ✅ ALL tests are GREEN (passing)
- ✅ NO tests are RED (failing)
- ✅ NO tests are SKIPPED
- ✅ Must see: "Tests: X/X passed (100%)"

**If tests timeout:**

- ✅ Increase timeout to 5-10 minutes
- ❌ NEVER reduce test coverage to save time

### 🔴 CRITICAL: Context7 MCP for Documentation

**BEFORE using ANY external library or updating existing library usage:**

1. **Resolve library ID:**

```typescript
mcp__context7__resolve - library - id('typeorm');
```

2. **Get current documentation:**

```typescript
mcp__context7__get -
  library -
  docs('/org/typeorm', {
    topic: 'repositories', // or 'migrations', 'query-builder', etc.
    tokens: 8000,
  });
```

**Required for:**

- TypeORM (DataSource, QueryRunner, Repository patterns)
- Jest + Testcontainers (integration test setup)
- Express.js (middleware, routing updates)
- Any other external dependencies being modified

**NEVER rely on potentially outdated knowledge - ALWAYS get current docs first!**

### 🔴 CRITICAL: Manual Testing Approval

**Before ANY git commit:**

1. ASK USER: "Do you want to test manually before committing?"
2. WAIT FOR USER RESPONSE
3. ONLY proceed with commit after explicit approval

---

## Refactoring Strategy

### Phased Approach

**Incremental, feature-by-feature refactoring** with these principles:

1. **Zero Breaking Changes**: Maintain API contracts during refactoring
2. **Batch TDD**: Write ALL tests first, then implement
3. **Real Database Testing**: Testcontainers for all integration tests
4. **Feature Flags**: Toggle new implementation during migration
5. **Gradual Migration**: One endpoint at a time, starting with simplest
6. **Context7 First**: Get current docs before modifying any library usage

---

## Phase 1: Foundation Setup (Low Risk)

### 1.1 Declare Missing Dependencies

**Goal**: Fix `package.json` dependency declarations

**Pre-work Checklist:**

- [ ] No external library docs needed (just package.json change)
- [ ] No tests required (configuration change)

**Actions:**

```json
// packages/backend/package.json
{
  "dependencies": {
    "@misc-poc/shared": "workspace:*" // ADD THIS
  }
}
```

**Testing:**

```bash
yarn install
yarn workspace @misc-poc/backend typecheck
```

**Validation:**

```bash
yarn validate  # Sufficient for config-only change
```

**Estimated Time**: 5 minutes
**Risk**: Low

---

### 1.2 Create Repository Factory

**Goal**: Centralize repository instantiation with dependency injection

**Pre-work Checklist:**

- [ ] Get Context7 docs for TypeORM DataSource patterns
- [ ] Write unit tests FIRST (Batch TDD Red phase)
- [ ] Mock DataSource for unit tests (acceptable for factory tests)

**Context7 Required:**

```typescript
// STEP 1: Get TypeORM docs
mcp__context7__resolve - library - id('typeorm');
mcp__context7__get -
  library -
  docs('/typeorm/typeorm', {
    topic: 'data source dependency injection',
    tokens: 8000,
  });
```

**New File**: `packages/backend/src/infrastructure/repositories/repository-factory.ts`

```typescript
import { DataSource } from 'typeorm';
import { PostgreSQLRecordRepository } from '@misc-poc/infrastructure-postgresql';
import { PostgreSQLUserRepository } from '@misc-poc/infrastructure-postgresql';
import { RecordRepository, UserRepository } from '@misc-poc/application';

export interface RepositoryFactory {
  createRecordRepository(userId: string): RecordRepository;
  createUserRepository(): UserRepository;
}

export class TypeORMRepositoryFactory implements RepositoryFactory {
  constructor(private readonly dataSource: DataSource) {}

  createRecordRepository(userId: string): RecordRepository {
    return new PostgreSQLRecordRepository(this.dataSource, userId);
  }

  createUserRepository(): UserRepository {
    return new PostgreSQLUserRepository(this.dataSource);
  }
}
```

**Testing Strategy (Batch TDD):**

1. **RED Phase** - Write tests first:

```typescript
// packages/backend/src/infrastructure/repositories/__tests__/repository-factory.test.ts
describe('TypeORMRepositoryFactory', () => {
  it('should create RecordRepository with userId');
  it('should create UserRepository');
  it('should throw on invalid userId format');
  it('should reuse DataSource across repository instances');
});
```

2. **GREEN Phase** - Implement until all tests pass

3. **REFACTOR Phase** - Clean up

**Validation:**

```bash
yarn validate  # Sufficient for unit tests only
```

**Estimated Time**: 45 minutes (including Context7 research)
**Risk**: Low

---

### 1.3 Create Use Case Container

**Goal**: Centralize use case instantiation with proper dependency injection

**Pre-work Checklist:**

- [ ] Review application layer use cases (already in codebase)
- [ ] Write unit tests FIRST (Batch TDD Red phase)
- [ ] No Context7 needed (using internal packages)

**New File**: `packages/backend/src/application/use-case-container.ts`

```typescript
import {
  CreateRecordUseCase,
  SearchRecordsUseCase,
  UpdateRecordUseCase,
  DeleteRecordUseCase,
  GetTagSuggestionsUseCase,
  ExportDataUseCase,
  ImportDataUseCase,
  RecordRepository,
  TagRepository,
  UnitOfWork,
} from '@misc-poc/application';
import { RepositoryFactory } from '../infrastructure/repositories/repository-factory';

export interface UseCaseContainer {
  createRecordUseCase(userId: string): CreateRecordUseCase;
  searchRecordsUseCase(userId: string): SearchRecordsUseCase;
  updateRecordUseCase(userId: string): UpdateRecordUseCase;
  deleteRecordUseCase(userId: string): DeleteRecordUseCase;
  getTagSuggestionsUseCase(userId: string): GetTagSuggestionsUseCase;
  exportDataUseCase(userId: string): ExportDataUseCase;
  importDataUseCase(userId: string): ImportDataUseCase;
}

export class DefaultUseCaseContainer implements UseCaseContainer {
  constructor(private readonly repositoryFactory: RepositoryFactory) {}

  createRecordUseCase(userId: string): CreateRecordUseCase {
    const recordRepository =
      this.repositoryFactory.createRecordRepository(userId);
    const tagRepository = this.repositoryFactory.createTagRepository(userId);
    const unitOfWork = this.repositoryFactory.createUnitOfWork(userId);
    return new CreateRecordUseCase(recordRepository, tagRepository, unitOfWork);
  }

  // ... other use cases with proper repository injection
}
```

**Testing Strategy (Batch TDD):**

1. **RED Phase** - Write ALL tests first:

```typescript
describe('DefaultUseCaseContainer', () => {
  it('should create CreateRecordUseCase with injected repositories');
  it('should create SearchRecordsUseCase with injected repositories');
  it('should create all use cases with proper dependencies');
  it('should inject userId-scoped repositories');
});
```

2. **GREEN Phase** - Implement until all pass

3. **REFACTOR Phase** - Clean up

**Validation:**

```bash
yarn validate  # Sufficient for unit tests
```

**Estimated Time**: 1 hour
**Risk**: Low

---

## Phase 2: First Endpoint Migration (Medium Risk)

### 2.1 Refactor `/api/tags` Endpoint (Repository Pattern)

**Why Start Here?**

- Read-only operation (no data modification risk)
- Already has caching integration (preserve existing behavior)
- Simple business logic
- No transaction requirements
- Uses `RecordRepository.getTagStatistics()` which already exists

**Pre-work Checklist:**

- [ ] Get Context7 docs for Express.js middleware patterns
- [ ] Write ALL integration tests FIRST (Batch TDD Red phase)
- [ ] Use Testcontainers for integration tests (MANDATORY)
- [ ] Write contract test comparing old vs. new implementation
- [ ] Establish performance baseline

**Context7 Required:**

```typescript
// STEP 1: Get Express.js docs
mcp__context7__resolve - library - id('express');
mcp__context7__get -
  library -
  docs('/expressjs/express', {
    topic: 'middleware error handling async',
    tokens: 8000,
  });
```

**Current Implementation** (lines 688-739 in `app.ts`):

```typescript
app.get('/api/tags', requireAuth, async (req: Request, res: Response) => {
  const user = req.user as { userId: string; email: string };

  // Try cache
  if (cacheService) {
    const cachedStats = await cacheService.getTagStatistics(user.userId);
    if (cachedStats !== null) return res.json(cachedStats);
  }

  // ❌ Direct SQL query - VIOLATION
  const tagStats = await dataSource.query(
    `SELECT unnest(normalized_tags) as tag, COUNT(*) as count
     FROM records WHERE user_id = $1
     GROUP BY unnest(normalized_tags) ORDER BY count DESC, tag ASC`,
    [user.userId]
  );

  // Format and cache
  const formattedTags = tagStats.map((row) => ({
    tag: row.tag,
    count: parseInt(row.count, 10),
  }));

  if (cacheService) {
    await cacheService.setTagStatistics(user.userId, formattedTags);
  }

  res.json(formattedTags);
});
```

**Target Implementation**:

```typescript
app.get('/api/tags', requireAuth, async (req: Request, res: Response) => {
  const user = req.user as { userId: string; email: string };

  // Try cache first (preserve existing caching logic)
  if (cacheService) {
    const cachedStats = await cacheService.getTagStatistics(user.userId);
    if (cachedStats !== null) return res.json(cachedStats);
  }

  // ✅ Use repository pattern
  const recordRepository = repositoryFactory.createRecordRepository(
    user.userId
  );
  const result = await recordRepository.getTagStatistics();

  if (result.isErr()) {
    return res.status(500).json({ error: result.unwrapErr().message });
  }

  const tagStats = result.unwrap();

  // Cache result (preserve existing caching logic)
  if (cacheService) {
    await cacheService.setTagStatistics(user.userId, tagStats);
  }

  res.json(tagStats);
});
```

**Testing Strategy (Batch TDD):**

**RED Phase - Write ALL tests FIRST:**

```typescript
// packages/backend/src/api/__tests__/tags-endpoint-migration-integration.test.ts
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import request from 'supertest';

describe('[Integration] GET /api/tags - Repository Pattern Migration', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let app: Express;

  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new PostgreSqlContainer('postgres:15').start();

    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      database: container.getDatabase(),
      username: container.getUsername(),
      password: container.getPassword(),
      // Add migrations
    });
    await dataSource.initialize();

    // Run migrations
    await dataSource.runMigrations();

    // Initialize app with test config
    app = await createApp({ dataSource });
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  describe('Contract Test: Old vs New Implementation', () => {
    it('should return identical results for same data', async () => {
      // Insert test data
      await dataSource.query(`INSERT INTO records ...`);

      // Get result from new implementation
      const response = await request(app)
        .get('/api/tags')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();
    });
  });

  describe('Repository Pattern Behavior', () => {
    it('should return tag statistics sorted by count DESC');
    it('should handle empty records gracefully');
    it('should isolate tags by userId');
    it('should cache results after first query');
    it('should return cached results on subsequent calls');
  });

  describe('Error Handling', () => {
    it('should return 500 on database errors');
    it('should handle repository errors gracefully');
  });

  describe('Performance', () => {
    it('should complete within 200ms for 1000 records', async () => {
      // Insert 1000 test records
      // Measure response time
    });
  });
});
```

**GREEN Phase - Implement until ALL tests pass**

**REFACTOR Phase - Clean up while keeping tests green**

**Feature Flag Implementation:**

```typescript
const USE_REPOSITORY_PATTERN = process.env.USE_REPOSITORY_PATTERN === 'true';

app.get('/api/tags', requireAuth, async (req: Request, res: Response) => {
  if (USE_REPOSITORY_PATTERN) {
    // New repository-based implementation
    return handleTagsWithRepository(req, res);
  } else {
    // Legacy direct query implementation
    return handleTagsLegacy(req, res);
  }
});
```

**Validation:**

```bash
# MANDATORY: Must use validate:all for repository changes
yarn validate:all
```

**Gradual Rollout:**

1. Run in test environment with feature flag
2. Compare results between old and new (contract test)
3. Monitor performance (ensure no regression)
4. Enable in production after 1 week of testing
5. Remove feature flag and legacy code

**Estimated Time**: 3 hours (including Context7, tests, implementation)
**Risk**: Medium (first endpoint, sets pattern)

---

### 2.2 Refactor `/api/tags/suggest` Endpoint

**Similar to 2.1 but with query parameter validation**

**Context7 Required:** Same as 2.1 (Express.js)

**Testing:** Same pattern (Testcontainers + contract tests)

**Validation:**

```bash
yarn validate:all  # MANDATORY
```

**Estimated Time**: 2 hours
**Risk**: Low (same pattern as 2.1)

---

## Phase 3: Write Operations (Higher Risk)

### 3.1 Create Record Endpoint

**Goal**: Migrate POST `/api/records` to use `CreateRecordUseCase`

**Pre-work Checklist:**

- [ ] Get Context7 docs for TypeORM transactions
- [ ] Write ALL integration tests FIRST (Batch TDD)
- [ ] Test transaction rollback scenarios
- [ ] Test duplicate detection
- [ ] Test concurrent creation attempts

**Context7 Required:**

```typescript
// STEP 1: TypeORM transactions
mcp__context7__resolve - library - id('typeorm');
mcp__context7__get -
  library -
  docs('/typeorm/typeorm', {
    topic: 'transactions unit of work pattern',
    tokens: 8000,
  });

// STEP 2: Express error handling
mcp__context7__get -
  library -
  docs('/expressjs/express', {
    topic: 'error handling middleware async',
    tokens: 8000,
  });
```

**Target Implementation**:

```typescript
app.post('/api/records', requireAuth, async (req: Request, res: Response) => {
  const user = req.user as { userId: string; email: string };
  const { content } = req.body;

  // ✅ Use application layer use case
  const createRecordUseCase = useCaseContainer.createRecordUseCase(user.userId);
  const result = await createRecordUseCase.execute({ content });

  if (result.isErr()) {
    const error = result.unwrapErr();
    return res.status(400).json({ error: error.message });
  }

  const { record } = result.unwrap();
  res.status(201).json(record);
});
```

**Testing Strategy (Batch TDD):**

**RED Phase - Write ALL tests FIRST:**

```typescript
describe('[Integration] POST /api/records - Use Case Migration', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15').start();
    dataSource = await setupDataSource(container);
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  describe('Successful Creation', () => {
    it('should create record with use case');
    it('should return 201 with created record');
    it('should persist to database');
    it('should create new tags automatically');
  });

  describe('Duplicate Detection', () => {
    it('should reject duplicate tag sets');
    it('should return 400 with duplicate error');
  });

  describe('Transaction Safety', () => {
    it('should rollback on tag creation failure');
    it('should rollback on record creation failure');
    it('should not leave partial data on errors');
  });

  describe('Concurrent Creation', () => {
    it('should handle concurrent requests safely');
    it('should prevent race conditions in tag creation');
  });

  describe('Validation', () => {
    it('should reject empty content');
    it('should reject invalid tag formats');
    it('should enforce max tag limits');
  });
});
```

**GREEN Phase - Implement until all pass**

**REFACTOR Phase - Clean up**

**Validation:**

```bash
yarn validate:all  # MANDATORY for transaction/database changes
```

**Estimated Time**: 4 hours (including Context7, complex testing)
**Risk**: High (data modification, transactions)

---

### 3.2 Update Record Endpoint

**Use Case**: `UpdateRecordUseCase`

**Same pattern as 3.1**

**Estimated Time**: 3 hours
**Risk**: High

---

### 3.3 Delete Record Endpoint

**Use Case**: `DeleteRecordUseCase`

**Same pattern as 3.1, simpler logic**

**Estimated Time**: 2 hours
**Risk**: Medium

---

## Phase 4: Complex Operations

### 4.1 Search Records Endpoint

**Use Case**: `SearchRecordsUseCase`

**Context7 Required:**

```typescript
mcp__context7__get -
  library -
  docs('/typeorm/typeorm', {
    topic: 'query builder full text search',
    tokens: 8000,
  });
```

**Complexity**: Multiple search modes (tags, content, combined)

**Testing**: Testcontainers + search query variations

**Validation:**

```bash
yarn validate:all  # MANDATORY
```

**Estimated Time**: 3 hours
**Risk**: Medium

---

### 4.2 Import/Export Endpoints

**Use Cases**: `ImportDataUseCase`, `ExportDataUseCase`

**Context7 Required:**

```typescript
// Streaming libraries
mcp__context7__resolve - library - id('stream-json');
mcp__context7__get -
  library -
  docs('/uhop/stream-json', {
    topic: 'streaming large json files',
    tokens: 8000,
  });
```

**Complexity**: Streaming, progress tracking, error recovery

**Testing**: Testcontainers + large dataset tests (performance tagged with [perf])

**Validation:**

```bash
yarn validate:all  # MANDATORY for batch operations
```

**Estimated Time**: 5 hours
**Risk**: High

---

## Phase 5: Authentication Refactoring

### 5.1 OAuth Flow Migration

**Goal**: Move authentication logic to use cases

**Context7 Required:**

```typescript
// Passport.js strategies
mcp__context7__resolve - library - id('passport');
mcp__context7__get -
  library -
  docs('/jaredhanson/passport', {
    topic: 'google oauth2 strategy',
    tokens: 8000,
  });

// JWT handling
mcp__context7__resolve - library - id('jsonwebtoken');
mcp__context7__get -
  library -
  docs('/auth0/node-jsonwebtoken', {
    topic: 'token generation validation',
    tokens: 8000,
  });
```

**New Use Cases to Create**:

```typescript
// packages/application/src/use-cases/authenticate-user-use-case.ts
export class AuthenticateUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(
    googleProfile: GoogleProfile
  ): Promise<Result<User, DomainError>> {
    // Find or create user
    // Update last login
    // Return user
  }
}
```

**Testing**: Testcontainers + OAuth flow simulation

**Validation:**

```bash
yarn validate:all  # MANDATORY for user repository changes
```

**Estimated Time**: 4 hours
**Risk**: High (security-critical)

---

## Phase 6: Infrastructure Cleanup

### 6.1 Remove Direct TypeORM Queries

**Goal**: Eliminate ALL `dataSource.query()` calls from route handlers

**Search Pattern:**

```bash
grep -r "dataSource.query" packages/backend/src/ --exclude-dir=__tests__
```

**Actions**:

- Move remaining queries to repositories
- Ensure all use repository pattern
- Remove direct DataSource from route handlers

**Validation:**

```bash
yarn validate:all  # MANDATORY
```

**Estimated Time**: 2 hours
**Risk**: Low

---

### 6.2 Remove Feature Flags

**Goal**: Remove all `USE_REPOSITORY_PATTERN` feature flags after validation period

**Estimated Time**: 1 hour
**Risk**: Low

---

## Phase 7: Testing & Validation

### 7.1 End-to-End Integration Test Suite

**Goal**: Ensure 100% endpoint coverage with integration tests

**All tests must:**

- ✅ Use Testcontainers (real PostgreSQL)
- ✅ Test complete request/response cycle
- ✅ Verify database state after operations
- ✅ Test error scenarios

**Validation:**

```bash
yarn validate:all  # Run ALL tests
```

**Must see:** "Tests: X/X passed (100%)"

**Estimated Time**: 3 hours
**Risk**: Low

---

### 7.2 Performance Benchmarking

**Goal**: Ensure refactoring doesn't degrade performance

**Metrics**:

- Response time (p50, p95, p99)
- Database query count
- Memory usage
- Cache hit rate

**Tag performance tests:**

```typescript
describe('[perf] Performance Benchmarks', () => {
  it('should handle 1000 records within 200ms');
});
```

**Validation:**

```bash
yarn test:perf  # Run performance tests separately
yarn validate:all  # Run everything before final commit
```

**Estimated Time**: 2 hours
**Risk**: Low

---

## Phase 8: Documentation & Cleanup

### 8.1 Update Architecture Diagrams

**Files to Update**:

- `docs/architecture/debt/backend-dependencies-detail.md`
- `docs/architecture/debt/package-dependencies.md`

**New Dependency Analysis**:

```markdown
| Package                        | Declared | Actually Used | Usage Level                |
| ------------------------------ | -------- | ------------- | -------------------------- |
| @misc-poc/application          | ✅ Yes   | ✅ Yes        | **100% - All use cases**   |
| @misc-poc/domain               | ✅ Yes   | ✅ Yes        | **100% - Domain entities** |
| @misc-poc/infrastructure-cache | ✅ Yes   | ✅ Yes        | **High - Performance**     |
| @misc-poc/shared               | ✅ Yes   | ✅ Yes        | **Medium - Utilities**     |
```

**Estimated Time**: 1 hour
**Risk**: None

---

## Complete Workflow Checklist (Per Endpoint)

### Pre-Implementation

- [ ] Get Context7 docs for all external libraries being modified
- [ ] Establish performance baseline (if applicable)
- [ ] Write ALL integration tests FIRST (Batch TDD Red phase)
  - [ ] Use Testcontainers with real PostgreSQL
  - [ ] Include contract test comparing old vs. new
  - [ ] Include error scenarios
  - [ ] Include edge cases
- [ ] Verify all tests are RED (failing)

### Implementation

- [ ] Implement new code following test specifications
- [ ] Work until ALL tests are GREEN
- [ ] Refactor while keeping tests green
- [ ] Verify no direct `dataSource.query()` calls
- [ ] Verify proper repository/use case usage

### Validation

- [ ] Run `yarn validate:all` (MANDATORY)
- [ ] Verify output: "Tests: X/X passed (100%)"
- [ ] No failing tests, no skipped tests
- [ ] Performance within 10% of baseline

### Pre-Commit

- [ ] Ask user: "Do you want to test manually before committing?"
- [ ] Wait for explicit approval
- [ ] Create feature flag for gradual rollout (if needed)

### Post-Commit

- [ ] Monitor in test environment
- [ ] Compare old vs. new results
- [ ] Gradual rollout to production
- [ ] Remove feature flags after validation period

---

## Timeline Estimates

| Phase                           | Estimated Time         | Risk Level  |
| ------------------------------- | ---------------------- | ----------- |
| Phase 1: Foundation Setup       | 2 hours                | Low         |
| Phase 2: Read Endpoints         | 5 hours                | Medium      |
| Phase 3: Write Operations       | 9 hours                | High        |
| Phase 4: Complex Operations     | 8 hours                | Medium-High |
| Phase 5: Authentication         | 4 hours                | High        |
| Phase 6: Infrastructure Cleanup | 3 hours                | Low         |
| Phase 7: Testing & Validation   | 5 hours                | Low         |
| Phase 8: Documentation          | 1 hour                 | None        |
| **Total**                       | **37 hours** (~5 days) | —           |

**Buffer**: Add 30% buffer for unexpected issues → **48 hours (~6 days)**

---

## Success Criteria

### Technical Metrics (MANDATORY)

- ✅ **Zero direct `dataSource.query()` calls** in route handlers
- ✅ **100% use case usage** for business logic
- ✅ **Repository pattern** for all data access
- ✅ **Domain entities** used for validation
- ✅ **ALL tests passing** (unit + integration + performance)
- ✅ **Must see**: "Tests: X/X passed (100%)"
- ✅ **Performance maintained** (within 10% of baseline)
- ✅ **All integration tests use Testcontainers** (no mocked databases)

### Architecture Compliance

- ✅ **Dependency Rule**: Backend → Application → Domain
- ✅ **Repository Pattern**: All data access via repositories
- ✅ **Use Case Pattern**: All business logic in use cases
- ✅ **Dependency Injection**: Proper DI throughout
- ✅ **No architectural violations** detected

### Process Compliance

- ✅ **Batch TDD followed**: Tests written first for every feature
- ✅ **Context7 used**: Current docs retrieved before library modifications
- ✅ **Manual testing approval**: User approval before every commit
- ✅ **No mocked databases**: All integration tests use Testcontainers

---

## References

- [Backend Dependencies Analysis](../debt/backend-dependencies-detail.md)
- [Package Dependency Diagram](../debt/package-dependencies.md)
- [Clean Architecture Principles (Robert C. Martin)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Application Layer Use Cases](../../../packages/application/src/use-cases/)
- [Infrastructure Repository Implementations](../../../packages/infrastructure/postgresql/src/)
- [Project Testing Standards](../../../CLAUDE.md#testing-standards)

---

**Document Version**: 1.0
**Created**: 2025-10-02
**Author**: Claude Code (AI Agent Self-Referential Guide)
**Status**: Ready for Implementation
**Branch**: `refactor/clean-architecture-migration`

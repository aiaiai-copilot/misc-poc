# Test Tagging Examples

## Performance Test Tagging

Performance tests that process large datasets (1000+ records), test concurrent operations, or have long execution times should be tagged with `[perf]` prefix.

### Purpose

- **Faster development validation**: Regular `yarn test` excludes performance tests
- **Dedicated performance testing**: Use `yarn test:perf` to run only performance tests
- **Complete testing**: Use `yarn test:all` to run all tests including performance tests

### Available Test Scripts

```bash
# Regular tests (excludes [perf] tagged tests) - DEFAULT
yarn test

# Performance tests only
yarn test:perf

# All tests (regular + performance)
yarn test:all

# Validation commands
yarn validate      # build + typecheck + lint + test (no perf)
yarn validate:all  # build + typecheck + lint + test:all (with perf)
```

### How to Tag Tests

You can tag tests at two levels:

**1. File-Level Tagging (Recommended for integration tests)**

- Tag the entire `describe()` block when ALL tests in the file are slow
- Typical use: Files using Testcontainers (PostgreSQL, Redis containers)
- Benefit: Entire file is skipped during fast validation

**2. Test-Level Tagging**

- Tag individual `it()` test cases within a file
- Use when only specific tests are slow (large datasets, performance benchmarks)

Add `[perf]` prefix to files/tests that involve:

- **Large datasets**: 1000+ records
- **Concurrent operations**: Multiple parallel requests
- **Performance benchmarks**: Execution time measurements
- **Memory testing**: Sustained load tests
- **Slow operations**: Tests with extended timeouts (>30s)
- **Testcontainers**: PostgreSQL, Redis, or other container startup

### Examples

#### ✅ File-Level Tagging (Entire Test Suite)

```typescript
// Tag entire test file when ALL tests use Testcontainers or are performance-focused
describe('[perf] Query Performance Optimization Contract', () => {
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    // Starting containers is slow (10-30 seconds)
    container = await new PostgreSqlContainer('postgres:15-alpine').start();
  });

  // All tests in this file are now tagged [perf]
  it('should use optimized GIN index', async () => {
    /* ... */
  });
  it('should calculate statistics within 500ms', async () => {
    /* ... */
  });
});
```

**Current files with describe-level [perf] tags:**

- `query-performance-optimization.test.ts` - Performance benchmarking
- `import-streaming-contract.test.ts` - Large dataset streaming tests
- `progress-reporting-contract.test.ts` - SSE with large exports
- `postgresql-record-repository-integration.test.ts` - DB integration tests
- `caching-integration.test.ts` - Redis + PostgreSQL integration

#### ✅ Test-Level Tagging (Specific Tests)

```typescript
// Tag individual tests with large datasets
it('[perf] should handle maximum allowed record count', async () => {
  const records = Array.from({ length: 1000 }, (_, i) => ({
    content: `test record ${i}`,
  }));
  // ... test implementation
}, 30000);

// Tag concurrent operation tests
it('[perf] should handle concurrent import requests safely', async () => {
  const promises = Array.from({ length: 10 }, () =>
    request(app).post('/api/import').send(data)
  );
  await Promise.all(promises);
});

// Tag performance benchmarks
it('[perf] should complete large import within reasonable time', async () => {
  const startTime = Date.now();
  const records = Array.from({ length: 10000 }, createRecord);
  // ... import
  const duration = Date.now() - startTime;
  expect(duration).toBeLessThan(150000);
}, 300000);

// Tag memory leak tests
it('[perf] should not leak memory under sustained load', async () => {
  const memBefore = process.memoryUsage().heapUsed;
  // ... perform operations
  const memAfter = process.memoryUsage().heapUsed;
  expect((memAfter - memBefore) / 1024 / 1024).toBeLessThan(100);
});
```

#### ❌ Incorrect Usage

```typescript
// DON'T tag small dataset tests
it('should import 5 records', async () => {
  // Small dataset - no [perf] tag needed
});

// DON'T tag fast unit tests
it('should validate record content', () => {
  // Fast validation - no [perf] tag needed
});

// DON'T tag single-operation tests
it('should create one record', async () => {
  // Single operation - no [perf] tag needed
});
```

### Decision Guide: File-Level vs Test-Level Tagging

**Use File-Level Tagging (`describe('[perf] ...')`) when:**

- ✅ File uses Testcontainers (PostgreSQL, Redis) in `beforeAll`
- ✅ ALL tests in the file are integration/performance tests
- ✅ File name includes: `*-integration.test.ts`, `*-performance.test.ts`, `*-contract.test.ts` with containers
- ✅ File startup takes > 10 seconds

**Use Test-Level Tagging (`it('[perf] ...')`) when:**

- ✅ Only SOME tests in the file are slow
- ✅ File mixes fast unit tests with slow performance tests
- ✅ Specific tests process large datasets (1000+ records)
- ✅ Individual tests have extended timeouts

### When to Add [perf] Tag

✅ **Add file-level [perf] tag when:**

- Entire test file uses Testcontainers
- All tests are performance benchmarks or integration tests
- File startup in `beforeAll` is slow (>10s)

✅ **Add test-level [perf] tag when:**

- Test inserts/processes 1000+ records
- Test runs concurrent operations (5+ parallel requests)
- Test measures execution time/performance
- Test has timeout > 30 seconds
- Test measures memory usage under load
- Test uses `insertLargeDataset()` or similar helper functions

❌ **Don't add [perf] tag when:**

- Test processes < 100 records
- Test is a simple unit test
- Test completes in < 5 seconds
- Test validates single operations
- Test checks error handling

### Workflow Integration

Performance tests are excluded from default validation to speed up development:

```bash
# During development (fast feedback)
yarn build && yarn typecheck && yarn lint && yarn test

# Before committing (use the validate command)
yarn validate

# Pre-release or CI (comprehensive)
yarn validate:all
```

### Finding Tagged Tests

```bash
# Find all file-level tags
grep -r "describe\('\[perf\]" packages/*/src/**/*.test.ts

# Find all test-level tags
grep -r "it\('\[perf\]" packages/*/src/**/*.test.ts

# Count all performance tests (both levels)
grep -rE "(describe|it)\('\[perf\]" packages/*/src/**/*.test.ts | wc -l
```

### Migration Guide

**For entire slow test files:**

1. Identify integration test files using Testcontainers
2. Add `[perf]` prefix to the top-level describe:

   ```typescript
   // Before
   describe('API Integration Tests', () => {

   // After
   describe('[perf] API Integration Tests', () => {
   ```

**For individual slow tests:**

1. Identify slow tests (those with large datasets or long timeouts)
2. Add `[perf]` prefix to the test name:

   ```typescript
   // Before
   it('should handle 10k records', async () => {

   // After
   it('[perf] should handle 10k records', async () => {
   ```

3. No other changes needed - the test content remains the same

### Current Tagged Tests

#### File-Level Tags (Entire Test Suite)

The following test files have `describe('[perf] ...')` at the top level, making ALL tests in the file tagged:

- `packages/infrastructure/postgresql/src/__tests__/query-performance-optimization.test.ts`
  - Entire file: Performance benchmarking with 1000-2000 record datasets
  - All tests verify index optimization and query performance

- `packages/backend/src/api/__tests__/import-streaming-contract.test.ts`
  - Entire file: Streaming tests with 5k-10k record datasets
  - Tests streaming JSON parsing, chunked processing, memory efficiency

- `packages/backend/src/api/__tests__/progress-reporting-contract.test.ts`
  - Entire file: SSE progress reporting with large datasets
  - Tests Server-Sent Events with concurrent operations

- `packages/infrastructure/postgresql/src/__tests__/postgresql-record-repository-integration.test.ts`
  - Entire file: Database integration tests with Testcontainers
  - Tests findByTags and getTagStatistics with real PostgreSQL

- `packages/backend/src/api/__tests__/caching-integration.test.ts`
  - Entire file: Redis + PostgreSQL integration tests
  - Tests cache layer with real Redis and PostgreSQL containers

#### Test-Level Tags (Individual Tests)

The following test files have specific `it('[perf] ...')` tests:

- `packages/backend/src/api/__tests__/import-endpoint-contract.test.ts`
  - `[perf] should handle maximum allowed record count` (1000 records)
  - `[perf] should handle concurrent import requests safely` (concurrent operations)

### Notes

- The `[perf]` tag uses regex pattern matching: `--testNamePattern='^(?!.*\\[perf\\]).*$'` (exclude) or `--testNamePattern='\\[perf\\]'` (include only)
- Tags work with Jest's `testNamePattern` option
- No changes to Jest configuration files required
- Compatible with all existing test infrastructure
- File-level tags are more efficient than tagging individual tests when the entire file is slow

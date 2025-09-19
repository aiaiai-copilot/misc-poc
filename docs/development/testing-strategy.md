# MISC MVP Testing Strategy & TDD Requirements

## Executive Summary

This document defines the mandatory Test-Driven Development (TDD) approach and testing requirements for MISC MVP. **No production code shall be written without a failing test first**. This is a core architectural principle, not a guideline.

## TDD Methodology

### The Three Laws of TDD

1. **You may not write production code until you have written a failing unit test**
2. **You may not write more of a unit test than is sufficient to fail**
3. **You may not write more production code than is sufficient to pass the failing test**

### Red-Green-Refactor Cycle

```
┌─────────┐      ┌─────────┐      ┌──────────┐
│   RED   │─────▶│  GREEN  │─────▶│ REFACTOR │
│  Write  │      │  Write  │      │ Improve  │
│ Failing │      │ Minimal │      │  Code    │
│  Test   │      │  Code   │      │ Quality  │
└─────────┘      └─────────┘      └──────────┘
     ▲                                  │
     └──────────────────────────────────┘
```

### TDD Process Requirements

| Step | Action                                 | Verification                    |
| ---- | -------------------------------------- | ------------------------------- |
| 1    | Write test describing desired behavior | Test must fail with clear error |
| 2    | Run test to confirm it fails           | Red test output                 |
| 3    | Write minimal code to pass             | No more code than necessary     |
| 4    | Run test to confirm it passes          | Green test output               |
| 5    | Refactor if needed                     | Tests remain green              |
| 6    | Commit with test and implementation    | Git history shows test-first    |

## Test Categories and Coverage Requirements

### Coverage Targets by Layer

| Layer                   | Minimum Coverage | Critical Paths | Rationale                                |
| ----------------------- | ---------------- | -------------- | ---------------------------------------- |
| **Domain**              | >95%             | 100%           | Core business logic, must be bulletproof |
| **Application**         | >90%             | 100%           | Use cases define system behavior         |
| **API Routes**          | >85%             | 100%           | Contract validation critical             |
| **Repositories**        | >90%             | 100%           | Data integrity essential                 |
| **Frontend Components** | >80%             | 100%           | User interactions                        |
| **E2E Critical Paths**  | N/A              | 100%           | User journeys must work                  |

### Test Pyramid

```
         /\
        /E2E\         5% - Critical user journeys
       /────\
      /Integr.\      15% - API and database
     /─────────\
    /   Unit    \    80% - Business logic
   /─────────────\
```

## Test Specifications by Component

### 1. Domain Layer Tests

**Purpose**: Verify business rules and invariants

**Test Categories**:

- Value Object validation
- Entity invariants
- Domain service logic
- Factory methods
- Error conditions

**Example Test Structure**:

```
describe('Record Entity')
  describe('creation')
    ✓ should create with valid data
    ✓ should reject empty content
    ✓ should enforce tag limit
    ✓ should maintain immutable ID
  describe('tag operations')
    ✓ should detect tag presence
    ✓ should compare tag sets correctly
  describe('invariants')
    ✓ should synchronize tags with content
    ✓ should preserve tag order
```

**Requirements**:

- No mocking in domain tests
- Pure functions tested with multiple scenarios
- Edge cases explicitly tested
- Performance benchmarks for critical operations

### 2. Application Layer Tests

**Purpose**: Verify use case orchestration

**Test Categories**:

- Use case happy paths
- Validation failures
- Repository interactions
- Transaction boundaries
- Error propagation

**Testing Approach**:

- Mock repositories with in-memory implementations
- Test complete workflows
- Verify all Result<T,E> paths
- Check side effects explicitly

**Contract Example**:

```
CreateRecord Use Case Contract:
  Input validation:
    ✓ rejects empty content
    ✓ rejects content exceeding limits
    ✓ normalizes tags per settings
  Duplicate detection:
    ✓ prevents duplicate tag sets
    ✓ excludes self on update
  Success path:
    ✓ creates record with UUID
    ✓ associates tags correctly
    ✓ returns complete DTO
  Error handling:
    ✓ returns validation errors
    ✓ returns duplicate error
    ✓ handles repository failures
```

### 3. API Integration Tests

**Purpose**: Verify HTTP contracts and middleware

**Test Categories**:

- Route authentication
- Request validation
- Response formatting
- Error status codes
- Rate limiting
- CORS headers

**Testing Tools**:

- Supertest for HTTP testing
- Test database with migrations
- JWT token generation helpers

**Contract Testing Requirements**:

```
Each endpoint must test:
  ✓ Successful operation (2xx)
  ✓ Authentication required (401)
  ✓ Invalid input (400)
  ✓ Resource not found (404)
  ✓ Duplicate resource (409)
  ✓ Rate limit exceeded (429)
  ✓ Internal error handling (500)
```

### 4. Repository Integration Tests

**Purpose**: Verify data persistence and retrieval

**Test Categories**:

- CRUD operations
- Query performance
- Index usage
- Transaction isolation
- Constraint enforcement

**Testing Approach**:

- Dedicated test database
- Fresh schema for each test suite
- Performance assertions for queries
- Concurrent operation testing

**Performance Requirements**:

```
Repository Performance Tests:
  Search operations:
    ✓ 10 records < 10ms
    ✓ 1,000 records < 50ms
    ✓ 10,000 records < 200ms
  Write operations:
    ✓ Single insert < 20ms
    ✓ Batch insert (100) < 100ms
  Index verification:
    ✓ GIN index used for tag search
    ✓ No sequential scans on large tables
```

### 5. Frontend Component Tests

**Purpose**: Verify UI behavior and user interactions

**Test Categories**:

- Component rendering
- User interactions
- State management
- API integration
- Error handling
- Accessibility

**Testing Tools**:

- React Testing Library
- MSW for API mocking
- Jest DOM matchers

**Component Test Requirements**:

```
Each component must test:
  Rendering:
    ✓ Initial render with props
    ✓ Loading states
    ✓ Error states
    ✓ Empty states
  Interactions:
    ✓ Click handlers
    ✓ Keyboard events
    ✓ Form submissions
  Integration:
    ✓ API calls triggered correctly
    ✓ Success response handling
    ✓ Error response handling
  Accessibility:
    ✓ ARIA attributes present
    ✓ Keyboard navigation
    ✓ Screen reader compatibility
```

### 6. End-to-End Tests

**Purpose**: Verify complete user journeys

**Test Scenarios**:

```
Critical User Journeys:
  First-time user:
    ✓ Google OAuth login
    ✓ Create first record
    ✓ Search and find record

  Data management:
    ✓ Create multiple records
    ✓ Edit existing record
    ✓ Delete record
    ✓ Handle duplicates

  Search workflow:
    ✓ Single tag search
    ✓ Multi-tag search (AND logic)
    ✓ Tag cloud navigation
    ✓ Empty results handling

  Import/Export:
    ✓ Export all data
    ✓ Import from file
    ✓ Handle invalid formats
    ✓ Preserve timestamps
```

**E2E Testing Rules**:

- Run against production-like environment
- Use real database (isolated)
- No mocking except external services
- Performance benchmarks included
- Cross-browser testing required

## Test Data Management

### Test Data Principles

1. **Isolation**: Each test uses independent data
2. **Repeatability**: Same input produces same output
3. **Clarity**: Test data clearly shows intent
4. **Realism**: Data resembles production usage

### Test Fixtures

```
Standard Test Records:
  minimal: "todo"
  typical: "meeting project alpha 15:00 tomorrow"
  maximal: [50 tags at maximum length]
  unicode: "café münchen 北京 🚀"
  special: "tag-with-dash tag_with_underscore"

Edge Cases:
  empty: ""
  whitespace: "   "
  duplicates: "todo todo todo"
  forbidden: "tag{} tag[] tag:"
```

### Database Test Helpers

```
Test Database Management:
  Before Suite:
    - Create test database
    - Run migrations
    - Verify schema

  Before Each Test:
    - Begin transaction
    - Insert test user
    - Reset sequences

  After Each Test:
    - Rollback transaction
    - Clear cache

  After Suite:
    - Drop test database
```

## Testing Standards

### Naming Conventions

| Test Type   | File Pattern            | Test Pattern                       |
| ----------- | ----------------------- | ---------------------------------- |
| Unit        | `*.test.ts`             | `describe('ComponentName')`        |
| Integration | `*.integration.test.ts` | `describe('Integration: Feature')` |
| E2E         | `*.e2e.test.ts`         | `test('User journey: Action')`     |

### Assertion Standards

```
Assertions must be:
  ✓ Specific - test one behavior
  ✓ Descriptive - clear failure messages
  ✓ Independent - no test order dependency
  ✓ Fast - <100ms for unit tests
  ✓ Deterministic - no random failures
```

### Test Documentation

Each test file must include:

```typescript
/**
 * @description Tests for [Component/Feature]
 * @requirements Links to PRD sections
 * @performance Expected execution time
 */
```

## CI/CD Integration

### Pipeline Stages

```yaml
Test Pipeline:
  1. Lint:
    - ESLint rules
    - Prettier formatting

  2. Unit Tests:
    - Run in parallel
    - Coverage report
    - Fail if <90%

  3. Integration Tests:
    - Sequential execution
    - Database required
    - API contract validation

  4. E2E Tests:
    - Browser tests
    - Performance metrics
    - Screenshot on failure

  5. Security Scan:
    - Dependency audit
    - OWASP checks
```

### Test Execution Requirements

| Environment | Trigger    | Requirements     | Timeout |
| ----------- | ---------- | ---------------- | ------- |
| Local       | Pre-commit | Unit tests       | 30s     |
| CI - PR     | On push    | All tests        | 5 min   |
| CI - Main   | On merge   | Full suite + E2E | 10 min  |
| Nightly     | Scheduled  | Extended E2E     | 30 min  |

### Coverage Enforcement

```yaml
Coverage Gates:
  Block Merge If:
    - Overall coverage < 85%
    - New code coverage < 90%
    - Critical path coverage < 100%
    - Domain layer coverage < 95%

  Coverage Reports:
    - HTML report in artifacts
    - Comment on PR
    - Track trends over time
```

## Performance Testing

### Response Time Requirements

| Operation        | Acceptable | Target | Maximum |
| ---------------- | ---------- | ------ | ------- |
| Unit test        | <10ms      | <5ms   | 100ms   |
| Integration test | <100ms     | <50ms  | 500ms   |
| E2E test         | <5s        | <2s    | 10s     |
| API endpoint     | <200ms     | <100ms | 500ms   |

### Load Testing Scenarios

```
Concurrent Users Test:
  - 10 concurrent: All operations <200ms
  - 50 concurrent: Search <500ms
  - 100 concurrent: No errors, <1s response

Data Volume Test:
  - 100 records: Search <50ms
  - 1,000 records: Search <100ms
  - 10,000 records: Search <200ms
  - 100,000 records: Search <500ms
```

## Test Debugging

### Debugging Helpers

```
Test Utilities:
  - Test ID attributes for components
  - Verbose logging in test mode
  - Database query logging
  - Network request interception
  - Time-travel debugging
```

### Troubleshooting Guide

| Issue           | Debug Steps                             |
| --------------- | --------------------------------------- |
| Flaky test      | Add retry logic, check async operations |
| Slow test       | Profile code, check database queries    |
| False positive  | Verify assertions, check mocks          |
| CI-only failure | Check environment variables, timezone   |

## Code Review Checklist

### TDD Verification

- [ ] Test commits appear before implementation
- [ ] Tests follow AAA pattern (Arrange, Act, Assert)
- [ ] All edge cases covered
- [ ] No commented-out tests
- [ ] Tests are independent
- [ ] Clear test descriptions
- [ ] No test.skip() without explanation
- [ ] Coverage meets requirements

### Review Questions

1. Can I understand what the code does by reading tests?
2. Do tests document business requirements?
3. Will tests catch regressions?
4. Are tests maintainable?
5. Do tests run quickly?

## Anti-Patterns to Avoid

### Testing Anti-Patterns

| Anti-Pattern             | Description                  | Better Approach                        |
| ------------------------ | ---------------------------- | -------------------------------------- |
| **Test After**           | Writing tests after code     | Always test first                      |
| **100% Mocking**         | Over-mocking dependencies    | Use real implementations when possible |
| **Brittle Tests**        | Tests tied to implementation | Test behavior, not implementation      |
| **Slow Tests**           | Tests taking seconds         | Optimize or move to integration        |
| **Test Interdependence** | Tests requiring order        | Each test independent                  |
| **Missing Assertions**   | Tests without expect()       | Always verify outcomes                 |
| **God Tests**            | Testing everything at once   | One concept per test                   |

## References

- [Test-Driven Development by Example - Kent Beck](https://www.amazon.com/Test-Driven-Development-Kent-Beck/dp/0321146530)
- [Growing Object-Oriented Software Guided by Tests](https://www.amazon.com/Growing-Object-Oriented-Software-Guided-Tests/dp/0321503627)
- [Testing Library Principles](https://testing-library.com/docs/guiding-principles/)
- [Jest Best Practices](https://jestjs.io/docs/best-practices)

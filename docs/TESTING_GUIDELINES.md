# Testing Guidelines for Future Development

## 🚨 Critical Rule: Integration Tests MUST Use Real Dependencies

### The Problem

In recent development sessions, integration tests were created using mocks instead of real database connections (Testcontainers). This defeats the purpose of integration testing and can lead to:

- False confidence in database interactions
- Missed schema/migration issues
- Inconsistencies between test and production behavior
- Wasted effort on mock setup that doesn't reflect reality

### The Solution

#### Use This Decision Matrix

| Test Purpose              | Dependencies    | Test Type            | Tools                      |
| ------------------------- | --------------- | -------------------- | -------------------------- |
| Individual function logic | Mocked          | **Unit Test**        | Jest + Mocks               |
| Database interactions     | Real PostgreSQL | **Integration Test** | Jest + Testcontainers      |
| Migration behavior        | Real PostgreSQL | **Integration Test** | Jest + Testcontainers      |
| API + Database            | Real DB + HTTP  | **Integration Test** | Testcontainers + Supertest |

#### Integration Test Template

```typescript
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

describe('Feature Integration Tests', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    // 🐳 MANDATORY: Real PostgreSQL container
    container = await new PostgreSqlContainer('postgres:15').start();

    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      database: container.getDatabase(),
      username: container.getUsername(),
      password: container.getPassword(),
      synchronize: false,
      dropSchema: false,
      logging: ['error'],
      entities: [],
      migrations: [
        /* your migrations */
      ],
      migrationsTableName: 'migration_history',
    });

    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  // Real integration tests here...
});
```

### Automatic Detection

We've implemented validation that detects:

- Files named `*integration.test.ts` without `@testcontainers` imports
- Database operation testing with mocks (`QueryRunner`, `DataSource`, migrations)
- Test descriptions containing "integration" but using mocks

Run validation:

```bash
yarn test:validate
```

### File Naming Convention

```bash
# Unit tests (isolated logic with mocks)
*.test.ts
*-unit.test.ts

# Integration tests (real dependencies)
*-integration.test.ts
*-contract.test.ts

# End-to-end tests
*.e2e.test.ts
*.spec.ts
```

### Red Flags to Watch For

❌ **Anti-patterns:**

- `mockQueryRunner` in migration tests
- `jest.fn()` for database operations
- "Integration test" descriptions with mocked dependencies
- Testing schema/constraints with fake objects

✅ **Correct patterns:**

- Real PostgreSQL containers for database testing
- Actual QueryRunner for migration testing
- Real DataSource for connection testing
- Mocks only for isolated unit logic

### Enforcement

1. **Pre-commit validation** warns about violations
2. **CLAUDE.md guidelines** provide clear instructions
3. **Validation script** identifies problematic patterns
4. **Code review checklist** includes test type verification

### Future Sessions

**Before ANY development using external libraries:**

1. **Use Context7 MCP** to get current documentation (TypeORM, React, Jest, Playwright, etc.)
2. **For database testing:** Follow the integration test template with Testcontainers
3. **For all testing:** Use decision matrix to choose appropriate test type
4. **Validation runs automatically** on commit

Before creating any test file, ask:

- "Does this test interact with a database?" → Use Testcontainers
- "Am I testing real system behavior?" → Use Testcontainers
- "Am I testing isolated logic only?" → Use mocks

**Remember: If you're testing how code interacts with real systems, use real systems!**

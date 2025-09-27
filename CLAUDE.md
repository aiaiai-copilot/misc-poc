# TaskMaster Project Standards & Guidelines

## 🎯 CORE PRINCIPLES

**These principles define HOW we work on this project:**

### 1. TEST-DRIVEN DEVELOPMENT

**All code must be developed using TDD with specifications from prd.txt**

- Test specifications location: `.taskmaster/docs/prd.txt`
- Follow the TDD cycle: Red → Green → Refactor
- Write tests BEFORE implementation (Red phase)
- Implement minimum code to pass tests (Green phase)
- Refactor while keeping tests green (Refactor phase)
- Test cases must be copied exactly from prd.txt specifications
- Never create test cases based on assumptions
- Exception: Configuration and setup tasks may not require tests

### 2. REAL DATABASE TESTING

**Database interactions must be tested with real databases**

- Use Testcontainers with PostgreSQL for all database tests
- Never mock database operations, migrations, or queries
- Integration tests must use actual database connections

### 3. CURRENT DOCUMENTATION

**Always use up-to-date documentation via Context7 MCP**

- Get current docs BEFORE using any external library
- Never rely on potentially outdated knowledge
- Applies to all external dependencies

### 4. BUILD QUALITY GATES

**All code must pass quality checks before commit**

- Required checks: `yarn build && yarn typecheck && yarn lint && yarn test`
- No commit should be made if any check fails
- Fix all errors before proceeding

### 5. INCREMENTAL DELIVERY

**Work must be completed incrementally with validation**

- One subtask at a time with approval between each
- Manual testing approval required before every commit
- Clear progress tracking and status updates

---

## 🧪 TESTING STANDARDS

### Test Classification

| Test Type   | Dependencies | When to Use             | Tools                 | Speed            | Coverage |
| ----------- | ------------ | ----------------------- | --------------------- | ---------------- | -------- |
| Unit        | Mocked       | Isolated logic          | Jest + Mocks          | Fast (ms)        | Wide     |
| Integration | Real         | Database/API operations | Jest + Testcontainers | Medium (seconds) | Deep     |
| E2E         | Full stack   | User workflows          | Playwright/Cypress    | Slow (minutes)   | Complete |

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

### Integration Test Template

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

### Testing Anti-Patterns

**❌ WRONG: Mock-based "Integration" Test**

```typescript
// DON'T DO THIS - This is a unit test disguised as integration test
describe('Migration Integration Test', () => {
  const mockQueryRunner = {
    createTable: jest.fn(),
  };

  it('should run migration', async () => {
    await migration.up(mockQueryRunner as any); // ❌ FAKE INTEGRATION
  });
});
```

**✅ CORRECT: Real Integration Test**

```typescript
// DO THIS - Real database testing
describe('Migration Integration Test', () => {
  let container: StartedPostgreSqlContainer;
  let queryRunner: QueryRunner;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15').start();
    // ... real setup
  });

  it('should run migration on real database', async () => {
    await migration.up(queryRunner); // ✅ REAL INTEGRATION
    const table = await queryRunner.getTable('users');
    expect(table).toBeDefined();
  });
});
```

### Test Quality Requirements

1. **Type Safety**: No `any` types in test code
2. **Cleanup**: Proper resource disposal (`afterAll`, `beforeEach`)
3. **Isolation**: Tests don't depend on each other
4. **Assertions**: Clear, specific expectations
5. **Performance**: Integration tests complete within 30 seconds

---

## 🎨 E2E TESTING STANDARDS

### When Adding New UI Components

1. CREATE new E2E tests in `e2e/` following naming `XX-feature-name.spec.ts`
2. UPDATE page objects in `e2e/support/page-objects/`
3. TEST all user interactions and accessibility
4. VERIFY error scenarios and edge cases

### When Modifying Existing UI

1. UPDATE affected E2E tests to match new behavior
2. MODIFY page object methods if selectors change
3. VERIFY backward compatibility
4. TEST transition periods

### When Removing UI Features

1. REMOVE corresponding E2E tests
2. CLEAN UP page object methods
3. UPDATE dependent test suites

### E2E Coverage Requirements

- **Functionality**: Core features work as expected
- **User flows**: Complete journeys from start to finish
- **Error handling**: Graceful failure and recovery
- **Accessibility**: Keyboard navigation, focus management, ARIA
- **Cross-component integration**: Component interactions
- **Data integrity**: CRUD operations

### E2E Quality Standards

- Use semantic selectors (`data-testid`)
- Write descriptive test names (Given-When-Then)
- Include multilingual content support
- Test realistic scenarios
- Maintain test independence
- Clean up test data between tests

---

## 📚 CONTEXT7 MCP USAGE

Use Context7 to get current documentation for ANY external library:

```javascript
// Step 1: Resolve library ID
mcp__context7__resolve - library - id('library-name');

// Step 2: Get documentation with specific topic
mcp__context7__get -
  library -
  docs('/resolved/library-id', {
    topic: 'specific-feature', // e.g., "migrations", "testing"
    tokens: 8000, // increase for complex topics
  });
```

**Always get documentation BEFORE using any external library or framework.**

---

## 🏗️ BRANCHING STRATEGY

### Branch Hierarchy

- **Parent tasks** (have subtasks) → Create new branch
- **Leaf tasks** (no subtasks) → Work on parent's branch

### Branch Naming

- Format: `task/<id>-<description>`
- Use lowercase, hyphens for spaces
- Keep under 50 characters

### Merge Strategy

- **Top-level branches** → Merge into `main`
- **Intermediate branches** → Merge into parent branch
- **Leaf tasks** → Already on parent branch (no merge)

### Pull Request Rules

- **Top-level tasks** → PR to `main`
- **Intermediate tasks** → PR to parent branch
- **Leaf tasks** → No PR needed

---

## 🚀 WORKFLOW AUTOMATION

### Available Commands

**TaskMaster Commands (enforce all workflow rules automatically):**

- `/next-task` - Start work on next priority task
- `/complete-subtask` - Complete current subtask with validation
- `/complete-task` - Finalize current task and create PR

**Commands enforce:**

- TDD approach (Red → Green → Refactor)
- One subtask at a time workflow
- Mandatory build validation before commits
- Manual testing approval gates
- Proper git branching strategy
- Automated PR creation

### Command Location

Place command files in:

- `.claude/commands/` - Project-specific commands (shared with team)
- `~/.claude/commands/` - Personal commands (user-specific)

### Workflow Sequence

1. **Start**: `/next-task` → Opens prd.txt, starts TDD cycle
2. **Work**: Implement one subtask following TDD (tests first)
3. **Complete Subtask**: `/complete-subtask` → Validates and commits
4. **Repeat**: For each subtask (with approval between)
5. **Finish**: `/complete-task` → Creates PR when all done

---

## 📁 PROJECT REFERENCES

- **Test Specifications**: `.taskmaster/docs/prd.txt`
- **Task Definitions**: `.taskmaster/tasks/tasks.json`
- **E2E Tests**: `e2e/`
- **E2E Guidelines**: `e2e/README.md`
- **TaskMaster CLI**: `.taskmaster/CLAUDE.md`

---

## 🚫 COMMON ANTI-PATTERNS

### Testing Anti-Patterns

- ❌ Mocking database interactions instead of using Testcontainers
- ❌ Creating test cases without checking prd.txt
- ❌ Skipping integration tests for database operations
- ❌ Using `any` types in test code

### Development Anti-Patterns

- ❌ Using libraries without checking Context7 documentation
- ❌ Committing code that fails build validation
- ❌ Skipping TDD for coding tasks
- ❌ Creating branches for leaf tasks

### Quality Anti-Patterns

- ❌ Ignoring TypeScript errors
- ❌ Skipping cleanup in tests
- ❌ Tests that depend on execution order
- ❌ Integration tests taking longer than 30 seconds

---

## 📝 IMPORT TASKMASTER WORKFLOW

**For workflow commands and operational procedures:**
@./.taskmaster/CLAUDE.md

---

_This document defines the technical standards and principles for the project. For specific workflow instructions, use the appropriate slash commands or refer to the TaskMaster documentation._

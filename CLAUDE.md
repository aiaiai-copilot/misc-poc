# TaskMaster Automation Instructions for Claude

## 🔴 PRIMARY RULES - APPLY TO EVERY TASK AND SUBTASK

**These rules override everything else and apply to ALL work in this project:**

### 1. ONE SUBTASK AT A TIME RULE

**NEVER implement multiple subtasks together**

- **⚠️ CRITICAL: Complete ONE subtask → Get approval → Commit → ONLY THEN start next subtask**
- If task has subtasks (e.g., 3.1, 3.2, 3.3), do them according to their interdependency (as a rule - sequentially):
  1. Complete subtask 3.1 FULLY (implement, test, get approval, commit)
  2. STOP and inform user: "Subtask 3.1 complete. Ready to start subtask 3.2?"
  3. Wait for user confirmation before proceeding
  4. ONLY after user approval, start subtask 3.2
- **NEVER jump ahead to next subtask without completing current one**
- **NEVER implement entire task at once if it has subtasks**

### 2. COMMIT APPROVAL RULE

**NEVER commit without explicit user approval**

- After EVERY task/subtask implementation
- Ask: "Ready for manual testing before commit?"
- WAIT for user response (DO NOT PROCEED WITHOUT APPROVAL)
- User may request fixes - implement them before asking again
- Only commit after user explicitly says "yes", "proceed", or gives clear approval

### 3. TDD WITH PRD.TXT RULE

**ALWAYS use Test-Driven Development with specifications from prd.txt (when applicable)**

- **⚠️ APPLIES TO:** Tasks that involve writing code (features, components, APIs, migrations, etc.)
- **⚠️ DOES NOT APPLY TO:** Configuration tasks, documentation, setup, environment settings, dependency updates, etc.
- **For coding tasks, CRITICAL SEQUENCE:**
  1. **OPEN** `~/projects/misc-poc/.taskmaster/docs/prd.txt`
  2. **FIND** the test specification for your current task/subtask
  3. **READ** the complete test requirements
  4. **COPY** test cases exactly as specified (DO NOT create your own)
  5. **WRITE** tests following the prd.txt specification
  6. **RUN** tests (expect failure)
  7. **IMPLEMENT** feature to make tests pass
  8. **RUN** tests again (expect success)
- **NEVER write tests based on assumptions - ONLY from prd.txt specifications**
- **For non-coding tasks:** Skip TDD and proceed directly with implementation

### 4. DATABASE TESTING RULE

**ALWAYS use Testcontainers for database tests**

- ANY test interacting with database = use real PostgreSQL container
- NEVER mock database operations, migrations, or queries
- Use integration test templates from Technical Details section

### 5. DOCUMENTATION RULE

**ALWAYS get current docs via Context7 MCP**

- Before using ANY external library/framework
- Command sequence: resolve-library-id → get-library-docs
- Never rely on potentially outdated knowledge
- This includes: ORMs, frameworks, testing tools, build tools, etc.

### 6. BUILD VALIDATION RULE

**ALWAYS validate build before completion**

- Run ALL commands: `yarn build && yarn typecheck && yarn lint && yarn test`
- Fix ANY errors before proceeding
- This applies to both subtasks and main tasks

## ⚠️ If you forget these primary rules, the user will reject your work

---

## 📋 STANDARD TASK WORKFLOW

### Pre-Task Mental Checklist

Before starting ANY task, verify understanding of:

- [ ] **For coding tasks: I will open `~/projects/misc-poc/.taskmaster/docs/prd.txt` FIRST**
- [ ] For coding tasks: I will find and read the test specification for this exact task
- [ ] For coding tasks: I will copy test cases from prd.txt, not create my own
- [ ] TDD approach will be used (for coding tasks only)
- [ ] Manual testing approval required before commits (always)
- [ ] Testcontainers for database tests (when applicable)
- [ ] Context7 for library documentation (when using external libraries)

### Phase 1: Task Selection & Setup

```bash
# 1. Check for unmerged PRs
gh pr list --state=open

# 2. Sync with main
git checkout main
git pull origin main

# 3. Get next task
tm next

# If there are unmerged PRs: STOP and notify user to merge them first
# Only proceed after PRs are merged and changes pulled
```

**⚠️ CRITICAL: If the selected task has subtasks:**

- DO NOT implement the entire task at once
- Start with the FIRST subtask only
- Complete subtask → Get approval → Commit → Ask permission for next subtask
- Example: Task 3 has subtasks 3.1, 3.2, 3.3
  - Do ONLY 3.1 first
  - After 3.1 is committed, ask: "Subtask 3.1 complete. Should I proceed with 3.2?"
  - Wait for user confirmation before starting 3.2

### Phase 2: Branch Creation Strategy

**Branch only for parent tasks (tasks with subtasks):**

- Task has subtasks → CREATE branch: `task/<id>-<description>`
- Task has NO subtasks → WORK on parent's branch

**Hierarchical Branching Examples:**

- Task 3 "Database Migration" (has 3.1, 3.2, 3.3) → CREATE `task/3-database-migration` from `main`
- Task 3.1 "Setup ORM" (has 3.1.1, 3.1.2) → CREATE `task/3.1-setup-orm` from `task/3-database-migration`
- Task 3.1.1 "Install deps" (leaf task) → WORK ON `task/3.1-setup-orm` (no new branch)
- Task 3.2 "Create migrations" (no subtasks) → WORK ON `task/3-database-migration` (no new branch)

**Merging Hierarchy:**

- **Top-level branches** (`task/3-database-migration`) → Merge into `main`
- **Intermediate branches** (`task/3.1-setup-orm`) → Merge into parent branch
- **Leaf tasks** → Already on parent branch (no merge needed)

**Pull Request Rules:**

- **Top-level tasks** → CREATE PR to merge into `main`
- **Intermediate tasks** → CREATE PR to merge into parent task branch
- **Leaf tasks** → NO PR (work is already on parent branch)

**Branch Naming:**

- Format: `task/<id>-<description>`
- Use lowercase, hyphens for spaces
- Keep description under 50 characters

**Why this prevents integration problems:**

- Clear hierarchy matches TaskMaster structure
- All related work flows upward to correct parent branch
- No scattered commits across unrelated branches
- Complete features assembled hierarchically before reaching main

```bash
# Set task to in-progress
tm set-status --id=<id> --status=in-progress
```

### Phase 3: Implementation Checklist

**For EACH task/subtask:**

- [ ] **FIRST: Open `~/projects/misc-poc/.taskmaster/docs/prd.txt` and find test spec for current task**
- [ ] Copy exact test requirements from prd.txt (don't improvise)
- [ ] Write tests exactly as specified in prd.txt
- [ ] Use Context7 for library documentation
- [ ] Use Testcontainers for database tests
- [ ] Implement feature to pass tests
- [ ] Run build validation: `yarn build && yarn typecheck && yarn lint && yarn test`
- [ ] Ask user: "Ready for manual testing before commit?"
- [ ] WAIT for explicit approval
- [ ] Commit only after approval

**Subtask-Specific Workflow:**
**⚠️ MANDATORY: Complete subtasks ONE AT A TIME**

After completing EACH subtask:

1. Complete ONLY the current subtask implementation
2. Run MANDATORY build validation (all commands must pass)
3. Ask: "Subtask X.Y complete. Do you want to test manually before committing?"
4. ⚠️ STOP AND WAIT - DO NOT PROCEED WITHOUT APPROVAL
5. After approval: commit changes for this subtask
6. Update subtask status: `tm set-status --id=<subtask-id> --status=done`
7. **STOP and ask: "Subtask X.Y committed. Should I proceed with subtask X.Z?"**
8. **WAIT for user confirmation before starting next subtask**
9. **NEVER automatically continue to next subtask**

**Example Flow:**

```
Task 3.1 has subtasks 3.1.1, 3.1.2, 3.1.3
- Implement 3.1.1 → Test → Approve → Commit
- STOP: "Subtask 3.1.1 complete. Ready for 3.1.2?"
- User: "Yes, proceed"
- Implement 3.1.2 → Test → Approve → Commit
- STOP: "Subtask 3.1.2 complete. Ready for 3.1.3?"
- And so on...
```

**Remember:**

- 📍 **ALWAYS read `~/projects/misc-poc/.taskmaster/docs/prd.txt` BEFORE writing any test**
- 📍 TDD - Write tests from prd.txt specifications (never improvise test cases)
- 📍 Use Context7 for library docs
- 📍 Database tests need Testcontainers
- 📍 Ask for manual testing approval before EVERY commit

### Phase 4: Task Completion

```bash
# 1. Run MANDATORY build validation
yarn build && yarn typecheck && yarn lint && yarn test
# If ANY command fails, fix errors before proceeding

# 2. Update task status BEFORE final commit
tm set-status --id=<id> --status=done

# 3. Ask for final manual testing approval
# "Ready for manual testing before final commit?"
# ⚠️ STOP AND WAIT FOR USER RESPONSE - DO NOT PROCEED ⚠️

# 4. After explicit approval, commit with status change
git add .
git commit -m "feat: implement task #<id> - <brief description>"

# 5. Push branch
git push -u origin task/<id>-<description>

# 6. Create PR (only for parent tasks)
# - Top-level tasks → PR to main
# - Intermediate tasks → PR to parent branch
# - Leaf tasks → NO PR (already on parent branch)
gh pr create --title "Task #<id>: <title>" --body "Implements task #<id>"

# 7. Return to main
git checkout main
git pull origin main
```

**CRITICAL: Never switch to main during active task work. Stay on task branch throughout implementation, including status updates.**

---

## 🔧 TECHNICAL DETAILS

### Testing Strategy

#### Test Classification

| Test Type   | Dependencies | When to Use             | Tools                 | Speed            | Coverage |
| ----------- | ------------ | ----------------------- | --------------------- | ---------------- | -------- |
| Unit        | Mocked       | Isolated logic          | Jest + Mocks          | Fast (ms)        | Wide     |
| Integration | Real         | Database/API operations | Jest + Testcontainers | Medium (seconds) | Deep     |
| E2E         | Full stack   | User workflows          | Playwright/Cypress    | Slow (minutes)   | Complete |

#### File Naming Convention

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

#### Integration Test Detection

**Automatically use Testcontainers when testing:**

- ✅ Database migrations (`up()`, `down()` methods)
- ✅ Database queries (`QueryRunner`, `Repository` operations)
- ✅ Schema validation (tables, indexes, constraints)
- ✅ Database connections and configurations
- ✅ Transaction behavior
- ✅ Data integrity and constraints
- ✅ Performance with real data volumes

#### Integration Test Template (with Testcontainers)

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

#### Testing Anti-Patterns to Avoid

**❌ WRONG: Mock-based "Integration" Test**

```typescript
// DON'T DO THIS - This is a unit test disguised as integration test
describe('Migration Integration Test', () => {
  const mockQueryRunner = {
    createTable: jest.fn(),
    // ... more mocks
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
    // Verify with real database queries
    const table = await queryRunner.getTable('users');
    expect(table).toBeDefined();
  });
});
```

#### Test Quality Gates

All tests must pass these gates before commit:

1. **Type Safety**: No `any` types in test code
2. **Cleanup**: Proper resource disposal (`afterAll`, `beforeEach`)
3. **Isolation**: Tests don't depend on each other
4. **Assertions**: Clear, specific expectations
5. **Performance**: Integration tests complete within 30 seconds

#### Validation Rules

**Automatic Red Flags:**

- File named `*integration.test.ts` without `@testcontainers` import
- Testing `QueryRunner`, `DataSource`, or migration classes with mocks
- Testing database schema/constraints with fake objects
- Using `jest.fn()` for database operations that should be real

**Code Review Check:**

```bash
# Flag integration tests without Testcontainers
grep -r "integration\.test\.ts" --include="*.ts" | \
  xargs grep -L "@testcontainers" | \
  if read; then echo "❌ Integration tests must use Testcontainers"; exit 1; fi
```

### E2E Testing Requirements

#### Mandatory E2E Test Actions

**✅ When Adding New UI Components:**

1. CREATE new E2E tests in `e2e/` following naming `XX-feature-name.spec.ts`
2. UPDATE page objects in `e2e/support/page-objects/` with new selectors
3. TEST all user interactions: clicks, keyboard navigation, form submissions
4. VERIFY accessibility: keyboard navigation, ARIA labels, screen reader support
5. INCLUDE error scenarios: invalid inputs, network failures, edge cases

**📝 When Modifying Existing UI:**

1. UPDATE affected E2E tests to match new behavior/selectors
2. MODIFY page object methods if selectors or interactions change
3. VERIFY backward compatibility or update tests accordingly
4. TEST both old and new user flows during transition periods

**❌ When Removing UI Features:**

1. REMOVE corresponding E2E tests for deleted functionality
2. CLEAN UP page object methods that are no longer needed
3. UPDATE test suites that depend on removed features
4. VERIFY remaining tests still pass after cleanup

#### E2E Test Coverage Checklist

For EVERY UI change, ensure tests cover:

- [ ] **Functionality**: Core feature works as expected
- [ ] **User flows**: Complete user journeys from start to finish
- [ ] **Error handling**: Graceful failure and recovery
- [ ] **Accessibility**: Keyboard navigation, focus management, ARIA
- [ ] **Cross-component integration**: How changes affect other UI parts
- [ ] **Data integrity**: For features involving data (export/import, CRUD)

#### E2E Test Quality Standards

- Use semantic selectors: Prefer `data-testid` over CSS classes
- Write descriptive test names: Clear Given-When-Then structure
- Include multilingual content: Match application's language usage
- Test real scenarios: Use realistic data and user behaviors
- Maintain test independence: Each test should run in isolation
- Clean up test data: Always reset state between tests

**Non-Negotiable:** NO UI changes without corresponding E2E test updates. ALL E2E tests MUST pass before committing.

### Context7 MCP Usage

**Before using any external library:**

```javascript
// Step 1: Resolve library ID
mcp__context7__resolve - library - id('library-name');

// Step 2: Get documentation
mcp__context7__get -
  library -
  docs('/org/library-name', {
    topic: 'specific-feature',
    tokens: 8000,
  });
```

#### Comprehensive Library ID Reference

**Backend & Database:**

- TypeORM → `/typeorm/typeorm`
- Prisma → `/prisma/prisma`
- Node.js → `/nodejs/node`
- Express → `/expressjs/express`
- Fastify → `/fastify/fastify`
- PostgreSQL drivers → Resolve via Context7

**Frontend & UI:**

- React → `/facebook/react`
- Vue → `/vuejs/vue`
- Angular → `/angular/angular`
- Vite → `/vitejs/vite`
- Webpack → `/webpack/webpack`
- TypeScript → `/microsoft/typescript`

**Testing Tools:**

- Jest → `/jestjs/jest`
- Vitest → `/vitest/vitest`
- Playwright → `/microsoft/playwright`
- Cypress → `/cypress/cypress`
- Testcontainers → `/testcontainers/testcontainers-node`

**Development Tools:**

- Docker → `/docker/docker`
- ESLint → `/eslint/eslint`
- Prettier → `/prettier/prettier`
- GitHub Actions → Resolve via Context7
- CI/CD tools → Resolve via Context7

**Always resolve library IDs for:**

- New library integrations
- Unfamiliar API patterns
- Version-specific features
- Complex configurations
- Best practices updates

---

## 🚀 QUICK REFERENCE

### When User Says "Work on next task" or "Implement task X"

1. **Check PR status:** Ensure previous PR merged
2. **Run task selection:** `tm next` or use specified ID
3. **CRITICAL: Check if task has subtasks**
   - If YES → Start with FIRST subtask only
   - If NO → Implement the single task
4. **Create branch:** Only if task has subtasks
5. **Set status:** Mark as in-progress (only current subtask)
6. **Implement with TDD:** Tests first (from prd.txt), code second
7. **Validate build:** All checks must pass
8. **Get approval:** Ask for manual testing
9. **Complete workflow:** Status update, commit, push
10. **For tasks with subtasks:** STOP and ask permission before next subtask

**⚠️ NEVER implement all subtasks at once - always one at a time with approval between each**

### Common Pitfalls to Avoid

❌ **DON'T:**

- Implement multiple subtasks before getting approval for each
- Automatically continue to next subtask without asking
- Implement entire task at once when it has subtasks
- Commit without user approval
- Skip TDD approach or ignore prd.txt specifications
- Mock database interactions
- Assume library APIs without checking Context7
- Update task status after pushing
- Create branches for leaf tasks
- Skip build validation

✅ **DO:**

- Complete ONE subtask at a time
- Ask for permission before starting next subtask
- Always ask for manual testing approval before commits
- Check `~/projects/misc-poc/.taskmaster/docs/prd.txt` for test specs
- Use Testcontainers for DB tests
- Get fresh docs via Context7
- Update status before final commit
- Work on parent branch for leaf tasks
- Fix all validation errors before proceeding

---

## 📁 Project Structure References

- **TEST SPECIFICATIONS (MANDATORY):** `~/projects/misc-poc/.taskmaster/docs/prd.txt`
- Task definitions: `.taskmaster/tasks/tasks.json`
- E2E tests: `e2e/`
- E2E guidelines: `e2e/README.md`
- Additional TaskMaster instructions: `.taskmaster/CLAUDE.md`

**⚠️ CRITICAL: Always read test specifications from prd.txt BEFORE writing any tests!**

---

## 🔒 Security & Safety Considerations

### When Working with External Tools

- Always validate inputs and outputs
- Use proper error handling for all external API calls
- Never expose sensitive credentials in code or commits
- Follow security best practices for the specific tools being used

---

## 📝 Import Statement

**Import Task Master's development workflow commands and guidelines:**
@./.taskmaster/CLAUDE.md

_The imported TaskMaster instructions complement these project-specific guidelines._

---

**Final Reminder: The PRIMARY RULES section is your north star. When in doubt, refer back to those five rules. If you forget them, the user's work will be disrupted and require manual intervention.**

# ⚠️ CRITICAL: Validation Rules for Future Sessions

## 🔴 READ THIS FIRST - Test Validation Requirements

This project has **TWO validation modes** for a reason. **DO NOT skip integration tests when they matter!**

---

## Quick Decision Tree

```
Are you changing...
├─ Database (schema, migrations, queries, indexes)? → validate:all ✅
├─ Repository layer or data access code? → validate:all ✅
├─ Performance optimizations or query tuning? → validate:all ✅
├─ API + Database integration? → validate:all ✅
├─ Caching, Redis, background jobs? → validate:all ✅
├─ Batch operations or large datasets? → validate:all ✅
├─ Code tested by Testcontainers? → validate:all ✅
├─ UI/frontend without backend? → validate ⚡
├─ Documentation only? → validate ⚡
├─ Simple utility functions? → validate ⚡
└─ Not sure? → validate:all ✅ (safer!)
```

---

## The Two Commands

### `yarn validate` ⚡ (Fast: ~2-3 minutes)

**What it does:**

- Build + TypeScript + Lint + Unit Tests
- **Excludes** integration tests tagged with `[perf]`
- **Skips** Testcontainers (PostgreSQL, Redis)

**When to use:**

- ✅ UI/frontend changes without backend
- ✅ Documentation updates
- ✅ Simple utility functions (pure logic)
- ✅ Configuration files (non-database)

**When NOT to use:**

- ❌ Database-related changes
- ❌ Performance-critical code
- ❌ Integration between services

---

### `yarn validate:all` ✅ (Complete: ~6-8 minutes)

**What it does:**

- Build + TypeScript + Lint + **ALL Tests**
- **Includes** integration tests with Testcontainers
- **Includes** performance tests with large datasets

**🔴 MANDATORY for these changes:**

1. **Database**
   - Schema changes
   - Migrations (create, modify, rollback)
   - Query changes or optimizations
   - Index creation/modification
   - Constraints, triggers, functions

2. **Repository Layer**
   - PostgreSQL repository implementations
   - Data access layer changes
   - Transaction handling
   - Batch operations

3. **Performance**
   - Query optimization
   - Index tuning
   - Caching strategies
   - Large dataset processing

4. **Integration**
   - API + Database interactions
   - API + Cache (Redis) interactions
   - Background jobs or async operations
   - Service-to-service communication

5. **Infrastructure**
   - Redis caching implementation
   - Queue/job processing
   - Testcontainer-tested code

---

## Why This Matters

### Integration Tests Exist For A Reason

**Unit tests mock everything** → They don't catch:

- ❌ SQL syntax errors in real PostgreSQL
- ❌ Migration script failures
- ❌ Index performance issues
- ❌ Transaction deadlocks
- ❌ Cache invalidation bugs
- ❌ Real-world timing issues

**Integration tests use real systems** → They catch:

- ✅ Actual database behavior
- ✅ Migration success/failure
- ✅ Query performance problems
- ✅ Data integrity issues
- ✅ Real caching behavior
- ✅ Actual system integration

### The Cost of Skipping Integration Tests

**If you skip integration tests on database changes:**

1. **Unit tests pass** ✅ (mocks are happy)
2. **You commit the code** ✅ (pre-commit only runs fast tests)
3. **Integration tests fail in CI** ❌ (real database rejects your code)
4. **You waste time** ⏰ (debug, fix, re-commit, wait for CI again)
5. **Team is blocked** 🚫 (broken main branch)

**If you run `validate:all` before commit:**

1. **Integration tests fail locally** ❌ (you find the issue immediately)
2. **You fix it right away** 🔧 (5 minutes of debugging)
3. **You commit working code** ✅ (CI passes on first try)
4. **Team is happy** 😊 (main branch stable)

---

## Pre-Commit Hook Behavior

**Current pre-commit hook runs:**

- ESLint + Prettier (always)
- **Fast tests only** (excludes `[perf]` tagged tests)

**This means:**

- ✅ Fast commits (~30 seconds)
- ⚠️ Integration tests NOT run automatically
- 🔴 **You MUST manually run `validate:all` for critical changes**

---

## Examples

### ❌ WRONG: Skipping Integration Tests

```bash
# Changing database migration
vim packages/backend/src/infrastructure/database/migrations/...

# Only running fast tests (BAD!)
yarn validate   # ❌ Skips migration integration tests

git commit -m "Add migration"  # ❌ Integration tests not verified
# Later: CI fails, migration doesn't work in real PostgreSQL
```

### ✅ CORRECT: Running All Tests

```bash
# Changing database migration
vim packages/backend/src/infrastructure/database/migrations/...

# Running ALL tests including integration (GOOD!)
yarn validate:all   # ✅ Runs migration on real PostgreSQL

git commit -m "Add migration"  # ✅ Confident it works
# Later: CI passes, migration works perfectly
```

---

## Remember

**Integration tests are NOT optional for:**

- Database schema/migrations/queries
- Repository implementations
- Performance-critical code
- Service integrations
- Caching implementations

**The 6-8 minutes to run `validate:all` is:**

- ✅ Faster than debugging CI failures
- ✅ Faster than fixing broken production
- ✅ Faster than team being blocked
- ✅ The right thing to do

---

## When In Doubt

**🔴 If you're not 100% sure → use `yarn validate:all`**

Better to wait 6 minutes and be confident than to save 4 minutes and break things.

---

## Summary Table

| Change Type                | Command        | Time    | Why                    |
| -------------------------- | -------------- | ------- | ---------------------- |
| Database schema/migrations | `validate:all` | 6-8 min | Real DB needed         |
| Repository/data access     | `validate:all` | 6-8 min | Real DB needed         |
| Performance/caching        | `validate:all` | 6-8 min | Real systems needed    |
| API + DB integration       | `validate:all` | 6-8 min | Full stack needed      |
| UI/frontend only           | `validate`     | 2-3 min | Unit tests sufficient  |
| Documentation              | `validate`     | 2-3 min | No runtime impact      |
| Not sure                   | `validate:all` | 6-8 min | Better safe than sorry |

---

**This document is here to help future you (and future Claude sessions) make the right choice!** 🎯

# Fix Errors in Specific Package

Fix test failures or build errors in a specific package without running full validation.

## 🔴 CRITICAL CONTEXT

**This command is for fixing existing errors in a NEW SESSION**

When context is lost from previous session, this command:

1. Re-establishes Batch TDD rules
2. Focuses only on the problematic package
3. Ensures 100% tests pass in that package before completion

## 🎯 USAGE

This command should be called with a package parameter:

- `/fix-errors backend` - Fix errors in backend package
- `/fix-errors infrastructure/postgresql` - Fix errors in PostgreSQL package
- `/fix-errors application` - Fix errors in application package
- `/fix-errors domain` - Fix errors in domain package
- `/fix-errors web` - Fix errors in presentation/web package
- `/fix-errors shared` - Fix errors in shared package
- `/fix-errors e2e` - Fix E2E test failures

## 📋 EXECUTION WORKFLOW

### Phase 1: Context Recovery

1. **Identify the package to fix**:

   ```bash
   # Navigate to the specific package
   cd packages/<package-name>
   # or for nested packages
   cd packages/infrastructure/postgresql
   ```

2. **Understand current state**:

   ```bash
   # Check what's failing
   yarn test 2>&1 | head -50
   # See the error pattern
   ```

### Phase 2: Error Analysis

#### 🔴 MANDATORY RULES (Lost Context Recovery)

**REMEMBER: This project uses Batch TDD**

- ALL tests in the package MUST be GREEN before marking as fixed
- ZERO tolerance for red tests
- NO partial fixes - fix everything or continue fixing

#### Identify Error Types

1. **Test failures**: Tests that were written but implementation is wrong
2. **Build errors**: TypeScript, compilation issues
3. **Lint errors**: Code style violations
4. **Runtime errors**: Tests that crash or timeout

### Phase 3: Targeted Testing Loop

#### 🎯 Package-Specific Validation

```bash
# Run ONLY the package tests (faster feedback loop)
cd packages/<package-name>
yarn test

# If tests timeout, IMMEDIATELY increase timeout
yarn test --testTimeout=300000

# For specific test file issues
yarn test path/to/specific.test.ts --testTimeout=300000
```

#### ⏱️ TIMEOUT PROTOCOL (Critical for Performance Tests)

If tests timeout:

1. **DO NOT reduce test data or coverage**
2. **INCREASE timeout immediately**:

   ```bash
   # Package-level jest.config.js
   module.exports = {
     testTimeout: 300000, // 5 minutes minimum
   };
   ```

3. **Remember**: Performance tests NEED time - this is EXPECTED

### Phase 4: Incremental Fix Strategy

#### For Each Error

1. **Fix the error** (implementation, not tests)
2. **Run package tests** to verify fix:

   ```bash
   yarn test  # From package directory
   ```

3. **Check results**:
   - If MORE tests pass → Continue to next error
   - If tests STILL fail → Keep fixing same issue
   - If ALL tests pass → Proceed to validation

#### 🚫 NEVER

- Skip failing tests
- Comment out test cases
- Reduce test data to make them pass
- Use `test.skip()` without approval
- Proceed with ANY red tests

### Phase 5: Package Validation

#### 📋 PACKAGE FIX CHECKLIST

Before considering package fixed:

- [ ] All package tests pass (show exact numbers)
- [ ] Zero test failures in this package
- [ ] Zero timeouts (or increased and passing)
- [ ] Build successful in this package
- [ ] TypeScript clean in this package
- [ ] Lint clean in this package

**Required output format:**

```
Package: backend
✅ Tests: 45/45 passed (100%)
✅ Build: Success
✅ TypeScript: No errors
✅ Lint: No warnings
```

### Phase 6: Commit Fixed Package

#### Intelligent Commit

1. **Stage only package files**:

   ```bash
   # From monorepo root
   git add packages/<package-name>
   ```

2. **Commit with clear message**:

   ```bash
   git commit -m "fix(<package>): resolve all test failures

   - Fixed X test failures
   - All <package> tests now passing (Y/Y)
   - No changes to other packages"
   ```

### Phase 7: Cross-Package Impact Check

#### Verify No Regressions

After fixing one package, quick-check dependencies:

```bash
# If fixed a core package, verify dependents
cd ../dependent-package
yarn test  # Should still pass

# If all good, return to root
cd ../..
```

## 🔴 STRICT RULES

### What This Command Does

- Focuses on ONE package at a time
- Fixes errors without changing functionality
- Ensures 100% tests pass in that package
- Maintains Batch TDD discipline

### What This Command Does NOT Do

- Does NOT add new features
- Does NOT modify test specifications
- Does NOT fix errors in other packages
- Does NOT proceed with partial fixes

## 📊 Progress Tracking

Track fixes systematically:

```markdown
## Fix Progress

### Package: backend

- [ ] Query timeout errors (15 tests)
- [ ] Connection pool errors (8 tests)
- [ ] Migration sequence errors (3 tests)
      Status: 0/26 fixed → 15/26 fixed → 26/26 COMPLETE ✅

### Package: infrastructure/postgresql

- [ ] Index creation errors (5 tests)
      Status: 0/5 fixed
```

## 💡 OPTIMIZATION TIPS

### For Faster Feedback

1. **Run specific test suites first**:

   ```bash
   yarn test --testNamePattern="QueryBuilder"
   ```

2. **Use watch mode for iterative fixes**:

   ```bash
   yarn test --watch --testPathPattern=query
   ```

3. **But ALWAYS run full package tests before completing**

### For Complex Errors

1. **Add debug logging temporarily**:

   ```typescript
   console.log('DEBUG:', { state, query, result });
   ```

2. **Run single test for deep debugging**:

   ```bash
   yarn test -t "should handle large datasets" --verbose
   ```

3. **Remove debug code before commit**

## ⚠️ NEW SESSION CONTEXT REMINDER

**If you're starting a fresh session to fix errors:**

1. **You're in a Batch TDD project** - ALL tests must pass
2. **Performance tests need TIME** - increase timeouts, don't reduce tests
3. **Package-focused fixing** - fix one package completely before moving on
4. **Zero tolerance** - NO red tests accepted
5. **Show numbers** - Always report "X/X tests passed"

## 🚫 COMMON PITFALLS

### From Lost Context

- ❌ Forgetting Batch TDD rules
- ❌ Accepting partial test success
- ❌ Reducing test coverage to "fix" timeouts
- ❌ Fixing across multiple packages simultaneously
- ❌ Not showing exact test numbers

### Fix These Immediately

- ✅ Re-establish 100% green test requirement
- ✅ Focus on single package
- ✅ Increase timeouts for slow tests
- ✅ Show exact pass/fail numbers
- ✅ Complete package before moving on

---

**Remember: This command exists because context gets lost. Always start by reminding yourself of the Batch TDD rules and ZERO tolerance for red tests!**

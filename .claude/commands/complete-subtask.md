# Complete Current Subtask

Complete the current subtask with full validation.

## 🔴 MANDATORY COMPLETION SEQUENCE

### Step 1: Final Build Validation (Optimized)

#### 🔴 MANDATORY TEST VERIFICATION

**STOP! Before ANY completion:**

1. **ALL tests MUST be GREEN** - no exceptions
2. **Zero failing tests allowed** - fix ALL red tests first
3. **No skipped tests** - unless explicitly approved by user
4. **If ANY test is red**: STOP and fix it before proceeding

#### Determine validation scope

1. **Identify changed files**: `git diff --name-only`
2. **Choose validation strategy**:

##### For single package changes (most common)

```bash
# Navigate to affected package
cd packages/<package-name>
# Run local validation (fast: ~30 seconds)
yarn build && yarn typecheck && yarn lint && yarn test
```

##### For multi-package or critical changes

```bash
# Run from monorepo root (slower: ~3-5 minutes)
yarn build && yarn typecheck && yarn lint && yarn test
```

##### Smart validation tips

- Local package checks catch 95% of issues
- Full monorepo check recommended for:
  - Changes to shared dependencies
  - Updates to root configuration
  - Cross-package functionality
  - Before merging to main branch

#### ⚠️ Docker Check for Integration Test Failures

If integration tests fail (especially database-related errors):

1. **Check Docker status**: `docker ps`
2. **If Docker daemon is not running**, you'll see an error like:
   - "Cannot connect to the Docker daemon"
   - "Is the Docker daemon running?"
3. **Ask user to start Docker**:

   ```bash
   sudo service docker start
   ```

4. **Wait for Docker to start** (usually 5-10 seconds)
5. **Retry the tests** after Docker is running

Common signs of Docker issues:

- Database connection timeouts
- "ECONNREFUSED" errors on localhost ports
- Container startup failures
- "docker: command not found" (Docker not installed)

If ANY command fails, fix errors before proceeding.

#### ✅ TEST RESULTS VERIFICATION

After running tests, VERIFY:

- **ALL test suites passed** (look for "PASS" or green checkmarks)
- **Zero failed tests** (no "FAIL" or red X marks)
- **Test summary shows 100% passing** (e.g., "Tests: 42 passed, 42 total")

**If even ONE test fails:**

1. STOP immediately
2. Fix the failing test(s)
3. Re-run ALL tests
4. Only proceed when 100% tests are GREEN

⚠️ **CRITICAL**: NEVER mark subtask as done with failing tests!

#### ⏱️ TIMEOUT PROTOCOL

If tests timeout:

1. **STOP** - Do not proceed
2. **INCREASE timeout immediately**:

   ```bash
   # Option 1: Update jest.config.js
   testTimeout: 300000  # 5 minutes minimum

   # Option 2: Command line
   yarn test --testTimeout=300000

   # Option 3: Per-test timeout
   jest.setTimeout(300000);
   ```

3. **RE-RUN tests** with increased timeout
4. **NEVER reduce test coverage** to avoid timeouts

**Remember**: Performance tests SHOULD take time - this is normal and expected!

### Step 2: Update Subtask Status

- Get current subtask using `tm current --subtask`
- Update status to done BEFORE commit: `tm set-status --id=<subtask-id> --status=done`
- If no active subtask found, use current task instead

### Step 3: Validation Checklist

## 📋 VALIDATION CHECKLIST (MANDATORY)

Before marking ANY subtask complete, verify:

- [ ] Build passed
- [ ] TypeScript passed
- [ ] Lint passed
- [ ] **Tests: X/X passed (show EXACT numbers)**
- [ ] Zero timeouts (if timeout occurred, increased and re-ran)
- [ ] Zero skipped tests (unless explicitly approved)
- [ ] Test output explicitly shows "All tests passed" or similar

**🚫 Cannot proceed if ANY item unchecked!**

### Step 4: Manual Testing Approval Gate

## ⚠️ APPROVAL REQUIRED

**The implementation is complete and validated.**
**Do you want to test manually before committing?**

Please test:

1. Functionality works as expected
2. No UI/UX regressions
3. Edge cases handled properly
4. Performance acceptable

**Type 'yes' or 'proceed' to approve commit, or describe any issues found.**

> **WAITING FOR YOUR RESPONSE...**

### Step 5: Intelligent Commit Process

After explicit approval, intelligently stage and commit changes:

1. **Get all changed files**: `git status --porcelain`
2. **Analyze changes** in context of current subtask
3. **Present filtered list** for approval:

   ```
   For subtask "Add user authentication", I recommend committing:
   - src/auth/login.ts (authentication logic)
   - tests/auth.test.ts (authentication tests)
   - package.json (added bcrypt dependency)

   Excluded from commit:
   - .env.local (local configuration)
   - debug.log (temporary file)

   Proceed with these files? (yes/no/edit)
   ```

4. **After confirmation**, stage only approved files
5. **Create commit** with meaningful message referencing the subtask

### Step 6: Progress Assessment

- Check overall task progress using `tm list --parent=<task-id>`
- Count remaining subtasks vs completed
- **If ALL subtasks complete**:
  - Message: "✅ This was the LAST subtask! All validation passed recently."
  - Suggest: "Run `/complete-task` to finalize the task and create PR"
  - Note: "Validation will be skipped in complete-task as it just passed"
- **Otherwise**:
  - Show progress percentage
  - List remaining subtasks

### Step 7: Next Subtask Gate

## 🛑 STOP - Approval Required for Next Subtask

**Subtask has been completed and committed.**

### Current Status

- ✅ Subtask complete
- 📊 Task Progress: X/Y subtasks done
- 🌿 Current branch: [show current branch]

### Available Options

1. **Continue with next subtask** (if any remaining)
2. **Switch to different task**
3. **Take a break**

**Should I proceed with the next subtask?**

> **WAITING FOR YOUR DECISION...**

If approved to continue:

#### Pre-continuation Branch Check

1. **Verify still on correct branch**:

   ```bash
   git branch --show-current  # Verify branch
   tm current                  # Verify task context
   ```

2. **If branch mismatch detected**:
   - Alert: "Branch mismatch detected! Currently on [branch] but task requires [task-branch]"
   - Switch to correct branch before continuing
3. **Pull latest changes**: `git pull origin <current-branch> --rebase`

#### Then proceed

- Get next subtask from task list
- Set it to in-progress
- Remind about checking prd.txt and Context7 docs

## Reminders for Next Subtask

1. **ONE AT A TIME**: Complete fully before moving to next
2. **TEST SPECS**: Always check prd.txt first
3. **CONTEXT7**: Get docs before using libraries
4. **VALIDATION**: Run all checks before completion
5. **DOCKER CHECK**: Verify Docker is running if integration tests fail
6. **APPROVAL**: Get manual testing approval before commit

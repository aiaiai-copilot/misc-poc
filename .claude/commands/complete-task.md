# Complete Current Task

Complete the current task with full validation. Automatically detects whether this is a subtask or the final task and handles accordingly.

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
# Fast validation (excludes integration/perf tests: ~2-3 minutes)
yarn validate

# Full validation (includes all tests: ~6-8 minutes)
yarn validate:all
```

**🔴 MANDATORY: Use `yarn validate:all` for these changes:**

- Database schema, migrations, queries, or indexes
- Repository implementations or data access layer
- Performance optimizations or query tuning
- API endpoints with database interactions
- Caching, Redis, or background job implementations
- Integration between services (API + DB, caching, etc.)
- Batch operations or large dataset processing
- Any code touching PostgreSQL/Redis Testcontainers

**⚠️ Use `yarn validate` (fast) ONLY for:**

- UI/frontend changes without backend impact
- Documentation updates
- Simple utility functions (pure logic, no I/O)
- Configuration files (non-database)

**Validation Scripts:**

- `yarn validate` = `yarn build && yarn typecheck && yarn lint && yarn test` (fast, skips [perf])
- `yarn validate:all` = `yarn build && yarn typecheck && yarn lint && yarn test:all` (includes integration)
- **When in doubt → use `yarn validate:all`**

##### Smart validation tips

- Local package checks catch 95% of issues for simple changes
- **ALWAYS use full validation** (`validate:all`) for:
  - Database-related changes
  - Performance-critical code
  - Integration layer changes
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

### Step 2: Update Task Status (Before Commit)

1. **Check if this is the last subtask**:
   - Run `tm show <parent-id>` to see all subtasks
   - Count how many are already done

2. **Update status(es)**:
   - Always update current subtask: `tm set-status --id=<subtask-id> --status=done`
   - **If this is the LAST subtask**: Also update parent: `tm set-status --id=<parent-id> --status=done`

3. **Important**: DO NOT commit yet - status updates will be included in the main commit

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

### Step 5: Intelligent Commit Process (ONE COMMIT ONLY)

After explicit approval, create ONE commit with all changes:

1. **Get all changed files**: `git status --porcelain`
2. **Analyze changes** in context of current subtask
3. **Present filtered list** for approval:

   ```
   For subtask "Add user authentication", I recommend committing:
   - src/auth/login.ts (authentication logic)
   - tests/auth.test.ts (authentication tests)
   - package.json (added bcrypt dependency)
   - .taskmaster/tasks/tasks.json (task status update)

   Excluded from commit:
   - .env.local (local configuration)
   - debug.log (temporary file)

   Proceed with these files? (yes/no/edit)
   ```

4. **Stage ALL approved files INCLUDING tasks.json**:

   ```bash
   git add <implementation-files> .taskmaster/tasks/tasks.json
   ```

5. **Create ONE commit** with implementation + status updates:
   - Commit message should describe the feature/fix work
   - NOT separate "chore" commits for task status
   - Example: `feat(auth): implement user login (task 5.2)`

⚠️ **CRITICAL**: Never create separate commits just for task status updates!

### Step 6: Progress Assessment & Last Subtask Detection

1. **Check overall task progress** using `tm list --parent=<task-id>`
2. **Count remaining subtasks** vs completed
3. **Determine if this is the LAST subtask**:

   ```bash
   # Get parent task details
   tm show <parent-id>
   # Count: done_count + 1 (current) == total_subtasks
   ```

#### 🎯 If ALL Subtasks Complete (LAST SUBTASK)

**✅ This was the LAST subtask! Automatically proceeding to task completion.**

Skip to **Step 7: Task Completion Flow**

#### 📊 If More Subtasks Remain

- Show progress percentage
- List remaining subtasks
- Skip to **Step 8: Next Subtask Gate**

---

### Step 7: Task Completion Flow (ONLY IF LAST SUBTASK)

**🎉 All subtasks complete - finalizing task and creating PR**

#### Phase 1: Final Approval Gate

## ⚠️ FINAL TASK APPROVAL REQUIRED

**All subtasks are complete. Task is ready for finalization.**

### Pre-Completion Checklist

## 📋 FINAL VALIDATION CHECKLIST

- [x] All subtasks marked as done
- [x] Build validation passed (just verified)
- [x] TypeScript validation passed (just verified)
- [x] Lint validation passed (just verified)
- [x] Tests: 100% passed (just verified)
- [x] Zero test failures
- [x] Code review ready

**✅ All validation passed in last subtask - skipping redundant checks**

**Do you want to perform final manual testing before creating the PR?**

This is your last chance to:

1. Test the complete feature end-to-end
2. Verify all acceptance criteria met
3. Check for any regressions
4. Review code quality

**Type 'yes' or 'proceed' to approve PR creation, or describe any issues.**

> **WAITING FOR YOUR APPROVAL...**

#### Phase 2: Push and Create PR

After approval:

1. **Verify correct branch before push**:

   ```bash
   git branch --show-current  # Ensure on task branch
   ```

2. **Push branch** to origin:

   ```bash
   git push origin <task-branch>
   ```

3. **Determine PR target**:
   - Top-level task branches → PR to `main`
   - Intermediate task branches → PR to parent branch
   - If on main/not a task branch → Skip PR creation

4. **Create Pull Request** with:
   - Clear title referencing task ID and description
   - Summary of what was accomplished
   - List of all completed subtasks
   - Testing status
   - Any relevant notes for reviewers

5. **Return to main branch (ONLY after task fully complete)**:

   ```bash
   # Ensure no more work on this task
   tm show <task-id>  # Verify status is 'done'

   # Only then return to main
   git checkout main
   git pull origin main
   ```

   **⚠️ WARNING**: Only return to main after the ENTIRE task is complete.
   Premature return to main causes Task Master to lose task context!

6. **Success message**:

   ```
   ✅ Task completed successfully!
   📝 PR created: [PR URL]
   🌿 Returned to main branch
   🎯 Ready for next task
   ```

**END OF WORKFLOW - Task fully complete!**

---

### Step 8: Next Subtask Gate (ONLY IF MORE SUBTASKS REMAIN)

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

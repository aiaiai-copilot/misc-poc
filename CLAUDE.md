# TaskMaster Automation Instructions for Claude

## CRITICAL: Automatic TaskMaster Workflow

When the user asks me to work on ANY task in this project, I MUST automatically follow this workflow:

### 1. Task Selection & Branch Creation

**CRITICAL: ALWAYS follow this EXACT sequence - NO exceptions:**

```bash
# STEP 1: Check for unmerged PRs FIRST
gh pr list --state=open

# STEP 2: Sync with main to get latest merged changes
git checkout main
git pull origin main

# STEP 3: ONLY NOW check what task to work on
tm next

# If there are open PRs from previous tasks:
# STOP and notify user: "There are unmerged PRs. Please approve and merge them before I continue with the next task."
# List the open PRs and wait for user confirmation

# After completing a task and creating its PR, ALWAYS verify merge status before next task:
# If no new changes were pulled in STEP 2, the PR is still unmerged - STOP and notify user
# Only proceed with next task if the PR has been merged (new changes were pulled)

# Create branch automatically using format: task/<id>-<description>
git checkout -b task/<id>-<short-description>

# Set task to in-progress
tm set-status --id=<id> --status=in-progress
```

**NEVER announce a task as "next" until AFTER completing steps 1-3 above!**

### 2. During Task Implementation

- Work ONLY on the task branch
- Make focused commits with clear messages
- Run tests before completion
- Follow TDD approach when applicable
- **MANDATORY**: After each subtask completion, ALWAYS commit changes and ask for user's manual testing approval before proceeding

### 3. Task Completion (AUTOMATICALLY do ALL of these)

```bash
# Mark task complete FIRST (before final commit)
tm set-status --id=<id> --status=done

# Commit final changes INCLUDING task status
git add .
git commit -m "feat: implement task #<id> - <brief description>"

# Push branch
git push -u origin task/<id>-<description>

# Create PR
gh pr create --title "Task #<id>: <title>" --body "Implements task #<id>"

# Return to main
git checkout main
git pull origin main
```

### 4. Branch Naming Rules

- Format: `task/<id>-<description>`
- Use lowercase, hyphens for spaces
- Keep description under 50 characters
- Examples:
  - `task/1-initialize-monorepo-structure`
  - `task/6-implement-search-query-value-object`

### 5. When User Says "Work on task X" or "Implement next task"

I MUST:

1. First check if previous task's PR was merged: `git checkout main && git pull origin main`
2. If no changes pulled, STOP and report: "Previous task's PR is still unmerged. Please approve and merge before continuing."
3. Only if PR was merged: run `tm next` or use specified task ID
4. Create appropriate branch automatically
5. Set task status to in-progress
6. Implement the task
7. Complete the full workflow above
8. Report completion to user with PR link
9. Always ask me if I want to test manually before committing.
   **NEVER ask user to do these steps manually - I handle ALL TaskMaster automation!**

## CRITICAL REMINDERS

### Task Status Management

- ❗ **ALWAYS** update task status (`tm set-status --id=<id> --status=done`) BEFORE the final commit
- ❗ **NEVER** update task status after pushing or creating PR
- ❗ **ALWAYS** include task status changes in the same commit as the implementation
- ❗ The task status file (`.taskmaster/tasks/tasks.json`) must be committed on the task branch

### Why This Matters

- Task status changes on main branch create inconsistency
- PRs should include both implementation AND task completion status
- This ensures task tracking is synchronized with code changes

### CRITICAL: Stay on Task Branch Throughout Implementation

**NEVER SWITCH TO MAIN DURING ACTIVE TASK WORK!**

❌ **WRONG WORKFLOW (causes branch confusion):**

```bash
# Working on task branch
git checkout task/<id>-<description>
# Implementation work...
# MISTAKE: Switching to main during task work
git checkout main  # ❌ DON'T DO THIS DURING TASK!
tm set-status --id=<id> --status=done
git commit # ❌ Wrong branch for task completion!
```

✅ **CORRECT WORKFLOW:**

```bash
# Working on task branch
git checkout task/<id>-<description>
# Implementation work...
# STAY ON TASK BRANCH for completion
tm set-status --id=<id> --status=done
git add .
git commit -m "feat: complete task #<id> - description"
git push -u origin task/<id>-<description>

# Create PR (method depends on your setup):
# - GitHub: gh pr create ...
# - GitLab: glab mr create ...
# - Manual: create PR through web interface
# - Or merge directly if no PR workflow

# ONLY switch to main when starting NEXT task
git checkout main
git pull origin main
```

**Key Principle: Task work (including status updates) stays on task branch until task is fully complete and merged.**

## MANDATORY SUBTASK WORKFLOW

### After Each Subtask Completion:

1. **Complete the subtask implementation**
2. **Ask user**: "Do you want to test manually before committing?"
3. **Wait for user confirmation**
4. **ONLY AFTER user approval**: Commit the changes
5. **Update subtask status**: `tm set-status --id=<subtask-id> --status=done`
6. **Continue to next subtask or complete main task**

**This workflow applies to EVERY subtask - no exceptions. Never commit without asking for manual testing approval first.**

## E2E Test Requirements for UI/UX Changes

When making ANY UI/UX changes, you MUST maintain end-to-end test coverage:

### MANDATORY E2E Test Actions

#### ✅ **When Adding New UI Components or Features:**

1. **CREATE new E2E tests** in `e2e/` directory following naming convention `XX-feature-name.spec.ts`
2. **UPDATE page objects** in `e2e/support/page-objects/` with new selectors and methods
3. **TEST all user interactions**: clicks, keyboard navigation, form submissions
4. **VERIFY accessibility**: keyboard navigation, ARIA labels, screen reader support
5. **INCLUDE error scenarios**: invalid inputs, network failures, edge cases

#### 📝 **When Modifying Existing UI:**

1. **UPDATE affected E2E tests** to match new behavior/selectors
2. **MODIFY page object methods** if selectors or interactions change
3. **VERIFY backward compatibility** or update tests accordingly
4. **TEST both old and new user flows** during transition periods

#### ❌ **When Removing UI Features:**

1. **REMOVE corresponding E2E tests** for deleted functionality
2. **CLEAN UP page object methods** that are no longer needed
3. **UPDATE test suites** that depend on removed features
4. **VERIFY remaining tests still pass** after cleanup

### E2E Test Coverage Checklist

For EVERY UI change, ensure tests cover:

- [ ] **Functionality**: Core feature works as expected
- [ ] **User flows**: Complete user journeys from start to finish
- [ ] **Error handling**: Graceful failure and recovery
- [ ] **Accessibility**: Keyboard navigation, focus management, ARIA
- [ ] **Cross-component integration**: How changes affect other UI parts
- [ ] **Data integrity**: For features involving data (export/import, CRUD)

### E2E Test Quality Standards

- **Use semantic selectors**: Prefer `data-testid` over CSS classes
- **Write descriptive test names**: Clear Given-When-Then structure
- **Include multilingual content**: Match application's language usage
- **Test real scenarios**: Use realistic data and user behaviors
- **Maintain test independence**: Each test should run in isolation
- **Clean up test data**: Always reset state between tests

### Non-Negotiable Rules

1. **NO UI changes without corresponding E2E test updates**
2. **ALL E2E tests MUST pass before committing**
3. **DOCUMENT test scenarios in commit messages**
4. **REVIEW E2E test coverage for each PR**

**Failure to maintain E2E tests will result in incomplete implementation.**

Refer to `e2e/README.md` for detailed guidelines and examples.

## 🚨 CRITICAL REMINDER: Context7 MCP First

**ALWAYS use Context7 MCP before working with ANY external tools/frameworks:**

- GitHub Actions workflows
- CI/CD tools
- Testing frameworks
- Build tools
- Deployment systems
- Any external APIs/services

**Pattern: resolve-library-id → get-library-docs → implement with current patterns**

## Task Master AI Instructions

**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

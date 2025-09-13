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

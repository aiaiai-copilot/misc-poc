# TaskMaster Automation Instructions for Claude

## CRITICAL: Automatic TaskMaster Workflow

When the user asks me to work on ANY task in this project, I MUST automatically follow this workflow:

### 1. Task Selection & Branch Creation

```bash
# Check what task to work on (if not specified)
tm next

# Check for unmerged PRs before proceeding
gh pr list --state=open

# If there are open PRs from previous tasks:
# STOP and notify user: "There are unmerged PRs. Please approve and merge them before I continue with the next task."
# List the open PRs and wait for user confirmation

# Only proceed if no blocking PRs exist, then sync with main
git checkout main
git pull origin main

# Create branch automatically using format: task/<id>-<description>
git checkout -b task/<id>-<short-description>

# Set task to in-progress
tm set-status --id=<id> --status=in-progress
```

### 2. During Task Implementation

- Work ONLY on the task branch
- Make focused commits with clear messages
- Run tests before completion
- Follow TDD approach when applicable

### 3. Task Completion (AUTOMATICALLY do ALL of these)

```bash
# Commit final changes
git add .
git commit -m "feat: implement task #<id> - <brief description>"

# Push branch
git push -u origin task/<id>-<description>

# Mark task complete
tm set-status --id=<id> --status=done

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

1. Immediately run `tm next` or use specified task ID
2. Create appropriate branch automatically
3. Set task status to in-progress
4. Implement the task
5. Complete the full workflow above
6. Report completion to user

**NEVER ask user to do these steps manually - I handle ALL TaskMaster automation!**

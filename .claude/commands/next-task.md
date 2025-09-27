# Start Next Task

Begin work on the next task following TaskMaster workflow rules.

## 🔴 CRITICAL WORKFLOW RULES

### ONE SUBTASK AT A TIME

- Complete ONE subtask → Get approval → Commit → ONLY THEN start next
- If task has subtasks, do them according to their interdependency (as a rule - sequentially)
- NEVER implement multiple subtasks without approval between each
- After each subtask: STOP and ask "Ready to continue with next subtask?"

### COMMIT APPROVAL REQUIRED

- NEVER commit without explicit user approval
- Always ask: "Ready for manual testing before commit?"
- Wait for user to say "yes", "proceed", or give clear approval
- User may request fixes - implement them before asking again

### BUILD VALIDATION MANDATORY

- Before ANY commit, validate changes smartly:
  1. **For single package changes**: Run local checks first
     - Navigate to package directory: `cd packages/<package-name>`
     - Run: `yarn build && yarn typecheck && yarn lint && yarn test`
     - These local checks are much faster (seconds vs minutes)
     - If local checks pass, optionally run full monorepo validation
  2. **For multi-package or root changes**: Run full validation
     - From root: `yarn build && yarn typecheck && yarn lint && yarn test`
- If ANY command fails, fix errors before proceeding
- This applies to EVERY subtask and main task

### DOCKER CHECK FOR TEST FAILURES

- If integration tests fail during validation:
  1. **Check Docker status**: `docker ps`
  2. **If Docker is not running**, ask user to start it:

     ```bash
     sudo service docker start
     ```

  3. **Wait for Docker to start** before retrying tests
  4. **Common Docker-related failures**:
     - Database connection errors
     - Container startup failures
     - Port binding issues (ECONNREFUSED)
     - Test database initialization problems

## Workflow Execution

### Phase 1: Pre-Flight Checks

- Check for uncommitted changes: `git status --porcelain`
- If uncommitted changes exist, stop and ask user to commit or stash them
- Check for unmerged PRs: `gh pr list --state=open`
- If there are unmerged PRs, warn user and ask if they want to continue
- Sync with main: `git checkout main && git pull origin main`

### Phase 2: Task Selection

- Get next task using `tm next` or use provided task ID if specified
- Set task status to in-progress: `tm set-status --id=<task-id> --status=in-progress`

### Phase 3: Branch Strategy

Determine if branch creation is needed:

- Check if task has subtasks using `tm list --parent=<task-id>`
- If task has subtasks (parent task) → Create branch `task/<id>-<description>`
- If task has no subtasks (leaf task) → Stay on parent branch

### Phase 4: Development Setup

#### For Coding Tasks

1. **Open prd.txt**: `.taskmaster/docs/prd.txt`
2. **Find test specification** for the current task
3. **Get Context7 documentation** for ALL libraries that will be used
4. **Write tests FIRST** based on prd.txt specifications (TDD - Red phase)
5. **Implement code** to make tests pass (TDD - Green phase)
6. **Refactor** if needed while keeping tests green (TDD - Refactor phase)

#### For tasks where only configuration is required

1. Skip TDD requirements
2. Get Context7 documentation for any tools being configured
3. Proceed directly to implementation
4. Still require build validation and approval

## 📋 IMPLEMENTATION CHECKLIST

**For EVERY subtask, follow this sequence:**

### 1. Identify Subtask Type

- [ ] Determine: Coding task (needs tests) vs Config/Setup (no tests)
- [ ] If coding: Locate test spec in prd.txt

### 2. Get Documentation FIRST

- [ ] Identify ALL libraries/tools that will be used
- [ ] Get Context7 docs for each library BEFORE writing any code

### 3. Implementation

- [ ] For coding: Write tests from prd.txt FIRST (TDD - Red phase)
- [ ] For coding: Implement to pass tests (TDD - Green phase)
- [ ] For coding: Refactor if needed (TDD - Refactor phase)
- [ ] For config: Implement directly

### 4. Validation (Optimized)

- [ ] Identify affected package(s) using `git diff --name-only`
- [ ] **Single package changes** (most common):
  - [ ] Navigate to package: `cd packages/<package-name>`
  - [ ] Run local validation: `yarn build && yarn typecheck && yarn lint && yarn test`
  - [ ] Time saved: ~30 seconds vs ~3-5 minutes for full check
  - [ ] Optional: Run full monorepo check if critical changes
- [ ] **Multi-package or root changes**:
  - [ ] Run from root: `yarn build && yarn typecheck && yarn lint && yarn test`
- [ ] **If integration tests fail**:
  - [ ] Check Docker status: `docker ps`
  - [ ] If Docker not running, ask user: `sudo service docker start`
  - [ ] Retry tests after Docker starts
- [ ] Fix ALL errors before proceeding
- [ ] Verify functionality works as expected

### 5. Approval Gate

- [ ] Ask: "Ready for manual testing before commit?"
- [ ] WAIT for explicit user approval
- [ ] If changes requested, implement and return to step 4

### 6. Commit

- [ ] Use intelligent git staging (see commit workflow)
- [ ] Create meaningful commit message
- [ ] Update subtask status to done

### 7. Next Subtask Check

- [ ] Report: "Subtask X.Y complete. Ready for subtask X.Z?"
- [ ] WAIT for user permission
- [ ] Only proceed if approved

## Remember These Critical Rules

⚠️ **ONE subtask at a time** - never jump ahead
⚠️ **Context7 docs FIRST** - before writing any code
⚠️ **Manual testing approval** - before EVERY commit
⚠️ **Build validation** - must pass before commit
⚠️ **Docker check** - verify Docker running if tests fail
⚠️ **Test specs from prd.txt** - don't invent test cases

## Common Docker Troubleshooting

### Symptoms of Docker Issues

- **Database tests failing**: Connection refused to localhost:5432 (PostgreSQL), :3306 (MySQL), :27017 (MongoDB)
- **Redis tests failing**: Connection refused to localhost:6379
- **Container errors**: "Cannot connect to Docker daemon", "docker: command not found"
- **Health check failures**: Containers not becoming healthy in time

### Quick Docker Fixes

1. **Start Docker service**:

   ```bash
   sudo service docker start     # Linux
   # OR
   sudo systemctl start docker   # SystemD-based systems
   ```

2. **Verify Docker is running**:

   ```bash
   docker ps                      # Should list running containers
   docker info                    # Should show Docker system info
   ```

3. **Check container health**:

   ```bash
   docker ps --format "table {{.Names}}\t{{.Status}}"
   ```

4. **Restart problematic containers**:

   ```bash
   docker-compose restart         # If using docker-compose
   # OR
   docker restart <container-name>
   ```

Always inform user if Docker needs to be started before running integration tests!

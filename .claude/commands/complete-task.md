# Complete Current Task

Finalize the current task and create pull request.

## 🔴 TASK COMPLETION WORKFLOW

### Phase 1: Completeness Validation

- Get current task using `tm current`
- Verify ALL subtasks are complete using `tm list --parent=<task-id>`
- Check for any pending or in-progress subtasks
- If subtasks remain incomplete, stop and inform user

### Phase 2: Final Build Validation

Run comprehensive validation:

```bash
yarn build && yarn typecheck && yarn lint && yarn test
```

If E2E tests exist, also run:

```bash
yarn test-e2e
```

All checks must pass before proceeding.

### Phase 3: Task Status Update

Mark task as done BEFORE final commit:

```bash
tm set-status --id=<task-id> --status=done
```

### Phase 4: Final Approval Gate

## ⚠️ FINAL APPROVAL REQUIRED

**Task is ready for completion.**

### Pre-Completion Checklist

- ✅ All subtasks completed
- ✅ All tests passing
- ✅ Build validation successful
- ✅ Code review ready

**Do you want to perform final manual testing before creating the PR?**

This is your last chance to:

1. Test the complete feature end-to-end
2. Verify all acceptance criteria met
3. Check for any regressions
4. Review code quality

**Type 'yes' or 'proceed' to approve, or describe any issues.**

> **WAITING FOR YOUR APPROVAL...**

### Phase 5: Final Commit

After approval, intelligently stage and commit:

1. **Review all changes** made during the task
2. **Analyze changed files** in context of the complete task
3. **Present summary** for approval, for example:

   ```
   Task #3.1 "Setup TypeORM" includes these changes:
   - Database configuration files
   - Entity definitions
   - Migration files
   - Integration tests
   - Updated dependencies

   Total: 15 files changed

   Review file list? (yes/no)
   ```

4. **Stage all task-related changes**
5. **Create comprehensive commit** with task completion message

### Phase 6: Push and Create PR

1. **Push branch** to origin
2. **Determine PR target**:
   - Top-level task branches → PR to `main`
   - Intermediate task branches → PR to parent branch
   - If on main/not a task branch → Skip PR creation

3. **Create Pull Request** with:
   - Clear title referencing task ID and description
   - Summary of what was accomplished
   - List of all completed subtasks
   - Testing status
   - Any relevant notes for reviewers

4. **Return to main branch**:

   ```bash
   git checkout main
   git pull origin main
   ```

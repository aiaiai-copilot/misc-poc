export default {
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    // NOTE: Tests are NOT run in pre-commit hook
    // Reasons:
    // 1. Workflow requires manual testing approval before every commit (see CLAUDE.md)
    // 2. Developers must run `yarn validate` or `yarn validate:all` before committing
    // 3. Running tests for entire packages on file changes is slow (even with [perf] exclusion)
    // 4. CI/CD runs comprehensive test suite on every push
    //
    // Pre-commit focuses on code quality (ESLint + Prettier) only
  ],
  '*.{json,md}': ['prettier --write']
};
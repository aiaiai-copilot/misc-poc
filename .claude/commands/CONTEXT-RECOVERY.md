# 🔴 QUICK CONTEXT RECOVERY

**FOR NEW SESSIONS - READ THIS FIRST!**

## CRITICAL RULES (Non-Negotiable)

1. **Batch TDD**: Write ALL tests first, then implement
2. **100% GREEN**: ZERO red tests accepted - fix ALL or continue fixing
3. **Timeouts**: INCREASE timeout, NEVER reduce test coverage
4. **Validation**: Must show "Tests: X/X passed" with exact numbers

## If You're Here to Fix Errors

Use: `/fix-errors <package>`

Examples:

- `/fix-errors backend`
- `/fix-errors infrastructure/postgresql`
- `/fix-errors frontend`

## Quick Validation Command

For single package:

```bash
cd packages/<package-name>
yarn test --testTimeout=300000
```

Must see: `Tests: X passed, X total` (where both X are equal)

## NEVER DO THIS

- ❌ Accept partial test success
- ❌ Reduce dataset size to avoid timeouts
- ❌ Skip failing tests
- ❌ Say "validation passed" without test numbers
- ❌ Fix multiple packages at once

## ALWAYS DO THIS

- ✅ Fix one package completely
- ✅ Show exact test numbers
- ✅ Increase timeout for slow tests
- ✅ Verify 100% tests pass before commit
- ✅ Remember: Performance tests SHOULD take time

---

**Start with `/fix-errors <package>` if fixing errors!**

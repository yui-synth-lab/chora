---
description: Runs linting, formatting, and tests across all packages in the CHORA workspace.
---
# Workflow: Run Quality Checks

This workflow automates codebase linting, formatting, and unit testing across all monorepo packages.

## Steps

### Step 1: Format Checks
Run code formatting using prettier/eslint rules:
```bash
rtk pnpm format
```

### Step 2: Code Linting
Run static analysis to catch syntax and typing issues:
```bash
rtk pnpm lint
```

### Step 3: Run Unit Tests
Execute Jest or Vitest test suites for `@chora/core`, `@chora/server`, and `@chora/web`:
```bash
rtk pnpm test
```

### Step 4: Verification
Ensure zero errors and zero warnings are reported. If any test fails, automatically inspect the corresponding test output file.

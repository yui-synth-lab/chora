---
description: Initializes the pnpm monorepo directory layout, workspace file, and package.json configurations for CHORA.
---
# Workflow: Initialize Workspace

This workflow guides the initialization of the CHORA pnpm monorepo structure.

## Steps

### Step 1: Create Monorepo Structure
Generate the directory tree structure:
- `packages/core`
- `packages/server`
- `packages/web`
- `packages/training`
- `packages/cli`
- `models`
- `data`

### Step 2: Initialize Root package.json
Create the root `package.json` with workspace configuration:
```json
{
  "name": "chora-monorepo",
  "private": true,
  "engines": {
    "node": ">=18.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

### Step 3: Initialize pnpm-workspace.yaml
Define package paths in `pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
```

### Step 4: Verification
Confirm that `pnpm install` executes successfully and creates the node modules lockfile.

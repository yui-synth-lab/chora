# Rules: Terminal & Command Safety

Always-on guidelines for command execution inside the CHORA workspace.

## Command Execution Principles
1. **Rust Token Killer (RTK) Proxying**:
   - Always run commands via `rtk` where applicable.
   - Example: `git status` -> `rtk git status`.
   - Never run raw shell commands that bypass `rtk` unless debugging a specific collision/issue with `rtk proxy`.

2. **Workspace Boundary**:
   - Ensure the working directory (`Cwd`) is always within the user's workspace: `e:/Projects/Git/github/chora`.
   - Do not create files or directories outside this workspace (e.g., `/tmp`, `/home`, `~`).

3. **Non-Interactive Mode**:
   - When running script generation or package installation (e.g., `npm`, `pnpm`, `npx`), always supply flags to ensure non-interactive execution (e.g., `--yes`, `-y`).

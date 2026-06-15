import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

/**
 * Dynamically finds the workspace root directory by climbing up from the current file
 * until it finds a marker file like 'pnpm-workspace.yaml' or '.git'.
 */
export function findWorkspaceRoot(): string {
  const currentFilePath = fileURLToPath(import.meta.url);
  let dir = path.dirname(currentFilePath);

  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  // Fallback to process.cwd() or parent of packages/core
  return path.resolve(path.dirname(currentFilePath), "../../../..");
}

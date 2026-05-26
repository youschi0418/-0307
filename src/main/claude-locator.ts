import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import type { ClaudeCodeStatus } from "../shared/protocol";

const execFileAsync = promisify(execFile);

function candidatePaths(): string[] {
  const home = os.homedir();
  const isWin = process.platform === "win32";
  const exe = isWin ? "claude.cmd" : "claude";
  const localBins = [
    path.join(home, ".claude", "local", "node_modules", ".bin", exe),
    path.join(home, ".local", "bin", exe),
    path.join(home, ".npm-global", "bin", exe),
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
  ];
  return localBins;
}

async function which(cmd: string): Promise<string | null> {
  const isWin = process.platform === "win32";
  const tool = isWin ? "where" : "which";
  try {
    const { stdout } = await execFileAsync(tool, [cmd]);
    const first = stdout.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    return first || null;
  } catch {
    return null;
  }
}

export async function locateClaudeCode(): Promise<ClaudeCodeStatus> {
  const fromPath = await which("claude");
  const candidates = [fromPath, ...candidatePaths()].filter(
    (p): p is string => !!p,
  );

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const { stdout } = await execFileAsync(candidate, ["--version"], {
        timeout: 5000,
      });
      const version = stdout.trim().split(/\s+/).pop() || stdout.trim();
      return { installed: true, path: candidate, version };
    } catch {
      // try the next candidate
    }
  }

  return { installed: false, path: null, version: null };
}

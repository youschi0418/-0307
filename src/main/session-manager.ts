import { EventEmitter } from "node:events";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import type { IPty } from "node-pty";
import { locateClaudeCode } from "./claude-locator";
import type {
  CreateSessionRequest,
  SessionDataEvent,
  SessionExitEvent,
  SessionId,
  SessionInfo,
} from "../shared/protocol";

// node-pty is a native module; require lazily so the renderer build doesn't pull it in.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pty = require("node-pty") as typeof import("node-pty");

interface Session {
  info: SessionInfo;
  pty: IPty;
}

export class SessionManager extends EventEmitter {
  private readonly sessions = new Map<SessionId, Session>();

  onData(listener: (e: SessionDataEvent) => void): this {
    return this.on("data", listener);
  }

  onExit(listener: (e: SessionExitEvent) => void): this {
    return this.on("exit", listener);
  }

  async create(req: CreateSessionRequest): Promise<SessionInfo> {
    const claude = await locateClaudeCode();
    if (!claude.installed || !claude.path) {
      throw new Error(
        "Claude Code CLI not found. Install with: npm install -g @anthropic-ai/claude-code",
      );
    }

    const id = randomUUID();
    const cwd = req.cwd && req.cwd.length > 0 ? req.cwd : os.homedir();
    const cols = req.cols ?? 120;
    const rows = req.rows ?? 32;
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      ...(req.env ?? {}),
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      FORCE_COLOR: "1",
    };

    const shell = claude.path;
    const args = req.args ?? [];

    const proc = pty.spawn(shell, args, {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env,
    });

    const info: SessionInfo = {
      id,
      cwd,
      pid: proc.pid ?? 0,
      createdAt: Date.now(),
      title: `Claude Code — ${path.basename(cwd) || cwd}`,
    };

    proc.onData((data) => {
      this.emit("data", { id, data } satisfies SessionDataEvent);
    });

    proc.onExit(({ exitCode, signal }) => {
      this.sessions.delete(id);
      this.emit("exit", {
        id,
        exitCode: exitCode ?? null,
        signal: signal ?? null,
      } satisfies SessionExitEvent);
    });

    this.sessions.set(id, { info, pty: proc });
    return info;
  }

  write(id: SessionId, data: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.pty.write(data);
  }

  resize(id: SessionId, cols: number, rows: number): void {
    const session = this.sessions.get(id);
    if (!session) return;
    try {
      session.pty.resize(Math.max(1, cols | 0), Math.max(1, rows | 0));
    } catch {
      // pty may already be dead; ignore
    }
  }

  kill(id: SessionId): void {
    const session = this.sessions.get(id);
    if (!session) return;
    try {
      session.pty.kill();
    } catch {
      // already dead
    }
    this.sessions.delete(id);
  }

  list(): SessionInfo[] {
    return [...this.sessions.values()].map((s) => s.info);
  }

  killAll(): void {
    for (const id of [...this.sessions.keys()]) this.kill(id);
  }
}

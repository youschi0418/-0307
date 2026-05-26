export type SessionId = string;

export interface CreateSessionRequest {
  cwd?: string;
  cols?: number;
  rows?: number;
  args?: string[];
  env?: Record<string, string>;
}

export interface SessionInfo {
  id: SessionId;
  cwd: string;
  pid: number;
  createdAt: number;
  title: string;
}

export interface SessionDataEvent {
  id: SessionId;
  data: string;
}

export interface SessionExitEvent {
  id: SessionId;
  exitCode: number | null;
  signal: number | null;
}

export interface SessionResizePayload {
  id: SessionId;
  cols: number;
  rows: number;
}

export interface SessionInputPayload {
  id: SessionId;
  data: string;
}

export const IPC = {
  CreateSession: "cmux:session:create",
  KillSession: "cmux:session:kill",
  ListSessions: "cmux:session:list",
  WriteSession: "cmux:session:write",
  ResizeSession: "cmux:session:resize",
  PickCwd: "cmux:dialog:pickCwd",
  CheckClaudeCode: "cmux:claude:check",
  OnSessionData: "cmux:session:onData",
  OnSessionExit: "cmux:session:onExit",
} as const;

export interface ClaudeCodeStatus {
  installed: boolean;
  path: string | null;
  version: string | null;
}

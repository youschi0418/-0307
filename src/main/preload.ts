import { contextBridge, ipcRenderer } from "electron";
import {
  IPC,
  type ClaudeCodeStatus,
  type CreateSessionRequest,
  type SessionDataEvent,
  type SessionExitEvent,
  type SessionId,
  type SessionInfo,
} from "../shared/protocol";

type DataListener = (e: SessionDataEvent) => void;
type ExitListener = (e: SessionExitEvent) => void;
type MenuListener = () => void;

const api = {
  checkClaudeCode: (): Promise<ClaudeCodeStatus> =>
    ipcRenderer.invoke(IPC.CheckClaudeCode),

  createSession: (req: CreateSessionRequest): Promise<SessionInfo> =>
    ipcRenderer.invoke(IPC.CreateSession, req),

  killSession: (id: SessionId): Promise<boolean> =>
    ipcRenderer.invoke(IPC.KillSession, id),

  listSessions: (): Promise<SessionInfo[]> =>
    ipcRenderer.invoke(IPC.ListSessions),

  pickCwd: (): Promise<string | null> => ipcRenderer.invoke(IPC.PickCwd),

  writeSession: (id: SessionId, data: string): void => {
    ipcRenderer.send(IPC.WriteSession, { id, data });
  },

  resizeSession: (id: SessionId, cols: number, rows: number): void => {
    ipcRenderer.send(IPC.ResizeSession, { id, cols, rows });
  },

  onSessionData(listener: DataListener): () => void {
    const handler = (_: unknown, e: SessionDataEvent) => listener(e);
    ipcRenderer.on(IPC.OnSessionData, handler);
    return () => ipcRenderer.off(IPC.OnSessionData, handler);
  },

  onSessionExit(listener: ExitListener): () => void {
    const handler = (_: unknown, e: SessionExitEvent) => listener(e);
    ipcRenderer.on(IPC.OnSessionExit, handler);
    return () => ipcRenderer.off(IPC.OnSessionExit, handler);
  },

  onMenu(channel: "newSession" | "closeSession", listener: MenuListener): () => void {
    const ipcChannel = `cmux:menu:${channel}`;
    const handler = () => listener();
    ipcRenderer.on(ipcChannel, handler);
    return () => ipcRenderer.off(ipcChannel, handler);
  },
};

contextBridge.exposeInMainWorld("cmux", api);

export type CmuxApi = typeof api;

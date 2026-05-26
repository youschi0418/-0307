import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import * as path from "node:path";
import { SessionManager } from "./session-manager";
import { locateClaudeCode } from "./claude-locator";
import {
  IPC,
  type CreateSessionRequest,
  type SessionInputPayload,
  type SessionResizePayload,
} from "../shared/protocol";

const sessions = new SessionManager();
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: "#0e0f12",
    title: "cmux for Claude Code",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Renderer is emitted to dist/renderer; this file compiles to dist/main/main.js.
  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {});
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function wireSessionEvents(): void {
  sessions.onData((e) => {
    mainWindow?.webContents.send(IPC.OnSessionData, e);
  });
  sessions.onExit((e) => {
    mainWindow?.webContents.send(IPC.OnSessionExit, e);
  });
}

function registerIpc(): void {
  ipcMain.handle(IPC.CheckClaudeCode, () => locateClaudeCode());

  ipcMain.handle(IPC.CreateSession, async (_e, req: CreateSessionRequest) => {
    return sessions.create(req ?? {});
  });

  ipcMain.handle(IPC.KillSession, (_e, id: string) => {
    sessions.kill(id);
    return true;
  });

  ipcMain.handle(IPC.ListSessions, () => sessions.list());

  ipcMain.on(IPC.WriteSession, (_e, payload: SessionInputPayload) => {
    if (!payload?.id) return;
    sessions.write(payload.id, payload.data);
  });

  ipcMain.on(IPC.ResizeSession, (_e, payload: SessionResizePayload) => {
    if (!payload?.id) return;
    sessions.resize(payload.id, payload.cols, payload.rows);
  });

  ipcMain.handle(IPC.PickCwd, async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Select working directory for Claude Code",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}

function buildMenu(): void {
  const isMac = process.platform === "darwin";
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "Session",
      submenu: [
        {
          label: "New Claude Code Tab",
          accelerator: "CmdOrCtrl+T",
          click: () => mainWindow?.webContents.send("cmux:menu:newSession"),
        },
        {
          label: "Close Tab",
          accelerator: "CmdOrCtrl+W",
          click: () => mainWindow?.webContents.send("cmux:menu:closeSession"),
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  registerIpc();
  wireSessionEvents();
  buildMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  sessions.killAll();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  sessions.killAll();
});

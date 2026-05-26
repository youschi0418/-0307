import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import type { CmuxApi } from "../main/preload";
import type {
  SessionDataEvent,
  SessionExitEvent,
  SessionId,
  SessionInfo,
} from "../shared/protocol";

declare global {
  interface Window {
    cmux: CmuxApi;
  }
}

interface TabState {
  info: SessionInfo;
  term: Terminal;
  fit: FitAddon;
  host: HTMLDivElement;
  tabEl: HTMLDivElement;
  exited: boolean;
}

const tabs = new Map<SessionId, TabState>();
let activeId: SessionId | null = null;

const tabsEl = document.getElementById("tabs") as HTMLDivElement;
const termsEl = document.getElementById("terminals") as HTMLDivElement;
const newBtn = document.getElementById("btn-new") as HTMLButtonElement;
const statusEl = document.getElementById("claude-status") as HTMLSpanElement;
const cwdLabel = document.getElementById("cwd-label") as HTMLSpanElement;
const pidLabel = document.getElementById("pid-label") as HTMLSpanElement;

const theme = {
  background: "#0e0f12",
  foreground: "#d8dee9",
  cursor: "#d97757",
  cursorAccent: "#0e0f12",
  selectionBackground: "rgba(217,119,87,0.35)",
  black: "#1c1f26",
  red: "#e06c75",
  green: "#98c379",
  yellow: "#e5c07b",
  blue: "#61afef",
  magenta: "#c678dd",
  cyan: "#56b6c2",
  white: "#d8dee9",
  brightBlack: "#5c6370",
  brightRed: "#e06c75",
  brightGreen: "#98c379",
  brightYellow: "#e5c07b",
  brightBlue: "#61afef",
  brightMagenta: "#c678dd",
  brightCyan: "#56b6c2",
  brightWhite: "#ffffff",
};

function setActive(id: SessionId | null): void {
  activeId = id;
  for (const [tid, state] of tabs) {
    const isActive = tid === id;
    state.host.classList.toggle("active", isActive);
    state.tabEl.classList.toggle("active", isActive);
    if (isActive) {
      requestAnimationFrame(() => {
        state.fit.fit();
        state.term.focus();
        sendResize(tid, state);
      });
    }
  }
  const current = id ? tabs.get(id) : null;
  cwdLabel.textContent = current?.info.cwd ?? "—";
  pidLabel.textContent = current ? `pid ${current.info.pid}` : "";
}

function sendResize(id: SessionId, state: TabState): void {
  const cols = state.term.cols;
  const rows = state.term.rows;
  if (cols > 0 && rows > 0) {
    window.cmux.resizeSession(id, cols, rows);
  }
}

function buildTabEl(info: SessionInfo): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "tab";
  el.setAttribute("role", "tab");
  el.dataset.sessionId = info.id;

  const title = document.createElement("span");
  title.className = "title";
  title.textContent = info.title;

  const close = document.createElement("span");
  close.className = "close";
  close.textContent = "×";
  close.title = "Close tab";
  close.addEventListener("click", (e) => {
    e.stopPropagation();
    closeTab(info.id);
  });

  el.addEventListener("click", () => setActive(info.id));
  el.append(title, close);
  return el;
}

function buildTerminal(): { term: Terminal; fit: FitAddon } {
  const term = new Terminal({
    fontFamily:
      "ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, Consolas, monospace",
    fontSize: 13,
    lineHeight: 1.2,
    cursorBlink: true,
    cursorStyle: "block",
    allowProposedApi: true,
    scrollback: 10000,
    theme,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  return { term, fit };
}

async function newSession(): Promise<void> {
  const status = await window.cmux.checkClaudeCode();
  if (!status.installed) {
    showEmptyState();
    return;
  }

  let info: SessionInfo;
  try {
    info = await window.cmux.createSession({ cols: 120, rows: 32 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    alert(`Failed to start Claude Code:\n\n${message}`);
    return;
  }

  const host = document.createElement("div");
  host.className = "term-host";
  host.dataset.sessionId = info.id;
  termsEl.appendChild(host);

  const { term, fit } = buildTerminal();
  term.open(host);

  term.onData((data) => window.cmux.writeSession(info.id, data));
  term.onResize(({ cols, rows }) =>
    window.cmux.resizeSession(info.id, cols, rows),
  );

  const tabEl = buildTabEl(info);
  tabsEl.appendChild(tabEl);

  tabs.set(info.id, { info, term, fit, host, tabEl, exited: false });
  setActive(info.id);
  clearEmptyState();
}

function closeTab(id: SessionId): void {
  const state = tabs.get(id);
  if (!state) return;
  window.cmux.killSession(id).catch(() => {});
  state.term.dispose();
  state.host.remove();
  state.tabEl.remove();
  tabs.delete(id);
  if (activeId === id) {
    const next = [...tabs.keys()].pop() ?? null;
    setActive(next);
    if (!next) showEmptyState();
  }
}

function showEmptyState(): void {
  if (termsEl.querySelector(".empty-state")) return;
  const el = document.createElement("div");
  el.className = "empty-state";
  el.innerHTML = `
    <h2>No active Claude Code sessions</h2>
    <p>Press <code>Ctrl/Cmd + T</code> or click <strong>＋ New</strong> to start one.</p>
    <button id="empty-new">Start a Claude Code session</button>
  `;
  termsEl.appendChild(el);
  el.querySelector<HTMLButtonElement>("#empty-new")?.addEventListener(
    "click",
    () => newSession(),
  );
}

function clearEmptyState(): void {
  termsEl.querySelector(".empty-state")?.remove();
}

async function refreshClaudeStatus(): Promise<void> {
  statusEl.textContent = "checking…";
  statusEl.className = "status status-unknown";
  const status = await window.cmux.checkClaudeCode();
  if (status.installed) {
    statusEl.textContent = `Claude Code ${status.version ?? "ok"}`;
    statusEl.className = "status status-ok";
    statusEl.title = status.path ?? "";
  } else {
    statusEl.textContent = "Claude Code not found";
    statusEl.className = "status status-bad";
    statusEl.title =
      "Install with: npm install -g @anthropic-ai/claude-code";
    showEmptyStateMissing();
  }
}

function showEmptyStateMissing(): void {
  clearEmptyState();
  const el = document.createElement("div");
  el.className = "empty-state";
  el.innerHTML = `
    <h2>Claude Code CLI not found</h2>
    <p>Install it, then reload this window:</p>
    <code>npm install -g @anthropic-ai/claude-code</code>
    <button id="empty-retry">Re-check</button>
  `;
  termsEl.appendChild(el);
  el.querySelector<HTMLButtonElement>("#empty-retry")?.addEventListener(
    "click",
    () => refreshClaudeStatus(),
  );
}

function handleData(e: SessionDataEvent): void {
  const state = tabs.get(e.id);
  if (!state) return;
  state.term.write(e.data);
}

function handleExit(e: SessionExitEvent): void {
  const state = tabs.get(e.id);
  if (!state) return;
  state.exited = true;
  state.tabEl.classList.add("exited");
  const code = e.exitCode ?? "?";
  state.term.write(`\r\n\x1b[2;33m[claude-code exited with code ${code}]\x1b[0m\r\n`);
}

function wireGlobalEvents(): void {
  newBtn.addEventListener("click", () => newSession());

  window.cmux.onSessionData(handleData);
  window.cmux.onSessionExit(handleExit);
  window.cmux.onMenu("newSession", () => newSession());
  window.cmux.onMenu("closeSession", () => {
    if (activeId) closeTab(activeId);
  });

  window.addEventListener("resize", () => {
    if (!activeId) return;
    const state = tabs.get(activeId);
    if (state) {
      state.fit.fit();
      sendResize(activeId, state);
    }
  });

  window.addEventListener("beforeunload", () => {
    for (const id of [...tabs.keys()]) {
      window.cmux.killSession(id).catch(() => {});
    }
  });
}

async function boot(): Promise<void> {
  wireGlobalEvents();
  await refreshClaudeStatus();
  showEmptyState();
}

boot().catch((err) => {
  console.error("cmux boot failed", err);
});

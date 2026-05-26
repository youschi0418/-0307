# CLAUDE.md

This file provides guidance for AI assistants working with this repository.

## Repository

- **Name**: -0307
- **Remote**: `youschi0418/-0307`

## Project

`cmux for Claude Code` — a minimal Electron desktop multiplexer that runs
multiple Claude Code CLI sessions in tabs. Each tab is a PTY-backed terminal
attached to a `claude` subprocess; sessions are isolated per working directory.

## Tech stack

- **Runtime**: Electron 30
- **Language**: TypeScript 5
- **Main / preload**: compiled with `tsc` (CommonJS, `dist/main`)
- **Renderer**: bundled with `esbuild` for the browser (`dist/renderer`)
- **PTY**: `node-pty` (native module; rebuilt against Electron's Node ABI)
- **Terminal UI**: `xterm` + `xterm-addon-fit`

## Layout

```
src/
  main/
    main.ts             Electron main process + IPC registration
    preload.ts          contextBridge exposing the `cmux` API
    session-manager.ts  PTY lifecycle for Claude Code processes
    claude-locator.ts   Detect the `claude` CLI on $PATH and common locations
  renderer/
    index.html
    renderer.ts         Tab + terminal management
    styles.css
  shared/
    protocol.ts         IPC channel names and message shapes
scripts/
  copy-assets.js        Copies HTML/CSS + xterm.css into dist/renderer
tsconfig.json           Typecheck-only base
tsconfig.main.json      Emit config for main + preload + shared
```

## Build commands

```
npm install             # also runs electron-rebuild for node-pty
npm run build           # compile main + bundle renderer + copy assets
npm start               # build, then launch Electron
npm run lint            # tsc --noEmit (typecheck everything)
npm run package         # produce a platform installer via electron-builder
```

## Requirements

- Node 20+
- The user must have the Claude Code CLI installed and on `$PATH`
  (`npm install -g @anthropic-ai/claude-code`). The app detects it on startup
  and falls back to a checked set of common install locations.

## Conventions

- **Branch naming**: feature branches use the `claude/` prefix.
- **Commit messages**: clear, descriptive summaries of the change.
- **Push**: always use `git push -u origin <branch-name>`.
- **IPC**: channel names live in `src/shared/protocol.ts`; both sides import
  from there to stay in sync.
- **Process safety**: the renderer never sees `node` APIs directly — all
  privileged calls go through the `cmux` object on `window`, defined in
  `src/main/preload.ts`.
- **Strings into the PTY**: write raw bytes (no JSON wrapping). The renderer
  hands user input directly to `cmux.writeSession`.

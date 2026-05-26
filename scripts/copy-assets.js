#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererSrc = path.join(root, "src", "renderer");
const rendererOut = path.join(root, "dist", "renderer");

fs.mkdirSync(rendererOut, { recursive: true });

const staticFiles = ["index.html", "styles.css"];
for (const name of staticFiles) {
  fs.copyFileSync(path.join(rendererSrc, name), path.join(rendererOut, name));
}

// xterm's CSS lives in the package; copy it next to the bundle so the HTML can reference it.
const xtermCss = path.join(root, "node_modules", "xterm", "css", "xterm.css");
if (fs.existsSync(xtermCss)) {
  fs.copyFileSync(xtermCss, path.join(rendererOut, "xterm.css"));
}

process.stdout.write("[copy-assets] renderer assets copied to dist/renderer\n");

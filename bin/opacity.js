#!/usr/bin/env node

const { spawn } = require("node:child_process");
const path = require("node:path");

function fail(message) {
  console.error(`[opacity] ${message}`);
  process.exit(1);
}

let electronPath;
try {
  electronPath = require("electron");
} catch {
  fail("Electron is not installed. Run `pnpm install` first.");
}

const mainPath = path.resolve(__dirname, "..", "apps", "menubar", "main.js");
const child = spawn(electronPath, [mainPath], {
  detached: true,
  stdio: "ignore",
  env: process.env
});

child.unref();

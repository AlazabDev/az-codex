#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "az-codex-pack-"));

try {
  const result = spawnSync(
    "pnpm",
    ["pack", "--pack-destination", tempDir],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    }
  );

  const stdout = String(result.stdout ?? "").trim();
  const stderr = String(result.stderr ?? "").trim();

  if (stdout) process.stdout.write(`${stdout}\n`);
  if (stderr) process.stderr.write(`${stderr}\n`);

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`pnpm pack failed with exit code ${result.status}`);
  }

  const archives = fs.readdirSync(tempDir).filter((name) => name.endsWith(".tgz"));
  if (archives.length !== 1) {
    throw new Error(`expected exactly one package archive, found ${archives.length}`);
  }

  const archive = path.join(tempDir, archives[0]);
  const stat = fs.statSync(archive);
  if (!stat.isFile() || stat.size === 0) {
    throw new Error("package archive is missing or empty");
  }

  console.log(`package check passed: ${archives[0]} (${stat.size} bytes)`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

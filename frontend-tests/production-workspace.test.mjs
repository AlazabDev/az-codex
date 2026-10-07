import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const read = (relative) => fs.readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("production workspace exposes operational health and release tools", async () => {
  const source = await read("src/lib/components/ProductionWorkspace.svelte");
  assert.match(source, /api\.getRuntimeStatus\(\)/u);
  assert.match(source, /api\.listMcpServers\(\)/u);
  assert.match(source, /api\.getRuntimeProcesses\(\)/u);
  assert.match(source, /api\.refreshMcpServers\(\)/u);
  assert.match(source, /api\.restartGateway\(\)/u);
  assert.match(source, /api\.runProductionCheck\(check\)/u);
  assert.match(source, /role !== "owner"/u);
  assert.match(source, /pnpm release:check/u);
  assert.match(source, /pnpm foundry:doctor/u);
  assert.match(source, /pnpm prod:doctor/u);
  assert.match(source, /pnpm mcp:doctor/u);
});

test("chat surface links the production workspace without replacing chat", async () => {
  const page = await read("src/routes/+page.svelte");
  const header = await read("src/lib/components/WorkspaceHeader.svelte");
  const tabs = await read("src/lib/components/WorkspaceTabStrip.svelte");

  assert.match(page, /\| "production"/u);
  assert.match(page, /ProductionWorkspace\.svelte/u);
  assert.match(page, /activeWorkspaceTabId === "production"/u);
  assert.match(page, /onOpenProductionTab=\{openProductionTab\}/u);
  assert.match(page, /title="Production tools"/u);
  assert.match(header, /Production \/ الإنتاج/u);
  assert.match(tabs, /tab\.kind === "production"/u);
});

test("backend production runner is fixed, bounded and owner-only", async () => {
  const runner = await read("backend/src/production_support.rs");
  const permissions = await read("backend/src/ws_method_support.rs");
  const dispatch = await read("backend/src/ws_dispatch_support.rs");

  assert.match(runner, /"release"\s*=>\s*Ok\(\("release:check"/u);
  assert.match(runner, /"foundry"\s*=>\s*Ok\(\("foundry:doctor"/u);
  assert.match(runner, /"production"\s*=>\s*Ok\(\("prod:doctor"/u);
  assert.match(runner, /"mcp"\s*=>\s*Ok\(\("mcp:doctor"/u);
  assert.match(runner, /PRODUCTION_CHECK_OUTPUT_LIMIT/u);
  assert.match(runner, /PRODUCTION_CHECK_NOT_ALLOWED/u);
  assert.match(permissions, /\| "production\/check"/u);
  assert.match(dispatch, /"production\/check" => run_production_check_payload/u);
});

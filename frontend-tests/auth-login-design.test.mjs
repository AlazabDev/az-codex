import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const source = await fs.readFile(
  new URL("../src/lib/components/AuthLoginOverlay.svelte", import.meta.url),
  "utf8"
);

test("Az Codex login keeps the real authentication controls", () => {
  assert.match(source, /data-testid="login-form"/u);
  assert.match(source, /data-testid="login-password"/u);
  assert.match(source, /data-testid="login-submit"/u);
  assert.match(source, /bind:this=\{loginHcaptchaContainer\}/u);
  assert.match(source, /void onSubmit\(\)/u);
});

test("Az Codex login matches the operations split-screen design", () => {
  assert.match(source, /Az Codex/u);
  assert.match(source, /AI OPERATIONS/u);
  assert.match(source, /Enterprise/u);
  assert.match(source, /AI Development/u);
  assert.match(source, /Workspace\./u);
  assert.match(source, /CODEX \+ FOUNDRY/u);
  assert.match(source, /CONNECTED TOOLS/u);
  assert.match(source, /AR \/ EN/u);
  assert.match(source, /Welcome back/u);
  assert.match(source, /Sign in to your Az Codex workspace/u);
  assert.match(source, /#030957/u);
  assert.match(source, /#ffb900/iu);
});

test("login remains responsive and password-only", () => {
  assert.match(source, /@media \(max-width: 760px\)/u);
  assert.match(source, /autocomplete="current-password"/u);
  assert.doesNotMatch(source, /data-testid="login-username"/u);
});

#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/frappe/az-codex}"
ENV_FILE="${ENV_FILE:-/home/frappe/az-codex/.env}"
RUN_AS="${RUN_AS:-frappe}"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

[[ -d "$APP_DIR/.git" ]] || fail "Repository not found at $APP_DIR"
[[ -f "$ENV_FILE" ]] || fail "Production env not found at $ENV_FILE"
command -v sudo >/dev/null 2>&1 || fail "sudo is required"
command -v curl >/dev/null 2>&1 || fail "curl is required"

printf '== Repository ==\n'
git -C "$APP_DIR" status --short
git -C "$APP_DIR" log -1 --oneline

if [[ -n "$(git -C "$APP_DIR" status --porcelain)" ]]; then
  fail "Production working tree is not clean"
fi

printf '\n== Build / release gate ==\n'
sudo -u "$RUN_AS" -H bash -lc "
  set -Eeuo pipefail
  cd '$APP_DIR'
  command -v pnpm >/dev/null
  command -v cargo >/dev/null
  command -v node >/dev/null
  pnpm install --frozen-lockfile
  pnpm release:check
"

printf '\n== Production environment / Foundry ==\n'
sudo -u "$RUN_AS" -H bash -lc "
  set -Eeuo pipefail
  cd '$APP_DIR'
  set -a
  source '$ENV_FILE'
  set +a
  pnpm foundry:doctor
  pnpm prod:doctor
"

printf '\n== Preflight passed ==\n'

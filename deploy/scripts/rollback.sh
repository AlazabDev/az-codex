#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/frappe/az-codex}"
ENV_FILE="${ENV_FILE:-/home/frappe/az-codex/.env}"
RUN_AS="${RUN_AS:-frappe}"
STATE_DIR="${STATE_DIR:-/home/frappe/.azcodex/deploy}"
TARGET_SHA="${1:-}"

[[ "${EUID}" -eq 0 ]] || {
  echo "Run as root: sudo bash deploy/scripts/rollback.sh [commit]" >&2
  exit 1
}

if [[ -z "$TARGET_SHA" && -f "$STATE_DIR/previous-release" ]]; then
  TARGET_SHA="$(tr -d '[:space:]' < "$STATE_DIR/previous-release")"
fi

[[ -n "$TARGET_SHA" ]] || {
  echo "No rollback target supplied and no previous-release marker exists." >&2
  exit 1
}

if [[ -n "$(git -C "$APP_DIR" status --porcelain)" ]]; then
  echo "Refusing rollback: production working tree is dirty." >&2
  exit 1
fi

echo "Rolling back to: $TARGET_SHA"

sudo -u "$RUN_AS" -H bash -lc "
  set -Eeuo pipefail
  cd '$APP_DIR'
  git fetch --prune origin
  git checkout --detach '$TARGET_SHA'
  pnpm install --frozen-lockfile
  pnpm build
  pnpm pack:check
  set -a
  source '$ENV_FILE'
  set +a
  pnpm foundry:doctor
"

systemctl restart az-codex.service
systemctl restart az-codex-health.timer

curl -fsS --retry 20 --retry-delay 1 --max-time 5 http://127.0.0.1:4173/healthz >/dev/null
curl -fsS --retry 20 --retry-delay 1 --max-time 5 http://127.0.0.1:4173/readyz >/dev/null

echo "Rollback healthy: $TARGET_SHA"

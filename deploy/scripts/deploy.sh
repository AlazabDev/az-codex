#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/frappe/az-codex}"
ENV_FILE="${ENV_FILE:-/home/frappe/az-codex/.env}"
RUN_AS="${RUN_AS:-frappe}"
STATE_DIR="${STATE_DIR:-/home/frappe/.azcodex/deploy}"
BRANCH="${BRANCH:-main}"

[[ "${EUID}" -eq 0 ]] || {
  echo "Run as root: sudo bash deploy/scripts/deploy.sh" >&2
  exit 1
}

[[ -d "$APP_DIR/.git" ]] || {
  echo "Repository not found: $APP_DIR" >&2
  exit 1
}
[[ -f "$ENV_FILE" ]] || {
  echo "Production env missing: $ENV_FILE" >&2
  exit 1
}

if [[ -n "$(git -C "$APP_DIR" status --porcelain)" ]]; then
  echo "Refusing deploy: production working tree is dirty." >&2
  git -C "$APP_DIR" status --short >&2
  exit 1
fi

install -d -o "$RUN_AS" -g "$RUN_AS" -m 0700 "$STATE_DIR"

PREVIOUS_SHA="$(git -C "$APP_DIR" rev-parse HEAD)"
printf '%s\n' "$PREVIOUS_SHA" > "$STATE_DIR/previous-release"
chown "$RUN_AS:$RUN_AS" "$STATE_DIR/previous-release"
chmod 0600 "$STATE_DIR/previous-release"

echo "Previous release: $PREVIOUS_SHA"

sudo -u "$RUN_AS" -H bash -lc "
  set -Eeuo pipefail
  cd '$APP_DIR'
  git fetch --prune origin
  git checkout '$BRANCH'
  git pull --ff-only origin '$BRANCH'
  pnpm install --frozen-lockfile
  pnpm release:check
  node --env-file='$ENV_FILE' ./bin/azcodex.mjs doctor
  node --env-file='$ENV_FILE' ./scripts/production-doctor.mjs
"

install -m 0644 "$APP_DIR/deploy/systemd/az-codex.service" /etc/systemd/system/az-codex.service
install -m 0644 "$APP_DIR/deploy/systemd/az-codex-health.service" /etc/systemd/system/az-codex-health.service
install -m 0644 "$APP_DIR/deploy/systemd/az-codex-health.timer" /etc/systemd/system/az-codex-health.timer
systemctl daemon-reload

systemctl enable az-codex.service az-codex-health.timer >/dev/null
systemctl restart az-codex.service
systemctl restart az-codex-health.timer

curl -fsS --retry 20 --retry-delay 1 --max-time 5 http://127.0.0.1:4173/healthz >/dev/null
curl -fsS --retry 20 --retry-delay 1 --max-time 5 http://127.0.0.1:4173/readyz >/dev/null

CURRENT_SHA="$(git -C "$APP_DIR" rev-parse HEAD)"
printf '%s\n' "$CURRENT_SHA" > "$STATE_DIR/current-release"
chown "$RUN_AS:$RUN_AS" "$STATE_DIR/current-release"
chmod 0600 "$STATE_DIR/current-release"

echo "Deployment healthy: $CURRENT_SHA"

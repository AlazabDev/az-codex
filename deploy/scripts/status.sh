#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/az-codex}"
DOMAIN="${DOMAIN:-codex.alazab.com}"

echo "== Git =="
git -C "$APP_DIR" log -1 --oneline || true
git -C "$APP_DIR" status --short || true

echo
echo "== Services =="
systemctl --no-pager --full status az-codex.service || true
systemctl --no-pager --full status az-codex-health.timer || true

echo
echo "== Local health =="
curl -fsS --max-time 5 http://127.0.0.1:4173/healthz || true
echo
curl -fsS --max-time 5 http://127.0.0.1:4173/readyz || true
echo

echo
echo "== Public edge =="
curl -fsSI --max-time 10 "https://$DOMAIN/" | sed -n '1,12p' || true

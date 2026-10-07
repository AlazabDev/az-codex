#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/frappe/az-codex}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
DOMAIN="${DOMAIN:-codex.alazab.com}"

[[ "${EUID}" -eq 0 ]] || {
  echo "Run as root: sudo bash deploy/scripts/install-system.sh" >&2
  exit 1
}

for command_name in nginx systemctl curl; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "Missing required command: $command_name" >&2
    exit 1
  }
done

install -d -m 0755 /var/www/certbot

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing existing production environment: $ENV_FILE" >&2
  exit 1
fi

chown frappe:frappe "$ENV_FILE"
chmod 0600 "$ENV_FILE"

install -m 0644 "$APP_DIR/deploy/systemd/az-codex.service" /etc/systemd/system/az-codex.service
install -m 0644 "$APP_DIR/deploy/systemd/az-codex-health.service" /etc/systemd/system/az-codex-health.service
install -m 0644 "$APP_DIR/deploy/systemd/az-codex-health.timer" /etc/systemd/system/az-codex-health.timer

if [[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" && -f "/etc/letsencrypt/live/$DOMAIN/privkey.pem" ]]; then
  install -m 0644 "$APP_DIR/deploy/nginx/codex.alazab.com.conf" "/etc/nginx/sites-available/$DOMAIN"
  echo "Installed TLS Nginx config."
else
  install -m 0644 "$APP_DIR/deploy/nginx/codex.alazab.com.bootstrap.conf" "/etc/nginx/sites-available/$DOMAIN"
  echo "Installed HTTP bootstrap Nginx config; obtain TLS before switching to final config."
fi

ln -sfn "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"

systemctl daemon-reload
nginx -t
systemctl reload nginx

echo
echo "System files installed."
echo "Environment: $ENV_FILE"
echo "Nginx site: /etc/nginx/sites-available/$DOMAIN"
echo
echo "Do NOT start az-codex until deploy/scripts/preflight.sh passes."

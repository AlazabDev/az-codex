#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/az-codex}"
ENV_DIR="${ENV_DIR:-/etc/az-codex}"
ENV_FILE="$ENV_DIR/az-codex.env"
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

install -d -m 0755 "$ENV_DIR"
install -d -m 0755 /var/www/certbot

if [[ ! -f "$ENV_FILE" ]]; then
  install -m 0600 "$APP_DIR/deploy/production.env.example" "$ENV_FILE"
  echo "Created $ENV_FILE from template."
  echo "Populate secrets before starting az-codex."
else
  chmod 0600 "$ENV_FILE"
fi

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

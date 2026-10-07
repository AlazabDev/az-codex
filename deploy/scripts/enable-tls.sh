#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/frappe/az-codex}"
DOMAIN="${DOMAIN:-codex.alazab.com}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

[[ "${EUID}" -eq 0 ]] || {
  echo "Run as root: sudo CERTBOT_EMAIL=... bash deploy/scripts/enable-tls.sh" >&2
  exit 1
}

[[ -n "$CERTBOT_EMAIL" ]] || {
  echo "CERTBOT_EMAIL is required" >&2
  exit 1
}

command -v certbot >/dev/null 2>&1 || {
  echo "certbot is required" >&2
  exit 1
}

if [[ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
  certbot certonly     --webroot     -w /var/www/certbot     -d "$DOMAIN"     --email "$CERTBOT_EMAIL"     --agree-tos     --no-eff-email     --non-interactive
fi

install -m 0644 "$APP_DIR/deploy/nginx/codex.alazab.com.conf" "/etc/nginx/sites-available/$DOMAIN"
ln -sfn "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"

nginx -t
systemctl reload nginx

curl -fsS --max-time 15 "https://$DOMAIN/healthz" >/dev/null || {
  echo "TLS is active, but public health check is not ready yet." >&2
  exit 1
}

echo "TLS enabled for https://$DOMAIN"

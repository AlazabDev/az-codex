# Production deployment — codex.alazab.com

This runbook targets the Alazab OCI deployment and keeps the WebUI bound to loopback behind Nginx.

## Layout

- Repository: `/opt/az-codex`
- Runtime user: `frappe`
- Environment: `/etc/az-codex/az-codex.env`
- Codex home: `/home/frappe/.codex`
- Frappe bench: `/home/frappe/frappe-bench`
- Public host: `https://codex.alazab.com`
- Internal WebUI: `http://127.0.0.1:4173`

## Build gate

Run before every production deployment:

```bash
pnpm install --frozen-lockfile
pnpm release:check
```

`release:check` runs the TypeScript/Svelte checks, Rust checks, unit tests, production build, compatibility/security verification, and an npm package dry-run.

## Secrets

Copy `deploy/production.env.example` to `/etc/az-codex/az-codex.env`, set real values on the server, and protect it with mode `600`.

Generate password hashes with:

```bash
pnpm hash-password
```

Generate the session signing secret with:

```bash
openssl rand -hex 48
```

Never commit the populated production environment file.

## systemd

Install the units:

```bash
sudo install -m 0644 deploy/systemd/az-codex.service /etc/systemd/system/az-codex.service
sudo install -m 0644 deploy/systemd/az-codex-health.service /etc/systemd/system/az-codex-health.service
sudo install -m 0644 deploy/systemd/az-codex-health.timer /etc/systemd/system/az-codex-health.timer
sudo systemctl daemon-reload
sudo systemctl enable --now az-codex.service
sudo systemctl enable --now az-codex-health.timer
```

Verify:

```bash
systemctl status az-codex.service --no-pager
systemctl status az-codex-health.timer --no-pager
curl -fsS http://127.0.0.1:4173/healthz
```

## Nginx

Create the ACME webroot and install the site config:

```bash
sudo install -d -m 0755 /var/www/certbot
sudo install -m 0644 deploy/nginx/codex.alazab.com.conf /etc/nginx/sites-available/codex.alazab.com
sudo ln -sfn /etc/nginx/sites-available/codex.alazab.com /etc/nginx/sites-enabled/codex.alazab.com
sudo nginx -t
```

For a first deployment without an existing certificate, obtain the certificate before enabling the TLS server block, or use Certbot's Nginx integration to bootstrap it.

After TLS is available:

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -I https://codex.alazab.com/
```

## Update procedure

Deploy only after CI passes.

```bash
cd /opt/az-codex
git fetch origin
git checkout main
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm release:check
sudo systemctl reload az-codex.service
curl -fsS http://127.0.0.1:4173/healthz
```

The WebUI restart path uses Codex app-server handoff when available so active sessions can reconnect.

## Rollback

Record the previous commit before updating:

```bash
git rev-parse HEAD
```

If a deployment fails after build validation, check out the previous known-good commit, rebuild, and reload the service:

```bash
git checkout <known-good-commit>
pnpm install --frozen-lockfile
pnpm build
sudo systemctl reload az-codex.service
```

Do not roll back the Frappe database with Git. Frappe schema/data changes must follow the bench backup/patch/migration policy separately.

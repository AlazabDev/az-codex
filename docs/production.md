# Production deployment — codex.alazab.com

This runbook targets the Alazab OCI deployment and keeps the WebUI bound to loopback behind Nginx.

## Layout

- Repository: `/opt/az-codex`
- Runtime user: `frappe`
- Environment: `/etc/az-codex/az-codex.env`
- OpenAI Codex home: `/home/frappe/.codex`
- Foundry Codex home: `/home/frappe/.azcodex`
- Default WebUI profile: `azcodex`
- Frappe bench: `/home/frappe/frappe-bench`
- Public host: `https://codex.alazab.com`
- Internal WebUI: `http://127.0.0.1:4173`

## Build gate

Run before every production deployment:

```bash
pnpm install --frozen-lockfile
pnpm release:check
```

`release:check` runs the TypeScript/Svelte checks, Rust checks, unit tests, production build, compatibility/security verification, a constrained-memory runtime smoke test, and a `pnpm pack` package-integrity check.

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

Foundry is required for the production default profile. Set all of:

```bash
AZURE_FOUNDRY_ENDPOINT=https://<resource>.openai.azure.com
AZURE_FOUNDRY_API_KEY=<server-secret>
AZURE_FOUNDRY_MODEL=<exact-azure-deployment-name>
AZCODEX_HOME=/home/frappe/.azcodex
```

Do not rely on a guessed model name. `AZURE_FOUNDRY_MODEL` is the Azure deployment name and is intentionally mandatory.

The production WebUI exposes two isolated profiles:

- `codex` → `/home/frappe/.codex` (OpenAI)
- `azcodex` → `/home/frappe/.azcodex` (Microsoft Foundry, production default)

Validate the Foundry path before starting the service:

```bash
set -a
source /etc/az-codex/az-codex.env
set +a

pnpm foundry:doctor
pnpm prod:doctor
```

`foundry:doctor` performs a small live `codex exec` round-trip through the configured Foundry deployment. Use `pnpm foundry:doctor:offline` only for configuration-only diagnostics.

## Production workspace

The chat UI exposes a dedicated **Production / الإنتاج** workspace. It is available from the workspace menu and directly from the composer toolbar.

The production workspace shows runtime/build health, active Codex routing, host memory/OOM state, MCP status, and links to Git, Terminal, Diagnostics, and MCP Settings.

For the owner role it can execute only four server-side checks through a fixed allowlist:

```text
release     -> pnpm release:check
foundry     -> pnpm foundry:doctor
production  -> pnpm prod:doctor
mcp         -> pnpm mcp:doctor
```

There is no arbitrary command parameter. The backend resolves the application root from `CODEX_WEBUI_PROJECT_ROOT`, enforces per-check timeouts, bounds captured output, audits the WebSocket mutation, and rejects non-owner callers.

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

set -a
source /etc/az-codex/az-codex.env
set +a
pnpm prod:doctor

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

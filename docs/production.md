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

Copy `deploy/production.env.example` to `/etc/az-codex/az-codex.env`, set real values on the server, and protect it as `root:frappe` with mode `0640`.

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

## First deployment

The first deployment uses the checked-in deployment helpers and does not expose the login over plaintext HTTP.

### 1. Clone the application

```bash
sudo install -d -o frappe -g frappe -m 0755 /opt/az-codex
sudo -u frappe -H git clone https://github.com/AlazabDev/az-codex.git /opt/az-codex
cd /opt/az-codex
```

If the directory already contains the repository, do not clone it again.

### 2. Install system files and HTTP-only ACME bootstrap

```bash
cd /opt/az-codex
sudo bash deploy/scripts/install-system.sh
```

This installs the systemd units and either:

- the final TLS Nginx configuration when a certificate already exists, or
- the ACME-only bootstrap configuration when this is the first certificate.

The bootstrap server returns `404` for every non-ACME HTTP request, so the login is never exposed over plaintext HTTP.

### 3. Populate production secrets

Edit:

```bash
sudo nano /etc/az-codex/az-codex.env
```

Then enforce the production permissions:

```bash
sudo chown root:frappe /etc/az-codex/az-codex.env
sudo chmod 0640 /etc/az-codex/az-codex.env
```

Required values include the password hashes, session secret, hCaptcha pair, and the Microsoft Foundry endpoint/API key/deployment.

### 4. Run the complete preflight

```bash
cd /opt/az-codex
sudo bash deploy/scripts/preflight.sh
```

Do not continue until this command finishes with:

```text
== Preflight passed ==
```

### 5. Deploy and start the service

```bash
cd /opt/az-codex
sudo bash deploy/scripts/deploy.sh
```

The deploy helper records the previous Git commit, fast-forwards `main`, runs the full release gate, validates Foundry and the production environment, installs the current systemd units, restarts the service, and requires both local health endpoints to pass.

### 6. Obtain and activate TLS

Install Certbot if it is not already installed, then run:

```bash
cd /opt/az-codex
sudo CERTBOT_EMAIL=admin@alazab.com bash deploy/scripts/enable-tls.sh
```

The script obtains the first certificate through the webroot challenge, installs the final TLS Nginx configuration, validates Nginx, reloads it, and checks the public health endpoint.

### 7. Final status

```bash
cd /opt/az-codex
sudo bash deploy/scripts/status.sh
```

The public application should now be available at:

```text
https://codex.alazab.com
```

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

Deploy only after CI passes. Production updates use one command:

```bash
cd /opt/az-codex
sudo bash deploy/scripts/deploy.sh
```

The helper refuses a dirty production tree, records the previous release SHA, fast-forwards `main`, runs `pnpm release:check`, performs the live Foundry and production doctors, installs the current systemd units, restarts the service and requires both `/healthz` and `/readyz` to pass.

The WebUI restart path uses Codex app-server handoff when available so active sessions can reconnect.

## Rollback

Every successful deploy stores the previous commit at:

```text
/home/frappe/.azcodex/deploy/previous-release
```

Rollback to it with:

```bash
cd /opt/az-codex
sudo bash deploy/scripts/rollback.sh
```

Or rollback to an explicit known-good commit:

```bash
sudo bash deploy/scripts/rollback.sh <commit-sha>
```

Rollback rebuilds the selected revision, validates the package and Foundry path, restarts the service, and requires both local health endpoints to pass.

Do not roll back the Frappe database with Git. Frappe schema/data changes must follow the bench backup/patch/migration policy separately.

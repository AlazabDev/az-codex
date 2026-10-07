# Az Codex Engineering Instructions

These instructions apply to the `az-codex` repository.

## Architecture boundaries

- `src/` — SvelteKit web application and client-side UI.
- `backend/` — Rust gateway, authentication, runtime and WebSocket/API services.
- `bin/` — user-facing CLIs. Keep them thin; reusable logic belongs in `scripts/` or dedicated modules.
- `scripts/` — build, verification, installation and shared Node.js tooling.
- `mcp/` — integration hub. All providers must be registered in `mcp/registry.json`.
- `messages/` — localization source messages.
- `templates/` — managed instruction/profile templates installed into external workspaces.
- `deploy/` — production deployment assets only; never store production secrets here.
- `docs/` — architecture, operations and integration documentation.

## Engineering rules

- Do not commit credentials, tokens, cookies, private keys or production `.env` files. Use placeholders or environment-variable names.
- Do not hard-code new integration paths in multiple places. Register integrations once in `mcp/registry.json` and consume the registry.
- Preserve backward compatibility for the public CLIs (`azcodex`, `codex-webui`) unless the change is explicitly versioned as breaking.
- Keep Node scripts ESM and shell-free where practical. For subprocesses, prefer argv arrays to string commands.
- Validate all filesystem paths that originate from configuration before accessing them.
- User-controlled values must never be concatenated into shell commands, SQL, URLs containing secrets or executable code.
- Generated directories (`build`, `dist`, `.svelte-kit`, `backend/target`) are outputs, not source.

## Validation standard

Before declaring repository work complete, run:

```bash
pnpm install --frozen-lockfile
pnpm mcp:doctor
pnpm verify:secrets
pnpm test:unit
pnpm check
pnpm check:gateway
pnpm build
pnpm verify
```

For release candidates run:

```bash
pnpm release:check
```

If Rust/Cargo is unavailable on the current host, do not claim the production build passed. Report the missing dependency and run the remaining Node-side checks.

## Frappe work

Repository-level Frappe integration code belongs under `mcp/`, `scripts/` and `templates/frappe/`. Application changes inside an external Frappe bench follow the installed Frappe `AGENTS.md` rules and must not patch upstream `frappe` or `erpnext` applications.

## Documentation

When adding a new provider or runtime subsystem, update the relevant registry/docs in the same change. Operational behavior that affects production must be documented under `docs/` or `deploy/`.

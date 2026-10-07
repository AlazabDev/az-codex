# Frappe bench support

Two parts, both installed with one command:

1. **Agent instructions** (`AGENTS.md`): Frappe conventions, safe workflow and a list of
   commands the agent must never run without approval (`drop-site`, `reinstall`, `restore`,
   `bench update`, `--force`, raw `DELETE`/`DROP`, non-developer sites).
2. **`frappe-bench` MCP server** (`mcp/frappe-bench.mjs`, zero dependencies): typed tools
   instead of raw shell.

```bash
azcodex frappe --bench /home/frappe/frappe-bench            # azcodex (Foundry)
azcodex frappe --bench /home/frappe/frappe-bench --openai   # plain codex (OpenAI)
azcodex frappe --remove [--openai]
```

Options: `--sites dev.local,test.local` (explicit allow list), `--readonly` (inspection only),
`--allow-console` (enables `console_eval`). Start a new session afterwards.

## Tools

| Tool | What it does |
| --- | --- |
| `bench_status` | bench path/version, apps, sites, allowed sites |
| `list_doctypes(app)` | DocTypes found in the app's JSON files |
| `get_doc_schema(doctype, app?)` | fields and permissions |
| `tail_logs(file?, lines?)` | last lines of `<bench>/logs/*.log` |
| `run_tests(site, app, module?, doctype?)` | `bench --site … run-tests --app …` |
| `migrate(site)` | backup, then `bench --site … migrate` |
| `backup(site)` / `build(app)` | `bench backup` / `bench build --app` |
| `console_eval(site, code)` | Python in `bench console` (off by default) |

## Safety model

- No shell: commands are argv arrays; app/site/module names are validated (`^[A-Za-z0-9._-]+$`).
- A site is usable only if it has `developer_mode` on or is in `FRAPPE_BENCH_ALLOWED_SITES`.
  Production sites are refused by default.
- `console_eval` needs `FRAPPE_BENCH_ALLOW_CONSOLE=1`; `FRAPPE_BENCH_READONLY=1` hides every mutating tool.
- 10-minute timeout per command (`FRAPPE_BENCH_TIMEOUT_SECONDS`), output limited to the last 20k characters.
- Codex still asks for approval according to the profile's approval mode.

Environment: `FRAPPE_BENCH_PATH`, `FRAPPE_BENCH_BIN`, `FRAPPE_BENCH_ALLOWED_SITES`,
`FRAPPE_BENCH_READONLY`, `FRAPPE_BENCH_ALLOW_CONSOLE`, `FRAPPE_BENCH_TIMEOUT_SECONDS`.

Tests: `pnpm test:azcodex` (uses a fake bench, no Frappe needed).

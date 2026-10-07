# Inline charts in chat

Assistant messages can contain a fenced code block with the language `chart`.
The block holds a JSON spec and is drawn as an inline SVG chart (no extra
dependency, theme-aware via `currentColor`). Invalid JSON or an unsupported spec
simply stays a normal code block, which also covers streaming: the block turns
into a chart once the closing fence arrives.

## Spec

| Field | Notes |
| --- | --- |
| `type` | `bar` (default), `line`, `area`, `scatter`, `pie` |
| `title`, `xLabel`, `yLabel` | optional text |
| `labels` | category names (bar/line/area/pie) |
| `series` | `[{ "name": "...", "data": [numbers] }]`, up to 12 series |
| `data` | shorthand for one series: `[numbers]` with `labels`, or `[{ "label": "A", "value": 3 }]` |

Scatter uses `series[].data` as `[[x, y], ...]` or `[{ "x": 1, "y": 2 }, ...]`.

Limits: 200 points, 12 series, finite numbers up to 1e15, 100k characters.

````md
```chart
{"type":"bar","title":"Revenue","labels":["Q1","Q2","Q3"],
 "series":[{"name":"2025","data":[10,14,9]},{"name":"2026","data":[12,18,15]}]}
```
````

## Telling the model about it

Models only draw charts if they know the format, so the instructions are installed
into `AGENTS.md` for you (a managed section between `codex-webui:charts` markers;
the rest of your file is never touched):

```bash
azcodex charts             # ~/.azcodex/AGENTS.md (also done by azcodex setup / webui / run)
azcodex charts --openai    # plain codex: $CODEX_HOME or ~/.codex/AGENTS.md
azcodex charts --remove    # remove the managed section
```

Start a new session after installing; Codex reads `AGENTS.md` when a session starts.

## Security

The spec is never inserted as HTML. `src/lib/chart-renderer.ts` builds the SVG
from numbers it formatted itself and escapes every label; the markdown sanitizer
only keeps the chart tags/attributes listed there, and validates their values.
Tests: `pnpm test:frontend` (`frontend-tests/chart-renderer.test.mjs`).

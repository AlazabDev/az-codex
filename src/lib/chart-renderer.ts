// Inline charts for chat messages.
// An assistant message can contain a fenced block:
//
//   ```chart
//   {"type":"bar","title":"Revenue","labels":["Q1","Q2"],"series":[{"name":"2026","data":[10,14]}]}
//   ```
//
// The JSON is validated and turned into a small static SVG built only from the
// elements/attributes below. Nothing from the spec is ever emitted unescaped, and
// markdown-renderer's sanitizer uses the same allowlists as defense in depth.

export type ChartType = "bar" | "line" | "area" | "scatter" | "pie";

export const CHART_ALLOWED_TAGS = ["svg", "rect", "line", "circle", "polyline", "path", "text", "title"] as const;

const NUM = /^-?\d+(\.\d+)?$/u;
const COLOR = /^(none|currentColor|#[0-9a-fA-F]{3,8})$/u;

/** attribute -> value validator, shared with the markdown sanitizer */
export const CHART_ATTRIBUTE_VALIDATORS: Record<string, (value: string) => boolean> = {
  x: (v) => NUM.test(v),
  y: (v) => NUM.test(v),
  x1: (v) => NUM.test(v),
  x2: (v) => NUM.test(v),
  y1: (v) => NUM.test(v),
  y2: (v) => NUM.test(v),
  cx: (v) => NUM.test(v),
  cy: (v) => NUM.test(v),
  r: (v) => NUM.test(v),
  rx: (v) => NUM.test(v),
  width: (v) => NUM.test(v),
  height: (v) => NUM.test(v),
  "stroke-width": (v) => NUM.test(v),
  opacity: (v) => NUM.test(v),
  "fill-opacity": (v) => NUM.test(v),
  "stroke-opacity": (v) => NUM.test(v),
  "font-size": (v) => NUM.test(v),
  "font-weight": (v) => /^(400|500|600|700)$/u.test(v),
  fill: (v) => COLOR.test(v),
  stroke: (v) => COLOR.test(v),
  points: (v) => /^[\d\s,.-]+$/u.test(v),
  "stroke-dasharray": (v) => /^[\d\s,.]+$/u.test(v),
  "text-anchor": (v) => /^(start|middle|end)$/u.test(v),
  "stroke-linejoin": (v) => /^(round|miter|bevel)$/u.test(v),
  "stroke-linecap": (v) => /^(round|butt|square)$/u.test(v),
  viewbox: (v) => /^[\d\s.-]+$/u.test(v),
  role: (v) => v === "img"
};

const PAINT = ["fill", "stroke", "stroke-width", "opacity", "fill-opacity", "stroke-opacity"];
export const CHART_TAG_ATTRIBUTES: Record<string, string[]> = {
  svg: ["viewbox", "role", "fill", "stroke"],
  rect: ["x", "y", "width", "height", "rx", ...PAINT],
  line: ["x1", "y1", "x2", "y2", "stroke", "stroke-width", "stroke-dasharray", "opacity", "stroke-opacity"],
  circle: ["cx", "cy", "r", ...PAINT],
  polyline: ["points", ...PAINT, "stroke-linejoin", "stroke-linecap"],
  path: ["d", ...PAINT, "stroke-linejoin", "stroke-linecap"],
  text: ["x", "y", "text-anchor", "font-size", "font-weight", "fill", "opacity", "fill-opacity"],
  title: []
};

const PALETTE = [
  "#d97706", "#2563eb", "#059669", "#dc2626", "#7c3aed", "#0891b2",
  "#db2777", "#65a30d", "#ea580c", "#4f46e5", "#0d9488", "#a16207"
];

const MAX_SERIES = 12;
const MAX_POINTS = 200;
const MAX_SOURCE_CHARS = 100_000;
const W = 640;
const H = 360;

type CategorySeries = { name: string; values: number[] };
type PointSeries = { name: string; points: Array<{ x: number; y: number }> };
type CategoryChart = {
  type: "bar" | "line" | "area" | "pie";
  title: string;
  labels: string[];
  series: CategorySeries[];
  xLabel: string;
  yLabel: string;
};
type ScatterChart = { type: "scatter"; title: string; series: PointSeries[]; xLabel: string; yLabel: string };
type Normalized = CategoryChart | ScatterChart;

function esc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function n(value: number) {
  return String(Math.round(value * 100) / 100);
}

function fmt(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${n(value / 1e9)}B`;
  if (abs >= 1e6) return `${n(value / 1e6)}M`;
  if (abs >= 1e4) return `${n(value / 1e3)}K`;
  return String(Math.round(value * 1000) / 1000);
}

function clip(value: unknown, max: number) {
  const text = String(value ?? "").replace(/[\u0000-\u001f]/gu, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1e15;
}

function normalize(raw: unknown): Normalized | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const spec = raw as Record<string, unknown>;
  const type = String(spec.type ?? "bar").toLowerCase();
  if (!["bar", "line", "area", "scatter", "pie"].includes(type)) return null;
  const title = clip(spec.title, 80);
  const xLabel = clip(spec.xLabel ?? spec.xlabel, 40);
  const yLabel = clip(spec.yLabel ?? spec.ylabel, 40);
  const rawSeries = Array.isArray(spec.series) ? spec.series : null;

  if (type === "scatter") {
    const source = rawSeries ?? (Array.isArray(spec.data) ? [{ name: title || "Series", data: spec.data }] : null);
    if (!source || source.length === 0 || source.length > MAX_SERIES) return null;
    const series: PointSeries[] = [];
    for (const item of source) {
      const entry = item as Record<string, unknown>;
      if (!entry || !Array.isArray(entry.data) || entry.data.length === 0 || entry.data.length > MAX_POINTS) return null;
      const points: Array<{ x: number; y: number }> = [];
      for (const p of entry.data) {
        const x = Array.isArray(p) ? p[0] : (p as Record<string, unknown>)?.x;
        const y = Array.isArray(p) ? p[1] : (p as Record<string, unknown>)?.y;
        if (!isNum(x) || !isNum(y)) return null;
        points.push({ x, y });
      }
      series.push({ name: clip(entry.name ?? `Series ${series.length + 1}`, 30), points });
    }
    return { type, title, series, xLabel, yLabel };
  }

  // category charts: labels + series, or shorthand data: [{label,value}] / data: number[]
  let labels: string[] = [];
  let series: CategorySeries[] = [];
  if (rawSeries) {
    if (!Array.isArray(spec.labels)) return null;
    labels = spec.labels.map((l) => clip(l, 40));
    for (const item of rawSeries) {
      const entry = item as Record<string, unknown>;
      if (!entry || !Array.isArray(entry.data) || !entry.data.every(isNum)) return null;
      series.push({ name: clip(entry.name ?? `Series ${series.length + 1}`, 30), values: entry.data as number[] });
    }
  } else if (Array.isArray(spec.data)) {
    if (spec.data.every((d) => d && typeof d === "object" && !Array.isArray(d))) {
      const rows = spec.data as Array<Record<string, unknown>>;
      if (!rows.every((r) => isNum(r.value))) return null;
      labels = rows.map((r) => clip(r.label ?? r.name, 40));
      series = [{ name: title || "Series", values: rows.map((r) => r.value as number) }];
    } else if (Array.isArray(spec.labels) && spec.data.every(isNum)) {
      labels = spec.labels.map((l) => clip(l, 40));
      series = [{ name: title || "Series", values: spec.data as number[] }];
    } else {
      return null;
    }
  } else {
    return null;
  }
  if (labels.length === 0 || labels.length > MAX_POINTS) return null;
  if (series.length === 0 || series.length > MAX_SERIES) return null;
  if (series.some((s) => s.values.length !== labels.length)) return null;
  if (type === "pie") {
    series = [series[0]];
    if (series[0].values.some((v) => v < 0) || series[0].values.reduce((a, b) => a + b, 0) <= 0) return null;
  }
  return { type: type as "bar" | "line" | "area" | "pie", title, labels, series, xLabel, yLabel };
}

function niceTicks(min: number, max: number, count = 5) {
  if (min === max) {
    max = min + 1;
    min = min > 0 ? 0 : min - 1;
  }
  const rough = (max - min) / count;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / pow;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * pow;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2 && ticks.length < 20; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

const text = (x: number, y: number, body: string, extra = "") =>
  `<text x="${n(x)}" y="${n(y)}" font-size="11" fill="currentColor" fill-opacity="0.7"${extra}>${esc(body)}</text>`;

function legend(names: string[], y: number) {
  if (names.length < 2) return "";
  const widths = names.map((name) => Math.min(name.length, 30) * 6.2 + 28);
  let x = Math.max(16, (W - widths.reduce((a, b) => a + b, 0)) / 2);
  let out = "";
  names.forEach((name, i) => {
    out += `<rect x="${n(x)}" y="${n(y - 9)}" width="10" height="10" rx="2" fill="${PALETTE[i % PALETTE.length]}"/>`;
    out += text(x + 15, y, name);
    x += widths[i];
  });
  return out;
}

function frame(inner: string, label: string) {
  return (
    `<div class="chart-block my-4 rounded-xl border border-gray-200 bg-gray-50/50 p-3 overflow-x-auto">` +
    `<svg class="w-full h-auto" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${inner}</svg></div>`
  );
}

function titleSvg(title: string) {
  return title ? `<text x="${W / 2}" y="22" font-size="14" font-weight="600" text-anchor="middle" fill="currentColor">${esc(title)}</text>` : "";
}

function renderPie(chart: CategoryChart) {
  const values = chart.series[0].values;
  const total = values.reduce((a, b) => a + b, 0);
  const cx = 210;
  const cy = chart.title ? 200 : 180;
  const r = 120;
  let out = titleSvg(chart.title);
  let angle = -Math.PI / 2;
  values.forEach((value, i) => {
    if (value <= 0) return;
    const color = PALETTE[i % PALETTE.length];
    const share = value / total;
    const sweep = share * Math.PI * 2;
    const tip = `<title>${esc(`${chart.labels[i]}: ${fmt(value)} (${n(share * 100)}%)`)}</title>`;
    if (share > 0.9999) {
      out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}">${tip}</circle>`;
    } else {
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      const x2 = cx + r * Math.cos(angle + sweep);
      const y2 = cy + r * Math.sin(angle + sweep);
      out += `<path d="M ${n(cx)} ${n(cy)} L ${n(x1)} ${n(y1)} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${n(x2)} ${n(y2)} Z" fill="${color}" stroke="#ffffff" stroke-width="1">${tip}</path>`;
    }
    angle += sweep;
  });
  const rows = Math.min(values.length, 14);
  for (let i = 0; i < rows; i += 1) {
    const y = 70 + i * 20;
    out += `<rect x="370" y="${y - 9}" width="10" height="10" rx="2" fill="${PALETTE[i % PALETTE.length]}"/>`;
    out += text(386, y, `${chart.labels[i]} — ${n((values[i] / total) * 100)}%`);
  }
  return out;
}

function renderCartesian(chart: Normalized) {
  const labels = chart.type === "scatter" ? [] : chart.labels;
  const multi = chart.series.length > 1;
  const left = 56;
  const right = 16;
  const top = chart.title ? 40 : 16;
  const bottom = 40 + (chart.xLabel ? 14 : 0) + (multi ? 22 : 0);
  const pw = W - left - right;
  const ph = H - top - bottom;

  let xs: number[] = [];
  let ys: number[] = [];
  if (chart.type === "scatter") {
    chart.series.forEach((s) => s.points.forEach((p) => { xs.push(p.x); ys.push(p.y); }));
  } else {
    chart.series.forEach((s) => ys.push(...s.values));
  }
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  if (chart.type === "bar" || chart.type === "area") {
    yMin = Math.min(yMin, 0);
    yMax = Math.max(yMax, 0);
  }
  const yTicks = niceTicks(yMin, yMax);
  yMin = yTicks[0];
  yMax = yTicks[yTicks.length - 1];
  const sy = (v: number) => top + ph - ((v - yMin) / (yMax - yMin || 1)) * ph;

  let xTicks: number[] = [];
  let xMin = 0;
  let xMax = 1;
  if (chart.type === "scatter") {
    xTicks = niceTicks(Math.min(...xs), Math.max(...xs));
    xMin = xTicks[0];
    xMax = xTicks[xTicks.length - 1];
  }
  const count = labels.length;
  const band = count ? pw / count : 0;
  const sx = (v: number) => left + ((v - xMin) / (xMax - xMin || 1)) * pw;
  const cxAt = (i: number) => left + (i + 0.5) * band;

  let out = titleSvg(chart.title);
  for (const tick of yTicks) {
    const y = sy(tick);
    out += `<line x1="${left}" y1="${n(y)}" x2="${W - right}" y2="${n(y)}" stroke="currentColor" stroke-opacity="0.12"/>`;
    out += text(left - 6, y + 4, fmt(tick), ' text-anchor="end"');
  }
  const baseline = sy(Math.max(yMin, Math.min(0, yMax)));
  out += `<line x1="${left}" y1="${n(baseline)}" x2="${W - right}" y2="${n(baseline)}" stroke="currentColor" stroke-opacity="0.4"/>`;

  if (chart.type === "scatter") {
    for (const tick of xTicks) {
      out += text(sx(tick), top + ph + 16, fmt(tick), ' text-anchor="middle"');
    }
  } else {
    const every = Math.ceil(count / 12);
    labels.forEach((label, i) => {
      if (i % every === 0) out += text(cxAt(i), top + ph + 16, clip(label, 14), ' text-anchor="middle"');
    });
  }

  chart.series.forEach((series, si) => {
    const color = PALETTE[si % PALETTE.length];
    if (chart.type === "scatter") {
      (series as PointSeries).points.forEach((p) => {
        out += `<circle cx="${n(sx(p.x))}" cy="${n(sy(p.y))}" r="4" fill="${color}" fill-opacity="0.75"><title>${esc(`${series.name}: (${fmt(p.x)}, ${fmt(p.y)})`)}</title></circle>`;
      });
      return;
    }
    const values = (series as CategorySeries).values;
    if (chart.type === "bar") {
      const group = band * 0.8;
      const bw = group / chart.series.length;
      values.forEach((v, i) => {
        const x = cxAt(i) - group / 2 + si * bw;
        const y = Math.min(sy(v), sy(0));
        const h = Math.abs(sy(v) - sy(0));
        out += `<rect x="${n(x)}" y="${n(y)}" width="${n(Math.max(bw - 2, 1))}" height="${n(Math.max(h, 0.5))}" rx="2" fill="${color}"><title>${esc(`${labels[i]} · ${series.name}: ${fmt(v)}`)}</title></rect>`;
      });
      return;
    }
    const pts = values.map((v, i) => `${n(cxAt(i))},${n(sy(v))}`);
    if (chart.type === "area") {
      const first = cxAt(0);
      const last = cxAt(values.length - 1);
      out += `<path d="M ${n(first)} ${n(sy(0))} L ${pts.join(" L ").replaceAll(",", " ")} L ${n(last)} ${n(sy(0))} Z" fill="${color}" fill-opacity="0.18" stroke="none"/>`;
    }
    out += `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (values.length <= 40) {
      values.forEach((v, i) => {
        out += `<circle cx="${n(cxAt(i))}" cy="${n(sy(v))}" r="3" fill="${color}"><title>${esc(`${labels[i]} · ${series.name}: ${fmt(v)}`)}</title></circle>`;
      });
    }
  });

  if (chart.xLabel) out += text(left + pw / 2, top + ph + 34, chart.xLabel, ' text-anchor="middle"');
  if (chart.yLabel) out += text(left, top - 4, chart.yLabel);
  if (multi) out += legend(chart.series.map((s) => s.name), H - 10);
  return out;
}

/** Returns the chart HTML, or null when the source is not a valid chart spec. */
export function renderChartBlock(source: string): string | null {
  if (source.length > MAX_SOURCE_CHARS) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return null;
  }
  const chart = normalize(parsed);
  if (!chart) return null;
  const inner = chart.type === "pie" ? renderPie(chart) : renderCartesian(chart);
  return frame(inner, chart.title || `${chart.type} chart`);
}

import assert from "node:assert/strict";
import test from "node:test";

import { CHART_ALLOWED_TAGS, CHART_ATTRIBUTE_VALIDATORS, CHART_TAG_ATTRIBUTES, renderChartBlock } from "../src/lib/chart-renderer.ts";
import { renderMarkdown } from "../src/lib/markdown-renderer.ts";

const bar = {
  type: "bar",
  title: "Revenue",
  labels: ["Q1", "Q2", "Q3"],
  series: [
    { name: "2025", data: [10, 14, 9] },
    { name: "2026", data: [12, 18, 15] }
  ]
};

// Every tag/attribute in generated charts must be allowed AND pass its validator,
// otherwise the browser sanitizer would strip it.
function assertSanitizerSafe(html) {
  const tags = [...html.matchAll(/<([a-zA-Z]+)([^>]*)>/gu)];
  for (const [, tag, rawAttrs] of tags) {
    if (tag === "div") continue;
    assert.ok(CHART_ALLOWED_TAGS.includes(tag), `unexpected tag <${tag}>`);
    for (const [, name, value] of rawAttrs.matchAll(/([a-zA-Z-]+)="([^"]*)"/gu)) {
      const key = name.toLowerCase();
      if (key === "class" || key === "aria-label" || key === "d") continue;
      assert.ok(CHART_TAG_ATTRIBUTES[tag].includes(key), `attr ${key} not allowed on <${tag}>`);
      const check = CHART_ATTRIBUTE_VALIDATORS[key];
      assert.ok(!check || check(value), `invalid ${key}="${value}" on <${tag}>`);
    }
  }
  for (const [, d] of html.matchAll(/ d="([^"]*)"/gu)) {
    assert.match(d, /^[ACHLQSTVZMac hlqstvz0-9,.\s-]+$/u);
  }
}

test("renders bar, line, area, scatter and pie charts safely", () => {
  const specs = [
    bar,
    { ...bar, type: "line" },
    { ...bar, type: "area" },
    { type: "scatter", series: [{ name: "pts", data: [[1, 2], { x: 3, y: -4 }] }] },
    { type: "pie", data: [{ label: "A", value: 3 }, { label: "B", value: 1 }] },
    { type: "pie", data: [{ label: "Only", value: 5 }] },
    { type: "bar", labels: ["a", "b"], data: [-3, 4] }
  ];
  for (const spec of specs) {
    const html = renderChartBlock(JSON.stringify(spec));
    assert.ok(html, JSON.stringify(spec));
    assert.match(html, /<svg [^>]*viewBox="0 0 640 360"/u);
    assertSanitizerSafe(html);
  }
});

test("escapes hostile labels and titles", () => {
  const html = renderChartBlock(JSON.stringify({ ...bar, title: '<img src=x onerror=alert(1)>"', labels: ["<script>", "b", "c"] }));
  assert.ok(html);
  assert.doesNotMatch(html, /<img|<script/u);
  assert.match(html, /&lt;script&gt;/u);
});

test("rejects invalid specs", () => {
  assert.equal(renderChartBlock("{not json"), null);
  assert.equal(renderChartBlock(JSON.stringify({ type: "radar", labels: ["a"], data: [1] })), null);
  assert.equal(renderChartBlock(JSON.stringify({ ...bar, series: [{ name: "x", data: [1, 2] }] })), null);
  assert.equal(renderChartBlock(JSON.stringify({ type: "bar", labels: ["a"], data: [1e30] })), null);
  assert.equal(renderChartBlock(JSON.stringify({ type: "pie", data: [{ label: "a", value: 0 }] })), null);
  assert.equal(renderChartBlock(JSON.stringify({ type: "bar", labels: Array(201).fill("a"), data: Array(201).fill(1) })), null);
});

test("markdown renders chart fences and falls back to a code block on bad JSON", () => {
  const ok = renderMarkdown("```chart\n" + JSON.stringify(bar) + "\n```", "Copy code");
  assert.match(ok, /class="chart-block/u);
  assert.doesNotMatch(ok, /code-copy-button/u);

  const bad = renderMarkdown("```chart\n{oops\n```", "Copy code");
  assert.match(bad, /language-chart/u);
  assert.doesNotMatch(bad, /chart-block/u);
});

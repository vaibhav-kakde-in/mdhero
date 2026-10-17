import { describe, expect, it } from "vitest";
import { highlightMarkdownLines } from "../../src/lib/utils/markdown-highlight";

/**
 * Every inline construct looks ahead for its closer, so a line of openers with
 * no closers used to cost quadratic time. The whole document is highlighted on
 * every keystroke, and 20 such lines (195 KB) froze editing for 2–4 s per key.
 * The scan now runs under a per-line work budget (STEPS_PER_CHAR).
 *
 * The time limit here is deliberately loose, about 20× what these take now and
 * about 1/3 of what they took before, so it catches the quadratic behaviour
 * coming back without being flaky on a slow CI runner.
 */
const PATHOLOGICAL: [string, string][] = [
  ["unmatched [", "[".repeat(9999)],
  ["[ with one ] at the end", "[".repeat(9998) + "]"],
  ["unclosed link destinations", "[a](".repeat(2499)],
  ["* openers", "*a ".repeat(3333)],
  ["* openers with a mismatched closer", "*a ".repeat(3332) + "a**"],
  ["_ openers", "_a ".repeat(3333)],
  ["~~ openers", "~~a ".repeat(2499)],
  ["$ math openers", "$a ".repeat(3333)],
];

describe("pathological lines stay fast", () => {
  it.each(PATHOLOGICAL)("%s", (_label, line) => {
    const text = Array(20).fill(line).join("\n");
    const start = performance.now();
    const out = highlightMarkdownLines(text);
    expect(performance.now() - start).toBeLessThan(1000);
    expect(out).toHaveLength(20);
  });
});

describe("a line that runs out of budget", () => {
  const line = "# " + "*a ".repeat(3333);
  const [html] = highlightMarkdownLines(line);

  it("keeps its block syntax coloured", () => {
    expect(html.startsWith('<span class="md-heading">')).toBe(true);
  });

  it("still contains every character of the source, escaped", () => {
    const text = html.replace(/<\/?[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    expect(text).toBe(line);
  });
});

describe("ordinary text is untouched by the budget", () => {
  it("highlights a long realistic paragraph in full", () => {
    const line = "Some **bold** and _em_ with `code` and [a link](https://x.org). ".repeat(150);
    const [html] = highlightMarkdownLines(line);
    expect(html.match(/md-strong/g)).toHaveLength(150);
    expect(html.match(/md-code/g)).toHaveLength(150);
  });
});

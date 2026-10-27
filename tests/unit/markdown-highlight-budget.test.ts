import { describe, expect, it } from "vitest";
import { highlightMarkdownLines } from "../../src/lib/utils/markdown-highlight";

/**
 * Every inline construct looks ahead for its closer, so a line of openers with
 * no closers used to cost quadratic time. The whole document is highlighted on
 * every keystroke, and 20 such lines (195 KB) froze editing for 2–4 s per key.
 * The scan now runs under a per-line work budget (STEPS_PER_CHAR).
 *
 * A fixed millisecond limit was flaky: each case was timed once, cold, while
 * the rest of the suite ran in parallel, and took 500–750 ms that way against
 * 20–60 ms on its own. So each case is now timed against ordinary text of the
 * same length, measured the same way at the same moment: load slows both
 * alike. Warmed up, best of three. These run at 4–9× ordinary text; the old
 * quadratic behaviour ran at well over 100×.
 */
const SLOWER_THAN_ORDINARY = 40;
const ORDINARY = "Some **bold** and _em_ with `code` and [a link](https://x.org). ";

function fastestRun(text: string): number {
  highlightMarkdownLines(text);
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    highlightMarkdownLines(text);
    best = Math.min(best, performance.now() - start);
  }
  return best;
}
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
    const ordinary = Array(20).fill(ORDINARY.repeat(Math.ceil(line.length / ORDINARY.length)).slice(0, line.length)).join("\n");
    expect(highlightMarkdownLines(text)).toHaveLength(20);
    const slowest = SLOWER_THAN_ORDINARY * fastestRun(ordinary);
    expect(fastestRun(text)).toBeLessThan(slowest);
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

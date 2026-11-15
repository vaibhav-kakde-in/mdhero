import { describe, it, expect, vi } from "vitest";

// The unit env is node (no DOM), so DOMPurify can't run. It only sanitizes —
// the token emission happens in the markdown-it layer before it — so we stub
// it as a passthrough and assert the emission itself. `table`/`sub`/`sup`
// surviving sanitization (all in DOMPurify's default allowlist) is covered by
// running the real app; see the PR's manual test checklist.
vi.mock("dompurify", () => ({ default: { sanitize: (html: string) => html } }));

const { render } = await import("../../src/lib/renderer/pipeline");

// Selective raw HTML: block-level <table> and paired inline <sub>/<sup> render
// as HTML; every other raw HTML construct stays escaped text (html stays off).
describe("html-ext: block-level <table>", () => {
  it("renders a single-line HTML table (the MinerU/exporter shape)", () => {
    const html = render(
      '<table><tr><td>任务</td><td>优先级</td><td>任务</td><td>优先级</td></tr>' +
        '<tr><td>串口接收任务</td><td>4</td><td>显示界面任务</td><td>10</td></tr></table>'
    );
    expect(html).toContain("<table>");
    expect(html).toContain("<td>任务</td>");
    expect(html).toContain("<td>串口接收任务</td>");
    expect(html).not.toContain("&lt;table&gt;");
  });

  it("renders a multi-line table with thead/th", () => {
    const html = render("<table>\n<thead>\n<tr>\n<th>A</th>\n<th>B</th>\n</tr>\n</thead>\n</table>");
    expect(html).toContain("<thead>");
    expect(html).toContain("<th>A</th>");
  });

  it("interrupts a paragraph without a blank line (alt chain, like html_block)", () => {
    const html = render("text\n<table><tr><td>x</td></tr></table>");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>x</td>");
    expect(html).toContain("<p");
  });

  it("renders inside a blockquote", () => {
    const html = render("> <table><tr><td>x</td></tr></table>");
    expect(html).toContain("<td>x</td>");
  });

  it("renders an unclosed table to end of document without hanging", () => {
    const html = render("<table>\n<tr><td>x");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>x");
  });

  it("leaves a <table> inside a fenced code block as code text", () => {
    const html = render("```\n<table><tr><td>x</td></tr></table>\n```");
    // highlight.js may auto-detect XML and tokenise the block, but it must
    // never produce a live <table> element from code.
    expect(html).toContain("<pre");
    expect(html).not.toContain("<table>");
    expect(html).not.toContain("<td>");
  });

  it("does not match lookalike tags — <table2> stays text", () => {
    const html = render("<table2><tr><td>x</td></tr></table2>");
    expect(html).toContain("&lt;table2&gt;");
    expect(html).not.toContain("<table>");
  });

  it("treats a 4-space-indented <table> as an indented code block, not a table", () => {
    const html = render("    <table><tr><td>x</td></tr></table>");
    expect(html).toContain("&lt;table&gt;");
    expect(html).not.toContain("<td>x</td>");
  });
});

describe("html-ext: inline <sub>/<sup>", () => {
  it("renders paired subscripts and superscripts", () => {
    expect(render("H<sub>2</sub>O")).toContain("H<sub>2</sub>O");
    expect(render("E = mc<sup>2</sup>")).toContain("mc<sup>2</sup>");
  });

  it("is case-insensitive but keeps the original text", () => {
    expect(render("x<SUB>1</SUB>")).toContain("x<SUB>1</SUB>");
  });

  it("leaves a crossed pair as escaped text", () => {
    expect(render("a<sub>x</sup>")).toContain("&lt;sub&gt;");
  });

  it("leaves an unclosed tag as escaped text", () => {
    expect(render("a<sub>x")).toContain("&lt;sub&gt;");
  });

  it("does not treat attributes as part of the tag (conservative whitelist)", () => {
    expect(render("a<sub class='x'>y</sub>")).toContain("&lt;sub class=");
  });

  it("supports several sub/sup spans in one paragraph", () => {
    const html = render("H<sub>2</sub>O and E=mc<sup>2</sup> and x<sub>1</sub>");
    expect(html).toContain("H<sub>2</sub>O");
    expect(html).toContain("mc<sup>2</sup>");
    expect(html).toContain("x<sub>1</sub>");
  });
});

describe("html-ext: everything else stays text", () => {
  it("escapes other block HTML", () => {
    expect(render("<div>x</div>")).toContain("&lt;div&gt;");
  });

  it("escapes other inline HTML", () => {
    expect(render("a <span>b</span> c")).toContain("&lt;span&gt;");
    expect(render("a <kbd>b</kbd> c")).toContain("&lt;kbd&gt;");
  });
});

// Same hardening standard as the <div dir> wrapper rule (rtl-direction.test.ts):
// the input is attacker-controlled and the renderer runs on the UI thread.
describe("html-ext: hardening", () => {
  it("matches sub/sup in linear time — a 100k run of '<' renders in milliseconds", () => {
    const t = performance.now();
    render("<" + "<".repeat(100_000));
    expect(performance.now() - t).toBeLessThan(500);
  });

  it("matches an unclosed long sub in linear time", () => {
    const t = performance.now();
    render("a<sub>" + "x".repeat(100_000));
    expect(performance.now() - t).toBeLessThan(500);
  });

  it("matches repeated '<sub>' openings in linear time", () => {
    const t = performance.now();
    render("<sub> ".repeat(10_000));
    expect(performance.now() - t).toBeLessThan(500);
  });

  it("renders a 100k-char table in linear time", () => {
    const row = "<tr>" + "<td>x</td>".repeat(100) + "</tr>";
    const doc = "<table>" + row.repeat(50) + "</table>";
    const t = performance.now();
    render(doc);
    expect(performance.now() - t).toBeLessThan(500);
  });
});

import { describe, expect, it } from "vitest";
import { highlightMarkdownLines } from "../../src/lib/utils/markdown-highlight";

/** The whole document's HTML, lines joined back with the newlines they drop. */
const highlightMarkdown = (text: string): string => highlightMarkdownLines(text).join("\n");

/** The text a browser would show for the highlighter's HTML. */
function visibleText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Every `<span class="cls">…</span>` whose content has no nested span, as text. */
function spansOf(html: string, cls: string): string[] {
  const re = new RegExp(`<span class="${cls}">([^<]*)</span>`, "g");
  return [...html.matchAll(re)].map((m) => visibleText(m[1]));
}

const SAMPLE = [
  "---",
  "title: Notes",
  "tags: [a, b]",
  "---",
  "",
  "# Heading *one*",
  "",
  "Setext heading",
  "==============",
  "",
  "Some **bold**, *italic*, ***both***, ~~gone~~ and `code` text.",
  "A [link](https://example.com \"title\") and ![alt](img.png) and [ref][id].",
  "Bare https://example.com/path. Autolink <https://x.org> and <me@example.com>.",
  "Math $a^2 + b^2$ but $5 and $10 stay text. Escaped \\*not em\\*.",
  "snake_case_name and 2 * 3 * 4 are not emphasis.",
  "",
  "> Quote with **bold**",
  "> > nested",
  "",
  "- item",
  "  1. nested",
  "- [ ] todo",
  "- [x] done",
  "",
  "***",
  "",
  "| a | b |",
  "|---|:-:|",
  "| `x|y` | [l](u) |",
  "",
  "```js",
  "const a = \"**not bold**\";",
  "```",
  "",
  "$$",
  "\\int_0^1 x",
  "$$",
  "",
  "[id]: https://example.com/ref \"Title\"",
  "<div>& < > html is text</div>",
].join("\n");

describe("highlightMarkdown", () => {
  it("keeps every character of the source, in order", () => {
    // The editor's mirror layer must wrap exactly like the textarea above it.
    expect(visibleText(highlightMarkdown(SAMPLE))).toBe(SAMPLE);
  });

  it("keeps the text of unclosed and half-typed constructs", () => {
    for (const src of [
      "**bold",
      "*a *b *c",
      "`code",
      "``a`b",
      "[text](url",
      "[text]",
      "![",
      "$x",
      "$$",
      "```",
      "~~~ py\ncode",
      "~x~",
      "<",
      "\\",
      "a\\",
      "| a |\n|--",
      "---\ntitle: x",
      "Heading\n-",
      "",
      "\n\n",
    ]) {
      expect(visibleText(highlightMarkdown(src))).toBe(src);
    }
  });

  it("keeps CRLF line endings", () => {
    const src = SAMPLE.replace(/\n/g, "\r\n");
    expect(visibleText(highlightMarkdown(src))).toBe(src);
  });

  it("escapes markup so the source cannot inject nodes", () => {
    const html = highlightMarkdown('<img src=x onerror="alert(1)"> & <b>');
    expect(html).not.toMatch(/<img|<b>/);
    expect(html).toContain("&lt;img");
    expect(html).toContain("&amp;");
  });

  it("returns one balanced string per line", () => {
    // The editor renders each line in its own element, and a construct must
    // not restyle the lines after it.
    const lines = highlightMarkdownLines(SAMPLE);
    expect(lines).toHaveLength(SAMPLE.split("\n").length);
    for (const line of lines) {
      const opens = (line.match(/<span /g) ?? []).length;
      const closes = (line.match(/<\/span>/g) ?? []).length;
      expect(opens).toBe(closes);
    }
  });
});

describe("block syntax", () => {
  it("marks ATX headings, dimming the hashes", () => {
    const html = highlightMarkdown("## Title");
    expect(html).toBe('<span class="md-heading"><span class="md-mark">##</span> Title</span>');
  });

  it("requires a space after the hashes", () => {
    expect(highlightMarkdown("#hashtag")).toBe("#hashtag");
  });

  it("marks a setext heading and its underline", () => {
    const [text, underline] = highlightMarkdown("Title\n---").split("\n");
    expect(text).toBe('<span class="md-heading">Title</span>');
    expect(underline).toContain("md-heading");
  });

  it("treats --- after a blank line as a rule, not a heading", () => {
    expect(highlightMarkdown("Text\n\n---").split("\n")[2]).toBe('<span class="md-mark">---</span>');
  });

  it("marks list bullets, numbers and task boxes", () => {
    expect(spansOf(highlightMarkdown("- a\n* b\n+ c\n12. d\n3) e"), "md-list")).toEqual([
      "-",
      "*",
      "+",
      "12.",
      "3)",
    ]);
    expect(spansOf(highlightMarkdown("- [ ] a\n- [x] b"), "md-list")).toEqual(["-", "[ ]", "-", "[x]"]);
  });

  it("does not take emphasis or decimals for list markers", () => {
    expect(highlightMarkdown("**bold** start")).not.toContain("md-list");
    expect(highlightMarkdown("1.5 million")).not.toContain("md-list");
  });

  it("marks blockquotes and still highlights inside them", () => {
    const html = highlightMarkdown("> # Quoted *it*");
    expect(html).toMatch(/^<span class="md-quote"><span class="md-mark">&gt; <\/span><span class="md-heading">/);
    expect(html).toContain('<span class="md-em">');
  });

  it("colors fenced code as code, without inline syntax", () => {
    const lines = highlightMarkdown("```ts\nconst a = **b**;\n```\nafter *x*").split("\n");
    expect(lines[0]).toBe('<span class="md-mark">```</span><span class="md-code">ts</span>');
    expect(lines[1]).toBe('<span class="md-code">const a = **b**;</span>');
    expect(lines[2]).toBe('<span class="md-mark">```</span>');
    expect(lines[3]).toContain("md-em");
  });

  it("only closes a fence with the same character and at least as many marks", () => {
    const lines = highlightMarkdown("````\n```\n~~~~\n````\ntext").split("\n");
    expect(lines[1]).toBe('<span class="md-code">```</span>');
    expect(lines[2]).toBe('<span class="md-code">~~~~</span>');
    expect(lines[3]).toBe('<span class="md-mark">````</span>');
    expect(lines[4]).toBe("text");
  });

  it("does not open a fence for inline code written with three backticks", () => {
    expect(highlightMarkdown("```a``` then *x*")).toContain("md-em");
  });

  it("colors $$ math blocks", () => {
    const lines = highlightMarkdown("$$\nx^2\n$$\n*after*").split("\n");
    expect(lines.slice(0, 3).every((l) => l.startsWith('<span class="md-math">'))).toBe(true);
    expect(lines[3]).toContain("md-em");
  });

  it("marks table pipes and the delimiter row", () => {
    const lines = highlightMarkdown("| a | b |\n|---|:-:|\n| c | d |\n\nnot | a table").split("\n");
    expect(spansOf(lines[0], "md-mark")).toEqual(["|", "|", "|"]);
    expect(lines[1]).toBe('<span class="md-mark">|---|:-:|</span>');
    expect(spansOf(lines[2], "md-mark")).toEqual(["|", "|", "|"]);
    expect(lines[4]).toBe("not | a table");
  });

  it("leaves pipes inside table code spans alone", () => {
    const row = highlightMarkdown("| a |\n|---|\n| `x|y` |").split("\n")[2];
    expect(spansOf(row, "md-mark")).toEqual(["|", "`", "`", "|"]);
  });

  it("marks frontmatter keys, only at the very top", () => {
    const lines = highlightMarkdown("---\ntitle: Hi\n---\nbody").split("\n");
    expect(lines[0]).toBe('<span class="md-mark">---</span>');
    expect(spansOf(lines[1], "md-key")).toEqual(["title"]);
    expect(lines[3]).toBe("body");
    expect(highlightMarkdown("text\n\n---\ntitle: Hi\n---")).not.toContain("md-key");
  });

  it("recognises frontmatter after a UTF-8 BOM", () => {
    expect(highlightMarkdown("﻿---\na: 1\n---")).toContain("md-key");
  });

  it("marks reference definitions", () => {
    const html = highlightMarkdown('[id]: https://x.org "T"');
    expect(spansOf(html, "md-link")).toEqual(["id"]);
    expect(spansOf(html, "md-url")).toEqual(["https://x.org"]);
  });
});

describe("inline syntax", () => {
  it("marks emphasis, strong and strikethrough with dimmed delimiters", () => {
    expect(highlightMarkdown("*a*")).toBe(
      '<span class="md-em"><span class="md-mark">*</span>a<span class="md-mark">*</span></span>'
    );
    expect(spansOf(highlightMarkdown("**a** __b__"), "md-mark")).toEqual(["**", "**", "__", "__"]);
    expect(highlightMarkdown("***a***")).toContain('class="md-strong md-em"');
    expect(highlightMarkdown("~~a~~")).toContain('class="md-strike"');
  });

  it("nests emphasis inside strong", () => {
    const html = highlightMarkdown("**bold *it* more**");
    expect(html).toMatch(/^<span class="md-strong">.*<span class="md-em">.*<\/span>.*<\/span>$/);
  });

  it("ignores underscores inside words and stars around spaces", () => {
    expect(highlightMarkdown("snake_case_name")).toBe("snake_case_name");
    expect(highlightMarkdown("2 * 3 * 4")).toBe("2 * 3 * 4");
    expect(highlightMarkdown("~single~")).toBe("~single~");
  });

  it("keeps emphasis on one line", () => {
    expect(highlightMarkdown("*open\nclose*")).toBe("*open\nclose*");
  });

  it("marks code spans, whose content is literal", () => {
    expect(highlightMarkdown("`a *b*`")).toBe(
      '<span class="md-code"><span class="md-mark">`</span>a *b*<span class="md-mark">`</span></span>'
    );
    expect(spansOf(highlightMarkdown("``a ` b``"), "md-mark")).toEqual(["``", "``"]);
  });

  it("marks links and images, with the text apart from the destination", () => {
    const html = highlightMarkdown("[see *this*](https://x.org) ![alt](a.png)");
    expect(spansOf(html, "md-url")).toEqual(["https://x.org", "a.png"]);
    expect(spansOf(html, "md-mark")).toEqual(["[", "*", "*", "](", ")", "![", "](", ")"]);
    expect(html).toContain('<span class="md-link">see <span class="md-em">');
  });

  it("marks reference links but not bare brackets", () => {
    expect(spansOf(highlightMarkdown("[text][ref]"), "md-url")).toEqual(["ref"]);
    expect(highlightMarkdown("[just brackets]")).toBe("[just brackets]");
  });

  it("handles parentheses and brackets inside links", () => {
    const html = highlightMarkdown("[a [b] c](https://x.org/wiki/F_(b)) end");
    expect(spansOf(html, "md-url")).toEqual(["https://x.org/wiki/F_(b)"]);
    expect(html.endsWith(" end")).toBe(true);
  });

  it("marks bare URLs and autolinks, leaving trailing punctuation out", () => {
    expect(spansOf(highlightMarkdown("See https://x.org/a."), "md-link")).toEqual(["https://x.org/a"]);
    expect(spansOf(highlightMarkdown("(www.x.org)"), "md-link")).toEqual(["www.x.org"]);
    expect(spansOf(highlightMarkdown("<https://x.org> <a@b.co>"), "md-link")).toEqual(["https://x.org", "a@b.co"]);
    expect(highlightMarkdown("fhttps://x.org")).not.toContain("md-link");
  });

  it("marks inline math but not prices", () => {
    expect(spansOf(highlightMarkdown("$x^2$ and $$y$$"), "md-math")).toEqual(["$x^2$", "$$y$$"]);
    expect(highlightMarkdown("costs $5 and $10")).not.toContain("md-math");
    expect(highlightMarkdown("$ spaced $")).not.toContain("md-math");
  });

  it("dims the backslash of an escape and keeps the character plain", () => {
    expect(highlightMarkdown("\\*a\\*")).toBe('<span class="md-mark">\\</span>*a<span class="md-mark">\\</span>*');
  });

  it("does not treat HTML as syntax, since the renderer shows it as text", () => {
    expect(highlightMarkdown("<b>x</b>")).toBe("&lt;b&gt;x&lt;/b&gt;");
  });

  it("skips inline scanning on absurdly long lines", () => {
    const line = "*a ".repeat(5000);
    expect(highlightMarkdown(line)).toBe(line);
  });
});

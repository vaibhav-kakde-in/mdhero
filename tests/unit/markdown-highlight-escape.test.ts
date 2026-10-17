import { describe, expect, it } from "vitest";
import { highlightMarkdownLines } from "../../src/lib/utils/markdown-highlight";

/**
 * The editor paints `highlightMarkdownLines` output with `insertAdjacentHTML`
 * (line-patch.ts), and its input is the open document: untrusted. The only
 * thing standing between a document and script injection is that every slice
 * of source text goes through `esc()` before it is concatenated. That holds
 * today, but it depends on every future change to a hand-written scanner
 * remembering to do it, and the example-based tests cannot prove it.
 *
 * So this checks the property itself, over many generated lines built from
 * HTML metacharacters and markdown punctuation:
 *
 *  1. the only tags in the output are `<span class="md-…">` and `</span>`;
 *  2. the only entities are the three `esc()` produces;
 *  3. stripping the tags and decoding gives back the exact source line, which
 *     is also what keeps the coloured layer aligned with the caret.
 *
 * Seeded, so a failure reproduces.
 */

const ALPHABET = [
  "<", ">", "&", '"', "'", "`", "*", "_", "~", "[", "]", "(", ")", "!", "$", "\\", "|", "#", "-",
  ":", "=", " ", "\t", "a", "b", "1", "/", ".", "@", "h", "t", "p", "s", "w", "﻿", "é", "\r",
];
const PAYLOADS = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  '"><svg onload=alert(1)>',
  '<iframe srcdoc="x">',
  "&lt;b&gt;",
  '<a href="javascript:alert(1)">x</a>',
  "`<b>`",
  "[<b>](javascript:x)",
  "**<i>**",
  "$<b>$",
  "<http://a.b/<x>>",
  "https://x.org/<img>",
  "- [ ] <u>",
  "> <b>",
  "| <b> | c |",
  "# <h1>",
];
const BLOCK_LINES = ["---", "```", "$$", "a|b", "|-|-|", "===", "~~~"];

let seed = 142;
function rand(n: number): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed % n;
}
function randomLine(): string {
  let s = "";
  const len = rand(40);
  for (let i = 0; i < len; i++) {
    s += rand(6) === 0 ? PAYLOADS[rand(PAYLOADS.length)] : ALPHABET[rand(ALPHABET.length)];
  }
  return s;
}

const TAG = /<\/?[^>]*>/g;
const ALLOWED_TAG = /^(<span class="md-[a-z]+( md-[a-z]+)?">|<\/span>)$/;
const decode = (html: string): string =>
  html.replace(TAG, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

describe("highlightMarkdownLines escapes everything it is given", () => {
  it("holds for generated lines built from HTML and markdown metacharacters", () => {
    const failures: string[] = [];
    for (let doc = 0; doc < 1000; doc++) {
      const source: string[] = [];
      const n = 1 + rand(10);
      for (let k = 0; k < n; k++) {
        source.push(rand(8) === 0 ? BLOCK_LINES[rand(BLOCK_LINES.length)] : randomLine());
      }
      const out = highlightMarkdownLines(source.join("\n"));
      expect(out).toHaveLength(source.length);
      out.forEach((html, k) => {
        const where = JSON.stringify(source[k]);
        for (const tag of html.match(TAG) ?? []) {
          if (!ALLOWED_TAG.test(tag)) failures.push(`tag ${tag} in ${where}`);
        }
        if (/&(?!lt;|gt;|amp;)/.test(html)) failures.push(`raw & in ${where}`);
        if (decode(html) !== source[k]) failures.push(`text changed in ${where}`);
      });
    }
    expect(failures.slice(0, 5)).toEqual([]);
  });
});

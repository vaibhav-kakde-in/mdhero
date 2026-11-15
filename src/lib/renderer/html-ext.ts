// Selective raw-HTML support.
//
// Raw HTML stays off in this renderer (`html: false` in pipeline.ts — a
// deliberate security/design choice, see addDirPlugin there). This plugin adds
// back exactly the two shapes of HTML that real-world documents carry and
// Markdown has no native syntax for, and nothing else:
//
//   - block-level `<table>…</table>` (e.g. MinerU / exporter output, or docs
//     written for GitHub), emitted as one html_block token — the Markdown
//     table syntax cannot express merged or exporter-generated layouts;
//   - inline paired `<sub>…</sub>` / `<sup>…</sup>` (H₂O, E=mc²), emitted as
//     html_inline tokens.
//
// Both token types render verbatim through markdown-it's default render rules
// — those are registered unconditionally; only the *parser* rules are gated on
// the `html` option — and then through the DOMPurify pass in renderFull, which
// strips scripts, event handlers and anything outside its allowlist (table
// elements, sub and sup are all in DOMPurify's default allowlist). Every other
// HTML construct keeps arriving as escaped text, exactly as before this
// plugin existed.
//
// Only new rules are registered here; no existing rule is modified, so the
// change cannot alter how any previously-rendered document renders.

import type MarkdownIt from "markdown-it";

// `<table` at the start of a line, followed by whitespace or `>`. Up to three
// leading spaces are tolerated — four or more is an indented code block, which
// the `code` rule (earlier in the chain) claims first; the sCount guard in the
// rule backs that up.
const TABLE_START_RE = /^\s{0,3}<table(?:\s|>)/i;
const TABLE_END_RE = /<\/table\s*>/i;

// Paired sub/superscripts, same element on both ends (`<sub>…</sub>` or
// `<sup>…</sup>` — a crossed pair stays text). The content is bounded
// (SUBSUP_MAX_LEN chars) and may not contain `<`, so a failed match can never
// scan further than the bound: linear time on attacker-controlled input, the
// same hardening standard as addDirPlugin's wrapper rule.
const SUBSUP_MAX_LEN = 256;
const SUBSUP_RE = new RegExp(
  `^<(sub|sup)>((?:(?!<)[\\s\\S]){1,${SUBSUP_MAX_LEN}})</(sub|sup)>`,
  "i"
);

export function addHtmlExtPlugin(md: MarkdownIt): void {
  // Before `paragraph` so a table can interrupt a paragraph without a blank
  // line, the same position html_block occupies when `html` is enabled. The
  // alt list mirrors html_block's, so lazy continuation inside lists and
  // blockquotes treats a table line the way it would with raw HTML on.
  md.block.ruler.before(
    "paragraph",
    "html_table",
    (state, startLine, endLine, silent) => {
      if (state.sCount[startLine] - state.blkIndent >= 4) return false;

      const startPos = state.bMarks[startLine] + state.tShift[startLine];
      if (state.src.charCodeAt(startPos) !== 0x3c /* < */) return false;

      const firstLine = state.src.slice(startPos, state.eMarks[startLine]);
      if (!TABLE_START_RE.test(firstLine)) return false;

      // Silent mode only asks "can a block start here?" — the first line
      // already answers that.
      if (silent) return true;

      // Consume through the line holding `</table>`. An unclosed table runs
      // to the end of the document; the browser's table-error recovery then
      // renders it, matching what a browser does with the same source.
      let nextLine = startLine + 1;
      let closed = TABLE_END_RE.test(firstLine);
      while (!closed && nextLine < endLine) {
        const lineText = state.src.slice(
          state.bMarks[nextLine] + state.tShift[nextLine],
          state.eMarks[nextLine]
        );
        if (TABLE_END_RE.test(lineText)) closed = true;
        nextLine++;
      }

      const token = state.push("html_block", "", 0);
      token.map = [startLine, nextLine];
      let content = "";
      for (let line = startLine; line < nextLine; line++) {
        content += state.src.slice(state.bMarks[line], state.eMarks[line]) + "\n";
      }
      token.content = content;

      state.line = nextLine;
      return true;
    },
    { alt: ["paragraph", "reference", "blockquote"] }
  );

  md.inline.ruler.push("html_subsup", (state, silent) => {
    const start = state.pos;
    if (state.src.charCodeAt(start) !== 0x3c /* < */) return false;

    const match = SUBSUP_RE.exec(state.src.slice(start));
    if (!match) return false;
    if (match[1].toLowerCase() !== match[3].toLowerCase()) return false;

    if (!silent) {
      const token = state.push("html_inline", "", 0);
      token.markup = match[1].toLowerCase();
      token.content = match[0];
    }

    state.pos += match[0].length;
    return true;
  });
}

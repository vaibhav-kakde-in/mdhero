/**
 * Markdown syntax highlighting for the editor (#73).
 *
 * Returns the source as HTML, each construct wrapped in a `<span class="md-…">`
 * (colored in Editor.svelte). The editor paints this in a
 * mirror layer behind its transparent `<textarea>`, so the output must hold
 * every character of the source exactly once and in order — tags only, nothing
 * added or dropped — or the mirror's lines would wrap differently from the
 * textarea's and the text would drift away from the caret. For the same reason
 * the CSS may only change color, weight and style, never a glyph's width.
 *
 * Deliberately a small line-based scanner rather than a CommonMark parser. It
 * follows what the renderer treats as syntax (markdown-it with `html: false`,
 * `linkify: true`, GFM tables and strikethrough, texmath `$` math, `---`
 * frontmatter) closely enough to read the source by, and every inline
 * construct ends with its line, so a lone `*` typed mid-edit cannot recolor the
 * rest of the document.
 */

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };

const esc = (s: string): string => s.replace(/[&<>]/g, (ch) => HTML_ESCAPES[ch]);

const span = (cls: string, html: string): string => (html ? `<span class="${cls}">${html}</span>` : "");

/** Lines longer than this are escaped but not scanned for inline syntax: the
 *  emphasis and link lookups are quadratic in the worst case, and a line this
 *  long is generated data, not prose anyone reads in the editor. */
const MAX_INLINE_LINE = 10_000;

// --- Block patterns (one line at a time; `\r` tolerated for CRLF files) -----

/** Same shape the renderer strips (`FRONTMATTER_RE` in pipeline.ts), BOM allowed. */
const FRONTMATTER_OPEN_RE = /^\uFEFF?---\r?$/;
const FRONTMATTER_CLOSE_RE = /^---\r?$/;
const FRONTMATTER_KEY_RE = /^(\s*)([\w-][\w .-]*)(:)([^\n]*)$/;
const FENCE_RE = /^(\s*)(`{3,}|~{3,})([^\n]*)$/;
const ATX_HEADING_RE = /^( {0,3})(#{1,6})(?=[ \t\r]|$)([^\n]*)$/;
const SETEXT_UNDERLINE_RE = /^ {0,3}(?:=+|-+)[ \t\r]*$/;
const HR_RE = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}\r?$/;
const QUOTE_RE = /^((?:[ \t]*>[ \t]?)+)([^\n]*)$/;
const LIST_RE = /^(\s*)([*+-]|\d{1,9}[.)])([ \t]+|(?=\r?$))(\[[ xX]\](?=[ \t\r]|$))?([^\n]*)$/;
const REF_DEF_RE = /^( {0,3})\[([^\]]+)\]:([ \t]*)(\S*)([^\n]*)$/;
const TABLE_DELIM_RE = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t\r]*$/;
const MATH_BLOCK_RE = /^\s*\$\$/;
const BLANK_RE = /^\s*$/;

// --- Inline patterns ---------------------------------------------------------

const ASCII_PUNCT_RE = /[!-/:-@[-`{-~]/;
const WHITESPACE_RE = /\s/;
const ALNUM_RE = /[\p{L}\p{N}]/u;
const AUTOLINK_RE = /<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)>/y;
/** The URLs markdown-it's linkify turns into links without any markup. */
const BARE_URL_RE = /(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>]+/y;
const URL_TRAILING_PUNCT_RE = /[.,:;!?"'*_~]$/;

const isSpace = (ch: string | undefined): boolean => ch === undefined || WHITESPACE_RE.test(ch);
const isAlnum = (ch: string | undefined): boolean => ch !== undefined && ALNUM_RE.test(ch);

/** Length of the run of `ch` starting at `from`. */
function runLength(s: string, from: number, ch: string): number {
  let i = from;
  while (s[i] === ch) i++;
  return i - from;
}

/**
 * Index just past the code span opening at `from` (a run of backticks), or -1
 * when the run has no closing run of the same length on the line.
 */
function codeSpanEnd(s: string, from: number): number {
  const run = runLength(s, from, "`");
  let i = from + run;
  while (i < s.length) {
    if (s[i] !== "`") {
      i++;
      continue;
    }
    const close = runLength(s, i, "`");
    if (close === run) return i + close;
    i += close;
  }
  return -1;
}

/**
 * Index of the bracket closing the one at `open` (`[`/`]` or `(`/`)`), or -1.
 * Skips backslash escapes and code spans, which cannot close a link.
 */
function matchingBracket(s: string, open: number, openCh: string, closeCh: string): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\") {
      i++;
    } else if (ch === "`" && openCh === "[") {
      const end = codeSpanEnd(s, i);
      if (end > 0) i = end - 1;
      else i += runLength(s, i, "`") - 1;
    } else if (ch === openCh) {
      depth++;
    } else if (ch === closeCh && --depth === 0) {
      return i;
    }
  }
  return -1;
}

/**
 * Start of the delimiter run closing the emphasis opened by `run` copies of
 * `ch` at `from`, or -1. Approximates CommonMark's flanking rules: the closer
 * must follow a non-space, and `_` never closes inside a word (`snake_case`).
 */
function emphasisClose(s: string, from: number, ch: string, run: number): number {
  let i = from + run;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\") {
      i += 2;
    } else if (c === "`") {
      const end = codeSpanEnd(s, i);
      i = end > 0 ? end : i + runLength(s, i, "`");
    } else if (c === ch) {
      const len = runLength(s, i, ch);
      const canClose = !isSpace(s[i - 1]) && (ch !== "_" || !isAlnum(s[i + len]));
      if (len === run && canClose && i > from + run) return i;
      i += len;
    } else {
      i++;
    }
  }
  return -1;
}

/** Drop the punctuation GFM leaves outside a bare URL ("see https://x.org."). */
function trimBareUrl(url: string): string {
  let u = url;
  for (;;) {
    if (URL_TRAILING_PUNCT_RE.test(u)) {
      u = u.slice(0, -1);
    } else if (u.endsWith(")") && u.split("(").length < u.split(")").length) {
      u = u.slice(0, -1);
    } else {
      return u;
    }
  }
}

/**
 * Highlights the inline syntax of one line (or of a piece of one).
 *
 * @param pipes Mark unescaped `|` as table cell separators.
 */
function inline(s: string, pipes = false): string {
  if (s.length > MAX_INLINE_LINE) return esc(s);

  let out = "";
  let plainFrom = 0;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    let html: string | null = null;
    let end = i + 1;

    if (ch === "\\" && i + 1 < s.length && ASCII_PUNCT_RE.test(s[i + 1])) {
      // Escaped punctuation is literal text; dim the backslash.
      html = span("md-mark", "\\") + esc(s[i + 1]);
      end = i + 2;
    } else if (ch === "`") {
      const close = codeSpanEnd(s, i);
      const run = runLength(s, i, "`");
      if (close > 0) {
        const ticks = span("md-mark", s.slice(i, i + run));
        html = span("md-code", ticks + esc(s.slice(i + run, close - run)) + ticks);
        end = close;
      } else {
        end = i + run; // a lone run stays text, and so do its backticks
      }
    } else if (ch === "$") {
      end = inlineMathEnd(s, i);
      if (end > i + 1) html = span("md-math", esc(s.slice(i, end)));
      else end = i + runLength(s, i, "$");
    } else if (ch === "<") {
      AUTOLINK_RE.lastIndex = i;
      const m = AUTOLINK_RE.exec(s);
      if (m) {
        html = span("md-mark", "&lt;") + span("md-link", esc(m[1])) + span("md-mark", "&gt;");
        end = i + m[0].length;
      }
    } else if (ch === "[" || (ch === "!" && s[i + 1] === "[")) {
      const link = inlineLink(s, i, pipes);
      if (link) [html, end] = link;
    } else if (ch === "*" || ch === "_" || ch === "~") {
      const run = runLength(s, i, ch);
      const opens =
        !isSpace(s[i + run]) &&
        (ch !== "_" || !isAlnum(s[i - 1])) &&
        (ch === "~" ? run === 2 : run <= 3);
      const close = opens ? emphasisClose(s, i, ch, run) : -1;
      if (close > 0) {
        const cls = ch === "~" ? "md-strike" : run === 1 ? "md-em" : run === 2 ? "md-strong" : "md-strong md-em";
        const delims = span("md-mark", s.slice(i, i + run));
        html = span(cls, delims + inline(s.slice(i + run, close), pipes) + delims);
        end = close + run;
      } else {
        end = i + run;
      }
    } else if (ch === "|" && pipes) {
      html = span("md-mark", "|");
    } else if ((ch === "h" || ch === "f" || ch === "w") && !isAlnum(s[i - 1])) {
      BARE_URL_RE.lastIndex = i;
      const m = BARE_URL_RE.exec(s);
      const url = m ? trimBareUrl(m[0]) : "";
      if (url.length > 7) {
        html = span("md-link", esc(url));
        end = i + url.length;
      }
    }

    if (html !== null) {
      out += esc(s.slice(plainFrom, i)) + html;
      plainFrom = end;
    }
    i = end;
  }
  return out + esc(s.slice(plainFrom));
}

/**
 * End of the inline math opening at `from` (just past its closing `$`), or
 * `from` when it is not math. texmath's dollar rules: `$…$` cannot start with
 * a space nor end with one, and a closing `$` followed by a digit is a price
 * ("$5 and $10"), not math. `$$…$$` also works inline.
 */
function inlineMathEnd(s: string, from: number): number {
  if (s[from + 1] === "$") {
    const close = s.indexOf("$$", from + 2);
    return close > from + 2 ? close + 2 : from;
  }
  if (isSpace(s[from + 1])) return from;
  for (let i = from + 2; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
    } else if (s[i] === "$") {
      if (!isSpace(s[i - 1]) && !/\d/.test(s[i + 1] ?? "")) return i + 1;
    }
  }
  return from;
}

/**
 * Highlights the link or image starting at `from` (`[` or `![`): inline
 * `[text](url)` and full references `[text][ref]`. Returns the HTML and the
 * index past the link, or null for brackets that are plain text (including
 * shortcut references, which only count if defined — beyond a line scanner).
 */
function inlineLink(s: string, from: number, pipes: boolean): [string, number] | null {
  const open = s[from] === "!" ? from + 1 : from;
  const close = matchingBracket(s, open, "[", "]");
  if (close < 0) return null;

  const text = span("md-link", inline(s.slice(open + 1, close), pipes));
  const lead = span("md-mark", esc(s.slice(from, open + 1)));
  const next = s[close + 1];
  if (next === "(") {
    const end = matchingBracket(s, close + 1, "(", ")");
    if (end < 0) return null;
    const html =
      lead + text + span("md-mark", "](") + span("md-url", esc(s.slice(close + 2, end))) + span("md-mark", ")");
    return [html, end + 1];
  }
  if (next === "[") {
    const end = s.indexOf("]", close + 2);
    if (end < 0) return null;
    const html =
      lead + text + span("md-mark", "][") + span("md-url", esc(s.slice(close + 2, end))) + span("md-mark", "]");
    return [html, end + 1];
  }
  return null;
}

/** What a line was classified as, for the setext check on the line after it. */
type LineKind = "paragraph" | "other";

/**
 * Highlights one line outside fences, math blocks and frontmatter.
 *
 * @param inQuote Set for the text after a `>` marker, which is re-classified so
 *   quoted headings, lists and emphasis are still recognised.
 */
function blockLine(line: string, pipes: boolean, inQuote = false): [string, LineKind] {
  if (BLANK_RE.test(line)) return [esc(line), "other"];

  if (pipes) {
    return TABLE_DELIM_RE.test(line) ? [span("md-mark", esc(line)), "other"] : [inline(line, true), "other"];
  }

  let m = ATX_HEADING_RE.exec(line);
  if (m) {
    return [esc(m[1]) + span("md-heading", span("md-mark", m[2]) + inline(m[3])), "other"];
  }

  if (HR_RE.test(line)) return [span("md-mark", esc(line)), "other"];

  m = QUOTE_RE.exec(line);
  if (m && !inQuote) {
    const [rest] = blockLine(m[2], false, true);
    return [span("md-quote", span("md-mark", esc(m[1])) + rest), "other"];
  }

  m = LIST_RE.exec(line);
  if (m) {
    const [, indent, marker, gap, task, rest] = m;
    const html =
      esc(indent) + span("md-list", esc(marker)) + esc(gap) + (task ? span("md-list", esc(task)) : "") + inline(rest);
    return [html, "other"];
  }

  m = REF_DEF_RE.exec(line);
  if (m) {
    const [, indent, label, gap, url, title] = m;
    const html =
      esc(indent) +
      span("md-mark", "[") +
      span("md-link", esc(label)) +
      span("md-mark", "]:") +
      esc(gap) +
      span("md-url", esc(url)) +
      esc(title);
    return [html, "other"];
  }

  return [inline(line), "paragraph"];
}

/**
 * Returns `text` as HTML, one string per line (split on `\n`), with its
 * Markdown syntax wrapped in `md-*` spans. No span crosses a line break, so
 * each line can be rendered — and re-rendered — on its own.
 */
export function highlightMarkdownLines(text: string): string[] {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;

  if (FRONTMATTER_OPEN_RE.test(lines[0])) {
    const close = lines.findIndex((l, k) => k >= 2 && FRONTMATTER_CLOSE_RE.test(l));
    if (close > 0) {
      out.push(span("md-mark", esc(lines[0])));
      for (i = 1; i < close; i++) {
        const m = FRONTMATTER_KEY_RE.exec(lines[i]);
        out.push(
          m
            ? span("md-meta", esc(m[1]) + span("md-key", esc(m[2])) + span("md-mark", m[3]) + esc(m[4]))
            : span("md-meta", esc(lines[i]))
        );
      }
      out.push(span("md-mark", esc(lines[close])));
      i = close + 1;
    }
  }

  let fence: { ch: string; len: number } | null = null;
  let inMath = false;
  let inTable = false;
  let setextNext = false;

  for (; i < lines.length; i++) {
    const line = lines[i];

    if (fence) {
      const m = FENCE_RE.exec(line);
      if (m && m[2][0] === fence.ch && m[2].length >= fence.len && BLANK_RE.test(m[3])) {
        out.push(span("md-mark", esc(line)));
        fence = null;
      } else {
        out.push(span("md-code", esc(line)));
      }
      continue;
    }

    if (inMath) {
      out.push(span("md-math", esc(line)));
      if (line.includes("$$")) inMath = false;
      continue;
    }

    if (setextNext) {
      out.push(span("md-heading", span("md-mark", esc(line))));
      setextNext = false;
      continue;
    }

    const fenceOpen = FENCE_RE.exec(line);
    if (fenceOpen && !(fenceOpen[2][0] === "`" && fenceOpen[3].includes("`"))) {
      const [, indent, marks, info] = fenceOpen;
      out.push(esc(indent) + span("md-mark", marks) + span("md-code", esc(info)));
      fence = { ch: marks[0], len: marks.length };
      inTable = false;
      continue;
    }

    if (MATH_BLOCK_RE.test(line)) {
      out.push(span("md-math", esc(line)));
      const afterOpen = line.slice(line.indexOf("$$") + 2);
      inMath = !afterOpen.includes("$$");
      inTable = false;
      continue;
    }

    const next = lines[i + 1];
    if (inTable && (BLANK_RE.test(line) || !line.includes("|"))) inTable = false;
    if (!inTable && line.includes("|") && next !== undefined && next.includes("|") && TABLE_DELIM_RE.test(next)) {
      inTable = true;
    }

    const [html, kind] = blockLine(line, inTable);
    if (kind === "paragraph" && next !== undefined && SETEXT_UNDERLINE_RE.test(next)) {
      out.push(span("md-heading", html));
      setextNext = true;
    } else {
      out.push(html);
    }
  }

  return out;
}

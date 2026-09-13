/**
 * Line-number gutter helpers, shared by the editor (#53) and the raw markdown
 * view (#110).
 *
 * Both panes render the numbers the same way: a transparent mirror element that
 * wraps identically to the text it shadows (same font, content width and
 * wrapping rules), with one block per logical line and a CSS counter drawing the
 * number. Because the mirror wraps the same way, a soft-wrapped line occupies
 * the same height in both layers and its number stays aligned with the line's
 * first row — no JS height measuring.
 *
 * The editor needs a mirror because a `<textarea>` cannot carry per-line
 * decorations. The raw view uses one for a different reason: `scroll-sync`
 * measures that pane via `pre.textContent`, and `textContent` puts no newlines
 * between block elements, so splitting the source into per-line elements would
 * silently corrupt line-anchored scrolling.
 */

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Zero-width space: keeps an empty line's block one line-box tall instead of
 *  collapsing to zero height, which would desync every number below it. */
const EMPTY_LINE = "​";

/**
 * CSS width the gutter column needs for `lineCount` numbers.
 *
 * Monospace, so `ch` is exact. Always reserves at least two digits so the
 * column does not visibly resize between line 9 and line 10.
 */
export function gutterWidth(lineCount: number): string {
  return `calc(${Math.max(2, String(Math.max(1, lineCount)).length)}ch + 16px)`;
}

/**
 * Builds the mirror's inner HTML: one `div.gl` per logical line.
 *
 * @param text Source text the gutter shadows.
 * @param activeLine Zero-based line to mark with `.gl.active`, or `-1` for none
 *   (the raw view has no caret, so it passes `-1`).
 */
export function gutterHtml(text: string, activeLine = -1): string {
  return text
    .split("\n")
    .map(
      (line, i) =>
        `<div class="gl${i === activeLine ? " active" : ""}">${escapeHtml(line) || EMPTY_LINE}</div>`
    )
    .join("");
}

/** Number of logical lines in `text`. */
export function lineCount(text: string): number {
  return text.split("\n").length;
}

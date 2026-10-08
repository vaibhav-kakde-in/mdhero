/**
 * Keeps a container's one-element-per-line children in step with a list of
 * per-line HTML strings, touching only the lines that changed.
 *
 * The editor's syntax layer (#73) is redrawn on every keystroke. Replacing its
 * whole innerHTML each time makes the browser re-parse, restyle and re-lay out
 * the entire document for a one-character edit, which gets slow on long files.
 * Diffing the line lists instead turns typing into a one-line update: only the
 * run between the unchanged start and the unchanged end is replaced.
 */

export interface LineRange {
  /** First index that differs. */
  start: number;
  /** End (exclusive) of the differing run in the old list. */
  prevEnd: number;
  /** End (exclusive) of the differing run in the new list. */
  nextEnd: number;
}

/** The run that differs between `prev` and `next`, after their common start and end. */
export function changedRange(prev: readonly string[], next: readonly string[]): LineRange {
  const max = Math.min(prev.length, next.length);
  let start = 0;
  while (start < max && prev[start] === next[start]) start++;

  let prevEnd = prev.length;
  let nextEnd = next.length;
  while (prevEnd > start && nextEnd > start && prev[prevEnd - 1] === next[nextEnd - 1]) {
    prevEnd--;
    nextEnd--;
  }
  return { start, prevEnd, nextEnd };
}

/**
 * Updates `container`, whose children render `prev` one line per `div.<cls>`,
 * so that they render `next`.
 */
export function patchLines(
  container: HTMLElement,
  prev: readonly string[],
  next: readonly string[],
  cls: string
): void {
  const { start, prevEnd, nextEnd } = changedRange(prev, next);
  for (let i = prevEnd - 1; i >= start; i--) container.children[i]?.remove();

  let html = "";
  for (let i = start; i < nextEnd; i++) html += `<div class="${cls}">${next[i]}</div>`;
  if (!html) return;

  const before = container.children[start];
  if (before) before.insertAdjacentHTML("beforebegin", html);
  else container.insertAdjacentHTML("beforeend", html);
}

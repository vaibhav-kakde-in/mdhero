/**
 * Undo/redo history for the editor (#182), owned by the app rather than the
 * <textarea>.
 *
 * The textarea's built-in history can't be relied on: any edit the app makes
 * itself (Tab indent) replaces the text and wipes it, and it belongs to the
 * DOM element, which is rebuilt on every tab switch and Cmd+E toggle. This
 * history is kept per tab (see `historyFor`) for as long as the tab is open.
 *
 * Each step stores only the changed run of text (the part between the
 * unchanged start and end), so a long document costs a few bytes per
 * keystroke, not a copy of the whole file.
 */

export interface TextSelection {
  start: number;
  end: number;
}

/**
 * How an edit was made, which decides whether it can merge into the step
 * before it. Typing and deleting merge into one step per word; anything else
 * (paste, cut, Enter, Tab, a reload from disk) is a step of its own.
 */
export type EditKind = "type" | "delete" | "other";

interface Step {
  /** Offset of the changed run. */
  at: number;
  removed: string;
  inserted: string;
  /** Selection before the edit, restored by undo. */
  before: TextSelection;
  /** Selection after the edit, restored by redo. */
  after: TextSelection;
  kind: EditKind;
  time: number;
}

export interface HistoryState {
  text: string;
  selection: TextSelection;
}

/** Steps kept per tab. Older ones are dropped first. */
export const HISTORY_LIMIT = 500;
/** A pause longer than this starts a new step even mid-word. */
export const GROUP_MS = 1000;

const SPACE = /\s/;

/** Maps an `InputEvent.inputType` to how the edit groups. */
export function editKind(inputType: string | undefined): EditKind {
  if (inputType === "insertText" || inputType === "insertCompositionText") return "type";
  if (inputType === "deleteContentBackward" || inputType === "deleteContentForward") return "delete";
  return "other";
}

/** The run that differs between `prev` and `next`, after their common start and end. */
export function diffText(prev: string, next: string): { at: number; removed: string; inserted: string } {
  const max = Math.min(prev.length, next.length);
  let at = 0;
  while (at < max && prev.charCodeAt(at) === next.charCodeAt(at)) at++;
  let prevEnd = prev.length;
  let nextEnd = next.length;
  while (prevEnd > at && nextEnd > at && prev.charCodeAt(prevEnd - 1) === next.charCodeAt(nextEnd - 1)) {
    prevEnd--;
    nextEnd--;
  }
  return { at, removed: prev.slice(at, prevEnd), inserted: next.slice(at, nextEnd) };
}

export class EditHistory {
  private undoStack: Step[] = [];
  private redoStack: Step[] = [];
  /** Set by undo/redo: the next edit is a new step, never merged into the one before. */
  private sealed = false;

  /** The text the history last saw. Every step is relative to it. */
  text: string;

  constructor(text: string) {
    this.text = text;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Records `next` as the new text. A no-op when nothing changed. */
  record(next: string, before: TextSelection, after: TextSelection, kind: EditKind, now = Date.now()) {
    if (next === this.text) return;
    const step: Step = { ...diffText(this.text, next), before, after, kind, time: now };
    this.text = next;
    this.redoStack = [];

    const top = this.undoStack[this.undoStack.length - 1];
    const merged = !this.sealed && top !== undefined && this.merge(top, step);
    this.sealed = false;
    if (merged) return;
    this.undoStack.push(step);
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
  }

  /**
   * Records a change made outside the editor (the file reloaded from disk) as
   * one undoable step, with the caret at the end of the changed run.
   */
  recordExternal(next: string, now = Date.now()) {
    if (next === this.text) return;
    const { at, removed, inserted } = diffText(this.text, next);
    const before = { start: at, end: at + removed.length };
    const after = { start: at + inserted.length, end: at + inserted.length };
    this.record(next, before, after, "other", now);
  }

  undo(): HistoryState | null {
    const step = this.undoStack.pop();
    if (!step) return null;
    this.redoStack.push(step);
    this.sealed = true;
    this.text = this.text.slice(0, step.at) + step.removed + this.text.slice(step.at + step.inserted.length);
    return { text: this.text, selection: step.before };
  }

  redo(): HistoryState | null {
    const step = this.redoStack.pop();
    if (!step) return null;
    this.undoStack.push(step);
    this.sealed = true;
    this.text = this.text.slice(0, step.at) + step.inserted + this.text.slice(step.at + step.removed.length);
    return { text: this.text, selection: step.after };
  }

  /** Folds `step` into `top` when they read as one edit. */
  private merge(top: Step, step: Step): boolean {
    if (step.kind !== top.kind || step.kind === "other") return false;
    if (step.time - top.time > GROUP_MS) return false;

    if (step.kind === "type") {
      // Each word with the spaces after it is one step: typing a non-space
      // right after a space starts the next one.
      const contiguous = step.removed === "" && step.at === top.at + top.inserted.length;
      const last = top.inserted[top.inserted.length - 1] ?? "";
      if (!contiguous || (SPACE.test(last) && !SPACE.test(step.inserted[0] ?? ""))) return false;
      top.inserted += step.inserted;
    } else {
      if (step.inserted !== "" || top.inserted !== "") return false;
      if (step.at + step.removed.length === top.at) {
        // Backspace: the run grows to the left.
        top.at = step.at;
        top.removed = step.removed + top.removed;
      } else if (step.at === top.at) {
        // Forward delete: the run grows to the right.
        top.removed += step.removed;
      } else {
        return false;
      }
    }
    top.after = step.after;
    top.time = step.time;
    return true;
  }
}

const histories = new Map<string, EditHistory>();

/**
 * The history for a tab, created on first use. When the tab's text changed
 * while no editor was open (a reload from disk in viewer mode), that change
 * becomes one undoable step, so the history never points at stale offsets.
 */
export function historyFor(tabId: string, text: string): EditHistory {
  let history = histories.get(tabId);
  if (!history) {
    history = new EditHistory(text);
    histories.set(tabId, history);
  } else {
    history.recordExternal(text);
  }
  return history;
}

/** Forgets a closed tab's history. */
export function dropHistory(tabId: string) {
  histories.delete(tabId);
}

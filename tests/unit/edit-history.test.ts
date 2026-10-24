import { describe, expect, it } from "vitest";
import {
  EditHistory,
  GROUP_MS,
  HISTORY_LIMIT,
  diffText,
  dropHistory,
  editKind,
  historyFor,
} from "../../src/lib/utils/edit-history";

const caret = (at: number) => ({ start: at, end: at });

/** Types `text` one character at a time from the end of the history's text. */
function type(h: EditHistory, text: string, now = 0) {
  for (const ch of text) {
    const at = h.text.length;
    h.record(h.text + ch, caret(at), caret(at + 1), "type", now);
  }
}

/** Presses Backspace `n` times at the end of the history's text. */
function backspace(h: EditHistory, n: number, now = 0) {
  for (let i = 0; i < n; i++) {
    const at = h.text.length;
    h.record(h.text.slice(0, -1), caret(at), caret(at - 1), "delete", now);
  }
}

describe("diffText", () => {
  it("isolates the changed run", () => {
    expect(diffText("hello world", "hello brave world")).toEqual({ at: 6, removed: "", inserted: "brave " });
    expect(diffText("abc", "aXc")).toEqual({ at: 1, removed: "b", inserted: "X" });
    expect(diffText("abc", "abc")).toEqual({ at: 3, removed: "", inserted: "" });
  });

  it("doesn't let the common start and end overlap on repeated text", () => {
    expect(diffText("aa", "aaa")).toEqual({ at: 2, removed: "", inserted: "a" });
  });
});

describe("editKind", () => {
  it("groups typing and single-character deletes, and nothing else", () => {
    expect(editKind("insertText")).toBe("type");
    expect(editKind("insertCompositionText")).toBe("type");
    expect(editKind("deleteContentBackward")).toBe("delete");
    expect(editKind("deleteContentForward")).toBe("delete");
    expect(editKind("insertFromPaste")).toBe("other");
    expect(editKind("deleteByCut")).toBe("other");
    expect(editKind("insertLineBreak")).toBe("other");
    expect(editKind(undefined)).toBe("other");
  });
});

describe("EditHistory", () => {
  it("undoes and redoes back to each state", () => {
    const h = new EditHistory("");
    h.record("one", caret(0), caret(3), "other");
    h.record("one two", caret(3), caret(7), "other");

    expect(h.undo()).toEqual({ text: "one", selection: caret(3) });
    expect(h.undo()).toEqual({ text: "", selection: caret(0) });
    expect(h.undo()).toBeNull();
    expect(h.redo()).toEqual({ text: "one", selection: caret(3) });
    expect(h.redo()).toEqual({ text: "one two", selection: caret(7) });
    expect(h.redo()).toBeNull();
  });

  it("undoes a word at a time, not a character at a time", () => {
    const h = new EditHistory("");
    type(h, "hello world");
    expect(h.undo()?.text).toBe("hello ");
    expect(h.undo()?.text).toBe("");
    expect(h.canUndo).toBe(false);
  });

  it("starts a new step after a pause", () => {
    const h = new EditHistory("");
    type(h, "ab", 0);
    type(h, "cd", GROUP_MS + 1);
    expect(h.undo()?.text).toBe("ab");
  });

  it("keeps paste, Enter and Tab as their own steps", () => {
    const h = new EditHistory("");
    type(h, "a");
    h.record("a  ", caret(1), caret(3), "other");
    h.record("a  b", caret(3), caret(4), "type");
    expect(h.undo()?.text).toBe("a  ");
    expect(h.undo()?.text).toBe("a");
  });

  it("merges a run of Backspace into one step", () => {
    const h = new EditHistory("hello");
    backspace(h, 3);
    expect(h.text).toBe("he");
    expect(h.undo()).toEqual({ text: "hello", selection: caret(5) });
  });

  it("merges a run of forward Delete into one step", () => {
    const h = new EditHistory("hello");
    h.record("ello", caret(0), caret(0), "delete");
    h.record("llo", caret(0), caret(0), "delete");
    expect(h.undo()).toEqual({ text: "hello", selection: caret(0) });
  });

  it("restores the selection that was replaced", () => {
    const h = new EditHistory("hello world");
    h.record("hello there", { start: 6, end: 11 }, caret(11), "other");
    expect(h.undo()).toEqual({ text: "hello world", selection: { start: 6, end: 11 } });
  });

  it("drops redo once a new edit is made", () => {
    const h = new EditHistory("");
    h.record("a", caret(0), caret(1), "other");
    h.undo();
    h.record("b", caret(0), caret(1), "other");
    expect(h.canRedo).toBe(false);
    expect(h.undo()?.text).toBe("");
  });

  it("never merges the first edit after an undo into the step before it", () => {
    const h = new EditHistory("");
    type(h, "item");
    h.record("item X", caret(4), caret(6), "other");
    h.undo();
    type(h, "s");
    expect(h.undo()?.text).toBe("item");
  });

  it("ignores a record that changes nothing", () => {
    const h = new EditHistory("same");
    h.record("same", caret(0), caret(0), "other");
    expect(h.canUndo).toBe(false);
  });

  it("makes an outside change (a reload from disk) one undoable step", () => {
    const h = new EditHistory("line one\n");
    h.recordExternal("line one\nline two\n");
    expect(h.undo()).toEqual({ text: "line one\n", selection: caret(9) });
    expect(h.redo()).toEqual({ text: "line one\nline two\n", selection: caret(18) });
  });

  it(`keeps at most ${HISTORY_LIMIT} steps, dropping the oldest`, () => {
    const h = new EditHistory("");
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) h.record(h.text + "\n", caret(i), caret(i + 1), "other");
    let undone = 0;
    while (h.undo()) undone++;
    expect(undone).toBe(HISTORY_LIMIT);
    expect(h.text).toBe("\n".repeat(10));
  });
});

describe("historyFor", () => {
  it("keeps one history per tab, across editor remounts", () => {
    const h = historyFor("tab-a", "draft");
    h.record("draft!", caret(5), caret(6), "other");
    expect(historyFor("tab-a", "draft!")).toBe(h);
    expect(historyFor("tab-b", "draft")).not.toBe(h);
    dropHistory("tab-a");
    dropHistory("tab-b");
  });

  it("records a change made while no editor was open", () => {
    const h = historyFor("tab-c", "old");
    expect(historyFor("tab-c", "new").undo()?.text).toBe("old");
    expect(h.text).toBe("old");
    dropHistory("tab-c");
  });

  it("starts fresh once the tab is closed", () => {
    const h = historyFor("tab-d", "x");
    dropHistory("tab-d");
    expect(historyFor("tab-d", "x")).not.toBe(h);
    dropHistory("tab-d");
  });
});

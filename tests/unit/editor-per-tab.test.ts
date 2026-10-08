import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression guard for #129: in Split, switching tabs updated the preview but
 * the editor kept the previous tab's text, and typing wrote it into the new tab.
 *
 * The Editor keeps a local copy of the text and won't take a new `value` while
 * its textarea has focus, so a parent update can't move the caret. A tab switch
 * doesn't blur it: the tab's mousedown calls preventDefault (drag to reorder),
 * and Ctrl+Tab / Ctrl+T come from the keyboard. So a single Editor instance
 * shared by two editing tabs never picked up the new tab's text. Each tab must
 * get its own Editor.
 */
const page = readFileSync(resolve(process.cwd(), "src/routes/+page.svelte"), "utf8");

describe("#129 — one Editor per tab", () => {
  it("keys every Editor on the active tab id", () => {
    const editors = [...page.matchAll(/<Editor\b/g)].map((m) => m.index!);
    // Split and Edit each render one; a regex that finds none must not pass.
    expect(editors.length).toBeGreaterThanOrEqual(2);
    for (const at of editors) {
      const before = page.slice(0, at);
      const open = before.lastIndexOf("{#key activeTab.id}");
      const close = before.lastIndexOf("{/key}");
      expect(open, "an <Editor> is not inside {#key activeTab.id}").toBeGreaterThan(close);
    }
  });

  it("re-attaches split scroll sync when the tab (and so the textarea) changes", () => {
    const start = page.indexOf("let splitSync");
    const end = page.indexOf("attachSplitSync(ta", start);
    expect(start, "split scroll sync effect not found").toBeGreaterThan(-1);
    expect(page.slice(start, end)).toContain("$activeTabId");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The dialog plugin is imported dynamically inside the helper, so the mock has
// to be in place before the module under test is loaded.
const dialog = vi.fn();
vi.mock("@tauri-apps/plugin-dialog", () => ({ message: dialog }));

import {
  CANCEL_LABEL,
  DISCARD_LABEL,
  OVERWRITE_LABEL,
  SAVE_LABEL,
  promptOverwrite,
  promptUnsaved,
} from "../../src/lib/utils/unsaved-prompt";
import { setLocale } from "../../src/lib/i18n";

beforeEach(() => {
  dialog.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  // The labels follow the interface language, which would otherwise come from
  // the OS language of the machine running the tests.
  setLocale("en");
});

/**
 * #160: the old prompts used `ask()`, which resolves to "was OK clicked". The
 * safe answer sat on OK so Return could not destroy work, which left Escape
 * (and the close box, and a dialog that threw) pointing at Discard. Cmd+Q threw
 * away every dirty tab, unrecoverably — a `new://` document is not part of the
 * session that gets restored.
 */
describe("promptUnsaved", () => {
  it("offers three buttons, with the cancel one titled exactly Cancel", async () => {
    dialog.mockResolvedValue(CANCEL_LABEL);
    await promptUnsaved("unsaved");
    const [, opts] = dialog.mock.calls[0];
    // Custom buttons resolve to the label string, so these are compared, not
    // "Yes"/"No". "Cancel" in particular is what gives the button the Escape
    // key equivalent on macOS.
    expect(opts.buttons).toEqual({ yes: SAVE_LABEL, no: DISCARD_LABEL, cancel: CANCEL_LABEL });
    expect(opts.buttons.cancel).toBe("Cancel");
  });

  it("maps each button to its answer", async () => {
    for (const [label, expected] of [
      [SAVE_LABEL, "save"],
      [DISCARD_LABEL, "discard"],
      [CANCEL_LABEL, "cancel"],
    ] as const) {
      dialog.mockResolvedValue(label);
      expect(await promptUnsaved("unsaved")).toBe(expected);
    }
  });

  // The regression itself: everything that is not an explicit Save or Discard
  // has to come back as "cancel". Under the old code each of these fell through
  // to the destructive branch.
  it.each([
    ["Escape / close box, which resolve to the cancel label", CANCEL_LABEL],
    ["the two-button results the API can also return", "Yes"],
    ["an unrecognised label", "Maybe"],
    ["an empty result", ""],
    ["null", null],
    ["undefined", undefined],
  ])("treats %s as cancel", async (_why, value) => {
    dialog.mockResolvedValue(value);
    expect(await promptUnsaved("unsaved")).toBe("cancel");
  });

  it("cancels when the dialog fails to open instead of discarding", async () => {
    dialog.mockRejectedValue(new Error("no dialog"));
    expect(await promptUnsaved("unsaved")).toBe("cancel");
  });
});

describe("promptOverwrite", () => {
  it("is two buttons, cancel titled exactly Cancel", async () => {
    dialog.mockResolvedValue(CANCEL_LABEL);
    await promptOverwrite("changed on disk");
    expect(dialog.mock.calls[0][1].buttons).toEqual({ ok: OVERWRITE_LABEL, cancel: CANCEL_LABEL });
  });

  it("overwrites only when Overwrite is clicked", async () => {
    dialog.mockResolvedValue(OVERWRITE_LABEL);
    expect(await promptOverwrite("changed on disk")).toBe(true);
  });

  it.each([CANCEL_LABEL, "Ok", "", null, undefined])("keeps the on-disk version for %s", async (value) => {
    dialog.mockResolvedValue(value);
    expect(await promptOverwrite("changed on disk")).toBe(false);
  });

  it("keeps the on-disk version when the dialog fails", async () => {
    dialog.mockRejectedValue(new Error("no dialog"));
    expect(await promptOverwrite("changed on disk")).toBe(false);
  });
});

describe("in another interface language", () => {
  it("shows translated buttons and reads the answer from those labels", async () => {
    setLocale("fr");
    dialog.mockResolvedValue("Abandonner");
    expect(await promptUnsaved("unsaved")).toBe("discard");
    // The English label is no longer a button, so it is not a Discard.
    dialog.mockResolvedValue(DISCARD_LABEL);
    expect(await promptUnsaved("unsaved")).toBe("cancel");
    dialog.mockResolvedValue("Écraser");
    expect(await promptOverwrite("changed on disk")).toBe(true);
  });

  it("keeps Cancel in English, where Escape depends on that title", async () => {
    setLocale("fr");
    dialog.mockResolvedValue(CANCEL_LABEL);
    expect(await promptUnsaved("unsaved")).toBe("cancel");
    expect(await promptOverwrite("changed on disk")).toBe(false);
    expect(dialog.mock.calls[0][1].buttons).toEqual({ yes: "Enregistrer", no: "Abandonner", cancel: "Cancel" });
    expect(dialog.mock.calls[1][1].buttons).toEqual({ ok: "Écraser", cancel: "Cancel" });
  });
});

/**
 * The helper is only half the fix — the call sites have to route through it and
 * must not reintroduce a two-button `ask()`. Source assertions, in the style of
 * the other tests here, because the unit environment is `node` and cannot mount
 * the page component.
 */
describe("the unsaved-changes call sites", () => {
  const page = readFileSync(resolve(process.cwd(), "src/routes/+page.svelte"), "utf8").replace(
    /\r\n/g,
    "\n"
  );

  it("has no two-button ask() left", () => {
    expect(page).not.toMatch(/\bask\(/);
    expect(page).not.toMatch(/okLabel|cancelLabel/);
  });

  it("prompts on all three paths", () => {
    // Close a dirty tab, quit with dirty tabs, and save over a file that
    // changed on disk. All three inverted Escape before #160.
    expect(page.match(/promptUnsaved\(/g)).toHaveLength(2);
    expect(page.match(/promptOverwrite\(/g)).toHaveLength(1);
  });

  it("acts on the destructive answer explicitly, never on the absence of a safe one", () => {
    // `if (choice === "cancel") return` rather than `if (safe) return` — so an
    // unexpected result stops instead of continuing into the destructive path.
    expect(page.match(/choice === "cancel"/g)).toHaveLength(2);
    expect(page).toContain('if (!overwrite) return false;');
  });

  it("aborts the quit when a save is cancelled, instead of quitting anyway", () => {
    const start = page.indexOf("__mdhero_quit");
    const body = page.slice(start, page.indexOf("__mdhero_check_updates", start));
    expect(body).toContain("if (!(await handleSave(t))) return;");
    // The old code had a `catch {}` around the dialog that fell through to
    // quit_app, so a dialog failure lost the same work.
    expect(body).not.toMatch(/catch\s*\{\s*\n?\s*\/\/[^\n]*\n\s*\}/);
  });
});

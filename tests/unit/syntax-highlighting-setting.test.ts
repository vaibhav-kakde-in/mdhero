import { afterEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";

async function loadSettingsWith(stored: string | null) {
  vi.stubGlobal("localStorage", {
    getItem: () => stored,
    setItem: () => {},
  });
  vi.resetModules();
  const { settings } = await import("../../src/lib/stores/settings");
  return get(settings);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("syntaxHighlighting setting", () => {
  it("highlights by default", async () => {
    expect((await loadSettingsWith(null)).syntaxHighlighting).toBe(true);
  });

  it("stays on for settings saved before the option existed", async () => {
    const stored = JSON.stringify({ fontSize: 18, closeOnEscape: false });
    expect((await loadSettingsWith(stored)).syntaxHighlighting).toBe(true);
  });

  it("restores a saved choice to turn it off", async () => {
    const stored = JSON.stringify({ syntaxHighlighting: false });
    expect((await loadSettingsWith(stored)).syntaxHighlighting).toBe(false);
  });

  it("falls back to on for anything that is not a boolean", async () => {
    // A hand-edited "false" is truthy, and null is falsy: read as-is, either
    // one flips the setting the wrong way.
    for (const junk of ["false", "true", null, 0, 1, "", {}]) {
      const stored = JSON.stringify({ syntaxHighlighting: junk });
      expect((await loadSettingsWith(stored)).syntaxHighlighting).toBe(true);
    }
  });
});

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

// Every on/off setting, with its default.
const BOOLEANS = [
  ["closeOnEscape", true],
  ["showLineNumbers", true],
  ["autoPresentMarp", true],
  ["restoreTabsOnLaunch", true],
  ["wrapCodeBlocks", false],
] as const;

describe.each(BOOLEANS)("the stored %s setting", (key, fallback) => {
  it("defaults when nothing is stored", async () => {
    expect((await loadSettingsWith(null))[key]).toBe(fallback);
  });

  it("restores a saved choice either way", async () => {
    for (const value of [true, false]) {
      const stored = JSON.stringify({ [key]: value });
      expect((await loadSettingsWith(stored))[key]).toBe(value);
    }
  });

  it("falls back to the default for anything that is not a boolean", async () => {
    // A hand-edited "false" is truthy, and null is falsy: read as-is, either
    // one flips the setting the wrong way.
    for (const junk of ["false", "true", null, 0, 1, "", {}]) {
      const stored = JSON.stringify({ [key]: junk });
      expect((await loadSettingsWith(stored))[key]).toBe(fallback);
    }
  });
});

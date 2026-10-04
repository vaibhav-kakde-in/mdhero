import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "../../src/lib/i18n/en";
import { zh } from "../../src/lib/i18n/zh";
import {
  normalizeLanguage,
  resolveLocale,
  translate,
  type MessageKey,
} from "../../src/lib/i18n/core";

const SETTINGS_KEY = "mdhero-settings";

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

/** Fresh store + i18n modules against a fake localStorage, so each test starts
 *  from its own persisted state (same pattern as tabs-session.test.ts). */
async function freshModules(initial: Record<string, string> = {}) {
  vi.resetModules();
  (globalThis as any).localStorage = fakeStorage(initial);
  const settingsMod = await import("../../src/lib/stores/settings");
  const i18n = await import("../../src/lib/i18n");
  const { get } = await import("svelte/store");
  return { settings: settingsMod.settings, t: i18n.t, locale: i18n.locale, get };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveLocale", () => {
  it("maps zh-* system languages to Chinese", () => {
    expect(resolveLocale("system", "zh")).toBe("zh");
    expect(resolveLocale("system", "zh-CN")).toBe("zh");
    expect(resolveLocale("system", "zh-Hans")).toBe("zh");
  });

  it("falls back to English for other system languages", () => {
    expect(resolveLocale("system", "en")).toBe("en");
    expect(resolveLocale("system", "en-US")).toBe("en");
    expect(resolveLocale("system", "ja")).toBe("en");
  });

  it("lets an explicit setting win over the system language", () => {
    expect(resolveLocale("en", "zh-CN")).toBe("en");
    expect(resolveLocale("zh", "en-US")).toBe("zh");
  });
});

describe("normalizeLanguage", () => {
  it("keeps valid settings", () => {
    expect(normalizeLanguage("system")).toBe("system");
    expect(normalizeLanguage("en")).toBe("en");
    expect(normalizeLanguage("zh")).toBe("zh");
  });

  it("falls back to system for junk stored values", () => {
    expect(normalizeLanguage("fr")).toBe("system");
    expect(normalizeLanguage(undefined)).toBe("system");
    expect(normalizeLanguage(null)).toBe("system");
    expect(normalizeLanguage(42)).toBe("system");
  });
});

describe("translate", () => {
  it("interpolates {placeholders}", () => {
    expect(translate("en", "toolbar.openTitle", { mod: "Ctrl" })).toBe("Open file (Ctrl+O)");
    expect(translate("zh", "toolbar.openTitle", { mod: "Ctrl" })).toBe("打开文件（Ctrl+O）");
  });

  it("keeps unmatched placeholders literal", () => {
    // No params at all, and a token no caller ever supplies ({prompt} is part
    // of the message, not a variable).
    expect(translate("en", "toolbar.openTitle")).toBe("Open file ({mod}+O)");
    expect(translate("en", "ai.error.urlTokenMissing")).toBe(
      "URL must contain {prompt} where the query goes"
    );
  });

  it("falls back to the key when the lookup misses", () => {
    expect(translate("en", "todo.missing" as MessageKey)).toBe("todo.missing");
  });
});

describe("dictionaries", () => {
  it("zh mirrors every key defined in en", () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });
});

describe("language setting", () => {
  it("persists a language switch and translates through the store", async () => {
    const { settings, t, get } = await freshModules();
    settings.update((s) => ({ ...s, language: "zh" }));
    expect(JSON.parse((globalThis as any).localStorage.getItem(SETTINGS_KEY)).language).toBe("zh");
    expect(get(t)("common.cancel")).toBe("取消");

    settings.update((s) => ({ ...s, language: "en" }));
    expect(get(t)("common.cancel")).toBe("Cancel");
  });

  it("follows navigator.language while the setting is system", async () => {
    vi.stubGlobal("navigator", { language: "zh-CN" });
    const { settings, locale, get } = await freshModules();
    expect(get(locale)).toBe("zh");

    settings.update((s) => ({ ...s, language: "en" }));
    expect(get(locale)).toBe("en");
  });

  it("falls back to system when the stored value is invalid", async () => {
    const { settings, get } = await freshModules({
      [SETTINGS_KEY]: JSON.stringify({ language: "fr" }),
    });
    expect(get(settings).language).toBe("system");
  });
});
import { beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import en from "../../src/lib/i18n/locales/en.json";
import de from "../../src/lib/i18n/locales/de.json";
import es from "../../src/lib/i18n/locales/es.json";
import fr from "../../src/lib/i18n/locales/fr.json";
import zhCN from "../../src/lib/i18n/locales/zh-CN.json";

const LOCALE_KEY = "mdhero_locale";

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

/** Fresh i18n module against a fake localStorage and OS language. */
async function load(stored: Record<string, string> = {}, osLanguage = "en-US") {
  vi.resetModules();
  vi.stubGlobal("localStorage", fakeStorage(stored));
  vi.stubGlobal("navigator", { language: osLanguage });
  return import("../../src/lib/i18n");
}

type Dict = { [key: string]: string | Dict };

/** key → its strings: one for a plain message, one per form for plurals. */
function messages(dict: Dict, prefix = ""): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const [k, v] of Object.entries(dict)) {
    const key = prefix + k;
    if (typeof v === "string") out[key] = { other: v };
    else if ("other" in v) out[key] = v as Record<string, string>;
    else Object.assign(out, messages(v, key + "."));
  }
  return out;
}

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

describe("locale dictionaries", () => {
  const base = messages(en);
  const dictionaries: Record<string, Dict> = { de, es, fr, "zh-CN": zhCN };

  for (const [code, dict] of Object.entries(dictionaries)) {
    const own = messages(dict);

    it(`${code} has exactly the keys of en.json`, () => {
      expect(Object.keys(own).sort()).toEqual(Object.keys(base).sort());
    });

    it(`${code} keeps the {placeholders} of en.json`, () => {
      for (const [key, forms] of Object.entries(own)) {
        const allowed = new Set(Object.values(base[key]).flatMap(placeholders));
        expect(placeholders(forms.other), key).toEqual(placeholders(base[key].other));
        for (const form of Object.values(forms)) {
          for (const p of placeholders(form)) expect(allowed.has(p), `${key}: ${p}`).toBe(true);
        }
      }
    });
  }
});

describe("translate", () => {
  let i18n: Awaited<ReturnType<typeof load>>;
  beforeEach(async () => {
    i18n = await load({ [LOCALE_KEY]: "en" });
  });

  it("resolves the active locale and follows setLocale", () => {
    expect(i18n.translate("toolbar.open")).toBe("Open");
    i18n.setLocale("fr");
    expect(i18n.translate("toolbar.open")).toBe("Ouvrir");
    i18n.setLocale("zh-CN");
    expect(i18n.translate("menu.file")).toBe("文件");
  });

  it("fills placeholders and formats numbers for the locale", () => {
    expect(i18n.translate("toolbar.openTitle", { mod: "Ctrl" })).toBe("Open file (Ctrl+O)");
    expect(i18n.translate("statusbar.words", { count: 1234 })).toBe("1,234 words");
    i18n.setLocale("fr");
    const n = new Intl.NumberFormat("fr").format(1234);
    expect(i18n.translate("statusbar.words", { count: 1234 })).toBe(`${n} mots`);
  });

  it("picks plural forms with the locale's rules", () => {
    expect(i18n.translate("statusbar.words", { count: 1 })).toBe("1 word");
    expect(i18n.translate("statusbar.words", { count: 0 })).toBe("0 words");
    i18n.setLocale("fr");
    expect(i18n.translate("statusbar.words", { count: 0 })).toBe("0 mot");
    expect(i18n.translate("statusbar.words", { count: 2 })).toBe("2 mots");
    i18n.setLocale("zh-CN");
    expect(i18n.translate("statusbar.words", { count: 1 })).toBe("1 字");
  });

  it("leaves unknown placeholders and unknown keys as they are", () => {
    expect(i18n.translate("settings.autoPresentMarpHint")).toContain("{code}");
    expect(i18n.translate("no.such.key" as any)).toBe("no.such.key");
  });

  it("gives a $t store that updates with the locale", () => {
    expect(get(i18n.t)("common.cancel")).toBe("Cancel");
    i18n.setLocale("de");
    expect(get(i18n.t)("common.cancel")).toBe("Abbrechen");
  });

  it("formats relative times", () => {
    const tr = i18n.translate;
    expect(i18n.formatRelativeTime(Date.now() - 10_000, tr)).toBe("Just now");
    expect(i18n.formatRelativeTime(Date.now() - 2 * 60_000, tr)).toBe("2m ago");
    expect(i18n.formatRelativeTime(Date.now() - 5 * 3_600_000, tr)).toBe("5h ago");
    expect(i18n.formatRelativeTime(Date.now() - 3 * 86_400_000, tr)).toBe("3d ago");
  });
});

describe("locale choice", () => {
  it("uses the stored choice first", async () => {
    const i18n = await load({ [LOCALE_KEY]: "de" }, "fr-FR");
    expect(get(i18n.locale)).toBe("de");
    expect(i18n.hasChosenLocale()).toBe(true);
  });

  it("falls back to the OS language without storing it", async () => {
    const i18n = await load({}, "es-MX");
    expect(get(i18n.locale)).toBe("es");
    expect(i18n.hasChosenLocale()).toBe(false);
    expect((globalThis as any).localStorage.getItem(LOCALE_KEY)).toBeNull();
  });

  it("maps any Chinese OS language to zh-CN and unsupported ones to English", async () => {
    expect(get((await load({}, "zh-TW")).locale)).toBe("zh-CN");
    expect(get((await load({}, "ja-JP")).locale)).toBe("en");
  });

  it("persists an explicit choice", async () => {
    const i18n = await load({}, "en-US");
    i18n.setLocale("fr");
    expect((globalThis as any).localStorage.getItem(LOCALE_KEY)).toBe("fr");
    expect(i18n.hasChosenLocale()).toBe(true);
  });
});

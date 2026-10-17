/**
 * MDHero i18n: a small, dependency-free translation layer.
 *
 * - One JSON dictionary per locale in `./locales/`. `en.json` is the source of
 *   truth: its keys type every lookup, and it is the fallback for any key a
 *   locale is missing.
 * - Templates use `{$t("section.key")}`, which re-renders when the locale
 *   changes. Imperative code (event handlers, dialogs, toasts) uses
 *   `translate()`, which reads the current locale once — so never call
 *   `translate()` from a template or a `$derived`.
 * - `{placeholder}`s are filled from params; numbers are formatted for the
 *   active locale. A message can instead be an object of plural forms
 *   (`{ "one": "…", "other": "…" }`), picked with `Intl.PluralRules` on
 *   `params.count`.
 * - Locale: stored choice → OS language → English. It is only persisted (under
 *   `mdhero_locale`) once the user picks one, so the first-run language picker
 *   can tell "chosen" from "detected". The locale is mirrored to `<html lang>`
 *   and to the native menu bar (`set_menu_language`).
 */
import { derived, get, writable } from "svelte/store";
import en from "./locales/en.json";
import de from "./locales/de.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import zhCN from "./locales/zh-CN.json";
import type { MessageKey, MessageParams } from "./types";

export type { MessageKey, MessageParams } from "./types";

export const STORAGE_KEY = "mdhero_locale";

export const SUPPORTED_LOCALES = [
  { code: "en", label: "English", nativeName: "English" },
  { code: "de", label: "German", nativeName: "Deutsch" },
  { code: "es", label: "Spanish", nativeName: "Español" },
  { code: "fr", label: "French", nativeName: "Français" },
  { code: "zh-CN", label: "Chinese (Simplified)", nativeName: "简体中文" },
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number]["code"];

export type Translate = (key: MessageKey, params?: MessageParams) => string;

/** Flatten nested sections into dotted keys: {a:{b:"x"}} → {"a.b":"x"}. Plural
 *  forms flatten the same way, to "key.one", "key.other", … */
function flatten(dict: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(dict)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") Object.assign(out, flatten(v as Record<string, unknown>, key));
    else out[key] = String(v);
  }
  return out;
}

const messages: Record<Locale, Record<string, string>> = {
  en: flatten(en),
  de: flatten(de),
  es: flatten(es),
  fr: flatten(fr),
  "zh-CN": flatten(zhCN),
};

const pluralRules = new Map<Locale, Intl.PluralRules>();
const numberFormats = new Map<Locale, Intl.NumberFormat>();

function lookup(l: Locale, key: string, count: unknown): string | undefined {
  const table = messages[l];
  if (key in table) return table[key];
  if (typeof count === "number") {
    if (!pluralRules.has(l)) pluralRules.set(l, new Intl.PluralRules(l));
    const form = table[`${key}.${pluralRules.get(l)!.select(count)}`];
    if (form !== undefined) return form;
  }
  return table[`${key}.other`];
}

function format(l: Locale, key: MessageKey, params?: MessageParams): string {
  const str = lookup(l, key, params?.count) ?? lookup("en", key, params?.count) ?? key;
  if (!params) return str;
  if (!numberFormats.has(l)) numberFormats.set(l, new Intl.NumberFormat(l));
  const nf = numberFormats.get(l)!;
  return str.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) return match;
    return typeof value === "number" ? nf.format(value) : value;
  });
}

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const known = SUPPORTED_LOCALES.find((l) => l.code === stored);
    if (known) return known.code;
    const nav = (navigator.language || "").toLowerCase();
    for (const l of SUPPORTED_LOCALES) {
      const code = l.code.toLowerCase();
      if (nav === code || nav.startsWith(`${code.split("-")[0]}-`) || nav === code.split("-")[0]) {
        return l.code;
      }
    }
  } catch {
    // No localStorage / navigator (tests, restricted webview): use English.
  }
  return "en";
}

export const locale = writable<Locale>(detectLocale());

/** Reactive translator: `{$t("key", { name })}` in templates. */
export const t = derived(locale, (l): Translate => (key, params) => format(l, key, params));

/** Non-reactive translation for event handlers, dialogs and toasts. */
export function translate(key: MessageKey, params?: MessageParams): string {
  return format(get(locale), key, params);
}

/** Switch the UI language and remember the choice. */
export function setLocale(l: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    // Not persisted; the UI still switches for this session.
  }
  locale.set(l);
}

/** Whether the user has picked a language yet (drives the first-run picker).
 *  Without storage the picker could never be dismissed, so report true. */
export function hasChosenLocale(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

/** "Just now / 5m ago / 3h ago / 2d ago", then a date. Takes the translator so
 *  a template caller can pass `$t` and follow locale changes. */
export function formatRelativeTime(ts: number, tr: Translate): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return tr("common.justNow");
  if (mins < 60) return tr("common.minAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return tr("common.hourAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return tr("common.dayAgo", { count: days });
  return new Date(ts).toLocaleDateString(get(locale));
}

/**
 * Native menu labels. The menu bar is built in Rust (menu.rs), outside the
 * DOM, so the active locale's labels are pushed to it on every change.
 */
const MENU_KEYS = [
  "menu.about",
  "menu.checkUpdates",
  "menu.hide",
  "menu.hideOthers",
  "menu.showAll",
  "menu.quit",
  "menu.file",
  "menu.open",
  "menu.pasteMarkdown",
  "menu.print",
  "menu.closeTab",
  "menu.edit",
  "menu.cut",
  "menu.copy",
  "menu.paste",
  "menu.selectAll",
  "menu.find",
  "menu.view",
  "menu.toggleTheme",
  "menu.fullscreen",
  "menu.window",
  "menu.minimize",
  "menu.maximize",
] as const satisfies readonly MessageKey[];

/** The locale last sent to the native menu (null after a failed push, so the
 *  next change retries). Rust builds the menu in English. Set before awaiting,
 *  so a quick fr → en switch still sends "en" while "fr" is in flight. */
let menuLocale: Locale | null = "en";

async function syncNativeMenu(l: Locale): Promise<void> {
  if (l === menuLocale || typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
  menuLocale = l;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const labels = Object.fromEntries(MENU_KEYS.map((key) => [key, format(l, key)]));
    await invoke("set_menu_language", { labels });
  } catch (err) {
    menuLocale = null;
    console.error("set_menu_language failed:", err);
  }
}

locale.subscribe((l) => {
  try {
    document.documentElement.lang = l;
  } catch {
    // No document (tests).
  }
  void syncNativeMenu(l);
});

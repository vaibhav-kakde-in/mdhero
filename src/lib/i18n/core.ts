import { en, type MessageKey } from "./en";
import { zh } from "./zh";

export type { MessageKey } from "./en";

/** What the language setting stores. "system" follows the OS/browser language. */
export type LanguageSetting = "system" | "en" | "zh";

/** A concrete language the UI can render in. */
export type Locale = "en" | "zh";

export type Translator = (key: MessageKey, params?: Record<string, string | number>) => string;

const DICTIONARIES: Record<Locale, Record<string, string>> = { en, zh };

/** Resolve a stored setting to a concrete locale. */
export function resolveLocale(setting: LanguageSetting, navLang = "en"): Locale {
  if (setting !== "system") return setting;
  return navLang.toLowerCase().startsWith("zh") ? "zh" : "en";
}

/** Coerce an arbitrary stored value to a valid setting ("system" fallback). */
export function normalizeLanguage(value: unknown): LanguageSetting {
  return value === "en" || value === "zh" ? value : "system";
}

/** Translate a key, filling `{placeholders}` from `params`. A key missing at
 *  runtime falls back to English, then to the raw key, so nothing renders blank. */
export function translate(locale: Locale, key: MessageKey, params?: Record<string, string | number>): string {
  const raw = DICTIONARIES[locale][key] ?? en[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name])
  );
}
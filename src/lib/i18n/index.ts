import { derived } from "svelte/store";
import { settings } from "../stores/settings";
import { resolveLocale, translate, type Translator } from "./core";

export * from "./core";

function detectNavLang(): string {
  return typeof navigator !== "undefined" ? navigator.language : "en";
}

/** The locale the UI renders in right now (resolves "system"). */
export const locale = derived(settings, ($s) => resolveLocale($s.language, detectNavLang()));

/** Translation function as a store — `{$t("key")}` re-renders on a language switch. */
export const t = derived(locale, ($locale): Translator => (key, params) => translate($locale, key, params));

/** Keep `<html lang>` in sync (a11y, hyphenation, font fallback). */
export function initI18n(): void {
  locale.subscribe(($locale) => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = $locale === "zh" ? "zh-CN" : "en";
    }
  });
}
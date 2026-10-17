/** Build a Google Translate URL for the given text.
 *
 *  Google Translate requires no API key, so opening this URL in the system
 *  browser is the "free Google Translator" integration: the selected markdown
 *  text is handed off to translate.google.com. `sl=auto` lets Google detect
 *  the source language; the target defaults to Russian (the app's primary
 *  user-facing language) but callers can override it. */
export const DEFAULT_TRANSLATE_TARGET_LANG = "ru";

export function googleTranslateUrl(
  selection: string,
  targetLang: string = DEFAULT_TRANSLATE_TARGET_LANG,
  sourceLang: string = "auto",
): string {
  const params = new URLSearchParams();
  params.set("sl", sourceLang);
  params.set("tl", targetLang);
  params.set("text", selection);
  params.set("op", "translate");
  return `https://translate.google.com/?${params.toString()}`;
}

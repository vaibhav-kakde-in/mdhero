import type { Translator } from "../i18n/core";

/** Relative "Just now / 5m ago / …" label for recents and folder file lists.
 *  Falls back to a locale-formatted date once the entry is a week old. */
export function formatRelativeTime(ts: number, t: Translator, locale: string): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("time.justNow");
  if (mins < 60) return t("time.minutesAgo", { mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("time.hoursAgo", { hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("time.daysAgo", { days });
  return new Date(ts).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US");
}
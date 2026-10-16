import { writable, get } from "svelte/store";
import { settings, type ReaderSettings } from "./settings";

export type ThemeMode = "light" | "dark" | "system";
export type PageThemeMode = ReaderSettings["pageTheme"];

export const themeMode = writable<ThemeMode>("system");

/** Whether the rendered page is dark right now. The page has its own theme
 *  (`settings.pageTheme`) so it can stay light in a dark window, or the
 *  reverse; this is its resolved value, for code that draws in the page's
 *  colours (Mermaid). The same value is on <html> as the `page-dark` class. */
export const pageDark = writable(false);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function getEffectiveTheme(): "light" | "dark" {
  const mode = get(themeMode);
  if (mode === "system") return getSystemTheme();
  return mode;
}

/** The page's theme given its setting and the interface's resolved theme. */
export function resolvePageTheme(
  mode: PageThemeMode,
  interfaceTheme: "light" | "dark",
): "light" | "dark" {
  return mode === "auto" ? interfaceTheme : mode;
}

export function applyCurrentTheme(): void {
  const theme = getEffectiveTheme();
  const page = resolvePageTheme(get(settings).pageTheme, theme);
  const html = globalThis.document?.documentElement;
  if (!html) return;

  html.classList.toggle("dark", theme === "dark");
  html.classList.toggle("page-dark", page === "dark");
  pageDark.set(page === "dark");
}

export function initThemeListener(): void {
  // Apply on init
  applyCurrentTheme();

  // Listen for OS theme changes
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", () => {
    applyCurrentTheme();
  });

  // Listen for store changes: the interface's mode, and the page's, which
  // lives in the settings store.
  themeMode.subscribe(() => {
    applyCurrentTheme();
  });
  settings.subscribe(() => {
    applyCurrentTheme();
  });
}

export function cycleTheme(current: ThemeMode): ThemeMode {
  const order: ThemeMode[] = ["system", "light", "dark"];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}

export function cyclePageTheme(current: PageThemeMode): PageThemeMode {
  const order: PageThemeMode[] = ["auto", "light", "dark"];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}

import { writable } from "svelte/store";

export interface ReaderSettings {
  fontSize: number;
  lineHeight: number;
  fontFamily: "sans" | "serif" | "mono";
  maxWidth: number;
  widthMode: "comfortable" | "wide";
  closeOnEscape: boolean;
  showLineNumbers: boolean;
  /** Auto-open `marp: true` documents as a slideshow (#44). */
  autoPresentMarp: boolean;
  /** Reopen the files that were open when the app last ran (#72). */
  restoreTabsOnLaunch: boolean;
  /** Width of the table-of-contents sidebar in px (#108). */
  tocWidth: number;
  /** Tabs in a row across the top, or in a resizable panel on the left. */
  tabsPosition: "top" | "side";
  /** Width of the side tabs panel in px. */
  tabsWidth: number;
}

const STORAGE_KEY = "mdhero-settings";
const DEFAULT_MAX_WIDTH = 720;
const MIN_MAX_WIDTH = 560;
const MAX_MAX_WIDTH = 3840;
const WIDE_MAX_WIDTH = "min(3840px, calc(100vw - clamp(48px, 8vw, 128px)))";

/** Table-of-contents sidebar width bounds (#108). The minimum keeps a heading
 *  readable rather than a column of ellipses; the maximum stops the sidebar
 *  from being dragged over the whole document on a small window. */
export const DEFAULT_TOC_WIDTH = 240;
export const MIN_TOC_WIDTH = 180;
export const MAX_TOC_WIDTH = 520;
/** Document width the sidebar must always leave behind. Without this the
 *  sidebar can be dragged wider than the window (which `tauri.conf.json` lets
 *  shrink to 400px), covering the document and putting the drag handle
 *  off-screen — the exact complaint #108 was filed about, reintroduced by its
 *  own fix. */
export const MIN_DOCUMENT_WIDTH = 240;

/** Side tabs panel width bounds. The minimum still fits a typical file name;
 *  past the maximum the room is better left to the document. */
export const DEFAULT_TABS_WIDTH = 220;
export const MIN_TABS_WIDTH = 160;
export const MAX_TABS_WIDTH = 400;

interface PanelBounds {
  min: number;
  max: number;
  fallback: number;
}

const TOC_BOUNDS: PanelBounds = { min: MIN_TOC_WIDTH, max: MAX_TOC_WIDTH, fallback: DEFAULT_TOC_WIDTH };
const TABS_BOUNDS: PanelBounds = { min: MIN_TABS_WIDTH, max: MAX_TABS_WIDTH, fallback: DEFAULT_TABS_WIDTH };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function loadSettings(): ReaderSettings {
  const defaults: ReaderSettings = {
    fontSize: 17,
    lineHeight: 1.7,
    fontFamily: "sans",
    maxWidth: DEFAULT_MAX_WIDTH,
    widthMode: "comfortable",
    closeOnEscape: true,
    showLineNumbers: true,
    autoPresentMarp: true,
    restoreTabsOnLaunch: true,
    tocWidth: DEFAULT_TOC_WIDTH,
    tabsPosition: "top",
    tabsWidth: DEFAULT_TABS_WIDTH,
  };

  if (typeof localStorage === "undefined") return defaults;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = { ...defaults, ...JSON.parse(stored) };
      const storedMaxWidth = Number(parsed.maxWidth) || defaults.maxWidth;
      return {
        ...parsed,
        maxWidth: clamp(storedMaxWidth, MIN_MAX_WIDTH, MAX_MAX_WIDTH),
        widthMode: parsed.widthMode === "wide" ? "wide" : "comfortable",
        tocWidth: clampTocWidth(parsed.tocWidth),
        tabsPosition: parsed.tabsPosition === "side" ? "side" : "top",
        tabsWidth: clampTabsWidth(parsed.tabsWidth),
      };
    }
  } catch {}

  return defaults;
}

function createSettingsStore() {
  const { subscribe, set, update } = writable<ReaderSettings>(loadSettings());

  return {
    subscribe,
    set(value: ReaderSettings) {
      set(value);
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      }
    },
    update(fn: (s: ReaderSettings) => ReaderSettings) {
      update((current) => {
        const next = fn(current);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
        return next;
      });
    },
  };
}

export const settings = createSettingsStore();

/** Clamp an arbitrary stored or dragged value to a usable sidebar width (#108).
 *  Non-numeric input (a hand-edited localStorage entry, a NaN from a pointer
 *  event) falls back to the default rather than collapsing the sidebar to 0. */
/** The widest the sidebar may be in a window of `viewportWidth`. Never returns
 *  less than MIN_TOC_WIDTH: on a very narrow window a cramped sidebar still
 *  beats one that cannot be grabbed. */
export function maxTocWidthFor(viewportWidth: number): number {
  return maxPanelWidthFor(TOC_BOUNDS, viewportWidth);
}

/** Pass `viewportWidth` to bound the result by the window as well as by
 *  MAX_TOC_WIDTH. Omitted, only the static bounds apply. With side tabs open,
 *  callers pass the window width minus the tabs panel: the room the ToC and
 *  the document share. */
export function clampTocWidth(value: unknown, viewportWidth?: number): number {
  return clampPanelWidth(TOC_BOUNDS, value, viewportWidth);
}

/** The widest the side tabs panel may be, given the width it shares with the
 *  document (the window minus the ToC, when that is showing). */
export function maxTabsWidthFor(availableWidth: number): number {
  return maxPanelWidthFor(TABS_BOUNDS, availableWidth);
}

/** Same rules as clampTocWidth, for the side tabs panel. */
export function clampTabsWidth(value: unknown, availableWidth?: number): number {
  return clampPanelWidth(TABS_BOUNDS, value, availableWidth);
}

function maxPanelWidthFor(bounds: PanelBounds, availableWidth: number): number {
  return Math.max(
    bounds.min,
    Math.min(bounds.max, Math.round(availableWidth) - MIN_DOCUMENT_WIDTH),
  );
}

function clampPanelWidth(bounds: PanelBounds, value: unknown, availableWidth?: number): number {
  // Deliberately not a bare Number(): Number(null), Number("") and Number([])
  // are all 0, which is finite, so junk would clamp to the minimum width and
  // look like a deliberate setting instead of falling back to the default.
  const width =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  if (!Number.isFinite(width)) return bounds.fallback;
  const ceiling =
    availableWidth === undefined || !Number.isFinite(availableWidth)
      ? bounds.max
      : maxPanelWidthFor(bounds, availableWidth);
  return clamp(Math.round(width), bounds.min, ceiling);
}

export function getContentMaxWidth(value: ReaderSettings): string {
  return value.widthMode === "wide" ? WIDE_MAX_WIDTH : `${value.maxWidth}px`;
}

export const fontFamilyMap: Record<string, string> = {
  sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
};

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
export function clampTocWidth(value: unknown): number {
  // Deliberately not a bare Number(): Number(null), Number("") and Number([])
  // are all 0, which is finite, so junk would clamp to the minimum width and
  // look like a deliberate setting instead of falling back to the default.
  const width =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  if (!Number.isFinite(width)) return DEFAULT_TOC_WIDTH;
  return clamp(Math.round(width), MIN_TOC_WIDTH, MAX_TOC_WIDTH);
}

export function getContentMaxWidth(value: ReaderSettings): string {
  return value.widthMode === "wide" ? WIDE_MAX_WIDTH : `${value.maxWidth}px`;
}

export const fontFamilyMap: Record<string, string> = {
  sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
};

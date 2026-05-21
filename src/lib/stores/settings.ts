import { writable } from "svelte/store";

export interface ReaderSettings {
  fontSize: number;
  lineHeight: number;
  fontFamily: "sans" | "serif" | "mono";
  maxWidth: number;
  closeOnEscape: boolean;
}

const STORAGE_KEY = "mdhero-settings";

function loadSettings(): ReaderSettings {
  const defaults: ReaderSettings = {
    fontSize: 17,
    lineHeight: 1.7,
    fontFamily: "sans",
    maxWidth: 720,
    closeOnEscape: true,
  };

  if (typeof localStorage === "undefined") return defaults;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaults, ...JSON.parse(stored) };
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

export const fontFamilyMap: Record<string, string> = {
  sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
};

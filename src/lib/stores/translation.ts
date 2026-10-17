import { writable } from "svelte/store";

export interface TranslationSettings {
  targetLang: string;
  autoTranslate: boolean;
}

const STORAGE_KEY = "mdhero:translation";

function defaultSettings(): TranslationSettings {
  return { targetLang: "ru", autoTranslate: false };
}

function load(): TranslationSettings {
  const defaults = defaultSettings();
  if (typeof localStorage === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<TranslationSettings>;
    return {
      targetLang:
        typeof parsed.targetLang === "string" && parsed.targetLang.trim()
          ? parsed.targetLang
          : defaults.targetLang,
      autoTranslate: typeof parsed.autoTranslate === "boolean" ? parsed.autoTranslate : defaults.autoTranslate,
    };
  } catch {
    return defaults;
  }
}

function persist(s: TranslationSettings) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

const store = writable<TranslationSettings>(load());

function updateStore(fn: (s: TranslationSettings) => TranslationSettings) {
  store.update((s) => {
    const next = fn(s);
    persist(next);
    return next;
  });
}

export const translationSettings = {
  subscribe: store.subscribe,
  set(value: TranslationSettings) {
    store.set(value);
    persist(value);
  },
  update: updateStore,
  reset() {
    const fresh = defaultSettings();
    store.set(fresh);
    persist(fresh);
  },
};

export const TRANSLATION_TARGET_LANGUAGES = [
  { code: "ru", label: "Русский" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "zh-CN", label: "中文 (简体)" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
];

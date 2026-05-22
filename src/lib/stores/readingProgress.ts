import { writable, get } from "svelte/store";

const STORAGE_KEY = "mdhero:readingProgress";
const MAX_ENTRIES = 500;

interface ProgressEntry {
  line: number;
  lastAccessed: number;
}

interface ReadingProgressStore {
  schemaVersion: 1;
  entries: Record<string, ProgressEntry>;
}

function load(): ReadingProgressStore {
  if (typeof localStorage === "undefined") return { schemaVersion: 1, entries: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { schemaVersion: 1, entries: {} };
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion !== 1 || typeof parsed.entries !== "object") {
      return { schemaVersion: 1, entries: {} };
    }
    return parsed as ReadingProgressStore;
  } catch {
    return { schemaVersion: 1, entries: {} };
  }
}

function persist(store: ReadingProgressStore) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/**
 * Normalize a tab's filePath into a storage key.
 * - `paste://` tabs → null (skip entirely)
 * - `url://` tabs → strip prefix, use the actual URL
 * - Everything else → use as-is (absolute path from Tauri)
 */
function storageKey(filePath: string): string | null {
  if (filePath.startsWith("paste://")) return null;
  if (filePath.startsWith("url://")) return filePath.slice(6);
  return filePath;
}

function evictIfNeeded(store: ReadingProgressStore) {
  const keys = Object.keys(store.entries);
  if (keys.length <= MAX_ENTRIES) return;

  // Sort by lastAccessed ascending, remove oldest
  const sorted = keys.sort(
    (a, b) => store.entries[a].lastAccessed - store.entries[b].lastAccessed
  );
  const toRemove = sorted.slice(0, keys.length - MAX_ENTRIES);
  for (const key of toRemove) {
    delete store.entries[key];
  }
}

const store = writable<ReadingProgressStore>(load());

export function saveProgress(filePath: string, line: number) {
  const key = storageKey(filePath);
  if (!key) return;

  store.update((s) => {
    // Top-of-file rule: don't save line <= 1, delete stale entry instead
    if (line <= 1) {
      if (s.entries[key]) {
        delete s.entries[key];
        persist(s);
      }
      return s;
    }

    s.entries[key] = { line, lastAccessed: Date.now() };
    evictIfNeeded(s);
    persist(s);
    return s;
  });
}

export function getProgress(filePath: string): number | undefined {
  const key = storageKey(filePath);
  if (!key) return undefined;
  const entry = get(store).entries[key];
  return entry?.line;
}

export function clearProgress(filePath: string) {
  const key = storageKey(filePath);
  if (!key) return;
  store.update((s) => {
    delete s.entries[key];
    persist(s);
    return s;
  });
}

export function clearAllProgress() {
  const empty: ReadingProgressStore = { schemaVersion: 1, entries: {} };
  store.set(empty);
  persist(empty);
}

import { writable } from "svelte/store";

/**
 * Templates picked in the toolbar, by file path. Kept per file rather than per
 * tab so the choice survives closing the tab and restarting; a file with no
 * entry follows its frontmatter and then the default in Settings.
 */
const STORAGE_KEY = "mdhero-template-overrides";

function load(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
}

export const templateOverrides = writable<Record<string, string>>(load());

templateOverrides.subscribe((value) => {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {}
});

/** `null` drops the override, so the file follows its document again. */
export function setTemplateOverride(filePath: string, id: string | null) {
  templateOverrides.update((all) => {
    const next = { ...all };
    if (id === null) delete next[filePath];
    else next[filePath] = id;
    return next;
  });
}

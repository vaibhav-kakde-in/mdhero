import { derived, writable } from "svelte/store";
import { listen } from "@tauri-apps/api/event";
import { mergeTemplates, type DocTemplate } from "$lib/templates";
import { parseUserTemplate } from "$lib/templates/user";
import { listUserTemplates, watchTemplates } from "$lib/tauri/templates";

export const userTemplates = writable<DocTemplate[]>([]);

/** Every template the app can show: built-ins, replaced or joined by the user's. */
export const allTemplates = derived(userTemplates, (user) => mergeTemplates(user));

export async function refreshUserTemplates(): Promise<void> {
  try {
    const files = await listUserTemplates();
    userTemplates.set(files.map(parseUserTemplate));
  } catch {
    // No config dir, or not running under Tauri: the built-ins still work.
  }
}

let started = false;

/** Load the templates folder and keep following it, so a CSS file saved in
 *  another editor restyles the open document straight away. */
export async function initUserTemplates(): Promise<void> {
  if (started) return;
  started = true;
  await refreshUserTemplates();
  await listen("templates-changed", () => void refreshUserTemplates()).catch(() => {});
  await watchTemplates().catch(() => {});
}

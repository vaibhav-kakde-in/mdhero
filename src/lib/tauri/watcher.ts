import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { reloadCurrentFile } from "./files";
import { tabStore } from "../stores/tabs";

let unlisten: UnlistenFn | null = null;
let reloadTimeout: ReturnType<typeof setTimeout> | null = null;

const OWN_SAVE_SUPPRESSION_MS = 1500;

export async function startFileWatcher(filePath: string): Promise<void> {
  if (unlisten) {
    unlisten();
  }

  unlisten = await listen<{ path: string }>("file-changed", () => {
    // Debounce on frontend too — editors may trigger multiple events
    if (reloadTimeout) clearTimeout(reloadTimeout);
    reloadTimeout = setTimeout(() => {
      // Skip reload if this file-changed event was triggered by our own save
      const lastSavedAt = tabStore.getLastSavedAt(filePath);
      if (lastSavedAt && Date.now() - lastSavedAt < OWN_SAVE_SUPPRESSION_MS) {
        return;
      }
      reloadCurrentFile(filePath);
    }, 100);
  });

  // The Rust watcher tracks only one file. Re-start it whenever the active
  // tab changes so returning to a previously opened tab watches its file again.
  invoke("start_watching", { path: filePath }).catch(() => {});
}

/**
 * Tear the watcher down on both sides of the IPC boundary.
 *
 * Dropping only the JS listener would leave the Rust debouncer watching the
 * directory of a file nobody has open any more — it keeps a thread and an OS
 * watch handle alive for the rest of the session.
 */
export function stopFileWatcher(): void {
  if (reloadTimeout) {
    clearTimeout(reloadTimeout);
    reloadTimeout = null;
  }
  if (unlisten) {
    unlisten();
    unlisten = null;
  }
  invoke("stop_watching").catch(() => {});
}

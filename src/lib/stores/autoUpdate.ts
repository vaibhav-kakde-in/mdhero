import { writable, get } from "svelte/store";

/**
 * In-app download + install of updates via tauri-plugin-updater.
 *
 * This is the *action* layer. The *detection* layer lives in `updater.ts`
 * (it polls mdhero.app/api/version, drives the banner/toast, and feeds the
 * aggregate DAU counter). When the user clicks "Update now," we run the
 * updater plugin's own check against the GitHub `latest.json` manifest —
 * that's authoritative for the signed artifact — then download, install, and
 * relaunch onto the new version.
 */

/** True while a download/install is in progress. */
export const updateInstalling = writable(false);
/** 0–100 once content length is known; -1 while indeterminate. */
export const updateProgress = writable(-1);
/** Human-readable error if the install failed (null = no error). */
export const updateError = writable<string | null>(null);

export async function installUpdate(): Promise<void> {
  // The updater plugin is a no-op in dev (no bundled app to replace). Surface
  // a clear message rather than failing cryptically.
  if (import.meta.env.DEV) {
    updateError.set("In-app updates are only available in installed builds, not dev.");
    return;
  }

  if (get(updateInstalling)) return;

  updateError.set(null);
  updateInstalling.set(true);
  updateProgress.set(-1);

  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();

    if (!update) {
      updateError.set("No update available.");
      updateInstalling.set(false);
      return;
    }

    let downloaded = 0;
    let contentLength = 0;

    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          contentLength = event.data.contentLength ?? 0;
          downloaded = 0;
          updateProgress.set(contentLength > 0 ? 0 : -1);
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          if (contentLength > 0) {
            updateProgress.set(Math.min(100, Math.round((downloaded / contentLength) * 100)));
          }
          break;
        case "Finished":
          updateProgress.set(100);
          break;
      }
    });

    // Installed to disk — relaunch onto the new version. On Windows the NSIS
    // installer (installMode: passive) handles the swap + relaunch itself, so
    // this may not return; calling relaunch is still correct on macOS.
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (err) {
    updateError.set(err instanceof Error ? err.message : String(err));
    updateInstalling.set(false);
  }
}

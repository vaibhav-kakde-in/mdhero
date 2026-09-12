/**
 * Stands in for `@tauri-apps/api/core` inside the Quick Look bundle.
 *
 * The extension is a plain WKWebView with no Tauri runtime and no asset
 * protocol, so `convertFileSrc` can never succeed there. `pipeline.ts` already
 * wraps every call in try/catch and falls back to the original `src`, so
 * throwing here is the correct, expected path — and aliasing to this stub keeps
 * the whole Tauri client out of the bundle.
 */
export function convertFileSrc(_path: string): string {
  throw new Error("no asset protocol in Quick Look");
}

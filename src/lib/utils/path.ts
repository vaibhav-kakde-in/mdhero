// Cross-platform path helpers.
//
// MDHero ships Windows, macOS and Linux builds, but several call sites derived
// a file name with `path.split("/").pop()`. On Windows a path has no forward
// slashes, so that returns the *entire* path — which is what the tab and window
// titles were showing. These helpers handle both separators and are unit tested
// against real paths from all three platforms.

/**
 * Last segment of a filesystem path — the file or folder name.
 *
 * Handles both separators, a trailing separator, and a path with no separator
 * at all (returned unchanged). Only for real paths: the `paste://` / `url://` /
 * `new://` tab sentinels contain `//` and would be cut at it, so callers filter
 * those out before getting here (they carry their own display name anyway).
 */
export function basename(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  const idx = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (idx < 0) return trimmed || path;
  return trimmed.slice(idx + 1) || trimmed;
}

/**
 * Strip Windows' verbatim path prefix, which `Path::canonicalize` returns and
 * which is correct but unreadable in a title bar: `\\?\C:\x` becomes `C:\x`,
 * and the UNC form `\\?\UNC\server\share` folds back to `\\server\share`.
 */
export function stripVerbatimPrefix(path: string): string {
  if (path.startsWith("\\\\?\\UNC\\")) return "\\\\" + path.slice(8);
  if (path.startsWith("\\\\?\\")) return path.slice(4);
  return path;
}

/**
 * Collapse the user's home directory to `~` for display, on any platform:
 * `/Users/<name>` (macOS), `/home/<name>` (Linux), `C:\Users\<name>` (Windows).
 * Returns the path unchanged when it isn't under a home directory.
 */
export function shortenHomePath(path: string): string {
  const normalized = stripVerbatimPrefix(path);
  const match = normalized.match(
    /^(?:\/Users\/|\/home\/|[A-Za-z]:[\\/]Users[\\/])[^\\/]+[\\/](.*)$/
  );
  if (!match) return normalized;
  return "~/" + match[1].replace(/\\/g, "/");
}

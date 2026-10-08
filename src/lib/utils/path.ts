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

/**
 * The line under a tab's name in the side tabs panel, for the tabs that need
 * one (see `tabsNeedingFolder`): the folder a file is in, or what kind of tab
 * it is for the ones without a file. Only the last two folder segments are
 * kept — enough to tell two README.md apart, without a long path that the
 * ellipsis would cut from its useful end.
 */
export function tabFolderLabel(filePath: string): string {
  if (filePath.startsWith("paste://")) return "Pasted";
  if (filePath.startsWith("new://")) return "Not saved yet";
  if (filePath.startsWith("url://")) {
    try {
      return new URL(filePath.slice("url://".length)).host;
    } catch {
      return "Web page";
    }
  }

  // Shortened with the file name still on, so a file directly in the home
  // directory comes out as `~` rather than the full home path.
  const shortened = shortenHomePath(filePath);
  const cut = Math.max(shortened.lastIndexOf("/"), shortened.lastIndexOf("\\"));
  if (cut < 0) return "";
  const folder = cut === 0 ? "/" : shortened.slice(0, cut);
  const segments = folder.split(/[\\/]/).filter(Boolean);
  if (segments.length <= 2) return folder.replace(/\\/g, "/");
  return "…/" + segments.slice(-2).join("/");
}

/**
 * The ids of the side tabs that show their folder under their name. A tab
 * shows its name alone unless another open tab has the same name and the
 * folder tells them apart: two README.md from different projects get it, two
 * "Untitled" (both "Not saved yet") don't. The full path is on hover anyway.
 */
export function tabsNeedingFolder(
  tabs: readonly { id: string; fileName: string; filePath: string }[]
): Set<string> {
  const foldersByName = new Map<string, Set<string>>();
  for (const tab of tabs) {
    const folders = foldersByName.get(tab.fileName) ?? new Set<string>();
    folders.add(tabFolderLabel(tab.filePath));
    foldersByName.set(tab.fileName, folders);
  }
  return new Set(
    tabs.filter((tab) => foldersByName.get(tab.fileName)!.size > 1).map((tab) => tab.id)
  );
}

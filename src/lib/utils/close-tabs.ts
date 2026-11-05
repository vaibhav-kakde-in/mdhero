// Which tabs a bulk entry of the tab context menu closes (#127).

export type CloseScope =
  /** Every tab but the one the menu was opened on. */
  | "others"
  /** The tabs after it: to its right in the top row, below it in the side panel. */
  | "after"
  /** All of them. */
  | "all";

/** Ids to close, in tab order. `anchorId` is the tab the menu was opened on. If
 *  it is no longer in the list, "others" and "after" close nothing rather than
 *  everything; "all" doesn't depend on it. */
export function tabsToClose(
  tabs: readonly { id: string }[],
  anchorId: string,
  scope: CloseScope
): string[] {
  const ids = tabs.map((t) => t.id);
  if (scope === "all") return ids;
  const at = ids.indexOf(anchorId);
  if (at === -1) return [];
  return scope === "others" ? ids.filter((id) => id !== anchorId) : ids.slice(at + 1);
}

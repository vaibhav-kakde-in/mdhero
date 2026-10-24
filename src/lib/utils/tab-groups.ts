/**
 * Tab groups, the way Chrome does them: a named, coloured run of tabs that
 * can be folded away. A group's tabs always sit next to each other in the tab
 * order, so the bar can draw each group as one block while everything else
 * (Ctrl+Tab, closing, the saved session) keeps working on one flat list.
 *
 * These helpers are pure: they take the tab list and return a new one.
 */

/** In the order a new group picks them: blue first, grey last. */
export const GROUP_COLORS = ["blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange", "grey"] as const;
export type GroupColor = (typeof GROUP_COLORS)[number];

export interface TabGroup {
  id: string;
  name: string;
  color: GroupColor;
  collapsed: boolean;
}

interface Groupable {
  id: string;
  groupId: string | null;
}

export function isGroupColor(value: unknown): value is GroupColor {
  return typeof value === "string" && (GROUP_COLORS as readonly string[]).includes(value);
}

function lastIndexWhere<T>(items: T[], test: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i--) {
    if (test(items[i])) return i;
  }
  return -1;
}

/** Gathers each group's tabs right after its first tab, keeping every other order. */
export function keepGroupsTogether<T extends Groupable>(tabs: T[]): T[] {
  const placed = new Set<string>();
  const out: T[] = [];
  for (const tab of tabs) {
    if (!tab.groupId) {
      out.push(tab);
    } else if (!placed.has(tab.groupId)) {
      placed.add(tab.groupId);
      out.push(...tabs.filter((t) => t.groupId === tab.groupId));
    }
  }
  return out;
}

/**
 * Drag and drop: moves the tab at `from` to `to`, the place of the tab it is
 * dropped on. Dropped on a tab of a group, it joins that group; on a loose
 * tab, it ends up outside any group. `pastEdge` says the drop is beyond the
 * edge of the group it lands next to (see `isGroupEdge`; also a drop on a
 * group's chip, or past the last tab of the bar): the tab then stays out of
 * that group. A tab alone in its group is the whole group, so it keeps it
 * wherever it lands outside another group.
 */
export function moveTab<T extends Groupable>(tabs: T[], from: number, to: number, pastEdge = false): T[] {
  if (!tabs[from] || !tabs[to] || (from === to && !pastEdge)) return tabs;
  const arr = [...tabs];
  const [moved] = arr.splice(from, 1);
  arr.splice(to, 0, moved);

  const own = moved.groupId;
  const aloneInGroup = !!own && !tabs.some((t) => t !== moved && t.groupId === own);
  const onto = pastEdge ? null : tabs[to].groupId;
  const groupId = onto ?? (aloneInGroup ? own : null);

  if (groupId !== own) arr[to] = { ...moved, groupId };
  const result = keepGroupsTogether(arr);
  return result.every((t, i) => t === tabs[i]) ? tabs : result;
}

/**
 * Whether the tab at `to` is the last of its group on the side a tab dragged
 * from `from` is heading. Dropped on the half of such a tab that faces that
 * side, a tab goes past the group instead of joining it.
 */
export function isGroupEdge(tabs: Groupable[], from: number, to: number): boolean {
  const groupId = tabs[to]?.groupId;
  if (!groupId) return false;
  return tabs[to > from ? to + 1 : to - 1]?.groupId !== groupId;
}

/**
 * Drag and drop of a whole group (by its chip): moves all its tabs next to
 * the tab at `to`, after it when moving right, before it when moving left,
 * the same way a single tab lands. Aimed at a tab of another group, it goes
 * past that whole group rather than into it.
 */
export function moveGroup<T extends Groupable>(tabs: T[], groupId: string, to: number): T[] {
  const first = tabs.findIndex((t) => t.groupId === groupId);
  const target = tabs[to];
  if (first === -1 || !target || target.groupId === groupId) return tabs;
  const members = tabs.filter((t) => t.groupId === groupId);
  const movingRight = to > first;

  let anchor = target;
  if (target.groupId) {
    const edge = movingRight
      ? lastIndexWhere(tabs, (t) => t.groupId === target.groupId)
      : tabs.findIndex((t) => t.groupId === target.groupId);
    anchor = tabs[edge];
  }
  const rest = tabs.filter((t) => t.groupId !== groupId);
  const at = rest.indexOf(anchor) + (movingRight ? 1 : 0);
  rest.splice(at, 0, ...members);
  return rest;
}

/**
 * Puts a tab in a group (`null` takes it out of its group). A tab joining a
 * group that has tabs lands after the last of them. Otherwise it stays where
 * it is, unless that is inside the group it leaves: then it moves just past
 * that group, so the group stays in one piece.
 */
export function setTabGroup<T extends Groupable>(tabs: T[], tabId: string, groupId: string | null): T[] {
  const idx = tabs.findIndex((t) => t.id === tabId);
  if (idx === -1 || tabs[idx].groupId === groupId) return tabs;
  const tab = tabs[idx];
  const rest = tabs.filter((_, i) => i !== idx);

  const lastOfTarget = groupId ? lastIndexWhere(rest, (t) => t.groupId === groupId) : -1;
  let at: number;
  if (lastOfTarget !== -1) {
    at = lastOfTarget + 1;
  } else {
    const lastOfOld = tab.groupId ? lastIndexWhere(rest, (t) => t.groupId === tab.groupId) : -1;
    at = Math.max(idx, lastOfOld + 1);
  }
  rest.splice(at, 0, { ...tab, groupId });
  return rest;
}

/** The groups that still hold a tab. */
export function liveGroups(groups: TabGroup[], tabs: Groupable[]): TabGroup[] {
  const used = new Set(tabs.map((t) => t.groupId));
  return groups.filter((g) => used.has(g.id));
}

/** The first colour no group uses yet; once all are taken, round again. */
export function nextGroupColor(groups: TabGroup[]): GroupColor {
  const used = new Set(groups.map((g) => g.color));
  return GROUP_COLORS.find((c) => !used.has(c)) ?? GROUP_COLORS[groups.length % GROUP_COLORS.length];
}

export function collapsedGroupIds(groups: TabGroup[]): Set<string> {
  return new Set(groups.filter((g) => g.collapsed).map((g) => g.id));
}

/** A tab is out of sight when its group is folded. */
export function isTabHidden(tab: Groupable, collapsed: Set<string>): boolean {
  return !!tab.groupId && collapsed.has(tab.groupId);
}

/**
 * The tab to show when the one at `start` goes away (closed, or folded into
 * its group): the first shown tab from `start` on, else the nearest one
 * before it. `null` when every tab is folded away (the caller goes Home).
 */
export function nearestShownTab<T extends Groupable>(tabs: T[], collapsed: Set<string>, start: number): T | null {
  for (let i = Math.max(start, 0); i < tabs.length; i++) {
    if (!isTabHidden(tabs[i], collapsed)) return tabs[i];
  }
  for (let i = Math.min(start, tabs.length) - 1; i >= 0; i--) {
    if (!isTabHidden(tabs[i], collapsed)) return tabs[i];
  }
  return null;
}

/** How to call a group in a menu: its name, or its tabs when it has none ("a.md + 2"). */
export function groupLabel(group: TabGroup, tabs: (Groupable & { fileName: string })[]): string {
  const name = group.name.trim();
  if (name) return name;
  const members = tabs.filter((t) => t.groupId === group.id);
  if (members.length === 0) return "";
  return members.length === 1 ? members[0].fileName : `${members[0].fileName} + ${members.length - 1}`;
}

export interface TabRun<T> {
  /** `null` for a run of tabs outside any group. */
  group: TabGroup | null;
  tabs: { tab: T; index: number }[];
}

/** Splits the tab list into what the bar draws: groups, and the loose tabs between them. */
export function tabRuns<T extends Groupable>(tabs: T[], groups: TabGroup[]): TabRun<T>[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const runs: TabRun<T>[] = [];
  tabs.forEach((tab, index) => {
    const group = (tab.groupId && byId.get(tab.groupId)) || null;
    const last = runs[runs.length - 1];
    if (last && last.group?.id === group?.id) {
      last.tabs.push({ tab, index });
    } else {
      runs.push({ group, tabs: [{ tab, index }] });
    }
  });
  return runs;
}

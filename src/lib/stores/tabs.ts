import { writable, get } from "svelte/store";
import {
  collapsedGroupIds,
  isGroupColor,
  isTabHidden,
  keepGroupsTogether,
  liveGroups,
  moveGroup,
  moveTab,
  nearestShownTab,
  nextGroupColor,
  setTabGroup,
  type GroupColor,
  type TabGroup,
} from "../utils/tab-groups";

export interface Tab {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  renderedHtml: string;
  frontmatter: Record<string, unknown> | null;
  wordCount: number;
  scrollTop: number;
  isEditing: boolean;
  editContent: string;
  dirty: boolean;
  lastSavedAt: number;
  /**
   * The file changed on disk while this tab had unsaved edits (#97). The edits
   * are kept; this flag marks the tab and makes Save ask before overwriting.
   * Cleared by a save, or once the tab is no longer dirty.
   */
  diskChanged: boolean;
  /** The tab group this tab belongs to, if any. */
  groupId: string | null;
}

export const HOME_TAB_ID = "__home__";

/** A tab group as saved with the session: its look and the files it held. */
export interface SavedGroup {
  name: string;
  color: GroupColor;
  collapsed: boolean;
  paths: string[];
}

/**
 * What survives a restart (#72): the on-disk files that were open, in tab
 * order, which of them was active (`null` when the home tab was), and the tab
 * groups they were in (the key is left out when there are none). Nothing
 * else — unsaved edits, scroll offsets and the `paste://` / `url://` / `new://`
 * tabs have no file to come back from.
 */
export interface SavedSession {
  paths: string[];
  activePath: string | null;
  groups?: SavedGroup[];
}

const SESSION_KEY = "mdhero-session";

function isRestorablePath(filePath: string): boolean {
  return !!filePath
    && !filePath.startsWith("paste://")
    && !filePath.startsWith("url://")
    && !filePath.startsWith("new://");
}

function loadSession(): SavedSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.paths)) return null;
    const session: SavedSession = {
      paths: parsed.paths.filter((p: unknown) => typeof p === "string" && isRestorablePath(p)),
      activePath: typeof parsed.activePath === "string" ? parsed.activePath : null,
    };
    const groups = Array.isArray(parsed.groups)
      ? parsed.groups.map(loadGroup).filter((g: SavedGroup | null): g is SavedGroup => g !== null)
      : [];
    if (groups.length > 0) session.groups = groups;
    return session;
  } catch {
    return null;
  }
}

function loadGroup(raw: any): SavedGroup | null {
  if (!Array.isArray(raw?.paths)) return null;
  const paths = raw.paths.filter((p: unknown) => typeof p === "string" && isRestorablePath(p));
  if (paths.length === 0) return null;
  return {
    name: typeof raw.name === "string" ? raw.name : "",
    color: isGroupColor(raw.color) ? raw.color : "grey",
    collapsed: raw.collapsed === true,
    paths,
  };
}

function saveSession(session: SavedSession) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
}

function createTabStore() {
  const tabs = writable<Tab[]>([]);
  const activeTabId = writable<string | null>(HOME_TAB_ID);
  const groups = writable<TabGroup[]>([]);

  // Captured once, before the persistence subscription below overwrites the
  // key with this (empty) session. `restoreSession` reads it on launch.
  const savedSession = loadSession();

  function persistSession() {
    const currentTabs = get(tabs);
    const active = currentTabs.find((t) => t.id === get(activeTabId));
    const session: SavedSession = {
      paths: currentTabs.filter((t) => isRestorablePath(t.filePath)).map((t) => t.filePath),
      activePath: active && isRestorablePath(active.filePath) ? active.filePath : null,
    };
    const savedGroups = get(groups)
      .map((g) => ({
        name: g.name,
        color: g.color,
        collapsed: g.collapsed,
        paths: currentTabs.filter((t) => t.groupId === g.id && isRestorablePath(t.filePath)).map((t) => t.filePath),
      }))
      .filter((g) => g.paths.length > 0);
    if (savedGroups.length > 0) session.groups = savedGroups;
    saveSession(session);
  }
  tabs.subscribe(persistSession);
  activeTabId.subscribe(persistSession);
  groups.subscribe(persistSession);

  // A group goes away with its last tab.
  tabs.subscribe((ts) => {
    const current = get(groups);
    const live = liveGroups(current, ts);
    if (live.length !== current.length) groups.set(live);
  });

  // The active tab is never folded away: whatever puts it in a folded group
  // (switching to it, moving it there, restoring a session) unfolds the group.
  function revealActiveTab() {
    const active = get(tabs).find((t) => t.id === get(activeTabId));
    if (!active?.groupId) return;
    const group = get(groups).find((g) => g.id === active.groupId);
    if (group?.collapsed) setGroupFlag(group.id, false);
  }
  tabs.subscribe(revealActiveTab);
  activeTabId.subscribe(revealActiveTab);
  groups.subscribe(revealActiveTab);

  /** The session as it was when this store initialised — i.e. the previous run's. */
  function getSavedSession(): SavedSession | null {
    return savedSession;
  }

  function generateId(): string {
    return Math.random().toString(36).slice(2, 10);
  }

  function addTab(filePath: string, fileName: string, content: string, renderedHtml: string, frontmatter?: Record<string, unknown> | null, wordCount?: number): string {
    const currentTabs = get(tabs);

    // If file is already open, switch to it
    const existing = currentTabs.find((t) => t.filePath === filePath);
    if (existing) {
      activeTabId.set(existing.id);
      tabs.update((ts) =>
        ts.map((t) => {
          if (t.id !== existing.id) return t;
          // Preserve edit state on re-add — only refresh content/render if not dirty
          if (t.isEditing) {
            const dirty = t.editContent !== content;
            return { ...t, content, renderedHtml, frontmatter: frontmatter ?? null, wordCount: wordCount ?? 0, dirty };
          }
          return { ...t, content, renderedHtml, frontmatter: frontmatter ?? null, wordCount: wordCount ?? 0, editContent: content, dirty: false };
        })
      );
      return existing.id;
    }

    const id = generateId();
    const newTab: Tab = {
      id,
      filePath,
      fileName,
      content,
      renderedHtml,
      frontmatter: frontmatter ?? null,
      wordCount: wordCount ?? 0,
      scrollTop: 0,
      isEditing: false,
      editContent: content,
      dirty: false,
      lastSavedAt: 0,
      diskChanged: false,
      groupId: null,
    };

    tabs.update((ts) => [...ts, newTab]);
    activeTabId.set(id);
    return id;
  }

  function closeTab(id: string) {
    if (id === HOME_TAB_ID) return; // Can't close home tab
    saveScrollPosition();
    const currentTabs = get(tabs);
    const idx = currentTabs.findIndex((t) => t.id === id);
    if (idx === -1) return;

    const newTabs = currentTabs.filter((t) => t.id !== id);
    tabs.set(newTabs);

    // If closing the active tab, switch to the adjacent one still in sight
    // (not folded away in a group), or home
    if (get(activeTabId) === id) {
      const next = nearestShownTab(newTabs, collapsedGroupIds(get(groups)), Math.min(idx, newTabs.length - 1));
      activeTabId.set(next ? next.id : HOME_TAB_ID);
    }
  }

  function goHome() {
    saveScrollPosition();
    activeTabId.set(HOME_TAB_ID);
  }

  function saveScrollPosition() {
    const currentId = get(activeTabId);
    if (currentId) {
      const scrollTop = window.scrollY;
      tabs.update((ts) =>
        ts.map((t) => (t.id === currentId ? { ...t, scrollTop } : t))
      );
    }
  }

  function switchTab(id: string) {
    if (get(activeTabId) === id) return;
    saveScrollPosition();
    activeTabId.set(id);
  }

  function updateTabContent(filePath: string, content: string, renderedHtml: string, frontmatter?: Record<string, unknown> | null, wordCount?: number) {
    tabs.update((ts) =>
      ts.map((t) => {
        if (t.filePath !== filePath) return t;
        const next: Tab = {
          ...t,
          content,
          renderedHtml,
          frontmatter: frontmatter ?? t.frontmatter,
          wordCount: wordCount ?? t.wordCount,
        };
        // Preserve in-progress edits when content updates from external sources (file watcher)
        if (t.isEditing) {
          next.dirty = t.editContent !== content;
          // Remember that the disk moved under unsaved edits, so the tab can
          // show it and Save can ask first (#97). Not raised when the disk
          // now matches what the user typed — there is nothing to lose then.
          next.diskChanged = next.dirty && (t.diskChanged || content !== t.content);
        } else {
          next.editContent = content;
          next.dirty = false;
          next.diskChanged = false;
        }
        return next;
      })
    );
  }

  function getActiveTab(): Tab | null {
    const id = get(activeTabId);
    if (!id) return null;
    return get(tabs).find((t) => t.id === id) ?? null;
  }

  // A dragged tab joins, keeps or leaves a group depending on where it lands
  // (see `moveTab`).
  function reorderTabs(fromIndex: number, toIndex: number, pastEdge = false) {
    const ts = get(tabs);
    const next = moveTab(ts, fromIndex, toIndex, pastEdge);
    if (next !== ts) tabs.set(next);
  }

  // A group dragged by its chip moves as a block (see `moveGroup`).
  function reorderGroup(groupId: string, toIndex: number) {
    tabs.update((ts) => moveGroup(ts, groupId, toIndex));
  }

  /** The tabs not folded away in a group, in order: what Ctrl+Tab walks through. */
  function shownTabs(): Tab[] {
    const collapsed = collapsedGroupIds(get(groups));
    return get(tabs).filter((t) => !isTabHidden(t, collapsed));
  }

  /** Puts the tab in a new group of its own and returns the group's id. */
  function createGroup(tabId: string): string {
    const id = generateId();
    groups.update((gs) => [...gs, { id, name: "", color: nextGroupColor(gs), collapsed: false }]);
    tabs.update((ts) => setTabGroup(ts, tabId, id));
    return id;
  }

  function moveToGroup(tabId: string, groupId: string) {
    if (!get(groups).some((g) => g.id === groupId)) return;
    tabs.update((ts) => setTabGroup(ts, tabId, groupId));
  }

  function removeFromGroup(tabId: string) {
    tabs.update((ts) => setTabGroup(ts, tabId, null));
  }

  function updateGroup(groupId: string, changes: { name?: string; color?: GroupColor }) {
    groups.update((gs) => gs.map((g) => (g.id === groupId ? { ...g, ...changes } : g)));
  }

  function setGroupFlag(groupId: string, collapsed: boolean) {
    groups.update((gs) => gs.map((g) => (g.id === groupId ? { ...g, collapsed } : g)));
  }

  // Folding the group of the active tab first moves to the nearest tab still
  // in sight (else Home), as Chrome does.
  function setGroupCollapsed(groupId: string, collapsed: boolean) {
    if (collapsed) {
      const ts = get(tabs);
      const activeIdx = ts.findIndex((t) => t.id === get(activeTabId));
      if (activeIdx !== -1 && ts[activeIdx].groupId === groupId) {
        const folded = collapsedGroupIds(get(groups)).add(groupId);
        const next = nearestShownTab(ts, folded, activeIdx);
        if (next) switchTab(next.id);
        else goHome();
      }
    }
    setGroupFlag(groupId, collapsed);
  }

  function toggleGroup(groupId: string) {
    const group = get(groups).find((g) => g.id === groupId);
    if (group) setGroupCollapsed(groupId, !group.collapsed);
  }

  /** Dissolves the group; its tabs stay where they are. */
  function ungroup(groupId: string) {
    tabs.update((ts) => ts.map((t) => (t.groupId === groupId ? { ...t, groupId: null } : t)));
  }

  /**
   * Rebuilds the saved groups over the tabs `restoreSession` reopened (#72),
   * matching them by path. Files that did not come back are simply missing
   * from their group; a group with none of its files back is not rebuilt.
   */
  function restoreGroups(saved: SavedGroup[]) {
    const current = get(tabs);
    const restored: TabGroup[] = [];
    const assigned = new Map<string, string>();
    for (const g of saved) {
      const members = current.filter((t) => !t.groupId && !assigned.has(t.id) && g.paths.includes(t.filePath));
      if (members.length === 0) continue;
      const id = generateId();
      restored.push({ id, name: g.name, color: g.color, collapsed: g.collapsed });
      for (const m of members) assigned.set(m.id, id);
    }
    if (restored.length === 0) return;
    groups.update((gs) => [...gs, ...restored]);
    tabs.update((ts) =>
      keepGroupsTogether(ts.map((t) => (assigned.has(t.id) ? { ...t, groupId: assigned.get(t.id)! } : t)))
    );
  }

  function setEditing(id: string, editing: boolean) {
    tabs.update((ts) =>
      ts.map((t) => {
        if (t.id !== id) return t;
        // When entering edit mode, sync editContent to current content if not already dirty
        if (editing && !t.isEditing && !t.dirty) {
          return { ...t, isEditing: true, editContent: t.content };
        }
        return { ...t, isEditing: editing };
      })
    );
  }

  function updateEditContent(id: string, newContent: string) {
    tabs.update((ts) =>
      ts.map((t) => {
        if (t.id !== id) return t;
        return { ...t, editContent: newContent, dirty: newContent !== t.content };
      })
    );
  }

  function markSaved(id: string) {
    tabs.update((ts) =>
      ts.map((t) => {
        if (t.id !== id) return t;
        return { ...t, content: t.editContent, dirty: false, diskChanged: false, lastSavedAt: Date.now() };
      })
    );
  }

  function getLastSavedAt(filePath: string): number {
    const t = get(tabs).find((x) => x.filePath === filePath);
    return t?.lastSavedAt ?? 0;
  }

  // Re-point a tab at a real filesystem path + name. Used when an unsaved
  // `new://` document gets a location on its first save (#63).
  function rebindPath(id: string, filePath: string, fileName: string) {
    tabs.update((ts) =>
      ts.map((t) => (t.id === id ? { ...t, filePath, fileName } : t))
    );
  }

  return {
    tabs,
    activeTabId,
    groups,
    addTab,
    closeTab,
    switchTab,
    updateTabContent,
    getActiveTab,
    reorderTabs,
    reorderGroup,
    goHome,
    setEditing,
    updateEditContent,
    markSaved,
    getLastSavedAt,
    rebindPath,
    saveScrollPosition,
    getSavedSession,
    shownTabs,
    createGroup,
    moveToGroup,
    removeFromGroup,
    updateGroup,
    setGroupCollapsed,
    toggleGroup,
    ungroup,
    restoreGroups,
  };
}

export const tabStore = createTabStore();

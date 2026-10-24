import { describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";

// Tab groups in the tab store: folding never hides the active tab, a group
// goes away with its last tab, and groups are saved with the session (#72).
const SESSION_KEY = "mdhero-session";

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

async function freshStore(initial: Record<string, string> = {}) {
  vi.resetModules();
  (globalThis as any).localStorage = fakeStorage(initial);
  (globalThis as any).window = { scrollY: 0 };
  const mod = await import("../../src/lib/stores/tabs");
  return mod.tabStore;
}

function session() {
  return JSON.parse((globalThis as any).localStorage.getItem(SESSION_KEY));
}

type Store = Awaited<ReturnType<typeof freshStore>>;

function open(store: Store, ...names: string[]): string[] {
  return names.map((n) => store.addTab(`/docs/${n}`, n, "", ""));
}

function order(store: Store): string[] {
  return get(store.tabs).map((t) => t.fileName);
}

function groupOf(store: Store, id: string) {
  const groupId = get(store.tabs).find((t) => t.id === id)?.groupId;
  return get(store.groups).find((g) => g.id === groupId) ?? null;
}

describe("tab groups in the tab store", () => {
  it("creates a group around a tab, with the next free colour", async () => {
    const store = await freshStore();
    const [a, b] = open(store, "a.md", "b.md");
    const g1 = store.createGroup(a);
    const g2 = store.createGroup(b);

    expect(get(store.groups).map((g) => [g.id, g.color, g.name, g.collapsed])).toEqual([
      [g1, "blue", "", false],
      [g2, "red", "", false],
    ]);
    expect(groupOf(store, a)?.id).toBe(g1);
  });

  it("moves tabs into and out of groups, keeping each group in one piece", async () => {
    const store = await freshStore();
    const [a, , c] = open(store, "a.md", "b.md", "c.md");
    const g = store.createGroup(a);
    store.moveToGroup(c, g);
    expect(order(store)).toEqual(["a.md", "c.md", "b.md"]);

    store.removeFromGroup(a);
    expect(order(store)).toEqual(["c.md", "a.md", "b.md"]);
    expect(groupOf(store, a)).toBeNull();
    expect(groupOf(store, c)?.id).toBe(g);
  });

  it("drops a group once its last tab leaves or closes", async () => {
    const store = await freshStore();
    const [a, b] = open(store, "a.md", "b.md");
    store.createGroup(a);
    store.createGroup(b);

    store.removeFromGroup(a);
    expect(get(store.groups)).toHaveLength(1);
    store.closeTab(b);
    expect(get(store.groups)).toHaveLength(0);
  });

  it("ungroups without moving the tabs", async () => {
    const store = await freshStore();
    const [a, b] = open(store, "a.md", "b.md", "c.md");
    const g = store.createGroup(a);
    store.moveToGroup(b, g);
    store.ungroup(g);

    expect(order(store)).toEqual(["a.md", "b.md", "c.md"]);
    expect(get(store.groups)).toHaveLength(0);
  });

  it("renames and recolours a group", async () => {
    const store = await freshStore();
    const [a] = open(store, "a.md");
    const g = store.createGroup(a);
    store.updateGroup(g, { name: "Specs", color: "green" });

    expect(groupOf(store, a)).toMatchObject({ name: "Specs", color: "green" });
  });

  it("moves off the active tab when its group folds: next shown tab, else Home", async () => {
    const store = await freshStore();
    const [a, b, c] = open(store, "a.md", "b.md", "c.md");
    const g = store.createGroup(a);
    store.moveToGroup(b, g);
    store.switchTab(a);

    store.setGroupCollapsed(g, true);
    expect(get(store.activeTabId)).toBe(c);
    expect(groupOf(store, a)?.collapsed).toBe(true);

    store.moveToGroup(c, g); // c joins the folded group: it unfolds
    expect(groupOf(store, a)?.collapsed).toBe(false);
    store.setGroupCollapsed(g, true);
    expect(get(store.activeTabId)).toBe("__home__");
  });

  it("unfolds a group when one of its tabs becomes active", async () => {
    const store = await freshStore();
    const [a, b] = open(store, "a.md", "b.md");
    const g = store.createGroup(a);
    store.toggleGroup(g);
    expect(groupOf(store, a)?.collapsed).toBe(true);

    store.switchTab(a);
    expect(groupOf(store, a)?.collapsed).toBe(false);
    expect(get(store.activeTabId)).toBe(a);
    void b;
  });

  it("skips folded tabs when closing the active tab and in the shown order", async () => {
    const store = await freshStore();
    const [a, b, c, d] = open(store, "a.md", "b.md", "c.md", "d.md");
    const g = store.createGroup(b);
    store.moveToGroup(c, g);
    store.toggleGroup(g);
    expect(store.shownTabs().map((t) => t.id)).toEqual([a, d]);

    store.switchTab(a);
    store.closeTab(a);
    expect(get(store.activeTabId)).toBe(d);
  });

  it("drags a tab into a group by dropping it on one of its tabs", async () => {
    const store = await freshStore();
    const [a, b, c] = open(store, "a.md", "b.md", "c.md");
    const g = store.createGroup(a);
    store.moveToGroup(b, g);

    store.reorderTabs(2, 0, true); // c before a, past the group's edge: stays loose
    expect(groupOf(store, c)).toBeNull();
    store.reorderTabs(0, 1); // c on a: lands after it, in the group
    expect(order(store)).toEqual(["a.md", "c.md", "b.md"]);
    expect(groupOf(store, c)?.id).toBe(g);
  });
});

describe("dragging a whole group", () => {
  it("moves the group's tabs as a block, and keeps them in their group", async () => {
    const store = await freshStore();
    const [a, b] = open(store, "a.md", "b.md", "x.md", "y.md");
    const g = store.createGroup(a);
    store.moveToGroup(b, g);

    store.reorderGroup(g, 3); // aimed at y.md, moving right: after it
    expect(order(store)).toEqual(["x.md", "y.md", "a.md", "b.md"]);
    expect(groupOf(store, a)?.id).toBe(g);
    expect(groupOf(store, b)?.id).toBe(g);
    expect(session().paths).toEqual(["/docs/x.md", "/docs/y.md", "/docs/a.md", "/docs/b.md"]);
  });
});

describe("tab groups in the saved session", () => {
  it("saves each group's look and files, and leaves the key out when there are none", async () => {
    const store = await freshStore();
    const [a, b] = open(store, "a.md", "b.md");
    store.addTab("paste://1", "Pasted", "", "");
    expect(session().groups).toBeUndefined();

    const g = store.createGroup(a);
    store.updateGroup(g, { name: "Docs", color: "purple" });
    store.toggleGroup(g);
    expect(session().groups).toEqual([
      { name: "Docs", color: "purple", collapsed: true, paths: ["/docs/a.md"] },
    ]);
    void b;
  });

  it("does not save a group made only of tabs with no file", async () => {
    const store = await freshStore();
    const p = store.addTab("paste://1", "Pasted", "", "");
    store.createGroup(p);
    expect(session().groups).toBeUndefined();
  });

  it("reads saved groups back, dropping junk", async () => {
    const store = await freshStore({
      [SESSION_KEY]: JSON.stringify({
        paths: ["/docs/a.md", "/docs/b.md"],
        activePath: null,
        groups: [
          { name: "Docs", color: "green", collapsed: true, paths: ["/docs/a.md", "paste://2"] },
          { name: 3, color: "tartan", paths: ["/docs/b.md"] },
          { name: "Empty", color: "red", paths: ["new://1"] },
          "nope",
        ],
      }),
    });
    expect(store.getSavedSession()?.groups).toEqual([
      { name: "Docs", color: "green", collapsed: true, paths: ["/docs/a.md"] },
      { name: "", color: "grey", collapsed: false, paths: ["/docs/b.md"] },
    ]);
  });

  it("rebuilds groups over the reopened tabs, in one piece", async () => {
    const store = await freshStore();
    open(store, "a.md", "x.md", "b.md", "c.md");
    store.restoreGroups([
      { name: "Docs", color: "green", collapsed: false, paths: ["/docs/a.md", "/docs/b.md", "/docs/gone.md"] },
      { name: "Gone", color: "red", collapsed: false, paths: ["/docs/gone.md"] },
    ]);

    expect(order(store)).toEqual(["a.md", "b.md", "x.md", "c.md"]);
    expect(get(store.groups).map((g) => g.name)).toEqual(["Docs"]);
  });
});

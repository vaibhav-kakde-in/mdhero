import { describe, expect, it } from "vitest";
import {
  GROUP_COLORS,
  groupLabel,
  isGroupEdge,
  keepGroupsTogether,
  liveGroups,
  moveGroup,
  moveTab,
  nearestShownTab,
  nextGroupColor,
  setTabGroup,
  tabRuns,
  type TabGroup,
} from "../../src/lib/utils/tab-groups";

// Tabs written as "id:group" ("a:G", or "a" for no group), to keep the
// expected orders readable.
function tabs(spec: string) {
  return spec.split(" ").map((s) => {
    const [id, groupId] = s.split(":");
    return { id, groupId: groupId ?? null, fileName: `${id}.md` };
  });
}

function spec(list: { id: string; groupId: string | null }[]) {
  return list.map((t) => (t.groupId ? `${t.id}:${t.groupId}` : t.id)).join(" ");
}

function group(id: string, extra: Partial<TabGroup> = {}): TabGroup {
  return { id, name: "", color: "blue", collapsed: false, ...extra };
}

describe("keepGroupsTogether", () => {
  it("gathers a group's tabs after its first one", () => {
    expect(spec(keepGroupsTogether(tabs("a:G x b:G y c:H d:G")))).toBe("a:G b:G d:G x y c:H");
  });

  it("leaves a list that is already in one piece alone", () => {
    expect(spec(keepGroupsTogether(tabs("x a:G b:G y c:H")))).toBe("x a:G b:G y c:H");
  });
});

describe("moveTab (drag and drop)", () => {
  it("joins the group it is dropped inside", () => {
    // Dragged rightwards onto a, x lands just after it: between a and b.
    expect(spec(moveTab(tabs("x a:G b:G y"), 0, 1))).toBe("a:G x:G b:G y");
    // Dragged leftwards onto b, y lands just before it.
    expect(spec(moveTab(tabs("x a:G b:G y"), 3, 2))).toBe("x a:G y:G b:G");
  });

  it("stays in its group when moved within it or to its edge", () => {
    expect(spec(moveTab(tabs("a:G b:G c:G y"), 0, 2))).toBe("b:G c:G a:G y");
    expect(spec(moveTab(tabs("y a:G b:G c:G"), 3, 1))).toBe("y c:G a:G b:G");
  });

  it("leaves its group when dropped away from it", () => {
    expect(spec(moveTab(tabs("a:G b:G x y"), 0, 3))).toBe("b:G x y a");
  });

  it("does not join a group when dropped on a loose tab next to it", () => {
    expect(spec(moveTab(tabs("x y a:G b:G"), 0, 1))).toBe("y x a:G b:G");
    expect(spec(moveTab(tabs("a:G b:G x y"), 3, 2))).toBe("a:G b:G y x");
  });

  it("joins a group of one tab, from either side", () => {
    expect(spec(moveTab(tabs("x a:G y"), 0, 1))).toBe("a:G x:G y");
    expect(spec(moveTab(tabs("x a:G y"), 2, 1))).toBe("x y:G a:G");
  });

  it("goes past the edge of a group instead of joining it, when told so", () => {
    expect(spec(moveTab(tabs("x a:G b:G y"), 0, 2, true))).toBe("a:G b:G x y");
    expect(spec(moveTab(tabs("x a:G b:G y"), 3, 1, true))).toBe("x y a:G b:G");
  });

  it("leaves a group that ends the tab bar, from its last tab or from further in", () => {
    expect(spec(moveTab(tabs("x a:G b:G"), 2, 2, true))).toBe("x a:G b");
    expect(spec(moveTab(tabs("x a:G b:G"), 1, 2, true))).toBe("x b:G a");
  });

  it("leaves a group that starts the tab bar, from its first tab or from further in", () => {
    expect(spec(moveTab(tabs("a:G b:G x"), 0, 0, true))).toBe("a b:G x");
    expect(spec(moveTab(tabs("a:G b:G x"), 1, 0, true))).toBe("b a:G x");
  });

  it("keeps a group of one tab when it goes past an edge", () => {
    expect(spec(moveTab(tabs("a:G x"), 0, 1, true))).toBe("x a:G");
  });

  it("changes nothing for a loose tab dropped past an edge where it already is", () => {
    const list = tabs("a:G x");
    expect(moveTab(list, 1, 1, true)).toBe(list);
  });

  it("keeps a group of one tab wherever that tab goes, outside another group", () => {
    expect(spec(moveTab(tabs("a:G x y"), 0, 2))).toBe("x y a:G");
  });

  it("does nothing for a drop on itself or out of range", () => {
    const list = tabs("a:G b");
    expect(moveTab(list, 1, 1)).toBe(list);
    expect(moveTab(list, 0, 5)).toBe(list);
  });
});

describe("isGroupEdge", () => {
  it("is true for the last tab of a group on the side the dragged tab is heading", () => {
    const list = tabs("x a:G b:G y");
    expect(isGroupEdge(list, 0, 2)).toBe(true);
    expect(isGroupEdge(list, 3, 1)).toBe(true);
  });

  it("is false for the other tabs of a group, and for loose tabs", () => {
    const list = tabs("x a:G b:G y");
    expect(isGroupEdge(list, 0, 1)).toBe(false);
    expect(isGroupEdge(list, 3, 2)).toBe(false);
    expect(isGroupEdge(list, 0, 3)).toBe(false);
  });

  it("counts the ends of the tab bar as edges", () => {
    const list = tabs("a:G b:G c:G");
    expect(isGroupEdge(list, 0, 2)).toBe(true);
    expect(isGroupEdge(list, 2, 0)).toBe(true);
  });
});

describe("moveGroup (dragging a group by its chip)", () => {
  it("lands after a loose tab when moving right, before it when moving left", () => {
    expect(spec(moveGroup(tabs("a:G b:G x y"), "G", 3))).toBe("x y a:G b:G");
    expect(spec(moveGroup(tabs("a:G b:G x y"), "G", 2))).toBe("x a:G b:G y");
    expect(spec(moveGroup(tabs("x y a:G b:G"), "G", 0))).toBe("a:G b:G x y");
    expect(spec(moveGroup(tabs("x y a:G b:G"), "G", 1))).toBe("x a:G b:G y");
  });

  it("goes past a whole other group, never into it", () => {
    // Aimed at the first tab of H while moving right: after all of H.
    expect(spec(moveGroup(tabs("a:G c:H d:H y"), "G", 1))).toBe("c:H d:H a:G y");
    // Aimed at the last tab of H while moving left: before all of H.
    expect(spec(moveGroup(tabs("x c:H d:H a:G"), "G", 2))).toBe("x a:G c:H d:H");
  });

  it("does nothing when aimed at itself, out of range, or for a group with no tabs", () => {
    const list = tabs("a:G b:G x");
    expect(moveGroup(list, "G", 1)).toBe(list);
    expect(moveGroup(list, "G", 9)).toBe(list);
    expect(moveGroup(list, "Z", 2)).toBe(list);
  });
});

describe("setTabGroup", () => {
  it("adds a tab at the end of a group that has tabs", () => {
    expect(spec(setTabGroup(tabs("x a:G b:G y"), "y", "G"))).toBe("x a:G b:G y:G");
    expect(spec(setTabGroup(tabs("a:G b:G x y"), "y", "G"))).toBe("a:G b:G y:G x");
  });

  it("leaves a loose tab where it is when it starts a new group", () => {
    expect(spec(setTabGroup(tabs("x y z"), "y", "N"))).toBe("x y:N z");
  });

  it("moves a tab out past the group it leaves, so the group stays in one piece", () => {
    expect(spec(setTabGroup(tabs("a:G b:G c:G y"), "a", null))).toBe("b:G c:G a y");
    expect(spec(setTabGroup(tabs("a:G b:G c:G y"), "b", "N"))).toBe("a:G c:G b:N y");
    // The last tab of the group is already past it.
    expect(spec(setTabGroup(tabs("a:G b:G y"), "b", null))).toBe("a:G b y");
  });

  it("moves a tab from one group to the end of another", () => {
    expect(spec(setTabGroup(tabs("a:G b:G c:H"), "a", "H"))).toBe("b:G c:H a:H");
  });

  it("returns the same list when nothing changes", () => {
    const list = tabs("a:G b");
    expect(setTabGroup(list, "a", "G")).toBe(list);
    expect(setTabGroup(list, "nope", "G")).toBe(list);
  });
});

describe("liveGroups / nextGroupColor", () => {
  it("drops the groups no tab is in", () => {
    expect(liveGroups([group("G"), group("H")], tabs("a:G b")).map((g) => g.id)).toEqual(["G"]);
  });

  it("picks the first colour no group uses, then goes round again", () => {
    expect(nextGroupColor([])).toBe("blue");
    expect(nextGroupColor([group("G", { color: "blue" }), group("H", { color: "yellow" })])).toBe("red");
    const all = GROUP_COLORS.map((color, i) => group(`g${i}`, { color }));
    expect(nextGroupColor(all)).toBe(GROUP_COLORS[0]);
  });
});

describe("nearestShownTab", () => {
  const folded = new Set(["G"]);

  it("takes the first shown tab from the start on", () => {
    expect(nearestShownTab(tabs("x a:G b:G y"), folded, 1)?.id).toBe("y");
  });

  it("falls back to the nearest shown tab before", () => {
    expect(nearestShownTab(tabs("x y a:G b:G"), folded, 2)?.id).toBe("y");
  });

  it("returns null when every tab is folded away, or there are none", () => {
    expect(nearestShownTab(tabs("a:G b:G"), folded, 0)).toBeNull();
    expect(nearestShownTab([], folded, -1)).toBeNull();
  });
});

describe("groupLabel", () => {
  it("uses the name, trimmed", () => {
    expect(groupLabel(group("G", { name: "  Docs " }), tabs("a:G"))).toBe("Docs");
  });

  it("names an unnamed group after its tabs", () => {
    expect(groupLabel(group("G"), tabs("a:G"))).toBe("a.md");
    expect(groupLabel(group("G"), tabs("x a:G b:G c:G"))).toBe("a.md + 2");
  });
});

describe("tabRuns", () => {
  it("splits the bar into groups and the loose tabs between them", () => {
    const runs = tabRuns(tabs("x y a:G b:G z c:H"), [group("G"), group("H")]);
    expect(runs.map((r) => [r.group?.id ?? null, r.tabs.map((t) => `${t.tab.id}@${t.index}`)])).toEqual([
      [null, ["x@0", "y@1"]],
      ["G", ["a@2", "b@3"]],
      [null, ["z@4"]],
      ["H", ["c@5"]],
    ]);
  });

  it("treats a tab whose group is gone as loose", () => {
    const runs = tabRuns(tabs("x a:G"), []);
    expect(runs).toHaveLength(1);
    expect(runs[0].group).toBeNull();
  });
});

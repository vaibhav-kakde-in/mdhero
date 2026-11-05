import { describe, expect, it } from "vitest";
import { tabsToClose } from "../../src/lib/utils/close-tabs";

const tabs = ["a", "b", "c", "d"].map((id) => ({ id }));

// The tab menu's bulk entries (#127) close a slice of the tab row, in order.
describe("tabsToClose", () => {
  it("closes every tab but the one clicked for 'others'", () => {
    expect(tabsToClose(tabs, "b", "others")).toEqual(["a", "c", "d"]);
  });

  it("closes the tabs after the one clicked for 'after'", () => {
    expect(tabsToClose(tabs, "b", "after")).toEqual(["c", "d"]);
  });

  it("closes everything for 'all', whichever tab was clicked", () => {
    expect(tabsToClose(tabs, "b", "all")).toEqual(["a", "b", "c", "d"]);
  });

  it("has nothing after the last tab", () => {
    expect(tabsToClose(tabs, "d", "after")).toEqual([]);
  });

  it("has no other tab when there is only one", () => {
    expect(tabsToClose([{ id: "a" }], "a", "others")).toEqual([]);
  });

  it("closes nothing around a tab that is gone, but still closes all", () => {
    expect(tabsToClose(tabs, "gone", "others")).toEqual([]);
    expect(tabsToClose(tabs, "gone", "after")).toEqual([]);
    expect(tabsToClose(tabs, "gone", "all")).toEqual(["a", "b", "c", "d"]);
  });

  it("handles an empty row", () => {
    expect(tabsToClose([], "a", "all")).toEqual([]);
  });
});

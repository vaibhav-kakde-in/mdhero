import { beforeEach, describe, expect, it } from "vitest";
import {
  clampTabsWidth,
  maxTabsWidthFor,
  DEFAULT_TABS_WIDTH,
  MIN_TABS_WIDTH,
  MAX_TABS_WIDTH,
  MIN_DOCUMENT_WIDTH,
} from "../../src/lib/stores/settings";
import { sideTabsWidth } from "../../src/lib/utils/layout";
import { tabFolderLabel, tabsNeedingFolder } from "../../src/lib/utils/path";
import { setLocale, translate } from "../../src/lib/i18n";

// The side tabs panel is sized by the same rules as the ToC sidebar (#108):
// a drag or a stored value can never collapse it or let it cover the document.
describe("clampTabsWidth", () => {
  it("keeps a width that is already in range", () => {
    expect(clampTabsWidth(260)).toBe(260);
  });

  it("clamps a drag past either bound", () => {
    expect(clampTabsWidth(20)).toBe(MIN_TABS_WIDTH);
    expect(clampTabsWidth(5000)).toBe(MAX_TABS_WIDTH);
  });

  it("falls back to the default for junk rather than collapsing", () => {
    for (const junk of [undefined, null, "", "wide", NaN, {}, []]) {
      expect(clampTabsWidth(junk)).toBe(DEFAULT_TABS_WIDTH);
    }
  });

  it("leaves the document its minimum width next to the panel", () => {
    // 800px shared with the document: the panel may take 800 - 240 = 560,
    // capped at the static maximum.
    expect(clampTabsWidth(5000, 800)).toBe(Math.min(MAX_TABS_WIDTH, 800 - MIN_DOCUMENT_WIDTH));
    expect(clampTabsWidth(5000, 500)).toBe(500 - MIN_DOCUMENT_WIDTH);
  });

  it("keeps the handle grabbable even on an absurdly narrow window", () => {
    expect(maxTabsWidthFor(100)).toBe(MIN_TABS_WIDTH);
    expect(clampTabsWidth(300, 100)).toBe(MIN_TABS_WIDTH);
  });
});

describe("sideTabsWidth", () => {
  it("is the panel width with tabs on the side, and nothing with tabs on top", () => {
    expect(sideTabsWidth({ tabsPosition: "side", tabsWidth: 250 })).toBe(250);
    expect(sideTabsWidth({ tabsPosition: "top", tabsWidth: 250 })).toBe(0);
  });
});

describe("tabFolderLabel", () => {
  // English, rather than the OS language of the machine running the tests.
  beforeEach(() => setLocale("en"));
  const label = (filePath: string) => tabFolderLabel(filePath, translate);

  it("shows the folder under the home directory as ~ on every platform", () => {
    expect(label("/Users/ada/notes/todo.md")).toBe("~/notes");
    expect(label("/home/ada/notes/todo.md")).toBe("~/notes");
    expect(label("C:\\Users\\ada\\notes\\todo.md")).toBe("~/notes");
  });

  it("shows a file directly in the home directory as ~", () => {
    expect(label("/Users/ada/todo.md")).toBe("~");
    expect(label("C:\\Users\\ada\\todo.md")).toBe("~");
  });

  it("keeps only the last two folders of a deep path", () => {
    expect(label("/Users/ada/dev/mdhero/docs/README.md")).toBe("…/mdhero/docs");
    expect(label("D:\\work\\client\\specs\\api\\README.md")).toBe("…/specs/api");
  });

  it("keeps a short path outside the home directory whole", () => {
    expect(label("/tmp/x.md")).toBe("/tmp");
    expect(label("D:\\notes\\x.md")).toBe("D:/notes");
    expect(label("/x.md")).toBe("/");
  });

  it("drops Windows' verbatim prefix", () => {
    expect(label("\\\\?\\C:\\Users\\ada\\notes\\todo.md")).toBe("~/notes");
  });

  it("names the tabs that have no file", () => {
    expect(label("paste://1716000000000")).toBe("Pasted");
    expect(label("new://1716000000000")).toBe("Not saved yet");
    expect(label("url://https://github.com/a/b/blob/main/README.md")).toBe("github.com");
    expect(label("url://not a url")).toBe("Web page");
  });

  it("names them in the interface language", () => {
    setLocale("fr");
    expect(label("paste://1716000000000")).toBe("Collé");
    expect(label("new://1716000000000")).toBe("Pas encore enregistré");
    expect(label("url://not a url")).toBe("Page web");
    expect(label("/tmp/x.md")).toBe("/tmp");
  });
});

describe("tabsNeedingFolder", () => {
  const tab = (id: string, fileName: string, filePath: string) => ({ id, fileName, filePath });

  it("shows the name alone when every name is different", () => {
    const tabs = [
      tab("a", "todo.md", "/Users/ada/notes/todo.md"),
      tab("b", "README.md", "/Users/ada/dev/mdhero/README.md"),
      tab("c", "Untitled", "new://1716000000000-0"),
    ];
    expect(tabsNeedingFolder(tabs)).toEqual(new Set());
  });

  it("adds the folder to same-named files, and only to them", () => {
    const tabs = [
      tab("a", "README.md", "/Users/ada/dev/mdhero/README.md"),
      tab("b", "todo.md", "/Users/ada/notes/todo.md"),
      tab("c", "README.md", "C:\\Users\\ada\\dev\\other\\README.md"),
    ];
    expect(tabsNeedingFolder(tabs)).toEqual(new Set(["a", "c"]));
  });

  it("tells a local file from a web page of the same name", () => {
    const tabs = [
      tab("a", "README.md", "/Users/ada/dev/mdhero/README.md"),
      tab("b", "README.md", "url://https://github.com/a/b/blob/main/README.md"),
    ];
    expect(tabsNeedingFolder(tabs)).toEqual(new Set(["a", "b"]));
  });

  it("leaves it out when the folder would not tell them apart", () => {
    const tabs = [
      tab("a", "Untitled", "new://1716000000000-0"),
      tab("b", "Untitled", "new://1716000000000-1"),
    ];
    expect(tabsNeedingFolder(tabs)).toEqual(new Set());
  });
});

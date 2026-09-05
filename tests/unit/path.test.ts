import { describe, expect, it } from "vitest";
import { basename, shortenHomePath, stripVerbatimPrefix } from "../../src/lib/utils/path";

// Windows paths are written with escaped backslashes throughout: "C:\\Users" is
// the four-character path C:\Users.

describe("basename", () => {
  it("takes the last segment of a POSIX path", () => {
    expect(basename("/Users/hugo/notes/readme.md")).toBe("readme.md");
    expect(basename("/tmp/a.md")).toBe("a.md");
  });

  // The bug this module exists for: `split("/").pop()` returned the whole
  // string here, so tab and window titles showed a full Windows path.
  it("takes the last segment of a Windows path", () => {
    expect(basename("C:\\Users\\hugo\\notes\\readme.md")).toBe("readme.md");
    expect(basename("\\\\server\\share\\doc.md")).toBe("doc.md");
  });

  it("handles trailing separators and separator-free input", () => {
    expect(basename("/Users/hugo/notes/")).toBe("notes");
    expect(basename("C:\\Users\\hugo\\")).toBe("hugo");
    expect(basename("readme.md")).toBe("readme.md");
  });
});

describe("stripVerbatimPrefix", () => {
  it("removes the verbatim prefix canonicalize() returns", () => {
    expect(stripVerbatimPrefix("\\\\?\\C:\\Users\\hugo\\a.md")).toBe("C:\\Users\\hugo\\a.md");
  });

  it("restores a UNC path to its familiar form", () => {
    expect(stripVerbatimPrefix("\\\\?\\UNC\\server\\share\\a.md")).toBe(
      "\\\\server\\share\\a.md"
    );
  });

  it("leaves ordinary paths alone", () => {
    expect(stripVerbatimPrefix("/Users/hugo/a.md")).toBe("/Users/hugo/a.md");
    expect(stripVerbatimPrefix("C:\\Users\\hugo\\a.md")).toBe("C:\\Users\\hugo\\a.md");
  });
});

describe("shortenHomePath", () => {
  it("collapses the home directory on every platform", () => {
    expect(shortenHomePath("/Users/hugo/notes/a.md")).toBe("~/notes/a.md");
    expect(shortenHomePath("/home/hugo/notes/a.md")).toBe("~/notes/a.md");
    expect(shortenHomePath("C:\\Users\\hugo\\notes\\a.md")).toBe("~/notes/a.md");
  });

  it("strips a verbatim prefix before matching", () => {
    expect(shortenHomePath("\\\\?\\C:\\Users\\hugo\\notes\\a.md")).toBe("~/notes/a.md");
  });

  it("leaves paths outside a home directory unchanged", () => {
    expect(shortenHomePath("/tmp/a.md")).toBe("/tmp/a.md");
    expect(shortenHomePath("D:\\repos\\a.md")).toBe("D:\\repos\\a.md");
  });
});

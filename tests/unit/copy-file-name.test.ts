import { afterEach, describe, expect, it, vi } from "vitest";
import { copyFileName } from "../../src/lib/utils/clipboard";

// Windows paths are written with escaped backslashes: "C:\\Users" is C:\Users.

function stubClipboard(writeText: (text: string) => Promise<void>) {
  vi.stubGlobal("navigator", { clipboard: { writeText } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyFileName", () => {
  it("copies only the file name of a POSIX path", async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard(writeText);
    expect(await copyFileName("/Users/hugo/notes/readme.md")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("readme.md");
  });

  it("copies only the file name of a Windows path", async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard(writeText);
    expect(await copyFileName("C:\\Users\\hugo\\notes\\readme.md")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("readme.md");
  });

  // Tabs opened from disk carry the canonical path, which on Windows keeps
  // the verbatim prefix.
  it("copies only the file name of a verbatim Windows path", async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard(writeText);
    expect(await copyFileName("\\\\?\\C:\\Users\\hugo\\my notes.md")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("my notes.md");
  });

  it("reports a clipboard failure instead of throwing", async () => {
    stubClipboard(async () => {
      throw new Error("denied");
    });
    expect(await copyFileName("/tmp/a.md")).toBe(false);
  });
});

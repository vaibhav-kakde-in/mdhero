import { describe, expect, it } from "vitest";
import { changedRange } from "../../src/lib/utils/line-patch";

/** Applies a changedRange result the way patchLines does, on plain arrays. */
function apply(prev: string[], next: string[]): string[] {
  const { start, prevEnd, nextEnd } = changedRange(prev, next);
  return [...prev.slice(0, start), ...next.slice(start, nextEnd), ...prev.slice(prevEnd)];
}

describe("changedRange", () => {
  it("is empty for identical lists", () => {
    expect(changedRange(["a", "b"], ["a", "b"])).toEqual({ start: 2, prevEnd: 2, nextEnd: 2 });
  });

  it("isolates a line edited in place", () => {
    expect(changedRange(["a", "b", "c"], ["a", "B", "c"])).toEqual({ start: 1, prevEnd: 2, nextEnd: 2 });
  });

  it("isolates an inserted line", () => {
    expect(changedRange(["a", "c"], ["a", "b", "c"])).toEqual({ start: 1, prevEnd: 1, nextEnd: 2 });
  });

  it("isolates a removed line", () => {
    expect(changedRange(["a", "b", "c"], ["a", "c"])).toEqual({ start: 1, prevEnd: 2, nextEnd: 1 });
  });

  it("covers everything when starting from nothing", () => {
    expect(changedRange([], ["a", "b"])).toEqual({ start: 0, prevEnd: 0, nextEnd: 2 });
  });

  it("does not let the common end overlap the common start with repeated lines", () => {
    expect(changedRange(["a", "a"], ["a", "a", "a"])).toEqual({ start: 2, prevEnd: 2, nextEnd: 3 });
    expect(changedRange(["a", "a", "a"], ["a"])).toEqual({ start: 1, prevEnd: 3, nextEnd: 1 });
  });

  it("always rebuilds the new list", () => {
    const cases: [string[], string[]][] = [
      [["x", "y", "z"], ["x", "q", "r", "z"]],
      [["a", "b", "a"], ["a"]],
      [["a"], ["b", "a", "b"]],
      [["", "", ""], ["", "x", "", ""]],
      [["a", "b"], []],
    ];
    for (const [prev, next] of cases) expect(apply(prev, next)).toEqual(next);
  });
});

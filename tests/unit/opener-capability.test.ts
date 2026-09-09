import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Capability = {
  permissions: Array<{
    identifier?: string;
    allow?: Array<{ path: string }>;
  }>;
};

const capability = JSON.parse(
  readFileSync(resolve(process.cwd(), "src-tauri/capabilities/default.json"), "utf8")
) as Capability;

describe("opener capability", () => {
  it("allows only non-executable document and image extensions", () => {
    const permission = capability.permissions.find(
      (entry) => entry.identifier === "opener:allow-open-path"
    );
    const paths = permission?.allow?.map((entry) => entry.path) ?? [];

    expect(paths).toHaveLength(9);
    expect(paths).not.toContain("**");
    expect(paths.every((path) => /^\*\*\/\*\.(pdf|png|jpe?g|gif|webp|bmp|tiff?)$/.test(path))).toBe(true);
  });
});

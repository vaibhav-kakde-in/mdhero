import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * #security-adjacent guard: DOMPurify must stay on 3.3.x.
 *
 * This is a test rather than a doc line because the reason lives in CLAUDE.md,
 * which is gitignored — a contributor retrying the bump cannot read it. They
 * can read a failing test.
 *
 * DOMPurify 3.4 strips HTML inside <foreignObject>, correctly, since that is an
 * injection vector. Mermaid puts labels there. `htmlLabels: false` fixes the
 * renderers that have that option (flowchart, class) and does nothing for the
 * ones that do not: `journey` has no `htmlLabels` option at all and renders
 * completely empty on 3.4.15.
 *
 * Its text writer comes from a different switch —
 *   conf.textPlacement === "fo" ? byFo : conf.textPlacement === "old" ? byText : byTspan
 * — and Mermaid's default config sets "fo". Moving off "fo" is a real lever but
 * only a partial fix, measured on 3.4.15 + mermaid 11.17.2:
 *
 *   default ("fo")  task labels gone,    section label gone
 *   "tspan"         task labels RENDER,  section label still gone
 *   "old"           task labels RENDER,  section label still gone
 *
 * So the pin holds until the section-label gap is solved. `timeline`,
 * `c4Diagram` and `sequenceDiagram` read the same switch and are the next
 * candidates to check.
 *
 * Nothing urgent is being held back: every critical and high Dependabot alert
 * is in a dev or build dependency. DOMPurify's own open alerts are low/medium
 * and mostly inapplicable here — no IN_PLACE, no SAFE_FOR_TEMPLATES, no hooks,
 * no function-based ADD_TAGS.
 *
 * If you are here because this test failed: re-render all 20 Mermaid types in
 * the built app and check the labels. The suite cannot see them.
 */
const pkg = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8")
) as {
  dependencies: Record<string, string>;
};
const workspace = readFileSync(resolve(process.cwd(), "pnpm-workspace.yaml"), "utf8");

describe("the DOMPurify pin", () => {
  it("keeps the app's own range inside 3.3.x", () => {
    expect(pkg.dependencies.dompurify).toBe("~3.3.3");
  });

  it("holds Mermaid's transitive copy at the same version", () => {
    // Without the override, Mermaid resolves its own ^3.3.3 up to 3.4.x and the
    // app ends up sanitizing with one version while Mermaid uses another.
    // pnpm 11+ no longer reads the `pnpm` field in package.json.
    expect(workspace).toMatch(/^overrides:\n(?:[ \t]+.*\n)*?[ \t]+dompurify: ['"]?~3\.3\.3['"]?$/m);
  });

  it("resolves to a 3.3.x install, not just a 3.3.x spec", () => {
    const installed = JSON.parse(
      readFileSync(resolve(process.cwd(), "node_modules/dompurify/package.json"), "utf8")
    ) as { version: string };
    const [major, minor] = installed.version.split(".").map(Number);
    expect(
      major === 3 && minor === 3,
      `dompurify ${installed.version} is installed. See the comment at the top of ` +
        "this file: 3.4+ renders Mermaid journey diagrams empty.",
    ).toBe(true);
  });

  it("has no 3.4 anywhere in the lockfile", () => {
    const lock = readFileSync(resolve(process.cwd(), "pnpm-lock.yaml"), "utf8");
    expect(lock).not.toMatch(/dompurify@3\.4/);
  });
});

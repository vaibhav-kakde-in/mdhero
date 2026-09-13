import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { escapeForInlineScript, stripGlobal } from "../../scripts/build-quicklook.mjs";

/**
 * Guards for the macOS Quick Look extension (#88), which renders untrusted
 * markdown in a second host and is easy to break invisibly.
 *
 * Two classes of regression are covered:
 *
 *   1. Inlining hazards. The renderer is embedded in a classic inline <script>.
 *      `<!--` and `</script` inside the minified bundle both terminate or
 *      comment out the script, and the failure is silent and spectacular — the
 *      bundle stops parsing mid-file and its source spills onto the page as
 *      text. Neither `node --check` nor a browser console reveals it.
 *
 *   2. Path drift. The whole design depends on the extension reusing the app's
 *      renderer rather than growing its own. A re-inlined sanitizer allowlist or
 *      a private markdown-it would break the security invariants quietly, which
 *      is exactly how the original Mermaid bypass happened.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(resolve(here, "../../", p), "utf8");

describe("escapeForInlineScript", () => {
  it("neutralises sequences that terminate an inline script", () => {
    const out = escapeForInlineScript('var a = "<!-->"; var b = "</script>";');
    expect(out).not.toMatch(/<!--/);
    expect(out).not.toMatch(/<\/script/i);
  });

  it("escapes a closing tag whatever its case", () => {
    expect(escapeForInlineScript("'</SCRIPT>'")).not.toMatch(/<\/script/i);
  });

  it("produces an escape that is legal inside a unicode-mode regex literal", () => {
    // The reason the escape is \x3C and not a backslash before `!`: `\!` is an
    // identity escape that a `u`-flagged regex rejects outright.
    const escaped = escapeForInlineScript("/<!--x/u");
    expect(() => new Function(`return ${escaped};`)()).not.toThrow();
  });

  it("leaves ordinary source untouched", () => {
    const src = "const x = a < b && c > d;";
    expect(escapeForInlineScript(src)).toBe(src);
  });

  it("still evaluates to the same string value after escaping", () => {
    const evaluate = (src: string) => new Function(`return ${src};`)();
    expect(evaluate(escapeForInlineScript('"<!--"'))).toBe("<!--");
    expect(evaluate(escapeForInlineScript('"</script>"'))).toBe("</script>");
  });
});

describe("stripGlobal", () => {
  it("unwraps Svelte's :global() scoping hints", () => {
    expect(stripGlobal(":global(html.dark) .md-content { color: red; }"))
      .toBe("html.dark .md-content { color: red; }");
  });

  it("handles nested parentheses", () => {
    // `:global(:not(pre) > code)` is real, and a naive match to the first `)`
    // truncates it into a broken selector.
    expect(stripGlobal("article :global(:not(pre) > code)::before"))
      .toBe("article :not(pre) > code::before");
  });

  it("leaves plain CSS alone", () => {
    const css = ".md-content { color: #1c1c1e; }";
    expect(stripGlobal(css)).toBe(css);
  });
});

describe("the Quick Look path reuses the app's renderer", () => {
  const preview = read("src/quicklook/preview.ts");
  const component = read("src/lib/components/MarkdownRenderer.svelte");

  it("renders through pipeline.ts rather than its own markdown parser", () => {
    expect(preview).toMatch(/from "\.\.\/lib\/renderer\/pipeline"/);
    expect(preview).not.toMatch(/from "markdown-it"/);
  });

  it("keeps one shared Mermaid sanitizer allowlist, imported by both paths", () => {
    for (const [name, src] of [["preview.ts", preview], ["MarkdownRenderer", component]]) {
      expect(src, `${name} should import the shared allowlist`)
        .toMatch(/MERMAID_SANITIZE_CONFIG/);
      // A re-inlined copy would show up as the allowlist's own contents.
      expect(src, `${name} should not inline its own allowlist`)
        .not.toMatch(/requiredFeatures/);
    }
  });

  it("keeps Mermaid in strict mode on both paths", () => {
    expect(preview).toMatch(/securityLevel:\s*"strict"/);
    expect(component).toMatch(/securityLevel:\s*"strict"/);
  });
});

describe("the generated page's security policy", () => {
  const script = read("scripts/build-quicklook.mjs");

  /**
   * Read the directives out of the `const csp = [...]` literal rather than
   * grepping the file, so the prose explaining each choice cannot satisfy or
   * break an assertion about the policy itself.
   */
  const directives: string[] = (() => {
    const body = script.slice(script.indexOf("const csp = ["), script.indexOf("].join("));
    return [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  })();
  const directive = (name: string) =>
    directives.find((d) => d.split(" ")[0] === name);

  it("was parsed out of the build script", () => {
    expect(directives.length).toBeGreaterThan(5);
    expect(directive("default-src")).toBe("default-src 'none'");
  });

  it("uses a nonce rather than 'unsafe-inline' for scripts", () => {
    const scriptSrc = directive("script-src");
    expect(scriptSrc).toContain("'nonce-__CSP_NONCE__'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("blocks network egress from the preview", () => {
    expect(directive("connect-src")).toBe("connect-src 'none'");
    // Remote images are a working exfil channel out of an extension that must
    // hold the network-client entitlement. Deliberately not allowed, unlike the
    // app itself; see CLAUDE.md invariant 1b.
    expect(directive("img-src")).not.toContain("https:");
  });

  it("substitutes at unique tokens, never at </head> or </body>", () => {
    expect(script).toMatch(/__MDHERO_PRELUDE__/);
    expect(script).toMatch(/__MDHERO_BOOT__/);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { get } from "svelte/store";

// The unit env is node (no DOM), so DOMPurify can't run; stub it as a
// passthrough (it only sanitizes — the src rewriting under test happens after
// it). convertFileSrc needs a Tauri webview, so stub it the way the real
// asset protocol shapes URLs.
vi.mock("dompurify", () => ({ default: { sanitize: (html: string) => html } }));
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://localhost/${path}`,
}));

const { renderFull, toFileUrl, assetUrlToFileUrl, rewriteCopiedHtml } = await import(
  "../../src/lib/renderer/pipeline"
);
const { settings } = await import("../../src/lib/stores/settings");

function setAbsoluteImagePaths(on: boolean) {
  settings.update((s) => ({ ...s, absoluteImagePaths: on }));
}

beforeEach(() => {
  setAbsoluteImagePaths(false);
});

describe("in-app rendering", () => {
  it("defaults to off (asset protocol, the pre-existing behavior)", () => {
    expect(get(settings).absoluteImagePaths).toBe(false);
    const { html } = renderFull("![a](images/x.jpg)", "D:\\docs");
    expect(html).toContain('src="asset://localhost/');
    expect(html).not.toContain("file:///");
  });

  it("keeps the asset protocol even when the setting is on (WebView2 blocks file://)", () => {
    // The setting governs clipboard output only — a WebView cannot load
    // file:// subresources from the app's origin, so in-app display must not
    // depend on it.
    setAbsoluteImagePaths(true);
    const { html } = renderFull("![a](images/x.jpg)", "D:\\docs");
    expect(html).toContain('src="asset://localhost/');
    expect(html).not.toContain("file:///");
  });

  it("keeps collecting the absolute disk path in assetPaths either way", () => {
    setAbsoluteImagePaths(true);
    const { assetPaths } = renderFull("![a](images/x.jpg)", "D:\\docs");
    expect(assetPaths).toContain("D:\\docs\\images\\x.jpg");
  });

  it("decodes percent-escapes before building the asset URL", () => {
    const { html } = renderFull("![a](images/a%20b.jpg)", "D:\\docs");
    expect(html).toContain("asset://localhost/D:\\docs\\images\\a b.jpg");
  });

  it("passes an already-absolute Windows path through to the asset URL", () => {
    const { html } = renderFull("![a](D:\\pics\\p.jpg)", "D:\\docs");
    expect(html).toContain("asset://localhost/D:\\pics\\p.jpg");
  });

  it("leaves external http(s), data: and asset: URLs untouched", () => {
    const { html } = renderFull(
      "![a](https://example.com/x.jpg) ![b](data:image/png;base64,AAAA) ![c](asset://localhost/z)",
      "D:\\docs"
    );
    expect(html).toContain('src="https://example.com/x.jpg"');
    expect(html).toContain("src=\"data:image/png;base64,AAAA\"");
    expect(html).toContain('src="asset://localhost/z"');
  });
});

describe("toFileUrl", () => {
  it("converts a Windows path", () => {
    expect(toFileUrl("D:\\a\\b.jpg")).toBe("file:///D:/a/b.jpg");
  });

  it("keeps POSIX paths absolute", () => {
    expect(toFileUrl("/home/u/f.jpg")).toBe("file:///home/u/f.jpg");
  });

  it("converts a UNC path", () => {
    expect(toFileUrl("\\\\server\\share\\f.jpg")).toBe("file://server/share/f.jpg");
  });
});

describe("assetUrlToFileUrl", () => {
  it("reverses an http://asset.localhost URL produced by convertFileSrc on Windows", () => {
    const asset = `http://asset.localhost/${encodeURIComponent("D:\\docs\\images\\x.jpg")}`;
    expect(assetUrlToFileUrl(asset)).toBe("file:///D:/docs/images/x.jpg");
  });

  it("reverses an https://asset.localhost URL (useHttpsScheme)", () => {
    const asset = `https://asset.localhost/${encodeURIComponent("/home/u/f.jpg")}`;
    expect(assetUrlToFileUrl(asset)).toBe("file:///home/u/f.jpg");
  });

  it("reverses an asset://localhost URL (macOS/Linux shape)", () => {
    const asset = `asset://localhost/${encodeURIComponent("/home/u/f.jpg")}`;
    expect(assetUrlToFileUrl(asset)).toBe("file:///home/u/f.jpg");
  });

  it("decodes percent-escaped characters", () => {
    const asset = `http://asset.localhost/${encodeURIComponent("D:\\docs\\图 片\\a b.jpg")}`;
    expect(assetUrlToFileUrl(asset)).toBe("file:///D:/docs/图 片/a b.jpg");
  });

  it("returns null for URLs that are not asset-protocol", () => {
    expect(assetUrlToFileUrl("https://example.com/x.jpg")).toBeNull();
    expect(assetUrlToFileUrl("file:///D:/x.jpg")).toBeNull();
    expect(assetUrlToFileUrl("data:image/png;base64,AAAA")).toBeNull();
    expect(assetUrlToFileUrl("images/x.jpg")).toBeNull();
  });

  it("returns null for malformed escapes instead of throwing", () => {
    expect(assetUrlToFileUrl("http://asset.localhost/D%3A%")).toBeNull();
  });
});

describe("rewriteCopiedHtml", () => {
  const asset = (p: string) => `http://asset.localhost/${encodeURIComponent(p)}`;

  it("rewrites img src to a file:/// URL", () => {
    const html = `<p><img src="${asset("D:\\docs\\images\\x.jpg")}" alt="x"></p>`;
    expect(rewriteCopiedHtml(html)).toBe(
      '<p><img src="file:///D:/docs/images/x.jpg" alt="x"></p>'
    );
  });

  it("rewrites srcset candidates and keeps descriptors", () => {
    const html =
      `<img srcset="${asset("D:\\docs\\a.jpg")} 1x, ${asset("D:\\docs\\b.jpg")} 2x">`;
    expect(rewriteCopiedHtml(html)).toBe(
      '<img srcset="file:///D:/docs/a.jpg 1x, file:///D:/docs/b.jpg 2x">'
    );
  });

  it("leaves external images untouched", () => {
    const html = `<img src="https://example.com/x.jpg"><img src="data:image/png;base64,AAAA">`;
    expect(rewriteCopiedHtml(html)).toBe(html);
  });

  it("mixes rewritten and untouched images in one selection", () => {
    const html =
      `<p><img src="${asset("D:\\docs\\x.jpg")}"><img src="https://example.com/y.jpg"></p>`;
    expect(rewriteCopiedHtml(html)).toBe(
      '<p><img src="file:///D:/docs/x.jpg"><img src="https://example.com/y.jpg"></p>'
    );
  });
});

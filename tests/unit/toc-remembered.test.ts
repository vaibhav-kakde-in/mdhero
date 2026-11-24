import { afterEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";

// One fake localStorage shared by the "launches" of a test, so what the first
// launch saves is what the next one reads.
function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  });
}

/** A fresh app launch: modules reloaded, so the stores start from storage. */
async function launch() {
  vi.resetModules();
  return import("../../src/lib/stores/toc");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// #178: the sidebar had to be reopened by hand on every launch, because
// `tocVisible` started at false and was never saved.
describe("the table-of-contents button across launches (#178)", () => {
  it("starts closed on a first launch", async () => {
    fakeStorage();
    expect(get((await launch()).tocVisible)).toBe(false);
  });

  it("comes back open after it was left open", async () => {
    fakeStorage();
    (await launch()).toggleToc();
    expect(get((await launch()).tocVisible)).toBe(true);
  });

  it("comes back closed after it was opened then closed", async () => {
    fakeStorage();
    const first = await launch();
    first.toggleToc();
    first.toggleToc();
    expect(get((await launch()).tocVisible)).toBe(false);
  });

  it("keeps the choice when the sidebar is only hidden, not toggled", async () => {
    // The home tab, a document without headings and edit mode hide the sidebar
    // by emptying the entries; none of them may forget that it was left open.
    fakeStorage();
    const first = await launch();
    first.toggleToc();
    first.tocEntries.set([]);
    expect(get(first.tocVisible)).toBe(true);
    expect(get((await launch()).tocVisible)).toBe(true);
  });

  it("does not disturb the other saved settings", async () => {
    fakeStorage({ "mdhero-settings": JSON.stringify({ fontSize: 21, tocWidth: 300 }) });
    (await launch()).toggleToc();
    const { settings } = await import("../../src/lib/stores/settings");
    expect(get(settings)).toMatchObject({ fontSize: 21, tocWidth: 300, tocOpen: true });
  });
});

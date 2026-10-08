// Geometry shared by the fixed-position parts of the window.
//
// The toolbar always runs across the top. The tabs are either a row under it
// or a resizable panel on the left. +page.svelte publishes the result as two
// CSS variables that the fixed elements position themselves from:
// `--chrome-top`, the height of everything above the document, and `--tabs-w`,
// the width of the side tabs panel (0 when the tabs are on top).

import type { ReaderSettings } from "$lib/stores/settings";

/** Height of the chrome when the tabs are on the side: the toolbar alone, as
 *  it renders since the View/Split/Edit switcher (#19). The side tabs panel
 *  starts right under it. */
export const SIDE_TABS_CHROME = 44;
/** Height of the chrome when the tabs are a row under the toolbar: the
 *  toolbar, then the 44px tab row, which sticks right under it. */
export const TOP_TABS_CHROME = 88;

/** Width of the side tabs panel for these settings, 0 when tabs are on top. */
export function sideTabsWidth(s: Pick<ReaderSettings, "tabsPosition" | "tabsWidth">): number {
  return s.tabsPosition === "side" ? s.tabsWidth : 0;
}

/** Height of the chrome above the document, as currently published. */
export function chromeTop(): number {
  const value = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--chrome-top"),
  );
  return Number.isFinite(value) ? value : TOP_TABS_CHROME;
}

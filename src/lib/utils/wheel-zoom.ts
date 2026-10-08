// Ctrl + mouse wheel steps the text size, like Ctrl+= / Ctrl+-.
//
// A mouse wheel notch arrives as one large delta (100px or more in WebView2,
// depending on display scaling), while a touchpad pinch — which Chromium also
// reports as Ctrl + wheel — arrives as a stream of small ones. Accumulating up
// to a threshold and dropping the remainder after each step gives exactly one
// step per notch at any scaling, and a controllable rate for a pinch.

const PIXELS_PER_STEP = 40;
// WheelEvent.DOM_DELTA_LINE / DOM_DELTA_PAGE, spelled out so this runs without
// a DOM in the unit tests.
const DELTA_LINE = 1;
const DELTA_PAGE = 2;
const PIXELS_PER_LINE = 40;
const PIXELS_PER_PAGE = 800;

export interface WheelDelta {
  deltaY: number;
  deltaMode: number;
}

/** Returns a function that turns each wheel event into the text-size change it
 *  triggers: +1 (wheel up, zoom in), -1 (wheel down, zoom out) or 0. */
export function createWheelZoom(): (e: WheelDelta) => number {
  let pending = 0;

  return ({ deltaY, deltaMode }) => {
    const pixels =
      deltaMode === DELTA_LINE
        ? deltaY * PIXELS_PER_LINE
        : deltaMode === DELTA_PAGE
          ? deltaY * PIXELS_PER_PAGE
          : deltaY;
    if (pixels === 0) return 0;

    if (Math.sign(pixels) !== Math.sign(pending)) pending = 0;
    pending += pixels;
    if (Math.abs(pending) < PIXELS_PER_STEP) return 0;

    const step = pending < 0 ? 1 : -1;
    pending = 0;
    return step;
  };
}

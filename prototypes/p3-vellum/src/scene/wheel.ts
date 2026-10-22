// Mouse wheel or trackpad? Read once from the first event of a wheel stream. A mouse wheel zooms; a trackpad
// two-finger scroll orbits. When the signals disagree, a vertical-only scroll counts as a mouse, so a wheel
// never tilts the view; a trackpad still proves itself by any sideways movement.
export interface WheelSample {
  dx: number;
  dy: number;
  /** WheelEvent.deltaMode */
  mode: number;
  /** legacy wheelDeltaY, where the browser has it */
  wdy?: number;
}

export function wheelSource(w: WheelSample): 'mouse' | 'trackpad' {
  if (w.mode !== 0) return 'mouse'; // line or page steps: only wheels do that
  if (w.dx !== 0) return 'trackpad';
  const ady = Math.abs(w.dy);
  if (ady === 0) return 'trackpad';
  // whole notches of 120 (Chrome, Safari and Edge for a wheel)
  if (w.wdy && Math.abs(w.wdy) >= 120 && Math.abs(w.wdy) % 120 === 0) return 'mouse';
  // macOS wheel notches arrive as 4.000244…, 8.000488…: a whole number plus a sliver
  const frac = ady - Math.floor(ady);
  if (ady >= 1 && frac > 0 && frac < 0.01) return 'mouse';
  // big whole steps (Windows-style 100, Firefox 48…)
  if (Number.isInteger(ady) && ady >= 40) return 'mouse';
  // trackpads: wheelDeltaY = −3·deltaY in Chrome and Safari
  if (w.wdy !== undefined && w.wdy !== 0 && Math.abs(Math.abs(w.wdy) - ady * 3) < 1e-6) return 'trackpad';
  return 'mouse';
}

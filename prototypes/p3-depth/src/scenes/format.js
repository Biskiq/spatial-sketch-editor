// Numbers in one place: the card's rounding, and the clamp that keeps a dragged
// handle inside the range its author allows.
export const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d);
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

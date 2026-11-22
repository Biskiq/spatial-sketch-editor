/*
 * Thumbnail distinctness measures, following the E7 method
 * (docs/roadmap/t2-look-atmosphere/s8-professional-material-foundation/evidence/s8-e7-distinctness.json):
 *   colour  — per-patch mean in linear sRGB, CIEDE2000, then the mean over patches (8×8 grid);
 *   luma    — SSIM on Rec.601 luma, uniform 8 px windows, stride 4, K1 0.01, K2 0.03, L 255;
 *   clipping — any channel at 255 inside the measured region.
 * A pair FAILS when meanPatchΔE00 < 3 AND SSIM > 0.95 (F's criterion).
 * `region` is [x0, x1] as fractions of the square image; E7's central crop is 54..137 of 192.
 */

export const E7_CENTRAL = [54 / 192, 138 / 192];

const toLin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const LIN = new Float32Array(256).map((_, i) => toLin(i));

function linToLab([r, g, b]) {
  // linear sRGB (D65) → XYZ → CIELAB
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function ciede2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (b, a) => { if (b === 0 && a === 0) return 0; const v = Math.atan2(b, a) * deg; return v < 0 ? v + 360 : v; };
  const h1p = h(b1, a1p), h2p = h(b2, a2p);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) { hbp = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2 : (h1p + h2p) / 2; }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

const span = (n, region) => [Math.round(n * region[0]), Math.round(n * region[1])];

/** Per-patch mean Lab over an grid×grid patch grid inside the region. */
export function patchLabs(px, n, region = E7_CENTRAL, grid = 8) {
  const [a, b] = span(n, region), size = b - a, out = [];
  for (let gy = 0; gy < grid; gy++) for (let gx = 0; gx < grid; gx++) {
    const x0 = a + Math.floor((gx * size) / grid), x1 = a + Math.floor(((gx + 1) * size) / grid);
    const y0 = a + Math.floor((gy * size) / grid), y1 = a + Math.floor(((gy + 1) * size) / grid);
    let r = 0, g = 0, bl = 0, k = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * n + x) * 4; r += LIN[px[i]]; g += LIN[px[i + 1]]; bl += LIN[px[i + 2]]; k++;
    }
    out.push(linToLab([r / k, g / k, bl / k]));
  }
  return out;
}

export function lumaPlane(px, n) {
  const out = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) out[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  return out;
}

export function ssim(la, lb, n, region = E7_CENTRAL, win = 8, stride = 4) {
  const [a, b] = span(n, region);
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2, N = win * win;
  let sum = 0, count = 0;
  for (let y = a; y + win <= b; y += stride) for (let x = a; x + win <= b; x += stride) {
    let ma = 0, mb = 0;
    for (let j = 0; j < win; j++) for (let i = 0; i < win; i++) { const k = (y + j) * n + x + i; ma += la[k]; mb += lb[k]; }
    ma /= N; mb /= N;
    let va = 0, vb = 0, cov = 0;
    for (let j = 0; j < win; j++) for (let i = 0; i < win; i++) {
      const k = (y + j) * n + x + i, da = la[k] - ma, db = lb[k] - mb;
      va += da * da; vb += db * db; cov += da * db;
    }
    va /= N - 1; vb /= N - 1; cov /= N - 1;
    sum += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
    count++;
  }
  return { value: sum / count, windows: count };
}

export function clippedFraction(px, n, region) {
  const [a, b] = span(n, region); let c = 0, k = 0;
  for (let y = a; y < b; y++) for (let x = a; x < b; x++) {
    const i = (y * n + x) * 4; if (px[i] === 255 || px[i + 1] === 255 || px[i + 2] === 255) c++; k++;
  }
  return c / k;
}

export function centreLuma(px, n) {
  const [a, b] = span(n, [0.4, 0.6]); let s = 0, k = 0;
  for (let y = a; y < b; y++) for (let x = a; x < b; x++) {
    const i = (y * n + x) * 4; s += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; k++;
  }
  return s / k;
}

/** Prepared per-image data so the 210-pair sweep stays fast. */
export function prepare(px, n, region) {
  return { n, region, labs: patchLabs(px, n, region), luma: lumaPlane(px, n), clipped: clippedFraction(px, n, region), centre: centreLuma(px, n) };
}

export function comparePrepared(A, B) {
  const d = A.labs.map((l, i) => ciede2000(l, B.labs[i]));
  const mean = d.reduce((s, v) => s + v, 0) / d.length;
  const s = ssim(A.luma, B.luma, A.n, A.region);
  return { meanPatchDeltaE00: mean, maxPatchDeltaE00: Math.max(...d), luminanceSSIM: s.value, windows: s.windows, fails: mean < 3 && s.value > 0.95 };
}

/** Pixels of an image element resampled to n×n through a 2D canvas (top row first). */
export function imagePixels(img, n) {
  const c = document.createElement('canvas'); c.width = c.height = n;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, n, n);
  return ctx.getImageData(0, 0, n, n).data;
}

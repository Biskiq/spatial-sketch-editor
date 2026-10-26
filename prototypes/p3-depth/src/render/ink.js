// The painter: canvas 2D, painter's algorithm, semantic lines. Faces and line
// strokes share one depth-sorted list so ink is hidden by the faces in front of
// it. Everything about where a point lands on the sheet comes from ./camera.js,
// so this module is only about pixels.

import { NEAR, clipPoly, clipSeg, cross3, dot3, norm3, projectCam, sub3, toCam } from './camera.js';

export const PALETTE = {
  paper: '#f3eee3',
  paperDeep: '#e7dfcf',
  ink: '#241f19',
  inkSoft: '#4a4338',
  quiet: '#7c7364',
  pencil: '#948b7b',
  blue: '#2a5c98',
  red: '#a63a2a',
  roof: ['#d8c3a3', '#d2ba95', '#cdb28b', '#d9c8a9'],
  roofFeature: '#c7a87e',
  roofDark: '#b3936c',
  wall: '#e8e0d0',
  wallShade: '#d9cfbc',
  fascia: '#8a755c',
  gable: '#e3d8c4',
  cheek: '#dccfb8',
  wood: '#a9763f',
  woodDark: '#7c5227',
  tread: '#c99a63',
  riser: '#b28551',
  platform: '#c99a63',
  stringer: '#8a6236',
  post: '#8a6a45',
  ribbon: 'rgba(78, 100, 112, 0.14)',
  glass: 'rgba(120, 156, 172, 0.30)',
  ground: '#efe8da',
};

const LIGHT = norm3([-0.45, 0.86, 0.38]);

// The painter knows only the paint order, never what a face is for. A scene
// assigns each face a layer: 0 sits under the surface (walls), 1 is the surface
// itself, 2 is a feature volume that stands over its host.
export const LAYERS = { under: 0, surface: 1, feature: 2 };

// ------------------------------------------------------------------ draw

// Two passes, deliberately: washes first, ink second.
// A wash is opaque and depth-sorted; ink is always legible, which is what a
// sketch does — you can see the far eave through the near slope.
export function draw(ctx, W, H, cam, scene) {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#f7f2e7');
  bg.addColorStop(1, '#e9e1d2');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const basePolys = [];
  const baseInk = [];
  const washes = [];
  const ink = [];

  const pushPoly = (pts, opts) => {
    const cs = clipPoly(pts.map((p) => toCam(p, cam)));
    if (cs.length < 3) return;
    const pp = cs.map((c) => ({ c, s: projectCam(c, cam, W, H) }));
    let depth = 0;
    for (const q of pp) depth += q.s.depth;
    depth /= pp.length;
    // normal from the unclipped world polygon, so clipping cannot flip it
    const nrm = pts.length >= 3
      ? norm3(cross3(sub3(pts[1], pts[0]), sub3(pts[2], pts[0])))
      : [0, 1, 0];
    (opts.base ? basePolys : washes).push({ kind: 'poly', pts: pp, depth, nrm, ...opts });
  };
  const pushLine = (a, b, opts) => {
    const seg = clipSeg(toCam(a, cam), toCam(b, cam));
    if (!seg) return;
    const sa = projectCam(seg[0], cam, W, H), sb = projectCam(seg[1], cam, W, H);
    (opts.base ? baseInk : ink).push({ kind: 'line', a: sa, b: sb, depth: (sa.depth + sb.depth) / 2, ...opts });
  };
  const pushLabel = (p, text, opts = {}) => {
    const c = toCam(p, cam);
    if (c[2] < NEAR) return;
    ink.push({ kind: 'label', s: projectCam(c, cam, W, H), depth: c[2], text, ...opts });
  };
  const pushDot = (p, opts = {}) => {
    const c = toCam(p, cam);
    if (c[2] < NEAR) return;
    ink.push({ kind: 'dot', s: projectCam(c, cam, W, H), depth: c[2], ...opts });
  };

  // ground
  const groundY = scene.groundY ?? 0;
  const gx = scene.ground ?? 22;
  // The table is a layer of its own, never depth-sorted against the model:
  // a ground plane that big always sorts as "near" and would swallow the drawing.
  // no ground fill: the paper is the table, and a 44 m quad seen in perspective
  // reads as a grey plane lying over the sheet
  const gl = 9;
  for (let i = -gl; i <= gl; i += 2) {
    if (i === 0) continue;
    pushLine([i, groundY, -gl], [i, groundY, gl], { stroke: 'rgba(120,108,90,0.16)', width: 0.7, ground: true, base: true });
    pushLine([-gl, groundY, i], [gl, groundY, i], { stroke: 'rgba(120,108,90,0.16)', width: 0.7, ground: true, base: true });
  }

  // soft plan shadow
  if (scene.shadowRings) {
    for (const ring of scene.shadowRings) {
      pushPoly(ring.map((p) => [p[0] + 0.3, groundY + 0.005, p[1] + 0.42]), {
        fill: 'rgba(74, 63, 48, 0.085)', stroke: null, flat: true, ground: true, base: true,
      });
    }
  }

  basePolys.sort((a, b) => b.depth - a.depth);
  for (const pr of basePolys) drawPoly(ctx, pr, cam, W, H);
  baseInk.sort((a, b) => b.depth - a.depth);
  for (const pr of baseInk) drawLine(ctx, pr, cam, W, H);

  // A wall never hides a roof from an eye above the eaves, and a feature volume
  // is above its host by construction, so the layer is the paint order; within a
  // layer, distance decides. Without the wall layer the far wall of a plan sorts
  // near the roof's centroid and paints the whole roof away.
  for (const f of scene.faces || []) pushPoly(f.poly3, { face: f });
  washes.sort((a, b) => (
    (a.face?.layer ?? LAYERS.surface) - (b.face?.layer ?? LAYERS.surface) || b.depth - a.depth
  ));
  for (const pr of washes) drawPoly(ctx, pr, cam, W, H);

  for (const l of scene.lines || []) pushLine(l.a3, l.b3, { line: l });
  for (const d of scene.dots || []) pushDot(d.p, d);
  for (const t of scene.labels || []) pushLabel(t.p, t.text, t);

  ink.sort((a, b) => b.depth - a.depth);
  for (const pr of ink) {
    if (pr.kind === 'line') drawLine(ctx, pr, cam, W, H);
    else if (pr.kind === 'label') drawLabel(ctx, pr);
    else if (pr.kind === 'dot') drawDot(ctx, pr);
  }

  ctx.restore();
}

function drawPoly(ctx, pr, cam, W, H) {
  const pts = pr.pts;
  if (pts.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].s.x, pts[0].s.y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].s.x, pts[i].s.y);
  ctx.closePath();

  let fill = pr.fill;
  if (!fill && pr.face) fill = colorFor(pr.face, cam, pts, pr.nrm);
  if (fill) {
    ctx.fillStyle = fill;
    if (pr.face && pr.face.alpha != null) {
      ctx.save();
      ctx.globalAlpha = pr.face.alpha;
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fill();
    }
  }
  if (pr.face && pr.face.edge) {
    ctx.strokeStyle = pr.face.edge;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

function drawLine(ctx, pr, cam) {
  const l = pr.line || {};
  // ground grid fades as it recedes, so the table reads as paper, not a wireframe
  let alpha = 1;
  if (l.ground) alpha = Math.max(0, 1 - (pr.depth - (cam.dist - 10)) / 26) * 0.9;
  if (alpha <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(pr.a.x, pr.a.y);
  ctx.lineTo(pr.b.x, pr.b.y);
  ctx.strokeStyle = l.stroke || PALETTE.ink;
  ctx.lineWidth = (l.width || 1.2) * (pr.a.depth > 34 ? 0.75 : 1);
  if (l.dash) ctx.setLineDash(l.dash);
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

function drawLabel(ctx, pr) {
  const { text, s } = pr;
  ctx.save();
  ctx.font = '500 11px ui-sans-serif, -apple-system, sans-serif';
  const w = ctx.measureText(text).width;
  const pad = 5;
  const bx = s.x + (pr.dx ?? 8);
  const by = s.y + (pr.dy ?? -8);
  ctx.fillStyle = pr.bg || 'rgba(247, 242, 231, 0.92)';
  roundRect(ctx, bx - pad, by - 12, w + pad * 2, 17, 3);
  ctx.fill();
  ctx.fillStyle = pr.color || PALETTE.inkSoft;
  ctx.fillText(text, bx, by);
  ctx.restore();
}

function drawDot(ctx, pr) {
  const { s } = pr;
  ctx.save();
  ctx.beginPath();
  ctx.arc(s.x, s.y, pr.r ?? 4.2, 0, Math.PI * 2);
  ctx.fillStyle = pr.fill || PALETTE.paper;
  ctx.fill();
  ctx.lineWidth = pr.lw ?? 1.6;
  ctx.strokeStyle = pr.stroke || PALETTE.blue;
  ctx.stroke();
  if (pr.pulse) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, (pr.r ?? 4.2) + 4.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(42, 92, 152, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function colorFor(face, cam, pts, nrm) {
  const base = face.color || PALETTE.roof[0];
  if (face.flat) return base;
  // Orient every normal upward first: the winding of a clipped patch is not
  // reliable, and a down-facing normal would paint coplanar patches two tones.
  let n = nrm || [0, 1, 0];
  if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
  // Signed light, so two slopes that mirror each other read as two surfaces.
  // Near-vertical faces are wash, not surface: one tone, like a section cut.
  const vertical = Math.abs(n[1]) < 0.4;
  const lam = Math.max(0, dot3(n, LIGHT));
  const shade = vertical ? 0.9 : 0.72 + 0.34 * lam;
  const depth = pts.reduce((a, q) => a + q.s.depth, 0) / pts.length;
  const fog = Math.max(0, Math.min(0.55, (depth - (cam.dist - 9)) / 55));
  return mixToward(shadeHex(base, shade), '#efe8da', fog * 0.5);
}

function shadeHex(hex, k) {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${cl(r)},${cl(g)},${cl(b)})`;
}

function mixToward(hex, target, t) {
  if (!hex.startsWith('#') && !hex.startsWith('rgb')) return hex;
  let r, g, b;
  if (hex.startsWith('#')) {
    r = parseInt(hex.slice(1, 3), 16); g = parseInt(hex.slice(3, 5), 16); b = parseInt(hex.slice(5, 7), 16);
  } else {
    const m = hex.match(/rgba?\(([^)]+)\)/);
    if (!m) return hex;
    const parts = m[1].split(',').map((x) => parseFloat(x));
    r = parts[0]; g = parts[1]; b = parts[2];
  }
  const tgt = target.startsWith('#')
    ? [parseInt(target.slice(1, 3), 16), parseInt(target.slice(3, 5), 16), parseInt(target.slice(5, 7), 16)]
    : [239, 232, 218];
  const k = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(r + (tgt[0] - r) * k)},${Math.round(g + (tgt[1] - g) * k)},${Math.round(b + (tgt[2] - b) * k)})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

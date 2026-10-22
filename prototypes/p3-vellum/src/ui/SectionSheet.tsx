// The section sheet: the roof drawn as a section, with the building behind it in pencil.
// One uniform scale, so slopes are true. A drag previews through the store and commits exactly the previewed profile.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Overhead, ProfilePt } from '../model/types';
import { store } from '../store';
import { derive } from '../model/derive';
import type { Joint } from '../model/section';
import {
  FAMILY_NAMES, moveJoint, moveStepEdge, pullPart, readSection, readSectionStroke,
  removeJoint, sectionFamily, setJointSharp, splitPart, validateGesture, type EditOpts,
} from '../model/section';
import { describeProfile, maxRise, ohRidge, ohSpan, presetProfile, sampleProfile, type ProfilePreset } from '../model/overheadGeom';
import { opOverhead } from '../model/ops';
import { roofWingsState } from '../model/wings';
import { MIN_HEADROOM, sectionContext } from '../model/sectionContext';
import { fmtM } from '../model/geom2d';
import { enterShaping, exitShaping, faceSection, toggleSeeThrough } from './shaping';

const W = 352, H = 232, PAD = 14;
const HIT_JOINT = 8, HIT_LINE = 7;
const PENCIL = '#8b857c';
const INK = '#1f1c19';
const BLUE = '#2f4bd8';
const RED = '#d9472b';

type Hit =
  | { kind: 'joint'; id: string; joint: Joint }
  | { kind: 'step'; id: string; edge: 'lo' | 'hi'; joint: Joint }
  | { kind: 'stepslide'; id: string; joint: Joint }
  | { kind: 'part'; id: string; u: number }
  | { kind: 'paper' };

type Drag =
  | { kind: 'joint'; id: string; start: ProfilePt[]; moved: boolean }
  | { kind: 'step'; id: string; edge: 'lo' | 'hi'; start: ProfilePt[]; moved: boolean }
  | { kind: 'stepslide'; id: string; start: ProfilePt[]; moved: boolean }
  | { kind: 'part'; id: string; start: ProfilePt[]; grab: [number, number]; uGrab: number; n: [number, number]; moved: boolean }
  | { kind: 'draw'; raw: [number, number][] };

const changedIds = (start: ProfilePt[], cand: ProfilePt[]): string[] => {
  const before = new Map(start.map((q) => [q.id, q]));
  const out: string[] = [];
  for (const q of cand) {
    const s = before.get(q.id);
    if (!s || Math.abs(s.u - q.u) > 1e-9 || Math.abs(s.h - q.h) > 1e-9) out.push(q.id!);
  }
  for (const q of start) if (!cand.some((c) => c.id === q.id)) out.push(q.id!);
  return out.filter(Boolean) as string[];
};

export function SectionSheet({ oh: committed }: { oh: Overhead }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
  const last = useRef<ProfilePt[] | null>(null);
  const frozen = useRef<{ yMin: number; yMax: number } | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<Hit | null>(null);
  const [status, setStatus] = useState('');
  const [drawn, setDrawn] = useState(false);
  const [partMenu, setPartMenu] = useState<{ x: number; y: number; id: string; u: number } | null>(null);

  const shown = store.shown.overheads.find((o) => o.id === committed.id) ?? committed;
  const profile = shown.profile;
  const span = ohSpan(shown);
  const baseY = shown.baseY;
  // a compound roof builds its primary wing at the authored section's own heights (scale 1); the multiply keeps the
  // sheet honest if a saved or edited roof ever gives the primary a different scale
  const wingState = roofWingsState(shown);
  const kH = wingState.kind === 'compound' ? Math.max(wingState.wings[wingState.primary]?.scale ?? 1, 1e-6) : 1;
  const sec = readSection(profile);
  const ctxData = sectionContext(store.shown, derive(store.shown), shown);

  // vertical range: the building below the roof, and the roof above it
  const lowLines = ctxData.lines.filter((l) => l.kind === 'floor' || l.kind === 'deck').flatMap((l) => l.pts.map((q) => q[1]));
  const yMinLive = Math.min(0, ...lowLines) - 0.3;
  const yMaxLive = baseY + Math.max(2, ...profile.map((q) => q.h * kH)) + 1.0;
  const yMin = frozen.current?.yMin ?? yMinLive;
  const yMax = frozen.current?.yMax ?? yMaxLive;
  const xMin = -0.15 * span, xMax = 1.15 * span;
  const k = Math.max(1e-6, Math.min((W - 2 * PAD) / (xMax - xMin), (H - 2 * PAD) / Math.max(yMax - yMin, 1e-6)));
  const ox = (W - k * (xMax - xMin)) / 2;
  const oy = (H - k * (yMax - yMin)) / 2;
  const sx = (x: number) => ox + (x - xMin) * k;
  const sy = (y: number) => H - oy - (y - yMin) * k;

  const toSec = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = cv.current!.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    return [xMin + (px - ox) / k, yMin + (H - oy - py) / k];
  };
  const local = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = cv.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const hitAt = (px: number, py: number): Hit => {
    const du = (u: number, h: number) => Math.hypot(sx(u * span) - px, sy(baseY + h * kH) - py);
    // step bars first, then the slide grip between them, then ordinary joints
    for (const j of sec.joints) {
      if (j.kind !== 'step') continue;
      const da = du(j.u, j.h), db = du(j.u, j.h2);
      if (Math.min(da, db) <= HIT_JOINT) {
        const firstIsLow = j.h <= j.h2;
        return { kind: 'step', id: j.id, edge: (da <= db) === firstIsLow ? 'lo' : 'hi', joint: j };
      }
      if (du(j.u, (j.h + j.h2) / 2) <= HIT_LINE) return { kind: 'stepslide', id: j.id, joint: j };
    }
    for (const j of sec.joints) {
      if (j.kind === 'step') continue;
      if (du(j.u, j.h) <= HIT_JOINT) return { kind: 'joint', id: j.id, joint: j };
    }
    const s = sampleProfile(profile);
    let bestU = -1, bestD = HIT_LINE;
    for (const p of sec.parts) {
      const A = sec.joints[p.a], B = sec.joints[p.b];
      for (let i = 0; i + 1 < s.length; i++) {
        if (s[i].u < A.u - 1e-9 || s[i + 1].u > B.u + 1e-9) continue;
        const ax = sx(s[i].u * span), ay = sy(baseY + s[i].h * kH);
        const bx = sx(s[i + 1].u * span), by = sy(baseY + s[i + 1].h * kH);
        const vx = bx - ax, vy = by - ay;
        const L2 = vx * vx + vy * vy;
        const t = L2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L2)) : 0;
        const d = Math.hypot(ax + vx * t - px, ay + vy * t - py);
        if (d < bestD) {
          bestD = d;
          bestU = s[i].u + (s[i + 1].u - s[i].u) * t;
        }
      }
    }
    if (bestU >= 0) return { kind: 'part', id: sec.parts.find((p) => bestU >= sec.joints[p.a].u - 1e-9 && bestU <= sec.joints[p.b].u + 1e-9)?.id ?? sec.parts[0].id, u: bestU };
    return { kind: 'paper' };
  };

  // ------------------------------------------------------------------ drawing
  const draw = () => {
    const c = cv.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr;
    c.height = H * dpr;
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // 1. grid
    g.strokeStyle = 'rgba(31,28,25,0.07)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = Math.ceil(xMin / 0.5) * 0.5; x <= xMax; x += 0.5) {
      g.moveTo(sx(x), 0);
      g.lineTo(sx(x), H);
    }
    for (let y = Math.ceil(yMin / 0.5) * 0.5; y <= yMax; y += 0.5) {
      g.moveTo(0, sy(y));
      g.lineTo(W, sy(y));
    }
    g.stroke();

    // 2. context, in pencil
    for (const l of ctxData.lines) {
      g.strokeStyle = l.kind === 'ceiling' ? 'rgba(139,133,124,0.7)' : l.faint ? 'rgba(139,133,124,0.32)' : l.kind === 'wall' ? 'rgba(31,28,25,0.55)' : PENCIL;
      g.lineWidth = l.kind === 'wall' ? 1.1 : 1.5;
      g.setLineDash(l.kind === 'ceiling' || l.kind === 'neighbour' ? [4, 3] : []);
      g.beginPath();
      for (let i = 0; i + 1 < l.pts.length; i++) {
        const a = l.pts[i], b = l.pts[i + 1];
        g.moveTo(sx(a[0]), sy(a[1]));
        g.lineTo(sx(b[0]), sy(b[1]));
      }
      g.stroke();
    }
    g.setLineDash([]);
    // headroom bands, in red pencil
    for (const band of ctxData.headroom) {
      const x0 = sx(band.x0), x1 = sx(band.x1);
      const y0 = sy(band.y), y1 = sy(band.y + Math.min(band.clear, MIN_HEADROOM));
      g.fillStyle = 'rgba(217,71,43,0.08)';
      g.fillRect(x0, y1, Math.max(1, x1 - x0), Math.max(1, y0 - y1));
      g.save();
      g.beginPath();
      g.rect(x0, y1, Math.max(1, x1 - x0), Math.max(1, y0 - y1));
      g.clip();
      g.strokeStyle = 'rgba(217,71,43,0.45)';
      g.lineWidth = 1;
      g.beginPath();
      for (let q = x0 - H; q < x1 + H; q += 7) {
        g.moveTo(q, y0);
        g.lineTo(q + (y0 - y1), y1);
      }
      g.stroke();
      g.restore();
      if (x1 - x0 > 42) {
        g.fillStyle = 'rgba(217,71,43,0.9)';
        g.font = '9.5px ui-monospace, monospace';
        g.fillText(`${band.clear.toFixed(1)} m headroom`, x0 + 4, y1 - 3);
      }
    }
    // people
    for (const p of ctxData.people) {
      const x = sx(p.x), y = sy(p.y);
      const h = 1.75 * k;
      g.strokeStyle = 'rgba(139,133,124,0.9)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y - h * 0.78);
      g.stroke();
      g.beginPath();
      g.arc(x, y - h * 0.88, Math.max(2, 0.11 * k), 0, Math.PI * 2);
      g.stroke();
    }

    // 3. the eave line
    g.strokeStyle = 'rgba(31,28,25,0.35)';
    g.setLineDash([3, 4]);
    g.beginPath();
    g.moveTo(sx(0), sy(baseY));
    g.lineTo(sx(span), sy(baseY));
    g.stroke();
    g.setLineDash([]);

    // 4. the roof section as a band `thick` deep
    let s = sampleProfile(profile);
    if (shown.form === 'revolve') {
      const half = s.filter((q) => q.u <= 0.5 + 1e-9);
      s = [...half, ...half.slice().reverse().map((q) => ({ u: 1 - q.u, h: q.h }))];
    }
    const top: [number, number][] = s.map((q) => [q.u * span, baseY + q.h * kH]);
    const band: [number, number][] = [...top, ...top.slice().reverse().map(([x, y]) => [x, y - shown.thick] as [number, number])];
    g.beginPath();
    band.forEach(([x, y], i) => (i ? g.lineTo(sx(x), sy(y)) : g.moveTo(sx(x), sy(y))));
    g.closePath();
    g.fillStyle = '#fbf9f5';
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 1.6;
    g.stroke();

    // 5. joints
    for (const j of sec.joints) {
      const hot = j.id === sel || (hover && (hover.kind === 'joint' || hover.kind === 'step' || hover.kind === 'stepslide') && hover.id === j.id);
      g.fillStyle = hot ? BLUE : '#fbf9f5';
      g.strokeStyle = hot ? BLUE : INK;
      g.lineWidth = hot ? 2 : 1.2;
      if (j.kind === 'step') {
        const x = sx(j.u * span), y0 = sy(baseY + j.h * kH), y1 = sy(baseY + j.h2 * kH);
        g.beginPath();
        g.moveTo(x, y0);
        g.lineTo(x, y1);
        g.stroke();
        for (const y of [y0, y1]) {
          g.beginPath();
          g.moveTo(x - 4, y);
          g.lineTo(x + 4, y);
          g.stroke();
        }
      } else {
        g.beginPath();
        g.rect(sx(j.u * span) - 3.2, sy(baseY + j.h * kH) - 3.2, 6.4, 6.4);
        g.fill();
        g.stroke();
      }
    }
    // part hover
    if (hover?.kind === 'part') {
      const p = sec.parts.find((q) => q.id === hover.id);
      if (p) {
        const A = sec.joints[p.a], B = sec.joints[p.b];
        g.strokeStyle = BLUE;
        g.lineWidth = 2.5;
        g.beginPath();
        let first = true;
        for (const q of s) {
          if (q.u < A.u - 1e-9 || q.u > B.u + 1e-9) continue;
          if (first) (g.moveTo(sx(q.u * span), sy(baseY + q.h * kH)), (first = false));
          else g.lineTo(sx(q.u * span), sy(baseY + q.h * kH));
        }
        g.stroke();
      }
    }

    // 6. freehand trace
    const d = drag.current;
    if (d?.kind === 'draw') {
      g.strokeStyle = BLUE;
      g.lineWidth = 2;
      g.beginPath();
      d.raw.forEach(([x, y], i) => (i ? g.lineTo(sx(x), sy(y)) : g.moveTo(sx(x), sy(y))));
      g.stroke();
    }
  };
  useEffect(draw);

  // ------------------------------------------------------------------ gestures
  const opts = (): EditOpts => ({
    span, form: shown.form, maxRise: maxRise(shown),
    tolU: Math.max(1e-4, (8 / k) / Math.max(span, 1e-6)),
    tolH: Math.max(1e-4, 8 / k),
  });

  const begin = (hit: Hit, e: PointerEvent) => {
    setDrawn(false);
    setPartMenu(null);
    frozen.current = { yMin: yMinLive, yMax: yMaxLive };
    last.current = null;
    const start = profile;
    if (hit.kind === 'joint') {
      setSel(hit.id);
      drag.current = { kind: 'joint', id: hit.id, start, moved: false };
    } else if (hit.kind === 'step') {
      setSel(hit.id);
      drag.current = { kind: 'step', id: hit.id, edge: hit.edge, start, moved: false };
    } else if (hit.kind === 'stepslide') {
      setSel(hit.id);
      drag.current = { kind: 'stepslide', id: hit.id, start, moved: false };
    } else if (hit.kind === 'part') {
      const [x, y] = toSec(e);
      const p = sec.parts.find((q) => q.id === hit.id);
      const A = p ? sec.joints[p.a] : null;
      const B = p ? sec.joints[p.b] : null;
      let n: [number, number] = [0, 1];
      if (A && B) {
        const sm = sampleProfile(start);
        const i = Math.max(0, sm.findIndex((q) => q.u >= hit.u) - 1);
        const a = sm[Math.min(i, sm.length - 2)], b = sm[Math.min(i + 1, sm.length - 1)];
        const dx = (b.u - a.u) * span, dy = (b.h - a.h) * kH;
        const L = Math.hypot(dx, dy) || 1;
        n = [-dy / L, dx / L];
      }
      drag.current = { kind: 'part', id: hit.id, start, grab: [x, y], uGrab: hit.u, n, moved: false };
    } else {
      setSel(null);
      drag.current = { kind: 'draw', raw: [[...toSec(e)] as [number, number]] };
    }
    store.set({ dragging: true });
    draw();
  };

  const preview = (candidate: ProfilePt[], measure: string) => {
    const d = drag.current;
    if (!d || d.kind === 'draw') return;
    const o = opts();
    const ids = changedIds(d.start, candidate);
    const clean = validateGesture(d.start, candidate, ids, o);
    if (!clean.valid) {
      setStatus(clean.notes[0] ?? 'that is not possible here');
      return;
    }
    last.current = clean.profile;
    const note = clean.notes.length ? clean.notes.join(' · ') : measure;
    setStatus(note);
    store.setPreview(opOverhead(shown.id, { profile: clean.profile }));
  };

  const finish = () => {
    const d = drag.current;
    drag.current = null;
    frozen.current = null;
    store.set({ dragging: false });
    if (!d) return;
    if (d.kind === 'draw') {
      const raw = d.raw
        .filter(([x, y]) => x >= -1e-6 && x <= span + 1e-6)
        .map(([x, y]) => ({ u: Math.max(0, Math.min(1, x / span)), h: Math.max(0, Math.min(maxRise(shown), (y - baseY) / kH)) }));
      const width = raw.length ? Math.max(...raw.map((q) => q.u)) - Math.min(...raw.map((q) => q.u)) : 0;
      if (raw.length < 3 || width < 0.05) {
        store.setPreview(null);
        setStatus('that stroke has no width across the roof');
        draw();
        return;
      }
      const readings = readSectionStroke(raw, { span, form: shown.form });
      if (!readings.length) {
        store.setPreview(null);
        setStatus('that stroke has no section in it');
        draw();
        return;
      }
      const first = readings[0];
      store.commit(first.label, opOverhead(shown.id, { profile: first.profile }), {
        readings: readings.map((r) => ({ id: r.id, label: r.label, detail: r.detail, op: opOverhead(shown.id, { profile: r.profile }) })),
        readingIndex: 0,
      });
      setDrawn(true);
      setStatus(first.detail);
      draw();
      return;
    }
    const p = last.current;
    if (!d.moved || !p) {
      store.setPreview(null);
      draw();
      return;
    }
    const label = d.kind === 'joint'
      ? (() => {
        const j = sec.joints.find((q) => q.id === d.id);
        return j?.kind === 'ridge' ? `Moved ${shown.name}’s ridge` : j?.kind === 'eave' ? `Moved ${shown.name}’s eave` : `Moved a joint on ${shown.name}’s section`;
      })()
      : d.kind === 'part' ? `Reshaped ${shown.name}’s section`
        : d.kind === 'step' ? `Changed ${shown.name}’s step` : `Moved ${shown.name}’s step`;
    store.commit(label, opOverhead(shown.id, { profile: p }));
    setStatus(label);
    draw();
  };

  const cancel = () => {
    drag.current = null;
    frozen.current = null;
    last.current = null;
    store.set({ dragging: false });
    store.setPreview(null);
    setStatus('');
    draw();
  };

  const commitProfile = (label: string, next: ProfilePt[]) => {
    if (!next.length) return;
    store.commit(label, opOverhead(shown.id, { profile: next }));
    setStatus(label);
  };

  return (
    <div>
      <div class="pad sheetpad" style={{ width: W + 'px', height: H + 'px' }}>
        <canvas
          ref={cv}
          tabIndex={0}
          style={{ width: W + 'px', height: H + 'px', cursor: hover?.kind === 'joint' || hover?.kind === 'step' ? 'grab' : hover?.kind === 'part' ? 'row-resize' : 'crosshair', outline: 'none', touchAction: 'none' }}
          onPointerDown={(e) => {
            if (e.detail > 1) return;
            cv.current?.focus();
            try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch {}
            const [px, py] = local(e);
            const hit = hitAt(px, py);
            if (e.altKey && hit.kind === 'joint') {
              const next = removeJoint(profile, hit.id, opts());
              if (next) commitProfile(`Removed a crease from ${shown.name}`, next);
              else setStatus('that joint is the roof’s only shape');
              setSel(null);
              return;
            }
            begin(hit, e);
          }}
          onPointerMove={(e) => {
            const [px, py] = local(e);
            const d = drag.current;
            if (!d) {
              const h = hitAt(px, py);
              const same = h.kind === hover?.kind && (h as any).id === (hover as any)?.id;
              if (!same) setHover(h);
              return;
            }
            const [x, y] = toSec(e);
            if (d.kind === 'draw') {
              d.raw.push([x, y]);
              draw();
              return;
            }
            d.moved = true;
            if (d.kind === 'joint') {
              const r = moveJoint(d.start, d.id, x / span, (y - baseY) / kH, { ...opts(), free: e.altKey, solo: e.shiftKey });
              preview(r.profile, `${fmtM(x)} across · ${fmtM(y - baseY)} above the eave`);
            } else if (d.kind === 'step') {
              const j = sec.joints.find((q) => q.id === d.id);
              const firstIsLow = !j || j.h <= j.h2;
              // moveStepEdge names its edges by profile index; the sheet names them by height
              const edge = (d.edge === 'lo') === firstIsLow ? 'lo' : 'hi';
              const r = moveStepEdge(d.start, d.id, edge, (y - baseY) / kH, opts());
              preview(r.profile, r.label ?? `step ${fmtM(Math.abs(y - baseY))}`);
            } else if (d.kind === 'stepslide') {
              const j = sec.joints.find((q) => q.id === d.id);
              if (j) {
                const r = moveJoint(d.start, d.id, x / span, j.h, { ...opts(), free: e.altKey, solo: e.shiftKey });
                preview(r.profile, `step at ${fmtM(x)}`);
              }
            } else {
              const s = ((x - d.grab[0]) * d.n[0] + (y - d.grab[1]) * d.n[1]) / kH;
              const r = pullPart(d.start, d.id, s, { ...opts(), free: e.altKey, solo: e.shiftKey, uGrab: d.uGrab });
              preview(r, `${s >= 0 ? 'fuller' : 'pointier'} by ${fmtM(Math.abs(s))}`);
            }
          }}
          onPointerUp={() => finish()}
          onPointerCancel={cancel}
          onPointerLeave={() => !drag.current && setHover(null)}
          onDblClick={(e) => {
            const [px, py] = local(e);
            const hit = hitAt(px, py);
            if (hit.kind === 'joint') {
              const j = sec.joints.find((q) => q.id === hit.id);
              if (!j || j.kind === 'eave') return;
              commitProfile(`Made a point on ${shown.name} ${j.kind === 'step' ? 'sharp' : 'smooth'}`, setJointSharp(profile, hit.id, !profile.find((q) => q.id === hit.id)?.crease));
            } else if (hit.kind === 'part') {
              setPartMenu({ x: px, y: py, id: hit.id, u: hit.u });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              if (drag.current) cancel();
              else if (partMenu) setPartMenu(null);
              else if (sel) setSel(null);
              else exitShaping();
              return;
            }
            if ((e.key === 'Backspace' || e.key === 'Delete') && sel) {
              e.preventDefault();
              e.stopPropagation();
              const next = removeJoint(profile, sel, opts());
              if (next) commitProfile(`Removed a crease from ${shown.name}`, next);
              else setStatus('that joint is the roof’s only shape');
              setSel(null);
              return;
            }
            if (e.key === 'Tab' && drawn) {
              const top = store.top;
              if (top?.readings) {
                e.preventDefault();
                e.stopPropagation();
                const next = ((top.readingIndex ?? 0) + (e.shiftKey ? top.readings.length - 1 : 1)) % top.readings.length;
                store.amendReading(next);
                setStatus(top.readings[next].detail);
              }
            }
          }}
        />
        {partMenu && (
          <div class="partmenu" style={{ left: partMenu.x + 'px', top: partMenu.y + 'px' }} onPointerDown={(e) => e.stopPropagation()}>
            {(() => {
              const a = splitPart(profile, partMenu.id, partMenu.u, 'crease', opts());
              return a ? (
                <button class="chip" onClick={() => { commitProfile(`Made a point on ${shown.name} sharp`, a.profile); setSel(a.jointId); setPartMenu(null); }}>Crease here</button>
              ) : null;
            })()}
            {(() => {
              const b = splitPart(profile, partMenu.id, partMenu.u, 'step', opts());
              return b ? (
                <button class="chip" onClick={() => { commitProfile(`Added a step to ${shown.name}`, b.profile); setSel(b.jointId); setPartMenu(null); }}>Step here (glazing)</button>
              ) : null;
            })()}
          </div>
        )}
      </div>
      <div class="sheet-status" title="The gesture validator's note, or the measurement under the hand">
        {status || 'Drag a joint, a slope, or draw a new section on the paper.'}
      </div>
      {(sel || (drawn && store.top?.readings)) && (
        <div class="chips" style={{ marginTop: '6px' }}>
          {drawn && store.top?.readings ? (
            store.top.readings.map((r, i) => (
              <button class={'chip' + ((store.top?.readingIndex ?? 0) === i ? ' on' : '')} title="Tab for another reading" onClick={() => { store.amendReading(i); setStatus(r.detail); }}>
                {r.label}
              </button>
            ))
          ) : sel && (() => {
            const j = sec.joints.find((q) => q.id === sel);
            if (!j) return null;
            const q = profile.find((x) => x.id === sel);
            return (
              <>
                <span class="note" style={{ margin: 0 }}>{j.kind === 'step' ? 'Step:' : 'Joint:'}</span>
                <button class={'chip' + (q?.crease ? ' on' : '')} disabled={j.kind === 'eave'} onClick={() => !q?.crease && commitProfile(`Made a point on ${shown.name} sharp`, setJointSharp(profile, sel, true))}>sharp</button>
                <button class={'chip' + (!q?.crease ? ' on' : '')} disabled={j.kind === 'eave'} onClick={() => q?.crease && commitProfile(`Made a point on ${shown.name} smooth`, setJointSharp(profile, sel, false))}>smooth</button>
                <button
                  class="chip"
                  disabled={j.kind === 'eave' || sec.joints.filter((x) => x.kind !== 'eave' && Math.max(x.h, x.h2) > 0.05).length <= 1}
                  title={j.kind === 'eave' ? 'The eave ends stay' : 'Remove this joint'}
                  onClick={() => {
                    const next = removeJoint(profile, sel, opts());
                    if (next) commitProfile(`Removed a crease from ${shown.name}`, next);
                    else setStatus('the roof needs this joint');
                    setSel(null);
                  }}
                >remove</button>
              </>
            );
          })()}
        </div>
      )}
      <div class="lab" style={{ marginTop: '10px' }}>Start from a shape</div>
      <ProfilePresets oh={committed} />
      <div class="row sheet-footer">
        <button class={'chip' + (store.ui.seeThrough ? ' on' : '')} title="See through the roof while shaping (X)" onClick={toggleSeeThrough}>See through · X</button>
        <button class="chip" title="Look across the section from the side you are on" onClick={faceSection}>Face the section</button>
        <button class="btn small" style={{ marginLeft: 'auto' }} onClick={() => exitShaping()}>Done</button>
      </div>
    </div>
  );
}

/** Starting shapes: a quick way in, folded away so they support sculpting rather than replace it. */
export function ProfilePresets({ oh }: { oh: Overhead }) {
  const revolve = oh.form === 'revolve';
  const span = ohSpan(oh);
  return (
    <div class="chips">
      {((revolve ? ['flat', 'dome', 'gable'] : ['flat', 'raked', 'gable', 'clerestory', 'vault', 'fold', 'sawtooth', 'butterfly']) as ProfilePreset[]).map((k) => (
        <button class="chip" onClick={() => store.commit(`Made ${oh.name} ${k === 'gable' && revolve ? 'a cone' : k}`, opOverhead(oh.id, { profile: presetProfile(k, span) }))}>
          {k === 'gable' && revolve ? 'cone' : k}
        </button>
      ))}
    </div>
  );
}

/** Read-only ink of the roof's section: the card's way into Edit Shape. */
export function SectionThumb({ oh }: { oh: Overhead }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const W = 270, H = 84, PAD = 8;
  const profile = (store.shown.overheads.find((o) => o.id === oh.id) ?? oh).profile;
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr;
    c.height = H * dpr;
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const maxH = Math.max(1, ...profile.map((q) => q.h));
    const sx = (u: number) => PAD + u * (W - 2 * PAD);
    const sy = (h: number) => H - PAD - (h / maxH) * (H - 2 * PAD);
    g.strokeStyle = INK;
    g.lineWidth = 1.6;
    g.beginPath();
    sampleProfile(profile).forEach((q, i) => (i ? g.lineTo(sx(q.u), sy(q.h)) : g.moveTo(sx(q.u), sy(q.h))));
    g.stroke();
    g.strokeStyle = 'rgba(31,28,25,0.3)';
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(PAD, sy(0));
    g.lineTo(W - PAD, sy(0));
    g.stroke();
    g.setLineDash([]);
  }, [profile]);
  return (
    <canvas
      ref={cv}
      class="section-thumb"
      title="Edit the shape of this roof"
      style={{ width: W + 'px', height: H + 'px', cursor: 'pointer' }}
      onClick={() => enterShaping(oh.id)}
    />
  );
}

/** The card shown while shaping: the live family name, the roof's name, and the sheet. */
export function ShapeCard({ oh }: { oh: Overhead }) {
  const shown = store.shown.overheads.find((o) => o.id === oh.id) ?? oh;
  const family = FAMILY_NAMES[sectionFamily(readSection(shown.profile), shown.form)];
  return (
    <>
      <div class="kind" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{family}</span>
        <button class="btn small" style={{ marginTop: '-6px', marginRight: '-6px' }} onClick={() => exitShaping()} title="Done (Esc)">Done</button>
      </div>
      <h3>{oh.name}</h3>
      <div class="facts">
        {describeProfile(shown)} · eave at <span class="num">{fmtM(shown.baseY)}</span> · highest point <span class="num">{fmtM(ohRidge(shown))}</span>
      </div>
      {roofWingsState(shown).kind === 'compound' && (
        <div class="note" style={{ marginTop: '-4px' }}>
          This is the primary wing’s section. Every wing follows this section.
        </div>
      )}
      <SectionSheet oh={oh} />
    </>
  );
}

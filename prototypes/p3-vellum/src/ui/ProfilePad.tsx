// Draw the roof's silhouette, not its parameters — then refine it without redrawing.
// The pad edits the one authored profile (the same one the roof's blue section handles edit in 3D): drag a point
// to move it, drag the line to bend it, double-click the line to add a point, ⌥-click a point to remove it, and draw
// on empty paper to start again. Every gesture previews live in 3D and is one undo step.
import { useRef, useEffect, useState } from 'preact/hooks';
import type { Overhead, ProfilePt } from '../model/types';
import type { V2 } from '../model/geom2d';
import { round } from '../model/geom2d';
import {
  sampleProfile, ohSpan, presetProfile, ProfilePreset, profileH, moveProfilePoint, bendProfile, insertProfilePoint, removeProfilePoint, setCrease,
} from '../model/overheadGeom';
import { fitProfile } from '../model/strokes';
import { opOverhead } from '../model/ops';
import { store } from '../store';
import { app } from './ctx';

const W = 270, H = 128, PAD = 12;
const HIT_POINT = 8, HIT_LINE = 7, SNAP_PX = 6;

type Drag =
  | { kind: 'point'; id: string; start: ProfilePt[]; moved: boolean; alt: boolean }
  | { kind: 'bend'; u: number; h0: number; y0: number; start: ProfilePt[]; moved: boolean }
  | { kind: 'draw'; raw: V2[] };

type PadGuide = { u?: number; h?: number };

export function ProfilePad({ oh: committed }: { oh: Overhead }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
  const guides = useRef<PadGuide[]>([]);
  const frozenMax = useRef<number | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<{ kind: 'point' | 'line' | 'none'; id?: string; u?: number }>({ kind: 'none' });
  // the live profile: a drag here or on the roof in 3D previews through the store, so both views show one shape
  const oh = store.shown.overheads.find((x) => x.id === committed.id) ?? committed;
  const profile = oh.profile;
  const span = ohSpan(oh);
  const maxH = frozenMax.current ?? Math.max(3, ...profile.map((p) => p.h)) * 1.25;
  const sx = (u: number) => PAD + u * (W - 2 * PAD);
  const sy = (h: number) => H - PAD - (h / maxH) * (H - 2 * PAD);
  const revolve = oh.form === 'revolve';
  const active3d = app.ov?.activeHandle?.startsWith('pp:') ? app.ov.activeHandle.slice(3) : null;
  const selected = profile.find((q) => q.id === sel) ?? null;

  const draw = () => {
    const c = cv.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr;
    c.height = H * dpr;
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, W, H);
    // base line (the eave)
    g.strokeStyle = 'rgba(31,28,25,0.35)';
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(PAD, sy(0));
    g.lineTo(W - PAD, sy(0));
    g.stroke();
    // snap guides
    g.strokeStyle = 'rgba(47,75,216,0.7)';
    for (const gd of guides.current) {
      g.beginPath();
      if (gd.u !== undefined) (g.moveTo(sx(gd.u), PAD / 2), g.lineTo(sx(gd.u), H - PAD / 2));
      if (gd.h !== undefined) (g.moveTo(PAD / 2, sy(gd.h)), g.lineTo(W - PAD / 2, sy(gd.h)));
      g.stroke();
    }
    g.setLineDash([]);
    // the curve (generated from the points; never edited directly)
    const d = drag.current;
    const s = sampleProfile(profile);
    g.strokeStyle = d?.kind === 'draw' ? 'rgba(139,133,124,0.6)' : hover.kind === 'line' || d?.kind === 'bend' ? '#2f4bd8' : '#1f1c19';
    g.lineWidth = 2;
    g.beginPath();
    s.forEach((q, i) => (i ? g.lineTo(sx(q.u), sy(q.h)) : g.moveTo(sx(q.u), sy(q.h))));
    g.stroke();
    if (d?.kind === 'bend' || hover.kind === 'line') {
      const u = d?.kind === 'bend' ? d.u : hover.u!;
      g.fillStyle = '#2f4bd8';
      g.beginPath();
      g.arc(sx(u), sy(profileH(s, u)), 3.2, 0, Math.PI * 2);
      g.fill();
    }
    for (const q of profile) {
      const hot = q.id === sel || q.id === active3d || (d?.kind === 'point' && d.id === q.id);
      const hov = hover.kind === 'point' && hover.id === q.id;
      g.fillStyle = q.crease ? (hot ? '#2f4bd8' : '#1f1c19') : '#fbf9f5';
      g.strokeStyle = hot || hov ? '#2f4bd8' : '#1f1c19';
      g.lineWidth = hot ? 2 : 1.2;
      const r = hot || hov ? 4 : 3;
      g.beginPath();
      if (q.crease) g.rect(sx(q.u) - r + 0.5, sy(q.h) - r + 0.5, 2 * r - 1, 2 * r - 1);
      else g.arc(sx(q.u), sy(q.h), r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    if (d?.kind === 'draw') {
      g.strokeStyle = '#2f4bd8';
      g.lineWidth = 2;
      g.beginPath();
      d.raw.forEach((q, i) => (i ? g.lineTo(sx(q[0]), sy(q[1])) : g.moveTo(sx(q[0]), sy(q[1]))));
      g.stroke();
    }
  };
  useEffect(draw);

  const local = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = cv.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const toProfile = (e: { clientX: number; clientY: number }): V2 => {
    const [x, y] = local(e);
    return [(x - PAD) / (W - 2 * PAD), ((H - PAD - y) / (H - 2 * PAD)) * maxH];
  };
  /** what is under the pen: a point, the line (and where along it), or empty paper */
  const hitAt = (e: { clientX: number; clientY: number }) => {
    const [x, y] = local(e);
    let best: ProfilePt | null = null, bd = HIT_POINT;
    for (const q of profile) {
      const dd = Math.hypot(sx(q.u) - x, sy(q.h) - y);
      if (dd < bd) (bd = dd), (best = q);
    }
    if (best) return { kind: 'point' as const, id: best.id! };
    const s = sampleProfile(profile);
    let lu = -1, ld = HIT_LINE;
    for (let i = 0; i + 1 < s.length; i++) {
      const ax = sx(s[i].u), ay = sy(s[i].h), bx = sx(s[i + 1].u), by = sy(s[i + 1].h);
      const vx = bx - ax, vy = by - ay;
      const L2 = vx * vx + vy * vy;
      const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L2)) : 0;
      const dd = Math.hypot(ax + vx * t - x, ay + vy * t - y);
      if (dd < ld) (ld = dd), (lu = s[i].u + (s[i + 1].u - s[i].u) * t);
    }
    if (lu >= 0) return { kind: 'line' as const, u: Math.max(0.001, Math.min(0.999, lu)) };
    return { kind: 'none' as const };
  };

  /** A dragged point lines up with the middle, its neighbours (a step) and their heights; 5 cm otherwise. */
  const snapPoint = (id: string, base: ProfilePt[], u: number, h: number, free: boolean): [number, number] => {
    guides.current = [];
    if (free) return [u, h];
    const i = base.findIndex((q) => q.id === id);
    const near = [base[i - 1], base[i + 1]].filter(Boolean);
    const px = (du: number) => Math.abs(du) * (W - 2 * PAD);
    const pxh = (dh: number) => (Math.abs(dh) / maxH) * (H - 2 * PAD);
    // steps of 5 cm from where the point was, so moving it sideways never nudges its height (and vice versa)
    const q0 = base[i];
    let su = q0.u + round((u - q0.u) * span, 0.05) / Math.max(span, 1e-6), sh = q0.h + round(h - q0.h, 0.05);
    for (const cu of [0.5, ...near.map((q) => q.u)]) if (px(cu - u) < SNAP_PX) {
      su = cu;
      guides.current.push({ u: cu });
      break;
    }
    for (const ch of [0, ...near.map((q) => q.h)]) if (pxh(ch - h) < SNAP_PX) {
      sh = ch;
      guides.current.push({ h: ch });
      break;
    }
    return [su, sh];
  };

  const preview = (pr: ProfilePt[]) => store.setPreview(opOverhead(oh.id, { profile: pr }));
  const commit = (label: string, pr: ProfilePt[]) => store.commit(label, opOverhead(oh.id, { profile: pr }));
  const end = () => {
    drag.current = null;
    guides.current = [];
    frozenMax.current = null;
  };
  const cancel = () => {
    end();
    store.setPreview(null);
  };

  return (
    <div>
      <div class="pad" style={{ width: W + 'px', height: H + 'px' }}>
        <canvas
          ref={cv}
          tabIndex={0}
          style={{ width: W + 'px', height: H + 'px', cursor: hover.kind === 'point' ? 'grab' : hover.kind === 'line' ? 'row-resize' : 'crosshair', outline: 'none' }}
          onDblClick={(e) => {
            const h = hitAt(e);
            if (h.kind === 'point') {
              const q = profile.find((x) => x.id === h.id)!;
              commit(`Made a point on ${oh.name} ${q.crease ? 'smooth' : 'sharp'}`, setCrease(profile, h.id, !q.crease));
            } else if (h.kind === 'line') {
              const r = insertProfilePoint(profile, h.u);
              commit(`Added a point to ${oh.name}’s profile`, r.profile);
              setSel(r.id);
            }
          }}
          onPointerDown={(e) => {
            if (e.detail > 1) return;
            cv.current?.focus();
            try {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            } catch {}
            frozenMax.current = maxH;
            const h = hitAt(e);
            if (h.kind === 'point') {
              if (e.altKey) {
                const next = removeProfilePoint(profile, h.id);
                if (next !== profile) commit(`Removed a point from ${oh.name}’s profile`, next);
                setSel(null);
                return end();
              }
              setSel(h.id);
              drag.current = { kind: 'point', id: h.id, start: profile, moved: false, alt: false };
            } else if (h.kind === 'line') {
              drag.current = { kind: 'bend', u: h.u, h0: profileH(sampleProfile(profile), h.u), y0: toProfile(e)[1], start: profile, moved: false };
            } else {
              setSel(null);
              drag.current = { kind: 'draw', raw: [toProfile(e)] };
            }
            draw();
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) {
              const h = hitAt(e);
              if (h.kind !== hover.kind || (h as any).id !== hover.id || (h.kind === 'line' && Math.abs(h.u - (hover.u ?? -1)) > 0.005)) setHover(h);
              return;
            }
            const [u, hh] = toProfile(e);
            if (d.kind === 'draw') {
              d.raw.push([u, hh]);
              return draw();
            }
            d.moved = true;
            if (d.kind === 'point') {
              const [su, sh] = snapPoint(d.id, d.start, u, hh, e.altKey);
              preview(moveProfilePoint(d.start, d.id, su, sh));
            } else {
              const dh = round(hh - d.y0, 0.01);
              preview(bendProfile(d.start, d.u, dh));
            }
          }}
          onPointerUp={() => {
            const d = drag.current;
            if (!d) return;
            if (d.kind === 'draw') {
              const r = d.raw;
              end();
              if (r.length < 3) return draw();
              let pts = r;
              if (pts[0][0] > pts[pts.length - 1][0]) pts = [...pts].reverse();
              return commit(`Drew a new profile for ${oh.name}`, fitProfile(pts, span));
            }
            const shown = store.shown.overheads.find((x) => x.id === oh.id)?.profile;
            end();
            if (!d.moved || !shown) return cancel();
            commit(d.kind === 'point' ? `Moved a point on ${oh.name}’s profile` : `Bent ${oh.name}’s profile`, shown);
          }}
          onPointerCancel={cancel}
          onPointerLeave={() => !drag.current && hover.kind !== 'none' && setHover({ kind: 'none' })}
          onKeyDown={(e) => {
            // the pad keeps its keys: Delete removes the picked point, not the roof
            if ((e.key === 'Backspace' || e.key === 'Delete') && sel) {
              e.preventDefault();
              e.stopPropagation();
              const next = removeProfilePoint(profile, sel);
              if (next !== profile) commit(`Removed a point from ${oh.name}’s profile`, next);
              setSel(null);
            } else if (e.key === 'Escape' && (drag.current || sel)) {
              e.stopPropagation();
              if (drag.current) cancel();
              setSel(null);
            }
          }}
        />
        <div class="padhint">{revolve ? 'Half the section, edge → centre → edge — it spins round' : 'The section, edge to edge — steps make glazing'}</div>
      </div>
      {selected && (
        <div class="chips" style={{ marginTop: '6px' }}>
          <span class="note" style={{ margin: 0 }}>Point:</span>
          <button class={'chip' + (selected.crease ? ' on' : '')} onClick={() => !selected.crease && commit(`Made a point on ${oh.name} sharp`, setCrease(profile, selected.id!, true))}>
            sharp
          </button>
          <button class={'chip' + (!selected.crease ? ' on' : '')} onClick={() => selected.crease && commit(`Made a point on ${oh.name} smooth`, setCrease(profile, selected.id!, false))}>
            smooth
          </button>
          <button
            class="chip"
            disabled={profile[0].id === selected.id || profile[profile.length - 1].id === selected.id}
            title="The eave ends stay"
            onClick={() => {
              commit(`Removed a point from ${oh.name}’s profile`, removeProfilePoint(profile, selected.id!));
              setSel(null);
            }}
          >
            remove
          </button>
        </div>
      )}
      <div class="chips" style={{ marginTop: '6px' }}>
        {((revolve ? ['flat', 'dome', 'gable'] : ['flat', 'raked', 'gable', 'clerestory', 'vault', 'fold', 'sawtooth', 'butterfly']) as ProfilePreset[]).map((k) => (
          <button class="chip" onClick={() => store.commit(`Made ${oh.name} ${k === 'gable' && revolve ? 'a cone' : k}`, opOverhead(oh.id, { profile: presetProfile(k, span) }))}>
            {k === 'gable' && revolve ? 'cone' : k}
          </button>
        ))}
      </div>
      <div class="note" style={{ marginTop: '6px' }}>
        Drag a point to move it · drag the line to bend it · double-click the line to add a point · ⌥-click a point to remove it · double-click a point: ■ sharp ↔ ○ smooth · draw on empty paper to start over.
      </div>
    </div>
  );
}

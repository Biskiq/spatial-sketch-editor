// Draw the roof's silhouette, not its parameters. A small section pad: the stroke is fitted into crease/smooth points.
import { useRef, useEffect } from 'preact/hooks';
import type { Overhead } from '../model/types';
import type { V2 } from '../model/geom2d';
import { sampleProfile, ohSpan, presetProfile, ProfilePreset } from '../model/overheadGeom';
import { fitProfile } from '../model/strokes';
import { opOverhead } from '../model/ops';
import { store } from '../store';

const W = 270, H = 112, PAD = 12;

export function ProfilePad({ oh }: { oh: Overhead }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const raw = useRef<V2[] | null>(null);
  const span = ohSpan(oh);
  const maxH = Math.max(3, ...oh.profile.map((p) => p.h)) * 1.25;
  const sx = (u: number) => PAD + u * (W - 2 * PAD);
  const sy = (h: number) => H - PAD - (h / maxH) * (H - 2 * PAD);
  const revolve = oh.form === 'revolve';

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
    g.setLineDash([]);
    // current profile
    const s = sampleProfile(oh.profile);
    g.strokeStyle = raw.current ? 'rgba(139,133,124,0.6)' : '#1f1c19';
    g.lineWidth = 2;
    g.beginPath();
    s.forEach((q, i) => (i ? g.lineTo(sx(q.u), sy(q.h)) : g.moveTo(sx(q.u), sy(q.h))));
    g.stroke();
    for (const q of oh.profile) {
      g.fillStyle = q.crease ? '#1f1c19' : '#fbf9f5';
      g.strokeStyle = '#1f1c19';
      g.lineWidth = 1.2;
      g.beginPath();
      if (q.crease) g.rect(sx(q.u) - 2.5, sy(q.h) - 2.5, 5, 5);
      else g.arc(sx(q.u), sy(q.h), 3, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    if (raw.current) {
      g.strokeStyle = '#2f4bd8';
      g.lineWidth = 2;
      g.beginPath();
      raw.current.forEach((q, i) => (i ? g.lineTo(sx(q[0]), sy(q[1])) : g.moveTo(sx(q[0]), sy(q[1]))));
      g.stroke();
    }
  };
  useEffect(draw);

  const toProfile = (e: PointerEvent): V2 => {
    const r = cv.current!.getBoundingClientRect();
    const u = (e.clientX - r.left - PAD) / (W - 2 * PAD);
    const h = ((H - PAD - (e.clientY - r.top)) / (H - 2 * PAD)) * maxH;
    return [u, h];
  };

  return (
    <div>
      <div class="pad" style={{ width: W + 'px', height: H + 'px' }}>
        <canvas
          ref={cv}
          style={{ width: W + 'px', height: H + 'px' }}
          onDblClick={(e) => {
            const [u, h] = toProfile(e as any);
            let bi = -1, bd = 0.06;
            oh.profile.forEach((q, i) => {
              const d = Math.hypot(q.u - u, (q.h - h) / maxH);
              if (d < bd) (bd = d), (bi = i);
            });
            if (bi < 0) return;
            const profile = oh.profile.map((q, i) => (i === bi ? { ...q, crease: !q.crease } : q));
            store.commit(`Made a point on ${oh.name} ${profile[bi].crease ? 'sharp' : 'smooth'}`, opOverhead(oh.id, { profile }));
          }}
          onPointerDown={(e) => {
            if (e.detail > 1) return;
            try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
            raw.current = [toProfile(e)];
            draw();
          }}
          onPointerMove={(e) => {
            if (!raw.current) return;
            raw.current.push(toProfile(e));
            draw();
          }}
          onPointerUp={() => {
            const r = raw.current;
            raw.current = null;
            if (!r || r.length < 3) return draw();
            let pts = r;
            if (pts[0][0] > pts[pts.length - 1][0]) pts = [...pts].reverse();
            const profile = fitProfile(pts, span);
            store.commit(`Drew a new profile for ${oh.name}`, opOverhead(oh.id, { profile }));
          }}
        />
        <div class="padhint">{revolve ? 'Draw half the section, edge → centre → edge — it spins round' : 'Draw the section, edge to edge — steps make glazing'}</div>
      </div>
      <div class="chips" style={{ marginTop: '6px' }}>
        {((revolve ? ['flat', 'dome', 'gable'] : ['flat', 'raked', 'gable', 'clerestory', 'vault', 'fold', 'sawtooth', 'butterfly']) as ProfilePreset[]).map((k) => (
          <button class="chip" onClick={() => store.commit(`Made ${oh.name} ${k === 'gable' && revolve ? 'a cone' : k}`, opOverhead(oh.id, { profile: presetProfile(k, span) }))}>
            {k === 'gable' && revolve ? 'cone' : k}
          </button>
        ))}
      </div>
      <div class="note" style={{ marginTop: '6px' }}>
        ■ sharp crease · ○ smooth. Double-click a point to switch it.
      </div>
    </div>
  );
}

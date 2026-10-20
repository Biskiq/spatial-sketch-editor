// The sheet: one piece of tracing vellum that slides through the building.
// It is the plane you draw on, the level you're working at, and the x-ray — all at once.
import { useRef, useState, useLayoutEffect } from 'preact/hooks';
import { store } from '../store';
import { derive } from '../model/derive';
import { lvl } from '../model/settle';

export function Rail() {
  const p = store.project;
  const d = derive(p);
  const v = store.view;
  const track = useRef<HTMLDivElement>(null);
  const [H, setH] = useState(300);
  const [drag, setDrag] = useState(false);
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    setH(el.clientHeight);
    return () => ro.disconnect();
  }, []);
  if (store.ui.mode === 'visit') return null;

  const minSnap = Math.min(0, ...d.snaps.map((s) => s.y));
  const lo = minSnap - 0.8;
  const hi = Math.max(6, d.bounds.top + 1, ...d.snaps.map((s) => s.y + 0.8));
  const yToPx = (y: number) => H - ((y - lo) / (hi - lo)) * H;
  const pxToY = (px: number) => lo + ((H - px) / H) * (hi - lo);

  // de-clutter labels: keep the more meaningful snap when two crowd each other
  const order = { ground: 0, floor: 1, deck: 2, top: 3, eave: 4, ridge: 5 } as const;
  const shown: typeof d.snaps = [];
  for (const s of [...d.snaps].sort((a, b) => order[a.kind] - order[b.kind])) {
    if (shown.some((t) => Math.abs(yToPx(t.y) - yToPx(s.y)) < 13)) continue;
    shown.push(s);
  }

  const setY = (clientY: number, magnet: boolean) => {
    const r = track.current!.getBoundingClientRect();
    let y = pxToY(clientY - r.top);
    let snapped = false;
    if (magnet) {
      for (const s of d.snaps) if (Math.abs(yToPx(s.y) - yToPx(y)) < 9) {
        y = s.y;
        snapped = true;
        break;
      }
    }
    if (!snapped) y = Math.round(y / 0.05) * 0.05;
    y = Math.max(lo + 0.2, Math.min(hi - 0.2, y));
    store.setView({ sheetOut: true, sheetY: lvl(y) }, v.sheetOut ? undefined : 'sheet');
  };

  const onThumbDown = (e: PointerEvent) => {
    e.preventDefault();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    setDrag(true);
    if (!v.sheetOut) store.setView({ sheetOut: true, sheetY: v.sheetY || 0 }, 'sheet');
  };
  const onMove = (e: PointerEvent) => drag && setY(e.clientY, !e.shiftKey);
  const onUp = () => setDrag(false);

  const thumbY = v.sheetOut ? yToPx(v.sheetY) : H + 14;
  const atSnap = d.snaps.find((s) => Math.abs(s.y - v.sheetY) < 0.01);
  const levels = new Map<number, number>();
  let col = 0;

  return (
    <div class="card rail" onPointerMove={onMove} onPointerUp={onUp}>
      <h4>The sheet</h4>
      <div class="sub">{v.sheetOut ? (atSnap ? `On ${atSnap.label}` : 'Drawing in the air') : 'Drag it up to draw roofs, decks and bridges'}</div>
      <div class="track" ref={track} onPointerDown={(e) => (e.target === track.current ? setY(e.clientY, true) : null)}>
        <div class="axis" />
        {d.rooms.map((r) => {
          const k = lvl(r.level);
          if (!levels.has(k)) levels.set(k, 0);
          const i = col++ % 7;
          return <div class="bar" title={r.name} style={{ left: 2 + i * 7 + 'px', top: yToPx(r.topY) + 'px', height: Math.max(2, yToPx(r.floorY) - yToPx(r.topY)) + 'px' }} />;
        })}
        {p.decks.map((dk) => (
          <div class="bar deck" title={dk.name} style={{ left: '4px', top: yToPx(dk.y) + 'px' }} />
        ))}
        {shown.map((s) => (
          <>
            <div class="tick" style={{ top: yToPx(s.y) + 'px' }} />
            <div class={'snap' + (v.sheetOut && Math.abs(v.sheetY - s.y) < 0.01 ? ' on' : '')} style={{ top: yToPx(s.y) + 'px' }} title={`${s.label} · ${s.y.toFixed(2)} m`} onClick={() => store.setView({ sheetOut: true, sheetY: s.y }, v.sheetOut ? undefined : 'sheet')}>
              {s.label}
            </div>
          </>
        ))}
        <div class={'thumb' + (v.sheetOut ? '' : ' resting')} style={{ top: Math.min(thumbY, H + 14) + 'px' }} onPointerDown={onThumbDown} title="Drag the sheet through the building · [ and ] jump between heights">
          {v.sheetOut ? `${v.sheetY >= 0 ? '+' : ''}${v.sheetY.toFixed(2)}` : 'sheet'}
        </div>
      </div>
      <div style={{ height: '16px' }} />
      <div class="row">
        <button class={'chip' + (v.cutMode === 'ghost' ? ' on' : '')} title="Above the sheet turns to tracing paper" onClick={() => store.setView({ cutMode: 'ghost' })}>
          X-ray
        </button>
        <button class={'chip' + (v.cutMode === 'cut' ? ' on' : '')} title="Cut through at eye height above the sheet, with a dark section fill" onClick={() => store.setView({ cutMode: 'cut' })}>
          Cut
        </button>
      </div>
      {v.sheetOut && (
        <button class="btn small outline" style={{ marginTop: '6px', width: '100%', justifyContent: 'center' }} onClick={() => store.setView({ sheetOut: false })}>
          Put away
        </button>
      )}
    </div>
  );
}

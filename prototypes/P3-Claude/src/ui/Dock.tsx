import { useState } from 'preact/hooks';
import { store } from '../store';
import { app } from './ctx';
import { setMode } from './TopBar';
import { OBJ_NAMES, opProject } from '../model/ops';
import type { ObjType, Palette } from '../model/types';
import { PALETTES } from '../scene/materials';
import { IPen, IPlace, ISlice, ILift, ICube, IPlan, IEye, IFrame, IPerson, ISwatch, IPin, IPlay } from './icons';

const OBJ_HINT: Record<ObjType, string> = {
  sculpture: 'stands on a floor',
  plinth: 'a low block to show on',
  bench: 'somewhere to sit',
  frame: 'hangs on a wall',
  tree: 'outside, or in a court',
  person: 'a figure for scale',
  screen: 'a free-standing panel',
};
const PAL_NAMES: Record<Palette, string> = { card: 'White card', basswood: 'Basswood', concrete: 'Concrete', terracotta: 'Terracotta' };

export function Dock() {
  const ui = store.ui;
  const v = store.view;
  const [pop, setPop] = useState<'none' | 'place' | 'palette'>('none');
  const [liftDown, setLiftDown] = useState(0);
  if (ui.mode === 'visit') return null;
  const tool = (t: typeof ui.tool) => store.set({ tool: t, placeType: t === 'place' ? ui.placeType : null });

  if (ui.mode === 'tell') {
    const p = store.project;
    return (
      <div class="card dock">
        <button class={'btn tool' + (ui.tool === 'pen' ? ' on' : '')} title="Draw the visitor’s walk. Start on the old walk’s end to continue it." onClick={() => tool('pen')}>
          <IPen /> Walk
        </button>
        <button class={'btn tool' + (ui.tool === 'moment' ? ' on' : '')} disabled={p.story.route.length < 2} title="Click on the walk to add a moment there" onClick={() => tool('moment')}>
          <IPin /> Add moment
        </button>
        <span class="sep" />
        <ViewChips />
        <span class="sep" />
        <button class="btn solid" disabled={p.story.route.length < 2} onClick={() => setMode('visit')}>
          <IPlay /> Play as visitor
        </button>
      </div>
    );
  }

  return (
    <>
      {pop === 'place' && (
        <div class="card pop" style={{ left: '0px' }}>
          {(Object.keys(OBJ_NAMES) as ObjType[]).map((t) => (
            <button
              class={'item' + (ui.tool === 'place' && ui.placeType === t ? ' on' : '')}
              onClick={() => {
                store.set({ tool: 'place', placeType: t, selection: null });
                setPop('none');
                store.toast(`Click a floor${t === 'frame' ? ' or a wall' : ''} to place a ${OBJ_NAMES[t].toLowerCase()} · Esc when done`);
              }}
            >
              <div>
                {OBJ_NAMES[t]}
                <small>{OBJ_HINT[t]}</small>
              </div>
            </button>
          ))}
        </div>
      )}
      {pop === 'palette' && (
        <div class="card pop" style={{ right: '0px' }}>
          {(Object.keys(PALETTES) as Palette[]).map((k) => (
            <button
              class={'item' + (store.project.palette === k ? ' on' : '')}
              onClick={() => {
                store.commit(`Model in ${PAL_NAMES[k].toLowerCase()}`, opProject({ palette: k }));
                setPop('none');
              }}
            >
              <span class="swatch" style={{ background: PALETTES[k].wall }} />
              <span class="swatch" style={{ background: PALETTES[k].floor, marginLeft: '-6px' }} />
              {PAL_NAMES[k]}
            </button>
          ))}
        </div>
      )}
      <div class="card dock">
        <button class={'btn tool' + (ui.tool === 'pen' ? ' on' : '')} title="The pen: drag to draw, click to pick, drag blue handles to shape" onClick={() => (tool('pen'), setPop('none'))}>
          <IPen /> Pen
        </button>
        <button class={'btn tool' + (ui.tool === 'place' ? ' on' : '')} title="Put things in the building" onClick={() => setPop(pop === 'place' ? 'none' : 'place')}>
          <IPlace /> {ui.tool === 'place' && ui.placeType ? OBJ_NAMES[ui.placeType] : 'Place'}
        </button>
        <span class="sep" />
        <button class={'btn tool' + (ui.tool === 'slice' ? ' on' : '')} title="Draw a line across the building to see it in section" onClick={() => tool(ui.tool === 'slice' ? 'pen' : 'slice')}>
          <ISlice /> Slice
        </button>
        <button
          class={'btn tool' + (v.liftPinned || v.liftHeld ? ' on' : '')}
          title="Hold to lift roofs and upper floors apart · click to keep them up (L / ⇧L)"
          onPointerDown={() => {
            setLiftDown(performance.now());
            store.setView({ liftHeld: true });
          }}
          onPointerUp={() => {
            const quick = performance.now() - liftDown < 260;
            store.setView({ liftHeld: false });
            if (quick) store.setView({ liftPinned: !v.liftPinned }, v.liftPinned ? undefined : 'lift');
          }}
          onPointerLeave={() => v.liftHeld && store.setView({ liftHeld: false })}
        >
          <ILift /> Lift
        </button>
        <span class="sep" />
        <ViewChips />
        <span class="sep" />
        <button class={'btn' + (ui.people ? ' on' : '')} title="Scale figures (P)" onClick={() => store.set({ people: !ui.people })}>
          <IPerson />
        </button>
        <button class="btn" title="Model material" onClick={() => setPop(pop === 'palette' ? 'none' : 'palette')}>
          <ISwatch />
        </button>
      </div>
    </>
  );
}

function ViewChips() {
  const eye = app.stage?.ctl.mode === 'eye';
  return (
    <>
      <button class="btn" title="Model view (1)" onClick={() => app.ix.view('model')}>
        <ICube />
      </button>
      <button class="btn" title="Plan view (2)" onClick={() => app.ix.view('plan')}>
        <IPlan />
      </button>
      <button class={'btn' + (eye ? ' on' : '')} title="Stand inside at eye height (3)" onClick={() => app.ix.view('eye')}>
        <IEye />
      </button>
      <button class="btn" title="Frame everything (F)" onClick={() => app.ix.frameAll()}>
        <IFrame />
      </button>
    </>
  );
}

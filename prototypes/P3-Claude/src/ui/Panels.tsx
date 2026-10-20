import type { ComponentChildren } from 'preact';
import { store } from '../store';
import { app } from './ctx';
import { derive, elementName } from '../model/derive';
import { opAck, opUnack, opFix, opRestoreOpening, opRestoreObj, opRestoreRoomSettings, opForgetParked } from '../model/ops';
import { opMoment, opRemoveMoment, opStoryIntro, opRoute, REVEALS } from '../story/storyOps';
import { setMode } from './TopBar';
import { IClose, IPlay } from './icons';
import type { Moment, Reveal, Opening, Obj } from '../model/types';
import { runGeom } from '../model/runs';
import { floorUnder } from '../model/derive';

function Panel({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <div class="card panel" onPointerDown={(e) => e.stopPropagation()}>
      <button class="btn small close" onClick={() => store.set({ panel: 'none' })}>
        <IClose />
      </button>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ what's real
const TRUTH: [string, string, string][] = [
  ['real', 'Drawing', 'Stroke reading and fitting (lines, arcs, one-piece circles), alternative readings, rooms emerging from walls, per-room heights, openings and arches on any wall, roofs from a drawn profile, decks, bridges, voids, stairs and ramps from a drawn walk.'],
  ['real', 'Revision', 'Ties and knots, ripples with choices that amend the same step, loose ends, the set-aside tray, room memory through divide and merge, whole-building scale with intents, one-step undo/redo. All of it runs here, in your browser.'],
  ['real', 'Looking', 'The sheet (draw plane, level and x-ray), cut with section fill, slice, lift, isolate, and the view history behind Esc. Sun shadows are real-time.'],
  ['real', 'Telling', 'The visitor’s walk (it climbs stairs from the surfaces under it), moments with captions, targets and reveals, and the visitor player.'],
  ['real', 'Files', '.glb / .gltf import (drop a file), autosave to this browser (localStorage), JSON export.'],
  ['prepared', 'Samples', 'The four starting projects were built by me with the same operations you use. Every part of them is editable.'],
  ['prepared', 'Boathouse', 'The “imported” boathouse is a mesh made in code to stand in for a file from another tool.'],
  ['sim', 'Light shaft', 'The glowing column under a lightwell is a visual effect, not light simulation.'],
  ['sim', 'Support', 'Whether something is held up is a rule of thumb (its edges must run near a wall or a post; short free stretches are allowed) — not engineering.'],
  ['sim', 'Fit checks', 'Headroom, stair steepness and opening fit use simple thresholds, not building codes.'],
  ['no', 'Imports', 'An imported mesh is shown as it came: cutting it shows it hollow (no section fill), and it has no rooms, heights or openings until you trace over it.'],
  ['no', 'Not here', 'Reshaping imported meshes, terrain, materials beyond the four palettes, real publishing or sharing, multiplayer, code-compliant stairs, structure, construction drawings.'],
];
const TAG: Record<string, string> = { real: 'Real', prepared: 'Prepared', sim: 'Simulated', no: 'Unsupported' };

export function TruthPanel() {
  return (
    <Panel title="What’s real?">
      <p>This is a prototype. Here is exactly what it does, and what it only pretends to.</p>
      {TRUTH.map(([t, h, b]) => (
        <div class="truth-row">
          <span class={'tag ' + t}>{TAG[t]}</span>
          <div>
            <b>{h}.</b> {b}
          </div>
        </div>
      ))}
      <h5>When another tool is simply better</h5>
      <p>
        Bring a model in from Rhino, SketchUp, Blender or Revit when you need ornament, detailed façades, freeform surfaces, terrain, or construction documents and BIM data. Biskiq is better for the parts you will keep changing: rooms,
        heights, levels, openings, light — and for telling it to visitors.
      </p>
    </Panel>
  );
}

// ------------------------------------------------------------------ help
const TRY: [string, string][] = [
  ['A curved gallery and a round room', 'Draw one long sweeping stroke, then a circle that touches it. Draw an arch shape on the wall between. The circle is one continuous wall with a centre and a size handle.'],
  ['Drama overhead', 'Open “Galleries”. Pick the roof — draw a new profile in the pad: a rise with a step makes clerestory glazing. Ceilings below stay flat unless you open them to the roof.'],
  ['A canopy past the footprint', 'Pull the sheet up to a room top and draw a shape beyond the walls. Posts appear in pencil; click one to accept.'],
  ['Too small?', 'Press ⌘A for the whole building and drag the corner handle. Doors stay person-sized; round stays round.'],
  ['Divide, then undivide', 'Draw a wall across a room. The new half borrows settings in pencil. Remove the wall: the room is whole again, and a changed half’s settings go to the tray, not the bin.'],
  ['Remove something others lean on', 'Pick a wall under a roof and hover Remove. What it touches turns red first. After, the ripple offers posts or shrinking.'],
  ['Levels', 'Open “Two wings”. Raise one room’s floor to make a plinth. With the sheet out, draw a line between the wings for a bridge, and a line from floor to deck for a stair.'],
  ['Atrium, partly closed', 'Open “Compression”. Pick the lightwell and drag its lower bead up — the deck fills back in because its outline was never changed.'],
  ['Move something across levels', 'Slide the sheet down so upper floors ghost, then drag the sculpture onto the lower floor.'],
  ['Tell it', 'Switch to Tell, draw the visitor’s walk, add moments, choose reveals, then Play.'],
];
const KEYS: [string, string][] = [
  ['drag', 'draw · or drag a handle'],
  ['click', 'pick'],
  ['Tab', 'another reading of what you just drew'],
  ['right-drag / ⌥-drag', 'turn the table'],
  ['two-finger scroll', 'turn · pinch to zoom · ⇧ to pan'],
  ['[  ]', 'move the sheet down / up a height'],
  ['L (hold) · ⇧L', 'lift apart · keep lifted'],
  ['double-click', 'isolate one thing · in eye view, step there'],
  ['1 2 3 · F', 'model · plan · eye · frame all'],
  ['Q E', 'turn 45°'],
  ['⌘Z · ⇧⌘Z', 'undo · redo'],
  ['Esc', 'back to exactly where you were'],
  ['Delete', 'remove what’s picked'],
];

export function HelpPanel() {
  return (
    <Panel title="Things to try">
      {TRY.map(([t, b]) => (
        <div class="try">
          <div class="ttl">{t}</div>
          <p>{b}</p>
        </div>
      ))}
      <h5>Keys</h5>
      <div class="keys">
        {KEYS.map(([k, v]) => (
          <>
            <span>{k}</span>
            <span>{v}</span>
          </>
        ))}
      </div>
      <h5>The marks</h5>
      <p>
        <b>Ink</b> is accepted work. <b style={{ color: 'var(--pencil)' }}>Pencil</b> is a suggestion — nothing becomes ink until you accept it. <b style={{ color: 'var(--red)' }}>Red</b> is a consequence that wants a look.{' '}
        <b style={{ color: 'var(--blue)' }}>Blue</b> is your hand: what’s picked, and its handles.
      </p>
    </Panel>
  );
}

// ------------------------------------------------------------------ history
export function HistoryPanel() {
  const fmt = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <Panel title="History">
      <p class="note">Every edit is one step, with its choices inside it. Click to go back to any point; the later steps stay below, struck through, until you change something.</p>
      <div class={'hist' + (!store.past.length ? ' cur' : '')} onClick={() => store.jumpTo(-1)}>
        <span>Start</span>
      </div>
      {store.past.map((t) => (
        <div class={'hist' + (t === store.top ? ' cur' : '')} onClick={() => store.jumpTo(t.id)}>
          <span>{t.label}</span>
          <time>{fmt(t.time)}</time>
        </div>
      ))}
      {[...store.future].reverse().map((t) => (
        <div
          class="hist future"
          onClick={() => {
            while (store.future.length && store.top?.id !== t.id) store.redo();
          }}
        >
          <span>{t.label}</span>
          <time>{fmt(t.time)}</time>
        </div>
      ))}
    </Panel>
  );
}

// ------------------------------------------------------------------ set-aside tray
export function TrayPanel() {
  const p = store.project;
  const d = derive(p);
  return (
    <Panel title="Set aside">
      <p class="note">Things that lost their place go here instead of the bin. Put them back, or let them go on purpose.</p>
      {!p.parked.length && <p>Nothing set aside.</p>}
      {p.parked.map((k) => {
        let put: any = null;
        if (k.what === 'opening') {
          const o = k.data as Opening;
          const own = p.runs.find((r) => r.id === o.run);
          const walls = own ? [own] : p.runs;
          put = walls.length ? (
            <select
              onChange={(e) => {
                const r = p.runs.find((x) => x.id === (e.target as HTMLSelectElement).value);
                if (r) store.commit(`Put back the ${k.label}`, opRestoreOpening(k.id, r.id, Math.min(runGeom(r).L / 2, own ? o.t * runGeom(r).L : runGeom(r).L / 2)));
              }}
            >
              <option>Put back on…</option>
              {walls.map((r) => (
                <option value={r.id}>{elementName(p, r.id)}</option>
              ))}
            </select>
          ) : (
            <span class="note">No wall to put it on yet.</span>
          );
        } else if (k.what === 'obj') {
          const o = k.data as Obj;
          put = (
            <button
              class="chip blue"
              onClick={() => {
                const f = floorUnder(p, d, o.at);
                store.commit(`Put back ${k.label}`, opRestoreObj(k.id, o.at, f.ref));
              }}
            >
              Put back on the floor
            </button>
          );
        } else if (k.what === 'room') {
          put = (
            <select onChange={(e) => store.commit(`Used ${k.label}`, opRestoreRoomSettings(k.id, (e.target as HTMLSelectElement).value))}>
              <option>Use for room…</option>
              {d.rooms.map((r) => (
                <option value={r.id}>{r.name}</option>
              ))}
            </select>
          );
        }
        return (
          <div class="item-row">
            <div class="ttl">{k.label}</div>
            <div class="sub">Set aside because {k.reason}.</div>
            <div class="chips">
              {put}
              <button class="chip" onClick={() => store.commit(`Let go of ${k.label}`, opForgetParked(k.id))}>
                Let it go
              </button>
            </div>
          </div>
        );
      })}
    </Panel>
  );
}

// ------------------------------------------------------------------ loose ends
export function IssuesPanel() {
  const all = store.issues();
  const open = all.filter((i) => !i.acknowledged);
  const ack = all.filter((i) => i.acknowledged);
  const focus = store.ui.issueFocus;
  const row = (i: (typeof all)[number]) => (
    <div class="item-row" style={focus === i.key ? { background: 'var(--red-soft)', margin: '0 -8px', padding: '10px 8px', borderRadius: '8px' } : undefined} onPointerEnter={() => store.set({ issueFocus: i.key })}>
      <div class="ttl" style={{ color: i.acknowledged ? 'var(--ink-2)' : 'var(--red)' }}>{i.text}</div>
      <div class="chips" style={{ marginTop: '6px' }}>
        {i.fixes.map((f, k) => (
          <button class="chip red" onClick={() => store.commit(f.label, opFix(i.key, k))}>
            {f.label}
          </button>
        ))}
        <button class="chip" onClick={() => store.select(i.ids[0] ?? null)}>
          Show me
        </button>
        {i.acknowledged ? (
          <button class="chip" onClick={() => store.commit('Reopened a loose end', opUnack(i.key))}>
            Reopen
          </button>
        ) : (
          <button class="chip pencil" title="It's intended — stop flagging it" onClick={() => store.commit('Accepted it as it is', opAck(i.key))}>
            It’s meant to be
          </button>
        )}
      </div>
    </div>
  );
  return (
    <Panel title="Loose ends">
      <p class="note">Consequences of your edits that may want a look. They never block you, and nothing was changed to hide them.</p>
      {!open.length && <p>All tidy.</p>}
      {open.map(row)}
      {ack.length > 0 && (
        <>
          <h5>Accepted as they are</h5>
          {ack.map(row)}
        </>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------ story
export function StoryPanel() {
  const p = store.project;
  const s = p.story;
  const ms = [...s.moments].sort((a, b) => a.t - b.t);
  const focus = store.ui.momentFocus;
  const patch = (m: Moment, x: Partial<Moment>, label = 'Edited a moment') => store.commit(label, opMoment(m.id, x));
  return (
    <Panel title="The story">
      <p class="note">The building is locked. Draw the visitor’s walk with the pen; click on it to add moments. Each moment can say something, look at something, and reveal something.</p>
      <div class="chips" style={{ margin: '8px 0' }}>
        <button class={'chip' + (s.intro ? ' on' : '')} onClick={() => store.commit(s.intro ? 'No opening shot' : 'Open with the model lifted apart', opStoryIntro(!s.intro))} title="The visit opens on the model lifted apart, settling as you walk in">
          Open on the lifted model
        </button>
        {s.route.length > 1 && (
          <button class="chip" onClick={() => store.commit('Erased the walk', opRoute([], 0, true))}>
            Erase the walk
          </button>
        )}
      </div>
      {s.route.length < 2 && <p>No walk yet — drag one through the building.</p>}
      {ms.map((m, i) => (
        <div class={'moment' + (focus === m.id ? ' focus' : '')} onClick={() => focus !== m.id && store.set({ momentFocus: m.id })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span class="num-dot">{i + 1}</span>
            <span class="note" style={{ flex: 1 }}>{Math.round(m.t * 100)}% along the walk</span>
            <button class="btn small" title="Play from here" onClick={() => app.player.canPlay(p) && app.player.start(i)}>
              <IPlay />
            </button>
            <button class="btn small" title="Remove moment" onClick={() => store.commit('Removed a moment', opRemoveMoment(m.id))}>
              <IClose />
            </button>
          </div>
          <textarea
            key={m.id + m.caption}
            defaultValue={m.caption}
            placeholder="What should the visitor hear here?"
            onBlur={(e) => {
              const v = (e.target as HTMLTextAreaElement).value;
              if (v !== m.caption) patch(m, { caption: v }, 'Wrote a caption');
            }}
          />
          <div class="row">
            <select value={m.reveal} onChange={(e) => patch(m, { reveal: (e.target as HTMLSelectElement).value as Reveal }, 'Chose a reveal')} title={REVEALS.find((r) => r.id === m.reveal)?.hint}>
              {REVEALS.map((r) => (
                <option value={r.id}>{r.label}</option>
              ))}
            </select>
            <button class={'chip' + (store.ui.tool === 'aim' && focus === m.id ? ' on' : m.look ? '' : ' blue')} onClick={() => store.set({ tool: 'aim', momentFocus: m.id })}>
              {m.look ? 'Re-aim' : 'Aim at…'}
            </button>
            <select value={String(m.dwell)} onChange={(e) => patch(m, { dwell: +(e.target as HTMLSelectElement).value }, 'Changed the pause')}>
              {[...new Set([2, 3, 4, 5, 7, 10, m.dwell])].sort((a, b) => a - b).map((x) => (
                <option value={String(x)}>{x} s pause</option>
              ))}
            </select>
          </div>
          <div class="note" style={{ marginTop: '4px' }}>{REVEALS.find((r) => r.id === m.reveal)?.hint}</div>
        </div>
      ))}
      {s.route.length > 1 && (
        <button class="btn solid" style={{ marginTop: '8px' }} onClick={() => setMode('visit')}>
          <IPlay /> Play as visitor
        </button>
      )}
    </Panel>
  );
}

export function Panels() {
  const ui = store.ui;
  if (ui.mode === 'visit' || ui.start) return null;
  switch (ui.panel) {
    case 'truth': return <TruthPanel />;
    case 'help': return <HelpPanel />;
    case 'history': return <HistoryPanel />;
    case 'tray': return <TrayPanel />;
    case 'issues': return <IssuesPanel />;
    case 'story': return ui.mode === 'tell' ? <StoryPanel /> : null;
  }
  return null;
}

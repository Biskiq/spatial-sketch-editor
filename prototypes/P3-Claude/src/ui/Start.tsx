import { store } from '../store';
import { app } from './ctx';
import { SAMPLES } from '../samples/samples';
import { emptyProject } from '../model/types';

export function Start() {
  if (!store.ui.start) return null;
  const recent = store.recent();
  const hasCurrent = store.project.runs.length > 0 || store.past.length > 0;
  const go = (f: () => void) => {
    f();
    store.set({ start: false });
    requestAnimationFrame(() => app.ix.frameAll());
  };
  return (
    <div class="start">
      <div class="card sheet">
        <h1>
          Biskiq <i>Vellum</i>
        </h1>
        <p class="lede">
          A drafting table for making and remaking buildings. Hold one pen: walls, arches, roofs, floors in the air, stairs and a visitor’s walk are all <em>drawn</em> — and the table says what it read, so you can change its mind with a tap.
          Every later edit is honest about what it touches.
        </p>
        <div class="marks">
          <div class="mark">
            <b>Ink</b>accepted work — never changed without telling you
          </div>
          <div class="mark pencil">
            <b>Pencil</b>suggestions — nothing becomes ink until you accept it
          </div>
          <div class="mark red">
            <b>Red pencil</b>consequences that want a look, with repairs
          </div>
          <div class="mark blue">
            <b>Blue</b>your hand — what’s picked and its handles
          </div>
        </div>
        <div class="grid">
          <button class="tile primary" onClick={() => go(() => store.load(emptyProject()))}>
            <span class="who">start fresh</span>
            <span class="tt">A blank table</span>
            <span class="bl">Drag to draw your first wall. Close it into a room; draw a circle for a round one.</span>
          </button>
          {SAMPLES.map((s) => (
            <button class="tile" onClick={() => go(() => store.load(s.make()))}>
              <span class="who">prepared · for {s.who}</span>
              <span class="tt">{s.title}</span>
              <span class="bl">{s.blurb}</span>
            </button>
          ))}
          <button class="tile dashed" onClick={() => go(() => app.openPrepared())}>
            <span class="who">prepared import</span>
            <span class="tt">An old boathouse, imported</span>
            <span class="bl">A mesh “from another tool”: inspect, slice, furnish and tell it — or trace over it to make it native. Or drop your own .glb anywhere.</span>
          </button>
        </div>
        {(recent.length > 0 || hasCurrent) && (
          <div style={{ marginTop: '18px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {hasCurrent && (
              <button class="btn solid" onClick={() => store.set({ start: false })}>
                Back to {store.project.name}
              </button>
            )}
            {recent
              .filter((r) => r.id !== store.project.id)
              .slice(0, 5)
              .map((r) => (
                <button class="btn outline" onClick={() => go(() => store.openRecent(r.id))}>
                  {r.name}
                </button>
              ))}
            <span class="note" style={{ marginLeft: '6px' }}>
              Saved in this browser only.
            </span>
            <button class="btn small" onClick={() => app.exportJSON()}>
              Export current as JSON
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

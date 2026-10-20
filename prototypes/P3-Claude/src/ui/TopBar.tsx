import { store } from '../store';
import { app } from './ctx';
import { opProject } from '../model/ops';
import { IUndo, IRedo, IClock, ITray, IHelp, ITruth, Logo, IMenu } from './icons';
import type { Mode, UIState } from '../store';

export function setMode(m: Mode) {
  if (m === 'visit') {
    if (!app.player.canPlay(store.project)) {
      store.set({ mode: 'tell', tool: 'pen', panel: 'story', selection: null });
      store.toast('Draw the visitor’s walk first — drag a path through the building');
      return;
    }
    app.player.start();
    return;
  }
  if (store.ui.mode === 'visit') app.player.stop();
  store.set({ mode: m, tool: 'pen', placeType: null, selection: m === 'tell' ? null : store.ui.selection, panel: m === 'tell' ? 'story' : store.ui.panel === 'story' ? 'none' : store.ui.panel });
}

const togglePanel = (p: UIState['panel']) => store.set({ panel: store.ui.panel === p ? 'none' : p });

export function TopBar() {
  const p = store.project;
  const ui = store.ui;
  const open = store.issues().filter((i) => !i.acknowledged).length;
  const tray = p.parked.length;
  return (
    <div class="topbar">
      <div class="card brand">
        <Logo />
        <span class="name">Biskiq</span>
        <span class="vellum">Vellum</span>
        <span class="sep" />
        <input
          value={p.name}
          title="Rename the project"
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          onBlur={(e) => {
            const v = (e.target as HTMLInputElement).value.trim();
            if (v && v !== p.name) store.commit('Renamed the project', opProject({ name: v }));
          }}
        />
        <button class="btn small" title="Open another project" onClick={() => store.set({ start: true })}>
          <IMenu />
        </button>
      </div>

      <div class="center-col">
        <div class="card modes" role="tablist">
          {(['make', 'tell', 'visit'] as Mode[]).map((m) => (
            <button class={ui.mode === m ? 'on' : ''} onClick={() => setMode(m)} title={m === 'make' ? 'Build and revise' : m === 'tell' ? 'Turn it into a walk with moments' : 'See it as a visitor would'}>
              {m === 'make' ? 'Make' : m === 'tell' ? 'Tell' : 'Visit'}
            </button>
          ))}
        </div>
        <PeekPill />
      </div>

      <div class="card right-tools">
        <button class="btn" disabled={!store.past.length} title="Undo (⌘Z)" onClick={() => store.undo()}>
          <IUndo />
        </button>
        <button class="btn" disabled={!store.future.length} title="Redo (⇧⌘Z)" onClick={() => store.redo()}>
          <IRedo />
        </button>
        <span class="sep" />
        <button class={'btn' + (ui.panel === 'issues' ? ' on' : '')} title="Loose ends — consequences that still want a look" onClick={() => togglePanel('issues')}>
          Loose ends <span class={'badge' + (open ? ' red' : '')}>{open}</span>
        </button>
        <button class={'btn' + (ui.panel === 'tray' ? ' on' : '')} title="Set aside — nothing is deleted as a side effect" onClick={() => togglePanel('tray')}>
          <ITray /> <span class={'badge' + (tray ? ' pencil' : '')}>{tray}</span>
        </button>
        <button class={'btn' + (ui.panel === 'history' ? ' on' : '')} title="History" onClick={() => togglePanel('history')}>
          <IClock />
        </button>
        <span class="sep" />
        <button class={'btn' + (ui.panel === 'truth' ? ' on' : '')} title="What in this prototype is real, prepared or simulated" onClick={() => togglePanel('truth')}>
          <ITruth /> What’s real?
        </button>
        <button class={'btn' + (ui.panel === 'help' ? ' on' : '')} title="Things to try, and keys" onClick={() => togglePanel('help')}>
          <IHelp />
        </button>
      </div>
    </div>
  );
}

function PeekPill() {
  const ui = store.ui;
  if (ui.mode === 'tell')
    return (
      <div class="locked">
        Building locked while you tell its story · <a href="#" onClick={(e) => (e.preventDefault(), setMode('make'))}>back to Make</a>
      </div>
    );
  const im = store.project.imported;
  if (!store.peeking && im?.display === 'underlay')
    return (
      <div class="peek">
        <span>
          Tracing over <b>{im.name}</b> — draw on top to make it native
        </span>
        <button class="btn small outline" onClick={() => store.commit('Showed the import solid', (q) => void (q.imported && (q.imported.display = 'solid')))}>
          Show solid
        </button>
      </div>
    );
  if (!store.peeking) return null;
  return (
    <div class="peek">
      <span>
        <b>Peeking</b> — building unchanged · {store.peekLabel()}
      </span>
      <button class="btn small outline" onClick={() => store.back()}>
        Back <span class="kbd">Esc</span>
      </button>
    </div>
  );
}

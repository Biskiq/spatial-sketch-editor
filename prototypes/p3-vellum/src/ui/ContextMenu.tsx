// The roof's context menu: an alternate way into Edit Shape, not a prerequisite for anything.
import { store } from '../store';
import { qualifyRidgeTurn } from '../model/roofEdits';
import { opRemove, removalReach } from '../model/ops';
import { elementName } from '../model/derive';
import { enterShaping } from './shaping';

export function ContextMenu() {
  const menu = store.ui.menu;
  if (!menu) return null;
  const p = store.project;
  const oh = p.overheads.find((o) => o.id === menu.id);
  if (!oh) return null;
  const turn = qualifyRidgeTurn(p, oh.id);
  const close = () => store.set({ menu: null, removePreview: null });
  const left = Math.max(4, Math.min(menu.at[0], (window.innerWidth || 1200) - 230));
  const top = Math.max(4, Math.min(menu.at[1], (window.innerHeight || 800) - 150));
  return (
    <>
      <div class="menu-backdrop" onPointerDown={close} />
      <div class="context-menu" style={{ left: left + 'px', top: top + 'px' }} onPointerDown={(e) => e.stopPropagation()}>
        <div class="lab">{oh.name}</div>
        <button onClick={() => { close(); enterShaping(oh.id); }}>Edit shape</button>
        <button
          disabled={!turn.available || !!turn.reason || !turn.op}
          title={turn.reason || (turn.available ? 'Turn the ridge to the next direction this outline supports' : 'This roof has no other direction')}
          onPointerEnter={() => turn.op && !turn.reason && store.setPreview(turn.op)}
          onPointerLeave={() => store.setPreview(null)}
          onClick={() => {
            if (!turn.op || turn.reason) return;
            store.setPreview(null);
            close();
            store.commit(`Turned ${oh.name}’s ridge`, turn.op);
          }}
        >
          Turn the ridge
        </button>
        <button
          onPointerEnter={() => store.set({ removePreview: [oh.id, ...removalReach(p, [oh.id])] })}
          onPointerLeave={() => store.set({ removePreview: null })}
          onClick={() => {
            close();
            store.commit(`Removed ${elementName(p, oh.id)}`, opRemove([oh.id]));
          }}
        >
          Remove
        </button>
      </div>
    </>
  );
}

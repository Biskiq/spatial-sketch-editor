// The running pieces the UI talks to, and a hook that re-renders on every store change.
import { useEffect, useState } from 'preact/hooks';
import type { Stage } from '../scene/stage';
import type { Overlays } from '../scene/overlays';
import type { Interact } from '../scene/interact';
import type { Player } from '../story/player';
import { store } from '../store';
import type { Op } from '../model/ops';

export interface AppRefs {
  stage: Stage;
  ov: Overlays;
  ix: Interact;
  player: Player;
  importFile: (f: File) => void;
  openPrepared: () => void;
  exportJSON: () => void;
}

export const app = {} as AppRefs;

export function useStore() {
  const [, set] = useState(0);
  useEffect(() => store.subscribe(() => set((v) => v + 1)) as () => void, []);
  return store;
}

export function usePlayer() {
  const [, set] = useState(0);
  useEffect(() => (app.player ? (app.player.on(() => set((v) => v + 1)) as () => void) : undefined), []);
  return app.player;
}

/** Live preview while a slider moves; one undo step when it is let go. */
export function liveProps(label: string, make: (v: number) => Op) {
  return {
    onInput: (e: Event) => store.setPreview(make(+(e.target as HTMLInputElement).value)),
    onChange: (e: Event) => store.commit(label, make(+(e.target as HTMLInputElement).value)),
  };
}

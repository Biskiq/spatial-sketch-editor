import { describe, it, expect, afterEach } from 'vitest';
import type { Stage } from '../src/scene/stage';
import { handlesFor } from '../src/scene/handles';
import { emptyProject, type Project, type Overhead } from '../src/model/types';
import { runTxn, opAddOverhead, opRemove } from '../src/model/ops';
import { derive } from '../src/model/derive';
import { presetProfile } from '../src/model/overheadGeom';
import { readSection } from '../src/model/section';
import { store } from '../src/store';

const stage = { mpp: () => 0.002, liftOf: () => 0 } as unknown as Stage;
const ordinary = { altKey: false, shiftKey: false } as unknown as PointerEvent;

function roof(preset: 'gable' | 'clerestory' = 'gable'): { p: Project; oh: Overhead } {
  const p = runTxn(emptyProject(), opAddOverhead([[0, 0], [10, 0], [10, 6], [0, 6]], 3, { dir: 0, profile: presetProfile(preset, 10) })).after;
  return { p, oh: p.overheads[0] };
}

function shaping(oh: Overhead) {
  store.ui = { ...store.ui, mode: 'make', tool: 'select', selection: oh.id, shaping: oh.id };
}

afterEach(() => {
  store.ui = { ...store.ui, shaping: null, seeThrough: false };
  store.base = emptyProject();
  store.past = [];
  store.preview = null;
});

describe('Edit Shape in 3D', () => {
  it('puts a section joint on every joint, plus the outline and the eave', () => {
    const { p, oh } = roof();
    shaping(oh);
    const hs = handlesFor(stage, p, derive(p), oh.id);
    const joints = readSection(oh.profile).joints;
    for (const j of joints) expect(hs.some((h) => h.id === `j:${j.id}`)).toBe(true);
    expect(hs.some((h) => h.id.startsWith('n:'))).toBe(true);
    expect(hs.some((h) => h.id.startsWith('e:'))).toBe(true);
    expect(hs.some((h) => h.id === 'eave')).toBe(true);
    // all of them are primary tier: shaping is the detailed depth, so nothing hides behind the pointer
    expect(hs.every((h) => h.tier === 'primary')).toBe(true);
  });

  it('gives a step both of its edges and its slide grip', () => {
    const { p, oh } = roof('clerestory');
    shaping(oh);
    const step = readSection(oh.profile).joints.find((j) => j.kind === 'step')!;
    const hs = handlesFor(stage, p, derive(p), oh.id);
    expect(hs.some((h) => h.id === `jlo:${step.id}`)).toBe(true);
    expect(hs.some((h) => h.id === `jhi:${step.id}`)).toBe(true);
    expect(hs.some((h) => h.id === `j:${step.id}`)).toBe(true);
  });

  it('previews the same profile a ridge-joint drag commits', () => {
    const { p, oh } = roof();
    shaping(oh);
    const ridge = readSection(oh.profile).joints.find((j) => j.kind === 'ridge')!;
    const h = handlesFor(stage, p, derive(p), oh.id).find((x) => x.id === `j:${ridge.id}`)!;
    const res = h.drag({ plan: [5, 3], y: 6.2 }, ordinary);
    expect(res?.op).toBeTruthy();
    expect(res?.reason).toBeUndefined();
    const previewed = runTxn(p, res!.op!).after.overheads[0].profile;
    const committed = runTxn(p, res!.op!).after.overheads[0].profile;
    expect(committed).toStrictEqual(previewed);
    expect(previewed.find((q) => q.id === ridge.id)!.h).toBeGreaterThan(ridge.h);
  });

  it('ends shaping when another thing is selected or the roof is removed, and keeps it through undo', () => {
    const { p, oh } = roof();
    store.base = p;
    store.past = [];
    shaping(oh);
    expect(store.ui.shaping).toBe(oh.id);
    store.select('something-else');
    expect(store.ui.shaping).toBeNull();

    shaping(oh);
    store.commit('Removed the roof', opRemove([oh.id]));
    expect(store.ui.shaping).toBeNull();

    const { p: q, oh: oh2 } = roof();
    store.base = q;
    store.past = [];
    shaping(oh2);
    store.commit('Made it flatter', (x) => {
      const o = x.overheads.find((y) => y.id === oh2.id)!;
      o.profile = presetProfile('flat', 10);
    });
    store.undo();
    expect(store.ui.shaping).toBe(oh2.id);
  });
});

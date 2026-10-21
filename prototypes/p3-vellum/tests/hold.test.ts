import { describe, expect, it } from 'vitest';
import type { Stage } from '../src/scene/stage';
import { handlesFor, zoneHandle } from '../src/scene/handles';
import { emptyProject, type Project, type ProfilePt } from '../src/model/types';
import { runTxn, opAddOverhead, opAddRun, opCoverRooms } from '../src/model/ops';
import { ohHasSurface, ohSpan, ohTopAt, nextRidgeDir, presetProfile, profileH, profilePeak, sampleProfile, pullShoulder } from '../src/model/overheadGeom';
import { roofZoneAt } from '../src/model/roofZones';
import type { V2 } from '../src/model/geom2d';
import { cleanSection } from '../src/model/section';
import { qualifyRidgeTurn, qualifyRoofEdit, withRoofProfiles } from '../src/model/roofEdits';
import { derive } from '../src/model/derive';
import { roofWingsState } from '../src/model/wings';
import { Interact } from '../src/scene/interact';
import { store } from '../src/store';
import { straighteningStop } from '../src/model/detents';

const stage = { mpp: () => 0.002, liftOf: () => 0 } as unknown as Stage;
const alt = { altKey: true } as unknown as PointerEvent;
const ordinary = { altKey: false } as unknown as PointerEvent;
const gable: ProfilePt[] = [
  { u: 0, h: 0, crease: true, id: 'a' },
  { u: 0.5, h: 2, crease: true, id: 'b' },
  { u: 1, h: 0, crease: true, id: 'c' },
];

function roof(preset: 'flat' | 'gable' = 'gable', outline: V2[] = [[0, 0], [6, 0], [6, 10], [0, 10]], compound = false, profile?: ProfilePt[]) {
  const p: Project = runTxn(emptyProject(), opAddOverhead(outline, 3, { dir: 0, preset, oneSpan: compound ? false : undefined, profile: profile ?? presetProfile(preset, 6) })).after;
  return { p, oh: p.overheads[0] };
}

function flushed(p: Project, selection: string, handle: any, target: { plan: V2; y: number }, event: PointerEvent) {
  store.base = p;
  store.past = [];
  store.future = [];
  store.preview = null;
  store.ui = { ...store.ui, selection, mode: 'make', tool: 'select' };
  const interaction: any = Object.create(Interact.prototype);
  Object.assign(interaction, {
    stage,
    state: 'handle',
    handle,
    handleStartProject: p,
    handleStartSelection: selection,
    handleZone: null,
    handleOp: null,
    handleChanged: false,
    handleLabel: undefined,
    moveRaf: 0,
    queuedMove: event,
    dragPoint: () => target,
    ov: { measure: null, moveActive: () => {}, setKnot: () => {}, setGuides: () => {}, setZone: () => {} },
  });
  interaction.flushHandleMove();
  return interaction;
}

describe('Hold roof handles', () => {
  it('gives a flat roof one stable new peak identity through previews and returns exactly to the start', () => {
    const { p, oh } = roof('flat');
    const at: V2 = [3, 5];
    const startY = ohTopAt(oh, at);
    const handle = zoneHandle(stage, p, oh, { kind: 'flatTop' }, at, startY)!;
    const raised = handle.drag({ plan: at, y: startY + 0.8 }, alt)!;
    const higher = handle.drag({ plan: at, y: startY + 1.1 }, alt)!;
    const back = handle.drag({ plan: at, y: startY }, alt)!;
    const raisedRoof = runTxn(p, raised.op!).after.overheads[0];
    const higherRoof = runTxn(p, higher.op!).after.overheads[0];
    expect(profilePeak(raisedRoof.profile).h).toBeCloseTo(0.8, 6);
    expect(profilePeak(higherRoof.profile).h).toBeCloseTo(1.1, 6);
    expect(raisedRoof.profile.find((q) => q.u === 0.5)?.id).toBe(higherRoof.profile.find((q) => q.u === 0.5)?.id);
    expect(runTxn(p, back.op!).after.overheads[0].profile).toEqual(oh.profile);
  });

  it('lands the ridge on the 45 degree detent and Alt leaves the stop free', () => {
    const { p, oh } = roof('gable');
    const at: V2 = [3, 5];
    const peak = profilePeak(oh.profile);
    const startY = ohTopAt(oh, at);
    const height45 = ohSpan(oh) * 0.5;
    const handle = zoneHandle(stage, p, oh, { kind: 'ridge', wing: 0 }, at, startY)!;
    const snapped = handle.drag({ plan: at, y: startY + height45 - peak.h + 0.02 }, ordinary)!;
    const freeHandle = zoneHandle(stage, p, oh, { kind: 'ridge', wing: 0 }, at, startY)!;
    const free = freeHandle.drag({ plan: at, y: startY + height45 - peak.h + 0.02 }, alt)!;
    const snappedPeak = profilePeak(runTxn(p, snapped.op!).after.overheads[0].profile).h;
    const freePeak = profilePeak(runTxn(p, free.op!).after.overheads[0].profile).h;
    expect(snapped.measure).toContain('45° pitch');
    expect(snappedPeak).toBeCloseTo(height45, 6);
    expect(free.measure).not.toContain('45° pitch');
    expect(freePeak).toBeCloseTo(height45 + 0.02, 6);
  });

  it('keeps a shared profile locked to its source section for both compound wings', () => {
    const outline: V2[] = [[0, 0], [10, 0], [10, 6], [6, 6], [6, 14], [0, 14]];
    const p = runTxn(emptyProject(), opAddOverhead(outline, 3, { dir: 0, oneSpan: false, profile: presetProfile('gable', 6) })).after;
    const oh = p.overheads[0];
    const at: V2 = [2, 1.5];
    const startY = ohTopAt(oh, at);
    const zone = roofZoneAt(oh, at, { ridge: 0.25, end: 0.25, eave: 0.2 });
    if (zone?.kind !== 'slope') throw new Error(JSON.stringify(zone));
    const handle = zoneHandle(stage, p, oh, zone, at, startY)!;
    const pulled = handle.drag({ plan: [1.5, 1.5], y: startY }, alt)!;
    expect(pulled.measure).toContain('same section');
    const next = runTxn(p, pulled.op!).after.overheads[0];
    expect(next.profile.length).toBeGreaterThan(oh.profile.length);
  });

  it('projects both sides of the slope onto the actual normal, so tangent drags add no fullness', () => {
    const { p, oh } = roof();
    for (const side of ['L', 'R'] as const) {
      const at: V2 = [side === 'L' ? 1.5 : 4.5, 5];
      const y = ohTopAt(oh, at);
      const h = zoneHandle(stage, p, oh, { kind: 'slope', side, wing: 0, locked: false }, at, y)!;
      const dx = side === 'L' ? 0.3 : -0.3;
      const dy = 0.3 * profilePeak(oh.profile).h / 3;
      const res = h.drag({ plan: [at[0] + dx, at[1]], y: y + dy }, alt)!;
      expect(runTxn(p, res.op!).after.overheads[0].profile).toEqual(oh.profile);
    }
  });

  it('straightens a bowed slope on both sides and returns exactly to as-it-was', () => {
    const bowed: ProfilePt[] = [
      { u: 0, h: 0, crease: true, id: 'a' },
      { u: 0.25, h: 1.4, crease: false, id: 'b' },
      { u: 0.5, h: 2, crease: true, id: 'c' },
      { u: 0.75, h: 1.4, crease: false, id: 'd' },
      { u: 1, h: 0, crease: true, id: 'e' },
    ];
    const { p, oh } = roof('gable', undefined, false, bowed);
    for (const side of ['L', 'R'] as const) {
      const stop = straighteningStop(oh.profile, side, ohSpan(oh))[0];
      expect(stop?.label, side).toBe('straight');
      const at: V2 = [side === 'L' ? 1.5 : 4.5, 5];
      const startY = ohTopAt(oh, at);
      const peak = profilePeak(oh.profile);
      const eave = oh.profile[side === 'L' ? 0 : oh.profile.length - 1];
      const rise = peak.h - eave.h;
      const run = ohSpan(oh) * Math.abs(peak.u - eave.u);
      const normalPlan = rise / Math.hypot(run, rise);
      const outward = stop.at / normalPlan;
      const dx = side === 'L' ? -outward : outward;
      const handle = zoneHandle(stage, p, oh, { kind: 'slope', side, wing: 0, locked: false }, at, startY)!;
      const res = handle.drag({ plan: [at[0] + dx, at[1]], y: startY }, ordinary)!;
      expect(res.measure).toContain('straight');
      const next = runTxn(p, res.op!).after.overheads[0];
      const samples = sampleProfile(next.profile);
      for (let i = 0; i <= 100; i++) {
        const u = side === 'L' ? (peak.u * i) / 100 : peak.u + ((1 - peak.u) * i) / 100;
        const line = eave.h + (peak.h - eave.h) * ((u - eave.u) / (peak.u - eave.u));
        expect(Math.abs(profileH(samples, u) - line)).toBeLessThan(0.01);
      }
      const back = handle.drag({ plan: at, y: startY }, ordinary)!;
      expect(runTxn(p, back.op!).after.overheads[0].profile).toEqual(oh.profile);
    }
  });

  it('straightens multiple bowed points on one slope and snaps back to as-it-was', () => {
    const straight: ProfilePt[] = [
      { u: 0, h: 0, crease: true, id: 'a' },
      { u: 0.2, h: 0.8, crease: false, id: 'b' },
      { u: 0.35, h: 1.4, crease: false, id: 'c' },
      { u: 0.5, h: 2, crease: true, id: 'd' },
      { u: 0.65, h: 1.4, crease: false, id: 'e' },
      { u: 0.8, h: 0.8, crease: false, id: 'f' },
      { u: 1, h: 0, crease: true, id: 'g' },
    ];
    const bowed = pullShoulder(straight, 'L', 0.04, true);
    const { p, oh } = roof('gable', undefined, false, bowed);
    const stop = straighteningStop(oh.profile, 'L', ohSpan(oh))[0];
    expect(stop?.label).toBe('straight');
    const at: V2 = [1.5, 5], y = ohTopAt(oh, at);
    const handle = zoneHandle(stage, p, oh, { kind: 'slope', side: 'L', wing: 0, locked: false }, at, y)!;
    const peak = profilePeak(oh.profile), span = ohSpan(oh);
    const rise = peak.h, run = span * peak.u, normalPlan = rise / Math.hypot(run, rise);
    const res = handle.drag({ plan: [at[0] + (stop.at / normalPlan) * -1, at[1]], y }, ordinary)!;
    expect(res.measure).toContain('straight');
    const straightened = runTxn(p, res.op!).after.overheads[0].profile;
    const curve = sampleProfile(straightened);
    for (let i = 0; i <= 100; i++) {
      const u = peak.u * i / 100;
      expect(Math.abs(profileH(curve, u) - peak.h * u / peak.u)).toBeLessThan(0.01);
    }
    const back = handle.drag({ plan: at, y }, ordinary)!;
    expect(back.measure).toContain('as it was');
    expect(runTxn(p, back.op!).after.overheads[0].profile).toEqual(oh.profile);
  });

  it('rejects a too-steep Alt ridge move and keeps the last valid preview', () => {
    const steepStart: ProfilePt[] = [
      { u: 0, h: 0, crease: true, id: 'a' },
      { u: 0.1, h: 1, crease: true, id: 'b' },
      { u: 1, h: 0, crease: true, id: 'c' },
    ];
    const { p, oh } = roof('gable', undefined, false, steepStart);
    const at: V2 = [0.6, 5], y = ohTopAt(oh, at);
    const handle = zoneHandle(stage, p, oh, { kind: 'ridge', wing: 0 }, at, y)!;
    const interaction = flushed(p, oh.id, handle, { plan: at, y: y + 0.5 }, alt);
    const lastValid = store.shown.overheads[0].profile;
    interaction.queuedMove = alt;
    interaction.dragPoint = () => ({ plan: at, y: y + 3 });
    interaction.flushHandleMove();
    expect(interaction.handleOp).toBeTruthy();
    expect(interaction.ov.measure.text).toContain('straight slope limit · 75°');
    expect(store.shown.overheads[0].profile).toEqual(lastValid);
    expect(profilePeak(store.shown.overheads[0].profile).h).toBeCloseTo(1.5, 6);
    store.setPreview(null);
  });

  it('validates the effective span when an eave edit narrows a roof', () => {
    const steepProfile: ProfilePt[] = [
      { u: 0, h: 0, crease: true, id: 'a' },
      { u: 0.2, h: 2.5, crease: true, id: 'b' },
      { u: 1, h: 0, crease: true, id: 'c' },
    ];
    const { p, oh } = roof('gable', undefined, false, steepProfile);
    const at: V2 = [6, 5], y = ohTopAt(oh, at);
    const eave = zoneHandle(stage, p, oh, { kind: 'eave', edge: 1 }, at, y)!;
    const op = eave.drag({ plan: [2, 5], y }, alt)!.op!;
    const candidate = runTxn(p, op).after;
    const check = qualifyRoofEdit(p, candidate);
    expect(check.reason).toContain('75°');
  });

  it('uses the same normalized profile for a Hold preview and its committed operation', () => {
    const { p, oh } = roof();
    const at: V2 = [3, 5], y = ohTopAt(oh, at);
    const handle = zoneHandle(stage, p, oh, { kind: 'ridge', wing: 0 }, at, y)!;
    const raw = handle.drag({ plan: at, y: y + 0.7 }, alt)!.op!;
    const candidate = runTxn(p, raw).after;
    const qualified = qualifyRoofEdit(p, candidate);
    expect(qualified.reason).toBe('');
    const op = withRoofProfiles(raw, qualified.profiles);
    const preview = runTxn(p, op).after;
    const committed = runTxn(p, op).after;
    expect(preview).toEqual(committed);
    expect(cleanSection(preview.overheads[0].profile, {
      span: ohSpan(preview.overheads[0]),
      form: preview.overheads[0].form,
      before: oh.profile,
      edited: preview.overheads[0].profile.filter((q) => q.id === 'b').map((q) => q.id!),
    }).valid).toBe(true);
  });

  it('turns only when the qualified roof surface changes and accepts an intentional compound turn', () => {
    const lShape: V2[] = [[0, 0], [10, 0], [10, 6], [6, 6], [6, 14], [0, 14]];
    const unchanged = roof('gable', lShape, true);
    expect(nextRidgeDir(unchanged.oh)).not.toBeNull();
    expect(qualifyRidgeTurn(unchanged.p, unchanged.oh.id).available).toBe(false);

    const changedCompoundShapes: V2[][] = [
      [[0, 0], [12, 0], [12, 5], [8, 5], [8, 12], [4, 12], [4, 5], [0, 5]],
      [[0, 0], [12, 0], [12, 12], [9, 12], [9, 3], [3, 3], [3, 12], [0, 12]],
      [[0, 0], [10, 0], [10, 6], [6, 6], [6, 14], [0, 14]],
    ];
    const turns = changedCompoundShapes.map((outline) => roof('gable', outline, true)).map(({ p, oh }) => qualifyRidgeTurn(p, oh.id));
    expect(turns.some((turn) => turn.available && !!turn.op && !turn.reason)).toBe(true);
  });

  it('rejects a single-span turn when the narrower effective span makes a straight slope exceed 75°', () => {
    const narrowPeak: ProfilePt[] = [
      { u: 0, h: 0, crease: true, id: 'a' },
      { u: 0.1, h: 2.5, crease: true, id: 'b' },
      { u: 1, h: 0, crease: true, id: 'c' },
    ];
    const { p, oh } = roof('gable', [[0, 0], [10, 0], [10, 6], [0, 6]], false, narrowPeak);
    const turn = qualifyRidgeTurn(p, oh.id);
    expect(turn.available).toBe(true);
    expect(turn.op).toBeUndefined();
    expect(turn.reason).toContain('straight slope limit · 75°');
  });

  it('checks a fitted compound roof after a wall handle settles, even while the wall is selected', () => {
    const stroke = (pts: V2[], closed: boolean) => ({
      kind: closed ? 'closed' as const : 'open' as const,
      pts,
      bulge: pts.map(() => 0).slice(0, closed ? pts.length : pts.length - 1),
      closed,
      center: [0, 0] as V2,
      radius: 0,
      length: 0,
      curved: false,
      corners: 0,
    });
    let p = runTxn(emptyProject(), opAddRun(stroke([[0, 0], [10, 0], [10, 6], [0, 6]], true), { baseY: 0 })).after;
    p = runTxn(p, opAddRun(stroke([[10, 6], [10, 14], [6, 14], [6, 6]], false), { baseY: 0 })).after;
    p = runTxn(p, opCoverRooms(derive(p).rooms.map((r) => r.id), 'gable', { wings: true })).after;
    const runId = p.runs[0].id;
    store.ui = { ...store.ui, selection: runId, mode: 'make', tool: 'select' };
    const handle = handlesFor(stage, p, derive(p), runId).find((h) => h.id === 'node:0');
    expect(handle).toBeTruthy();
    const interaction = flushed(p, runId, handle, { plan: [-1, 0], y: 0 }, alt);
    const shown = store.shown.overheads.find((o) => o.id === p.overheads[0].id)!;
    expect(interaction.handleOp).toBeNull();
    expect(interaction.ov.measure.text).toContain('Kept the last valid shape');
    expect(store.shown).toEqual(p);
    expect(roofWingsState(shown).kind).toBe('compound');
    expect(ohHasSurface(shown)).toBe(true);
    store.setPreview(null);
  });

  it('keeps a real translated fitted compound roof continuous when the wall run is selected', () => {
    const stroke = (pts: V2[]) => ({
      kind: 'closed' as const,
      pts,
      bulge: pts.map(() => 0),
      closed: true,
      center: [0, 0] as V2,
      radius: 0,
      length: 0,
      curved: false,
      corners: 0,
    });
    let p = runTxn(emptyProject(), opAddRun(stroke([[0, 0], [10, 0], [10, 6], [6, 6], [6, 14], [0, 14]]), { baseY: 0 })).after;
    p = runTxn(p, opCoverRooms(derive(p).rooms.map((r) => r.id), 'gable', { wings: true })).after;
    const runId = p.runs[0].id;
    store.ui = { ...store.ui, selection: runId, mode: 'make', tool: 'select' };
    const handle = handlesFor(stage, p, derive(p), runId).find((h) => h.id === 'move');
    expect(handle).toBeTruthy();
    const target = { plan: [handle!.pos.x + 1, handle!.pos.z + 0.5] as V2, y: 0 };
    const interaction = flushed(p, runId, handle, target, alt);
    const shown = store.shown.overheads[0];
    expect(interaction.handleOp).toBeTruthy();
    expect(roofWingsState(shown).kind).toBe('compound');
    expect(ohHasSurface(shown)).toBe(true);
    expect(shown.outline[0][0] - p.overheads[0].outline[0][0]).toBeCloseTo(1, 2);
    expect(shown.outline[0][1] - p.overheads[0].outline[0][1]).toBeCloseTo(0.5, 2);
    store.setPreview(null);
  });
});

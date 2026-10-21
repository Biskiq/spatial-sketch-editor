import { describe, it, expect } from 'vitest';
import { presetProfile } from '../src/model/overheadGeom';
import type { ProfilePt } from '../src/model/types';
import { profileH, sampleProfile } from '../src/model/profileCurve';
import {
  readSection, sectionFamily, cleanSection, moveJoint, moveStepEdge, pullPart, splitPart, removeJoint,
  setJointSharp, readSectionStroke, sameProfile, minPartU, MIN_STEP, MAX_SLOPE_DEG, FAMILY_NAMES,
  PRESET_TOL, nearestPreset, presetError,
} from '../src/model/section';

const SPAN = 8;
const MAX_RISE_H = 1.5 * SPAN;
const P = (pts: [number, number, boolean?][]): ProfilePt[] => pts.map(([u, h, c]) => ({ u, h, crease: c ?? true }));
const named = (pts: ProfilePt[]) => readSection(pts).pts; // ids, as a document profile always has
const clean = (pts: ProfilePt[], extra: Partial<Parameters<typeof cleanSection>[1]> = {}) =>
  cleanSection(pts, { span: SPAN, form: 'extrude', ...extra });
const jointOf = (pts: ProfilePt[], kind: string) => readSection(pts).joints.find((j) => j.kind === kind)!;

describe('reading a section', () => {
  it('reads a flat profile as two eaves and one flat part', () => {
    const s = readSection(presetProfile('flat', SPAN));
    expect(s.joints.map((j) => j.kind)).toEqual(['eave', 'eave']);
    expect(s.parts).toHaveLength(1);
    expect(s.parts[0].kind).toBe('flat');
    expect(s.parts[0].dir).toBe(0);
  });

  it('reads a gable as two slopes meeting at one ridge', () => {
    const s = readSection(presetProfile('gable', SPAN));
    expect(s.joints.map((j) => j.kind)).toEqual(['eave', 'ridge', 'eave']);
    expect(s.parts.map((p) => p.dir)).toEqual([1, -1]);
    expect(s.parts.every((p) => p.kind === 'straight')).toBe(true);
  });

  it('keeps smooth points inside a part, and creases as joints', () => {
    const s = readSection(presetProfile('vault', SPAN));
    expect(s.joints.map((j) => j.kind)).toEqual(['eave', 'eave']);
    expect(s.parts).toHaveLength(1);
    expect(s.parts[0].kind).toBe('curve');
    expect(s.parts[0].interior).toHaveLength(3);
  });

  it('reads a vertical pair as one step and remembers both heights', () => {
    const s = readSection(presetProfile('clerestory', SPAN));
    const step = s.joints.find((j) => j.kind === 'step')!;
    expect(step).toBeTruthy();
    expect(step.u).toBeCloseTo(0.55, 9);
    expect(step.h2).toBeGreaterThan(step.h);
    expect(step.id).toBe(s.pts[step.i].id);
  });

  it('gives a bare profile stable ids, so two reads agree', () => {
    const bare = P([[0, 0], [0.5, 2], [1, 0]]);
    const a = readSection(bare), b = readSection(bare);
    expect(a.joints.map((j) => j.id)).toEqual(b.joints.map((j) => j.id));
    expect(new Set(a.pts.map((q) => q.id)).size).toBe(3);
    expect(a.parts.map((p) => p.id)).toEqual(b.parts.map((p) => p.id));
  });

  it('is deterministic and stable under re-reading its own points', () => {
    const pts = presetProfile('sawtooth', SPAN);
    const a = readSection(pts);
    const again = readSection(a.pts);
    expect(again.joints.map((j) => j.id)).toEqual(a.joints.map((j) => j.id));
    expect(again.parts.map((p) => p.id)).toEqual(a.parts.map((p) => p.id));
  });
});

describe('naming the family', () => {
  const fam = (pts: ProfilePt[], form: 'extrude' | 'revolve' = 'extrude') => sectionFamily(readSection(pts), form);
  it('names the presets by their shape', () => {
    expect(fam(presetProfile('flat', SPAN))).toBe('flat');
    expect(fam(presetProfile('raked', SPAN))).toBe('shed');
    expect(fam(presetProfile('gable', SPAN))).toBe('gable');
    expect(fam(presetProfile('clerestory', SPAN))).toBe('clerestory');
    expect(fam(presetProfile('vault', SPAN))).toBe('vault');
    expect(fam(presetProfile('butterfly', SPAN))).toBe('butterfly');
    expect(fam(presetProfile('sawtooth', SPAN))).toBe('sawtooth');
    expect(fam(presetProfile('fold', SPAN))).toBe('folded');
    expect(fam(presetProfile('dome', SPAN), 'revolve')).toBe('dome');
  });
  it('tells a gambrel from a saltbox from a pointed vault', () => {
    expect(fam(named(P([[0, 0], [0.25, 1.8], [0.5, 2.4], [0.75, 1.8], [1, 0]])))).toBe('gambrel');
    expect(fam(named(P([[0, 0], [0.35, 2.2], [1, 0.6]])))).toBe('saltbox');
    expect(fam(named(P([[0, 0], [0.25, 1.2, false], [0.5, 2], [0.75, 1.2, false], [1, 0]])))).toBe('pointed-vault');
    expect(fam(named(P([[0, 0], [0.3, 1.4], [0.7, 0.2], [1, 1.1]])))).toBe('free');
  });
  it('has a human name for every family', () => {
    for (const f of Object.keys(FAMILY_NAMES) as (keyof typeof FAMILY_NAMES)[]) expect(FAMILY_NAMES[f].length).toBeGreaterThan(2);
  });
});

describe('clean rules (the gesture validator)', () => {
  it('accepts the authored profiles unchanged', () => {
    for (const k of ['flat', 'raked', 'gable', 'clerestory', 'vault', 'butterfly', 'sawtooth', 'fold'] as const) {
      const pts = presetProfile(k, SPAN);
      const r = clean(pts);
      expect(r.valid).toBe(true);
      expect(r.notes).toEqual([]);
      expect(sameProfile(r.profile, pts)).toBe(true);
    }
  });

  it('is idempotent on every profile it accepts', () => {
    const cases = [
      presetProfile('gable', SPAN),
      presetProfile('vault', SPAN),
      named(P([[0, 0], [0.35, 2.2], [1, 0.6]])),
      named(P([[0, 0], [0.25, 1.8], [0.5, 2.4], [0.75, 1.8], [1, 0]])),
      named(P([[0, 0], [0.25, 1, false], [0.4, 1.6, false], [1, 0]])),
    ];
    for (const pts of cases) {
      const once = clean(pts);
      expect(once.valid).toBe(true);
      const twice = clean(once.profile);
      expect(twice.valid).toBe(true);
      expect(sameProfile(twice.profile, once.profile)).toBe(true);
      expect(twice.notes).toEqual(once.notes);
    }
  });

  it('clamps a height the edit asked for, and refuses one it did not', () => {
    const g = named(presetProfile('gable', SPAN));
    const clamped = clean(g, { edited: [g[1].id!], before: g });
    expect(clamped.valid).toBe(true);
    const tooHigh = clean(g.map((q, i) => (i === 1 ? { ...q, h: 40 } : q)), { edited: [], before: g });
    expect(tooHigh.valid).toBe(false);
    expect(tooHigh.notes.join(' ')).toContain('range');
    const clampedHigh = clean(g.map((q, i) => (i === 1 ? { ...q, h: 40 } : q)), { edited: [g[1].id!], before: g });
    expect(clampedHigh.valid).toBe(true);
    expect(profileH(sampleProfile(clampedHigh.profile), 0.5)).toBeLessThanOrEqual(MAX_RISE_H + 1e-6);
  });

  it('refuses a section that folds over itself', () => {
    const r = clean(named(P([[0, 0], [0.5, 2], [0.3, 1], [1, 0]])));
    expect(r.valid).toBe(false);
    expect(r.notes.join(' ')).toContain('fold');
  });

  it('closes a step shortened under 30 cm at the higher height, keeping its first id', () => {
    const start = named(P([[0, 0], [0.5, 1.2], [0.5, 1.5], [1, 0]]));
    const short = start.map((q, i) => (i === 2 ? { ...q, h: 1.2 + MIN_STEP * 0.5 } : q));
    const r = clean(short, { edited: [start[1].id!, start[2].id!], before: start });
    expect(r.valid).toBe(true);
    expect(r.profile).toHaveLength(3);
    expect(r.profile[1].h).toBeCloseTo(1.35, 6);
    expect(r.profile[1].id).toBe(start[1].id);
    expect(r.notes.join(' ')).toContain('close step');
    // and a wobble across the limit does not reopen it
    expect(sameProfile(clean(r.profile, { before: start }).profile, r.profile)).toBe(true);
  });

  it('refuses a newly created joint that leaves a piece too narrow', () => {
    const g = named(presetProfile('gable', SPAN));
    const tiny = g.slice();
    tiny.splice(1, 0, { u: minPartU(SPAN) * 0.3, h: 0.4, crease: true, id: 'newJoint' });
    const r = clean(tiny, { edited: ['newJoint'], before: g });
    expect(r.valid).toBe(false);
    expect(r.notes.join(' ')).toContain('room');
  });

  it('refuses a changed straight part steeper than 75°', () => {
    const pts = named(P([[0, 0], [0.5, 1], [1, 0]]));
    const steeper = pts.map((q, i) => (i === 1 ? { ...q, u: 0.02 } : q));
    const r = clean(steeper, { edited: [pts[1].id!], before: pts });
    expect(r.valid).toBe(false);
    expect(r.notes.join(' ')).toContain(`${MAX_SLOPE_DEG}°`);
  });

  it('never rewrites a part the gesture did not touch', () => {
    const pts = named(P([[0, 0], [0.3, 1.2], [0.5, 2], [0.75, 0.9], [1, 0]]));
    const moved = pts.map((q, i) => (i === 2 ? { ...q, h: 2.3 } : q));
    const r = clean(moved, { edited: [pts[2].id!], before: pts });
    expect(r.valid).toBe(true);
    expect(r.profile[1]).toEqual(pts[1]);
    expect(r.profile[3]).toEqual(pts[3]);
  });

  it('drops a redundant smooth point a gesture redrew, but never a joint', () => {
    // three smooth points on one straight run: the middle one can go without moving the curve
    const pts = named(P([[0, 0], [0.2, 0.8, false], [0.4, 1.6, false], [1, 4]]));
    const r = clean(pts, { edited: [pts[1].id!, pts[2].id!], before: pts });
    expect(r.valid).toBe(true);
    expect(r.profile.length).toBeLessThan(pts.length);
    expect(r.profile.some((q) => q.id === pts[1].id)).toBe(false);
    const was = sampleProfile(pts), now = sampleProfile(r.profile);
    for (const s of now) expect(Math.abs(profileH(was, s.u) - s.h)).toBeLessThan(0.01);
    // no joint was dropped, only smooth points
    expect(readSection(r.profile).joints).toHaveLength(2);
    expect(r.notes).toContain('straight');
    expect(sameProfile(clean(r.profile, { edited: r.profile.map((q) => q.id!) }).profile, r.profile)).toBe(true);
    // an untouched part keeps all its points
    const kept = clean(pts, { edited: [] , before: pts });
    expect(kept.profile).toHaveLength(4);
  });

  it('keeps a real bow', () => {
    const pts = named(P([[0, 0], [0.25, 1.6, false], [0.4, 1.9, false], [1, 0]]));
    const r = clean(pts, { edited: pts.map((q) => q.id!), before: pts });
    expect(r.valid).toBe(true);
    expect(r.profile).toHaveLength(4);
    expect(r.notes).not.toContain('straight');
  });
});

describe('moving a joint', () => {
  it('moves a ridge and snaps it to the centre when close', () => {
    const g = named(presetProfile('gable', SPAN));
    const ridgeId = jointOf(g, 'ridge').id;
    const e = moveJoint(g, ridgeId, 0.49, g[1].h + 0.5, { span: SPAN, form: 'extrude' });
    expect(e.profile[1].u).toBe(0.5);
    expect(e.label).toBe('centred');
    expect(e.profile[1].h).toBeCloseTo(g[1].h + 0.5, 6);
  });

  it('keeps every piece at least 40 cm wide', () => {
    const g = named(presetProfile('gable', SPAN));
    const ridgeId = jointOf(g, 'ridge').id;
    const e = moveJoint(g, ridgeId, 0.999, g[1].h, { span: SPAN, form: 'extrude' });
    const minP = minPartU(SPAN);
    expect(e.profile[1].u).toBeLessThanOrEqual(1 - minP + 1e-6);
    expect(e.profile[1].u).toBeGreaterThanOrEqual(minP - 1e-6);
  });

  it('stops a joint from standing steeper than 75° to its neighbour', () => {
    const pts = named(P([[0, 0], [0.3, 1.2], [0.6, 2], [1, 0]]));
    const e = moveJoint(pts, pts[1].id!, 0.58, 6, { span: SPAN, form: 'extrude', free: true });
    const du = Math.abs(e.profile[2].u - e.profile[1].u) * SPAN;
    const slope = Math.abs(e.profile[2].h - e.profile[1].h) / Math.max(du, 1e-9);
    expect(slope).toBeLessThanOrEqual(Math.tan((MAX_SLOPE_DEG * Math.PI) / 180) + 1e-6);
  });

  it('moves the mirror joint on a symmetric section unless the gesture says otherwise', () => {
    const pts = named(P([[0, 0], [0.3, 1.4], [0.7, 1.4], [1, 0]]));
    const sym = moveJoint(pts, pts[1].id!, 0.35, 1.6, { span: SPAN, form: 'extrude' });
    expect(sym.profile[2].u).toBeCloseTo(0.65, 6);
    expect(sym.profile[2].h).toBeCloseTo(1.6, 6);
    const solo = moveJoint(pts, pts[1].id!, 0.35, 1.6, { span: SPAN, form: 'extrude', solo: true });
    expect(solo.profile[2].u).toBeCloseTo(0.7, 6);
    expect(solo.profile[2].h).toBeCloseTo(1.4, 6);
  });

  it('offers pitch detents that land on the pitch they name', () => {
    const g = named(presetProfile('gable', SPAN));
    const e = moveJoint(g, jointOf(g, 'ridge').id, 0.52, 4.02, { span: SPAN, form: 'extrude' });
    expect(e.label).toBe('45° pitch');
    expect(e.profile[1].h).toBeCloseTo(4, 6);
  });

  it('levels a joint with the other side when close, before suggesting a pitch', () => {
    const pts = named(P([[0, 0], [0.35, 1.6], [0.65, 2.0], [1, 0]]));
    const e = moveJoint(pts, pts[2].id!, 0.65, 1.58, { span: SPAN, form: 'extrude' });
    expect(e.profile[2].h).toBeCloseTo(1.6, 6);
    expect(e.label).toContain('level');
  });

  it('merges a joint dragged into its neighbour when the shape allows it', () => {
    const pts = named(P([[0, 0], [0.25, 1.8], [0.5, 2.4], [0.75, 1.8], [1, 0]]));
    const e = moveJoint(pts, pts[1].id!, 0.98, 2.4, { span: SPAN, form: 'extrude', free: true });
    expect(e.merged).toBe(true);
    expect(e.label).toBe('Merge with its neighbour');
    expect(e.profile).toHaveLength(4);
    expect(readSection(e.profile).joints.filter((j) => j.kind !== 'eave')).toHaveLength(2);
  });

  it('does not merge the only ridge away', () => {
    const g = named(presetProfile('gable', SPAN));
    const e = moveJoint(g, jointOf(g, 'ridge').id, 1.2, g[1].h, { span: SPAN, form: 'extrude', free: true });
    expect(e.merged).toBeUndefined();
    expect(readSection(e.profile).joints.filter((j) => j.kind !== 'eave')).toHaveLength(1);
  });

  it('makes a saltbox by leaning a gable’s ridge, and a gambrel from two creases pulled out', () => {
    const g = named(presetProfile('gable', SPAN));
    const salt = moveJoint(g, jointOf(g, 'ridge').id, 0.35, g[1].h, { span: SPAN, form: 'extrude' });
    const saltProfile = salt.profile;
    expect(sectionFamily(readSection(saltProfile), 'extrude')).toBe('saltbox');
    // crease each slope, then pull the creases out: the lower slope steepens, the upper shallows — a gambrel
    const gable = named(presetProfile('gable', SPAN));
    const left = splitPart(gable, readSection(gable).parts[0].id, 0.2, 'crease', { span: SPAN, form: 'extrude' })!;
    const rsec = readSection(left.profile);
    const rightPart = rsec.parts.find((q) => rsec.joints[q.a].u < 0.8 && rsec.joints[q.b].u > 0.8)!;
    const both = splitPart(left.profile, rightPart.id, 0.8, 'crease', { span: SPAN, form: 'extrude' })!;
    const crease = readSection(both.profile).joints.find((j) => j.kind === 'crease' && Math.abs(j.u - 0.2) < 1e-6)!;
    const pulled = moveJoint(both.profile, crease.id, 0.2, 1.2, { span: SPAN, form: 'extrude' });
    expect(sectionFamily(readSection(pulled.profile), 'extrude')).toBe('gambrel');
    // the mirror crease went with it
    expect(readSection(pulled.profile).joints.find((j) => j.kind === 'crease' && j.u > 0.5)!.h).toBeCloseTo(1.2, 6);
  });

  it('replays the same target from the same start to the same geometry and ids, sparse or dense', () => {
    const g = named(presetProfile('gable', SPAN));
    const ridgeId = jointOf(g, 'ridge').id;
    const sparse: [number, number][] = [[0.52, 2.2], [0.6, 2.4], [0.44, 2.1], [0.4, 2.3]];
    const dense: [number, number][] = [];
    for (let i = 0; i < sparse.length - 1; i++)
      for (let k = 0; k < 7; k++) {
        const t = k / 7;
        dense.push([sparse[i][0] + (sparse[i + 1][0] - sparse[i][0]) * t, sparse[i][1] + (sparse[i + 1][1] - sparse[i][1]) * t]);
      }
    dense.push(sparse[sparse.length - 1]);
    const last = (seq: [number, number][]) => seq.reduce((p, [u, h]) => moveJoint(g, ridgeId, u, h, { span: SPAN, form: 'extrude' }), { profile: g });
    const a = last(sparse), b = last(dense);
    expect(sameProfile(a.profile, b.profile)).toBe(true);
    // and going back to the start restores the original exactly
    expect(sameProfile(moveJoint(g, ridgeId, g[1].u, g[1].h, { span: SPAN, form: 'extrude' }).profile, g)).toBe(true);
  });

  it('moves an eave in height only', () => {
    const g = named(presetProfile('gable', SPAN));
    const e = moveJoint(g, readSection(g).joints[0].id, 0.4, 0.6, { span: SPAN, form: 'extrude' });
    expect(e.profile[0].u).toBe(0);
    expect(e.profile[e.profile.length - 1].u).toBe(1);
    expect(e.profile[0].h).toBeCloseTo(0.6, 6);
    expect(e.profile[e.profile.length - 1].h).toBeCloseTo(0, 6);
  });

  it('closes a step edge dragged onto the other, and refuses to leave a 15 cm step', () => {
    const pts = named(presetProfile('clerestory', SPAN));
    const step = jointOf(pts, 'step');
    const r = moveStepEdge(pts, step.id, 'hi', pts[step.i].h + MIN_STEP * 0.5, { span: SPAN, form: 'extrude' });
    expect(r.profile).toHaveLength(pts.length - 1);
    expect(r.label).toBe('Close this step');
    expect(readSection(r.profile).joints.some((j) => j.kind === 'step')).toBe(false);
  });
});

describe('pulling a part', () => {
  it('lets the grabbed point follow the hand, and bows the part', () => {
    const g = named(presetProfile('gable', SPAN));
    const sec = readSection(g);
    const out = pullPart(g, sec.parts[0].id, 0.3, { span: SPAN, form: 'extrude', uGrab: 0.25 });
    expect(out).toHaveLength(4);
    const s = sampleProfile(out);
    expect(profileH(s, 0.25)).toBeGreaterThan(profileH(sampleProfile(g), 0.25) + 0.15);
    expect(clean(out, { edited: out.map((q) => q.id!) }).valid).toBe(true);
  });

  it('pulls the mirror part the same way on a symmetric section, and not when solo', () => {
    const g = named(presetProfile('gable', SPAN));
    const sec = readSection(g);
    const out = pullPart(g, sec.parts[0].id, 0.3, { span: SPAN, form: 'extrude', uGrab: 0.25 });
    for (const s of sampleProfile(out)) {
      if (s.u <= 0.05 || s.u >= 0.95) continue;
      const mirror = profileH(sampleProfile(out.map((q) => ({ ...q, u: 1 - q.u })).reverse()), 1 - s.u);
      expect(Math.abs(mirror - s.h)).toBeLessThan(0.06);
    }
    const solo = pullPart(g, sec.parts[0].id, 0.3, { span: SPAN, form: 'extrude', uGrab: 0.25, solo: true });
    expect(solo).toHaveLength(4);
    expect(solo[3]).toEqual(g[2]);
  });

  it('never lifts the curve above the maximum rise', () => {
    const g = named(presetProfile('gable', SPAN));
    const sec = readSection(g);
    let out = g;
    for (let k = 0; k < 40; k++) out = pullPart(out, sec.parts[0].id, 0.8, { span: SPAN, form: 'extrude', uGrab: 0.1 });
    for (const s of sampleProfile(out)) expect(s.h).toBeLessThanOrEqual(MAX_RISE_H + 1e-6);
  });
});

describe('splitting and removing', () => {
  it('creases a part where asked, and the halves stay parts of the same roof', () => {
    const g = named(presetProfile('gable', SPAN));
    const sec = readSection(g);
    const r = splitPart(g, sec.parts[0].id, 0.25, 'crease', { span: SPAN, form: 'extrude' })!;
    const after = readSection(r.profile);
    expect(after.joints.filter((j) => j.kind !== 'eave')).toHaveLength(2);
    expect(after.joints.some((j) => j.id === r.jointId && j.kind === 'crease')).toBe(true);
    expect(profileH(sampleProfile(r.profile), 0.25)).toBeCloseTo(profileH(sampleProfile(g), 0.25), 6);
  });

  it('steps a part by 30 cm and keeps the ridge and far eave where they were', () => {
    const g = named(presetProfile('gable', SPAN));
    const sec = readSection(g);
    const r = splitPart(g, sec.parts[0].id, 0.3, 'step', { span: SPAN, form: 'extrude' })!;
    const after = readSection(r.profile);
    const step = after.joints.find((j) => j.kind === 'step')!;
    expect(step).toBeTruthy();
    expect(Math.abs(step.h2 - step.h)).toBeCloseTo(0.6, 2);
    expect(after.joints[after.joints.length - 1].h).toBeCloseTo(0, 6);
    expect(after.joints.find((j) => j.kind === 'ridge')!.h).toBeCloseTo(g[1].h, 6);
    expect(clean(r.profile).valid).toBe(true);
  });

  it('refuses a split too close to an end', () => {
    const g = named(presetProfile('gable', SPAN));
    expect(splitPart(g, readSection(g).parts[0].id, 0.01, 'crease', { span: SPAN, form: 'extrude' })).toBeNull();
  });

  it('refuses to remove an eave or the only joint above it', () => {
    const g = named(presetProfile('gable', SPAN));
    const sec = readSection(g);
    expect(removeJoint(g, sec.joints[0].id, { span: SPAN, form: 'extrude' })).toBeNull();
    expect(removeJoint(g, sec.joints[1].id, { span: SPAN, form: 'extrude' })).toBeNull();
  });

  it('removes one of several joints and re-reads the shape', () => {
    const pts = named(P([[0, 0], [0.25, 1.8], [0.5, 2.4], [0.75, 1.8], [1, 0]]));
    const out = removeJoint(pts, jointOf(pts, 'crease').id, { span: SPAN, form: 'extrude' });
    expect(out).toBeTruthy();
    expect(out!).toHaveLength(4);
    expect(clean(out!).valid).toBe(true);
  });

  it('softens and sharpens a joint without moving it', () => {
    const g = named(presetProfile('gable', SPAN));
    const ridgeId = jointOf(g, 'ridge').id;
    const soft = setJointSharp(g, ridgeId, false);
    expect(readSection(soft).joints.some((j) => j.id === ridgeId)).toBe(false);
    const sharp = setJointSharp(soft, ridgeId, true);
    expect(sharp[1].h).toBe(g[1].h);
    expect(readSection(sharp).joints.some((j) => j.id === ridgeId && j.kind === 'ridge')).toBe(true);
  });
});

describe('reading a drawn section', () => {
  const strokeGable = (n = 80) => Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n;
    return { u, h: 2.2 * (1 - Math.abs(2 * u - 1)) + Math.sin(i * 3.1) * 0.01 };
  });

  it('offers a tidy reading before the stroke as drawn, both valid and named', () => {
    const rs = readSectionStroke(strokeGable(), { span: SPAN, form: 'extrude' });
    expect(rs.length).toBeGreaterThan(0);
    expect(rs[0].id).toBe('tidy');
    expect(rs[0].label).toBe('Gable');
    expect(rs.some((r) => r.id === 'drawn')).toBe(true);
    for (const r of rs) expect(clean(r.profile).valid).toBe(true);
  });

  it('keeps the drawn reading when the stroke is not a named shape', () => {
    const rs = readSectionStroke([{ u: 0, h: 0 }, { u: 0.4, h: 1.1 }, { u: 0.7, h: 0.4 }, { u: 1, h: 0.9 }], { span: SPAN, form: 'extrude' });
    expect(rs.map((r) => r.id)).toContain('drawn');
    expect(rs.every((r) => clean(r.profile).valid)).toBe(true);
  });

  it('returns nothing for a degenerate scribble, so the old roof stays', () => {
    expect(readSectionStroke([{ u: 0.5, h: 1 }, { u: 0.5, h: 1 }], { span: SPAN, form: 'extrude' })).toEqual([]);
  });
});

describe('the nearest-preset reading is bounded, not guessed', () => {
  const presetPeak = (span: number) => Math.max(...presetProfile('gable', span).map((q) => q.h));
  const gableOf = (span: number, extra: number) => named(P([[0, 0], [0.5, presetPeak(span) + extra], [1, 0]]));

  it('declares its tolerance in metres, never below a hand’s width', () => {
    expect(PRESET_TOL(1)).toBeCloseTo(0.12, 6);
    expect(PRESET_TOL(3)).toBeCloseTo(0.12, 6); // 3.5% of 3 m is under 12 cm
    expect(PRESET_TOL(10)).toBeCloseTo(0.35, 6);
    expect(PRESET_TOL(10)).toBeGreaterThan(PRESET_TOL(3));
  });

  it('accepts a shape inside the tolerance and names the preset it is near', () => {
    const span = 10;
    const tol = PRESET_TOL(span);
    const preset = presetProfile('gable', span);
    const within = gableOf(span, tol * 0.9);
    // the error is sampled at 50 stations, so it may miss the exact peak by a couple of centimetres
    expect(presetError(within, preset)).toBeLessThanOrEqual(tol);
    expect(presetError(within, preset)).toBeGreaterThan(tol * 0.8);
    const near = nearestPreset(within, { span, form: 'extrude' });
    expect(near).toBeTruthy();
    expect(near!.error).toBeLessThanOrEqual(tol + 1e-9);
    expect(near!.preset).toBe('gable');
    // and the reading appears before "as drawn"
    const rs = readSectionStroke(within.map((q) => ({ u: q.u, h: q.h })), { span, form: 'extrude' });
    expect(rs.some((r) => r.id === 'preset' && r.detail.startsWith('preset'))).toBe(true);
    // a named reading comes first; the raw stroke is always last and never replaces it
    expect(['tidy', 'preset']).toContain(rs[0].id);
    expect(rs[rs.length - 1].id).toBe('drawn');
  });

  it('offers no preset when every candidate is outside the tolerance', () => {
    const span = 10;
    const tol = PRESET_TOL(span);
    const outside = gableOf(span, tol * 1.15);
    // the gable is the nearest family and is still too far: nothing is close enough to be called a name
    expect(presetError(outside, presetProfile('gable', span))).toBeGreaterThan(tol);
    expect(nearestPreset(outside, { span, form: 'extrude' })).toBeNull();
    const rs = readSectionStroke(outside.map((q) => ({ u: q.u, h: q.h })), { span, form: 'extrude' });
    expect(rs.some((r) => r.id === 'preset')).toBe(false);
    expect(rs.some((r) => r.id === 'drawn')).toBe(true);
  });

  it('scales with the span: the same 20 cm miss is too far at 3 m and close enough at 10 m', () => {
    const small = gableOf(3, 0.2);
    expect(presetError(small, presetProfile('gable', 3))).toBeCloseTo(0.2, 1);
    expect(nearestPreset(small, { span: 3, form: 'extrude' })).toBeNull();
    const large = gableOf(10, 0.2);
    expect(presetError(large, presetProfile('gable', 10))).toBeCloseTo(0.2, 1);
    const near = nearestPreset(large, { span: 10, form: 'extrude' });
    expect(near).toBeTruthy();
    expect(near!.preset).toBe('gable');
  });

  it('never flattens a step into a smooth family', () => {
    const step = presetProfile('clerestory', SPAN);
    const near = nearestPreset(step, { span: SPAN, form: 'extrude' });
    // the drawing already is the step preset, so any reading offered must keep the step
    if (near) expect(readSection(near.profile).joints.some((j) => j.kind === 'step')).toBe(true);
    // and a step drawing is never read as the smooth gable that is nearest by height alone
    const rs = readSectionStroke(step.map((q) => ({ u: q.u, h: q.h })), { span: SPAN, form: 'extrude' });
    expect(rs.every((r) => readSection(r.profile).joints.some((j) => j.kind === 'step'))).toBe(true);
  });
});

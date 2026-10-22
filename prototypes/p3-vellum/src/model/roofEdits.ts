// Qualification shared by live roof handles, fitted-roof wall edits and explicit ridge turns.
// The caller owns the gesture snapshot; this module only checks the settled candidate and returns any profile
// normalization that must be replayed identically for preview and commit.
import { ohH, ohHasSurface, ohSpan, nextRidgeDir } from './overheadGeom';
import { spanCliff } from './roofSpan';
import { fmtM, pointInPoly } from './geom2d';
import { cleanSection, readSection } from './section';
import type { Op } from './ops';
import { opOverhead, runTxn } from './ops';
import type { Overhead, ProfilePt, Project } from './types';
import { continuedWings, roofWingsState } from './wings';

export interface RoofEditQualification {
  profiles: Map<string, ProfilePt[]>;
  reason: string;
}

function sameOutline(a: Overhead, b: Overhead, tol = 1e-8): boolean {
  return a.outline.length === b.outline.length && a.outline.every((p, i) =>
    Math.abs(p[0] - b.outline[i][0]) <= tol && Math.abs(p[1] - b.outline[i][1]) <= tol);
}

function sameFit(a: Overhead['fit'], b: Overhead['fit']): boolean {
  return a === b || (!!a && !!b && a.overhang === b.overhang && a.rooms.length === b.rooms.length && a.rooms.every((id, i) => id === b.rooms[i]));
}

function pointChanged(a: ProfilePt, b: ProfilePt): boolean {
  return Math.abs(a.u - b.u) > 1e-9 || Math.abs(a.h - b.h) > 1e-9 || !!a.crease !== !!b.crease;
}

function sameAuthoredProfile(a: ProfilePt[], b: ProfilePt[]): boolean {
  return a.length === b.length && a.every((p, i) => p.id === b[i].id && !pointChanged(p, b[i]));
}

function scaleProfile(profile: ProfilePt[], scale: number): ProfilePt[] {
  return profile.map((p) => ({ ...p, h: p.h * scale }));
}

function unscaleProfile(profile: ProfilePt[], scale: number): ProfilePt[] {
  return profile.map((p) => ({ ...p, h: p.h / scale }));
}

function validationSpans(oh: Overhead): { span: number; scale: number }[] {
  const state = roofWingsState(oh);
  if (state.kind !== 'compound') return [{ span: ohSpan(oh), scale: 1 }];
  const wingSpans = state.wings.map((w) => ({
    span: w.span === 'w' ? w.rect[1] - w.rect[0] : w.rect[3] - w.rect[2],
    scale: w.scale,
  }));
  // Start with the most constrained physical wing so any required normalization is shared by every wing.
  return [
    { span: state.primarySpan, scale: 1 },
    ...wingSpans.sort((a, b) => a.scale - b.scale || a.span - b.span),
  ];
}

function validateProfile(before: Overhead, after: Overhead): { profile?: ProfilePt[]; reason: string } {
  const spanChanged = Math.abs(ohSpan(before) - ohSpan(after)) > 1e-7 || before.dir !== after.dir || before.form !== after.form;
  const oldById = new Map(before.profile.map((p) => [p.id, p]));
  const edited = new Set<string>();
  if (spanChanged || before.form !== after.form) {
    for (const p of after.profile) if (p.id) edited.add(p.id);
  }
  for (const p of after.profile) {
    const old = p.id ? oldById.get(p.id) : undefined;
    if (!old || pointChanged(old, p)) if (p.id) edited.add(p.id);
  }
  for (const p of before.profile) if (p.id && !after.profile.some((q) => q.id === p.id)) edited.add(p.id);

  const editedIds = [...edited];
  const currentIds = new Set(after.profile.map((p) => p.id).filter((id): id is string => !!id));
  const protect = readSection(before.profile).joints
    .filter((j) => !edited.has(j.id) && currentIds.has(j.id))
    .map((j) => j.id);
  let normalized = after.profile.map((p) => ({ ...p }));

  const spans = validationSpans(after);
  for (let pass = 0; pass <= spans.length; pass++) {
    let changed = false;
    for (const { span, scale } of spans) {
      const safeScale = Math.max(scale, 1e-9);
      const result = cleanSection(scaleProfile(normalized, safeScale), {
        span,
        form: after.form,
        before: scaleProfile(before.profile, safeScale),
        edited: editedIds,
        protect,
      });
      if (!result.valid) return { reason: result.notes[0] ?? 'the section is not valid at this span' };
      const next = unscaleProfile(result.profile, safeScale);
      if (!sameAuthoredProfile(normalized, next)) changed = true;
      normalized = next;
    }
    if (!changed) break;
  }

  // The last wing's cleanup may have changed the shared section. Confirm every effective span accepts that same
  // authored profile; do not keep a result which is valid only on the wing that normalized it.
  for (const { span, scale } of validationSpans(after)) {
    const result = cleanSection(scaleProfile(normalized, Math.max(scale, 1e-9)), {
      span,
      form: after.form,
      before: scaleProfile(before.profile, Math.max(scale, 1e-9)),
      edited: editedIds,
      protect,
    });
    if (!result.valid) return { reason: result.notes[0] ?? 'the section is not valid at this span' };
    if (!sameAuthoredProfile(normalized, unscaleProfile(result.profile, Math.max(scale, 1e-9))))
      return { reason: 'the shared section cannot be normalized consistently across these roof wings' };
  }
  return { profile: sameAuthoredProfile(normalized, after.profile) ? after.profile : normalized, reason: '' };
}

/**
 * Check every roof changed by a settled transaction, even when the selected handle belongs to a wall. Explicit turns
 * may bypass massing continuity for their own roof, but still pass section, surface and coverage qualification.
 */
export function qualifyRoofEdit(
  before: Project,
  candidate: Project,
  options: { intentionalTurns?: Set<string> } = {},
): RoofEditQualification {
  const profiles = new Map<string, ProfilePt[]>();
  for (const old of before.overheads) {
    const next = candidate.overheads.find((o) => o.id === old.id);
    if (!next) continue;
    const profileChanged = !sameAuthoredProfile(old.profile, next.profile);
    const spanChanged = Math.abs(ohSpan(old) - ohSpan(next)) > 1e-7 || old.dir !== next.dir || old.form !== next.form;
    const planChanged = !sameOutline(old, next) || old.dir !== next.dir || old.oneSpan !== next.oneSpan || old.form !== next.form;
    const geometryChanged = profileChanged || spanChanged || planChanged || old.hip !== next.hip || !sameFit(old.fit, next.fit);
    if (!geometryChanged) continue;

    if (profileChanged || spanChanged) {
      const checked = validateProfile(old, next);
      if (checked.reason) return { profiles: new Map(), reason: checked.reason };
      if (checked.profile) profiles.set(next.id, checked.profile);
    }

    if (old.oneSpan === false || next.oneSpan === false) {
      if (!options.intentionalTurns?.has(old.id)) {
        const continuity = continuedWings(old, next);
        if (!continuity.kept) return { profiles: new Map(), reason: continuity.reason };
      }
      const state = roofWingsState(next);
      if (state.kind === 'unsupported' && ohHasSurface(old))
        return { profiles: new Map(), reason: state.reason };
    }
    if (ohHasSurface(old) && !ohHasSurface(next))
      return { profiles: new Map(), reason: 'this change would leave the roof without a surface' };
  }
  return { profiles, reason: '' };
}

/** Replay an action while applying the exact normalized profile that the caller previewed. */
export function withRoofProfiles(op: Op, profiles: Map<string, ProfilePt[]>): Op {
  if (!profiles.size) return op;
  return (project, choices) => {
    const result = op(project, choices);
    for (const [id, profile] of profiles) {
      const oh = project.overheads.find((o) => o.id === id);
      if (oh) oh.profile = profile.map((p) => ({ ...p }));
    }
    return result;
  };
}

function visibleChange(a: Overhead, b: Overhead): boolean {
  if (!sameOutline(a, b)) return true;
  const xs = [...a.outline.map((p) => p[0]), ...b.outline.map((p) => p[0])];
  const zs = [...a.outline.map((p) => p[1]), ...b.outline.map((p) => p[1])];
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const samples: [number, number][] = [...a.outline, ...b.outline];
  const n = 32;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++)
    samples.push([minX + ((maxX - minX) * i) / n, minZ + ((maxZ - minZ) * j) / n]);
  for (const q of samples) {
    const inA = requireCoverage(a, q), inB = requireCoverage(b, q);
    if (inA !== inB) return true;
    if (inA && Math.abs(ohH(a, q) - ohH(b, q)) > 0.01) return true;
  }
  return false;
}

function requireCoverage(oh: Overhead, q: [number, number]): boolean {
  // Avoid making a rejected/no-surface compound look like the single-span fallback in the comparison below.
  if (!ohHasSurface(oh)) return false;
  return pointInPoly(q, oh.outline);
}

/**
 * One answer for the Settings control that chooses wings or one span. Listed only when the plan has a compound
 * candidate or the roof already uses one, and never offered as a clean commit when the alternative would produce a
 * cliff or a roof without a surface.
 */
export interface CoverageChoice {
  shown: boolean;
  /** the roof's current choice: true when it covers the outline as one span */
  oneSpan: boolean;
  available: boolean;
  op?: Op;
  reason: string;
}

export function qualifyCoverage(project: Project, id: string): CoverageChoice {
  const oh = project.overheads.find((o) => o.id === id);
  if (!oh || oh.form !== 'extrude') return { shown: false, oneSpan: true, available: false, reason: '' };
  const oneSpan = oh.oneSpan !== false;
  const wings = roofWingsState({ ...oh, oneSpan: false });
  const shown = wings.kind === 'compound' || oneSpan === false;
  if (!shown) return { shown: false, oneSpan, available: false, reason: '' };
  if (oneSpan) {
    // already one span: the alternative is the wings this plan can carry
    if (wings.kind !== 'compound')
      return {
        shown, oneSpan, available: false,
        reason: wings.kind === 'unsupported' ? wings.reason : 'this plan is one rectangle, so it has no wings to divide',
      };
    const raw = opOverhead(id, { oneSpan: false });
    const next = runTxn(project, raw).after.overheads.find((o) => o.id === id);
    if (!next || !ohHasSurface(next))
      return { shown, oneSpan, available: false, reason: 'the wings cannot carry this section' };
    return { shown, oneSpan, available: true, op: raw, reason: '' };
  }
  // already wings: the alternative is one span, and a cliff is not a clean result to commit
  const cliff = spanCliff({ ...oh, oneSpan: undefined });
  if (cliff)
    return {
      shown, oneSpan, available: false,
      reason: `as one span it would stop ${fmtM(cliff.h)} up at an inner eave`,
    };
  const raw = opOverhead(id, { oneSpan: true });
  const next = runTxn(project, raw).after.overheads.find((o) => o.id === id);
  if (!next || !ohHasSurface(next))
    return { shown, oneSpan, available: false, reason: 'one span would leave this roof without a surface' };
  return { shown, oneSpan, available: true, op: raw, reason: '' };
}

export interface RidgeTurn {
  available: boolean;
  op?: Op;
  reason: string;
}

/** One qualification shared by the card preview, card commit and R shortcut. */
export function qualifyRidgeTurn(project: Project, id: string): RidgeTurn {
  const oh = project.overheads.find((o) => o.id === id);
  const dir = oh && nextRidgeDir(oh);
  if (!oh || dir === null || dir === undefined) return { available: false, reason: '' };
  const raw = opOverhead(id, { dir });
  const candidate = runTxn(project, raw).after;
  const turned = candidate.overheads.find((o) => o.id === id);
  if (!turned) return { available: false, reason: '' };
  const check = qualifyRoofEdit(project, candidate, { intentionalTurns: new Set([id]) });
  if (check.reason) {
    if (ohHasSurface(oh) && ohHasSurface(turned) && !visibleChange(oh, turned))
      return { available: false, reason: '' };
    return { available: true, reason: check.reason };
  }
  const op = withRoofProfiles(raw, check.profiles);
  const exact = runTxn(project, op).after.overheads.find((o) => o.id === id);
  if (!exact || (ohHasSurface(oh) && !ohHasSurface(exact))) {
    const state = exact && roofWingsState(exact);
    return { available: true, reason: state?.kind === 'unsupported' ? state.reason : 'the turn would leave the roof without a surface' };
  }
  if (ohHasSurface(oh) && ohHasSurface(exact) && !visibleChange(oh, exact))
    return { available: false, reason: '' };
  return { available: true, op, reason: '' };
}

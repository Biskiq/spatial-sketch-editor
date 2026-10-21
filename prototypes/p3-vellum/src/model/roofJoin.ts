// Joining two roofs into one — deliberately narrow. Two gables that meet, at the same eave, pitch, hip, thickness
// and relationship to their rooms, become one wing roof: the proven decomposition makes the valley, so there is no
// seam to keep in sync afterwards. Anything else is refused with the reason. Generalised joining (different eaves,
// different families, cross-family repair) and splitting back are production work, not this prototype's.
//
// What is preserved, predictably: the roof you start from (A) keeps its id, name, direction, thickness, hip,
// overhang and section shape; its pitch is kept by sizing the section to the joined roof's primary span. B is
// absorbed: its rooms join A's `restsOn` and `fit`. One op, so one Undo restores both roofs exactly.
import { V2, ensureCCW, fmtM } from './geom2d';
import { P, union } from './clip';
import type { Overhead, Project, ProfilePt } from './types';
import { ohFrame, ohHasSurface, ohSpan } from './overheadGeom';
import { profilePeak } from './profileCurve';
import { readSection, sectionFamily, FAMILY_NAMES } from './section';
import { roofWingsState } from './wings';
import { runTxn, type Op } from './ops';

const EAVE_TOL = 0.02;
const THICK_TOL = 0.01;
const PITCH_TOL_DEG = 1;
const HIP_TOL = 0.05;
const OVERHANG_TOL = 0.01;
/** a joined single span must keep A's span: ridges end to end, not side by side */
const SPAN_TOL = 0.05;

export interface JoinCheck {
  ok: boolean;
  reason: string;
  /** the joined roof exactly as it would be committed (after settle), when ok */
  merged: Overhead | null;
}

const refuse = (reason: string): JoinCheck => ({ ok: false, reason, merged: null });

/** The gable's pitch in degrees, read from its own section and the span it stands on. */
export function gablePitch(oh: Overhead): number {
  const pk = profilePeak(oh.profile);
  const run = pk.u * ohSpan(oh);
  return run > 1e-6 ? (Math.atan2(pk.h, run) * 180) / Math.PI : 90;
}

const familyOf = (oh: Overhead) => sectionFamily(readSection(oh.profile), oh.form);

/** Drop vertices that sit on the straight line between their neighbours (a union leaves them on shared edges). */
function simplify(ring: V2[]): V2[] {
  let pts = ring.slice();
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (Math.abs(cross) <= 1e-6 * Math.max(1, len) || Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-6) {
        pts.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return pts;
}

const scaled = (profile: ProfilePt[], k: number): ProfilePt[] => profile.map((q) => ({ ...q, h: q.h * k }));

/** The joined roof, before settle refits it, or the reason there is none. Pure. */
function draftJoin(p: Project, aId: string, bId: string): { oh: Overhead } | { reason: string } {
  const a = p.overheads.find((o) => o.id === aId);
  const b = p.overheads.find((o) => o.id === bId);
  if (!a || !b || a === b) return { reason: 'that roof is not there any more' };
  if (!ohHasSurface(a) || !ohHasSurface(b)) return { reason: `${!ohHasSurface(a) ? a.name : b.name} has no surface to join` };
  for (const o of [a, b]) {
    const fam = o.form === 'extrude' ? familyOf(o) : 'dome';
    if (fam !== 'gable') return { reason: `only two gables can be joined here, and ${o.name} is a ${FAMILY_NAMES[fam].toLowerCase()}` };
  }
  // where they are before what they are: a pair that doesn't meet has nothing else worth comparing
  const u = union(P(ensureCCW(a.outline)), P(ensureCCW(b.outline)));
  if (u.length !== 1) return { reason: "they don't meet" };
  if (u[0].length > 1) return { reason: 'together they would enclose a courtyard' };
  if (Math.abs(a.baseY - b.baseY) > EAVE_TOL) return { reason: `their eaves are at different heights (${fmtM(a.baseY, 2)} and ${fmtM(b.baseY, 2)})` };
  if (Math.abs(a.thick - b.thick) > THICK_TOL) return { reason: 'they are different thicknesses' };
  const pa = gablePitch(a), pb = gablePitch(b);
  if (Math.abs(pa - pb) > PITCH_TOL_DEG) return { reason: `their pitches differ (${Math.round(pa)}° and ${Math.round(pb)}°)` };
  if (Math.abs((a.hip ?? 0) - (b.hip ?? 0)) > HIP_TOL) return { reason: `one is hipped more than the other (${fmtM(a.hip ?? 0, 2)} and ${fmtM(b.hip ?? 0, 2)})` };
  if (!!a.fit !== !!b.fit) return { reason: `${a.fit ? a.name : b.name} follows its walls and ${a.fit ? b.name : a.name} keeps its own outline` };
  if (a.fit && b.fit && Math.abs(a.fit.overhang - b.fit.overhang) > OVERHANG_TOL)
    return { reason: `their overhangs differ (${Math.round(a.fit.overhang * 100)} and ${Math.round(b.fit.overhang * 100)} cm)` };
  if (!!a.restsOn?.length !== !!b.restsOn?.length) return { reason: `${a.restsOn?.length ? a.name : b.name} rests on its rooms and the other has its own height` };

  const outline = ensureCCW(simplify(u[0][0]));

  const oh: Overhead = {
    ...a,
    outline,
    oneSpan: false,
    restsOn: a.restsOn?.length ? [...new Set([...a.restsOn, ...(b.restsOn ?? [])])] : null,
    fit: a.fit ? { ...a.fit, rooms: [...new Set([...a.fit.rooms, ...b.fit!.rooms])] } : null,
  };
  const st = roofWingsState(oh);
  if (st.kind === 'unsupported') return { reason: `as one roof ${st.reason}` };
  if (st.kind === 'single') {
    // the plan is one rectangle: fine end to end, but side by side it would be one wider roof with a higher ridge
    delete oh.oneSpan;
    if (Math.abs(ohFrame(oh).wmax - ohFrame(oh).wmin - ohSpan(a)) > SPAN_TOL)
      return { reason: 'side by side they would make one wider roof with a higher ridge; draw it as one roof instead' };
  }
  // keep A's pitch: the same section, sized to the span the joined roof stands on
  oh.profile = scaled(a.profile, ohSpan(oh) / ohSpan(a));
  return { oh };
}

/**
 * Whether A and B can be joined, answered by running the join on a copy — so the chip, its hover preview and the
 * commit see the same settled roof, not three approximations of it.
 */
export function joinCheck(p: Project, aId: string, bId: string): JoinCheck {
  const draft = draftJoin(p, aId, bId);
  if ('reason' in draft) return refuse(draft.reason);
  const after = runTxn(p, opJoinRoofs(aId, bId)).after;
  const merged = after.overheads.find((o) => o.id === aId) ?? null;
  if (!merged || after.overheads.some((o) => o.id === bId)) return refuse('the join did not hold');
  const st = roofWingsState(merged);
  if (st.kind === 'unsupported') return refuse(`once fitted to its rooms, ${st.reason}`);
  return { ok: true, reason: '', merged };
}

/** Roofs whose outlines meet A's: the only ones a join is ever offered with. */
export function joinNeighbours(p: Project, aId: string): Overhead[] {
  const a = p.overheads.find((o) => o.id === aId);
  if (!a) return [];
  return p.overheads.filter((o) => o.id !== aId && union(P(ensureCCW(a.outline)), P(ensureCCW(o.outline))).length === 1);
}

const sameRing = (x: V2[], y: V2[]) => x.length === y.length && x.every((q, i) => Math.abs(q[0] - y[i][0]) < 1e-6 && Math.abs(q[1] - y[i][1]) < 1e-6);

/**
 * Join B into A. `expect` is the roof the preview showed: if the project has moved on since, nothing is joined and
 * the note says to look again, so a click never commits a roof nobody saw.
 */
export const opJoinRoofs = (aId: string, bId: string, expect?: Overhead | null): Op => (p) => {
  const draft = draftJoin(p, aId, bId);
  const a = p.overheads.find((o) => o.id === aId);
  const b = p.overheads.find((o) => o.id === bId);
  if ('reason' in draft) return { notes: [{ kind: 'info', text: `Can't join ${b?.name ?? 'that roof'} into ${a?.name ?? 'this roof'}: ${draft.reason}. Nothing changed.`, ids: [] }] };
  if (expect) {
    // the preview showed the settled roof; a fitted roof is refitted by settle, so compare what the draft fixes
    const shown = expect.fit ? expect.fit.rooms.slice().sort().join() === draft.oh.fit!.rooms.slice().sort().join() : sameRing(expect.outline, draft.oh.outline);
    if (!shown || expect.profile.length !== draft.oh.profile.length || expect.profile.some((q, i) => Math.abs(q.h - draft.oh.profile[i].h) > 1e-6 || Math.abs(q.u - draft.oh.profile[i].u) > 1e-6))
      return { notes: [{ kind: 'info', text: `${a!.name} or ${b!.name} changed since the join was offered. Nothing changed; hover the offer again.`, ids: [] }] };
  }
  const i = p.overheads.findIndex((o) => o.id === aId);
  p.overheads[i] = draft.oh;
  p.overheads = p.overheads.filter((o) => o.id !== bId);
  return {
    select: aId,
    notes: [{ kind: 'good', text: `Joined ${b!.name} into ${a!.name}: one roof, one pitch, with the valley where they meet.`, ids: [aId] }],
  };
};

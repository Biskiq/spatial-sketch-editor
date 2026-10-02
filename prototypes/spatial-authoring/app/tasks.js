// Capability dispatch and the active task session.
//
// A task is work the editor is doing: unroll this wall around that window, open the museum along
// this line, lift that ceiling, type a height. It carries three separate things on purpose:
//
//   subject   the identity the user asked about. This is what the Card shows, and it never becomes
//             the host: an artwork on the Rotunda wall keeps the artwork as its subject while the
//             wall is the technical target.
//   target    where the work actually happens (the wall, the ceiling, the cut).
//   focus     the local point inside the target (a wall top, a ceiling underside). Focus is not an
//             identity, and selecting elsewhere never rewrites the subject.
//
// The seam also answers what a subject can offer at all — "Look" is derived from the fixture's real
// capabilities and the current reading, not from a permanent tool catalogue. Parking and Resume are
// completed by the lens stage; S1 establishes the record and the neutral teardown.
import { S, thing, W, C } from './state.js';
import * as nav from './navigation.js';

// ----- what a subject can offer ------------------------------------------

// Capability is a property of the fixture, not of the shell: a bench offers nothing, a curved wall
// can unroll, a ceiling can lift and be looked up at, an artwork faces the wall it hangs on.
// 'dims' is the in-place measurement task: it opens no reading and moves nothing, so it is offered
// wherever the fixture really carries numbers. An artwork without a stored size offers none, because
// the prototype would have nothing real to report.
export function capabilities(id) {
  const t = thing(id);
  if (!t) return [];
  const out = [];
  if (t.kind === 'walls') {
    out.push('face');
    if (t.item.kind === 'arc') out.push('unroll');
    out.push('dims');
  } else if (t.kind === 'openings') {
    out.push('face');
    if (t.wall && t.wall.kind === 'arc') out.push('unroll');
    out.push('dims');
  } else if (t.kind === 'art') {
    // A hanging artwork's Look is the wall it hangs on. With no wall reference there is nothing to face
    // and nothing to fly to, so the work it offers is Repair — not a guessed host.
    if (t.item.wall) out.push('face');
    else out.push('repair');
    if (typeof t.item.w === 'number' && typeof t.item.h === 'number') out.push('dims');
  } else if (t.kind === 'ceilings') {
    out.push('lift', 'lookup', 'dims');
  }
  if (S.session?.kind === 'section' || S.knife) out.push('reveal');
  return out;
}

export const can = (id, what) => capabilities(id).includes(what);

// The verb a capability wears in the shell.
export const VERB = {
  face: 'Look',
  unroll: 'Unroll',
  lift: 'Lift',
  lookup: 'Look up',
  dims: 'Measure',
  reveal: 'Reveal',
  repair: 'Repair',
};

// The capabilities that do real spatial work, as opposed to the in-place measurement task. The Card
// keeps them in separate sections so "Look" never means "show me the numbers".
export const SPATIAL = ['face', 'unroll', 'lift', 'lookup'];
export const IN_PLACE = ['dims'];
// Work about a reference itself: neither a standpoint nor a measurement — a second kind of decision.
export const REFERENCE = ['repair'];

// ----- the active task ---------------------------------------------------

export const current = () => S.task;
export const subjectOf = () => S.task?.subject ?? null;
export const targetOf = () => S.task?.target ?? null;
export const focusOf = () => S.task?.focus ?? null;
export const isActive = (kind) => S.task?.kind === kind;

const nameOf = (id) => thing(id)?.item?.name ?? '';

// begin() records the work as it is invoked. `subject` is the identity that asked for it; `target`
// is what the work is done to.
export function begin({ kind, subject = null, target = null, focus = null, params = {}, instrument = true }) {
  const depth = S.task && S.task.kind !== kind ? (S.task.depth || 0) + 1 : (S.task?.depth || 0);
  S.task = { kind, subject, target, focus, params, depth, instrument, since: performance.now() };
  return S.task;
}

// Readings that are entered by nesting keep their parent's task visible through `depth`.
export function end() { S.task = null; }

export function setFocus(focus) { if (S.task) S.task.focus = focus; }
export function clearFocus() { if (S.task) S.task.focus = null; }
export function setParam(key, value) { if (S.task) S.task.params = { ...S.task.params, [key]: value }; }

// Precision is a state of the active task, not a mode of the shell: it is where the numbers of the
// work in hand are reached without a pointer, and it exists only while a task does. Exiting it
// restores the task surface exactly as it was.
export function setPrecision(on) {
  if (!S.task) return false;
  S.task.precision = !!on;
  return S.task.precision;
}
export const isPrecision = () => !!S.task?.precision;

// For the shell: one description of the current work, with the subject and the target named
// separately so no title can conflate them.
export function describe(task = S.task) {
  if (!task) return null;
  const subjectName = task.subject ? nameOf(task.subject) : null;
  const targetName = task.target?.label || (task.target?.id ? nameOf(task.target.id) : null);
  const focusLabel = task.focus?.label || null;
  const titles = {
    face: subjectName ? `Facing ${subjectName}` : 'Facing the wall',
    unroll: targetName ? `${targetName} · unroll around ${subjectName || 'the subject'}` : 'Unrolling the wall',
    section: 'Open along a line',
    lift: targetName ? `${targetName} lifted` : 'Lifting the ceiling',
    lookup: targetName ? `Looking up · ${targetName}` : 'Looking up',
    dims: subjectName ? `${subjectName} · measurements` : 'Measurements',
    repair: subjectName ? `Repairing ${subjectName}` : 'Repairing a missing reference',
  };
  return {
    kind: task.kind,
    title: titles[task.kind] || task.kind,
    subject: task.subject,
    subjectName,
    target: task.target,
    targetName,
    focus: task.focus,
    focusLabel,
    depth: task.depth || 0,
    precision: !!task.precision,
  };
}

// ----- dispatch ----------------------------------------------------------

// The operation layer registers what each capability does; this seam only routes and records.
const dispatch = {};

export function setDispatch(table) { Object.assign(dispatch, table); }

export function invoke(kind, opts = {}) {
  const fn = dispatch[kind];
  if (!fn) return null;
  return fn(opts);
}

export const dispatchable = () => Object.keys(dispatch);

// ----- neutral teardown and parking --------------------------------------

// Registered by the operation layer: drop the reading's geometry, clips, ghosts and mirrored
// reading without animating anywhere. Nothing here restores an origin pose.
let neutralize = null;
export function setNeutralize(fn) { neutralize = fn; }

// Park: cancel whatever is unaccepted, freeze the realized standpoint, then drop the reading. The
// camera stays exactly where it was rendered — the derived-flatness formula must not dolly it.
export function park({ neutralizeReading = true, keepRealized = true } = {}) {
  const before = nav.realized();
  if (keepRealized) nav.holdRealized();
  if (neutralizeReading && neutralize) neutralize();
  return { held: nav.hold(), before, after: nav.realized() };
}

export const parked = () => S.parked;

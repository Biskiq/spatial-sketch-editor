import { byId, findThing } from './model.js';

// Editor session state. Nothing here is architecture: the museum lives in ctx.museum,
// and view state (standpoint, what is open, the trail) never enters Undo.
export const S = {
  sel: null,
  hover: null,
  session: null,
  sid: 0,
  tool: 'select',
  knife: null,
  motion: 'adaptive',
  /* the Motion control in the view bar: cut every move to an instant change, like the OS setting */
  reduceMotion: false,
  /* the Wall grid control: draw the wall being worked on as drafting paper, or show its real
     material. Off means the wall is never papered, in any view, for any curvature. */
  wallDrafting: true,
  seen: {},
  trail: [],
  trailPos: -1,
  undo: [],
  redo: [],
  pending: null,
  refusal: null,
  /* the one value a gesture or the numeric editor currently owns, for emphasis only */
  activeEdit: null,
  reveal: null,
  recentCut: null,
  popover: null,
  busy: false,
  hurry: false,
  shift: false,
  caption: null,
  status: null,
  edited: new Set(),
  beacon: null,
  summary: null,
  finder: null,
  gated: [],
  /* the work the editor is doing: capability, initiating identity, technical target, local focus.
     Set and cleared by the task seam; the linger selection is not this. */
  task: null,
  /* an inactive task remembered for explicit Resume, and only that */
  parked: null,
  /* realized flatness held while a reading is deactivated, so parking cannot move the eye */
  flatHold: null,
  /* browse/search context: query and focused row. Never selection, never a standpoint. */
  browse: { q: '', focus: null },
  /* QA observation only: a command that threw, or a page error. Never a source of product behaviour;
     the acceptance harness asserts this stays empty. See qa/README.md. */
  faults: [],
};

let faultSeq = 0;
export function recordFault(kind, detail) {
  faultSeq += 1;
  S.faults.push({ n: faultSeq, kind, message: String(detail?.message ?? detail ?? ''), stack: detail?.stack ? String(detail.stack).split('\n').slice(0, 4).join(' | ') : '', at: performance.now() });
  if (S.faults.length > 200) S.faults.shift();
}

export const ctx = {
  museum: null,
  stage: null,
  ov: null,
  ui: () => {},
};

export const W = (id) => byId(ctx.museum.walls, id);
export const C = (id) => byId(ctx.museum.ceilings, id);
export const thing = (id) => (id ? findThing(ctx.museum, id) : null);
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const galleryName = (id) => byId(ctx.museum.galleries, id)?.name;

export function refOf(id) {
  const t = thing(id);
  if (!t) return '';
  if (t.item.ref) return t.item.ref;
  if (t.kind === 'art') return 'SCENE · ' + id.toUpperCase().slice(0, 6);
  return 'SCENE';
}

export function labelOf(id) {
  const t = thing(id);
  return t ? t.item.name : '';
}

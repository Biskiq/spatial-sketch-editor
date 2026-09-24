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
  seen: {},
  trail: [],
  trailPos: -1,
  undo: [],
  redo: [],
  pending: null,
  refusal: null,
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
};

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

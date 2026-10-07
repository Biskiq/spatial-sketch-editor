import { byId, findThing } from './model.js';

// Editor session state. Nothing here is architecture: the museum lives in ctx.museum,
// and view state (standpoint, what is open, the trail) never enters Undo.
export const S = {
  /* Two authoring lenses over the same project, with one canonical selection and Camera. */
  lens: 'world',
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
  /* An inactive task remembered for explicit Resume, and only that: the original identity, the
     resolving targets and the reading/task parameters. Never a Camera, a selection snapshot, an
     unaccepted proposal or a geometry object. See actions.js (parkWorldWork / parkedContext). */
  parkedByLens: {world:null,experience:null},
  // Compatibility view for retained World QA; storage is the one lens-keyed map.
  get parked() { return this.parkedByLens.world; },
  set parked(value) { this.parkedByLens.world=value; },
  /* A listing a crossing is leaving, remembered beside the parked record rather than inside it: it is
     context, not work, and only an explicit Resume puts it back. Never a selection, never a Camera. */
  browseMemory: null,
  /* Experience session state, never source and never Undo. `expAudition` projects supported capability
     values temporarily while a World subject is operated; `expCaptureAsk` holds the ambiguous
     captured-use choice; `expReview` records the product outcomes the quickstart instructions observe. */
  expAudition: null,
  expCaptureAsk: null,
  /* A shared-contribution replacement that reaches more than one linked Activity waits here for an
     explicit local/shared acceptance, so a rebind can never silently change every linked use. */
  expRebindAsk: null,
  /* `expReview` records what the review aid observes: product outcomes the real paths report, and the
     provenance of the document on screen. `source` names the loader that produced the current document
     ('none' at boot), `writes` counts accepted authoring commands since that load, `authored` names the
     outcomes this session authored (a Presentation, an explanation, a capture, a framing, a Guide Stop),
     `at` records the outcomes that belong to one moment rather than to the session, keyed by Presentation — a
     View an author captures or an explanation they write is that moment's, while a loader's framing is not —
     and the rest hold the last real outcome of each product path (a completed visit, a visitor session, a
     scope decision, a provider loss). A step's
     outcome is read from here and from the authored documents — never from a field being present or a
     button having been pressed, and a quickstart topic is credited only for the outcomes its own
     instruction authors, so any unrelated edit cannot complete it. */
  expReview: { auditions: 0, previews: 0, source: 'none', writes: 0, at: {}, peeks: 0, visit: null, visitor: null, scope: null, loss: null },
  /* realized flatness held while a reading is deactivated, so parking cannot move the eye */
  flatHold: null,
  /* browse/search context: query, page and focused place/relation. Never selection, never a standpoint. */
  browse: { q: '', focus: null, page: 0 },
  /* the narrow shell's sheets: the Index and the Card over the stage. A disclosure, so it changes what
     is shown and nothing else — never the reading, the work in hand or the Camera. */
  sheet: { index: false, card: false },
  /* the system's own reduced-motion preference, followed live. Separate from the user's Reduce-motion
     choice below: the choice is the editor's, the preference is the machine's. */
  osReduced: false,
  /* the Card's Details disclosure. A disclosure toggle changes what is shown and nothing else. */
  expand: false,
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
export const thing = (id) => (id ? findThing(ctx.museum, id) || (ctx.sceneSource?.subjects[id] ? {kind:'objects',item:ctx.sceneSource.subjects[id]} : null) : null);
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

// Editor session state. None of this is authored truth: selection, the current
// Stop, the browsing camera, inspections, capture drafts, the drawer lens and the
// preview run all disappear on reload and never enter Undo.

export const S = {
  mode: 'author', // 'author' | 'preview'
  exp: 'E-HOW',
  stop: null, // current Stop (occurrence id) — the drawer's context
  sel: null, // { kind: 'stop'|'beat'|'state'|'subject'|'perf'|'view'|'diag', ... }
  hover: null,
  look: 'free', // 'shot' (through the current Stop's shot) | 'free' (session browsing)
  orbit: null, // session browsing camera
  camAnim: null, // { from, to, t0, dur, then }
  inspect: null, // { inst, comp, sep, cut, origin, level: 'casing'|'bay', casingPose, lookBefore }
  capture: null, // capture sheet draft
  drawer: { open: true, lens: 'beats' },
  scrub: null, // Stop-local authoring-preview time; null → the Stop's waiting moment
  panel: 'inspect', // right panel: 'inspect' | 'review'
  motion: 'full', // 'full' | 'reduced'
  toast: null,
  menu: null, // popovers
  pendingMove: null, // { inst, pos }
  pendingPerf: null, // { perf, separation }
  presenter: { open: false, j: 0, s: 0, pos: null }, // pos: { x, y } when dragged; null = default bottom-left
  world: { t: 0 },
  help: false,
  specimen: null, // 'visitor' when the page is only the visitor runtime
};

export const app = { R: null, stage: null, ui: () => {}, frame: () => {} };

export const reducedMotion = () => S.motion === 'reduced';

import { S, ctx, C } from './state.js';
import { createMuseum } from './model.js';
import { run, finishTweens, tween } from './anim.js';
import { ease } from './stage.js';
import * as A from './actions.js';
import { applyField } from './ui.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const idle = async () => { await new Promise((r) => setTimeout(r, 30)); while (S.busy) await new Promise((r) => setTimeout(r, 30)); };

function edit(label, fn) {
  A.beginEdit();
  const err = fn();
  if (err) { A.cancelEdit(); A.setStatus(err, 'refuse'); return; }
  A.commitEdit(label);
}

async function reset() {
  finishTweens();
  await run(async () => {
    if (S.session) await A.exitSessionInner(A.home3D());
  });
  if (S.knife) A.cancelKnife(true);
  Object.assign(S, { popover: null, reveal: null, recentCut: null, summary: null, beacon: null });
  A.restoreQuiet(createMuseum());
  S.undo = []; S.redo = []; S.pending = null;
  const c = A.home3D();
  Object.assign(ctx.stage.cam, { target: c.target, az: c.az, el: c.el, frameH: c.frameH, flat: 0, mirror: false });
  S.last3D = ctx.stage.camState();
  S.trail = []; S.trailPos = -1;
  A.pushTrail('3D');
  A.select(null);
}

const gwin = () => ctx.museum.walls.find((w) => w.id === 'rotunda').openings.find((o) => o.id === 'gwin');

// the scripted versions of the hand gestures, so a journey can show them
async function peel(wallId, sA, to) {
  A.beginPeel(wallId, sA);
  await run(() => tween(S.motion === 'instant' ? 0 : 1100, (t) => A.peelTo(to * ease(t))));
  A.endPeel();
}
async function liftTab(id) {
  A.beginLid(id);
  await run(() => tween(S.motion === 'instant' ? 0 : 700, (t) => A.lidTo(0.6 * ease(t))));
  await A.endLid();
}

export const JOURNEYS = [
  {
    id: 'A', name: 'Curved wall',
    kicker: 'Journey A · reshape a window in the round wall',
    steps: [
      { t: 'An ordinary moment in 3D', b: 'The museum on its mat. Two galleries: the straight Long Gallery and the round Rotunda, one step taller. Nothing is open, nothing is flattened.', run: async () => { await reset(); } },
      { t: 'Select the Garden window', b: 'The selection is the opening itself, in PLATE blue — the Navigator, the Inspector and the view all name <b>O-GW</b>. Already in 3D it has the handles whose axis you can read from here, and its numbers. A folded corner sits on the wall top above it.', run: async () => { A.select('gwin'); } },
      { t: 'Pull the corner', b: 'D’s gesture, kept: pull the dog-ear and the wall unrolls under your hand, from where you stand — outside, so you see the outside face. Let go at about 180° and it <b>stays there</b>. The dashed ring on the floor is the wall as built; the unrolled sheet wears paper, and the strip says <b>view only</b>.', run: async () => { A.select('gwin'); await peel('rotunda', gwin().s, 0.5); } },
      { t: 'Walk round to the inside', b: 'Inside / Outside is a real standpoint, not a flag: the camera swings round the wall. The window’s neighbours swap hands, because you are on the other side of the same wall.', run: async () => { await A.setSide(1); } },
      { t: 'Square up — to scale in height only', b: 'Standing square, the mat becomes paper and a <b>vertical</b> scale bar appears: heights can be read off the picture. There is no horizontal bar, because a half-round wall foreshortens widths. The numbers are another matter — they are measured on the wall, so they are exact at any curvature.', run: async () => { await A.squareUp(); } },
      { t: 'Lay it flat', b: 'Drag the curvature dial to Flat. Now the horizontal scale bar returns: the sheet is to scale both ways. 34.56 m of wall, the seam marked S at both ends, junctions A and B.', run: async () => { await A.unrollTo(1); await A.squareUp(); } },
      { t: 'Flatten the arch', b: 'Drag the spring-line handle, or type the rise. The head stays at 3.40 — only the spring line moves. One Undo entry; the Inspector field moved with it because they are the same number.', run: async () => { A.select('gwin'); edit('Garden window arch rise', () => A.applyOpening('gwin', { rise: 0.45 })); } },
      { t: 'Widen it', b: 'Drag a jamb and the opposite jamb holds. 1.60 → 2.20 along the curve.', run: async () => { edit('Garden window width', () => A.applyOpening('gwin', { w: 2.2 })); } },
      { t: 'Back to 180°, step into 3D, keep working', b: 'Curvature is a view you can stop anywhere. In 3D, handles whose axis you can read stay live; any that run too close to your line of sight drop out and their numbers stay typeable. Here the sill drops to 0.70 from the 3D view.', run: async () => { await A.unrollTo(0.5); await A.stepBack(); A.select('gwin'); edit('Garden window sill', () => A.applyOpening('gwin', { sill: 0.7 })); } },
      { t: 'Let the Rotunda rise toward the garden', b: 'Top form → Gable, ridge over the window at 7.20. The ceiling line stays drawn at 6.00 so you can see the wall now stands above it.', run: async () => {
        const g = ctx.museum.walls.find((x) => x.id === 'rotunda').openings.find((o) => o.id === 'gwin');
        edit('Rotunda wall top → Gable', () => A.applyWallTop('rotunda', { form: 'gable', h0: 6, h1: 6, rs: g.s, rh: 7.2 }));
        A.select('rotunda');
      } },
      { t: 'Put it back — and see what stays', b: 'Esc rolls the wall back onto its footprint while you walk back to where you stood — one motion. Then the editor names what you changed while it was open: four building changes stay, with one button to undo them all. View state went back; edits did not.', run: async () => { await A.closeSession(); } },
    ],
  },
  {
    id: 'B', name: 'Look inside',
    kicker: 'Journey B · open the museum along a line',
    steps: [
      { t: 'Tilt into Plan', b: 'Plan is the same camera tipped straight down: the cut descends through the building to 1.20 and the mat turns to paper. Drag the bead in the view bar to tilt by hand.', run: async () => { await reset(); await A.goPlan(); } },
      { t: 'Draw a line through the museum', b: 'The arrow says which way you will look, the band how far in (6.0 m). The live peek shows what the cut reveals before anything opens. In 3D the building previews the cut in place.', run: async () => { A.startKnife(); await idle(); A.presetKnife([-17, 0.25], [13, 0.25], -1, 6); } },
      { t: 'Slide it to compare', b: 'B’s exploratory preview, restored: drag the yellow grip and the line slides, the peek re-deriving the cut as you go. The end grips turn it. You choose by recognising a picture, and nothing has opened yet.', run: async () => { const k = S.knife; k.p0 = [k.p0[0], -1.6]; k.p1 = [k.p1[0], -1.6]; k.dirty = true; ctx.ui(); await new Promise((r) => setTimeout(r, 500)); k.p0 = [k.p0[0], 0.25]; k.p1 = [k.p1[0], 0.25]; k.dirty = true; ctx.ui(); } },
      { t: 'Open it', b: 'The near half parts toward you and fades; the plan tips up and settles face-on to the cut. Only the selection speaks at full strength — every other source carries its reference quietly, so the drawing stays legible as the museum grows.', run: async () => { await A.commitKnife(); } },
      { t: 'Pull the depth in', b: 'Depth 3.0 m: the North wall and Harbor at Dusk leave the drawing. The selected painting keeps a place on the paper — a dashed ring where it is, and why it is not drawn.', run: async () => { A.setDepth(3.0); A.select('harbor'); } },
      { t: 'Go to its wall', b: 'The Inspector offers three ways back to it: include it, show it through, or go to its wall. Going to the wall <b>nests</b>: the strip now reads 3D › Section › Facing, and the button says Back.', run: async () => { await A.goToHost('harbor'); } },
      { t: 'Esc — straight back into the cut', b: 'Esc steps back one crumb, exactly: the same cut, the same 3.00 m depth, the same standpoint, the painting still selected. ⇧Esc would have put everything back at once.', run: async () => { await A.closeSession(); } },
      { t: 'Include it', b: 'Or reach just far enough: depth 3.00 → 4.00 m, a number you can see, recorded as a view change — never in Undo.', run: async () => { A.includeIt('harbor'); } },
      { t: 'Raise the Gallery door from the cut', b: 'The door is cut through its middle, so its head is honest here: drag it up. One Undo entry.', run: async () => { A.setDepth(6); A.select('gdoor'); edit('Gallery door head', () => A.applyOpening('gdoor', { head: 3.2 })); } },
      { t: 'Close it up', b: 'The halves slide back together and the camera lies back down into Plan. The cut stays as a quiet line with “Reopen this cut”, and it is on the trail.', run: async () => { await A.closeSession(); } },
    ],
  },
  {
    id: 'C', name: 'Ceiling',
    kicker: 'Journey C · find and fix a line of light',
    steps: [
      { t: 'The wall explains itself', b: 'Select the North wall. The Inspector says its top is 20 cm below the Long Gallery ceiling — the thin line of daylight a visitor would see.', run: async () => { await reset(); A.select('north'); } },
      { t: 'Lift the lid by its tab', b: 'Select the ceiling and a tab appears on its edge: drag it up and the lid rises where you stand (D’s gesture). Past a third it finishes lifting. The dashed outline stays where the ceiling really is. Every wall it rests on is tethered: three meet it, the North wall has a coral 20 cm gap, the light slot is green — open on purpose.', run: async () => { A.select('longc'); await liftTab('longc'); } },
      { t: 'Ask the gap what to do', b: 'Clicking the coral tag offers the fixes the model supports — nothing is repaired silently.', run: async () => { S.popover = { wall: 'north', ceil: 'longc' }; ctx.ui(); } },
      { t: 'Preview before choosing', b: 'Hovering “Lower the ceiling” previews the consequence: the South and West walls would then stand 20 cm above it. Nothing is committed yet.', run: async () => { const opts = A.gapOptions('north', 'longc'); S.popover = { wall: 'north', ceil: 'longc', opts }; A.previewOption(opts[1]); ctx.ui(); } },
      { t: 'Raise the wall instead', b: 'One click, one Undo entry. The tether goes quiet: four of four walls meet it.', run: async () => { A.unpreview(); A.commitOption(A.gapOptions('north', 'longc')[0]); } },
      { t: 'Look up', b: 'The lid settles back as the camera sinks below the floor and turns to look straight up. Everything under 1.60 is sliced away, so the overhead reads like a plan from underneath. Looking up nests inside the lift: the strip reads 3D › Lifted › Looking up.', run: async () => { await A.lookUp('longc'); } },
      { t: 'Mirror to match Plan', b: 'Looking up, east is on your left — honest, you tilted your head back. Mirror flips the drawing so east is on the right like Plan; the compass says which you are in.', run: async () => { A.toggleMirror(); ctx.ui(); } },
      { t: 'Lower the soffit', b: 'Type an underside height: 3.20 → 3.00. Height runs along your line of sight here, so the gate offers no drag handle — it is typed.', run: async () => { A.select('soffit'); applyField({ type: 'ceil', id: 'soffit', key: 'base' }, 3.0); } },
      { t: 'Put everything back', b: '⇧Esc (or the first crumb) closes the whole chain at once and returns to where you began. The summary names the two building changes; the lift, the look-up and the mirror were all view.', run: async () => { await A.closeAll(); } },
    ],
  },
  {
    id: 'D', name: 'Fast repeat',
    kicker: 'Journey D · the same moves, for someone who knows them',
    steps: [
      { t: 'Motion that learns', b: 'Each move plays at teaching speed the first two times you see it, with a caption; after that it is brisk and silent. And every opening is now <b>one</b> beat — the Rotunda goes from 3D to a flat sheet in one motion (0.8 s once learned, down from a 5.5 s six-step sequence). <kbd>Shift</kbd> makes any move instant.', run: async () => { await reset(); S.motion = 'adaptive'; S.seen = { face: 3, close: 3, section: 3, lift: 3, lookup: 3, plan: 3, '3d': 3, unfold: 3, fold: 3, switch: 3, side: 3, trail: 3 }; A.setStatus('Motion now brisk for moves you have already seen', 'view'); } },
      { t: 'One press to a flat sheet', b: 'Select the Rotunda wall and press <b>O</b> — or click its corner.', run: async () => { A.select('rotunda'); await A.unfold(); } },
      { t: 'Hop straight to another wall', b: 'Same kind of open state, so it replaces rather than nests: the Rotunda rolls up while the camera goes to the Entrance. Esc will go home, not back to the Rotunda.', run: async () => { A.select('entrance'); await A.face('entrance'); } },
      { t: 'Step back along the trail', b: '<kbd>[</kbd> and <kbd>]</kbd> walk the view history — standpoints restored exactly, including curvature and side. Undo is untouched.', run: async () => { A.trailStep(-1); } },
      { t: 'Home in one key', b: 'Esc puts everything back and returns to the standpoint you started from.', run: async () => { await A.closeSession(); } },
    ],
  },
  {
    id: 'E', name: 'Everyday edit',
    kicker: 'Journey E · ordinary authoring across Plan, 3D and a wall face',
    steps: [
      { t: 'Select a window in Plan', b: 'Plan is the camera tipped down, so the Garden window has the same kit as everywhere else, seen from above: a grip to slide it and two jambs. Sill and head run along your line of sight here, so the gate offers no handles for them — their numbers are typed, on the tapes.', run: async () => { await reset(); await A.goPlan(); A.select('gwin'); } },
      { t: 'Slide it along the curve', b: 'The grip follows the wall, not the screen: 4.32 → 6.40 m round from the seam. One Undo entry.', run: async () => { edit('Garden window position', () => A.applyOpening('gwin', { s: 6.4 })); } },
      { t: 'Widen it', b: 'A jamb drag, measured along the curve: 1.60 → 2.00.', run: async () => { edit('Garden window width', () => A.applyOpening('gwin', { w: 2.0 })); } },
      { t: 'Tilt toward 3D', b: 'Drag the bead half-way. Nothing is swapped: as the walls stand up, the sill and head handles arrive because their axis has become readable. The selection never left.', run: async () => { await A.fly({ ...ctx.stage.camState(), el: 0.8, flat: 0 }, S.motion === 'instant' ? 0 : 1000); A.pushTrail('3D'); } },
      { t: 'Raise the head, in 3D', b: 'A coarse edit where you are: 3.40 → 3.80. The drag runs on the wall’s own face, so the number is exact even in perspective.', run: async () => { edit('Garden window head', () => A.applyOpening('gwin', { head: 3.8 })); } },
      { t: 'Face it for the profile', b: 'Profile details belong where you stand square: F walks you inside, facing it. The arch rise has its handle here; drop it to 0.60.', run: async () => { await A.face('gwin'); edit('Garden window arch rise', () => A.applyOpening('gwin', { rise: 0.6 })); } },
      { t: 'Esc — exactly back', b: 'Back to the tilted standpoint you left, not to a default 3D. The summary names the one change made while facing.', run: async () => { await A.closeSession(); } },
      { t: 'Plan, then Undo twice', b: 'Back in Plan, ⌘Z twice undoes the rise and the head. The view does not move; Undo only knows the building.', run: async () => { await A.goPlan(); A.select('gwin'); A.undo(); A.undo(); } },
    ],
  },
  {
    id: 'F', name: 'Where did it go?',
    kicker: 'Journey F · find anything, and be told why you can’t see it',
    steps: [
      { t: 'Find anything', b: 'D’s finder, kept: <kbd>/</kbd> searches names and references. Every result carries where it is <b>from here</b> — the same resolver the Inspector and the drawing use.', run: async () => { await reset(); document.querySelector('[data-act="find"]').click(); const i = $('#finderInput'); i.value = 'tide'; i.dispatchEvent(new Event('input')); } },
      { t: 'Pick one that is hidden', b: 'Tide Study I is inside the Rotunda, behind its wall from this standpoint. A beacon marks where it is; the Inspector says why you can’t see it and offers <b>Look at it</b> or <b>Face it</b>.', run: async () => { $('#finder').hidden = true; A.select('tide1'); S.beacon = 'tide1'; ctx.ui(); } },
      { t: 'Face it', b: 'One click walks you to the wall it hangs on.', run: async () => { await A.face('tide1'); } },
      { t: 'Find something set aside', b: 'While you face the Rotunda, Harbor at Dusk is set aside. Finding it says so, and offers to face it instead — replacing this wall, not nesting.', run: async () => { A.select('harbor'); S.beacon = 'harbor'; ctx.ui(); } },
      { t: 'Face it instead', b: 'The Rotunda rolls away and the camera goes straight to the North wall.', run: async () => { await A.face('harbor'); } },
    ],
  },
];

let J = 0, I = 0;

function render() {
  const j = JOURNEYS[J];
  const st = j.steps[I];
  $('#jTabs').innerHTML = JOURNEYS.map((x, k) => `<button class="${k === J ? 'on' : ''}" data-j="${k}"><span>${x.id}</span>${esc(x.name)}</button>`).join('');
  $('#jKicker').textContent = j.kicker;
  $('#jTitle').textContent = st.t;
  $('#jBody').innerHTML = st.b;
  $('#jDots').innerHTML = j.steps.map((_, k) => `<button class="${k === I ? 'on' : k < I ? 'done' : ''}" data-step="${k}" aria-label="Step ${k + 1}"></button>`).join('');
  $('#jCount').textContent = `${I + 1} / ${j.steps.length}`;
}

async function play(j, i, replay = true) {
  J = j; I = i;
  render();
  const steps = JOURNEYS[j].steps;
  if (replay) {
    const m = S.motion, seen = { ...S.seen };
    S.motion = 'instant';
    for (let k = 0; k < i; k++) { await steps[k].run(); await idle(); }
    S.motion = m;
    S.seen = seen;
  }
  await steps[i].run();
}

export function initJourneys() {
  const panel = $('#journeys');
  panel.addEventListener('click', (e) => {
    const tj = e.target.closest('[data-j]');
    if (tj) { play(+tj.dataset.j, 0, false); return; }
    const ts = e.target.closest('[data-step]');
    if (ts) { play(J, +ts.dataset.step); return; }
    const a = e.target.closest('[data-jact]');
    if (!a) return;
    const n = JOURNEYS[J].steps.length;
    if (a.dataset.jact === 'next') {
      if (I + 1 < n) play(J, I + 1, false);
      else if (J + 1 < JOURNEYS.length) play(J + 1, 0, false);
    }
    if (a.dataset.jact === 'prev' && I > 0) play(J, I - 1);
    if (a.dataset.jact === 'replay') play(J, I);
    if (a.dataset.jact === 'close') panel.classList.remove('open');
  });
  $('#jToggle').addEventListener('click', () => panel.classList.toggle('open'));
  render();
  const q = new URLSearchParams(location.search);
  if (q.get('journey')) {
    const j = Math.max(0, JOURNEYS.findIndex((x) => x.id === q.get('journey').toUpperCase()));
    const i = Math.min(+(q.get('step') || 0), JOURNEYS[j].steps.length - 1);
    panel.classList.add('open');
    setTimeout(() => play(j, i), 60);
  }
}

export { C };

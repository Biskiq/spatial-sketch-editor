# Commission 1 — Explain & Direct (prototype)

**Status: unratified design proposal, non-authoritative.** A runnable answer to Commission 1 in
[the durable design commissions](../2026-09-27-biskiq-durable-design-commissions.md). It follows the ratified
north star, the F contract and PLATE; proposed departures are listed in `rationale.html` §10. Nothing here is shipped
behavior and no prototype code is presumed shippable. No user testing has been done: usability claims are hypotheses.

## Run

Serve this folder with any static server (ES modules need `http://`, not `file://`):

```bash
python3 -m http.server 8827
```

Then open <http://localhost:8827/>. Three.js r175 is vendored in `vendor/`; fonts load from Google Fonts (falls back to system fonts offline).

- `rationale.html` — journey/state map, lifetimes and scope rules, specimens, Beats vs Clock comparison, run/ownership map, rejected alternatives, handoff (implemented vs simulated, assumptions, technical proofs, proposed departures), hypotheses.
- `?j=4.3` — jump straight to a journey step (1.1–6.7; list in the rationale and the Presenter).
- `?visitor=1` — touch visitor specimen (use a ~390 px wide window).
- `?motion=reduced` — reduced motion (also follows the OS setting, and the Motion toggle in the status bar).

Press <kbd>J</kbd> for the Presenter (outside the product): step through journeys, reset the fixture, or simulate
another writer / a failing capture. Drag the Presenter by its header to move it out of the way; double-click the
header to dock it back bottom-left. Press <kbd>?</kbd> for keys. The authoring surface needs a window ≥1000 px wide.

## The authoring path (start here)

The Presenter’s first row is the path the demo teaches, left to right; each stage is a shortcut into the journey
that walks it. Every step names the controls it uses in its **Where** line, and *Set up this state* / *Replay* put
the demo into that exact state so a step can be re-run or poked at by hand.

| Stage | Journey | What it wires |
| --- | --- | --- |
| **Set up** | 1 · Inspect & capture | Your own camera → <kbd>I</kbd> inspect → <kbd>C</kbd> **Capture**: one accepted step makes a Camera view *and* a Stop |
| **Build** | 2 · Build “How it works” | Stops in order, with their words. Still moments: a view, the states it holds, no timing |
| **Wire** | 3 · Reuse & timing | **Beats** join one shot to the next — **cut** or **travel**, at a word cue — plus the reusable performance; its last step reads every Stop on one ruler |
| **Read & run** | 4 · Preview, interrupt, rejoin | The visitor run: pause, free look, a control conflict, handoff, rejoin |

Journeys 5–6 (a second Experience; revise and repair) are branches off the path, not stages of it.

**One Stop at a time, or the whole thing.** Still, Beats and Clock are all Stop-local. The drawer’s fourth lens,
**Whole**, lays every Stop of the Experience end to end on one ruler: drag anywhere on it to scrub all of them in
one motion, <kbd>Space</kbd> plays it through, and **Hold at waiting moments** stops where the run stops (turn it
off to play straight through the gates). It reads the same pure evaluation the Clock lens and the run use, so it
writes nothing. `?j=3.7` opens it.

### Camera pathing in this prototype

Deliberately partial. `camera.routes` does carry authored waypoints (`via` — the fixture ships four routes), and
travel interpolates along them; there is **no control that authors or moves a waypoint**. What *is* authorable:
route *existence* (Review → **Add a route**, a straight leg between two views, `via: []`) and, per beat,
**cut vs travel**. Travel duration is derived from the path length (`clamp(len / 1.7, 1.6, 4.8)`), never typed. A
cut needs no route, which is why the demo’s camera work is mostly cuts.

## Files

| Path | Role |
| --- | --- |
| `index.html`, `styles/app.css` | Shell (PLATE grid + proposed Experience station) and all styles |
| `app/fixture.js` | Pump bay, pump definition, views/routes, the “Open casing” performance, two Experiences (revision 14) |
| `app/camera.js` | The one Camera evaluator: framing (locked/assisted), coverage, routes, travel, orbit, blends |
| `app/derive.js` | Pure derivations: Stop schedule from beat relations, Stop evaluation, diagnostics |
| `app/store.js` | Acceptance: expected revision → typed intent → validate → one history entry or refusal; Undo/Redo |
| `app/run.js` | Isolated preview/visitor run: ownership, conflicts (yield/stop/handoff), rejoin, restart |
| `app/actions.js`, `app/state.js` | Session state and creator actions (inspection, capture, preview) |
| `app/stage.js` | Three.js scene and thumbnails |
| `app/ui*.js` | Outline, Inspector, Stop drawer lenses, visitor, per-frame tags/map |
| `app/journeys.js` | Presenter fixtures and deep links |
| `app/main.js` | Boot, frame loop, pointer and keyboard |
| `rationale.html`, `styles/doc.css` | Rationale and handoff |

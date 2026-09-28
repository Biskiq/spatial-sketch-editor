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

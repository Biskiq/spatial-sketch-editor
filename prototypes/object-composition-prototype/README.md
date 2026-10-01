# Commission 2 — Objects & Assemblies (prototype)

An unratified design proposal for the brief in
[`2026-09-27-biskiq-durable-design-commissions.md`](../../docs/roadmap/f-foundation-contracts/design/proposals/2026-09-27-biskiq-durable-design-commissions.md)
(Commission 2, “Compose a reusable display light”). It's a runnable design prototype, not production code, and nothing in it is shipped behaviour.

## Run

From the repository root:

```bash
python3 -m http.server 8832 --bind 127.0.0.1 --directory prototypes/object-composition-prototype
```

Then open [the demo](http://127.0.0.1:8832/). (There's also a `c2-objects-and-assemblies` entry in `.claude/launch.json`.) No build step: plain ES modules with vendored Three.js r175 (`vendor/`, MIT).

## Pages

- `index.html` — the prototype. The dark **presenter** (<kbd>J</kbd>, outside the product) walks the six scenario steps. “Set up step N” resets and completes the earlier steps; “Do it” performs a task through the same actions a creator would use. Drag the presenter by its header to move it out of the way; double-click the header to dock it back.
- `rationale.html` — proposition, annotated journey/state map (`#journey`), terminology and scope rules, lifetime cues, contextual-vs-bench comparison, rejected alternatives, proposed PLATE/P26 departures, accessibility, usability hypotheses.
- `specimens.html` — reusable patterns (capability disclosure, value rows, reach, relationships, repair), state specimens for unavailable resources and cancelled updates, live states, and the narrower density specimen.

- [`HANDOFF.md`](HANDOFF.md) — implemented versus simulated behavior, review links, semantic assumptions, findings and technical proofs.
- [`qa/verification.md`](qa/verification.md) — final browser and repository verification record; repeatable browser checks in `qa/checks.js`.

## URL parameters

`?step=1..6` (`&done=1` also completes that step) · `?state=<name>` (see `STATES` in `app/scenario.js`) · `?approach=bench` · `?motion=reduced` · `?density=compact` · `?scenario=0` hides the presenter.

## Files

`app/model.js` fixture + domain rules (pure) · `app/state.js` store, accept/undo, stale check · `app/actions.js` every command · `app/stage.js` Three.js view · `app/overlay.js` viewport annotations · `app/ui.js` shell/Inspector/sheets · `app/scenario.js` presenter + named states · `app/main.js` wiring, pointer, keyboard · `styles/app.css`, `styles/doc.css`.

## Implemented vs simulated (short handoff)

- **Real in the prototype:** 3D picking and selection depth, drag/rest, hang with refusals, wall move carrying attachments, one-history-entry-per-accepted-action with domain labels, expected-revision stale refusal, reach preview, value provenance chains, revision comparison by declared part ids, per-project library references with retained copies.
- **Simulated (and labelled):** ingest (fixture manifests instead of parsing files), source revisions, library storage/network/availability, the “other writer”, Camera/Experience references (fixture records), the Layout compiler (a tiny bay compiler, not the canonical one), the articulation evaluator (a single tilt). Exploded inspection is presentation only.
- **Prototype-only shortcuts:** snapshot undo (whole-document before/after); selection pruning in `state.js`; local orbit/framing code (not canonical Camera integration). All work is in memory and resets on reload. Reference-only loading is disabled; missing-copy recovery remains a static specimen. Fonts are optional network requests with system fallbacks; prototype modules and Three.js are local.
- **Technical proofs still owed (brief's engineering follow-ups):** real structured ingest + a re-export with reordered/removed parts; attachment frames + picking back to source through a presentation offset; atomic failure on an invalid host.
- **Proposed contract departures:** see `rationale.html#departures` (object-first Contents, a wider review Inspector, a reach control in value rows, the lifetime palette).

## Verification status

Finished browser pass on 2026-09-27: **32/32 prototype checks**, including all six presenter steps and thirteen named states. Checked desktop (1440 × 900), compact review (1024 × 700), actual picking/dragging, keyboard recovery and reduced-motion range. Repository checks: **4,676 fast tests**, **254 architecture tests**, and both app typechecks pass. See the [verification record](qa/verification.md) for scope and limitations. Ready for owner design review; no user study or production acceptance is claimed.

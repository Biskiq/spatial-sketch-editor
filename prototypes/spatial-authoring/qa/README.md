# World Authoring Prototype QA

The prototype's acceptance lives beside its executable here, not in a design folder. Each script
owns its own static server for **this** checkout (an ephemeral port), waits for real readiness, and
**exits nonzero** when an assertion fails.

```sh
qa/run-all.sh              # every axis
qa/run-all.sh journey      # axis B: journeys A–F, one checkpoint per step
qa/run-all.sh interaction  # axis B: real pointer and keyboard paths
qa/run-all.sh flows        # axis B: peel, nested return, trail restore, knife, grid, reopen
qa/run-all.sh policy       # lifecycle: cancellation, identity vs target, neutral teardown
qa/run-all.sh shell        # the World shell's composition: one head, Index, Card, invoked Instrument
qa/capture-baseline.sh     # regenerate qa/baseline.json (deliberate: the accepted baseline changed)
```

Requires `agent-browser` and `python3`. `QA_SHOT=0` skips captures; `QA_BASE=http://host:port` measures
an already-running copy instead of starting one; `QA_OUT` moves the captures.

A run costs one browser session per axis; `agent-browser` starts dropping results after roughly a
hundred evals in a session, which shows up as **empty** results rather than wrong ones. An assertion
that failed with no value at all is a harness symptom: re-run that axis on its own session before
treating it as a behaviour failure.

## What is observed

`window.__me.qa` (in `app/main.js`) reports, read-only:

| Probe | Meaning |
| --- | --- |
| `state()` | reading label, canonical selection, Undo/Redo depth and last label, Reveal, knife aim, session kind and parameters (`u`, `side`, `depth`, `ceilId`, `focusId`, parent, origin), crumbs, trail, requested camera, **realized** camera (eye, up, direction, FOV, distance, framing), fault count |
| `museum()` / `hash()` | the accepted fixture's source values and a stable digest of them |
| `realized()` | the camera as rendered, not as requested — the distinction parking and resizing must keep |
| `faultList()` / `clearFaults()` | every command error inside `anim.run`, every frame error and every page error |
| `idle()` | resolves when the command queue is empty |
| `render()` | draws one frame on demand. A backgrounded tab stops `requestAnimationFrame`, so waiting for frames would hang the harness; assertions about what is drawn ask for a frame instead |

## Baselines and tolerances

- `baseline.json` holds the fixture digest, the A–F step inventory and one checkpoint per presenter
  step. `journey-check.sh` compares each step against it. Regenerating it means the accepted
  baseline changed; there is no automatic overwrite.
- Numbers compare with an absolute tolerance of **0.002** (`check.py --tol`). Requested and realized
  camera framing are recorded to three decimals. Positions and source values compare exactly.
- The realized camera — eye, distance and frame height — is a function of the **stage rect**, which
  each checkpoint records (`stage`). A shell change that resizes the stage therefore moves those
  numbers without moving any behaviour, and re-baselining is how that is recorded. The S2 baseline
  was regenerated for exactly that reason: the fixture digest (`650e93c4`), the fixture itself, the
  step inventory and every semantic field (`kind`, `sel`, `session`, `crumbs`, `trail`, `undo`,
  `lastUndo`, `fov`, `dir`, `up`, `target`) were identical, and only the fit-dependent fields moved.
  The Instrument overlays the stage rather than taking layout space, so the stage rect is constant
  across all 50 checkpoints and invoking work cannot change the fit of a reading.
- Screens are captures, never the assertion mechanism.

## Coverage limits (recorded, not hidden)

1. The A–F run proves 50 presenter steps against recorded checkpoints — reading, selection,
   parameters, Undo depth, crumbs and standpoint per step. It is not 50 independent proof cases for
   every spatial invariant; the invariants are asserted separately in `interaction-check.sh` and
   `flow-check.sh`.
2. Real gestures are covered where they carry a rule: handle drag and release, refusal rollback,
   typed values, Tab continuity, the peel, Plan and 3D drags, the knife slide, the reopen control.
   Pan/orbit/pinch feel, trackpad, touch and pen are not asserted here.
3. Accessibility proof is partial: keyboard reach for search, selection, numeric entry and unwind is
   asserted. Screen-reader announcements and focus order across the whole shell are not yet.
4. Responsive proof is 1440×900 in these scripts; other viewports and DPR2 belong to the stage that
   adds them, with the same harness.
5. Intermediate visuals (mid-peel, mid-lift, mid-cut) are captured on demand (`QA_SHOT=1`) and are
   evidence, not assertions.
6. Shell composition is asserted as geometry and inventory (what exists, where it sits, which verbs a
   subject offers), not as appearance: colour, type and spacing are the design system's business and
   are reviewed by eye. The 1440×900 viewport is the only one measured so far.

## Files

| File | Role |
| --- | --- |
| `lib.sh` | server, readiness, decoded evals, real pointer helpers, assertion counters, fault observation |
| `check.py` | subset/baseline comparison with numeric tolerance; `--get` reads one value |
| `capture-baseline.sh` | writes `baseline.json` |
| `journey-check.sh` | axis B presenter replay against the baseline |
| `interaction-check.sh` | axis B pointer/keyboard interaction wiring |
| `flow-check.sh` | axis B harvested flows and exact return |
| `policy-check.sh` | lifecycle: one cancellation policy, identity vs technical target, parking that keeps the realized camera |
| `shell-check.sh` | the World shell's composition: one search entry, the Index, the Card, the Instrument that takes no space, and a row's verb acting on the row's subject |
| `run-all.sh` | the axis driver |

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
qa/run-all.sh precision    # stage S3: spatial tasks, in-place measurement, Precision
qa/capture-baseline.sh     # regenerate qa/baseline.json (deliberate: the accepted baseline changed)
```

Requires `agent-browser` and `python3`. `QA_SHOT=0` skips captures; `QA_BASE=http://host:port` measures
an already-running copy instead of starting one; `QA_OUT` moves the captures.

Each axis is one browser session, torn down however its script ends — pass, failure or interrupt — and
the next axis never starts until that helper is gone. Never fan an axis into sections that each open
their own browser and server: every copy pays startup again and leaves the machine slower for the run
after it. The rules live in `.agents/skills/browser-test-hygiene`.

Minimum testing: an axis asserts only what its stage can break, aims at seconds rather than tens of
minutes, and is run on its own while a stage is being built; the full set belongs to a checkpoint.
Inside an axis, one eval returns a block's whole JSON blob and the assertions compare it in bash, so an
assertion costs no browser round trip.

What the harness knows about keys, measured rather than assumed:

- `agent-browser press <printable key>` does not release the key: the page then receives thousands of
  keydowns a second, forever, so the key's command re-runs whenever the state changes (close a reading
  and watch it open again). `qa_press` therefore dispatches the keydown itself for a single-character
  key, and keeps the CLI's press for Escape, Enter, Tab and the arrows.
- With a live knife aim on screen, `press` hangs for about 30 seconds and drops the key. Where that
  matters, `qa_key_dispatch` dispatches the keydown explicitly instead.
- A press can therefore also land after the eval that followed it, which is why key-driven assertions
  wait for the state the key should cause, and why the ordinary state a block depends on is established
  and then verified rather than assumed.
- What produces **no value at all** in an assertion is a command that hung or was dropped, not the
  number of evals: 220 plain evals in one session returned clean in 6 seconds. An empty result is a
  harness symptom; re-run the axis before reading it as a defect.

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
| `precision-check.sh` | stage S3: Look's three routes, the retained first gesture, in-place measurement, one active surface, Precision and its refusal, and a number reached where no handle is legible |
| `run-all.sh` | the axis driver |

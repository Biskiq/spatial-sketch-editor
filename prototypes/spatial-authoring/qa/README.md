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
qa/run-all.sh browse       # stage S4: Browse/Search context, result verbs, the Details grammar
qa/run-all.sh repair       # stage S5: the unresolved reference, Repair, and Owner/Source/Reach
qa/run-all.sh lens         # stage S6: the lens, parked work, and explicit Resume from the bridge
qa/run-all.sh responsive   # stage S7: viewport/DPR, keyboard controls and live reduced motion
qa/run-all.sh correctness  # numerical validators, summary history, nested parking and cancellation
qa/mutation-check.sh       # protected regressions on disposable copies
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
  key, and dispatches Escape on the focused element after native Escape stalls, and keeps native Enter, Tab and arrows.
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
- B7–B9 preserve the originally unselected Section subject as null; only these three expectations changed during S8, independently protected by correctness parking checks.
- Screens are captures, never the assertion mechanism.

## Coverage limits (recorded, not hidden)

1. The A–F run proves 50 presenter steps against recorded checkpoints — reading, selection,
   parameters, Undo depth, crumbs and standpoint per step. It is not 50 independent proof cases for
   every spatial invariant; the invariants are asserted separately in `interaction-check.sh` and
   `flow-check.sh`.
2. Real gestures are covered where they carry a rule: handle drag and release, refusal rollback,
   typed values, Tab continuity, the peel, Plan and 3D drags, the knife slide, the reopen control.
   Pan/orbit/pinch feel, trackpad, touch and pen are not asserted here.
3. Keyboard proof includes search/selection/invocation, fields/refusal announcements, line definition, sheet focus/return, shortcut isolation, gap preview/cancel, Repair/Resume and unwind. Screen-reader listening and assistive-device/usability trials remain outside this prototype acceptance.
4. Responsive proof covers 1440×900, 1280×800, 1024×768 and DPR2 with canvas/picking agreement and unchanged realized pose/source.
5. Intermediate visuals (mid-peel, mid-lift, mid-cut) are captured on demand (`QA_SHOT=1`) and are
   evidence, not assertions.
6. Shell composition is asserted as geometry and inventory (what exists, where it sits, which verbs a
   subject offers), not as appearance: colour, type and spacing are the design system's business and
   are reviewed by eye. The S7 axis also measures narrow desktop and DPR2.

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
| `browse-check.sh` | stage S4: one bounded dense list with paging and an honest register, browse/context that never selects or moves, Select that changes identity only, Open location/Bring into view/Include/Reveal/Face each on the named record, and Details Expand/Focus/Select/Open task as four distinct effects |
| `repair-check.sh` | stage S5: the quiet rest warning for an unresolved reference, the locator that is never a host, Repair's explicit wall pick and declared station/height, the fixture's own refusals, one accepted edit with Undo/Redo moving the reference and not the view, canceled and left-unresolved work writing nothing, and Owner/Source/Reach as supported facts |
| `lens-check.sh` | stage S6: crossing lenses parks World work as an inactive record with the realized eye and FOV unmoved, the read-only bridge's two identities and its named refusals for World work and Search, the foreign Card on return, contextual Resume explained locally for a changed selection or a changed/missing target, Resume as a fresh invocation with a fresh return context, and one cancellation covering an open draft and a live aim |
| `responsive-check.sh` | S7 viewport/DPR, sheet focus and pose stability, keyboard aim/fields/refusal, live OS reduced motion and identical endpoints |
| `correctness-check.sh` | remaining numerical and nested-lifecycle obligations, no duplicate broad shell suite |
| `mutation-check.sh` | same-defect replacement proof, disposable copies only |
| `run-all.sh` | the axis driver |

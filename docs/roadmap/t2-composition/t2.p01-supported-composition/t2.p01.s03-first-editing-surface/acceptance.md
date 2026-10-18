# T2.P01.S03 — closeout and acceptance stub

AUTHORITY: NONE — accepted evidence, review rounds and residuals are preserved in Git.

**Owner acceptance:** 2026-10-18, recorded from the slice owner's deliberate `slice-closeout`
invocation. The invocation is the owner acceptance event; it did not waive independent review, which is
recorded at the anchor below and covers the implementation revision. Acceptance covers the plan's
criteria at the declared `architecture-integration` tier; the declared integration route remains
[T2.P01.S04](../t2.p01.s04-bounded-composition-loop/implementation-plan.md), the phase's FINAL PHASE
GATE, which still owes the integrated result.

**Delivered:** the first coherent Scene editing surface over the landed F4/host contracts — two
contributed tasks (`place-object`, `scene-arrange`) registered through S07's contribution points, one
shared `ScenePlacementSession` per accepted source and reading for pointer and typed entry, typed
exact X/Z/yaw entry that plans the same canonical F4 intent a pointer release would, one proposal
identity keyed by accepted source and **reading** rather than by the frame's evaluation generation,
and the lifecycle that ends a proposal on a genuine reading change, an ended lease, task close,
source replacement and adapter unmount. Commits go through
`F4.intent-acceptance@1:local-single-domain-v1`; undo/redo are the host's history; Undo is unavailable
while a proposal is live. No Save, Preview, resize, duplicate or delete.

**Provenance:** implementation PR #147, branch `T2-P01-S03`; the tested implementation revision is
`8381dc54`, and the later commits in the PR are documentation only. Independent review ran three
rounds and ended **APPROVE** with no open finding; the only change after that verdict was the
recoverable-refusal regression case the review itself asked for.

**Evidence:** `architecture-integration` tier, at `8381dc54` — `npm run check` 0 errors / 0 warnings;
`test:fast` 138 files / 1939 tests; `test:arch` 20 files / 163 tests; `test:heavy` 8 files / 118 tests;
focused component and session suites 9 and 40 tests. Real dev server, canonical enclosed-room starter:
desktop, narrow (390×844), keyboard-only and reduced-motion journeys recorded, including a typed
proposal surviving four seconds of frame re-evaluation and committing exactly, honest planner
refusals that keep the form open, and Undo→Redo restoring the placed source. Manual-owed rows: 0. The
full evidence, the corrected `Fit` row and every limitation are in the anchor.

**Entry points:**

```text
implementation  apps/editor/src/lib/authoring/adapters/scene/placement.ts
                apps/editor/src/lib/authoring/adapters/scene/SceneTransformInstrument.svelte
                apps/editor/src/lib/authoring/adapters/scene.adapter.ts
validation      packages/project-model/src/f4/** (F4 admission, unchanged by this slice)
regressions     apps/editor/tests/lib/authoring/scene-proposal-lifetime.test.ts
                apps/editor/tests/lib/authoring/scene-editing-surface.test.ts
                apps/editor/tests/lib/authoring/scene-instrument-focus.test.ts
```

**Residuals:** typed entry is one exact group per proposal (combined move+rotate is an F4 decision);
a Stage press while the typed form is open cancels through the documented blur path and the toolbar
is therefore not a focus-preserving redraw; selection is not requalified after Undo→Redo of a Place
(host wiring, `T1.P01.S07`); a Place's completion message is not displayed because the accepted
install re-creates the instrument; the intermittent `stale-epoch` on `Begin` after an accepted install
was rechecked on 2026-10-18 and did not reproduce, and stays open as
[TD-8](../../../../operations/tech-debt/README.md#td-8--a-tasks-scoped-services-go-stale-after-an-accepted-install-refusing-begin).
Save, Preview, resize, duplicate and delete stay with T2.P01.S04. No active checkpoint existed for the
slice.

**Contract:** durable reference truth for the reachable rules lives in
[composition-execution.md](../../../../reference/composition-execution.md); this slice's host edits are
authorized by the [host-seam exception](../../../../reference/decisions/t2-s03-host-seams-2026-10-17.md)
and the [renderer exception](../../../../reference/decisions/t2-s03-renderer-exception-2026-10-17.md).

## CLOSEOUT PRESERVATION — T2.P01.S03 (2026-10-18)

```text
prose compacted:                 2   stubs at their own paths (this record, the plan)
reference promotions:            0   durable rules already owned by reference/composition-execution.md
renderable evidence archived:    0 files / 0 bytes
evidence stubs / manifests:      0
transient artifacts removed:     0
historical anchor:               5dca5459 · tag closed/T2.P01.S03 (local only — not pushed)
new live → archive prose links:  0
manual-owed verification rows:   0
remaining deferred items:        0 slice-owned defects; residuals are named above
permanent stubs added:           2 (owner-ratified cost)
```

The required merge method is a **merge commit**, so the anchor stays reachable from `main`.
Post-merge work is limited to the two steps that cannot run before it: verify the anchor is an ancestor
of `main` and push the tag. The procedure is
[preservation.md](../../../../../.agents/skills/slice-closeout/references/preservation.md#anchor-mechanics).

Recovery of the full acceptance record:

EVIDENCE-PATHS: start — the following is a historical Git recovery path at the accepted closeout base.
`git show 5dca5459:docs/roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s03-first-editing-surface/acceptance.md`
EVIDENCE-PATHS: end

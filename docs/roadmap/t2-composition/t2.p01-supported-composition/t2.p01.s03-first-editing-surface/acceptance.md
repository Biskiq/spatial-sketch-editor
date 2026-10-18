# T2.P01.S03 — acceptance record: First coherent editing surface

**Slice:** T2.P01.S03 · **Status:** accepted 2026-10-18 — shipped
**Plan:** [implementation-plan.md](./implementation-plan.md) — owns this slice's acceptance criteria
**Phase:** [T2.P01](../README.md) · **Register:** [phase slice register](../README.md#slice-register)

**Owner acceptance:** 2026-10-18, recorded from the slice owner's deliberate `slice-closeout`
invocation, resumed after an earlier closeout stopped on a correctness defect. The invocation is the
owner acceptance event; it did not waive independent review, which is recorded below and covers this
implementation revision.

**Verification tier:** `architecture-integration`, declared by the plan. The declared **integration
route** is [T2.P01.S04](../t2.p01.s04-bounded-composition-loop/implementation-plan.md), the phase's
declared FINAL PHASE GATE; the integrated result is owed there and is not claimed here.

## Delivered

The first coherent Scene editing surface over the landed F4/host contracts:

- **Two contributed tasks** — `place-object` and `scene-arrange` — registered through S07's
  contribution points, with one shared `ScenePlacementSession` per accepted source and reading for
  pointer and typed entry (`src/lib/authoring/adapters/scene.adapter.ts`).
- **Typed exact entry** on X, Z and yaw: `setEntry` plans the same canonical F4 intent a pointer
  release would, shows the captured candidate in the form and in the overlay/ghost, and installs
  exactly that pose through `commit()`.
- **One proposal identity** — the surface registry, the overlay, the ghosts and the instrument are
  keyed by the accepted source and the *reading*, not by the frame's evaluation generation
  (`sceneReadingKey`), so the Stage's own redraw no longer destroys a live proposal.
- **Lifecycle** — a genuine reading change (Plan↔3D), an ended gesture lease, task close, accepted
  source replacement and adapter unmount all still cancel the proposal and release its lease once.
- **Canonical acceptance** — commits go through `F4.intent-acceptance@1:local-single-domain-v1`;
  undo/redo are the host's history, and Undo is unavailable while a proposal is live.

## Verification — recorded at the tested revision

The tested revision is implementation commit `8381dc54`, which carries the production change and the
tests recorded here; the closeout edits after it are documentation only. The full contract is the editor suite: `test:fast`,
`test:arch` and `test:heavy` were all run, and nothing was path-gated.

| Check | Command | Result |
| --- | --- | --- |
| Svelte/TS diagnostics | `npm run check` | 0 errors, 0 warnings |
| Fast lane | `npm run test:fast` | 138 files / 1939 tests passed |
| Architecture lane | `npm run test:arch` | 20 files / 163 tests passed |
| Heavy lane | `npm run test:heavy` | 8 files / 118 tests passed |
| Focused, component-level | `npx vitest run tests/lib/authoring/scene-proposal-lifetime.test.ts tests/lib/authoring/scene-editing-surface.test.ts` | 9 and 40 tests passed |

Focused coverage added by this slice's repair, each proved by mutation (it fails with its own
mechanism removed, and only then):

- `tests/lib/authoring/scene-proposal-lifetime.test.ts` — the real instrument mounted over a
  published surface: a live proposal and its exact entry survive ordinary re-evaluation; a reading
  change cancels it; a lease that ends under an unchanged reading cancels it (both through
  `ensureSession` and through the frame loop, each failing when its own call is removed); the form
  adopts a registry surface that replaces the same reading; the fields show the captured candidate
  and never resurrect a replaced entry; a refused entry keeps the form, a refusal that ended the
  lease closes it and keeps the reason; unmount releases the proposal it shows.
- `tests/lib/authoring/scene-editing-surface.test.ts` — the real session/facade: the typed candidate
  survives an ordinary evaluation, the overlay label, ghost centre/yaw and committed intent payload
  are the same pose, and each exact entry plans from the pose the previous one captured.
- `tests/lib/authoring/scene-instrument-focus.test.ts` — the three `focusout` scopes that previously
  cancelled the proposal `Begin` had just opened.

## Independent review

Three rounds, all recorded in this slice's review artifacts and PR #147:

1. Two independent reviewers on the first repair (reading-keyed surfaces, untracked effect,
   `onDestroy`): **APPROVE with required fix** and **REJECT on one required fix** — a lease ended
   under an unchanged reading was never cancelled. Fixed by `proposalLive()` consumption in
   `dropDeadProposal`, plus registry-authority adoption (`replaced`).
2. Re-review of that fix: **APPROVE**, with the refusal-state and test-attribution gaps it named.
3. Review of the final revision: **APPROVE**, no open finding. The only change after that verdict is
   the recoverable-refusal regression case the review itself asked for (test-only; production files
   unchanged since the verdict).

## Browser evidence — real dev server via `agent-browser`

Re-run 2026-10-18 at `8194b64e` (documentation-only commits after the tested implementation revision
`8381dc54`), on branch `T2-P01-S03`. The dev server ran this tree with no cloud client
(`PUBLIC_API_ORIGIN` unset), so every project is a locally booted canonical **Enclosed room** starter;
Save is out of S03 and was never exercised. Input below is real CDP key/click/typing input except
where a line says *probe*.

### Desktop Chrome, 1280×900

| Journey | Observed |
| --- | --- |
| Typed proposal survives ordinary re-evaluation, then commits | `Begin` → `X=2.5`: candidate `2.500, 1.000 m · 0.000 rad` in the feedback and in the overlay; after **4 s** of continuous frame re-evaluation the candidate, all three fields and `Commit` were unchanged; Enter installed `2.5 m · 0.5 m · 1.0 m` |
| Move then yaw then move (stale-entry check, earlier pass, unchanged revision) | `Z=5` refused `no-support` with the form still open; `Z=1` → `1.500, 1.000 m`; yaw `1.25` → `1.500, -2.500 m · 1.250 rad` with the fields reset to that pose; `X=2` → `2.000, -2.500 m · 0.000 rad` (the replaced `Z=1` was not resurrected); Commit installed `2 / -2.5, yaw 0` |
| Esc / Plan↔3D mid-proposal (earlier pass, unchanged revision) | `Cancelled; the accepted pose is unchanged.`, fields gone, document unchanged; no proposal on return to 3D |
| Stage press mid-proposal | press on the Stage with a typed proposal live → `Cancelled; the accepted pose is unchanged.`, document unchanged — the recorded blur path (see [Residuals](#residuals-and-limitations)), not a silent commit |

### Narrow viewport, 390×844

| Journey | Observed |
| --- | --- |
| Layout | no horizontal overflow (`documentElement.scrollWidth` 390 = viewport; no control's box crosses the right edge). Index expanded: stage 330 px and `.instrument-body` is a **97 px** window over 229 px of form; index collapsed: stage 515 px and every instrument control is inside the viewport — `Begin` 694–718, `PLACE`/`X`/`Z` 740–765, `Place` 773–797, `Snap` 819–843 of 844 |
| Typed exact entry | `X=2`, `Z=-1.25` → `Fit` (no live proposal) → values retained → `Place` installed `2 m · 0.5 m · -1.25 m` |
| Undo / Redo | Undo removed the entity (Undo disabled, Redo enabled) and the subject note read `The selected subject no longer exists in the restored source.`; Redo restored the source — the instrument's `ENTITY` list again offered `Block · primitive` |

### Keyboard-only, 1280×900 (no pointer used after load)

| Step | Observed |
| --- | --- |
| Boot | 11 × Tab reached `Enclosed room`; Enter booted the room |
| Arm the task | 26 × Tab reached `TASK Place object`; Enter opened the instrument (tab order then passes stage → Plan → 3D → Fit → Open source JSON → Close → ENTITY → Use selection → Begin → PLACE → X) |
| Exact entry | typed `3.25` and `-0.5` with real keys; Tab to `Place`; Enter installed `3.25 m · 0.5 m · -0.5 m` |
| Undo | 12 × Tab wrapped to the header, 2 more reached `Undo`; Enter removed the entity (Undo disabled, Redo enabled) |
| Redo | Tab → `Redo` → Enter; the source again contained `Block · primitive` (*probe*: the instrument was opened by a DOM click to read its `ENTITY` list; every mutation above used keys) |

### Reduced motion, 1280×900

| Journey | Observed |
| --- | --- |
| Preference | OS `prefers-reduced-motion: reduce` → the header control read `Reduced motion on` |
| Refusal is honest and recoverable | `X=1.75, Z=2.25` → `planner-rejected: No compiled Room floor supports this point.`, form open with its values; `Z=0.25` then installed `1.75 m · 0.5 m · 0.25 m` |
| `Begin` after an accepted install | succeeded immediately (`Editing entity-…`), **no `stale-epoch`** |
| Typed proposal under reduced motion | candidate `2.500, 0.250 m · 0.000 rad`; survived 4 s of frame re-evaluation; Enter installed `2.5 m · 0.5 m · 0.25 m` — the last displayed candidate and the committed pose agree |

The feedback pose, the overlay pose and the committed pose agreed in every case above; no
post-preview Y correction was observed (a placed box rests at `Y = 0.5` in all four servers).

**Correction to the earlier record.** Its desktop row read "exact X/Z → redraw (`Fit`) → Commit",
implying a live proposal survives the Stage toolbar. It does not, and the plan says it must not:
clicking `Fit` takes focus out of the editing subtree, which is the documented blur-cancel path.
Reproduced twice at 1280×900 — a live proposal with `X=2.7` typed, then `Fit` →
`Cancelled; the accepted pose is unchanged.`, fields gone, document unchanged. What the slice
guarantees, and what was measured above, is that *ordinary* re-evaluation (the Stage's own frames)
does not cancel; the toolbar is not a focus-preserving redraw.

**Not re-run, stated rather than implied:** a real pointer Move/Yaw drag. `agent-browser`'s wheel
dispatch lands at the viewport origin (`clientX/clientY` 0,0), so wheel scrolling inside
`.instrument-body`/`.index-body` could not be exercised either; their scrollability was established
from geometry (229 vs 97 px, 884 vs 208 px) and from keyboard focus moving controls into view, and
horizontal overflow was measured as zero at 390 px.

## Criteria (from the plan)

| Criterion | Evidence |
| --- | --- |
| Place, move, rotate, switch readings, enter an exact value, undo/redo from a valid floor project | browser journeys above; lane suites |
| Include a Plan-ineligible selected entity, missing model bytes, unsupported host, mid-gesture reading switch | fast lane: `scene-editing-surface`, `scene-adapter`, `stage-facade`, `scene-operation-*` refusals; mid-gesture switch covered by the reading-change cancel |
| Review desktop, narrow, keyboard-only and reduced-motion journeys | all four recorded above; pointer drag not re-run (see the limitation there) |
| The last valid displayed candidate equals its committed pose within 1e-6 m/rad; no post-preview Y fix | browser: `4.250, 0.500 · 1.250` → `4.25/0.5, yaw 1.25`; `2.000, -2.500 · 0.000` → `2/-2.5, yaw 0`; adapter test asserts the accepted payload from the same candidate |

## Acceptance review follow-up — 2026-10-18

Closeout was reopened on three review findings and each is dispositioned here:

1. **The three missing journeys were not waived; they are now recorded.** Narrow, keyboard-only and
   reduced-motion journeys were run on the real surface (above). Nothing is carried to S04 that the
   plan asks this slice to review. The earlier record's `Fit` row was wrong and is corrected above.
2. **Preservation now happens before the merge**, as the closeout skill requires: this record and the
   plan are compacted to stubs at their own paths in the same PR, with the anchor computed from the
   commit that still holds their full bodies (below).
3. **The host-seam authorization is reconciled.** The route's `syncContributedTask()` (the
   contributed-task mirror that restores a persistent instrument after an accepted install closed it)
   is recorded in the [host-seam addendum](../../../../reference/decisions/t2-s03-host-seams-2026-10-17.md),
   in batch B's shared-file row and in the plan's launch condition 3. No production file changed for
   it; the code that already shipped is the code that was approved.

## Residuals and limitations

- **Typed entry is one exact group per proposal.** A move entry carries X/Z and keeps the accepted
  yaw; a yaw entry carries the angle and keeps the accepted X/Z. The form now always shows the
  captured pose, so nothing is silently dropped, but a creator cannot commit a move and a rotation in
  one operation. Combined intents are an F4 decision, not an adapter one.
- **Pointer press on the Stage while the typed form is open.** The press calls `session.begin()`,
  which releases the typed lease and grants one to the drag; the form cannot see that through
  `proposalLive()`. A normal press blurs the field first and cancels through `focusout` (re-observed
  2026-10-18: a live `X=2.7` proposal ended as `Cancelled; the accepted pose is unchanged.` with the
  document unchanged), and Commit can only install the drawn candidate or refuse, so no wrong pose is
  written. The same blur rule means the Stage toolbar (`Fit`) is not a focus-preserving redraw. A
  session-level "which lease owns the displayed candidate" would close this; it is not claimed here.
- **Selection is not requalified after Undo→Redo of a Place.** Undo removes the placed entity and
  its selection; Redo restores the source but not the selection, so the Card stays closed and the
  creator re-selects. The source is correct — measured through the instrument's `ENTITY` list, which
  offers `Block · primitive` again after Redo. Selection requalification belongs to the host wiring
  (`T1.P01.S07`), not to this adapter.
- **A Place's completion message is not shown.** The accepted install re-creates the contributed
  instrument (fields reset, `feedback` empty), so `Placed one box.` is written to an instance that is
  no longer displayed. The Card and the history controls show the result; the message is a
  presentation gap, not a lost change.
- **Intermittent `stale-epoch` on Begin after an accepted install** was observed once during the
  earlier acceptance run when the task panel's services had not been rebuilt. It was **re-checked on
  2026-10-18 and did not reproduce**: `Begin` succeeded immediately after three accepted installs
  (two placements and one typed move). It stays tracked as
  [TD-8](../../../../operations/tech-debt/README.md#td-8--a-tasks-scoped-services-go-stale-after-an-accepted-install-refusing-begin)
  rather than being declared fixed.
- Save, Preview, resize, duplicate and delete are outside S03; they stay with T2.P01.S04.

No active checkpoint existed for this slice. The dev server and the browser session this review used
are stopped; no listener remains.

## Preservation

**Deferred.** Closeout steps 8–11 (compaction, the historical anchor, the preservation report and the
link sweep) are performed after the merge commit, because the anchor they record is that commit.
Merge is the owner's decision and has not been taken; this record therefore claims no anchor and no
merge. Required merge method: a merge commit, so the slot anchor stays reachable.

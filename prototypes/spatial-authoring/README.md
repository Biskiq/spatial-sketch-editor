# Unified World and Experience V2 Prototype

**Current unified executable reference**, adopted in place under #112 and extended by
#113 (2026-10-03). It preserves World journeys A–F and implements Experience V2 authoring,
isolated visitor execution and both directions of continuity. The accepted World shell keeps: local Index, dominant Stage, selected identity Card, invoked Look/Details,
Instrument and Precision. [PLATE §0.8](../../docs/reference/design-system/editor-shell-and-visual-system.md#08-accepted-destination-shell--unified-world--experience-direction-2026-10-01-pr-111)
owns destination shell design; this static prototype establishes no production interface or cutover.

**C1–C8 conformance complete; C9.1–C9.9 implemented/reviewed, awaiting MP3/MP4 owner acceptance.** The [C9 plan](../../docs/roadmap/p25-experience/design/experience-v2-prototype/authoring-completeness-plan.md) owns authoring-completeness scope; [C9 evidence](./qa/EXPERIENCE-C9-EVIDENCE.md) owns current executable provenance and verification. [Conformance evidence](./qa/EXPERIENCE-CONFORMANCE-ACCEPTANCE.md) retains C1–C8 proof. MP1 and MP2 are owner-accepted; automated proof and Presenter completion accept no human gate. Travel and fresh repeated-Stop visits are owner-ratified. Detailed visual refinement remains the later UI/UX slice, and no production interface or cutover is established here.

```sh
cd prototypes/spatial-authoring
python3 -m http.server 8826
# http://localhost:8826/                 explore; J opens the Presenter for the active lens
# http://localhost:8826/rationale.html   current rationale and specimens
# ?journey=A&step=0&motion=instant       reproducible presenter entry
bash qa/run-all.sh                     # all registered browser axes; private server/browser per axis
bash scripts/shoot.sh                  # regenerate specimens into qa/out/specimens
```

No build step. Three.js is vendored; Google Fonts have system fallbacks. The Presenter and
`window.__me` are prototype facilities outside the product interaction model.

- [rationale.html](./rationale.html) — current shell, inherited A–F, intermediate readings and return.
- [IMPLEMENTER-REFERENCE.md](./IMPLEMENTER-REFERENCE.md) — formulas, validators, cancellation,
  navigation/task seams and the limits of these mechanisms.
- [qa/ACCEPTANCE.md](./qa/ACCEPTANCE.md) — acceptance, coverage/harvest and preservation evidence.
- [qa/EXPERIENCE-CONFORMANCE-ACCEPTANCE.md](./qa/EXPERIENCE-CONFORMANCE-ACCEPTANCE.md) — replacement C1–C8 behavior, board comparisons, gates and Paper handoff.
- [qa/EXPERIENCE-ACCEPTANCE.md](./qa/EXPERIENCE-ACCEPTANCE.md) — historical S0–S9 evidence.
- [qa/README.md](./qa/README.md) — current executable checks and their actual proof limits.

Try the Garden window's Look → Unroll, or pull the Rotunda dog-ear and stop anywhere. O unrolls,
S squares up, K defines a Section (arrows slide/turn, −/= depth, Tab side, Enter opens).
Lift a ceiling, preview its gap correction, then U looks up. Measure reaches numbers in place;
P opens Precision. / searches; row verbs distinguish selection from navigation/recovery.
Esc leaves the foremost writer/Precision/task, Back returns one reading, Shift-Esc puts the chain
back. View navigation stays separate from source Undo.

Lens crossing cancels proposals and parks procedures inactive in their owning lens. Returning is
ordinary. Explicit Resume revalidates current identity and targets, reactivates accepted parameters
and keeps the current realized Camera. World-only footer controls refuse in Experience; their
retirement and Paper authoring belong to the next PR.

In Experience, explicitly open Saltmarsh Highlights or create a Presentation from a selected World
subject, a region or the environment. Auto/Hints derive framing; explicit Capture adds a Camera View
and its use atomically to the unordered Set. Hints and
Precise Camera are local depth, independent of Guide work. Add to Guide creates occurrences;
Overview expands a Stop, Seam connects supported Camera Views, and Coordinate binds holds or
invocations to stable Camera stations. Card headers distinguish shared framing from occurrence reach.
Head Preview works with no Guide or Views and returns to the exact authoring context.

With screenshot mode off, the shared Presenter switches by lens: World retains A–F; Experience guides Q1–Q8 authoring followed by advanced topics. Its optional walkthrough is on by default: Next demonstrates the current task through ordinary product commands, then advances. Off, Next only browses; outcomes are advisory and never block it. Back/Skip/close/reopen author nothing. Preview can retain read-only guidance while the authoring walkthrough option and all other writers stay unavailable. This guidance is separate from the authored Guide/Stops. The separate Experience examples disclosure offers explicit Reset, Load Example and Load Conformance commands; loading never plays or positions the Camera. The donor at
[`../experience-authoring/`](../experience-authoring/README.md) stays runnable with its 4.1 tests.
The integrated design folder retains the finalized synthesis/boards, rather than another executable.
The [replacement #113 conformance plan](../../docs/roadmap/p25-experience/design/experience-v2-prototype/conformance-plan.md)
owns this replacement's implementation scope; [historical Experience acceptance](./qa/EXPERIENCE-ACCEPTANCE.md) maps S0–S9 evidence.
Paper PA0 must reconcile against this unified tree. F and production T1/T2/T3/T4 remain gated.

The predecessor shell, reconciliation and comparisons are preserved in Git; their interaction
rules are harvested into the current reference/tests. The stable phase-local path is a
[forward pointer](../../docs/roadmap/p26-spatial-depth/Final-Design-Prototype/README.md), with no second executable.

# PR #113 Experience V2 — checkpoint

TYPE: implementation / verification (C9 continuation)
STATUS: C9.1–C9.3 implemented and accepted through **MP2 (accepted by the owner 2026-10-05)**;
C9.4 (Camera default Travel and live invocation) and C9.5 (visitor participation and agency)
implemented, self-reviewed and verified at the executable revision recorded below; stopped at
the MP3 human gate.
GOAL: complete the C9 authoring-completeness slice through C9.5 and stop for the MP3 human
review; no merge or phase closure.

CONSTRAINTS:
- Prototype-local implementation; no Paper adoption, production formats or phase closure.
- The owner authorized implementation through MP2; MP1 was explicitly accepted by the
  owner on 2026-10-04 and MP2 on 2026-10-05. C9.4/C9.5 were authorized to proceed
  autonomously after MP2 acceptance and stop at MP3.
- Commit provenance, correct against live Git: the C9.1 slice is committed by the owner's
  review pass as `abaa7592`; C9.2/C9.3 as `12652d9b`, the first external-review repair as
  `db83a9d7`, and the second review repair as `9a44678a`; the C9.4/C9.5 increment is
  `c118c08b`. All are pushed to `origin/prototype-v2` (the evidence/status update is the
  docs-only child of the commit it records). No merge or closure was performed.
- AGENTS.md rule 11 requires expanded scope before changing the unrelated missing fixture.
- Donor stays unchanged; every QA axis closes its own browser and server.

READ:
- `docs/README.md` router; `apps/editor/tests/README.md` verification doctrine.
- `docs/roadmap/p25-experience/design/experience-v2-prototype/authoring-completeness-plan.md` (C9).
- `prototypes/spatial-authoring/qa/EXPERIENCE-C9-EVIDENCE.md` (C9.1–C9.3 record).
- Browser-hygiene, agent-browser and slice-closeout skills.

## Established — S0–S9 (prior evidence, retained)

- Branch `prototype-v2`; actual PR https://github.com/Biskiq/spatial-sketch-editor/pull/113.
- S0–S9 implementation and review repairs are complete; [S0–S9 acceptance][s0s9] and
  [C1–C8 conformance acceptance][c8] remain prior evidence, not C9 acceptance authority.
- The missing P23B fixture is a pre-existing repository-gate blocker, also absent at #113's
  base; exact original identity and recovery guidance are recorded in the C1–C8 acceptance.
  Restoration needs separately authorized work and was not performed.

## Established — C9 (this increment)

- C9.1 committed (`abaa7592`); **MP1 accepted explicitly by the owner 2026-10-04**.
  Standalone J1 loop inspected with the Presenter closed; no comprehension result invented.
- **MP2 accepted by the owner 2026-10-05**: the reviewed J1 repeat, A/B Guide creation,
  Preview/Next, Peek-level Stop editing and deliberate Overview enter/leave worked with
  predictable View/Stop/Presentation scope and no workflow failure. Three observations were
  recorded as non-blocking and assigned outward: shell/control density → the later UI/UX
  refinement slice; Guide snap/cut → superseded by C9.4; incomplete View/Presentation
  removal → C9.6 revision/repair.
- C9.2/C9.3 implemented and verified, committed as `12652d9b` (the full record, changed
  paths, repairs and limitations are in [the C9 evidence record][c9]).
- External MP2 review (2026-10-05) named five blockers; all five are repaired at their
  owning authority with pure and browser regression coverage: the route writer ends on Stop
  selection (stale Stage clicks refuse), the primary explanation keeps its binding through
  regrouping, Experience-scoped narration keeps captions and View cues without satisfying a
  later Stop's Gate, Auto derives from remaining Experience work and never interrupts a live
  Camera move, and impossible dependency/cue/Stop-condition scopes are repairable,
  unavailable work. A second review pass then folded C9.1 as accepted and blocked the
  combined C9.2/C9.3 verdict on station activation, cue-scope consistency and remaining-work
  edge cases; all three are repaired at their owning authority (the station is now the
  Activity's single trigger and only automatic work is invokable, cue scope and Gate/pacing
  scope are separate predicates that agree with `emit`, and remaining work is modelled once as
  runtime completion instead of elapsed subtraction at every node), with regression and
  same-defect mutation coverage. Details and coverage in the evidence record.
- Prototype verification at the repaired revision `9a44678a`: pure Node suite **75/75**
  (10 then 14 external-review cases); `qa/run-all.sh all` **18 axes / 762 assertions / 0
  failures, rc=0** — every axis rerun at that one revision (`/tmp/c9-all-final.log`);
  `qa/mutation-check.sh` 23/23 same-defect rejections for the first pass and 28/28 for the
  second, rc=0 (World 3, V2 7, C9 18: the original six, the seven external-review
  obligations — route writer, explanation binding, Experience output, completed work, live
  move, Auto clock, dependency scope — and five second-pass obligations: invocation
  repeating on every tick, a visitor offer becoming traversal work, a stopped remainder
  waited for, a carried dependency paying its elapsed time twice, and the cue predicate
  collapsed back onto the strict scope predicate. The 13th, entry-plus-station double
  activation, was re-targeted from the tick-repeat defect to the activation contract itself).
- C9.4/C9.5 (Camera default Travel and live invocation; visitor participation and agency)
  implemented, self-reviewed and verified: pure Node suite **93/93**; `qa/run-all.sh all`
  **18 axes / 780 assertions / 0 failures, rc=0** at the reviewed revision (`/tmp/c945b-all.log`);
  `qa/mutation-check.sh` **39/39** same-defect rejections (26 model/runtime + 3 World/lens + 7 V2
  conformance + 3 wiring), with the composition-only rerun green on its 29 C9 obligations. Seven
  self-review findings were repaired, two of them in surrounding C9.1–C9.3 behavior (an origin
  already at the destination View was painted and refused as a Travel gap, and the
  departure-readiness rule had two copies so removing one would have left the other refusing early
  Next), and the N1-superseded axis steps were rewritten rather than worked around.
- An **independent review** of the pushed C9.4/C9.5 executable then named four acceptance blockers;
  this repair pass fixed all four at their owning authority, each with behavior coverage and a
  same-defect mutation: Rejoin and detour Return now resume the playhead (remaining work rather than a
  rebuilt estimate, a cue whose signal already fired skipped, future cues kept, and the parent's own
  remainder and cue floor restored on Return); **Preview Experience** exists as the world-only entry
  that needs no Presentation, Stop or Guide; offer **availability is authorable** with Experience-wide
  as the default, written in the same aggregate edit and switchable from the Card without changing the
  offer's home; and a same-View Seam is zero-distance only while the visitor is standing there,
  otherwise the ordinary Camera framing invocation from the live pose. The review also caught this
  record naming the missing P23B fixture path outside its `EVIDENCE-PATHS` region, which the repository
  documentation gate reads as a claim about a missing file; that text is repaired and the gate is green
  at this revision. Details in the evidence record.
- Product defects found and fixed during verification: Guide band reachability (band
  measured 285.84px vs Card reserve 216px), visitor transcript crash on View uses without
  `.start`, and the parked-detour parent-visit regression. Details in the evidence record.
- Root repository gates at `9a44678a`: `test:arch` **276/276** rc=0; `npm test` 33 files
  failed / 339 passed / 1 skipped, 4951 passed / 1 failed / 1 skipped rc=1; `check` 1
  missing-module error / 0 warnings; `build` unresolved import; `git diff --check` rc=0.
  Logs `/tmp/c9-{arch,root-test,check,build}-final.log`. Every red gate is the same
  missing P23B fixture, reported separately, not hidden.
- Donor `prototypes/experience-authoring` (separately reported): typecheck, 62/62 domain
  tests, production build and Playwright regressions; tree unchanged.

CURRENT:
- MP2 accepted by the owner 2026-10-05 with three non-blocking observations recorded;
  C9.4/C9.5 implemented, self-reviewed and verified, committed as `c118c08b` and pushed, with
  the evidence/status docs as its docs-only child. C9.6–C9.9 and Paper are not started.
- The prototype is left usable for the MP3 walkthrough; QA axis servers close themselves and
  no session is left running.

NEXT:
1. Owner performs **MP3 — Travel and agency** at the pushed head, with the Presenter closed.
   Recipe; each step names what must be observable, not merely what to click:
   - *explicit Travel preparation*: in an ordinary session build a Guide whose departure
     Presentation holds more than one Framed use, open the Seam and choose Travel. One step
     must leave every legitimate origin supported (`Prepared n Camera route … · Camera owns
     route geometry`), no origin as a gap, and the whole preparation as one Undo step. Adding
     or selecting a View, and starting a Preview, must never add Camera connectivity by
     themselves.
   - *visible Camera flight*: Preview on a Travel Seam and press Next. The Camera must fly the
     authored route instead of snapping; Cut on the same Seam must snap and execute no route
     beats.
   - *early/manual navigation during movement*: press Next again while the first flight is in
     flight. The new move must start from where the Camera actually is, on the supported
     directed route, with no "finish the current move" demand, and arrive at the authored
     destination.
   - *redirect and rejoin*: redirect to another eligible View mid-visit, then Rejoin. Rejoin
     must restore the Stop's viewing intent from the live pose without replaying route stations
     or queued cues.
   - *exploration*: Explore and orbit freely — no offer may fire from exploration.
   - *direct visitor interaction*: click a used subject, then (separately) drag over it. A click
     activates what the subject offers; a drag only orbits.
   - *multiple-offer behavior*: on a subject offering more than one interaction, a click must
     open an explicit choice naming each offer's activation and target subject, with Cancel;
     nothing may run before the visitor chooses, and any deliberate navigation must settle an
     open choice.
   - *deliberate View choice*: the eligible View controls must re-frame without restarting
     narration incorrectly — compare caption/transcript state before and after.
   - *standalone/Guide Presentation open and close*: open another available Presentation — a
     Guide Stop is parked with exactly one Return that restores it with no duplicate entry;
     Close on a standalone Presentation returns to exploration, never to authoring.
   - *one side detour and return*: take one authored detour, then Return; a second detour
     before returning must be refused with a visible reason rather than replacing the first.
   - *predicted versus observed cursor/pause*: predict a Stop's readiness/Auto count (Camera
     movement counted once, invoked station work counted at its own station) and compare it
     with the visitor panel; pause and resume Auto and confirm the clock continues rather than
     restarting.
   - *rejoin and Return keep the remainder* (review repair): in a Stop whose work is a long narration,
     let part of it play, Explore, and Rejoin — the panel must owe only the part not yet played, a cue
     whose moment already passed must not be claimed again, and a cue still ahead must still arrive.
     Take one detour mid-Stop and Return: the parent's own remaining work and cue floor must come back,
     not the detour's.
   - *availability authoring* (review repair): add an offer from a Presentation and confirm the draft
     offers availability with Experience-wide selected; accept it and confirm the Card reads
     `Experience-wide` while the offer stays homed in that Presentation; switch it to another
     Presentation and confirm one Undo step and one changed scope.
   - *Preview the Experience without a Presentation* (review repair): with an Experience-wide offer and
     no Presentation selected, `Preview Experience` must start a world-only visit (no Presentation, Stop
     or Guide), offer that participation, and return to authoring untouched. Without any Experience-wide
     offer the entry must be absent rather than start an empty visit.
   - *same-View Travel after moving* (review repair): on a Seam whose origin and destination are the
     same View, press Next while standing at that View (instant, zero distance), then Explore away and
     press Next again: the Camera must fly back from where it actually is rather than snap, and no route
     may be invented.
2. Record the MP3 outcome. Only then start C9.6 revision/repair; it is explicitly not started.
3. Keep root gates current; carry the missing-fixture blocker explicitly and do not fabricate
   or restore it without separate authorization.

OPEN:
- MP3 outcome (human evidence; automated assertions cannot substitute).
- Push completed for C9.4/C9.5 (`c118c08b` plus its docs-only evidence child); the branch is at
  the pushed head and PR #113 stays open and unmerged.
- All 18 axes are verified at the C9.4/C9.5 executable revision; no axis is carried from an
  earlier pass.

[s0s9]: ../../../prototypes/spatial-authoring/qa/EXPERIENCE-ACCEPTANCE.md
[c8]: ../../../prototypes/spatial-authoring/qa/EXPERIENCE-CONFORMANCE-ACCEPTANCE.md
[c9]: ../../../prototypes/spatial-authoring/qa/EXPERIENCE-C9-EVIDENCE.md

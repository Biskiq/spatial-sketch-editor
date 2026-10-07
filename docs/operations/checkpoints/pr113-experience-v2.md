# PR #113 Experience V2 — checkpoint

TYPE: prototype implementation / owner-review handoff
STATUS: C9.1–C9.9 implemented and reviewed; bounded shared-Presenter follow-up in final verification.
GOAL: finish the bounded follow-up and hand PR #113 to the owner for MP3/MP4 acceptance; no merge or closure.

CONSTRAINTS:
- Prototype-local only. Preserve one Camera evaluator/navigation authority, Experience policy ownership,
  private visitor execution, deterministic selection/history and exact Preview return.
- One Presenter panel/controller switches lens content. World A–F remains unchanged; Experience
  guides actual authoring. This is editor guidance, distinct from authored Guide/Stops.
- The owner authorized implementation, self-review/repair, verification, commit and push for this follow-up.
- MP1 accepted 2026-10-04 and MP2 accepted 2026-10-05. MP3 and MP4 require explicit owner acceptance;
  automation, rehearsals and Presenter completion cannot accept them.
- No production migration, missing-fixture restoration, Paper work, broader shell overhaul or six-QA reconciliation.

READ:
- `docs/README.md`; `apps/editor/tests/README.md` verification contract.
- `docs/roadmap/p25-experience/design/experience-v2-prototype/authoring-completeness-plan.md`.
- `prototypes/spatial-authoring/qa/EXPERIENCE-C9-EVIDENCE.md` — exact executable provenance and review/proof.

ESTABLISHED:
- C1–C8 conformance and S0–S9 prior evidence remain retained in their acceptance records.
- C9.1–C9.5 are implemented, with reviewed Travel, lifecycle, interaction, detour, held-viewing,
  remaining-work and Preview-isolation repairs. Their historical run counts keep their own revisions.
- C9.6–C9.9 are implemented and reviewed: revision/removal/repair, rich example/local coordination,
  deliberate Camera precision and observational quickstart/advanced outcomes. The prior review commits
  are `4e8cc8e7` and `dad60dff`; they are not unstarted work.
- A2 now retains the capability handoff's source use, target use and target run; the visitor's Stop
  must match that same live carried run. Unrelated carried work and another run of the same use fail.
- C9 ordinary walkthrough uses real product commands, earned Next, Back and explicit Skip. Lens switching,
  navigation and close/reopen preserve source/history/selection/Camera. Preview guidance has no writers.
- MP3/MP4 remain pending human review. Trials (cursor/detour parent pause) are not permanent architecture.

EVIDENCE:
- `prototypes/spatial-authoring/qa/EXPERIENCE-C9-EVIDENCE.md` owns final counts, mutations and repository-gate limits.
- `prototypes/spatial-authoring/qa/walkthrough-check.sh` drives Q1–Q8 and both lens directions through visible controls.
- `prototypes/spatial-authoring/tests/experience-c9-review.test.mjs` and
  `prototypes/spatial-authoring/qa/composition-mutation-check.sh` protect A2 use/run identity.

DO NOT REPEAT:
- C9.6–C9.9 implementation or the repaired review rounds. Use current evidence, not old router status.
- Do not regenerate six visual QA specimens or treat a green Presenter as human acceptance.

CURRENT:
- Implementation is complete; final verification and committed executable provenance are being recorded.
- The missing P23B fixture remains a separate repository-gate blocker outside this authorized mutation scope.

NEXT:
1. Owner performs **MP3 — Travel and agency** at the pushed head with the Presenter closed.
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
2. Owner performs **MP4 — rich capability acceptance**: loaded route/station/invoke/Hold, visitor
   interaction/detour/return, revision/repair, additional Views/entry policies, shared/local scope and
   precise Camera. Review the Experience walkthrough and recheck shared structural seams.
3. Record explicit owner outcomes before C9 acceptance, merge/closure or onward Paper work.

OPEN:
- MP3 and MP4 owner acceptance; detailed visual refinement remains the separately scoped UI/UX slice.
- The pre-existing missing P23B fixture still blocks full repository test/check/build; no fabricated fix.

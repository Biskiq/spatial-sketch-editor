# Current

PHASE: F — foundation contracts; status/order → ../roadmap/README.md;
       registration → ../roadmap/f-foundation-contracts/README.md.
CHILD: F.1–F.5 target contract WRITTEN and OWNER-RATIFIED; NO IMPLEMENTATION AUTHORIZED.
       Normative text → ../reference/composition-execution.md. Draft each exact interface
       with its first consumer and ratify it as an amendment; tracks do not mint their own.
NEXT: #114 (Experience UX implementation per
       ../roadmap/p25-experience/design/experience-v2-prototype/ux-pruning-and-shell-reconciliation-plan.md)
       is OPEN (owner-authorized 2026-10-11). UX0 (harness and baseline), UX1 (shared chrome and
       locator: one Head Preview menu, the Index restructured, locator coverage by pointer and
       keyboard), UX2 (Presentation and Views: aggregate Present, the Presentation and View Cards,
       the Views list, the one Advanced authoring home, and the bounded neutral image pass behind the
       View preview) and UX3 (Scene subject: the subject's Card in the QA 5 order — identity, Present
       this, the derived Used in Experience reach, and the subject's own behavior and visitor-interaction
       doors — with no capability control at rest) have landed. UX3's review corrections also landed: the
       derived reach now counts a Presentation that merely *focuses* the subject (a Present → Add to Guide
       Stop is a reference even with no behavior authored), the descriptor chooser is worded as choosing
       and configuring a capability rather than adding an authored behavior, and the `Used in Experience`
       rows are compact one-line references. The owner also ratified a lightweight verification policy
       (plan §9, 2026-10-12): a slice runs only the focused axes/tests covering the control it moved plus
       a small real-browser smoke path, and broad regression/mutation sweeps are owner-directed rather
       than per-slice gates. UX4 (Guide, Stops, edges) has landed: one Guide home in a bounded Deck — a
       named Stop chip followed by its own resolved-continuation edge chip (order / explicit / End /
       needs-repair, a connector only for a truly adjacent destination), Edit Guide ordering, a
       restructured Stop Card and an edge Card that owns Cut/Travel, coverage and the Camera Path door —
       the Peek pips, Overview L2 strip, Expand disclosure and Seam triptych are retired. UX5 (Camera Path
       posture) has also landed: one Camera home for the edge's Camera half — a routing head naming the
       Guide edge, a From list with connected/gap status, authored path points as selectable chips, an
       armed-only `+ Path point` insertion (a plain Stage press adds nothing), a selected-point Card with
       an evaluated Camera preview, Look through, Remove and Used by, and a straightened Deck lane naming
       the edge. The UX5 review's Deck reconciliation has landed too: every posture's band is a shallow
       name block plus its own lane — the Guide's ordered Stop chips (number, Stop name, Presentation)
       separated by one-word continuation pills, the Path's straightened topology, and the Journey's time
       axis — with the Path | Journey switch and the Journey's numbers in the Index header. UX6 (Journey
       timeline, Cues, Hold/Invoke authoring, grouped station movement, Rehearse) is in progress at a
       recorded checkpoint (see the evidence record's WIP list: the covering QA axes are unrun at this
       commit, and the strip's Hold inputs are still the C9 writer). The plan's 2026-10-12 conformance
       revision (§5.1–§5.8, the §7 checklist) specifies what UX4–UX6 still owe (one-row Guide lane,
       timing-free Path posture, Journey Cards without the C9 strip) and light UX1–UX3 fixes. The same
       day's review reconciled it with the code (§3.1, §3.2, §5.4, §5.5): edge, point and Cue stay session
       readings under the selected Stop, a new path point goes into the nearest segment, keyboard focus
       survives re-renders, and Camera Path entry keeps its return capture. No owner call is open (§12).
       The next implementation pass follows §5.1's order. UX7 is where implementation
       stops for the owner's design discussion. Paper and production work stay unauthorized.
       Evidence → ../../prototypes/spatial-authoring/qa/EXPERIENCE-UX-EVIDENCE.md (UX0–UX3) with
       ../../prototypes/spatial-authoring/qa/EXPERIENCE-C9-EVIDENCE.md (with
       closeout preservation report) for the accepted C9 baseline it starts from.
       Inventory → ../../prototypes/spatial-authoring/qa/experience-ux-selector-inventory.md.
       Contract → ../reference/design-system/editor-shell-and-visual-system.md
       §0.8.1. Status → ../roadmap/p25-experience/README.md.
PROTOTYPE BATON (owner-decided 2026-10-03; #114 inserted 2026-10-11): #112 close/merge →
        #113 Experience V2 + real World ↔ Experience continuity + six-QA UX design lock (closed) →
        #114 Experience UX implementation (opened 2026-10-11; UX0–UX5 landed + the UX5 Deck reconciliation, UX6 in progress at a checkpoint) → #115 Paper PA0–PA12 → prototype detour closes →
        F exact-interface amendments → T1/T2/T3/T4.
        #114 — implements locked PLATE §0.8.1 in the prototype (UX0–UX7), keeping C9
        capability and MP3/MP4 recipes green; owner visual acceptance is its gate.
        PAPER (#115) — after #114, not started: World Paper adoption, PA0–PA12 →
        ../roadmap/p26-spatial-depth/design/paper-authoring-prototype/implementation-plan.md;
        contract → PLATE §0.8.4 (accepted 2026-10-03). PA0 reconciles against #114's tree.
BLOCKERS: P23B fixture missing — separate repository-gate blocker (root test/check/build);
        restoration needs separate scope authorization. Not a #113 condition.
CARRY: TD-4 release costs · TD-5 `$state` proxy cost · D5 follow-up probes · M1
       session-conditioning limitation → ./tech-debt/README.md.

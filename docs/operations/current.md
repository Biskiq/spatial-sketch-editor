# Current

PHASE: P23B — geometry performance & stabilization (P-level status → ../roadmap/README.md)
CHILD: P23B.11-wall-chain — SHIPPED and closed 2026-09-27 (owner REVIEWED AND ACCEPTED with no
       remaining blocker; one PR for the slice: #95; routine `slice-closeout` inside the same PR;
       accepted head `dcd3682f`; merge method squash (owner merges); post-merge recovery via
       `refs/pull/95/head` — the tag is local only). Delivered M-1 (exact pair short-circuits in
       `buildCorrespondenceComponents`: group check first, inflated-bbox prune,
       containment-before-overlap) and M-3 (the room-neutral identity condition; ambiguous faces
       refused), with M-2 recorded as the X-4 blocked case; M-4 threads the wall-chain plan's
       accepted compile into the commit install. The wall-chain release the S1 profile attributed
       has moved (all-curved Wall-authoring 944.5 → 88.6 ms p50, correspondence 828.7 → 0.2).
       Overall interaction improvement is still NOT established: the browser/node gap and P23B.6's
       unresolved final-capture increases were owner-routed to the pre-P23B.8 follow-up's M1
       measurement, which has now run (see the next line). No numeric target proposed.
CHILD (closed, between P23B.11 and P23B.8): pre-P23B.8 follow-up — EXECUTED and CLOSED 2026-09-27
       (measurement + ranking only; the owner's explicit go was given and the plan's scope is what ran).
       M1: ONE protocol, ONE session, TWO runtimes (headless Chrome 152.0.7977.54 and Electron 35.0.2
       / Chromium 134) under the same fixtures, classes, 25-accepted-action rule, three-frame settle,
       1500×1000 DPR 1 viewport and 19.292586186549904 px/m ladder; both captures settled with ZERO
       dropped boundaries and both taken at executed head `b6f2203b` on a clean tree. It reports BOTH
       D1 rows as a comparison only (all-curved Wall-authoring 141.9 ms p50 Chrome / 165.2 Electron;
       all-curved Whole-Room 300.0 / 353.8 — P23B.6 S1b's 3,601.2 / 493.4 are NOT reproduced: a
       finding, not a fix, and the increases stay UNRESOLVED), the drag-attached gesture-frame series,
       release → next presented frame at full coverage (214–292 ms p50 on all-curved Chrome, 229–350
       Electron, against 31–66 ms on the straight control — where the previously reported
       `browser-frame` PROXY read 5–40 ms on the same releases), long-frame incidence, D7's post-fix
       `commit-capture` (0.8–3.1 ms p50 from the classes that carry the mark; ABSENT, with a reason,
       in the two authoring classes on both runtimes) and D13's coverage limit noted beside the
       session. R1: ONE ordered ranking from the closed S7 keyed capture, self-time only where priceable,
       with NO mechanism chosen: mesh-prebuild is the larger exclusive cost in five of the six committed
       classes (level in the sixth), room-geometry-compile is at or below it everywhere, and the
       canonical-gates row is REPORTED, not ranked (its exclusive self is withheld in every class).
       CORRECTED 2026-09-27 by owner review — see the follow-up's corrections record; the first version
       ordered rows 2/3 by the smaller self while placing row 1 by the largest total.
       Two DEV-only instruments landed and NO product module was touched (test-enforced); no
       threshold, target, budget metric, baseline or ratchet read or written; the connected case
       stayed advisory (excluded from D1/D7 by construction, with a test). Records, the two LIVE
       captures and the acceptance record → ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/
       (plan STATUS amended in place, executed head `b6f2203b`, evidence anchor `58a139f2`, tag
       `closed/pre-p23b.8-follow-up` local only).
       FOLLOW-ON, same day: the owner authorized the three optimization directions as expanded scope for
       this PR and they were RUN — D5's candidate implementation was measured OUT and reverted (see
       QUEUED BY NAME above and the live-attribution record), so THAT pass's tree changes were DEV-only
       instruments plus their tests, and the product changes which followed from its findings (the
       transient Room unit and the Room-label placer's eligibility grid) LANDED 2026-09-28 in the three
       commits recorded under the D6 block below. NEXT: P23B.8's entry gate.
RATIFIED DIRECTION (2026-09-27): the Biskiq northstar decision record is ratified and
       routed at ../reference/decisions/northstar-ratification-2026-09-27.md; the authority
       rules and the live contracts were reconciled in the same change set (AGENTS.md rule 10,
       docs/README.md, north-star, architecture, component contracts, roadmap). This
       reconciliation authorizes NO implementation and closes no phase. F — foundation
       contracts — is owner-ratified (2026-09-27, with amendments: Camera splits in the
       same cutover as the Experience order migration; exact interfaces land via F
       amendments in shared code; extensions declare required/optional): the target
       contract F.1–F.5 lives at ../reference/composition-execution.md and authorizes no
       implementation. Capability re-planning re-derives against it; P24/P25/P26 existing
       plans remain pre-redesign evidence re-derived as T2/T3/T1. The ratified decision record is
       normative for all new design and outranks conflicting pre-ratification text (AGENTS.md
       rule 10); landed contracts keep describing current behavior until their explicit cutover.
STAGE: P23 closed 2026-09-22 (PR #73). P23B executes the owner-ratified SEQUENCE between P23 and P26
       (order + four amendments → phase README §SEQUENCE). Shipped and closed, each with closed
       stubs, recovery anchor and tag routed from the phase README: P23B.3a · P23B.0-durable ·
       P23B.4 · P23B.5 · the measurement-only step · P23B.7 · P23B.6 · P23B.11 · the pre-P23B.8
       follow-up (M1 + R1). P23B.1 and P23B.2 retain their own review statuses. NEXT: P23B.8's entry
       gate — the pre-P23B.8 follow-up that came before it RAN and closed without entering anything
       into it (see CHILD above), and the queued items' before-P23B.8 condition still applies.
       P26 planning is re-derived as T1 against F
       (see RATIFIED DIRECTION); P26 implementation is unauthorized and its validation window is
       selected but not open.
       Architecture cycle: PHASE_1 installed, no owner action required.

NEXT:
1. P23B.8'S ENTRY GATE — the next step on the SEQUENCE. The step that preceded it, THE PRE-P23B.8
   FOLLOW-UP (owner-routed 2026-09-27, executed between P23B.11 and P23B.8), is EXECUTED and CLOSED:
   its RATIFIED SCOPE was ONE measurement session (M1 — gesture frames plus
   release-to-next-presented-frame on the heavy curved layout, headless Chrome AND Electron under one
   protocol) and ONE release-cost ranking (R1 — the decision doc's three candidates; produced after M1,
   as ruled). It entered nothing into P23B.8's decision and set no threshold; its records, two LIVE
   captures and acceptance record → ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/.
   A REVIEW-CORRECTION PASS then ran on the same branch (2026-09-27; uncommitted when written, landed as
   commit `3ef60e68` with the records it corrects): R1's ranking was corrected in place (mesh-prebuild is the larger exclusive cost
   in five of six committed classes, level in the sixth; room-geometry-compile is at or below it
   everywhere; the canonical-gates row is reported, not ranked — its exclusive self is withheld in
   every class), the gesture rows were restricted to the measured population (they had pooled warm-up
   drags and retried attempts), the `wall-authoring` population was reconciled (23 measured accepted vs
   20; rule unchanged, decomposition now reported), BOTH M1 legs were RE-RUN against the corrected code,
   and the D4 whole-Room / D5 pointer-move / D6 Plan-presentation attribution was read out of the
   session's own rows. Corrections + attribution record →
   ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-M1-R1-corrections-and-attribution-record.md
   TWO MEASURED CANDIDATES, both in PRODUCT code and both therefore UNAUTHORIZED: the whole-Room move's
   per-preview full-generation mesh preparation (61.8 / 70.5 ms p50 exclusive self per occurrence, SIX
   per accepted action, against ONE occurrence at 12.7 ms for a single-wall drag on the same fixture and
   session — mechanism stays with P26 §3.5) and the pointer-move wall-snap index derivation (173.2 /
   231.3 ms p50 per accepted geometry on all-curved against 13.3 / 13.8 ms on the straight control, and
   PROVABLY paid outside the synchronous release — mechanism stays with the P23B.7 family). The
   corrected pair also shows a second-session shift of ×0.38–×1.03 in EVERY row the corrections cannot
   touch, so M1's absolutes are session-conditioned: any future before/after must be SAME-SESSION.
   Gates re-run green on the corrected worktree: check 0/0 · test 359 files / 5,121 · arch 23/254 ·
   heavy 7/89 · perf 8/63 · build · visitor bundle 3 server / 9 client (one full-suite run under load
   reported 6 five-second TIMEOUTS; all four affected files pass standalone and none reproduces).
   DIRECTION PROPOSED for all three targets, OWNER-AUTHORIZED as expanded scope for this PR and RUN
   (working tree then; committed 2026-09-28) →
   ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-optimization-directions-proposal.md
   with its results in .../2026-09-27-D4-D5-D6-live-attribution-record.md. What came back, one line
   each: D5's exact hull+calipers replacement was IMPLEMENTED, proven output-identical and MEASURED UP
   TO 2.2× SLOWER at the real input (2,560 spans / 40 Walls / k ≤ 128), so it was DELETED — the cost is
   the READS, 43.7 ms over the live `$state`-proxied geometry against 3.6 ms for the same values as
   plain objects (12.1×, live, one drag), and a copy-first fix does not pay either, so the fix belongs
   to the identity the frozen baseline is stored under (preview-state / P23B.7 family ruling); D4's
   reuse accounting shows reuse ALREADY WORKS per Wall (`built: 4 / reused: 36` with
   `compiled-wall-changed` as the stated reason, six preparations per accepted action) and the 61–68 ms
   of each 72–81 ms preparation is the per-Wall VALUE COMPARISON of the whole generation, not the
   builds; D6's falsifier came back NEGATIVE — the idle surface paces at 16.67 ms p50 (481 frames /
   8,000.1 ms, Electron 35.0.2 preflight, calibration residual 0.168 ms), so the post-release wait is
   real work — and the cold live action that followed (the app's own baseline restore + mesh reinstall
   inside the window, 120.8 / 129.2 ms) is SUPERSEDED by the steady-state protocol run of the same
   legs WITH the split in place: 0.0 ms of restore and 0.0 ms of commit AFTER a release in all 38 class
   rows on both runtimes (p50 AND p95; three single-action strays at 0.0 ms, no commit mark at all),
   because BOTH families land INSIDE the release: restore 7.0–10.8 ms on a whole-Room move of the three
   recorded fixtures (3.2–10.8 with the advisory connected one; 0.1–3.6 ms elsewhere), commit 1.0–2.9 ms
   on that same class against 7.1–28.6 ms everywhere else — the only class where the two invert, which
   is the bridge's edit already having landed during the drag — and the restore's own mesh install is a
   0.00 ms reuse hit in steady state (it wrapped a `{built: 0, reused: 40}` preparation at 129.2 ms in
   the cold probe, so that figure was a first-preparation cost). The wait is therefore 1.6–5.3 ms of
   scheduling, the Plan render
   (17–52 % of it), and a tail of 47–78 % (Electron) / 43–59 % (Chrome) after the page's LAST
   attributed mark (which lands p50 11–89 ms in), i.e. a stage the harness has no mark for.
   **SUPERSEDED 2026-09-28 — the tail was PRICED and it is NOT a compositor/raster/present stage: with
   trace DURATIONS in place the wait is ~96–97 % page JavaScript, contained in one Svelte runtime task
   per release, and on the curved fixtures mostly the Room-label placer's eligibility grid. See the
   2026-09-28 post-release-window-attribution record below.** The new
   preparation marks run in protocol and confirm D4 there: 6 `mesh-prebuild` per accepted whole-Room
   action (49.2–70.6 ms p50, of which 33.9–63.0 ms is the comparison remainder) against 1 per
   single-Wall drag (7.3–12.7 ms), `mesh-build` 0.3–0.7 ms, `mesh-inputs`/`mesh-room-meshes` 0.0 ms.
   The second restore — one full chain per action OUTSIDE every action's span — is 0.2–0.9 ms of p50s
   (n = 25 per class), which is why the containment pool counters are now published beside every
   window.
   TRACED (read-only, no code changed) WHY a whole-Room move pays its pipeline per pointer move, against
   a single-Wall drag that pays it once per gesture: they are DIFFERENT code paths reached from the same
   press — a press inside a Room interior starts a room-unit drag (LayoutPlanViewport.svelte:3455/:3484)
   whose pointermove handler restores the baseline snapshot and then re-derives and installs the whole
   document (`restoreLayoutPreviewSnapshot` :3743 → `previewWallFirstRoomMove` :3745 →
   `planWallFirstRoomMove` + `applyWallFirstRoomDocumentPlan`, "one bundle, one compile"), 6 restores +
   6 preparations + 5 FULL compiles per accepted action at 9.9 + 70.6 + 31.0 ms p50 — while a press on a
   canonical Wall starts an architecture edit (:3716 → `previewArchitectureEdit`, "one snap, one
   proposal, one Plan update") that compiles exactly ONCE, at release, and installs it as
   `preview-compile-reused`. VERDICT: the restore and the compile are per-move by MECHANISM (P23.6a's
   "the candidate is always derived from the immutable baseline") — 100 % of the 40-Wall document
   recompiled for a delta that changes ≈3.3 Walls — and the preparation's 62–68 ms is caused by the
   generation-IDENTITY-keyed mesh WeakMap, NOT by unconsulted reuse: the reference IS handed in
   (`applyCompiledLayout:644`) and ~36.7 of 40 Walls are reused per frame. So the work is not required
   by the geometry and not caused by a missing reference; it is a whole-document re-derive per move
   whose dominant term is the value comparison that "reuse" costs when the key changes. Three
   candidate directions (provenance reuse · no compiled install per move · transform prepared outputs)
   are product + P23B.5-ratchet rulings, none taken.
   → ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-room-move-reuse-trace-record.md
   SKETCHED (design only, NO code, NO authority) what the room drag would look like on the Wall drag's
   shipped transient contract ("pointerdown captures the immutable baseline · pointermove derives a
   proposal, installs nothing, writes no history · pointerup = one canonical planner call + compile"),
   and listed what must stay true: the release is ALREADY re-derived from the release point against the
   frozen baseline (:4042–4072), so the six per-move installs are preview-only and removing them cannot
   change what commits — provided the eight invariants already enforced by
   layout-room-move-gesture.test.ts stay unweakened, plus six new obligations (same intent as the planner;
   refutation-only preflight; no resampling of the drawn curve; truthful room-derived presentation;
   the 3D consumer read FIRST — it is the open D4-2 question; existing tests unmodified with per-gesture
   compile/install counts asserted). Two behaviour changes it cannot avoid, with precedent: the original
   stays drawn under the overlay (the wall drag's accepted UX), and refusals only the full planner can
   see move from "red while dragging" to "red at release" unless the cheap gate is extended — that
trade is the one to decide first. No cache, no Worker, no WASM, no baseline, no ratchet write.
   → ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-room-move-quick-sketch-design-sketch.md
   REVIEWED (read-only, no code changed) the EXTERNAL RESEARCH SYNTHESIS obtained against the room-drag
   brief and CORRECTED three of its assumptions from the shipped code, each of which changes the plan:
   (1) its Slice A assumes a room-unit proposal the repo does NOT have — core exports only
   `proposeWallFirstArchitectureGeometry` / `preflightWallFirstArchitectureCandidate` (direct edits) and
   `planWallFirstRoomMove` (the FULL planner), and the drag's pointermove calls THAT
   (`LayoutPlanViewport.svelte:3744–3757`), so the slice is NEW CORE SURFACE (extending the intent to a
   wall set is smallest: proposal and preflight share ONE intent→candidate mapping) plus the viewport
   rewiring, not a viewport-local refactor; (2) the sketch's open "who consumes the installed preview"
   read is CLOSED and favorable — `LayoutPreviewScene.svelte:83–89` prefers a transient bundle and
   `Workspace3DView.svelte:419` wires one, but that view is mounted in an `{:else}` branch
   (`EditorApp.svelte:2250`), so during a PLAN room drag the 3D scene is NOT MOUNTED and the
   presentation set is Plan-local; (3) the refusal trade is not "red while dragging becomes red at
   release" — `drag.candidateValid` is read by NO production renderer (gesture tests only), so the live
   signal is the geometry itself, and a PROPOSAL-ONLY per move (no preflight) is admissible, which also
   avoids re-introducing the `snap-wall-index` cost the room path does not pay today (grid snap only,
   `layout-interaction.ts:1448–1462`). The synthesis's conclusion (gesture-scoped transient transform
   over the frozen baseline, one compile + install at release, no second geometry authority, no Worker,
   no incremental compiler) is CONFIRMED, and its two exclusions match the measurements. It also cannot
   know that the reuse ratchet measures this exact path per move (`p23b5-reuse-ratchet.ts:203–227`).
   PLAN PROPOSED, sequenced so step P0 changes NO product code (translation-parity differential · a
   cost probe of the ADDED per-move work · a consumer census proving the Plan-only presentation set ·
   a per-gesture call-count baseline), with the ADDED per-move cost stated as the plan's largest
   uncertainty and its falsifier (if it costs as much as the removed side, the fast path fails), the
   core change carrying core's owner authorization, and the two visible consequences (the original stays
   drawn under the overlay; live geometry fidelity replaces a fully recompiled candidate) taken as OWNER
   DECISIONS before building. No authority claimed, no product module touched, no cache/Worker/WASM,
   no baseline or ratchet write.
   → ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-research-synthesis-review-and-plan.md
   IMPLEMENTED (owner-authorized as expanded scope; working tree then, committed 2026-09-28) the whole-Room drag's
   transient attempt, gated on the plan's own P0 measurements — which came back: (P0.2) TRANSLATION
   PARITY PASSES EXACTLY — compile(translated) ≡ translate(compile(baseline)) point-for-point on every
   moved Wall's samples/length/thickness/height/endpoints and every moved Room's floor polygon, over all
   four committed fixtures × three deltas, and the drawn attempt IS the planner's compiled geometry, not
   a second description of it; (P0.3) ROTATION PARITY FAILS at sampling density — a rotated isolated
   group compiles to the rigid image of its Rooms (vertex-exact) and preserves every Wall's length, but
   `samples(rotated)` and `rotate(samples)` do NOT agree on sample count, so a rotation cannot be
   previewed by moving canonical points; (P0.4) ADDED-SIDE COST 136–197× BELOW THE REMOVED SIDE
   (0.391–0.581 ms proposal against 69.2–79.2 ms planner + compile + prepare, all-curved 40-Wall
   fixture, same session, twice); (P0.5) five pointermoves install nothing, leave the document
   byte-identical to the frozen baseline, replace no compiled geometry and write no history, and the
   release commits EXACTLY the planner's candidate for the RELEASE delta (proven against a different
   last-previewed position) with one entry and exact Undo. THE CHANGE: the planner's candidate
   construction is extracted as `roomUnitMoveCandidate` and SHARED by the planner and the preview (one
   moving-set→candidate mapping, the P23.11 proposal's own rule); a new
   `layout-transient-room-unit.ts` returns the render-only attempt; `LayoutRoomUnitDrag` carries the
   moving set frozen at pointer-down (resolved once through the planner's own isolation policy);
   `withRoomUnitMoveIntent` draws it in the pending token language composed INSIDE the refusal
   annotation; the viewport's pointermove no longer calls the planner, its release keeps its sequence
   with the guarded baseline restore, and the legacy Room-unit path is UNTOUCHED because it commits its
   last previewed candidate rather than re-deriving. DEVIATION, reported not hidden: ROTATION IS NOT
   WIRED — it has no reachable committable wall-first target (the rotation handle reads the legacy Room
   registry, empty for wall-first, and the legacy path commits its last preview) and its preview is not
   parity-equivalent anyway; the rotation surface exists in core, parity-evidenced and routed. GATES on
   this tree: editor `check` 0/0 · `layout-core` `check` 0 errors · `test` 363 files / 5,142 passed
   (was 360/5,129) · `test:arch` 23/254 · `test:heavy` 8/92 (was 7/89) · `test:perf` 9/64 (was 8/63) ·
   `build` ok · focused invariants `layout-room-move-gesture.test.ts` 17/17 UNMODIFIED. One existing
   test changed deliberately and strengthened, not weakened: `plan-refusal.test.ts`'s source-text guard
   now asserts the nested composition (the refusal still composes OVER the whole transient chain). A
   WIRING GUARD added with the tests (each path called exactly once, read from the viewport's source)
   caught a real defect before it shipped: TWO gesture-exit sites cleared `roomUnitSnapshot` without
   clearing the attempt (the broad gesture reset and `clearActiveLayoutDrag`), which would have left a
   stale attempt after a project replacement; both now clear it and the guard asserts the counts match.
   VERIFIED LIVE as well as at unit level: one real whole-Room drag driven through the harness host on
   the real viewport (DEV, Chrome, owner-40-curved, ladder zoom 19.29 px/m, `__P2311_PERF__` on) paid
   ONE bounded proposal per pointermove (4 moves → 4 `room-unit-proposal` at 0.5/0.6/0.5/1.4 ms) with
   ZERO `preview-compile` and ZERO `mesh-prebuild` per move, drew 5 pending-language polylines beside
   the committed ink and 0 after the release, then reached the canonical path EXACTLY once per gesture
   (1 compile 52.6 ms, 1 preparation 12.2 ms), reported "Moved room" and was undone by exactly ONE
   history entry (the Room's fill rect returned to its pre-gesture position). NOT DONE, and said so: the
   live M1-protocol FRAME SERIES / before-after was NOT run — a same-session before needs a pre-change
   tree and every M1 absolute is session-conditioned, so the gesture improvement is established as a
   mechanism, a unit-level ratio and a live per-gesture call-count accounting, not as a frame series.
   No cache, no Worker, no WASM, no baseline write, no ratchet write.
   → ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-room-move-transient-implementation-record.md
   → ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-M1-release-to-presented-split-record.md
   → ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-28-room-drag-follow-ups-record.md
   → ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-28-M1-arms-chrome-leg.json
   FOLLOW-UP (2026-09-28, working tree then; committed 2026-09-28) closed the outstanding "no frame series" caveat and
   two cleanups, and reported one ROUTED item rather than silently reversing a locked decision:
   (a) THE M1 PROTOCOL CAN NOW TAKE A BEFORE/AFTER IN ONE SESSION WITHOUT A PRE-CHANGE TREE. The driver
   gained a DEV-only BEFORE/AFTER ARM (`p23b-m1-room-drag-arm.ts`): the whole-Room class interleaves the
   shipped `transient` path with the pre-change `per-move` path — the pre-change path is still reachable
   in this tree behind one DEV switch, which is what removes the need for a pre-change checkout — and the
   arm is recorded against each RESOLVED action index, so `summarizeM1Arms` splits the class's measured
   population by arm and the record carries per-arm mark/boundary/release/gesture rows plus a signed
   before/after table (a cell only one arm reported is NULL, never zero). New `--arms` flag on the CDP
   runner; the arm is the ONE thing a product module learns about M1, and `p23b-m1-record.test.ts`'s
   product-module guard was deliberately narrowed to pin exactly that (one import, one call, and no
   recorder/sampler/observer/registry/raw-global in `LayoutPlanViewport.svelte`). MEASURED LIVE IN ONE
   SESSION on the real viewport (DEV, Chrome, owner-40-curved-v1, ladder zoom 19.29 px/m): 4 pointermoves
   cost 4 `room-unit-proposal` / 0 `preview-compile` / 0 `mesh-prebuild` / 40.2 ms under `transient`
   against 0 / 4 / 5 / 1006.6 ms under `per-move`, the release unchanged at 1 compile + 1 preparation on
   both arms — a 25× move-phase difference taken as a WITHIN-SESSION comparison, never a cross-session
   one (every M1 absolute is session-conditioned). THE FRAME SERIES IS NOW MEASURED, which is the caveat
   the earlier entry left open: the arms protocol was RUN end to end on the Chrome leg
   (`pre-p23b.8-follow-up/2026-09-28-M1-arms-chrome-leg.json`, 19 class rows, 4,457 presented frames,
   clock-calibration residual 0.265 ms, commit `33d532f5`, tree dirty by design), and the whole-Room class
   splits into 40 accepted actions PER ARM over the four committed fixtures, release coverage 1 in both.
   Gesture-frame series (rAF callback interval inside each measured drag; arm-separable because the
   builder filters the registry by the arm's actions): `transient` p50 17.2 ms, 19.9 % of intervals
   ≥ 50 ms, vs `per-move` p50 166.2 ms, 82.0 % ≥ 50 ms — cleanly separated on every fixture (worst cell:
   all-curved, 34 vs 357 ms), with a shared long tail because the bracket includes the release, which is
   the unchanged control (release p50 13.6–30.5 vs 13.7–27.0 ms). Per accepted action the mechanism shows
   as 4.00 `room-unit-proposal` / 1.00 `preview-compile` / 1.00 `mesh-prebuild` / 1.00 `baseline-restore`
   under `transient` against 0 / 5.00 / 6.00 / 6.00 under `per-move`. Stated limits: the Electron leg was
   not spent, and the long-frame row is the CLASS's window (identical in both arm rows by construction,
   only its coverage is arm-keyed), so it is read as class-level. (b) TWO NOW-UNUSED PER-MOVE SIGNALS DELETED, per the
   plan's own item 10 ("do not leave a flag that is written and never read as if it were a signal") and
   the group-highlight finding: `LayoutRoomUnitDrag.candidateValid` is gone (declaration, per-move reset
   and the two write sites; it was read by no production renderer and a transient drag has no per-move
   planner verdict to record), and `buildPlanInteractionProjection` no longer draws the per-member
   `selection-bounds` highlight (it was anchored to the INSTALLED baseline, so it stopped following the
   pointer — the moving unit is drawn by the gesture's own attempt instead). Both are guarded by tests,
   not just removed: the gesture suite asserts the session carries no such field, and the projection
   assertion now counts zero baseline-anchored group bounds (re-adding the block makes it 2 and fails).
   (c) ROTATION WIRED — THE OWNER REVERSED P23.14 DECISION 7 (scope A of the two the record offered),
   so the deviation is closed with the decision's own reason answered: the decision said a canonical Room
   "has no honest result to commit", and that result now exists as the canonical planner's rigid
   whole-unit rotation. Core gains `planWallFirstRoomRotation` (same isolation policy, same candidate
   mapping, same canonical gates as the move planner, `no_op` on a zero angle) and its overlay partner
   `proposeWallFirstRoomUnitRotation`; the editor gains `previewWallFirstRoomRotation` (the planner's own
   document through the ONE install point) and `transientRoomUnitRotation` (render-only attempt), so the
   rotate branch installs nothing per pointermove and the release re-derives ONE candidate at the release
   ANGLE against the frozen baseline, exactly as translation re-derives the release DELTA. Reachability
   is what was missing and is now supplied: the arm and handle are offered for a selected Room in EITHER
   document kind, anchored to the COMPILED outline (`roomTopCenter`) rather than the empty legacy Room
   registry, with `rotationHandleScreenPoint` exported so paint, hover and the gesture's hit test resolve
   to one identity and pointer-down keeps its offer-then-hint eligibility. The shipped negative test was
   REWRITTEN to assert the reversal AND what survives it (legacy Rooms keep their authored-yaw gesture;
   a wall-first Room gets no legacy vertex handles; no affordance without context or selection), and a
   new differential gates the preview the way translation is gated: the drawn attempt IS the release
   planner's candidate point-for-point, proposing exactly the Walls the release reports changed. The P0.3
   sampling-density result is KEPT, not hidden: it rules out drawing the rotation by rotating the
   baseline's canonical points, which is why the attempt RESAMPLES instead — so the ghost's ink density
   can differ by a sample on a curved Wall (a redraw difference, never a geometry difference).
   DEV-only instruments only: no product behavior, no baseline, no ratchet, no Worker, no WASM, no new
   cache, no threshold.
   QUEUED BY NAME, D4/D5/D6 now ROUTED WITH EVIDENCE rather than open: P1 randomized M-3
   differential + test/DEV-side invariant · D4 whole-Room move measurement — MEASURED: the price is the
   full-generation per-Wall comparison run per preview frame, mechanism stays with P26 §3.5 and needs
   its owner's ruling · D5 topology/snap/hit-test measurement — MEASURED: read amplification through
   the `$state` proxy, mechanism stays with the P23B.7 family (preview-state identity) and needs a
   ruling · D6 adapter/GPU + Plan-template measurement — FALSIFIER NEGATIVE (the wait is not surface
   pacing); steady-state split MEASURED — the wait is NOT the restore and NOT the commit (0.0 / 0.0 ms
   after the release in 38/38 rows, both inside it), and its remaining 47–78 % is a post-JavaScript
   tail with no mark — **PRICED 2026-09-28: the runner now retains trace DURATIONS and V8 CPU samples,
   and the tail is page JavaScript (one Svelte task per release containing the Room-label placer's grid),
   not a compositor stage; the fix and its three legs are in the 2026-09-28 record, and what D6 still
   needs from P26 P6/P1 is a ONE-SESSION arm for the end-to-end number — **SATISFIED 2026-09-28 for the
   ROOM-LABEL placer only (`--label-arms`, see the 2026-09-28 room-label arm record): the tail's
   largest consumer now has a within-session before/after and a null on the fixture where its
   mechanism is absent; the room-unit/transient side still awaits its Electron leg** · D8 heap-retention
   comparison (no redesign) · D9 dormant S6-mapping cleanup · D10 cache/interning ruling only · D13
   baseline coverage limit (noted beside M1). Withdrawn: P3, D11, D12 (the blocked M-2 case stays
   recorded). Decisions → ../roadmap/p23b-geometry-performance/2026-09-27-pre-P23B.8-follow-up-decisions.md.
   Plan (RATIFIED, EXECUTED and CLOSED — M1 both-runtime protocol · R1 ranking method · two separable
   DEV-only instrumentation items; executed head `b6f2203b`; measurement and ranking only) →
   ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-pre-P23B.8-follow-up-plan.md.
   BEFORE-P23B.8 CONDITION: every queued item must be ratified, or explicitly routed to P23B.8 / P26,
   before P23B.8 entry — nothing reaches P23B.8 undecided.
   THEN (2026-09-28, same working tree; committed 2026-09-28) THE D6 TAIL WAS PRICED, AND THE FIRST PRODUCT
   CHANGE OF THIS SLICE CAME OUT OF IT. The instrument that D6 routed by name ("the runner retaining
   trace event DURATIONS") was built in two steps, because the first one proved the trace cannot answer
   the question alone: (a) the window split now keeps each `FunctionCall`'s DEFINITION SITE (line +
   column) and keys its script rows by it, which resolves the largest row of every class — an anonymous
   function in the pre-bundled Svelte chunk — to `deps/chunk-AI5TZSIZ.js:739:20`, i.e. Svelte's own
   microtask-flush wrapper — the CONTAINER, present in 20/20 windows at p50 143.4 ms of a 149.6 ms
   window on all-curved, with no app frame named inside it, because a `FunctionCall` span's duration
   includes everything it calls; (b) a V8 CPU PROFILE was added instead (`--cpu-profile`, sampler at
   1,000 µs, sliced into the same per-class windows, self time per frame, with the two clocks' relation
   REPORTED — profile start 272 ms before the trace's own marker and end 4.5 s after it, elapsed time
   between anchors on one clock, never an offset assumed away). WHAT IT FOUND: the wait is ~96–97 %
   JavaScript and inside it the largest consumer is the P23.13 Room-label free-space placer's
   ELIGIBILITY GRID — 57.4 % of the window's sampled time on the all-curved fixture (leg A), with
   `edgeDistance` at 39.5 % of that window and at 17.11 % of the WHOLE 285-second run, the largest row
   in the profile. THE FIX (product, `layout/plan-room-labels.ts`, five decision-neutral changes: a
   bounding-box lower bound that prunes the point-to-polyline distance, the closed-polygon walk without
   its per-cell copy, early exit once a cell's slack is already negative — the magnitude of a discarded
   cell is read by nothing — active-text inflation hoisted out of the per-cell loop, and the even-odd
   inside test computed PER ROW as a crossing table plus four direct BFS visits). MEASURED, THREE LEGS,
   same protocol and flags: the distance loop 17.11 % of sampled run time → 9.96 %, the inside test
   4.40–5.66 % → 0.26 % (`pointStrictlyInside` 293 ms, 0.08 %); the placer's share of the all-curved
   post-release window 57.4 % → 41.0 %, of room-creation-commit 52.1 % → 37.9 %, of owner-curved
   25.1 % → 12.7 %; all-curved windows p50 213.7 → 116.7 ms (room-creation-commit) and 199.6 → 120.4 ms
   (wall-authoring). Leg C's own window column is NOT read as a delta and the record says why: its run
   took 354.7 s of sampled time against leg B's 236.5 s, and the class the row table cannot touch
   (straight) moved 23.7 → 65.9 ms — that is the session, not the change. PARITY: `check` 0/0; 365 test
   files / 5,181 tests pass; `test:arch` 23/254; the placement suite is the teeth (re-introducing the
   far-edge bound fails 16 of its 28 pre-existing tests, measured twice) and the two NEW curved-room
   tests are stated as coverage, not teeth, because they pass against the wrong bound too; two scratch
   property checks (300,000 random polylines → 0 mismatches, 37.1 % of segments pruned; 168,000
   row-table comparisons → 0 mismatches).
   Record → ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-28-post-release-window-attribution-and-room-label-fix-record.md.
   THEN (2026-09-28, same working tree; committed 2026-09-28) THAT RECORD'S OWN OPEN ITEM WAS CLOSED: the
   placer got the SAME ONE-SESSION BEFORE/AFTER ARM the room drag has, and its end-to-end effect is now
   a DELTA rather than three conditioned legs. WHAT LANDED: `layout/p23b-m1-room-label-arm.ts` (the
   shipped `pruned-grid` vs the pre-change `per-cell-grid` kept verbatim, behind DEV +
   `__P2311_PERF__`, changing no placement decision — asserted by running both arms over 8 fixtures
   incl. a 256-vertex ring, a concave face, every mask class, three zoom regimes and a frozen gesture,
   and requiring identical labels, readouts and sticky memory on the first AND second pass); the driver
   interleaves the arm PER ATTEMPT in EVERY class, because the placer runs on every Plan render, and
   records it against the RESOLVED action index; the runner gained `--label-arms`, which splits each
   class's post-release windows by that index (an unassigned window is DROPPED and counted, never
   assigned) and re-prices the same split from the CPU profile with `arm::class` buckets — one sample
   walk shared with the class slice, so the two cannot drift. MEASURED, ONE SESSION, Chrome 152
   headless, 4,415 presented frames, calibration residual 0.131 ms, 19 classes, 25 attempts per class:
   all-curved 40-wall window p50 219.4 → 149.4 (bend), 215.8 → 146.4 (rigid-wall-drag), 145.6 → 100.1
   (room-creation-commit), 150.0 → 102.3 (wall-authoring), 169.4 → 114.8 ms (whole-room-move-bridge) —
   ratio 0.68 on all five; owner-curved −8.7…−10.2 ms and connected −18.9…−19.6 ms, ordering themselves
   by how much boundary the grid measures; and the FALSIFIER: on the straight 40-wall fixture, where
   the grid has no long curved polyline, −1.7 / −2.2 / +1.4 / −2.8 ms (0.95–1.02), with the pre-change
   arm's `edgeDistance` 95.7 ms against the shipped arm's 0.0 ms. IN SELF TIME, same windows, same arm
   split: all-curved sampled 9,884 → 6,732 ms, `edgeDistance` 3,890.5 → 898.5, the per-cell inside test
   1,006.8 → 0, the per-cell distance helper 691.6 → 0, replaced by the prune's own `segmentLowerBound`
   0 → 932.7 and `polylineDistance` 0 → 586.1, GC 274.5 → 226.6. COVERAGE/PARITY FROM THE CAPTURE
   ITSELF: every measured action accepted in both arms in all 19 classes, `unassignedWindows` 0
   everywhere (10/10 and 12/11 splits are the arithmetic of 25 attempts over two alternating arms), and
   the class's MIXED release p50 sitting exactly on the shipped arm's last window — where the median of
   two separated halves must land. THE WHOLE-RUN PROFILE ROW REMAINS DOMINATED BY THE OLD CODE
   (`edgeDistance` 27,487 ms / 12.17 %, the largest row of the run) BECAUSE IT SPANS BOTH ARMS: a mixed
   population, and the per-arm slice is the readable version of the same number. STILL OPEN: the placer
   is STILL the largest single consumer inside those windows, so the next lever is unchanged and now
   ONE RUN away — the grid's existence per placement (a memo keyed by Room + viewport + mask inputs, or
   a coarser cell budget when the projection has not changed), with the straight fixture as the
   falsifier that has to stay flat; and this arm has no Electron leg.
   Record → ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-28-room-label-arm-before-after-record.md.
   THEN (2026-09-28, same working tree; committed 2026-09-28) THE GRID'S WALK WAS SEEDED AND ITS TERMS
   RANKED, and the arm that was just built measured the result on the same day. WHAT LANDED (product,
   `layout/plan-room-labels.ts`): every distance walk is SEEDED with the slack already found
   (`seededPolylineDistance` returns the exact distance, or `null` when the term cannot come in below the
   seed), whole GROUPS of segments are pruned in bulk against a per-polyline group bounding box, the
   terms are visited CHEAPEST-SEGMENTS-FIRST, and that box is built only for a polyline with at least 8
   segments — because the grid is built 8–72 times per accepted action and pays whatever this costs on
   every one of them. THE ORDER IS THE PART THE FALSIFIER BOUGHT: the first revision ran the mask first
   and the Room's own boundary LAST, which is right for a flattened 256-vertex curve and wrong for a
   four-segment rectangle, and micro-benchmarks at the scale the leg itself reports put that order at
   0.61–0.95× on the straight shapes against 1.47–2.35× for the ranked order (curved: 3.5–7.6×), with 0
   eligible-value and 0 sign mismatches cell-by-cell over five shapes and three grid scalings. DECISION-
   NEUTRAL THE SAME WAY THE FIRST FIX WAS — the arm now runs THREE grids (shipped `seeded-grid`, the
   previous `pruned-grid`, the pre-change `per-cell-grid`), the parity suite requires identical labels
   from all three over 8 fixtures incl. the sticky-memory second pass, and the placer's own 30-test suite
   (16 of which fail under a wrong bound) is unchanged and green. MEASURED, TWO LEGS, Chrome 152
   headless, three arms interleaved per attempt in EVERY class, signed pair `seeded-grid` − `pruned-grid`:
   all-curved 40-wall window p50 113.1 → 94.9 (bend), 107.8 → 94.9 (rigid-wall-drag), 104.5 → 92.5
   (room-creation-commit), 111.1 → 81.7 (wall-authoring), 102.9 → 91.3 ms (whole-room-move-bridge) —
   0.73–0.89 on all five classes, CPU slice agreeing — with the placer's own self time 13.30 → 9.24 ms
   per accepted action across all 19 rows (pre-change grid 33.34 ms); the FALSIFIER reads 0.92–1.03 on the
   straight fixture, and the REJECTED first revision is RECORDED as its own leg at 1.00–1.10 rather than
   quietly rewritten, because that reading is what makes the falsifier worth trusting. Calibration
   residual 0.062 ms, 4,418 presented frames, `unassignedWindows` 0 in all 19 rows.
   THE NEXT LEVER IS NOW PRICED, NOT SPENT: the counter that travels with each attempt's arm record shows
   the grid is built **8–72 times per accepted action** (40 on all-curved bent, 30 on the straight rigid
   drag, 72 on room-creation-commit) against **5–6 `p2311:plan-render-model` renders per accepted action**,
   ≈0.6 ms per build on the all-curved fixture — so the grid's existence is a measured budget (≈24 ms per
   accepted action there) while its REDUNDANT SHARE IS EXPLICITLY UNMEASURED. NO memo, NO cache, NO key
   was added; counting the key-hit rate is the next pass's first step, not this one's conclusion.
   STILL OPEN: the placer remains the largest single consumer inside those windows, and this arm still has
   no Electron leg.
   Record → ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-28-room-label-grid-ranked-walk-and-reuse-budget-record.md.
   THEN (2026-09-28, same working tree; committed 2026-09-28) THE GRID'S REDUNDANT SHARE WAS MEASURED, AND
   THE PASS STOPPED AT THE MEASUREMENT. WHAT LANDED (DEV-only — `layout/p23b-m1-room-label-arm.ts` plus the
   record plumbing and their tests): every grid build is now KEYED over the inputs that determine it (the
   Room's projected polygon, the projected mask with its clearances, the semantic centre), hashed over every
   coordinate's EXACT bits — so two builds sharing a key would have produced one identical grid, which is
   what makes "did these inputs repeat?" the same question as "could a memo have skipped this build?" — and
   each attempt records its builds IN ARRIVAL ORDER as key ordinals in first-seen order. The counts say HOW
   MUCH repeated; the order says whether a cache would have been THERE WHEN THE REPEAT ARRIVED, so any
   policy can be simulated offline from one capture instead of one policy being baked into the instrument.
   The placer passes those three inputs to the call it already makes, by reference and only when the gate is
   on: no placement decision, no arm default and no product path changes, and the placer's own 30-test suite
   plus the three-arm parity differential are the evidence. MEASURED, ONE LEG, Chrome 152 headless,
   calibration residual 0.833 ms, 4,434 presented frames: 479 recorded attempts, 0 without a sequence and 0
   whose sequence disagreed with the attempt's own build count; 14,680 grid builds of which 4,376 (29.8 %)
   rebuilt byte-identical inputs — 27.0 % (straight) · 32.3 % (all-curved) · 28.8 % (owner) · 31.5 %
   (connected), and 15.3 % (room-creation-commit) to 50.0 % (whole-room-move-bridge) per class. THE SHAPE
   IS THE FINDING: every accepted action builds the fixture's Rooms once and then rebuilds a TRAILING SUBSET
   of them — half of them, or all of them — from identical inputs, so NO repeat is ever adjacent: a 1- or
   2-entry cache hits ZERO times on every class and every fixture, while a cache big enough to HOLD THE PASS
   (4 entries on the smallest fixture, 16 on the largest here) captures every one of them — which makes the
   size it needs the ROOM COUNT (4–61 keys per attempt on these fixtures), not a constant, and makes a
   fixed-size cache only ever as good as the smallest Room count it was sized against. THE STRAIGHT FIXTURE
   IS NOT A FALSIFIER HERE, and the record says so rather than implying one: this is a RATE, and every
   fixture repeats (27.0 % straight against 32.3 % all-curved). NOT BUILT, DELIBERATELY: no memo, no cache
   and no key in the product path, and no product behaviour changed. What the number justifies is a cache
   that OUTLIVES a single `placeRoomLabels` call, is SIZED BY THE ROOM COUNT, is KEYED BY A HASH SHIPPED
   INTO THE PRODUCT PATH, and is correct only while that hash covers every input the grid ever grows to
   accept — with a ceiling of ≈9 % of the all-curved `bend` window (29.8 % of the grid against the grid's
   31.7 % share of that window) before its own cost. That is not a local concern of the placer, and the
   trailing second pass reads like the PLAN BEING PLANNED MORE THAN ONCE PER SETTLE, which would make a
   cache the wrong tool — both are the class of change this thread stops and asks about.
   AND THEN THE CENSUS WAS RUN, SAME SESSION, SAME DEV-ONLY PATTERN (no product code changed): one record per
   `placeRoomLabels` call — the Rooms it was handed, its `reason`, whether it got the sticky `memory`, its entry
   time, and the range of the attempt's build order it produced — so every repeat is attributed to the call that
   built it. SECOND LEG: 479 accepted actions, 2,692 calls (5.62 per call), 14,388 builds with 4,084 repeats
   (28.4 %; the same instrument read 29.8 % in the first leg, and that gap IS the reproducibility bound).
   THE PASS IS NAMED: 100 % of repeats come from calls AFTER the action's first, the first call of every action
   repeats NOTHING, and ALL 479 actions end with a `lod` call that built a grid for every Room and was 100 %
   repeats. The shape is identical in all 19 classes — a live `lod` pass, the gesture frames in `frozen` (which
   build TEN grids across 965 calls, i.e. the placer ALREADY knows how to say "unchanged, do not rebuild"), a
   `geometry` pass that re-optimises after the settle, and then that trailing `lod` pass 14–36 ms later over
   BYTE-IDENTICAL inputs. So the redundancy is NOT scattered repeats: it is ONE EXTRA PLANNING PASS per accepted
   action, on inputs the pass before it had already planned. WHAT THAT SETTLES AND WHAT IT DOES NOT: the GRID half
   is proven from the capture (3,991 builds whose inputs were byte-identical to those of the pass 14–36 ms
   earlier); the PLACEMENT half is NOT — the capture cannot see whether that pass's placement differed from the
   one before it, nor whether its consumer needs a placement of its own at all. THAT is the choice now on the
   table and it is NOT taken here: classify the trailing pass as unchanged (how the Plan decides a label layer
   is stale — a render-path change) or give the placer a result-level memo (cross-call state keyed by a shipped
   input hash). Still NO memo, NO cache and NO key in the product path.
   Record → ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-28-room-label-grid-reuse-rate-record.md.
   COMMITTED 2026-09-28 — the working tree every block above was written on has LANDED as a commit
   series on this branch — the three that carried the work, plus the follow-up commit that recorded
   them and carries this text: `3ef60e68` the M1 measurement stack and the records it produced (class
   attribution, the post-release window by phase, the CPU profile, both DEV arm switches, the runner
   rows, and the 09-27 records and two compact captures); `2ccded81` the whole-Room drag on the
   transient contract with rotation wired and the two dead per-move signals deleted, with the room-move
   records and the arms frame series; and `58a0c5ef` the Room-label placer's eligibility grid with the
   one-session arm that measures it, plus both records and that capture. Added to the same series the
   same day, for the pass above: `bca3da02` the seeded, ranked, index-gated grid walk, with the arm grown
   to three grids and the grid-build budget that arms' records now carry; `2e292ade` the runner signing
   the new pair from the arm module's own constants; and `c88b511a` the two legs and the record that
   reads them (the shipped engine and the rejected first revision, both committed as folded single-line
   captures). Added for the repeat-rate pass above: `27396240` the DEV-only build keys and the arrival-order
   sequence, with the record plumbing, the page/driver wiring and their tests; and `572a6a7d` the leg's
   folded capture with the record that reads it; `d17cc500` the DEV-only call census that attributes every
   repeat to the call that built it, and `acb0754f` the second leg's folded capture with the record that names
   the trailing pass. The "NOT committed"
   wording inside those blocks is the state at the time each was written and is kept as provenance,
   never as status; the only things that stay deliberately uncommitted are the two 2026-09-27 M1 leg
   captures (gitignored at two exact paths for their ~40k-line size). Nothing was pushed and no PR was
   opened.
2. Standing constraints:
   - the v5 baseline is test-enforced and `bench:record` is its only writer — never rewrite it; the
     accepted partial baseline (W6 §10.3 disposition A) stands: no further capture, no settlement
     claim beyond its synchronous press/move-phase coverage limit. P23B.11 read and wrote neither the
     baseline nor the P23B.5 ratchet;
   - the P23B.5 reuse ratchet is LIVE and only `npm run reuse:record --reason "…"` may move it — no
     hand-edits or new budget metric. P23B.6's M-3m reuse lives in the EXISTING weak generation
     cache; do not add another cache, re-own the sample store, or claim P23B.5 release-scope M-3
     (still unreachable/unimplemented). Do not restart P23B.4 or reopen P23B.6 / P23B.11;
   - P23B.7's unstarted follow-ups stay named, not silently dropped: the snapshot guard's documented
     limits and the bounded heap-retention follow-up (no redesign proposed).
3. P23B.1 harvest review and the P23B.2 ACCEPT/PART-RETURN evidence decision remain open and separate;
   they do not reopen any shipped slice.
4. P26 planning is now re-derived as track T1 against F (see RATIFIED DIRECTION above): its
   current umbrella/candidate order is pre-redesign evidence, and its prototype journeys A–F
   remain the experience/QA authority. The accepted prototype authorizes neither implementation
   nor the validation window; the F target contract is owner-ratified (F.1–F.5, with
   amendments) and the next planning step is re-deriving T1/T2/T3 against it, independent of the
   P23B continuation (NEXT 1: the pre-P23B.8 follow-up has closed, so P23B.8's entry gate is next).
   No implementation is authorized.
5. P23 carries 13 owner-carried verification rows and 5 deferred debt items, named in its closed gate
   stub; P23B neither claims nor closes them. U-1 was DECLINED; Rust/WASM stays undecided until
   P23B.8.

ROUTE:
ratified direction · decision provenance (normative destination) → ../reference/decisions/northstar-ratification-2026-09-27.md
F composition/execution target contract (owner-ratified 2026-09-27 with amendments; no implementation authorized) → ../reference/composition-execution.md
F foundation-contract phase registration + status → ../roadmap/f-foundation-contracts/README.md
phase pipeline · P-level status → ../roadmap/README.md
P23B phase status · child order · SEQUENCE + amendments · closed stubs/anchors/tags → ../roadmap/p23b-geometry-performance/README.md
P23B.11 closed plan stub (delivered mechanisms · accepted contract · entry points · residual ledger · recovery) → ../roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/2026-09-26-P23B.11-wall-chain-release-delay.md
P23B.11 closed acceptance stub (acceptance record · reused gates · the S7 measurement · preservation report) → ../roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/2026-09-27-P23B.11-S7-remeasurement-record.md
P23B.11 closed step records (S1 profile · S3 short-circuits · S4 gate · S5 identity early-out · S6 M-4 · review fix) → ../roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/
P23B.11 LIVE measurement JSON records (S1 profile + classes · S7 profile) → ../roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/
pre-P23B.8 follow-up decision doc (owner decisions 2026-09-27; M1 + R1 ratified scope; queued items + condition) → ../roadmap/p23b-geometry-performance/2026-09-27-pre-P23B.8-follow-up-decisions.md
pre-P23B.8 follow-up records + plan (RATIFIED, EXECUTED and CLOSED 2026-09-27 — M1 session record · S2 Chrome leg · S3 Electron leg + pair tables · R1 ranking · acceptance + preservation record; executed head `b6f2203b`, evidence anchor `58a139f2`) → ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/
pre-P23B.8 follow-up captures, COMMITTED as single-line JSON (cited machine-readable evidence: the arms run's per-arm frame series · the restore-vs-commit split pair with the postRelease split, the presented pairing and the containment pool · the Room-label arm leg's per-class `labelArms` assignment, per-arm window rows and per-arm CPU slice · the seeded/ranked grid leg's three-arm `labelArms` rows with the signed pair `seeded-grid` − `pruned-grid`, its per-arm CPU slice and its per-class `buildsPerAction` · and the rejected first revision's leg, kept for the falsifier reading that rejected it) → ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-28-M1-arms-chrome-leg.json · ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-M1-restore-split-chrome.json · ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-M1-restore-split-electron.json · ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-28-M1-label-arms-chrome-leg.json · ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-28-room-label-grid-ranked-walk-chrome-leg.json · ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-28-room-label-grid-first-revision-chrome-leg.json · ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-28-room-label-grid-reuse-rate-chrome-leg.json (the repeat-rate leg: every recorded attempt's `byAction[].keySequence` in arrival order, each class's grid-build key histogram with its repeat count, and the `buildsPerAction` budget beside them) · ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-28-room-label-grid-call-census-chrome-leg.json (the census leg, which carries that plus `byAction[].labelCalls`: one entry per `placeRoomLabels` call with its Rooms, `reason`, memory, entry time and the range of the attempt's build order it produced)
pre-P23B.8 follow-up M1 LEG captures, RETAINED BUT DELIBERATELY NOT COMMITTED (two exact root-.gitignore paths: ~40k pretty-printed lines each = 59,335 of the slice's 63,588 added PR lines, so they stay out of the PR; every quoted row is in the records and the S2/S3 runner commands regenerate them) → ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-M1-chrome-leg.json · ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-M1-electron-leg.json
docs startup boundary · update rules · skills → ../README.md
test contract + concrete commands → ../../apps/editor/tests/README.md
recorded v5 baseline (test-enforced; `bench:record` is its only writer) → ../../apps/editor/src/lib/bench/baselines/g3-baseline.json
LIVE P23B.5 reuse ratchet (only writer `npm run reuse:record --reason "…"`) → ../roadmap/p23b-geometry-performance/p23b.5-caching-reuse-optimization/reuse-counter-ratchet.json
LIVE measurement-step capture (cited evidence) → ../roadmap/p23b-geometry-performance/p23b-measurement-only-step/2026-09-25-release-containment-capture.json
LIVE P23B.7 S6 capture (cited evidence) → ../roadmap/p23b-geometry-performance/p23b.7-interaction-optimization/2026-09-25-s6-commit-path-identity-capture.json
P23B.6 closed release-delay diagnosis stub (candidate evidence P23B.11 consumed) → ../roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-release-delay-diagnosis.md
P23B.1 harvest (own review status) → ../roadmap/p23b-geometry-performance/p23b.1-internal-geometry-pipeline-harvest/2026-09-22-P23B.1-harvest-record.md
P23B.2 research report (own evidence decision) → ../roadmap/p23b-geometry-performance/p23b.2-external-geometry-performance-research/2026-09-22-P23B.2-external-geometry-performance-research.md
P26 planning + accepted direction (routes the prototype) → ../roadmap/p26-spatial-depth/2026-09-24-P26-continuous-spatial-authoring-umbrella.md
P23 (closed, evidence only incl. close record) → ../roadmap/p23-layout-depth/README.md
post-P23 debt → tech-debt/README.md

BLOCKER:
- The 2026-09-27 reconciliation authorizes no implementation. The F target contract is
  owner-ratified (F.1–F.5, with amendments); capability re-planning re-derives against
  it, and no implementation is authorized.
- P26 implementation readiness remains gated: planning is re-derived as T1 against F; the
  validation window is not open.
- The P23B.2 ACCEPT/PART-RETURN evidence decision remains open and separate from every shipped slice.
- The pre-P23B.8 follow-up has EXECUTED and CLOSED (measurement + ranking only), so P23B.8 entry is
  now gated by the before-P23B.8 condition alone — every queued item must be ratified, or explicitly
  routed to P23B.8 / P26, before P23B.8 entry.
- P23B.6's final-capture all-curved Whole-Room and Wall-authoring release increases remain UNRESOLVED:
  M1 re-read both rows on both runtimes and did NOT reproduce them (a finding, not a fix, and no
  cause is claimed), and the browser/node gap still has no established cause. M1's own results are
  advisory — one machine, one DEV session — and create no budget or threshold.
- The P23B.7 snapshot-guard limits and the bounded heap-retention follow-up remain carried and
  unstarted.

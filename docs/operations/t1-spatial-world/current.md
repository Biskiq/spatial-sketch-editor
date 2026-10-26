# T1 — Spatial world: current baton

PHASE: T1.P02 Native Wall creation →
       ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md
       T1.P01 closed 2026-10-21. T1.P02 is active; S01 and S05 are shipped.
ACTIVE: T1.P02.S06 (performance foundation), optimize step (agent), released 2026-10-25. Started
        2026-10-24 at trusted base 2215af341a650ac3a99a0fbb36e48de7e901411e; setup and C.2
        amendment in PR #190. Owner-directed takeover starts at 764175e0 on the existing branch.
        The previous flat-counter claims do not establish total-operation locality: source arrays,
        Maps, BVH buffers and compiled outputs still copied globally at that revision. Persistent
        roots, lazy compiled views, session-owned historical restoration and bounded Node
        comparisons are implemented (d47c25e1 / bd443412 / 5cdccb79 / 0156eac1 / 48126338).
        Fresh independent review is pending; no acceptance is recorded. The Room-shaped
        100,002-entity replay passes cold/cross-revision output parity; accepted native source,
        flat canonical SHA and full Stage consumers remain explicit costs.
        Owner-directed continuation (2026-10-26): the Plan interaction layer is now local too —
        panning retains one Plan evaluation instead of re-deriving it per frame, a click's hit
        path is a retained screen-space AABB broad phase (O(log F + c) instead of
        O(F log F + F·S) projections) with the same exact test and priority order, and the
        per-frame selection echo is indexed. Source analysis and correctness tests only; no
        benchmark, profile or timing probe was run. T3 review of the Plan-key change and the
        retained-target protocol is owed; independent review of the pass has not happened. Dossier:
        ../../roadmap/t1-spatial-world/broad-research/spatial-computation-architecture.md.
        Second continuity pass (2026-10-26, `3e7efdbe`): an accepted edit no longer re-derives the
        whole Plan. `createPlanRetainer` keeps each compiled source's derivation (its membership row
        and its placements) and maintains the declared order alongside it, so a new compile
        generation relocates only the fragments and re-measures only the sources the edit touched:
        O(N) cheap comparisons, O(k) derivation, O(F) fragments — no id sort, no fragment sort, no
        candidate or membership churn. Anything it cannot prove it reproduces (a source id shared
        by two kinds, or repeated within one) is handed to the normative evaluator, and the
        differential suite holds the two identical across generations, moved spans, changed
        openings, added and removed sources, parameter and target changes, refusals and a
        randomized sequence. The hit path no longer re-sorts eligible fragments — they already
        arrive in the declared order — and membership lookup is indexed by the assembly pass.
        Derived, not measured. T3 review of the Plan evaluator's retention protocol is owed, and
        the remaining O(F) per generation is a property of the ratified correspondence (every
        fragment carries its generation), not of the implementation.
        Third continuity pass (2026-10-26): the Plan is now maintained from the compiler's own
        evidence. `diffCompiledSources` compares two compiled snapshots' persistent roots and names
        the records whose identity changed, so an accepted edit re-derives exactly those sources —
        one Wall's height change derives one source, with zero field comparisons and zero legacy-array
        materialization (`compiled.walls`/`compiled.rooms` are lazy arrays; the retainer now iterates
        the retained root instead). The complete output stays exactly as ratified but is
        demand-driven: `fragments`, `membership`, `streams` and `bounds` materialize on first read and
        cache, while `planFragmentOf`/`planMembershipOf` answer from the retained per-source records.
        Two corrections to earlier claims in the record: `splice` insertion is O(k·S), not O(k log S),
        and the old fallback's index-paired `wallUnchanged` re-derived 11 (10 Rooms) / 41 (40 Rooms)
        untouched sources per insertion — fixed by pairing on the whole derived placement, now a
        size-invariant constant. The Index panel no longer derives the whole located-subject list on
        every Plan evaluation, and the live-target view copies property descriptors rather than
        spreading (a spread would now force the lazy fields on every pan). Independent review (two
        reviewers, correctness and integration) found one real defect — a lazily materialized plan
        read after a later evaluation described the newer sources under its own generation — now
        fixed by capturing each plan's own view and pinned by a regression case that fails without
        it. Derived, not measured; T3 review of the compiler-delta certificate is still owed.
        Integration and candidate freeze (2026-10-26, `d7600576`): `main` (`51dcb764`) is merged, not
        rebased, so every S06 commit and all bench provenance keep their SHAs. Seven conflicts were
        resolved additively — the frozen-revision memo and work counters now coexist with Save's
        `SaveWorkInstrumentation`, `verifyUnitDependencyLocks` takes one options object carrying both
        sides' optional inputs, and the Stage host / perf helpers are unions. No flow definition,
        counter, budget or threshold changed and `perf/bench.ts`'s pass composition is untouched, so
        Bench 3 compares the same conditions as Bench 1/2. One interpretive caveat is recorded in
        `perf/README.md`: a deeply frozen unit's repeat digest is served from the memo, so its
        `save.unit.*` phases do not appear — compare F9 rows and benches at like cache state, it is
        reuse, not a lost stage. Two final reviewers (correctness and the T3-shaped ownership mandate)
        found no correctness defect in the merged tree: one provenance caveat, three comment and
        documented-invariant corrections. Verification on the merged tree: every package check, the
        editor build, API suite, fast lane 176 files / 2,282 tests, architecture 22 / 180, heavy
        11 / 138, and the durable `npm test` 209 files / 2,600 tests. The all-in-one contention was
        characterised rather than guessed — three whole-tree sweeps crossed the 5 s default only
        under ~200-file parallel transform (1.5–2.3 s alone); they now state their own budget with no
        assertion changed, and one flaky lifecycle case waits on its observable condition instead.
        This is the Bench 3 candidate; it is not accepted, merged or deployed, and T3 review of the
        retention protocol, the compiler-delta certificate and the Plan-key/retained-target change is
        still owed.
        Results and hand-off: ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/acceptance.md
NEXT:   Owner-run Bench 3 on the frozen candidate, then the same review boundary — plus T3 sign-off
        on the Plan retention protocol, the compiler-delta certificate and the Plan-key/
        retained-target change. The candidate freeze and its review disposition are recorded in
        ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/review-handoff.md#current-independent-review-boundary
        (a diagnostic Bench 2 has run and remains non-acceptance and contaminated; the formal Bench 3
        remains the owner's and has not run):
        T1.P02.S06 → ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/implementation-plan.md
        It runs on an owner-run benchmark budget of at most three passes:
        set up (agent) → Bench 1 (owner) → optimize with hand calculation (agent) → Bench 2
        (owner) → fix (agent) → Bench 3 final acceptance (owner).
        Agents never run a full benchmark pass. This takeover's owner-directed, bounded Node
        comparisons are separately labelled; they are not Bench 2 or product-budget evidence.
        The one exception is owner-directed: the owner had the agent launch Bench 1 (2026-10-24).
        It covers:
        - the peak-first, setup-free harness method on the designated MacBook Air M2 (16 GB);
        - L/XL and realistic-load workloads;
        - per-stage scaling evidence;
        - algorithm work inside the one compiler;
        - the full-permissive library exploration.
        Then S02 (draw, close, divide and delete), which is held and NOT authorized. It is halted
        until S06 is accepted and merged. After that it needs its own owner authorization, a plan
        review, the T3 review of the shared Head/F4 shell allocation and the T2/T3
        contribution-compatibility review. Then S03 (outline, held) and S04 (final gate).
        Order: S06 → S02 → S03 → S04.
CLAIMS: S06 setup holds apps/editor/perf/**. Writer: the T1 S06 takeover agent, branch
        `t1/p02-s06-bench-setup`; expected patch base 764175e0. T3 reviews immutable capture,
        Stage admission and qualified handoff; T2/T3 review shared renderer compatibility.
        The shared harness/fixture review remains required. No shared test helper under
        apps/editor/tests/helpers/** is edited. Every owner-run pass on the M2 holds the
        machine-wide perf lock.
CARRY:  - Transferred to S06 (owner replanning 2026-10-24):
          - S02's install-compile and Undo/Redo dedupe and the incremental/worker experiment;
          - T3.P02.S02's deferred Scope A performance rows (measurement and dispositions);
          - T3.P03.S02's L/XL fixtures and M/L drag rows.
        - S01's F2 S/M open timings stay assigned to S04 on the designated M2. S04 cites and
          rechecks S06's owner-run numbers. Bounded Node evidence does not establish the product budgets.
        - Occupancy-derived curve-knot/interior-anchor allocators stay outside accepted intents. The
          first curve-authoring slice captures them before curved drawing ships.
        - Deferred-retirement rows in the T1 track README are still live: the Room-level wall mesh
          path (VisitorLayoutShell Room branch) and the Camera room-ownership branches
          (`isWorldPointInsideRoomXZ`).
BLOCKERS: none for S06 once the coordination PR is merged. S02 is blocked by S06 and by its
        authorization and reviews above.
ROUTE:  ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md#slice-register
        → ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/implementation-plan.md

BOUNDARIES: No phase closure, T1 TRACK COMPLETE event or owner architecture verdict is recorded.
RELEASE: ../../reference/decisions/performance-foundation-authorization-2026-10-24.md

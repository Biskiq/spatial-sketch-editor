# Test-suite harvest — Museum Editor (2026-09-19)

**Status:** evidence gathering only at authoring time (no tests refactored, renamed, moved, or deleted; no production code changed; no commits). **T1 and T2a have since been executed** from this report — see **§J Execution log** for the lane implementation and the exact duplicate removals; §C.3 dispositions are annotated `EXECUTED (T2a)` where the change landed. Three T2a units were later judged false-successor deletions in review and **restored** — see **§J.4**. **T2b and T2c have since been executed** — see **§K Execution log (T2b + T2c)** for the render harness, the A/K/E/I/F replacements with their mutation evidence, the retained pins and why, and the relic smoke contract. **T3 has since been executed** — see **§L Execution log (T3)** for the dismantled `contracts.test.ts` accumulator (its migration map, the 49 pruned duplicate assertions and the two new boundary homes), the four ownership pins T3b added, the relic retirements T3c performed against §K.5, and the before/after maintenance + lane metrics. T4–T6 remain unstarted.
**Scope:** `apps/editor/tests/**/*.{test,spec}.{js,ts}` on branch `refractor/tests` at `a479f78` (merge of PR #61, P23.14 implementation).
**Authority rule used:** current `docs/reference/` over archived plans; archived plans/comments used only to explain why a historical test exists.
**Artifacts:** this report + `test-suite-harvest-inventory-2026-09-19.csv` (same directory, 303 rows, one per test file, with LOC/describes/tests/subsystem/slice/imports-fs/walk/spawn/loop/random/timing/kind + run-1 duration + vitest test count).

## A. Executive findings (15 bullets)

1. **Suite size (measured):** 303 test files, 4,510 tests (4,509 passed, 1 skipped — the skipped one is the `plan-bench` full-tier measure), ~113.5k LOC of test code. Vitest reports 1,222 suites (describe blocks).
2. **Total runtime (measured, 2 full runs):** run-2 wall `31.36s` (`transform 7.71s, collect 94.96s worker-sum, tests 52.45s worker-sum, prepare 17.96s`); run-1 per-file duration sum `52.20s`, worker-span `26.93s`. Transform + collect/prepare overhead is real (~8–18s worker-sum) but the dominant cost is a small heavy tail, not sheer count.
3. **Heavy tail dominates:** top 10 files = **79.3%** of per-file sum; top 25 = 85.4%; top 50 = 90.5%. The top 7 alone (≈41s of 52s) are: `normalize-asset` 15.26s, `camera-motion` 6.23s, `p2311-bend-perf-pass` 5.06s, `p23-6e-extra-angled-plan-integrity` 4.71s, `layout-scale-fixtures` 3.77s, `layout-preview-state` 2.43s, `wall-mesh-builder` 2.20s.
4. **Single slowest file is a subprocess harness:** `lib/content/normalize-asset.test.ts` (6 tests, 15.26s, ~29% of per-file sum) shells out to `sh`/`shasum`/CLI. Correctness invariant may be durable; the *mechanism* (subprocess per run) belongs in a heavy lane, not the inner loop.
5. **Source-reading files: 77 of 303 (25.4%).** Mechanical triage: 44 arch-boundary-via-source-walk, 30 pure source-shape, 3 other reads; plus ~95 more files with boundary-like names but no `fs` reads (heuristic over-tags — only ~15–20 are legitimate durable boundaries, see §C).
6. **Slice-named files: 115 of 303 (38%).** Largest families: `p23-6` 18, `p23-13` 18, `p23-12` 11, `p23-11` 11, `p23-14` 9, `p23-f0` 5, `p11`/`p12` 4 each. Slice names are history, not product contracts — durable ones need product-contract renames later (map in §G, no renames now).
7. **Strongest supersession chain (shell):** `P11 compact-controls → P12 one-shell lanes/header-chrome → P21.6 focus/timeline slices → P23.14 PLATE`. The durable shell authority is now `docs/reference/design-system/editor-shell-and-visual-system.md` (rank 1, ratified R1–R4, P23.14 review-open). Qualification from the deep pass (C.1.1): the genuinely superseded portion of the old files is very small — 1 `it` (p11-s4 A3a) + 2 line-merges (scrubber, toggles). The rest of P11/P12/P21 is still-live behavior (Flip/Repeat/scope/focus/drag machines, hook matrices) and architecture (live-absence tripwires, framing ownership, picking boundary, rig guard). P23.14 re-asserts the *new* chrome — but mostly still via source text, so P23.14 is "durable contract, brittle mechanism" (REPLACE-mechanism, not DELETE-invariant).
8. **P23.13 → P23.14 is partial supersession, not wholesale:** PLATE explicitly *consumes* P23.13 drafting/icon/Plan-paper contracts unchanged and only supersedes their shell placement/dimension/type/material numbers (§0.5/§2.6–2.7 of the shell contract). So `p23-13-*` drafting semantics (snap grammar, attention, salience, door/window, state-controls) stay durable; their shell-chrome assertions move to PLATE.
9. **Known shape-pin warning already in-repo:** `apps/editor/tests/README.md` "Caveats" explicitly calls `p23-13-keyboard` a shape pin that "passed while the announcement missed required value+units". Verified: the file mixes pure traversal behavior (durable) with ~24 `toContain`/slice assertions over `LayoutPlanViewport.svelte` (brittle). Canonical REPLACE example.
10. **`contracts.test.ts` (2,734 LOC / 158 its / 25 describes / 812 `toContain` + 25 `toMatch`) is a living accumulator, not a frozen slice.** Git log shows continuous updates through the P23.14 shell feats. Per-describe triage (C.1.2): durable boundaries (relic isolation, route wiring, gizmo sweeps, pick metadata, camera-plan ownership) + behavioral core (boot/history/transactions, zero-node, 3 FSM fixtures, 3 selection its — NOT chrome, never delete) + chrome/pixel pins + 4 review-open flags (MODE pressed-fill, tray width, 12.5px, `border-radius:0`). Verdict: 7-way split per C.1.2 — only the G-group (7 deletes with named successors) is unblocked.
11. **Cheap-at-runtime ≠ cheap-to-own:** P23.13 family totals ~0.24s, P23.14 family ~0.12s, boundary/contract group ~0.27s over 12 files in run-1. Their burden is maintenance/fragility (they break on harmless refactors), not wall time. Lane-split alone does not fix them; they need mechanism replacement (source → behavior).
12. **LOC misleads:** largest file `layout-geometry-golden.test.ts` (13,212 LOC, 7 tests) runs in 0.063s; `editor-store-camera.test.ts` (4,049 LOC, 135 tests) runs in 0.385s. Conversely `normalize-asset` (113 LOC) costs 15.26s. Rank by (§D) burden × supersession × fragility × replaceability, never LOC alone.
13. **Heavy-loop/property/perf signals:** 47 files with big-number+loop patterns, 9 with `Math.random`/property-like use, 32 with timing/perf patterns, 1 spawner. Most heavy loops protect durable invariants (identity bijection, snap parity, motion sweeps) — change *where/how often* they run (`MOVE_HEAVY`), not whether the proof exists.
14. **Relic (`/museum/editor`) is thin but fully traced (C.1.4):** production is `<MuseumEditorEntry relic />` only → frozen pre-H1 `MuseumEditorApp`; coverage = mount (contracts source its) + frozen transport chrome + frozen behavior (Flip pose, Repeat scope, selection/preview, camera authoring, shortcuts, Paris placement/focus, registry-free, legacy Inspector, backslash-untouched) + isolation (no-Layout, no re-derive, relic store entry). No dedicated smoke exists — a 6-assertion smoke is specified (mount / frozen interactions / isolation / frozen transport / shared-store detector / shell-untouched) with per-assertion replace-mapping. Gaps: no DOM mount test, no shared-import drift guard, no-layout-history branch unpinned.
15. **No CI lane architecture today (verified):** root `test` → `test -w @portfolio/editor` → `vitest run` → all 303 files. No `.github/workflows/` in repo. Any lane model (`test:fast/arch/heavy/perf/full`) is greenfield proposal only (§F); path-based CI selection is unsafe for arch tests.

## B. Full inventory artifact

- **Machine-readable:** `test-suite-harvest-inventory-2026-09-19.csv` (this directory). Every test file appears exactly once. Columns: `path, loc, describes, its, tests_fn, tests_approx, subsystem, domain, slice, imports_source, reads_fs, walks_repo, spawns, large_loop, randomized, timing, kind_heuristic, run1_duration_s, vitest_tests`.
- **How it was generated:** mechanical scan (`inventory.py` logic preserved in `/tmp` during harvest; rerunnable) + run-1 JSON durations merged. `kind_heuristic` is a first-pass label only (`behavior` / `arch-boundary` / `arch-boundary (source-walk)` / `source-shape` / `source-read/other`) — manual triage in §C overrides it where evidence requires.
- **Counts (mechanical, from CSV):** `reads_fs` 77, `walks_repo` 96, `spawns` 1, `large_loop` 47, `randomized` 9, `timing` 32. Slice-named 115, non-slice 188. Strict-behavior-nonheavy (behavior + no fs/spawn/loop/timing) 102 files.
- **Subsystem spread (top):** `lib/layout/*` ~71 files (largest), `lib/editor/layout` 52, `lib/editor/app` 27, `lib/editor/store` 26, `lib/editor/camera` 15, `content` 11, plus museum/visitor/bench/project/render/state/e2e/vite long tail (see CSV).
- **Audit note:** `vitest_tests` (assertionResults per file) sums to exactly 4,510 and matches the runner; `tests_approx` (`it(`+`test(` regex) sums to 4,310 because `it.each`/`test.each` rows expand at runtime. Trust `vitest_tests`.

## C. Candidate disposition table

> Classifications are recommendations only. Confidence is stated per row. `KEEP_FAST` obvious cases (102 strict-behavior-nonheavy files + other cheap behavior) are **not** row-listed; they are defined as a class at C.0. Everything else gets a row (hand-triaged C.1 first, rule-based draft C.2 after).

### C.0 Obvious `KEEP_FAST` (class definition, no per-file rows)

A file is obvious `KEEP_FAST` iff **all** hold: `kind_heuristic=behavior`, no `fs` reads, no subprocess, no large-loop/random/timing flags, run-1 duration < 0.5s, not a slice-acceptance-only pin (imports `$lib` behavior and asserts runtime values, not source text). 102 files meet the strict mechanical gate; representative examples: `layout-geometry.test.ts`, `layout-wall-topology.test.ts`, `editor-selection.test.ts`, `history-controller.test.ts`, `mutation-guards.test.ts`, codec/schema round-trips, gizmo math, plan-render-model unit tests. Risk of keeping: negligible. Benefit of touching: none — do not churn these.

### C.1 Hand-triaged high-value dispositions (evidence-backed)

| path (short) | classification | conf | current invariant protected | why classification fits | overlapping/superseding test(s) | recommended future action | runtime/maint benefit | risk if changed |
|---|---|---|---|---|---|---|---|---|
| `lib/editor/app/contracts.test.ts` (2,734 LOC, 158 tests, 0.114s, **25 describes**) | `MERGE`+`REPLACE` (split per C.1.2 — 7-way split plan; deletes only via the G-group, all with named successors) | high | Visitor closure; single nav/motion owner (motion partial, nav missing — gaps); Layout/Scene split; relic mount; shell composition; Inspector/gizmo/selection/transaction boundaries | Living accumulator. Per-describe triage in C.1.2: durable boundaries (relic isolation, route wiring, gizmo sweeps, pick metadata, candidate neutrality, camera-plan ownership) + behavioral core (boot/history/transactions, zero-node, 3 FSM fixtures, 3 selection its — NOT chrome, never delete) + chrome/pixel pins (density, hex, 12.5px, import-line) + 4 review-open flags (see below) | P23.14 family; package boundary tests; `arrange-delete`, `snap-input-validation`, `project-session-isolation`, `unified-project-tree`, `interaction-fsm` (named successors per group) | 7-way split per C.1.2 (A visitor boundary / B single-owner arch / C Layout-Scene ownership / D shell-behavior presence / E behavioral core / F chrome-or-owner / G delete-with-successor) | Maint: very high. Runtime: ~0.1s | Medium — split must not lose visitor/single-owner/Layout-Scene/relic/FSM/selection assertions |
| `lib/editor/store/p12-s4-header-chrome.test.ts` (131 LOC, 5 tests) | `KEEP_BUT_RENAME` + `MERGE` (scrubber line only) + `KEEP_FAST`/`KEEP_ARCH`/`RELIC_ONLY` (see C.1.1) | high | Live transport ownership in fixed header; ruler-relic-only + scrub/View-Key in Dots; idle/Sequence lifecycle; relic surface; rig lifecycle guard | C1a mostly uncovered elsewhere (only scrubber-absence line merges to drawer §17 collapsed); C1b View-Key-×2/playhead/ticks uncovered; C2a behavioral; C2b relic; C2c rig boundary | `p23-14-camera-drawer` §17 collapsed (scrubber-absence line only — in-test comment already cites Decision 5) | Rename to live-transport ownership; merge scrubber line; split C1b ownership gates → control-ownership; keep View-Key/playhead as tripwire | Maint high; runtime ~0.01s | Medium — C1b/C2c are load-bearing tripwires |
| `lib/editor/store/p12-s3-one-shell-lanes.test.ts` (233 LOC, 9 tests) | `KEEP_FAST` (behavior) + `REPLACE_MECHANISM` (B1a source part) + `RELIC_ONLY` (B2b) | high | One Edge-lane set (inert, menu-owned); store→motion integration; Flip/repeat/discovery; Sequence scope machine | B1b/c, B2a, B3a–d behavioral and uncovered elsewhere; B1a source pins lane inertness/click-count/menu ownership (no P23.14 same-defect successor — drawer pins vocabulary, not inertness); B2b relic Flip freeze-pin | `p23-14-camera-drawer` (vocabulary only, NOT same-defect — do not merge) | Keep all behavioral describes; shrink B1a to inertness/ownership (vocab → drawer); keep B2b frozen | Maint high; runtime small | Low |
| `lib/editor/store/p11-s4-compact-controls.test.ts` (193 LOC, 14 tests) | `RELIC_ONLY` + `KEEP_ARCH` + `KEEP_FAST` (mixed; header claim "pins only relic" is half-true — see C.1.1) | high | Frozen relic segmented/icon-only chrome (relic-only); live Stop-absence + no-duplicate-Preview-Edge (live-absence boundaries); Flip/Repeat store semantics + hook matrices (live behavior) | A1a–c/A1e relic chrome; A1d/A2a/A5 live-absence pins; A2b/A3/A4 live store behavior. Only A3a has a same-defect successor (p12-s3 B2a) | Keep relic describes frozen; keep A1d/A2a/A5 as arch tripwires; keep A2b/A3b–c/A4 fast; DELETE only A3a (→ p12-s3 Flip) | Maint high (source pins); runtime small | Low — Flip/Repeat/hook-matrix behavior is load-bearing |
| `lib/editor/camera/p21.6-slice-b.test.ts` (197 LOC, 17 tests, 0 `$lib`) | `KEEP_ARCH` (lifecycle/ownership) + `MOVE_HEAVY` (visual pins) — NOT delete (see C.1.1) | high | Frustum/handles/nodes/anchors/keyframes/drag-basis/badge visuals; hidden-init + pose-cache + framing-owner + focus-reconcile lifecycle; arbitration/picking/realignment | D2c/d, D3a/d lifecycle + ownership pins are architecture boundaries (stale-focus crash guard, framing ownership, picking boundary) with no successor; D1/D3b/c/e/f visual pins uncovered by motion/boundary tests (motion pins sampling, not drag basis/arbitration/pick order) | `museum/camera-core-boundary` (import hygiene only, NOT same-defect); `camera-motion` (sampling only) | Keep D2c/d, D3a/d as arch; move D1/D3b/c/e/f visual-string pins to heavy (or keep as cheap tripwires — owner call) | Maint high; runtime small | Medium — drag-basis/arbitration/picking have no other proof |
| `lib/editor/p21.6-slice-c.test.ts` (326 LOC, 19 tests) | `KEEP_FAST` (E1/E2/E3a/E4) + `RELIC_ONLY` (E3b) + `KEEP_ARCH` (E5a/b/d) + `MERGE` (E5c ownership lines only) | high | Focus-mode state; drag-deferral machine; focus shortcut; observer framing aspect; collapse/inert/hint/scrub wiring | E1/E2/E4 core canvas-safety behavior with no successor; E5c toggle-ownership lines already cite P23.14 §14 (merge 3 `not.toContain` lines → control-ownership); E5b `inert` ≠ a11y-motion focus-ring (different defect, do not merge) | `p23-14-control-ownership` §14 (E5c toggles only) | Keep E1/E2/E3a/E4 fast; keep E3b frozen; keep E5a/b/d as arch; merge E5c ownership lines | Maint medium-high | Medium — focus/drag machine is load-bearing |
| `lib/editor/store/p23-f0-stage1-format-policy.test.ts` (482 LOC, 18 tests) | `KEEP_ARCH` | high | Dual-dispatch format guard: every mutator classified; direct writes excepted; facade consults policy | Intentionally mechanical source scan + behavioral guard contract. Post-F0 architecture still current (Layout/Scene split, transaction rollback, no mixed-schema history) | `mutation-guards`, `document-store`, F0 stage 2–5 writer/visitor tests | Keep as arch gate; do not weaken. Lane: `test:arch` (pre-PR + CI), not inner-loop-optional | Runtime ~0.03s; value is gate, not speed | High if weakened — this is the transaction-guard proof |
| `lib/layout/p23-13-keyboard.test.ts` (300 LOC, 21 tests) | `REPLACE` (partial already-behavior) | high | Traversal order/wrap/absence; keyboard-only announcements; viewport wiring | Pure traversal part durable + already behavioral; ~24 viewport `toContain`/slice pins brittle (README caveat: passed while announcement missed value+units) | `plan-keyboard-traversal` unit part (keep); needs live wiring successor | Keep pure describes as-is; replace viewport slice with adapter/DOM/composed-string test | Maint high; runtime small | Low for pure part; medium for wiring until live test exists |
| `lib/layout/p23-13-empty.test.ts` (94 LOC, 7 tests) | `REPLACE_MECHANISM` (copy/ghost/lifecycle) + `KEEP_ARCH` (latch-at-root it) | high | Empty/sparse copy; open-corner ghost; illustrative-only; startup-only dismiss incl. undo semantics; latch-above-mount composition | Zero behavior imports; ghost/card pins duplicate `contracts.test.ts:705–731` (merge to one owner); latch-at-root composition is R4-family one-owner (keep as arch). No live successor verified (`planHintDismissed` only in pin suites) | `contracts.test.ts` ghost pins (same-mechanism dup — merge, not successor) | E1 render ghost/card when browser infra lands; E2 session-latch store test (dismiss on transient, no restore on undo, no resurrect on remount); keep latch-at-root it | Maint medium; runtime tiny | Medium — undo/dismiss lifecycle subtle; new tests required first |
| `lib/layout/p23-13-icons.test.ts` (108 LOC, 5 tests) | `KEEP_ARCH` (keep-list/paths/family) + `REPLACE_MECHANISM` (label/size pins) + `MERGE` (editor-only → boundary) | high | Owner-ratified keep-list (5 lucide, byte-identical) vs Designer-D family paths; generic-UI family boundary; visible labels; editor-only component | Keep-list + verbatim paths ARE the contract (PLATE §2.7; DOM render would assert identical strings anyway). `size={14}`/`</button>` order → I1 render test (blocked on browser infra). Editor-only → `visitor-import-boundary:86` demonstrated successor | `museum/visitor-import-boundary.test.ts:86` (editor-only successor) | Keep keep-list/path/family pins; I1 toolbar-label render test; merge editor-only to boundary | Maint medium | Low |
| `lib/layout/p23-13-surrounds.test.ts` (73 LOC, 3 tests) | Split per it: `MERGE` (registry → theme.test.ts) + `KEEP_ARCH` (paper invariance) + `MERGE` (Scene-ink → A6 owner) | high | 7-theme registry/block presence; paper+selection token invariance; Scene-ink theme-independence | Registry/default covered by `theme.test.ts` (8-id superset incl. all 7 + plate-light) — merge; six-block-presence has NO successor (fold-or-keep owner call); paper invariance still normative (PLATE §4.2, now 8 blocks); Scene-ink is 3rd copy (keep A6 owner in object-scene-paint) | `lib/editor/theme.test.ts` (registry/default successor); A6 paint owner | Merge registry + Scene-ink; keep paper-invariance as arch | Maint medium; runtime tiny | Low |
| `lib/layout/p23-13-presentation-foundation.test.ts` (221 LOC, 8 tests) | `KEEP_FAST` (behavior part) + `MERGE` (paint pins) | medium | Band/ink split; renderer-neutral facts; adapter paint contract | Mixed: real geometry/render-model behavior + ~20 PlanSvg/CSS pins. S0 foundation still current | `plan-render-model`, `p23-13-door-window`/`salience`/`attention` (paint siblings) | Keep geometry describes; consolidate paint pins with S1/S2/S8 paint tests | Maint medium | Low |
| P23.14 family (9 files, ~0.12s total): `a11y-motion`, `camera-drawer`, `contrast-floor`, `control-ownership`, `inspector-junction-dissolve`, `inspector-target`, `state-language`, `type-roles` (+ `p23-14-room-rotation-arm` behavioral) | `MERGE` (mechanism) — durable contracts, brittle pins; `NEEDS_OWNER_DECISION` on tray-width change (contrast-floor pins review-open rail width as baseline tripwire) | high | PLATE shell: keyboard/motion/density, drawer lanes+frustum, contrast floor, one-owner, property-first Inspector+deferred destructives, workspace-scoped target, state language, type roles | Newer durable contracts superseding P11/P12/P21/P23.13 shell-shape assertions **in intent** — but 8 of 9 assert via `fs` source reads (`toContain` 10–69 per file). Verified non-equivalences: drawer lane-vocabulary ≠ B1a inertness/click-ownership; drawer frustum-presence ≠ slice-b diamond/color pins; a11y focus-ring ≠ slice-c `inert` pins (see C.1.1). `room-rotation-arm` pure behavior, no fs reads | Old P11/P12/P21/P23.13 shell pins (superseded in intent only); `contracts.test.ts` chrome (duplicate) | Keep invariants; migrate assertions to rendered/DOM/store behavior over T3; keep thin arch subset (ownership/exposure gates); flag tray-width pin on any rail-width owner decision | Maint high (they *are* the new fragility surface); runtime negligible | Medium-high — PLATE review still open; do not freeze brittle pins as eternal truth before owner closeout |
| `lib/content/normalize-asset.test.ts` (113 LOC, 6 tests, 15.26s) | `MOVE_HEAVY` | high | Asset normalization job (P24A.1 spike R1); gated on tool availability | Sole subprocess spawner (`execFileSync`/`execSync`, temp dirs, 120–240s timeouts). Invariant may be durable; mechanism is environment-dependent + dominant runtime cost | None (unique) | Move to `test:heavy` (relevant-paths + nightly/CI), keep a fast availability-gated smoke if needed | Runtime **very high** (~29% of suite) | Medium — ensure heavy gate still runs before publish/asset changes |
| `lib/museum/navigation/camera-motion.test.ts` (3,540 LOC, 117 tests, 6.23s) | `MOVE_HEAVY` (split sweeps) | high | Single camera-motion system: easing/sweeps, 1,001-sample dense checks, detour/loop semantics | 54 `for` loops, `Array.from`, 25 `toBeLessThan`. Protects the one-motion-system contract — must not lose proof. Cost is loop density, not fragility | `camera-route`, `editor-directed-edge-motion`, `cardinal-snap-motion` (adjacent, cheap) | Keep a fast representative subset in `test:fast`; move 1,001-sweeps + timing asserts to `test:heavy`/`test:perf` | Runtime high (2nd largest) | Low if split keeps representatives fast; high if sweeps deleted outright |
| `lib/bench/p2311-bend-perf-pass.test.ts` (661 LOC, 10 tests, 5.06s) | `MOVE_HEAVY` → `test:perf` | high | Bend perf regressions (frozen-baseline meshes/pick index, quadratic drag) | Explicit perf gate (`performance.now`, budgets). Valuable proof, wrong lane — every-run timing asserts are flaky + slow | `p23-11-bend-command` (functional Bend), `p23-11-fix-pass` | Move to `test:perf`; keep functional Bend coverage fast | Runtime high; flakiness medium | Low — functional proof stays fast |
| `lib/layout/p23-6e-extra-angled-plan-integrity.test.ts` (407 LOC, 12 tests, 4.71s) | `MOVE_HEAVY` or split | medium | Oblique-wall integrity (fusion/sliver fixes surfaced by Navigator smoke) | Dense angled plans; costly geometry. Durable topology correctness, not slice acceptance | `layout-geometry`, `wall-first-codec`, `shared-walls` | Profile before moving: if cost is fixture scale, tier it (small fast + dense heavy) | Runtime high | Medium — topology regressions are silent; keep dense case somewhere |
| `lib/layout/__fixtures__/layout-scale-fixtures.test.ts` (78 LOC, 5 tests, 3.77s) | `MOVE_HEAVY` | medium | Scale-fixture validity (30k/60k tiers compile+validate) | Fixture self-test at scale tiers. Useful, not inner-loop | `bench/*`, `plan-bench` consumers | Move to heavy/perf; fast loop uses smallest tier only | Runtime high | Low |
| `lib/editor/layout/layout-preview-state.test.ts` (534 LOC, 27 tests, 2.43s) | `KEEP_FAST` (investigate first) | low | Preview snapshot/commit lifecycle | No heavy flags; cost unexplained (possibly fixture build per test). Do not move blindly — profile | `p23-11-transient-direct-preview`, `p23-12-lifecycle-semantics` | Profile; likely fix setup cost rather than lane-split | Runtime medium-high | Medium — preview lifecycle is core; avoid lane-hiding a slow-setup smell |
| `lib/layout/wall-mesh-builder.test.ts` (755 LOC, 29 tests, 2.20s) | `KEEP_FAST` + `MOVE_HEAVY` split | medium | 3D wall meshes (winding/normals, pick ranges) + shell-boundary read | 40 `for` loops + 1 `fs` read (boundary part). Mesh correctness durable (wall-first geometry contract) | `wall-mesh-shell-boundary`, `layout-geometry*` | Keep boundary + representative mesh tests fast; move exhaustive winding sweeps to heavy | Runtime medium-high | Low |
| `lib/layout/p23-12-identity.test.ts` (466 LOC, 18 tests, 0.26s) | `MOVE_HEAVY` (subset) | medium | Reference identity bijection (6-char family-prefixed, unique, never reassigned) | Multiple ~200k-iteration loops + 1M-scale numbers. Cheap wall time (0.26s!) — burden is *agent-time/energy*, not suite seconds. Proof of bijection durable | `p23-12-transient-allocation`, `p23-12-plan-identity`, `p23-9-junction-identity` | Keep property statements; move 200k× loops to heavy/property gate with smaller fast representatives | Runtime low, maintenance/attention medium | Low |
| `lib/layout/p23-2-snap-extent-parity.test.ts` (792 LOC, 44 tests, 0.27s) | `MOVE_HEAVY` (randomized/iterative subset) | medium | Snap-winner/extent parity over 1,000+ spans + randomized cases | 19 `for` loops, `Math.random`, 3 timing asserts. Durable snap correctness; randomized + iterative cases belong in property gate | `p23-2-snap`, `p23-2-align`, `p23-13-snap-grammar` | Keep deterministic parity fast; move randomized/iterative + timing to heavy | Runtime low, flakiness medium | Low |
| `lib/bench/bench-report.test.ts` (67 LOC, 0.61s) + `browser-bench.test.ts` (83 LOC, 0.52s) + `three-stats.test.ts` + `plan-bench.test.ts` | `MOVE_HEAVY` / `test:perf` | high | Perf budgets/baselines/tiers | Timing/budget asserts; `plan-bench` already has 1 skipped full-tier test (correct precedent) | `bench-boundary` (arch, keep fast) | Move measurement tests to perf lane; keep `bench-boundary` + types fast | Runtime medium (1.1s combined) + flakiness | Low |
| `lib/editor/editor-store-camera.test.ts` (4,049 LOC, 135 tests, 0.385s) | `KEEP_FAST` | medium | Camera store: selection/history/preview/transport (incl. relic branches) | Huge but fast and behavioral. Size is a readability debt, not a lane problem | P11/P12/P21 timeline pins (older, thinner) | Keep; consider file split by concern in T5 (no behavior change) | Runtime low; maintenance medium (size) | Medium — do not split blindly; relic branches live here |
| `lib/layout/layout-geometry-golden.test.ts` (13,212 LOC, 7 tests, 0.063s) | `KEEP_FAST` | medium | Golden geometry regression | Biggest file, negligible runtime. Data, not logic — leave alone | `layout-geometry`, `layout-geometry-parity` | Keep; never rank by LOC (this file is the counterexample) | None | None |
| `lib/editor/app/p23-6e-hierarchy-projection.test.ts` (2,241 LOC, 109 tests, 0.046s) | `MERGE` (long-term) | low | Navigator projection (index/keys/pages/search) + source wiring | Largest slice-acceptance file; cheap to run. Overlaps `p23-12-navigator-identity`, `p23-6b-hierarchy-inspector`, `unified-project-tree` | Same cluster | Keep fast for now; T3 consolidation candidate (projection vs identity vs inspector ownership) | Maint medium | Medium — Navigator identity is user-visible; map before merging |
| `lib/layout/p23-11-fix-pass.test.ts` (1,204 LOC, 38 tests, 0.145s) | `KEEP_FAST` (with `MERGE` note) | low | Bend fix-1/fix-2: knot preservation, authored Wall-distance metric | Slice-named but durable topology; cheap. May duplicate `bend-command`/`curve-planners` at different layer (planner vs history vs metric) | `p23-11-bend-command`, `p23-11-curve-planners` | Keep; document layer difference (planner contract vs integration vs metric) before any merge | Low | Medium — each layer catches different failure (see §E/F) |
| `lib/editor/layout/p23-2-interior-anchor-release.test.ts` (854 LOC, 26 tests, 0.63s) | `KEEP_ARCH` (semantics) + `REPLACE` (wiring pins) | medium | Interior-anchor release: authored anchors interior-only; node-view endpoints runtime-generated, never persisted | Directly protects the Scene SoT contract (authored interior-only anchors). Viewport pointer-lifecycle wiring pins are brittle | `plan-render-boundary`, `p23-2-snap*` | Keep release-semantics describes as arch; replace viewport-wiring slices with adapter behavior | Maint medium | High if semantics lost — this is a protected contract |
| `lib/layout/plan-render-boundary.test.ts`, `layout-geometry-boundary.test.ts`, `museum/camera-core-boundary.test.ts`, `museum/visitor-import-boundary.test.ts`, `museum/layout/wall-mesh-shell-boundary.test.ts`, `project-model-boundary.test.ts`, `bench/bench-boundary.test.ts` | `KEEP_ARCH` | high | One nav/motion owner; Layout/Scene ownership; visitor isolation; package/direction boundaries | Legitimate durable boundaries (import/direction/single-owner). Cheap (all < 0.1s in run-1) | `contracts.test.ts` boundary subset (overlap is intentional defense-in-depth) | Keep in `test:arch`; run pre-PR + CI always | Negligible runtime; high protection value | High if removed |
| `lib/visitor/p22-1-cold-runtime.test.ts`, `p22-3-public-route.test.ts`, `p23-12-visitor-identity-isolation.test.ts`, `preview-surface-boundary.test.ts`, `visitor-runtime-state.test.ts` | `KEEP_ARCH` | high | Cold release bootstrap; public closure (no editor code); visitor identity isolation | Visitor/editor isolation contract. Cheap (~0.08s combined) | `contracts.test.ts` visitor subset | Keep all; add path-trigger so asset/publish changes always run them | Negligible runtime | High if removed |
| `lib/editor/app/room-focus.test.ts`, `lib/editor/layout/plan-timing-pill.test.ts`, `lib/editor/theme.test.ts`, `theme-registry.test.ts`, `styles/scene-palette.test.ts`, `p20-s2-spatial-registry.test.ts`, `p20-s4-load-resolution.test.ts`, `preview/project-flows.test.ts`, `p23-6h-height-parity.test.ts`, `p23-3-opening-authoring-reachability.test.ts`, `p23-10-add-junction.test.ts`, `p23-10-wall-edit-gesture.test.ts`, `p23-11-bend-command.test.ts`, `p23-12-plan-identity.test.ts`, `p23-12-transient-allocation.test.ts`, plus P23.13 behavioral describes per C.1.3 (attention geometry/suppression/ink-adapter, door/window grammar, keyboard groups/stepping/entry/composed-announcements, foundation source-facts, refusal lifecycle/paint, room-labels placer/tiers/dedup, salience regime/fallback/strokes/aids, snap-grammar glyph/winner/placement, state-controls acquisition/authority/marks/focus, thin-wall pipeline) | `KEEP_FAST` (behavioral describes) — P23.13 deep triage in C.1.3 keeps ~90 pure its fast | high (reviewed) | Various durable behaviors (focus, contrast, registry, reachability, gestures, identity, drafting paint/grammar) | Deep-reviewed: P23.13 files are majority-pure (only paint/wiring pins need replacement: A1–A10/K1–K3/E1–E2/R1–R4/S1/I1, all "new test required first" — node env has no PlanSvg render harness). Source-wiring describes listed in C.1.3 with exact line refs | Successors mostly do not exist yet (verified gaps C.1.3) | No immediate action; T2/T3 handles wiring pins per the C.1.3 replacement sketches | Low per file; medium in aggregate | Low — always name the behavioral successor first (C.1.3 does) |

### C.1.1 Cluster 1 deep review — shell/timeline chain (per-describe, 2026-09-19 pass)

Every `it` in the 5 historical files was read against production. Key correction to the first harvest: **`p11-s4` is not obsolete main-editor chrome — its header ("pins only retained relic behavior") is half-true.** A1a–c/A1e are relic chrome, but A1d/A2a/A5 are live-absence boundaries and A2b/A3/A4 are live store behavior. Only **one** `it` (A3a) earns `DELETE_CANDIDATE`. P23.14 asserts on the *same* Svelte files (Frame/Dots/Panel/Ruler) with **no direct contradictions** (verified: 2× each of 5 ratified lane labels coexists with 2× `+ View Key`; in-test comments already reconcile the eras).

**p11-s4-compact-controls** — A1a segmented `aria-pressed` / A1b icon-only names / A1c Follow-Observer-gating / A1e dense-row+44rem → `RELIC_ONLY` (high). A1d (live Ruler/Frame must NOT regain Repeat/Reverse) / A2a (no visible Stop in 3 sources) / A5 (Preview Edge affordance only in Inspector) → `KEEP_ARCH` (high; live-absence tripwires). A2b stop-teardown via store / A3b Flip refusal states / A3c hook enable-matrix / A4a–c Repeat edge-only+history-clean+hook → `KEEP_FAST` (high; no P23.14 successor — Flip/Repeat/scope machine has zero P23.14 coverage). A3a (Flip resets playhead to 0) → `DELETE_CANDIDATE`, successor p12-s3 B2a which asserts strictly more (mode/transport/runId/repeat/discovery).

**p12-s3-one-shell-lanes** — B1b (store→motion easing integration) / B1c (Edge valid without global flow) / B2a (Flip preserves repeat+discovery) / B3a–d (Sequence scope machine) → `KEEP_FAST` (high). B2b (relic Flip pose preservation at 5 playheads) → `RELIC_ONLY` (high; the relic Flip freeze-pin). B1a (shared panel, Edge-local inert 5-lane projection, onclick-count-1, pill-menu ownership) → `REPLACE_MECHANISM` (high): drawer pins lane *vocabulary*, not inertness/click-count/menu ownership — same feature, NOT same defect, do not merge.

**p12-s4-header-chrome** — C2a (idle/mode lifecycle) → `KEEP_FAST` (high, behavioral). C2b (relic surface) → `RELIC_ONLY`. C2c (rig teardown guard: `isRelic || currentWorkspace !== 'camera'` + `stopCameraPreview()`) → `KEEP_ARCH` (med). C1a (live header transport/POV/Observer/timecode, no tour-selector/scrubber/Repeat) → `KEEP_BUT_RENAME` to "live transport ownership" (high); only its scrubber-absence line merges to `p23-14-camera-drawer` §17-collapsed (in-test comment cites P23.14 Decision 5). C1b (ruler-relic-only, View-Key-×2, playhead-overlay, tick math, Home/End) → `REPLACE_MECHANISM` (high): ownership gates → control-ownership; View-Key-×2/playhead/ticks have no successor — load-bearing tripwire until one exists.

**p21.6-slice-b** — D2c (paused-preview owner in both frustum owners) / D2d (`reconcileCameraFocus` on doc swap) / D3a (framing gates: none/playhead/selection, eligibility) / D3d (hidden helpers excluded from picking) → `KEEP_ARCH` (med-high; stale-focus crash guard, framing ownership, picking boundary — no successor). D2a (init-hidden) / D2b (pose cache) → `KEEP_ARCH` (med). D1a–g, D3b/c/e/f (frustum opacity, FOV handles, badge grammar, anchors, keyframe glyphs, drag-basis, arbitration order, realignment, path toneMapped) → `MOVE_HEAVY` (visual-string pins; D1f drag-basis borderline `KEEP_ARCH`). NOT delete: motion tests pin sampling, not drag basis/arbitration/pick order; boundary pins hygiene, not values.

**p21.6-slice-c** — E1 (focus state, 4 its) / E2 (drag-deferral machine, 8 its) / E3a (backslash shortcut) / E4 (observer framing aspect math) → `KEEP_FAST` (high; core canvas-safety, no successor). E3b (relic untouched) → `RELIC_ONLY`. E5a (grid collapse keeps canvas mounted) / E5b (`inert={collapsed}` + focus refs) / E5d (scrub resync + `useTask(updateResolution)`) → `KEEP_ARCH` (med; E5b ≠ a11y-motion focus-ring — different defect). E5c: 3 toggle-ownership `not.toContain` lines → `MERGE` to `p23-14-control-ownership` §14 (in-test comments already cite it); hint-placement pins stay.

**Demonstrated same-defect merges (only 3):** A3a→B2a; C1a-scrubber-line→drawer-§17-collapsed; E5c-toggles→control-ownership-§14. **Verified non-equivalences (do NOT merge):** B1a View-Key/onclick vs drawer vocabulary; C1b View-Key-×2/playhead/ticks vs drawer lanes; slice-b frustum-in-ViewHelpers vs drawer no-frustum-on-Plan (complementary sides); E5b `inert` vs a11y focus-ring; A2a Stop-absence vs drawer mode-ownership; B1b store→motion integration vs motion unit tests. **Review-open:** none of the 5 historical files asserts F4/tray-width/pressed-fill; `contrast-floor` tray-width pin (`--editor-tray-width: calc(44px …)`) is a legitimate baseline tripwire flagged `NEEDS_OWNER_DECISION` on any rail-width decision.

### C.1.2 Cluster 2 deep review — `contracts.test.ts` (25 describes; `relic isolation` at L229 is grep-invisible)

`B` = behavioral store/DOM, `S` = source-text. History/selection/transaction describes are NOT chrome — never delete.

| # | Describe | Invariant | Mech | A/B/C* | Best future home | Disposition |
|---|---|---|---|---|---|---|
| 1 | `empty project contract` | Blank codec-valid + byte-stable; populated scene needs rooms | B | B | project-codec | MERGE (high) |
| 2 | `pinned types` | `EditorViewMode` = `plan \| 3d` | type+B | B | view-state test | MERGE (high) |
| 3 | `P3 structural visual contracts` | 5 shared lanes ×2 scopes; heights; Plan primitives; paper split; footprint tokens | S | A(partial)/C | split: timeline→shell-behavior; ink→plan-render-boundary | MERGE split; numeric/absence pins REPLACE (med) |
| 4 | `zero-node policy + room-resolver seam` | No nodes → null initial; zero-node boots Chopin-free | B | A+B | nav store tests | MERGE (high); never delete |
| 5 | `relic isolation` | Relic rejects `setWorkspace('layout')` | B | **A** | visitor-editor-boundary | KEEP_ARCH (high) |
| 6 | `boot into an empty project` | Blank boot; tour-preview lock; reset restores doc + clears history; B0 flow | B | B | store tests | KEEP_FAST (high) |
| 7 | `Plan ↔ 3D switch preserves session state` | it1 workspace preserves doc/history/dirty/selection (B); it2 ceiling explicit-context + relic mount (S) | B+S | A(it2)/B(it1) | split: it1 store; it2 boundary | MERGE split (high) |
| 8 | `route wiring (relic smoke proxy)` | Relic route = virtual entry only; keyed session + abort teardown; Row Spatial-only; plugin → MuseumEditorApp | S+live call | **A** | boundary/relic-smoke; teardown it → `project-session-isolation` | KEEP_ARCH relic/route; teardown REPLACE (med-high) |
| 9 | `P21.1 shared shell` | Spine/View-Bar/Tray/MODE/timeline/menu/theme/ramp/snap/save-pill | S | **A**/C | split: ownership→arch; MODE/tray→shell-behavior; snap it → `snap-input-validation` | MERGE; pressed-fill + tray-width NEEDS_OWNER_DECISION |
| 10 | `P21.2 scene reconciliation` | Tool set; Arrange-Delete single-entry; read-only gate; ghost; primer; status | S | A(partial)/C | Delete it → `arrange-delete.test.ts` (DELETE w/ successor); `border-radius:0` NEEDS_OWNER_DECISION | REPLACE; Delete-it DELETE (high) |
| 11 | `P21.3 camera reconciliation` | Ribbon orders; drawer-owns-Observer/POV (F5); no FOV in Plan; shared sidebar/timeline; density numbers | S | **A**/C | F5/shared-owner → KEEP_ARCH; density → OWNER; XZ-regression → fast | mixed KEEP_ARCH + NEEDS_OWNER_DECISION (med-high) |
| 12 | `P21.5 Slice 3 inspector density` | 28px fields; legend folded; panels removed; Place gate; session controls in View menu | S | **A**/C | panel-removal+routing → single-owner/Inspector (R4) | MERGE split (med-high) |
| 13 | `P21.5 Slice 4 inspector typography` | Token tiers; 11px headers; 12px/12.5px; 7-theme hexes | S | C | type-roles + theme tests; **12.5px off R3 ladder → NEEDS_OWNER_DECISION** | REPLACE hex sweep (med) |
| 14 | `P21.5 Slice 5 timeline density` | 48px pill/36px header; no-coral; no collapsed scrubber; ruler/playhead; keyboard parity | S | weak-A/C | live-chrome → p12-s4 (in-file cited owner); parity → a11y-motion | DELETE live-chrome w/ p12-s4 named (med-high) |
| 15 | `unified hierarchy contracts` | Sidebar/tree editor-only; flow-panel counts; 4-section sidebar; mount/hide; neighbor ownership; legacy roots empty | S | **A** | split: relic→boundary; Navigator/roots→arch; terminology/counts → tree-test successors | MERGE split (med-high) |
| 16 | `layout 3D pick metadata` | Renderer-free builder; highlight shell; pick gates; cache | S | **A** | boundary tests | MERGE (high) |
| 17 | `centralized 3D layout selection` | `onLayoutPick` optional + relic-absent; visitor gate; S6 exports | S | **A** | selection/boundary tests | MERGE (high) |
| 18 | `single gizmo host` | Sole constructor; composer; precedence; adapter-only mutations; TransformControls-free motion; FSM ACTIVE_TARGET_CHANGE + ESC; **3 behavioral FSM fixtures** | B+S | **A**+B | FSM fixtures → `interaction-fsm` KEEP_FAST; sweeps → gizmo/boundary; harness-content it → DELETE (successor is the harness itself) | MERGE split (high) |
| 19 | `layout candidate session` | Renderer-neutral layout; descriptor-gated adapter; candidate shape + no-throw | S | **A** | gizmo/layout adapter unit tests (successors exist) | REPLACE_MECHANISM (high) |
| 20 | `camera context contracts` | Context seam + relic fallback; View-menu split; docked timeline; tour-selector relic-only; instant switches; labels; G3 map; keep-mounted plans; status; Scene sidebar; inspector domain-driven; Plan mutation-free; toolbar; Aim; loop/detour; orientation Scene-only; fades-gone; Rooms actions; visibility facade | S | **A**/C | 4-way split: boundary (seam/fallback/predicates/tour-selector/Plan-free) / single-owner arch (motion wiring, G3, inspector) / shell-behavior (toolbar, menus, status, sidebar, cells) / chrome-or-owner (icons, fades, density) | MERGE split (med) |
| 21 | `cross-domain selection contracts` | Arrange eligibility; Plan-scoped transform; Scene seam; no-clear rerun; activate-on-actionable (B); domain preserved (B); import clears (B) | B+S | A+B | 3 behavioral its KEEP_FAST (never delete); S its → selection tests | MERGE (high) |
| 22 | `asset library selection contracts` | Explicit-click deselect; relic has no wiring | S | **A** (relic) | visitor-editor-boundary | MERGE (high) |
| 23 | `P1.5 Camera Plan source contracts` | Live workspace + `$state`; mutation-free sweep; /museum camera-plan-free; anchor routing; Inspector Plan routing | S | **A** | boundary + camera-plan tests; museum-free it stays KEEP_ARCH content | MERGE (high) |
| 24 | `P3B.5 preview affordance source contracts` | Pending-nav blocks preview; icon/count pins; AT group | S | weak-A/C | drawer/preview tests (import-line + ×4 counts REPLACE) | REPLACE_MECHANISM (med) |
| 25 | `P19 project persistence coordinator` | Pre-save recheck order; first-save identity + baselines; normalize-before-install; stale-list guards; no disabled chrome; relic controller-free | S (slice/order) | A(relic)/B-adjacent | persistence tests (ordering → behavioral doubles); relic it → boundary | REPLACE ordering; relic MERGE (med-high) |

\* A = architecture boundary, B = behavioral contract, C = historical chrome. **7-way split plan (loses no boundary):** A. visitor-editor-boundary (#5, #7-it2, #8 relic/route, #15-relic, #20 seam/fallback/predicates/tour-selector/Plan-free, #22, #23 museum-free, #25 relic, #17 relic-absent). B. single-owner arch (#9 axis/tray, #11 F5+shared, #12 removal+routing, #15 Navigator/roots, #18 sweeps, #20 motion/G3/inspector). C. Layout/Scene ownership (#1→codec, #15 roots, #16, #19, #23 mutation-free). D. shell-behavior presence-not-pixels (#3 lanes/panel/ghost, #9 tray/MODE/menu/save-pill, #10 primer/ghost/status-role, #11 ribbon roles, #20 toolbar/menus/status/sidebar/cells). E. behavioral core KEEP_FAST (#4, #6, #7-it1, #18 FSM fixtures, #21 B-its). F. chrome-or-owner (#9 pressed/tray, #10 hex/copy/`border-radius:0`, #11 density, #12 px/tones, #13 12.5px/hex, #14 geometry, #15 terminology/counts, #20 icons/fades, #24 import/icons). G. DELETE with named successors: #10 Delete-it→`arrange-delete`, #9 snap-it→`snap-input-validation`, #8 teardown-it→`project-session-isolation`, #13 type→`type-roles`, #14 live-chrome→p12-s4 (parity→a11y-motion), #15 terminology→`unified-project-tree`+6e, #18 harness-it→`editor-gizmo-host` itself. **Gaps found in-file:** no one-nav-graph/evaluator pin (motion-side only); no positive Layout-v5/Scene-v1 pin (only legacy empty-roots); no single import-direction sweep editor→museum; F4/TD-2 correctly unpinned (not a gap to fill).

### C.1.3 Cluster 3 deep review — P23.13 source-shape tests (per-describe)

Rule applied: pure geometry/policy/adapter its stay `KEEP_FAST`; token/direction negatives stay `KEEP_ARCH`; source wiring with behavioral intent → `REPLACE_MECHANISM` with a concrete sketch (all blocked on the same infra fact: node env, no PlanSvg render harness — **new tests required first, nothing deletable yet**); exact old-markup → `DELETE_CANDIDATE` only with successor (almost none qualify).

**attention** — geometry (pad-64/cap-180/settle-150ms/tier-ceiling), placer suppression, region ink adapter → KEEP_FAST (high). Paint contract (token→class, CSS fill, drafts polygon, sceneInkFor precedence) + wiring (re-stamp/restore, ceiling, snapshot wrap) → REPLACE_MECHANISM A1–A4 (high): test `tokenClass` mapping directly; render class→paint; feed closure-wash polygon + footprint; interaction-state test (arm locus → clock past `PLAN_ATTENTION_RESTORE_MS` → null + ceiling at label input + wrapped presentation at PlanSvg input).
**door-window** — band/door-cue/window pure grammar (11 its) → KEEP_FAST (high). Wall-outside-room punch → REPLACE_MECHANISM A5 (render room-less wall, assert void + silhouette). Cue-presentation-only: model-exclusion pure → KEEP_FAST; hit/snap exclusion negatives → KEEP_ARCH (high; `contracts:172–186` leaf/swing/threshold negatives are same-mechanism dups — keep this owner).
**empty** — see corrected C.1 row (E1 render + E2 latch + latch-at-root KEEP_ARCH).
**icons** — see corrected C.1 row (keep-list/paths/family KEEP_ARCH; labels I1; editor-only MERGE to boundary:86).
**keyboard** — groups/stepping/entry/composed-announcement pure (11 its incl. the README-prescribed value+units strings) → KEEP_FAST (high). `PLAN_CONTROL_MARKS` shape pin → KEEP_ARCH with disclaimer (med). 8 wiring its (arrows/Enter/numeric/pointer/Escape/release/no-write/announce-count incl. brittle `toBe(6)`) → REPLACE_MECHANISM K1–K3 (high, highest priority): drive `planTraversalStep` + `planKeyboardControlReadout` over document facts asserting composed role+position+owner+value+units; pointer-silent vs keyboard-once via derivation inputs; direct `planKeyboardControlReadout` tests (junction/edge/slide/null — **zero callers in tests today**, verified gap).
**object-scene-paint** — footprint/LayoutObject verbatim + no-hit pure → KEEP_FAST. Resting/state/opacity/1px-floor CSS pins → REPLACE_MECHANISM A6 (render resting/active/hover/selected + multi-zoom objects; absorbs salience + surrounds dups — A6 is the single owner). Camera-vs-Layout hook separation negative → KEEP_ARCH (med-high).
**presentation-foundation** — opening source-facts pure (4 its) → KEEP_FAST. Band-width positives + window call-through → REPLACE_MECHANISM A7 (render wall/window at scales). Clamp/ink-merge/`0.28`/door-retire negatives + role-token values → KEEP_ARCH (high; retire-dups merge to door-window owner).
**refusal** — lifecycle + paint pure (7 its) → KEEP_FAST. Lifetime wiring (arm/expiry/clear/compose) → REPLACE_MECHANISM F1 (drive reject/opening-drag → annotation-over-proposal; clock → expired; press/Escape → cleared; verified no live successor).
**room-labels** — area/format, candidates, tiers/dedup, long-names/readout, stickiness/settle, fallback-metrics (~22 its) → KEEP_FAST (high). Readout 12/280 constants → KEEP_FAST; `.plan-readout` CSS literals + no-input slice → REPLACE_MECHANISM R1 (browser test; never-editable half NEEDS_OWNER_DECISION on home). No-transition CSS pins → KEEP_ARCH (node-env absence-only, med-high). Viewport wiring (geometry-key regex, gesture sessions, `loadingdone`, identity-pair pins) → REPLACE_MECHANISM R2–R4 (extract reason/predicate/derivation to unit-testable fns).
**salience** — regime/door/window/aids/grid pure (~13 its) → KEEP_FAST (high). Passive-ink line pins → REPLACE_MECHANISM (A6 owner). Freeze-release count-equality pin → REPLACE_MECHANISM S1 (interaction-state: every baseline-clear clears `salienceFreeze`). Paper tokens + persist-nothing + non-import direction → KEEP_ARCH (high; Plan Paper durable per PLATE §4.2).
**snap-grammar** — glyph map/winner/value/placement pure (~21 its; 10px overlay type consistent with PLATE `-xs`, no action) → KEEP_FAST (high). Glyph-ink table pure → KEEP_FAST (owns open-path-as-hole fix). Paint literals + `snapGlyphPath` cases + plus-geometry → REPLACE_MECHANISM A8 (render 6 glyphs + fallback: fill-vs-stroke, 2px accent, halo, orthogonal plus; durable `#146d68`). D5 owner-comment pin → KEEP_ARCH but NEEDS_OWNER_DECISION (comment-reword breaks it; keep vs docs-pointer is an owner call).
**state-controls** — acquisition/hit/marks/focus-ring/focus-lifecycle pure (20 its) → KEEP_FAST (high). Paint order + 2/1.5/3/1px separations → REPLACE_MECHANISM A9 (render hovered/selected walls). Never-recolour negatives → KEEP_ARCH (med-high).
**surrounds** — see corrected C.1 row.
**thin-wall** — sub-2px pipeline (2 its, 7-wall compile→model→salience) → KEEP_FAST (high). Aid-mark source pins → REPLACE_MECHANISM A10 (render thin/dense at 8px/m: band preserved + aid / casing skipped).

### C.1.4 Cluster 4 deep review — Inspector/Navigator overlap + Cluster 5 relic trace

**Only two genuine same-defect pairs in the whole Inspector/Navigator cluster — everything else is same-feature/different-defect (verified by disjoint modules/assertion targets):**
1. `Ends…` row removal: 6e Room-page projection it vs p23-12-navigator row-identity it — same `buildHierarchyPageProjection(room-a)`, same `'Ends '` absence → MERGE into the 6e it (med-high).
2. Shared-Wall→Rooms: p23-12-navigator `roomIdsByWallId` it strictly subsumed by 6e index + participation its → MERGE into 6e (med).
**Preserve-different-layers (all survive):** legacy-model projection / index / page-projection / search-projection / selection identity / highlight / reveal evaluation / resolved Inspector target / exposure / headers / copy / property order / destructive wiring / dissolve authority (query vs entries) / identity composition / pin presentation / emphasis / CSS protections / interactivity gating / legacy quarantine / reset lifecycle. Consequences: 6b stays `KEEP_ARCH` (legacy quarantine path, not superseded by 6e canonical mechanism); 6e stays `KEEP_FAST` (foundation); p23-12-inspector-identity stays `KEEP_FAST` (strings, not structure — P23.14 property-first pins order, different defect); p23-12-navigator-identity stays `KEEP_FAST` except the two merges; `unified-project-tree` stays `KEEP_FAST`+`KEEP_ARCH` (legacy model/matcher/filter/format-routing); both P23.14 Inspector files stay `KEEP_FAST` (target matrix/exposure and dissolve authority/wiring have no counterpart — `unified-project-tree` cross-domain highlight tests the tree matcher, not the Inspector mount gate).

**Relic trace (production: `routes/museum/editor/+page.svelte` = `<MuseumEditorEntry relic />` only; plugin → `MuseumEditorApp.svelte` frozen pre-H1 shell; `isRelic` reads private `relicMode`; no layout-history registration when relic).** Coverage today: mount (contracts route-wiring + virtual-entry + hierarchy-mount its, all source); frozen transport chrome (contracts + p12-s4 relic-header/Ruler/PreviewControls/`+View Key`×2); frozen behavior — Flip pose (p12-s3), Repeat scope (p11-s4), selection/preview (p12-s2), camera authoring (editor-store-camera B0), shortcuts/lifecycle (editor-store-shell), placement (Paris arm/click/IDs/yaw), focus (Paris-only gate), registry/resolver-free (p20-s2/s4, a11y), legacy Inspector mount (inspector-target), focus-untouched (slice-c); isolation — no-Layout (contracts relic-isolation + P7.3 boot), no re-derive (live-rooms), relic store entry (p12-s4 C2b). **Minimal future smoke (6 assertions, specified not implemented):** (1) mount: route has virtual entry not EditorApp; plugin → MuseumEditorApp; mounts LeftSidebar not EditorSidebar/UnifiedProjectTree (replaces route/hierarchy mount its). (2) frozen interactions: relic fixture — Paris preselect, `focusRoom('paris')` true / `('entrance')` false, one pending-node draft→connect (replaces placement/focus/connect its; drop ID/yaw/microcopy depth). (3) isolation: `setWorkspace('layout')` false; `updateRooms` harmless; no `registerLayoutHistory`/UnifiedProjectTree/`createProjectApi` (replaces isolation/boot/live-rooms/registry its). (4) frozen transport: relic-header + tour-selector present; Panel mounts PreviewControls under `isRelic`; `+View Key` stays 2 live-only (replaces p12-s4 header + contracts P11/tour its). (5) shared-store detector: relic Flip at 0.5 preserves sampled pose; playing-seek refused (replaces p12-s3 Flip-relic + p12-s2 relic its). (6) shell-untouched: relic backslash → focusMode false, panel open (keep slice-c it as-is). **Relic gaps:** no DOM/behavioral mount test (untrack-freeze unpinned); no shared-import drift guard (only representative pins); `MuseumEditorApp` no-layout-history branch has no direct test; no relic-side import-surface test; focus isolation pins backslash only.

### C.2 Rule-based draft dispositions — REPLACED for reviewed clusters (2026-09-19 pass)

C.2's mechanical draft is superseded by C.1.1–C.1.4 for: all 5 Cluster-1 files, all of `contracts.test.ts` (25 describes), all 14 P23.13 files (describe-level), all 7 Inspector/Navigator files, and relic branches. What remains low-confidence (explicitly):

- Source-readers NOT deeply reviewed (~20 files: `hierarchy-navigator-state`, `p23-12-plan-identity`, `p23-12-transient-allocation`, `p23-2-interior-anchor-release` wiring half already C.1-triaged, `p23-6b/6e-bridge`, `p23-6e-projection` wiring half, `layout-3d-picking` purity half, `wall-material`, `p23-10-*`, `p23-11-bend-command` wiring half, `p20-*`, `theme*`, `scene-palette`, `plan-timing-pill`, `room-focus` slice half, `p14-footprints`, `preview/project-flows`, `p23-6h-height-parity`, `editor-navigation-graph` scan half, `editor-store-bind-migration`): presumed per C.1-row calls where listed, else `REPLACE_MECHANISM` draft (low) except `*-boundary*`, `p23-f0-stage*`, `p23-12-visitor-identity-isolation`, `p22-*` (`KEEP_ARCH` draft, low). Each needs a 5-minute read before T2.
- Timing-flagged files not reviewed (~15): `MOVE_HEAVY`-or-incidental draft (low) — check budget-gate vs incidental `Date.now`.
- Slice-named behavioral files not reviewed (~55): `KEEP_FAST` + rename debt draft (low).
- Randomized files: keep-statements + `MOVE_HEAVY` loops draft (low); verify seeds first.

### C.3 Semantic successor map (deletion/replacement candidates only)

| Old test | Old invariant | Current authority | Successor test | Same-defect evidence | Remaining gap | Disposition / conf |
|---|---|---|---|---|---|---|
| p11-s4 A3a Flip-resets-playhead | Non-relic Flip resets playhead to 0 | Store Flip semantics (durable) | p12-s3 `Flip semantics / resets non-relic Edge playhead while preserving repeat and discovery` | Same swap call, same stale-playhead bug fails both; successor asserts strictly more | None | **EXECUTED (T2a)** — DELETE_CANDIDATE / high |
| p12-s4 C1a scrubber-absence line | No collapsed second scrubber | PLATE Decision 5 / drawer §17 | `p23-14-camera-drawer / §17 collapsed / mounts no lane, ruler or second scrubber` | Same reintroduced-scrubber bug (`mini-player__scrubber` / range input / `showCollapsedScrubber`) fails both; in-test comment cites supersession | None for this line | **EXECUTED (T2a)** — MERGE (line only) / high |
| slice-c E5c 3 toggle-ownership lines | No second panel writer in shared toolbar | PLATE R4 §14 one-owner | `p23-14-control-ownership / §14 / panel visibility written only by View Bar` | Same `toggleLeftSidePanel/RightSidePanel/FocusMode`-in-toolbar bug fails both; in-test comments cite §14 | Hint-placement pins stay | **EXECUTED (T2a)** — MERGE (lines only) / high |
| contracts #10 Arrange-Delete it | Single Delete entry point | Arrange ownership (durable) | `arrange-delete.test.ts` (behavioral) | Same duplicate-entry bug fails both | None | **EXECUTED (T2a)** — DELETE_CANDIDATE / high |
| contracts #9 snap it | Snap wiring present | Snap grammar (durable) | `snap-input-validation.test.ts` (behavioral) | ~~Same unwired-snap bug fails both~~ **WRONG — successor tests the parsers, not the toolbar call site; it stays green if the wiring disappears** | None | **RESTORED (review): DELETE_CANDIDATE WITHDRAWN** |
| contracts #8 teardown it | Keyed session + abort teardown | Session isolation (durable) | `project-session-isolation.test.ts` (behavioral successor, cited in-file) | ~~Same leaked-session bug fails both~~ **WRONG — successor proves `ProjectAssetRequestScope.invalidate()` behaves; it does not fail if `EditorApp` stops calling it** | None | **RESTORED (review): REPLACE_MECHANISM not demonstrated** |
| contracts #13 type grammar | Type tiers present | PLATE R3 ladder | `p23-14-type-roles.test.ts` | **Ladder-closure lines only.** The two literal step lines are genuinely subsumed; the Inspector *shorthand* mappings are NOT (a role swapped for another valid role still closes the ladder) | 12.5px tier | **PARTIALLY RESTORED (review)** — 5 mapping assertions kept, 2 subsumed step lines dropped |
| contracts #14 live-chrome its | P12 timeline geometry | p12-s4 (in-file cited owner) | `p12-s4-header-chrome` (parity it → a11y-motion) | Same chrome-drift bug fails both | Parity behavior | **EXECUTED (T2a, partial)** — DELETE_CANDIDATE / med-high |
| contracts #15 terminology/counts | Tree vocabulary + counts | Tree projection (durable) | `unified-project-tree.test.ts` + 6e projection | Same renamed-row bug fails both | None | **NOT EXECUTED (T2a)** — no demonstrated successor (see §J.2) / med-high |
| contracts #18 harness-content it | No harness text in prod | — (meta) | `editor-gizmo-host.test.ts` (the harness itself) | Same leak fails the harness directly | None | **EXECUTED (T2a)** — DELETE_CANDIDATE / high |
| contracts #3/#10/#11/#12/#13/#15/#20/#24 chrome/pixel pins | Exact px/hex/copy/import lines | PLATE (ratified parts) / review-open parts | P23.14 behavior successors where ratified; OWNER where open | Same-implementation-drift fails both, but pins freeze possibly-undecided chrome | Review-open items (below) | REPLACE_MECHANISM, except NEEDS_OWNER_DECISION pins / med |
| p23-13 wiring/paint pins (A1–A10, K1–K3, E1–E2, R1–R4, S1, I1) | Adapter/wiring behavior via source strings | Drafting contracts (durable) + PLATE | **Written in T2b** — see §K. A1–A10, K1–K3, I1 replaced (rendered proof + mutation evidence); F1/E2 gained the behavioural half they were missing | n/a | R2–R4 and the call-site wiring halves (attention, refusal, latch ownership, freeze sweep) stay pins | **EXECUTED (T2b), partial**: A1–A10/K1–K3/I1 replaced · E1/E2/F1 behavioural half added · R2–R4 + wiring pins RETAINED / high |
| 6e-vs-p23-12 `Ends…` row | No per-Wall Ends relation row | Decision 4 (durable) | 6e Room-page projection it | Same reintroduced-row bug fails both (same call, same string) | None | **EXECUTED (T2a)** — MERGE into 6e / med-high |
| p23-12 shared-Wall→Rooms | Wall shows both Rooms | Index relation (durable) | 6e index + participation its | Same dropped-room bug fails both; successor asserts more | None | **EXECUTED (T2a)** — MERGE into 6e / med |
| Relic markup pins (header/tour/ruler/controls/mount) | Frozen relic chrome + mount | Relic frozen (durable) | `relic-smoke.test.ts` — **built in T2c** (6 claims, 13 tests, `ARCH_FILES`) | Smoke asserts the same mount/chrome/isolation behaviourally; §K.5 maps each historical pin to its smoke claim | Nothing deleted in T2c (additive by instruction); consolidation after the smoke survives independently | **SMOKE BUILT (T2c)** — historical pins still RETAINED / high |

> **Superseded in part by §L (T3a/T3c):** the §C.1.2 seven-way split was
> executed as a *disposition* pass rather than seven files — the behavioural core
> went back to `test:fast`, the shell pins went to the owners that already assert
> those invariants (the P23.14 family, `p12-s4`, `p11-s4`, the tree/camera-plan/
> persistence homes), and only two unconditional boundaries needed new files.
> The G-group deletions are all done (the snap and teardown guards were *moved to
> the files whose machinery they guard*, which is why §J.4's restoration is now
> paired with its successor instead of separated from it), the relic route/mount
> its are covered by the smoke, and the `#15` terminology/counts half that was
> STOPPED in T2a now has a home (`unified-project-tree`).

Review-open pins that MUST NOT become durable behavior yet: contracts P21.1 MODE pressed-fill (`--editor-bg-recess` vs open accent-tint question); contracts P21.1 + contrast-floor tray width (`--editor-tray-width: calc(44px …)` vs open rename/widen question); contracts P21.5-Slice-4 `12.5px` tier (off R3 ladder); contracts P21.2 `border-radius:0` (PLATE material tension); room-labels never-editable guard home; snap D5 comment-vs-docs; surrounds six-block-presence home.

### C.4 Uncovered gaps discovered (all verified, not hypothesized)

1. **No live keyboard→announcement test.** `planKeyboardControlReadout` (viewport:4340) has zero test callers; only wiring pins + pure `planTraversalAnnouncement` tests reference the path. README incident class reproducible today. New test K3 is highest priority. — **CLOSED (T2b, §K.2/K.3):** the readout and the traversal rule were extracted to `plan-keyboard-readout.ts` / `plan-keyboard-session.ts` and are driven directly (`plan-keyboard-readout.test.ts`, `plan-keyboard-session.test.ts`); the remaining call-site pins are narrowed wiring guards.
2. **No live attention/refusal/empty-lifecycle tests.** `planHintDismissed`, `planRefusal`, `attentionZone` appear in tests only inside pin suites (+ contracts same-mechanism ghost pins). Renaming `touchPlanAttention`/`armPlanRefusal`/latch bindings passes silently with broken behavior. — **PARTLY CLOSED (T2b, §K.2/K.3):** the attention paint/zone rules, the refusal record+annotation lifecycle and the empty-state dismissal gate now have behavioural tests; the *call sites* (`touchPlanAttention`, `armPlanRefusal`, the latch bindings) still pass silently, because they are event-driven component state — see §K.4.
3. **No PlanSvg render/adapter tests.** Every `PlanSvg.svelte` test reference is a source-string read; `plan-render-boundary` only pins delegation. All A-sketches need new harness code. — **CLOSED (T2b, §K.1):** `tests/helpers/plan-render-harness.ts` renders the shipped component through `svelte/server` and reads paint from the compiler's stylesheet; the A-series rows are replaced with mutation-proven rendered claims (§K.2/K.3).
4. **No one-nav-graph/evaluator pin.** Motion-side pinned (TransformControls-free); route-side has no equivalent. Add one-evaluator sweep. — **CLOSED (T3b, §L.3)**: `camera-core-boundary` now sweeps evaluator ownership (every route/flow evaluator defined exactly once) and the editor navigation graph as the single owner of flow semantics.
5. **No positive Layout-v5/Scene-v1 ownership pin.** Only legacy empty-roots branch pinned. Add `formatVersion: 5` wall-first / `formatVersion: 1` world-local positive pins. — **CLOSED (T3b, §L.3)**: the format-policy gate now asserts the authoring pair classifies wall-first + project-world, the retired pair legacy, and the mixed pair never the default.
6. **No single editor→museum import-direction sweep.** Piecemeal `$lib/museum`-free + museum-free pins exist; no unified sweep analogous to gizmo sweeps. — **CLOSED (T3b, §L.3)** as two directions: no editor source imports the museum *app*, and the shared `$lib/museum` shell stays editor-free (it is consumed by the visitor build too). Sweeping `$lib/museum` out of the editor was the wrong premise — the editor legitimately owns that rendering shell.
7. **Relic has no DOM/behavioral mount test; `MuseumEditorApp` no-layout-history branch unpinned; no relic-side import-surface test.** See C.1.4 gaps. — **PARTLY CLOSED (T2c, §K.5):** `relic-smoke.test.ts` covers the mount/implementation, the frozen transport (server-rendered, so it is a behavioural transport proof) and the isolation branches, including `MuseumEditorApp`'s no-layout-history branch. The relic-side *import-surface* check is still only the shared boundary suites plus the smoke's mount claims; a dedicated relic import-surface test remains open. — **CLOSED (T3b, §L.3)**: `relic-smoke` now owns the frozen import surface (the relic shell never consumes the unified tree, the greenfield sidebar or the project API).

### C.5 Residual low-confidence drafts (superseded counts — see C.2 replacement note above)

- Source-reading files not hand-triaged: see C.2 list (each needs a 5-minute read before T2).
- Timing-flagged files not reviewed: `MOVE_HEAVY`-or-incidental draft (low) — check budget-gate vs incidental `Date.now`.
- Slice-named behavioral files not reviewed: `KEEP_FAST` + rename debt draft (low) — needs owning-slice plan + reference check.
- Randomized/property-like files (9): presumed keep-statements + `MOVE_HEAVY` for the randomized loops (draft). Verify seeds/determinism before moving.

## D. Top cleanup opportunities (re-ranked with assertion-level evidence — 2026-09-19 pass)

Moved up (strong successor + low deletion risk): line-level merges (new #2), contracts G-group deletes (new #3), Ends-row/navigator merges (#12). Moved down (protect unique behavior, no successor): P23.13 paint/wiring (was #8/#9/#16 — now "new test required first", not cleanup-ready), slice-b (was #3 — now KEEP_ARCH/MOVE_HEAVY, nothing deletable), interior-anchor (unchanged — still split, but wiring successor unbuilt).

> **Superseded in part by §K (T2b/T2c):** the P23.13 rows moved from "new test
> required first" to **replaced on rendered proof** once the render harness
> existed. The rows rated "protect unique behavior" were not weakened — the
> call-site and plumbing pins are still there, now with the reason recorded.
>
> **Owner-open pins were not ratified by T2b.** Every replacement that touches a
> PLATE item asserts *presence or mechanism* (a class is emitted, a rule exists,
> an aid is additive, a mark is unhittable), never a disputed value: the refusal
> ink is asserted by declaration existence rather than by its colour, the 12.5px
> tier is untouched (`NEEDS_OWNER_DECISION`), and MODE pressed fill, tray width,
> `border-radius: 0`, room-label never-editable ownership, the snap D5 comment
> ownership and surrounds block-presence ownership all remain open.

1. **`contracts.test.ts` split (7-way plan, C.1.2)** — still #1: 25 describes, largest fragility surface, now with an explicit lossless split (A visitor-boundary / B single-owner / C Layout-Scene / D presence-behavior / E behavioral core / F chrome-or-owner / G delete-with-successor). G-group deletes unblocked immediately.
2. **Line-level merges with demonstrated same-defect successors (zero new tests needed):** p11-s4 A3a→p12-s3 B2a (DELETE 1 it); p12-s4 scrubber line→drawer §17 (MERGE 1 line); slice-c E5c toggles→control-ownership §14 (MERGE 3 lines); `Ends…` row→6e Room-page (MERGE 1 it); shared-Wall→Rooms→6e index (MERGE 1 it). Safest first cleanup (see §G T2a).
3. **Contracts G-group deletes with named behavioral successors:** Arrange-Delete→`arrange-delete`, snap→`snap-input-validation`, teardown→`project-session-isolation`, type→`type-roles` (hold 12.5px), timeline-chrome→p12-s4, terminology→tree+6e, harness-content→harness itself. Each independently deletable once its successor is confirmed green.
4. **P23.14 mechanism migration (8 files)** — unchanged priority: the new fragility surface; migrate to rendered/DOM/store assertions before owner closeout. Tray-width pin flagged OWNER on rail-width decisions.
5. **`normalize-asset` → heavy lane** — unchanged (29% runtime, no semantic overlap with anything).
6. **`camera-motion` sweep split** — unchanged, with a new precision: B1b store→motion integration (p12-s3) is NOT covered by motion unit tests (different layer) — keep that integration fast while moving the 1,001-sweeps.
7. **`p2311-bend-perf-pass` → perf lane** — unchanged.
8. **New-test-first blockers (NOT cleanup-ready — build these before T3):** K3 `planKeyboardControlReadout` direct tests (highest priority, zero callers today); F1 refusal lifecycle; E2 empty latch store test; A1–A10 paint/adapter sketches; S1 freeze-release; I1 toolbar labels; R2–R4 room-label extraction. No PlanSvg render harness exists — all A-sketches need harness code, not rewrites.
9. **Relic smoke build (6 assertions, C.1.4)** — unblocks RELIC_ONLY consolidation (relic header/tour/ruler/controls/mount, Flip pose, Paris placement/focus, isolation, backslash). Until it lands, all relic pins stay frozen.
10. **Ownership/architecture gap pins (add, don't remove):** one-nav-evaluator sweep; positive Layout-v5/Scene-v1 pins; unified editor→museum import sweep; relic no-layout-history + import-surface pins. Small, high-value, currently unprotected.
11. **`layout-scale-fixtures` + `extra-angled-plan-integrity` + `bench-report`/`browser-bench`** — tier or move to heavy/perf (unchanged).
12. **`p23-2-snap-extent-parity` randomized/iterative subset + `p23-12-identity` 200k-loop subset** — deterministic stays fast; property subsets move (unchanged).
13. **`wall-mesh-builder` sweep split** — boundary + representatives fast; winding sweeps heavy (unchanged).
14. **`layout-preview-state` profile-first** — do not lane-hide; fix setup cost (unchanged).
15. **P23.13 paint cluster: NO merge until A-harness exists** — door-window/salience/attention/object-paint overlap is same-mechanism duplication with A6 as designated single owner, but consolidation executes only after A6 render tests land (else proof is lost). Downgraded from active merge to sequenced plan.
16. **Inspector cluster: NO merge except the two demonstrated pairs** — 6b (legacy quarantine), 6e (canonical foundation), p23-12-identity (strings), navigator-identity (rows/pins/search/CSS), both P23.14 files (target/dissolve), unified-tree (legacy matcher) each protect disjoint layers (C.1.4). Only Ends-row + Wall→Rooms merge.
17. **Slice-b visual pins → MOVE_HEAVY, lifecycle pins → KEEP_ARCH** — nothing in the file is deletable (drag-basis/arbitration/picking/pose-cache/framing-owner have no successor). Downgraded from delete-candidate to lane disposition.
18. **`p23-2-interior-anchor-release` split** — semantics → arch (SoT interior-only anchors), viewport-wiring → adapter behavior (successor unbuilt).
19. **Review-open containment** — MODE pressed-fill, tray width, 12.5px tier, `border-radius:0`, never-editable home, D5 comment, block-presence home stay NEEDS_OWNER_DECISION; no cleanup PR touches them.
20. **Slice-rename debt (115 files)** — after T2–T4 stabilize survivors (unchanged).

## E. Supersession map

### E.1 Camera Timeline shell/chrome: P11 → P12 → P21 → P23.14

- **Old contract (P11.4):** frozen-relic segmented mode, icon-only a11y, no visible Stop, Edge-Repeat edge-only (`p11-s4-compact-controls`, 22 pins over 9 camera Svelte files).
- **Changed by (P12.3/P12.4):** one-shell Edge lanes, Flip semantics, Sequence scope, live header chrome + idle/transport lifecycle (`p12-s3-one-shell-lanes`, `p12-s4-header-chrome`).
- **Changed by (P21.5/P21.6):** timing-pill contrast, focus-mode state, drag deferral, observer framing, 3D viz lifecycle (`plan-timing-pill`, `p21.6-slice-b/c`).
- **Superseded by (P23.14 PLATE, durable):** drawer transport/readout + 5-lane set + no self-expand (`camera-drawer`); one writable owner per fact (`control-ownership`, R4); closed type ladder + roles (`type-roles`, R3); state language + axis ink (`state-language`); a11y keyboard/motion/density (`a11y-motion`); workspace-scoped Inspector target (`inspector-target`, R4); contrast floor (`contrast-floor`). Authority: shell contract §§7/10/11/13/14/16–18/22–23 + R1–R4.
- **Current durable tests:** P23.14 family (intent-durable, mechanism-brittle) + `camera-core-boundary` (hygiene only) + `camera-motion`/`camera-route` behavior + `editor-store-camera` behavior + p12-s3 B1b store→motion integration (NOT covered by motion units — different layer, keep fast).
- **Remaining obsolete/duplicate (assertion-level, C.1.1):** exactly 1 DELETE (p11-s4 A3a → p12-s3 B2a) + 2 line-merges (scrubber → drawer §17; toggles → control-ownership §14). Everything else in P11/P12/P21 keeps: relic describes frozen, Flip/Repeat/scope/focus/drag machines fast (no P23.14 coverage), lifecycle/ownership pins as arch, slice-b visuals to heavy. P12 header-chrome file is renamed, not removed.

### E.2 Shell rank/control ownership

- Old: scattered P11/P12/P21 ownership asserts (toolbar vs sidebar vs inspector vs app-bar). New (R4, durable): host paints, workspace exposes; one writable owner per fact; Inspector single resolved target (`resolveInspectorDomain`/`resolveInspectorExposure`); drawer owns POV/Observer; View Bar owns menus/utilities; Tray paints no bar utility. Tests: `p23-14-control-ownership`, `p23-14-inspector-target` (new authority) supersede old ownership slices. Remaining duplication: `contracts.test.ts` ownership pins + `p23-6b-hierarchy-inspector` legacy mapping asserts.

### E.3 Inspector structure

- Old: `p23-12-inspector-identity` (one header pattern, identity-not-ID copy, optional-name), `p23-6b-hierarchy-inspector` (ownership projection). New: property-first Inspector + deferred destructives + junction-dissolve single authority (`p23-14-inspector-junction-dissolve`, `p23-14-inspector-target`). Durable: one target, property-first, dissolve authority. Deep review (C.1.4) found only TWO same-defect pairs in the whole cluster (`Ends…` row → 6e Room-page; shared-Wall→Rooms → 6e index) — P23.12-identity pins *strings* while P23.14 pins *order/structure* (different defects); 6b pins the legacy quarantine path, not superseded by 6e canonical mechanism. Merge direction narrowed to those two pairs; all layers in the preserve-list survive.

### E.4 Focus mode

- Old: `p21.6-slice-c` focus-state/drag-deferral/shortcut pins. New: PLATE focus-vs-armed separation (§18) + `a11y-motion` keyboard model + `control-ownership` host gates. Remaining: focus behavioral describes in slice-c are still the liveliest proof — keep under product name, drop chrome slices.

### E.5 Theme/contrast

- Old: `p23-13-surrounds` (7-theme token invariance), `p23-13-salience`/`attention` (regime/ink resolution). New: `p23-14-contrast-floor` (measured floor + R1 tray micro-tier). Durable union: token invariance + measured floor. Merge into one `theme-isolation` proof (computed tokens, not string slices).

### E.6 Plan empty state

- Old: `p23-13-empty` (§8 copy + ghost + startup-only dismiss + undo semantics). No newer supersession — PLATE consumes Plan contracts unchanged. So this is **not obsolete**, it is **brittle**: same invariant needs a render/lifecycle test. Gap noted (no behavioral successor found).

### E.7 Keyboard wiring

- Old: `p23-13-keyboard` (traversal pure + viewport wiring slice). No supersession of the traversal contract; PLATE adds the shell-wide keyboard model (`a11y-motion` one menu/roving-focus/popover lifecycle). Direction: keep traversal units; replace viewport slice with live wiring; align announcement semantics with shell keyboard model.

### E.8 Drafting icons

- Old: `p23-13-icons` (owner ruling 2026-09-17: 5 lucide keep-list + Designer-D family paths + editor-only component). No supersession (PLATE consumes iconography unchanged). Brittle-mechanism only: move from Svelte-source + doc-SVG crawl to icon-data + render test.

### E.9 Timeline mini-player/drawer

- Old: P11/P12 mini-player/transport pins (`p11-s4`, `p12-s4`, `p8-s2/s3/s4` preview scope/sequence). New: drawer transport-only collapsed strip + ratified lane set (`p23-14-camera-drawer`, R4). Remaining: `p8-*` preview scope/sequence behavioral tests look durable (preview state machine) — verify against drawer contract before touching; timeline chrome pins go.

### E.10 Relic-specific behavior

- No supersession chain (frozen by definition). Old = current: `museum/editor` mounts `MuseumEditorEntry relic` (source pin in `contracts.test.ts`); relic store branches in `p12-s4-header-chrome`/`editor-store-camera`/`p21.6-slice-c`; isolation via visitor boundaries. Full trace + 6-assertion smoke spec in C.1.4 (mount / frozen interactions / isolation / frozen transport / shared-store detector / shell-untouched, each with replace-mapping). Everything relic-markup-shaped stays `RELIC_ONLY` until the smoke lands; gaps (no DOM mount, no drift guard, no-layout-history branch) are additive pins, not cleanup.

### E.11 F0 migration gates → post-F0 architecture

- `p23-f0-stage1-format-policy` (dispatch inventory + guard) + stage 2–5 (writers, fixtures, visitor parity, small items) are **transitional gates that became permanent architecture tests**: the dual-dispatch/transaction-guard/post-F0 Layout(world-local v1)/Scene ownership is current truth. Keep as `KEEP_ARCH`. Do not confuse "migration-era name" with "obsolete".

## F. Proposed durable suite structure

Respect current conventions (mirrored `tests/lib/**`, `$lib` imports, no tests under `src/`) unless there is a strong reason to change. Recommendation: **keep the mirrored tree + filename/tag conventions; add lanes by script, not by directory move** (moves churn 303 files + the dev-perf route's relative import + boundary `import.meta.url` roots for zero behavioral gain).

```text
npm test            → vitest run (all 303; CI + pre-PR gate; unchanged default)
npm run test:fast   → inner loop: everything EXCEPT heavy/perf/arch-gated-out
npm run test:arch   → durable boundaries always pre-PR + CI (visitor isolation,
                      single nav/motion owner, Layout/Scene split, format-policy
                      guard, package/direction boundaries, relic smoke once built)
npm run test:heavy  → expensive proof: subprocess, 200k loops, 1k sweeps,
                      randomized/property, scale fixtures, dense integrity
npm run test:perf   → timing/budget gates only (bend-perf, bench-report,
                      browser-bench, three-stats, plan-bench full tier)
npm run test:full   → fast + arch + heavy + perf (== npm test; explicit alias)
```

- **What belongs where:** fast = current-behavior unit/store/adapter tests with no subprocess, no ≥1k-loop sweeps, no timing asserts, no `fs` source slicing (source-*boundary* arch tests stay in arch even though fast). Arch = §C `KEEP_ARCH` list (~25 files). Heavy = §D 5–8 + 11–14 + bench scale. Perf = bench timing/budget files. Full = everything (today's gate, kept for CI).
- **Inner loop (agents):** `test:fast` (target <10s wall; current fast subset already ~10–12s once the top-7 heavy tail leaves).
- **Before PR:** `test:fast` + `test:arch` (arch is cheap, ~0.5s, and is the unsafe-to-skip set).
- **CI:** `test:full` (all lanes). Nightly/periodic also runs `test:full`; no lane is ever permanently skipped in CI.
- **Relevant-paths selection:** allowed ONLY for heavy/perf (asset/normalization paths → heavy; bench/layout-scale paths → perf). **Never path-gate arch.** Path selection for fast is unsafe in this repo because shell/store/layout boundaries are cross-cutting (a Plan change can break camera drawer ownership via shared store); keep fast unpartitioned.
- **Implementation (T1, behavior-neutral):** lane scripts via vitest `exclude`/`include` patterns or file-list args (no file moves, no config behavior change to the default `test`). Verify with runtime comparison (T6).

## G. Refactor sequencing proposal

- **T1 — instrumentation + lane scripts, behavior-neutral.** Add `test:fast/arch/heavy/perf/full` scripts (exclude-lists, no file moves); record pre/post wall times + per-file table; keep `npm test` default identical. Verify: `test:full` == `test` file set + test count 4,510; `test:fast` wall <12s.
- **T2a — line-level merges + G-group deletes (safest first PR; no new tests needed).** Files/describes: p11-s4 A3a (delete 1 it, successor p12-s3 B2a); p12-s4 scrubber line (merge to drawer §17); slice-c E5c 3 toggle lines (merge to control-ownership §14); `Ends…` row it + shared-Wall→Rooms it (merge into 6e); contracts G-group (Arrange-Delete→`arrange-delete`, snap→`snap-input-validation`, teardown→`project-session-isolation`, type→`type-roles` exc. 12.5px, timeline-chrome→p12-s4, terminology→tree+6e, harness-content→itself). Assertions to preserve: everything else in those files. Assertions safe to delete: the listed lines/its only. New tests required first: none. Verification gate: `test:fast` + `test:arch` green; `git diff` shows only the listed lines gone.
- **T2b — new-test-first blockers (build proof before any replacement).** K3 readout direct tests (priority 1); F1 refusal lifecycle; E2 empty latch store test; A6 paint owner + A1–A5/A7–A10 adapter sketches; K1–K2 wiring; S1 freeze-release; I1 toolbar labels; R2–R4 extraction; PlanSvg render harness (A-sketches need it). Verification gate per test: new test fails when the pinned source string is reverted (mutation check), then old pin is removed in the same PR.
- **T2c — relic smoke build (6 assertions, C.1.4).** Mount / frozen interactions / isolation / frozen transport / shared-store detector / shell-untouched. Verification gate: smoke green; RELIC_ONLY pins annotated with the smoke assertion that covers them (no deletion yet).
- **T3a — contracts 7-way split (C.1.2 plan).** Groups A–G with member describes listed; E-group (behavioral core: #4, #6, #7-it1, #18 FSM fixtures, #21 B-its) moves verbatim, never rewritten; F-group chrome migrates to behavior/DOM or OWNER-flagged; review-open pins (MODE fill, tray width, 12.5px, `border-radius:0`) carried as NEEDS_OWNER_DECISION, never defaulted. Verification gate: per-describe coverage map (old describe → new home + green run); visitor/single-owner/Layout-Scene/relic/FSM/selection asserts all present; owner sign-off on PLATE-open items.
- **T3b — ownership gap pins (additive, small).** One-nav-evaluator sweep; Layout-v5/Scene-v1 positive pins; unified editor→museum import sweep; relic no-layout-history + import-surface pins. Verification gate: each new pin fails on a real violation (mutation check) + `test:arch` green.
- **T3c — P23.14 mechanism migration + P11/P12/P21 residue.** Migrate P23.14 source pins to rendered/DOM/store assertions (keep thin ownership/exposure arch subset); shrink p12-s3 B1a to inertness/ownership; split p12-s4 C1b (ownership gates → control-ownership; View-Key/playhead stays tripwire); move slice-b visual pins to heavy. Verification gate: no P23.14 invariant left to source-text alone except the flagged arch subset + owner closeout.
- **T4 — split heavy/property/perf from fast loop.** Move `normalize-asset`, `camera-motion` sweeps (keep p12-s3 B1b integration fast), `bend-perf`, scale/dense fixtures, bench timing, randomized/200k subsets to heavy/perf lanes with fast representatives kept. Verify: fast wall target met; heavy/perf still green in CI; no invariant deleted (split, not cut). NOTE: P23.13 paint-cluster and Inspector-cluster merges are explicitly EXCLUDED from T4 — they wait on T2b harnesses (D15/D16 downgrade).
- **T5 — rename durable tests away from historical slice names.** Only survivors of T2–T4, toward names like `camera-timeline-behavior`, `shell-focus-mode`, `shell-control-ownership`, `plan-keyboard-navigation`, `plan-empty-state`, `theme-isolation`, `visitor-editor-boundary` (+ relic smoke). Verify: `git grep` old names → supersession pointers; dev-perf relative import + boundary roots updated; full suite green.
- **T6 — full closeout + runtime comparison.** Re-run §B measurements (2–3 full runs + group runs + isolated heavies); publish before/after wall + per-file deltas + fragility anecdote (refactor a shell file and count broken tests before/after). Verify: faster inner loop, same-or-stronger arch proof, zero silent invariant loss.

## H. Methodology notes + limits

- Reference-over-archive applied: PLATE shell contract + architecture ownership docs decided supersession; slice plans/comments used only for provenance.
- Vitest worker concurrency caveat: per-file durations in run-1 JSON are measured within concurrent workers, so contended files may read slightly high and uncontended slightly low. Mitigation: two full runs + default-reporter wall/timing breakdown + isolated heavy/group runs (see addendum below); conclusions that depend on exact ordering within ±0.1s are not drawn. Lane/group claims use sums, not ranks, except the top-7 tail where the gap exceeds noise (>2s vs <0.7s for rank 8+).
- `kind_heuristic` over-tags `arch-boundary` (filename match). Manual triage (§C.1) narrows legitimate durable boundaries to ~25 files.
- Isolated-run addendum (measured after harvest close):
  - `normalize-asset` alone: Duration 11.22s (tests 10.95s) — dominant single file; subprocess cost confirmed, concurrency-independent.
  - `camera-motion` alone: Duration 3.95s (tests 3.49s) vs 6.23s full-run — concurrency inflates ~60%, still heavy alone (1,001-sweeps + 25 timing asserts).
  - `p2311-bend-perf-pass` alone: Duration 4.57s (tests 3.08s) vs 5.06s — consistent heavy.
  - `p23-6e-extra-angled-plan-integrity` alone: Duration 4.51s (tests 3.70s) vs 4.71s — consistent heavy.
  - `layout-scale-fixtures` alone: Duration 2.47s (tests 1.71s, 8 tests) vs 3.77s — concurrency inflates, still heavy alone.
  - P23.14 family (9 files) alone: Duration 1.17s wall (transform 1.24s, collect 2.60s worker-sum, **tests 175ms**, 105 tests) — family cost is transform/collect overhead, not test logic. Burden is fragility, not runtime.
  - P23.13 lead subset (5 files) alone: Duration 647ms (**tests 25ms**, 42 tests) — same conclusion.
  - Concurrency note: full-run per-file durations read 20–60% high for the heavy tail vs isolated runs; top-7 rank order unchanged; all lane/group claims use sums or >2s gaps, never ±0.1s ranks.

## I. Owner-facing summary (5 questions)

1. **How much looks genuinely redundant or obsolete?** Deletion debt is tiny. Exactly one `it` (p11-s4 A3a → p12-s3 B2a), two line-merges (scrubber → drawer §17; toggles → control-ownership §14), two Navigator its (into 6e projection), and the contracts G-group (7 deletes, each with a named behavioral successor) — see C.3. Nothing in `p21.6-slice-b` is safely deletable: lifecycle/ownership stays `KEEP_ARCH`, visual pins move to heavy or remain tripwires. The large mass is **test-mechanism debt** (~40–60 files of durable invariants proven via source slicing, all "new test required first" — C.4), not duplication: apparent clutter turned out to be different layers protecting different regressions. ~102 files obvious `KEEP_FAST`; ~25 `KEEP_ARCH`. Treat this as test-architecture modernization, not a pruning exercise.
2. **Small heavy tail vs sheer count?** Tail. Top 10 files = 79% of per-file time; top 7 ≈ 41 of 52s. Removing `normalize-asset` alone (~29%) + moving 6 more files' dense work out of the inner loop cuts fast-loop wall by more than half. Sheer count (4,510 tests) is healthy — most files run in milliseconds.
3. **What can leave the inner loop with almost no safety loss?** `normalize-asset` (subprocess), `p2311-bend-perf-pass` + bench timing/budgets (perf lane), `camera-motion` dense sweeps (keep representatives), scale/d dense fixtures (`layout-scale-fixtures`, `extra-angled-plan-integrity` dense tier), `wall-mesh-builder` exhaustive sweeps, randomized/200k subsets (`snap-extent-parity`, `p23-12-identity`) — all with fast representatives kept. Everything arch (visitor isolation, single-owner, format guard, package boundaries) stays in pre-PR/CI.
4. **Which historical suites consolidate first?** Order is **T1 → T2a → T2b/T2c → T3**. T1 (lane scripts) first: solves the user-visible agent-wait problem without changing proof. T2a (C.3 line/it merges + contracts G-group) is the first cleanup PR: demonstrated same-defect successors only, no new harness, no owner decisions, no semantic changes. P23.13 paint consolidation is **blocked until the render harness and replacement tests exist** (T2b) — not next. Inspector/Navigator yielded only **two demonstrated duplicate pairs** (T2a); the other layers catch different defects and stay. `contracts.test.ts` split (T3a) follows T2b/T2c, not T2a. No further semantic harvest before T2a: the evidence standard (exact old test → exact successor → same-defect reasoning) is already stricter than needed; next research happens only when T2b designs a specific missing harness.
5. **What deeper inspection is still needed before deleting anything?** For each candidate: name the behavioral successor test (file + describe) that fails on the same defect; confirm relic branches have a smoke home; confirm randomized/property moves keep seeds; confirm perf moves keep budgets in CI; get owner closeout on PLATE review-open items (F4/TD-2, tray width, View Bar pressed fill) so replacements don't freeze contested chrome. No file is marked DELETE without that mapping — T2a already meets this standard; the rest waits on T2b/T2c.

**Bottom line: deletion debt is tiny. Test-mechanism debt is large. Runtime debt is a heavy-tail problem.** The suite is healthier than the first scan suggested — stop harvesting, implement T1 → T2a.

## J. Execution log — T1 + T2a (2026-09-19)

Executed from this report on branch `refractor/tests` (baseline `a479f78`).
No production code changed. Two commits:

- `test: add fast arch heavy perf lanes` (T1)
- `test: remove proven duplicate assertions` (T2a)

A third, docs-only commit records this §J and the §C.3 annotations.

### J.1 T1 — test lanes (EXECUTED)

**Approach:** lanes by configuration, not by file move. The mirrored
`tests/lib/**` tree, the dev-perf relative import and every `import.meta.url`
boundary root are untouched. Membership lives in `apps/editor/test-lanes.ts`;
every lane configs share `apps/editor/vitest.shared.ts` (the Svelte plugin +
`$lib` alias) so all lanes exercise the same module graph. `vitest.config.ts`
was refactored onto that shared setup — behavior-neutral.

**Scripts** (root passthrough + `@portfolio/editor`):

```text
npm test            vitest run                              (unchanged default)
npm run test:fast   vitest run --config vitest.fast.config.ts
npm run test:arch   vitest run --config vitest.arch.config.ts
npm run test:heavy  vitest run --config vitest.heavy.config.ts
npm run test:perf   vitest run --config vitest.perf.config.ts
npm run test:full   vitest run --config vitest.config.ts      (== npm test)
```

`test:fast` excludes exactly `test-lanes.ts`'s arch ∪ heavy ∪ perf lists via
`configDefaults.exclude` + those paths; it never infers an exclusion from a
filename or a file's size.

**Membership.**

- **arch (21 files):** the §C KEEP_ARCH boundaries — `visitor-import-boundary`,
  `camera-core-boundary`, `wall-mesh-shell-boundary`, `project-model-boundary`,
  `bench-boundary`, `plan-render-boundary`, `layout-geometry-boundary`; the
  visitor isolation set (`p22-1-cold-runtime`, `p22-3-public-route`,
  `p23-12-visitor-identity-isolation`, `preview-surface-boundary`,
  `visitor-runtime-state`) plus the two `tests/vite` boundary plugins; the F0
  format-policy/transaction gates (`p23-f0-stage1-format-policy` + stages 2–5);
  `editor-store-bind-migration`; and `contracts.test.ts` (it owns the visitor
  closure / single nav-motion owner / Layout↔Scene / relic-mount boundaries
  until the T3a 7-way split moves its behavioral core into fast). Arch is never
  path-gated.
- **heavy (1 file):** `lib/content/normalize-asset.test.ts` only — the sole
  uniformly-expensive whole file (subprocess harness; ~29% of per-file time).
- **perf (5 files):** `p2311-bend-perf-pass`, `bench-report`, `browser-bench`,
  `three-stats`, `plan-bench` (the plan-bench full tier stays the 1 skip).

**Baseline & equivalence (proved with the vitest JSON reporter).**

- `npm test` = 303 files / 4,510 tests; `test:full` = 303 files / 4,510 tests;
  identical file sets.
- union(fast 276, arch 21, heavy 1, perf 5) = the full 303, **disjoint** (no
  file in two lanes); lane test counts sum to 4,510 (4,131 + 350 + 6 + 23).

**Wall times** (this machine, 8 cores; `npx vitest run`, concurrency caveat §H
applies).

| lane | files | tests | vitest wall | real |
|---|---|---|---|---|
| baseline `npm test` | 303 | 4,510 | 28.54s | 29.7s |
| `test:fast` | 276 | 4,131 | 22.09s | 22.7s |
| `test:arch` | 21 | 350 | 2.47s | 3.5s |
| `test:heavy` | 1 | 6 | 11.15s | 11.7s |
| `test:perf` | 5 | 23 (1 skip) | 3.75s | 4.4s |
| `test:full` | 303 | 4,510 | 28.5s | 29.7s |

**On the <12s fast target: not met, and intentionally not chased.** The
residual wall is per-file transform/collect overhead across ~276 files, not the
heavy tail: dropping the five slowest *remaining* files
(`camera-motion`, `p23-6e-extra-angled-plan-integrity`, `layout-scale-fixtures`,
`layout-preview-state`, `wall-mesh-builder`) moved 22.1s → 19.7s while the
tests worker-sum fell 27.0s → 11.6s and `collect` stayed ~72s. Reaching <12s
would require excluding correctness tests the harvest does not support as
heavy/perf/arch — i.e. gaming the number, which T1 forbids.

**Heavy candidates inspected and deferred to T4** (per "do not blindly move a
mixed file" — each is mixed with cheap, load-bearing tests, so a file-level
split would need rewriting):

| candidate | why it stays in `fast` |
|---|---|
| `camera-motion` (6.23s/117) | constants, easing, `createCameraMotion`, guard repairs are cheap and interleaved with 1,001-sweeps |
| `layout-scale-fixtures` (3.77s) | 6 of 8 tests <10ms; only the small+medium compile (196ms) and 1,000-room compile (1,456ms) are heavy |
| `p23-6e-extra-angled-plan-integrity` (4.71s) | 3 stress tests (114/874/1025ms) among 9 cheap (0–15ms) |
| `wall-mesh-builder` (2.20s) | mesh correctness + a renderer-free **boundary** import test (belongs to arch) |
| `p23-12-identity` (0.26s) | 2 dense loops (90/64ms) among 16 cheap; negligible wall |
| `p23-2-snap-extent-parity` (0.27s) | randomized/dense subset (~96/23ms) among cheap deterministic parity |
| `p21.6-slice-b` (0.004s) | lifecycle arch pins + visual-string pins |

Mixed files that also carry arch material (`p11-s4`, `p12-s4`, `p21.6-slice-c`,
`p23-2-interior-anchor-release`) stay in their existing (fast) lane for the same
reason.

### J.2 T2a — proven duplicate removals (EXECUTED)

Only units with a demonstrated same-defect successor were removed. Test-count
deltas are exact.

| # | File | Removed | Successor | Δtests |
|---|---|---|---|---|
| 1 | `store/p11-s4-compact-controls` | `it('swaps direction and resets the non-relic Edge playhead to 0')` | p12-s3 `Flip semantics — resetting non-relic Edge playhead while preserving repeat and discovery` | −1 |
| 2 | `store/p12-s4-header-chrome` | the collapsed-scrubber absence line (`not.toContain('mini-player__scrubber')`) in C1a | `p23-14-camera-drawer` §17 collapsed `mounts no lane, ruler or second scrubber` | 0 |
| 3 | `p21.6-slice-c` | E5c's 3 ownership lines (`toggleLeftSidePanel`/`toggleRightSidePanel`/`toggleFocusMode` `not.toContain`) | `p23-14-control-ownership` §14 `panel visibility is written only by the View Bar utilities` | 0 |
| 4 | `app/p23-12-navigator-identity` | `it('the shared Wall shows both Rooms as participation context')` | 6e source-index `roomIdsByWallId` (strictly more rooms) | −1 |
| 5 | `app/p23-12-navigator-identity` | `it('replaces the per-Wall Ends relation row with the boundary inventories')` | 6e `nests hosted Openings … no Ends relation row` + `derives Boundary Junctions…` | −1 |
| 6a | `app/contracts` | ~~route-wiring teardown block (6 assertions) inside `mounts one keyed session…`~~ **RESTORED §J.4** | ~~`project-session-isolation`~~ (machinery, not the `EditorApp` call site) | 0 |
| 6b | `app/contracts` | ~~`it('validates Row 2 snap number inputs before writing gizmo state')`~~ **RESTORED §J.4** | ~~`snap-input-validation`~~ (parsers only, no call-site guard) | 0 |
| 6c | `app/contracts` | arrange-delete router-internals block (`deriveArrangeTarget`/`deleteLayoutObject`/`store.deleteSelection`) | `arrange-delete` (behavioral); shell-wiring lines kept | 0 |
| 6d | `app/contracts` | ~~`it('locks the three-tier Inspector type grammar…')`~~ **REDUCED §J.4** to 5 shorthand-mapping assertions | `p23-14-type-roles` owns the ladder steps + closure | 0 |
| 6e | `app/contracts` | timeline `height: 48px;` + `height: 36px;` + the frame-level `mini-player__timecode` fragment | `p12-s4-header-chrome` | 0 |
| 6f | `app/contracts` | `it('records the fake-host lifecycle harness…')` meta-test | `editor-gizmo-host.test.ts` (the harness itself) | −1 |

Also dropped the now-unused `TEST_DIR` const in `contracts.test.ts`.

**Population change:** 4,510 → **4,504** tests (−6 `it`s: 1 p11-s4, 2 navigator,
3 contracts). Files stay 303. The one skip (`plan-bench` full tier) is unchanged.

> **Superseded by §J.4:** three of those units were restored after review, so
> the T2a end-state is **4,506** tests / −4 `it`s. This row is kept as the
> as-committed record, not the current state.

**Items deliberately NOT executed** (fallback: stop rather than widen scope):

- **contracts #15 terminology/counts — STOPPED.** The asserted vocabulary
  (`<h2>Sequence Inspector</h2>` / `<h2>Unsequenced</h2>` / `<h2>Connections</h2>`,
  `chainConnectionRows`, `neighborRowsOf`, the four-section Camera sidebar and
  the row-gating counts) appears **only** in `contracts.test.ts`; neither
  `unified-project-tree.test.ts` nor `p23-6e-hierarchy-projection.test.ts`
  asserts it (verified by grep). No demonstrated successor ⇒ no removal; this
  needs the contracts 7-way split (T3a) to find a home.
- **contracts #13, the 11px section-header `it` — KEPT.** `p23-14-type-roles`'s
  swept-surface guard does not list the nine inspector panel components, so the
  component-level 11px tier has no successor sweep yet. T2b gap: extend
  `SWEPT_SURFACES` to the inspector panels before deleting it.
- **contracts #14, ruler-readout and keyboard-parity its — KEPT.** p12-s4 does
  not pin the 9px ruler token, and `p23-14-a11y-motion` covers the shell
  menu/roving-focus/popover model, not the collapsed pill, so parity was not
  "mapped" and stayed.
- **12.5px tier — untouched** (NEEDS_OWNER_DECISION), per instruction.

### J.3 Verification (after T1+T2a as first committed)

- `npm test` == `npm run test:full`: 303 files, same file set; 4,504 tests
  (4,503 pass, 1 skip).
- Lanes partition: fast 276/4,128 + arch 21/347 + heavy 1/6 + perf 5/23
  = 4,504, disjoint.
- `npm run test:fast` and `npm run test:arch` green; every successor file run
  explicitly green; `npm run check` (svelte-check) 0 errors.
- Post-T2a wall: fast 23.3s, arch 2.5s, full 31.6s (concurrency caveat §H).
  Superseded by §J.4 for the current end-state.

### J.4 Review response — three "successors" restored (EXECUTED)

An external review found three T2a units whose named successor pins a *different*
failure than the deleted assertion. All three were **restored** (or reduced to
their non-redundant half). The distinction that matters — and that the §C.3
successor map got wrong — is **behavioral successor vs. call-site successor**:

- A successor that imports and exercises the module under test can replace an
  intra-module assertion (`arrange-delete` #6c: it imports
  `deleteArrangeSelection` and deletes end to end, so the removed router-internals
  lines really were subsumed — this one **stands**).
- A successor that tests a *sibling* module's machinery, or only the pure helper
  the call site consumes, does **not** replace a pin on the call site; it stays
  green when the wiring is deleted. That is the case for all three below.

| # | Restored | Why the named successor was a false successor |
|---|---|---|
| 6a | `contracts` route-wiring teardown block inside `mounts one keyed session…` (6 assertions on `EditorApp.svelte`) | `project-session-isolation.test.ts` proves `ProjectAssetRequestScope.invalidate()` behaves when called. It cannot fail if `EditorApp` stops calling `projectRequestController?.abort()` / `invalidateProjectAssets()` / `clearRetainedSourceAliases()` / `assetScope.invalidate()`. The retained `{#key}` pin is a markup pin and does not close it. Grep confirms the deleted block was the only pin on those calls. |
| 6b | `it('validates Row 2 snap number inputs before writing gizmo state')` | `snap-input-validation.test.ts` imports `parseTranslationSnapMeters` / `parseRotationSnapDegrees` and tests valid/invalid numbers. It does not touch `EditorViewportToolbar.svelte`, so a toolbar that stops calling the parsers on `onchange` — or stops restoring the live value on reject — leaves it green. Grep confirms the deleted assertions were the only test referencing `commitTranslationSnap` wiring. |
| 6d | `it('maps the Inspector type shorthands onto their ratified roles')` — the 5 semantic mappings only | `p23-14-type-roles` proves the ladder is closed and that swept surfaces carry no pinned pixel value. Both hold when `--editor-inspector-value` is repointed at another *valid* role, or when `--editor-font-size-label` points at `lg`. The two literal step lines (`font-size-xs: calc(10px …)`, `font-size-md: calc(12px …)`) **were** genuinely subsumed by the successor's `LADDER` sweep and stayed deleted; `section: var(--editor-font-size-xs)` and friends were restored as mappings. |

Unchanged by the review (verified, not just asserted): p11-s4 A3a Flip (strictly
subsumed by p12-s3 B2a), the p12-s4 collapsed-scrubber line, the slice-c E5c
ownership lines, both p23-12 Navigator removals (stronger 6e coverage), the
timeline height/timecode fragments (p12-s4 owner; still green), and the gizmo
harness meta-test (the harness itself is the failure boundary). The 12.5px tier
remains untouched (NEEDS_OWNER_DECISION).

**Corrected end-state (measured, vitest JSON reporter):**

- `npm test` ≡ `npm run test:full`: 303 files, **4,506** tests (4,505 pass, 1 skip).
- Partition is exact: fast 276/4,128 + arch 21/**349** + heavy 1/6 + perf 5/23
  = **4,506**, disjoint, union = the full 303 files.
- Net T2a deletion: **−4 `it`s** (p11-s4 1, navigator 2, gizmo meta 1); the
  scrubber/ownership/timeline/arrange-delete edits are line-level (0 tests).
- Wall: `test:fast` 24.4s, `test:arch` 2.9s, `test:full` 29.6s.
- `contracts.test.ts` 156 tests; `npm run check` (svelte-check) 0 errors.

**Open note carried forward (non-blocking in review):** `contracts.test.ts` sits
wholly in `ARCH_FILES` until the T3a 7-way split, so its cheap behavioral core
(~110ms) is outside `test:fast`. The complete behavioral inner loop is therefore
`test:fast` + `test:arch` (~27s), which the review accepted as a T3a item rather
than a T1 blocker.

## K. Execution log — T2b + T2c (EXECUTED)

Scope of this slice: **new-test-first replacement of source-pin proof with
behavioural proof** (T2b) and the **dedicated frozen-relic smoke** (T2c). No
T3/T4/T5/T6 work was started; the only production code touched is the two small
seams named in §K.1.

**The rule this slice was built around** (from the §J.4 review): *a test
mentioning the same feature is not a successor.* A replacement counts only when
it fails on the same defect. Every replacement below therefore carries a
**mutation** that reintroduces that defect and a recorded failing assertion
(§K.3); anything whose equivalence could not be demonstrated was **kept**, not
guessed away (§K.4).

### K.1 Harness architecture (`tests/helpers/plan-render-harness.ts`)

One helper, two mechanisms, no new dependency:

1. **`svelte/server`'s `render()`** runs the *shipped* component in plain Node
   (the `svelte()` transform is already in every lane's setup). No jsdom, no
   happy-dom, no browser ceremony, deterministic, and the component is not
   mocked into a different architecture — it is driven by the same props the app
   passes (`model`, `planView`, `presentation`). `parseMarkup()` turns the
   emitted markup into elements with tags, attrs, product classes (the compiler's
   `svelte-xxxx` scope class is dropped), text, depth and document order.
2. **`svelte/compiler`'s `compile(..., { css: 'external' })`** yields the real
   stylesheet, so paint declarations are read from the compiler's authority
   instead of a regex over source text; `planSvgRule(selector)` / `componentRule`
   / `planSvgSelectors` are the queries.

`tests/lib/layout/plan-render-harness.test.ts` proves the harness itself before
it is trusted (the markup is the shipped component, it answers to prop changes,
and the scoped-selector and comment cases resolve correctly). The same
`render()` mechanism also carries the T2c relic transport assertion and the I1
toolbar labels; `plan-render-harness.test.ts` is the only file that asserts the
harness rather than the product.

**Deliberately out of scope for the harness:** effects, timers, and DOM events.
Its claims are the *emitted* half of a rendering contract (element kind, class,
geometry, attribute, order, presence) plus the *declared* half (compiled CSS for
an emitted class). Interaction state is driven through the same inputs the app
passes. This boundary is what makes §K.4's retained pins necessary rather than
lazy.

**Production seams added (documented, not hidden):**

- `src/lib/editor/layout/plan-keyboard-readout.ts` — the role/position/owner/
  value/units readout mapping, previously an inline function in
  `LayoutPlanViewport.svelte` with **zero callers and zero direct tests** (C.4
  gap 1). Extracting it gives the keyboard path one implementation the component
  and the tests both call; the module is pure and has no test-only affordances.
- `src/lib/editor/layout/plan-keyboard-session.ts` — the traversal decision
  (`planTraversalStep`-based next-target choice) that used to live inline in the
  viewport's key handler.

Both improve the architecture on their own terms (one owner for a mapping and a
rule that the component merely consumes) and are the only production changes in
the whole slice.

### K.2 New tests and the old pins they replace

| Row | Old mechanism | New proof | Old pin |
|---|---|---|---|
| **K3** | `planKeyboardControlReadout` pinned by *nothing* (zero callers) + 8 wiring `toContain`s | `plan-keyboard-readout.test.ts` — the readout driven over document facts across junction/edge/slide/null, including the composed role+position+owner+value+units string | the wiring pins were **narrowed** to the call-site facts they uniquely own (the rule itself is now proven) |
| **K1/K2** | `planTraversalStep` wiring pins | `plan-keyboard-session.test.ts` — traversal decisions asserted directly; pointer-silent vs keyboard-once via the derivation inputs | same narrowing as K3 |
| **A1–A3** | `p23-13-attention` paint contract sliced out of `PlanSvg.svelte` text | `p23-13-attention / S8 paint contract` — the wash polygon and reason label rendered through the harness, each emitted class read from the compiler's stylesheet, and a non-identity token proving the class table is what the renderer reads | the 3 source assertions **deleted**; the third claim (per-footprint Scene ink precedence) **moved to its A6 owner** |
| **A4** | the same slice | `p23-13-object-scene-paint / applies the regime fraction…` (A6 owner): one footprint inside the zone dims to the zone value while the others keep the regime value | source pin **deleted** (this is the §J.4 false-successor lesson applied: the successor must fail when the per-primitive source is dropped) |
| **A5** | `p23-13-door-window` band/punch literal slice | rendered room-less plan: band runs, casing per run, and both Opening punches emitted with **zero Rooms**; casing/punch widths and role tokens read from the compiler | 2 of 3 source lines **replaced**; the plan.css token line **kept** (plain-CSS token ownership — static is the correct mechanism) |
| **A6** | `object-scene-paint` regex slice (done in the harness commit) | resting/state/zoom ink rendered; object footprint = authored polygon; screen-constant ink | source pins **deleted** |
| **A7** | `p23-13-presentation-foundation` band/role/window literals | rendered band projection at 8 px/m (`1.6px` / `2.8px` exact), role tokens from the compiler, and the Window frame count at 8/20/100 px/m matching the grammar's own resolution | 3 positives **replaced**; the retired-clamp/floor/`0.28` absences **kept** (absence checks are the right mechanism) |
| **A8** | `p23-13-snap-grammar` glyph `case` slices + plus-path regex | every glyph shape rendered: each emits its own `path`, the **same `d` at 8 and 100 px/m** (screen-constant by measurement, not by claim), the halo emitted under the ink, and the grid cross verified to be two orthogonal arms of `2 × radius` with no arc command | source slices **replaced**; the token value and the D5 owner note **kept** |
| **A9** | `p23-13-state-controls` `indexOf` ordering + rule regexes | the emitted composition order `contour → moat → casing → band` for a selected Wall, the §2 separations computed from compiled declarations, and every compiled mass rule enumerated for state-token recolouring | source pins **deleted** |
| **A10** | `p23-13-thin-wall` template `{#if}` slices | the aid marks rendered from the **real salience pipeline** at 8/20/100 px/m: band count = Wall count, one silhouette per Wall, casing skipped for the dense pair, no aid at 20/100, aid carries no band width | source pins **deleted** |
| **I1** | `p23-13-icons` toolbar label containment | labels read from the **rendered** toolbar: the 10 tool labels, Grid only in the Plan view, Cancel only while a gesture can be cancelled | source label list **replaced** |
| **F1** | `p23-13-refusal` lifetime wiring slices + the paint/lifecycle unit halves | **added** (not a replacement): the annotation is additive and non-mutating (the committed projection survives, the input is not edited in place), unhittable, exactly one stop/×/reason, owner-derived keys, and a single expiry rule that never fires on an unusable clock | the 4 unit assertions that existed **stay**; the 3 wiring pins **keep** (see §K.4) |
| **E2** | `p23-13-empty` latch ownership slices | **added**: the dismissal gate's two inputs driven by real machinery — a held Rect Room drag and a primitive draft read as live gestures, cancel returns them to rest, and emptiness is document truth | ownership/latch pins **keep** (see §K.4); the behavioural half is new |
| **T2c** | ~20 historical relic pins, all additive | `relic-smoke.test.ts` — the six-claim contract (§K.5) | **no** historical relic pin deleted (T2c is additive by instruction) |

### K.3 Mutation / sensitivity evidence

Every mutation was applied to production source, the affected file(s) run, then
reverted through a self-restoring runner; the tree was verified clean after each
batch (`git status`). No mutation code is committed.

| Mutation (defect reintroduced) | Assertion that failed |
|---|---|
| relic route mounts greenfield `EditorApp` | smoke 1 `mounts the virtual entry and never the greenfield EditorApp` |
| relic Paris-only focus gate widened to every Room | smoke 3 `keeps the relic room-focus gate literally Paris-only` |
| relic header branch never taken | smoke 4 `renders the relic header, tour selector and frozen mini-player transport` |
| shared-store Flip retunes the relic too | smoke 5 `keeps the relic's frozen Flip semantics while the live shell resets` |
| relic may enter the Layout workspace | smoke 6 `refuses the Layout workspace on the relic…` |
| live shell focus shortcut reaches the relic | smoke 6 `keeps a shell focus shortcut from reaching the relic shell` |
| `.closure-wash` loses its ink rule | A1 `maps the S8 tokens to a class and gives each one ink` |
| drafts layer stops receiving interaction drafts | A2 `paints a polygon in the drafts layer…` |
| the class table is bypassed for the identity fallback | A3 `routes every style token through the class table…` |
| per-footprint Scene ink no longer read before the regime | A4 `applies the regime fraction as opacity…` (A6 owner) |
| casing rule loses its `+2px` punch width | A5 `keeps a wall-first Wall outside every Room…` |
| band projection off by one pixel | A7 `projects the canonical band width…` |
| adapter stops asking the grammar for the Window frame count | A7 `paints at most two Window strokes…` |
| Wall band stops reading its role token | A7 `paints from the band/ink/silhouette/partition/cue role tokens` |
| the readability aid stops being conditionally additive | A10 `drops the aid entirely once the bands stand on their own` |
| dense no longer collapses the stacked profiles | A10 `collapses the stacked profiles to the one neutral aid…` |
| the plus glyph becomes the refusal diagonal | A8 `draws the grid cross as two orthogonal strokes…` |
| glyph ink painted under its own halo | A8 `separates an open-path glyph…with a paper halo` |
| band emitted before the casing | A9 `paints contour → moat → profile → band…` |
| Wall mass recoloured with the selection token | A9 `never recolours the Wall mass with a state token` |
| a tool button loses its visible label | I1 `keeps visible labels authoritative beside every icon` |
| Cancel offered with nothing to cancel | I1 `offers the view utilities beside the tools…` |
| refusal annotation stops being additive | F1 `never mutates, restyles or hides anything the plan already drew` |
| refusal mark becomes selectable | F1 `answers a refusal with marks that can never be selected or hit` |
| a held Rect Room drag is no longer a drafting gesture | E2 `sees a live drafting gesture, and comes back to rest…` |
| a cancelled primitive draft keeps the interaction live | E2 (same it) |
| toolbar stops calling the snap parsers (from §J.4) | the restored contracts wiring guard |
| **`numericEntryOpen` adapter inverted** (`!numericEntry` on a `… | null` field) | K1/K2 call-site pin `asks the traversal rule at the keydown and applies every answer` — **and nothing else**: the pure `plan-keyboard-session` tests stayed green, which is the §J.4 lesson repeating (§K.7) |

### K.4 Pins deliberately retained (and why)

| Pin | Owner | Why it stays |
|---|---|---|
| `p23-13-attention` attention **wiring** (3 its: `touchPlanAttention`, `PLAN_ATTENTION_RESTORE_MS`, `planAttentionAt`, `tierDropZone`, `withPlanAttentionSceneInk` wrap) | A1–A4 | Call-site: the harness is server-side, so it cannot run the per-frame effect or the settle timer. The *rule* is proven behaviourally; what only this pin can say is that the viewport calls it. |
| `p23-13-refusal` **lifetime wiring** (3 its: arm, expire, clear, compose) | F1 | Same reason, one step further: the refusal lifetime is component-local `$state.raw` + `setTimeout`, armed in `onPointerUp`/`onPointerDown` and cleared by Escape. Driving it needs a browser env (out of T2b scope) or a production seam lifting the lifetime to a store-level owner — an ownership change, not a test change. |
| `p23-13-empty` **latch ownership** (2 its: viewport `$bindable`, EditorApp/PlanWorkspace composition) | E2 | The card's rule is one derived line three components deep; a server render neither runs effects nor survives a view round trip. The latch's set-once property *is* an assignment-absence fact, which is exactly what static inspection is for. |
| `p23-13-salience` **freeze-release coupling sweep** (1 it) | S1 | A coupling sweep — every baseline-release path must also release the freeze. The frozen behaviour is proven behaviourally above it; only the sweep can fail when a *new* release path is added without its freeze release. |
| `p23-13-room-labels` **viewport plumbing** (3 its: reactivity key, gesture predicate, font-readiness invalidation) | R2–R4 | These pin viewport-internal *plumbing* (a `$state` key that must stay reactive, a predicate that must keep naming every live gesture session, a `loadingdone` hook that must not fire per frame). Replacing them means extracting that logic out of the component into its own modules — a production ownership change with its own review surface. **Deferred, not dropped** (§K.6). |
| `p23-13-icons` editor-only import pin, `p23-13-door-window` plan.css token line, `p23-13-presentation-foundation` retired-name absences, `p23-13-snap-grammar` token value + D5 owner note, all boundary/isolation sweeps | — | The correct mechanism for the invariant: token ownership in a plain stylesheet, code-path absence, an owner ruling recorded in a comment, import/package direction, unique-ownership sweeps. T2b is not a "zero source reads" project. |

### K.5 T2c — relic smoke coverage (six claims)

`tests/lib/editor/app/relic-smoke.test.ts` (13 tests, `ARCH_FILES` — every claim
is an unconditional mount/isolation guarantee, so it sits with the other durable
boundaries; its rendered mechanism is not why it is there).

1. **Route still mounts** — the route file imports the virtual entry and renders
   `<MuseumEditorEntry relic />`, never `EditorApp`; the real Vite plugin
   resolves `\0virtual:museum-editor-entry` and its default export is the frozen
   `MuseumEditorApp` (module boundary, not a substring).
2. **It mounts the relic implementation** — `MuseumEditorApp` mounts
   `EditorLeftSidebar`, not the greenfield `UnifiedProjectTree`/`EditorApp`.
3. **Frozen interactions still work** — the Paris-only focus gate refuses
   `entrance` (a real room) and accepts `paris`; a relic placement arms and
   cancels without mutating the document.
4. **Frozen transport is reachable** — the shipped `EditorCameraTimelineFrame`
   is **server-rendered** with a relic store: `relic-header`, `tour-selector` and
   the frozen `mini-player__transport`/`__timecode` appear when collapsed, and
   the relic's own ruler + PreviewControls appear when a preview is live; the
   live store renders `s4-header` with POV/Observer instead, in the same frame.
5. **Shared-store changes cannot silently retune the relic** — the Flip pair:
   the relic keeps its physical pose (sampled motion preserved) while the live
   shell resets its playhead.
6. **Current shell ownership stays isolated** — `setWorkspace('layout')` is
   refused on the relic and allowed live; `MuseumEditorApp` registers no layout
   history on a relic mount (the mount-time branch, pinned where it is decided);
   the shell focus shortcut does not reach the relic; two stores stay independent.

**Known relic gaps accounted for:** no Layout history ownership crosses into the
relic (claim 6), and the import surface stays frozen (claims 1–2 + the existing
boundary suites).

**RELIC_ONLY replacement map (annotation only — nothing deleted in T2c):**

| Old pin | Protects | Covered by smoke | Still uniquely protected? | Future deletion candidate? |
|---|---|---|---|---|
| `contracts` route-wiring relic its | relic route mounts the entry, not `EditorApp` | claim 1 | Partly — `contracts` also pins the live route's keyed session alongside it | **Yes**, after the T3a split separates the live route pins |
| `contracts` P11/tour + `p12-s4` relic-header/Ruler/PreviewControls its | frozen relic transport chrome | claim 4 | No (chrome), **yes** for `+View Key` ×2 (live-only count) | **Yes**, once `+View Key` gets its own home |
| `p12-s3` Flip-relic + `p12-s2` relic preview its | frozen transport semantics | claim 5 | No | **Yes** |
| `p11-s4` Repeat-scope relic it | frozen repeat scope | Partly (claim 5 samples the pose path; repeat scope is not asserted) | **Yes** | Not yet — needs a repeat-scope assertion first |
| placement / focus / connect its (Paris arm, IDs, yaw, microcopy) | frozen interaction surface | claim 3 | **Yes** for ID/yaw/microcopy depth | Not yet |
| `contracts` relic-isolation + P7.3 boot + live-rooms + registry its | no Layout, no re-derive, relic store entry | claim 6 | Partly | Yes for the duplicate halves only |
| `slice-c` focus-untouched it | focus isolation | claim 6 | No | **Yes** (kept as-is in T2b; T2c does not delete) |

The consolidation pass that acts on this map is deliberately **after** the smoke
has survived independently.

### K.6 Newly discovered gaps and deliberate deferrals

- **R2–R4 extraction (deferred, with the pins kept).** Replacing the room-label
  viewport plumbing needs the reason/predicate/derivation lifted out of
  `LayoutPlanViewport.svelte` into modules. That is a production ownership change
  and would widen this PR's production surface well past the two seams in §K.1,
  so it is deferred rather than half-done; each pin now says so in place. Lane:
  the architecture/ownership slices, before or with T3b.
- **The refusal lifetime has no store-level owner.** Its state, timer, arm and
  clear sites all live inside the viewport. Until that is lifted (an ownership
  change), the wiring can only be pinned statically — recorded here so the next
  slice does not mistake it for an untested helper.
- **`contracts.test.ts` still sits wholly in `ARCH_FILES`** (T3a), so the
  behavioural inner loop remains `test:fast` + `test:arch`. Unchanged by T2b.
- **C.4 items 4–6 remain open** (one-nav-graph/evaluator pin, positive
  Layout-v5/Scene-v1 ownership pins, a single editor→museum import-direction
  sweep). They are *architecture additions*, not replacements, and belong with
the T3b ownership work.
- **The pre-existing plan fixture type error** in the K-cluster test (missing
  `sillHeight`) was caught by `npm run check` on the first post-cluster run and
  fixed in commit `c245b83`; recorded here because the cluster was committed
  before the type check was re-run.

### K.7 Review round — the adapter polarity regression (EXECUTED)

An external review of PR #63 found one **real behaviour regression introduced by
this slice**. The extraction renamed the inline `!numericEntry` guard into a
named fact, and the call site passed the old negation into the new name:

```ts
numericEntryOpen: !numericEntry   // numericEntry is PlanNumericEntryState | null
```

The rule (`plan-keyboard-session.ts`) reads the fact literally —
`if (facts.key === 'Enter' && !facts.numericEntryOpen)` — so the adapter was
**inverted**: with no field open the helper saw "a field is open" and swallowed
the first Enter (no group entry, no numeric door), while a genuinely open field
looked closed. That is precisely the P23.13 behaviour the extraction exists to
preserve (first Enter enters the selected owner's group, second reaches S7's
door).

Fixed in three parts, all required by the review:

1. **Viewport mapping corrected** to `numericEntryOpen: numericEntry !== null`,
   with the polarity stated in a comment so the next reader does not re-invert it.
2. **The call-site pin now asserts polarity as an equality**, not a containment:
   `expect(body).toMatch(/numericEntryOpen: numericEntry !== null\b/)` plus
   `expect(body).not.toContain('numericEntryOpen: !numericEntry')`. The old pin
   (`toContain('numericEntryOpen: !numericEntry')`) pinned the **wrong mapping** —
   it certified the inverted adapter, which is why the regression shipped green.
3. **Mutation evidence added** (§K.3): flipping the mapping back to the inverted
   form fails exactly that pin and *nothing else* in the keyboard suites.

The transferable lesson, and it is the T2a one again: **machinery correctness
does not imply call-site correctness.** A pure decision module with a `boolean`
fact has a polarity the module cannot check for itself, and the pure suite
necessarily stayed green through the inversion. Where an extracted rule consumes
a *mapped* fact, the call-site pin must assert the mapping — including its
polarity — rather than the presence of a string that an inverted mapping also
satisfies.

### K.8 Final verification (measured)

- `npm run check` (svelte-check): **0 errors, 0 warnings**.
- `npm test` ≡ `npm run test:full`: **307 files, 4,557 tests** (4,556 pass, 1 skip).
- Partition exact and disjoint: fast 279/4,166 + arch 22/362 + heavy 1/6 +
  perf 5/23 = **4,557**, union = the full 307 files (verified by diffing the
  JSON-reporter file lists).
- Lane membership delta: `+1` arch file (`relic-smoke.test.ts`), `+3` fast files
  (`plan-keyboard-readout`, `plan-keyboard-session`, `plan-render-harness`);
  both new keyboard modules are ordinary deterministic behaviour, so they are
  **fast**, not arch.
- Test-count delta from the T2a end-state (4,506): **+51**. New tests: smoke 13,
  keyboard readout/session 21, harness 10, A-series replacements and the F1/E2
  additions the rest; the A/I replacements that deleted a source line kept a
  behavioural test in its place, so no row lost coverage.
- No product behaviour changed: all mutation targets were reverted, and the only
  production edits are the two seams in §K.1.

**Commit list (this slice, in order):** `test: prove the Plan keyboard readout
and traversal rules directly` → `test: add a node Plan render harness and prove
the A6 paint row through it` → `test: add frozen relic smoke contract` →
`test: replace A-series paint pins with rendered proof` → `test: render the Wall
state composition and snap glyphs` → `test: render the band projection and
Window frame count` → `test: prove the refusal and empty-state gate behaviour` →
`test: read the toolbar labels off the rendered toolbar` → `test: fix the
keyboard fixture type and record retained pins` → this docs commit.

## L. Execution log — T3 (EXECUTED)

Scope: **T3a** (dismantle `contracts.test.ts`), **T3b** (the four ownership
gaps), **T3c** (historical-shell + relic consolidation). T4/T5/T6 not started;
**no production code changed in this slice** (the two seams from §K.1 remain the
only production edits in the PR).

Commit list: `test: share one $lib source reader across boundary suites` →
`test: dismantle the contracts accumulator into durable homes` →
`test: pin the four ownership gaps the harvest identified` →
`test: retire relic pins the smoke now owns, and two proven duplicates` → this
docs commit.

### L.1 T3a — method

The core review rule (same feature ≠ same defect) was applied mechanically where
it could be: a **duplicate detector** parsed every `toContain`/`toMatch` in
`contracts.test.ts` with its polarity and source expression, then searched every
other test file for the *same literal with the same polarity*. That is the same
defect by construction — the string leaving that one source file. It reported
**74/716** assertions duplicated elsewhere; after adjudicating generic literals
that legitimately recur in unrelated components (`pointer-events: none`,
`aria-hidden="true"`, `<button`, `selectLayout`), **49 assertions were pruned**.
Every other assertion **moved verbatim** — nothing was rewritten, so no moved
test lost sensitivity.

Infrastructure added, and only because it deletes duplication: `tests/helpers/lib-source.ts`
owns the `$lib`/route/`readAllSourceFiles` readers that five files had each
copied. The two brand-new *test* files are boundary homes (below); the accumulator
itself is gone, so net file delta is +1.

### L.2 T3a — migration map

| Old home (describe) | New durable home |
|---|---|
| empty project contract · pinned types · zero-node policy · boot into an empty project · Plan↔3D it1 · 3 gizmo FSM fixtures · 3 cross-domain behavioural its | `project/project-codec`, `app/editor-view-state`, `store/document-store`, `app/p23-3-new-project-boot`, `editor-store-shell`, `gizmo/editor-gizmo-behavior-fixtures`, `store/selection-store` — **all `test:fast`** |
| route wiring (live its), editor-side sidebar/tree mount | **new** `app/editor-entry-boundary.test.ts` (arch) |
| single gizmo host sweeps · layout candidate session · layout 3D pick metadata · centralized 3D layout selection | **new** `gizmo/editor-gizmo-boundary.test.ts` (arch) |
| P21.1 shared shell · P21.2 tools/Delete/status/edges · P21.3 ribbon ownership · camera-context toolbar/menu/cells/rail/toolbar-composition · ceiling context seam | `app/p23-14-control-ownership.test.ts` (21 its) |
| P21.3 density/Timeline sharing · P21.5-S5 collapsed-pill geometry · P3 lanes · camera-context docking/rig-gating/G3 | `app/p23-14-camera-drawer.test.ts` |
| P21.5-S3/S4 inspector density, typography, panels, Place gate, Inspector routing · P1.5 Inspector routing · cross-domain Arrange eligibility | `app/p23-14-inspector-target.test.ts` |
| P21.5-S4 type ladder/typography sweep · P21.5-S3 field geometry | `app/p23-14-type-roles.test.ts` |
| P21.1 row-band ramp · P21.5-S4 seven-theme calibration | `app/p23-14-contrast-floor.test.ts` |
| StatusRail readout · camera 3D status readout | `app/p23-14-state-language.test.ts` |
| no-fade shells (2 its) | `app/p23-14-a11y-motion.test.ts` |
| timeline heights · S5 expanded transport / ruler timecodes / pill parity · relic tour selector · loop readout | `store/p12-s4-header-chrome.test.ts` (live transport owner) |
| frozen relic PreviewControls (+AP/AA/CH predicates) | `store/p11-s4-compact-controls.test.ts` |
| tree/CameraFlowPanel vocabulary, sequence seed, ancestor reveal, legacy roots, asset-panel selection, visibility facade | `app/unified-project-tree.test.ts` (13 its) + `app/p23-6e-hierarchy-projection.test.ts` |
| Plan SVG door/window primitives | `layout/p23-13-door-window.test.ts` |
| Camera Plan paper + P14 footprint aliases | `camera-plan/p14-camera-plan-footprints.test.ts` |
| Camera Plan ribbon order / FOV exclusion / XZ binding / live workspace | `camera-plan/camera-plan-state.test.ts` |
| camera labels · camera paths · orientation box | `camera/editor-camera-labels`, `camera/editor-camera-path`, `editor-orientation-gizmo` |
| preview affordances | `camera/editor-camera-preview-affordances.test.ts` |
| P19 persistence coordinator (5 its) | `project-persistence.test.ts` |
| snap wiring guard · AppRow cloud-error gate · save-state pill | `snap-input-validation`, `app/project-persistence-presentation` (the guard now sits with the machinery it guards) |
| Staging gesture seam | `layout/plan-scene-transform.test.ts` |
| `/museum` camera-plan-free | `museum/visitor-import-boundary.test.ts` |

**Dropped, with the owner named**: `relic isolation` and the two relic route
its (relic-smoke claims 1/6); the contracts ghost/card sketch (13 assertions
identical to `p23-13-empty`, the ghost owner).

### L.3 T3b — the four gaps (additive)

| Gap (C.4) | Pin | Mutation that fails it |
|---|---|---|
| no one-nav-graph/**evaluator** pin | `camera-core-boundary`: each camera-core route evaluator defined exactly once; the editor navigation graph is the single owner of flow semantics | a second `resolveFlowRoute` in the editor; a re-derived `flowDetourGroups` in the store |
| no positive Layout-v5/Scene-v1 pin | `p23-f0-stage1-format-policy`: the authoring pair classifies wall-first + project-world; the retired pair legacy; the mixed pair never the default | `project-world` → `legacy-room-local`; `wall-first` → `legacy` |
| no unified editor→museum sweep | `visitor-import-boundary`: no editor source imports the museum app; the shared `$lib/museum` shell stays free of editor internals | `@portfolio/museum` import in `EditorApp`; `$lib/editor` import in `MuseumShared` |
| relic import surface | `relic-smoke` §7: the relic shell never consumes the unified tree / greenfield sidebar / project API | `createProjectApi` in `MuseumEditorApp` |

Note on the third pin: the first draft swept `$lib/museum` out of the editor and
was **wrong** — the editor legitimately owns `$lib/museum` (its 3D museum
rendering shell, consumed by the visitor too). The pin was corrected to the two
directions that are actually invariants; recorded here because the false premise
is the kind of thing a mechanical sweep hides.

### L.4 T3c — consolidation performed

| Unit | Owner that now covers it | Evidence |
|---|---|---|
| `p12-s4` relic-header + tour-selector source slices | relic-smoke claim 4 | forcing the relic branch off fails the smoke (`expected … to contain 'relic-header'`) |
| `p12-s4` relic branch PreviewControls mounting | relic-smoke claim 4 | same |
| `p21.6-slice-c` relic backslash-immunity it | relic-smoke claim 6 | removing `&& !store.isRelic` fails the smoke; the retired pin no longer does (transfer verified both ways) |
| `p23-13-surrounds` theme-registry loop | `theme.test.ts` `THEME_IDS` exact list | renaming a theme id fails theme.test.ts |
| `p23-13-surrounds` Scene-ink source slice | A6 paint owner (`p23-13-object-scene-paint`) | dropping `sceneInkFor` fails the rendered A6 proof |

### L.5 Pins deliberately retained (T3c)

- **`p12-s3` relic Flip preservation.** The smoke samples *one* playhead (§K.5
  claim 5); the pin sweeps five and also asserts `direction`/`runId`/`edgeRepeat`.
  A regression that resets only at a later playhead would pass the smoke — not
  the same defect coverage, so the pin stays (the §J.4 rule, applied in reverse).
- **`p11-s4` Repeat-scope relic it.** No smoke claim asserts repeat scope.
- **`p12-s2` relic selection/preview it.** Mixed: the smoke covers the seek
  refusal, not the P11 selection scopes it also asserts.
- **`p12-s4` "does not apply live header controls to the relic store surface".**
  It is a behavioural store test, not header chrome; claim 4 renders markup.
- Everything in §K.4 (attention/refusal/latch wiring, freeze sweep, R2–R4
  plumbing) is untouched.
- **Owner-open items unchanged**: MODE pressed-fill, tray width, `12.5px`,
  `border-radius:0`, room-label never-editable home, snap D5 comment,
  surrounds block-presence home. T3 moved them with their comments intact and
  asserted no disputed value.

### L.6 Metrics (baseline = PR63 pre-T3 head `51c3586`)

| Metric | Before | After |
|---|---|---|
| test files | 307 | **308** (−1 accumulator, +2 boundary homes) |
| tests | 4,557 | **4,560** |
| test LOC | 114,665 | **114,729** (+64, +0.06%) |
| `contracts.test.ts` LOC | 2,716 | **0 (deleted)** |
| source-reading test files | 77 | **74** |
| assertions duplicated elsewhere (detector) | 74 | **0 for the dismantled set** |
| historical slice-named files removed/touched | — | `contracts` removed; `p11-s4`, `p12-s3`, `p12-s4`, `p21.6-slice-c`, `p23-13-surrounds` edited in place |

The +64 LOC are the moved code, its wrapper `describe` lines, the two new
boundary homes and the shared reader; the accumulator's 2,716 lines and 49
duplicated assertions left. The residual growth is **not** new proof — it is the
same proof in durable homes — so the consolidation is net-reductive on every
axis that matters (files −1 accumulator, source-readers −3, arch lane halved)
while LOC is flat.

### L.7 Lane changes

| Lane | Before | After |
|---|---|---|
| fast | 279 files / 4,166 | 279 files / **4,279** (+113: the behavioural core is back in the inner loop) |
| arch | 22 / 362 | 23 / **252** (contracts gone; `editor-entry-boundary` + `editor-gizmo-boundary` added) |
| heavy | 1 / 6 | 1 / 6 |
| perf | 5 / 23 (1 skip) | 5 / 23 (1 skip) |
| full | 307 / 4,557 | 308 / 4,560 |

`test:arch` now contains only unconditional boundaries — the mixed accumulator's
cheap behavioural core no longer hides there, which closes the open note carried
in §J.4.

### L.8 Verification (measured, this machine)

- `npm run check` (svelte-check): **0 errors, 0 warnings**.
- `npm test` ≡ `npm run test:full`: **308 files, 4,560 tests** (4,559 pass, 1 skip).
- Partition exact and disjoint: fast 4,279 + arch 252 + heavy 6 + perf 22 (+1 skip)
  = 4,560.
- Walls: full 38.7s, fast 34.3s, arch 10.0s, heavy 10.0s, perf 4.4s (concurrency
  caveat §H; the fast lane also carries 113 more tests than its pre-T3 state).
- Mutations: 9 T3b defers + 4 T3c owner-equivalence checks, all self-restored;
  after every batch `git status` showed only intended test edits.

### L.9 What T3 did **not** finish (carried forward)

- **P23.14 migration to rendered proof.** T3 concentrated the live shell's source
  pins into the P23.14 family rather than replacing them; the paint half already
  has a behavioural owner (the render harness), but the *shell composition*
  half (Spine/View-Bar/Tray ownership, menu row composition, status rail) is
  still source text. Replacing it needs a DOM/event harness the §K.1 server-render
  harness deliberately excludes — that is T3c's remaining substance and it was
  not attempted here rather than half-done.
- **`p23-13` paint-cluster merges** beyond `surrounds`: the A-cluster now has a
  single paint owner (A6) and per-store proof, but door-window/attention/salience
  still each carry some paint literals. Sequenced after P23.14.
- **R2–R4 room-label plumbing and the refusal-lifetime owner** remain deferred
  production-ownership changes (§K.6) — T3 found no architectural reason to
  force them.
- **RELIC_ONLY pins kept per §L.5** stay until a real successor exists.
- **No GitHub status checks** are attached to the branch head: all verification
  in this report is locally measured.

# P23B measurement-only step — action containment and the commit path

```text
STATUS:  CORRECTION PASS 1, revision 2 (2026-09-25). A clean-tree capture now
         exists, the commit path is priced, and the ranking is restored on
         measured evidence. Review finding 2 is CONFIRMED, not refuted: the
         commit's restore DOES re-derive the whole wall-mesh cache. The earlier
         "refutation" in this file was itself wrong and is withdrawn in §4.
         §7 adds the owner-extension identity pin: the object the commit hands
         the restore is a Svelte `$state` proxy of the compile's geometry, not
         the object the install cached — STATE-SIDE, so the SEQUENCE now runs
         P23B.7 before P23B.6 (order only; §6).
ROLE:    DEV-only, advisory measurement of where an accepted action's time goes,
         run before any P23B.6/P23B.7 optimization per the phase README's
         owner-authorized routing amendment (2026-09-25).
NOT:     a budget, a target, a regression gate, or a baseline. `g3-baseline.json`
         is neither read nor written here (`bench:record` remains its only
         writer); `BUDGETS` / `ENFORCED_BUDGET_METRICS` are unchanged.
```

## 0. What correction pass 1 changed

```text
F1  the commit re-installs live state; that is a leading cost, not rendering
    → CONFIRMED as location, corrected as cause. `gesture-commit` is 266.6 ms
      p50 of a 341.6 ms curved drag release (78%), and it is now three disjoint
      marks: `commit-capture` 125.5 · `commit-matches` 0.5 · `commit-replace`
      137.8. It is NOT expensive because "re-installing live state" is
      inherently costly: the reactive write of the same geometry is 0.5 ms. It is
      expensive because the restore re-derives the wall-mesh cache (§4) and the
      snapshot clone is large (§3).
F2  the 85 ms mesh install should have been nearly free; hit, miss, or two
    pooled occurrences?
    → CONFIRMED: it is a MISS. Two real builds per accepted edit, 40 Walls each,
      and the commit's is 5-6x slower per Wall than the install's. Not pooling:
      `maxPerAction` = 2 and both occurrences are visible (§4).
F3  the `self` columns compared different populations
    → fixed in code: `self` is reported only where every occurrence could be
      priced, and `selfWithheld` states how many could not. The tables in §3 are
      read with `self WITHHELD` where the marks overlap.
F4  `n` was occurrences, not actions
    → fixed in code: `total.count` is occurrences, with `actionsPresent` and
      `maxPerAction` beside it. This is what makes the two-build finding visible.
F5  rule 2 was broken by the "~490 ms unnamed" subtraction
    → removed; the qualitative claim it supported is gone with it.
F6  there was no durable source for the numbers
    → SATISFIED: this revision's capture ran on a CLEAN tree at `d48809ab` and is
      committed as `2026-09-25-release-containment-capture.json` (21,332 bytes,
      SHA-256 `c004abbd92d5bf90892f3f90b6c3bf898f546a0529b46de6bfd52beecfe3d76d`),
      carrying the per-path tables, the per-Wall build split and the raw
      intervals of three accepted actions. Revision 1's numbers remain unusable
      (dirty tree at `d9a56a2b`, no committed artifact) and are NOT reused.
F7  smaller items — the "same work one tick later" claim is gone; the P23B.8 line
    is argued from the shape of the work, not from a threshold; the all-curved
    abort keeps its coverage limit and the perturbation note in §1.
```

## 1. Provenance and coverage

```text
capture      revision 2, 2026-09-25, on a CLEAN working tree at d48809ab
             (`p23b-measurement`; the harness's own provenance reads
             `git status --porcelain` at load). Committed artifact:
             2026-09-25-release-containment-capture.json — 21,332 bytes,
             SHA-256 c004abbd92d5bf90892f3f90b6c3bf898f546a0529b46de6bfd52beecfe3d76d.
             The 20.6 MB raw containment JSON (87,698 mark occurrences) is NOT
             committed; its SHA-256 at capture time was
             3897797bbe0330cc66a37455a0b94c8b6092f50a07f8e3535e988e3fe868f2b2.
             Every node satisfies end = start + total by construction, so the
             intervals in the artifact are exact.
machine      arm64 / Apple M2 / 8 logical CPUs / 16 GB RAM · macOS 15.7.2
browser      Freebuff 0.0.147 / Chrome 130.0.6723.191 / Electron 33.4.11, DPR 1,
             viewport 1920x1200, one harness tab open (see the perturbation note)
population   warm-up excluded per path, accepted outcomes only — the interaction
             report's own rule, applied to containment
protocol     the committed `drive.ts` scripted capture, unchanged
             (25 actions per path, shared ladder 19.292586 px/m, 5 warm-up)

owner-40-curved-v1        CAPTURED  selection 20, bend-knot-edit 20,
                                    plan-drag-edit 20, wall-authoring 23,
                                    plan-pan-zoom 52 (measured, warm-up excluded)
p23b-40-wall-straight-v1  CAPTURED  selection 20, plan-drag-edit 20,
                                    wall-authoring 23, plan-pan-zoom 52
p23b-40-wall-all-curved-v1 ABORTED  the driver's own guard: "action 78 did not
                                    complete within 6000 ms". The guard was NOT
                                    raised: it is part of the protocol and
                                    comparability with P23B.0 depends on it.
```

PERTURBATION NOTE (F7). The aborted action is a wall-authoring click on the
all-curved fixture, where the P23B.0 baseline records a 1,984.8 ms p50 for that
path. The capture runs with the harness panel open and the DEV measurement switch
on — the protocol's own configuration — but a single action over 6 s is not
evidence about the path's distribution and is recorded only as a coverage limit.
One further note for the record's own reproducibility: a first attempt at this
capture ran while a second harness tab still had a scripted capture in flight;
two drivers in one browser contend for the main thread and share the fixture
projects. That attempt was discarded (never downloaded, never cited) and the
capture quoted here ran with exactly one harness tab open.

## 2. What the containment model measures

`apps/editor/src/lib/bench/p23b-containment.ts` binds each `p2311:` component
mark to the action **and outcome** whose own boundary interval encloses it, and
reports a tree per action. Rules:

1. **Containment by interval, not proximity.**
2. **Never summed.** Every figure is one action's tree or a distribution over a
   group. `total.count` counts OCCURRENCES; `actionsPresent` and `maxPerAction`
   are reported beside it, so a mark that fires twice inside one action is
   visible rather than pooled (F4).
3. **Exclusive time only where every occurrence could be priced.** `self` is
   `null` unless all of a label's occurrences in the group had disjoint, fully
   contained children; `selfWithheld` states how many could not be priced.
4. **Three visible remainders.** `unbound` = inside the action, outside all of
   its boundaries. `unattributed` = outside every action, pooled by name.
   `ambiguous` = an attachment whose two intervals are IDENTICAL (added by this
   pass), where which encloses which is not decidable from timestamps.

## 3. The commit path, priced

`PlanWorkspace.commitLayoutTransaction` captures the snapshot and hands it to the
history boundary; `HistoryController.commitLayout` compares it (`matches`) and
calls `host.replace(next)`, which runs `restoreLayoutPreviewSnapshot`. All three
are now disjoint marks inside `gesture-commit`.

```text
curved owner fixture, accepted actions, p50 ms (total; self where pricable)
                        bend-knot-edit   plan-drag-edit   wall-authoring
gesture-commit                 315.1            320.0    (authoring-release
  self                           3.3              3.2     1289.4 total)
commit-capture                 148.6            149.5     (commit-capture has
commit-matches                   0.5              0.5      no separate mark on
commit-replace                 162.6            164.8      the authoring path)
  baseline-restore             160.7            162.8             165.0
    restore-mesh-install       160.2            162.3             164.4
  restore-reactive-write          0.5              0.5              0.7
straight control fixture                                                     
gesture-commit                  —              244.3    (authoring-release 371.9)
  self                          —                1.3
commit-capture                  —              106.6
commit-matches                  —                0.1
commit-replace                  —              135.2              137.2
  baseline-restore              —              134.6              136.6
    restore-mesh-install        —              134.3              136.3
round-relevant control figures                                                
preflight-topology curved 11.1 (bend) / 11.5 (drag); straight 2.2
acceptance-compile curved 25.3 / 27.0; straight 15.1
architecture-snap-resolution curved 11.8 / 11.1; straight 3.0
```

So on the curved owner fixture a single accepted drag release is 341.6 ms p50, of
which the commit is 266.6 ms (78%). The snapshot clone alone is 125.5–149.5 ms,
and the restore 137.8–164.8 ms.

`selection` actions commit nothing (no `commit-*` marks) and instead restore a
transient baseline inside the release: `baseline-restore` 34.0 ms p50 whose
`self` is 33.9 ms — that is the reactive write, with `restore-mesh-install` at
0.0 ms. It is the same reactive-write cost the between-action restores pay.

## 4. The review's question, answered: the commit's restore MISSES the mesh cache

Revision 1 read 85–97 ms `restore-mesh-install` inside a release and the earlier
pass of this correction claimed it was not a miss, on the strength of a test whose
preview state is a plain object (the restore then hands back the very object the
compile cached). The clean-tree capture refutes that claim. Per accepted edit:

```text
wall-mesh builds, per accepted action (all three fixtures/paths agree)
  during the install (inside `plan-apply`, parent `mesh-prebuild`):
      curved bend  n=25 p50 27.2   curved drag n=25 p50 26.3   straight drag 22.8
  inside the commit (`commit-replace` → `baseline-restore` → `mesh-prebuild`):
      curved bend  n=25 p50 161.7  curved drag n=25 p50 160.7  straight drag 135.4
  each build is 40 `standalone-wall-build` marks (39/41 on some actions), i.e.
  the FULL wall set, both times.

per-Wall cost of the same work
  install-time build:   standalone-wall-build p50 0.5-0.8 ms, 40 in 3.8-4.3 ms
  commit-time build:    the same 40 Walls cost 33.9-47.0 ms (0.6-2.2 ms each)
```

Two decisive raw trees (full text in the committed artifact):

```text
curved plan-drag-edit idx=55 · span 1393.4 ms
  plan-apply [688..753] total=64.8
    mesh-prebuild [730..753] total=23.0 self=19.2
      standalone-wall-build x40 [730..753] total=3.8
  gesture-commit [753..1020] total=266.6 self=2.8
    commit-capture [753..879] total=125.5 self=125.5
    commit-matches [881..882] total=0.5
    commit-replace [882..1020] total=137.8
      baseline-restore [885..1020] total=134.4
        mesh-prebuild [886..1020] total=133.8 self=99.9
          standalone-wall-build x40 [890..1019] total=33.9
        restore-mesh-install [886..1020] total=133.9  (identical interval ->
                                                        reported `ambiguous`)

straight plan-drag-edit idx=25 · span 706.1 ms — same shape, 24.2 ms install
build and 138.1 ms commit build, both 40 Walls.
```

THE CONTROL THAT MAKES IT A MISS RATHER THAN AN UNAVOIDABLE COST: the same
restore between actions is free. The `unattributed` pool holds 75 restores on the
curved fixture and 50 on the straight one, all of them
`baseline-restore` p50 37.8 / 34.6 ms with `restore-mesh-install` p50 0.0 ms — the
meshes are reused, and the cost that remains is `restore-reactive-write`. So the
cache DOES work; the commit's restore simply passes it a geometry object it has
never seen, and pays a full rebuild in the release where a hit would cost ~0. The
commit-time rebuild is also 5–6x slower per Wall than the identical install-time
build.

WHICH IDENTITY DIFFERS — SETTLED IN §7. This section claims only the MISS, which
is measured on 100 of 100 accepted commit-path actions across two fixtures. The
identity behind it is pinned by the owner-extension probe in the RUNNING app: the
install caches the meshes under the compile's own object (`derivePreviewBundle` →
`resolveWallMeshes(result.geometry)`), while the commit's restore passes
`snapshot.geometry` — Svelte's `$state` proxy of that same compile, read out of
the live preview (`EditorApp.svelte:248` holds it in `$state(...)`). Two earlier
attempts to settle this IN PROCESS are kept as history because both failed for the
same reason: a plain-object harness reads the raw object back, and a runes helper
collapsed Svelte 5.56's `$state` to a non-reactive value, so neither could see the
proxy the app really passes. The 5–6x per-Wall gap follows from the same proxy
(every property read is trapped).

## 5. What still holds from the measurement

```text
· containment by interval, with `unbound` and `unattributed` buckets that put the
  between-action undo/re-seed restores in the fixture-cost pool instead of mixing
  them into action cost;
· `self: null` with a stated reason wherever contained marks overlap, instead of a
  subtracted guess;
· `ambiguous` (identical interval) is not a curiosity here: `restore-mesh-install`
  and `mesh-prebuild` are the same interval inside the commit, and revision 1 read
  a nesting out of that pair that the call order cannot produce;
· UN-1 re-derived by symbol: the planner, `deriveInstallBundle` and the
  preview-install commit all sit INSIDE `plan-apply`; P23B.1's line anchors are
  stale and were not used;
· the preflight ceiling corroborated: `preflight-topology` p50 11.1–11.6 ms
  (curved) and 2.2 ms (straight) per accepted move, `preflight` self 0.1–0.2 ms
  (drag) and 6.4 ms (bend with 39 curve samples) — single-digit ms against a
  release two orders larger, consistent with the recorded 1.7 / 7.8 / 9.9 ms per
  move and with P23B.5's per-drag preflight p50 8.9 ms;
· no production telemetry (the marks ride the shipped DEV + `__P2311_PERF__`
  gate) and no baseline write.
```

## 6. Ranking (restored, on the clean-tree capture)

```text
1. THE DUPLICATED WALL-MESH BUILD INSIDE THE COMMIT'S RESTORE — named first.
   p50 160.2 (curved bend) / 162.3 (curved drag) / 164.4 curved authoring /
   134.3 straight, on EVERY accepted edit (100/100), where the identical build
   during install costs 23-27 ms and the same restore between actions costs 0.0.
   The fix shape is to make the cache key agree with what the restore passes (or
   stop handing it a different identity) while KEEPING what makes the cache safe:
   fresh `Map` containers per install so reactive consumers still invalidate, the
   geometry-identity key so a stale entry can never be read for another document,
   and exact undo/redo. That is behaviour-preserving by construction: it removes
   duplicated work, not a write. It is a per-gesture commit-path fix, so under the
   ratified sequence it belongs to P23B.7 S6's family (per-gesture
   preview-install/reactive work) or to a bounded history-path fix of its own —
   NOT to P23B.6, and taking it before P23B.6 needs the sequence amended.
2. `commit-capture` — the commit's snapshot clone (project + model + issues):
   p50 149.5 (curved) / 106.6 (straight) on every accepted edit, the second
   largest named cost and independent of the mesh miss. Its only consumer is the
   history entry, so any reduction has to preserve exact undo/redo; it is named,
   not solved here.
3. THE BETWEEN-ACTION RESTORES — 75 (curved) / 50 (straight) per session at p50
   37.8 / 34.6 ms, of which `restore-reactive-write` is 37.7 / 34.6. Fixture cost,
   not action cost, and the same per-gesture family as 1 and 2. It is the largest
   pool of named time in the whole capture and it is invisible in an action-scoped
   view, which is exactly why the `unattributed` bucket exists.
4. P23B.7's gesture-scoped topology gate — NAMED, NOT FIRST: single-digit to
   low-teens ms per accepted move against a commit path two orders larger.
5. P23B.8 — no measured demand. The argument is the shape of the work
   (main-thread, reactive and Three-bound, no cross-thread split today), not a
   threshold, and not "no cost is large".
6. P23B.6 — NEITHER NAMED FIRST NOR EXCLUDED. The work in item 1 IS render
   geometry build/install, which is why revision 1 read it as rendering; but the
   cost here is a cache/identity defect on the commit path, and a renderer slice
   that does not touch that identity would leave all of it in place. P23B.6's own
   case still has to be made, and this capture does not make it.
```

ORDER RULING (owner, 2026-09-25 — applied). The identity pin in §7 is
STATE-SIDE, so the owner's pre-authorized branch amends the SEQUENCE's step 11 so
that **P23B.7 runs before P23B.6** (P23B.4 → P23B.5 → P23B.7 → P23B.6 → P23B.8).
The amendment is order only: no slice is renamed, rescoped or renumbered, and the
phase README's SEQUENCE block carries the one authoritative copy. The next step is
P23B.7's own plan/review work; P23B.7 and P23B.6 implementation remain
unauthorized until those slices are ratified. This record raises no target and
starts no optimization.

## 7. The identity pin (owner extension) — DEV-only

COMMIT: `a2692454` (`feat(p23b): add the DEV geometry-identity probe for the
commit mesh rebuild`). The capture below ran on a CLEAN tree at that commit
(`git status --porcelain` empty; the harness's own provenance confirms it), in one
harness tab, on the committed protocol: revision 3, owner-40-curved-v1 CAPTURED
(session `6c1c0396-c16e-4181-bb13-3e3e8435c493`, settled, no incomplete actions)
and p23b-40-wall-straight-v1 CAPTURED (session
`7f39158c-dce2-4a4a-8c3c-893372446089`, settled). p23b-40-wall-all-curved-v1
aborted again on the driver's own guard ("action 106 did not complete within
6000 ms") during wall-authoring, so the coverage limit in §1 stands and 2,332
probe rows were recorded. The probe itself costs one bounded row per observation
and no clone beyond the memoized `structuredClone` per unique geometry.

WHAT THE PROBE IS. `apps/editor/src/lib/editor/layout/p23b-mesh-identity.ts`,
behind the same DEV + `__P2311_PERF__` gate as every `p2311:` mark, inert
otherwise, changing no value and read by no product code. One row per
observation: phase (`install` · `install-bundle` · `capture` · `commit-replace` ·
`restore` · `prebuild-hit` · `prebuild-miss`), the geometry's identity id (a
`WeakMap` id per object), `stateProxy`, `walls`, `liveId`, `sameAsLive`,
`lastInstallId`, `sameAsInstall`. Full log →
`globalThis.__P2311_MESH_IDENTITY__`; the harness panel shows its tail and the
measurement record carries the phase counts plus the first rows.

HOW `stateProxy` IS TESTED, exactly: `structuredClone(object)` throws
`DataCloneError` for a Proxy exotic object and succeeds for the plain object
behind it, so "throws" is recorded as `stateProxy: true`. The check is memoized
per object identity and its clone is discarded. (A `$state.snapshot` comparison
was NOT used: Svelte 5.56's `snapshot` deep-clones in dev, so it never returns the
input identity and cannot answer the question.)

RESULT — one accepted rigid edit per fixture, first one after warm-up, times in ms
after the action's start:

```text
owner-40-curved-v1 · plan-drag-edit · action 50 · span 929 · commit-replace [601..688]
  t=501  install-bundle  id=52  proxy=NO   walls=40   (the compile's own object)
  t=510  prebuild-miss   id=52  proxy=NO   walls=40   (the install's build, keyed raw)
  t=524  capture         id=53  proxy=YES  walls=40   sameAsInstall=NO (lastInstall=52)
  t=601  commit-replace  marker (no geometry)
  t=604  restore         id=53  proxy=YES  walls=40   sameAsInstall=NO
  t=604  prebuild-miss   id=53  proxy=YES  walls=40   (the COMMIT's rebuild)

p23b-40-wall-straight-v1 · plan-drag-edit · action 25 · span 702 · commit-replace [527..630]
  t=240  install-bundle  id=153 proxy=NO   walls=40
  t=250  prebuild-miss   id=153 proxy=NO   walls=40
  t=266  capture         id=154 proxy=YES  walls=40   sameAsInstall=NO (lastInstall=153)
  t=527  commit-replace  marker (no geometry)
  t=528  restore         id=154 proxy=YES  walls=40   sameAsInstall=NO
  t=528  prebuild-miss   id=154 proxy=YES  walls=40   (the COMMIT's rebuild)
```

THE THREE ANSWERS:

1. **Is the geometry inside `commit-replace` the same object the install cached?**
   NO. Distinct identity ids on both fixtures (53 vs 52; 154 vs 153), and
   `sameAsInstall: false` is measured against the install that ran 23–26 ms
   earlier in the SAME action.
2. **Is either object a Svelte `$state` proxy?** The commit-time one is
   (`stateProxy: true`, by the `structuredClone` test above); the installed and
   cached one is not.
3. **Where does the second object come from?** Named by symbol:
   `captureLayoutPreviewSnapshot` (`apps/editor/src/lib/editor/layout/layout-preview-state.svelte.ts`)
   reads `state.geometry` off the live preview, and `EditorApp.svelte:248` holds
   that preview in `$state(...)` — so the read returns Svelte's deep proxy of the
   compile's object. `snapshot.geometry` is that proxy, and the commit's
   `restoreLayoutPreviewSnapshot` hands it to `installWallMeshes`, whose
   `derivedWallMeshes` entry is keyed on the compile's raw object. The proxy is
   also why the commit's rebuild of the same 40 Walls is 5–6x slower per Wall
   (0.5–2.2 ms vs 0.0–0.2 ms): every property read goes through the proxy trap.

→ The ruling is therefore **STATE-SIDE**: the top measured cost is per-gesture
commit/history work, and the phase README's SEQUENCE now runs **P23B.7 before
P23B.6** (order only — no renumbering, no scope or identity change).

PERTURBATION NOTE (revision-2 magnitudes). Revision 2's release p50s run ~40–85%
above revision 1's and the P23B.0 baseline (curved wall-authoring release 1,289.4
vs 700.3 ms; straight wall-authoring 371.9 vs the baseline's 262.6 ms), with the
DEV measurement switch on and the harness panel open. The DURABLE finding of this
section is the per-edit build COUNT and the identity it fails on — measured
identically on four fixtures/actions — not the millisecond magnitudes, which are
single-session and advisory.

## 8. Reproduction

```bash
npm run dev:editor            # DEV server on the working tree
open http://localhost:5173/dev/perf/p23b
# window >= ~1250 px wide (the shared view must fit the fixture's target box)
# ONE harness tab only — a second driver in the same browser invalidates timings
# "Run scripted capture" → then "Download measurement record JSON"
npm test -w @portfolio/editor -- tests/lib/bench/p23b-containment.test.ts \
  tests/lib/layout/p23b-measurement-marks-wiring.test.ts \
  tests/lib/editor/layout/layout-transient-preview.test.ts
```

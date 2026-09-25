# P23B measurement-only step — CLOSED (2026-09-25)

```text
AUTHORITY: NONE — closed work. The live authority for ORDER is the phase README's SEQUENCE block
           (step 11 carries the owner's 2026-09-25 order amendment); this stub only records what ran.
STATUS:    CLOSED 2026-09-25 in PR #91 (squash-merged) after the owner accepted the step —
           the identity pin and the order ruling recorded, gates green, no optimization started.
           The body was compacted to this path-preserving stub; the full record (390 lines) is
           recoverable at anchor `1d0fb220`.
ROLE:      DEV-only, advisory measurement that ran BEFORE any P23B.6/P23B.7 optimization, per the
           phase README's routing amendment and the owner's one-line extension of 2026-09-25.
NOT:       a budget, a target, a regression gate or a baseline. `g3-baseline.json` was neither read
           nor written here (`bench:record` stays its only writer); no budget metric was added.
```

## delivered

A containment model that binds every `p2311:` mark to the action **and outcome** whose boundary
interval encloses it; the priced commit path; and the DEV geometry-identity pin that attributes the
commit-time wall-mesh rebuild. It ends at a ranking and an owner order ruling — no fix, no
optimization, no product behaviour change.

## contract (what the step was authorized to do)

```text
· P23B.7 S1 extended to the wall-authoring release, PLUS P23B.6 S1 (presentation cost classes);
· tie the existing p2311 marks to the enclosing action/outcome — DONE (p23b-containment.ts);
· add DEV marks on the release path outside `plan-apply` — DONE (`selection-hit`, `gesture-commit`,
  `authoring-release`) plus the commit split (`commit-capture` / `commit-matches` / `commit-replace`);
· re-derive UN-1 by SYMBOL, never from P23B.1's line anchors — DONE: planner, `deriveInstallBundle`
  and the preview-install commit all sit INSIDE `plan-apply`; P23B.1's anchors are stale, unused;
· containment, never a sum of pooled distributions; every number advisory (one machine, one session);
· end at a RANKING, then stop for the owner;
· OWNER EXTENSION 2026-09-25: also pin which geometry identity `installWallMeshes` receives at commit
  time (DEV-only, no product change) and rule the P23B.6/P23B.7 order from it — the ruling below.
```

## the finding (durable, measured)

Every accepted edit on a commit path builds the **full 40-Wall mesh set twice**, and the second build
is a cache **MISS** — not the reactive write, not rendering per frame. p50 ms, warm-up excluded:

```text
                                     curved bend   curved drag   curved authoring   straight drag
build inside `plan-apply`                 27.2          26.3            —               22.8
build inside `commit-replace`'s restore  161.7         160.7          190.7            135.4
(the same restore BETWEEN actions hits: `restore-mesh-install` p50 0.0 over 75 curved / 50 straight)

commit path inside a curved drag release (341.6 total, 78%):
  `commit-capture` 125.5   `commit-matches` 0.5   `commit-replace` 137.8
P23B.7's gesture topology gate: `preflight-topology` 11.1-11.6 curved / 2.2 straight per accepted move
```

**The identity pin** (probe commit `a2692454`, revision-3 capture, first accepted rigid edit per
fixture) — the answer to the owner's extension:

```text
owner-40-curved-v1 action 50: install-bundle id=52  proxy=NO  -> prebuild-miss id=52
                              capture        id=53  proxy=YES sameAsInstall=NO
                              commit-replace marker
                              restore        id=53  proxy=YES -> prebuild-miss id=53   <-- the MISS
p23b-40-wall-straight-v1 action 25: identical shape (id 153 vs 154, both 40 Walls)
```

The object the commit hands `installWallMeshes` is a Svelte **`$state` proxy** of the compile's
geometry — read out of the live preview by `captureLayoutPreviewSnapshot` (`EditorApp.svelte` holds
that preview in `$state(...)`) — never the object the install cached in `derivedWallMeshes`.
`stateProxy` is tested by `structuredClone` throwing a `DataCloneError`, memoized per identity. The
5–6× per-Wall gap (0.5–2.2 ms vs 0.0–0.2 ms) follows from the same proxy.

## the order ruling (owner, STATE-SIDE — applied)

The SEQUENCE's step 11 runs **P23B.7 before P23B.6** (P23B.4 → P23B.5 → P23B.7 → P23B.6 → P23B.8).
Order only: no slice renamed, rescoped or renumbered; the phase README's SEQUENCE block holds the one
authoritative copy, written next to the P23B.3a precedent. Next work item: **P23B.7's own plan/review**
— both P23B.7 and P23B.6 implementation stay unauthorized until their slices are ratified.

## evidence

```text
capture record (this file's full body)      anchor `1d0fb220` (390 lines) — revision 2 + the pin
committed capture artifact                  .../2026-09-25-release-containment-capture.json
                                            21,332 bytes · SHA-256 c004abbd92d5bf90892f3f90b6c3bf898f546a0529b46de6bfd52beecfe3d76d
                                            captured on a CLEAN tree at `d48809ab` (one harness tab)
probe capture                               revision 3, clean tree at `a2692454`, one harness tab
sessions (revision 3)                       owner-40-curved-v1 6c1c0396-…  ·  straight 7f39158c-…
gates at acceptance                         `npm test -w @portfolio/editor` 339 passed | 1 skipped files,
                                            4,860 passed | 1 skipped tests · `test:arch` 23/254 ·
                                            `test:perf` 8+1 / 62+1 · `check` 0/0 editor AND museum ·
                                            both apps build · visitor bundle 3 server / 9 client ·
                                            baseline SHA-256 5534926e… (107,521 bytes) unchanged
limits                                      all-curved-40 aborted on the driver's own 6000 ms guard
                                            (not raised); revision-2 magnitudes run 40-85% above
                                            revision 1 and the P23B.0 baseline, so the durable result
                                            is the per-edit build COUNT and the identity, not the ms;
                                            revision 1's numbers are never reused (dirty tree `d9a56a2b`,
                                            no committed artifact)
```

## entry points

```text
implementation  containment model        apps/editor/src/lib/bench/p23b-containment.ts
                DEV identity probe       apps/editor/src/lib/editor/layout/p23b-mesh-identity.ts
                release-path marks       apps/editor/src/lib/editor/layout/LayoutPlanViewport.svelte
                commit split             apps/editor/src/lib/editor/store/history-controller.svelte.ts
                commit capture mark      apps/editor/src/lib/editor/app/PlanWorkspace.svelte
                harness + driver         apps/editor/src/routes/dev/perf/p23b/+page.svelte · drive.ts
validation      containment rules        apps/editor/tests/lib/bench/p23b-containment.test.ts
                mark wiring              apps/editor/tests/lib/layout/p23b-measurement-marks-wiring.test.ts
                probe gate + records     apps/editor/tests/lib/editor/layout/p23b-mesh-identity.test.ts
regressions     the mesh-cache key       apps/editor/tests/lib/editor/layout/layout-transient-preview.test.ts
                                         (describe "P23B measurement step — the restore path and the
                                         mesh-cache key")
```

## residuals (named, not closed here)

```text
· the duplicate build is NOT fixed — the cache key still disagrees with what the restore passes;
  that fix is the ruled P23B.7-first work (a per-gesture commit-path fix) and needs its own slice;
· `commit-capture`'s 107-149 ms snapshot clone per accepted edit is measured and unaddressed;
· the between-action restore pool (75 curved / 50 straight restores, p50 37.8 ms, `restore-reactive-write`)
  is fixture cost, measured and unaddressed;
· all-curved-40 coverage stays a limit: the capture aborts on the driver's 6000 ms action guard;
· revision-2/3 millisecond magnitudes are single-session and advisory.
```

## recovery

```bash
git fetch origin refs/pull/91/head          # squash merge: `main` does not contain the anchor
git show 1d0fb220:docs/roadmap/p23b-geometry-performance/p23b-measurement-only-step/2026-09-25-release-containment-record.md
git show closed/p23b-measurement:docs/roadmap/p23b-geometry-performance/p23b-measurement-only-step/2026-09-25-release-containment-record.md
```

## CLOSEOUT PRESERVATION — P23B measurement-only step (2026-09-25)

```text
prose compacted:                 1    stub at its own path (this record)
reference promotions:            0    the miss mechanism is owned in code (probe + cache comments) and
                                      pinned by tests; the order lives in the phase README's SEQUENCE
renderable-evidence copies:      0    none existed; the capture JSON stays LIVE at its path (21 KB,
                                      machine-readable, cited by this stub next to its SHA-256)
archive:                         0    nothing renderable moved
anchor:                          1d0fb220 (last commit with the full body) · tag
                                      `closed/p23b-measurement` · merge method squash (P1 with the
                                      recorded degradation: recovery runs through refs/pull/91/head)
checkpoint:                      none  no active checkpoint, no RESUME pointer
links repaired:                  0    nothing moved; the artifact path and the stubs keep their paths
routers agree:                   phase README (SEQUENCE step 11 + routing amendment + status) ·
                                      operations/current.md NEXT names P23B.7
implementation changed in closeout: NO (documentation only)
```

# P23B.7 S6 — the commit-path mesh identity: fix, oracle, and its own capture (2026-09-25)

```text
AUTHORITY: the ratified plan .../2026-09-22-P23B.7-interaction-optimization.md §6 S6 + §7 (S6 BUILD
           COUNT, DETERMINISTIC) and the phase README's owner-authorized execution-routing amendment
           of 2026-09-25. This record is S6's own evidence; it amends nothing.
STATUS:    S6 EXECUTED and MEASURED — fix committed (d6f65426), the mandated `$state` regression
           oracle green, and this browser capture taken on a CLEAN tree at `d6f65426` BEFORE any
           S3/S4 topology change (the plan's "NO topology change may precede this capture").
ROLE:      DEV-only, advisory measurement of the FIXED commit path, on the EXISTING containment model
           (p23b-containment.ts) and the DEV identity probe (p23b-mesh-identity.ts) — S6's own record.
NOT:       a budget, a target, a regression gate or a baseline; not S7's slice-wide re-measure.
           `g3-baseline.json` was neither read nor written (`bench:record` stays its only writer) and
           no budget metric was added.
```

## the defect and the fix, as shipped

The install cached the compile's own geometry object in `derivedWallMeshes`; the commit's capture handed
`installWallMeshes` the object the **live `$state` graph reads back** — a Svelte proxy of that compile —
so the restore's lookup MISSED and the full 40-Wall mesh set was built a second time inside
`commit-replace` (p50 135–191 ms on the committed fixtures, against 22–27 ms for the install's own build).

```text
the fix (layout-preview-state.svelte.ts)
  `wallMeshIdentities`   a WeakMap from the live-read identity (the proxy) to the COMPILE's own object
  `wallMeshCacheKey()`   resolves any incoming geometry through that map; the compile's object is the key
  `installWallGeometry()` writes `state.geometry`, then records the identity the state reads back — ALL
     writers of `state.geometry` go through it (applyCompiledLayout, commitPreviewBundle,
     commitLayoutCandidate, replaceState, and the restore in restoreLayoutPreviewSnapshotUnmeasured)
  `resolveWallMeshes()`  resolves the key FIRST, then consults `derivedWallMeshes`
what the fix deliberately does NOT change
  · the identity disagreement: the restore is still handed a proxy that is NOT the object the install
    cached — the cache agrees with the identity, never the identity with the cache;
  · the container contract: callers still receive FRESH Maps, so installing a restored baseline
    invalidates reactive consumers exactly as a rebuild did (meshes reused, containers never);
  · undo/redo CONTENT, the capture/restore round-trip, and what a release commits.
```

## the oracle, before and after (in-process, `$state`-backed, production seams)

```text
apps/editor/tests/lib/editor/layout/p23b7-mesh-identity-regression.test.ts
  pre-fix (run against the unfixed source)   "an accepted edit builds the wall-mesh set ONCE:
                                              expected 2 to be 1"          <- the defect, reproduced
  post-fix                                    pinned interval: 1 build · 1 miss (the install) ·
                                              1 hit (the commit restore)
  between-action restore                      counted SEPARATELY: 0 builds (it already hit)
  undo / redo content                         byte-identical across the committed edit
  the existing plain-state test               unchanged — a semantics pin, never this gate
```

## this capture — independent, in the browser, through the shipped seams

```text
commit d6f6542658f28a70be278a9c2ad307e38fc4fe3d · branch P23B.7 · tree CLEAN
  (the harness's own provenance reads `git status --porcelain` on load: `treeDirty: false`)
driver apps/editor/src/routes/dev/perf/p23b/drive.ts, UNCHANGED — the harness's own scripted capture,
  triggered from its own control; it drives the SHIPPED handlers with synthetic input events
protocol 25 accepted actions per path · 5 warm-up · shared ladder 19.292586 px/m (identical to the
  committed measurement-only capture) · viewport 1920x1200 · DPR 1
machine arm64 / Apple M2 / 8 logical CPUs / 16 GB RAM · macOS 15.7.2 (24G325)
browser Freebuff 0.0.147 / Chrome 130.0.6723.191 / Electron 33.4.11
coverage 3/3 fixtures CAPTURED, all settled, no incomplete actions, 0 dropped boundaries —
  owner-40-curved-v1 · p23b-40-wall-straight-v1 (no bend knot: the path is not applicable) ·
  p23b-40-wall-all-curved-v1 (the carried all-curved-40 coverage limit did NOT fire this run)
```

### the count (authoritative)

```text
204 install rows  ->  204 `prebuild-miss`  ->  204 `mesh-prebuild` builds: exactly ONE per install
                      200 of them are the 200 accepted commit-path actions' own installs, 4 are remounts
475 restore rows  ->  475 `prebuild-hit`   ->  ZERO builds
                      200 follow a `commit-replace` (the accepted edits' commit restores): 0 builds each,
                          hit immediately after in 200/200
                      275 follow a `capture` (between-action / pointer-down brackets): 0 builds each,
                          hit immediately after in 275/275
inside `commit-replace`: 0 `mesh-prebuild` marks — for 200 of 200 accepted commit-path actions
builds per accepted action: {"1": 200}   (containment ancestry: plan-apply 54 · reactive > plan-apply 71 ·
                          action root 62 · p2311:authoring-release 13; NONE under a commit)
per fixture (accepted commit-path actions / windows / edit-side builds / commit-restore builds)
  owner-40-curved-v1        75 / 75 / {1:75} / {0:75}
  p23b-40-wall-straight-v1  50 / 50 / {1:50} / {0:50}
  p23b-40-wall-all-curved-v1 75 / 75 / {1:75} / {0:75}
```

### the identity still disagrees — and the cache agrees with it

```text
of the 201 install windows that contain a restore:  100% (201/201)
  restoreProxy        true    the restore is handed a Svelte `$state` proxy
  restoreSameAsInstall false   it is NOT the identity the install cached
  restoreSameAsLive    true    it is the identity the live state reads back
  restoreHitNext       true    and the row right after the restore is a `prebuild-hit` on that identity
one accepted edit's rows (probe order) — compare the pre-fix pin, whose restore was followed by a MISS
  capture id=5 proxy=YES · install-bundle id=6 proxy=NO -> prebuild-miss id=6 · capture id=7 proxy=YES
  · commit-replace · restore id=7 proxy=YES sameAsInstall=false -> prebuild-hit id=7
  · capture id=7 · restore id=5 proxy=YES -> prebuild-hit id=5
```

### ms (advisory)

```text
`commit-replace` interval (it encloses the commit's own restore)
  before (measurement-only capture, revision 2)  p50 161.7 curved bend · 160.7 curved drag ·
                                                 190.7 curved authoring · 135.4 straight drag
  after  (this capture, pooled by path)          bend n=50 p50 1.4 p95 3.25 · drag n=75 p50 1.2 p95 2.93 ·
                                                 authoring n=75 p50 1.3 p95 3.46
  per fixture                                    owner p50 1.3 · straight p50 0.6 · all-curved p50 1.5
  inside one interval                            `restore-mesh-install` 0.0 ms, `baseline-restore` 0.3 ms
the install's own build (where the one build now lives)
  owner p50 11.9 / p95 21.5 · straight p50 13.4 / p95 16.6 · all-curved p50 23.7 / p95 27.7
the between-action restore — UNCHANGED by the fix, and it already hit
  `baseline-restore` n=75 p50 17.2 p95 36.5 · `restore-reactive-write` n=75 p50 17.2 p95 36.5 ·
  `restore-mesh-install` n=75 p50 0.0 p95 0.1  (0.0 both before and after: fixture cost, not S6)
```

## evidence

```text
capture artifact            .../2026-09-25-s6-commit-path-identity-capture.json
                            16,875 bytes · SHA-256 95790b0081d5c42b6193d7eed8f94786461f774672d1319668ace4f3e0009112
harness's own record        NOT committed — 186,080 bytes · SHA-256
                            987f335017fe231d870b4b9385158a8cbbed569cf81cff6bc4729a62474d85e2
                            (reproducible in shape, never byte-identical: identity and session ids are per-run)
sessions                    owner-40-curved-v1 fb0e0d0d-… · straight c9288abd-… · all-curved 7009d84f-…
pre-fix counterpart         measurement-only capture artifact (revision 2, d48809ab,
                            SHA-256 c004abbd…) + the pre-fix oracle run quoted above
gates at S6's commit        `npm run check` 0 errors / 0 warnings; the layout · bench · layout-core suites
                            166 files passed | 1 skipped, 2,196 tests passed | 1 skipped
```

## carried limits (named, not hidden)

```text
· ms are advisory and single-machine / single-session; the DURABLE result is the per-edit build COUNT
  and the geometry identity. The `commit-replace` gap (p50 ~160-190 ms -> p50 0.6-1.5 ms) is an order of
  magnitude beyond the 40-85% revision-to-revision drift the measurement-only step carried, so the
  attribution is the removed build — and still no ms figure here is a budget or a target.
· the all-curved-40 6000 ms action guard did not fire on this run; the limit stays CARRIED and unraised.
· this capture is S6's OWN, independent of S7 by construction; S7 re-measures slice-wide and may
  restate these numbers with more fixtures of work behind them.
· `commit-capture`'s 107-149 ms snapshot clone per accepted edit remains measured and UNADDRESSED (out
  of S6's scope, as the plan allows).
· the harness's 186 KB raw record is not committed; this distilled artifact is, following the
  measurement-only step's own convention.
```

## entry points

```text
the fix            apps/editor/src/lib/editor/layout/layout-preview-state.svelte.ts
                     `wallMeshIdentities` · `wallMeshCacheKey()` · `installWallGeometry()` ·
                     `resolveWallMeshes()` · `derivedWallMeshes`
the oracle         apps/editor/tests/lib/editor/layout/p23b7-mesh-identity-regression.test.ts
                   apps/editor/tests/lib/editor/layout/p23b7-reactive-preview-state.ts (the `$state` harness)
                   apps/editor/tests/lib/editor/layout/p23b7-svelte-internal-client.d.ts (client `proxy`)
semantics pin      apps/editor/tests/lib/editor/layout/layout-transient-preview.test.ts
                     (describe "P23B measurement step — the restore path and the mesh-cache key")
instrument         apps/editor/src/lib/editor/layout/p23b-mesh-identity.ts (identity phases)
                   apps/editor/src/lib/bench/p23b-containment.ts (marks -> action/outcome)
                   apps/editor/src/routes/dev/perf/p23b/+page.svelte · drive.ts (harness + driver)
```

## next

S3 (affected-extent derivation) → S4 (gesture-invariant verdict set, the four-cell sample/verdict matrix
and the OR-3 differential) → S5 only if S7's measurement names it → S7. S6 is closed by this record; the
preflight reference frozen in S2 and the P23B.5 absolute invariants are untouched by it.

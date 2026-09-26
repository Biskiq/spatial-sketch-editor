# P23B.7 S6 — the commit-path mesh identity: fix, oracle, and its own capture (CLOSED)

```text
AUTHORITY: NONE — closed-work stub. The live contract is owned in code (`wallMeshIdentities` ·
`wallMeshCacheKey()` · `installWallGeometry()` · `resolveWallMeshes()` in
`apps/editor/src/lib/editor/layout/layout-preview-state.svelte.ts`) and by its tests. The capture
artifact stays LIVE at its own path (machine-readable cited evidence). Full body recoverable via
the recovery line.
```

## Delivered

The commit-path duplicate wall-mesh build is FIXED: the identity a restore reads back off the `$state`
proxy is mapped to the compile's own geometry, so the commit's restore HITS the cache the install
filled. S6's own independent browser capture (clean tree at `d6f65426`, BEFORE any topology change)
shows the durable result: 200 accepted edit actions → exactly ONE wall-mesh build each, all
install-side, 0 inside `commit-replace` (204 installs → 204 builds; 475 restores → 475 hits /
0 builds; 200/200 commit restores hit immediately). The identity disagreement itself is UNCHANGED
(the restore is still handed a proxy that is not the install's object); the cache now agrees with it.

## Evidence

```text
capture artifact   .../2026-09-25-s6-commit-path-identity-capture.json — 16,875 bytes,
                   SHA-256 `95790b0081d5c42b6193d7eed8f94786461f774672d1319668ace4f3e0009112`
                   (stays LIVE; the harness's 186,080-byte raw record is NOT committed)
pre-fix counterpart measurement-only capture (revision 2, `d48809ab`, SHA-256 `c004abbd…`)
gates              `npm run check` 0 errors / 0 warnings; layout · bench · layout-core suites
                   166 files passed | 1 skipped, 2,196 tests passed | 1 skipped
```

Carried limits: ms are advisory and single-machine/single-session — the durable result is the
per-edit build COUNT and the geometry identity; `commit-replace` p50 161.7/160.7/190.7/135.4 ms →
1.4/1.2/1.3 is an order of magnitude beyond the carried 40–85 % drift; the all-curved-40 6000 ms
action guard stayed unraised; `commit-capture`'s clone remained measured-and-unaddressed in S6 (S7
priced it; the review-time fix landed separately).

## Entry points

```text
the fix            apps/editor/src/lib/editor/layout/layout-preview-state.svelte.ts
the oracle         apps/editor/tests/lib/editor/layout/p23b7-mesh-identity-regression.test.ts
                   (+ p23b7-reactive-preview-state.ts · p23b7-svelte-internal-client.d.ts)
semantics pin      apps/editor/tests/lib/editor/layout/layout-transient-preview.test.ts
instrument         apps/editor/src/lib/editor/layout/p23b-mesh-identity.ts
                   apps/editor/src/lib/bench/p23b-containment.ts
harness            apps/editor/src/routes/dev/perf/p23b/+page.svelte · drive.ts
```

## Recovery

```text
git show 2fec2e6f:<this path>          # full body (S6 record's last full commit)
git show closed/p23b.7:<this path>     # as of the accepted head
DEGRADATION (squash): branch commits are not ancestors of `main` post-merge; recovery runs via
git fetch origin refs/pull/92/head && git show <A>:<path>. tag closed/p23b.7 is local only.
```

# Three.js r186 upgrade — acceptance record

**PR:** #122 · **Branch:** `chore/threejs-upgrade` · **Date:** 2026-10-14/15 (America/Toronto).
**Baseline:** `61baf02873a63d37e3f5a3e2992396f387600d38` (PR #116 merge).
**Plan:** [implementation-plan.md](./implementation-plan.md) — this record sits beside it.

## 1. Execution route (review ratification)

Owner-authorized bounded maintenance, executed directly on the
`chore/threejs-upgrade` branch as a standalone maintenance lifecycle. No
repository phase/slice was manufactured for it, and no T-track or F-gate
state was touched. Review, acceptance, closeout and merge-commit
requirements are preserved by this record and the PR.

## 2. Dependency and code changes

| Change | Before | After |
| --- | --- | --- |
| `three` (editor + camera-core dev) | `^0.175.0` → 0.175.0 | `^0.186.1` → **0.186.1** |
| `@types/three` (editor + camera-core dev) | `^0.175.0` → 0.175.0 | `^0.186.0` → **0.186.0** |
| `camera-core` Three peer | `^0.170.0 … \|\| ^0.175.0` | same union **plus `^0.186.1`** |
| `VisitorPreviewSurface.svelte` | `<Canvas … shadows>` | `<Canvas … shadows={PCFShadowMap}>` (+ `three` import) |
| `dev/assets/+page.svelte` | `<Canvas … shadows>` | `<Canvas … shadows={PCFShadowMap}>` (+ `three` import) |
| `@threlte/core` / `@threlte/extras` | 8.5.16 / 9.21.0 | **unchanged** (same resolutions) |

`npm ls three @types/three @threlte/core @threlte/extras --all`: one
physical Three 0.186.1, every consumer deduped to it; no peer conflicts,
no `--legacy-peer-deps`/`--force`/overrides.

Lockfile delta is confined to the r186 type-package consequences the plan
predicted: `meshoptimizer ~1.1.1`, `fflate ~0.8.3`,
`@dimforge/rapier3d-compat ~0.12.0` added, `@webgpu/types` removed. No
Threlte/Svelte/Kit/Vite/Vitest/asset-tooling refresh.

No intermediate Three version was needed: no check, contract or asset
failure pointed at a revision-specific regression, so the direct r175 →
r186 migration stands. No new tests were added: the full existing suite
passes on r186 and no demonstrated regression or changed cleanup behavior
needed lasting coverage (minimal-testing principle).

## 3. Runtime

- Execution: **Node v26.7.0 / npm 11.19.0** (engines `>= 20` satisfied;
  pre-existing camera-controls `>= 22` note unchanged). No supported-Node
  policy change.
- No new CommonJS/ESM warnings: production build shows only the
  pre-existing chunk-size hint.

## 4. Automated verification (final tree)

All green on the final implementation tree:

- `npm ci` · `npm ls three @types/three @threlte/core @threlte/extras --all`
- `npm run check` (svelte-check: 0 errors, 0 warnings)
- `npm run check:camera-core` · `check:layout-core` · `check:project-model` · `check:api`
- `npm run build` (production editor build passes)
- `npm run test:arch` — 15 files, 131 tests passed
- `npm test` — 116 files, **1525 tests passed**
- `npm run test:api` — DB-backed, **zero skips, zero fails** (local Postgres via `.env` `DATABASE_URL`)
- `git diff --check` against the reviewed base — clean

Ownership/matrix/texture-source screen: no application use of
`matrixAutoUpdate`, no `Source` named import, no `Texture.source` writes,
no `Clock`/removed-API consumers — the r184–r186 changes need no app
patch, confirmed by green typechecks plus the wall-adapter, material-remap,
texture-cache, cold-runtime, public-route and dense camera suites passing
on r186 with real Three objects.

## 5. Browser verification

Paired r175-baseline vs r186 comparison under matched fixtures, camera,
lighting, dimensions (viewport 1280×1000) and DPR 1. Baseline served from
a clean worktree at `61baf02`; r186 from this branch. Fixture API: local
HTTP server on `:8787` bound through `PUBLIC_API_ORIGIN`, serving the two
retained release documents in [evidence/](./evidence/empty.json)
(`aaaaaaaa-…` empty) and [evidence/](./evidence/composite.json)
(`bbbbbbbb-…` two-node tour + box/3-light-kinds/piano/P20 texture).
Texture bytes: shipped `plaster-warm/map.png` (47,350 B, real PNG).

Environment: **HeadlessChrome 152**, WebGL2 via **ANGLE Metal, Apple M2**,
macOS 15.7.2. **Safari/WebKit not covered**: `safaridriver` is present but
session creation hangs without the interactive "Allow Remote Automation"
approval — recorded as unavailable coverage, not substituted.

| Journey | Result |
| --- | --- |
| `/dev/materials` textured + `?textures=off` | All six previews load; repeat/rotation, color-vs-data handling, fallbacks coherent. Paired diff **0.11/255** both modes. Console clean. |
| `/dev/assets`, all 7 approved GLBs | Every model reaches `ready` with metrics/bounds on r186 (piano multi-mesh, oil-lamp transmission, chandelier emissive). Focus trio paired: piano **0.48**, lamp **0.51**, chandelier **0.51** (canvas-confined; panel pixels identical). Console clean. |
| Shadow toggle (assets route) | Off/on toggles with no errors; on-vs-off diff 0.41 proves the `PCFShadowMap` path shades. No shadow warning in console on any route. |
| Model switching / placeholders | Repeated switching + revisit with no errors; placeholder desk shows fallback geometry + metrics. Direct network-failure → `failed` branch not induced (GLB cache + offline-reload kills the dev document itself); fallback render path proven, `AssetModel` untouched by this upgrade. |
| Cold `/p/:id`, empty project | Anonymous load, Version 1, zero-camera orbit copy, canvas mounts. Console clean. |
| Cold `/p/:id`, composite tour | Tour copy active; **ArrowRight guided motion** moves tour-a → tour-b (view diff 20.3); **drag free-look** changes view (28.3); reload re-boots cleanly. Paired r175-vs-r186 diff **0.24**. Console clean. |
| Viewport resize | 1280×577 → 1280×1000 mid-session, no errors, canvases adapt. |
| Surviving routes `/`, `/projects`, `/editor`, `/project/x/spatial`, `/p/x` | HTTP 200; entry/notice copy renders; no new console errors. |

Paired evidence: [evidence/](./evidence/) (`r175-*.png` vs `r186-*.png`).

### Accepted upstream differences (not regressions)

Small canvas-confined deltas (0.1–0.7/255 mean-abs) consistent with the
screened r181 PBR energy compensation and r181–r182 shadow-filtering
modernization. No missing geometry, no failed decode, no incorrect
transform, no renderer error, no ownership violation. No authored
lighting/material values were changed to compensate. No difference was
judged materially unacceptable; none is escalated.

## 6. Outstanding risks / owner decisions

1. **Safari/WebKit uncovered** (see §5). Chromium + M2 covers shader,
   texture and loading paths; WebKit-specific issues, if any, surface in
   T-track QA.
2. **No permanent browser harness added** per plan — evidence is a static
   paired set; re-verification needs the fixture recipe in §5.
3. Threlte stays at 8.5.16/9.21.0: no demonstrated incompatibility, so no
   engine change is proposed.

## 7. Closeout / merge requirements

- Head SHA to be recorded at push; **do not merge here** — owner merges
  via **Merge pull request** and verifies post-merge ancestry and recovery.
- Merge readiness: exhaustive gate green (§4), browser acceptance recorded
  (§5), diff confined to 2 manifests + lockfile + 2 canvases + this record.

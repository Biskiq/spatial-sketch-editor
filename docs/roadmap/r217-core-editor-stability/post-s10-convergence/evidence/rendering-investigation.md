# Rendering and Camera investigation

Audit base `9139f3c2`, Chromium, 2026-10-30. No production file was instrumented or fixed. Browser evaluation observed the existing renderer hook; numerical probes imported Camera-core directly. Results below distinguish reproduced causes from remaining hypotheses.

## Grid cutoff: reproduced, open

Reproduction: open `/editor`, choose Enclosed room, World/3D, Grid enabled; orbit from about 45° to 13.49° and then 87.97°. Captures are [medium](./grid-medium-3d.png), [shallow](./grid-shallow-3d.png), [overhead](./grid-overhead-3d.png), all 1280×577. This is a reduced-height diagnostic viewport, separate from the shell comparison matrix.

The actual Three Camera had near **9.90533557901168**, far **19.931301866607104**. `viewport.ts` → `depthRange(distanceMeters, sceneRadiusMeters)` bounds clip planes to the scene sphere. The finite reference mat/grid is not part of that depth envelope.

| Pose | Actual grid geometry X / Z bounds (metres) | Ground sample, inside that geometry | Clip-space result |
| --- | --- | --- | --- |
| Medium ~45° | X [-30.5,37.5], Z [-28.5,11] | Screen centre-column NDC y=.5 → [3.5,0,-10.737903589] | NDC z=1.253501533: beyond far plane |
| Same | Same | y=.9 → z≈-22.91 | NDC z≈1.7246: beyond far plane |
| Same | Same | y=0 → z=-2.5 | NDC z≈.66468: visible |
| Shallow 13.49° | X [-83.5,90.5], Z [-47.5,45.5] | y=0 → [3.5,0,-7.254046] | NDC z≈1.131277: beyond far plane |
| Same | Same | y=-.5 → z≈4.05466 | NDC z≈-.828: visible |
| Overhead 87.97° | X [-19,26], Z [-13,11] | Centre-column y=-.9/0/.9 | NDC z≈.5384/.57735/.6163: all visible |

Medium grid counted 346 minor +88 major vertices (217 segments). The sampled missing ground coordinates are **inside the existing finite grid rectangle**. Enlarging `gridRectFor()` cannot fix those samples. The mat is depth-clipped too; the similarly colored background makes the region read as ungridded ground. This is not evidence of a world mesh visibly rendering beyond its Camera far plane.

Files inspected:

- `apps/editor/src/lib/authoring/stage/stage-grid.ts`: `gridDatumFootprintFor`, `gridRectFor`, `gridPlanFor`. Four corner rays unproject near/far points but intersect the infinite ray; t>1 can be accepted outside the frustum. Hits are clamped to 24×max target-plane width/height. Fewer than two usable hits falls back to a target-centred rectangle. A horizon crossing may have visible ground not conservatively described by four valid corner hits.
- `apps/editor/src/lib/authoring/stage/shell/stage-grid-scene.ts` and `StageGrid.svelte`: finite line buffers, world anchoring, datum offset, depth-tested material; frustum culling disabled. Disabling object culling does not disable clip planes.
- `apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte`: existing finite 6000×6000 reference mat. Its size alone does not guarantee viewport coverage under current clip planes.
- `packages/camera-core/src/viewport.ts`: `depthRange` is the proven clipping source; the evaluator remains the sole projection authority.

**Bounded proposal frontier, not yet final algorithm:** Camera owns a display-ground clipping envelope separate from authored scene radius/fit. The grid consumes that same evaluated frustum and existing finite ground envelope. Compute a conservative finite plane/frustum intersection including edge/horizon cases, round bounds outward, then generate world-anchored lines under an explicit geometry budget. Do not solve by multiplying grid bounds, making an infinite grid, disabling depth tests, moving the Camera, enlarging semantic scene bounds or adding a second evaluator. The successor must resolve the exact envelope, near/far precision and budget policy in the plan before implementation; these remain O4.

Regression requirements: sampled ground points inside the finite visible ground must fall inside grid coverage **and** clip range; classify sky/behind/near/far separately. Exercise elevations 5/15/45/75/89°, azimuth quadrants/diagonals, portrait/landscape, translated targets, zoom extremes, datum changes and horizon crossing. Include actual Stage wiring, not only footprint math. Orbit/zoom screenshot sequences must show continuity to visible ground edges, no jump, no meaningful observed slowdown. Assert deterministic buffer/segment bounds; formal timing benchmarks are not a new gate.

### Runtime observation recipe

The task used this init script (not committed as runtime code):

```js
window.__BISKIQ_PERF__ = { enabled: true };
window.__BISKIQ_PERF_ON_RENDERER__ = (renderer, surface) => {
  if (surface !== 'stage') return;
  const render = renderer.render.bind(renderer);
  renderer.render = (scene, camera) => {
    window.__R217_GRID_OBSERVATION__ = { scene, camera, renderer };
    return render(scene, camera);
  };
};
```

Use `camera.getWorldPosition(camera.position.clone())`, not `camera.position`: Stage copies matrices. Inspect actual BufferGeometry positions/bounds and project the ground sample through `matrixWorldInverse` then `projectionMatrix`. Do not interpret an infinite ray-plane hit as an in-frustum hit.

## Camera flip: reproduced, open

`upForReading('plan', azimuth)` supplies `[sin(azimuth),0,cos(azimuth)]`. `viewUpForPose` uses world +Y until elevation reaches the near-overhead limit, then switches to that Plan vector. But the limiting projected world-up approaches the **negative** of that vector. The view basis reverses at the threshold.

Actual rendered near-overhead→2D frames, azimuth 0:

- Before: right [1,0,0], up [0,.00136233,-.99999907].
- Next frame: right [-1,0,0], up [0,-.0008202,.99999966].
- Consecutive right-vector dot product **-1**. Settled Plan right [-1,0,0], up≈[0,0,1].

This is a 180° roll, not evidence of a reflection. [Endpoint screenshot](./camera-plan-flip.png) alone cannot prove temporal continuity; the frame basis observation does.

The [numerical sweep](./camera-sweep.jsonl) imported current Camera-core and sampled 601 frames from 0–0.6 seconds for every combination of elevations [5,45,88]° and azimuths [0,44,46,90,179,225,315]°. Every combination had a minimum consecutive right dot close to -1. It then completed 20 settled 3D↔Plan cycles: target delta 0, scale delta 0, remembered3D elevation unchanged. Starting target [3.5,1.5,-1], target-plane height 15.2 m, scene radius 5 m, rect left 352/top 86/width 1088/height 814/DPR 1. This was a diagnostic, not a committed regression test.

The current contract intentionally snaps Plan to nearest quarter turn (ties lower) and returns to remembered3D elevation without fit; it retains the detented azimuth rather than restoring an earlier arbitrary azimuth. Do not misclassify that as numerical drift. Prototype `stage.js` is an SVG/mock Camera; it provides stable visual expectations, not an interpolation implementation to copy.

Proposed fix direction: derive one continuous basis in Camera-core and settle to its overhead limit; preserve target, target-plane scale and quarter-turn policy. Endpoint sign convention changes need O3 adjudication. Extend `apps/editor/tests/lib/museum/navigation/camera-viewport-evaluation.test.ts` with signed screen-axis continuity, not only absolute orthographic distances. Add reversal mid-transition, repeated fast switching, reduced motion, quarter-turn ties, multiple azimuth/elevation browser journeys and no source/selection/tool changes. A fresh browser test across multiple azimuths remains owed: the live trace confirmed one azimuth; the 21-pose sweep provides numerical coverage, not browser coverage.

## Selected geometry: confirmed gap and decision

`paper-marks.ts` → `geometryOf` gives Layout selection its filled Plan polygons, but Scene returns `fills: []` and contour segments only. `paper-plan.ts` already retains Scene footprint polygons; `plan-scene-footprint.ts` owns primitive/catalogue/approved model extents and native-form concave rings/tilted triangle union. Reuse those same polygons; no new picking bounds or independent footprint reconstruction.

`StageSelectionLayer.svelte` clones selected mesh geometry by canonical identity, depth-tests a MeshBasicMaterial gold overlay at opacity 0.18 and adds a strong contour/halo. Opening selection uses a synthetic box at compiled aperture width/height/sill and wall thickness+.02. It excludes hidden ancestors. The current tint is real and explicitly accepted by S07. Browser evidence covers selected Wall and primitive; Opening/native-form material behavior was inspected in code, not exhaustively exercised live.

Prototype palette in `prototypes/production-shell-wireframe/scene.js` uses mat gold #d4ad45/.28 tint; Paper dark-gold#74560c/.22 tint. Recommended starting proposal is those values on actual geometry, preserving canonical identity and neutral hover. S07 ratified 0.18 tint and deferred darker Paper ink; owner O1 must adjudicate the revision.

The completed spec must state, by Wall/Opening/primitive/model/native form and Paper/3D: exact fill/outline/opacity, depth and tone-mapping rules, contour width, overlap and aperture treatment. Preserve 3D occlusion (no x-ray fill); Paper overlays must respect the drawing/eligibility ordering rather than becoming a second hit authority. Hover stays neutral, thinner and untinted; selected identity suppresses its own hover. Do not fill an Opening as a solid Wall or replace a concave form with its bounding rectangle. Validate front/back overlapping geometry, light walls/dark mat, shaded Plan, holes and hidden/unsupported subjects.

# SL2 — Drawn Cut implementation plan

Status: implementing. Extends SL1 (`layout.slice`, PR #362) on the shipped
`ResolvedSlice`, `StageClip`, `StageSliceLayer` and Slice pill seams. No SL3
analytic Section and no second clipping architecture.

## 1. One session reading

`SliceReading` gains a discriminated `drawn` arm:

```ts
{ kind: 'drawn', start: [x, z], end: [x, z], hidden: 'left' | 'right', depthMeters: number }
```

`ResolvedSlice` gains the matching arm with a world midpoint `origin`, unit
`along`, unit `hiddenNormal`, `halfLength`, `depthMeters` and its finite
endpoints. Level keeps `cutY` / `lowerY`. `slice-reading.svelte.ts` stays the one
session store and replaces any existing reading when a segment is placed. The
reading remains session-only: no document, history, dirty state or Save path.

## 2. Predicate and GPU

The predicate is the single source of truth:

```
s = dot(p - origin, along)
b = dot(p - origin, hiddenNormal)
hidden = |s| <= halfLength && (b > 0 || b < -depthMeters)
```

CPU consumers (`sliceHides`, picking, ghost, caps) use it. GPU clipping is a
uniform-driven `onBeforeCompile` patch installed once per colour material in the
material store, with a stable `customProgramCacheKey`. A mode uniform turns it
off for Level/off, so drawing, Flip and depth changes never change the program
count. The two native SL1 planes stay attached and park at keep-all for a drawn
reading; they still realize Level without recompiling. Depth and distance
(shadow) materials are untouched, and `clipShadows` stays false.

The patch is proved on real WebGL before UI: kept/discarded pixels on both
sides and outside the finite extent, identical shadow frames, stable program
count across draw/move/Flip/depth, and no SL1/Preview/snapshot regression.

## 3. Caps and handles

Caps reuse `sectionMeshes`. A drawn reading sections on the vertical cut plane
(the plane through the segment, normal toward the visible side), clips the
returned loops and chains to the segment's planar extent, then places them
through the section basis `origin + uU + vV`; SL1's renderer and edge mapping
are generalized from a fixed Y to the full basis. The depth boundary is not
capped (SL3's triangulated Section is out of scope). `StageSliceLayer` draws
the finite cut plane, endpoint grips, the depth ray and the live proposal, and
keeps the SL1 cap scheduler/settle. Cap assembly is already known over budget;
SL2 does not add cap work to continuous gestures and reports measured behavior
rather than claiming the 4 ms budget.

## 4. Gesture and editing

A route-owned slice draw controller resolves the pointer through the existing
host-tool/Measure datum and `snapDraftingPoint`, so Wall ends, Grid/Snap and the
Wall length tag are reused. A press starts a segment; a second Slice replaces
the first. Hidden side at draw is the camera side in 3D and the segment's right
in Plan; Flip reverses it. Pressing an endpoint, the line, or the depth-ray
grip edits that handle without authoring. Depth is finite with a
`[0.1 m, far-side distance]` clamp, defaulting to the far-side distance.
Escape cancels a live draft/edit first, then Put back clears the reading.
`Put back` also disarms the drawn tool. Selection and picking filter hidden
subjects through the same predicate; wholly hidden selected subjects keep the
SL1 ghost treatment extended to the 3D pieces.

## 5. UI and arbitration

The Build > Slice plate gains Level | Drawn. Arming Slice keeps SL1's immediate
Level reading; Drawn starts the finite gesture while the plate stays open. The
Slice pill names a drawn cut and exposes Flip, depth value and Put back; Level
keeps the existing depth menu. The route remains the composition root; gesture,
predicate, geometry and picking logic live in their Stage owners.

## 6. Verification

- Focused Vitest: predicate/extent/depth/Flip, section clipping, ghost,
  picking, reading replacement, shader patch key/uniforms, gesture commits.
- `npm run check -w @portfolio/editor`, `npm run test:arch`,
  editor test lane, `npm run build`.
- Real-WebGL Playwright fixture extended from `stage-clip-entry.ts`: pixels,
  shadows, program counts, imported material, Preview and snapshot parity.
- Browser QA in Plan and 3D; record unrun checks and performance honestly.

Stop if the shader cannot be made finite/stable without a T2 contract change or
a second clipping path; record the evidence and alternatives instead of
shipping a fallback architecture.

# T2.S8 PR D — format cutover and the vertical material slice

**Status:** implementation complete on `t2/s8-pr-d-format-cutover`, based on
`main@d4598f79`. Review-ready; not merged. **The format migration is not
activated.** No saved head, pending capture or release was converted. The five
follow-up findings from review are addressed below.

## Cutover

Scene is now **12** and resources **3**; the F.2 envelope, Layout, Camera and
Experience versions are unchanged. The outgoing reader/build remains the
released predecessor, and its original bytes remain intact.

- The Scene reader accepts the new material grammar at the active stamp and
  refuses outgoing, mixed and future stamps with domain-owned issues.
- A `material` resource has `id === contentRevision === canonical recipe digest`,
  `pin: null`, `unresolved: null`, one exact `resource:material` lock requiring
  `pbr-metallic-roughness@1`, and its normalized recipe plus exactly one local
  image source per definition binding.
- Structural closure walks every definition binding and instance replacement,
  matches the Scene texture row and resource pin, and rejects duplicate IDs,
  duplicate/missing locks, mismatched revisions, missing images and unsupported
  capabilities before runtime preparation.
- `RuntimeScene.materialIndex` is the read-only `{definitions, images}` index
  prepared beside the model footprints. Stage, snapshots, detached Preview,
  Finish authoring and the cold visitor read it from there.
- Catalogue Finishes and the model-own path retain their existing records and
  semantics. Resource-backed Finishes always have project identity and cannot
  silently fall back to a curated recipe.

## Digest boundary

`@portfolio/project-model/units` exposes `verifyEnvelopeMaterialDigests` (async)
and `checkEnvelopeMaterialProof` (sync). The proof is keyed by digest **and
exact canonical recipe bytes**. A serialized `verified` flag is ignored.

- Editor admission validates structure, asynchronously hashes every recipe and
  remembers each digest-and-canonical-bytes proof in a session-owned registry.
  A new draft is prepared asynchronously before registration; the synchronous
  `scene-finish-register` planner reads only that registry, so the real adapter
  path can register a recipe the admitted source does not yet contain.
- The public release loader validates the release document and verifies its
  material digests before fetching or installing release bytes.
- API Save, Load and rename independently recompute canonical hashes; a
  disagreement is a refusal, never a repair. No extra version row or receipt is
  written for a refused document.
- Empty-material documents keep the synchronous path.

## `scene-finish-register`

The operation runs through the existing expected-revision F.4 planner and
commits one candidate containing:

- verified destination texture records/resources and the material resource plus
  its exact lock;
- the Finish instance and the optional selected target assignments;
- precise grants for the changed material, entity/surface, texture and resource
  keys and the lock delta.

It supports zero or multiple selected targets, preflights image IO/identity, and
reuses an existing identical definition and its verified pins when the full
recipe matches even under different requested local IDs. A conflicting hash,
pin, lock, capability, target revision or foreign asset refuses the whole
candidate. There is no second transaction system.

## Delivery

`materialDeliveryContribution` is a pure, sorted projection of profiles,
definitions, image pins and subject uses with resolved inputs and mapping
requirements. The cold composer:

- includes curated, override and inherited images of admitted subjects;
- requires each project texture's manifest digest, MIME and byte length to agree
  with the authored pin and downloaded bytes (a successful HTTP read without a
  digest is insufficient);
- requires static locators to pass the frozen shipped manifest;
- resolves palette literals for the capture;
- keeps native Forms in Stage/Preview and retains the cold-public refusal for
  Forms and unadmitted models.

## Follow-up review fixes

### 1. Host-owned target analysis

The registration payload's `targetFacts` is an echo for diagnostics, never
evidence. The planner now requires `options.targetAnalysis`, the host's own
`TargetAnalysis` for one exact source revision. It must name the same subject
and geometry revision, cover every selected target and reproduce exactly the
draws, UV sets and normal-frame sets the host derived. A missing, stale or
incompatible analysis refuses with `target-pending`; a caller that asserts a
fact the host did not prove refuses with `untrusted-target-facts`.

The editor analyzer (`render/materials/target-analysis.ts`) constructs the exact
native primitive geometry through `constructGeometry`, reads Layout surfaces
through their existing projection and requires an approved-derivative provider
for model facts. It does not inspect renderer state or trust the payload. The
acceptance suite includes an adversarial case: a GLB derivative with UV0 only,
and a caller claiming UV1 on it, is refused; the same call with the host-derived
UV0 set is admitted. Layout surfaces currently return no analysis and therefore
cannot be registered until their host derivation lands; that is a safe refusal,
not a fabricated fact.

### 2. Outgoing conversion revision proof

`convertScene11To12` recomputes and compares the content revision of all five
units (Layout, Scene, Camera, Experience, resources) before reading any material
or emitting bytes. A payload edited underneath unchanged headers refuses with
`content-revision-mismatch` at the affected header path. The converter never
repairs a header over bytes it has not proved. Fixture-variant tests seal their
fixtures through the same content-revision helper; the tamper test deliberately
leaves the headers stale and asserts that Scene and resources payload edits are
both refused with no document.

### 3. Visual exit

The new standalone browser gate (`apps/editor/src/routes/dev/s8-d/`) builds the
real three-image brushed-metal Finish (colour, packed ORM, NormalDX `-Y`) on a
primitive, serializes it, admits the saved bytes in a fresh session, composes
the cold release bundle from the verified PNG bytes, then draws that bundle
through the product Scene description and entity representation. Case B is the
accepted catalogue path carrying the same effective inputs through overrides.
Each capture uses a fresh browser context (empty browser cache and a fresh
editor session); the D source is a cold admission of the serialized bytes, not
the in-memory draft.

Reproduce with the editor dev server on port 5219:

```sh
S8_D_BASE_URL=http://localhost:5219 node apps/editor/scripts/run-s8-d-gate.mjs \
  --out docs/roadmap/t2-look-atmosphere/s8-professional-material-foundation/evidence/s8-d-gate.json
```

The gate requests WebGL2 (WebGPU hidden) and WebGPU, records the observed
backend and device, captures 512×512 canvas PNGs and compares every RGB channel
against the B frame. Results on this machine (Apple M2, 8 cores, ANGLE Metal
renderer, WebGPU `metal-3`, HeadlessChrome 153.0.8010.12, DPR 1):

| Backend | D frame | B frame | Mean abs | Max abs | Channels > 8 |
| --- | --- | --- | --- | --- | --- |
| WebGL2 | [`s8-d-webgl2-d.png`](./evidence/s8-d-webgl2-d.png) | [`s8-d-webgl2-b.png`](./evidence/s8-d-webgl2-b.png) | 0 | 0 | 0 |
| WebGPU | [`s8-d-webgpu-d.png`](./evidence/s8-d-webgpu-d.png) | [`s8-d-webgpu-b.png`](./evidence/s8-d-webgpu-b.png) | 0 | 0 | 0 |

Both frames show the rotated brushed pattern, proving the three sampled images
and UV transform reached the GPU on both backends. The screenshots are the
rendered canvases, not a mock-up; `evidence/s8-d-gate.json` carries the full
plans, image hashes, backend identity and raw measurements.

The same cold bundle is itself an admissible public composition: 8,477 saved
bytes, three textures, one `primitive` entity, zero Forms and zero model
placements. The existing cold-public refusal for native Forms and unadmitted
models was not weakened.

### 4. Zero-image registration

`scene-finish-register` now accepts `images: []` when the recipe has no image
bindings, instead of requiring a non-empty array. A recipe with bindings still
requires exact one-to-one image coverage. The acceptance suite registers a
constant-colour Finish with no images, assigns it, saves it, cold-admits it and
renders its resolved constants without a missing-texture diagnostic.

### 5. Browser measurements

The gate measures the actual D and B browser paths on both backends. Timings
are milliseconds from one run per backend; warm edits are 12 samples after three
warm-ups.

| Case | Build | Cold load → draw | Warm edit p50 / p90 | Motion p95 |
| --- | --- | --- | --- | --- |
| WebGL2 D | 115 | 36 | 0.2 / 0.3 | 16.7 |
| WebGL2 B | 100 | 37 | 0.3 / 0.4 | 16.7 |
| WebGPU D | 81 | 39 | 0.3 / 0.4 | 16.8 |
| WebGPU B | 42 | 37 | 0.3 / 0.4 | 16.7 |

- **First correct draw:** the cold-bundle-to-idle-and-two-frames reading is
  36–39 ms, well inside the 1 s p90 budget. The page-start total including the
  fixture build is 78–151 ms. One cold sample per backend was taken, so this is
  not a p90 claim.
- **Warm Finish editing:** p90 0.3–0.4 ms for a changed roughness constant
  through the real description and representation with cached decoded sources,
  under both the 150 ms first-use and 100 ms warm budgets. This measures update
  admission, not GPU shader completion.
- **Active motion:** p95 16.7–16.8 ms over 120 frames of a two-second camera
  orbit, about one 60 Hz display period and inside the two-period budget.
- **Resource reuse:** after the initial draw and 16 successive descriptor edits,
  live decoded texture sources remain exactly three (7,488 compressed bytes,
  786,432 decoded bytes), unchanged from first draw; geometry and material stores
  each hold one live instance with all superseded instances disposed. A
  changed roughness constant is a new descriptor key, so the store constructs a
  new sampled material and releases the old one; it does not upload a second
  copy of any image. The same description re-applied constructs nothing new.

The heavy 32-use / eight-distinct-1K-set fixture was not run; B's unchanged
sampling path and residency evidence still apply, and the numbers above are for
this one-plane gate only.

## Migration evidence

[`evidence/s8-d-conversion.json`](./evidence/s8-d-conversion.json) records the
bounded library converter (`convertScene11To12`) with the exact Scene 11 /
resources 2 source from `d4598f79`:

| Item | Result |
| --- | --- |
| Source | 29,829 bytes, `sha256-aef406451ee4129636bfa18e8a2f2ca10ffa4312862f98a2c326a812d8037a5e` |
| Dry run | success, no document emitted, 1 material / 1 texture / 7 entities / 2 assignments preserved |
| Converted | 30,030 bytes, `sha256-bfb3378a61edfeff4a57dfb7b2c117bc735e61919e3527d4b74a2db3d7d80fd8` |
| Fixture comparison | byte-identical to the committed Scene 12 / resources 3 fixture |
| Outgoing refusal | current reader reports `unsupported_format_version` on both Scene and resources units |
| Refusal cases | future Scene, mixed resource header, mixed Scene data, outgoing resource data, missing materials |

The production application does not call the converter. Activation remains an
owner-controlled decision with a restorable predecessor and an inventory of
saved heads, history, pending captures and releases.

The registered public projection of the current-world fixture is 28,593 bytes,
`sha256-044efa28a790cd75e86f29009394b987b63da7add46f28daf366367b33fc95a2`;
it removes the native Form as required by the existing P20 public refusal.

## Exit fixture

`apps/editor/tests/lib/project-model/s8-pr-d-acceptance.test.ts`:

1. registers a three-image brushed metal recipe (colour, packed ORM,
   NormalDX `-Y`) on a primitive and a Wall;
2. paints the Wall, then one Undo restores the exact post-registration bytes,
   a second removes the definition/lock/assignment, and Redo reproduces both
   exact serialized states;
3. registers an unassigned Finish, reuses its definition with different local
   image IDs without adding texture/resource rows or a second lock, and leaves
   entity assignments unchanged;
4. assigns one resource-backed rotated Finish to a primitive, a Form and a GLB
   through the D writer, proving the shared definition is not catalogue-only;
5. serializes, admits the source cold through the asynchronous ingress, and
   composes the release from that cold-admitted envelope so its image pins agree
   exactly with the manifest;
6. injects a false recipe hash, a changed target revision, a stale registration
   geometry revision, a foreign image, a valid header around a tampered recipe,
   a missing material lock and an unsupported capability. Every case refuses
   with no candidate.

The registration in that fixture is dispatched to the planner registered by the
real Scene adapter, with no injected proof: the fixture fills the session
registry through asynchronous source admission and new-draft preparation, then
lets the adapter's synchronous planner read it.

The Postgres-backed API suite additionally saves the same three-image brushed
metal definition, verifies every definition image pin, and refuses both a
missing blob and a corrupt blob without advancing the project head.

Companion suites cover the codec/converter (`scene-conversion.test.ts`, including
resolved sparse-mapping offsets, shipped staticization, palette followers and
packed components), the
pure delivery projection (`materials/delivery.test.ts`), definition image leases
for Stage (`stage-asset-leases.test.ts`), cold runtime image-pin validation and
the public release material refusal (`visitor-public-route.test.ts`). The B
characterization suite retains the shared rotated Finish on a Form and a GLB,
and the look-parity golden remains the pixel oracle.

## Verification (this branch)

| Command | Result |
| --- | --- |
| `npm run test:fast -w @portfolio/editor` | 461 files / 5,695 tests passed, exit 0 |
| targeted D acceptance, codec/converter, planner and render-boundary suites | 8 + 9 + 47 + 28 tests passed |
| `npm run test:arch -w @portfolio/editor` | 38 files / 356 tests passed, exit 0 |
| heavy renderer lane (earlier on this branch) | 11 files / 138 tests passed |
| `npm test -w @biskiq/api` (Postgres-backed) | exit 0, no failures (including Save refusal for missing/corrupt definition blobs) |
| `npm run check:project-model` | 0 errors |
| `npm run check:api` | 0 errors |
| `npm run check -w @portfolio/editor` | 0 errors, 16 pre-existing Svelte warnings |
| `BUNDLE_PROVENANCE=1 npm run build -w @portfolio/editor` | exit 0 |
| `S8_D_BASE_URL=http://localhost:5219 node apps/editor/scripts/run-s8-d-gate.mjs` | exit 0; four frames captured, both backends pixel-identical |
| `npm run perf:bundle:first-load -w @portfolio/editor` | exit 0; public route 566.5 KiB brotli, no `three` in `/` or `/projects` first load |

The fast lane includes the public-surface, prepared-reader-required, visitor
isolation, current-world fixture, material runtime and B renderer suites.

## Limits

- The visual gate is a dedicated standalone route, not the product shell's
  detached Preview chrome. It mounts the same Scene description, entity
  representation, material store and CanvasHost, but does not exercise the
  Preview panel's surrounding UI lifecycle; the preview-boundary suites still
  cover that mount.
- Cold Load in the browser is the serializer → fresh source admission →
  cold-public composer path. It does not call the cloud API in a browser. The
  Postgres-backed API suite separately covers Save/Load, definition image pins
  and refusals for missing or corrupt blobs.
- Measurements come from one Apple M2 machine and one cold sample per backend;
  no p90 for first draw, no heavy 32-use fixture and no software backend row.
  Motion is rAF cadence, not GPU timestamp queries. Warm edit timing stops at
  update admission, not shader completion. Results on other hardware remain
  unmeasured.
- Layout surfaces return no target analysis yet, so registration on a Layout
  surface refuses safely until that host derivation is added; native
  primitives and model derivatives are analyzed.
- Migration activation, saved-head inventory and owner approval are deliberately
  outside this PR.

## Review focus

Tier 2 review should check the single merge boundary: Scene 12/resources 3,
canonical-byte proof ownership, exact lock/capability closure, the
`scene-finish-register` scope grants and reuse rule, and the cold/public pin
agreement. No migration is activated by merging this PR.

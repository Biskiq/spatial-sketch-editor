# T2.S8 PR D — format cutover and the vertical material slice

**Status:** implementation complete on `t2/s8-pr-d-format-cutover`, based on
`main@d4598f79`. Review-ready; not merged. **The format migration is not
activated.** No saved head, pending capture or release was converted.

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
  remembers the proof for the exact admitted `ProjectEnvelope` in a `WeakMap`.
  The synchronous `scene-finish-register` planner reads only that proof.
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
4. serializes, admits the source cold through the asynchronous ingress, and
   composes a release whose image pins agree exactly with the manifest;
5. injects a false recipe hash, a changed target revision, a foreign image, a
   valid header around a tampered recipe, a missing material lock and an
   unsupported capability. Every case refuses with no candidate.

Companion suites cover the codec/converter (`scene-conversion.test.ts`), the
pure delivery projection (`materials/delivery.test.ts`), definition image leases
for Stage (`stage-asset-leases.test.ts`), cold runtime image-pin validation and
the public release material refusal (`visitor-public-route.test.ts`). The B
characterization suite retains the shared rotated Finish on a Form and a GLB,
and the look-parity golden remains the pixel oracle.

## Verification (this branch)

| Command | Result |
| --- | --- |
| `npm run test:fast -w @portfolio/editor` | 461 files / 5,680 tests passed, exit 0 |
| targeted D acceptance + public release after final test edit | 20 tests passed |
| `npm run test:arch -w @portfolio/editor` | 38 files / 354 tests passed, exit 0 |
| heavy renderer lane (earlier on this branch) | 11 files / 138 tests passed |
| `npm test -w @biskiq/api` (Postgres-backed) | exit 0, no failures |
| `npm run check:project-model` | 0 errors |
| `npm run check:api` | 0 errors |
| `npm run check -w @portfolio/editor` | 0 errors, 16 pre-existing Svelte warnings |
| `BUNDLE_PROVENANCE=1 npm run build -w @portfolio/editor` | exit 0 |
| `npm run perf:bundle:first-load -w @portfolio/editor` | exit 0; public route 569.7 KiB brotli, no `three` in `/` or `/projects` first load |

The fast lane includes the public-surface, prepared-reader-required, visitor
isolation, current-world fixture, material runtime and B renderer suites.

## Limits

- No hardware WebGPU/WebGL2 performance run was repeated. That B evidence is
  unchanged; this PR changes format/readers, not the sampling path. The
  deterministic B golden and current-world cold fixture pass.
- No manual browser session was used for detached Preview or a visual pixel
  comparison; those surfaces are covered by the renderer characterization,
  golden, preview-boundary and cold-composition suites.
- Migration activation, saved-head inventory and owner approval are deliberately
  outside this PR.

## Review focus

Tier 2 review should check the single merge boundary: Scene 12/resources 3,
canonical-byte proof ownership, exact lock/capability closure, the
`scene-finish-register` scope grants and reuse rule, and the cold/public pin
agreement. No migration is activated by merging this PR.

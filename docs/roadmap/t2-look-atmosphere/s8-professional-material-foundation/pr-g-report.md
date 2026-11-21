# T2.S8 PR G — transfer a Finish between projects

**Status:** implementation complete on `t2-s8-g-material-library`, based on `main@55cc54dd`.
Review-ready; **not merged**. F is independent of this branch and was not started here; U is not
started.
Authority: [plan § G](./implementation-plan.md#g--transfer-a-finish-between-projects).

## What G adds

**Codec** (`packages/project-model/src/library/material-library.ts`). Material items are the
canonical format 1 payload `{ formatVersion, kind: 'material', name, recipe }`. The content id is
the SHA-256 of the canonical bytes including the name; `recipeHash` is the portable recipe-only
revision. Save flattens a palette follower to its current literal and drops Treatment. Strict readers
refuse unknown keys, other format versions and unevaluable recipes. Image bindings cover the recipe's
distinct map digests (at most five) and carry either a project texture id or a frozen shipped URI.
`finishLibraryDraftFromScene` is the editor's Save side; it names every local image pin and reports
captured followers.

**Storage** (`apps/api/migrations/011-material-library.sql`). The existing `form_library_items`
kind check admits `material`; the same table gains the portable recipe hash and the complete
thumbnail key/hash/recipe/byte-size set. `material_library_images` has primary key
`(item_id, hash)` and exactly one of a private `object_key` or a shipped `source_uri`. Receipts and
staging reuse `library_receipts` / `library_staging` with material operation kinds. Library keys are
`library/<namespace>/<owner>/<item>/<attempt>/...`; destination keys are
`projects/<namespace>/<project>/assets/<assetId>/...`.

**Save** (`POST /library/items`). Accepts exactly `{ contentId, operationId, sourceProjectId,
payload, images }`. Ownership is derived from the session; a project image is rechecked as a ready
row of the owner's named source project. Private bytes are copied through `ObjectStore.get/put` and
verified for digest, MIME, length and PNG/JPEG/WebP signature before the transaction. The transaction
inserts item metadata, image rows and the operation receipt together; a list never observes a
partial item, and a replayed operation returns the committed summary. Payload >256 KiB, >1,000
items, >5 images or an invalid pin refuse without a row.

**List/read/thumbnail/remove.** Existing callers keep the form-only list. `?kind=material` and
`?kind=all` are explicit; summaries carry kind, format version, recipe hash, image count and
thumbnail availability. Items are immutable revisions. Read returns the canonical payload, ETag and
`X-Library-Kind`. Thumbnail GET is owner-only, private/no-store, `image/png`, ≤192×192, ≤256 KiB or
404. Thumbnail PUT takes `expectedContentId` and `recipeKey`, sniffs the PNG, decodes its dimensions
(no larger than 192×192) and refuses a stale item with 409. A missing derivative leaves the item listable and
insertable. Remove deletes item and child rows in one transaction and reclaims only keys no
committed row names.

**Insert** (`POST /library/items/:itemId/transfers`). Accepts exactly `{ destinationProjectId,
contentId, operationId }`. It rechecks item owner/revision/format and the destination owner, reuses a
matching ready destination row or stages a verified private copy, then under the destination project
lock rechecks identity, installs ready rows and records the receipt. The Finish id is
`finish-<operationId>`. A second operation gets a second Finish id while identical bytes/rows are
shared. Same id with a different body is 409; a replay after the destination saved base advanced is
409 `stale_revision`; removal during copy is 404 and nothing is installed. No destination row or
serialized destination ever names a library object key or URL.

**Editor services.** `material-client.ts` is the owner-authorized HTTP client (save, list, read,
remove, thumbnail GET/PUT, transfer) with strict response verification. `material.ts` saves an
accepted Finish and inserts one back through the ordinary F4 `scene-finish-register` intent, using
the returned recipe revision and installing the vendored texture records. The inserted item gets the
allocated Finish id; editing one inserted instance does not touch the source or the other instance.
`uploadFinishThumbnail` encodes B's fixed 192×192 `InspectionFrame` as PNG and installs it through
the pinned PUT; a failed encode/upload leaves the item on its swatch fallback. Thumbnail render
acquisition remains the caller's B/D renderer step; G owns the fixed-frame encode, bound and upload
contract.

**Docs reconciled.** `assets.md` now describes both typed items, the material payload, image
sources, thumbnail and transfer; `persistence.md` records migration 011, receipts, staging and
destination independence.

## Acceptance (G exit)

Browser gate `/dev/s8-g` (source Finish on E's real authoring adapter; real F4 coordinator,
serializer, cold admission and render description; in-memory owner/private library transport). The
two-project journey saves a palette-following three-file ORM Finish, inserts twice, edits one,
deletes the item and source project, and cold-opens the destination.

| G exit assertion | Result |
| --- | --- |
| One local material definition after two inserts | pass (`definitionCount: 1`) |
| Independent Finish ids and independent edit | pass (`finish-gate-insert-a`, `finish-gate-insert-b`) |
| Identical image hashes | pass (three pinned digests) |
| Identical lit result | pass (normalized descriptor equality; local texture ids replaced by pinned hashes) |
| Zero runtime library calls after transfer | pass (`runtimeLibraryCalls: 0`) |
| Cold-open serialized destination | pass (9,626 bytes) |
| Source/item removal preserves destination | pass (gate deletes both before cold admission) |

Details: [`evidence/s8-g-gate.json`](./evidence/s8-g-gate.json). This is a structural lit-plan and
binding check, not a rendered-pixel comparison; the gate run had no canvas/WebGPU adapter.

API/DB acceptance (`apps/api/tests/material-library.test.mjs`, real Postgres and the real
owner/bytes contract):

| Required case | Result |
| --- | --- |
| Private canonical Save; form-only list unchanged; material/all filters; ETag/kind | pass |
| Other owner's read/delete/thumbnail/transfer | pass (404) |
| Thumbnail missing → 404, stale key → 409, pinned upload → exact bytes, removal → 404 | pass |
| Insert vendors exact bytes, lost-response replay is byte-identical, changed body 409, later revision 409 | pass |
| Two concurrent inserts: two Finish ids, one shared destination row set | pass |
| Unsupported format, missing source bytes, removal during copy, upload failure before commit | pass |
| Quota refusal with no row | pass |
| Destination survives item and source-project deletion; bytes remain readable | pass |

Focused editor tests (8) cover flattening/palette capture, image pin naming, F4 installation with
the allocated id, no F4 call on refusal, a serialized destination with no transport path, kind
filtering, canonical read/refusal and exact transfer triple plus recipe revalidation.

## Verification

| Lane | Result |
| --- | --- |
| `npm run check:project-model` | pass |
| `npm run check:api` | pass |
| `npm run check` (editor) | 0 errors; 16 pre-existing warnings in 6 files |
| `npm run build:api` | pass |
| `npm run test:api` (fresh local Postgres) | 162 pass, 0 fail |
| focused API `material-library.test.mjs` | 12 pass |
| focused editor material & library suites | 4 files, 26 pass |
| `npm run test:arch` | 38 files, 357 pass |
| `npm run test:fast` (prior baseline; not re-run after final edits) | 461/466 files and 5,726/5,731 tests passed; five unrelated load timeouts (harness, stage-grid/handles/paper) passed 120/120 when rerun alone |
| `npm run build` (editor) | pass |

## Review fixes

- **Atomic staging claim/consume fencing** — library staging rows are recorded before object puts, claimed and consumed atomically inside commit transactions (`consumeStagingRows`), and expired via one atomic CTE claim-and-check query so concurrent or retried operations cannot double-consume or race a staged object.
- **`withProjectWriteLease` on transfer** — `POST /library/items/:itemId/transfers` acquires the destination project write lease around the destination mutation and receipt commit, with `handlerTimeout` and `createProjectWriteRequestSignal`.
- **`flattenFinishForLibrary` issue/name enforcement** — flattening rejects any non-empty `resolveFinish` issues and validates the assembled payload (name bounds, canonical size) through `readMaterialLibraryPayload` rather than silently dropping roles or substituting defaults.
- **`insertFinishFromLibrary` `expectedRevision` stale-editor guard** — registration captures `expectedRevision` before network IO, checks target admissibility up front, re-checks revision/project identity after IO, and refuses stale inserts without calling `host.accept`.
- **Migration 011 schema-scoped constraint check** — `011-material-library.sql` qualifies its `pg_constraint` lookups with `conrelid = 'form_library_items'::regclass` instead of matching across schemas.
- **Real palette-following + pre-cold-open source removal in `/dev/s8-g`** — the browser gate now applies `SCENE_PALETTE_SLOT_ADD` and `SCENE_FINISH_PATCH` on the source coordinator, asserts `capturedFollowers: ['palette-warm']` and flattened `#d8b48a` colour, and disposes/clears the source project alongside the library item before cold-admitting the destination.

## Deviations and limits

- **No product UI.** G exposes the codec, API, client and services; the Library/Paint journey and
  thumbnail shelf belong to U. This follows E's engineering-surface precedent.
- **Thumbnail generation is split at the renderer boundary.** B's fixed inspection job produces the
  192×192 frame; G encodes, size-checks, pins and uploads it. No new renderer cache or product
  thumbnail queue was added.
- **Browser gate transport is in-memory**, not a live API server, so the gate proves the editor
  journey and destination independence while the API tests prove HTTP, Postgres, ownership and
  bytes. The gate's lit equality is structural (descriptor with pinned hashes), not pixel identity.
- `apps/api/src/form-library.ts` keeps its filename as the generalized library dispatcher; form
  format 1, its ETag and form-only listing remain unchanged.
- F's catalogue harvest is not used. The frozen shipped manifest is the only shipped source.
- Docker was unavailable on this workstation; API tests ran against the local Postgres database
  named by `DATABASE_URL`, with an in-memory object store. No remote R2 or deployment was touched.

No unresolved G-scope defect or owner decision is open. Do not merge; do not begin U.

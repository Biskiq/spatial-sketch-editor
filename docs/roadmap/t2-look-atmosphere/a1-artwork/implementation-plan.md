# T2 A1 Artwork implementation plan

**Claim:** T2 A1 Artwork. **Review:** Tier 2, owner decision in this draft before implementation.
**Base:** main at `0ce09d70`, including [approved T2 revision 4](../README.md)
([#289](https://github.com/Biskiq/spatial-sketch-editor/pull/289)) and
[P0 Look seams](https://github.com/Biskiq/spatial-sketch-editor/pull/292).
Use the accepted [S0 Gate A evidence](https://github.com/Biskiq/spatial-sketch-editor/pull/291)
at PR head `de790254` (clean measured build `1a669fb1`) as a rendering contract. Its dev bench is still on the S0 draft.

## Goal and scope

Import one or more PNG, JPEG or WebP files from Stage drop or Library › Artwork › Import.
Successful imports appear under This project. Arm the first successful import in input order,
let the creator hang it on a wall or place it free, and let them place independent copies from
the same Library image. Select, move, turn, resize, duplicate, rename and delete the resulting
Artwork through the ordinary Stage, Index and Card. Save and reopen, and enter Visitor Preview
with the same image, dimensions, world pose and appearance. Prepare and verify immutable image
pins for future public delivery.

A2 owns framing and hanging extensions. S7 owns Light it and G1 owns grouping. The only
Artwork Studio seam is the tagged source field. Keep Trim, image replacement, credit entry,
Use as Finish, procedural/drawing sources and permanent wall hosting outside A1. The existing
Finish image path keeps its own identity and behavior.

## Owner decisions and compatibility

1. **Scene format.** Propose Scene unit 6 if A1 lands first, per D2. At rebase check
   `SCENE_UNIT_FORMAT_VERSION` and take exactly the next free version. Bump the Scene header and
   payload together through `packages/project-model/src/units/{types,envelope,validate,canonical,runtime}.ts`.
   Keep the F2 envelope, source-format epoch, Layout, Camera, Experience and Resources versions.
   The shared Scene entity codec is also used by the world-local runtime adapter. Audit all entry
   points and callers of `SCENE_WORLD_LOCAL_FORMAT_VERSION` separately. Keep its number for
   internal projection, and require the new Scene unit at persisted admission. If inspection finds
   a supported separately persisted world-local writer, bring its version policy to this review
   before changing it.
2. **Source cutover.** Apply the approved pre-baseline strict refusal to Scene 5, mixed header and
   payload, and unknown future versions. Map unsupported Scene versions to an explicit version
   error on open and Save, preserving the active editor and original cloud version. No fallback,
   implicit conversion, destructive reset or overwrite. Check whether any real trial project or
   existing durability promise is affected before merge. If one is affected, stop for owner scope
   on a bounded validated migration with preserved originals and recovery. An old application
   cannot open new Scene data. A code rollback alone will not recover those versions.
3. **Publication.** Current main has the AM-9 gap. `apps/api/src/app.ts` returns
   `prepared-reader-required` and `publication-persistence.ts` has no public release writer or
   reader. A1 implements and tests the pin and render handoff against immutable fixtures and the
   detached cold path. T4 owns the production prepared compiler/reader contract and activation.
   Confirm this boundary in review. If public end-to-end publication is required in A1, it depends
   on the T4 reader and needs a separate owner decision before implementation. Source version 6
   must never be a gate on an already supported prepared release. The legacy authored-document
   cold client is fixture/integration evidence and cannot establish cross-source-version durability.
4. **Storage and policy.** Reuse immutable P20 `texture` upload rows unchanged, with no image
   kind, transcoder or schema migration. Store oriented display dimensions in Scene and keep
   original bytes. Approve the admission limits, placement defaults and alpha behavior below.
   They are proposed implementation defaults where the baseline leaves a choice. No new runtime
   dependency. If robust decoding or the tested texture budget requires one, return to the owner.

## Authored shape and writes

- Add `SceneArtworkEntity` to the closed entity union in `packages/project-model/src/scene.ts`.
  Store exactly `{ kind: 'artwork', id, name, position, rotation, source, widthMeters }`.
  Position is the image centre, rotation uses the shared world-local Euler convention, local +Y
  is up and +Z is the image front. Source is `{ kind: 'image', assetId, pixelWidth, pixelHeight }`.
  The asset ID is the canonical P20 UUID. The dimensions are positive safe integers after
  orientation. The finite width and derived height each admit 0.001–1000 m inclusive. Height is
  `widthMeters * pixelHeight / pixelWidth`. Reject an independent height, generic scale, room,
  host, material, renderer or URL field. Initial width is 1 m clamped to the interval that keeps
  both axes legal. Width and height entry use the same scalar writer and ratio conversion.
- Persist a Scene `artworkLibrary` list (empty by default) of
  `{ assetId, name, pixelWidth, pixelHeight }`, keyed by asset ID. This records that an image
  entered the Artwork shelf, including imports that have not been hung. It avoids treating every
  P20 Finish image as Artwork and survives reopen without a new registry kind. Use canonical
  ID ordering. Require unique entries and an exact dimension match from each Artwork source to
  its shelf entry. Multiple Artwork entity IDs can point to one entry. Deleting a hanging leaves
  the shelf entry available. No independent library-removal or remote asset-delete command in A1.
  The shelf is authored source and stays out of runtime projection and release closure.
- Update `scene-codec/{parse-entities,canonical}.ts`, entity clone/resolve and Scene validation.
  Validate IDs, source discriminants, finite transforms, dimensions and shelf closure in the
  shared reader. Extend exhaustive branches in Scene planners, selection, picking, bounds and
  runtime grouping deliberately. Reject Artwork membership in clusters for this slice. Include
  Artwork in ordinary object discovery and framing bounds, with image-rectangle picking and no
  invisible support/collision solid. Avoid form/model and Finish edit paths.
- Use `createScenePlanners`, F4 acceptance and the existing Scene change-record/restore scope
  machinery. Add scoped operations for registering a completed import batch, placing a single
  hanging, and changing width. Extend existing object commands where their payloads preserve
  Artwork invariants. Rotate and translate the centre in 3D using the ordinary transform lease,
  with a subject-specific writer where a yaw-only or floor-contact command cannot express it.
  Duplicate allocates an entity ID and copies source and physical size. Never mint a new P20
  asset for placement or duplicate. Validate exact target IDs and expected revision before
  publication to history. Inverse records cover only the touched shelf entries or entity IDs.

## Import, placement and history

1. Mount import and Library through the P0 route composition. Put drop intake, the armed
   candidate and the Artwork writer in an Artwork-owned authoring module. Stage captures only
   supported file drops while World editing is active. Reuse the native file picker and Stage
   tool arbitration, including pointer capture, Escape/Select, scope changes and read-only modes.
   No accepted source write on hover. Drop arms placement once ready, just like Library Import.
2. Resolve an authenticated saved project before registration. If the draft is unsaved, require
   the normal first Save and let the creator retry the import. Do not create a hidden project or
   auto-save unrelated edits. For each file validate the MIME by bytes, the 25 MiB P20 limit,
   and a static oriented image with each edge at most 4096 px and at most 16,777,216 pixels.
   Preflight dimensions before allocating the decoded surface. Admit JPEG EXIF orientation
   exactly once across probe, size and drawing, and reject animated PNG/WebP, malformed or
   undecodable inputs. Use one shared byte-probe policy, with browser decode confirmation before
   authoring and byte-derived validation at the trusted Save/release boundary. Test grayscale,
   oriented JPEG and alpha PNG/WebP. The same original bytes serve Finish and Artwork.
3. Use `platform/project-persistence.ts` and `apps/api/src/asset-persistence.ts` for owner-scoped
   register, upload, list and content. The API currently makes a fresh ID on registration; do
   not claim digest deduplication. Reuse a ready row when verified MIME, size and SHA-256 match
   within this project. Byte equality never crosses project scope. For a mixed batch, process
   sequentially, report each refused file, and register successful shelf entries in one accepted
   action. Existing shelf entries are reused without a no-op history record. A lost upload
   response is resolved by checking the reserved row and verifying its digest before retry.
   If a different project or mode took over, abort or ignore the stale result. If F4 refuses the
   batch after upload, offer retry from the verified ready rows.
4. Evaluate the current Stage ray against canonical Layout solid faces via the existing adapter
   intersection/compiled representation. Pick the nearest visible vertical wall face, including
   the local tangent on curved walls, and disregard openings, caps and occluded hits. Orient +Z
   along the hit-side normal and offset the centre 2 mm outward. Use the active floor elevation
   plus 1.5 m for the eye line, and same-face neighbour centres as vertical and horizontal guides.
   Use a proposed 12 CSS px screen-space acquisition radius, prefer the nearest guide and break
   ties by eye line then entity ID. Derive neighbours from current position, parallel facing and
   proximity to the same compiled face. Recheck the snapped centre on the same solid face. When
   it falls in an opening or past an edge, keep the unsnapped hit; the wall remains a placement
   magnet, and overhang does not move or resize the image. For a curved face, place tangent at the
   centre and keep the quad flat. Treat wall side/face identity as session input. A wall edit
   after placement leaves the world transform intact.
5. With no eligible wall hit, follow the pointer on the horizontal plane at floor elevation plus
   1.5 m, upright and facing the evaluated camera in yaw. With a parallel ray or a plane behind
   the camera, intersect a camera-facing plane 3 m ahead through the view centre, retaining
   upright orientation. Use the existing Stage viewport/camera ray and a stable yaw fallback for
   overhead views. A failed candidate has no commit. Recompute against the current accepted
   snapshot at click; a stale or incompatible lease cancels. The ghost uses the same geometry and
   size as the accepted candidate. Placement selects the new entity and disarms the tool.
6. Scale with projected corner handles in the artwork plane, preserving aspect and the opposite
   corner during drag. Commit centre and width together in one history entry at release. Show
   centimetres live. Card width/height edits keep the centre fixed and refuse invalid entries with
   a field-level message. Drag cancellation restores the accepted state; F4 undo/redo restores
   exact source, dimensions and pose. Import batch, place, rename, duplicate, delete and each
   completed drag or confirmed field edit are separate chronological operations. Undoing shelf
   admission never deletes immutable bytes. History replay and saved versions may still need them.

## Save, reopen and release

- **Save.** Add a pure shared collector for the Artwork asset references with field paths.
  Include every shelf entry for Save. Deduplicate IDs. In `apps/api/src/save-persistence.ts`,
  verify each ID against a ready upload row in the captured project before appending a version,
  beside the existing model-pin verification. Check allowed MIME, size, SHA-256, and display
  dimensions against the bounded original bytes. Do byte probing/hash verification outside the
  project-row transaction, then recheck the verified immutable row's identity and owner-scoped
  project inside the conditional write before append. Process bounded reads sequentially and
  cancel on failure. Follow the existing operation-receipt path for retries of committed saves.
  Return a path-specific refusal for missing, foreign, pending, corrupt or mismatched content.
  Preserve the active source, dirty state and saved-base token on refusal.
- **Reopen.** Extend the guarded load paths in
  `authoring/project-session/project-session.svelte.ts`. Strictly admit the envelope first.
  Resolve and verify metadata and bytes before replacing an active project, and report a
  recoverable error with retry when a referenced image is unavailable. Read shelf metadata for
  every entry and verify bytes sequentially. Retain decoded textures only for active render
  consumers. Preserve the current source and resource scope if preparation fails. No fallback
  to a logical URI fetch or public copy. If a directly opened project cannot hydrate, show its
  blocking load error without presenting an empty editable replacement.
- **Visitor Preview.** At `experience-preview.svelte.ts` capture the accepted Scene reading and
  resolve its placed Artwork images in a detached read-only scope, then pass the scope and runtime
  projection through `VisitorPreviewSurface.svelte`. Reuse already verified bytes when available.
  Block entry with a retryable notice if closure fails. Retire a superseded Preview preparation
  when the project or run changes. Preview includes no shelf, ghost, handles or editor stores.
- **Release preparation seam.** Collect the union of P20 image IDs referenced by placed Artwork
  and the existing admitted texture closure, keyed by canonical ID and ordered deterministically.
  Exclude unplaced shelf entries. Reuse the same manifest entry when an Artwork and a Finish use
  the same ready asset. The trusted preparer reads only the target project's ready rows and
  verifies the stored objects (MIME, length, SHA-256 and Artwork display dimensions), then binds
  one immutable delivery pin per asset with ID, MIME, length, hash and the exact private object
  locator or retained delivery copy. Prepared visitor data needs only entity ID, world pose,
  size/ratio and the delivery asset key for an Artwork. T4 owns that descriptor's version and
  how retained objects are physically committed and served. Missing or changed objects block
  preparation. Later authoring edits never rebind an earlier release pin.
- **Cold verification.** Extend the fixture/integration path in `visitor-cold-runtime.ts` and
  `public-release-client.ts`. Validate that every Artwork asset key resolves to a same-release
  manifest entry. Reuse version-qualified fetch and MIME/length/SHA checks, then validate
  the image dimensions before creating the read-only scope. Resolve the validated UUID to
  `/project-assets/{assetId}` as an internal lookup key. Missing, mismatched or foreign-version
  bytes fail bootstrap before rendering. Keep the existing native-form publication refusal
  and all current publish/public route behavior. Add a fixture with two releases where newer
  authoring changes image or pose and the older package still uses its own immutable pins.

## Rendering and resource ownership

- Extend `visitor/VisitorEntityGroups.svelte`, already shared by Stage via
  `authoring/stage/shell/StageEntities.svelte` and by visitor rendering via
  `visitor/VisitorEntities.svelte`. Render one centred unit-UV quad scaled to the evaluated
  width/height. Use a visitor-safe component and an explicit scoped resolver. The Stage owns
  its authoring adapter for that resolver. Visitor components never access project credentials,
  session upload state or the default editor texture source.
- Use white `MeshLambertMaterial` and an sRGB map, with linear working space, sRGB output,
  `NoToneMapping`, exposure 1.0 and the existing PCF shadow pipeline. Use no environment
  map, emissive contribution or PBR Finish properties. Keep existing light rigs and Paper/Living
  policy. Gate A measured a neutral reference, so actual appearance follows the scene lights.
  A later global tone mapper needs Gate B evidence and an owner D16 decision. Snapshot parity
  and the E6 readback correction stay with S0.
- Use a front-facing quad and preserve fractional source alpha in the colour pass. For images
  with alpha use transparent blending and disable depth writes, with existing opaque occlusion
  and Three transparent sorting. Verify overlap and edge halos. Supply matching alpha-mapped
  depth and distance shadow materials for directional/spot and point lights, with a 0.5 shadow
  cutoff as the proposed binary shadow approximation. It preserves the silhouette but does
  not simulate fractional transmission. Use an opaque depth-writing pass for fully opaque
  images. Respect the existing shadow enablement and receive lighting/shadows where enabled.
- Key image leases by scope and verified asset ID/hash, including whether the decoded image has
  any alpha below 1. Share in-flight loads and resolved textures within that scope and release
  them at the last reference. Keep geometry, material and shadow-material lifetimes tied to
  the component or lease. Use the scoped conventions in `museum/materials/texture-cache.ts`
  and `visitor/visitor-texture-scope.ts`, auditing disposal before reuse. Give Artwork an
  explicit bounded scope if the Finish cache retains sources beyond the last consumer. Revoke
  temporary URLs, close decoded bitmaps and dispose GPU objects on final release or failed
  preparation. A late completion after cancellation must dispose its result. Stage unload,
  project switch, Preview exit and cold unmount retire only their own scope. Upload retries,
  undone imports and discarded ghosts do not trigger remote deletion. P20 owns retention and
  project cleanup.

## Implementation order and verification

1. Land the reviewed Scene shape, canonical and validation changes, asset reference collector,
   scoped writers and exact restore behavior in the A1 draft. Add codec tests for v5 refusal,
   mixed headers, unknown keys, UUID/size limits, invalid dimensions, shelf closure, clusters,
   canonical hash stability and world-local projection. Test legacy model/form/primitive/light
   behavior with updated current-format fixtures. Keep historical rejection fixtures historical.
2. Wire P20, Save, and reopen before exposing the import surface. Cover mixed batches, already
   ready image reuse, stale project and revision, MIME spoofing, animation and EXIF, failed
   retry, wrong-project IDs, failed Save atomicity, and failed reopen preserving current work.
   Test first Save required, import without placement across reopen, and one asset shared by
   two independently editable hangings and a Finish.
3. Add Stage intake, Library, placement, Card, Index, marks and shared drawing. Cover
   roomless/curved walls, either face, openings, nearest-hit priority, eye-line/neighbor ties,
   free placement, wall move independence, ratio edits, cancel, and exact undo/redo. Cover
   transform history for centre plus size and pointer arbitration with existing Scene tools.
4. Add Preview and cold fixtures. Test missing/corrupt pins, deduplication, immutable delivery
   across saves, preview and Stage parity, visitor isolation, stale decode and final release
   disposal. Verify public routes retain their gap responses. Re-run the neutral Gate A chart
   against the production Artwork material using the Gate A default-framebuffer basis
   (mid-tone mean ΔE00 ≤ 2, near-black ΔE00 ≤ 3, monotonic ramp and no clipping), then inspect a
   real photo and a transparent image under neutral and coloured light. Check alpha edges,
   shadows and parity in Stage/Preview with the same saved environment and matched view.
5. At implementation review, use the focused contract and integration checks, API persistence
   coverage with configured Postgres, architecture boundaries and affected lanes in
   [the editor test contract](../../../../apps/editor/tests/README.md). Use focused manual visual
   acceptance and record findings on this PR. This planning commit has no runtime verification.
   Promote the enduring Scene, asset and persistence invariants before merge and retire this plan
   per the repository workflow.

## Parallel ownership

| Surface | Coordination |
| --- | --- |
| P0 `look-authoring.svelte.ts`, spatial route and Stage shell | A1 owns Artwork intake, candidate marks, shelf and writer. S3 owns emitter tools, marks, and Light Card/Index. Each keeps feature state in its own module. Compose contributions by entity kind through the existing P0 seams. In shared mount points the second landing rebases, retains the first contribution and verifies both together. |
| Scene union, planner dispatch, render entity grouping and lighting | A1 owns the Scene bump and Artwork branches. S3 owns Light operations and light realization. Share the ordinary acceptance/selection/render entry points. S3 plans no format bump. If it lands after A1, rebase its fixtures on the admitted Scene format. Neither branch takes a lighting rig or renderer change on behalf of the other. |
| Layout hit geometry and reference docs | T1 owns Layout representation and format, including curved and closed-wall semantics. A1 consumes compiled hit facts and owns only Artwork placement policy. If hit data is insufficient, agree a Layout-owned query with T1 before implementation. Rebase persistence/architecture edits over T1 A0 [#293](https://github.com/Biskiq/spatial-sketch-editor/pull/293) when promoting A1 rules. |
| Release and renderer evidence | T4 owns activation and versioned prepared delivery. S0 owns Gate A evidence and later Gate B/C work. A1 owns Artwork pins, image rendering and its acceptance evidence. |

Record shared-file agreements on the affected drafts before implementation. At rebase, check
S3 and T1 claims again and resolve overlaps before changing a shared mount or contract.

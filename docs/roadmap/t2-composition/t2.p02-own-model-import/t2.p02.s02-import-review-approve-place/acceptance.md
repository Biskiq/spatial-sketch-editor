# T2.P02.S02 — acceptance record: Import, review, approve and place

**Slice:** T2.P02.S02 · **Status:** implemented on `t2/p02-s02-import-review-approve-place`;
implementation-PR merge gate green; **awaiting owner acceptance** (not merged, not `accepted`) ·
**Plan:** [implementation-plan.md](./implementation-plan.md) (owns the scope and criteria) ·
**Phase:** [T2.P02](../README.md) · **Register:** [phase slice register](../README.md#slice-register)

This record claims only what ran. Every unrun row below is explicit. Nothing here is
`T2.P02.S03`'s integrated final gate, phase close or track completion.

Authorization: [post-Batch-E owner release](../../../../reference/decisions/post-batch-e-authorization-2026-10-23.md).

## Tested revision and environment

- **Trusted base:** `main` @ `fff7dc14` (post-Batch-E coordination merge). Start step recorded in the
  [T2 baton](../../../../operations/t2-composition/current.md) with eligibility and cycle check.
- **Tested tree:** that base plus this slice's diff — 24 modified files and 14 new files, 4,835
  insertions / 147 deletions before the documentation edits on this page (the browser run added one
  test file and three source edits on top of the first commit). The PR head is the same tree plus
  this record.
- **Machine:** owner's MacBook Air M2 / 16 GB, macOS (local checkout). Node/npm per the repository
  lockfile; Playwright browsers as installed by the harness.
- **Databases:** DB-backed API evidence used the lane's own Compose stack —
  `BISKIQ_STACK=biskiq-t2 BISKIQ_DB_PORT=5434 BISKIQ_API_PORT=8788`, migrations applied, target
  `postgresql://biskiq:biskiq@localhost:5434/biskiq`. No sibling lane's database was used or reset.
  `stack:up` needed `R2_OBJECT_NAMESPACE` supplied for the migrate service; the API tests ran against
  the S01 object-store contract, not real R2.
- **Viewport / reduced motion:** the browser journey below ran at 1600 × 1000 in headless Chromium with
  default motion; narrow desktop, keyboard-only and reduced motion remain unrun (see unrun rows). The
  shipped shell's own acceptance is owned by T1 and was not re-run here.

## Criteria and results

| Plan criterion | Result | Evidence |
| --- | --- | --- |
| Review observed vs admitted content; parts/clips/variants observed, never admitted | **Pass (contract)** | `tests/lib/authoring/scene-import-ingest.test.ts` — node/empty/mesh tally, `admitted` block is `whole-object` with `observed-not-admitted` for parts/clips/variants |
| Node hierarchy preserved node-for-node; one pivot root is the only addition | **Pass (contract)** | same file: every source node recorded with mesh/empty answer, `creator-import-pivot` present in the written derivative, node count unchanged |
| Confirmed metric scale/pivot applied exactly once; footprint/contact agree with the bytes | **Pass (contract)** | same file re-reads the encoded derivative through meshopt and compares `getBounds` with the report's footprint/contact; the scaled run moves both by the declared factor and leaves source bounds unmodified |
| Retained source bytes/hash, recipe identity, report digest | **Pass (contract)** | same file: per-file `sha256` of the exact captured bytes, `creator-import@1` v1, deterministic digest over the canonical report |
| Refusals install nothing, in words | **Pass (contract)** | same file: two roots, non-glTF format, lone media file, missing local buffer, external URL, unsupported required extension, malformed bytes, empty model, invalid scale/pivot, cancel — each a distinct code with a message naming the cause |
| Source ≤ 50 MiB, derivative ≤ 25 MiB | **Pass (source bound); derivative cap unrun** | source cap proven before any read; the derivative cap is a plain length check after write and was not exercised with a >25 MiB derivative |
| Lazy worker; decoders only for sources needing them | **Pass (build evidence)** | `npm run perf:bundle`: `_app/immutable/workers/worker-*.js` (247.0 KiB) and its two chunks (111.0 / 103.4 KiB) plus Draco/Basis assets are listed under *“emitted but in no product/dev route load set”*; the `/project/[projectId]/spatial` load set excludes them. Decoder *use* (Draco/KTX2 sources) is unrun |
| Approval outside authored history; exact pins frozen | **Pass** | `scene-operation-acceptance.test.ts` — approval data is not in the envelope; the accepted candidate's resource pin/lock verbatim from the server answer |
| First placement installs resource + exact lock + entity as one accepted result | **Pass** | same file: one `accept` writes `model` resource, one `resource:model` lock at the pin hash and the entity; envelope validates; the original envelope is untouched |
| Undo removes that result atomically; Redo restores it | **Pass** | same file: Undo returns the admitted canonical JSON (no resource, no lock, no entity); Redo restores the same pins and entity id |
| Later instance reuses pins, adds distinct identity | **Pass** | same file: second placement omits the introduction, yields one resource, one lock, two entities sharing `assetId` |
| Refusal changes none of them | **Pass** | same file: mismatched resource/definition, duplicate introduction and stale metadata identity each reject with an unchanged canonical JSON |
| Resource and definition must agree about the approved object | **Pass** | `planners.ts` compares confirmed footprint/contact and the definition's provenance digest with the introduced payload; `model-resource-admission.test.ts` covers the translation, `scene-operation-acceptance.test.ts` the mismatch refusal |
| A real textured source survives import → approve → place → Save → reopen | **Pass (browser)** | One 2 m box with a 2050 × 2050 map: review reported `1 nodes · 1 meshes · 12 triangles · 1 textures`, `Textures capped at 2048 px: 1 reduced`, footprint 2.000 × 2.000 m, contact 0.000 m. The uploaded derivative (21,540 bytes) decodes to nodes `paint-box` + `creator-import-pivot` and a `image/webp` 2048 × 2048 texture. The model rendered in 3D, Save persisted it, and a fresh load rendered it again from the pin. |
| Saved project holds resource + lock + entity for that placement | **Pass (API read)** | `GET /projects/:id` on the saved row: one `model` resource with a `sha256-…` pin (mime `model/gltf-binary`, 21,540 bytes), one `resource:model` lock at the same hash, one `kind: 'model'` entity naming that resource. |
| Contact/Plan/render agreement for an approved model | **Pass (unit)** | `scene-model-render.test.ts`: Plan draws the confirmed footprint and rotates with yaw; the session's contact answers come from the envelope; Resize/Duplicate are offered only with an approved contact. Rendered pixels unrun |
| Two instances share one immutable resource; independent identity | **Pass (unit)** | same file: one fetch and one object URL per hash with a reference per instance; disposal releases exactly the acquired references; a second resolution acquires again |
| A failed model is reasoned, not dressed as loaded | **Pass (unit)** | same file: failures are reported per resource; the route shows the first reason in its status note |
| Cancel/stale/replaced session cannot install | **Pass (unit) + review-fixed** | session generation is bumped by `cancel()` and `dispose()` and checked after every awaited API step; the instrument arms only from an `approved` state |
| Visitor/Preview boundary unchanged; `/p` catalogue-only | **Pass (static)** | no visitor module imports authoring code; Preview receives only a `ReadonlyMap<string, string>` prop; `/p/[publicationId]` passes none. Boundary suites in the arch lane pass |
| Placement never mutates Layout | **Pass** | planner installs `scene` + `units.resources` + `dependencyLock` only; Layout reads stay through `resolveSceneSupport` |
| No edit to `scene-planning/frame.ts` (S05 owns it) | **Pass** | the file is absent from this diff |

## Commands and results

All commands from the repository root unless noted; each ran on the tested tree.

| Command | Result |
| --- | --- |
| `npm run check:project-model` | pass, 0 errors |
| `npm run check` (editor, svelte-check) | pass, 0 errors, 0 warnings |
| `npm run check:api` | pass (no API source changed) |
| `npm run test` (full unconditional suite, the merge gate) | **186 files / 2,414 tests passed** |
| `npm run test:arch` | 22 files / 176 tests passed |
| `npm run test:heavy` | 9 files / 125 tests passed |
| `npm run test:fast` | 155 files / 2,113 tests passed |
| `npm run build` | pass (`vite build`; worker emitted as its own ES chunk) |
| `npm run perf:bundle` | pass; Import/decoder chunks outside every route load set (numbers above) |
| `npm run test:api:stack` (`BISKIQ_STACK=biskiq-t2`, DB port 5434) | 95 pass, 0 fail, **0 skipped** |

**Load-sensitive timeouts observed and re-run clean.** While a sibling lane's Playwright perf run
held the machine (load average ~45), five files exceeded the 5 s per-test budget — always as
`Test timed out in 5000ms`, never an assertion failure — including
`tests/lib/layout/p23b11-correspondence-reference.test.ts` and the documentation link scanner. On the
idle machine the same tree passes `test` (186/2,414), `test:fast` (155/2,113), `test:arch` (176) and
`test:heavy` (125). The timeouts are recorded as environment contention, not as a slice pass and not
as a behavior regression.

## Browser journey (local test-auth)

An authenticated editor session was available through the repository's own local seam, not Google:
`POST /test-auth/session` with the lane's `E2E_TEST_AUTH_SECRET` mints the canonical session for
`agent-user-a` (see [.env.example](../../../../../.env.example) and
[test-auth.ts](../../../../../apps/editor/tests/e2e/test-auth.ts)). The cookie was installed in a
fresh Chromium context at `localhost`; the API answered `/auth/me` authenticated and `/projects` 200
with it, 401 without. The editor ran on `:5173` with `PUBLIC_API_ORIGIN=http://localhost:8788`
(SvelteKit reads `apps/editor/.env`, so the variable must be exported to `npm run dev` or placed in an
ignored `apps/editor/.env`).

Journey, at 1600 × 1000:

1. **Start creating → Enclosed room → Save to Cloud.** A starter baseline is local; the first Save
   creates the project row and answers `Saved · All accepted changes are saved.`
2. **Index → Library · Own model → Import model…** opens the instrument. One generated GLB (2 m box,
   2050 × 2050 PNG map, 82,152 bytes) was chosen.
3. **Read model** reported `1 nodes (0 empty) · 1 meshes · 12 triangles · 1 textures`,
   `Footprint 2.000 × 2.000 m · contact 0.000 m · height 2.000 m`, and
   `Textures capped at 2048 px: 1 reduced`; parts/clips/variants were labelled reported, not admitted.
4. **Approve and place** staged and pinned the derivative, then opened Place with
   `An imported model is placed by clicking its floor position`.
5. **Clicking the floor** placed the textured box at that point; the Head turned to
   `Save changes · Unsaved changes`.
6. **Save changes** persisted; the saved row has one `model` resource (pin `sha256-bae127…`, 21,540
   bytes), one `resource:model` lock at that hash, and one `kind: 'model'` entity.
7. **Fresh load** of the same URL rendered the same textured box from the pin, with
   `Nothing to undo yet` and `All accepted changes are saved.`

The uploaded derivative was read back independently: 21,540 bytes, nodes `paint-box` +
`creator-import-pivot`, one `image/webp` texture at 2048 × 2048 (source 2050 × 2050). No page errors;
the only failed request in the console was a favicon 404.

### Findings from the browser run (fixed)

The first two attempts failed at seams the unit tests could not see. Both are fixed and covered:

- **Staging omitted the recipe.** `createImport` sent `files` only, and S01's strict body reader
  requires `files` **and** `recipe` (and rejects undeclared fields), so every approve answered
  `400 invalid_model_import`. The client now sends the caller's recipe identity, and
  `tests/lib/platform/model-import-client.test.ts` pins the body to the server's shape.
- **A GLB source collided with its own derivative path.** `derivativePathFor('paint-box.glb')`
  returned `paint-box.glb`, and staging refuses a repeated declared path. The derivative name now
  keeps `model.glb` for a glTF source and falls back to `<stem>.derived.glb` (then `-2`, …) when the
  source set already claims the name; the ingest test covers both.
- **An unsaved project reported a bare 404.** Import stages against a project row, so a brand-new
  local baseline must be saved first. The procedure now says
  `Save this project before importing a model: an import belongs to a saved project.`

## New dependencies (permissive-only ruling)

| Package | Version | Licence |
| --- | --- | --- |
| `@gltf-transform/core` | 4.4.1 | MIT |
| `@gltf-transform/extensions` | 4.4.1 | MIT |
| `@gltf-transform/functions` | 4.4.1 | MIT |
| `draco3d` | 1.5.7 | Apache-2.0 |
| `meshoptimizer` | 1.1.1 | MIT |
| `property-graph` (transitive) | 4.1.0 | MIT |

All are runtime dependencies of the editor because the browser builds the derivative; the API still
only checks structure and pins. No copyleft, source-available or unclear licence was introduced.

## Unrun rows (owner-run / blocked here)

1. **Remaining browser and shell observations.** The import → review → approve → place → Save →
   reopen journey now ran (see below), but selection/rest, near-bound file pickers, cancel at each
   step, offline approval/retry, keyboard-only procedures and transforms, local refusal text, narrow
   desktop, reduced-motion, lens park/Resume and Preview exit did not. The unit and acceptance
   evidence above is not a substitute for those.
2. **Preview rendering of an actual mapped derivative.** Wiring, props and boundary rules are in
   place and unit-tested; no browser run shows the model inside Preview. Preview refuses to open
   without an admitted Experience (`Create an Experience in the Experience lens to Preview it.`),
   and authoring one is the Experience lens's own scope, not this slice's.
3. **Performance rows.** No F5 admission long tasks / worker time / peak heap / GPU-memory delta /
   chosen→placed, no F6 S/M placement timing, no hard GPU row at M, no F13 repeated
   import/place/delete with shared-instance disposal, and no `apps/editor/perf/flows/` import flow.
   Rationale: the flow needs an authenticated stack and a real import fixture, so authoring it
   without a way to run it would ship an unverified spec. The bundle/load-set evidence above is the
   only delivery-side row recorded. These remain owed on this machine before acceptance.
4. **Conditional decoders with real sources.** The WebP encode and the `2048 px` cap are now proven
   with a real 2050 px map (see the browser row), but a Draco-compressed source and a real KTX2
   (`KHR_texture_basisu`) source were not exercised.
5. **Worker-message timing and cancellation across the worker boundary.** The worker protocol is
   implemented; only the in-process recipe and the session's generation guard are tested.
6. **Derivative > 25 MiB refusal** and a **real 50 MiB+ source** were not built as fixtures; only the
   declared-size cap is proven.
7. **Real R2 / deployed environment.** API evidence used the local object-store contract.
8. **`import-model` accessible-name and focus-return checks** beyond code review (no browser run).

## Independent review and disposition

An independent review pass read the diff and the new modules against five risk areas. Findings and
their disposition:

- **Fixed — cancel could still install after an in-flight approval.** `cancel()`/`dispose()` now bump a
  procedure generation that is checked after every awaited API step and before the approval installs;
  the instrument arms only from an `approved` state.
- **Fixed — Import could strand a published Scene session** (and its release function). Import no
  longer owns or publishes a Scene session: it leaves a pending arm that the Scene adapter applies to
  the session it opens for the placement task, and clears on a failed open.
- **Fixed — resource/definition disagreement was unenforced.** The planner now compares confirmed
  footprint, contact and the report digest named by the definition's provenance.
- **Fixed — definitions could outlive procedure state.** The definition registry is rebuilt from the
  accepted envelope on every rebind, so the accepted resource is the authority after install.
- **Fixed — expired staging retried forever.** A `not-found`/`conflict` approval drops the staging so
  the next attempt declares a fresh one.
- **Fixed — re-resolve revoked live URLs on every edit.** An unchanged pin set reuses the URLs it
  already has.
- **Fixed — failed pins had no visible state.** The route reports the first failure in its status
  note next to the truthful fallback.
- **Fixed — typed Place ignored an armed model.** Typed placement now releases the arm explicitly and
  the instrument says that an imported model is placed by clicking the floor.
- **Recorded, not fixed — `locator` is trusted from the payload** (non-empty only). It is authored
  metadata; rendering fetches by hash through the owner-only route and Save verifies the pin, so no
  bytes are fetched from it. Tightening it is S01's validator or an S03 follow-up.
- **Recorded, not fixed — no local byte verification of the pin.** By design: the browser creates the
  derivative, the API pins it, and Save verifies. A non-session client could build a payload naming an
  unapproved hash; it would render nothing (the hash route 404s) and Save would refuse.

## Stop-and-report items (host/shell and scope)

1. **Editable Card facts are not implemented.** The plan's bounded host contribution names editable
   Scene facts (field identity/label/unit/value, live read-only state during a ray, commit/refusal,
   focus return) plus Library/Head Find invocation. Find/task/instrument invocation ships here through
   the existing `stage-instrument-v1` contributions and needed no host change; a **writable numeric
   Card fact would be a new host interface** and, per the plan, T2 must not add host authority
   unilaterally. Scene numeric edits therefore stay in the adapter's instrument, and the Card keeps
   its landed read-only facts plus the name writer. This needs T1's agreement (and T1's file
   ownership) before it can be built; it is **not claimed** and not silently narrowed.
2. **Host patch inside this PR, for T1 review:** `authoring/stage/shell/StageCanvas.svelte`
   (`modelUrls` prop → `VisitorEntities`), `authoring/stage/host-acceptance.ts` (the host's resource
   staging grant), and the route's approved-model resolution/threading. These are the only Stage-side
   edits; no host state, selection or acceptance authority moved.
3. **T3 review:** `visitor/VisitorEntities.svelte` and `visitor/VisitorPreviewSurface.svelte` carry a
   bounded `modelUrls` prop; `museum/assets/AssetModel.svelte` gains `resolvedUrl` and falls back to
   the catalogue path unchanged.
4. **Shared fixture touched:** `tests/lib/authoring/__fixtures__/unit-envelope-fixtures.ts` gained a
   `resourceStaging` option defaulting to the host's grant (the current Stage host wires it that way).
   Per the shared-file table this serializes with other lanes' fixture edits.

## Entry points

```text
import procedure  apps/editor/src/lib/authoring/adapters/scene/import/{types,ingest,worker,worker-client,session,definitions}.ts
                  apps/editor/src/lib/authoring/adapters/scene/import/ImportModelInstrument.svelte
transport         apps/editor/src/lib/platform/model-import-client.ts
placement         packages/project-model/src/scene-planning/model-resource.ts
                  packages/project-model/src/scene-planning/planners.ts (single resources-granted planner)
                  apps/editor/src/lib/authoring/adapters/scene/placement.ts
render            apps/editor/src/lib/authoring/scene/model-bytes.ts
                  apps/editor/src/lib/authoring/scene/plan-scene-footprint.ts
                  apps/editor/src/lib/museum/assets/AssetModel.svelte
regressions       apps/editor/tests/lib/authoring/scene-import-ingest.test.ts
                  apps/editor/tests/lib/authoring/scene-model-render.test.ts
                  apps/editor/tests/lib/authoring/scene-operation-acceptance.test.ts
                  apps/editor/tests/lib/project-model/model-resource-admission.test.ts
                  apps/editor/tests/lib/project-model/scene-operation-planners.test.ts
API (unchanged)   apps/api/src/app.ts, apps/api/src/model-persistence.ts — S01 routes reused
```

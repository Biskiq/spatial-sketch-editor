# T2.S8 PR E — manual authoring and correctable set import

**Status:** implementation complete on `t2-s8-e-manual-authoring`, based on `main@1e3dcc66`
(includes #391). Independently reviewed, CI-fixed and review-ready; not merged. F, G and U are not
started.
Authority: [plan § E](./implementation-plan.md#e--manual-authoring-and-correctable-set-import).

## Owner ruling: D migration obligations closed

Scene 12 / resources 3 is the **sole canonical format**. Under the
[pre-baseline policy](../../../reference/components/persistence.md#development-stage-schema-compatibility-pre-baseline)
there is no Scene 11 → 12 activation, saved-head inventory, rollback campaign or separate approval.

EVIDENCE-PATHS: start — removed source paths as they stood before this PR

| Removed (no current consumer) | Kept |
| --- | --- |
| `packages/project-model/src/scene-conversion.ts` (`convertScene11To12`) and its test | Strict Scene 12 / resources 3 validation; formats 10, 11 and 13 refuse (`scene-look-schema.test.ts`) |
| `packages/project-model/src/materials/scene-finish.ts` (A's Scene 11 → v1 adapter) and its exports | Save/Load canonical-hash recomputation and refusal, F4 integrity, material digest proofs |
| Dead Scene 11-only parse helpers and stale "Scene 11" comments in code | API database migration infrastructure (untouched) |
| | [D report](./pr-d-report.md) and `evidence/s8-d-conversion.json` as history |

EVIDENCE-PATHS: end

Docs reconciled: `persistence.md`, `scene-codec.md` and `scene-content.md` now describe Scene 12 /
resources 3 as current with no converter; the plan's status line and its *Recovery and switch*
paragraph carry the ruling; T2 README Sky rows no longer name a Scene version.

## What E adds

**E4 operation surface** (`packages/project-model/src/scene-planning/`), all on the existing
expected-revision F4 route:

- `finish-inspect.ts` — `inspectFinish(ref, targets)`: definition revision, per-field provenance
  (base / override / disabled), effective values and multipliers, actual users including dormant
  surfaces, supported operations and diagnostic actions.
- `finish-patch.ts` — typed patch (`set` / `disable` maps only / `reset`), duplicate-field refusal,
  mapping normalization (radians to [0, 2π), offsets to [0, 1)), S4 tint rule on colour-map reset,
  `normalScale` refused without a resulting normal map, dormant strength kept on disable, no-op
  refused.
- `finish-planners.ts` — rename (trimmed, 1–120 chars, `invalid-name`), patch with `in-place` /
  *All* / *Just this* (clone shared by the exact selected subset), curated-base materialization,
  unused-only remove (counts dormant uses; drops definition and lock only when no other instance
  uses the resource; texture rows and P20 bytes stay). Reach is rechecked: a changed user set
  refuses even at the same size. Artwork, lights and *Model's own* are not Finish targets.

**E5 set import.** Pure grammar and composer in `@portfolio/project-model/material-authoring`
(`proposal.ts`, `draft.ts`): NFC + ASCII fold, separator tokens, longest terminal alias, resolution
tokens, ORM/RMA channels, gloss inversion, generic normal `+Y` with acknowledgement, unsupported
signals/encodings left unassigned with reasons, collisions and duplicates blocking with no
enumeration-order winner, identical digests collapsed, sorted output. Manual and corrected drafts
share `composeDraft`; new composed recipes with roughness/metallic maps get unit factors and an
authored zero is preserved.

Editor services in `apps/editor/src/lib/authoring/materials/material-set.ts`: `readSetFileFacts`
(concurrency 2), `prepareDraft(edits, files, expectedRevision, signal)` and
`acceptDraft(draft, targets, operationId, signal, host)`. Plan § E5 names a `scope` parameter but never
defines what it carries; no invented semantics were added, so the signature deviates (host-injected
F4 scope is derived from `targets`). Acceptance refuses pending targets and dormant/retired surfaces
(`refused`) before IO, bounds uploads at two and stops new ones on the first failure (every lane
settles before the result returns), stages distinct files through `importProjectImage`, rechecks revision and reach after IO and
issues exactly one `scene-finish-register` with Finish id `finish-<operationId>`. F4 refusals map `stale-revision`, `image-pin-conflict`/`texture-mismatch` (→ `image-pin-mismatch`)
and `aborted` to their own codes; the rest stay `refused`. `aborted`,
`stale-revision`, `target-pending`, `image-pin-mismatch` and `unresolved-role` leave the project
unchanged. `project-artwork.ts` gains `preferAssetIds` (prefer an already referenced ready row, else
the lexically first) and an in-flight map so identical bytes reserve and upload once.

**Visitor isolation.** `preview-surface-boundary` forbids `material-authoring`; an arch test proves
the visitor closure rejects it.

## Acceptance (E exit)

apps/editor/tests/lib/project-model/s8-pr-e-acceptance.test.ts (15 tests) drives the real adapter,
target analysis and unit coordinator:

| E exit item | Result |
| --- | --- |
| Create, correct a binding, reset inherited ↔ disabled, rename, Undo/Redo (one entry each) | pass |
| Shared edit across entity / Wall / dormant lid; stale reach refused at equal size; *All*; *Just this* clone | pass |
| Delete unused (definition + lock dropped, textures kept); in-use remove refused, dormant counted | pass |
| *Model's own* not editable; a light target refused as non-paintable, no upload | pass |
| Shuffled files → byte-identical proposal; GL/DX and packed/loose block then resolve | pass |
| Automatic vs manual assembly, reversed completion order: identical canonical recipe, closure, resolved output, history | pass |
| Cancel after first ready upload (no partial Finish); corrupt member → `image-pin-mismatch`; stale → `stale-revision`; retry accepted | pass |
| Explicit zero multiplier preserved | pass (also `material-set-proposal.test.ts`) |

Also: `material-set-proposal.test.ts` (10), `project-artwork.test.ts` (+2), `preview-surface-boundary.test.ts` (+1).

## Verification

| Lane | Result |
| --- | --- |
| `npm run check` (editor) | 0 errors; 16 pre-existing warnings, none in files this PR touches |
| `check:project-model` | pass |
| `test:fast` | 464 files, 5723 tests (2 load-timeout flakes in unrelated harness/paper files pass alone) |
| `test:arch` | 38 files, 357 tests pass |
| `test:heavy` | 11 files, 138 tests pass |
| `npm run build` | pass |
| `check:api` / `test:api` | pass / 150 pass, 0 fail (fresh local Postgres) |

**Focused browser QA** (`/dev/s8-e`, real adapter → serialize → cold admission → cold release bundle
→ product Scene description; `?backend=webgl2` hides WebGPU as D's runner does). Details:
[`evidence/s8-e-gate.json`](./evidence/s8-e-gate.json).

| Backend | auto = manual saved bytes | auto = manual pixels | edited differs | console errors |
| --- | --- | --- | --- | --- |
| WebGPU | yes (`88e8ad53…`) | yes (`57ff1a4b…`) | yes (`9a4fe093…`, pixels `77f7bbe3…`) | none |
| WebGL2 | yes (`88e8ad53…`) | yes (`e8e36343…`) | yes (pixels `34ef97bd…`) | none |

Warm first correct draw: ~208 ms WebGPU, ~82 ms WebGL2 at 768² device px (DPR 1.5). Not a
performance gate; F owns the measurement protocol.

## Independent review and closeout (2026-11-21)

The merge gate's `test:arch` failure was two written paths in this report naming files this PR
deletes. The removal table is now a declared `EVIDENCE-PATHS` region — the repository grammar for a
record of deleted files — so the paths stay readable without claiming they still exist. No Scene 11
compatibility code was restored.

Independent review covered E4 and F4 acceptance, E5 determinism/correction/dedupe/cancellation and
stale refusal, manual/automatic canonical equivalence, the Scene 12 / resources 3 cleanup, Save/Load
and resource closure, Undo/Redo and visitor isolation. One substantive diagnostic defect was found
and fixed: `acceptDraft` treated every target without analysis facts as `target-pending`, so a light
(or another non-paintable subject) was reported as "still being analysed" forever. It now refuses a
light, a non-paintable subject, a missing object and a retired Layout surface as `refused` before any
upload, and applies the same rule after IO. The acceptance test asserts the light refusal and an
unchanged project. No other substantive E-scope defect was found.

The mixed Scene-object + Layout-surface registration limit is accepted as E's documented workflow
limitation: F4 still refuses a compound write and E does not widen it. It is recorded in the plan's
*What reaches UX planning* section as a two-step journey U must present, not as a failed import.

### Closeout verification

| Check | Result |
| --- | --- |
| `npm run test:arch` | 38 files, 357 passed (documentation gate green) |
| `npm run test:fast` | 464 files, 5721 passed + 2 unrelated load timeouts, green alone (review follow-up) |
| `npm run check` | 0 errors; 16 pre-existing warnings |
| `check:project-model` | pass |
| `npm run build` | pass |
| focused E suites | 42 passed across four files; the two changed suites re-ran 25/25 |
| `/dev/s8-e` recheck | WebGL2: auto = manual saved bytes, edited differs, no console errors |

The browser recheck ran on this workstation's Chromium, which exposes no WebGPU adapter (the
renderer falls back to WebGL2), so the committed WebGPU row above remains the only WebGPU
observation. PNG bytes are generated per run, so the recheck's saved hashes differ from the
committed gate's; within the recheck auto and manual are identical and edited is not. Pixel identity
was not re-read in the recheck.

## Remaining limits and blockers

- **Mixed targets need two steps.** F4 refuses one registration that names both entities and Layout
  surfaces as compound acceptance; `acceptDraft` refuses such a call before IO with guidance to
  register on one kind, then paint the rest. No F4 change was made. This is E's accepted, documented
  workflow limitation; the plan's UX handoff carries the two-step journey into U.
- **No product UI.** E delivers the operation surface and services; the creator UI follows the UX
  plan (U).
- Owner manual browser acceptance was waived by the owner (2026-11-21); the agent gate above is the browser evidence.

F (inspection/catalogue) and G (transfer) can proceed in parallel from this surface.

## Review follow-up

- A *Just this* clone that ends pristine (catalogue base, no overrides) is not stored: surfaces and
  primitives take the curated normal form (`{materialId}` / `materialId` without `materialInstanceId`)
  and the allocated Finish id is ignored (a reservation, not a grant). A clone reaching a model user
  keeps its instance, since a model has no normal form for a catalogue base.
- Resetting `maps.normal` to a base without a normal map refuses a still-authored `normalScale`
  (`normal-control-without-normal`) unless the patch resets it too; `disable` stays allowed.
- `inspectFinish` always lists `materialize` for a curated Finish, matching the patch planner.

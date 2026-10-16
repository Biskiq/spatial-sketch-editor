# T3.P01.S01 independent implementation review

Reviewed 2026-10-16 against the [approved S01 plan](./implementation-plan.md),
AM-2/AM-6/AM-7, the phase conversion matrix and the strict post-#115 source codecs.
Review input: `a16b55f9`; implementation base: `bbff4f20` (PR #127).
Fixes and this evidence belong to branch `T3-P01-S01`, PR #131.

The review traced every new production module, their producers/consumers and the
standalone program import closure. The final diff was checked for scope and for
preservation of the landed reference/channel behavior. No capability acceptance,
closeout, source activation or merge is recorded here.

The following findings were repaired directly. Locations name the final owning
functions; regression tests exercise admitted input and observable behavior.

| Finding | Repair and evidence |
| --- | --- |
| **P1 — Resolution discarded reference identity.** `scoped` could resolve a connection through a View ID, ignore trailing instance segments, accept unknown component/capability/location qualifiers, and answer a stale exact or locked revision with current contents. | [Unit resolution](../../../../../packages/project-model/src/references/unit-resolution.ts) now checks kind, full path, declared qualifiers, accepted-envelope binding and concrete content revision. A repairable resource remains unresolved even if revision/pin metadata is present. Both admitted resource kinds have resolvers even when empty, distinguishing missing subjects from unsupported domains. [Conformance](../../../../../apps/editor/tests/lib/project-model/unit-resolution-conformance.test.ts) covers these refusals and valid exact/locked resolution. |
| **P1 — Converter locks could not resolve their own subjects.** Migration emitted unit pins, while the reader searched only for a subject pin. | `createDependencyLockReader` can use a supplied subject's actual owning-unit identity to find its existing pin. It never substitutes the current header revision for a missing pin. The migration suite resolves Camera Views and Experience Stops directly from converter-produced envelopes. |
| **P2 — Qualified lock keys collided.** Delimiter joins confused opaque kind/ID fields and `['x/y']` with `['x', 'y']`; capability requirements could name conflicting versions of one capability. | One [tuple-key function](../../../../../packages/project-model/src/units/identity.ts) serves admission and lookup. Duplicate capability IDs refuse, including differing versions. Regression cases retain delimiter-bearing IDs and distinct paths. The lock-reader constructor validates its supplied lock before indexing it. |
| **P1 — Content identity changed after a codec read.** The constructor hashed unnormalized Experience data, while reading inserted default continuations. The envelope writer also serialized malformed input directly. | [Unit construction](../../../../../packages/project-model/src/units/canonical.ts) validates/normalizes domain data before hashing; the writer validates before serialization. A regression passes an omitted continuation through construction, writing, parsing and real envelope validation, then verifies every revision and the envelope digest. |
| **P2 — Program admission dropped meaning or admitted contradictory instructions.** Guard/action variants accepted each other's fields; state assignments/equality values were unchecked; choice state could be read as a boolean; content IDs were only locally unique; Cut and local-time holds could contradict their owning records. | [Program validation](../../../../../packages/project-model/src/program/validate.ts) refuses those cases, bounds recursive guards to 32 expressions of nesting, preserves the actual lifecycle diagnostic path, and confines OpenUrl to absolute HTTP(S) URLs. [Program regressions](../../../../../apps/editor/tests/lib/project-model/program-conformance.test.ts) cover positive and negative cases without adding an interpreter. |
| **P2 — Source conversion changed supplied intent.** A mid-chain entry appeared in the report but not the Guide; reverse-authored cycle closing edges were missed; detour policy could silently change origin/target or invent a later rejoin; bare node IDs were accepted as Stop IDs. | [Conversion](../../../../../packages/project-model/src/migration/convert.ts) preserves the supplied Guide entry, treats closing connections as undirected while retaining directed timing, requires actual produced Stop IDs and enforces the authored detour origin/target and return-to-origin relation. Invalid target-policy values return typed refusals before hashing. A report with no entry now carries `null`, never an empty-ID sentinel. |
| **P1 — Model resources and required-byte failures were omitted.** Conversion covered textures only, selected the first staged duplicate pin, and closure missed unresolved required resources, pin-only revision mismatches and missing pin metadata. | Conversion includes distinct model asset identities and validates all staged pins before selection. [Envelope findings](../../../../../packages/project-model/src/units/validate.ts) report authored unresolved diagnostics separately from required Scene/lock closure failures, checking the full resource scope and pin metadata. Regressions cover model assets, duplicate staged pins and pin-only revision/metadata mismatches. |
| **P2 — Unit admission missed existing constraints.** Camera admission omitted the current project's keyframe eye/target constraint; repeated Guide placements could reuse an ambiguous Stop identity; accepted revisions could belong to another project; byte sizes could exceed exact integer range. | The Camera codec reuses the existing pure pose validator without changing camera-core. Unit admission requires distinct authored Stop occurrences, the envelope's own project revision and safe integer byte sizes. [Unit conformance](../../../../../apps/editor/tests/lib/project-model/units-conformance.test.ts) covers these cases. |
| **P2 — Inactivity evidence missed import routes.** The original test scanned editor aliases but omitted API and relative incoming edges. Its shared closure helper resolves workspace subpaths to the root barrel. | [Boundary coverage](../../../../../apps/editor/tests/lib/project-model/program-entry-closure.test.ts) now inspects incoming edges from editor, API and other package sources, including relative/dynamic imports, with negative controls. The exact program closure remains four delivery-validation modules. |

The converter's post-validation duplicate-ID, missing-link and asymmetric-link
branches were unreachable: the actual source codec already refuses those shapes.
They and their unreachable refusal tags were removed. Invalid-source fixtures
assert the upstream refusal; no fixture bypasses admission to claim branch coverage.
The source codec, Camera/Scene data and landed reference/channel modules are unchanged.
A dedicated converter fixture preserves path anchors, target waypoints, both View
tracks, framing envelopes, durations and easing in both directions.

Verification on the reviewed tree:

- The six S01 conformance/boundary files contain **96 passing tests** (27 added by
  this review); the unchanged `references-v1` conformance suite also passes.
- Architecture lane: **16 files / 144 tests pass**.
- Complete editor suite: **125 files / 1693 tests pass**, using
  `npm run test -w @portfolio/editor -- --maxWorkers=1`.
- Heavy lane: **8 files / 118 tests pass**, using
  `npm run test:heavy -w @portfolio/editor -- --maxWorkers=1`.
- `npm run check`, `check:layout-core`, `check:project-model`, `check:camera-core`,
  `check:api` and `build` pass. Editor check reports zero errors and warnings.
- `npm run test:api` passes **39 tests, zero skips**, including real local Postgres
  migration/publication/auth cases. No credentials or database contents are recorded.
- Built-route browser smoke: `/`, `/projects`, `/project/x/spatial`, `/p/x` and
  `/editor` show their expected landing/Hub/reset/unavailable surfaces with no page
  errors or console errors. The task-owned browser and preview server were released.
- `git diff --check bbff4f20` passes; the final committed range is checked separately.

Two ordinary parallel full-suite attempts hit existing 5-second timeouts in the
unchanged F3 exhaustive ownership and Layout reference tests. Serial execution
passed the complete population with unchanged cases and timeouts; no test/config
was weakened. The build retains dependency unused-import and chunk-size warnings.
The externally hosted frozen museum was not rerun; repository isolation passes.

Remaining integration obligations are explicit:

- S01 proves codecs and pure preparation. Directed Travel/gap behavior, per-visit
  lifecycle/reset, handoff cleanup, reduced motion and semantic navigation still
  require the one S03 interpreter and its behavioral trace conformance. No codec
  fixture is evidence that those runtime behaviors are implemented.
- Captured baseline identity, reviewed policy intent and staged-byte verification
  remain caller-supplied facts. This pure converter cannot attest uploaded bytes,
  inventory projects/publications, quiesce writers or perform a CAS installation.
  S04 owns those actions and the single source-epoch activation/recovery.
- Structural envelope admission and asynchronous content-revision verification
  remain distinct APIs. A future trusted reader must recompute revisions and apply
  selected-program executable closure before delivery; admission alone is insufficient.
- The full merge gate must apply to the eventual integrated main. This review
  changes no gate readiness or acceptance record; F2 remains `ratified`.

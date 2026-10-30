# S09 — independent final implementation review

**Verdict:** ACCEPT FOR ROUTINE CLOSEOUT (2026-10-30). No remaining P0–P2 blocker.

**Reviewed branch base:** `2d10d7afeff73ebd1d2933e5830041892d93bee0`; current `main` `9e0827aa859bfba6a30413d4a1b1af5834695354`. Repairs are an additive working diff; all checkpoint commits remain intact. Exact production/test bytes are in [independent-branch-code-manifest.json](./independent-branch-code-manifest.json), SHA256 `6cc5ee3adb23bd4dfda74509b5c8954f6c137e17b307165ac7c78dd3ce65ddc6`. The independently tested combined repair tree is identified by [independent-combined-code-manifest.json](./independent-combined-code-manifest.json), SHA256 `4af3911f81e8b98eb54c021b8f2d2212fd4b64be7d49443f9f77205ab9569604`. Documentation changes do not alter these code/test identities.

## Findings and approved criteria

- **P2, repaired:** the offset Move glyph moved the entity to the pointer's absolute floor position. A captured world grab offset now preserves the initial pose and applies pointer delta before S05 snapping and existing support/planner admission. Tests cover stationary/tiny movement, multiple yaws, Snap/Alt and refused support with one-entry history.
- **P2, repaired:** fixed-size size glyphs were interpreted as absolute world endpoints. Pointerdown closest-axis travel is now captured; subsequent travel is added to the accepted extent. Plan Height retains its existing CSS-delta/factor path. No new planner or form policy.
- **Criterion 1:** Width, Depth and Height run through the existing set-form-size/F4 path; valid releases add one entry and refused/cancelled releases add none. Repeated resizes retain the original base dimension.
- **Criterion 2:** a rotated, hit-resolved Width edit updates the accepted runtime Scene and the retained footprint projection used by StageCanvas/scene.adapter; that exact projection feeds Paper and matches an independently evaluated new form. The previous silhouette disappears. This corrects missing evidence without an owner waiver.
- **Criterion 3:** marks and Card share the same planner/scale/refusal path. The planner enforces scale [0.01,100] and evaluated dimensions [0.001,100] m; the coordinator's alleged range departure was inaccurate. A real admitted centered elevation form (factor 2) passes Plan Height preview, acceptance, base-contact and history assertions. No centered-height or scale-policy owner ruling is required.
- **Criterion 4:** shared S07 descriptors, Scale disclosure without history, 44 px coarse hit policy, and Height/Width/Depth descriptor order remain intact. Quarter-turn and diagonal collision tests retain separate Move/Width/Depth hits.
- **Criterion 5:** the complete T5 corpus/golden tests, Shape draw/size, Save/cold reopen, My Objects insertion and refusal contracts pass in the full suite. Geometry/kernel code and goldens are unchanged.
- **Criterion 6:** no scene-form-size overlay ids remain; Delete remains a Card action.

Parent re-ran Shape, native-form marks, S08 Scene editing, support and S05 drafting: 5 files / 111 tests. The 3D Height oracle retains five-digit precision. The final combined suite below includes corrected runtime-Paper and admitted centered-form evidence.

## Final combined gates and integration

The combined tree was reconstructed from both owning branches' exact reviewed working diffs over checkpoint c0ad8e15. The checked code/test manifest still matched after verification. Both original merge orders produced the same checkpoint tree af3c3ba2; repaired shared-adapter patches apply cleanly and retain both tick and form-mark contributions. S08 object marks, S05 snap arithmetic and support admission were independently inspected and their contracts pass.

| Gate | Result |
| --- | --- |
| npm run test:full | 247 files / 3154 tests passed, including arch and heavy |
| Explicit npm run test:heavy | 11 files / 138 passed; heavy kernel code/tests unchanged by repairs |
| Explicit npm run test:arch after review docs | 23 files / 193 tests passed |
| npm run check | 0 errors, 0 warnings |
| npm run build | passed |
| check:layout-core, check:project-model, check:camera-core, check:geometry-core | all passed |
| check:api | passed |
| DB-backed test:api | 122 passed / 15 contracts / 0 skipped |

The API target was a task-owned postgres:16-alpine container (id f56df5848f19f4ca773509742777cabb2f3e385cbfe7dc811c844dcd010f5745), database biskiq on an ephemeral loopback port; it was stopped/removed. No external object store was touched. Package/API sources and tests are unchanged across these editor repairs, so their gate evidence remains applicable. The standalone architecture lane passed after final review documentation (23 files / 193 tests); the focused documentation gate was rerun after trimming two trailing Markdown spaces. Whitespace is checked against main 9e0827aa plus the complete working diff.

Recommended and owner-authorized merge order: S06 / #227, then S09 / #228. There is no outstanding substantive owner decision for these slices: the two mandatory fixture gaps are corrected, the claimed policy departures did not reproduce, and existing coordinator clarifications require no new planner, authority or deferred feature. Do not close the R217 phase or claim S11 acceptance.

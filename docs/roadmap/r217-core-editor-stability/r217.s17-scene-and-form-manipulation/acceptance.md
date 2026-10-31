# R217.S17 — acceptance record: Scene and form manipulation

**Slice:** R217.S17 · **Status:** [implementation PR #239](https://github.com/Biskiq/spatial-sketch-editor/pull/239) in review; no acceptance recorded · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:**
[R217](../README.md) · **Integration route:**
[R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

This record documents the implementation candidate and its current evidence. It does not accept
the slice or the R217 integrated gate.

## Implemented

Selected Scene objects and native forms can be moved from their bodies in Plan and 3D. Placement
and manipulation previews follow the pointer; Plan ghosts use the same projected footprints as
accepted placement. Manipulation mark priority, form sizing, and pointer placement refusal were
updated with focused regression coverage. The browser seed creates the mixed fixture and approves
its creator model through the real import routes, using measured importer output for normalization.

## Verification evidence

- `npm run check` passed with 0 errors and 0 warnings.
- The affected-subsystem suite passed: 9 files, 155 tests. It covered scene editing, object cards,
  manipulation marks, operation acceptance, shape reading, candidate ghosts, stage facade, and the
  mixed fixture contract.
- `npx vitest run tests/lib/authoring/scene/object-definition-policy.test.ts` passed: 1 file,
  9 tests.
- Browser work against a disposable API-seeded mixed project confirmed primitive body Move,
  Turn, Size, Duplicate and Undo; live Plan pointer placement, an off-floor refused candidate, and
  Undo of a valid placement; native-form Turn and Size in Plan and 3D; and approved-model body
  Move, Turn, Size, Duplicate and Undo in Plan and 3D. The live approved-model footprint came from
  measured importer geometry. The disposable project was deleted after the checks.
- `npm run test:arch` did not pass: 22 files / 23 passed and 193 / 194 tests passed. The failure
  is the pre-existing broken link in the S16 evidence pointer
  (`docs/roadmap/r217-core-editor-stability/r217.s16-openings-and-junction-hover/evidence/CLOSED.md`);
  its relative path resolves under `docs/roadmap/archive/`, while the manifest is under
  `docs/archive/`. The pointer is unchanged from the trusted base; no S16 file was changed.

## Unresolved criteria and integration

The mixed fixture includes a floor catalogue model, but `CATALOGUE_MODEL_CONTACT_RECORDS` marks
every such record `verified: false`. The object-definition policy admits only verified model
contact and footprint metadata. Therefore the catalogue row cannot honestly receive manipulation
marks or floor placement from this implementation. No dimensions are guessed and the admission
policy is not bypassed. The plan's catalogue-object Move, Turn, Size and Place criterion remains
owed and blocks R217.S11 J15 until the verification record or an owner-approved scope resolution
provides an eligible catalogue subject.

The S11 integrated gate also remains outstanding. Browser evidence above is implementation
evidence, not slice acceptance. The complete per-subject Place, body Move, Turn, Size, Duplicate
and Undo matrix has not been recorded in both Plan and 3D; 3D pointer placement and the catalogue
row are still owed. Required S11 integrated, coarse-pointer, native-touch and Safari evidence is
also not claimed here.

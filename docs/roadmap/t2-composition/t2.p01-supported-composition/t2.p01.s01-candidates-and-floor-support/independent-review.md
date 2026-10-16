# T2.P01.S01 — independent focused T1/Layout review

**Reviewer:** distinct reviewer agent `/root/t1_layout_review`, acting in the T1/Layout review
role explicitly requested by the owner on 2026-10-16. This reviewer did not implement the query,
planner or tests. The implementation agent requested this reviewer-authored evidence file after
receiving the independent findings.

**PR:** [#130](https://github.com/Biskiq/spatial-sketch-editor/pull/130).
**Reviewed baseline:** `3b66feb3` (implementation/test commit `29fd21e3`), plus the four uncommitted
threshold evidence tests added during this review in `layout-floor-support.test.ts` and
`place-object-candidate.test.ts`. Those additions change no production behavior.

## Scoped sign-off

**Approved within this scope:** the Layout-owned floor-query public exports, **1e-6 m** boundary
and coplanar elevation tolerances, **1e-9** per-component up-normal tolerance, current-format
context equivalence, query-point qualification and deterministic ambiguity behavior. No
substantiated in-scope implementation defect remained after independent inspection and checks.
The review recommended the four added threshold tests as evidence improvements, not as repairs
for a discovered implementation defect.

- The `layout-core` barrel addition is append-only. Package exports/dependencies, canonical
  compiler code/tolerances and existing queries, including `findPolygonContaining`, are unchanged.
  The new module imports Layout-native types and helpers, with no F1, editor or renderer dependency.
- Boundary membership uses Euclidean distance to finite polygon segments. The added tests pin an
  inclusive edge at 1e-6 m and distinguish near/far outside corners; the tolerance is not an
  axis-aligned expansion. Invalid containing boundaries and contradictory compiled facts refuse.
- Coplanarity requires the same floor context and pairwise elevation differences within 1e-6 m.
  A middle elevation cannot bridge endpoints farther apart than tolerance. The retained value is
  an exact compiled Room elevation from the first source-ordered witness, without quantization or
  averaging. The added test pins inclusive coplanarity, exact canonical Y preservation and refusal
  beyond the floor/Room fact tolerance.
- `floorId` is a sufficient context key for the **current compiled format**: polygons are in the
  common world frame, each compiled Room floor derives from the one floor datum, and no placed
  structure instance or independent level/frame context is represented here. Distinct floor IDs
  remain separate even at identical elevations. A future format with levels, structure instances
  or independent frames must revisit the context contract before reusing this equivalence rule.
- The normal tolerance compares each component against `[0, 1, 0]`; it is not an angular or slope
  admission policy. Current compiled Room floors are upward by construction. The added test pins
  inclusive X/Z component drift and refusal beyond 1e-9; the planner retains the supplied evidence.
- Query-point qualification allows Euclidean round-trip drift within 1e-6 m. It never snaps or
  replaces the composed world pose with the evidence point. The new near/far test preserves exact
  composed X/Z and contact-resolved Y while retaining the captured query point.
- Source/Room/floor/record ordering is explicit lexical ordering, independent of array order.
  Collision-safe identities are used for lookup, not lexical comparison. Equivalent witnesses are
  retained, separate contexts/elevations require an explicit choice, and an elevation choice with
  multiple matches refuses rather than accepting the first entry.

## Independently executed verification

Against the reviewed baseline:

- Focused floor-support, placement-candidate and placement-frame suites: **3 files / 58 tests pass**.
- `npm run check:layout-core`: pass.
- `npm run check:project-model`: pass.

After re-reviewing the four threshold test additions:

```sh
npm run test:fast -w @portfolio/editor -- tests/lib/layout/layout-floor-support.test.ts tests/lib/project-model/place-object-candidate.test.ts tests/lib/project-model/placement-frame.test.ts
```

**3 files / 62 tests pass** (28 floor-support, 28 placement-candidate, 6 placement-frame).

This is independent scoped review evidence, not a claim that the repository's T1 owner personally
approved the change, overall slice acceptance, closeout, integrated host/gesture verification or
permission to merge. Final acceptance revalidation and actual host-captured source/frame/readiness
remain the later integration slices' responsibilities. No closeout or merge was performed.

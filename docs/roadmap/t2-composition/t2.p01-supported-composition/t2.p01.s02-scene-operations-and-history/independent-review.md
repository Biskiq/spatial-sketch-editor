# T2.P01.S02 — independent implementation review

AUTHORITY: NONE — reviewer-authored evidence is preserved in Git. The slice plan and the T2 phase
contracts own the current behaviour; this artifact records scoped review provenance only.

**Reviewed:** branch `T2-P01-S02`, base `74367936`, implementation `d38594b3` with the review
repairs at `9818c329`, `bd7178eb`, `f12c7c5d` and `af39acd1`. Two adversarial rounds plus a final
verification round, 2026-10-16, then a third round adjudicating two follow-up findings against
`7bca2fc8` and repairing both at `62d4d5b0`. **Re-review of `62d4d5b0` is pending**; no verdict here
covers it.

**Provenance.** Four distinct reviewer agents were spawned against separate risk axes and given
read-only scopes, followed by two final verifiers on the repair delta. They are independent of the
authoring pass: each was briefed to defeat the work, none could edit files, and their findings were
triaged against the code rather than accepted wholesale. The coordinator ran every command and
repair. This is not a claim that a repository T1 owner or the phase owner personally reviewed the
PR, and it is not slice acceptance.

## Round 1 — four axes, read-only

| Axis | Verdict | Findings |
| --- | --- | --- |
| Planner semantics (poses, ownership, correspondence, no-op) | no blocking defect | one substantive preservation bug: sub-tolerance pitch/roll were zeroed by yaw operations |
| Record-scope guard soundness (defeat attempts) | no passing-but-wrong pair constructed | one substantive future hole: carried top-level fields were a hand-maintained list |
| Support, intent reading, ownership boundaries | two substantive defects | (1) recorded `ShapeReader` issues were discarded on the success path, so unknown payload keys and mismatched support-choice variants installed; (2) `choice-required` disclosed candidates at ineligible elevations |
| Evidence vs. claims | one blocking evidence defect, three substantive gaps | (1) `npm run test:full -- --maxWorkers=2` never passed the flag to vitest, so the recorded gate was not the gate that ran; (2) delete was never undone; (3) determinism was replayed on `set-yaw` only; (4) duplicate refusals asserted only `rejected` |

Nits triaged into the repair set: guard cases asserting only `length > 0`; a shared, unfrozen
admission object; a bypass-test claim that overstated what the test proves; over-precise
expectations of the complete-suite command.

## Repairs

`9818c329` — strict reading and honest disclosure:

- Collected `ShapeReader` issues now refuse both planner paths, so an unknown payload key or a
  support-choice variant carrying the other variant's field refuses with its path and code.
- A captured choice the snapshot no longer yields offers only eligible contexts, or refuses
  `no-support` when none exists at the required elevation.
- The record-scope guard derives carried top-level fields from the documents instead of a fixed
  list, so a new Scene field is protected when it lands.
- `set-yaw` and `place-on-floor` preserve sub-tolerance pitch/roll instead of zeroing them.

`bd7178eb` — re-review findings:

- Cluster fields are derived the same way, closing the same hole one level down.
- A resolving captured-choice case now proves a legitimate choice still prepares, so the strictness
  repair cannot silently refuse every choice.
- A yaw stored as `4.0` rad and captured as `4.0` rad no longer installs a canonicalized `-2.283`
  rad history entry for the same rotation; an equivalent angle keeps the stored value and reports
  `no_op`. No-op and cluster comparisons use the guard's key-order-independent equality.
- Primitive contact agreement with the editor policy is compared at `1e-9 m` rather than by exact
  float equality; disagreement still refuses.

`f12c7c5d` — the four captured-input defects assert their specific diagnostic code
(`stale-revision`, `invalid-target`, `frame-mismatch`, `unexpected-allocation`) instead of only
`rejected`.

`af39acd1` — gate capacity: the F.3 bounded exhaustive Camera sweep declares a 30 s budget.
It runs in ~2.5 s alone and crossed vitest's 5 s default once the lane grew, reproducing on
unmodified `main`; the traversal and its assertion are unchanged. The complete-suite command was
also corrected to the form that actually forwards the flag
(`npm run test:full -w @portfolio/editor -- --maxWorkers=2`).

## Round 2 and final verification

Re-review confirmed each repair, then found: the cluster comparison was still list-based
(substantive), and the new "any recorded issue refuses" rule had no positive case, so it could have
started refusing every legitimate captured choice without a test noticing (substantive evidence
gap). Both were repaired in `bd7178eb`. The final verifier pair then walked the wrap math, the
tolerance boundary, the derived comparisons and each new assertion, and reported **no defect in the
delta**: the cluster case, the wrapped-yaw no-op, the resolving choice, the replay membership and
the pinned guard paths all fail on the pre-repair code and pass now.

## Round 3 — follow-up adjudication (`7bca2fc8`)

Two findings were raised against the pushed head. Both were reproduced, both are substantive, and
both are repaired at `62d4d5b0`.

**P1 — owner-frame references were accepted without resolution.** Confirmed. `readFrameReference`
validated the `FrameReference@1` *shape* (owner, frame id, revision) and then kept the
caller-supplied `origin`/`yaw`. For `project-world` that was sound, because the identity conversion
is checkable; for `owner-frame` nothing was resolved — no frame id lookup, no owner placement, no
revision match — so an intent could name any frame with any revision and still carry an arbitrary
transform, and every frame-carrying operation (`place-object`, `move-horizontal`, `set-yaw`,
`place-on-floor`) would plan from it. `references-v1` already forbids inventing a frame, and the T2
contract requires a "validated conversion"; a pure planner is given no `FrameResolver`, so the
honest behaviour is refusal, not trust. The intent reader now refuses a structurally valid
owner-qualified frame as `unsupported-frame` (a capability refusal, distinct from the
`invalid-value` a malformed reference earns), and the planner keeps that code instead of flattening
it. The identity frame still plans, and malformed references still refuse as invalid.

Disposition of the builder seam: S01's `preparePlaceObjectCandidate` still documents its frame as
host-resolved and its own suite pins an owner-frame acceptance; that function is not the untrusted
boundary and S02's planners can no longer reach it with an owner frame. Closing it belongs to
whoever admits a real frame resolver, and it is recorded as a residual rather than changed here.

**P2 — the guard granted a whole `rotation` field to a yaw edit.** Confirmed as a real gap in
enforcement, not only in coverage: the scope vocabulary was field-level, so `set-yaw` granted
`rotation`, and a planner defect that rewrote pitch or roll would have been admitted as "rotation
changed" — exactly the class of overreach the guard exists to refuse. A grant may now name one
component of a vector field (`rotation[1]`), and `omitGrants` removes only that component, leaving
the others inside the exact comparison; a non-array value stays in the comparison, so a malformed
grant can only make the guard stricter. `set-yaw` and the yaw branch of `place-on-floor` grant the
shared `YAW_SCOPE_FIELD` constant, and the candidate still reports `rotation` as the changed field
for F.4's change record.

Evidence — both new tests fail on the pre-repair code, checked by mutation rather than asserted:
reverting the reader to accept owner-frames fails the four-operation refusal test, and reverting
the guard to component-blind grants fails the pitch/roll case (a yaw-only change stays admitted in
both).

## Verdict

At `af39acd1`, no substantiated defect remained in the scope reviewed then, and that verdict covered
implementation acceptance at the slice's declared `architecture-integration` tier. The round-3
adjudication above shows that verdict was too generous on two axes: an unresolvable frame was
trusted, and the guard's grant was coarser than the operation it protected. Both are repaired at
`62d4d5b0`, so **acceptance is not justified again until `62d4d5b0` is independently re-reviewed**;
the repairs were authored by the same coordinator, and this record does not certify its own work.
Remaining items are cosmetic or cross-owner, not slice defects:

- guard assertions discriminate with stable message substrings in addition to path and code;
- `entityScale` coerces a corrupt non-positive scale to `1` (unreachable after admission);
- the primitive contact formula exists in both this package and S01's editor policy, and the two
  owners should converge on one;
- a yaw difference below `1e-9 rad` is absorbed as `no_op` by construction.

Also open by design, not defects here: an owner-qualified frame has no resolver and therefore no
admitted use in this slice, and S01's placement builder still trusts the host that hands it a
resolved frame.

Out of scope and not reviewed here: the DB-backed API suites, browser journeys, live host
registration (`T2.P01.S03`) and phase integration (`T2.P01.S04`).

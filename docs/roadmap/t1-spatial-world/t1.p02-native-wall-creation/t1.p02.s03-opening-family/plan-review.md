# T1.P02.S03 — plan review: Opening as an Ink reading

AUTHORITY: NONE — the phase README owns slice status; the [release list](../../../now.md) entry and
the [authorization record](../../../../reference/decisions/t1-p02-s03-authorization-2026-10-27.md)
own the release. This artifact records a **pre-build plan review** of the
[complete implementation plan](./implementation-plan.md) against the contracts and code named
below. It is not a GitHub review and does not discharge the standing independent implementation
review of the PR.

STATUS: complete 2026-10-27. The reviewed plan passes with the conditions in §5.

## 1. Scope reviewed

- [S03 implementation plan](./implementation-plan.md) — the complete plan: two bounded F4 Layout
  operations, the Opening reading on Ink, host preference, refusal/repair, typed offset, removal and
  the wall-deletion re-proof.
- [Shell draft — Opening (S03)](../shell-draft.md#opening-s03) — Opening is an Ink reading on a Wall
  face, not a dock family; host-relative ghost and facts; refusal in words; settled fields in the
  Card; delete in its scoped action.
- The release's scope fence ([authorization](../../../../reference/decisions/t1-p02-s03-authorization-2026-10-27.md))
  and the phase [drawing policy](../README.md#drawing-and-enclosure-policy-owner-accepted-2026-10-22).

Not in scope, and not claimed: implementation correctness, browser or performance evidence, the
independent implementation review, and owner acceptance.

## 2. Authority and seam evidence read

| Source | What it establishes |
| --- | --- |
| [PLATE — Walls and hosts](../../../../reference/design-system/editor-shell-and-visual-system.md) | An Opening is cut in an eligible host's coordinates by Ink on a wall face; hosts are sought, projected onto host axes and refused in words; a selected host wins ties and selection does not change; tools stay armed between hosts |
| [Architecture — semantic authorities](../../../../reference/architecture.md) | Layout owns hosted Openings; one canonical compiler; no second ownership or duplicate domain rule |
| [`layout-wall-openings.ts`](../../../../../packages/layout-core/src/layout-wall-openings.ts) | `planCreateWallFirstOpening` / `planDeleteWallFirstOpening` already own fit, overlap, height and captured identity; **no clamping**, rejection is the contract |
| [`layout-opening-set.ts`](../../../../../packages/layout-core/src/layout-opening-set.ts) | One validator owns host span, interval fit, vertical fit and same-Wall overlap; adapter wording must not re-derive it |
| [`drawing-planners.ts`](../../../../../apps/editor/src/lib/authoring/adapters/layout/drawing-planners.ts) | The S02 pattern for captured F4 planners, COW recording, correspondence and one candidate change; S03 follows it rather than inventing a path |
| [`layout.adapter.ts`](../../../../../apps/editor/src/lib/authoring/adapters/layout.adapter.ts) | Ink lifecycle, host hit test, preview/commit identity, re-arm after install and the Card's scoped actions |
| [`ink.ts`](../../../../../apps/editor/src/lib/authoring/adapters/layout/ink.ts) | The published palette surface and the existing Junction/Wall hit test; the Opening host reading extends the same model |
| [`LayoutCardFields.svelte`](../../../../../apps/editor/src/lib/authoring/adapters/layout/LayoutCardFields.svelte) + `precision.ts` | Offset/width/height/sill already have one Card writer through `layout-opening-measure`; S03 must not duplicate it |
| [tests/README](../../../../../apps/editor/tests/README.md#what-a-change-requires) | `architecture-integration` tier, full PR gate, performance as on-demand evidence only |

## 3. Contract compatibility

**C1 — no F4 contract change.** The two new operations register through the existing captured-intent
path and per-planner scope. Preview and acceptance use one immutable capture and the working level;
no new reference, envelope or save behaviour is introduced. `unit-acceptance-v1` and
`conditional-save-units-v1` stay as landed.

**C2 — the domain rule stays single.** Fit, overlap, vertical fit and host resolvability are the
existing planning gates. The plan's adapter-side sentences are composed from rejection codes and
values, not recomputed geometry; the ghost is the planner's own candidate.

**C3 — the shell seam is already generic.** A reading inside the Ink palette and an Opening Card
action need no Stage, Head or route edit. The plan adds no dock key, no Index family and no shell
module change. T2/T3 adapter contracts are untouched.

**Post-build correction:** Hover preview required additive Stage facade and spatial route edits; the
review fix also updates the Stage session task generation. The pre-build assessment above is retained
as review history, not a description of the actual diff.

**C4 — identity and consequences are preserved.** The create capture mints the Opening id before
evaluation; delete correspondence retires the identity; Wall deletion keeps S02's one-step hosted
retirement. Nothing retargets Camera/Experience references.

**C5 — the plan is executable at the trusted base.** The planners, the tolerance-based host test,
the preview/commit lifecycle, the Card writer and the on-demand browser supervisor all exist. The
new file is the smallest seam that keeps drawing planners focused; it is not a second coordinator.

Findings: **no blocking defect at plan level.**

## 4. Risks and controls

- **Pointer-only creation would fail keyboard parity.** Control: the typed-offset action on the
  preferred host is part of the plan, not an optional extra.
- **A ghost that clamps would launder an invalid placement.** Control: offset is the pointer's exact
  projection; out-of-fit is refused, never shifted.
- **Reading changes could hide a live Wall proposal.** Control: switch is refused while a chain has
  points; other unwinds clear the Opening preview and write nothing.
- **Two accepts for one press.** Control: the create state machine owns one in-flight guard, as the
  chain commit already does.
- **Performance rows can be mistaken for correctness.** Control: they are on-demand evidence and any
  unrun row is recorded as owed to S04, never as a pass.

## 5. Conditions

1. The implementation PR keeps the two operations on the one Layout coordinator and the one
   canonical compiler; a second acceptance path, document edit or host-geometry implementation
   blocks the slice.
2. The adapter never clamps a pointer or typed offset and never substitutes its own overlap/fit
   check for the planner's rejection.
3. Any shared Stage/Head edit discovered during build stops and reports; the plan's shell claim is
   "no edit".
4. The standing independent implementation review remains required before merge, along with the full
   PR gate and the browser/performance evidence named in the plan.
5. No lifecycle status is promoted by this review: S03 stays `approved` in the phase register until
   owner acceptance.

## 6. Verdict and what remains

**Verdict: pass for the plan, with the conditions above.** Implementation starts on its own branch
from `98449a44`, with:

- the independent implementation review before merge;
- the full required gate and the browser journey;
- F4/F8 Opening rows measured on the designated M2 or explicitly recorded as unrun and owed to S04;
- every existing budget, cycle and ownership rule unchanged.

**Omissions, named rather than implied.** No browser journey, performance measurement or production
edit was made for this review. No owner or independent sign-off is claimed.

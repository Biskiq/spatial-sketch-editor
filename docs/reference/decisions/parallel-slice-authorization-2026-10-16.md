# Parallel slice authorization and reconciliation decision

**Date:** October 16, 2026. **Status:** **owner-authorized** — the owner authorizes four slices to
run in parallel and asks for their plans to be reconciled, challenged and registered first. The
authorization and the reconciliation decisions below land together in one docs-only PR and take
effect only when that PR merges after independent review. Until then nothing here is claimable work.

This record is decision provenance, like the [2026-10-15 F ratification](./f-ratification-2026-10-15.md)
that authorized `T1.P01.S01`. It changes no ratified contract: F semantics stay in
[`composition-execution.md`](../composition-execution.md#ratified-amendments), lifecycle and gate
identity stay in the [roadmap register](../../roadmap/README.md#gate-register), and each slice's
scope stays in its own plan. It copies none of them.

## Authorization

| Slice | Phase | Plan | Consumes / Requires at authorization |
| --- | --- | --- | --- |
| `T1.P01.S02` — Shell, Stage and viewport provider | T1.P01 (registered 2026-10-15) | [plan](../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s02-shell-stage-and-viewport-provider/implementation-plan.md) | `F1.reference@1`, `F3.channels@1` / `references-v1`, `inspection-v1` |
| `T1.P01.S03` — Local acceptance and history foundation | T1.P01 | [plan](../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s03-local-acceptance-and-history-foundation/implementation-plan.md) | `F1.reference@1` / `references-v1` |
| `T2.P01.S01` — Deterministic candidates and canonical floor support | T2.P01 (registered here) | [plan](../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s01-candidates-and-floor-support/implementation-plan.md) | `F1.reference@1` / `references-v1` |
| `T3.P01.S01` — Shared unit and program codecs | T3.P01 (registered here) | [plan](../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s01-unit-and-program-codecs/implementation-plan.md) | `F1.reference@1`, `F3.channels@1` / `references-v1`, `inspection-v1` |

Every consumed gate and required scope is `accepted` on the trusted base: post-PR #126 `main`
(`6964c2dc`), where the accepted F1/F3 implementation commit `ee463d0b` is an ancestor. Each slice
enters through its track runbook's start step; `T1.P01.S02` is a listed exposure of the configured
architecture-cycle window, so its first authorized implementation — not this authorization — opens
that window.

**Registrations that carry this authorization.** T2.P01 and T3.P01 are registered so that their
first slices have a phase, a slice register and a final gate; T2 and T3 move from `planning` to
`approved`. The register `Provider slice` column is wired for exactly the providers authorized here
— `T1.viewport-projection@1` → `T1.P01.S02`, `F4.intent-acceptance@1` → `T1.P01.S03`,
`F2.unit-envelope@1` → `T3.P01.S01` — and every one of those rows stays `ratified` with empty
evidence.

## Reconciliation decisions

The owner asked for an adversarial review that resolves material weaknesses rather than aligning
text. These are the decisions that review made; each is folded into the plan or register that owns
it.

| # | Decision | Why | Owner of the live statement |
| --- | --- | --- | --- |
| 1 | **T3.P01 is registered as the source/runtime cutover phase (S01–S04, final gate S04).** First capture and Cut Preview with its integrated gate become a candidate next phase, T3.P02, registered once `T3.camera-experience-cutover@1` is drafted and owner-ratified. | Those slices consume a gate that is still `undrafted` with no version, so they cannot be registered without either an unratified version or an untruthful `Consumes`; and the activation slice is already the exhaustive integration point. | T3 track README, T3.P01 README, T3.P02 proposal |
| 2 | **`T1.P01.S03` provides both F4 scopes AM-4 assigns it:** the enduring `acceptance-invariants-v1` and the retiring `local-single-domain-v1`, which requires it. | The plan named only the retiring scope, leaving the unit capabilities' ratified prerequisite without a provider. | S03 plan |
| 3 | **Admission equals runtime preparation.** An accepted current-source candidate passes `validateProject` with the host's Scene options, resolves through the runtime Scene path and introduces no blocking canonical-compile issue absent from its baseline. | Otherwise the editor could accept a document the visitor cold runtime refuses. | S03 plan |
| 4 | **One current-source content identity:** the landed `sha256Bytes` over canonical authored-content bytes: the strict writer's normalized source with ID-keyed Layout identity maps ordered and only `layout.identity.cursor` excluded. Full canonical source retains the cursor for persistence/history. The digest is invariant to input key order and whitespace, exported once from `@portfolio/project-model`. S03 owns its meaning; whichever of S02/S03 merges first lands the export and the other reuses it; Save and the API reuse it later. | S02 (boot), S03 (acceptance) and later T3 Save each need it in parallel; two definitions would make `exact` references and Camera-output source identity disagree after integration. | S02 and S03 plans; cross-track batch protocol |
| 5 | **Shared F4 contracts in the package, history editor-only.** The AM-4 types, current-source admission and content identity live in `@portfolio/project-model`; the coordinator and its 100-entry history are editor-only and never reach a package barrel the public route imports. | `@portfolio/project-model` has one root export that the public route's module graph includes, and the public gate checks that graph by path, not by tree-shaking. | S03 plan |
| 6 | **Host-to-F4 integration is owned by `T1.P01.S04` by default.** Accepted install → Stage snapshot, Undo/Redo commands, replacement → new history baseline, correspondence-based selection requalification and Camera-output rebase are not S02's or S03's: neither may consume the other and both stay parallel. | Under the trusted-base rule, a slice that wires the other's output would have to `Consume` it before starting. | S04 plan; cross-track batch protocol |
| 7 | **S03's proof operations are conformance-scoped.** S03 ships the registration seam and Layout/Scene admission, not production operation kinds. | Production Layout operations are S04/S05's, Scene operations `T2.P01.S02`'s; an S03 operation would pre-empt both. | S03 plan |
| 8 | **The floor-support query is Layout-owned and built by its first consumer.** `T2.P01.S01` adds it to `@portfolio/layout-core` as a read-only query over compiled output, under T1 review; callers supply the compile-generation identity S02 owns. Because `layout-core` sits below `project-model`, the query (like S02's Plan representation) speaks Layout-native IDs and F1 qualification happens above it. | The T2 draft left its ownership to T1/Layout review; a T2-owned copy or an S02 support resolver would be a second authority, and importing F1 types into `layout-core` would create a dependency cycle. | T2.P01.S01 and S02 plans |
| 9 | **Scene planners never rewrite Camera-bearing Scene fields.** T2 operations produce entity-level changes; Camera data passes through untouched by construction. | Byte-exact Camera preservation becomes structural, and the T3 Scene 2 cutover changes only the adapter. | T2.P01.S01 plan |
| 10 | **New F2 codecs, the converter and the program codec stay off the root barrel.** `ExecutionProgram@1` gets a standalone entry whose import closure is proven on the module graph; `unit-resolution-v1` is additive and leaves `references-v1` conformance unchanged. | AM-6 requires a delivery-only closure, and normal readers and the public route must not import the migration-only converter. | T3.P01.S01 plan |
| 11 | **S02 implements the landed F1/F3 surface, not the earlier draft:** the `layout.plan@1` family (`cut-height`, `depth`, `lateral-span`, `source-kind-filter`, `reveal`), whose single `lateral-span` is the contract's "lateral span/crop", so membership reports `outside-span` and no separate `outside-crop`; fragment sub-references use only the landed `component`/`interval` kinds, a Wall side being a Layout-declared component ID. | The interface draft predates S01's acceptance; a second lateral property or a new sub-reference kind would be an F extension, not provider latitude. | S02 plan; T1.P01 interfaces |
| 12 | **The viewport consumes the landed Camera-output rebase.** A content change ends the live inspection claim, and the host re-acquires it without moving or refitting the view. | The protocol deliberately does not requalify ownership across sources; S02, accepted before any edit exists, must still prove the post-edit path. | S02 plan |
| 13 | **Consumers name the viewport capability.** `T1.viewport-projection@1:viewport-projection-v1` (AM-5) joins the `Requires` of every slice consuming that gate. | A consumer declares what it uses; consuming the gate version alone is not readiness. | Phase slice registers |
| 14 | **Parallel shared-file protocol** for the four slices: one writer per shared module, append-only barrels and lane lists, and the full merge gate re-run on the then-current `main`. | Four concurrent slices write into two shared packages, one test-lane list and two barrels. | [cross-track batch protocol](../../roadmap/cross-track-execution.md#parallel-batch-2026-10-16) |
| 15 | **Every authorized plan carries the engineering principle:** *"Exercise ambitious independent engineering judgment: challenge assumptions, investigate missing invariants and cross-system failure modes, pursue stronger or simpler solutions, and resolve demonstrated defects without speculative abstractions or unauthorized contract changes."* | Owner direction for the implementing agents, who keep their design freedom inside the ratified contracts. | Each of the four plans |

## Explicit non-implications

- **No other slice is authorized.** `T1.P01.S04`–`S06`, `T2.P01.S02`–`S04` and `T3.P01.S02`–`S04` are
  registered as `proposed` and hold no implementation permission. T3.P02 and T4 register nothing.
- **No gate changes state.** Wiring a provider is not implementation; every affected row stays
  `ratified` with empty evidence, and no Accepted-capabilities entry is added.
- **No cycle transition.** The T1.P01 window stays selected and unopened; T2/T3 slices are not
  exposures and cannot open it.
- **No contract changes.** AM-1–AM-8, PLATE, the landed `reference/*` contracts and the gate rules
  are unchanged; landed contracts keep describing current behavior until each slice's own cutover.

## Provenance

Owner request, 2026-10-16, against post-PR #126 `main` (`6964c2dc`). The reconciliation PR
(`parallel-four-slice-authorization`) carries the register changes, the reconciled plans and the
evidence; independent review precedes merge, and no implementation or orchestration starts before
it merges. Its only non-Markdown change is the execution-structure gate's live `Requires` pin in
`apps/editor/tests/docs/parallel-track-gates.test.ts`, updated to the registrations above; the
gate's rules are unchanged.

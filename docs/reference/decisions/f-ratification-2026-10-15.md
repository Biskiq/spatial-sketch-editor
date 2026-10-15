# F-interface ratification and capability-readiness decision

**Date:** October 15, 2026. **Status:** **owner-ratified.** The owner approves the seven decisions of
the coordinated ratification PR [#124](https://github.com/Biskiq/spatial-sketch-editor/pull/124) and
adopts the six policy dispositions below. The independent reviewer accepted the architecture and the
subsequent F4 corrections, and verified the neutral cross-track document relocation.

This record is the decision provenance. The live normative statements stay in
[`composition-execution.md`](../composition-execution.md#ratified-amendments) and the
[gate register](../../roadmap/README.md#gate-register); this record copies neither. It authorizes no
implementation by itself: the approved T1.P01.S01 entry is registered and authorized separately.

## Ratified decisions

| # | Decision | Consequence and live owner |
| --- | --- | --- |
| 1 | **AM-1–AM-8 are the shared product/architecture contracts.** | The exact F.1 reference, F.2 envelope, F.3 inspection plus Camera-output protocol, F.4 local acceptance/Save/retirement, the shared Stage seam with starter gallery, the ExecutionProgram codec with bounded profile, the source-migration policy and the prepared-delivery direction are ratified as written in [`composition-execution.md`](../composition-execution.md#ratified-amendments). |
| 2 | **F1–F4 and `T1.viewport-projection` are ratified at version 1.** | The gate register records `ratified` with empty evidence columns. No implementation, export, conformance fixture or acceptance record is claimed. |
| 3 | **Capability-specific readiness, trusted-base enforcement and retirement semantics are adopted.** | The rule is owned by [`f-foundation-contracts/README.md`](../../roadmap/f-foundation-contracts/README.md#capability-readiness); its checker enforcement is authorized T1.P01.S01 work, not installed by this decision. |
| 4 | **The enduring `acceptance-invariants-v1` capability stays inside F4@1; only current-source adapter admissions retire at T3.P01.S04.** | Retirement is per scope and terminal. Unit acceptance depends on F2 and the enduring invariants, never on a retiring admission. F4 keeps its major version. |
| 5 | **Local accepted revisions stay separate from cloud saved-base concurrency tokens.** | `AuthoringIntent.expectedRevision` compares the local `AcceptedRevision`; `SaveAcceptedSource@1` compares a durable saved-base token that is not the local accepted revision, not a SQL version ordinal and not a publication pointer revision. |
| 6 | **Sole-provider assignments are confirmed and register through their own authorized track phase.** | F1/F3 → T1.P01.S01 · F4 → T1.P01.S03 (Save/unit extensions T3.P01.S02/S03) · F2 and the ExecutionProgram codec → T3.P01.S01 · F5 → T4.P01.S02 · viewport seam → T1.P01.S02 · source/runtime cutover → T3.P01.S04 · prepared reader → T4.P01.S05. The register `Provider slice` column is wired at each phase registration. |
| 7 | **The T1.P01.S01 registration/authorization path is approved as the next capability implementation entry.** | Registering T1.P01 and approving T1.P01.S01 is authorized. Every other slice, phase and track stays unauthorized until separately approved. |

## Policy dispositions

| # | Question | Owner disposition |
| --- | --- | --- |
| 1 | Numeric conformance tolerances | Provider-owned conformance parameters; the amendments stay silent. |
| 2 | Plan cut/depth calibration defaults | Provider-calibrated (S02); not ratified defaults. |
| 3 | Ratify the viewport interface before S02 implementation | Yes — shape approval precedes S02 acceptance, which still proves the implementation. |
| 4 | Freeze the exact F5 codecs in this round | No — deferred to T4.P01.S02. |
| 5 | Introduce a new F4 major for the scope split | No — F4 stays at major version 1. |
| 6 | Release Baseline, Source Baseline and any publication gap | Separate, evidence-backed future decisions; no blanket approval. |

## Explicit non-implications

- **Ratified is not implemented.** No shared code, export, fixture, acceptance record or implementation commit exists for any ratified interface.
- **Implemented is not accepted.** A provider landing code does not accept its gate.
- **An accepted shared gate does not accept every extension capability.** Each capability scope carries its own acceptance evidence at the trusted base.
- **The approved T1 authorization does not authorize T2–T4.** Future track registrations and their slices remain separately authorized even though their plans already exist.

## Provenance

PR #124 (`f-contract-ratification`), owner approval 2026-10-15. The ratified shapes are the F target
contract's amendments; the planning proposals they were promoted from remain planning evidence in
[`../../roadmap/`](../../roadmap/README.md) and are not raised to contract authority by this record.

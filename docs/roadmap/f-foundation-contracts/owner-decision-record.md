# F ratification — owner-decision record

**Status:** proposed with the coordinated ratification PR; no decision here is ratified until the
owner approves the precise normative diff. Route: [f-foundation-contracts](./README.md) ·
[gate register](../README.md#gate-register) ·
[capability readiness](./README.md#capability-readiness) · normative
[`../../reference/composition-execution.md`](../../reference/composition-execution.md).

## Recommended decisions

1. **Ratify AM-1–AM-8** as written: exact F.1 reference, F.2 envelope, F.3 inspection plus
   Camera-output protocol, F.4 local acceptance/Save/retirement, the shared Stage seam with
   starter gallery, the ExecutionProgram codec with bounded profile, source migration policy and
   prepared-delivery direction.
2. **Move F1–F4 and `T1.viewport-projection` to `ratified` version 1** with amendment anchors
   and empty evidence columns. Keep F5, the T3 cutover and the T4 reader `undrafted` until their
   first-consumer drafts (T4 S02, T3 S04, T4 S05) land.
3. **Adopt the capability-readiness rule** (Accepted capabilities / Requires, trusted-base
   eligibility, retirement terminal state) with checker enforcement landing in authorized
   T1.P01.S01.
4. **Record F.4 retirement per scope.** `acceptance-invariants-v1` is the enduring acceptance
   layer and never retires, so it stays the prerequisite of `unit-acceptance-v1` and
   `conditional-save-units-v1`; only `local-single-domain-v1` and `conditional-save-current-v1`
   retire with the current-source adapter at T3.P01.S04. This keeps one F.4 provider and one
   versioned capability model — no parallel registry, permanent legacy admission, invented
   evidence or new framework.
5. **Confirm F.4's two Save identities.** A local intent compares `expectedRevision` against the
   local `AcceptedRevision`; cloud persistence compares a captured accepted source against a
   durable saved-base token that is not the local accepted revision, not a SQL version ordinal
   and not a publication pointer revision.
6. **Confirm sole-provider assignments** in amendment text; wire the register `Provider slice`
   column at phase registration (naming unregistered slices now would fail the gate lane).
7. **Confirm T1.P01.S01 eligibility:** on approval plus phase registration, S01 may start and
   install Requires enforcement; no other slice, migration, gap or Baseline is authorized.

## Questions the evidence cannot settle

| # | Question | Recommendation | Why it is open |
| --- | --- | --- | --- |
| 1 | Should numeric conformance tolerances (T2 support-boundary/coplanar 1e-6 m, normal 1e-9, pose agreement 1e-6) be normative or provider conformance parameters? | Provider conformance; amendments stay silent. | They are operation-local calibration, not cross-domain semantics; freezing them invites false precision. |
| 2 | Should Plan calibration defaults (1.2 m cut height, 100 m finite depth) be ratified defaults or S02 parameters? | S02 parameters under review. | Same reason as 1; defaults are reviewable without normative force. |
| 3 | Is `T1.viewport-projection@1` rightly ratified now rather than at S02 acceptance? | Yes — the seam is fully drafted with consumer probes. | Ratification here is shape approval; S02 acceptance still proves the implementation. Owner confirms the timing. |
| 4 | Is deferring the exact F5 envelope to T4.P01.S02 correct, or should this round freeze it? | Defer — S02 is the drafting provider. | The T4 draft is direction-grade; freezing it now would preempt the provider's specification slice (T4 S01). |
| 5 | Is splitting the bundled F.4 scope into enduring `acceptance-invariants-v1` plus the retiring current-source admission the correct minimum? | Yes — one scope on one existing entry, no new gate/provider/registry. | The owner should confirm that the enduring invariants must stay Requirable after adapter retirement rather than be re-established by a new major. |
| 6 | Release Baseline, Source Baseline and any publication gap. | Separate future decisions with actual inventory. | No evidence in this round covers durable external use; AM-7/AM-8 require inventory plus explicit approval at activation. |

No merged phase proposal required edits for this round: they speak in proposed terms and the
register remains the live authority. On owner approval, this record is promoted to
[`../../reference/decisions/`](../../reference/decisions/) as the ratification entry under the
established `<name>-<YYYY-MM-DD>.md` convention, dated by the owner decision itself. Until that
approval it stays a proposal here and no approval date is claimed.

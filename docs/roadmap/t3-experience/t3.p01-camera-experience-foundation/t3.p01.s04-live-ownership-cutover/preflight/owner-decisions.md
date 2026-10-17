# Owner decisions — T3.P01.S04 preflight

**Status:** open. Nothing here is approved. This file collects the decisions only the repository owner
can make; the coordinator escalates them with the executed inventory attached.

Order matters: D1–D2 precede D3. D4 only applies if the inventory produces a finding; D5 is part of
D3's recovery plan.

---

## D1 — Publication compatibility disposition (AM-7, K2)

**Question:** What happens to existing publications while prepared delivery is deferred by R1-D?

**Options**

| # | Option | Consequence |
| --- | --- | --- |
| A | Approve a gap bounded by the measured publication set | Those public links are unavailable until T4's prepared-reader cutover; status/Unpublish stay honest; new Publish refuses |
| B | Require conversion of existing release artifacts before activation | S04 grows a release converter and delivery barrier; scope and risk expand; front-runs deferred F5/T4 work |
| C | Measured-zero gap | No existing audience affected; first publication waits for T4 |
| D | Reject activation for now | Keeps the current path; the whole cutover and its consumers wait |

**Evidence needed:** executed [inventory](./inventory.md) publication/release rows with provenance,
per-publication artifact readability probe, and the [disposition table](./publication-disposition.md)
filled in.

**Recommendation:** C if measured zero; A for a small fixed set; escalate to B if the set is large or
business-critical. There is no blanket approval. Choosing A or B for a non-zero set amends the phase
README's stricter activation rule and needs a ratified amendment, not only this decision record.

**Owner decision:** _pending_ — date, choice, scope list, signature.

---

## D2 — Ratify `T3.camera-experience-cutover@1` and choose its contract anchor

**Question:** Ratify version 1, and where does the contract live?

**Options**

| # | Option | Consequence |
| --- | --- | --- |
| A | New `AM-9` section in the composition-execution reference, heading `AM-9 Shared Camera and Experience cutover` | Keeps all F/cutover interfaces in one ratified document; needs owner-ratified amendment to a ratified contract; register anchor is `am-9-shared-camera-and-experience-cutover` |
| B | Dedicated contract page in the reference directory (proposed, not written), heading `T3 Camera and Experience cutover` | Lower blast radius on the F document; adds a separate page and index entry; anchor is `t3-camera-and-experience-cutover` |
| C | Defer ratification | S04 stays unauthorized; T3.P02 cannot register; downstream work stalls |

**Evidence needed:** [gate-draft.md](./gate-draft.md) §5–§9; confirmation that the provider is sole and
the consumers are correctly named.

**Recommendation:** A — one ratified interface neighbourhood, one anchor that the register validator
can resolve, and no second contract style.

**Owner decision:** _pending_ — anchor choice, ratification date, recorded act.

---

## D3 — Authorize T3.P01.S04

**Question:** Does implementation start?

**Options**

| # | Option | Consequence |
| --- | --- | --- |
| A | Authorize after D1–D2 and all four preflight items are reviewed | Normal path; S04 starts with a closed authorization table |
| B | Authorize conditionally, with the gap decision recorded and inventory findings dispositioned | Same work, more explicit residual risk; needs a named stop condition |
| C | Do not authorize | S04 stays `proposed`; no activation work starts |

**Evidence needed:** reviewed inventory, migration coverage, quiescence/recovery, publication
disposition, ratified gate, and the owner's own decision record.

**Recommendation:** A. Conditional authorization is only sensible if the inventory is complete and the
only residual is the gap itself.

**Owner decision:** _pending_.

---

## D4 — Inventory-forced scope change

**Question:** If the inventory finds unknown formats, broken publications, orphan assets or a
conversion-refusal class with no viable repair, what happens?

**Options**

| # | Option | Consequence |
| --- | --- | --- |
| A | Extend coverage with a bounded, reviewed converter case | S04 scope grows; needs its own fixtures and review, not a silent exception |
| B | Exclude those projects/publications with a recorded, disclosed disposition | Cutover proceeds for the covered set; excluded data must remain readable or explicitly unavailable, never deleted |
| C | Stop activation until the finding is resolved | Safest where authored data would be lost or misread |

**Evidence needed:** the executed inventory, the refusal classes from
[migration-coverage.md](./migration-coverage.md), and a per-finding count.

**Recommendation:** C for authored-data loss or unknown formats; B for broken rows with no owner
impact; A only when the case is genuinely bounded and reviewable.

**Owner decision:** _pending_ — only if a finding exists.

---

## D5 — Post-activation recovery rule

**Question:** After the first new-format edit, what recovery is promised?

**Options**

| # | Option | Consequence |
| --- | --- | --- |
| A | Roll forward/repair; restore only an explicitly selected backup with disclosed loss | Honest, bounded, consistent with the phase's "no reverse conversion" rule |
| B | Keep the pre-cutover backup as a hard rollback target indefinitely | Invites silent data loss of all new-format edits; needs a retention decision |
| C | No backup after activation | Unacceptable for authored data |

**Evidence needed:** [quiescence-recovery.md](./quiescence-recovery.md) rehearsal results and the
converter retirement condition.

**Recommendation:** A, with backup retention stated as a separate operational decision.

**Owner decision:** _pending_.

---

## Explicitly not owner decisions here

- Whether the inventory may use the local Compose database — **no**, by contract.
- Whether drafting this gate ratifies it — **no**.
- Whether S04 may migrate live data before authorization — **no**.
- Whether T4 or T3.P02 is authorized — **no**; R1-D stands for T4, and T3.P02 remains unregistered.

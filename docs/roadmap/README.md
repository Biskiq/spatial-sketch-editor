# Roadmap — areas and archived registers

**Role:** area routes and historical register anchors. **Status is computed:** `npm run status`
(capability maturity, health, flags, claims). **Workflow:** [`../workflow.md`](../workflow.md).
**Focus:** [`../../focus.md`](../../focus.md).

T1–T5 are areas, not permission gates. New work is identified by capability ids in
[`capabilities.json`](../../capabilities.json), claimed in GitHub and reviewed by risk tier. Phase
and slice identifiers below remain valid as history.

## Track register

| Track | Status | Roadmap |
| --- | --- | --- |
| T1 | approved | [T1 — Spatial world](./t1-spatial-world/README.md) |
| T2 | approved | [T2 — Composition](./t2-composition/README.md) |
| T3 | approved | [T3 — Experience](./t3-experience/README.md) |
| T4 | planning | [T4 — Release and delivery](./t4-release/README.md) |
| T5 | approved | [T5 — Expressive Geometry](./t5-expressive-geometry/README.md) |
| R115 | shipped | [R115 — PR #115 architecture reset](../archive/roadmap/parallel-track-cutover/README.md) |
| R217 | shipped | [R217 — Core Editor Stability](./r217-core-editor-stability/README.md) |

R217 is closed; Core Product Stability was accepted at #271 (`ce4e232c`), with S11
[owner-accepted by override and separate execution waived](./r217-core-editor-stability/r217.s11-integrated-final-gate/acceptance.md).
That is product acceptance, not a claim that every individual check ran. R115 is a repository phase,
not a track.

## Gate register

The gate register is historical interface evidence, archived with the retired process register:
[`roadmap-register-2026-11-06.md`](../archive/roadmap/roadmap-register-2026-11-06.md#gate-register).
Accepted F1–F4 identities and their providers remain valid evidence; semantics stay owned by
[`../reference/composition-execution.md`](../reference/composition-execution.md) and the domain
contracts. New work uses capability ids and the ledger, not new gate rows.

## Production implementation hold

The production hold and the owner-written release list retired on 2026-11-06. Permission now follows
the [risk tiers](../workflow.md#risk-tiers-the-highest-applicable-tier-wins); the owner starts batches
by prompt, with the current priority in [`focus.md`](../../focus.md). #259's harness implementation
is the active scope. No open hold exists.

## History

Closed phase trees, the release list, coordination DAG, batons, architecture cycle and closeout
procedures live under [`../archive/`](../archive/). They are provenance, never current authority.

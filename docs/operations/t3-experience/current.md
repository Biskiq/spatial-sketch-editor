# T3 — Experience: current baton

Track-scoped handoff; lifecycle status belongs to the phase and track registers.

```text
PHASE: T3.P01 Camera-experience foundation (closable, not closed) →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md
SLICE: T3.P01.S04 shipped/closed 2026-10-20; final-gate acceptance and evidence are in the routed
       acceptance record. T3.camera-experience-cutover@1 is accepted at the reviewed implementation
       revision; no other capability scope was inferred.
NEXT:  Owner merge review of PR #158 using P1 merge-commit method (no squash/rebase), then verify the
       preservation anchor. Owner may then run phase-closeout or leave T3.P01 open.
BLOCKER: none for slice closeout. Phase closure, post-merge anchor verification and production
         activation are separate owner actions.
ROUTE: ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md →
       t3.p01.s04-live-ownership-cutover/acceptance.md (review provenance, final gates, limitations,
       preservation report and P1 merge requirement).
CARRY: T3.P02 remains candidate/unregistered until its trusted base contains the accepted cutover
       gate. T1.P01.S06 remains proposed with its F2/cutover requirements unchanged. T2 owns catalogue
       model/resource verification; T4 owns the prepared public reader. Migration 005, deploys and
       namespace-scoped object purge remain post-merge activation steps.
```

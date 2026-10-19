# T2 — Composition: current baton

Track-scoped handoff. **Replace only this file for T2 work.** It carries T2's current work and its
immediate next step; it is not a status store, a plan or another track's state.

```text
NOT:  status · a plan · the gate register · another track's state
OWNS: T2's current work and immediate next step
READ: this file → the phase README → the exact slice plan
FEED: the owning phase README (child status/order) · the gate register (exact interfaces)
```

Authoritative status stays outside this file: a phase README owns its slice register and the
[gate register](../../roadmap/README.md#gate-register) owns exact interfaces. Never synchronize another
track's baton, and never treat stale baton text as a blocker — verify Git state and the registered
prerequisites instead.

```text
PHASE: T2.P01 Supported object composition (in-progress) →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md
SLICES: the phase README's slice register is authoritative — S01, S02 and S03 shipped; S04, the
        phase's declared FINAL PHASE GATE, is proposed and unauthorized.
BATON: S03 closed 2026-10-18 at implementation `2747f1691551296e21b17aa04dfd9de76cb08f59`
        (tag `closed/T2.P01.S03`); its record, verification tier, residuals and closed-work
        recovery:
        ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s03-first-editing-surface/acceptance.md
        The closed work merges through PR #147, whose required merge method is a merge commit; the
        tag stays local until the post-merge anchor check.
NEXT:   merge PR #147 (merge commit) → verify the anchor is an ancestor of `main` → push the tag.
        S04 then needs owner authorization only: its registered prerequisites are already satisfied
        on `main` (`conditional-save-current-v1` accepted; T1's Head Save integration landed via
        `T1.P01.S04`, PR #148, merged 2026-10-18).
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s03-first-editing-surface/acceptance.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s04-bounded-composition-loop/implementation-plan.md
BLOCKER: S04 authorization. PR #147's merge does not wait on anything else.
```

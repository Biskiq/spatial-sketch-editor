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
SLICES: T2.P01's slice register is authoritative — S01, S02 and S03 shipped; S04 proposed and
        unauthorized.
BATON: S03 pointer Move was repaired after manual browser acceptance found its ray used the wrong
       CSS origin. The delta review found no issues; real-browser Move/Yaw, F4 commit, Undo/Redo and
       refusal evidence passed. PR #147 has the refreshed code and acceptance. The compact record and
       archived screenshots are routed here:
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s03-first-editing-surface/acceptance.md
       Full acceptance body anchor `2747f1691551296e21b17aa04dfd9de76cb08f59` is tagged
       `closed/T2.P01.S03` (local only — not pushed). PR #147 is owner-accepted and open. The
       documentation-reference gate passed (55 tests).
NEXT: Final merge of PR #147 as a merge commit. After merge, verify the anchor is an ancestor of
      `main` and push the tag. S04 remains proposed and unauthorized; it also waits for its
      registered prerequisites.
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s03-first-editing-surface/acceptance.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s04-bounded-composition-loop/implementation-plan.md
BLOCKER: none for S03. S04 waits on its prerequisites and authorization.
```

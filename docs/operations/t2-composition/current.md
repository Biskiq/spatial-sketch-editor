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
SLICES: T2.P01's slice register is authoritative — S01/S02 shipped; S03 accepted after repair;
        S04 proposed and unauthorized.
BATON: Manual browser acceptance found S03 pointer Move did not publish a candidate. The coordinate
       mapping and refusal feedback are repaired, independently reviewed with no findings, and
       accepted with real-browser Move/Yaw commit and Undo/Redo evidence. Current full acceptance
       record and archived screenshots are routed here:
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s03-first-editing-surface/acceptance.md
       Code/evidence and refreshed docs remain uncommitted on `T2-P01-S03` / PR #147; the current full
       record stays in the working tree because the previous anchor `5dca5459` only preserves the
       superseded acceptance. No commit, push or merge was made.
NEXT: Preserve the refreshed code, evidence and acceptance record in an owner-authorized commit on
      the existing PR branch. The documentation-reference gate passed (55 tests). The P1 merge
      method is a merge commit; post-merge anchor verification and tag push follow only after the
      owner decides to merge. S04 remains proposed and unauthorized; it also waits for its
      registered prerequisites.
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s03-first-editing-surface/acceptance.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s04-bounded-composition-loop/implementation-plan.md
BLOCKER: S03 has no open correctness finding; preservation anchor and PR update need a commit, which
         the repository's no-commit rule does not authorize without an explicit user request. S04
         waits on its prerequisites and authorization.
```

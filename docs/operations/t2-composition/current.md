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
SLICES: T2.P01's slice register is authoritative — S01 shipped 2026-10-16; S02 shipped 2026-10-17
        under an owner override of the pending re-review of `62d4d5b0`; S03–S04 proposed and
        unauthorized.
BATON: none active. S02 (Scene operations and shared history) is closed on branch `T2-P01-S02`
       (PR #134), cut from `main` `74367936`, in parallel with `T3.P01.S02` under the pair protocol.
       It consumes the accepted `local-single-domain-v1` and registered no live host.
NEXT: Merge gate for PR #134 against then-current `main` — reconcile `origin/main` first; the required
      merge method is a merge commit so the `closed/T2.P01.S02` anchor stays reachable, and post-merge
      anchor verification follows. S03 is not authorized.
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md
BLOCKER: none.
```

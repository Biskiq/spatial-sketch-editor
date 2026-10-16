# T3.P01.S02 — Early conditional Save: implementation plan

**Slice:** T3.P01.S02 · **Status:** proposed — not authorized · **Phase:** [T3.P01](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T3](../../README.md) · **Runbook:**
[T3 operations](../../../../operations/t3-experience/README.md)

```text
CONSUMES: F1.reference@1, F4.intent-acceptance@1
REQUIRES: F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t3.p01.s04-live-ownership-cutover/implementation-plan.md
```

## Prerequisite

`T1.P01.S03`'s `local-single-domain-v1` accepted at this slice's trusted base. Not F2, F3, viewport or
the source cutover. Before authorization the owner settles where the dirty/saving/saved/conflict
control mounts: it belongs in T1's shell Head, so either this slice consumes the accepted host or the
host↔F4 wiring slice owns the control while this slice ships protocol, server and client state.

## Scope

Extend T1's shared F4 with `conditional-save-current-v1`. Implement capture of immutable local
accepted source, AcceptedRevision/content digest, create-only or exact saved-base precondition and
stable operation identity. Use the existing source adapter's full validation; compare
ownership/revision, validate and append/update atomically in the server transaction. Replace
unrestricted current-source PUT admission, including old-client rejection and create
collision/privacy behavior.

Recompute the digest server-side with the single content-identity export and reject revision identity
reused for different contents. A client and server whose canonical form or digest version differ
refuse explicitly rather than compare unlike bytes. Return persisted source revision/digest plus a
fresh saved-base token; keep metadata outside the strict current source document. Identical retries
return their prior receipt, never another version. An older in-flight Save cannot mark newer local
edits saved or install into a replaced session. Local editing/Undo remains immediate; server conflict
preserves local work/history and remote data. Provide dirty/saving/saved/conflict states with explicit
reload/resolution. Do not automatically merge, rebase or make every individual edit a server
command. Save adds no authoring Undo entry.

## Exit criteria

Real-Postgres same-base writers (one winner), create-only collision, no partial version/pointer
update, retry payload mismatch, failed full validation and stale response/dirty behavior, with zero
skips. The common gate being accepted for local operations is not Save evidence. Register this
capability record before T1/T2 enable Save; F2-backed Save remains unsupported until S03.

## Readiness declaration

This slice is **proposed and not authorized**; it holds no implementation permission, and nothing
here claims implementation, acceptance or readiness. Evidence belongs in [acceptance.md](./acceptance.md).

# T4 — Release

**Status:** track placeholder. #115 writes only this track's delivery obligations; the track
README's full structure and runbook are created by the execution-structure work that follows
this reset. Nothing here authorizes an implementation slice, and no prepared-release capability
exists today.

## Delivery obligations

1. **The strict snapshot reader is the current delivery path.** The P22 authored-snapshot reader
   — the snapshot → runtime path inside the cold visitor runtime — and the API publication
   snapshot format are **made strict by #115** and remain the only way a release reaches a
   visitor (`implementation-plan.md` §5.1). They are **retired at T4**, not before: deleting them
   in #115 would gain no capability and would remove the only delivery path.
2. **The prepared-reader obligation.** T4 replaces that snapshot reader atomically with the
   prepared reader, whose concrete dependency is the F5 release envelope
   ([`composition-execution.md`](../../reference/composition-execution.md), F.5) plus the
   T4 prepared-reader slice. A prepared release is an obligation and an F-gated interface, not a
   shipped capability.
3. **Verifiable provenance and closed resources.** A release must carry verifiable provenance
   (what source, revision and conversion produced each delivered artifact) and must not depend on
   open or unowned resources: referenced resources are closed over before publication, and a
   missing, failed or corrupt resource is visible rather than silently accepted. Publication
   freezes a version snapshot and serves it with `cache-control: no-store`, and a published
   manifest carries no storage keys.
4. **Per-Experience pointers.** Release data is addressed per Experience — the unit that owns
   visitor-facing composition and editorial occurrences — rather than as one undifferentiated
   document, so a release can name the Experience it delivers and its own scope.
5. **The covered-data ledger is empty by owner statement.** There is no covered-data ledger
   obligation outstanding: the owner records it as empty. No release work is owed against it, and
   no ledger is created to hold it.
6. **Publication UI and import/export are removed.** The publication client and presentation, the
   package importer/exporter and the project asset upload/load paths were removed by #115 with no
   remaining consumer. T4 rebuilds publication UI against the prepared reader; nothing in the
   current tree publishes or imports from an authoring surface.

# T4 — Release and delivery

**Track:** T4 · **Status:** planning — obligations recorded, **no implementation authorized**
([track register](../README.md#track-register)) · **Runbook:**
[`../../operations/t4-release/README.md`](../../operations/t4-release/README.md) · **Gates
owned:** `T4.prepared-reader` ([gate register](../README.md#gate-register)) ·
**Contracts:** [`persistence.md`](../../reference/components/persistence.md),
[`composition-execution.md`](../../reference/composition-execution.md) (F.5),
[`architecture.md`](../../reference/architecture.md) §Release packages

## Bounded objectives

Getting an accepted revision to a visitor, durably and without hidden dependencies. Completion
evidence for any phase in this track is a recorded acceptance against the phase's declared final
gate, with publication ownership, the strict reader and the visitor isolation all still proven.

- a **prepared reader** that replaces the authored-snapshot path atomically, consuming the F.5
  release envelope;
- publication UI rebuilt against that reader;
- verifiable provenance and closed resources for every delivered artifact;
- per-Experience addressing rather than one undifferentiated release document.

## Concern ownership and exclusions

- **Owns:** release compilation and the release envelope consumer, the visitor delivery path,
  publication UI, provenance and closed-resource guarantees.
- **Does not own:** the authoring surfaces (T1–T3), the F.5 semantics
  ([`composition-execution.md`](../../reference/composition-execution.md)) or the
  Experience/Camera data model. The reader never depends on the authoring validator.
- **Ordering:** T4 may establish its envelope and existing-data lowering in parallel, then
  integrate new capability payloads as their domain contracts land. It does not wait for a whole
  track, and it never blocks another track's phase.

## Delivery obligations

1. **The strict snapshot reader is the current delivery path.** The P22 authored-snapshot reader
   — the snapshot → runtime path inside the cold visitor runtime — and the API publication
   snapshot format are **made strict by PR #115** and remain the only way a release reaches a
   visitor (implementation-plan §5.1). They are **retired at T4**, not before: deleting them in
   PR #115 would gain no capability and would remove the only delivery path.
2. **The prepared-reader obligation.** T4 replaces that snapshot reader atomically with the
   prepared reader, whose concrete dependency is the F.5 release envelope
   ([`composition-execution.md`](../../reference/composition-execution.md), F.5) plus the T4
   prepared-reader slice. A prepared release is an obligation and an F-gated interface, not a
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
   package importer/exporter and the project asset upload/load paths were removed by PR #115 with
   no remaining consumer. T4 rebuilds publication UI against the prepared reader; nothing in the
   current tree publishes or imports from an authoring surface.

## Current vs destination contracts

| Concern | Current (post-#115 foundation) | Destination |
| --- | --- | --- |
| Release payload | authored `ProjectDocument` snapshot + asset manifest in immutable `releases` rows; `readPublicRelease` revalidates with deployed code | versioned, prepared visitor package compiled from an accepted revision × selected Experiences × a delivery profile |
| Reader | the strict current-format reader inside the cold runtime | a separately versioned reader that never depends on the authoring validator |
| Publication UI | **removed** with the editor shell | rebuilt against the prepared reader |
| Provenance | build/release rows as they exist today | declared compiler identity, input locks, resource hashes and a source-revision link |

## Evidence roles

- [First-phase proposal](./first-phase-proposal.md) — track-local source-first planning for accepted-unit
  lowering, independently versioned prepared releases and the atomic reader cutover. A proposal
  for review, not a registered phase, F amendment or implementation authorization.
- [`persistence.md`](../../reference/components/persistence.md) — the current persisted formats and
  the strict current-format reader contract.
- `apps/api/tests/publication.test.mjs` — the real-Postgres publication lifecycle proof, executed
  with Postgres reachable and zero skips
  ([`tests/README.md`](../../../apps/editor/tests/README.md) → "What a change requires").
- Prototypes and prior release records — history; they hold no release authority.

## Phase register

No T4 phase is registered. A phase is added here by an authorized plan, with its own README under
`./t4.p01-<capability>/` and its own slice register.

| Phase | Status | Depends on | Workspace |
| --- | --- | --- | --- |
| — | — | — | — |

A registration-ready draft of the first phase exists:
[T4.P01 — Prepared release foundation](./t4.p01-prepared-release-foundation/README.md), proposed
2026-10-17. It reconciles the [first-phase proposal](./first-phase-proposal.md) against current
`main` and drafts the docs-only S01 plan. Until the owner registers it (D6 of the
[next-batch proposal](../next-batch-2026-10-17.md#proposed-decisions)), it is not a row in this
register and it authorizes nothing.

## Starting foundation

**Retained modules and gates this track builds on**

- `apps/api` — the Fastify runtime, publication/release rows and the project-scoped asset registry
  (metadata in Postgres, bytes in R2, reached only through the API).
- [`apps/editor/src/lib/visitor/`](../../../apps/editor/src/lib/visitor/) — the cold public
  runtime behind `/p/:publicationId`, made strict in WP3.
- `apps/editor/vite/public-surface-boundary-plugin.ts` — the visitor/public closure proof that
  requires a real `/p/[publicationId]` entry point.
- `@portfolio/project-model`'s strict current-format readers and writers, shared with T1–T3.
- Architecture gates already enforcing this track's boundaries:
  `tests/vite/public-surface-boundary-plugin.test.ts`,
  `tests/lib/visitor/visitor-cold-runtime.test.ts`,
  `tests/lib/visitor/visitor-public-route.test.ts`.

**Deferred-retirement rows with exact conditions** (implementation-plan §5.1)

- **The P22 authored-snapshot reader and the API publication snapshot format** — *retire at the T4
  prepared-reader cutover*. Concrete dependency: F5.release-envelope plus the T4 prepared-reader
  slice, which replaces the reader atomically. Made strict by PR #115 in the meantime; deleting it
  earlier would remove the only delivery path.
- **`apps/api`** — retained as foundation; **refactor later at T3/T4** (expected-revision Save at
  T3, prepared release at T4).

**Capability losses this track owns rebuilding** (implementation-plan §4.4)

Publishing a project, importing or exporting a package, and uploading or loading project assets
from an authoring surface. Today the product can save, load and serve a cold public release and
nothing else; there are currently no releases (owner statement).

**Successor obligations carried into T4** (implementation-plan §7.2)

- the visitor/public isolation guarantees (AGENTS rule 4) and the `public-surface-boundary-plugin`
  proof must stay green throughout;
- the DB-backed publication and auth tests must be executed with Postgres reachable and zero
  skips at every T4 gate, never inherited from an earlier run.

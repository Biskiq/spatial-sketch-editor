# T3 — Experience

**Track:** T3 · **Status:** approved — `T3.P01` registered 2026-10-16 and **closed 2026-10-20**, with
all six children shipped (`T3.P01.S01` 2026-10-16 (PR #131), `S02` 2026-10-16 (PR #133), `S03`
through its split halves `S05` (PR #140) and `S06` (PR #141), and the final gate `S04` 2026-10-20
(PR #158, `9a457f6b`)) ([track register](../README.md#track-register)) · **Runbook:**
[`../../operations/t3-experience/README.md`](../../operations/t3-experience/README.md)
**Evidence:** [`planning-evidence.md`](./planning-evidence.md) · **Gates owned:**
`T3.camera-experience-cutover` ([gate register](../README.md#gate-register)) ·
**Contracts:** [`camera-tour.md`](../../reference/components/camera-tour.md),
[`composition-execution.md`](../../reference/composition-execution.md) (F.1–F.4),
[`architecture.md`](../../reference/architecture.md), [PLATE](../../reference/design-system/editor-shell-and-visual-system.md)

## Bounded objectives

Experience: what a visitor is taken through, and how authoring expresses it. Completion evidence
for any phase in this track is a recorded acceptance against the phase's declared final gate,
with the one-Camera-authority, visitor-isolation and current-format invariants still proven.

- Experience composition over domain-qualified subjects: Presentations, Experience-wide
  Interactions, Guides and Stops, with Destination as a **role**, never a second authored entity;
- the **Camera ↔ Experience cutover**: Camera keeps views, connectivity, routes, framing,
  projection and evaluation; Experience takes editorial occurrences, order, holds, continuation,
  Gates and interaction policy — in **one** migration, not two;
- Camera and Experience authoring surfaces rebuilt on the retained pure Camera math;
- preview that shares visitor semantics, and the acceptance/history result (F.4) that makes a
  compound change atomic, undoable and stale-writer-safe;
- the visitor navigation, DOM companion and accessibility contract (the a11y/motion requirements
  in the planning evidence).

## Concern ownership and exclusions

- **Owns:** visitor-facing composition, editorial occurrences and order, Camera authoring,
  preview, the authoring history/acceptance result, and the a11y/motion contract for its surfaces.
- **Does not own:** Camera route/motion evaluation itself (retained under `@portfolio/camera-core`),
  Layout/Scene domain ownership (T1/T2), release packaging and the prepared reader (T4). The
  Experience unit's envelope is F.2 territory; T3 is its first consumer.
- **Ordering:** the order cutover lands **before** T1 migrates Camera authoring onto the new
  ownership contract; node links and Experience order are never coequal writable authorities.
  Exact `Gate@Version` prerequisites govern eligibility.

## Current vs destination contracts

| Concern | Current (post-#115 foundation) | Destination |
| --- | --- | --- |
| Camera data | inside `project.scene`; `@portfolio/camera-core` evaluates | its own codec-bounded unit (F.2), split in the same cutover as the order move |
| Editorial order | `nextNodeId` / `previousNodeId` / `holdSeconds` / `detourOfNodeId` / `lockInteraction` on Camera nodes | Experience-owned occurrences and order; the legacy fields are migration **input**, never a live writer |
| Experience document | none — not designed | collection-capable unit over one shared world (F.2) |
| History / acceptance | **removed** with the editor shell; no product history today and no expected-revision precondition | F.4: one expected revision, typed intents, one atomic accepted result and one undo result |
| Preview | **removed** with the editor shell | the same runtime and evaluation as the visitor, isolated; never writes source |

Landed contracts keep describing current behaviour until their explicit cutover.

## Evidence roles

- [`planning-evidence.md`](./planning-evidence.md) — obligations from the retired P25 material,
  including the a11y contract, the repeated-occurrence findings and the F.4 successor criteria.
  Evidence, not authorization.
- [`camera-tour.md`](../../reference/components/camera-tour.md) — the current Camera/tour/motion
  contract.
- The archived P25 compact and the Experience prototypes — interaction references for a pre-#115
  model; not current truth.

## Phase register

One row per registered phase. The phase README owns its objectives, children and order; this
register owns lifecycle only.

| Phase | Status | Depends on | Workspace |
| --- | --- | --- | --- |
| T3.P01 | shipped | F1.reference@1, F3.channels@1, F4.intent-acceptance@1 | [T3.P01 — Camera/Experience cutover foundation](./t3.p01-camera-experience-foundation/README.md) |

T3.P01 is registered by the owner decision of 2026-10-16
([record](../../reference/decisions/parallel-slice-authorization-2026-10-16.md)) as the
source/runtime cutover phase (S01–S06, final gate S04), with its
[F amendment drafts](./t3.p01-camera-experience-foundation/f-amendment-proposals.md) as planning
evidence. **`T3.P01.S01`** shipped 2026-10-16 (PR #131) and **`T3.P01.S02`** shipped 2026-10-16 (PR
#133). **`T3.P01.S03`** shipped 2026-10-17 through its registered split, **`T3.P01.S05`** (PR #140)
and **`T3.P01.S06`** (PR #141), which accepted `unit-acceptance-v1`, `conditional-save-units-v1` and
`camera-handoff-v1`. The final gate **`T3.P01.S04`** was owner-authorized on 2026-10-19
([record](../../reference/decisions/t3-cutover-ratification-2026-10-19.md)), after AM-9 replaced AM-7
with a clean source epoch; its accepted result is the second delivery of this track's Camera →
Experience split, and `T3.camera-experience-cutover@1` is `accepted` in the gate register at
`06a8aac8`. The phase closed 2026-10-20 (its PHASE CLOSE block); **the track is not complete**, and
the owner-run production activation of the new source epoch is a separate operational step that has
not been executed.
`Depends on` lists the
external gates its slices consume; `F2.unit-envelope@1` is provided inside the phase by S01.

**Candidate next phase (not registered):**
[T3.P02 — First capture and Cut Preview](./t3.p02-capture-and-cut-preview/README.md). Its
registration precondition — an accepted `T3.camera-experience-cutover@1` — is now met, so it
registers only through the owner's own registration and slice-authorization event, not as a
consequence of T3.P01's closure.

## Starting foundation

**Retained modules and gates this track builds on**

- `@portfolio/camera-core` — `camera-route.ts` + `camera-motion.ts`: connectivity, routes,
  framing, projection and evaluation. One authority; the mechanism is replaceable and "one
  motion" is not one motion kind.
- `apps/editor/src/lib/authoring/camera/` — the four §4.3-criteria pure Camera modules (framing
  envelopes, interior-anchor path editing, directed-edge timing and connectivity, route clone).
  T3 decides their later home; editorial-order parts are explicitly not among them.
- [`apps/editor/src/lib/visitor/`](../../../apps/editor/src/lib/visitor/) — the cold visitor
  runtime made strict in WP3, the isolation suites and the public route.
- Architecture gates already enforcing this track's boundaries:
  `tests/lib/museum/camera-core-boundary.test.ts`,
  `tests/lib/visitor/visitor-cold-runtime.test.ts`,
  `tests/lib/visitor/visitor-identity-isolation.test.ts`,
  `tests/lib/visitor/preview-surface-boundary.test.ts`, plus the vite public/preview
  surface-boundary plugin tests.

**Deferred-retirement rows with exact conditions** (implementation-plan §5.1)

- **Scene/Camera editorial order fields and `camera-core` main-flow/node-order orchestration** —
  *retire at the T3 camera-experience cutover*. Concrete dependency: the retained visitor guided
  runtime consumes order, and Experience order is its successor representation. The new product
  has no writer for these fields after PR #115. Blocked until the replacement representation
  exists; it is never "later cleanup".
- **`apps/editor/src/lib/platform/project-persistence.ts` and its asset helpers** — retained as
  foundation; **refactor later at T3**, which adds expected-revision acceptance (F.4).
- **`apps/api`** — retained as foundation; **refactor later at T3/T4** (expected-revision Save at
  T3, prepared release at T4).

**Capability losses this track owns rebuilding** (implementation-plan §4.4)

Directing Camera, preview, and the authoring acceptance/history system, together with the
Experience surface that does not exist yet. Each is a T3 capability, not a regression. The
`/project/:id/preview` and `/project/:id/publish` routes are removed with no replacement until
these land.

**Successor obligations carried into T3** (implementation-plan §7.2)

- **the F.4 acceptance criteria** — one logical result, no-op writes nothing, rollback on failure,
  bounded history depth, atomic group/duplicate validation — previously proven by the deleted
  `history-controller`, `document-store` and `mutation-guards` suites;
- **stale-writer rejection** — the expected-revision precondition for local *and* cloud writers.
  Today's cloud Save takes a row lock and appends versions but accepts no expected revision;
- **M5** project-replacement / Navigator guard — re-armed by the first T1 or T3 slice introducing
  project/session replacement;
- the visitor/public isolation guarantees (AGENTS rule 4) stay green throughout.

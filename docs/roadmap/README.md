# Roadmap — status and registration authority

**Role:** the roadmap owns **track and phase lifecycle**, the **track register**, the
**gate register** and future work. Operational procedure lives in the track runbooks
([`../operations/`](../operations/)); current assignments live in each track's baton, routed from
[`../operations/current.md`](../operations/current.md); closed-work procedures live in the
event sections of [`../operations/README.md`](../operations/README.md).

```text
NORMAL ROUTE: roadmap/README → requested track README → phase README → exact artifact
STATUS OWNER: this file (track + phase lifecycle, gate register)
              → phase README (its own children)   → slice acceptance record (outcomes)
```

The **phase README** owns its children's status and order and routes active child work
**directly** to the exact plan/context/design/QA artifact it needs. Slice-specific artifacts
may live in a slice workspace directory, but a **workspace directory does not require a
README**: there is no mandatory intermediate slice router. A workspace-local index is allowed
only when a workspace genuinely needs a local navigational index, and is then
**navigation-only** — never a status, plan, decision, acceptance or contract authority. The
phase root holds phase-wide artifacts only.

## Accepted basis

The ratified decision record
([`../reference/decisions/northstar-ratification-2026-09-27.md`](../reference/decisions/northstar-ratification-2026-09-27.md)),
as refined by the later
[World | Experience amendment](../reference/decisions/world-experience-reconciliation-2026-09-29.md),
is normative for all new design. Its concerns are promoted into one live normative statement
per concern:

- product direction → [`../reference/north-star.md`](../reference/north-star.md);
- ownership and boundaries → [`../reference/architecture.md`](../reference/architecture.md);
- the ratified cross-domain shapes F.1–F.5 →
  [`../reference/composition-execution.md`](../reference/composition-execution.md), registered
  in [`f-foundation-contracts/README.md`](./f-foundation-contracts/README.md); exact shared
  interfaces ratified 2026-10-15 ([record](../reference/decisions/f-ratification-2026-10-15.md));
- the ratified shell and visual-system destination (PLATE) →
  [`../reference/design-system/editor-shell-and-visual-system.md`](../reference/design-system/editor-shell-and-visual-system.md).

The retained prototypes ([`../../prototypes/README.md`](../../prototypes/README.md)) are
runnable product hypotheses and their QA/reference evidence; they test and challenge these
contracts but are never production, persisted-format or implementation authority.
Ratification, planning and prototype acceptance authorize **no** implementation: capability work
starts only from a registered phase's authorized slice.

Status vocabulary, used by every register below: `proposed | planning | approved |
in-progress | shipped | archived`. A register row states what is true now; it never
fabricates a merge, an acceptance or a closure.

## Track register

Every track and every repository phase is registered here exactly once. The track or phase
README linked in the last column owns its own objectives, evidence and children; this table
owns lifecycle only and never copies their content.

| Track | Status | Roadmap |
| --- | --- | --- |
| T1 | approved | [T1 — Spatial world](./t1-spatial-world/README.md) |
| T2 | approved | [T2 — Composition](./t2-composition/README.md) |
| T3 | approved | [T3 — Experience](./t3-experience/README.md) |
| T4 | planning | [T4 — Release and delivery](./t4-release/README.md) |
| R115 | shipped | [R115 — PR #115 architecture reset](./parallel-track-cutover/README.md) |

- **R115 is a repository phase, not a fifth track.** It is registered here directly because it
  has no parent track; its sole child is `R115.S01` and its own README owns that child.
- **`planning`** means the track's roadmap and evidence exist and no capability phase is
  registered or authorized. It is the honest state after PR #115: planning evidence is
  recorded, implementation is not authorized.
- **A `shipped` track needs a `TRACK COMPLETE` block** (owner, date, evidence) on its row here.
  Its phases are closed, its objectives are met against their bounded evidence, and residuals
  have named owners. No **track** is `shipped` today: the single `shipped` row above is the
  repository phase R115, which closes through its own `PHASE CLOSE` block.
- **A repository phase (`R…`) is not a track.** `phase-closeout` moves its own row here to
  `shipped` without a `TRACK COMPLETE` record, because there is no track whose completion event it
  would record; its `PHASE CLOSE` block and final-gate acceptance carry the evidence.

## Gate register

One row per **gate and major version**. A gate is an exact cross-domain interface (F) or a
declared capability cutover; it is never a milestone, a phase or a status mirror. The register
records interface and evidence identity only — F semantics stay owned by
[`../reference/composition-execution.md`](../reference/composition-execution.md) and its
ratified amendments.

| Gate | Version | Kind | Owner | Contract anchor | State | Provider slice | Exports | Conformance | Acceptance | Commit | Accepted capabilities |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F1.reference | 1 | foundation | composition-execution.md | [F.1 + AM-1](../reference/composition-execution.md#am-1-f1-references-v1) | accepted | T1.P01.S01 | `packages/project-model/src/references` | `apps/editor/tests/lib/project-model/references-conformance.test.ts` | `docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s01-shared-interface-providers/acceptance.md` | `ee463d0b` | `F1.reference@1:references-v1` active — `docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s01-shared-interface-providers/capability-references-v1.md`; `F1.reference@1:unit-resolution-v1` active — `docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s01-unit-and-program-codecs/capability-unit-resolution-v1.md` |
| F2.unit-envelope | 1 | foundation | composition-execution.md | [F.2 + AM-2](../reference/composition-execution.md#am-2-f2-unit-envelope-v1) | accepted | T3.P01.S01 | `packages/project-model/src/units` | `apps/editor/tests/lib/project-model/units-conformance.test.ts` | `docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s01-unit-and-program-codecs/acceptance.md` | `6dcb6d6d` | `F2.unit-envelope@1:unit-envelope-v1` active — `docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s01-unit-and-program-codecs/capability-unit-envelope-v1.md` |
| F3.channels | 1 | foundation | composition-execution.md | [F.3 + AM-3](../reference/composition-execution.md#am-3-f3-inspection-and-camera-output-v1) | accepted | T1.P01.S01 | `packages/project-model/src/channels` | `apps/editor/tests/lib/project-model/channels-conformance.test.ts` | `docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s01-shared-interface-providers/acceptance.md` | `ee463d0b` | `F3.channels@1:inspection-v1` active — `docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s01-shared-interface-providers/capability-inspection-v1.md` |
| F4.intent-acceptance | 1 | foundation | composition-execution.md | [F.4 + AM-4](../reference/composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1) | accepted | T1.P01.S03 | `packages/project-model/src/f4`, `packages/project-model/src/content-identity.ts` | `apps/editor/tests/lib/authoring/f4-acceptance.test.ts`, `apps/editor/tests/lib/authoring/f4-current-source-admission.test.ts`, `apps/editor/tests/lib/authoring/f4-public-isolation.test.ts`, `apps/editor/tests/lib/project-model/content-identity.test.ts` | `docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s03-local-acceptance-and-history-foundation/acceptance.md` | `8ec0c5f1` | `F4.intent-acceptance@1:acceptance-invariants-v1 active — docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s03-local-acceptance-and-history-foundation/capability-acceptance-invariants-v1.md, F4.intent-acceptance@1:local-single-domain-v1 active — docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s03-local-acceptance-and-history-foundation/capability-local-single-domain-v1.md, F4.intent-acceptance@1:conditional-save-current-v1 active — docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s02-early-conditional-save/capability-conditional-save-current-v1.md |
| F5.release-envelope | — | foundation | composition-execution.md | [F.5](../reference/composition-execution.md#f5-release-envelope-and-program-slots) | undrafted | — | — | — | — | — | — |
| T1.viewport-projection | 1 | capability | T1 | [AM-5](../reference/composition-execution.md#am-5-shared-stage-and-starter-gallery-v1) | ratified | T1.P01.S02 | — | — | — | — | — |
| T3.camera-experience-cutover | — | capability | T3 | — | undrafted | — | — | — | — | — | — |
| T4.prepared-reader | — | capability | T4 | — | undrafted | — | — | — | — | — | — |

**Legend (enforced by `apps/editor/tests/docs/parallel-track-gates.test.ts`):**

- **Kind** is `foundation` (a ratified cross-domain interface) or `capability` (a declared
  cutover in one track).
- **State** is `undrafted | ratified | implemented | accepted | superseded`. An undrafted
  gate has no version, and a ratified shape alone is not readiness: only a row that is
  `accepted`, with exactly one registered provider and recorded evidence, is ready.
  A `ratified` row names its amendment anchor and keeps empty evidence columns; its sole
  provider assignment lives in the amendment text until phase registration wires the
  `Provider slice` column.
- **Version** is `—` while a gate is `undrafted`; the first ratified amendment assigns `1`.
  A compatible, optional extension keeps the version and records its amendment anchor. An
  **incompatible** amendment adds a new row (`version + 1`) and marks the old row
  `superseded`, retaining that row's provider and evidence.
- **Provider slice** is `—` until a real provider is planned. A gate/version has **at most
  one** provider slice; `implemented` and `accepted` require exactly one registered provider.
  Superseding an unimplemented proposal does not manufacture one.
- **Contract anchor** is the owning contract's section; `—` while no interface is written.
  A named anchor must resolve.
- **Exports** / **Conformance** / **Acceptance** are repository paths: `implemented` requires
  existing exports and conformance paths, and `accepted` additionally requires an existing
  acceptance record and a commit that is an ancestor of `HEAD`. A ratified-only gate, or one
  whose shared code is absent, never counts as ready.
- **Accepted capabilities** holds this version's accepted scopes, one entry per scope, filed on
  **its own** gate/version row: `` `Gate@Version:capability-vN` `` then `active` or `retired`, then
  `—` and a durable record path carrying the scope's contract anchor, admitted source kinds,
  prerequisites, extension slice, exports, conformance, acceptance and ancestor commit. That record
  declares one row under its `Accepted capability` heading:
  `Capability | Anchor | Source kinds | Prerequisites | Extension slice | Exports | Conformance | Acceptance | Commit`.
  This is the capability-scope field the rule below resolves; a scope that is only planned stays in
  its slice plan and records no entry here, and a `retired` entry keeps its recorded evidence while
  admitting no new or in-progress consumer.
- **Eligibility:** a slice in `in-progress` or `accepted` consumes only `accepted` rows, and
  every consumed `Gate@Version` must already have been `accepted` **at the trusted base**
  (`git merge-base HEAD main`) — a consumer cannot satisfy its own prerequisite by editing
  this register. A consumer of a `superseded` row is ineligible until it re-declares the new
  version; `shipped` slices keep their historical version. The finer capability-scope rule
  (`Accepted capabilities` / `Requires`, including a retired scope being ineligible) is defined
  by the [capability-readiness rule](./f-foundation-contracts/README.md#capability-readiness)
  and is enforced, with the rules above, by
  [`parallel-track-gates.test.ts`](../../apps/editor/tests/docs/parallel-track-gates.test.ts)
  (`capabilityProblems`); a `Requires` names an exact `Gate@Version:capability-vN` scope of a
  gate the same row already declares in `Consumes`, resolved with its prerequisite closure.

## Lifecycle and completion events

| Event | Entry and authority | Consequence; what it does not imply |
| --- | --- | --- |
| Slice acceptance → routine closeout | A recorded independent review/acceptance, then the `slice-closeout` skill | The phase child row, durable promotion, real gate readiness and the baton are updated. The final child sets the phase `closable`. No second review, and no phase or track close. |
| Phase closure | Explicit owner invocation, then the `phase-closeout` skill | The final gate, integration and residuals are verified, and `PHASE CLOSE` plus the track's phase row are written. No track, product or cycle closure follows. |
| Track completion | Explicit owner request against the approved bounded objectives | Objective evidence, required phase closures and residual transfers are verified, and `TRACK COMPLETE` is written on this register. Domain code, contracts, gates and regressions are kept. |
| Product integration acceptance | An approved integration plan plus its recorded acceptance | Only that gate and version are accepted. Contributing phases and tracks are not closed, and no Baseline is declared. |

The routine slice sequence is implementation → review → acceptance → closeout → merge, using
the recorded acceptance without re-running gates just to close. A substantive change introduced
at closeout reopens only the affected review. **All four event procedures are owned by the
event sections of [`../operations/README.md`](../operations/README.md)**; this table states the
lifecycle consequence and routes.

## Closed phases

**P23** (wall-first architectural Plan editor minimum) and **P23B** (geometry performance and
stabilization — closed 2026-09-29 by owner ruling after P23B.9's correctness and
performance-regression gate was accepted and P23B.10's closeout made the phase closable) are
shipped and closed. Their closure provenance, format-cutover records, Room lineage and algorithm
decisions are archived under [`../archive/technical/p23/`](../archive/technical/p23/) and
[`../archive/technical/p23b/`](../archive/technical/p23b/). No P-level execution route remains:
PR #115 replaced that sequence with the tracks above.

## Unscheduled proposals

These proposals are not authorized and have no phase or slice. Registering execution is an
owner decision; their presence here is a planning route, not lifecycle or gate readiness.

- **Cross-track execution proposal** — the [proposed T1–T4 allocation, capability dependencies and
  execution DAG](./cross-track-execution.md). The coordinated provider/capability model the tracks
  re-derive against; owner-confirmed 2026-10-15. It registers no gate, phase or slice, and its exact
  interfaces stay the F amendments in
  [`../reference/composition-execution.md`](../reference/composition-execution.md). It also carries
  the [shared-file and merge protocol](./cross-track-execution.md#parallel-batch-2026-10-16) for the
  four slices authorized 2026-10-16.

- **Next parallel batch (2026-10-17), owner-approved** ([record](../reference/decisions/next-batch-authorization-2026-10-17.md); D1–D5 applied, D6/D7 held). The [coordination proposal](./next-batch-2026-10-17.md)
  resolves the `viewport-projection-v1` readiness cycle with a proposed narrow `T1.P01.S07` bridge. It
  verifies `T3.P01.S03`'s prerequisite closure, drafts T4.P01 registration and the docs-only S01, and
  states `T2.P01.S03`'s exact launch conditions. The proposal itself registers, authorizes and accepts nothing; the record does. Ruling R1-D then
  deferred all T4 work until [Core Editor Stability](./core-editor-stability.md), the pre-publication
  milestone whose criteria are proposed there.

- **Three.js dependency maintenance** — [scoped upgrade plan](./threejs-upgrade/implementation-plan.md)
  from the post-PR #116 baseline. Owner-authorized standalone maintenance,
  independently reviewed and accepted, merged into `main` as `74efb98b`
  (PR #122); delivery state in the [acceptance record](./threejs-upgrade/acceptance.md).
  Not a track, phase or gate. Dependency modernization and compatibility
  fixes only; retained-renderer verification is separate from future T1
  Stage integration.

- **Stop-at-next-occurrence playback** (recorded 2026-08-27 as "P13"). In sequence playback,
  Play would travel to the beginning of the next stop and pause there, with a toggle between
  stop-at-node and continuous end-to-end playback. The pinned semantics for `A → B → C` were:
  play from A travels to the start of B and pauses; play again travels B→C; the final play
  continues to the tail or loops where a closing edge exists. "Beginning of a node" means the
  end of the inbound motion span and the start of the authored hold. It was estimated as a small
  change because the arrival progress of every node already existed as data, the playhead
  advanced under one clock, and the toggle could mirror an existing session-flag pattern. **Its
  original premise is retired:** the Sequence/timeline transport it extended was editor-only and
  was removed with the editor shell, and the order model it read is retired at the T3
  Camera/Experience cutover. T3 may assess an occurrence-based equivalent against the Experience
  order contract; it is not carried as a scheduled item.
- **Branch rejoin — experiment, no schedule** (recorded 2026-08-21). Authoring a branch that
  rejoins the main sequence at a *later* stop (`C → E → F → D`) is not representable in the
  shipped model, which expresses only return-to-origin chains. Three modeling options were
  recorded: (1) a tail-node field, recommended for any future increment as the smallest delta and
  matching the existing detour-origin precedent, additive to the strict codec with no version
  field or migration; (2) a first-class Branch record, cleanest but a new top-level collection
  needing codec, semantics, serialization, export and contract tests; (3) deriving rejoin from
  the graph, rejected as implicit and silently breakable when the edge is deleted. Risk finding:
  data risk low, validator/mutator risk medium (every sequence mutation gains a rejoin-validity
  clause and the rejoin edge likely needs delete guarding), playback risk high and separable (no
  branch playback engine exists). Open questions: whether rejoin validity restricts re-root/reorder
  so the target stays after the origin, whether a rejoin edge is delete-guarded, and whether
  timeline branch rendering is ever part of an increment or branch authoring stays model-only.
  Revisit only if branch authoring is prioritized.

## Operations

```text
CURRENT WORK:    ../operations/current.md
EVENT PROCEDURES: ../operations/README.md       (track completion · integration · replanning)
TRACK RUNBOOKS:   ../operations/<track>/README.md
CYCLE STATE:      ../operations/architecture-cycle.md   (loaded only by its three hooks)
DEFERRED DEFECTS: ../operations/tech-debt/README.md
```

Non-milestone: Typed DB layer (conditional infra).

# T1 — Spatial world: planning evidence and obligations

**Status:** evidence and obligations for the T1 track, consolidated by #115 WP4
([implementation-plan.md](../parallel-track-cutover/implementation-plan.md) §8.4). This is
**not** an implementation plan and it authorizes no implementation. An obligation stated here
is picked up by a later, separately authorized T1 phase plan; nothing here is ratified by being
written down. Where a source left a choice open, it stays open and says so.

**Provenance.** Baseline `e90a58224443bdbf44114d7285d55c983b79cc84`. Consolidated from the
P26 continuous-spatial-authoring umbrella and P26 research (archived at
[`docs/archive/technical/spatial/`](../../archive/technical/spatial/)), the P26 architectural
synthesis (deleted by #115; recover it with
`git show e90a58224443bdbf44114d7285d55c983b79cc84:docs/roadmap/p26-spatial-depth/research/synthesis/p26-architectural-spatial-depth-synthesis.md`),
the P26 protected design plans under [`prototypes/spatial-authoring/`](../../../prototypes/spatial-authoring/)
and [`prototypes/paper-authoring-commission/`](../../../prototypes/paper-authoring-commission/),
[PLATE](../../reference/design-system/editor-shell-and-visual-system.md) with its
[spatial instrument grammar](../../reference/design-system/spatial-instrument-grammar.md),
[architecture.md](../../reference/architecture.md) and
[north-star.md](../../reference/north-star.md), the
[tech-debt ledger](../../operations/tech-debt/README.md), and
[implementation-plan.md](../parallel-track-cutover/implementation-plan.md) §4.3/§4.4/§5.1/§7.2.

## 1. Division of evidence (World / Conservatory / Paper)

Three retained evidence families carry different authority, and none of them is a production
contract ([`prototypes/README.md`](../../../prototypes/README.md)):

- **World (V2 Spatial Authoring)** — the *spatial interaction reference*: Plan ↔ 3D continuity,
  Rotunda unroll/partial readings, Section/cut, ceiling lift, nested Look/return and World
  journeys **A–F** with their QA. Experience V2 is historical functional/regression evidence,
  not a design authority.
- **Conservatory** — the accepted unified UX, Experience authoring and shared visual shell.
  Its interactive states and journeys are the primary Experience UX acceptance language.
- **Paper** — the accepted **2D authoring depth and precision** contract: tools, drafting,
  dimensions, discovery and advanced procedures, reconciled with Conservatory into PLATE
  §0.8.4. PA0–PA12 is inactive and unimplemented.

**Round 2 alignment (2026-10-23).** [Production shell Round 2](../../reference/decisions/production-shell-round-2-ratification-2026-10-23.md) supersedes the shell treatment of Conservatory and Paper in this section. Conservatory remains Experience-semantics and scenario evidence, Paper remains rationale for Wall semantics and drafting, and the [Round 2 wireframe](../../../prototypes/production-shell-wireframe/README.md) is the accepted visual and behavioral evidence. No scope or sequence here changes.

A prototype records interaction intent and its own shortcuts; its geometry, module choices and
parameterizations are not requirements.

## 2. A circular enclosure needs one self-connected, continuously curved Wall

**Accepted scope (D8).** A direct Circular Room tool must produce **one** continuous canonical
Wall enclosing **one** persistent Room, retaining that Wall/Room identity through hosted
Openings, radius/diameter editing and unfolding. Internal spans, samples and mesh fragments may
be numerous; none becomes an independently authored Wall. The existing multi-Wall ring stays
valid architecture but does **not** satisfy this outcome.

Representation is **P7-gated** and the umbrella recommends a narrowly scoped parametric
closed-circle centerline variant on an ordinary Layout Wall with a self-loop topology case and
one stable seam Junction. The bounded cubic alternative remains a legitimate proof alternative,
not an accepted segmented-Wall substitute. No representation is chosen here.

## 3. Head-fixed arch rise and independent overhead-region intent

Retain the accepted vocabulary: level/slope/gable Wall tops measured along the Wall;
**independent Opening arch rise with the head held**; independent Layout-owned CeilingRegions
with closure versus suspended intent; simple flat/shed/gable overhead forms.

Today's archive derives rise from `width / 2` and the Wall top is one scalar height, so
head-fixed rise cannot be added as a UI field alone: it needs coherent codec, profile sampling,
validation, mesh and Section consumption. Proposed schema direction — one authoritative Wall
top definition with level as the current scalar case — is a **proposal**, and this record
**asserts no encoding** for either mechanism.

## 4. Typed cut / projected / hidden representation streams with source correspondence

Derivation must split data into typed primitives (**cut / projected / hidden / symbol**) with
per-source tagging, and style them at render. Two independent predecessor codebases fail their
identity contract at a later **merge/flatten** stage, so #115 carries the rule as a hard v1
constraint: **no merging on selectable streams**; merging is allowed only in export paths and
only with membership records preserved.

## 5. Hosted Opening identity

Opening interaction must resolve from the **hosted relation** plus compiled intervals/profile —
including the void and cut cap — never from boolean faces or nearest-face heuristics. The
umbrella's closed-Wall extension carries this to periodic hosts: one seam-crossing Opening stays
**one entity** with multiple derived intervals, one complete profile range and one host.

## 6. Source identity through Section and peel

Every selectable derived primitive carries canonical source identity (`{sourceId, stream,
subRef?}`, including outlines), and there is no section-local entity identity. Selection state
belongs to canonical entities rather than a view, so a view transition may change handles but
never identity. Peel is a **display-only** transform: a chosen display cut may show a
seam-crossing Opening in two sheet fragments, but both select and edit one Opening, and partial
or full peel changes no radius, Junction, persisted station or semantic identity.

## 7. Finite depth affects geometry and membership

Finite depth is a **required derivation parameter with a finite default**, never optional state a
consumer may ignore. Lateral and vertical crop are range operations on the same single
derivation. Exclusion is **reasoned**: the single membership stage emits codes
(`outside-depth`, `outside-span`, `outside-crop`, `filtered-type`, `no-meaningful-projection`),
and depth/crop exclusions surface a Reveal affordance that changes presentation and interaction
eligibility for one source without touching depth or document history. Silent exclusion is the
shared failure of both predecessor codebases.

## 8. Nested Look/return kept separate from document Undo

Contextual nesting, the view trail and document Undo are three separate things. A recipe records
the exact camera/framing/projection plus cut/depth/crops, side/station/peel, lift, mirror,
Reveal and parent; different context kinds nest and same-kind hops replace the current level.
Document Undo stays the chronological Scene/Layout history: **view steps do not enter it, and
Undo does not navigate.** An "undo these" exit-summary action is valid only for a verified
contiguous, still-available suffix, invalidated by any new edit, Undo/Redo, replacement or
history truncation. Exact return is guaranteed for still-valid references; invalidation unwinds
to the nearest valid parent and is explained — never silently approximated, and never resolved
by choosing a nearby entity.

## 9. Focused mechanisms carried forward

- **D2 — ceiling closure, coverage and datum.** Independent closure/suspended regions retained;
  decide Floor-relative versus world-fixed authored overhead under datum change, with measured
  world height shown clearly either way. Generated fallback only for uncovered enclosure; no
  duplicate authored closure overlap. Open.
- **D3 — fit/gap and intentional openings.** Prefer explicit one-shot fixes with previews and
  **no automatic following**; decide the representation of intentional Wall/ceiling gaps
  alongside closure intent. Persistent fit constraints deferred. Open.
- **D5 — crop, cut-only, seam and ambiguous inverse.** Keep crop/cut-only in phase; decide the
  display-cut presentation for single-Wall and multi-Wall loops, and refusal/recovery for
  self-overlapping peeled surfaces or invalid recipes. Prefer an explicit reason plus
  square-up/host recovery over guessing. Display decisions cannot change canonical periodic or
  seam identity. Open.
- **D6 — exit summary and motion UX.** Keep the separate histories and exact return; validate the
  "undo these" suffix; choose copy for the unavailable case. Adaptive teaching / instant /
  reduced-motion policy schedules the same transition and end state; exact durations and
  thresholds are tunable. Open.

## 10. Status of D1, D4, D7 and D8

- **D1 — implementation readiness / projection choice: superseded by the seam gate.** The
  umbrella's readiness claim is not carried forward as a gate; the recommendation (one
  persistent scene with projected vector/HTML overlays, Plan as a camera/cut destination) is a
  recommendation only, and P1 was to resolve the exact projection transition.
- **D4 — schema and compatibility: under prune-first.** Retain current documents and ownership;
  choose an explicit version/migration or repository-approved fresh-authority policy for
  closed-circle geometry, periodic Openings, top profiles, independent rise and regions. No
  competing height/profile writers and no reinterpretation of old serialized data.
- **D7 — PLATE changes: under PLATE.** PLATE remains the unchanged durable shell/visual-system
  authority; prototype appearance does not override it. Circular Room discoverability and
  radius/diameter precision controls must fit the architectural tool family with no separate
  editor. Ratify any deltas into the durable contract at that time; keep it unchanged now.
- **D8 — circular Room / single-Wall enclosure: already accepted** (see §2).

## 11. Wall-role ruling, and its two decisions

**Destination (owner ruling 2026-10-03).** The Wall is the authored primitive and its spatial
role is **derived**: Walls taking part in a closed enclosure bound it, a Wall that encloses
nothing is free-standing, and a Wall drawn across an enclosed Room divides it, producing derived
Room topology through the canonical compiler and its lineage. Rooms stay derived and no Room
geometry becomes editable. The current encoding stores an authored
`role: 'boundary' | 'partition'` and only `boundary` Walls take part in face extraction.

**Two decisions the cutover owes** ([architecture.md](../../reference/architecture.md) §Ownership;
[north-star.md](../../reference/north-star.md)):

1. how to migrate existing `partition` Walls; and
2. whether a closed ring may ever be intentionally non-enclosing.

**Decided 2026-10-22** ([batch E](../../reference/decisions/batch-e-authorization-2026-10-22.md),
E3, in the [T1.P02 drawing policy](./t1.p02-native-wall-creation/README.md#drawing-and-enclosure-policy-owner-accepted-2026-10-22)):

1. no migration — Layout format 6 drops the authored role, readers refuse format 5, and fixtures that
   encoded a deliberate `partition` are rebuilt as geometry (pre-baseline rule);
2. every closed ring encloses; an intentionally non-enclosing ring is not supported in T1.P02.

Both take effect when `T1.P02.S01` lands format 6. Division keeps the landed Room reconciliation
(one splits survivor by evidence order, one Room born).

## 12. Slab and ceiling ownership kept open

F names slab/ceiling ownership as an **open mechanism**, so it stays open: an independent
CeilingRegion owns footprint, height/profile, thickness and closure/suspended meaning; a Room
may seed or overlap a footprint but **never owns the region**. Default generated Room closure is
preserved where no authored closure overrides coverage, suspended regions do not erase
enclosure, and an ambiguous overlapping-closure surface is **refused pending an explicit joint
rule** rather than double-rendered. Generated fallback stays derived and unpersisted; converting
it to an authored region is an explicit command. Persistent fit-to-overhead is not a
prerequisite for truthful relations or one-shot fixes.

## 13. §7.2 successor obligations

Carried from the #115 test/architecture disposition ([implementation-plan.md](../parallel-track-cutover/implementation-plan.md) §7.2):

- **Editor/visitor mesh parity** — re-established at the first editor Stage renderer, honouring
  the rule that no editor helper enters `MuseumScene` or visitor imports.
- **M1 — Layout semantic mutation call-site proof** — the editor mutation runner and its
  call-site test are removed; core planner tests remain. Re-armed by the first T1 slice that
  introduces Layout mutation wiring, which supplies the call-site proof.
- **M5 — project-replacement / Navigator guard** — dormant likewise, re-armed by the first T1 or
  T3 slice introducing project/session replacement.
- **Plan-representation invariant** — the Plan grammar, salience, dimensions and snapping are
  worth retaining through an adapter, but its independent affine projection cannot be the
  universal viewport authority; the retained grammar stops owning a second camera/world
  transform.

## 14. TD-2 non-recurrence

TD-2 (Inspector numeric fields announcing `:invalid` while holding legal values, because the step
base differs from `min`) closes as *implementation removed*, never as *fixed*. Its
**non-recurrence criterion**: the same defect must not recur in the PLATE number field. It is a
T1 obligation, not a #115 fix.

## 15. TD-5's lesson

TD-5 recorded a ~12× per-read penalty for reuse and comparison over `$state`-proxied compiled
geometry, and a candidate sweep that was proven output-identical and then **measured slower**.
It closes as retired with the benchmark, and **its lesson goes to T1 evidence: do not deep-proxy
compiled geometry.** Any future comparison or reuse work measures against the input the editor
actually hands in.

## 16. Routes to retained authoring modules

T1 owns the retained pure Layout and accessibility seams relocated by #115
([implementation-plan.md](../parallel-track-cutover/implementation-plan.md) §4.3):

- [`apps/editor/src/lib/authoring/layout`](../../../apps/editor/src/lib/authoring/layout) —
  hit resolution against compiled query records with a locked priority, and exact-value
  parsing/validation. PLATE precision and refusal still require these; their later owner is the
  T1 viewport/precision slice.
- [`apps/editor/src/lib/authoring/a11y`](../../../apps/editor/src/lib/authoring/a11y) — a
  keyboard roving-focus primitive; its later owner is the T1 shell.

## 17. Legacy Layout types/codec retirement row

`layout-core`'s **legacy floors/rooms types, `layout-codec`, `layout-room-frame` and the legacy
`compileLayoutGeometry` adapter** are **RETIRE AT T1's first Layout schema cutover**
(implementation-plan.md §5.1). The concrete dependency recorded there: `layout-types.ts` and
`layout-codec.ts` host definitions consumed by 37 and 9 wall-first modules, so separating them
*is* the authored-schema redesign T1 owns (Wall roles and levels). After #115 they are reachable
only from wall-first internals and tests, never from a project/API/runtime reader. `layout-compat`,
`layout-migration` and `layout-migration-math` were removed in #115 with no successor detector.

**T1.P02.S01 outcome (2026-10-22):** the first Layout schema cutover reached format 6 without the
separation. Retiring these modules is larger than the slice, so it is deferred to its own authorized
slice, which must land before T1.P02.S02 starts: the definitions are live compiler and wall-first
codec vocabulary rather than dead legacy residue, eight test files exercise the legacy compiler
adapter through fixtures the tests README forbids deleting, the arch lane pins the current module
map, and one room type is still referenced by the parallel-track reader owner. The measured
blockers, the remaining work and the state left intact are the
[stop-and-report](t1.p02-native-wall-creation/t1.p02.s01-layout-identity-and-format-cutover/acceptance.md).

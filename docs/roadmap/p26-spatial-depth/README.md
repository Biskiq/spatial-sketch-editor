# P26 — Continuous Spatial Authoring

> **Authority banner (ratified 2026-09-27).** Everything in this phase's existing
> plans, umbrella, candidate order, research and prototype architecture is
> **pre-redesign evidence**, not authority. P26 is re-derived as track **T1**
> against F and the ratified direction, and its plan is rewritten after F; no
> scope exclusion, sequence or architecture shortcut here binds the re-derived
> plan. Landed behavior remains current truth until its explicit cutover.
> Authority: [`../../reference/decisions/northstar-ratification-2026-09-27.md`](../../reference/decisions/northstar-ratification-2026-09-27.md)
> and [`../../reference/north-star.md`](../../reference/north-star.md).

**Ratified re-derivation requirements:**

- Representation code must be **runtime-safe Layout evaluation that visitors can
  also run** — not editor-only. Editor recipes/trails decompose into Camera
  viewing intent plus typed state contributions, captured explicitly.
- View settings become **typed, addressable values** (F.3 channel addresses),
  not session-only view state.
- The vertical model is **level-ready**: a level ID and level-qualified
  references are established in F.1 and precede vertical architecture work, even
  if the first UI exposes one level.
- IDs use the **F.1 reference format**; level/structure-qualified identity is
  present before vertical architecture expands.
- T1 supplies the shared continuous viewport/projection, canonical picking and
  runtime-safe Layout representation seams consumed by World and Experience
  authoring. T3 data and Camera/order cutover may proceed in parallel; Camera
  authoring adapters migrate after that cutover so node order is not renewed.
- **Prototype journeys A–F** remain the **experience/QA authority** for this
  direction: A Curved wall (3D → peel → walk round → square up → flat → edit at
  any curvature → put back), B Look inside (draw a line → preview → part → face
  the cut → edit → close), C Ceiling (lift → preview a fix → look up → edit →
  return), D the practised-creator variant, E Everyday edit (Plan → slide and
  widen → tilt → face → rise → back → Undo), F Where did it go? (find → why you
  can't see it → go to it). They are scripted in
  [`prototypes/spatial-authoring/`](../../../prototypes/spatial-authoring/README.md)
  (**World Authoring Prototype** — retaining the P26 *Final Design Prototype* A–F, moved to
  the durable [`prototypes/`](../../../prototypes/README.md) family 2026-09-29);
  prototype implementation shortcuts are not production contracts.

**Phase goal:** deliver one continuous, contextually editable spatial world: Plan↔3D,
first-class circular Room creation with one self-connected Wall, Wall facing
and peeling, drawn-line Section/depth/Reveal, ceiling lift/look-up,
and exact return with view navigation separate from document Undo. P26 includes
the architectural redesign and production implementation needed for that experience.

```text
STATUS: planning — experience target accepted; architecture/sequence are pre-redesign
        evidence to be re-derived as T1 against F (see authority banner)
CURRENT: 2026-09-24-P26-continuous-spatial-authoring-umbrella.md (pre-redesign evidence
         until re-derived)
NEXT: re-derive scope/slices/T1 plan against the owner-ratified F target contract
      (F.1–F.5 → roadmap/README) and the ratified direction before any production
      implementation plan; exact F interfaces land as F amendments in shared code
EXECUTION: P23B closed 2026-09-29 and #103 is merged; the operational baton is F
           (→ ../../operations/current.md). T1 production planning follows the F interfaces;
           no P26 production child is implementation-ready.
GATE: no production implementation approved; no production child is implementation-ready.
      F and re-derivation precede P26 production implementation authorization;
      the architecture cycle's validation window remains closed.
```

**Demo design revision:** [Visual-system specification plan](./design/visual-system-refinement/specification-plan.md)
— bounded demo work following the owner-directed [visual-system sequence](../README.md).
This revision is separate from the pre-redesign production plans below.

**Prototype adoption (#112) accepted 2026-10-02:** [closed plan and recovery](./design/world-authoring-prototype/implementation-plan.md)
· [current World executable](../../../prototypes/spatial-authoring/README.md)
· [acceptance/harvest](../../../prototypes/spatial-authoring/qa/ACCEPTANCE.md).
The shell is adopted in place with A–F preserved. **#113 replacement implementation under conformance review:**
[active C1–C8 plan](../p25-experience/design/experience-v2-prototype/conformance-plan.md) corrects the shared executable;
[fresh evidence/specimens](../../../prototypes/spatial-authoring/qa/EXPERIENCE-CONFORMANCE-ACCEPTANCE.md) records current proof.
S0–S9 evidence is historical. Repository gates remain blocked by the missing P23B fixture;
final external review is pending. F and T1/T2/T3 production gates remain unchanged.
Preservation convention: `closed/world-authoring-prototype` tags the full accepted plan body;
local-only until explicitly pushed. This adoption is not a P26 final phase gate or phase closure.

**Paper authoring adoption — next PR after #113, not started:** [Paper adoption plan](./design/paper-authoring-prototype/implementation-plan.md)
· [accepted contract, PLATE §0.8.4](../../reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination)
· [rationale](../../../prototypes/paper-authoring-commission/PAPER-SHELL-PROPOSAL.md).
It adopts the accepted World Paper shell into the same World executable as PA0–PA12 in
dependency-ordered slices, preserving A–F and the #112 seams. The owner-decided sequence is
#112 close/merge → #113 Experience V2 + real World ↔ Experience continuity → Paper PA0–PA12 in
the next PR → prototype detour closes → F exact-interface amendments → T1/T2/T3/T4; Paper's
position is decided, not an open call. Prototype evidence only; no F/T1 gate moves.

**Shell/design authority vs executable state (2026-10-01, PR #111):**

```text
BEHAVIORAL AUTHORITY:   P26 journeys A–F / spatial-authoring behavior (banner above)
SHELL DESIGN AUTHORITY: PLATE §0.8–§0.8.4 (promoted shared/World laws,
                        Experience expression, parked-task return and,
                        since 2026-10-03, World Paper authoring)
                        #111's syntheses/QA retain final design records/specimens
EXECUTABLE STATE:       World Authoring Prototype adopts the accepted shell in place
                        (#112), retaining A–F; #113 implements Experience V2
                        and both-lens continuity — prototype evidence only
PRODUCTION STATE:       unchanged — planning / re-derived T1; no production child
                        becomes implementation-ready because #111 exists
```

## Routes and evidence (pre-redesign)

- **Phase-wide proposal:** [Continuous Spatial Authoring umbrella](./2026-09-24-P26-continuous-spatial-authoring-umbrella.md) — baseline/source evidence, architecture, subsystem dispositions, rebuild/migration, full scope, proofs, decisions, acceptance and P24 handoff. The re-derived plan is authored after F, not here.
- **Accepted experience:** [World Authoring Prototype](../../../prototypes/spatial-authoring/README.md) — the current executable adopts the World shell; rationale, QA acceptance, implementer reference and journeys are linked there, and a path-preserving stub remains at the old phase-local [`Final-Design-Prototype/`](./Final-Design-Prototype/README.md). Its implementation shortcuts are not production contracts; journeys A–F remain the experience/QA authority (banner above).
- **Shell design authority:** [PLATE](../../reference/design-system/editor-shell-and-visual-system.md). The desired visual-language amendment landed as visual-system sequence step 3 (2026-09-29): PLATE **§0.7** states the accepted demo as the desired visual language, labelled **landed-now / desired-from-demo / still-unbuilt**. Sequence step 4 promotes both finalized designs into PLATE **§0.8–§0.8.3** (2026-10-01, PR #111): shared/World laws, Experience expression and explicit parked-task return. The [final World synthesis](../../../prototypes/world-experience-shell-round/design/design-synthesis.md) and [QA package](../../../prototypes/world-experience-shell-round/QA-package/) retain the detailed design record/specimens. The accepted World Paper authoring shell is promoted into PLATE **§0.8.4** (2026-10-03), with the [Paper shell proposal](../../../prototypes/paper-authoring-commission/PAPER-SHELL-PROPOSAL.md) as its rationale. These are normative destination design requirements — no production implementation, restyle or cutover — and P26/T1 production planning still follows the F interfaces.
- **Readiness state:** [architecture cycle](../../operations/architecture-cycle.md).
- **Primary execution:** [P23B](../p23b-geometry-performance/README.md), whose SEQUENCE remains authoritative for that phase.

## Candidate order — proposed only

No child plans or proofs are authorized. Details and dependency gates are in umbrella §6–§9.

1. Landed-P23B reconciliation and prepared implementation plan.
2. Early continuous Plan↔3D authoring slice, retaining production Wall drawing.
3. Circular Room creation and canonical single-Wall enclosure (P7), including periodic Openings and generated floor/ceiling.
4. Facing and attributed contextual cuts/recovery, using the closed-Wall fixture.
5. Canonical vertical profiles, arch rise and independent ceilings, including circular coverage.
6. Cubic and closed-circle peeling/intermediate precision (P3 consumes P7).
7. Ceiling lift/look-up and relationship recovery.
8. Session/accessibility/Scene-Camera integration and viewport cutover.
9. Integrated acceptance and P24 handoff.

D8 inclusion is accepted; representation remains technical-design/proof-gated.
The first continuous walking slice stays bounded to existing ordinary Wall and
Opening semantics. The next slice delivers circular creation and editing before
Section/coverage/peel acceptance; no multi-Wall substitute fulfills D8.

## Supporting provenance — not competing design authority

- [Research synthesis](./research/synthesis/p26-architectural-spatial-depth-synthesis.md): independently accepted domain decisions retained by the umbrella; the old separate-workspace framing is superseded.
- [Designer brief](./design/briefs/2026-09-22-p26-designer-brief.md): original assignment, now answered by the accepted prototype.
- [Broad compact](./research/broad/deep-research-P26-phase-1-compact.md), [FreeCAD harvest](./research/harvests/P26-phase2-freecad-section-orthographic-harvest.md), [Bonsai harvest](./research/harvests/P26-phase2-bonsai-view-identity-rcp-harvest.md): supporting research only.

REGISTER and presentation-only reproductions of it are superseded; they are not
live P26 authorities. Preserve independently accepted product decisions through the umbrella.

**Final phase gate:** integrated acceptance makes P26 closable, not closed.
Major-phase closure is owner-invoked and follows the architecture cycle's
selected-window lifecycle. This planning revision invokes no closeout.

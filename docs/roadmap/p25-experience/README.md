# P25 — Experience Foundation

> **Authority banner (ratified 2026-09-27).** Every existing plan, research
> compact and assumption in this phase is **pre-redesign evidence**, not
> authority. P25 is re-derived as track **T3** (Experience data) against F and
> the ratified direction before planning resumes. Authority:
> [`../../reference/decisions/northstar-ratification-2026-09-27.md`](../../reference/decisions/northstar-ratification-2026-09-27.md)
> and [`../../reference/north-star.md`](../../reference/north-star.md).

**Ratified re-derivation requirements:**

- **The old blanket rejection of variables/conditions is lifted.** Typed,
  serializable session declarations with explicit owners, initial values and
  reset behavior, plus bounded deterministic side-effect-free expressions for
  guards, derived values and choice availability, are ratified destination
  semantics. Syntax, UI and the initial operator set remain planning choices;
  arbitrary scripting stays the separately governed exception.
- A project supports **multiple Experiences over one shared world**; the
  persisted Experience unit is collection-capable (F.2). The UI may initially
  expose one Experience and simple choices.
- Presentations, Experience-wide Interactions and optional Guides with stable
  Stops belong to Experience. Repeated Stops may reference one Presentation
  (e.g. Intro → Piano → Paris → Piano → Exit), with distinct session visits.
  Guide editorial order, holds, Gates and continuation belong to Experience;
  **Camera-order cutover** happens here, and node links and Experience order
  are never coequal writable authorities. “Destination” is target/address
  vocabulary, not another authored entity.
- **First compound acceptance** (F.4) lands with this cutover: one expected
  revision, typed intents, one atomic accepted result and one undo result.
- Retained accessibility evidence (motion policy, semantic content, reduced
  motion) is carried into re-derivation and reconciled with the expanded
  direction rather than retained as an old scope exclusion.

**Phase goal:** narrow complete Experience foundation: collection-capable
Experience unit, reusable Presentation, optional Guide/Stop, content and
bounded semantic Interaction/Activity invocation; a first real
domain-supported capability and narrow shared execution/session path. Preserve
repairable unresolved authored bindings while Preview and publication require
closure for affected required behavior. This does not require T2's full
definition/component system or T1's later representation depth.

**Status:** retained phase evidence — T3 data/authoring planning is assigned to
[#115's parallel-track cutover](../README.md#next-task-handoff--115), against
the ratified F target and accepted design. Relevant F/interface gates precede execution.
No P25.x implementation-ready child plans exist; none is authorized here.

## Pre-redesign artifacts (evidence)

- Umbrella: [`2026-09-08-P25-experience-foundation-umbrella.md`](./2026-09-08-P25-experience-foundation-umbrella.md)
- Research compact (primary): [`research/P25-research-compact.md`](./research/P25-research-compact.md)

## Research (supporting evidence)

- [`research/deep-research-P25.md`](./research/deep-research-P25.md)
- [`research/deep-research-report-P25-full.md`](./research/deep-research-report-P25-full.md)
- [`research/prompt-phase-5.md`](./research/prompt-phase-5.md)

Experience is a ratified authored semantic domain; its persisted codec-bounded unit (collection-capable) is settled in F.2 ([`../../reference/composition-execution.md`](../../reference/composition-execution.md) §F.2), and no schema exists yet. `ExperienceDocument` is not a designed format and must not be frozen or implemented ahead of its authorized planning.

**Retained V2 hypotheses, not T3 defaults:** promoting an interior View to a
Stop may imply entry framing or a semantic explanation; detours may suspend a
Presentation or depart/re-enter. These are retained domain-planning questions,
not instructions for another V2 implementation round. The [final V2 synthesis](../../../prototypes/integrated-experience-authoring/design/Prototype-V2-final-synthesis.md)
and [earlier World design](../../../prototypes/world-experience-shell-round/README.md)
preserve prior rationale. Current shell/Experience design authority →
[PLATE](../../reference/design-system/editor-shell-and-visual-system.md).
**#114 cutover (2026-10-13):** [Conservatory](../../../prototypes/experience-ux-alternative/README.md)
is the accepted unified UX/Experience direction, promoted into PLATE. The former
Card/Deck expression and [UX3/V3 proposal](./design/experience-ux-v3/README.md) are
historical. T3/F retain Presentation/Guide semantics, Camera ownership and useful
functional evidence; no mock formats or production implementation are authorized.

## Unified Experience V2 prototype (#113)

**Accepted and closed (2026-10-11).** C1–C8 in-scope conformance and C9.1–C9.9 are implemented and reviewed; MP1–MP4 are owner-accepted for functionality, not as final visual UX. Slice id `p25-experience-v2`: annotated tag `closed/p25-experience-v2` (pushed to origin; target `74e8610464ad6c2cee913a3423d867dcc61f2a20`) anchors the retired C9 plan body (first use of the `closed/` tag convention).
[Standalone conformance plan](./design/experience-v2-prototype/conformance-plan.md) ·
[shared executable](../../../prototypes/spatial-authoring/README.md) ·
[conformance evidence](../../../prototypes/spatial-authoring/qa/EXPERIENCE-CONFORMANCE-ACCEPTANCE.md) ·
[C9 plan stub](./design/experience-v2-prototype/authoring-completeness-plan.md) ·
[current C9 evidence](../../../prototypes/spatial-authoring/qa/EXPERIENCE-C9-EVIDENCE.md) (with the closeout preservation report).
The earlier S0–S9 implementation and acceptance remain prior evidence, not C9 acceptance authority.

MP1 was owner-accepted 2026-10-04 and MP2 2026-10-05. **MP3 and MP4 were owner-accepted on 2026-10-11 for functionality only.** Browser rehearsal, automated tests and Presenter completion stay evidence, never acceptance. Travel and fresh repeated-Stop visits are owner-ratified; cursor/detour-pause policies remain trials. Experience Reset preserves independent World/Camera truth and shared history. Recorded verification (not rerun for closeout): prototype Node 140/140, 24 axes 1073/1073, successor 102/102 rejected, arch 276/276; counts and exact executable provenance live in the C9 evidence record.

**Historical UX lock (#113, docs/design/assets only).** The six QA boards and
[adjudications](../../../prototypes/integrated-experience-authoring/design/experience-ux-reconciliation.md)
record the 2026-10-11 expression. #114's UX1–UX6/review changes remain functional
and regression evidence; [their diff disposition](../../../prototypes/spatial-authoring/qa/EXPERIENCE-UX-EVIDENCE.md#114-v2-branch-diff-disposition)
is explicit. UX7, the UX3/V3 standalone plan and PNG acceptance are inactive.
Current Experience authoring/UX acceptance → [PLATE §0.8.1](../../reference/design-system/editor-shell-and-visual-system.md#081-finalized-experience-shell-expression)
and Conservatory's interactive journeys. The donor remains a regression oracle;
the missing P23B fixture is a separate repository-gate blocker.

**Baton:** #114 accepted unified design → #115 parallel-track planning cutover →
foundation-gated production implementation. The former sequential prototype route
is retired. P24/P25/P26 research and accepted capability decisions are retained;
#114 authors no T3 plan and closes no major phase.

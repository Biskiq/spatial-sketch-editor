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

**Status:** proposed — pre-redesign (banner above); re-derived as T3 after F.
No P25.x implementation-ready child plans exist; none is authorized here.

## Pre-redesign artifacts (evidence)

- Umbrella: [`2026-09-08-P25-experience-foundation-umbrella.md`](./2026-09-08-P25-experience-foundation-umbrella.md)
- Research compact (primary): [`research/P25-research-compact.md`](./research/P25-research-compact.md)

## Research (supporting evidence)

- [`research/deep-research-P25.md`](./research/deep-research-P25.md)
- [`research/deep-research-report-P25-full.md`](./research/deep-research-report-P25-full.md)
- [`research/prompt-phase-5.md`](./research/prompt-phase-5.md)

Experience is a ratified authored semantic domain; its persisted codec-bounded unit (collection-capable) is settled in F.2 ([`../../reference/composition-execution.md`](../../reference/composition-execution.md) §F.2), and no schema exists yet. `ExperienceDocument` is not a designed format and must not be frozen or implemented ahead of its authorized planning.

**Prototype V2 hypotheses, not T3 defaults:** promoting an interior View to a
Stop may imply only entry framing or a semantic explanation entry point; a
detour may suspend a parent Presentation or act as departure/re-entry. Test
both in the integrated shell before selecting behavior. The World | Experience
shell composition is now the accepted destination direction
([PLATE §0.8](../../reference/design-system/editor-shell-and-visual-system.md)
with [§0.8.1's finalized Experience expression](../../reference/design-system/editor-shell-and-visual-system.md#081-finalized-experience-shell-expression)
promoted from the [final V2 synthesis](../../../prototypes/integrated-experience-authoring/design/Prototype-V2-final-synthesis.md),
alongside the [final World design](../../../prototypes/world-experience-shell-round/README.md)).
Card/Deck composition and progressive Camera disclosure are fixed destination design;
exact metrics, the remaining V2 usability experiments and implementation mechanisms
remain later work. Promotion changes no T3 implementation gate.

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

## Unified Experience V2 prototype (#113)

**C1–C8 in-scope conformance complete; C9.1–C9.3 accepted through MP2, C9.4/C9.5 implemented and verified, stopped for MP3 (2026-10-05):**
[standalone replacement plan](./design/experience-v2-prototype/conformance-plan.md) ·
[shared executable](../../../prototypes/spatial-authoring/README.md) ·
[current conformance evidence/specimens](../../../prototypes/spatial-authoring/qa/EXPERIENCE-CONFORMANCE-ACCEPTANCE.md).
The [S0–S9 plan](./design/experience-v2-prototype/implementation-plan.md) remains prior evidence,
not acceptance authority, along with [S0–S9 acceptance](../../../prototypes/spatial-authoring/qa/EXPERIENCE-ACCEPTANCE.md).
The replacement corrects V2 composition, disclosure, Camera/return and QA gaps with
fresh C1–C8 behavioral and blocking visual gates. External manual review then exposed
authoring-model and ordinary-workflow gaps against Prototype 4.1. The additional
[C9 authoring-completeness plan](./design/experience-v2-prototype/authoring-completeness-plan.md)
defines capability-first parity/journey acceptance, retaining blocking shell,
information-home, disclosure, spatial/temporal and ownership seams. Travel and
fresh repeated-Stop visits are owner-ratified; cursor/detour-pause remain trials.
Experience Reset preserves independent World/Camera truth and shared history.
MP1 follows C9.1 before lifecycle/Guide expansion — owner-accepted 2026-10-04;
MP2 precedes Travel/agency and was owner-accepted 2026-10-05, with its three
observations recorded as non-blocking (shell density later, Guide snap/cut
superseded by C9.4, View/Presentation removal at C9.6). C9.4 and C9.5 are
implemented, self-reviewed, independently reviewed and verified at the pushed
executable revision; the review's four findings — Rejoin/detour Return rebuilding
remaining work, the missing interaction-only Preview Experience, availability
modelled but not authorable, and a same-View Travel shortcut ignoring the live pose
— are all repaired with regression and mutation coverage. MP3 is the next human
gate and C9.6–C9.9 and Paper are not started.
Capability
acceptance remains pending; detailed density/type/proportion and broader visual
refinement follow in a dedicated, separately scoped UI/UX slice. C9 requires only
targeted structural/reachability evidence, not exhaustive specimen comparison.
The missing P23B fixture remains a separate repository-gate blocker.
The donor stays a runnable regression oracle; the integrated design folder retains the finalized
synthesis and boards. This work authorizes no T3 production implementation and closes no phase.
Paper PA0–PA12 follows #113, before returning to F. This is separate from pre-redesign plans above.

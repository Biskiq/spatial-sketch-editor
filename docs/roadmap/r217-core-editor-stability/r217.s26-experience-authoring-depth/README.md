# R217.S26 — Experience authoring depth: planning workspace

**Status: proposed, for owner review (2026-11-03).** Planning only. Nothing here registers,
releases or authorizes a slice. The proposed slices are listed in the
[R217 README](../README.md#post-s25-experience-authoring-depth-proposed), not in its slice register;
the [release list](../../now.md) is unchanged, so every scope below stays
under the [production hold](../../README.md#production-implementation-hold). Registration needs the
owner's [bounded replanning](../../../operations/README.md#bounded-replanning) entry and the decisions
in [owner-decisions.md](./owner-decisions.md); release needs a separate owner release.

**What S26 is.** S25 put Experience into the shared shell with honest placeholders. S26 completes the
creator workflow those placeholders stand for — Presentation → Views → Guide and Stops → Camera paths →
playback → Preview — inside the accepted Round 2 shell, with Conservatory's content and interaction,
on the existing Camera and Experience authorities. It is delivered as four bounded slices,
**R217.S26–R217.S29**, before the final gate R217.S11.

**Authorities** (unchanged from the [S25 harvest](../r217.s25-experience-shared-homes/design-harvest.md), D13):

| Concern | Authority |
| --- | --- |
| Shared shell: Head, Index, Stage, outer Card container, dock, interaction language, compact Guide | [Round 2 ratification](../../../reference/decisions/production-shell-round-2-ratification-2026-10-23.md), [wireframe](../../../../prototypes/production-shell-wireframe/README.md) |
| Experience content and interaction inside that shell | [Conservatory](../../../../prototypes/experience-ux-alternative/README.md) |
| What exists and what an operation may do | Domain: `packages/project-model/src/units/{types,planning,validate}.ts`, `packages/camera-core/src/`, [Camera contract](../../../reference/components/camera-tour.md), [PLATE §0.8.1](../../../reference/design-system/editor-shell-and-visual-system.md#081-finalized-experience-shell-expression), [spatial grammar](../../../reference/design-system/spatial-instrument-grammar.md#camera-framing-instruments) |

**Hard limits.** One Camera authority: every pose, route, duration and evaluated sample comes from
`@portfolio/camera-core`; Experience supplies holds and order only. No prototype shortcut is promoted
([S25 harvest §5](../r217.s25-experience-shared-homes/design-harvest.md#5-prototype-shortcuts-never-promoted)
plus the ones named here). No publishing, narration, captions, cues, Gates, Detours or branching. No
persisted-format change: the one capability that would need one, Stop-local guided Views, is deferred
([E3](./owner-decisions.md#e3)).

## Read next

1. [Capability inventory](./capability-inventory.md) — every step of the creator workflow: what
   Conservatory and Round 2 show, what production does at S25, what the domain supports, and the slice
   that closes each gap. Includes the domain-operation ledger and corrections to the S25 harvest.
2. [Owner decisions](./owner-decisions.md) — E1–E14, each with a recommendation. E1 (sequencing) and
   E2 (new planners) gate everything else.
3. [Execution plan](./execution-plan.md) — the four slices: scope, domain operations, visual and
   interaction completion, dependencies, shared files, acceptance journeys and verification, plus the
   proposed S11 changes.

## Sources studied

Conservatory: `app/main.js`, `app/plan.js`, `app/camera.js`, `README.md`, `design-rationale.md`,
`scope-and-critique.md`. Round 2 wireframe: `exp.js`, the Experience parts of `app.js` and `stage.js`,
the *Author an Experience* tour, `README.md`, `DESIGN-NOTE.md`. Production at `f8da7eb0` (S25 merged):
`authoring/experience/*`, the Experience controller and commands, `camera-core`, the F.2 unit types,
planners and validation, the retained `authoring/camera/*` helpers, the visitor Preview surface, and
the S24/S25 records. No browser session was run for this plan and no screenshots are kept; each slice
starts with a live check of its own states (see the execution plan's start rule).

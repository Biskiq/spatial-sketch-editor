# Agent context — Personal / Museum

**Bootstrap only.** Durable hub: [`docs/README.md`](./docs/README.md) (router — start here).
Human overview: [`README.md`](./README.md).

Conflict: **`docs/` reference files + router win** over this file for product detail; **this file wins** for hard rules below. The ratified decision record (`docs/reference/decisions/northstar-ratification-2026-09-27.md`) is normative for all new design and outranks conflicting pre-ratification reference/roadmap text; landed contracts keep describing current behavior until their explicit cutover (rule 10).

## Repo facts

- npm workspaces; apps are `@portfolio/editor` and read-only `@portfolio/museum`.
- `prototypes/` holds durable runnable prototypes and their QA/reference evidence
  ([`prototypes/README.md`](./prototypes/README.md)). They are **not** npm
  workspaces, not production applications and not authority — a prototype shortcut
  never becomes a production contract by being kept there.
- “Camera” = **3D guided PerspectiveCamera navigation**, not webcam.
- Root `dev` / `test` target editor; root `build` / `check` cover both apps.

## Hard rules

1. **One Camera authority** — one authority for connectivity, routes, framing, projection and evaluation; every profile controller (guided travel, free look, reduced motion, film, future XR) realizes viewing intent through it, and no second navigation graph, evaluator, or independent pose/FOV interpolation exists. Experience owns editorial occurrences, order, holds and continuation; invocation time mapping evaluates through Camera. The current `camera-route.ts` + `camera-motion.ts` mechanism and its curve/guard model are replaceable implementation, not the guarantee, and "one motion" does not mean one motion kind.
2. **Distinct, never-merged semantic authorities** — Layout owns architecture (including levels, placed structures, reusable definitions and validated alternatives); Scene owns object composition, placed instances and world presentation; Camera owns views, routes, framing, projection and evaluation; Experience owns visitor-facing composition and editorial occurrences; typed resources form their own independently versioned system. Never hide a new domain inside another document. World-local project placement with explicit internal frames; no mandatory Room frame. The current Layout + Scene documents, their format numbers, and Camera storage inside Scene are the landed encoding until their explicit cutover — current, not the destination.
3. **Authored truth excludes generated/render/session state** — authored connection anchors are interior only; node-view endpoints are generated at runtime, never authored; generated geometry, Three objects, renderer handles, selection and history are never serialized. Immutable, reproducible delivery derivatives (compiled release payloads) are explicitly permitted outside authored documents; generated Camera endpoints may exist in a compiled delivery descriptor, never as a second authored set of connection anchors.
4. **Visitor isolation** — the editor ships in production at `/`, `/editor`, and `/museum/editor` (no build-flag gating). `/museum` and public releases are visitor-only: no editor session, selection, history, gizmo, layout UI, or authoring infrastructure in visitor chunks. Runtime-safe domain evaluators (e.g. Layout representation) are shared with visitor runtimes; isolation is about editor machinery, not about forking domain math.
5. Editor helpers outside `MuseumScene` / visitor imports.
6. **No second authority** — one canonical architectural compiler; Layout-owned representation and runtime-safe algorithms consume its output, and release lowering may derive shared kernel dataflow without becoming a second navigation authority or architectural reconstruction. Prefer Floor/Wall/Ceiling planes.
7. Svelte 5 runes; Threlte patterns; `scroll-travel` unused.
8. **No commits** unless user asks.
9. **Token discipline (progressive disclosure)** — start at `docs/README.md`, follow router links, read minimum sufficient context. A routed file is not automatically a full-file read: read the smallest relevant section / authority box / route block first, then stop unless the task, missing information, or contradictory evidence requires expanding within the file. Routes are starting points, not hard boundaries: do not preload deeper or adjacent docs speculatively; expand into docs/code/tests/Git only when the task, missing information, or contradictory evidence requires it. Never preload the tree; archive is opt-in historical evidence, not current truth.
10. **Authority by concern** — no single total ordering; resolve a doc-vs-doc
    conflict through the owner of that concern. `operations/current.md` owns the
    **current work/baton/status**; an **active plan** owns its approved slice
    scope; `roadmap/` owns future work; a **landed `reference/*` contract** owns
    durable architecture and current product truth (`reference/architecture.md`,
    `reference/north-star.md`, component contracts); `archive` owns history.
    The **ratified decision record**
    (`docs/reference/decisions/northstar-ratification-2026-09-27.md`) is the
    normative destination authority: it is normative for all new design and
    outranks conflicting pre-ratification reference/roadmap text. A **ratified
    durable design contract** is normative for its own domain and outranks older
    descriptive numbers there: the shell + visual-system contract
    (`docs/reference/design-system/editor-shell-and-visual-system.md`) owns
    shell composition, material, typography, control metrics and state
    language. The ratified F target contract
    (`docs/reference/composition-execution.md`) owns the common
    composition/execution shapes (F.1–F.5) normative for new persisted and
    cross-domain formats; its per-section implementation status separates
    landed behavior from the destination. Do not implement shell chrome from
    `reference/design-system/*` shell tables or from a component's scoped CSS.
    **Landed contracts keep describing current behavior until their explicit
    cutover**; they are never rewritten to match the destination before the
    migration, and the destination is never presented as shipped.
    Source/tests/Git are implementation evidence, not another documentation
    tier. If they materially contradict `reference/`, use the reconciliation
    triage in `docs/README.md` rather than resolving by precedence alone.
11. **Scope limits mutation, not inspection or verification.** For
    implementation/code tasks, local task scope never narrows the repository-level
    verification required by the applicable test contract. Inspect callers,
    dependents, wiring, tests and adjacent code as needed to establish impact. If
    correctness appears to require a change outside the assigned scope, report it
    rather than making it unless scope is explicitly expanded. Concrete editor
    commands and lane semantics stay owned by `apps/editor/tests/README.md` and are
    deliberately not duplicated here.

12. **No agent footer in commits** — when asked to commit, the message is the message: never append a
    `Generated with …` line or a `Co-Authored-By: <agent>` trailer for any tool, guide or harness.

## Boot contract

```text
START: docs/README.md
READ: smallest routed context that can answer the task
STOP: no additional reading currently justified (not "investigation forbidden")
NO: speculative whole-repo / whole-doc-tree preload
NO: archive unless routed or evidence requires it
NO: commit/push unless allowed

ON slice acceptance complete:
use slice-closeout skill

ON explicit owner request to close a major phase:
use phase-closeout skill (manual-only)
final-gate acceptance makes a phase closable, not closed;
major-phase closure is owner-invoked only

ON substantial unfinished work needing same- or cross-agent resume:
use work-checkpoint skill

ON launching or attaching to a browser (any task — QA, verification, debugging, scraping):
use browser-hygiene skill
```

# Architecture health and extension readiness — audit and proposal

**Audit of main `96c71f78` (PR #266 merged), 2026-11-07 · documentation only · proposal, not approval.**
This proposal changes no production code, check, format or dependency. It sequences maintainability
work *around* the [T5 umbrella plan](../t5-expressive-geometry/umbrella-plan.md); it is not a
second roadmap and does not reorder T5 capabilities. Each recommended pull request names its own
[risk tier](../../workflow.md#risk-tiers-the-highest-applicable-tier-wins). It is temporary: one
foundation PR implements the pre-Studio work, promotes the enduring rules into the
[architecture](../../reference/architecture.md) and
[composition](../../reference/composition-execution.md) references and deletes this proposal; the
T5-time items already live as one-line seams in the T5 plan.

## Decision summary

**Is a refactor warranted now?** A large one is not. The domain packages, F4 acceptance, the
Stage adapter contribution model and visitor isolation are sound and should be left alone. There is
**one genuine bottleneck**: the spatial route
(`apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`, 7,350 lines) has become the
place where every lens-specific interaction and the whole project-session lifecycle accumulate.
Layout and Scene reach the Stage through adapters; Experience does not, and `studio.dual-entry` is
the next posture that would land the same way. The T5 plan already says "avoid growing another
all-purpose host inside the already large route"; this proposal makes that instruction executable.

| Change | When | Value | Size |
| --- | --- | --- | --- |
| R1 Retarget route source-text checks to follow code | Foundation PR, commit 1 | Unblocks every extraction below without weakening a check | Test-only |
| R4 Narrow adapter port + import boundary check | Foundation PR, commit 2 | Enforces the existing "no private Stage imports" contract; first plugin-SDK seam | Types + one arch test |
| R5 Scene datum-plane hits through the Stage intersect | Foundation PR, commit 3 | One ray→plane semantics for Studio's Scene gestures | Small |
| R3 Project-session controller out of the route | Foundation PR, commit 4 | Studio's save-before-switch and open-in-Studio call one owner | ~1,000 route lines move |
| R2 Experience lens interaction layer out of the route | Foundation PR, commit 5 | Studio lands as a module, not ~1–2k more route lines and 40+ more lens branches | ~1,500 route lines move |
| R6 Landing and Projects routes stop loading Three | Foundation PR, commit 6 | Measured: `/` and `/projects` load the 729 KB Three chunk | Small |
| R7 Lazy Experience lens | Foundation PR, commit 7 | World first load excludes Experience authoring | Small, measured |
| R8 One presentation-token source | Foundation PR, commit 8 | Prerequisite for skins; removes 589 duplicated fallbacks | Mechanical |
| R9 Unit planners grouped by owner | Folded into `scene.object-definition` | Registration follows ownership | Small |
| R10 Representation-family dispatch | Folded into the first T5 result-seam consumer | The one T5-driven seam that also serves extensions | Part of a capability |

**Deferred, with reasons below:** splitting `layout.adapter.ts`, renaming/merging `lib/museum`,
API route modularization, any plugin manifest/loader/sandbox, runtime skin switching and
extension-authored units.

## Baseline and method

`npm run status` at `96c71f78`: complete report, 0 failing gate checks, no open PRs, no
Studio claims; open flags #272–#276. A local `vite build` succeeds in ~15 s.

Evidence was gathered from production source, git history, the build output and the
[bundle report](../../../apps/editor/perf/bundle-report.mjs): import graphs, rune/function counts,
dispatch sites, test pinning and per-route first-load sets. File size alone is not treated as a
defect — the [architecture reference](../../reference/architecture.md#ownership-current-source-of-truth)
explicitly rejects line-count thresholds, and this audit agrees. A finding below needs a
coupling, ownership or growth mechanism, not a length.

Prior audits in the archive are UX-level (for example the R217 plan-authoring audit); no earlier
maintainability finding was found to re-verify. Two pieces of in-tree guidance are stale and are
corrected under R1.

## What is already sound — keep it

1. **Package dependency direction.** `layout-core`, `camera-core` and `geometry-core` are leaves;
   `project-model` depends on all three; no package imports editor, Svelte or `$lib` code (matches
   are comments only). The API imports only `project-model` subpaths and `layout-core`. The
   [packages contract](../../../packages/AGENTS.md) holds.
2. **F4 acceptance as the permission kernel.** Every writer registers a `DomainPlanner` with an
   admission profile (`domain`, `compound`, `units`, `resources`), and the
   [coordinator](../../../apps/editor/src/lib/authoring/f4/acceptance-coordinator.ts) refuses a
   candidate that "changes contents outside its admitted domain". This is exactly the enforcement
   point a permissioned extension needs. Issue #272 (envelope metadata outside the scope check)
   is the known hole and is a prerequisite for any third-party writer.
3. **The Stage adapter contribution model.** [`catalog.ts`](../../../apps/editor/src/lib/authoring/adapters/catalog.ts)
   discovers `*.adapter.ts` at build time; a `StageAdapterBinding` contributes ~30 slots (pick,
   handles, overlay, candidate preview, graphics, ghosts, pointer/key/hover intents, tasks, Find
   entries, Card facts/writers/actions, instruments) and is rebound per accepted snapshot;
   `requiredCapabilities` is negotiated against `HOST_STAGE_CAPABILITIES` and refuses unknown
   ones. Layout and Scene use it: the route imports one `layout-core` group and two Scene helpers.
   This is the right internal plugin seam and needs no redesign.
4. **Pick arbitration and dock composition.** [`stage-pick.ts`](../../../apps/editor/src/lib/authoring/stage/stage-pick.ts)
   is 44 lines and keeps domain winners domain-owned; dock tools derive from contributions
   (`stageDockTools`). Studio's scope fits both without restructuring (see B3).
5. **Visitor isolation.** Two Vite boundary plugins plus isolation checks in the architecture test lane; the editor
   Stage and visitor share entity renderers (`StageEntities` → `VisitorEntityGroups`) instead of
   forking them. Keep.
6. **Spatial presentation precedent.** [`world-environment.ts`](../../../apps/editor/src/lib/render/world-environment.ts):
   Scene stores only `environment.preset`; one runtime-safe look table is shared by Stage,
   snapshots, Preview and the published visit. This is the pattern future spatial styles should
   generalize (see "Extension readiness").
7. **Large single-owner modules.** `layout-core` (33k lines), `camera-core/viewport.ts`,
   `camera-motion.ts`, `stage-facade.ts` (one coherent host closure), `experience-controller.svelte.ts`
   and `ExperienceGuide.svelte` are large but single-responsibility and tested. No split is
   recommended.
8. **The safety net for extraction exists.** About 5,000 lines of mounted route tests
   (`spatial-route-gesture`, `-experience-homes`, `-source-replacement`, `-resume-save`,
   `stage-height-sheet`) boot the real route with the real facade, Layout adapter and F4, plus
   browser flows under `apps/editor/perf/flows`. Extraction can be proven behavior-neutral.

## Confirmed issues

### C1 — The spatial route accumulates lens-specific interaction (high)

| Evidence | Value |
| --- | --- |
| Size and growth | 4,782 lines at `6cfe0fb7` (2026-11-01) → 7,350 at `ce4e232c` (2026-11-06): +54 % in six days of R217 Experience work (S23–S31). 110 commits touched it since August, more than any other production file. |
| State | 87 imports (24 from `lib/authoring/experience`), 97 `$state`, 58 `$derived`, 27 `$effect`, 164 functions |
| Regions (approx.) | 476–1830 Experience playback, View edit, placement, re-aim, Look through, Preview warm/open · 2123–3120 project lifecycle · 3121–4760 measurement, refresh, pointer/wheel/key routing · 4761–5868 labels, Experience Card/Index wiring, dock · 5869–6596 markup · 6597–7350 styles |
| Branching | 42 inline `lens === / !== 'experience' \| 'world'` branches; `onPointerDown`, `onClick`, `onWheel` and `handleKey` hard-code Experience precedence before adapter routing |
| Ownership note | [`experience.adapter.ts`](../../../apps/editor/src/lib/authoring/adapters/experience.adapter.ts) registers planners and one task but states that "the authoring homes … are mounted once by the route's Experience lens" |

This is not a domain-ownership violation: Experience edits go through Camera intents and F4. It is a
composition defect: the route is the only place a posture can hook pointer precedence, keyboard,
chrome gating and replacement teardown, so each posture adds route code. Studio's specification
(World-origin scope, muted non-pickable context, scoped dock without Ink, scope strip, Esc/return,
Camera framing and return) needs every one of those hooks.

### C2 — The project-session lifecycle lives in the route (medium-high)

`load`, `runReplacement`, `offerResumeSave`/`resumePendingSave`, `prepareProjectLifecycle`,
`renameCurrentProject`, `deleteCurrentProject`, conflict refresh and reload (~1,000 lines) share
route-local state (`pendingSavedBase`, `remoteSavedCanonicalJson`, `headSave`, `boot`). The code is
careful — epoch-bound loads, explicit create/open intents — but it is reachable only through the
route. `studio.dual-entry` PR 2 needs "save the source project before a cross-project switch or
retain it in place if Save fails", `/studio` direct creation and `Open in Studio` posture: all of
these are this lifecycle.

### C3 — Route source-text checks pin code location (medium; blocks C1/C2 fixes)

Eleven test files read the route source; at least 70 assertions match exact text in it (40 in
`stage-shell-composition.test.ts` alone, e.g. a regex over `function capturePointer(`). Several
guard real invariants (no `.applyIntent(`, Camera intents only through `requestViewingIntent`,
capture wrapped in `try`). Any extraction fails them although behavior is unchanged. They must be
retargeted to wherever the code lives, never deleted.

### C4 — Adapters receive the whole facade (medium)

`StageAdapterServices.stage` is the full `StageFacade` (68 members, including
`registerStageAdapter`, `installAccepted`, `changeLens`, `dispose`). Adapters use about 20 of them
plus about a dozen `stage.session.*` members (`task`, `cancel`, `candidate`, `writerGeneration`, `arm`, …),
and import `stage-session`, `camera-session`, `host-acceptance` and `accepted-read` directly. The
[Shared Stage interface](../../reference/composition-execution.md#shared-stage-interface) says
consumers use "the public facade (no private Stage imports)"; no check enforces it. First-party
code is fine today; the gap matters the moment a Studio module or any extension is written against
"whatever the facade exposes".

### C5 — Scene re-implements datum-plane hits (low-medium, on Studio's path)

Layout resolves pointer→datum through `context.intersect(ray, datumWorkingPlane(…))`, which returns
reasoned `parallel | behind | stale-evaluation` failures. [`scene.adapter.ts`](../../../apps/editor/src/lib/authoring/adapters/scene.adapter.ts)
solves the same plane by hand three times (`pointerDatumPoint`, the Turn ring at a level plane and
Plan footprint picking) with different epsilons (1e-8, 1e-6, none) and behind checks. Studio's
create/size/turn gestures run through these paths; one plane semantics avoids divergent refusals.

### C6 — `/` and `/projects` load the Three chunk (medium, measured)

Bundle report at `96c71f78`: `/` first load 1,094 KiB raw / 306 KiB gzip and `/projects`
1,118 / 315 KiB, both including the 729 KB chunk that contains Three, plus a 259 KB Layout/domain
chunk. The route needs `createProjectId`, auth and pending-capture handling; it reaches Three via
`project-persistence.ts` → `@portfolio/project-model/units` (whole barrel) →
`project-layout-semantics.ts` → `camera-core` → `three`. Part of the closure may be legitimate
(pending-capture validation), so the fix is a lazy import of the validating path, not a guess.
No workspace package declares `sideEffects`, which may also limit tree-shaking; measure before
changing it.

### C7 — Presentation tokens exist but are not one source (low now; blocks skins)

[`shell-roles.css`](../../../apps/editor/src/lib/authoring/stage/shell/shell-roles.css) defines
PLATE roles, scoped to `.editor-host`. Components use them 771 times, but 589 uses repeat the value
as a `var(--shell-x, #hex)` fallback, 306 bare hex literals remain in 38 Svelte files (landing,
login, Projects and visitor routes cannot see the scoped tokens) and Three instrument paint
duplicates them in TS ([`stage-paint.ts`](../../../apps/editor/src/lib/authoring/stage/shell/stage-paint.ts),
`PAPER_TONES`). A skin today would mean editing ~60 files.

### C8 — Experience authoring is in the World first load (low-medium)

The spatial route's first load is 2,653 KiB raw / 751 KiB gzip; its authoring chunk (1.23 MB raw /
363 KB gzip) contains Stage, adapters and Experience authoring. Experience authoring is ~21 % of
`lib/authoring` source by bytes. Lazy instruments already exist (`ImportModelInstrumentLazy`,
`MyObjectsSectionLazy`, dynamic `VisitorPreviewSurface`), so a lazy lens follows precedent — but
only after C1, because the route statically imports 24 Experience modules.

### C9 — Stale agent guidance (low, cheap)

[`lib/authoring/README.md`](../../../apps/editor/src/lib/authoring/README.md) still describes the
#115 retention set ("most have no product importer today") for a tree that is now 62k lines of live
authoring code; `catalog.ts` says "Production currently discovers no writers" while it discovers
three adapters. Agents read these first.

### C10 — Unit planners are bundled across owners (low)

[`units/planning.ts`](../../../packages/project-model/src/units/planning.ts) holds Camera,
Experience and a Scene (`scene-environment-set`) planner; `createUnitCandidatePlanners` is
registered by the Experience adapter. Admission declares the right domain, so F4 ownership is
correct; only the registration vehicle is wrong. Matters when Scene object-definition planners
arrive.

### Not confirmed as issues

- **`layout.adapter.ts` (4,940 lines; one `bind` closure with ~85 nested functions).** Large and hard
  to unit-test, but single-domain, already partly decomposed into `adapters/layout/*`, covered by
  the Layout adapter suites, and untouched by T5's first capabilities. Defer until T1 work resumes.
- **Entity-kind conditionals in the Scene adapter** (~45 `form` dispatch sites repo-wide).
  `studio.dual-entry` and profile revision add no entity kind. Address with R10, when control
  surfaces or holes add a representation family.
- **API `app.ts`** (31 handlers, persistence already in separate modules). Coherent; revisit when
  T4 publication adds route groups.
- **`lib/museum` naming and the runtime renderer split** across `lib/museum`, `lib/render`,
  `lib/layout` and `lib/content`. Confusing next to the externalized Chopin museum, but a move
  touches 19 test files and both boundary plugins' closures for little behavioral gain. Do it, if
  at all, inside R10 when the renderer is touched anyway.

## Recommended boundaries and contribution interfaces

### B1 — The route is a composition root

The route mounts the Stage, constructs controllers, routes raw DOM events in a fixed order and
renders shell slots. A new posture or capability adds a module and a wiring line, not route
branches. No line budget is proposed; the rule is reviewed by asking "which owner does this new
route code belong to?".

### B2 — Posture layer (route-local, two concrete consumers)

```ts
/** Session-only interaction posture that runs before adapter routing. Owns no selection,
 *  history or Camera state; realizes viewing through facade intents only. */
type StagePostureLayer = {
	readonly id: 'experience-lens' | 'studio-scope';
	pointerDown?(event: PointerEvent): 'claimed' | 'pass';
	pointerMove?(event: PointerEvent): 'claimed' | 'pass';
	pointerUp?(event: PointerEvent): 'claimed' | 'pass';
	pointerCancel?(reason: StageInterruptionReason): void;
	click?(event: MouseEvent): 'claimed' | 'pass';
	wheel?(event: WheelEvent): 'claimed' | 'pass';
	key?(event: KeyboardEvent): 'claimed' | 'pass';
	/** Chrome the posture gates; read reactively by the route's shell slots. */
	readonly chrome: { readonly dockToolFilter?: (id: string) => boolean; readonly cardInset?: number };
	/** Exactly once: lens exit, project replacement, route teardown. */
	dispose(): void;
};
```

The route keeps its current precedence: pinch/second pointer → active layer → adapters →
navigation. At most one layer is active. **Alternative rejected for now:** promoting postures into
the Stage adapter contract (host-arbitrated). It is the more general shape, but it changes a
Tier 1 shared contract for two first-party consumers; promote it only if a third consumer (for
example an extension posture) needs host arbitration. Implement layers as `.svelte.ts` controllers
constructed during route initialization so their `$effect`s attach to the route's effect tree
(an effect created outside component initialization needs `$effect.root` and explicit disposal).

### B3 — Subject scope in the Stage host (lands inside Studio PR 1)

Studio's "other content is muted and non-pickable" must be host state, not a route filter, because
the host must not reorder hits and an out-of-scope occluder must not swallow a press:

- `StageSession` gains a session-only `scope: { root: SemanticReference } | null`, cleared on
  replacement, never serialized.
- `StageAdapterContext` exposes `inScope(reference)`; each domain's pick provider excludes
  out-of-scope candidates itself, so the next in-scope candidate can win.
- Marks/handles and Card are admitted only for in-scope subjects; dock tools pass the posture's
  `dockToolFilter` (no Ink in Studio); muted presentation is a render flag on context, not a
  material change.

### B4 — Project-session controller

`createProjectSession(...)` (proposed in `lib/authoring/project-session/`) owns boot/load intents,
replacement, resume-Save offers, rename/delete/conflict/reload, saved base and Head Save
construction for one epoch. It exposes reactive `boot` and `headSave` plus commands
(`load(id, intent)`, `replace(action)`, `saveBeforeSwitch()`, `rename`, `delete`). The route
renders and wires it; `boot-state.ts` remains the admission owner; F4/persistence semantics are
unchanged.

### B5 — Adapter port

`StageAdapterPort` = the facade members adapters actually use, plus a `StageTaskPort` for the
session members they need, both exported from
[`stage-adapter-host.ts`](../../../apps/editor/src/lib/authoring/stage/stage-adapter-host.ts).
Type-only at first: the runtime object is still the facade. An architecture check asserts that
`lib/authoring/adapters/**` and future Studio/extension modules import Stage only through
`stage-adapter-host` and published type modules. This is the first plugin-SDK seam and costs
nothing at runtime.

### B6 — Representation-family dispatch (T5's generalized result seam)

When the first T5 consumer generalizes beyond one extruded ring (control surfaces or holes, per the
[capability sequence](../t5-expressive-geometry/umbrella-plan.md#capability-sequence)), shape the
seam as a **first-party table keyed by representation family**: runtime-safe evaluation
(`geometry-core`), footprint/bounds for pick and Paper, and one shared-renderer entry consumed by
both Stage and visitor. The renderer currently infers cap/side layout from extrusion buffers
(`lib/museum/entities/form-geometry.ts`); that inference becomes the extrusion family's entry. No
registry API, loading or versioning is built — but this is the seam a CAD/BIM or modeling extension
would later contribute to, so getting its shape right serves both.

## Implementation sequence

The work needed before Studio lands as **one scoped foundation PR**. After it merges, T5 starts from
a clean route and needs nothing from this proposal. The T5 items are already written into the
[T5 umbrella plan](../t5-expressive-geometry/umbrella-plan.md) as one-line seams, so later
capabilities read only their own plan. The
[editor test contract](../../../apps/editor/tests/README.md) is the merge requirement. "Stop" means
leave the PR as a draft and report back, not improvise.

### Foundation PR before `studio.dual-entry` — Tier 1 (shared shell surface, Save/resume paths)

No visible behavior change. It is reviewed one commit at a time, and every commit keeps the full lane green, so
a reviewer (or `git bisect`) can follow each step. Commits, in this order:

1. **Retarget route source-text checks; fix stale guidance (R1).** Give each assertion that pins the
   route a target that follows the code. That is either a named-module read (the route plus the
   modules it composes) or a mounted behavioral assertion with the same predicate. Update
   `lib/authoring/README.md` and the `catalog.ts` header to describe the live tree. *Proof:* map each
   of the ~70 assertions 1:1 to its retarget, with an equal or stronger predicate (the PR lists the
   mapping), and change no production code in this commit.
2. **Adapter port and import boundary (R4, B5).** Define `StageAdapterPort` and `StageTaskPort` as
   types, move `evaluationIdOf` behind them, and add an architecture-lane check on adapter imports.
   *Proof:* all three adapters compile against the port; no runtime diff.
3. **Scene datum-plane hits through `context.intersect` (R5).** *Proof:* the Scene placement, Turn and
   Plan footprint suites pass unchanged, and refusals keep their wording.
4. **Project-session controller (R3, B4).** *Proof:* `spatial-route-source-replacement`,
   `spatial-route-resume-save`, `stage-boot-states`, `head-save-journey` and the `project-lifecycle`
   and `lifecycle-regression` browser flows pass unchanged. Create and open stay distinct, and a stale
   load cannot install over a replacement.
5. **Posture layer and Experience lens (R2, B2).** Move Experience playback, View edit, placement,
   re-aim, Look through, Preview warm/open, Experience pointer/click/wheel/key precedence, and Card
   and Index wiring into `lib/authoring/experience/experience-lens.svelte.ts`, plus one lens layer
   component where markup moves. *Proof:* `spatial-route-experience-homes`, `experience-shared-homes`,
   `playback`, `spatial-route-gesture` and the Experience browser flows pass. The route keeps no
   Experience-specific functions, and its lens branches reduce to layer dispatch and slot selection.
   The spatial-route bundle report stays within ±1 %.
6. **Landing and Projects stop loading Three (R6).** Lazy-import the validating pending-capture
   path, or use a narrower `project-model` subpath. Add `--forbid` bundle-report assertions that `/`
   and `/projects` load no Three. *Proof:* the bundle report shows Three gone from both first loads;
   the login-return and pending-capture flows pass. *Stop:* the auth-return resume flow needs
   synchronous validation.
7. **Lazy Experience lens (R7).** Load the lens layer and the Experience homes on first lens entry,
   with idle prefetch. *Proof:* a measured drop in spatial-route first load; Experience browser flows
   pass; no new loading state. *Stop:* any visible delay or loading UI — drop this commit and flag
   `needs-ux` rather than holding the PR.
8. **One presentation-token source (R8).** Move the PLATE roles to an app-level token sheet with the
   same values and remove the `var()` fallbacks. Derive the Three instrument paint from one TS table,
   checked equal to the CSS. Add a check forbidding bare hex outside the token and runtime
   look-table files. *Proof:* every resolved colour is unchanged (token diff empty; screenshots of
   the shell, landing, Projects and a published visit match); new check green. Mechanical, so it
   goes last: it touches the files earlier commits moved. *Stop:* any value change — values belong
   to the approved design.
9. **Closeout.** Promote the enduring rules into the references: route as composition root and the
   posture layer go into [Shared Stage interface](../../reference/composition-execution.md#shared-stage-interface),
   the adapter port goes into [Extension points](../../reference/composition-execution.md#extension-points-and-version-negotiation),
   and the token-source rule goes beside the shell rules it governs. Then delete this proposal and
   its roadmap row.

Overall acceptance: `check`, `test`, `test:arch`, `build` and the touched browser flows pass; the
change adds no persisted-format, API, Camera write path, Stage adapter contract change or dependency.

- *Risks:*
  - `$effect` ordering and lifetime once effects leave the component.
  - Pointer precedence: look-through re-aim, placement and View marks must still run before adapters.
  - Esc semantics.
  - Teardown of a live playback or Look through on replacement.
  - Epoch and currency checks split across modules.
  - A retargeted read that can never fail.
- *Stop and split:*
  - Any visible behavior change, or any check that cannot keep its predicate (Tier 2).
  - Commit 7 hitting its own stop is dropped from the PR, not a reason to hold it.

Do not open Studio route work while this PR is open; both edit the same route regions.

### Folded into T5 (one-line seams already in the umbrella plan)

- **`studio.dual-entry`:** Studio is a second posture layer, and the host gains a session-only
  subject scope (B3); PR 2 uses the project-session controller for save-before-switch.
- **`scene.object-definition`:** registers its planners from the Scene adapter, and moves the
  existing `scene-environment-set` planner there with them (R9).
- **First result-seam consumer (capability 7 or 8):** shapes the seam as a first-party
  representation-family table (R10, B6).

### Deferred

| Item | Revisit when |
| --- | --- |
| Split `layout.adapter.ts` along existing `adapters/layout/*` seams | T1 Layout work resumes and needs to change its gesture core |
| Rename/merge `lib/museum`, `lib/render`, `lib/layout` into one runtime renderer | R10 touches the renderer anyway |
| API route plugins | T4 publication adds route groups |
| Plugin manifest, loader, sandbox, marketplace | Owner decides a trust model and a first external consumer exists |
| Runtime skin switching | Owner approves a second skin |
| Extension-authored units | A concrete domain admission is proposed |

## Build, test, runtime and performance consequences

- **Build:** extraction is neutral (same modules, same chunks); R6/R7 reduce first-load bytes and
  must be proven with the bundle report, not estimated.
- **Tests:** the mounted route suites remain the primary proof and are unchanged; R1 is the only
  test-shape change and is constrained to equal predicates. New checks: R4 import boundary, R6
  bundle forbids, R8 literal ban — all architecture-lane, fast.
- **Runtime:** posture layers and the project-session controller are plain `.svelte.ts` rune
  controllers constructed by the route, so the reactive graph is the same shape. The real risk is
  effect lifetime; the foundation PR proves teardown on replacement and route unmount exactly once.
- **T5 disruption:** the foundation PR touches the route and adapters that Studio PR 1 will also
  touch. Merge it before Studio route work starts; do not run them concurrently.

## Extension readiness — direction, not implementation

**Principle:** an extension contributes through the same seams first-party domains use. There is
no plugin-only path, no second history, selection, Camera or compiler.

| Extension layer | Existing seam | What a permissioned SDK would add later |
| --- | --- | --- |
| Authored data | F.2 units and the [extension points table](../../reference/composition-execution.md#extension-points-and-version-negotiation) (domain admission; required/optional negotiation) | An extension unit kind per admitted domain; owner decision on preserving unknown optional units on Save |
| Writers | `DomainPlanner` admission + F4 scope check | Per-extension admission grants checked at `registerPlanner`; #272 fixed first |
| Editor contributions | `StageAdapter` slots + `requiredCapabilities` | The R4 port as a versioned contract; conformance kit grown from the stage-conformance probe adapter |
| Runtime and visitor | Runtime-safe evaluators, shared renderer, boundary plugins | Entries in the R10 representation-family table; visitor half must pass the same boundary plugins |
| Presentation | PLATE tokens; environment preset id → shared look table | Skins as alternate token values (R8); spatial styles as typed resources referenced by id, like the preset |

**CAD/BIM-like tools** map onto Layout, which owns architecture and its one canonical compiler.
Such an extension contributes Layout operations (planners over `layout-core` semantics),
representation and interchange — never a parallel architectural model (hard rules 2 and 6).

**Skins** change token values, never component structure. Whether instrument semantics
(selection gold, refusal, proposal cobalt) may change under a skin is an owner decision; this
proposal assumes they stay fixed for legibility.

**Trust model:** until the owner decides otherwise, only first-party bundles discovered at build
time are extensions. Untrusted third-party code on the main thread with DOM and WebGL access is not
safe to admit; isolation (worker/iframe) is a Tier 2 decision with its own research.

## Owner decisions this proposal needs

1. Accept the single foundation PR as the prerequisite for `studio.dual-entry` (recommended), or
   let Studio PR 1 start on the current route and absorb the cost there.
2. Accept the route-local posture layer (B2) now, with host arbitration deferred to a third consumer.
3. For later, not now: skin scope (instrument colours fixed?), preservation of unknown optional
   units, and the third-party trust model.

## What this proposal rejects

Splitting files by length; a generic command framework (the
[shared authoring operations](../../reference/composition-execution.md#shared-authoring-operations)
contract already rules it out); a plugin registry, event bus or DI container before an external
consumer exists; moving the Stage facade into a package (it is editor-only by contract); splitting
`layout-core`, `camera-core` or the Experience controller; and any change that turns a shell
restriction into a reason to omit an approved Studio journey.

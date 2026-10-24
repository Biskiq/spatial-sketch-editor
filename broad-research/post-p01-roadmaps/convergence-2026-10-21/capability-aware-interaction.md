# Capability-aware interaction — RR-3 / RR-5 / RR-6 commission and initial findings

**Status:** research/planning proposal, 2026-10-21; inspected baseline `78cafc3acaad0f9919855901a7ea4d98aeecd85f`. No ratification, phase registration, implementation authorization or production change. Owner acceptance of P1's meaningful interactive Presentation, P2 Smart Wall and P3 Vellum is an input; P4 is explicitly deferred. Earlier roadmap language about P4 starting early does not reopen it.

**Round boundary, revised 2026-10-22:** follow the [convergence sequence](../../../docs/archive/roadmap/coordination-2026-10/product-convergence-2026-10-21.md#scope-and-sequence).
Step 2 (independent research) **executed 2026-10-22 at `ce9b7156`**; `git diff 78cafc3a ce9b7156 --stat`
touches only `broad-research/` and `docs/` (13 files), so no inspected source, test or asset changed and the
baseline evidence stands. Results are in [§Step 2 results](#step-2-results) and the
[handoff](#handoff-to-the-convergence-lead); disposable probes are under
[`probes/capability/`](./probes/capability/README.md). Results feed combined contract/design and canonical
roadmap/DAG reconciliation in PR #173. The
[owner production hold](../../../docs/roadmap/README.md#production-implementation-hold) includes
T3.P02 despite its earlier authorization; research or merge cannot release that hold.

## Decision and first consumer

**Owner clarification, 2026-10-22 (owner-supplied provenance in chat; not inspected artifact evidence).** The P1
executable was deliberately kept out of the repository; its capability is narrower than the earlier
[P1 commission](../prototype-roadmap.md) (mechanical watch, rich controls). What it demonstrated: a Presentation
for an object can exist without Rooms, Guides or Stops. The owner's point: **for an imported object, Biskiq keeps
its parts, lets the creator annotate them, and lets the object be viewed in itself, as part of an
exhibition/Room, or as part of a Guide — the same object and annotations reused across those contexts.** The
earlier rich P1 commission is not the accepted scope.

Re-centred decision: the smallest honest contract for (a) **part retention on import** — which imported nodes
survive admission as addressable components; (b) **part-qualified annotation** — an annotation targeting a
qualified part of a placed instance, its owner, and its survival across resource revision; (c) **three-context
reuse** — the same object + annotations viewed standalone (empty World, Guide-free Presentation), within a
Room/exhibition and within a Guide, without cloning Scene data and without Room/Guide/Stop prerequisites.
Material variants, clips and mechanism actions are **later action families**; their evidence is kept below but
decides nothing for (a)–(c) except where noted.

Proposed acceptance specimen (revised): one imported model with real node-level parts (e.g. the clock source's
`ClockCase`/`Clockface`/`Glass`/`MoonDial`, or the synthesized fixture), placed twice in an empty World. Admit two
parts; annotate one part and one instance-local point on instance B only; view through a Guide-free Presentation;
reuse that Presentation as a Stop in a Guide and frame the same instance inside a Room; Save/reload; duplicate
instance B; replace the resource revision and receive explicit repair. A single-mesh model must remain usable at
object level and truthfully offer no parts.

Answer these decisions together, without designing a universal workflow engine:

1. What separates **observed file data**, **admitted component** and **authored annotation/binding**? Who validates each boundary?
2. Which identity survives instance duplication, resource revision and re-export; how does a reusable role interface differ from component identity?
3. Which minimal Experience records express part annotations and their reuse in three contexts without making Presentation a Scene container or a page tree?
4. (Demoted) How does one semantic event produce a typed domain action with run ownership, cancellation, conflicts, reset and accessible equivalents?

## Bounded read inputs

Start at [docs router](../../../docs/README.md), then read only these concerns and their named implementation evidence. Expand when a probe exposes a concrete missing contract.

| Input | Read boundary / purpose |
| --- | --- |
| [Coordination proposal](../README.md) | §§2–6, ledger rows for controls, invocation, resources and content; RR-3/5/6 and authorization route. P4 is deferred; its original early sequencing is inactive. |
| [Prototype commission](../prototype-roadmap.md) | P1 journey and §5 asset/invocation/content proofs; requirements, not demonstrated implementation. Superseded as scope by the owner clarification above. |
| [Scene contract](../../../docs/reference/components/scene-content.md) | Ratified definition/instance/capability/override/reuse and truthful-ingest paragraphs; existing clusters are not assemblies. |
| [Assets contract](../../../docs/reference/components/assets.md) | Ratified destination and current asset system; source/derivative provenance and truthful capability reporting. |
| [Camera contract](../../../docs/reference/components/camera-tour.md) | Current F2 ownership and Guide-free access; Camera is the sole viewing evaluator. |
| [F contract](../../../docs/reference/composition-execution.md) | F.1 component/resource references, F.2 domain admission, F.3 contributions, F.4 compound acceptance, session logic, AM-3/6/9; extension points for only the first consumer's missing kinds. |
| [PLATE](../../../docs/reference/design-system/editor-shell-and-visual-system.md) | §0.8.1 Presentation/subject/Preview, discovery ownership and final conformance test. Presentation is reusable composition, not a Scene container. |
| [T3.P02](../../../docs/roadmap/t3-experience/t3.p02-capture-and-cut-preview/README.md) | Bounded outcome, exclusions and slice register: S01 approved; S02 proposed. Rich controls/general animation orchestration are excluded. |
| Production evidence | `packages/project-model/src/{units/types.ts,units/experience/{lowering,interpreter,companion}.ts,program/types.ts,channels/{families,camera-output,handoff,negotiate,types}.ts,references/unit-resolution.ts,scene.ts}`, `apps/editor/src/lib/museum/assets/{AssetModel.svelte,model-utils.ts,instance-material-remap.ts}`, `apps/editor/assets-source/pipeline/normalize-asset.sh`. |
| P1 evidence limit | Resolved by owner statement (above): the executable is intentionally absent; its mechanisms were not inspected. |

## Initial findings — evidence classes kept separate

*(Step 1 findings, preserved; corrections from step 2 are in [§Corrections](#corrections-to-initial-findings).)*

**Observed repository evidence (read-only source/header inspection; no browser/runtime execution here):**

- `ExperiencePresentation` currently contains `id`, `label`, `viewId`; `ProgramContentRecord` admits text only. The program action union admits show-content, navigate-to, open-url, continue and boolean/choice set-state. No arbitrary button-to-component-capability action or rich visitor-control grammar is present in that inspected union.
- The shared interpreter already has bounded guards, typed boolean/choice state, lifecycle actions and `runId`/`runEpoch` stale-event rejection. Its reset rewinds the **same** run; a fresh run is the host's new-run path. The companion explicitly lists Presentations with no Stop. Camera output tickets already carry output/source/session/owner/run qualification and ordered ownership transitions.
- `DEFAULT_CHANNEL_FAMILIES` admits Layout Plan inspection and Camera session inspection. This is useful landed infrastructure, not generic clip/component/property orchestration. Typed resource kinds currently admit `texture` and `asset`; portable performance/explanation interfaces are not established by that union.
- F's older prose saying no reducer/general channel system exists needs status reconciliation against AM-3/6 and current source. Preserve its normative rules; do not restart those foundations or claim arbitrary capability execution is landed. Lowering currently accepts explicit preparation inputs for content/state/lifecycle, which is not proof of persisted authoring homes for all those inputs.
- The inspected `AssetModel.svelte` clones a loaded GLTF scene and reports animation **names** to inspection. No clip playback executor was found in that renderer/inspection closure. Rendering a hierarchy or displaying clip names does not admit semantic components, pivots, actions or revision continuity.

GLB JSON-chunk probe actually run with Python stdlib (`struct`, `json`, `hashlib`); geometry buffers were not decoded and pivots were not visually validated:

| Local specimen | SHA-256 | JSON results |
| --- | --- | --- |
| `apps/editor/static/museum/models/decor/clock/grandfather-clock.glb` | `c44bfabd45da819470038502130b56f7bc6863daaadc0d48909c9d14e6361420` | 4 nodes / 4 meshes; 0 parent nodes; 4 explicit TRS nodes; no animations; no node extras. |
| `apps/editor/assets-source/models/grandfather-clock/source.glb` | `e43717f8f2cf849c67da6a7dc4370921a975b1258bb11aa1fb4e0429aa892173` | 11 nodes / 4 meshes; 7 parent nodes; 6 matrix nodes; no animations; no node extras. Source hierarchy and derivative differ. |
| `apps/editor/static/museum/models/piano/grand-piano.glb` | `a360b6fcbad835f5b82fe0ba7d347538695230974d27767483a4d6fd4a08d660` | 17 nodes / 17 meshes; 0 parent nodes; 17 explicit TRS nodes; no animations; no node extras. |

These three files have no repeated nonempty node names, but that proves neither durable IDs nor mechanism semantics. The derivative extensions are meshopt compression, WebP textures and mesh quantization; none supplies the missing interaction meaning. Separate clock/piano meshes do not prove an opening, playable or exploded mechanism. Source/derivative hierarchy mismatch makes resource correspondence a real question now.

**Externally verified technical facts (primary sources, accessed 2026-10-21):**

- Core glTF names need not be unique; its core animation format stores node-transform/morph keyframes and leaves playback order, loops and runtime policy to the application. A clip/file therefore cannot define Biskiq cancellation or ownership semantics by itself. [Khronos glTF specification, §§3.3, 3.11](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- Material variants are a genuine non-animation capability candidate: the Khronos sample shoe declares three variants through `KHR_materials_variants`. This verifies sample documentation/JSON, **not local ingest or evaluator support**; pin its source revision and inspect actual bytes before using it as a positive control. [Khronos sample README](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/MaterialsVariantsShoe/README.md), [extension specification](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_variants/README.md)
- W3C's button pattern supports Enter/Space activation and explicit toggle state. Pointer Events specifies `pointercancel` when a stream is suppressed. Thus keyboard semantics and cancellation must be mapped deliberately; a raycast click handler alone is insufficient. [WAI button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/), [Pointer Events §4.2.7](https://www.w3.org/TR/pointerevents3/#the-pointercancel-event)
- SCXML offers state-machine invocation and exit cancellation semantics. It is a comparator for event/run design, not a reason to adopt a second interpreter or its whole language. [W3C SCXML](https://www.w3.org/TR/scxml/)

**Inference / provisional recommendation (step 1):** P1's accepted outcome fits existing authority separation but needs narrowly admitted capability/offer/binding shapes. Asset evidence is presently static, and common invocation scaffolding is farther advanced than broad status prose suggests. The consequential gap is honest admission plus bounded domain effects, not another Camera, generic timeline or foundational reducer. *(Step 2: confirmed and sharpened — the consequential gap for the re-centred consumer is part retention + component admission + targeted annotation, not effects; see results.)*

## Step 2 results

Evidence classes: **[O]** observed repository/executed locally; **[X]** externally verified (step 1, not re-fetched);
**[I]** inference/proposal; **[N]** not run.

### Probe disposition ledger

| Probe | Disposition | Command / evidence | Decisive result |
| --- | --- | --- | --- |
| 0 P1 provenance | **Resolved by owner statement** (not inspected) | Looked: `prototypes/` at HEAD; `git log --all --diff-filter=A --name-only` and `git log --all --name-only` for p1/watch/studio/presentation paths (hits only P1-named camera/installation plans and `p23b8-p1-randomized-differential.test.ts`; historical prototype dirs are `New-QA`, `P3-Claude`, `biskiq-creator-shell-design-independent`, `experience-*`, `integrated-experience-authoring`, `object-composition-prototype`, `p2-smart-wall`, `p3-vellum`, `paper-authoring-commission`, `spatial-authoring`, `world-experience-shell-*`); `git branch -a`; `git stash list`; lead checked `~/Documents/Biskiq/batch-2026-10-17`/`-20` and the artifact list. PR #154 (`42d77b28`) is docs-only (4 files under `broad-research/`). | Executable intentionally absent. No mechanism claim is made about it. Accepted UX finding preserved as owner statement. |
| 1 Asset audit | **Executed** [O] | `python3 -I probes/capability/glb_audit.py $(git ls-files '*.glb' '*.gltf')` — all 15 tracked models | Every catalogue derivative is flat (0 parent nodes); every source has hierarchy. 5 of 8 sources are a single mesh. One source clip exists and is dropped. Table below. |
| 2 Positive/negative capability | **Executed with a synthesized fixture** (no download) [O] | `node probes/capability/make_fixture.mjs` → `fixtures/part-specimen.glb` `48a24ffc…98bee`, 2612 B, validator 0 errors/0 warnings, byte-identical on regeneration; loader column `loader.probe.ts`; negative control = clock derivative `c44bfabd…`. No `KHR_materials_variants`/animated sample exists in installed `node_modules`. | Admission matrix below: loader exposes parts/clip/raw variants; Biskiq admits none. Repo's own normalize recipe destroys an annotation marker and misattributes variants. |
| 3 Instance/revision addressing | **Executed, bounded** [O]; re-export reorder/rename/remove, Undo/reload **deferred** | `addressing.probe.ts` (two instances of one resource; part-qualified F.1/F.3 targets; resource revision change) | F.1 resolves instance B, refuses any `componentId` (`missing`). F.3 keeps A and B scopes distinct but admits a nonexistent part id. Deferred trigger: the T2 component-admission slice (correspondence) and its F4 Undo/reload proof. |
| 4 Invocation trace | **Executed** [O] | `lifecycle.probe.ts` (interpreter + Camera tickets), `addressing.probe.ts` (research-only `scene.part-emphasis@1` family) | Run-scoped stale rejection, idempotent cancel, exclusive conflict, ordered replacement and stale cleanup are enforced by landed code. Gap: same-run reset accepts pre-reset completions. |
| 5 Baseline/async invalidation | **Partly executed** [O]; definition baseline/variant/instance override **blocked: missing interface** | Same probes: source rebase, resource revision expiry | Source edit → stale run; resource revision → contribution reads `absent`. No definition/variant/override provider exists to compute an effective baseline (Scene `SceneModelEntity` = `assetId` + transform + whole-asset material). |
| 6 Input/projection/a11y | **Deferred** (no browser) | Trigger: the consuming T3 slice's real-route review (browser-hygiene skill). Source-level: companion supplies `focusOnOpen`/`escapeReturnsTo`, Activate/navigation instructions, Presentations as destinations; no projected part label, part pick or DOM part list exists. | Nothing decided beyond: a part annotation needs a DOM equivalent that does not depend on projection or occlusion. |
| 7 Reuse and scope | **Deferred** beyond D3 analysis | Trigger: owner call on per-instance vs per-definition annotation reach (D3). | Three-context reuse is representable by one Experience Presentation reused standalone and by Stops; Room context needs no Room subject. |

### Asset audit and source → derivative loss report [O]

Catalogue (Probe 1; sha prefixes; full hashes reproducible with `run.sh`):

| Asset | Source (nodes/meshes/groups/empties, clips) | Derivative | Lost by the catalogue route |
| --- | --- | --- | --- |
| Clock `e43717f8` → `c44bfabd` | 11/4/7/0, none | 4/4/0/0 | named part groups `ClockCase`, `Clockface`, `Glass`, `MoonDial` (only generated leaf names `ClockCase_ClockCase_0`… survive); transforms baked |
| Piano `09627e34` → `a360b6fc` | 20/17/3/0, none | 17/17/0/0 | 3 groups; source meshes are `Object_3…19` (no semantic names in source either) |
| Chandelier `f29d0c4f` → `83e188c2` | 13/6/4/3 empties, clip `Animation` (1 LINEAR key on meshless `Empty.016_10`) | 4/4/0/0, no clip | 2 meshes merged/removed, empties, clip; node `Object_6` now carries mesh `Object_0` (mesh names renumbered) |
| Oil lamp, salon chair, salon table | 3/1, 5/1, 5/1 | 1/1 each | groups only; **single mesh: no node-level parts exist** |
| Sofa, dining chair (`.gltf`) | 1/1 each | sofa 1/1 | none; single mesh |

The one supplied clip animates a meshless empty with a single key — observed clip ≠ meaningful capability.

Recipes over the fixture (`run.sh`; gltf-transform 4.4.1):

| Recipe | Nodes / meshes | Part/capability effect |
| --- | --- | --- |
| Source fixture | 7 / 3 | Body (variants, extras), LidHinge→Lid, Foot ×2 (shared mesh), `Anchor.Dial` (empty, extras), clip on LidHinge |
| **Repo P24A `normalize-asset.sh`** (prune, dedup, center) `4b489263` | 7 (6 + new `Pivot` root) / 1 | `Anchor.Dial` and its extras **deleted** (prune); Body/Lid/Foot meshes **deduplicated into one mesh carrying Body's variant mapping** → Lid and both Feet now switch Walnut/Ebony; root path gains `Pivot` |
| `prune` alone | 6 / 3 | annotation marker deleted |
| `join` | 4 / 2 | Feet merged into Body; **Body's variant mappings dropped** while the root still declares variants |
| `optimize` (catalogue merge/meshopt route) | 4 / 2 | marker gone, Feet merged, **variant mapping moved from Body to Lid** |
| Part-preserving: `prune --keep-leaves true`, `dedup --meshes false`, `center` `a599c8b4` | 8 / 3 | all 7 source nodes keep indices 0–6, extras and correct variant attachment; `Pivot` appended as node 7 |

Caveat: the dedup misattribution needs meshes with identical geometry and default material — fixture-induced, but
realistic for repeated parts (feet, knobs). It suffices to falsify "prune/dedup is safe" for part retention.
Part-preserving index stability is shown for this fixture, not guaranteed generally; a recorded node map is still required.

### Admission matrix [O]

| Feature (fixture unless noted) | Observed in bytes | Loader exposes (three 0.186.1) | Biskiq evaluator | Bound / admitted |
| --- | --- | --- | --- | --- |
| Node parts / hierarchy | 7 nodes, 2 groups | Object3D tree; glTF node index only via `parser.associations`, **absent on the `SkeletonUtils.clone` that `cloneModelScene` uses** | renderer mounts whole clone | none: `SceneModelEntity` binds whole `assetId`; F.1 `componentId` → `missing` |
| Names | duplicate `Foot`; `Anchor.Dial`; root `Specimen` = scene name | renamed `Foot_1`, sanitized `AnchorDial`, `Specimen_1`; original kept only in `userData.name` | — | names are not locators even inside one revision |
| Empty marker + extras | yes | `userData` | none | none; deleted by repo prune |
| `KHR_materials_variants` | 2 variants, 2 mappings | raw JSON in `userData.gltfExtensions` only; variant materials never built (plugin not installed; loader docs list it as separately registered) | none; `remapModelMaterials` replaces **every** mesh's material (whole-asset) | none |
| Clip `LidOpen` 1 s | 1 channel n2.rotation | `AnimationClip`, track `LidHinge.quaternion` (bound by runtime name) | names to inspection only | none |
| Clock derivative (negative control) | flat 4 meshes, no clips/variants/empties | — | — | object-level only; must refuse part/clip/variant claims |

### Lifecycle and addressing traces [O]

`addressing.probe.ts` (research family `scene.part-emphasis@1`, exclusive, session scope, `qualifiedAddresses: true`):

```text
F1 instance-b → resolved; instance-b + componentId node:5 → failed/missing ("this unit authors no such component…")
DEFAULT host → rejected:unsupported-required-family   (no Scene family is admitted)
run-x@1 instance-b/node:5   → accepted
run-g@1 instance-b/node:999 → accepted   ← nonexistent part admitted: no component validation anywhere
run-z@1 instance-a/node:5   → accepted   (distinct instance scope; B does not leak to A)
run-y@1 instance-b/node:5   → rejected:competing-exclusive-contribution
run-x@2 → accepted; withdraw run-x@1 → ignored; re-offer run-x@1 → rejected:stale-run-epoch
withdraw run-x@2 → withdrawn; again → absent;  computed from older content → rejected:stale-contribution
resource revision change → envelope content changes → old contribution reads absent (no component correspondence check)
```

`lifecycle.probe.ts`:

```text
Guide-free Experience lowers: entryStopId null, stops 0, presentation content [t1]
enter → completed, effects [completed], panel null; companion lists p-object with stopIds []   ← cannot be shown
A enter → holding s1 (camera,panel,hold); tick 1000; cancel → cancelled; cancel again → ignored
B enter (new run) → holding; A late complete/continue → B: stale; A late complete → A: ignored
B tick 2000 → ready; continue → s2 occ run-b:s2:2; reset (same run) → s1 occ run-b:s1:1 (occurrence id reused)
B event under edited sourceContentId → stale
pre-reset late complete → B after reset: accepted, phase completed   ← same-run reset cannot fence old async work
Camera: acquire A; replace by B; cancel(A) → ignored:stale-run-epoch; cancel(B) → cancelled; again → cancelled;
        old A re-acquire → refused:stale-run-epoch; rebase with C held → rebased, ended run-c
```

### Corrections to initial findings

- **Piano specimen** in the step-1 table is the derivative; its source is `apps/editor/assets-source/models/grand-piano.glb` (`09627e34…`, 20 nodes, 3 groups). Every catalogue derivative is flattened, and the chandelier's one source clip is dropped — the step-1 "no animations" generalization holds only for derivatives.
- **F status prose is stale, confirmed against source:** F.3 "Current behavior: no general channel system is landed" — `inspection-v1` negotiation is family-generic (any `ChannelFamily` passed to `createChannelHost`), component-qualified and run-epoch fenced. Session-logic "no typed session declarations, reducer or expression evaluator exist" — the AM-6 interpreter has boolean/choice declarations, a deterministic reducer and bounded guards. Normative rules unaffected.
- **Common scaffolding claim confirmed, with two precise gaps:** F.3 never validates that an address's `componentId` exists (owner reference only); same-run interpreter `reset` keeps `runId`/`runEpoch`, so pre-reset completions are accepted afterwards.
- **Guide-free Presentation:** the companion lists Stop-less Presentations, but `ExperienceEvent` has no Presentation-entry event and `navigate` requires a Stop, so the landed interpreter cannot show one. Step 1's "lists Presentations with no Stop" was true but incomplete.
- **Material remap** in `instance-material-remap.ts` is whole-asset; no per-part override exists. Scene model entities reference a typed `asset` resource by id (closure check in `units/validate.ts`), with one revision per resource.
- **T3.P02 README/S01 plan** cite a "PR #154 P1 Interactive Presentation Studio prototype" in `prototypes/README.md`; PR #154 is docs-only and no such prototype exists there (intentionally, per owner). Stale reference for the lead.
- **No positive sample in `node_modules`:** none of the installed packages ships a variants/animated GLB; the installed `@gltf-transform/*` and `gltf-validator` sufficed to synthesize and validate one.

### D1–D4 after evidence

- **D1 → part retention on import. Resolved for planning: B**, refined. Retain immutable source bytes; produce the render derivative with a part-preserving recipe; record a compiled per-revision ingest report (observed nodes, hierarchy, extras, extensions, clips, variants — all "observed, not admitted"); admit components only by explicit creator/owner action. **Rejected: reuse of the P24A normalize recipe or catalogue optimize for creator import** — observed to delete markers, merge parts and misattribute capability. Strongest alternative A (flat static admission) remains acceptable as a *render derivative* only while source and recipe are retained. **New falsifier/fallback:** 5 of 8 real sources are single-mesh, so node-level parts are often absent; annotation targets must include an instance-local point/frame on the whole instance, not only components.
- **D2 → identity. Resolved for planning: B.** Opaque component IDs minted at admission, never reused, mapped per pinned resource revision to locators `{sourceNode, derivativeNode}`; F.1 reference = Scene entity + `componentId` (slot already exists and is correctly refused today). Names fail even within one revision (loader renaming/sanitizing). On revision replacement, correspondence is explicit evidence or the binding stays unresolved with repair. Falsifier unchanged (producer-verified source identity becomes correspondence evidence).
- **D3 → annotation ownership and three-context reuse. Provisional B, one owner call open.** Visitor-facing annotation text is **Experience-owned** (rule 2), targeting F.1-qualified instance/part/point; a Presentation groups annotations with Views and is reused standalone and by Stops; "within a Room" is the same instance framed by a View in a World with Layout — no Room subject or frame. Neutral part labels (component name) belong to the definition/resource component table. **Strongest alternative C** (typed explanation resource keyed to definition component IDs, so annotations follow every instance/project) is the answer if the owner means the annotations travel with the *object definition*. **Rejected A** (annotations as Scene instance state): duplicates visitor meaning into Scene and copies on duplication. Visibility during free exploration in a Room without an invoked Presentation needs the North Star's Experience-wide Interaction — not landed; deferred unless the owner requires it for the first consumer.
- **D4 → demoted; B stays provisional for later families.** The first consumer needs only show-annotation + Camera View, both landed paths (show-content, Cut, Camera tickets). When part emphasis/variants/clips arrive, F.3's generic negotiation already gives instance-distinct exclusive scopes and epoch fencing; the family's owner validator must resolve `componentId` through the component provider, and visitor Reset must start a new run (or the interpreter must fence same-run reset). C (statechart runtime) rejected as before.

### Minimal record sketches — UNRATIFIED, illustrative only

```ts
// AUTHORED — T2 definition/resource owner (inline project-local definition per Scene contract)
type ModelResourceRevision = {
  resourceId: string; revision: string;                 // revision = derivative content identity
  source: ResourcePin; derivative: ResourcePin;          // both retained; source never replaced by derivative
  recipe: { id: string; version: number; tool: string }; // e.g. part-preserving@1, gltf-transform 4.4.1
  components: readonly { componentId: string; label: string; locator: { sourceNode: number; derivativeNode: number } }[];
};
// COMPILED DERIVATIVE — reproducible from source bytes + recipe; never authored, may be cached
type IngestReport = { revision: string; structure: 'flat' | 'nodes-preserved';
  nodes: readonly { index: number; name: string | null; parent: number | null; mesh: boolean; extras: boolean }[];
  observed: { clips: readonly string[]; variants: readonly string[]; extensions: readonly string[] };
  admitted: { components: number; clips: 0; variants: 0 } };   // truthful: observed ≠ admitted
// AUTHORED — Experience (additive to Experience@1 via an AM-9-style amendment)
type ExperienceAnnotation = { id: string; text: string;
  target: SemanticReference;                              // scene entity, componentId string | null
  anchor: { kind: 'component' } | { kind: 'instance-point'; offsetMeters: [number, number, number] } };
type ExperiencePresentation = { id: string; label: string; viewId: string;
  subjects: readonly SemanticReference[]; annotationIds: readonly string[] };   // uses, never copies
// COMPILED DERIVATIVE — F.5 program content kind (generated locator allowed, rule 3)
type ProgramAnnotationRecord = { id: string; kind: 'annotation'; text: string; entityId: string; derivativeNode: number | null };
// SESSION — never serialized
type AnnotationProjection = { annotationId: string; runId: string; screen: [number, number] | null; occluded: boolean };
```

| Concern | Owner |
| --- | --- |
| Source/derivative bytes, recipe, ingest report, component table, part resolver, revision correspondence | T2 (Scene definition + typed resource) |
| Placed instance, instance-local frame, duplication semantics | Scene (T2) |
| Annotation text, target binding, Presentation grouping, Stop reuse, lowering | Experience (T3) |
| View capture/framing of a part | Camera (unchanged; no part-target evaluation) |
| Part pick → selection of a component-qualified subject | T1 Stage host (selection seam), via `DerivedSourceRef.subRef: component` |
| Projection, occlusion, DOM equivalent | runtime adapters (session), T3 visitor surface |

## Alternatives to decide with evidence

*(Step-1 tables preserved; step-2 verdicts are in [§D1–D4 after evidence](#d1d4-after-evidence).)*

### D1 — discovery and admission

| Alternative | Strength / cost / rejection test |
| --- | --- |
| A. Infer actions from names, separated meshes or AI descriptions | Fast first impression; cannot establish pivots, legality or continuity. Reject as execution authority. AI may propose a mapping for review, never silently manufacture capability. |
| B. Explicit capability manifest/adaptor per pinned resource revision, validated by its owning domain | Truthful supported/unsupported distinction; supports static files and native objects; preparation/adaptor work must be visible. **Provisional choice → selected for part retention**: separate observed file features (ingest report), admitted components and authored annotations. |
| C. Only certified source-authored semantic extensions | Strong portable author intent where present; excludes ordinary static imports and couples adoption to producer tooling. Useful optional input to B, not a prerequisite. |

**Falsifier for B:** if two realistic files require essentially arbitrary handwritten code per interaction, narrow the admitted family or choose certified packages for that family; do not disguise manual preparation as automatic ingest. Compare time and repair burden against a static text/View explanation. *Step 2: for part annotation no per-file code is needed; the binding falsifier is single-mesh assets, answered by instance-point anchors.*

### D2 — component identity and reusable roles

| Alternative | Strength / cost / rejection test |
| --- | --- |
| A. Exact resource revision + local node index/path | Honest within immutable bytes, cheap; all cross-re-export continuity unresolved. Viable initial locator, insufficient as reusable component identity. *Step 2: paths break under `center` (new root); indices survive only a part-preserving recipe.* |
| B. Definition-owned stable component IDs + explicit revision-pinned locator/correspondence map | Durable authored meaning, explicit repair after replacement; requires mapping provenance and non-reused IDs. **Selected for planning**; initially permit unresolved revisions instead of guessing correspondence. |
| C. Role names as target addresses, automatically matched on replacement | Convenient reuse; role collisions and renamed/repeated parts can silently retarget. Reject as identity. Retain typed roles only as reusable **requirements**, explicitly bound to B's concrete references. |

A role such as `inspectable-subject` declares required capability family/version, parameter/value/frame constraints and multiplicity. It is not an imported component ID. Binding validates compatibility, preserves explicit missing/incompatible results, and exposes shared versus this-use reach. One resource can satisfy different roles; two instances of one definition remain distinct qualified targets. *Roles are not needed by the re-centred first consumer.*

**Falsifier for B:** if source identity survives re-export reliably through a verified producer extension, use that as correspondence evidence rather than maintaining a competing ID source. If continuity cannot be proven, keep old bindings repairable and refuse execution.

### D3 — Presentation/content representation

| Alternative | Strength / cost / rejection test |
| --- | --- |
| A. Presentation embeds a new Scene or arbitrary page/component tree | Expressive but duplicates subject ownership and creates layout/scripting scope. No current first consumer justifies it. Reject giant embedded scene/page as the default model. Also reject annotations as Scene instance state. |
| B. Small Experience-owned offer/content records referencing external subjects/capabilities, rendered through screen/projected/3D adapters | Keeps semantic text independent of projection; finite grammar and predictable ownership. **Provisional choice**: annotation records with F.1 part/point targets, used by Presentations in three contexts. A projected label is not a new Scene object merely because it follows a subject. |
| C. Separate reusable typed UI/explanation resource immediately | Clear sharing/revision contracts; premature for one explanation. **Strongest alternative**: select if annotations must follow the object definition across instances/projects (owner call). Experience then holds uses/bindings, not copied Scene data. |

**Falsifier for B:** accepted P1 composition cannot be represented without exceptions that behave like arbitrary page layout. Identify the missing accepted behavior, compare a bounded additional record kind with C, and return only that design departure for decision. Do not translate the prototype DOM tree into source schema.

### D4 — event → typed action execution

| Alternative | Strength / cost / rejection test |
| --- | --- |
| A. Each control directly mutates Three objects and restores a saved whole-scene snapshot | Easy demo; bypasses channels and overwrites newer/unrelated state. Reject production use. |
| B. Existing Experience reducer dispatches bounded typed effects to domain-owned evaluators through F.3 | Reuses stale-event and Camera handoff guarantees (traced); adds only selected capability families and validators. **Provisional for later families**; not needed by the first consumer. |
| C. Adopt a broad workflow/statechart/visual scripting runtime | Handles complex independent behavior; adds language, effect, scheduling and debugging scope. Keep as comparator only. |

**Falsifier for B:** the accepted first consumer demonstrably requires independent persistent activity or a condition beyond current bounded operators. Record that exact trace and propose the missing operator/lifetime; do not widen all invocation semantics speculatively. *Step 2: no such trace for part annotation.*

## Proposed lifecycle to prove, not claim as landed

1. Resolve a pinned target, admitted capability and typed parameters before enabling an offer. A semantic `Activate` event names the offer, Presentation use and invocation; DOM, touch and 3D hit adapters produce the same event. Sliders/dragging require distinct typed value/commit/cancel semantics if the accepted task actually needs them.
2. Allocate a fresh activity/run epoch; acquire only its declared affected channels. Camera actions request canonical Camera output; component/material actions use their own owner evaluators. Same-channel exclusive conflict rejects unless that family explicitly defines replacement or composition; do not invent global last-writer-wins. *(Traced: landed.)*
3. Compute from the accepted effective instance baseline and active contributions. Define completion policy per family; cancellation/exit removes only that run's contributions. Reset exposes the current valid baseline plus remaining contributors, not a stale whole-scene snapshot. A runtime baseline is never a saved authored edit. *(Blocked: no baseline provider.)*
4. Every async completion/load/failure/cleanup checks source/resource revision, session, invocation and accepted epoch before applying. Removal, source revision change and Preview exit invalidate affected work. Old callbacks cannot clear or reclaim newer channels; cancellation must be idempotent. *(Traced: landed for runs/channels/Camera; gap for same-run reset.)*
5. Re-entry creates a new invocation even when the Presentation or Stop is reused. Keep invocation reset distinct from current interpreter same-run reset. If a source edit occurs during rehearsal, explicitly end/rebase the session before deriving another baseline; do not restore pre-edit authored values.
6. Give each 3D/projected action a labelled DOM equivalent, visible availability/reason, logical focus/return and state announcement. Occlusion or off-screen targets do not remove semantic access. Reduced motion preserves outcome via an owner-declared endpoint/discrete equivalent, not a faster animation. *(Deferred, Probe 6.)*

## Reproducible probes — step-2 disposition

Run probes in a disposable research harness outside production workspaces. Dispositions are in the
[ledger](#probe-disposition-ledger); this table keeps the original specifications for the deferred parts.

| Probe | Reproduction and discriminating result |
| --- | --- |
| Probe 0. Recover accepted P1 evidence | *Resolved by owner statement.* Original: record artifact path/revision and classify each action's mechanism. |
| Probe 1. Repeat current asset audit | *Executed* (`glb_audit.py`, all 15 tracked models). Decode with the actual loader separately; JSON counts alone establish no usable pivot. |
| Probe 2. Positive and negative capabilities | *Executed* with a synthesized fixture instead of a download; Khronos samples remain an optional external control. |
| Probe 3. Instance and revision addressing | *Bounded part executed.* Deferred: reorder/rename nodes, duplicate names, change units/root transform, remove a component, re-export and replace resource revision; assert A untouched, old identity never resolves by name/index/nearest; typed repair; Undo/reload in the production proof. |
| Probe 4. Invocation trace | *Executed* for interpreter, Camera tickets and a research channel family. |
| Probe 5. Baseline and async invalidation | *Async half executed;* baseline/variant/override blocked until a definition/override provider exists. |
| Probe 6. Input and projection | *Deferred.* Repeat the same offer with pointer, touch, Enter/Space and screen reader. Force occlusion, reframing, narrow viewport, failed target resolution, `pointercancel`, lost capture and reduced motion. Record one semantic activation per intent, clear cancel/no unintended commit, readable fallback, focus return and no required hover/drag. |
| Probe 7. Meaningful reuse and scope | *Deferred.* Reuse an explanation on a compatible second instance, then an incompatible asset; edit one use, then a shared binding; compare a conventional text/View explanation. |

## Handoff to the convergence lead

**Owning contract sections — amend or retain (do not edit from this packet):**

| Location | Gist |
| --- | --- |
| [Scene `#ratified-destination-not-shipped`](../../../docs/reference/components/scene-content.md#ratified-destination-not-shipped), "Resources, identity, and ingest" + "Open mechanism decisions" | **Retain**; amend to resolve component-identity mechanics for the first consumer: minted opaque component IDs in a definition-owned, revision-pinned component table; annotations are not Scene state. |
| [Assets `#ratified-destination-not-shipped`](../../../docs/reference/components/assets.md#ratified-destination-not-shipped) "Truthful ingest"; [`#model-preparation-and-validation-checklist`](../../../docs/reference/components/assets.md#model-preparation-and-validation-checklist) | **Retain** truthful ingest; amend: creator-import derivatives use a part-preserving recipe or record a source→derivative node map; the checklist's "merged" step and the P24A prune/dedup recipe are catalogue-only and evidenced as part-destroying. |
| [Camera contract](../../../docs/reference/components/camera-tour.md#one-authority) | **Retain**; no amendment: framing a part is ordinary View capture; no part-target Camera evaluation. |
| [F.1 `#f1-identity-and-reference`](../../../docs/reference/composition-execution.md#f1-identity-and-reference) | **Retain**; amend "Current implementation": unit resolvers refuse `componentId`; a Scene-entity component reference kind is the extension point the T2 provider fills. |
| [F.2 `#f2-persisted-units-and-the-project-envelope`](../../../docs/reference/composition-execution.md#f2-persisted-units-and-the-project-envelope) | Amend when consumed: model resource revision carries source + derivative pins, recipe and component table; Experience unit gains annotation records and Presentation subject/annotation uses (additive). |
| [F.3 `#f3-channels-and-representation-parameters`](../../../docs/reference/composition-execution.md#f3-channels-and-representation-parameters) | Correct stale "Current behavior"; add rule: a component-qualified family's owner validator must resolve `componentId` through the owner provider (negotiation alone admits dangling ids). |
| [Session logic `#session-state-and-declarative-logic`](../../../docs/reference/composition-execution.md#session-state-and-declarative-logic) | Correct stale "Current behavior" (AM-6 reducer/state/guards landed); add: visitor Reset of async work starts a new run/epoch. |
| [F.5 `#f5-release-envelope-and-program-slots`](../../../docs/reference/composition-execution.md#f5-release-envelope-and-program-slots) / [AM-6](../../../docs/reference/composition-execution.md#am-6-execution-program-and-visitor-profile-v1) | Later optional kinds: `annotation` content record with compiled locator; Presentation-entry (Stop-free) execution. |
| [PLATE §0.8.1](../../../docs/reference/design-system/editor-shell-and-visual-system.md#081-finalized-experience-shell-expression) "Information homes" Scene-subject row, "Scene subjects" | Amend: part-qualified subject selection and annotation through the Card ("deeper capability on invocation"); single-mesh objects show no part affordance. Retain Presentation definition. |
| [North Star `#composition-behavior-and-direction-model`](../../../docs/reference/north-star.md#composition-behavior-and-direction-model), [`#experience-lens--visitor-facing-composition`](../../../docs/reference/north-star.md#experience-lens--visitor-facing-composition) | **Retain** Subject ("supported component") and Guide-free Presentation; optionally add the owner's three-context statement as accepted direction. |

**Missing providers and dependency edges [I]:** (P-A) T2 model ingest: source + derivative pins, part-preserving
recipe, ingest report — *inside C2*. (P-B) T2 component admission + F.1 component resolver + revision
correspondence/repair (reuse F.4 `CorrespondenceEntry` vocabulary) — after C2. (P-C) T3 annotation records,
F.2 home, lowering to an F.5 kind — whole-instance/point targets need only C2 + S01's text home; part targets need
P-B. (P-D) T3 Presentation-entry run path (Stop-free Preview) — independent. (P-E) T1 selection seam for
component-qualified selection and a renderer node map surviving `cloneModelScene` — needed by P-B's UI. (P-F,
later) Scene part-emphasis/variant/clip families with component-resolving validators. Edges: C2 → P-B → P-C(part);
P-E → P-B UI; S01 text home → P-C; P-D ∥ all.

**Static K1 (C2):** capability research stays *not a prerequisite*, but C2 must **retain**, so part annotation is
not foreclosed: source bytes + hash; recipe id/version; a render derivative that does not prune empty leaves,
dedup meshes, join or flatten (or a recorded node map); a truthful ingest report marking parts/clips/variants as
observed-not-admitted; `SceneModelEntity` without name/index part fields; F.1 `componentId` left null. It must not
reuse `normalize-asset.sh` or the catalogue optimize unchanged. It need not mint components, build admission UI or
correspondence.

**Held T3.P02.S01:** **no new prerequisite.** Precise scope clarifications only: (1) if it persists Presentation
"subject/use", store an F.1 `SemanticReference` (component null), not a bare entity id; (2) if it drafts the
AM-9 Presentation-text home, keep whole-Presentation text as a closed v1 kind that a later `annotation` kind extends
additively — no part-name keys; (3) its plan must state whether Preview covers Stop-free Presentations: the landed
interpreter cannot show one (traced), so either Guide-only Preview or an added Presentation-entry path within its
own scope; (4) drop the stale "PR #154 prototype" citation. Part-qualified text targets are excluded from S01.

**Part annotation is a joint consumer:** T2 provider slice first, then a T3-led consumer. **Next slice to plan
(proposal):** owner T2 — "Admit and address parts of an imported model": from C2's retained source, list observed
nodes, admit/name two parts, select a part on Stage, duplicate the instance and Save/reload with component identity
intact, replace the revision and get explicit repair; single-mesh models offer none. Prerequisites: C2 landed with
the retention constraints, T1 component-selection seam. Then T3 "Part-annotated Presentation in three contexts"
(prerequisites: that slice, S01 text home + Presentation-entry Preview).

**Uncertainties:** owner call — per-instance (D3-B) or per-definition (D3-C) annotation reach; whether Room
free-exploration visibility is in the first consumer; dedup misattribution trigger is fixture-induced; loader
evidence is Node-side, not a rendered check; Probe 6 untested; re-export correspondence unexercised.

**Cross-seam notes.** *Capability identity/revision (RR-4):* one owner-qualified component identity
(definition-minted ID + revision-pinned locator) serves annotation targets and any part-hosted attachment; revision
replacement uses explicit correspondence in F.4's before/after vocabulary or leaves `UnresolvedBinding` repair, never
names. *Layout representation contributions (RR-1/2):* viewing an object "in a Room" may co-run Layout Plan/peel
contributions in the same F.3 negotiation; annotation projection reads their result for occlusion at runtime only;
annotation anchors are instance-local, never Room/level frames. (Note: `probes/vertical/` currently holds a Vite
`node_modules` cache.)

## Deliverables, pass/stop and amendment route

**Execution bound:** start with probes 1–2 (repeatable inventory audit and one positive capability fixture), then probes 4–6 for that family. Probe 0 bounds claims about the unavailable accepted prototype; it does not block existing Guide-free capture or a truthful new native fixture. Probes 3 and 7 open to the depth of the selected instance/reuse promise; do not implement general re-export correspondence or package distribution to prove one local binding. Return a precise missing interface when it decides the question rather than building its whole provider inside the research harness.

Deliver one decision packet containing (a) P1 evidence/provenance and capability inventory; (b) pinned asset/admission matrix and source→derivative loss report; (c) the four alternative decisions with falsifiers resolved or explicitly open; (d) minimal proposed records/types and domain ownership map; (e) deterministic lifecycle traces plus rendered/input/accessibility evidence; (f) exact contract/design deltas and first consuming slice proposal. A schema sketch must be labelled unratified and distinguish authored records, compiled derivatives and session state. *Step 2: (a)–(d), (f) and the deterministic half of (e) delivered above; rendered/input evidence deferred.*

Name exact North Star/design/architecture/domain/F sections to amend or retain, rejected alternatives
and remaining owner calls, missing provider/capability nodes and dependency edges, and the next slice
to plan. Distinguish consequences for static K1 admission and existing T3.P02.S01 from prerequisites
of richer interaction/reuse. The lead reconciles these with the other packets and folds the selected
owning-document amendments and canonical roadmap/DAG into this same PR. Researchers do not
independently ratify contracts or change registration/implementation authority.

**Pass to planning:** demonstrate one non-animation interaction or prove why the accepted first task specifically needs a supplied clip; truthful unsupported results; two-instance targeting; incompatible-revision repair; cancellation/re-entry/stale-callback safety; one shared semantic input path with DOM access; source unchanged by rehearsal; reuse without Scene/page cloning. Existing F/Camera guarantees are reused and only exact absent interfaces remain proposed. This enables owner review of amendments and production scope, not automatic authorization. *Step 2: passes for planning the T2 part-admission slice (truthful unsupported, two-instance targeting, stale safety, missing interfaces named); repair, DOM path and reuse remain consuming-slice acceptance, not research results.*

**Stop narrowly:** no truthful positive capability fixture (imported or native), unusable pivot, missing semantic provider, impossible correspondence or unproven lifecycle means that claim remains blocked. Identify the missing provider/API/fixture and preserve useful text/View/static work. If new independent clocks, arbitrary code, site layout, publication, libraries or the deferred P4 agent harness become necessary, record a scope decision rather than silently adding them. Unrelated proofs create no technical prerequisite for T3.P02; its owner hold still applies.

| Proposed amendment after evidence, only if needed | Owner / precise scope and risk |
| --- | --- |
| Truthful resource capability/component admission | T2 + resource-kind owner: pinned feature report, stable component IDs, locators/correspondence evidence, capability descriptors and validity; F.1/F.2 kind admission. Risk: treating a renderer node map as authored semantic authority or promising re-export continuity that was never proved. **Evidence now requires it for part annotation.** |
| Typed runtime action family and channel policy | Effect's domain owner + T3 invocation: parameters/results, target qualification, conflict operator, completion/reset/cancel policy and failure diagnostics; F.3 descriptor/operator amendment and bounded program action/profile extension if required. Camera's evaluator and ticket ownership remain sole authority. Risk: cleanup bypass, hidden interpolation or a second scheduler. **Not needed by the first consumer.** |
| Experience offer/content/binding records | T3: annotation records with F.1 targets, Presentation subject/annotation uses, shared-use scope and repair; F.2 authored home and F.5 lowering only where consumed. Do not turn deferred T4 delivery into this inquiry's prerequisite. Risk: Presentation absorbs Scene/resource state or becomes a general page model. |
| Reusable typed explanation interface | T3 + independently versioned resource owner, only after concrete reuse needs it (D3-C owner call): role requirements, explicit bindings, revision locks, local/shared edit reach and incompatibility. No parallel component identity scheme. Risk: premature packaging or automatic semantic matching. |
| PLATE interaction extension | Part-qualified selection/annotation placement, preview/return, selected identity and availability/repair states through PLATE conformance. Do not copy P1 chrome or silently create a third lens. Risk: rich permanent inspector inventory obscures ordinary composition. |

Research records alternatives and proposed deltas here. The combined reconciliation in PR #173 prepares
the owning contract/design amendments for explicit owner ratification before merge; registration,
implementation authorization and release from the hold remain distinct. This researcher commission
does not itself amend authoritative docs or production formats.

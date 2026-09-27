# Peer review: final northstar synthesis

**Folded into the final synthesis** → [`reference/decisions/northstar-ratification-2026-09-27.md`](./reference/decisions/northstar-ratification-2026-09-27.md); kept as the review as written — its findings are history, not current claims.

**Reviews:** [North-star-final-decision-synthesis.md](./North-star-final-decision-synthesis.md) (2026-09-27), checked against repository `96aca756`.

**Premise (owner):**

- P24–P26 plans and earlier accepted scope predate the redesign. They are evidence, not authority.
- Shipped code defines the cutover problem, not the ceiling.
- Tracks may run in parallel where neither depends on the other's correctness.
- The goal is compatibility by construction, not repeated reconciliation.

## Verdict

**Approve with corrections.** Ratify these as proposed:

- the product model;
- the three architectural decisions (§§5–7);
- the ownership table;
- Experience-owned occurrence order.

The corrections deal with authority, sequencing, and pre-redesign restrictions the synthesis carries into the new authority. They amend the core decisions rather than replace them.

- Apply **A1–A5** before ratification.
- Adopt **B1–B4** as ratified direction, each as a clause in the §8 text and the §10 register. Settle them before the A3 foundation contracts are written, because those contracts encode them.
- Everything else is planning work (**C**).

No further research or review cycle is needed.

Evaluated and not raised: **Camera connectivity.** `SceneConnection` edges and the multi-hop `getCameraRoute` (a breadth-first search over connections) already exist independently of the `nextNodeId`/`previousNodeId` order links ([scene.ts](../packages/project-model/src/scene.ts), [camera-route.ts](../packages/camera-core/src/camera-route.ts)). Moving order to Experience therefore needs no Camera redesign. The §2 facts I spot-checked are accurate.

## A. Correct before ratification

### A1. The synthesis re-installs pre-redesign plans as authorities

§9 and the handoff:

- keep the P24/P25/P26 plans "unchanged";
- preserve "P26's accepted spatial experience and the current execution sequence" and the accepted P25 minimum;
- adopt the pre-redesign pipeline (P23B → P26 → P24 → P25) as the progression.

AGENTS.md rule 10 gives future work to `roadmap/` and approved slice scope to active plans. Its only ratified-contract slot names the shell contract. Within those scopes, the old plans would therefore outrank the ratified synthesis that is meant to govern them. Pre-redesign restrictions then pass through without being re-examined:

| Carried restriction | Where | Replace with |
| --- | --- | --- |
| Contextual representation is editor-only | [P26 umbrella](./roadmap/p26-spatial-depth/2026-09-24-P26-continuous-spatial-authoring-umbrella.md) §3.1, §5 | A4 |
| One floor; "multi-storey/Levels" excluded | [layout-wall-first-types.ts](../packages/layout-core/src/layout-wall-first-types.ts); P26 §4 | B3 |
| No variables, expressions or generic conditions | [P25 umbrella](./roadmap/p25-experience/2026-09-08-P25-experience-foundation-umbrella.md) reject list | B1 |
| No user model import ("static-first") | [P24A annex](./roadmap/p24-scene-staging/2026-09-08-P24A-asset-supply-canonical-ingest-annex.md) Decision 2; synthesis §9 | Truthful single-model import inside the first creator→audience loop. §3 requires that "a creator importing one model should reach composition and direction immediately", and the trials need creators' own material. |
| One publication per project | P22 `publications` ([persistence](./reference/components/persistence.md)) | B2 |

**Correction.**

- On ratification, pre-redesign phase plans become evidence. Each phase is re-derived from the ratified destination before its planning resumes.
- Landed *behavior* is preserved, and only as a cutover obligation.
- The P23B baton continues by owner decision. It is operational work, not direction.
- In the same activation change, amend AGENTS.md rule 10 and the docs/README "Where truth lives" table:
  - the ratified direction is normative for all new design;
  - it outranks pre-ratification reference and roadmap text where they conflict;
  - landed contracts keep describing current behavior until their cutover.
- Give the decision record a routed home.

### A2. Restate hard rules as guarantees; release the mechanisms they freeze

For agents, AGENTS.md hard rules outrank docs. The handoff treats them generically and folds the sacred contracts into "reconcile … together". Several rules freeze today's mechanism as if it were the guarantee, so every new capability would force another amendment. The ratification record should carry this split:

| Rule | Keep (guarantee) | Release (replaceable) |
| --- | --- | --- |
| AGENTS 1 / Sacred 5: one nav + one motion, `camera-route.ts` + `camera-motion.ts` only | One Camera authority for connectivity, routes, framing, projection and evaluation. Nothing else interpolates pose or FOV. The shot vocabulary (travel, orbit, track, lens/focus, retimed invocation) grows inside it. Camera evaluates viewing intent; each profile's viewer controller (guided, free look, reduced motion, film, XR) realizes that intent through Camera. | File names; the curve/guard model; reading "one motion" as one motion kind |
| AGENTS 2 / Sacred 3: two domains; Layout v5 / Scene v1; Scene owns cameras | Distinct, never-merged authorities (Layout, Scene, Camera, Experience, typed resources). World-local coordinates. No mandatory Room frame. | Document count; format numbers; Camera stored inside Scene |
| AGENTS 3 / non-goal: no generated state persisted | Authored truth holds no generated, render or session state. Immutable, reproducible delivery derivatives are allowed outside it. Generated Camera endpoints are never authored. | — |
| AGENTS 6 / Sacred 4: no second graph or compiler | One canonical architectural compiler. Representation algorithms are Layout-owned. Kernel evaluation plans are derived dataflow, not a navigation graph or a compiler. | — |
| AGENTS 4 / Sacred 9: visitor isolation | Visitor chunks contain no editor code, session state or authoring infrastructure. | Achieving isolation by keeping domain evaluators editor-only (A4) |
| Sacred 11: Experience never creates sequences or edits camera timing | Experience references Camera views and routes and never duplicates poses or paths. It owns occurrences, order, holds and continuation. Retiming happens only through a declared time mapping that Camera evaluates. | — |
| Sacred 12: one project asset registry | One typed resource system with project and library scopes, revisions and locks. No store per mode. | Registry scoped to one project |
| Sacred 8: publishing uses the same project model | Publishing compiles accepted source into derived, versioned packages. The native project export stays a separate artifact. | — |

### A3. Write the foundation contracts first; they cannot "emerge"

§9 says to "extract common resolution only as actual consumers use it", and that P26's shared guarantees "should emerge from that work". The P26 plan already sketches its own `SourceRef`, its own `ViewRecipe`, and representation parameters that exist only in the editor session. Re-planned P24 and P25 work would each mint instance, Stop and content references. These are persisted or cross-domain formats:

- Machinery can grow one consumer at a time. Formats cannot, because every consumer that invents one creates exactly the pairwise reconciliation the synthesis warns against.
- The scope map introduces compound acceptance only at P27. If Experience gets its own unit, the Experience cutover already spans owners ("add Stop here" creates a Camera view and a Stop).

**Correction.** Add a third parallel obligation beside release durability and the trials: **F, the foundation contracts**. Write them after ratification and before any phase is re-planned. F is bounded contract-writing, not research:

1. **Identity and reference.**
   - References are qualified by domain, instance path and revision context. Names, indices and hierarchy paths are never identity.
   - Generated fragments are qualified by generation.
   - The scheme covers Layout levels, structures and instanced definitions (B3).
   - Public addresses name a publication or a pinned release, plus a semantic location keyed by durable identity. The location resolves unchanged across republish while its subject persists, and removal is reported explicitly. This replaces §4's "a deep link names a release".
2. **Persisted units.**
   - One codec-bounded, versioned unit per semantic domain, inside a project envelope that holds the accepted revision and the dependency lock.
   - Inline project-local resources keep the same identity they would have as library resources.
   - Decide Camera's unit here, before the Experience cutover: split from Scene, or co-located behind its own codec boundary.
3. **Channels and representation parameters.**
   - Addresses take the form `instance → component → capability/property → frame`, with typed values and units.
   - Inspection parameters (cut, depth, peel, lift, reveal) are typed values that channels can address.
4. **Compound acceptance.**
   - One expected revision, validation across all domains, one undo result.
   - First implemented with the Experience cutover.
5. **Release envelope.**
   - Manifest, closure, required-capability profiles, and program slots for occurrences and session state (B1).
   - Shaped for the destination from version one. Data from before the cutover lowers into it.

Each contract declares its extension points: reference kinds, channel families, program node kinds, session-state types and profile capabilities. Later capabilities then add to the contracts instead of revising them. §10's encoding choices stay implementation decisions; the shapes above are what gets ratified.

### A4. P26 representation must be a runtime-safe Layout evaluator, not editor code

The destination needs architectural representations driven by channels:

- visitor architectural reveals;
- separations driven by a presentation;
- explicit capture from inspection into presentation.

It also requires that editor preview use "that same lowering", and it forbids domain rules re-implemented for visitors only. P26, however, treats contextual derivation (section membership, peel and lift display maps) as editor-side: "contextual displacement remains editor-only", with recipes and presentation policy under the editor boundary. The synthesis asks only for "separable representation parameters" and calls visitor reveals new scope. Publishing a section or peel later would therefore mean either rebuilding P26's core outside the editor or re-implementing it for the runtime.

**Correction.**

- Representation evaluation (fragments, display maps and their inverses, validity) is Layout-owned, runtime-safe domain code. The F.3 values parameterize it.
- Only session UX stays in the editor: recipes and trail, handles, gizmos, pending gestures.
- Visitor isolation holds, because this is domain code, not editor code. No abstract framework is required.
- P26's `ViewRecipe` decomposes into future authored forms: a Camera view plus state contributions. Capture then becomes a validated copy.
- Shipping visitor reveals stays a later capability.

### A5. Split the compatibility baseline; no source-capsule bridge during the redesign

The north-star defines a single Compatibility Baseline. The synthesis separates source compatibility from release compatibility but never restates that baseline. §7 also lets the first durable release be "a versioned source capsule", with a compiled profile only once "visitor capabilities and measured delivery needs justify it".

The source schemas are about to churn: Experience, resources, levels, circular Walls, ceilings, profiles. A durable capsule would bind every such release to historical decoders and historical Layout compilers. `readPublicRelease` currently revalidates stored snapshots with whatever validator is deployed.

**Correction.**

- Split the baseline into two:
  - a **Release Baseline**, declared when external durability is needed;
  - a **Source Baseline**, ratified only after F's formats land.
- Until the Source Baseline, durable releases ship as a minimal prepared-visitor profile: lowered runtime data plus a closed manifest. A versioned release reader reads it, never the authoring validator. The existing world-space `RuntimeScene`/`RuntimeConnection` forms are a credible start.
- The first compiled profile is justified by decoupling, not by performance.
- Trial creators' projects get bounded, scripted migration as a documented pre-baseline exception.

## B. Establish in the ratified direction

### B1. Typed session state and declarative logic belong in the execution contract

The foundation lists references, capabilities, channels, dependencies, local time and lifecycle. Several things the synthesis promises need authored, typed session state and conditions:

- letting the visitor influence the next scene, or branch after a choice;
- configurator variants that must stay compatible;
- rejoining a guided path;
- deep-link session payloads, late join, and film input traces.

The pre-redesign P25 plan rejects variables, expressions and generic conditions, and the synthesis neither adopts nor replaces that rejection. Without a sanctioned tier, each feature invents its own conditions (Experience choices, Scene ambient bindings, variant rules), or pushes creators toward scripts. Unifying those later would reach into shipped links, sessions and package programs.

**Correction.**

- Add typed, serializable session state, declared per Experience or package with initial values and scope.
- Add a bounded, deterministic, side-effect-free expression form for guards, derived values and choice availability, evaluated by the kernel.
- Scripts remain the extension-module exception.
- Syntax and UI are planning decisions.

### B2. A project holds several Experiences over one world

The synthesis implies multiple tours, and Proof D1 has "two experiences", but it never states the cardinality or the publication unit. P22 keys one publication per project. A cutover that assumes a single Experience would fix identity scope, publication addressing, embed interfaces and UI around one Experience. A client review, a public version, a kiosk loop and a guided tour of the same world would then need duplicated projects, and a revision to the world would stop reaching all of them.

**Correction.**

- A project may contain multiple Experiences.
- Scene ambient bindings apply to every Experience; Experience invocations apply per Experience.
- A release is an accepted revision × selected Experience(s) × a delivery profile.
- Publication pointers are per published Experience.
- The UI may begin with one Experience.

### B3. Layout owns architectural multiplicity

The gap:

- Canonical Layout is "exactly one floor", and P26 excludes levels.
- The synthesis extends definitions, instances and revisions to objects, Camera and performances, but not to architecture.
- The north-star already lists multi-story and building/district work as deferred scope.
- The shell contract anticipates tours that cross floors.

P26 is about to fix Plan-as-cut, ceiling and slab meaning, Section, and the vertical schema on one floor datum. Adding levels or instanced architecture later would reopen the compiler, room reconciliation, representation contexts and every stored Wall or Opening reference.

**Correction.**

- Layout authority extends to multiple levels, placed structures, validated alternatives and reusable Layout-owned architectural definitions, all compiled canonically.
- F.1 qualifies Layout subjects to match.
- P26's vertical schema and Plan destination are made level-ready before its vertical slice.
- Multi-level authoring can ship later.

### B4. Name the audience-data lifetime and a residual ownership rule

Two gaps:

- **Audience data.** Review comments, approvals, saved visitor configurations, shared-session snapshots and outcome analytics persist, yet visitors never edit source. None of the four named lifetimes (inspection, authored intent, evaluated output, session state) fits. These records sit on the initial offer's loop: share with a client → feedback → revise → re-share.
- **Ownership.** The ownership table is a closed list. Environment and atmosphere, render settings, audio emitters, trigger zones, localization and data sources have no owner. The north-star rule against smuggling new domains into existing documents is not carried forward.

**Correction.**

- Add a persisted audience/collaboration lifetime:
  - held outside authored source;
  - keyed by F.1 public addresses plus release context;
  - carried forward by identity continuity, or reported as orphaned;
  - governed by its own retention and privacy policy.
- Add a residual ownership rule:
  - world presentation defaults to Scene;
  - visitor-facing content, localization and UI configuration default to Experience;
  - any other domain is admitted by declaring its authority, F.1 conformance, persisted unit, validation, channel families and operators, evaluator and lowering, effects, and conformance fixtures.

## C. Safe for capability planning (guard in brackets)

- Kernel implementation or substrate, invalidation granularity, caches, container encoding, and serialized Camera preparation [conform to F].
- Route policy between Stops: shortest path, authored via-connections, or cut.
- Moving `holdSeconds`, `lockInteraction` and `detourOfNodeId` off Camera nodes at the cutover.
- History and concurrency mechanism: compound snapshots, op-log or CRDT [add to §10's invariants that authoring operations are deterministic functions of the expected revision and a typed, serializable intent, so agents, audit, replay and later co-editing need no rewrite].
- Where release compilation runs [package provenance must be verifiable, not self-asserted, before the Release Baseline].
- Level mechanism, meaning expansion into host topology versus isolated structures, and slab/ceiling ownership.
- Channel operator defaults, interruption and media rules, the supported component and clip set, library tenancy and permissions, and device/XR profiles.

## Recommended sequence

```text
Ratify (A1–A5 applied; B1–B4 adopted)
→ F foundation contracts (A3)                        — every later step depends on these
→ parallel tracks, no mutual correctness dependency:
    T1 P26 re-derived: viewport/projection seam → runtime-safe representation (A4),
       level-ready vertical schema (B3)
    T2 Composition data: definitions, instances, resource revisions, truthful single-model import
    T3 Experience data: Experience units (B2), Stops/occurrences, order cutover,
       first compound acceptance
    T4 Release: prepared-visitor profile + versioned reader; Release Baseline when needed (A5)
    P23B performance work (independent; owner decision)
→ Composition/Experience authoring UI on T1's viewport seam (not on its later representation
  slices); T3's order cutover lands before T1 migrates Camera authoring adapters
→ Creator/audience trials on the minimal loop: import → place → direct → publish → revise → re-share
→ Source Baseline (F formats landed; T2/T3 stable)
→ P27–P30 re-derived from the ratified direction and trial evidence
```

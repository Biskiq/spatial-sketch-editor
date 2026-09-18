# AI-Native Spatial Authoring — Compact Reference (from deep-research-report.md)

> **Status (2026-09-06, preserved from source, authoritative over § Roadmap below).** Research snapshot. External/SOTA findings = reference evidence. Internal roadmap refs reflect repo state at research time and are **superseded by `docs/plans/README.md` + later owner decisions**, notably 2026-09-06 reconciliation (P23/P24 staged depth families; narrow P25 after useful minima; bounded agent/reuse proof after first complete vertical slice). Do not read superseded P22–P28 sequence/dates below as current.

## 1. Thesis / direction

- Do not compete on `prompt → 3D`; raw asset/world generation commoditizing (Meshy, Tripo, Rodin, World Labs; models cheaper monthly).
- Compete on: `prompt → structured spatial project → reusable primitives → validated experience → durable runtime → publish`.
- Durable product: **agent-native spatial experience platform where humans + AI compose typed spatial/camera/content/interaction primitives instead of generating bespoke Three.js apps**. Models + 3D generators = replaceable clients/suppliers. Durable layer = project schema + operations + validation + runtime.
- Analogy: Blender value to agents = mature object model, scene state, assets, operators, node systems, renderers, reusable Geometry Node groups (parameterized functions, themselves assets) — not raw geometry creation; agents operate it via Python API + official MCP work. Equivalent here = **experience primitives**.
- Target architecture:
  - `AI → inspect_project / create_room / place_asset / create_view / connect_views / create_guided_sequence / bind_interaction / validate / publish → semantic project → runtime → URL`
  - Not: `AI → write 8,000 lines Three.js → website`.
- Core inference: **as generative capability rises, value moves from creation → representation, orchestration, validation, execution**.
- Positioning: do not build another AI 3D generator; build place where AI-generated 3D becomes real project. Blender gives agents reusable language for making/manipulating 3D; this platform gives agents reusable language for turning 3D into experience. AI = intelligence; providers = meshes/worlds; platform = structure, operations, reuse, constraints, evaluation, execution.
- North-star stance (source): do not throw away north star; sharpen it; keep AI paragraph (human + agent share one semantic model); shift defensive ("remain useful in AI-heavy future") → offensive (agent-native authoring). Future call = "Build me a spatial product launch" → agent uses layout/staging/Camera Plan/Experience primitives + validators + runtime (see §7), not "write me a 3D site".

## 2. Executive findings (SOTA reality check)

- **One-shot 3D crossed important line (as of 2026-09-05).** Frontier agents: take rough intent, operate Blender/Three.js tooling, build editable scenes, inspect renders, fix mistakes, stage cameras, iterate to usable output.
  - Strongest case: OpenAI GPT-6 Astra workflow publ. 2026-09-04 — design brief → editable Blender architectural scene via Python API (architecture, furniture, materials, lighting, cameras) → preview-render inspection → intersection/composition repair → multi-shot camera tour (~30-sec walkthrough from 4 takes; specified eye height, focal lengths, easing, gaze targets; revised weak shots where framing lingered on blank walls / ended poorly). citeturn12search0turn15view0
  - Models: GPT-6 Astra positioned coding + computer-use; Claude Fable 5.1 coding + longer-running agent tasks; both connect models to creative software, not just emit instructions. Anthropic documented Blender official MCP for Claude (Python API; analyse scenes, batch changes, build tooling). citeturn12search0turn13search1turn13search0
- **Good results are not truly "one blind shot."** Astra arch example used: floor-plan step, iterative render inspection, geometry repair, existing Poly Haven assets for larger environment, explicit camera constraints, shot revision. Game example used: deterministic tests, named fixtures, browser instrumentation, render/state checks, performance counters. Playco workflow gives agents direct Unity/Godot access to edit/run/test/validate, not merely emit code. citeturn15view0turn15view1turn14view2
- Killed weak moat: "Camera staging hard, so Camera Plan itself AI-proof" — no; AI stages cameras already. citeturn15view0 Better moat: **Camera Plan turns generated camera intent into reusable, inspectable, editable, validated project state**.
- OpenAI Modeling Studio (browser): designed primarily for Codex via WebMCP — inspect running 3D scene; object/model/material/composition changes; Codex exercised tool surface to expose limitations. Close to recommended product architecture. citeturn14view1
- Game example lesson: Three.js app exposed debug API, named test scenes, state/performance counters, repeatable browser tests → reproduce → inspect → change → rerun/compare. Deterministic generation/maths/contracts via Vitest; browser behaviour via Playwright. citeturn15view1
- Playco reuse lesson: 3 themed prototypes from 1 common grey-box foundation, not from zero → **give AI tested foundation; mutate domain state, not regenerate infrastructure**. citeturn14view2
- Research convergence (biggest signal): **SOTA scene agents increasingly want structured state + tools + spatial facts + critics** — SceneAssistant (atomic ops + visual feedback), NaLA (geometric context: collision/support/containment), SAGE (generation vs semantic/visual/physical critics + iteration), Scenethesis (coarse semantic plan + visual refinement + physical optimisation), SceneOrchestra (predict tool-call sequences once vocabulary reliable), WorldClaw (planning → structured regions/terrain/assets/materials/relationships, explicit assets for edit/reuse). citeturn18search1turn18search3turn19search2turn19search10turn18search0turn19search0turn19search1
- Counterweight: VibeWorlding reports substantial failure rates on demanding world-building tasks; benchmark may evolve, but hero demos ≠ production reliability. citeturn18search12
- Social/practice split:
  - X: many Astra/Blender one-post one-shot claims (whole scenes from concept/reference; environments; walkable/camera-staged) — capability discovery, cherry-picked, not benchmarks. citeturn20search0turn20search3turn20search6turn20search9 AI filmmaking/previs pattern: Blender blocking + camera moves as stable structure before downstream generative video → camera plans/staging/semantic state become **control inputs to generative media**, not obsoleted. citeturn20search11turn20search12
  - Reddit (sceptical, useful): r/aigamedev Blender-tools-vs-text-to-mesh — editable geometry, UVs, scene state, spatial reasoning; generic agents often need custom tooling. citeturn20search1 r/aifilmmaking — write scene → block in Blender → lock camera/props/movement → render refs → hand stable refs to generative video (structure first, stochastic second). citeturn20search7 Claude/Blender MCP — better results after changing MCP/tooling layer → **agent performance depends heavily on tool-contract quality, not only base-model IQ** (anecdotal, strategically relevant). citeturn20search18
- Repo grounding (source inference): connected GitHub search found `toni8699/spatial-sketch-editor`; terminology matches (Spatial/Experience, Camera Plan, P21–P25, AI-heavy-future statement); treated as repo. fileciteturn12file0L1-L27 North star already: AI + human act on same semantic project model; AI results inspectable, editable, constrained, versionable, publishable. Strategically correct existing choices: 1 canonical asset ingest boundary; external generators as replaceable boundaries; Scene/Camera authoring split; camera graph + sequence as canonical spatial truth; eventual `Event → Target → Action`; project persistence; asset registry; shared runtime (not separate Spatial/Experience worlds). fileciteturn10file0L1-L2 Editor source imports camera timeline/flow logic; contracts reference extracted camera core. fileciteturn17file5L102-L113 fileciteturn17file8L163-L174

## 3. Key concepts / definitions (durable IR)

- Data primitives (formalized; compatible with existing north star; Experience references Spatial, never duplicates scene/camera truth; IR for human + agent clients). fileciteturn10file0L1-L2:
  - `Project`
    - `Spatial`
      - `Layout`: `Room`, `Wall`, `Opening`, `Surface`, `Level`
      - `Scene`: `Entity`, `AssetRef`, `Material`, `Light`, `Environment`
      - `Direction`: `View`, `Connection`, `Path`, `Sequence`, `ShotIntent`, `AttentionBeat`, `Cue`
    - `Experience`: `Destination`, `NavigationItem`, `Content`, `Interaction`, `VisitorPolicy`
    - `Assets`: `AssetRecord`
    - `Runtime`: `PublishConfig`
- Direction grammar: repo already treats camera graph = topology, sequence = primary guided traversal, future direction = `View / Shot → Transition → Attention Beat → Cue → optional Branch`. More useful to agents than keyframe array. fileciteturn10file0L1-L2
- Experience kits: small semantic bundles (Blender Node Group analog: parameterized logic surviving across projects), not giant templates. citeturn11search2turn11search4turn11search6
- Authoring Core topology (target, not current): `Editor UI ─┐ / Agent ─┼→ Authoring Core → Canonical Project / SDK ──┘`; rejected: `Editor UI → editor store internals` + `Agent → generated source / raw JSON hacks`.
- Rules: **Editor + AI are clients of same Authoring Core; neither owns truth.** Provider outputs enter via Asset Registry; provider never becomes project architecture. **AI never owns parallel truth** (Human UI / Agent API / Automation / Importers → same deterministic ops → same documents → same validation → same runtime). **When AI repeatedly generates same logic, turn it into reusable primitive** (orbit code → Product Orbit; hotspot handlers → Hotspot+Interaction; gallery nav → Guided Tour; room geometry → layout ops; loading/LOD → runtime; scene validators → validator API; normalization → ingest pipeline). Assisted work resolves into same inspectable/editable/constrained/versioned/publishable state; every mutation attributable, reversible, independently validatable. Product loop: `Describe → Plan → Compose → Direct → Validate → Preview → Publish → Refine`. Platform succeeds when agent prefers composing tested project over generating rendering/navigation/camera/interaction/publishing infra from scratch.

## 4. SOTA providers / infrastructure (replaceable supply)

| Tool / project | What agent gets | Maturity / terms | Integration | Strategic use |
|---|---|---|---|---|
| **Meshy** | Text/image/multi-image → 3D, remesh, topology options, textures, rigging/animation + other asset ops; official MCP wraps generation/status/download. citeturn17search0turn17search1turn17search19turn17search32 | Commercial production API | Low–medium | First provider behind Asset Registry. Never make Meshy concepts project truth. Draft→inspect→validate→refine→accept (Text-to-3D separates preview vs refinement). citeturn17search0 |
| **Tripo** | Text/image → model + texture, rig, animation, conversion; explicitly agent-oriented dev tooling. citeturn16search5 | Commercial API | Low–medium | 2nd provider to prove abstraction. |
| **Hyper3D Rodin** | Programmatic text/image-to-3D, generation/status/download, texture workflow. citeturn16search10turn16search14 | Commercial API | Low | Commodity asset source. |
| **World Labs Marble / World API** | Text/images/video/multiview → persistent explorable worlds; editing, expansion, combination, downstream exports. citeturn17search2turn17search3turn17search6 | Commercial world-model/API | Medium–high | Treat as environment/source asset. Do not make its representation product model. Bigger strategic threat to basic spatial editor; Marble persistent worlds from sparse input; Chisel = coarse blocking → refinement; staged create/edit, not 1 opaque call. citeturn17search3turn17search25turn17search31 |
| **Blender official MCP direction** | Model controls Blender/Python scene ops; inspect/debug creative work; generated-code security concern (Blender warns executing model code). citeturn13search0turn13search2 | Official experimental | Reference, not dependency | Shows agent-native DCC. Own API should be safer/more semantic than arbitrary Python. |
| **Three.js DevTools MCP** | 59 tools: live inspect/modify Three.js scenes — objects, materials, shaders, textures, animation, performance, memory; vanilla Three.js/R3F. fileciteturn18file0L1-L7 fileciteturn16file0L1-L6 | Community OSS, MIT | Medium | Observability/debug reference. Not product moat alone. Token-efficient workflows documented. |
| **SAGE** | Agentic generation/refinement with generators + critics (semantic plausibility / visual realism / physical stability). Apache-2.0. citeturn19search2turn19search10 fileciteturn21file0L1-L7 | Research + OSS | Research ref | Study critic/evaluator arch > generator. |
| **SceneAssistant** | NL editing via atomic ops (scaling/rotation/focus); visual feedback after ops. citeturn18search1 | Research repo; no root `LICENSE` found in inspection | Research ref | Evidence for atomic-op + render-feedback arch. |
| **WorldClaw** | Structured planning + explicit scene assets for edit/reuse; large-world generation. Paper/repo 2026-08-07. citeturn19search1 fileciteturn23file0L1-L7 | Very recent research | Research ref | Converges on structured spec vs opaque pixels. |
| World Labs Spark (open web-rendering) | Gaussian-splat/world representations integratable into Three.js/web. citeturn17search17turn17search33 | Open work | Watch | May become asset/environment format to consume, not replace. |

- Raw propositions: "Come manually build a 3D room on web" weakens; "Turn any generated world/assets into controllable, semantic, interactive, tested, publishable experience" strengthens.

## 5. Technical approaches (operations, facts, camera, kits)

### 5.1 Agent operation vocabulary (deterministic project ops; main interface)

| Domain | Operations (exact names preserved) |
|---|---|
| **Inspect** | `inspect_project`, `query_entities`, `inspect_entity`, `get_bounds`, `get_spatial_relations`, `get_camera_plan`, `get_runtime_stats` |
| **Layout** | `create_room`, `resize_room`, `add_wall`, `add_opening`, `set_surface`, `duplicate_structure` |
| **Scene** | `place_asset`, `set_transform`, `align`, `distribute`, `attach`, `group`, `lock`, `set_visibility`, `set_material`, `set_light` |
| **Assets** | `search_assets`, `generate_asset`, `ingest_asset`, `normalize_asset`, `replace_asset`, `create_lod`, `inspect_license` |
| **Camera** | `create_view`, `set_pose`, `set_target`, `set_lens`, `connect_views`, `set_path`, `set_duration`, `set_sequence`, `set_attention_subject` |
| **Experience** | `create_destination`, `add_navigation_item`, `create_content`, `bind_interaction`, `set_visitor_policy`, `attach_audio` |
| **Quality** | `validate_project`, `validate_layout`, `validate_camera_plan`, `validate_performance`, `render_preview`, `compare_preview` |
| **State** | `begin_transaction`, `preview_diff`, `commit`, `rollback`, `undo`, `redo`, `snapshot`, `restore_version` |
| **Delivery** | `preview_experience`, `publish`, `inspect_publish`, `unpublish` |

- Rejections: do not expose Svelte; do not expose Three.js object internals as primary API; do not tell agent to modify raw project JSON; do not make `executeJavaScript()` / `executePython()` main tool — those = escape hatches. Main = deterministic ops.
- Write-result contract:
```ts
type OperationResult<T> = { projectVersion: string; transactionId: string; affectedIds: string[]; result: T; warnings: ValidationIssue[]; errors: ValidationIssue[]; };
```
- Destructive-op preconditions e.g.:
```ts
moveEntity({ id: "sculpture-12", position: [4.2, 0, 8.1], expectedVersion: "v_147", constraints: { preserveFloorContact: true, avoidCollision: true } });
```
- Gives agents **bounded semantics** vs raw Blender Python (Blender MCP warns generated code executes without normal safety guards; raw power OK for experimentation, hosted projects need typed commands, ownership checks, validation, transactions, reversible diffs). citeturn13search2

### 5.2 Geometry / spatial fact tools (do not force inference from screenshots / giant JSON)

- Ops: `get_world_bounds(entity)`, `get_distance(a, b)`, `get_support_surface(entity)`, `get_visibility(camera, subject)`, `get_occlusion(camera, subject)`, `get_clearance(entity)`, `get_path_clearance(connection)`, `get_room_membership(entity)`, `get_nearest_surface(point)`.
- Rationale: NaLA + related work — agents improve with geometric context for collision/containment/support. citeturn18search3turn19search24 Enables e.g. "Put sculpture near east wall, but leave 1.5 m visitor clearance" without mental geometry.
- Validators/evals same philosophy outward: user projects need runtime validators; agent needs "Did me make good experience?" not just "Did schema parse?" — cf. research critics + OpenAI instrumented workflows. citeturn19search2turn18search0turn15view1 Observability: runtime should expose domain-level state/render/performance probes (cf. 59-tool DevTools MCP; named test scenes + state/perf probes). fileciteturn18file0L1-L7 citeturn15view1

### 5.3 Camera / direction grammar (strongest differentiated primitives)

```ts
type ShotIntent = "establish" | "approach" | "reveal" | "inspect" | "orbit" | "follow" | "rest" | "exit";
type Shot = { subjectIds: EntityId[]; intent: ShotIntent; durationRange?: [number, number]; lensRange?: [number, number]; eyeHeight?: number; minSubjectCoverage?: number; maxOcclusion?: number; motionProfile?: MotionProfile; attention?: AttentionBeat[]; cues?: Cue[]; };
```
- Flow: NL ("Slow reveal of piano. Start wide from doorway. Approach for four seconds. Stop with piano filling about half frame. Then orbit left and reveal portrait.") → AI builds **camera program** (not animation code) → human sees in Camera Plan → human moves node → runtime resolves → validator checks → Experience binds to cue. Stronger than "AI generated camera spline". Leverage = persistent semantic objects (Astra already invents eye height/lens/easing/ordering/gaze; persistence/reuse/modification is moat). citeturn15view0

### 5.4 Experience kits (composition after primitives)

- `Hero Reveal`: establish view; approach transition; subject visibility constraint; reveal cue; optional title interaction.
- `Museum Stop`: destination; inspection view; info card; next/previous navigation; reduced-motion fallback.
- `Product Orbit`: hero view; constrained orbit; hotspot set; CTA content; mobile fallback.
- `Guided Gallery Tour`: entrance; ordered destinations; camera sequence; narration cues; free-explore escape.
- Call shape: `instantiate("product-orbit", subject="car")` → modify 5 params. Compresses model work dramatically.
- Higher-value reuse example: `car-launch-showroom`, `car-hero-reveal`, `car-orbit`, `feature-hotspot`, `guided-product-tour` encode work above mesh layer (mesh `car GLB` alone insufficient).

## 6. Gap / moat analysis (repo at research time)

### 6.1 Already strategic assets

| Existing work | AI-era value |
|---|---|
| Portable project truth | AI operates durable model, not source code |
| Scene / Camera ownership split | Clear tool authority; agent knows domain ownership |
| Plan / 3D views | Same state manipulated abstractly + inspected visually |
| Camera graph + sequence | Ready-made semantic program for direction/navigation |
| Camera timeline / framing work | Becomes reusable shot grammar |
| Project persistence / version concepts | Mutations become transactions/versions |
| Project Asset Registry | Boundary for Meshy/Tripo/Rodin/etc. |
| Single geometry compiler | Author semantic architecture without mesh code |
| Visitor runtime direction | Output becomes product, not editor file |
| Future `Event → Target → Action` model | Compact tool vocabulary for agent interactions |

- Roadmap position then: P19 persistence shipped 2026-09-03; P20 asset registry/R2 shipped 2026-09-04; P21 shell/UI reconciliation in progress, P21.5/final acceptance remaining. Then P22 basic Publish + visitor runtime, P23 typed DB access, P24 Experience foundation, P25+ expansion. fileciteturn11file0L1-L10 Boring infra before agent layer largely built.

### 6.2 Missing (4 gaps)

1. **Public semantic operation boundary** — editor = main privileged client of state; need Authoring Core shared by Editor/Agent/SDK.
2. **Evaluation as product primitive** — tests strong (P21 closeout: Vitest/check/build/bundle, visual/accessibility gates fileciteturn11file0L1-L10); turn outward to runtime validators.
3. **Agent observability** — domain-level probes (see §5.2).
4. **Reusable compositions** — above assets (see §5.4).

### 6.3 Moat ranking (source author inference from evidence)

| Layer | Moat | Why |
|---|---|---|
| Raw text-to-3D | ★ | Commodity/API. citeturn17search0turn16search5 |
| Raw Three.js generation | ★ | Frontier coding agents capable. citeturn12search0turn14view1 |
| Generic transform editor | ★★ | Mature DCC/web owns it |
| Asset ingest / provenance / normalization | ★★★ | Needed durable infra |
| Semantic project schema | ★★★★★ | Stable language models target |
| Deterministic operation protocol | ★★★★★ | Models cheaper, safer, reliable, interchangeable |
| Camera / direction grammar | ★★★★★ | Reusable intent above keyframes |
| Experience primitives | ★★★★★ | World → visitor product |
| Validators / evals | ★★★★★ | Generation cheap; "works" valuable |
| Spatial runtime / publishing | ★★★★★ | Durable execution target |
| Reusable experience kits | ★★★★★ | Compounds across users/projects/models |

- Target mermaid (preserved structure): `Human Editor → Authoring Core ← Agent (Astra/Fable/future) via Agent Tool API (MCP/WebMCP/SDK)`; `Asset/World Providers (Meshy·Tripo·Rodin·Marble) → Project Asset Registry → Canonical Project Schema ↔ Authoring Core`; `Authoring Core ↔ Validators+Evals (geometry·camera·semantics·performance·accessibility)`; `Schema → Spatial Experience Runtime → Preview/Published URL`; `Runtime → Runtime Observability (state·render·performance) → Tool API`. Fits existing north star. fileciteturn12file0L8-L27

## 7. Product implications (north-star amendment + target UX)

- Proposed `docs/north-star.md` addition (source-drafted, date-stamped 2026-09-05/06 research; check currency before applying): **Agent-native authoring** — Museum Editor = web-native authoring system + runtime for spatial experiences, usable by humans + software agents via same semantic project model. Creator describes experience at high level; agent assembles/revises via typed spatial/asset/camera/content/interaction primitives. No bespoke Three.js regen, no duplicated editor state, no generated source as truth. Durable boundary = canonical representation + deterministic ops + reusable primitives + validation + runtime. Foundation models, asset/world generators, external DCC = replaceable clients/suppliers. Assisted work → same inspectable/editable/constrained/versioned/publishable state; mutations attributable/reversible/independently validatable. Loop `Describe → Plan → Compose → Direct → Validate → Preview → Publish → Refine`. Success = agent prefers composing tested project over generating equiv. infra from scratch.
- Test prompt (killer benchmark): "Build me a brutalist virtual car launch. Large concrete atrium at dusk. Black sports coupe on a low rotating plinth. Start with 8-second establishing approach, then hero reveal, slow left orbit, close inspection, then wide finish. Add four product hotspots, ambient sound, short feature cards, free-explore after guided tour. Must work on mobile and keep initial payload under project performance budget."
- Ideal agent plan (11 steps): 1. `create_project("car-launch")`; 2. `instantiate_layout("brutalist-atrium")` or semantic room/walls/openings; 3. search/generate car + furniture; 4. ingest via registry → normalize pivot → scale → provenance → optimization metadata; 5. stage scene → plinth → car → lights → environment; 6. Camera Plan → establish → approach → reveal → orbit → inspect → finish; 7. Experience → navigation → 4 content cards → hotspot interactions → audio → free-explore transition; 8. validate → collisions → clearances → subject visibility → camera clipping → path continuity → performance → missing assets → accessibility/reduced-motion; 9. preview; 10. repair failed constraints; 11. publish. Zero bespoke app code for normal case.
- Baseline vs platform: Baseline = Prompt → model writes Vite → installs Three.js → invents loaders → writes camera controller → writes interactions → writes responsive UI → writes asset paths → debugs runtime → deploys app. Platform = Prompt → 25–60 semantic tool calls → validated ProjectDocument → runtime → URL. Stronger models → 2nd system better.
- Agent transaction UX (not generic chatbot): e.g. `You: Make gallery more dramatic.` → Agent proposes Scene `~ GalleryKeyLight intensity 2.0 → 3.3; + RimLight; ~ Wall material roughness 0.72 → 0.60` / Camera `~ PianoReveal lens 35mm → 42mm; ~ PianoReveal target → Piano` / Experience `no changes` / Validation `✓ no camera collision; ✓ target visible; ✓ budget within limit` → `[Apply] [Review individually]`. Human+AI authoring, not vibe coding; AI output inspectable/editable/constrained, no parallel opaque state. fileciteturn12file0L8-L27
- Regeneration blast-radius demo: "Keep everything. Make tour slower and move sculpture 1 metre left." Bad = regenerates scene; good = `set_transition_duration(...)` + `set_transform(sculpture, ...)` — 2 ops.

## 8. Recommendations — prioritized roadmap (SUPERSEDED; see status header)

> Source sequence below is retained as historical evidence only. Effort ranges = planning estimates (1 experienced dev, current codebase, not greenfield), not measurements. P-number amendment advice + dates superseded.

| Work | Priority | Effort | Ship | Why now |
|---|---|---|---|---|
| Finish P21 | P0 | remaining slice | P21.5 + acceptance gates | Clean baseline; tracker already requires. fileciteturn11file0L1-L10 |
| P22 Publish + Spatial Runtime Contract | P0 | 5–8 wks | Versioned published snapshot; deterministic asset resolution; visitor runtime; runtime diagnostics; stable preview fixture API | Execution target for future agents; P22 = first stable execution contract, not just display |
| Semantic Authoring Operations | P0 | 6–10 wks | UI-independent command layer (Scene/Layout/Camera/Assets); transactions, preconditions, diffs, undo | Most important AI platform investment |
| Validator + Observability Core | P0 | 4–7 wks | Spatial facts, collisions, refs, camera visibility/clipping, route integrity, perf counters, screenshots/state probes | Close model loop. citeturn15view1turn19search2 |
| Experience Primitive Foundation | P0/P1 | 5–8 wks | Destination, NavigationItem, Content, Interaction, VisitorPolicy docs | Scene → reusable experience |
| Direction / Camera Primitive Kit | P1 | 4–6 wks | ShotIntent, AttentionBeat, Cue, templates, camera validators | Strongest existing domain agent-friendly |
| Agent API | P1 | 4–7 wks | MCP first; optional WebMCP/TS SDK; inspect → mutate → preview → validate → publish | Direct platform use |
| Provider Adapters | P1 | 2–4 wks each | Meshy first, then Tripo/Rodin; World Labs later | Commodity feeds asset boundary. citeturn17search1turn16search5 |
| Prompt → Project Planner | P1 | 5–8 wks | Intent decomposition → plan → ops → validate/refine loop | One-shot UX without one-shot arch |
| Experience Kits / Templates | P2 | 5–10 wks ongoing | Product reveal, museum stop, guided tour, gallery, spatial portfolio, showroom | Reuse compounds; fewer calls/tokens |
| Collaboration / marketplace / billing | P3 | Later | Team + commercial systems | After creation/runtime loop proves demand |

- Source P-number mapping advice: `P21 finish shell; P22 publish + runtime contract; P23 typed DB tightly bounded; P24 Experience foundation + define semantic primitive contracts; P25 Authoring Core / operation protocol; P26 Agent interface + validators; P27 Provider adapters + Prompt-to-Project; P28+ kits/sharing/teams/marketplace`. Do not casually renumber P23/P24 in docs (tracker P-number rules). Keep P23 narrow; do not let typed-DB redesign consume months while agent boundary absent; P23 valid plumbing, scheduled after P22. fileciteturn11file0L1-L10 Dependency note: agent-safe ops ideally start before full Experience; do design/extraction for Authoring Core during P22/P24 without exposing AI feature; MCP = thin client later.
- Source timeline: Sep 2026 Finish P21 (UI polish/acceptance) → Autumn 2026 P22 Publish (stable visitor runtime; state + perf probes) → Late 2026 Semantic Authoring Core (transactions/deterministic ops; geometry + camera validators) → Early 2027 Experience primitives (Navigation; Content; `Event → Target → Action`) → Early–Mid 2027 Agent interface (MCP/SDK; diff+preview+validate) → Mid 2027 Generator adapters (Meshy/Tripo/Rodin) + Prompt→structured planner → Later kits/community primitives/libraries/collab/marketplace. Mermaid `timeline` in source § Roadmap.
- Validation benchmark (explicit product benchmark; last targets = product goals, not current-performance claims; do not measure "Wow, pretty room"): fixed suite, e.g. 30 prompts — `museum gallery; product showroom; architectural tour; portfolio; history walkthrough; education room; interactive sculpture; car launch; fashion exhibition; small narrative world`.

| Metric | Initial target |
|---|---|
| Project decodes with zero schema errors | 100% |
| Tool command execution success, excl. upstream provider outage | ≥99% |
| All agent mutations as reversible transactions | 100% |
| Broken asset/entity refs after final validation | 0 |
| Camera topology/sequence invalid edges | 0 |
| Hard camera/geometry collision after validation | 0 |
| Required subject visible for intended shot samples | ≥95% |
| Published benchmark project loads without runtime error | 100% |
| Agent mutations with exact affected IDs + before/after diff | 100% |
| Standard experience requiring generated application JS | 0% target |
| Prompt revision changes only intended state (no rebuild) | >90% cases |
| Reuse rate from primitives/templates | Track upward; aim >60% standard |
| Agent token/tool cost vs greenfield Three.js baseline | Measure; target 3–10× lower total model work |

## 9. Risks / limitations / unresolved

- Generative supply commoditizes fast; manual-room-builder proposition weakens; provider representations must not leak into project truth.
- Hero demos ≠ reliability (VibeWorlding); social claims anecdotal; X timing/quality claims treat as anecdotal.
- Blender MCP power vs safety: generated code executes without normal guards — hosted projects need bounded semantics. citeturn13search2
- threejs-devtools reference useful but insufficient as moat.
- P23/P24 dependency ordering risk (ops needed before full Experience) — source proposes design/extraction during P22/P24.
- Licenses/terms to respect: threejs-devtools-mcp MIT; SAGE Apache-2.0; SceneAssistant no root LICENSE found in inspection; commercial APIs (Meshy/Tripo/Rodin/World Labs) production/commercial terms.

## 10. Watchlist + source/reference index

### 10.1 GitHub projects

- `DmitriyGolub/threejs-devtools-mcp` — most immediately useful arch ref; 59 live tools; token-efficient workflows; MIT; study granularity/discovery/perf/model-facing responses. fileciteturn18file0L1-L7
- `ahujasid/blender-mcp` — historical/community ref for rapid direct Blender-agent spread pre/alongside official MCP; compare broad Python power vs narrower semantic API. citeturn13search0turn13search2
- `ROUJINN/SceneAssistant` — atomic ops + visual-feedback loop. citeturn18search1
- `NVlabs/sage` — generator/critic arch + evaluation; Apache-2.0. citeturn19search2 fileciteturn21file0L1-L7
- `Tencent-Hunyuan/Hunyuan3D-WorldClaw` — 2026-08-07; structured planning for very large scenes; explicit reusable assets. fileciteturn23file0L1-L7
- Awesome 3D Scene Generation lists — track flood (text-to-scene, layout, physical staging, world gen) vs one-off papers. citeturn18search17

### 10.2 Papers / projects (why)

- SceneAssistant — atomic ops + render feedback. citeturn18search1 | NaLA — geometry-aware context (support/collision/containment). citeturn18search3 | SAGE — critics/validators first-class. citeturn19search2 | Scenethesis — semantic plan + physical optimisation. citeturn18search0 | SceneOrchestra — tool-call trajectories replace codegen once vocabulary good. citeturn19search0 | WorldClaw — prompt → structured spec + editable explicit assets. citeturn19search1 | VibeWorlding — reliability counterweight; test, not screenshots. citeturn18search12

### 10.3 Social / video

- X: `@anshuc` (Astra/Blender MCP experimentation; concept-to-Blender one-shot via Codex/Blender; anecdotal). citeturn20search0 `@andrewpprice` (Blender/AI commentary; AI-replaces-DCC vs DCC-as-infra). citeturn20search2 `@higgsfield_ai` + creators (3D previs → generative video; blocking/storyboarding vs final footage). citeturn20search11turn20search12 Builders posting env/character/scene agent experiments (frontier, not reliability benchmarks). citeturn20search3turn20search6turn20search9turn20search14
- Reddit: r/aigamedev Blender-tools-vs-text-to-mesh (editable state, clean geometry, stats, spatial reasoning, custom tooling). citeturn20search1 r/aifilmmaking blockout+AI-video (stable cameras/props/blocking as deterministic control). citeturn20search7 r/ClaudeAI Blender MCP/tooling (default MCP failures; custom tool design helps). citeturn20search18 r/blender AI discussions (correction cost, topology, predictability, time-saved counter-signal). citeturn20search10
- YouTube: Aidan Stanik "I Tested GPT-6 Astra In Blender" (hands-on frontier check, not launch copy). citeturn21search1 Building Aeon "Can Claude Fable Make AI Assets Game Ready?" (post-generation: heavy meshes, Blender cleanup; ingest/normalization gap). citeturn21search3 Long-form Blender MCP + Claude builds/tutorials (full sessions; corrections/structured-tool needs). citeturn21search7turn21search11 Official/developer Astra examples — arch-viz + game building overlap domain; agent testing patterns. citeturn15view0turn15view1

### 10.4 Saved search queries (run every few weeks)

- General (27): `"agentic 3D scene generation" tool calling`; `"editable 3D scene" LLM agent`; `"3D scene agent" MCP`; `"Three.js MCP" scene inspector`; `"WebMCP" Three.js`; `"Blender MCP" camera staging`; `"Blender MCP" scene generation`; `"AI previs" Blender camera`; `"AI video" Blender blockout camera`; `"camera blocking" generative video`; `"camera planning" multimodal agent`; `"3D layout agent" collision support containment`; `"scene graph" LLM spatial reasoning`; `"geometry-aware agent" 3D scene`; `"physical critic" 3D scene generation`; `"semantic 3D authoring" AI`; `"agentic spatial authoring"`; `"prompt to interactive 3D experience"`; `"prompt to Three.js world"`; `"spatial runtime" agent`; `"3D authoring schema" agent`; `"reusable scene primitives" AI`; `"text to world" editable objects`; `"world model" semantic objects editor`; `"AI 3D asset pipeline" retopology LOD`; `"3D agent validation" collision occlusion`; `"AI camera director" 3D`.
- Provider-specific (13): `Meshy MCP agent`; `Meshy API scene pipeline`; `Tripo MCP agent`; `Tripo CLI agent`; `Rodin API agent`; `World Labs API editable worlds`; `Marble Chisel scene`; `Gaussian splat Three.js Spark`; `Hunyuan WorldClaw`; `SceneAssistant 3D agent`; `SAGE scene generation`; `SceneOrchestra tool calling`; `NaLA 3D layout`.
- Watch signal: models increasingly prefer `structured scene spec + stable reusable tools + geometry queries + visual/state feedback + validators + runtime` — current evidence yes. citeturn15view0turn15view1turn18search1turn18search3turn19search0turn19search2

---

## Research Inventory

- Named projects/products/tools/models/companies: GPT-6 Astra; Claude Fable 5.1; Codex; Modeling Studio (OpenAI, WebMCP); Poly Haven; Meshy (+MCP); Tripo; Hyper3D Rodin; World Labs Marble / World API / Chisel / Spark; Blender (+official MCP, Python API); Playco agent bridge (Unity/Godot); Three.js DevTools MCP (`DmitriyGolub/threejs-devtools-mcp`); `ahujasid/blender-mcp`; SceneAssistant (`ROUJINN/SceneAssistant`); SAGE (`NVlabs/sage`); NaLA; Scenethesis; SceneOrchestra; WorldClaw (`Tencent-Hunyuan/Hunyuan3D-WorldClaw`); VibeWorlding; Awesome 3D Scene Generation lists; Three.js / R3F; Vite; `toni8699/spatial-sketch-editor`; X accounts `@anshuc`, `@andrewpprice`, `@higgsfield_ai`; YouTube Aidan Stanik, Building Aeon; Vitest; Playwright; Svelte (rejected as agent API); R2 (P20 asset registry).
- Source markers retained: cite `turn12search0 turn13search0/1/2 turn11search2/4/6/8 turn14view1/2 turn15view0/1 turn16search5/10/14 turn17search0/1/2/3/6/17/19/25/31/32/33 turn18search0/1/3/12/17 turn19search0/1/2/10/24 turn20search0/1/2/3/6/7/9/10/11/12/14/18 turn21search1/3/7/11 turn16file0 turn18file0 turn21file0 turn23file0`; filecite `turn10file0 L1-L2 turn11file0 L1-L10 turn12file0 L1-L27 + L8-L27 turn17file5 L102-L113 turn17file8 L163-L174 turn18file0 L1-L7 turn21file0 L1-L7 turn23file0 L1-L7`.
- Benchmarks/quantitative facts: 2026-09-04 Astra workflow; ~30-sec walkthrough, 4 takes; 2026-09-05 SOTA date; 59 DevTools MCP tools; WorldClaw 2026-08-07; P19 2026-09-03, P20 2026-09-04; efforts 5–8 / 6–10 / 4–7 / 5–8 / 4–6 / 4–7 / 2–4 each / 5–8 / 5–10 wks; moat ★–★★★★★; 30-prompt suite (10 named prompts); metric targets 100% / ≥99% / 0 / 0 / 0 / ≥95% / 100% / 100% / 0% / >90% / >60% / 3–10×; platform 25–60 tool calls; 8-sec establish; 4 hotspots; 1 m revision; UX deltas 2.0→3.3, 0.72→0.60, 35mm→42mm; ids `sculpture-12`, `v_147`, `[4.2,0,8.1]`.
- Unresolved / open: benchmark exact evolution (VibeWorlding); social-claim reliability; P23/P24 ordering dependency; typed-DB breadth risk; whether next-model prettiness vs structured-tool preference holds (source bets yes); commercial terms evolution; Spark/splat format support timing.
- Original-matrix → compact-section mapping: provider table (§4) → §4; existing-assets table (§6.1) → §6.1; moat table (§6.3) → §6.3; roadmap table (§8) → §8; benchmark metric table (§8) → §8; papers table (§10.2) → §10.2. Test-family → section: car-launch 11-step plan → §7; baseline-vs-platform → §7; blast-radius 2-op revision → §7; transaction-UX proposal → §7; primitives tree → §3; op vocab table → §5.1; geometry tools → §5.2; Shot/ShotIntent types → §5.3; kits (4) + car-reuse list → §5.4; mermaid arch + timeline → §6.3/§8 (structure preserved in prose); north-star draft + AI-never-parallel-truth rule + primitive-extraction examples → §3/§7.

## Loss Audit

- [x] every original section accounted for (exec summary; SOTA; providers; research convergence; social split; reuse/primitives/ops/facts/camera/kits; gap/assets/missing/moat/arch; north-star amendment + target UX; roadmap + benchmark + transaction UX; watchlist GitHub/papers/X/Reddit/YouTube/queries; closing)
- [x] every table/matrix dimension retained (provider rows keep offering+maturity+integration+use; moat rows keep stars+why; roadmap rows keep priority+effort+ship+why; benchmark rows keep metric+target; papers rows keep why)
- [x] every named project/tool retained (see inventory)
- [x] every source/link retained and attached to its claim (cite/filecite markers kept with owning statements)
- [x] every quantitative fact retained (see inventory)
- [x] every concrete fixture retained with inputs/outputs/invariants/edges (car-launch prompt + 11 steps; baseline 9 vs platform 4; blast-radius 2 ops; transaction UX with exact deltas/checks; `OperationResult`/`moveEntity`/`Shot` contracts)
- [x] every enumeration has member-level coverage; no umbrella substitution (primitive tree members; 9 op domains × members; 10 geometry tools; 8 ShotIntents + 8 Shot fields; 4 kits × members; 10 benchmark prompts; 13 metrics; 27+13 queries; all member values listed, not collapsed)
- [x] every protected token preserved or explicitly mapped (`inspect_project…unpublish`; `Room/Wall/Opening/Surface/Level`, `Entity/AssetRef/Material/Light/Environment`, `View/Connection/Path/Sequence/ShotIntent/AttentionBeat/Cue`, `Destination/NavigationItem/Content/Interaction/VisitorPolicy`, `AssetRecord/PublishConfig`; `establish/approach/reveal/inspect/orbit/follow/rest/exit`; `Event → Target → Action`; `create_project/instantiate_layout/set_transition_duration/set_transform`; kit IDs; file markers)
- [x] every rejection/defer decision retained (§5.1, §4, §6–§8)
- [x] every caveat + unresolved question retained (§9 + inventory)
- [x] no invented citations; no silent conclusion changes (source-only; roadmap supersession flagged; inferences labeled as source's)
- Field-level audit passes; all substantive source items accounted for; exact inputs/outputs/invariants preserved in compressed syntax.

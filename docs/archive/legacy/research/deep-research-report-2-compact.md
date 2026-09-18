# Deep Research Report 2 — Compact Reference (Re-assessing Museum Editor Uniqueness, Sep 2026)

## 1. Thesis / direction

- Verdict: mature Museum Editor still differentiable, but not via claims now commoditized: "AI-native 3D editor," MCP support, AI edits same scene as human, editable AI output, visual self-checking, browser 3D publishing, AI creates objects/materials/lights/cameras/interactions. citeturn12search4turn20search11turn20search0
- Corrected North Star (affirmed): advantage must come from accumulated reusable behaviour across composition/revision/validation/runtime/delivery; cheaper/more reliable than bespoke generation is a hypothesis to measure, not a moat claim. Architecture/product audit concurs: dependable revision + delivery across repeated projects > schema ownership; benchmark vs strong reusable-code baseline, not naive rebuild-Three.js-from-zero agent. fileciteturn3file0L2-L2 fileciteturn0file0
- Frontier moved toward product: GPT-6 Astra examples incl. modelling complete house in Blender → Unreal Engine walkthrough; Playco case connects Astra to Unity/Godot for scene edit + play/test + validate + iterate, reporting 50% fewer manual fixes vs preceding model on prototype workflow. Anthropic Fable 5.1 current flagship (coding/knowledge); community one-shots show Fable-class models compressing elaborate procedural Three.js worlds into single file. Reliability caveat: OpenAI 3D examples = vendor demos/customer cases; Fable worlds = community demos — "3D creation is hard for AI" untenable as strategy regardless. citeturn21search5turn21search3turn21search2turn14search1
- World generation moving upstream — assume world may arrive already generated: World Labs Marble (production World API: text/images/video → navigable worlds, web share, splat + GLB export); Google Genie 3 (controllable photorealistic worlds realtime 20–24 fps; Project Genie = experimental research product); Tencent HY-World 2.0 + WorldClaw (open/research prompt→navigable or agentically composed environments). citeturn11search5turn11search1turn21search14turn11search12turn11search10
- Reassessment: do not aim to be best AI 3D editor; aim to be best system for turning arbitrary spatial supply (drawn/imported/scanned/generated/agent-built) into structured, revisable, reusable, validated, published visitor experience. Centre of gravity: world creation → experience orchestration.
- Mature path: `prompt/brief → drawn/imported/generated world → semantic regions+anchors+assets → stage → direct camera+attention → visitor journey+content+interaction → validate → publish → observe → revise`.
- Editability + validation themselves commoditizing: MUSE preservation-aware local editing (99.9% preservation, 0.6% unintended changes on reported editing split); SceneAssistant atomic ops + rendered visual feedback; SceneTeract finds VLM semantic-confidence vs physical-feasibility mismatches (why deterministic geometric checks matter); CinemaTraj composes semantic camera motions + collision-avoidance optimization. Need coherent production workflow + reusable library + runtime contract + visitor-experience domain, not just semantic ops/camera primitives/validators. citeturn11academia38turn11academia36turn11academia37turn11academia39
- Competitive assessment: Spline = closest strategic competitor; PlayCanvas = strongest infra/developer competitor; Blender + frontier agents = strongest power-user alternative; one-shot Three.js agents = cost/flexibility baseline; world models = strongest threat to Build/Stage; Meshy + Tripo = partners not competitors.
- Scope: keep broad North Star — museums, exhibitions, architecture, historical walkthroughs, spatial portfolios, showrooms, education, interactive stories, related 3D-first experiences. fileciteturn3file0L2-L2 Sharpen common thread: not just 3D scenes; designed visitor experiences through spatial content.

## 2. Competitive landscape (strategic assessment, not vendor claims)

- Reliability legend: Production = currently shipping commercial/official capability; Official demo = first-party demo w/o broad reliability evidence; Experimental = explicitly experimental product/interface; Research = evaluated research not production product; Community demo = useful capability evidence, not dependable benchmark.

| Product | Reliability | AI adoption | Workflow uniqueness | Reusability | Integration | Vs one-shot | AI-proofability |
|---|---|---|---|---|---|---|---|
| Museum Editor mature target | Target, not current claim | Model-neutral agent, same semantic behaviour as human | Potentially high iff centred on Spatial→Direction→Visitor Experience, not generic 3D editing | Potentially very high via rooms, staging, direction, experience kits, runtime | Provider-neutral canonical ingest; external models/worlds/DCC upstream | Must win on revision/reuse/validation/publish, not first generation | Medium→High potential; unproven. Economic advantage = hypothesis. fileciteturn3file0L2-L2 |
| Spline V2 / Omma | Production editor; Omma beta | Very high: native Agent; same editor tools; screenshot inspection; MCP to external agents; agent authors custom code | Very broad 3D design, apps, games, event/state interactivity, code, web experiences | Strong: editable scene state, collaboration, community remixing | GLB/GLTF, web viewer, Code API, Three.js/R3F workflows, MCP | Strong: AI work stays editable/deployable, not throwaway | High. Closest threat; independently converged on much of agent-native thesis. citeturn12search4turn20search11turn20search7turn12search13turn12search3 |
| PlayCanvas | Production | Very high: MCP, vibe coding, Codex/Claude/Cursor, runtime verification | General browser 3D apps/games, AR/VR/configurators, not experience-specific authoring | Very strong: templates, assets, version control, collaboration, reusable engine | Open-source engine, npm, React/Web Components, glTF/USDZ, WebGPU, splats | Very strong: agent modifies real project, checkpoints, launches, screenshots, reads logs, injects controls | Very high. Generic breadth + agent tooling compounds with models. citeturn12search0turn12search1turn20search0 |
| Verge3D | Production | Native AI not prominent in reviewed first-party material | Strong DCC→interactive-web; 300+ Puzzles; configurators, e-learning, shops, AR/VR, games | Strong templates/Puzzles, cross-project reuse | Blender/3ds Max/Maya, WordPress/WooCommerce, SCORM, JS | Strong for DCC-resident teams (reusable web behaviour + deployment) | Medium–High. DCC bridge durable, though agents may automate same workflow. citeturn13search3turn13search7turn13search18 |
| Vectary | Production | AI image→3D in editor | No-code interactive product presentation, configurators, AR/VR | File cloning, collaboration, reusable projects | Browser import/edit/publish/embed | Moderate–strong for product presentation (integrated authoring+sharing) | Medium. Broader tools/models can reproduce. citeturn13search1turn13search5turn13search14 |
| Shapespark | Production | Little native AI emphasis | Extremely focused: arch model → lighting/material → POIs/tour → browser walkthrough | Good domain reuse: preserves viz settings on source-model update | Revit, SketchUp, 3ds Max + FBX/COLLADA/OBJ; one-click web share/embed | Strong in archviz (avoids rebuilding runtime/lighting) | Medium. Narrow specialization helps; generated worlds + agentic DCC threaten manual parts. citeturn12search2 |
| Meshy | Production | Very high: proprietary Meshy models, conversational 3D Agent, REST API, MCP; current API: generation, remesh/retexture/rig/animation | Asset generation, not spatial-experience authoring | Assets reusable; workflow reuse at asset-processing level | Excellent: GLB/FBX/OBJ/STL/USDZ/3MF, REST + MCP | Meshy *is* asset supply; removes reason to own mesh generation | Medium. Valuable upstream supplier; generation quality commoditized. citeturn20search1turn20search6turn20search5 |
| Tripo | Production | High: text/image/multi-image generation, texturing, processing, rigging/animation; SDK/ComfyUI + MCP ecosystem | Asset-generation pipeline, not experience system | Reusable generated assets + automated processing | Strong APIs/SDKs, ComfyUI, Blender-facing tooling, standard model workflows | Same as Meshy: supply increasingly cheap/programmatic | Medium. Integration candidate; weak reason to compete. citeturn5search15turn5search4turn5search2turn5search1 |
| Blender + official MCP + frontier agent | Blender production; MCP experimental | External model drives Blender Python API via MCP; server itself contains no LLM | Extremely broad DCC: geometry, procedural systems, materials, animation, rendering, asset ecosystem | Extremely high via .blend, assets, Geometry Nodes, scripts, libraries | Python, huge format/tool ecosystem, MCP | Very strong once Astra/Fable-class manipulate it: real editable DCC state vs bespoke web code | Very high. Operators improve agent usefulness as models improve. Do not compete head-on. citeturn6search0turn6search3turn6search8turn21search5 |
| GPT-6 Astra / Claude Fable + Three.js starter | Models production/rolling out; individual 3D examples often demos | Model *is* agent; codes, uses computers/tools | Essentially unlimited (generates custom software) | Increasing via skills, starters, component libraries, model memory/context | Maximum code-level interop | This *is* one-shot baseline. Astra demos Blender→UE5 + Playco engine editing; Fable one-shot Three.js demos impressive | Very high + improving. "Saving tokens" alone cannot be moat. citeturn21search5turn21search3turn21search2turn14search1 |
| World Labs Marble / Google Genie / HY-World | Marble/API production; Genie experimental; Hunyuan mixed OSS/research | Specialized world models, not conventional editor agents | Prompt/image/video → navigable world; increasingly direct world creation | Reusable as world/output more than fine semantic authoring | Marble exports splats/GLB + API; Hunyuan releases models/code; Genie more closed research | Very strong at environment creation; can skip much of Build/Stage | High, esp. if semantic object editing/interactions/deployment keep improving. citeturn11search5turn11search1turn21search14turn11search12 |
| SceneAssistant / MUSE / WorldClaw / Gizmo-class OSS | Research / early OSS | Agent-native by design: atomic ops, visual feedback, memory, verification, MCP | Scene generation/editing, not polished end-user product | Increasingly strong: structured state/commands, preservation-aware edits | Often Blender, Three.js, MCP, model/provider composition | Shows structured-ops + visual-critique + editable-state becoming commonplace | High directional threat, low current product maturity. Tells where infra heads. citeturn11academia36turn11academia38turn14search2turn14search3 |

### Spline — competitor changing answer most
- Spline V2 warning vs "human+AI share one semantic editor" as uniqueness: AI Agent builds/edits via Spline's own editor commands; edits enter normal undo history, sync to collaborators, human continues immediately. Agent manipulates objects, materials, lights, cameras, booleans, particles, cloners, lathes, sky, variables, events, states; takes screenshots while working. MCP server lets Codex/Claude/Cursor/other MCP clients operate live desktop editor. citeturn20search11turn12search4turn20search7
- Beyond "3D scene designer": Code tab stores HTML/CSS/JavaScript with scene for custom UI/behaviours, AI Agent authors that code; Viewer + Code APIs connect scenes to websites; Omma beta orchestrates code/image/3D agents to build interactive apps/games, publish to live URLs. So 3D+interaction+web UI+AI+deployment insufficient for differentiation. citeturn12search13turn12search9turn12search12turn12search3
- Opening: Spline = deliberately general creative software. Museum Editor specializes richer concept than "event happens to object": visitor location, what they should notice, content belonging at spatial moment, navigation, camera direction supporting journey, branch/rejoin behaviour, whole-experience deliverability. Inference from Spline broad feature model + Museum Editor North Star, not claim Spline cannot reproduce such projects. citeturn12search14turn12search13 fileciteturn3file0L2-L2

### PlayCanvas — harder infra benchmark
- Covers eventual "agent authoring platform" at engineering level. MCP docs recommend: read-only inspection first; checkpoint before changes; observable outcome-oriented instructions; viewport capture; launching actual app; reading runtime logs/state; injecting keyboard/mouse/touch; restoring checkpoints on failure. Agent touches entities, components, scripts, assets, scenes, settings, templates, animation, builds, version-control state. citeturn20search0
- Do not compete as smaller generic engine. Target request: "Create six-stop architectural story. Reveal atrium, let visitors inspect three objects, show contextual info at each stop, optional branch into archive room, preserve reduced-motion behaviour, then publish." System resolves into domain-level project state without user/agent designing general app architecture. Domain product vs engine distinction.

### One-shot baseline vs reliability benchmark
- Fable community repo: single prompt → entire procedural island as one ~75 KB `index.html` (terrain, water, vegetation, animals, seasons). Author contrasts one-shot vs much larger iteratively engineered version; latter deeper on nearly every axis. Lesson: one-shot = extraordinary breadth; repeated engineering still buys depth/maintainability. citeturn14search1
- Browser WorldClaw reimplementation: one prompt → live walkable editable Three.js world in minutes for ~US$0.50 fal.ai credits. Gizmo: Three.js/Rapier engine, serialized worlds, CLI, screenshot workflow, MCP commands to coding agents. Both early community OSS, demonstrate cheaply recreatable "agent-native 3D substrate." citeturn14search3turn14search2
- Social/video = low weight: June X demo (mirrored by Digg) of Fable 5 producing working Swiss-lever watch movement in Three.js while visually checking output; September YouTube hands-on (via AI/TLDR) of Astra agent working ~12.5 hours on 3D world. Frontier signals only; demo/anecdotal, not completion-rate or production-cost benchmarks. citeturn16search11turn16search4
- Reddit = ecosystem signal only: current r/threejs threads show polished browser-native experiences; Reddit Devvit ecosystem includes AI agents routinely building/publishing games into Reddit posts; neither proves AI reliably satisfies arbitrary Museum Editor-class briefs. citeturn18search5turn18search0

## 3. Differentiation: structured spatial-experience system

- Shift centre: "structured 3D editor" → "structured spatial-experience system."

### 3a. Own visitor-experience semantics, not generic interactivity
- Generic `click → do something` = losing scope battle: Spline (events, states, arbitrary code); PlayCanvas (general component/script engine); Verge3D (300+ visual Puzzles: app logic, e-commerce, media, physics, e-learning). citeturn12search13turn20search0turn13search3
- Experience layer: high-level visitor semantics where concepts understand each other:
- `World/Region → Destination → Stop/Beat → Shot/Transition/Attention → Content → Event→Target→Action → Branch/Rejoin/Free explore → Completion/continuation`.
- "Museum stop" ≠ arbitrary object + JS: knows destination, camera/free-explore presentation, associated content, interaction target, accessibility behaviour, next/rejoin semantics. Agent instantiates known-good stop in one op; human inspects/changes constituents normally.
- Camera: automation commoditizing (CinemaTraj: LLM composes atomic dolly/orbit/crane/pan/tilt/zoom/arc moves from structured scene graph + optimizes for collision avoidance; OpenAI Blender example shows frontier models authoring cameras). Opportunity ≠ camera paths; camera direction as participant in larger visitor-experience grammar. citeturn11academia39turn21search5

### 3b. Generated worlds as input, not existential threat
- North Star already allows imported spaces; Build/Stage/Direct/Experience complementary, not mandatory sequence — more important given Marble/Genie/Hunyuan/agentically assembled worlds. fileciteturn3file0L2-L2 World Labs exposes world generation programmatically, exports high-quality GLBs, collider meshes, splats; high-quality meshes large (~600k triangles with textures; ~1M vertices/triangles in another variant) → downstream normalization + web optimization = obvious integration role. citeturn11search5turn11search1turn11search7
- Broaden semantic model beyond authored rooms. Keep `Room` as architectural primitive; add future Semantic Spatial Overlay: `Region; Surface; Anchor; Portal; Support surface; Subject; Destination`.
- Generated Marble/Hunyuan/Blender environment enters as world asset → acquires lightweight semantics without reconstructing whole mesh as `LayoutDocument` walls.
- Flow: `World Labs/Blender/imported GLB/splat → canonical world ingest → semantic spatial overlay (Region/Surface/Anchor/POI) → Stage+Camera+Experience → validation+publish`. World models = suppliers, not substitutes, whenever customer needs directed, content-rich, revisable web experience.

### 3c. Revision as first-class product contract
- "Editable AI output" = table stakes: Spline agent edits normal file + ordinary undo history; PlayCanvas checkpoints/version control around MCP changes; MUSE research shows localizable preservation-aware scene editing improved algorithmically. citeturn20search11turn20search0turn11academia38
- Differentiate via semantic revision contract: request ("make Stop 4 darker, replace sculpture, make reveal slower, do not change any other stop") → planned affected state (Scene: lights 12, 14 + entity 88; Camera: connection 5; Experience: unchanged) → candidate → domain validation → semantic diff → one atomic revision → runtime validation.
- Human/agent UI must answer: What did request change? What intentionally preserved? Which downstream references affected? Did visitor path / content binding / camera destination break? Can previous published revision be restored?
- General agents increasingly good at this themselves; product advantage = cheap + deterministic because domain already knows project meaning.

### 3d. Reuse = complete experience kits
- Raw mesh abundant; single preset easy to generate. Stronger unit = tested combination of semantics.
- Gallery stop kit: display wall / pedestal arrangement; lighting setup; subject anchor; camera reveal; info panel; reach/click behaviour; reduced-motion alternative; validation rules.
- Product reveal kit: product placement; lighting rig; hero shot; orbit / inspection shot; feature hotspots; specification content; CTA; mobile behaviour.
- Architectural tour segment: destination; approach camera; establishing shot; optional free-explore zone; contextual media; rejoin point.
- More strategic than hundreds of CAD commands: strong model customizes small number of composable kits more effectively than giant narrow-UI-tool collection.
- Ecosystem points same way: Three.js "skills" package performant setup/asset handling/common patterns so agents skip boilerplate; Gizmo packages serialized runtime + commands/MCP; Spline community remixing. Reuse = key battlefield, not unique idea; Museum Editor specializes reuse at whole spatial-experience level. citeturn14search12turn14search2turn12search3

### 3e. Spatial-experience validation, not validation in general
- Generic verification = standard agent infra: PlayCanvas lets AI launch app, inspect viewport, read logs, query state, inject controls. WebMCP frames structured tools as improving agent speed/reliability/precision; Google WebMCP docs require evals verifying agents choose/execute tools correctly. citeturn20search0turn21search1turn21search18
- Differentiate on what spatial visitor experience must satisfy:

| Check | Why |
|---|---|
| Destination reachable | Visitor journey correctness |
| Tour branch can rejoin | Experience graph correctness |
| Camera transition intersects architecture | Spatial-direction correctness |
| Named subject visible at attention beat | Direction/content correctness |
| Content references valid asset/entity | Experience integrity |
| Deleted entity still referenced by action | Semantic project integrity |
| Free-explore area has safe/reasonable bounds | Visitor behaviour |
| Reduced-motion alternative exists | Accessibility |
| Keyboard/touch path works | Delivery quality |
| Published asset closure complete | Runtime correctness |
| Declared project performance budget passes | Web delivery |
| External asset provenance/attribution complete | Publication safety |

- SceneTeract: systematic VLM semantic-confidence vs physical/geometric-feasibility mismatches even for strong models → value of deterministic spatial checks over trusting agent self-assessment. citeturn11academia37

### 3f. Post-publish feedback loop (mature differentiator; not pre-core-model work)
- Runtime understanding destinations/stops/branches/content/interactions enables observing anonymous product-level facts: visitor entered Stop A; skipped branch B; repeatedly backed out of transition C; content panel D never opened; mobile users abandoned before Stop E.
- Feeds human/agent recommendations: "Most mobile visitors leave during this 14-second transition." / "Secondary branch has 8% completion rate." / "This information card rarely opened." / "Shorter camera route would preserve all mandatory content."
- Mature polished product only; visitor-outcome data potentially more defensible than another generation feature (links authoring to real effectiveness). Strategic inference, not claim competitors cannot implement analytics.

## 4. Integration / non-competition strategy

- Resilient architecture benefits from every external AI advance rather than fighting it.

| External | Relationship | Consume | Not build |
|---|---|---|---|
| Meshy | Primary upstream asset adapter candidate | Text/image-generated GLB, normalized size/origin, textures, remesh, rig/animation metadata; provenance | Proprietary generic text-to-mesh model (exposes generation/post-processing via REST+MCP). citeturn20search6turn20search5 |
| Tripo | Primary/alternative asset adapter | Image/text/multi-image assets, optimized variants, rig/animation outputs | Parallel internal generation stack (exposes APIs/SDK/ComfyUI-style surfaces). citeturn5search15turn5search4turn5search2 |
| Blender | Upstream DCC / repair / advanced authoring | GLB/glTF, eventually metadata-friendly round trips where practical | Sculpting, retopo, UVs, general procedural modelling, animation workbench. MCP direction makes it more valuable upstream. citeturn6search0turn6search3 |
| World Labs Marble | World/environment provider | World exports, GLB/collider, possibly splat representations, camera/source metadata | Foundation world model (World API already programmable). citeturn11search5turn11search1 |
| Hunyuan / other open world models | Optional world-generation adapters | World/mesh/GS representations after normalization | Internal world-generation research programme. citeturn11search12turn11search6 |
| OpenAI / Anthropic / Google models | Replaceable authoring clients | Semantic authoring ops, inspection, validation, visual critique | Proprietary general planner prerequisite; frontier changes too fast to encode provider assumptions into project truth. citeturn21search5turn21search2turn21search14 |
| MCP | Agent transport adapter | Project inspection + semantic ops | MCP-specific domain design. Spline/PlayCanvas/Meshy/Blender show MCP = transport/table stakes. citeturn20search7turn20search0turn20search6turn6search0 |
| WebMCP | Future browser-local transport option | Safe contextual actions where browser-native agent access helps | Project semantics depending on still-evolving browser API; as of Sep 2026 Imperative API remains origin-trial/intent-to-experiment. citeturn21search6turn21search1 |
| Three.js ecosystem | Underlying ecosystem + export/integration surface | Standard runtime concepts, GLTF tooling, developer embed/extension possibilities | Generic Three.js app builder as core product; agent skills make generic generation cheaper. citeturn14search12turn14search5 |
| Spline / PlayCanvas | Benchmark first; interop only on demand | Standard assets/files if customers bring them | Feature-parity chase; breadth = reason to specialize, not duplicate. citeturn12search4turn20search0 |

- Boundary: `UPSTREAM SUPPLY (Meshy/Tripo/Blender/Marble/future generators) → canonical ingest → MUSEUM EDITOR PROJECT (spatial semantics; staging; direction; visitor experience; reusable kits; validation) → visitor runtime → publish`. Deliberately agnostic about how chair/building/landscape created once canonical metadata suffices.
- Provider capability churn > schema churn: Meshy API added real-world auto-sizing + origin placement, currently exposes Meshy-6/latest generation; World Labs expanded export + coordinate-system compatibility; external capability keeps changing faster than project schema should. citeturn20search5turn11search0

### What not to compete on (mature product resists)
- Mesh topology / sculpting / UV / rig-authoring: Blender + specialized AI+DCC have structural advantage; experimental MCP gives external agents access to enormous Python-authoring surface. citeturn6search0turn6search3
- Raw 3D generation: Meshy/Tripo/general models/world models already provide via APIs/SDKs/agent surfaces. citeturn20search6turn5search15turn11search5
- General-purpose browser games/apps: PlayCanvas + generated Three.js apps occupy with greater programming freedom. citeturn12search0turn21search3
- Generic no-code interaction programming: Verge3D 300+ Puzzles + Spline events/states/code show depth of rabbit hole; provide behaviour vocabulary for spatial experiences + extension boundary later, not universal scripting. citeturn13search3turn12search13
- Generic AI orchestration: WebMCP/MCP clients/frontier agents increasingly supply planner; durable surface = quality of ops + project representation, not proprietary chat loop. citeturn21search1turn21search2turn21search5

## 5. Strategic primitives + roadmap

- Ranking assumes mature position above. Strategic value = increases differentiation/reuse/agent-leverage/cross-project value as models improve.

| Rank | Primitive / capability | Score | Why |
|---|---|---:|---|
| 1 | Experience Stop / Destination / Beat | 5/5 | Geometry → visitor unit tying place/direction/content; closer to unique job than another modelling primitive |
| 2 | Experience Kit | 5/5 | Reuses complete tested space/staging/camera/content/behaviour/validation combo; value = accumulated operational knowledge, hard to replace with single prompt |
| 3 | Semantic validation + publish contract | 5/5 | Semantics → dependable delivery; valuable while VLM-confidence vs physical-feasibility gaps persist. citeturn11academia37 |
| 4 | Semantic revision / diff / checkpoint | 5/5 | Safe inspectable AI iteration; must go beyond "AI can edit" since preservation-aware edits improving. citeturn11academia38 |
| 5 | Canonical asset/world ingest + provenance | 5/5 | Every Meshy/Tripo/Blender/world-model improvement helps rather than threatens. citeturn20search6turn11search5 |
| 6 | Region / Surface / Anchor / Subject overlay | 4.5/5 | Generated/imported worlds join Experience semantics without reverse-engineering into walls/rooms |
| 7 | Tour / Branch / Rejoin / Cue semantics | 4.5/5 | Spatial-experience grammar above generic event/state systems; useful to agents + kits |
| 8 | Camera Shot / Transition / Attention binding | 4/5 | Valuable bound to subject/content/journey; camera generation alone increasingly automatable. citeturn11academia39turn21search5 |
| 9 | Room / Opening / Numeric / Snap / Alignment | 4/5 | Excellent semantic Build substrate + reusable precision; useful without general CAD |
| 10 | Placement / Material / Lighting rig presets | 3.5/5 | Necessary quality/reuse layer, but Spline/PlayCanvas/Blender + agents increasingly automate. citeturn12search4turn20search0turn21search5 |
| 11 | Generic event scripting | 2.5/5 | Escape hatch eventually; poor differentiation vs Spline/PlayCanvas/Verge3D. citeturn12search13turn13search3 |
| 12 | Stairs / railings / sweep / revolve / broad CAD tail | 2/5 | Useful when real projects demand; weak reason to delay full experience loop |
| 13 | Native generic text-to-mesh | 1/5 | Meshy/Tripo/providers already compete directly + programmatically callable. citeturn20search6turn5search15 |

- P23/P24 reinterpretation: minimum Build + Stage sets still sensible (genuinely usable substrate), but strategic compounding begins once Experience composes them. Revised North Star already places P25 after minimum useful P23/P24 not long tails; market evidence strengthens sequencing. fileciteturn3file0L2-L2
- Roadmap: 2026 frontier (Spline native Agent+MCP; PlayCanvas deep Editor MCP + runtime verification; Blender MCP official experiment; Astra/Fable cheap complex 3D generation; Marble/Genie/Hunyuan push world generation upstream) → Product-loop proof (Finish P21; P22 cold visitor runtime + Publish; prove versioned delivery independent of editor) → Minimum semantic vocabulary (P23 minimum Build; P24 minimum Stage; no CAD/DCC long tails) → Differentiation proof (P25 narrow Experience: Destination+content+visitor action; Camera+Experience binding; complete publishable visitor journey) → Comparative agent proof (same brief+model: Museum Editor vs Spline/PlayCanvas/strong Three.js starter; include revision requests not only first generation) → Differentiation expansion (Experience kits; semantic revision+validation; provider-neutral Meshy/Tripo adapters; generated-world ingest + semantic overlays; model-neutral MCP/API surface) → Mature platform (multiple tours/branches/free explore; rich kit ecosystem; visitor analytics + authoring feedback; embed/runtime SDK where demand proves it; worlds increasingly generated upstream).

### Crucial benchmark gate
- Earlier audit: compare vs strong reusable-code baseline; now harder: also vs Spline V2 + PlayCanvas MCP (already embody much of agent-native workflow). fileciteturn0file0 citeturn20search11turn20search0
- Same frontier model + assets + brief across 4 paths:

| Path | Question |
|---|---|
| Museum Editor | Does domain structure actually reduce total work? |
| Spline V2 Agent/MCP | Does mature general 3D editor already provide enough semantic/editable workflow? |
| PlayCanvas MCP | Does general web-3D engine + strong agent simply win on flexibility? |
| Strong Three.js starter + agent | Does cheap bespoke software remove need for authoring platform? |

- Do not stop at "Build a museum." Same revision suite to all four: Move central exhibit but preserve tour; Replace four assets with new provider's models; Turn Stop 3 into optional branch; Make hero reveal slower without affecting later timing; Change lighting but preserve artwork material appearance; Add reduced-motion behaviour; Remove one exhibit and repair every dependent reference; Publish previous version again; Let human manually make final change. Thesis becomes obvious or fails here.

## 6. Risks + metrics

### Principal strategic risks
| Risk | Severity | Why | Response |
|---|---|---|---|
| Spline converges on thesis | Very high | Same-editor agent edits, screenshot feedback, MCP, interactivity, custom code, web publishing. citeturn12search4turn20search11turn12search13 | No generic editor parity chase; own visitor-experience semantics, spatial direction, kits, domain validation |
| PlayCanvas makes general engine authoring easy enough | Very high | Agent edits, checkpoints, runs, inspects, tests, verifies real app. citeturn20search0 | Radically easier at narrower spatial-experience class |
| One-shot bespoke code effectively free | High / existential | Astra/Fable-class + reusable Three.js skills cut custom-app cost. citeturn21search5turn14search1turn14search12 | Benchmark total revision/delivery effort; pivot toward runtime/embed specialization if no material advantage |
| World models bypass Build/Stage | High | Marble/Genie/HY-World reduce authoring-from-primitives need. citeturn11search5turn21search14turn11search12 | Imported/generated worlds first-class + semantic overlays |
| Validation commoditizes | Medium–High | PlayCanvas runtime verification + research deterministic critics. citeturn20search0turn11academia37 | Specialize checks around visitor meaning + publish guarantees |
| Revision commoditizes | Medium–High | MUSE strong preservation-oriented editing results. citeturn11academia38 | Productize history, semantic diffs, atomicity, human review; not AI editing itself |
| CAD/DCC scope consumes roadmap | High | Blender enormously broader + directly agent-operable. citeturn6search0turn6search8 | Limit CAD to high-leverage spatial semantics |
| Template constraint tax | Medium | Reuse faster but repetitive / hard to override | Kits instantiate normal editable project state; measure override work |
| Provider lock-in | Medium–High | Mesh/world versions change rapidly (e.g. Meshy moved generation versions/parameters). citeturn20search5 | Normalize at ingest, preserve provenance; project truth provider-neutral |
| "Agent-native" marketing without evidence | High | Spline/PlayCanvas/Meshy/Blender all have MCP/agent stories. citeturn20search7turn20search0turn20search6turn6search0 | Agent support = table stakes; measure outcome economics |

### Core dashboard (audit metrics tightened; fileciteturn0file0)
| Metric | Definition | Why |
|---|---|---|
| Accepted-publish effort | Wall-clock + human active minutes, brief → accepted live version | Actual product outcome, not tool-call theatre |
| Total accepted-publish cost | Model tokens/calls + generation providers + compute + failed attempts + human intervention | Tests "cheaper than bespoke" hypothesis directly |
| Revision locality | Requested changes done while unrelated state unchanged | Single most important AI-era authoring metric |
| Revision success rate | % realistic revision tasks completed without manual repair | Creation vs dependable production |
| Cold publish pass rate | Fresh browser/device loads declared published revision with all assets + behaviours | Reusable runtime value |
| Human continuation time | Time for human unfamiliar with AI process to make specified change in editor | AI output truly owned by user |
| Cross-project reuse leverage | Effort delta: second project with existing kits/primitives vs first implementation | Substrate actually compounds |
| Experience integrity failures | Broken targets, unreachable destinations, camera/architecture conflicts, missing content, runtime errors per revision | Semantic system value |
| Provider portability | Success + normalization quality when equivalent assets/worlds from different providers | Integration strategy real |
| Visitor outcome | Completion, branch use, content engagement, abandonment, device-specific failure on published experiences | Authoring decisions → real usefulness |

- Do not optimize for agent tool calls (single giant tool can hide complexity) or "% generated by AI" (goal ≠ maximal automation; goal = reliable ownership of result).
- Revision locality (MUSE-inspired; evaluation already technically meaningful in 3D research; turn into product acceptance metric; citeturn11academia38): `Revision locality = requested targets correctly changed + required dependent changes correctly made − unrelated state changed`.

## 7. Mature North Star recommendation

- Keep broad category: museums, exhibitions, architecture, historical walkthroughs, spatial portfolios, product showrooms, education, interactive stories, other 3D-first web experiences — common thread = visitor experiencing spatially organized content, not industry. fileciteturn3file0L2-L2
- Recommended mature thesis: Museum Editor is model-agnostic platform for composing, directing, revising, publishing interactive spatial experiences. Project may start from editor-built architecture, imported DCC content, generated assets, scanned environments, AI-generated worlds. Turns spatial supply into inspectable experience model: semantic regions + anchors, staged content, camera + attention direction, visitor navigation, contextual media + interactions, reusable experience kits, validation, versioned web runtime. Humans + AI operate same project behaviour. External models/providers = replaceable creators/inputs. Does not compete to generate every mesh/world/line of code; owns structured experience + reliable revision/delivery.
- Rejected positionings (what stronger claim differs from):
  - "We have semantic 3D project format AI can edit." — Spline effectively has that now. citeturn20search11
  - "AI can modify editor over MCP." — PlayCanvas/Spline/Meshy/Blender show this rapidly becoming standard infra. citeturn20search0turn20search7turn20search6turn6search0
  - "We can create beautiful 3D from prompt." — Astra/Fable-class coding agents/Meshy/Tripo/Marble/Genie/Hunyuan crowd this layer. citeturn21search5turn21search2turn20search6turn5search15turn11search5turn21search14
- Stronger claim: "Give Museum Editor any usable world. We turn it into an experience."
- Eventual proof chain: `Astra/Fable/future model + Meshy/Tripo/Marble/Blender → Museum Editor → structured visitor experience → human can take over instantly → validation catches regressions → one revision does not break five others → known runtime behaviour → publish → repeat on next project`. Resilient to model progress: better model improves every input + authoring client while product supplies reusable experience layer.
- Not perfectly "AI-proof" — nothing is. Spline could specialize; PlayCanvas could gain higher-level templates; world generators could add semantic objects/interactions/hosting; future agents could reproduce much of runtime automatically. Attached audit right to assign low confidence to any durable moat claim. fileciteturn0file0
- Defensibility must accumulate, not be declared: specialized experience semantics + excellent human authoring UX + agent-operable deterministic behaviour + tested experience kits + provider-neutral integrations + domain validators + publish/runtime guarantees + version/revision history + eventually real visitor outcome data. Combination harder to replace than any individual feature.
- Net assessment: mature polished North Star = promising but only conditionally unique. As generic AI-native web-3D editor: already crowded, led most directly by Spline + PlayCanvas. As model-neutral spatial-experience orchestration/revision/publishing system (generated/imported worlds as inputs, visitor journeys as deepest semantic layer): still credible + meaningfully differentiated destination. Highest-value roadmap decision ≠ more AI features; make Experience + reusable cross-domain kits + semantic revision/validation deeper than what general-purpose 3D editor naturally provides.

## 8. Research Inventory + Loss Audit

### Named projects / products / tools / models / companies
Museum Editor; Spline V2; Omma (beta); PlayCanvas; Verge3D; Vectary; Shapespark; Meshy (Meshy-6/latest); Tripo; Blender (+ official/experimental MCP, Python API); GPT-6 Astra; Claude Fable 5.1 / Fable 5 / Fable-class; Three.js starter + skills; World Labs Marble + World API; Google Genie 3 / Project Genie; Tencent HY-World 2.0 / Hunyuan; WorldClaw (+ browser reimplementation); SceneAssistant; MUSE; SceneTeract; CinemaTraj; Gizmo; Playco; Unity; Godot; Unreal Engine (UE5); Codex; Claude; Cursor; React; Web Components; R3F; WebGPU; ComfyUI; Reddit Devvit; r/threejs; X/Digg; YouTube AI/TLDR; fal.ai; MCP; WebMCP Imperative API; HTML/CSS/JavaScript; GLB/glTF/GLTF/FBX/OBJ/STL/USDZ/3MF/COLLADA; splats/GS; .blend; Geometry Nodes; Revit; SketchUp; 3ds Max; Maya; WordPress/WooCommerce; SCORM; Rapier; OpenAI; Anthropic; Google; Tencent.

### Source markers retained (attached to owning claims above)
turn12search4; turn20search11; turn20search0; turn20search7; turn12search13; turn12search3; turn12search9; turn12search12; turn12search14; turn12search2; turn12search0; turn12search1; turn13search3; turn13search7; turn13search18; turn13search1; turn13search5; turn13search14; turn20search1; turn20search6; turn20search5; turn5search15; turn5search4; turn5search2; turn5search1; turn6search0; turn6search3; turn6search8; turn21search5; turn21search3; turn21search2; turn21search14; turn21search1; turn21search18; turn21search6; turn11search5; turn11search1; turn11search12; turn11search10; turn11search7; turn11search0; turn11search6; turn11academia36; turn11academia37; turn11academia38; turn11academia39; turn14search1; turn14search2; turn14search3; turn14search5; turn14search12; turn16search11; turn16search4; turn18search5; turn18search0; turn3file0 (L2-L2); turn0file0.

### Benchmarks / quantitative facts
50% fewer manual fixes (Playco/Astra prototype workflow); 20–24 fps (Genie 3); 99.9% preservation + 0.6% unintended changes (MUSE editing split); 300+ Puzzles (Verge3D); ~600k triangles w/ textures + ~1M vertices/triangles variant (World Labs high-quality meshes); ~75 KB single-file index.html procedural island (terrain/water/vegetation/animals/seasons); ~US$0.50 fal.ai credits (WorldClaw one-prompt world, minutes); ~12.5 hours (Astra 3D-world session, YouTube/AI-TLDR); June X/Digg Fable 5 Swiss-lever watch demo; 14-second transition abandonment example; 8% secondary-branch completion example; primitive scores 5/5 (ranks 1–5), 4.5/5 (6–7), 4/5 (8–9), 3.5/5 (10), 2.5/5 (11), 2/5 (12), 1/5 (13); P21/P22/P23/P24/P25 staging.

### Unresolved / hypothesis-status items
Economic advantage ("cheaper/more reliable than bespoke") = hypothesis to measure; AI-proofability Medium→High = potential, unproven; visitor-outcome loop = strategic inference not competitor-incapability claim; Spline specialization opening = inference not non-reproducibility claim; durable-moat claims = low confidence per audit; social/video/Reddit/community demos = signals not benchmarks; benchmark gate (4-path + 9-item revision suite) = pass/fail test for thesis; provider-neutral ingest + runtime/embed specialization pivots conditional on evidence.

### Original-matrix → compact-section mapping; test-family → compact-section mapping
- 12-row × 8-col competitive ratings matrix → §2 table (all rows/cols; Reliability/AI-adoption/Workflow/Reusability/Integration/Advantage/AI-proofability + per-row cites).
- 12-row domain-validation matrix → §3e table (check + rationale per row).
- 10-row integration matrix (external/relationship/consume/not-build) → §4 table.
- 13-row primitives ranking (rank/primitive/score/why) → §5 table.
- 10-row risks matrix (risk/severity/why/response) → §6 risks table.
- 10-row metrics matrix (metric/definition/why) → §6 dashboard table.
- 4-row benchmark-gate matrix (path/question) → §5 benchmark table.
- Fixture families → §1 pipeline chain; §2 Spline capability list (objects/materials/lights/cameras/booleans/particles/cloners/lathes/sky/variables/events/states) + PlayCanvas MCP op list (inspect-read-only/checkpoint/outcome-instructions/capture/launch/logs+state/inject-input/restore; entities/components/scripts/assets/scenes/settings/templates/animation/builds/version-control) + one-shot cases (75 KB island vs engineered version; $0.50 WorldClaw; Gizmo runtime/CLI/screenshot/MCP) preserved in compressed syntax; §3a hierarchy chain; §3b overlay members (Region/Surface/Anchor/Portal/Support surface/Subject/Destination) + ingest flow; §3c revision flow (request/planned-state Scene lights-12-14+entity-88 + Camera-connection-5 + Experience-unchanged/candidate/domain-validation/semantic-diff/atomic-revision/runtime-validation) + 5 review questions; §3d three kit trees (gallery 8 members; product reveal 8; tour segment 6); §3f five observation facts + four recommendation quotes; §4 boundary diagram + 5-item not-compete list; §5 roadmap phase chain + 9-item revision suite; §6 locality formula; §7 nine-domain scope list + proof chain + nine-item defensibility stack.

### Loss audit
- [x] every original section accounted for (§1 exec; §2 landscape + Spline/PlayCanvas/one-shot; §3a–3f uniqueness; §4 integration + not-compete; §5 primitives + roadmap + benchmark; §6 risks + metrics; §7 North Star).
- [x] every table/matrix dimension retained (reference/cite, score, severity, rationale, verdict columns kept per row; row×column values compared, not mere category presence).
- [x] every named project/tool retained (inventory list above).
- [x] every source/link retained and attached to its claim (marker list above; no invented citations; no silent conclusion changes).
- [x] every quantitative fact retained (benchmark list above; no inferred quantities).
- [x] every concrete fixture retained with inputs/outputs/invariants/edges (mapping above; exact inputs/outputs/invariants preserved in compressed syntax).
- [x] every enumeration has member-level coverage; no umbrella substitution (kit members, overlay members, hierarchy levels, scope domains, Spline/PlayCanvas op lists, revision suite, defensibility stack each listed member-by-member).
- [x] every protected token preserved or explicitly mapped (Room; LayoutDocument; Region/Surface/Anchor/Portal/Support surface/Subject/Destination/POI; Stop/Beat/Shot/Transition/Attention/Content/Event→Target→Action/Branch/Rejoin/Free explore/Completion/continuation; P21/P22/P23/P24/P25; MCP; WebMCP Imperative API; GLB/glTF/USDZ/splat/GS; Meshy-6; lights-12-14/entity-88/connection-5).
- [x] every rejection/defer decision retained (§4 not-build column + §4 not-compete + CAD-tail deferral + parity-chase rejections).
- [x] every caveat + unresolved question retained (reliability legend; demo-vs-production distinctions; inference-vs-claim labels; hypothesis list above).
- [x] no invented citations; no silent conclusion changes.
- Field-level audit passes; all substantive source items accounted for.

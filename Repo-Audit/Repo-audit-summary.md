## EXECUTIVE FINDING

**The system mostly works for cold-start routing, but its authority and resume contracts need a few targeted corrections.** A rewrite would discard useful structure.

- **Biggest strength:** progressive disclosure works. Fresh agents answered small tasks without loading roadmap history, unrelated skills, or broad tests.
- **Biggest failure risk:** instructions marked as hard authority contain obsolete product facts. More literal compliance would make those contradictions more consequential.
- **Checkpoint verdict:** the format preserves an investigation well; discovery, scope preservation, and permission to follow new evidence are less reliable.

I ran **12 independent subagents with no inherited project conversation**. G–J used explicitly synthetic, in-memory fixtures because you prohibited file changes. They demonstrate discovery and proposed lifecycle behavior, not actual checkpoint writes/deletions or shipping. All probes shared the normal system/tool environment and repository instructions. No files changed; Git remained clean.

The external criteria fit the findings: OpenAI recommends narrower skill triggers, contextual reads, and explicit completion boundaries; Anthropic supports just-in-time retrieval and structured cross-session evidence. Neither justifies removing genuine project invariants or adopting a universal startup/test ritual. [OpenAI guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra), [Anthropic context guidance](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), [Anthropic harness guidance](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

## PASS

Behaviors demonstrated by the probes:

- **Tiny edit:** router → known file; no checkpoint skill merely because the file concerns checkpoints.
- **Global status:** router → roadmap → stop.
- **P26 status:** router → roadmap → P26 README → stop.
- **Architecture:** direct reference routing without roadmap preload.
- **Missing implementation plan:** treated as an authorized prerequisite to prepare, not an automatic permission gate.
- **New bug:** bounded source investigation; respected an explicit owner deferral; selected tech debt for durable diagnosis.
- **Clean boundary:** proposed promotion before checkpoint deletion, removal of `RESUME`, and advancement of the semantic baton.
- **Slice close:** detected the checkpoint obligation, promoted findings, and excluded raw working memory from archive.
- **Owner Git changes:** derived checkout state from Git; the semantic baton remained usable.
- **Historical rationale:** entered archive because the question specifically required history.

Additional checks:

- **79 local Markdown destinations across 18 scoped files resolved.** This was a path-existence check, not an anchor or whole-repository link audit.
- The checkpoint directory currently contains only its README: no orphaned or duplicate checkpoint.
- `current.md` is 181 bytes and contains no branch, hash, dirty-state claim, completed-work history, or bug diagnosis.
- No probe asked an unnecessary permission question.

## FAILURES

### High · Obsolete facts retain hard-rule precedence

[AGENTS.md:17](/Users/tony/Documents/Biskiq/spatial-sketch-editor/AGENTS.md:17) still declares:

- `rooms.ts` authoritative until B4/B5;
- `scene.json` v6 authoritative;
- layout prohibited from driving `/museum` before those gates.

Yet the live museum runtime imports `chopin-project.json`, builds its room registry from `project.layout`, and compiles that layout. [Runtime evidence](/Users/tony/Documents/Biskiq/spatial-sketch-editor/apps/museum/src/lib/content/chopin-project.ts:32)

The editor’s canonical boot uses a wall-first layout plus world-local scene. [Canonical boot](/Users/tony/Documents/Biskiq/spatial-sketch-editor/packages/project-model/src/project-codec.ts:75)

**Consequence:** an agent must reinterpret a supposedly superior hard rule to follow current architecture. The invariant—one canonical authority—remains necessary; its historical filenames and migration gate do not.

### High · Some directly routed references describe obsolete behavior as current

Three concrete examples:

- [Persistence:8](/Users/tony/Documents/Biskiq/spatial-sketch-editor/docs/reference/components/persistence.md:8) describes a versionless scene and room-frame layout without clearly separating legacy compatibility from the canonical wall-first/world-local format.
- [Camera contract:11](/Users/tony/Documents/Biskiq/spatial-sketch-editor/docs/reference/components/camera-tour.md:11) defines camera poses as room-local. The resume probe had to consult source/tests to recover the world-local case.
- [Shell contract:5](/Users/tony/Documents/Biskiq/spatial-sketch-editor/docs/reference/components/shell.md:5) calls its pre-P21 map the current implementation, although the active context documents the shipped project/workspace rows and current code retains a project-scoped shell session.

**Consequence:** routing succeeds but delivers stale authority. This is more important than reducing router prose.

### Medium · Checkpoint instructions conflict with their own continuation purpose

[Work-checkpoint:90](/Users/tony/Documents/Biskiq/spatial-sketch-editor/.agents/skills/work-checkpoint/SKILL.md:90):

> Open only checkpoint READ / EVIDENCE targets.

The generated checkpoint’s `NEXT` required locating schema and tests not listed in those fields. Probe H successfully did that—but therefore did not obey “only” literally.

Its metadata also emphasizes checkpoint **creation at interruption**, while the body owns resume and completion. Probe H loaded no skill, explaining that no creation/update was requested.

**Consequence:** literal compliance can block the next investigative step; metadata can fail to load the procedure on resume.

### Medium · Checkpoints can preserve findings while losing task boundaries

Probe G produced useful evidence and ruled-out hypotheses, but:

- changed the goal from continuing diagnosis to restoring placement;
- included implementation in `NEXT`;
- omitted the existing TD-1 record, which already establishes the format issue and explicit P24 deferral.

Probe H recovered the schema answer but never discovered that durable diagnosis.

This is partly a fixture/agent failure, not proof that every checkpoint will fail. It exposes a real gap: **a checkpoint can be technically resumable while semantically mis-scoped.**

### Medium · Closeout metadata triggers too broadly

[Slice-closeout:3](/Users/tony/Documents/Biskiq/spatial-sketch-editor/.agents/skills/slice-closeout/SKILL.md:3) includes:

> after tests pass

Taken independently, that applies to a typo check, isolated regression fix, or unfinished increment—not just accepted slice completion.

The body is appropriately procedural. The trigger is the problem.

### Medium · Active implementation routing still permits a large initial read

P23.14 directly routes an **87 KB context** and **29 KB final direction**. The three named references add approximately **94 KB** if read whole.

Probe D requested roughly **138 KB of source material**, then about **35 KB of repeated excerpts/search output** after truncation.

The task genuinely needs substantial context eventually. The avoidable cost is loading entire artifacts before locating the first bounded increment—not the existence of detailed design evidence.

### Low · Debug provenance contains an incorrect introduction anchor

[TD-1:145](/Users/tony/Documents/Biskiq/spatial-sketch-editor/docs/operations/tech-debt/README.md:145) attributes the empty wall-first registry branch to `2c9b04d`.

Read-only `git log -S` and blame locate that branch in **`d5ec0df`**. Inspecting the file at `2c9b04d` confirms the branch was absent.

The ledger also dates `d1705b7` September 10; Git records September 11.

**Consequence:** the investigation remains recoverable, but a successor following the stated introduction commit wastes time.

### Low · Minor metadata drift

- The roadmap uses `planning`, but its declared status enum omits it. [Roadmap:26](/Users/tony/Documents/Biskiq/spatial-sketch-editor/docs/roadmap/README.md:26)
- The optional model-routing document still treats Sol xhigh as the ceiling and contains a historical capacity rubric. No probe loaded it unnecessarily, so it is latent scaffolding rather than current startup overhead. [Model assessment:13](/Users/tony/Documents/Biskiq/spatial-sketch-editor/docs/roadmap/model-assessment.md:13)

## FRONTIER-MODEL RISKS

| Instruction | Exact literal failure mode | Recommended adjustment |
|---|---|---|
| AGENTS hard rules override product detail | Obsolete authority wins over landed architecture | Retain invariants; replace superseded authority names/gates |
| `current.md` above plans/contracts in universal truth order | Transient baton can appear to override durable architecture | Scope baton authority to active work; distinguish landed facts from intended changes |
| `L1: Read only … active phase/slice … active plan` | Every normal task may appear to require phase context | Make those reads conditional on implementation/status needs |
| `STOP: task answered` | Implementation may stop at explanation or first pass | Keep routing stop; define implementation completion through applicable acceptance and fixes |
| Archive only for explicitly historical rationale | Legitimate source-history investigation may appear prohibited | Allow bounded historical evidence when needed; never treat it as current authority |
| Resume: open **only** listed targets | Cannot follow a newly discovered symbol/test needed by `NEXT` | Start with listed targets; permit bounded expansion |
| Checkpoint description requires another agent | Same-agent fresh-context resume may miss the trigger | Name creation, resume, and completion of substantial interrupted work |
| Closeout “after tests pass” | Passing any test activates shipping lifecycle | Trigger on slice acceptance completion or explicit closeout request |
| Closeout “run” acceptance again | May repeat unchanged verified gates | Accept current evidence; rerun when changes or uncertainty justify it |
| Compactor’s generic “compress/normalize/deduplicate” terms | Ordinary editing may activate preservation-heavy workflow | Scope metadata explicitly to research Markdown |

**Observed versus predicted:** probes avoided premature permission requests and broad test rituals. Several risks above remain literalness risks, not observed failures. Probe H’s skill omission and expansion beyond its checkpoint targets were observed.

### Instruction classification

The table groups repeated wording by instruction family; it separates actual project constraints from historical scaffolding.

| Scoped instruction family | Classification | Assessment |
|---|---|---|
| AGENTS bootstrap, human overview, router pointer | ROUTING | Keep |
| Workspace commands and camera terminology | DURABLE TRUTH | Useful disambiguation |
| AGENTS one route/motion; no second graph; generated-endpoint exclusion | HARD INVARIANT | Keep |
| `rooms.ts`/B4–B5/`scene.json` v6 authority clauses | LEGACY SCAFFOLDING | Replace historical state, preserve canonical ownership |
| Visitor isolation, helper boundaries, production availability | HARD INVARIANT | Keep; route listings belong in current architecture |
| Svelte/Threlte conventions | HARD INVARIANT | Project constraints |
| `scroll-travel` unused | DURABLE TRUTH | State claim, not prohibition |
| Prefer Floor/Wall/Ceiling planes | DURABLE TRUTH / design guidance | Preference should remain distinguishable from hard prohibition |
| No commits/push without authorization | HARD INVARIANT | Explicit owner boundary |
| Truth precedence | ROUTING | Needs authority-by-concern qualification |
| Minimum reads, no recursive preload, bounded searches | ROUTING | Proven useful |
| Router L3 exceptions and archive entry | ROUTING | Useful guard against archaeology; retain task-driven exceptions |
| Direction/priority reserved to owner | HARD INVARIANT | Protect actual scope decisions, not routine implementation |
| Router truth locations, need table, IMPLEMENT/DESIGN/RESEARCH paths | ROUTING | Keep |
| Router update destinations and handoff/checkpoint distinction | ROUTING | Keep concise pointers |
| Phase creation, ship/archive lifecycle instructions | REPEATED PROCEDURE | Skills should own detailed steps |
| Roadmap pipeline/status ownership and phase/slice routing | ROUTING + TASK-SPECIFIC DETAIL | Correct layering; fix enum |
| Active phase/slice goals, gates, carried rows, ratified design authority | TASK-SPECIFIC DETAIL | Properly local to owning manifests |
| Reference ownership, serialization, isolation and geometry boundaries | DURABLE TRUTH + HARD INVARIANT | Correct role; stale facts need reconciliation |
| Checkpoint directory CREATE/UPDATE/COMPLETE/NO list | REPEATED PROCEDURE | Small useful entry summary; avoid growing duplicate procedure |
| Work-checkpoint schema and lifecycle | REPEATED PROCEDURE | Stable recovery workflow |
| Checkpoint facts-versus-hypotheses and no diary/history | HARD INVARIANT of the artifact | Keep |
| Slice-closeout verification/promotion/archive/link repair | REPEATED PROCEDURE | Strong procedural value |
| Reviewer briefing, factual validation, scoped disclosure | REPEATED PROCEDURE + HARD INVARIANT | Keep |
| Compactor inventory, reconstruction audit, provenance preservation | REPEATED PROCEDURE + artifact invariants | Keep outcome; simplify repeated prescriptions |
| Compactor repeated style bans, exhaustive examples, preferred section itinerary | LEGACY SCAFFOLDING candidates | Consolidate or disclose on demand |
| Tech-debt template | REPEATED PROCEDURE | Enough; no separate debug skill needed |
| TD-1 diagnosis and explicit deferral | DURABLE TRUTH + TASK-SPECIFIC DETAIL | Strong record, with incorrect historical anchor |
| Optional model capacity/routing rubric | LEGACY SCAFFOLDING | Reassess separately from repository truth |

## SKILLS

Sizes include metadata. All four local skills were inspected as audit subjects; their workflows were not executed against repository files.

| Skill | Trigger / false-positive risk | False-negative risk | Size / procedural value / overconstraint | Decision |
|---|---|---|---|---|
| [slice-closeout](/Users/tony/Documents/Biskiq/spatial-sketch-editor/.agents/skills/slice-closeout/SKILL.md) | Accepted slice or explicit ship/archive; **“after tests pass” too broad** | Low | 37 lines, 2.3 KB. High lifecycle value. Moderate trigger/order risk | **Keep; narrow trigger** |
| [work-checkpoint](/Users/tony/Documents/Biskiq/spatial-sketch-editor/.agents/skills/work-checkpoint/SKILL.md) | Substantial expensive interruption; low false-positive risk | **Resume/completion and same-agent reset underdescribed** | 105 lines, 2.2 KB. High recovery value. “Only targets” overconstrains | **Keep; adjust metadata and resume rule** |
| [consult-browser-reviewer](/Users/tony/Documents/Biskiq/spatial-sketch-editor/.agents/skills/consult-browser-reviewer/SKILL.md) | Explicit reviewer consultation; low risk | Low for intended Museum workflow | 16 lines, 1.3 KB. Focused briefing/validation procedure. Low overconstraint | **Keep** |
| [research-md-compactor](/Users/tony/Documents/Biskiq/spatial-sketch-editor/.agents/skills/research-md-compactor/SKILL.md) | Research preservation, but metadata verbs are broad | Low | 187 lines, 14.4 KB. Real preservation value; repeated constraints and examples dominate | **Simplify; move optional examples/checklists behind links if useful** |

`work-checkpoint` is **not a generic debugging recipe**. Its core concerns are evidence, frontier, continuation, promotion, and deletion.

`slice-closeout` likewise mostly encodes deterministic lifecycle work without micromanaging implementation. One ordering improvement: inspect/promote checkpoint content before writing final evidence and advancing the baton; keep deletion after successful promotion.

No new skills are warranted.

## COLD-START RESULTS

For compactness, paths below are relative to the [repository root](/Users/tony/Documents/Biskiq/spatial-sketch-editor). Every probe had the supplied AGENTS instructions and opened `docs/README.md`; neither counts as an accidental read. Costs are approximate filesystem/output bytes, **not token counts**, and exclude common injected instructions.

**Unnecessary question/permission request: none in A–L.**

| Probe | Required read set → actual files/skills | Why / authority / stop point | Avoidable context / result |
|---|---|---|---|
| **A · Tiny edit** | Router + `docs/operations/checkpoints/README.md`; no skill | Known target supplies spelling; stop after confirming “Transient” already correct | ~5.9 KB. No roadmap, tests, or unrelated skill. **Pass**, though it exercised an already-correct target rather than an applied edit |
| **B · Global status** | Router + `docs/roadmap/README.md`; no skill | Roadmap owns phase state/order; stop there | ~6.8 KB. No avoidable files. P23 execution, P26 planning. **Pass** |
| **C · P26 status** | B + `docs/roadmap/p26-spatial-depth/README.md`; no skill | Phase README owns next step; stop at design brief/no implementation approval | ~8.7 KB filesystem footprint. No synthesis preload. **Pass** |
| **D · Current implementation** | Router, roadmap, current, P23 README, P23.14 README; then context/final-direction and reconciliation excerpts; no skill | Manifests establish missing child plan; context/design own preparation | Oversized context requests truncated; repeated reads followed. Stop at concrete plan-writing prerequisite; intended continuation did not require permission. **Routing pass; context-efficiency partial** |
| **E · Architecture** | Router + architecture + persistence contracts; no skill | Direct package/boundary authority; stop when model/camera ownership established | ~21 KB. Architecture already answered much of the question; full persistence added unrelated material. **Pass with modest overread** |
| **F · New bug** | Router/current, placement contract, P23.14 README; excerpts from context/final-direction, debt template, Plan overlays/viewport/interaction/keyboard files; no skill | Source confirms rotation no-op; explicit owner ruling controls deferral | ~35–40 KB. Initial gizmo search and broad direction matches avoidable. Selects durable debt record, not current history. **Pass** |
| **G · Interrupted debugging** | Router, current, checkpoint README, `work-checkpoint`; four placement/registry source files | Skill owns checkpoint form; source/scenario distinguish evidence; stop after proposed checkpoint/baton | ~19 KB read. Duplicate directory summary and unused search matches. One checkpoint, no diary; **partial** because scope broadened and existing debt was missed |
| **H · Resume** | Virtual current/checkpoint, Git, camera contract, model/codec/save snippets and conversion/codec tests; **no skill** | Source/tests resolve absent `roomId` and world-local format; stop before NEXT 2 | ~45–55 KB. Broad test search, failed guessed paths, small registry reread. Did not redo full diagnosis; **partial** due missed skill/debt and literal target restriction |
| **I · Clean boundary** | Router, `work-checkpoint`, current, roadmap, debt README, P23.14 README | Owner deferral + promotion rules; stop after transition specification | 27.2 KB. Roadmap redundant. Promote defect, delete checkpoint, remove RESUME, return to planning. **Simulation pass** |
| **J · Slice close** | Router, `slice-closeout`, current, roadmap, P23/P23.14 READMEs | Fixture supplies acceptance; skill owns closeout; phase owns successor | 15.4 KB. No deep design/source reads. Promote findings and delete raw checkpoint; no automatic test repeat. **Simulation pass** |
| **K · Manual Git change** | Router/current/P23.14 README + Git status/log; no skill | Git owns checkout; semantic docs own next unit; stop when agreement established | ~8–10 KB. No remote fetch, so push freshness not independently proved. Handoff survives local commit changes. **Pass** |
| **L · Historical rationale** | Router; P23.12 final contract; historical brief excerpts; shell identity excerpt; no skill | Historical contract/brief explain decision; current reference corroborates landed result | ~51 KB including search output. Broad archive search avoidable; shell already has exact pointer. **Answer/routing pass; retrieval inefficient** |

Exact additional source targets for the longer probes:

- **F:** `apps/editor/src/lib/editor/layout/plan-overlays.ts`, `LayoutPlanViewport.svelte`, `layout-interaction.ts`, `plan-keyboard-traversal.ts`.
- **G:** `packages/project-model/src/project-layout-semantics.ts`; editor `EditorSelection.svelte`, `camera-plan/CameraPlanViewport.svelte`, `store/navigation-graph-mutator.svelte.ts`.
- **H:** project-model `scene.ts`, `scene-format.ts`, `scene-codec/{index,parse-document,canonical,parse-entities,readers}.ts`, plus located `wall-first-project.ts`; tests `apps/editor/tests/lib/project/scene-world-conversion.test.ts` and `apps/editor/tests/lib/content/scene-codec.test.ts`. Additional search-only matches included `project-compat.test.ts` and unrelated layout tests.
- **L:** `docs/archive/roadmap/p23/p23.12-final-design-contract.md` and `p23.12-designer-brief.md`; landed identity section in `docs/reference/components/shell.md`.

**Context-budget conclusion:** routine startup is already small. The major costs arise from whole-artifact reads, broad searches, and stale references requiring source reconstruction. There is no evidence that shaving a few lines from AGENTS would outperform correcting those problems.

## HANDOFF / CHECKPOINT

**Clean-boundary durability: good.** Deleting today’s `current.md` would lose convenience, not durable knowledge: the phase/slice manifests retain P23.14’s planning stage and next action.

**Interrupted-boundary durability: useful, incomplete.** G → H preserved the two-layer failure, ruled-out causes, unfinished state, and next technical question. H did not re-investigate floor-hit generation or the Svelte warnings. It did repeat a small registry lookup and rediscover information already present in TD-1.

**Garbage collection: sound contract, simulated execution only.** I and J both chose promotion before deletion, removed `RESUME`, and refused to archive raw checkpoints. No live checkpoint existed to exercise physical cleanup.

The intended ownership map is sound:

| Artifact | Proper responsibility | Audit |
|---|---|---|
| `current.md` | Next atomic unit | Live file passes |
| Git | Physical checkout/history | K passes |
| Checkpoint | Same unfinished unit | Format passes; scope/discovery need improvement |
| Tech debt | Durable deferred diagnosis | Strong exemplar; provenance correction needed |
| Reference | Landed truth | Some stale contracts fail |
| Archive/closeout | Completed evidence and rationale | Discoverable; older slices have grandfathered exceptions |

Deleting a completed checkpoint **after actual promotion** should not destroy durable knowledge. The schema alone cannot guarantee this; the lifecycle must verify that each durable finding reached its owner.

## DEBUG PROVENANCE

**Recoverability is good, but the complete chain is not uniformly proven.**

For TD-1, I traced:

1. Symptom and repro → named consumer/registry symbols.
2. Symbols → Git blame and string-history search.
3. Git → P23.1/P23.3 commits and PR identifiers.
4. Commit → changed implementation, tests, and plan paths.
5. Current phase manifest → shipped-slice ownership.

The ledger also explains why existing tests miss canonical boot → placement → commit, and names the regression coverage owed by a future fix. That is useful forensic detail, not handoff history.

Limitations:

- One introduction commit is wrong.
- The defect is deferred, so the regression tests it requests are **not a completed protection**.
- Older P23 plans remain live under an explicit grandfathering rule; one still says `implementation-ready` despite the phase marking it shipped. Git and phase status recover the history, but a uniform closeout/archive chain is not established for every older slice.

Do not retain old `current.md` content to compensate. Correct the durable anchors.

## MECHANICAL CHECKS

Only these appear worth adding later:

1. **Scoped live-link validation:** Markdown destinations, heading anchors, and explicit router paths.
2. **Checkpoint integrity:** valid `RESUME`, no orphan pointers, no duplicate task checkpoints, no checkpoint associated with shipped work, no raw checkpoints under archive.
3. **Baton hygiene:** flag volatile branch/HEAD/dirty-state fields in `current.md`; allow historical commit evidence in debt/checkpoints.
4. **Manifest consistency:** valid status vocabulary and P-level versus child-level ownership.
5. **Moved-path detection during closeout:** references to the exact moved bundle, including HTML/image paths.

Two checks need restraint:

- Archive links are not automatically errors; rationale/evidence links are legitimate.
- A hash that resolves can still be the wrong provenance anchor. That needs targeted historical verification, not a superficial link check.

No checker was built.

## SURGICAL CHANGES

Ordered by leverage:

1. **Correct AGENTS authority facts**, preserving single-source, navigation, persistence, and isolation invariants.
2. **Reconcile the routed persistence/camera/shell contracts** with landed behavior; label legacy compatibility explicitly.
3. **Adjust checkpoint metadata and resume wording:** cover resume/completion, permit bounded new targets, and preserve authorized scope/owner deferrals in the checkpoint’s goal or constraints.
4. **Narrow closeout triggering** to accepted slice completion or explicit closeout. Consult checkpoint findings before final evidence/baton advancement.
5. **When writing the pending P23.14 plan, provide exact section/source routes per increment.** The missing plan is the natural place to solve current context loading; no new abstraction is needed.
6. **Correct TD-1’s introduction commit/date** and link the existing diagnosis from relevant continuation context.
7. **Then address small cleanup:** status enum, optional model rubric, and compactor repetition.

## DO NOT CHANGE

- One navigation graph/route/motion authority.
- Visitor/editor import isolation and production availability.
- Canonical authored state versus derived geometry/runtime state.
- Generated-endpoint and renderer-state persistence exclusions.
- Explicit no-commit/no-push authorization boundary.
- Owner control over genuine product direction and scope changes.
- Phase-owned child status and a P-level-only global roadmap.
- Archive as historical evidence, never current authority.
- Semantic handoff versus interrupted-work checkpoint separation.
- Promotion before deletion; no raw checkpoint archive.
- Regression protection appropriate to the defect.
- Compactor preservation of fields, qualifiers, provenance, and uncertainty.

**Keep the harness. Correct its stale authority and a few literalness traps; do not replace it with a larger instruction system.**
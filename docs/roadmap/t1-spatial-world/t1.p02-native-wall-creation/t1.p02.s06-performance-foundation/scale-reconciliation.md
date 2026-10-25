# T1.P02.S06 — world-scale reconciliation and Bench 1 decision package

**Status: ruled 2026-10-24.** The owner approved D1–D9 (§6) as recommended. The approved
extensions are implemented in PR #190 as the plan's
[C.2 amendment](./implementation-plan.md#c2-scale-identification-amendment-owner-ratified-2026-10-24),
which supersedes PR #189's pending C.1 where they differ; §7 records what changed and what the
implementation found. This page reconciles PR #189's world-scale research
([synthesis][synthesis], [scale-measurement proposal][proposal], pending [C.1 amendment][c1]) with
the S06 setup. §1–§6 are the decision package as the owner ruled on it. The plan's E1–E5, H1–H9 and
I1–I6, the correctness contracts and the three owner-run passes are unchanged.

The target is accepted: routine editing of 10,000+ Rooms, 100,000+ architectural entities and
millions of visual details. This page asks what the three passes must capture so that Bench 1
identifies the mechanisms that would get there, rather than only timing today's code at S–XL.

## 1. What the setup already shows

Every number below comes from the setup at `9a9b3bdc`. Each carries its evidence label: smoke
runs are single runs ("smoke, not evidence"), censuses are counts ("census, not timing"), and
probes are agent diagnostics outside any pass. None of them is a measurement row.

| # | Finding | Label | Consequence for the research |
| --- | --- | --- | --- |
| F1 | Full open grows superlinearly. F2 cold total is 0.15 s at grid-S (74 entities), 0.54 s at M (338), 5.3 s at L (1,262) and 21.6 s at XL (2,522): doubling N from L to XL multiplies it by 4.1. Generating fixtures through the planners is quadratic too (XL took 24 min). | smoke, not evidence | PR #189's uniform 67.6 µs/entity extrapolation does not describe the current full path. Bench 1 has to identify the superlinear terms (the pair loops H3 targets), not fit one per-entity coefficient. |
| F2 | Memory is the first wall. Heap retained after forced GC at grid-XL: 373 MiB at open; 640, 975, 1,028 and 1,081 MiB after 5, 10, 15 and 20 consecutive accepted edits. At sweep-H10 (1,330 Rooms, 3,240 Walls, 716 placements): 956 MiB at open; 1,459, 1,478 and 2,052 MiB after 1, 2 and 3 edits, after which the tab crashed on the 4th. The crash reproduced in two different flows (a drag then Undo in the smoke run, typed edits in the probe). Chrome caps a tab's JS heap at about 4 GB, and transient peaks during an accept reach about twice the retained heap. | smoke; agent probe | A 10,000-Room source cannot be admitted in the browser today: the heap would exhaust before any frame-time question arises. Data ownership (clones, history, compiled and renderer mirrors) is a mandatory axis, not an optional one. |
| F3 | Submission is per entity. Draws per frame equal the mesh count at every tier (91 at S, 4,681 at XL, 10,526 at H10). There is about one material per mesh (6,714 materials for 9,953 meshes at H10) over 36 shared textures and 14 programs. The shadow pass is minor (24 draws). | census-grade counts from smoke | The per-entity-ownership hypothesis is already confirmed at the count level. Bench 1 needs the time side: CPU time inside `render()` and GPU time where the browser exposes it. |
| F4 | The Stage re-renders every frame at rest: 60 frames/s idle at S–L, and 18–19 frames/s at H10 with 10,526 draws and 8.07 M triangles per frame. | smoke, not evidence | An idle editor already costs a full scene submission every frame. Render-on-demand (next to H9) is a mechanism to evaluate, alongside batching. |
| F5 | One accepted commit runs 2 full compiles and 7 `structuredClone`s, hashes 15 MB and freezes 1.6 M objects at H10, and leaves about 3,000 more live geometries afterwards. | count, not timing | The acceptance path's global work (H2, H5, H7) shows up as counts. Their time shares come from Bench 1's stage spans. |
| F6 | Harness confounds, found and not yet fixed: (a) F7 orbits from the default view after open, which for the museum family shows nothing until Fit (the camera clips at 121–235 m); (b) no flow measures the Plan reading; (c) the H/D sweep blocks add Rooms and Walls but no Openings (137 stay constant), so E5 and the sweep rows cannot see the Room×Opening and Wall×Opening pair terms that dominate the grids; (d) the H blocks are disconnected, which PR #189 rightly says manufactures locality. | setup review | Without fixing these, Bench 1 would time an empty view at the museum and miss the dominant superlinear terms in the sweep. |
| F7 | Withdrawn: the F13 grid-XL "166 MiB retention" was the harness's own reference to the last rendered scene, fixed in `9a9b3bdc`. After the fix, F13 retains about 17 MiB and 645 DOM nodes after close at every tier. | smoke | Not a product finding. |

## 2. PR #189 against the implementation

**Supported now** (no change needed): changed set k (E1), the irrelevance sweep with pixel
equality (E5), draws, triangles, main and shadow passes, live programs, geometries and textures,
resident texture, geometry, shadow and drawing-buffer bytes, frames at rest, per-stage work spans
(compile, admission parse/runtime/digest/serialize/freeze, envelope validation, Scene resolve,
Layout representation), work counts (compiles, entity sets, pair visits for three loops, digests
and bytes, serializations, F4 clones, frozen objects), F3 input-to-preview correlation, commit and
Undo/Redo completion, long tasks, and traced GC/idle/paint attribution.

**Bounded extensions** (no new mechanism; each fits inside existing runs):

| Proposal item | Extension | Why it is enough for Bench 1 |
| --- | --- | --- |
| All-visible Plan | Inside each F7 run, after the orbit: Plan reading + Fit, a 1 s rest window and a 3 s scripted pan/zoom, with render counters, CPU render time and resident bytes | Gives the current Plan cost with every footprint in frame at S, M, L, XL, museum and H10, with 33 measured runs per tier and no extra open |
| All-visible 3D | The same window in 3D after Fit; F7's orbit itself starts from Fit (F6a) | Removes the empty-view confound and makes "all visible" a defined framing |
| Submission versus GPU | CPU time of each `renderer.render()` call; probe `EXT_disjoint_timer_query_webgl2` once per session and record GPU time, or null with the reason | Separates CPU submission from GPU work; fits render CPU time against draws |
| Compatible bins | One census per window: distinct (program, material-parameter, geometry-layout) groups among the drawn meshes | The draw count batching could reach while keeping equal output: a logical model of a physical scene, labelled as such |
| Ownership and residency | Post-GC heap after open, after the F3 sequence and after each F13 cycle (outside timed windows); live geometries and materials after each commit | Retained bytes per accepted edit and history depth: F2's first wall |
| Superlinear attribution | Count every pair loop and global pass the compiler and admission run, not just the three counted now | Bench 1 can fit time ≈ a + b·N + c·pairs per stage and name the quadratic term |
| Connected sweep | A third variant, C: blocks joined to the museum through shared Junctions and Walls, carrying doors and windows | Exposes the opening-pair terms and removes the disconnected-locality artefact; keeps H and D unchanged |
| Repetition | Extend E3 to a logical census at 2k, 20k, 200k and 2M placement descriptors with a fixed definition set, plus an increased-definition control | Counts what per-copy ownership would cost against definition sharing; physical millions stay out of reach |

**Requires a scope ruling:** a scale census toward 10,000 Rooms. Planner construction is
infeasible: extrapolated from XL it would take days. The assembly exception in PR #189 (replicate a
planner-built connected block with ID remapping, then validate and compile the whole source
through the canonical path) is the right tool. Run it **in Node**, as a labelled feasibility
census (compile and validation work counts, Node wall time and peak heap at about 1k, 3k and 10k
Rooms), with a 10-minute bound per point. Do not attempt a browser admission inside an owner pass:
F2 predicts it will exhaust the heap and abort the pass.

**Defer, with reasons:**

- **Evaluated set e, index node visits, negative-query invalidations, certificate fallbacks.**
  These are properties of an incremental evaluator and an index that do not exist yet. Today every
  compile evaluates all N, so e = N by construction. They belong to D.3's count oracles after
  Bench 1. Listing them as pre-Bench-1 statistics mixes up what can be measured now with what a
  mechanism would add later.
- **The execution-plan laboratory** (retained Plan vectors, merged or instanced equal-output 3D).
  Its comparisons are paired within one pass, so Bench 2 can run reference and candidate side by
  side with no Bench 1 baseline of the candidate. Bench 1's attribution decides which candidate is
  worth building: if CPU submission is not the critical path at L, the instancing lab is the wrong
  first build. Exact candidates with framebuffer differentials take days, would delay Bench 1, and
  would not improve what Bench 1 identifies. Recommendation: a separately approved lab plan, built
  between Bench 1 and Bench 2, which matches PR #189's own pass roles (Bench 2 discriminates).
- **Hierarchy, demand frontier, town navigation, streaming, WebGPU, HLOD, label allocation,
  precision encoding.** No fixture, hierarchy or second backend exists to measure. Keep them as
  models in the research until an implementation scope exists.
- **Install/render/present identity.** This stays under the owner's held H0 ruling; S06 records
  rAF and trace evidence with its existing limits.

**Push-back on the proposal's method:**

1. *Extra diagnostic timing conditions at ≥10 runs each.* At XL every extra condition with its own
   open costs about 12 min per cache state set. Embedding the diagnostic windows in existing runs
   (same session, after the required window) gives them 33 runs at almost no extra open time.
2. *A 10,000-Room physical product point in the passes.* F2 makes this a predicted crash. It
   should be an agent feasibility census outside the passes, recorded with its failed phase and
   bound, as PR #189 itself allows. Product rows stop at the largest point the tab survives.
3. *"Millions of details" as physical evidence.* At H10, 716 placements already mean 7 M triangles
   and a 53 s main-thread block. Physical millions need the lab's instancing path. Until then this
   is a logical census, labelled.
4. *Six contrasts as one frozen pre-Bench-1 package.* Four of them (semantic size, all-visible
   Plan, all-visible 3D, ownership) are decisive and cheap to make physical now. Repetition and
   working-set turnover can only be logical at Bench 1, and causality is already covered.
   Freezing all six as equals would mostly freeze placeholders.

## 3. The smallest decisive program

Three evidence classes, never mixed: **physical product** (the real path, in the passes),
**logical census or model** (agent-run, no pass cost) and, later, **physical laboratory** (Bench 2
and 3).

| Question | Bench 1 (identify) | Agent, before Bench 1 | Bench 2 (discriminate) |
| --- | --- | --- | --- |
| Semantic locality versus N | Tier rows S–XL; sweep rows at ×1 and ×10 for variants H and C; stage spans and pair counts fitted per stage | E1, E5 (H, D and new C); the scale census to 10k Rooms (Node) | D.3 count oracles (e, index visits) against full-compile differentials |
| All-visible Plan | Plan + Fit windows at every tier | Compatible-bin census | Retained-vector lab paired with the product Plan |
| All-visible 3D: submission versus detail | 3D + Fit windows; CPU render time; GPU time or null | Compatible-bin census; triangles per draw | Merged or instanced lab, equal output, paired |
| Data ownership | Post-GC heap per edit and per cycle; clones, freezes, digest bytes; geometries after commit | E5 frozen-object and history slopes | H2/H5 differentials and retained-byte oracles |
| Memory residency | Resident bytes in every window; heap ceiling records | E4; logical repetition census | Residency policy only if Bench 1 shows turnover |
| Causality | Existing F3/F4/F8 correlation | — | Unchanged |

A Bench 1 result is decisive when each stage's time is attributed to one of: whole-document
evaluation, superlinear pair work, acceptance-path copying and hashing, per-entity submission,
idle re-rendering, or retained memory, with residuals stated.

## 4. Setup changes, cost and risk

| Change | Agent setup time | Added Bench 1 time | Risk |
| --- | --- | --- | --- |
| F7 from Fit; Plan and 3D all-visible windows | 2–3 h | about 40 min (≈ 12 s × 33 runs × 6 workloads) | Changes F7's start view from T3's earlier M rows; Bench 1 is S06's first baseline, so consistency across S06 passes holds |
| CPU render time, GPU timer probe, compatible-bin census | 1–2 h | under 1 min | GPU timers are probably unavailable on macOS Chrome; recorded as null with the reason |
| Post-GC heap probes, geometry and material counts after commit | 1 h | 3–5 min | GC at XL can take about 1 s; it stays outside timed windows |
| Remaining pair-loop and global-pass counters | 1–2 h | none | Touches layout-core and project-model seams (still inert without the flag); T3 reviews |
| Connected sweep variant C at ×3 and ×10 | 2 h + about 40 min generation | E5 about 5 min; sweep rows only if the owner adds C to them | Larger E5 browser run; C10 open time unknown until generated |
| Logical repetition census (E3 extension) | 1–2 h | none | Model only |
| Scale census to 10k Rooms by assembly (Node) | 3–4 h + up to 30 min runs | none | Needs the A.1 exception; a point that exceeds its bound is recorded, not retried |
| Re-smoke at all tiers, E5 rerun, handover refresh | about 1.5 h machine time | — | Needs a quiet machine |

**Bench 1 duration, before any of this.** Scaled from the handover smoke's per-run costs (a
planning model, not evidence): about **6–12 h** for the tiers and fixed phases. grid-XL's F3/F4/F8
alone is 2.4–6.6 h, driven by 33 runs × (61 accepted results + 300 drag inputs) at about 3.9 s per
accepted result. The sweep latency rows add about 0.6 h for the museum and 1.9 h for the H10
orbit. The **H10 drag row cannot complete** (F2). The proposed extensions add under an hour.

## 5. Mandatory, optional, deferred

| Scope | Items | Justification |
| --- | --- | --- |
| **Mandatory before Bench 1** | All-visible Plan and 3D windows with F7 from Fit; CPU render time, GPU timer probe and compatible-bin census; post-GC heap and per-commit ownership counts; the remaining pair-loop and global-pass counters; connected sweep variant C in E5 | Each closes a confound (F6) or identifies one of the four decisive axes, at under an hour of pass time |
| **Optional before Bench 1** | Scale census to 10k Rooms (needs the A.1 exception); logical repetition census; C10 in the sweep latency rows | Agent-time only, with no pass cost except C10. They locate the scale wall but do not change Bench 1's rows |
| **Deferred to between Bench 1 and 2** | The execution-plan lab (Plan vectors, merged or instanced 3D), under its own approved plan | Paired comparisons need no Bench 1 baseline; Bench 1 decides which candidate to build |
| **Deferred beyond S06** | Hierarchy, streaming, town navigation, WebGPU, HLOD, labels, precision encoding, content-identity change | No implementation exists to measure; they stay research and owner proposals |

## 6. Owner decisions

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Approve the mandatory extensions in §5 as an S06 C amendment (they supersede PR #189's C.1 text where they differ) | Approve |
| D2 | Grant the A.1 assembly exception for a Node-only scale census, with no browser admission in the passes | Approve, Node-only |
| D3 | Add sweep variant C (connected, with Openings) to E5; decide whether C10 also joins the sweep latency rows (+≈2 h) | Add C to E5; leave the rows at museum ×1 + H10 for Bench 1 |
| D4 | The H10 drag row, which crashes the tab: (a) record a crash in a report-only row as a bounded failure row and continue; (b) drop H10 drag from the sweep rows; (c) leave it, so the pass aborts near its end | (a), with hard-tier failures still failing the phase |
| D5 | grid-XL F3/F4/F8 (report-only) costs 2.4–6.6 h: full method, or one cache state (warm, about a third of the time) | Warm-only for Bench 1, full for Bench 3 |
| D6 | Approve a lab plan to be written after Bench 1 for Bench 2 | Approve the timing; review the plan separately |
| D7 | Merge PR #189 as research, with C.1 marked as superseded by this ruling | Approve |
| D8 | Chrome auto-updated from 153 to 155 during setup: pin and record the build for all three passes | Approve; the manifest already records the version |
| D9 | realistic-L stays unrun until per-source asset approval and an isolated API stack exist | Unchanged from setup |

**Recommended next action:** rule on D1–D9. The agent then implements the approved extensions
(about a day of agent time plus fixture generation), reruns the all-tier smoke check and E5 on the
new revision and refreshes the handover in the [acceptance record](./acceptance.md) with digests,
the frozen command and the updated duration. On the owner's direction (2026-10-24), the agent
then starts Bench 1 itself on the designated machine, detached and without waiting for it, and
its task ends there. Everything else about the pass is unchanged: the owner rules on whether it
counts (A.7).

## 7. Rulings and implementation (2026-10-24)

The owner approved D1–D9 as recommended. PR #190 implements D1–D5 and D8 as the plan's C.2
amendment. D6 (the lab plan) follows Bench 1, D7 (merging PR #189 as research) is left to that
PR's owner, and D9 is unchanged. On the owner's direction the agent then starts Bench 1 itself;
the [acceptance record](./acceptance.md#bench-1-launch) records the launch.

Implementing the extensions and the re-smoke produced five findings. They refine §1, which stays
as the owner ruled on it.

| # | Finding | Label | Consequence |
| --- | --- | --- | --- |
| F8 | Every browser timing and heap figure in §1 (F1, F2, F4) came from a **Svelte dev-mode build**. `vite-node` sets `NODE_ENV=development`, and the bench's `vite build` inherited it: all 38 client chunks carried dev metadata, against 0 in a clean build. The draw, mesh and work counts (F3, F5) do not depend on it. | harness defect, fixed | The bench now strips `NODE_ENV` from every child and refuses a build with dev markers. The re-smoke on the production build replaces those figures. |
| F9 | The open's superlinear term is in **Stage mount, not admission**. In Node, grid-XL admission takes 0.6 s. Of the 23.0 s browser open on the production build, about 86 % of self time is one native DOM insertion: Threlte's Context inserting its children fragment (Svelte's comment anchors) into the `<canvas>` element. It grows ×4.4 from L to XL. | agent probe | This corrects F1's consequence. The H3 pair loops are not the open's dominant term. Bench 1's per-stage spans and traces measure it. |
| F10 | Per move, the planner's superlinear self time from L to XL (N doubles): the topology gates' Junction×Junction and Wall×Wall loops (`validateWallFirstTopologyPass` ×4.6, `chordFailure` ×4.4, `coincidenceFailure` ×6.7), `bounds2` ×7.5, `cacheKeyOf` ×3.9, and linear Junction lookups in `wallFirstWallSpan`. | agent probe | These loops are now counted (`pairs:junction-junction`, `pairs:wall-wall`, `lookup:junctions`, `cache-key:chars`). Bench 1 can fit time against them. |
| F11 | Scale census (D2), connected grid-L tiles in Node. **1k** (1,176 Rooms, 2,422 Walls and Openings): admitted in 2.4 s; one per-move plan 3.8 s; peak RSS 3.1 GiB. **3k** (3,136 Rooms, 6,384 Walls and Openings, 16 MB source): admitted in 9.6 s, with 93 M pair visits and 4.4 G cache-key characters; one per-move plan 22.6 s, with 9 whole-document passes, 185 M pair visits and 124 M Junction lookups; heap after 3.6 GiB, peak RSS 5.3 GiB. **10k** (9,604 Rooms, 19,404 Walls): admission ran out of the 12 GiB Node heap after about 30 s. | census, not timing | Per-move planning grows about ×6 for ×2.7 Rooms, and memory is the first wall at 10k, before any browser. The F10 loops and the cache keys are the counted candidates. Product rows stay at S–XL and the sweep. |
| F12 | On the production build, sweep-H10's F3/F4/F8 row **completes** instead of crashing the tab (heap 898 MiB after the open, 1,475 MiB after the sequence). D4's bound does not trigger. Each H10 run costs about 24 min: a 173 s open, then about 11 s per accepted result and about 2 s per drag input. | smoke, not evidence | As ruled, Bench 1 runs this row in all three cache states, about 13 h of the pass. The acceptance record gives the total. Limiting it the way D5 limits grid-XL would need a new owner ruling. |

[synthesis]: https://github.com/Biskiq/spatial-sketch-editor/blob/103fc631/broad-research/all-visible-editing-and-town-overview.md
[proposal]: https://github.com/Biskiq/spatial-sketch-editor/blob/103fc631/docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/scale-measurement-proposal.md
[c1]: https://github.com/Biskiq/spatial-sketch-editor/pull/189

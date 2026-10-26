# Native creative depth: response to peer review

**Research date:** 25 October 2026  
**Status:** An evaluation of five review hypotheses and the revisions they caused. It decides nothing for the owner, releases no scope and admits no dependency.  
**Package:** [Native creative depth](./README.md) · labels follow the package's [evidence conventions](./README.md#3-how-to-read-the-evidence)

A peer review of this package raised five hypotheses. The review said they were not authoritative decisions, and it asked for an independent evaluation: defend conclusions where the evidence warrants, revise where it does not, and keep disagreements visible. Each section below gives:

- the hypothesis;
- what was checked;
- a verdict: **accepted**, **accepted in part**, or **not verified**;
- any pushback;
- what changed;
- what stays open.

[Section 6](#6-what-the-review-did-not-raise) lists what the review did not raise. [Section 7](#7-disagreements-and-uncertainties-kept-open) keeps the remaining disagreements in one place.

## 1. Geometry benchmarks

**Hypothesis.** The TypeScript, Manifold and OCCT comparisons mix different operations and implementations. Does the evidence support the performance and Rust/WASM conclusions?

**Checked.**

- Every probe script was audited.
- A matched probe was run: one identical meshed, copied-out wall through seven routes, with warm-up, repeated runs, p50 and p95, and validity checks.
- Biskiq's production wall compiler and mesher were timed on the same fixture.
- Every other cited probe was re-run, and all results are published in [probe methods](./probe-methods.md).

**Verdict: accepted.** The headline row set a Manifold extrusion without copy-out (0.69 ms) against sequential OCCT cuts without tessellation (777 ms). It mixed representation, algorithm, implementation and output completeness. The 0.69 ms was also Manifold's WASM, not plain TypeScript, which the README partly obscured. The Rust/WASM sentence ("no isolated CPU bottleneck justifies Rust/WASM") claimed more than the probes could show: no custom module was measured, and no Biskiq hot path had been probed.

**Pushback, on the direction, not on the method.** The conclusions the package drew survive on the matched evidence, in narrower form:

- **Construction beats general booleans within each library.** Manifold took 1.29 ms by extrusion against 3.5–3.7 ms by boolean. OCCT took 120 ms against 199–717 ms.
- **OCCT is blocked regardless of speed.** Its licence is LGPL-2.1, and its WASM is about 4.9 MB brotli.
- **Plain JavaScript is not automatically better.** three.js matched Manifold's time, but its output had T-junctions.

**The narrowed claim.** The research found **no evidence that meets the North Star's Rust/WASM gate**, and the cheapest levers it found are algorithmic. That is a statement about the evidence, not a finding that Rust/WASM is unjustified. Manifold is itself C++ compiled to WASM; the gate concerns a purpose-built module.

**Changed:**

- [probe methods](./probe-methods.md), which is new;
- [geometry §1](./geometry-identity-and-performance.md#1-findings-in-brief), §3, §4, §8 and §9;
- README findings and technical base;
- synthesis §1 and §3;
- proof [P6](./proof-agenda.md#p6-evaluator-placement-and-the-kernel-question).

**Open:**

- browser and laptop A/B measurements;
- S06's harness on real fixtures;
- whether opening-dense, arched hosts occur in real projects.

## 2. XYZ drawing

**Hypothesis.** Should basic spatial drafting be distinguished from unrestricted 3D chains? Basic drafting means vertical lines, tilted or offset planes, and axis constraints. It may be foundational even if unrestricted chains are deferred. Is P2 sufficient to establish that boundary?

**Checked.**

- [PLATE §0.8.4](../../docs/reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination): Ink and its readings, the Height Sheet, the drawn vertical Slice, the height ray, and the axis-ray mark.
- The original study's [§4.1](../spatial-modeling-depth-research-2026-10-25.md#41-spatial-ink-three-dimensions-with-understandable-depth) and its capability table.
- Vellum's drawing grammar.

**Verdict: accepted.** It also corrects an overstatement in this package. The original study already treated "draw on a visible face or plane; pull a line vertically" as the first-hour baseline, and it said "the priority is a reliable drawing context". The package's "challenge" to that study was broader than the actual disagreement. The disagreement is narrower: whether arbitrary workplanes and cross-plane chains belong in the foundation.

**O** **What PLATE already ratifies as drawing surfaces:**

- the ground;
- a raised sheet at any height, which is a horizontal offset plane;
- a wall face, including a curved one;
- the height ray, which is a vertical pull;
- the drawn vertical Slice, but only as temporary inspection ("never source");
- axis rays, as a transformation mark.

**What is missing:**

- (a) axis locks during an Ink stroke in 3D;
- (b) vertical linework as source;
- (c) planar faces of other hosts as drawing surfaces at any orientation: roof planes, ramps, an object's sloped top;
- (d) planes offset from a host face;
- (e) a free plane not on any host, for example hinged on a picked edge;
- (f) unrestricted cross-plane chains.

**I** **Position.**

- **(a)–(d) are basic spatial drafting and are foundational.** They fit "draw on things", because each adds precision on, or relative to, an existing surface.
- **(e) is a candidate.** It is the first rung that needs a persistent workplane object, so it must earn its place.
- **(f) stays deferred.**

**Is P2 sufficient? Not as first written.**

- It lumped (b) to (e) into one "explicit workplanes" condition.
- It had no vertical or axis-locked task.
- Its falsifier, two or more tasks impossible, could not locate a boundary.

P2 is now a capability ladder with tasks and a falsifier per rung.

**Pushback.** "Foundational" should not be read as "a general workplane system first". Axis locks and host-face drafting need no workplane object. Only rung (e) does.

**Changed:**

- synthesis §1, §3, §5 and §6;
- [P2](./proof-agenda.md#p2-a-drafting-ladder-from-host-surfaces-to-free-chains), rewritten;
- handoff D6 and tranche B;
- README.

**Open:**

- whether vertical linework is ever source, as opposed to an object: a post is a Shape, a cable is linework;
- whether tilted host faces become a reading per host class. PLATE's list names ground, raised sheet and wall face, and adding faces would be an owner decision.

## 3. Compound roofs and spiral forms

**Hypothesis.** P3's roof work left joined gables, valleys and localized protrusions unresolved, and the spiral railing raises the question of native geometric depth. Are these specialist capabilities, or could bounded versions emerge from the language? What would prove either position?

**Checked.**

- Vellum's [roof footprints record](../../prototypes/p3-vellum/plans/roof-footprints-final-polish.md): the supported families, the limitations and the deferrals.
- The Vellum README.
- This package's capability map and anchor case.

**Verdict: accepted in part.** There is a correction of fact, and a correction of this package.

**O** **The fact.** P3 resolved more than the hypothesis says:

- Two compatible gables (same eave, pitch, hip and fit) join into one roof with a valley. The join previews on hover and is one undo step.
- L, T, U and plus plans with up to four rectilinear wings get wing roofs whose eaves stay level and whose valleys meet.

P3 deferred these:

- joins across families, eaves or pitches, which need "true surface–surface intersection";
- off-axis, curved or freehand plans, and plans of more than four rectangles;
- courtyards;
- stepped or one-sided wing sections;
- dormers and lean-tos, as "new massing semantics".

Read as dormers, bays and lean-tos, the **localized protrusions are unresolved**, as the review says.

**The package correction.** The capability map placed "complex roofs, winder and helical stairs" wholly under specialist work, while the anchor case is a spiral railing and the evidence argues for families that know their carriers. That was inconsistent.

**I** **Position.** Bounded versions plausibly emerge from the language. The native boundary is set by the **geometric operation** a case needs, not by the element's name. [Synthesis §6.1](./synthesis-and-direction.md#61-where-native-depth-stops-compound-roofs-and-helical-forms) gives the analysis:

- **Compound roofs.** A bounded roof family needs four parts:
  - per-edge planes over a footprint;
  - an upper envelope for joins, which is P3's own recorded production direction;
  - a straight skeleton for hips on arbitrary polygons;
  - dormers as features hosted in a roof plane's local frame, the roof analogue of an Opening in a Wall's (s, z) frame.
- **Spirals.** A helical stair needs no new depth:
  - an analytic helix carrier;
  - a sweep with an explicit frame;
  - a ruled band paired at authored stations;
  - treads distributed under a total-rise constraint.

**What would prove either position.** The new proof [P12](./proof-agenda.md#p12-where-native-depth-stops-compound-roofs-and-helical-stairs) runs two fixture corpora with stated pass conditions:

- **Bounded families win** if they cover a majority of ordinary cases without manual planes, refuse the rest in words, keep hosted features through edits, and meet the per-edit budget.
- **The cases are specialist** if common cases need general surface–surface intersection, solid booleans or free 3D chains, or if hosted features do not survive edits.

The coverage thresholds are decision points for the owner, not sourced numbers.

**Pushback.** Showing a case can be native does not make it worth scheduling. P12 informs placement; owner decision D12 sets the boundary. D1, D11 and P3/P4 evidence still govern whether a recipe should be proposed.

**Changed:**

- synthesis §6, with a new §6.1;
- creator evidence §4.1 and §4.3;
- proof P12 and fixtures F10 and F11;
- handoff D12 and B7.

**Open:**

- whether a robust straight skeleton is achievable in TypeScript under the licence rule (CGAL is GPL);
- the envelope's cost at the M scale;
- how much fair-curve work handrail easements need.

## 4. Current capability claims

**Hypothesis.** Saying Biskiq has already solved the SketchUp workflow overstates what is usable today. Geometric foundations should be distinguished from complete creator workflows.

**Checked.**

- The production compiler and mesher, including the probe in [probe methods §4](./probe-methods.md#4-results-the-matched-40-opening-wall).
- The T1.P02 [README](../../docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md) and the [S03 outline](../../docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s03-opening-family/implementation-plan.md).
- The [release list](../../docs/roadmap/now.md).

**Verdict: accepted. The gap is larger than the review says.**

**O** **The geometric foundation is in production:**

- curved Walls as cubic chains with arc-length frames;
- rectangular, rounded and pointed Openings cut analytically in the Wall's (s, z) frame, with no CSG;
- a mesh builder with metric arc-length UVs, reveals and role-tagged triangles that fails closed with structured issues and is shared with the visitor runtime.

The probe compiled and meshed a curved wall with 40 arched Openings without issues.

**O** **The creator workflow does not exist yet:**

- Wall drawing (S02) is held behind S06.
- Layout-core already plans Opening creation and deletion, but "none is wired to the editor".
- The Opening family slice (S03) is not authorized, and it explicitly excludes curved hosts.
- T1.P02's outcome draws straight Walls.
- Curve authoring waits for "the first curve-authoring slice", which no plan yet scopes.

A creator therefore cannot draw a curved wall or put a window in one today, and no planned slice yet delivers that.

**Pushback.** The geometric claim stands, and it matters. The hard part of the SketchUp pain is solved by construction, not by a boolean, so "generalize the host-local pattern, not a kernel" still follows.

**Changed:**

- wording throughout;
- the [status ledger](./synthesis-and-direction.md#2-status-ledger-what-exists-by-kind-of-evidence), which now has separate foundation and workflow rows;
- a reconciliation note in the [handoff §7](./roadmap-handoff.md#7-reconciliation-with-current-authorities-and-roadmap) that curved hosts are unplanned. That note is an observation, not a promotion.

**Open:**

- whether the owner wants curve authoring planned;
- whether brief B1's curved walls wait for it.

## 5. Source evidence

**Hypothesis.** The Reddit anchor thread is accessible and gives direct evidence of the author's manual workaround.

**Checked**, on 25 October 2026:

- a direct HTTPS request, which returned HTTP 403;
- the web-fetch tool, which refuses reddit.com;
- the in-app browser, which blocks reddit.com and old.reddit.com by policy;
- a web search, which found no index of the thread.

**Verdict: not verified.** The report is recorded, not adopted. The thread may well be readable by a person. This package does not quote or paraphrase content it could not read.

**Changed:**

- creator evidence §2 and §3, and the README limits, now record the reviewer's report and the access attempts;
- the anchor case is still described from matching threads, and says so.

**Why it matters, and how much.** The package's inferences from the anchor case rest on matching threads:

- a family that knows its carriers;
- a ruled band with arc-length pairing;
- an explicit frame mode.

A manual workaround, such as hand-drawn triangulation, would add a rung to the escalation ladder and strengthen those inferences. If the thread shows a different intention, the anchor framing should be corrected.

**Open.** Someone with access should paste the post and the workaround into PR #192 so that §3 can cite it directly.

## 6. What the review did not raise

1. **Curved hosts are unplanned.** The only planned Opening slice excludes them, and no curve-authoring slice exists ([§4](#4-current-capability-claims)).
2. **The relevant performance question is Biskiq's own evaluators on dense hosts, not one kernel against another.**
   - The production path took 3.3–9.3 ms p50 for one 40-opening wall in Node.
   - Meshing arched heads dominates.
   - S06 owns that path ([probe methods §4](./probe-methods.md#4-results-the-matched-40-opening-wall)).
3. **Validity must accompany speed.** Two routes produced open meshes:
   - earcut extrusion, with T-junctions;
   - three-bvh-csg, with 3,856 open edges on the wall.

   A fast, invalid mesh is not a cheaper route to the same result.
4. **The budget columns are project scales, not machines.** The first revision's "4, 8 and 16 ms" read as if they were machine tiers. The columns are S, M and L projects, judged on the designated M2.
5. **Production already designs identity by role.** The wall mesher's `Layout3dTriangleRef` gives every triangle exactly one pick owner. The owner is keyed by Room, wall segment and surface role (side, lintel, bridge), or by Opening and surface role (jamb, sill, lintel, arch reveal). That is the role-address policy at surface granularity, already shipped. It strengthens [geometry §5](./geometry-identity-and-performance.md#5-identity-and-correspondence) and gives P5 a production baseline.
6. **The package contradicted itself** on helical stairs and complex roofs ([§3](#3-compound-roofs-and-spiral-forms)).
7. **The original study already drew the drafting distinction** ([§2](#2-xyz-drawing)).

## 7. Disagreements and uncertainties kept open

| Topic | This package's position | Uncertainty | What resolves it |
| --- | --- | --- | --- |
| Rust/WASM | Not established. Schedule no custom module, because the gate is unmet | The probes cannot show the opposite either | S06 harness; P6 in browsers on laptop A |
| Workplanes | Basic drafting (a)–(d) is foundational. A free workplane (e) must earn its place | The review may see (e) as foundational too | P2 rung 4 |
| Roofs and helices | Bounded families are plausible. The boundary is set by operation | Unproven either way | P12 |
| Anchor thread | Unverified | Its content may change the framing | A pasted copy in the PR |
| P12 thresholds | Decision points for the owner | Not sourced | Owner ruling before P12 runs |

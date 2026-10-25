# Native creative depth and modeling: research package

**Research date:** 25 October 2026  
**Status:** Research and recommendations. No architecture ratification, production implementation, dependency adoption, or roadmap release.  
**Builds on:** [Deepening Biskiq without becoming another 3D modeling or BIM application](../spatial-modeling-depth-research-2026-10-25.md). That study is preserved verbatim; this package extends it and does not replace it.

## 1. Purpose and question

**Question:** How can Biskiq become a powerful yet effortless, self-contained environment for multidisciplinary spatial creation, without inheriting the complexity of traditional 3D modeling, CAD or BIM software?

**Guiding ambitions.** These are guiding ambitions, not predetermined technical solutions:

- Something convincing and beautiful in about fifteen minutes.
- Useful refinement of the same project over about ten hours.
- Sophisticated operations that feel natural.
- Native capability for most ordinary multidisciplinary tasks, with specialists served through interchange and assets.
- Responsiveness in ordinary laptop browsers.

## 2. Reading order

| Document | What it answers | Read it when |
| --- | --- | --- |
| [Synthesis and direction](./synthesis-and-direction.md) | The recommended direction; the status ledger; what is confirmed and challenged in the original study; the profile, carrier and rule language; the capability map; ownership seams; risks | First |
| [Creator evidence](./creator-evidence.md) | Where ordinary creation breaks in SketchUp and similar tools, including the spiral-railing anchor case, stairs, roofs, curved hosts, trim, objects, surfaces and patterns; what experts advise instead | You need the user problem behind a recommendation |
| [Approaches and precedents](./approaches-and-precedents.md) | Shapr3D and clay-like modeling; the direct-modeling lineage; signed-distance and sketch paradigms; procedural recipe systems; AI generation and assets; finishing and handoff | You need to know how others did it, and at what cost |
| [Geometry, identity and performance](./geometry-identity-and-performance.md) | Representation; operation feasibility; TypeScript, Rust/WASM and kernels, with measured probes; identity and correspondence; finish geometry; interchange | You need technical constraints |
| [Proof agenda](./proof-agenda.md) | Eleven ranked proofs with falsifiers; shared method and fixtures; sequence | You are commissioning evidence |
| [Roadmap handoff](./roadmap-handoff.md) | Readiness; capability tranches; dependency graph; owner decisions; planning-ready briefs | You are planning |

## 3. How to read the evidence

**Claim labels**, used throughout the package:

| Label | Meaning |
| --- | --- |
| **O** (observation) | A sourced fact: documentation, a forum case, a paper, a licence file, a repository file, or a measured probe |
| **I** (inference) | The research team's interpretation of observations |
| **R** (recommendation) | A proposed course of action for owner or planning consideration |
| **H** (hypothesis) | A claim to be tested; the [proof agenda](./proof-agenda.md) says how |

**Status terms for Biskiq capabilities**, defined in the [status ledger](./synthesis-and-direction.md#2-status-ledger-what-exists-by-kind-of-evidence):

| Term | Meaning |
| --- | --- |
| **Production** | Shipped on `main` |
| **Prototype** | Demonstrated in an accepted prototype; interaction intent, not authority |
| **Ratified destination** | Owner-ratified direction, not shipped |
| **Proposed** | Recommended by research |
| **Open** | A mechanism decision the authorities leave open |
| **Undecided** | Explicitly not yet decided by the owner |

**Probes.** Figures marked *probe* come from disposable local scripts run during this research, on an M2 with 16 GB in Node. They are orders of magnitude, not browser measurements. No script or package was added to the repository ([geometry, note on measurements](./geometry-identity-and-performance.md)).

## 4. The direction in one page

**R** **Make context the modeling tool.** Most custom form in an ordinary spatial project is context-dependent: it fits, follows, hosts or repeats. Biskiq already owns that context through its semantic structure.

Biskiq should build:

- a small language of **profile, carrier and rule**, composed into domain-owned families that validate and refuse in words;
- drawing **on things**, in readings, with carriers picked from hosts;
- **presentation depth** with equal standing;
- **found objects** as first-class content, with a light edit kit;
- **designed identity**, where families name parts by role.

**R** **The technical base:**

- TypeScript domain evaluators sharing small runtime-safe numeric modules.
- Manifold as the one gated, editor-only boolean option.
- No Rust/WASM.
- No heavy kernel in the visitor runtime.

### Most significant findings

1. **O** **The most documented SketchUp pain is already solved by Biskiq production code.** A window in a curved wall takes 4–14 steps there. Biskiq Openings are cut analytically in the Wall's own frame ([creator evidence §4](./creator-evidence.md#4-architectural-elements)). The gap lies in drawing, custom forms and presentation, not in hosting.
2. **O** **Many "modeling" failures are design errors** the tool cannot see: inconsistent rise and run, walking lines, winders. **I** Validation is a feature.
3. **O** **Expert advice is often to model less**: fake detail, import, simplify, accept representational accuracy. **I** Presentation depth is legitimate depth here, provided it survives free movement (**H**, P7).
4. **I** **One language covers ordinary objects and architecture.** Profile, carrier and rule describe a plinth, a lamp, trim, a railing and a roof. Vellum's overhead model already demonstrates it with stable profile-point identity.
5. **O** **No shipping system examined keeps per-member overrides through regeneration.** FreeCAD's tracker carries 156 issues labelled toponaming, with open ones dated as late as 23 October 2026. **I** Bounded families can avoid the problem entirely by naming parts by role from authored keys. Practice shows coarse identity usually suffices.
6. **O** **The clay-like feel is mostly portable interaction design**, and Shapr3D's newest Parameter Cards converge on Biskiq's ratified precision ladder. **I** Biskiq's version of B-rep healing is *semantic* healing, kept explicit and previewed.
7. **O, probe** **Domain construction is orders of magnitude cheaper than generic kernels.**
   - Plain-TypeScript sweeps, ruled strips and Coons patches each ran in under a millisecond.
   - A 40-opening wall took 0.7 ms as an extrusion with holes, against 777 ms as OCCT sequential cuts.
   - Only Manifold is an admissible solid kernel. OCCT is blocked by licence, and its WASM is about 19 times the visitor JavaScript budget.
8. **O** **AI now makes freeform props cheaply but fails at dimensioned, revisable structure.** CAD agents completed 17.5% of tasks, against 87% for experts. **I** AI and import serve context-independent objects. Native families serve the dimensioned layer, and they are also what agents operate.

### Where this confirms and challenges the original study

**Confirmed:**

- the five capabilities;
- equal standing for presentation;
- TypeScript first;
- identity as the hardest seam;
- recipes as selective.

**Challenged:**

- **Arbitrary-plane and cross-plane drawing as foundation.** The research favors drawing on things.
- **Rounding as research-gated.** Profile rounding is a baseline.
- **The adoption order.** Found objects and rounding move earlier.

The full table is [synthesis §3](./synthesis-and-direction.md#3-what-this-package-confirms-and-challenges-in-the-original-study).

### Decisions that need owner authority

The full list is in the [handoff §4](./roadmap-handoff.md#4-owner-decisions). The four that matter most:

- **D1:** the scope statement for native form relative to the "general-purpose geometry modeling" non-goal.
- **D2:** Scene parametric definitions as the home of native forms.
- **D4:** the identity policy, after P5.
- **D5:** the circle-on-wall alternative reading.

### Readiness

Ready for roadmap reconciliation as **research input**. Not ready for releasing implementation scopes or designing schemas. See the [readiness verdict](./roadmap-handoff.md#1-readiness-verdict).

## 5. Relation to the original study

The original study's sections stay authoritative as research input for what they cover. This package adds or replaces only where it says so explicitly.

| Original study section | This package |
| --- | --- |
| §3 evidence; §6–7 Hew and DraftDown | Not repeated. New community, paradigm and kernel evidence is added |
| §4 capability table | Re-weighted in [synthesis §3](./synthesis-and-direction.md#3-what-this-package-confirms-and-challenges-in-the-original-study) and [§6](./synthesis-and-direction.md#6-capability-map-native-asset-extension-specialist) |
| §8 architecture direction | Confirmed. Identity gets a concrete policy in [geometry §5](./geometry-identity-and-performance.md#5-identity-and-correspondence) |
| §9 technology | Extended with measured probes and a licence-checked operation matrix |
| §10 conflicts | A resolution path for circle-on-wall (D5) |
| §11 experiments | Refined by proofs P1–P11 |
| §12 adoption order | Re-weighted into capability tranches A–G |
| §13 drift; §14 open questions | Four drift risks added; several open questions narrowed |

## 6. Method, sources and limits

**Research passes.** Eight parallel passes were run:

1. architectural-element frustrations;
2. object, surface and pattern frustrations;
3. direct and clay-like paradigms;
4. procedural recipes and architectural intelligence;
5. geometry kernels and web implementation, with local probes;
6. editability and identity mechanisms;
7. challenge evidence on AI, assets and tool history;
8. finishing and interchange seams.

**Internal inspection.** The research also inspected:

- production `layout-core` types;
- the P3 Vellum model;
- PLATE §0.8.4;
- the North Star, architecture and Scene destinations;
- the licensing ruling;
- the release list;
- the geometry harvest;
- the procedural assessment;
- the Research 6 reconciliation.

**Sources.** Primary sources were used where reachable: vendor documentation, licence files, repositories, papers and forum threads. Each claim links its source inline.

**Limits:**

- Reddit was unreachable, so the anchor thread ([r/Sketchup](https://www.reddit.com/r/Sketchup/comments/1xcfrht/trouble_with_faces/)) is unverified. It is described from matching SketchUp threads.
- Several Autodesk and Graphisoft pages returned 403, so Revit evidence comes from search summaries.
- The shared web-search budget ran out during several passes. Gaps are listed at the end of each document.
- Forum counts are not prevalence.
- No survey quantifies how creators split time between modeling and sourcing. P11 addresses that gap.
- The kernel probes ran in Node, not browsers.

**Research notes.** The raw notes from each pass (about 500 KB) are not committed. Each document carries the sources it relies on.

## 7. Authority

This package is research input. It does not:

- amend the North Star, the architecture, the Scene contract or PLATE;
- release a scope, change the release list or register a proposal;
- admit a dependency, or choose a licence.

Canonical authorities remain:

- [`docs/README.md`](../../docs/README.md);
- the [North Star](../../docs/reference/north-star.md);
- the [architecture](../../docs/reference/architecture.md);
- the [roadmap](../../docs/roadmap/README.md).

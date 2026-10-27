# G0 — Expressive Geometry foundation architecture: commission

**Status: original approved commission retained as historical evidence; bounded G0 direction
ratified 2026-10-27** ([later ruling](../../reference/decisions/t5-g0-ratification-2026-10-27.md),
[original approval](../../reference/decisions/t5-g0-approval-2026-10-27.md)). The original brief below
is preserved. Its three-to-five-increment deliverable and post-G0 route do not prescribe current
milestones, slice counts or sequencing. [T5 tracking](./README.md) owns the current E0 decision and
authorization route; no E0 experiment, prototype, dependency or production implementation is authorized.
No complete architecture acceptance or independent review is claimed.

**Track:** [T5](../t5-expressive-geometry/README.md) · **Predecessor evidence:** S06 (PR #190, merged
`6af62eb4`) · **Decision owner:** the repository owner · **Executing role:** a commissioned
engineering architect, independent of the slice that wrote the prototypes

## 1. Why this commission exists

The product is moving from *drawing architecture well* to *creating and revising geometry*. S06
finished the architectural computation foundation — one canonical compiler, incremental evaluation,
retained Plan and representation, measured limits — and native-creation prototypes (PR #194, #196)
and depth studies (PR #192, #195) show the interaction the product wants next. What does not exist is
a defensible engineering answer for geometry that is **created, deformed, related and repeatedly
revised** without forking the document, the compiler, the acceptance path or the renderer.

The owner's product direction is that Biskiq supports effortless semantic and geometric editing in
World beside a dedicated Object Focus workspace for deeper, more precise and expressive modeling,
sharing one authored source, identity, relationships and history, with the drawing-first philosophy
preserved and the eventual capability not limited to today's prototypes
([decision](../../reference/decisions/t5-g0-approval-2026-10-27.md)).

The commission's job is that answer: one architecture the owner can ratify, with the alternatives and
costs that justify it.

## 2. Scope and non-goals

**In scope**

- constructive solid operations (union, difference, intersection, and the modeling operations that
  follow from them);
- robust curves and surfaces — representation, continuity, offsetting, trimming, intersection;
- freeform deformation and direct shape modification;
- geometric relationships and constraints (coincidence, tangency, parallelism, dimensional intent)
  at the level needed to keep edits predictable;
- **correspondence**: how a repeated revision identifies "the same face/edge/vertex" so history,
  selection, dimensioning and downstream consumers survive an edit;
- durable revision: what is stored, what is recomputed, and how an accepted change is replayed;
- the mathematical/kernel/library strategy behind all of the above, including permissive third-party
  geometry and WASM/native kernels where measured need justifies them.

**Out of scope (do not commission work here)**

- a tool UI, panel layout, interaction prototype or another UX artifact — the shell authority and
  interaction evidence are named in §5;
- a second authored document, source format, history store or acceptance authority;
- rendering-architecture replacement, WebGPU migration, HLOD, streaming or town navigation;
- performance re-baselining of S06's rows, or a new benchmark campaign;
- any production implementation, dependency admission or package scaffolding.

## 3. Evidence base to start from (verify, do not trust prose)

| Input | What it contributes | Merge / identity |
| --- | --- | --- |
| S06 acceptance + contract | accepted compiler/Plan/representation baseline, measured limits, follow-ons | PR #190, `6af62eb4`; product candidate `d89554b1` |
| Native Form Lab | the creative interaction the product wants: contextual creation and retained revision | PR #194, `db738064` |
| Native object shaping | shape manipulation and Object Focus interaction evidence; durable in [`prototypes/native-object-shaping/UX-SPEC.md`](../../../prototypes/native-object-shaping/UX-SPEC.md) | PR #196, `4a1ff08d` |
| Depth prototypes | depth/shape design evidence | PR #195, `51dcb764` |
| Spatial modeling depth study | design and terminology package | PR #192, `de2f8423` |
| World-scale architecture study | alternatives, falsification ideas, long-term scaling | PR #189, `4dcd53e9` — **historical research**, ratios are hypotheses |
| `reference/architecture.md`, `reference/composition-execution.md` | ownership, F contracts, F2/F4 laws any design must satisfy | live contracts |
| [PLATE shell contract](../../reference/design-system/editor-shell-and-visual-system.md), Vellum ([`prototypes/p3-vellum/DESIGN.md`](../../../prototypes/p3-vellum/DESIGN.md)) and Shape Focus | ratified shell authority and interaction evidence for feel/operation vocabulary; design evidence, not production implementation | product design authority |

Prototype code is **evidence about intent and feasibility**, never production authority: it must be
re-read against current `main`, and no prototype module is promoted by citation.

## 4. Required deliverables

The architect returns these as one architecture package (§7). Each is required.

1. **One recommended architecture**, with the two or three serious alternatives it beat, the criteria
   used, and the conditions that would falsify the recommendation.
2. **Representation strategy**: which geometric representations are authoritative (exact, procedural,
   mesh, hybrid), how tolerance and identity are handled, and how robustness is achieved without
   silently changing accepted arithmetic where F contracts govern it.
3. **Kernel and library strategy**: what is built in-house, what is consumed, licensing status under
   the repository's permissive-only rule, and whether WASM/native kernels are justified — each with
   the measurement or analysis behind it, not a vendor claim.
4. **Ownership and integration boundaries** against S06's compiler and Plan, Layout units and
   topology, Scene objects/definitions/instances, F2/F4 acceptance and history, capture/Save, the Stage
   and the shared renderer, and T4 delivery. State whether any cross-domain interface requires an F
   amendment, and what its shape would be.
5. **Editable operation and correspondence model**: the operation graph or equivalent, how a repeat
   revision preserves identity, how correspondence is invalidated and rebuilt, how it survives
   acceptance/Undo/Redo and Save, and why the result is not a mesh-only dead end.
6. **Incremental evaluation and invalidation requirements**: what is recomputed per edit, what is
   retained, the expected growth with project size, and the interactive budgets that follow for an
   ordinary laptop browser. Reuse S06's measurement method and its recorded limits; do not invent a
   parallel method.
7. **Implementation-ready sequence**: the first three to five deliverable increments, each with the
   real consumer it serves, the acceptance evidence it must produce, the measurable criteria that
   decide success, and the point at which it becomes production-owned capability rather than a lab.
8. **Risk and falsification register**: where the architecture is most likely to be wrong, the
   experiment or differential that would show it, and what would be re-scoped rather than patched.

## 5. Creativity constraints (deliberately open UX)

**Product direction (owner, 2026-10-27).** Effortless semantic and geometric editing in World beside
a dedicated **Object Focus** workspace for deeper, more precise and expressive 3D modeling; both
share one authored source, identity, relationships and history; the drawing-first philosophy and its
progressive learning curve are preserved, and the eventual capability is not limited to what today's
prototypes demonstrate. The architecture must serve that direction while the final Object Focus UX
and technical architecture stay open — this commission prescribes no kernel, language, operation set,
representation or feature sequence
([decision](../../reference/decisions/t5-g0-approval-2026-10-27.md)).

The architecture must be able to express the creative intent already evidenced — immediate
contextual creation, progressive mastery, deep repeatable revision, and manipulation that feels
direct — **without** prescribing a tool, panel, mode or menu design. Final UX stays open and stays
with its ratified owners:

- PLATE's shell authority is ratified; do not re-litigate the shell.
- Vellum and Shape Focus are interaction evidence for feel and operation vocabulary; treat them as
  requirements input, not as an implementation to port.
- Define **creative-operation semantics** precisely enough to engineer and test (what a bevel, an
  offset, a deformation or a constraint means, and what happens on failure); leave presentation open.

## 6. Decision authority and constraints

The architect **may** recommend: a representation mix, a kernel/library set, package boundaries,
persistent versus recomputed state, an F amendment shape, and a phased delivery sequence. The
architect **may not**: ratify a contract, admit a dependency, register a phase, release a slice,
create a persisted format, or change S06's accepted behavior. Those stay owner or owning-track acts.

Every recommendation must respect Layout and Scene as distinct authored authorities, introduce no
competing authored source or duplicate Layout compiler, and preserve the accepted F2/F4 semantics and
refusal behavior, the visitor isolation boundary, the full-permissive licensing rule, and the
requirement that an accepted revision is reproducible byte-for-byte where today's contracts require it.

## 7. Form of the deliverable and review

- Write the architecture as its own artifact under `docs/roadmap/t5-expressive-geometry/g0-*/`,
  linking (not copying) the evidence above, and keep this commission unchanged except for a
  status line the owner may direct.
- Record measured claims with revision, machine and command; label analysis and prototype findings as
  such. No unmeasured speedup or scalability claim is accepted as architecture evidence.
- Expect an independent review of the architecture against the deliverables and the contracts before
  the owner ruling; unresolved findings are reported, not absorbed.

## 8. Authorization route after G0

```text
OWNER DECISION      approved 2026-10-27; G0 starts once PR #198 merges (no implementation)
ARCHITECTURE        the package above, independently reviewed
OWNER RULING        accept, revise or reject; F amendment + licensing decisions if the design needs them
REGISTRATION        first T5 phase + slice plan with a real consumer and measurable acceptance
RELEASE             owner release-list entry; implementation starts only then
```

Nothing in this brief shortens that route, and no G0 output authorizes implementation by itself.

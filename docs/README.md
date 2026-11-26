# Biskiq documentation

**Start here.** Code and tests establish landed behavior. The eight `docs/reference/` contracts state
semantic authority, invariants and tolerances. [design-system.md](./design-system.md) owns the shared
shell and Stage grammar. [prototypes/README.md](../prototypes/README.md) routes each surface to its
approved visual target. [plans/README.md](./plans/README.md) holds active multi-PR blueprints only.

## Contract and visual router

| Code or concern | Read |
| --- | --- |
| Routes, platform, semantic owners, F.1–F.4, Stage adapter seam | [architecture.md](./reference/architecture.md) |
| `packages/layout-core`, Walls/Spaces/Regions/Openings, Plan compiler | [layout.md](./reference/layout.md) |
| `packages/project-model` Scene, placement, Finishes, `surfaceFinishes` | [scene.md](./reference/scene.md) |
| `packages/camera-core`, Views, routes, motion, Guide time map | [camera.md](./reference/camera.md) |
| Experience unit, Presentations, Guides, interpreter, accessibility | [experience.md](./reference/experience.md) |
| `packages/geometry-core` Forms, P20 images, material resources, libraries, licensing | [resources.md](./reference/resources.md) |
| `apps/editor/src/lib/render`, `lib/visitor`, renderer and frame work | [rendering.md](./reference/rendering.md) |
| `apps/api`, codecs, Save/Load, source admission, release baselines | [persistence.md](./reference/persistence.md) |
| `apps/editor/src/lib/authoring`, Stage route, adapters | [architecture.md](./reference/architecture.md#shared-stage-seam) |
| UI surfaces and responsive states | [prototypes/README.md](../prototypes/README.md) |
| Shared shell, coexistence, marks | [design-system.md](./design-system.md) |
| T1/T2/T4/T5 remaining work | [plans/README.md](./plans/README.md) |
| Tests, lanes and browser QA | [apps/editor/tests/README.md](../apps/editor/tests/README.md) |
| Harness profiles, CI and merge automation | [tools/harness/README.md](../tools/harness/README.md) |
| Long-term research and historical spikes | [broad-research/README.md](../broad-research/README.md) |

Read only the owning section needed for the task. Routine implementation does not require a
reference edit. Update a contract for an actual contract change, an accepted design promotion, a
material contradiction or a deliberate audit — replacing old text rather than appending amendment
history. Put a single-PR plan on its PR; keep a multi-PR blueprint here only while it is active.

## Core domain terms

- **Space / Room.** A Space is the product word for the persisted `Room` record. A Room is enclosed
  when its required `virtualEdges` list is empty and open when it states straight virtual edges
  between existing Junctions; `overhead` is `closed` or `open-to-sky`. Geometry, area and floor stay
  derived. An open Space wholly inside an enclosed Room is the one admitted containment (booth in
  hall); other overlap refuses. The collection and type keep the name Room.
- **Horizontal Region.** A flat Layout slab with a counterclockwise footprint, positive thickness and
  a datum-relative elevation. **A floor region's elevation is its top; an overhead region's elevation
  is its underside.** That datum difference is the whole distinction — not a second kind. Generated
  Room floor/lid planes remain separate derived geometry; a Region can span Spaces or sit outside
  them.
- **Presentation / Stop / Guide / View.** A **Presentation** is reusable Experience composition: an
  ordered list of Camera Views, optional subject/text and `explorable`. A **Stop** is one authored
  Guide occurrence referencing a Presentation, with an entry View, stay, invitation and outgoing Cut
  or Travel. A **Guide** is one linear order of Stops with its pacing. A **View** is Camera-owned
  spatial attention (pose/framing, projection, evaluation). Repeated visits add session invocation
  identity; none of the three authored identities substitutes for it.
- **Finish / Material family.** A **Finish** is `{id, name, base, overrides?}` — a curated catalogue
  or project material plus sparse treatment overrides — assigned to objects or Layout surfaces. A
  **Material family** owns the source grammar, evaluator and declared target requirements for one
  kind of appearance; `pbr-metallic-roughness/v1` is the first, not a universal material format.
  Procedural source survives its bakes; a bake is a reproducible derivative, never silent authored
  truth.
- **Focused context / Object Studio.** A narrowing of the same application, project, selection, Undo
  and Save to one subject or task with tools suited to it. Object Studio is the first focused scope;
  it exposes domain capabilities, never its own copy of material, geometry or history.
- **F2 `ProjectEnvelope`.** The one live source: accepted revision, dependency lock and exactly one
  codec-bounded unit each for Layout, Scene, Camera, Experience (collection-capable) and typed
  resources. The envelope coordinates; it is not another domain authority.
- **Authored / evaluated / session.** Authored source persists; evaluated geometry, routes, meshes and
  descriptors are derived and reproducible; selection, clocks, runs, proposals and history are
  session-only. The three lifetimes never collapse into one storage layer.
- **Approved visual target.** A runnable specimen that owns feature layout, controls and responsive
  states for its surface. A donor or study preserves evidence but is not current UX authority.

## Planning non-trivial work

These are distilled from T1, T2 and S8; they are guidance, not a process gate.

1. **Separate wiring gaps from inventions first.** If the capability already exists in `packages/*`
  planners and only exposure is missing, ship the UI over the proven operation as a direct PR with no
  planning document. Write a blueprint only for unbuilt semantics, cross-domain contracts or a
  multi-PR programme.
2. **Falsify the riskiest assumption with a cheap probe before locking a schema.** Test the boundary
  that would invalidate the format — S1's neighbour-opening limit, S2's corner collapse, S0's indoor
  sky leak and byte-128 colour transfer, an import's UV or tangent failure — then commit the
  encoding. A probe belongs on the PR or in `broad-research/`, not in a contract.
3. **Decouple capability proofs from final UX when their uncertainties differ.** Prove codecs, pins,
  recovery and multi-backend rendering in vertical slices first; explore and approve UX in
  interactive `prototypes/` specimens over the real capabilities and limits. A capability proof does
  not wait for a visual decision, and a visual target does not promise an unimplemented operation.
4. **Keep multi-PR blueprints only while active.** Plans live in `docs/plans/<programme>/` with their
  remaining scope and deletion condition; single-PR plans, closeout reports and screenshots live on
  the GitHub PR. Keep enduring design authorities in `docs/design-system/`, not in a programme
  folder: T1's interaction sketches and T5's Object Studio journeys live there. T4's unbuilt release
  design stays with its active programme until the capability lands or the owner retires it.
5. **Preserve the non-obvious.** When consolidating, keep tolerances, rationale, named exceptions and
  open seams even when the implementation detail moves. A contract that merely restates a destination
  essay or a format integer duplicates code and will drift.

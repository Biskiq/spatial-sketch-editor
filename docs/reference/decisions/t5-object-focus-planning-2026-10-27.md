# T5 E0 withdrawal and Object Focus planning — 2026-10-27

**Status:** the owner's E0 withdrawal is recorded as a ruling. The planning direction, the
registration of `T5.P01` and the approval of its first slice plan are proposed by the T5 planning
PR and take effect only when the owner merges it. Two owner amendments made in that PR's review —
[T5 dependency licensing](#owner-amendment-t5-dependency-licensing) and
[reusable native objects](#owner-amendment-reusable-native-objects) — take effect with it. Merging
releases nothing: the [release list](../../roadmap/now.md) is unchanged and owner-written.

This record owns what was decided and what merging does. The
[T5 umbrella plan](../../roadmap/t5-expressive-geometry/umbrella-plan.md) owns the architecture and
roadmap; the [T5 track README](../../roadmap/t5-expressive-geometry/README.md) owns objectives and
the phase register; [T5.P01](../../roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/README.md)
owns its slice register.

## Owner ruling: E0 withdrawn

The owner rejected the E0 guide/arrangement experiment as insufficiently valuable for T5's
direction. The [E0 execution plan](../../roadmap/t5-expressive-geometry/e0-execution-plan.md)
(PR #205) is withdrawn and superseded; it stays at its path as historical evidence with a
withdrawal notice. [PR #206](https://github.com/Biskiq/spatial-sketch-editor/pull/206), which
implemented its disposable `prototypes/e0-spatial-playground`, was closed without merge on
2026-10-27. Nothing from E0 is product, contract, format or roadmap authority.

**Preserved evidence.** PR #206's head `12821a1d8b1f9d48261ea66ce51be9efc55bc33f` remains
retrievable through the pull request (30 files: the playground, 20 model tests, example designs, a
blank decision-note template and its run instructions). Its own report recorded the finding worth
keeping: with one guide per document, the explicit path's source was always unambiguous and
prefilled, so once a source was chosen the two entry paths converged; what remained was a
persistent context against tools plus an inspector. Relocating controls is not a creative
advantage, and composable guide context did not earn T5's first investment. No owner decision note
or creator result was recorded.

**What stays.** The [North Star's creative-freedom principles](../north-star.md#creative-freedom-and-depth),
the [architecture obligations](../architecture.md#expressive-creation-and-revision-destination) and
the Scene, persistence and assets destination sections promoted by the
[G0 ratification](./t5-g0-ratification-2026-10-27.md) are unchanged. Contextual creation and
composable relationships remain principles; they are no longer T5's first experiment. The G0
proposals remain historical evidence.

## Working direction and planning response

The owner's working direction is a dedicated Object Focus workspace for creating, shaping and
refining 3D objects, sharing Biskiq's visual language and project architecture, treated as a
design hypothesis. The umbrella plan answers it with native forms: Scene-owned objects whose shape
is authored source, created by drawing in World and refined in Object Focus. It challenges one part
of the hypothesis: Object Focus becomes a **scope on the one Stage**, not a separate workspace,
because PLATE and the architecture require one Stage, selection, history and Camera, and a
separate studio would be built twice. The studio qualities — isolation, framing, sections on paper,
a bounded tool set and a faithful return — are kept inside that scope.

## Owner amendment: T5 dependency licensing

Biskiq's product licence remains undecided, and this amendment selects none. For dependencies
admitted through T5 plans, it supersedes the
[2026-10-23 permissive-only admission rule](./post-batch-e-authorization-2026-10-23.md#licensing-direction):

- **Permissive licences** stay admissible as before, recorded in the admitting slice's acceptance.
- **Weak-copyleft licences** (LGPL-2.1, LGPL-3.0 and MPL-2.0, including LGPL with an exception such
  as OCCT's) are eligible for consideration and adoption after the documented review below. The
  review is part of the admitting slice plan, which the owner approves before the library is
  installed.
- **Strong copyleft** (GPL, AGPL), source-available or field-of-use terms, and missing or unclear
  licences still stop and are reported to the owner.

Other tracks keep the 2026-10-23 rule. The 2026-10-23 record and the
[S06 narrowing](./performance-foundation-authorization-2026-10-24.md#full-permissive-licensing) are
preserved as written; S06 is shipped and its narrower list stays its own.

**Weak-copyleft admission review.** The admitting slice plan documents, and its acceptance records:

1. **Identification:** the SPDX expression and any exception, the exact pinned version, and the
   licence of every shipped component, including vendored and WASM-compiled sources.
2. **Distribution:** how the code reaches users — browser bundle, separately loaded WASM module,
   worker or server only. Delivery to a browser is distribution.
3. **Obligations and how each is met:** licence text and notices shipped with the product; the
   corresponding source of the exact version and of any modification offered. For LGPL, the
   library ships as a separately loaded, replaceable module with build instructions, so a user can
   substitute a modified build. For MPL, modified covered files stay separate and their source is
   offered.
4. **Compatibility:** the dependency forecloses no plausible product licence (proprietary,
   permissive or copyleft), any MPL "Incompatible With Secondary Licenses" designation is checked,
   and no strong-copyleft component is shipped.
5. **Modification policy:** unmodified upstream is preferred; any patch is published with its
   source.
6. **Change:** a version, licence or distribution change repeats the review.

A candidate whose obligations cannot be met in the shipped build stops. Where the review leaves real
doubt, it stops for the owner, who may seek legal review. The review identifies obligations; it does
not by itself select a library.

**OCCT.** OCCT (LGPL-2.1 with the Open CASCADE exception) is a legitimate future candidate for the
B-rep route, not blocked by its licence category. It is judged against capability, browser
performance, integration cost and compliance obligations when a named precision capability needs
it ([umbrella plan §5.4](../../roadmap/t5-expressive-geometry/umbrella-plan.md#54-computation-strategy-admitted-routes)).
The same applies to MPL implicit-field candidates such as Fidget and libfive. Nothing is installed or
selected.

## Owner amendment: reusable native objects

The owner commits this creator workflow: **Save to My Objects → open another project → insert an
editable copy → refine independently.**

- My Objects saves a form's authored source — generator controls, keys, scale and its catalogue
  material — never a generated mesh.
- It is the first bounded consumer of the ratified **library scope** of the one typed resource
  system ([assets destination](../components/assets.md#ratified-destination-not-shipped)), following
  T2's landed identity and persistence rules: a logical identity, an immutable content-addressed
  revision, owner-only access, strict server-side validation through the shared codec, and storage
  outside authoring history.
- Inserting a copy creates a new authored identity, as the destination requires for detaching to
  edit independently. The copy carries no reference to the library item, so later edits on either
  side never reach the other.
- Shared instances, offered updates, item revisions, rename, folders, search and sharing wait.

**No versioning until beta (owner ruling, 2026-10-27).** Library items follow the general
[pre-baseline rule](../north-star.md#development-stage-schema-compatibility-pre-baseline): each item
records its format number, readers are strict, and no upgrader, migration or tolerant reader is
built. When a format change leaves stored items on an older number, My Objects still lists them,
marked as made with an earlier development version; they cannot be inserted, and Remove stays
available. Versioning and migration obligations for projects and library items start at **beta
release**, which the owner declares as the baseline; that is when format changes begin shipping
migrations.

## Effect of merging the planning PR

Merging is the owner's approval of:

1. this record of the E0 withdrawal and the evidence above;
2. the [umbrella plan](../../roadmap/t5-expressive-geometry/umbrella-plan.md) as T5's planning
   direction. It is roadmap authority, not a reference contract: the North Star, architecture,
   Scene, persistence and assets contracts, F, PLATE and the performance contract are not amended,
   apart from repairing the North Star's routing sentence that named E0 and pointing the North Star's
   and assets contract's dependency-licensing sentences at the T5 licensing amendment;
3. registration of `T5.P01` — Drawn native objects — with its slice register, its final gate and the
   T5 runbook and baton, and the approval of the
   [first slice plan](../../roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s01-native-form-source-and-evaluation/implementation-plan.md);
   the My Objects slice `T5.P01.S04` is registered as proposed;
4. the execution-structure gate's admission of T5 batons, runbooks and release-list rows
   (`apps/editor/tests/docs/parallel-track-gates.test.ts`), so a T5 release row can be written
   without a further test change;
5. the two owner amendments above.

It does not release any scope, install a dependency, amend an F contract or gate, change PLATE,
admit a Scene format, or authorize the later phases the umbrella plan describes. The first slice
declares two libraries already resident in the lockfile as direct dependencies of
`@portfolio/geometry-core` — `robust-predicates` 3.0.3 (Unlicense, already used by Layout) and
`earcut` 2.2.4 (ISC, today transitive) — and its acceptance records their versions and licences.

## Owner decisions

Each decision has the default the merged plan uses. Changing a default in review changes the plan
before merge.

| # | Decision | Default on merge |
| --- | --- | --- |
| D1 | Object Focus is a scope on the one Stage, with a state pill and Put back, rather than a separate workspace, route or shell | Scope on the one Stage |
| D2 | T5 implements native-form semantics inside the Scene unit, codec and planners under T2 review; T2 keeps Scene authority, other entity kinds and definitions/instances | T5 implements under T2 review |
| D3 | A new T5-owned runtime-safe workspace package, `@portfolio/geometry-core`, holds reusable numerics with no domain meaning; its only libraries are the resident `robust-predicates` and `earcut` | Admitted with `T5.P01.S01` |
| D4 | Scene unit format 3 → 4 adds the `form` entity; strict readers refuse 3; fixtures regenerate; the slice starts after `T2.P02.S03` merges or T2 hands over the Scene-unit files | As stated |
| D5 | Ink becomes one Pen with readings from more than one domain; the Scene **Shape** reading lands in `T5.P01` slice S02 through a bounded seam T1 reviews (alternative: T1 delivers the seam first) | Bounded T1-reviewed seam in S02 |
| D6 | Revision promise for P02: shaping is bound to object space, so a later outline or size edit re-evaluates it where it is in the object, or refuses | Object-space binding |
| D7 | Section presentation in Focus — PLATE's default reading takeover versus the Shape focus specification's split pane (PLATE's retained inset) — is a named P02 design-loop decision | Decided in P02 |
| D8 | The library scope for My Objects lands in `T5.P01.S04`, limited to the `form` kind, implemented by T5 under T2 review so later kinds extend the same scope (alternative: T2 lands a general library scope first and S04 consumes it) | T5 lands it under T2 review |

Decisions owned by a later phase stay there: Manifold admission and any asynchronous F4 preparation
for composite forms, the weak-copyleft admission review of any OCCT, Fidget or libfive candidate,
and T2 definition/attachment consumption.

## Release step for the first slice

When the owner chooses to start `T5.P01.S01`, the release is one owner edit: add its row to the
[release list](../../roadmap/now.md) — condition "starts after `T2.P02.S03` merges on `main` (or T2
records a Scene-unit writer handoff to this slice); recheck consumed gates and active scopes at its
own trusted base" — linking its plan. The coding agent then starts through the
[T5 runbook](../../operations/t5-expressive-geometry/README.md) start step.

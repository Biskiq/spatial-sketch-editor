# Object Studio and modeling foundation — reconciliation evidence

**Supporting research for PR #266, reconciled against main `cda02e61`.**
The implementation direction now lives only in the
[T5 umbrella](../../docs/roadmap/t5-expressive-geometry/umbrella-plan.md), with its
[Studio journey specification](../../docs/roadmap/t5-expressive-geometry/object-studio-design.md).
This file preserves the useful alternatives, falsifiers and research routes. It is not a second
plan, source-format authority or authorization sequence. The
[earlier proposal at its original PR head](https://github.com/Biskiq/spatial-sketch-editor/blob/e2e3aea74317fd3f84d15c68dd4e4896b217fc1f/broad-research/native-modeling-freedom/PROPOSAL.md)
retains the complete C1–C6 wording for comparison.

## Reconciliation of the competing directions

| Prior contribution | Retained | Corrected or replaced |
| --- | --- | --- |
| Earlier native-form plan | Scene-owned source, keyed controls, reproducible evaluation, object-space refinement, independent My Objects copies | The categorical ban on a Studio entry route; assumed cross-engine proof from an arithmetic whitelist; performance numbers presented as gates; deferred assemblies without a concrete consumer |
| [PR #244 UX](../native-object-creation-ux/PROPOSAL.md) and [storyboard](../native-object-creation-ux/STORYBOARD.md) | Explicit entry/return, recognition, whole/part reach, no automatic Focus after quick creation, Open editable copy versus Insert copy | Standalone discovery is through ordinary Projects first, not a mutable In progress library. No separate unplaced source document. Illustrative piano/chair screens do not approve geometry tools. |
| [Shape Focus prototype specification](../../prototypes/native-object-shaping/UX-SPEC.md) | Current-body sections as instruments, visible reach, explicit preservation meaning, one Card writer, Apply/Discard, blur never commits | Mandatory split view/section on entry is prototype-specific. Its single-contour restriction bounds that operation, not all future Studio work. Reshape/Keep still need a field and validity design before product implementation. |
| Original #266 | Equal standalone and World-origin journeys in one app; existing project lifecycle; headless geometry; honest return/reuse; stretch versus proportional size; adversarial kernel comparisons | The separate fixture document and experimental Undo path are rejected for the product. Do not build several speculative engines plus an experimental editor before making canonical work useful. C1–C6 promotion gates and one “final” Scene 5 cutover are superseded. |
| [Native creative-depth research](../native-creative-depth/README.md) | Contextual editing, bounded family semantics, explicit identity/correspondence, comparative probes and failure cases | Dated implementation/licence observations are historical. Current approved references govern. A prototype timing or package capability claim is not evidence of an integrated product guarantee. |

## Technical judgments and evidence limits

**Representation.** Authored profile/operation source is the default because it preserves meaningful
parameters without making generated mesh history authoritative. It supports direct interaction
without a visible feature tree. It can become awkward for many interacting operations, so its
bounded operation families must be tested under upstream revision, not just forward creation.
The alternative — explicit planar faces, loops and Float64 planes — can make direct face editing
natural, but adds incidence, non-planarity, split/merge correspondence and source-conversion costs.
Re-deriving vertices from three planes does not determine a four-or-more-plane junction or solve
which new face is the old subject. A bounded experiment may still justify that representation for
a named need; it does not justify selecting it as the universal foundation now.

**Determinism.** Retain the current kernel's exact goldens and arithmetic restrictions. The
[ECMAScript numeric specification](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.sqrt)
supports the distinction between specified square-root rounding and implementation-approximated
transcendentals. Inferring bit identity for an entire library/worker pipeline also requires fixed
algorithms, traversal order, rounding boundaries and empirical conformance. Do not claim that
Float64 or WASM alone supplies it, and do not replace exact identity/source obligations with an
unspecified geometric epsilon.

**Triangulation.** [Earcut's documentation](https://github.com/mapbox/earcut#algorithm) does not
guarantee correct conforming triangulation for arbitrary input. The retained
[matched extrusion probes](../native-creative-depth/probe-methods.md) found T-junctions in a
three.js extrusion route. That observation is not a failing test of Biskiq's current extruder.
It motivates explicit ring validation, shared boundary subdivision and independent topology checks
when adding holes. Render vertices duplicated for UVs/normals must be distinguished from actual
geometric boundaries.

**Boolean precision and provenance.** The
[Manifold core mesh interface](https://manifoldcad.org/docs/html/structmanifold_1_1_mesh_g_l_p.html)
documents both single-precision MeshGL and double-precision MeshGL64, plus input-face/run provenance.
That does not establish which options a selected JavaScript/WASM artifact exposes. Inspect and pin
the actual binding; retain the old Float32 round-trip experiment as a falsifier rather than a
universal claim about Manifold. Input provenance helps map material/roles but does not establish
durable semantic identity after splits, merges or upstream revisions. Persistent Biskiq references
need the owning domain's correspondence.

**Boolean correctness.** [Upstream issue #1888](https://github.com/elalish/manifold/issues/1888)
reports a grazing union with missing volume despite a successful status; reversing operands changes
the result in the report. Keep its concrete coordinates as a regression case and establish the
selected build's behavior. Status, closed edges and positive volume alone are insufficient.
Bounds/volume inequalities also cannot detect every wrong shape. Use analytic expected results,
sections/containment and operand-order/metamorphic checks where they are valid; refuse unsupported
uncertain cases. Replaying a source program avoids cumulative mesh quantization but cannot repair
a kernel's incorrect single evaluation.

**Polygon libraries.** [Clipper2](https://angusj.com/clipper2/Docs/Overview.htm) is a candidate for
2D offset/clip work, not a selected TS dependency. The upstream implementations and a chosen port
or WASM wrapper are different artifacts. A consumer must specify integer scaling, rounding,
overflow, fill rule, split results and source correspondence. “Offset this face” is not a complete
source or UX design, and neither Clipper2 nor Manifold supplies an inferred constraint solver.

**Stretch.** The original Q4 proposal's useful idea is a piecewise spatial map with end regions
that translate rigidly and a middle band that changes length. This is not proportional Size and
not a universal thickness-preserving resize. A splayed member crossing the band can change angle
and thickness; triangles crossing a band boundary require subdivision. The umbrella fixes a bounded
axis/band operation and an explicit oblique counterexample. A multi-part table may be simpler to
revise by changing its named parts than by deforming a fused body.

**Integration.** Current `form-geometry` derives UVs and surfaces from extrusion buffer layout.
General meshes need explicit provenance and updated footprint/contact/render consumers. A lazy
import does not prove zero-byte initial cost or visitor isolation. A runtime-safe evaluator may be
shared with Preview; the Studio controller cannot. An async function at the host does not prove
every planner/load/Save path supports expensive async source validation.

## Retained comparison corpus

No new probes or performance measurements were run for this documentation revision. The following
are concrete future correctness/revision cases, not a compulsory benchmark or demonstration gate.

| Case | Question / falsifier |
| --- | --- |
| Single plinth, pierced panel and open frame | Does a profile or profile-with-holes suffice? Do Plan, 3D, contact, Save and reopen agree? |
| Multi-part table and later piano lid | Can parts be named and revised independently without fusing away future behavior targets? |
| Recessed/rebated vitrine | Does a positioned source cutter beat a direct planar operation on both creation and later revision? |
| Portal widened 1.2 m → 2 m with 60 mm end members | Can a bounded stretch leave end members intact? Compare proportional size and part editing. |
| Splayed member crossing a stretch band | Does the tool honestly disclose changed angle/thickness rather than claiming preservation? |
| Twenty repeated/out-of-order edits | Compare source replay, naive Float32 round-trip and any plane-derived candidate; test revision drift and lost bindings independently. |
| Grazing union and reversed operands | Run #1888 and nearby scale/translation cases against the actual pinned build with independent expectations. |
| Concave, collinear, thin and near-touching loops | Prove shared cap/side topology; explicit refusal is preferable to silent repair. |
| Split/merged/vanished surface | Does provenance become a set or unresolved result instead of guessing a continuing face? |
| Save in flight, Undo branch, deleted root and worker restart | Does stale completion install nothing and preserve the last accepted source? |

## Research library

- [Native Form Lab findings](../../prototypes/native-form-lab/FINDINGS.md): transactions, keyed
  controls and failure lessons; its standalone viewport/history are not product infrastructure.
- [Geometry, identity and performance study](../native-creative-depth/geometry-identity-and-performance.md),
  [probe methods](../native-creative-depth/probe-methods.md),
  [approaches and precedents](../native-creative-depth/approaches-and-precedents.md): the substantive
  geometry comparisons and their limits. Dated statements remain observations, not current policy.
- [Geometry library harvest](../geometry-library-harvest.md): polygon and kernel alternatives.
- [Expressive form research](../expressive-3d-form-sculpting-hybrid-modeling-2026-10-27.md): deformation,
  implicit and mixed representations; not authority to install a universal modeling graph.
- [Spatial modeling depth](../spatial-modeling-depth-research-2026-10-25.md): creator barriers and
  revision needs. Keep the ambitious ceiling while admitting one useful family at a time.

Current [dependency policy](../../docs/reference/components/assets.md#dependency-licensing) permits
review of weak-copyleft candidates for T5; old “OCCT is blocked by licence category” conclusions are
superseded. Current [performance policy](../../docs/reference/components/performance.md) suspends
mandatory benchmark matrices. The [workflow](../../docs/workflow.md) owns capabilities and PR review;
historical phase/hold claims in studies do not govern implementation.

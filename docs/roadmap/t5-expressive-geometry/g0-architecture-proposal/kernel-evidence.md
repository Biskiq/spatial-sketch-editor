# G0 — Kernel, mathematics and evidence assessment

**Companion to the [Stage 1 proposal](./README.md) · 27 October 2026 · recommendations only.**
No package was installed or admitted. Primary upstream documentation and license texts were
checked during this investigation; moving upstream URLs describe that inspection, not a frozen
dependency manifest. A consuming slice must pin the exact release, build options and complete
dependency/license closure before admission. No new kernel-performance measurements were run.

## 1. Concrete adoption recommendation

**Prioritize Manifold for bounded solid operations and Clipper2 for new planar clipping/offset
needs. Build Biskiq's intent, correspondence and validation layer in-house.** Start with existing
TypeScript curve/control machinery and a small admitted deformation family. Do not adopt a general
CAD kernel, global constraint solver or volume-processing stack for the first consumer.

For the next expressive capability, functional implicit evaluation is the preferred architecture.
**Fidget is the strongest candidate to evaluate if weak copyleft is authorized**: it directly
supplies expression evaluation, interval specialization, gradients and meshing. Under today's
policy it is blocked. The permissive route is a deliberately small independently implemented field
evaluator, initially using admitted primitive/curve functions and a validated contouring path,
potentially Manifold's level-set facility. This is real development cost, not a claim that a few
shader functions replace Fidget. Do not copy MPL implementation into permissive code.

Keep libfive as a comparison/reference, OCCT as the preferred later precision-kernel candidate,
and surface/deformation libraries as selectively admitted numerical components. A source graph
should be independent of those libraries' native handles and file formats, without inventing an
abstraction so generic that every backend must implement every operation.

## 2. Library decisions

“Candidate under current policy” means its identified license appears permissive; it is **not**
authorization, complete transitive review or a finding of browser fitness.

| Foundation | Technical role and evidence | Current-policy disposition and recommendation |
| --- | --- | --- |
| **Manifold — C++ / JS-WASM** | Closed triangle-mesh booleans, primitive construction, vertex properties and source/face provenance. Official bindings and algorithm documentation exist; the documented WASM build is serial-only. Requires manifold inputs; do not confuse topological guarantees with exact surfaces or persistent semantic naming | **Apache-2.0; first adoption candidate.** Use a narrow worker adapter, explicit object disposal and copy/transfer accounting. Independent validity checks, near-coincident corpus and source-role mapping required. [Repository and license](https://github.com/elalish/manifold), [API](https://manifoldcad.org/docs/html/), [build/dependencies](https://raw.githubusercontent.com/elalish/manifold/master/README.md) |
| **Clipper2 — C++ and language ports** | Planar clipping and offsets. Integer arithmetic makes the scale/range/error boundary explicit; floating interfaces still scale to integers. Small features may disappear within rounding tolerance | **BSL-1.0; candidate for new planar operations.** Prefer reference implementation semantics; a TS/WASM port needs its own conformance and closure check. Do not replace landed Layout arithmetic incidentally. [Repository/license](https://github.com/AngusJohnson/Clipper2), [coordinate range](https://www.angusj.com/clipper2/Docs/Overview.htm), [robustness](https://angusj.com/clipper2/Docs/Robustness.htm) |
| **Fidget — Rust** | Functional expression tapes, interval-based simplification, gradients and manifold dual contouring. Its native JIT is unavailable in WASM; browser execution uses the interpreter. The maintainer explicitly characterizes it as experimental, with integration/fork work expected | **MPL-2.0; blocked today.** Preferred conditional implicit-kernel spike, not a production dependency promise. Native speed charts are not browser evidence. Its mesher explicitly allows possible self-intersections and missed thin features. [Repository/license](https://github.com/mkeeter/fidget), [WASM/API](https://docs.rs/fidget/latest/fidget/), [meshing limits](https://docs.rs/fidget-mesh/latest/fidget_mesh/) |
| **libfive — C++** | Functional representation and feature-preserving hierarchical meshing; direct manipulation of procedural variables is useful precedent | **Core/stdlib/Python MPL-2.0; Guile/Studio GPL-2.0-or-later; blocked.** Compare mechanisms with Fidget, not both as runtime dependencies. Do not mislabel the whole project GPL or permissive. [Upstream scope and license split](https://raw.githubusercontent.com/libfive/libfive/master/README.md) |
| **OCCT — C++** | B-rep curves/surfaces, topology, trims, fillets, healing and STEP-oriented precision work. This is the strongest specialist candidate, not a universal sculpt engine. Browser wrappers demonstrate packaging possibilities, not Biskiq latency | **LGPL-2.1 with Open CASCADE exception; blocked.** Evaluate only for a named precision consumer. The exception concerns object code incorporating headers; it is not a blanket exemption from LGPL obligations. [Capabilities](https://occt3d.com/open-cascade-technology/index.html), [license](https://raw.githubusercontent.com/Open-Cascade-SAS/OCCT/master/LICENSE_LGPL_21.txt), [exception](https://raw.githubusercontent.com/Open-Cascade-SAS/OCCT/master/OCCT_LGPL_EXCEPTION.txt) |
| **Truck — Rust** | Permissive B-rep alternative with modeling/topology/geometric infrastructure | **Apache-2.0; possible candidate, not selected.** This investigation has no conformance evidence matching the needed trims/fillets/offsets. Its existence refutes “there is only one permissive kernel,” but does not establish feature parity with OCCT. Do not invest in completing a CAD kernel to unlock the first native object. [Repository/license](https://github.com/ricosjp/truck) |
| **OpenVDB / NanoVDB** | Sparse volume structures and processing; useful foundation for later sampled detail. A sparse grid accelerates storage/access, not automatically all operations or editing | **OpenVDB Apache-2.0; potential candidate after full build audit.** Study data structures now; defer full browser stack. NanoVDB alone is not a complete mutable sculpting system. [Project, scope and license](https://raw.githubusercontent.com/AcademySoftwareFoundation/openvdb/master/README.md) |
| **OpenSubdiv** | Efficient evaluation of deforming subdivision surfaces with static topology; useful when deliberate surface flow becomes a real consumer | **Inspected release branch uses TOST 1.0, an Apache-derived license with changed trademark terms.** Do not record it as plain Apache-2.0. Compatibility/admission review remains open; defer to surface-refinement horizon. [Project](https://github.com/PixarAnimationStudios/OpenSubdiv), [actual license](https://raw.githubusercontent.com/PixarAnimationStudios/OpenSubdiv/release/LICENSE.txt) |
| **libigl** | Broad geometry-processing algorithms, including differential operators and deformation; good for bounded algorithm comparison | **Core MPL-2.0; blocked; optional components/dependencies differ.** Under a changed policy, choose individual routines and pin their closure, not the entire toolkit. [Documentation](https://libigl.github.io/), [license](https://raw.githubusercontent.com/libigl/libigl/main/LICENSE.MPL2) |
| **geometry-central** | Surface data structures, intrinsic geometry, distance and remeshing; valuable for later surface-relative controls and transport | **MIT top level, but uses Eigen; not a fully permissive closure by default.** Eigen's inspected license is MPL-2.0; optional SuiteSparse also needs component-level review. Do not admit on the MIT badge alone. [Capabilities](https://geometry-central.net/), [MIT license](https://raw.githubusercontent.com/nmwsharp/geometry-central/master/LICENSE), [dependencies](https://geometry-central.net/build/dependencies/), [Eigen license](https://gitlab.com/libeigen/eigen/-/raw/master/COPYING.MPL2) |
| **CGAL** | Robust predicates/constructions and specialist algorithms, including skeletons and mesh processing; attractive as a precision algorithm supplier or test oracle | **Mixed LGPL/GPL packages or commercial licensing; blocked.** With an approved compatible policy, evaluate only the packages a consumer needs. A permissive wrapper does not relicense the embedded implementation. [Official license and package policy](https://www.cgal.org/license.html) |
| **Ceres Solver** | Nonlinear least-squares machinery, potentially useful once compact constraint problems exceed simple analytic/local solves | **BSD-style top-level license; exact files/dependencies still require audit.** Defer: a numerical minimizer does not supply geometric constraint semantics, uniqueness or hard-constraint satisfaction. [License and third-party caveat](https://raw.githubusercontent.com/ceres-solver/ceres-solver/master/LICENSE) |

## 3. Mathematical foundations to build around

Adopt the methods, not an indiscriminate set of packages:

1. **Robust geometric decisions.** Adaptive precision predicates for orientation/incidence,
   explicit planar quantization and declared construction tolerances. Predicate correctness,
   approximation error and meaningful semantic identity are separate guarantees.
   [Shewchuk's primary work](https://www.cs.cmu.edu/~quake/robust.html).
2. **Curve/frame geometry.** Retained curves, arc-length parameterization, rotation-minimizing
   frames, bounded curvature and explicit seam/corner policy for sweeps. Reuse and qualify existing
   production math; prototype position-only timings do not establish a valid solid pipeline.
   [Repository geometry study and its limits](../../../../broad-research/native-creative-depth/geometry-identity-and-performance.md).
3. **Constrained direct deformation.** Small controls drive dense shape through cages, spatial
   maps or local variational solves. ARAP is a useful surface-detail baseline; Kelvinlets offer
   compact space deformations. Neither automatically guarantees collision freedom, preservation
   of a finite patch or arbitrary large-deformation validity.
   [ARAP](https://igl.ethz.ch/projects/ARAP/),
   [Kelvinlets paper](https://graphics.pixar.com/library/Kelvinlets/paper.pdf).
4. **Implicit evaluation.** Bounded function composition, gradients, conservative intervals,
   spatial specialization and feature-aware extraction. Start on CPU/worker; GPU rendering is
   not an architecture prerequisite. The MPR paper demonstrates expression reduction, not a
   transferable performance factor for this product.
   [MPR research](https://www.mattkeeter.com/research/mpr/).
5. **Inverse problems with limited intent.** Solve for a declared subset of controls with
   residual validation and deterministic tie-breaks. Retained curves and structured annotations
   are evidence for this interaction/representation connection; arbitrary sketch interpretation
   remains an ambiguity problem.
   [FiberMesh](https://igl.ethz.ch/projects/FiberMesh/),
   [Structured Annotations](https://cragl.cs.gmu.edu/annotations/).

Our in-house responsibility is the operation vocabulary, ownership adapters, frames/units,
invariants, deterministic preparation, semantic-region lifecycle, conversion contracts, repair
and adversarial conformance. Buying a kernel cannot delegate those responsibilities. Conversely,
writing general robust solid booleans or trimmed-surface intersection ourselves would consume
effort better spent on this product unless licensing or measured behavior makes it necessary.

## 4. Licensing paths and commercial consequences

The [2026-10-23 ruling](../../../reference/decisions/post-batch-e-authorization-2026-10-23.md#licensing-direction)
leaves product licensing undecided and admits only permissive dependencies, including dev
dependencies. **MPL and LGPL are blocked even when commercial proprietary integration is possible.**
This proposal evaluates policy options; it changes none.

| Path | What it enables | Consequence for the architecture/business |
| --- | --- | --- |
| **Keep current permissive-only policy** | Manifold, qualified Clipper2 and independently developed controls/fields; other candidates after full closure review | Keeps future licensing options open. More in-house implicit/deformation work, fewer mature precision choices. Delay unsupported capabilities rather than conceal incompatible code in a wrapper |
| **Permit selected weak copyleft, without choosing AGPL for Biskiq** | Potential Fidget/libfive core/libigl/Eigen and OCCT integration | Separates the dependency question from the product business model. This is my preferred next policy question if reuse materially reduces implementation risk; it still needs an explicit owner ruling |
| **Adopt an AGPLv3-based product model** | A compatible open combined work can incorporate a broader copyleft ecosystem, including selected GPLv3 CGAL packages | Supports paid distribution/hosting with reciprocity, but changes source-availability and redistribution expectations; does not make every dependency compatible or grant proprietary relicensing rights |

**MPL route.** MPL 2.0 generally keeps covered files and modifications available in source when
distributed, while allowing a larger work's other files under different terms. Secondary-license
compatibility has conditions, including the “Incompatible With Secondary Licenses” designation.
For a browser bundle, minification or WASM compilation does not erase those source obligations.
Audit file boundaries and notices for the actual build. [MPL text §§1, 3](https://www.mozilla.org/en-US/MPL/2.0/),
[Mozilla FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/).

**LGPL route.** Proprietary commercial use can be possible with compliance; distribution must
preserve the relevant source and user modification/relinking rights. Static/WASM packaging makes
the exact relinking materials and build procedure a practical design issue. OCCT's header
exception does not alone settle that distribution plan.
[OCCT LGPL text](https://raw.githubusercontent.com/Open-Cascade-SAS/OCCT/master/LICENSE_LGPL_21.txt),
[exception](https://raw.githubusercontent.com/Open-Cascade-SAS/OCCT/master/OCCT_LGPL_EXCEPTION.txt).

**AGPL route.** Selling copies, support or hosting is allowed. Conveyed covered binaries have
source obligations; §13 additionally requires a modified network-interactive version to offer
its Corresponding Source to remote users. Browser-delivered application code is distributed code,
not merely a server kept private. Corresponding Source includes needed build/install material,
not merely an upstream repository URL. Recipients retain redistribution rights. These are
commercial-model considerations, not a prohibition on revenue.
[AGPLv3 §§1, 4–6, 13](https://www.gnu.org/licenses/agpl-3.0.txt).

GPLv3 and AGPLv3 explicitly permit combination under their respective provisions; that does not
resolve GPLv2-only, custom license, patent or third-party asset issues. Ordinary user-created
geometry is not automatically copyleft because the editor is, but a delivered package containing
covered runtime code carries that code's obligations. A permissively licensed independent viewer
could be a deliberate future choice if ownership and dependency boundaries support it; neither
worker separation nor an HTTP endpoint automatically makes a combined program legally independent.
[GNU license FAQ: combination, output and program boundaries](https://www.gnu.org/licenses/gpl-faq.html.en).

Biskiq cannot offer a proprietary license for someone else's copyleft implementation merely by
dual-licensing its own code. A proprietary OEM/embedded distribution needs rights for every included
component, an applicable exception or a genuinely separate replacement. CGAL offers a commercial
licensing route; price, scope and procurement feasibility were not investigated.
[CGAL commercial licensing](https://www.cgal.org/license.html). For a future dual-license model,
review rights to existing and incoming Biskiq contributions as well. Have qualified licensing
counsel assess the concrete selected build/distribution plan before changing policy.

**Recommendation:** do not choose AGPL solely to obtain geometry libraries. Keep this architecture
viable under the current rule; ask separately whether selected weak-copyleft reuse is worth its
compliance cost. If the owner wants AGPL's reciprocal product model, the same architecture works,
with a wider but still audited kernel pool. No kernel selection here presupposes that decision.

## 5. Evidence discipline and unproved claims

Repository baseline for the proposal is merged `main` at `83c79c40` (PR #200), after G0's start
condition PR #198. Research was initially inspected in the user's checkout, then the relevant
commission, contracts and source boundaries were checked in an isolated worktree at that merged
baseline. Unmerged local implementation work is not part of the proposal PR.

Source spot-checks include the [Native Form Lab evaluator](../../../../prototypes/native-form-lab/src/geometry/index.ts)
and [types](../../../../prototypes/native-form-lab/src/model/types.ts), the
[F4 unit acceptance seam](../../../../packages/project-model/src/f4/unit-acceptance.ts), and
[S06 persistent storage](../../../../packages/layout-core/src/persistent-store.ts). They support
bounded findings about role keys, shared acceptance and runtime-only retained structures; they
are not a full source audit or proof of the proposed engine.

The [earlier matched geometry probes](../../../../broad-research/native-creative-depth/probe-methods.md)
are historical Node measurements, with commands/fixtures and caveats in that artifact. Their
Manifold/OCCT comparison is useful prioritization evidence, not a browser budget, a current-version
benchmark or proof that a bespoke WASM implementation wins. S06's accepted end-to-end numbers
have different workloads and must not be combined into a synthetic T5 speedup.

Primary evidence supports individual algorithms and library capabilities. The following remain
architectural hypotheses: a common intent interface will stay intuitive across representations;
functional fields will outperform sampled fields on Biskiq's revisable workloads; useful semantic
anchors will survive enough edits to avoid frequent repair; the proposed object envelope will meet
ordinary-laptop targets; and a small implementation team can maintain the conversion/validation
surface economically. The [proposal's risk register](./README.md#10-risks-falsification-and-what-changes-if-we-are-wrong)
names the experiments and change of direction for each.

Emscripten's threaded WASM support requires the relevant cross-origin isolation setup and a
distinct fallback strategy; thread availability cannot be assumed in every embed. Start with
single-thread worker execution and justify threading later.
[Emscripten pthread documentation](https://emscripten.org/docs/porting/pthreads.html).

### Coverage of the commission

| Required output | Location in the proposal |
| --- | --- |
| One direction, serious alternatives and falsifiers | §§1, 9–10 |
| Representation, tolerance, identity and robustness | §§3–5 |
| Libraries, licensing and language strategy | This assessment; §7 |
| Ownership, S06, F2/F4, Save, Stage and T4 | §§6–7 |
| Editable operation and correspondence model | §§3, 5–6 |
| Incremental evaluation and browser targets | §7; existing performance contract remains authoritative |
| First three to five consumer increments | §8; five proposed increments, none registered |
| Risks and discriminating proofs | §§8, 10 |

This is a single-agent proposal and self-check, **not** the commission's independent review.
The Stage 1 PR is the stopping point; reconciliation follows only a later owner instruction.

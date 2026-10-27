# Spatial computation architecture — falsification and persistent roots

**Track:** T1 / S06 · **PR:** [#190](https://github.com/Biskiq/spatial-sketch-editor/pull/190)

**Audited base:** 764175e0e8db12e09a580a3e818b9420dfe50ca5

**Implementation:** d47c25e1 + 5cdccb79 + 48126338; comparison harness bd443412, counter/replay correction 0156eac1.

**Status:** implemented for independent review; no acceptance, owner contract ratification, Bench 2 or merge.

This replaces the earlier dossier's complexity claims. Two or three entity evaluations did not establish
a sublinear edit: the base still copied complete authored arrays, Maps, spatial buffers and compiled
outputs. Its two-size slopes and accepted-node counts were measurements of subsets, not proofs about
complete operations. The former HAMT speed ratios, gesture percentages and OP-1/2/3 benefit percentages
had no reproducible evidence and are withdrawn.

The selected implementation removes those copies from the certified local Wall path. It does
**not** establish a universal O(log N + k + results) editing bound: arbitrary spatial queries can
still test N entries, accepted Layout edits still traverse native source collections and stream
existing canonical bytes, and some Stage consumers still read whole collections. These are separate
problems with separate dispositions below.

## 1. What the base actually did

Let J, W, R and O count Junctions, Walls, Rooms and objects; H count face half-edges; Q count
compiled query records; B and C count BVH nodes and child links. Counts describe logical slots
or explicit buffer bytes, not engine object sizes.

| Path at 764175e0 | Hidden work for a local rigid Wall move | Replacement |
| --- | --- | --- |
| Candidate construction | J + W pointer slots copied by native slice | Borrow frozen array roots; copy edited blocks of at most 32 slots and their binary paths |
| materializePatchedWorldIndex | 2J + 2W + H Map entries copied; all walk summaries sliced | Stable ID/index directories with current-source views; persistent sampled-wall/half-edge maps and walk vector |
| BVH clone | 15 typed arrays: exactly 37W + 42B + 4C payload bytes; irregular-list copy; new 4 max(16,B)-byte stack | Three persistent map handles and a wrapper; no cloned N-sized buffers or stack |
| BVH maintenance | Ancestor refit, but partitions never repaired after a move | Bounded fat partitions; remove/reinsert after escape; AVL balance |
| Query instrumentation | Accepted internal nodes, excluding many rejected child and leaf tests | Every tested node bound, every tested entry, irregular scan, ordering work and output |
| Delta compile | Q output slots; W + J + 2R + O compiled/list slots; chunk-directory and aggregate work | Persistent ordered vectors, augmented bounds/issue counts, ordered diagnostic map, lazy full-array adapters |
| F4 capture | Repeated full detached graph captures destroyed unchanged identity | Share proven immutable JSON children; detach every new container; preserve native fallback for accessors/exotics |
| Layout codec | New entity graphs for unchanged source records | Reuse only already immutable, strictly validated, identically normalized elements; global collection/reference checks remain |
| Stage seal / representation | Deep freeze forced query getters; all Junction legs, Walls and objects scanned; child-array search/splice on replacement | Seal unseen persistent paths; Wall/Junction root diff; keep attached meshes; skip unchanged object collection |
| Retention | COW parent, equivalence and pending-patch references could retain evicted ancestors | Weak parent hints, opaque equivalence tokens, immediate root installation and bounded qualified prepared artifacts |

A native array slice and Map constructor remain linear even if they copy references instead of
geometry. Chunking with a copied flat directory is O(N / block-size), which is still linear.
A balanced spatial tree has logarithmic height; this alone says nothing logarithmic about the
number of overlapping subtree bounds a range query must examine.

## 2. Representations seriously evaluated

The evaluations below distinguish implemented comparisons, analytical designs and unmeasured
alternatives. There is no blanket claim that one JavaScript library or data-structure family wins.

| Representation | Relevant benefit | Decision |
| --- | --- | --- |
| Persistent radix vector / RRB tree | Logarithmic path copying; RRB also supports split, concat and insertion | Implement a smaller blocked binary vector for replacement-only local edits. RRB remains credible for future membership editing; native accepted arrays still need an adapter |
| Persistent B/B+ tree or immutable chunk DAG | Wide paths, ordered iteration, page locality | Credible next packing optimization. A persistent page directory is essential; copying N/pages pointers recreates the original defect. No fabricated JS speed comparison |
| HAMT / CHAMP | Efficient persistent identity directory, compact bitmap nodes | Credible alternative. Current static native ID directories already share without edits; changed numeric/string maps need ordering/augmentation, so one deterministic AVL implementation serves more roles |
| Persistent AVL | Worst-case logarithmic search/update paths, simple rotations, augmentation | Selected for sampled walls, half-edges, diagnostics and spatial directories. Nodes never point to prior roots |
| Fat nodes / modification boxes | Can reduce persistence space under the relevant model | Examined, not implemented. Version ancestry, bounded node modifications, augmented bounds and full branching need their own proof; O(log N) path allocation is explicit here |
| Mutable transients + immutable accepted roots | Fast working handles without copying accepted state | Selected: mutable map handles replace immutable roots. No accepted document or old generated record is edited in place |
| Sparse overlays / MVCC / LSM runs | Cheap transaction append and snapshot tokens | Unbounded overlay chains make reads depend on history depth; flat-directory compaction can hide N work. Require a persistent directory and bounded compaction before replacing the selected trees |
| Event log / inverse journal | Small event append | Does not itself give constant-time historical reads; replay/checkpointing and inverse correctness remain. Persistent historical roots directly solve the read requirement |
| Generational IDs / stable slots | Cheap insert/remove without reindexing the suffix | Useful for future membership deltas; no new serialized IDs or source ownership installed in S06 |
| Incremental materialized views | Reverse joins and query deltas, cached aggregates | Selected directly: Wall→Room, Junction→Wall and host→Opening indexes; retained per-owner query records; aggregate vector summaries |
| General self-adjusting engine / differential database | General dependency maintenance | Not installed. The existing canonical compiler's typed builders and explicit reverse dependencies express this fixed graph without a second evaluator. No unsupported claim that these engines are intrinsically too slow |
| Dynamic DCEL / connectivity structures | Efficient explicit topology changes | Not a replacement for existing Room correspondence semantics. S06 certifies unchanged topology; insertion/deletion/reconciliation still uses the canonical fallback |

Primary foundations: [persistent structures](https://www.cs.cmu.edu/~sleator/papers/Persistence.htm),
[RRB trees](https://hypirion.com/pdf/RMTrees.pdf),
[CHAMP](https://ir.cwi.nl/pub/24029/24029B.pdf),
[Clojure persistent collections/transients](https://clojure.org/reference/data_structures), and
[augmented persistent maps](https://www.cs.cmu.edu/~yihans/papers/pam.pdf).

### Spatial alternatives and the missing theorem

Refitting, fat partitions, reinsertion and balanced path copying are implemented comparisons.
The base BVH8, fixed-centroid AVL, adaptive-centroid AVL and adaptive four-extrema AVL use the same
overlap predicate and ordered result contract in the bounded replay. The default now orders
(minX, minZ, maxX, maxZ), rather than centroids alone, using fixed-width IEEE-754 Morton bits.
It distinguishes horizontal and vertical enclosing slabs with equal centroids. Small movements
retain a bounded fat partition; an escaped entry gets a new key. AVL rotations guarantee height
and maintenance paths, not range-query selectivity.

[Box2D's dynamic AABB tree](https://box2d.org/documentation/group__tree.html) supplies a useful
reinsertion precedent and separately reports node/leaf visits.
[R*-trees](https://brava.dbs.ifi.lmu.de/publications/585), surface-area rotations and localized
rebuilds can improve spatial quality. They do not, merely by being balanced or periodically rebuilt,
supply the requested worst-case exact reporting theorem. They remain credible linear-space
alternatives; this task does not claim to have benchmarked every implementation.

Exact rectangle overlap is a four-dimensional dominance query:
p = (minX, minZ, -maxX, -maxZ), q = (query.maxX, query.maxZ, -query.minX, -query.minZ);
report p whose four coordinates are at most q's. Thus there is **no inherent requirement to
scan unrelated rectangles**.

A classical dynamic 4D range tree offers polylogarithmic queries/updates with
O(N log³ N) space; straightforward query cost is O(log⁴ N + results), with amortized
weight-balanced augmentation work. See [MIT's range-tree treatment](https://classes.csail.mit.edu/6.851/spring12/lectures/L03.html).
Combining two outer range layers with a 2D priority-search structure gives a plausible
O(log³ N + results) query / O(N log² N) space design; this is a composition analysis,
not an implemented fully persistent bound. [McCreight's priority search trees](https://epubs.siam.org/doi/10.1137/0214021)
are the bottom-level basis. Arbitrary historical branching cannot inherit an ephemeral
rebuilding amortization without a separate analysis.

At N = 100,000 and height 17, a straightforward three-catalog-layer design has roughly
N h³/6 = 82 million memberships (328 MB of four-byte IDs alone); the two-layer alternative
has roughly 15–17 million occurrences (60–68 MB of IDs). These are transparent sizing models,
not measured heap sizes or universal space lower bounds. Links, summaries, persistent versions
and JavaScript objects add storage. A sophisticated packed implementation could do better.

[Static 4D dominance research](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.SoCG.2020.59)
even gives O(log N + results) reporting with almost-linear space. That theorem is static;
it does not supply this editor's dynamic, persistent update implementation. Consequently the
selected linear-space index is a measured engineering choice, **not an optimality claim**.
A theorem-backed dynamic dominance structure is a concrete stronger alternative if worst-case
reporting is made a requirement. No API or ownership change is intrinsically necessary for that
internal replacement.

## 3. Selected pipeline and its invariants

- Source format 6 and authored order stay unchanged. Lazy enumerable array adapters preserve
  existing full-document consumers; indexed reads use runtime-only persistent roots.
  Complete capture/JSON readers explicitly materialize and count their output.
- Static ID, incidence, component and host directories are shared. Current-source projections
  capture the current document and those directories, not a previous world. Dynamic sampled
  data, half-edge contributions, walk signs and spatial bounds path-copy.
- A swept-region certificate must discover formerly absent neighbours. Cyclic star order,
  exact canonical sampling and affected Opening constraints remain guarded. Area signs carry
  conservative forward-error envelopes; ambiguous cancellation or accumulated error delegates
  to the canonical gate. This is a sign proof, never a second area/topology evaluator.
- Compiled ordering is retained independently of map iteration. Persistent slots hold the
  canonical builders' outputs; bounds and issue counts are maintained on update paths.
  One-Wall read APIs do not flatten unrelated geometry or query records.
- Stage sealing visits unseen generated paths and values. Lazy flat arrays freeze when demanded.
  A Floor key containing all Room IDs stays deferred until a consumer requests that string.
- Wall representation diffs both Walls and Junction incidence: a changed join can affect a mesh
  whose Wall key did not change. It replaces buffers on the existing attached mesh and releases
  old buffers. An unchanged object array skips the object renderer.
- Immutable historical compile snapshots belong to their session. Restoring a known root works
  across membership changes; five transient memo-table roots are retired in constant root work.
  Branch edits evaluate from the restored persistent world. Reset still makes the next compile cold.
- Borrowed-array diffs compare backing ranges as well as node identity. A full-array visitation
  proof also covers unchanged ranges after lazy splitting; neither helper walks the untouched
  suffix merely because a temporary range-view node is new.
- Only an immutable value that was actually validated can enter the codec element cache.
  Equality includes normalization, prototype, property order and values. A mutable parser output
  is never certified in anticipation of a later freeze.
- Prepared artifacts are bounded to 16 entries and qualified by operation, baseline token and
  canonical intent. Terminal paths consume them. Weak COW hints may expire and cause a cold
  fallback; they never become acceptance authority.

The source and generated roots contain no selection, renderer handles, history, authored endpoints
or second compiler. No source format, revision mint, refusal, dependency-lock, Save or visitor
isolation contract was changed.

## 4. Complete-operation cost model

Let k include the affected dependency closure, g its samples/boundary/record/key volume, t the
spatial nodes actually tested, I irregular entries scanned, q reported spatial candidates, A
explicitly materialized array slots, D changed canonical byte volume, S serialized source size,
and v meshes whose rendered inputs changed. L counts dependency-lock entries, P other reference
checks, and U Scene/Camera projection, resolution and cross-domain runtime preparation.
Strings/IDs and entity payloads are not assumed free.

| Operation / boundary | Defensible cost |
| --- | --- |
| Fork persistent map/spatial root | O(1) handles; no entity-node copy |
| Replace one vector slot | O(log N + 32), including copied block and summaries |
| Replace one persistent map/spatial entry | O(log N) path nodes and fixed-width key work; removes/reinserts after partition escape |
| Certified local candidate, dependencies, compile | O(k log N + g + t + I + q + small dirty-set ordering); no global container reconstruction |
| Spatial query | O(t + I + q); large output uses four fixed-word radix passes. t can be Theta(N) |
| Read one retained Wall / its query records | O(log N + that Wall's requested records), with native ID-directory lookup |
| Bounds/count access | O(1) root summary; updates charged to copied paths |
| Public full source/geometry/query arrays | O(A), on demand; full issue output also charges its size |
| Stage generated sealing + stable-membership Wall/object update | Changed paths/graphs plus O(v log N + changed mesh bytes); not an O(N) enumeration |
| Known immutable compile-root restoration | O(1) root/directory operations, including membership changes; no entity traversal |
| Full accepted Layout edit | Local work **plus** native changed-source array capture/codec/reference work, lock/reference work O(L + P), runtime preparation U, canonical byte assembly/hashing O(D), and pretty source serialization O(S) |
| Accepted undo/redo to imperative installation | Existing admission/identity/JSON proofs reuse known source; compile root restores; rendering charges actual diff. Membership-changing rendering still uses the full fallback |
| First admission / cold compile / uncertain certificate | Full canonical work; no sublinear claim |
| Complete product Stage / frame | Room templates, presentation scans, scene graph traversal, draw submission and GPU work are outside the demonstrated local bound |

For fixed local k, the retained subsystem approaches O(log N + g + t + I + q). It does
not have the requested universal O(log N + k + affected results) guarantee. With h retained
local revisions, derived path storage is O(N + h k log N + retained changed geometry), apart from
explicit full materializations and cold membership rebuilds. Accepted native arrays, canonical
strings and other domains are separate retention costs. No VM garbage-collection latency guarantee
follows from these source-level bounds.

Editing a high-degree Junction, a Wall with a long curve, a Room boundary containing many Walls,
or a value that changes every Room's documented fallback thickness can have a large true dependency
closure. The entity count k alone is an inadequate measure of that output.

The accepted replay uses empty other domain payloads and an empty dependency lock. It does not
prove locality for a complex Scene/Camera/resource project. Current runtime preparation still maps
Camera Views into its read projection and resolves Scene; closure and lock code still traverses
their inputs. A Layout unit revision can also restamp many unit-level lock pins. These costs are
not mathematical requirements of immutability. A T3-owned runtime-preparation cache/read-set
decision must name Scene/Camera/resource revisions, Scene options and external dependency epochs;
blindly memoizing a callback-bearing options object would be unsafe. No such contract is installed.

## 5. Identity, ownership and owner decisions

Immutability requires stable values and no mutable aliases; it does not require whole-document
copying. Proven frozen JSON and normalized codec elements are now shared under the existing
ownership semantics. Accepted revisions, refusal ordering, dependency locks and full-source
restoration retain their existing authority.

The existing identity is flat SHA-256 over the existing canonical byte sequence. SHA's sequential
compression means a changed early byte invalidates the remaining stream state in the standard
algorithm. Prefix reuse can help late edits but gives no sublinear worst-case update. A Merkle
root is a different digest, not an interchangeable acceleration of that identity.
The primary hash definition is [FIPS 180-4](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf).

The earlier OP labels remain hypotheses:

| Hypothesis | Corrected disposition / smallest decision |
| --- | --- |
| OP-1: entity-level history / inverse journal | Entity sharing and known historical root restoration did not require an inverse journal or new F4 authority, and are implemented. Removing accepted native-array construction and whole Layout reference checks needs a T3-approved admitted persistent-source/read-adapter contract. It must retain strict arbitrary-source validation, capture-before-async, exact historical source, locks and fresh accepted revisions |
| OP-2: Merkle identity / delta Save | Not installed. A persistent hierarchical hash could update O(k log_B N) nodes; at N=100,000, fanout 32 gives four levels, roughly 128 child digests per changed path plus changed payload. This is a sizing example, not a timing or wire-compatibility claim. A flat list of all leaf hashes is still linear. New identity/version, migration, lock/pin, Save/API and delivery meanings require the owning F2/F4 decision |
| OP-3: batched rendering | No 100,000-entity FPS claim. A targeted Room-surface/portal adapter can avoid existing full scans; instancing/merging may reduce CPU submissions but must preserve materials, selection/provenance and visitor isolation. Shared renderer/Stage changes require T2/T3 review, with browser/GPU evidence in the owner-run process |

Native source arrays and full admission remain avoidable representation work, not mathematical
requirements of F4. Full requested JSON has an output-size lower bound. Full canonical SHA is a
different, existing identity obligation. Full rendering/visibility costs are yet another concern.
These must not be merged into a single claim that every remaining linear operation is necessary.

More narrowly, current COW planners refresh changed centerline objects even on endpoint moves,
and the codec constructs fresh collection arrays. These are freshness/normalizer conventions,
not canonical-byte requirements. Removing them requires checking the existing P1 source-trace
and mutable-normalizer consumers; it must not be justified merely by equal JSON. The admitted
persistent-source proposal should explicitly decide their replacement rather than preserve
unnecessary copying by accident.

## 6. Reproduction and falsification

The [S06 implementation record](../t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/acceptance.md#persistent-representation-takeover)
owns the final measured tables and limitations. The
[review handoff](../t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/review-handoff.md#current-independent-review-boundary)
maps each invariant to source and focused falsifiers. The
[evidence directory](../t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/evidence/persistent-2026-10-25/README.md)
contains raw samples, complete named counters, allocation estimates, memory observations, oracle
digests, baseline instrumentation and replay commands.

Timing windows include the entire selected operation and exclude observers, setup and full-output
oracles. The same fixture, edit, iterations and consumers run against both revisions. Cold oracles
run in separate processes over exact final authored JSON, avoiding a peak heap containing two
complete compiler graphs. Every successful local result must match both its cold oracle and the
other revision; accepted runs also compare source identity and serialized bytes. Failures stay in
the result, without extrapolated replacement numbers.

The spatial replay includes 2,048 clone/move/query operations over 100,000 entries, 32 retained
historical roots, equal-centroid slabs, all-overlap output and 1,000 irregular entries. Focused tests
add 2,000 insert/remove transitions, curved real Walls, Opening profiles, large-coordinate area
cancellation, formerly absent dependencies, immutable branching and renderer disposal. This is
bounded Node evidence, not Bench 2, browser/GPU evidence or a new independent-review verdict.

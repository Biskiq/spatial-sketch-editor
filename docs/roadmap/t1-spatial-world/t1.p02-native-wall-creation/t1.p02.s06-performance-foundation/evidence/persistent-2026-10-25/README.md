# Bounded persistent-representation evidence

This compares the exact implementation at 764175e0 with committed code at 48126338.
The harness labels the second side working-tree; both manifests have an empty changed-file list.
Both replay commands run sequential child Node processes, without this task's tests/build running
alongside timing. This is bounded Node evidence, **not Bench 2**, browser/GPU evidence or product
budget acceptance. The raw records are [pipeline.json](./pipeline.json) and [spatial.json](./spatial.json).

## Method and limits

- The same seed-101 geometry, target Wall, deltas, iterations and selected consumers run on both
  sides. Room fixtures use the existing 30% target curved-Room mix, two Openings per Room with a seeded profile mix
  and three objects per Room. Freestanding selection retains real seeded curves and 6,250 Windows.
- Setup, four local warm edits (three accepted warm edits), the observed operation and full-output
  oracles are outside the unobserved timing samples. Results are consumed. Every local operation
  forces index installation before it ends, including the base's deferred materialization.
- Local includes candidate, certification, complete index maintenance, semantic compile and a
  one-Wall/query read. Only the 10/100-Room rows also include imperative Wall/object installation.
  Large rows do not include rendering. They are not complete browser interaction timings.
- Accepted includes real F4 preparation/capture/admission, Layout validation, hashing/serialization,
  revision/history, Stage admission and imperative installation. Other domain payloads and locks
  are empty: complex Scene/Camera/resource preparation is not represented by these timing rows.
- Baseline instrumentation adds only count/test/output hooks, parsed with esbuild before any run;
  its algorithms and results are unchanged. Timing windows have no observer, although inert count
  checks remain. This is not a claim that instrumentation has literally zero CPU overhead.
- Full ordered geometry, keys, queries and diagnostics are hashed record by record. A separate
  process cold-compiles the exact final authored JSON. All 16 cold comparisons and all eight
  cross-revision pairs agree. Accepted pairs also match source-content identity and serialized
  envelope bytes. Verification digests do not replace the product's canonical identity.
- Allocation is V8 sampling at 4,096-byte intervals, including minor/major-collected objects and
  observer/profiler overhead in the counted window. It is an estimate, not every allocated byte.
  Exact explicit buffer bytes and logical copied slots/nodes are separate counters.
- Each row has 12–40 local or eight accepted timing samples; history has 110. Median and p95 use
  the recorded sorted sample ranks, not a confidence estimate. Base runs precede current runs.
  There is no randomized ordering, thermal control or product performance-budget verdict.
- Complete raw counters, inclusive spans, samples, heap/external/array-buffer/RSS and process failure
  fields remain in the JSON. Nested spans are not added as disjoint stages. Counter absence alone
  does not prove a removed copy site; the source audit and count falsifiers supply that proof.

Host: Apple M2; darwin/arm64; Node v26.7.0; physical memory 16 GiB. Load averages are recorded at write time, not controlled.

## Local operation timing and allocation

| Fixture | Authored entities | Mesh install | Samples | Median ms base / current | p95 ms base / current | Sampled allocation MiB base / current | Post-GC retained delta MiB base / current |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 10 Rooms | 140 | yes | 40 | 2.09 / 2.01 | 3.72 / 2.97 | 4.74 / 4.38 | 12.84 / 0.47 |
| 100 Rooms | 1,400 | yes | 24 | 3.43 / 2.14 | 4.53 / 3.04 | 5.69 / 4.20 | 15.03 / 0.26 |
| 1,000 Rooms | 14,000 | no | 24 | 13.58 / 1.07 | 14.94 / 2.42 | 7.91 / 1.66 | 85.18 / 0.21 |
| 7,143 Rooms | 100,002 | no | 12 | 111.98 / 2.39 | 226.21 / 3.10 | 48.79 / 1.72 | 290.58 / 0.87 |
| 31,250 freestanding Walls | 100,000 | no | 12 | 112.72 / 1.52 | 152.66 / 2.08 | 48.98 / 0.56 | 293.93 / 0.25 |

The small case has no decisive speed win. Large counts, not a fitted two-size timing slope, establish the removed linear containers. Different fixture shapes have different affected outputs; do not compare their latencies as equal work.

## Exact source-level local work

Base counts include native copied entries/slots and explicit typed-buffer payloads:

| Fixture | Source slots | Map entries | Walk slots | BVH copy + scratch bytes | Query slots | Compiled/list slots |
| --- | --- | --- | --- | --- | --- | --- |
| 10 Rooms | 80 | 240 | 20 | 2,050 + 64 | 3,144 | 130 |
| 100 Rooms | 800 | 2,400 | 200 | 19,754 + 292 | 31,821 | 1,300 |
| 1,000 Rooms | 8,000 | 24,000 | 2,000 | 190,906 + 2,340 | 319,727 | 13,000 |
| 7,143 Rooms | 57,144 | 171,432 | 14,286 | 1,386,774 + 18,724 | 2,287,343 | 92,859 |
| 31,250 freestanding Walls | 93,750 | 187,500 | 0 | 1,496,572 + 18,724 | 2,317,100 | 93,750 |

Current counts include all copied vector blocks and allocated tree nodes, rather than pretending structural sharing is zero allocation:

| Fixture | Vector slots copied | Vector nodes allocated | Map nodes allocated | Spatial node bounds tested | Spatial entries tested | Spatial results emitted | Full materialized slots |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 10 Rooms | 466 | 29 | 71 | 16 | 10 | 4 | 0 |
| 100 Rooms | 512 | 65 | 122 | 30 | 18 | 4 | 0 |
| 1,000 Rooms | 512 | 113 | 171 | 45 | 23 | 4 | 0 |
| 7,143 Rooms | 512 | 161 | 215 | 53 | 28 | 4 | 0 |
| 31,250 freestanding Walls | 224 | 77 | 43 | 37 | 19 | 1 | 0 |

There are no full source/Map/BVH/query copy sites on this local path. Native accepted source is a different boundary below. The Room edit evaluates three Walls, two Junctions, two Openings and one Room per compile: eight entities, not three total. The freestanding edit evaluates one Wall, two Junctions and one Opening. Fresh-grid BVH8 queries sometimes test fewer bounds/entries; the win is complete-operation storage/output work and sustained partition maintenance, not a claim that every scalar count fell.

## Complete accepted operation

| Fixture | Median ms base / current | Captured objects base / current | Captured property slots base / current | Codec callback entries base / current | Current immutable element hits | Current source materialized slots | Digest calls base / current | Digest bytes base / current |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 Rooms | 7.30 / 5.91 | 1075 / 45 | 3548 / 207 | 171 / 140 | 135 | 80 | 6 / 2 | 47,071 / 46,892 |
| 100 Rooms | 27.86 / 8.11 | 8503 / 45 | 30422 / 927 | 1569 / 1400 | 1395 | 800 | 6 / 2 | 436,147 / 435,968 |

Captured object count is constant while copied array slots still grow: immutability sharing does not remove native source containers. Current codec entry counts include immutable hits; global uniqueness/reference checks remain. Accepted operation runs two incremental compiles. Query assembly and generated deep-freeze no longer flatten unrelated records. Digest-byte volume barely changes: unchanged tiny units save calls, but changed Layout plus full envelope bytes still stream. Pretty canonical JSON is still serialized and retained.

## History restoration and retention

| Implementation | Timed accepted edits | Retained history depth | Post-GC heap delta MiB | Early roots sampled | Live sample indices | Sample 0 is fixture-held baseline |
| --- | --- | --- | --- | --- | --- | --- |
| base | 110 | 100 | 98.53 | 10 | [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] | False |
| current | 110 | 100 | 48.25 | 10 | [0] | True |

Four warm/count accepted operations precede these 110 timing samples. All ten base probes remain reachable. Current probes 1–9 are reclaimed; sample 0 equals the fixture baseline explicitly referenced by the harness. This is not a zero-memory history claim: native source arrays, canonical strings, changed compiled geometry and the real 100-entry history remain resident.

| Implementation | Direction | Historical compile root restored | Entity evaluations | Base flat query slots | Current materialized slots | Digest calls | F4 metadata/graph objects frozen |
| --- | --- | --- | --- | --- | --- | --- | --- |
| base | undo | 0 | 8 | 3144 | 0 | 0 | 1807 |
| base | redo | 0 | 8 | 3144 | 0 | 0 | 1807 |
| current | undo | 1 | 0 | 0 | 0 | 0 | 45 |
| current | redo | 1 | 0 | 0 | 0 | 0 | 45 |

Undo/redo measurements include coordinator admission and Stage installation; this history case omits mesh rendering. The base already reused its known admission/identity proof and did not hash on these restores. The new improvement is zero geometry evaluation/output reconstruction and a stable compile root. Single observed restore times are in raw JSON and are not a separate latency benchmark. Focused tests also restore across changed membership, keep sessions separate, and branch/reset correctly. Membership-changing renderer reconciliation still has a full fallback.

## Sustained spatial maintenance

This separate primitive replay uses 100,000 entries, 2,048 clone/move/query operations and 32 historical roots. Empty-gap queries rotate through the full domain, avoiding a fortuitous root split. Counted and unobserved sequences are separate; exact queries and historical boxes are checked after each replay.

| Policy | Unobserved 2,048-operation batch ms | Max node tests / operation | Max entry tests / operation | Total BVH buffer bytes copied | Total scratch bytes allocated | Total persistent map nodes allocated |
| --- | --- | --- | --- | --- | --- | --- |
| BVH8-refit | 1406.2 | 8,401 | 2,457 | 11,924,787,200 | 306,782,208 | 0 |
| fixed-centroid | 178.4 | 7,765 | 4,184 | 0 | 0 | 64,278 |
| adaptive-centroid | 52.7 | 34 | 17 | 0 | 0 | 104,344 |
| adaptive-extents | 65.3 | 34 | 17 | 0 | 0 | 104,344 |

The current policies trade more constant/path work for no N-sized fork. Raw retainedMemory includes the Vite/runtime, initial fixture, counted index and timed historical roots; it is not isolated index heap attribution. Array-buffer memory must not be ignored when comparing a typed-array base with object trees.

| Policy | Adversary | Entries | Results | Node bounds tested | Entries tested | Radix entry reads | Radix bucket writes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BVH8-refit | equal-centroid-slabs | 4095 | 0 | 585 | 4095 | 0 | 0 |
| BVH8-refit | fully-overlapping | 8192 | 8192 | 4681 | 8192 | 0 | 0 |
| BVH8-refit | irregular-population | 1000 | 1000 | 1 | 1000 | 0 | 0 |
| fixed-centroid | equal-centroid-slabs | 4095 | 0 | 4083 | 2041 | 0 | 0 |
| fixed-centroid | fully-overlapping | 8192 | 8192 | 8192 | 8192 | 65536 | 67584 |
| fixed-centroid | irregular-population | 1000 | 1000 | 0 | 1000 | 8000 | 10048 |
| adaptive-centroid | equal-centroid-slabs | 4095 | 0 | 4083 | 2041 | 0 | 0 |
| adaptive-centroid | fully-overlapping | 8192 | 8192 | 8192 | 8192 | 65536 | 67584 |
| adaptive-centroid | irregular-population | 1000 | 1000 | 0 | 1000 | 8000 | 10048 |
| adaptive-extents | equal-centroid-slabs | 4095 | 0 | 3 | 1 | 0 | 0 |
| adaptive-extents | fully-overlapping | 8192 | 8192 | 8192 | 8192 | 65536 | 67584 |
| adaptive-extents | irregular-population | 1000 | 1000 | 0 | 1000 | 8000 | 10048 |

Four-extrema ordering defeats the named equal-centroid slabs; it is not a general logarithmic reporting theorem. All-overlap output and irregular populations are explicitly linear. Large sorted output uses eight entry reads and four entry writes per result, plus four passes of bucket clear/prefix/increment work: 4 × (512 + 2r) bucket writes. The 2,000 insert/remove/irregular transition and 2,000 movement correctness tests remain separate exhaustive falsifiers.

## Reproduction and verification

Run from the repository root on the recorded Node runtime. The scripts own disposable git archives under the system temporary directory and remove them; no new branch/worktree/browser is created.

```sh
node apps/editor/perf/regressions/compare-persistent.mjs --allocations --output /tmp/s06-pipeline.json
node apps/editor/perf/regressions/compare-persistent.mjs --spatial --output /tmp/s06-spatial.json
```
Use --smoke for the small diagnostic or --only local:7143 for one pinned case; these do not replace complete correctness verification. Each child/oracle has a 180-second limit. Failure records stay visible rather than being extrapolated. The discarded replacement-string instrumentation failure, simultaneous warm/cold oracle OOM attempts and superseded source-change replay are not successful rows in these artifacts.

The [verification record](./verification.txt) records commands and results. Full editor: 202 files / 2,524 tests; architecture: 22 / 180; heavy: 11 / 138. Package/editor checks and build pass. These preserve prior correctness tests and add focused falsifiers, not broad browser timing. A documentation-link failure during in-progress writing was repaired and the full suite and whole architecture lane rerun. No new independent review, Bench 2 or acceptance is claimed.

The [implementation record](../../acceptance.md#persistent-representation-takeover), [architecture dossier](../../../../broad-research/spatial-computation-architecture.md), and [fresh review map](../../review-handoff.md#current-independent-review-boundary) explain remaining native source, flat identity, runtime/lock, spatial worst-case and full Stage costs.

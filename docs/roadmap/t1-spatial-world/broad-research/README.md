# T1 Broad Research — Spatial Computation Architecture

**Track:** T1 · **Area:** Fundamental Computer Science Research & Architectural Strategy  
**Owner:** T1 Spatial World Architecture  
**Status:** active reference and owner proposals

This directory holds deep research dossiers and owner decision packages that examine the fundamental computational architecture of Biskiq's spatial engine across scale, persistence, dependency tracking, incremental evaluation, and rendering.

## Dossier Register

| Document | Topic | Status | Decision Proposals |
| --- | --- | --- | --- |
| [`spatial-computation-architecture.md`](./spatial-computation-architecture.md) | Fundamental Computational Architecture Challenge (CS search space across persistent data structures, incremental computation, database view maintenance, planar subdivisions, dynamic BVH, canonical hashing, and instanced rendering) | Landed Foundation & Owner Proposals | OP-1: Entity-Level F4 History COW & Journal<br>OP-2: F2.unit-envelope@2 Chunked Merkle Content Identity<br>OP-3: Cross-Domain Batched / Instanced GPU Rendering |

## Connection to Landed Contracts

- **Landed S06 Implementation:** `packages/layout-core/src/{layout-bvh.ts,layout-world-index.ts,layout-geometry-delta.ts,layout-geometry-reuse.ts}` and `packages/project-model/src/units/{canonical.ts,validate.ts,acceptance.ts}` implement the authorized S06 delta compiler and spatial index improvements, achieving $O(1)$ scaling slopes for all authorized counters on branch `t1/p02-s06-bench-setup` (PR #190).
- **Owner Proposals (OP-1, OP-2, OP-3):** Define the bounded cross-domain contract amendments required to eliminate the remaining $O(N)$ whole-unit serialization, flat SHA-256 byte streaming, and history duplication outside authorized S06 boundaries.

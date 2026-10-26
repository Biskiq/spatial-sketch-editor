# T1 Broad Research — Spatial Computation Architecture

**Track:** T1 · **Area:** Fundamental Computer Science Research & Architectural Strategy  
**Owner:** T1 Spatial World Architecture  
**Status:** implementation evidence awaiting independent review; owner hypotheses remain unratified

This directory holds deep research dossiers and owner decision packages that examine the fundamental computational architecture of Biskiq's spatial engine across scale, persistence, dependency tracking, incremental evaluation, and rendering.

## Dossier Register

| Document | Topic | Status | Decision Proposals |
| --- | --- | --- | --- |
| [`spatial-computation-architecture.md`](./spatial-computation-architecture.md) | Source-level complexity audit; persistent storage, materialized views, dynamic spatial reporting, history and identity | S06 branch implementation, not acceptance or an optimality claim | OP-1: admitted persistent source/read boundary; OP-2: separate identity/Save migration; OP-3: bounded rendering proposal |

## Connection to Landed Contracts

- **S06 implementation:** runtime-only persistent roots, current-source projections, lazy compiled arrays and indexed renderer updates remove complete container copies from the certified local Wall path. Actual tested spatial nodes, copied slots, output and canonical byte work remain visible. See the dossier and its linked checked-in comparisons.
- **Owner hypotheses:** immutable sharing and historical compile-root restoration already work under current contracts. Further admitted-source, identity/Save and renderer changes have distinct ownership decisions; none is ratified by this research. Flat counter slopes alone never establish total-operation complexity.

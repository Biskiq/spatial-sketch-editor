# Model assessment — pipeline routing (living doc)

**Created:** 2026-08-20 · **Owner:** plan owner · **Pruned:** 2026-09-05
(owner decision: P20-onward reference only; pre-P20 rows and the expired
2026-08-27 hard-gate section removed).
**Purpose:** estimate each task's required intensity on a direct 1–100 scale,
where **Sol xhigh = 100**, then route it using the capacity table below.
The score is task intensity, not a benchmark percentage. This table is
living; keep statuses aligned with [`README.md`](README.md). Shipped P20+
rows stay as calibration references for future work; pre-P20 history was
scrubbed 2026-09-05 and is not re-assessed here.

## Methodology

- **Sol xhigh is the 100-point reference.** It is the most intensive setting in
  the policy; no higher tier exists (no Sol Max — removed 2026-08-27, never used).
- Estimate the task's required intensity from ambiguity, cross-system scope,
  consequence of failure, design judgment, and verification burden.
- Compare that task intensity to the approximate ceiling of each useful model
  setting:

| Setting | Intelligence index | Capacity vs Sol xhigh |
|---|---:|---:|
| Luna low | 33 | 57% |
| Luna medium | 38 | 66% |
| Luna high | 46 | 79% |
| Luna xhigh | 49 | 84% |
| Luna max | 51 | 88% |
| Sol medium | 54 | 93% |
| Sol high | 56 | 97% |
| Sol xhigh | 58 | 100% |

- Choose the cheapest setting whose capacity clears the task score. Treat
  Terra as dominated by the Luna/Sol frontier unless workload evidence shows a
  specific latency, style, reliability, or provider advantage.
- Start at the cheapest plausible setting and escalate on concrete capability
  failure, not prompt length or stylistic preference.

## Routing interpretation

| Task intensity | Default route | Rationale |
|---:|---|---|
| 1–55 | Luna setting selected by the capacity table | Bounded/mechanical work or established patterns |
| 56–86 | Sol medium/high/xhigh selected by the capacity table | Cross-surface implementation, state integration, or broad verification |
| 87–100 | Sol xhigh by default | Near-frontier ambiguity or high consequence |

The numeric score remains a task estimate. The capacity table determines the
model setting; it is not a claim that benchmark index points equal guaranteed
success percentages.

## Assessment — P20 onward (reference + active pipeline)

| Increment | Intensity / 100 | Recommended setting | Status / rationale |
|---|---:|---|---|
| **P20.S0** | 70 | Sol medium | shipped 2026-09-04 — asset contract + R2 gate (investigation/planning slice); high ambiguity (9 targeted unknowns, schema decision with version-policy consequences, guest-binary tradeoff) but no implementation or verification load; output is the S1–S4 slice briefs |
| **P20.S1** | 78 | Sol high | shipped 2026-09-04 — Postgres registry + R2 streaming client + authenticated API + test seam; verified by local live smoke vs real R2 (also fixed the `RETURNING` 42702 the smoke exposed) |
| **P20.S2** | 72 | Sol medium | shipped 2026-09-04 — new cloud-file ingest + Spatial acceptance reuse existing placement/selection/history; built-ins stay catalogue-only; verified by local live browser smoke vs real R2 |
| **P20.S3** | 76 | Sol high | shipped 2026-09-04 — explicit local/package texture conversion + readiness-aware Save blocker + portable export; failure matrix pins upload/mutation/Save retries; verified by local live browser smoke vs real R2 |
| **P20.S4** | 64 | Sol medium | shipped 2026-09-04 — pre-replacement Load hydration through the existing binary cache/renderer + round-trip smoke; bounded implementation, verification-heavy (refresh/Load/render fidelity); verified by local live browser smoke vs real R2 |
| **P21.1** | 77 | Sol high | shipped — shared shell: tokens/primitives + Row 1 + layout-owned projectId-keyed session (A→B teardown) + Ribbon Zones A/B/C + 3-toolbar decomposition; broadest re-host risk in P21 |
| **P21.2** | 66 | Sol medium | shipped — Scene reconciliation (Plan ghost/primer/openings/status + 3D density); presentation-only, preserved X/Z/yaw authority, Y preservation, single tagged entry, untouched gizmo pipeline |
| **P21.3** | 74 | Sol medium | shipped — Camera reconciliation (Plan sidebar/Inspector/footprints/undirected edges/per-direction timing + 3D framing/overlays + shared Timeline density, transport above lanes); preserved topology, timing, Y rule, Camera-only Timeline, shared selection/state |
| **P21.4** | 82 | Sol high | shipped — Preview takeover + Hub/flows: layout-owned takeover, exact session restore, generic visitor composition, preview-surface import-closure gate, project-switch teardown, strict Hub + entry/OAuth integrity; highest ambiguity and consequence in P21 |
| **P21.5** | 45 | Luna high | closed 2026-09-07 — UI polish pass, Slices 1–5 + §2.6 gizmo detach + 2B node colors; owner eye tests passed; presentation-only, no behavior change |
| **P21.6** | 65 | Sol medium | shipped 2026-09-08 — 3D camera visualization (token swap, nub retire, cinematic frustum, node/path unification) + focus-mode closeout; verified by six-reference visual comparison + axe/contrast sweep + Slice C focus/DPR browser rows on top of the headless suites |
| **P22.1** | 80 | Sol high | shipped — cold runtime + asset seam; release-scoped `TextureLoadScope`, shipped-static registry + retention proof, single-remap model gate; 14 focused tests, full suite 2529 green |
| **P22.2** | 78 | Sol high | shipped — release persistence + API; migration 003, revision OCC with ABA + idempotent no-ops, R2 stream-verify, owner/anon matrix; 10 real-Postgres tests, full API suite 33 green |
| **P22.3** | 74 | Sol medium | shipped 2026-09-08 — public route cold bootstrap + chrome + bundle closure; load-effect `untrack(disposeBundle)` fix found by hosted smoke (literalassigned-bundle retrigger) and pinned by regression test; fresh anonymous production session settles 1 metadata + 1 texture, no WebGL loop |
| **P22.4** | 68 | Sol medium | shipped 2026-09-08 — publish surface; dirty/stale/revision gates, switch-safety, axe; hosted owner lifecycle (publish/rename/update/unpublish/republish + stale-ABA conflict) passed on production |
| **P22.5** | 64 | Sol medium | shipped 2026-09-08 — hosted acceptance + closeout; production cold-browser loop, anonymous release-membership boundary (76,488-byte asset), shipped-static retention in deployed output, full gate (Vitest 2570, API 39, checks/builds/bundles green) |

| **P23.0a** | 68 | Sol medium | shipped 2026-09-09 — wall-first schema + explicit format identification scaffolding; schema design with version-policy consequences but bounded blast radius (no writers, read-only identification) |
| **P23.8** | 84 | Sol high | shipped 2026-09-09 — straight-wall topology + persistent Room regions; robust orientation, deterministic noding/faces/reconciliation with provenance rules; highest complexity in the Foundation Gate |
| **P23.0b** | 80 | Sol high | shipped 2026-09-09 — legacy→wall-first migration + compiler/runtime/editor cutover; three.js-exact transform preservation, ~87-site adapter ripple, byte-identical legacy compile (golden-protected); 26 new tests flushed 4 latent bugs |
| **P23.0 F0** | 72 | Sol medium | in progress — acceptance gate per the execution-order addendum in the P23.0 doc; six ordered stages, mutator inventory dominates; escalation on demonstrated failure |

Pre-P20 numbers still proposed/unscheduled (P13 stop-at-node, branch-rejoin
experiment) are assessed when scheduled — no standing rows. P23+ entries are
added here when scheduled.

# T1/T2 — Architecture and performance consolidation

**Status:** planning baseline for owner review. Nothing here is implemented and nothing in it
authorises implementation; each slice is claimed and reviewed as its own pull request after this
plan is approved. **Base:** `main` at `afca870f` (PR #314 merged). **Tier:** 2 for the plan (it
proposes enforcement of hard rules and edits to reference contracts); each slice carries its own
tier in [`slices.md`](./slices.md).

**Claim check (2026-11-13):** the only open pull request is draft #291 (`T2.S0`, Gate A). Open
issues are #284, #280 and #273. None claims this work.

## Goal

Before geometry and rendering are expanded further, bring the code back inside its documented
invariants and give the **Scene → derived geometry → render resources → renderer** pipeline one
owner per stage. Three deliverables, planned together because they touch the same seams:

1. **Invariant remediation** — the places where the code departs from the hard rules and reference
   contracts, each with a check that keeps it from recurring.
2. **The T1/T2 joint renderer refactor** — describe once, share resources by key, retain
   representations, own render identity; WebGL stays production, the result stays WebGPU-portable.
3. **T1 geometry and editing-path optimisation** — remove work that is repeated per frame or per
   accept without need.

Not in scope: new product features, kernel replacement, a WebGPU migration, speculative rewrites.

## Documents

| Document | Holds |
| --- | --- |
| [`audit.md`](./audit.md) | Evidence: findings against the invariants, the pipeline as built, the cost model with every figure labelled measured, counted, estimate or unknown |
| [`renderer-refactor.md`](./renderer-refactor.md) | Design of the renderer refactor: layers, ownership, keys, the one material factory, identity, instancing, portability rules |
| [`slices.md`](./slices.md) | Implementation-ready slices: touchpoints, dependencies, measure-first step, tests, acceptance, rollback, lanes |

## Headline findings

| Finding | Effect | Slice |
| --- | --- | --- |
| The Stage renders a full frame every display frame at rest (PF-1) | ≈60,000 draw calls per second at grid L with nothing changing; S06's "stop drawing at rest" regressed and only a source-shape test guards it | I1 |
| A live Layout candidate recompiles and redraws the whole project every frame (PF-2) | W wall compiles per tick, pointer moving or not | I2, G1 |
| Every accepted edit re-resolves the whole Scene and reruns Scene-keyed render work (PF-3, PF-4) | a Wall or Camera edit churns materials, textures and shadows | G2 |
| Rooms are still mounted per entity through Svelte with three materials each (RR-1) | ≈2,000 components and 588 materials at L; the likely main term in the 4.8 s open render gap | R3 |
| World materials are built at twelve sites; geometry and materials are per entity (AR-6, RR-3 to RR-9) | no sharing, no instancing, T2's one-factory rule unmet | R2, R4, R5 |
| The runtime re-merges Camera into Scene; a Room frame and a second wall path survive (AR-1 to AR-3) | hard rule 2 holds in authored data, not at runtime | I3, I4 |
| Compiled-geometry caching has five owners (AR-4) | repeated compiles; a session outliving its project | I2 |

## Benchmark policy

Planning ran no benchmark; every number in the audit is a record, a count from code or a labelled
hand estimate. Execution follows [`slices.md`](./slices.md) section 1.1: measure inside the slice
before changing anything, apply the optimisation only if the measurement supports the hypothesis,
measure again afterwards. Counts are the instrument and the acceptance line; durations are evidence.

## Execution shape

Seventeen slices in four file-disjoint lanes after one baseline slice (C0). Lanes can run as
parallel sessions; order inside a lane is fixed. If the milestone is cut short, the value order is
I1, G2, I2 + G1, R1, R2a, R3. R7 (instancing and batching) is gated and expected to be abandoned
unless measurement shows the frame is draw-bound.

## Owner decisions

These are the choices the plan cannot make. Each has a recommendation and a default the plan
assumes; none blocks C0, I1, I2, I3, G2 or G3.

### D1 — Measurement authority

[`performance.md`](../../reference/components/performance.md) makes performance investigation
owner-initiated and bounds wall-clock runs to `npm run perf:spot`. This milestone asks for targeted
measurement inside slices. Issue #273 reports the perf browser flows drive a menu that no longer
exists.
**Recommend:** treat this plan's approval as the owner initiation; counts are the default and need
no further authorisation; authorise `perf:spot` at exactly two checkpoints (C0 baseline, milestone
end) and single named traces where a slice asks for one; fold the #273 repair into C0.
**Default if undecided:** counts and traces only; wall-clock baseline recorded as unmeasured.

### D2 — Visitor free look outside the Camera authority (AR-7)

The visitor's neutral frame is driven by `OrbitControls`, a pose authority outside Camera. Hard
rule 1 lists free look as a profile realised through Camera.
**Recommend:** record it as a named, tested exception until T3 owns free look, rather than rebuild
Camera work inside a T1/T2 milestone.
**Default if undecided:** unchanged and unscheduled; the finding stays open.

### D3 — Candidate preview wording in the reference contracts

`architecture.md` describes a candidate preview as a compile plus `buildPaperPlan`;
`layout-performance.md` keeps compilation off the per-move path. Both are satisfiable.
**Recommend:** keep the design — a candidate goes through the one compiler, never a second
evaluator — and amend both to say "once per distinct candidate, through a session; never per
frame". G1 carries the edit.
**Default if undecided:** G1 implements that behaviour and leaves the wording for the next owner
checkpoint.

### D4 — Ordering against T2.S0 (PR #291) and Directional retirement

R2 encodes the Gate A pipeline record; R6 assumes Point, Spot and the Sky's Sun only.
**Recommend:** merge #291's Gate A record before R2a opens; land Directional retirement as its own
product slice before R6.
**Default if undecided:** R2a reads the pipeline values from the code as merged; R6 waits.

### D5 — Priority

[`focus.md`](../../../focus.md) names the PR #259 harness cutover as the current priority and
changes only by owner commit. Scheduling this milestone is the owner's call.

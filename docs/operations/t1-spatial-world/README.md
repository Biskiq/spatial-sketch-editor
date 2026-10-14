# T1 — Spatial world: operational runbook

**Role:** how T1 work is started, verified, reviewed, closed and escalated. Procedure only — this
file copies no status and owns no list.

```text
STATUS:  ../../roadmap/README.md#track-register → ../../roadmap/t1-spatial-world/README.md → phase child row
BATON:   ../current.md
GATES:  ../../roadmap/README.md#gate-register          (eligibility rules live there, never here)
CYCLE:   ../architecture-cycle.md                      (loaded only by the start step below)
EVENTS:  ../README.md                                  (completion · integration · replanning)
```

## Working agreements

- **Extraction discipline.** Extract responsibilities with their callers and ownership
  boundaries. A forwarding surface is justified only when it serves an intentional, owned interface
  or a bounded migration; a temporary compatibility shim names its retirement condition and cannot
  count as completed extraction merely because the implementation moved behind it. Maintain one
  authoritative owner per mutable state fact. **Implementation review owns the caller-migration and
  shim-retirement decision**; routine closeout only confirms that the accepted evidence contains no
  unowned remaining shim, and it introduces no production edit.
- **One writable owner per concern.** Track objectives and the phase register live in
  [`../../roadmap/t1-spatial-world/README.md`](../../roadmap/t1-spatial-world/README.md); phase
  scope, the slice register and `PHASE CLOSE` live in the phase README; current assignments live
  in the baton. Link them; never mirror their content.
- The canonical architectural compiler stays single, and Layout-owned representation consumes its
  output — a T1 slice never reconstructs topology or adds a second ownership of a Layout fact.

## Start implementation

```text
1 ELIGIBILITY  the slice's child row in its phase README is `approved` or `in-progress`, and every
               `Consumes` Gate@Version already exists and is `accepted` at the trusted base
2 CYCLE        "If your slice ID is listed under Exposure slices and `Opened by` is empty, follow
               `open-window` before capability work." (→ ../architecture-cycle.md)
3 CONTRACT     the slice plan's verification tier and its integration route, with the commands in
               ../../../apps/editor/tests/README.md
4 SEQUENCE     implementation → review → acceptance → routine closeout → merge
```

A requirement change discovered during work goes to the reviewer, or back through the F amendment
path ([`../../roadmap/f-foundation-contracts/README.md`](../../roadmap/f-foundation-contracts/README.md))
— never into a phase-local encoding.

## Test families

- kernel correctness (`@portfolio/layout-core`, `@portfolio/project-model`) in the fast and heavy
  lanes; the arch lane stays unconditional;
- the Layout geometry, wall-mesh shell and camera-core boundaries in
  [`test-lanes.ts`](../../../apps/editor/test-lanes.ts);
- dense geometry and numerical sweeps stay dense (tests/README rules 12–14, 21).

Tier, evidence and escalation are owned by
[`apps/editor/tests/README.md`](../../../apps/editor/tests/README.md) ("What a change requires" and
the focused ladder). A PR #115 checkpoint keeps the complete §7.4 contract; after #115 a
per-implementation-PR merge keeps its declared full gate.

## Review, closeout and event routes

```text
REVIEW / ACCEPT  the slice plan's criteria plus recorded evidence
ROUTINE CLOSE    slice-closeout (final-gate guard; cycle-window check; no production edit)
PHASE CLOSE      explicit owner invocation → phase-closeout
TRACK COMPLETE   explicit owner request → ../README.md top section
INTEGRATION      an approved integration plan → ../README.md second section
REPLAN           new goal, completion handoff or orphaned obligation → ../README.md third section
```

## Scoped debt and interruption

A deferred defect goes to [`../tech-debt/README.md`](../tech-debt/README.md) with this track or its
phase named as `Owner`; a deferred-retirement row stays in the track README with its exact
condition. Interrupted substantial work uses `work-checkpoint` and
[`../checkpoints/README.md`](../checkpoints/README.md): the checkpoint carries the track/phase/slice
identity, the resume route, which verification tier ran with its tested revision and diff, and the
integration gate still owed. A focused green run is never inherited as acceptance.

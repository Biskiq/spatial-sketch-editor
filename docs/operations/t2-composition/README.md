# T2 — Composition: operational runbook

**Role:** how T2 work is started, verified, reviewed, closed and escalated. Procedure only — this
file copies no status and owns no list.

```text
STATUS:  ../../roadmap/README.md#track-register → ../../roadmap/t2-composition/README.md → phase child row
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
  [`../../roadmap/t2-composition/README.md`](../../roadmap/t2-composition/README.md); phase scope,
  the slice register and `PHASE CLOSE` live in the phase README; current assignments live in the
  baton.
- **Scene placement mutates Scene only.** Layout is consulted for support and never mutated by a
  placement; a mixed Layout/Scene transaction, a per-instance Plan proxy or a persisted Plan
  transform is not introduced. Acquisition/approval stays outside authoring history.

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

A Scene-level requirement that needs a shared interface goes through the F amendment path; T2
never mints a parallel format.

## Test families

- `@portfolio/project-model` Scene codec, world-local validation and writer suites, with the
  project-model boundary in [`test-lanes.ts`](../../../apps/editor/test-lanes.ts) unconditional;
- the kernel-level Scene transform/validation contract in
  [`scene-content.md`](../../reference/components/scene-content.md) and the wall-mesh shell
  boundary for shared render modules;
- dense assembly and material/light matrices in the heavy lane;
- the real-Postgres API suites when a change reaches Save/Load, assets or publication, executed
  with a reachable database and **zero skips**.

Tier, evidence and escalation are owned by
[`apps/editor/tests/README.md`](../../../apps/editor/tests/README.md) ("What a change requires" and
the focused ladder).

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
phase named as `Owner` (TD-1's remaining obligations are carried in the track README and the
planning evidence). Interrupted substantial work uses `work-checkpoint` and
[`../checkpoints/README.md`](../checkpoints/README.md): the checkpoint carries the track/phase/slice
identity, the resume route, which verification tier ran with its tested revision and diff, and the
integration gate still owed. A focused green run is never inherited as acceptance.

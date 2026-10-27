# T5 — Expressive Geometry: operational runbook

**Role:** how T5 work is started, verified, reviewed, closed and escalated. Procedure only — this
file copies no status and owns no list.

```text
STATUS:  ../../roadmap/README.md#track-register → ../../roadmap/t5-expressive-geometry/README.md → phase child row
BATON:   ./current.md
GATES:  ../../roadmap/README.md#gate-register          (eligibility rules live there, never here)
CYCLE:   ../architecture-cycle.md                      (loaded only by the start step below)
EVENTS:  ../README.md                                  (completion · integration · replanning)
DIRECTION: ../../roadmap/t5-expressive-geometry/umbrella-plan.md
```

## Working agreements

- **T5 builds capability; the owning domain keeps meaning.** Native forms are Scene truth. T5 writes
  the native-form parts of the Scene unit, codec, validation and planners under T2 review, and the
  Stage seams it needs as T1-reviewed patches. T5 creates no document, writer, history, selection,
  acceptance path, Camera or renderer of its own.
- **One writable owner per concern.** Track objectives and the phase register live in
  [`../../roadmap/t5-expressive-geometry/README.md`](../../roadmap/t5-expressive-geometry/README.md);
  architecture and the phase roadmap live in the
  [umbrella plan](../../roadmap/t5-expressive-geometry/umbrella-plan.md); phase scope, the slice
  register and `PHASE CLOSE` live in the phase README; current assignments live in the baton.
- **Shared Scene files.** Scene unit, codec and planner edits are serialized with T2's writers under
  the [shared-file protocol](../../roadmap/cross-track-execution.md#shared-files-and-merge-protocol).
- **Canonical geometry is deterministic.** `@portfolio/geometry-core` uses exactly rounded arithmetic
  only, carries no domain meaning, renderer or DOM, and a change to canonical output for an accepted
  source moves the Scene format version with new goldens.
- **Dependencies.** A library enters only through its slice plan or an owner decision, under the
  permissive-only licensing rule; a copyleft candidate stops and is reported.

## Start implementation

```text
1 ELIGIBILITY  the slice's child row in its phase README is `approved` or `in-progress`, and every
               `Consumes` Gate@Version already exists and is `accepted` at the trusted base,
               and the scope is listed in `docs/roadmap/now.md` with its condition met
2 CYCLE        "If your slice ID is listed under Exposure slices and `Opened by` is empty, follow
               `open-window` before capability work." (→ ../architecture-cycle.md)
3 CONTRACT     the slice plan's verification tier and its integration route, with the commands in
               ../../../apps/editor/tests/README.md
4 SEQUENCE     implementation → review → acceptance → routine closeout → merge
```

The change stays in the owning authority (AGENTS.md rules 1, 2 and 6). Add the test that fails
when the new behavior breaks. Run the verification tier the slice plan declares. The
[test manual](../../../apps/editor/tests/README.md) owns the acceptance bar, and `npm test` is never
narrowed. A cross-domain need goes through the F amendment path; T5 never mints a parallel format.

## Test families

- `@portfolio/geometry-core` corpus, golden digests and the determinism source scan, with the
  package boundary in [`test-lanes.ts`](../../../apps/editor/test-lanes.ts) unconditional;
- the `@portfolio/project-model` Scene codec, validation, record-scope and planner suites for native
  forms;
- editor rendering, Plan footprint and visitor-isolation suites that native forms reach;
- the real-Postgres API suites when a change reaches Save/Load, executed with a reachable database
  and **zero skips**.

Tier, evidence and escalation are owned by
[`apps/editor/tests/README.md`](../../../apps/editor/tests/README.md) ("What a change requires" and
the focused ladder).

## Review, closeout and event routes

```text
REVIEW / ACCEPT  the slice plan's criteria plus recorded evidence; T2 review for Scene changes,
                 T1 review for Stage seams, T3 review for any F4/Head/Save change
ROUTINE CLOSE    slice-closeout (final-gate guard; cycle-window check; no production edit)
PHASE CLOSE      explicit owner invocation → phase-closeout
TRACK COMPLETE   explicit owner request → ../README.md top section
INTEGRATION      an approved integration plan → ../README.md second section
REPLAN           new goal, completion handoff or orphaned obligation → ../README.md third section
```

## Scoped debt and interruption

A deferred defect goes to [`../tech-debt/README.md`](../tech-debt/README.md) with this track or its
phase named as `Owner`. Interrupted substantial work uses `work-checkpoint` and
[`../checkpoints/README.md`](../checkpoints/README.md): the checkpoint carries the track/phase/slice
identity, the resume route, which verification tier ran with its tested revision and diff, and the
integration gate still owed. A focused green run is never inherited as acceptance.

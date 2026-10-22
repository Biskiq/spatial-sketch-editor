# T4 — Release and delivery: operational runbook

**Role:** how T4 work is started, verified, reviewed, closed and escalated. Procedure only — this
file copies no status and owns no list.

```text
STATUS:  ../../roadmap/README.md#track-register → ../../roadmap/t4-release/README.md → phase child row
BATON:   ./current.md
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
  [`../../roadmap/t4-release/README.md`](../../roadmap/t4-release/README.md); phase scope, the
  slice register and `PHASE CLOSE` live in the phase README; current assignments live in the baton.
- **The reader is separate.** The release reader is independently versioned and never depends on
  the changing authoring validator; publication is closed over its resources before it serves, and
  a missing, failed or corrupt resource is visible rather than silently accepted.

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
when the new behavior breaks. Do not copy a gate conformance suite into the slice. Run the
verification tier the slice plan declares. The [test manual](../../../apps/editor/tests/README.md)
owns the acceptance bar, and `npm test` is never narrowed.

The prepared-reader cutover consumes the ratified F.5 envelope as an exact gate version before it
is eligible; it replaces the strict snapshot reader atomically rather than running beside it.

## Test families

- the real-Postgres API suites (`publication`, `test-auth`, `projects`, `assets`, `migration`),
  executed with a reachable database and **zero skips** — a skipped DB-backed run is a blocked
  checkpoint, never a pass;
- the visitor suites — cold runtime, public route, identity isolation — plus the vite
  public-surface boundary plugin test, all unconditional in
  [`test-lanes.ts`](../../../apps/editor/test-lanes.ts) because no lane or build can see a broken
  `/p/:publicationId` entry point;
- browser checks on the retained product routes (sign-in entry, project hub, the read-only spatial
  Stage and a cold `/p/:id`), recorded as manual evidence when they are the only coverage.

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
phase named as `Owner`; the snapshot-reader retirement row stays in the track README with its exact
condition. Interrupted substantial work uses `work-checkpoint` and
[`../checkpoints/README.md`](../checkpoints/README.md): the checkpoint carries the track/phase/slice
identity, the resume route, which verification tier ran with its tested revision and diff, and the
integration gate still owed. A focused green run is never inherited as acceptance.

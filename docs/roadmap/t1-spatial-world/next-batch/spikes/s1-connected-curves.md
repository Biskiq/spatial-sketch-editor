# T1 S1 — Connected Curves technical spike

**GO for the connected-curve plan on model B.** Results 2, 3 and 4 hold at the fixture level.
The Room can carry whole-object identity through real arc Walls, the stated radius survives
exactly, and a validated radius candidate can move the connected ring as one edit or refuse it
as a whole. Model C is unnecessary for these results.

**Authority:** [The spike (S1)](../README.md#the-spike-s1) and
[implementation acceptance](../implementation-prs.md#lane-s-spikes-with-a-decision-as-their-exit).
**Base:** `06f0d0df` on `origin/main`. Only the fixtures and this report are part of S1.

## Reproduce

Run from the repository root with workspace dependencies installed.

```sh
cd apps/editor
npx svelte-kit sync
npx vitest run tests/lib/layout/spikes/s1-connected-curves.test.ts --maxWorkers=2
```

Seven tests pass. The suite prints the geometric errors. It uses the existing Layout codec,
Wall/Junction topology, Opening and portal validation, and compiler to judge staged candidates.
For Undo/Redo it uses the existing F4 history stack with test snapshots containing canonical
Layout bytes and a separate Round fact. Recording and restoring that envelope is fixture code.
The real editor acceptance coordinator, identity installation and saved project format were
outside the probe.

## Results

| S1 result | Existing production behavior | Test-harness simulation and measured outcome |
| --- | --- | --- |
| **1. Exact subdivision** | The cubic split resolver partitions by de Casteljau subdivision. The open-Wall split planner retains the first fragment's ID and rewrites oriented Room boundary refs. The closed-Wall planner refuses to split. | Staged the first closed-to-open split, keeping the original seam and one Wall ID. The following splits and Junction-snapped attachments use shipped planners. Each split matched the original cubic under reparameterization within `1e-11 m` at 65 samples per half. Untouched cubics were identical. |
| **2. Whole identity and Round** | Reconciliation kept the Room ID/name on the staged first split and the second attachment. The second closes a real adjoining Room with one shared arc. Opening create/move worked on a ring member. The shipped group move translated both Rooms and their shared arc. The isolated Duplicate planner cloned the boundary and Opening after the annex was stripped with shipped deletions. | Carried the stated fact by Room ID, updated its centre on move and gave the copy a new fact, ID and normal copy name. The copy fixture grafted the isolated clone into the original connected scene and kept the source and annex in place. Repacking the detached ring produced one canonical closed Wall and retained the Room ID/name and seam-hosted Opening. The history stack restored exact before/after snapshot bytes for each operation. |
| **3. Exact radius** | The current Room codec rejects an inline `round` field. The shipped closed-Wall reader averages stored geometry for the isolated circle and returns null on an open arc. | The stated `5.123456789012345` m survived a JSON round trip with exact number equality. The same Layout bytes with the fact removed yielded no Round value. A nullable Room-owned `{ center, radius }` is sufficient for this evidence. Presence states Round, so the exact radius needs no additional scalar, fit or tolerance. |
| **4. Whole resize and refusal** | The opening-set validator rejected `opening_exceeds_wall` and named the attached Wall whose window no longer fit. Canonical gates accepted the valid whole candidate. | At 4 m, all three rim Junctions and all arc controls scaled about the stated centre. Outside Junctions stayed fixed and the attached Wall stretched by 1 m through its shared Junction. The arc Opening's near-edge angular station and physical width survived. At 6.125 m the neighbour would shorten from 3 m to 1.875 m, below its Opening's 2.25 m far edge. The attempt returned only a refusal and left all Layout/fact bytes and history depth unchanged. The accepted edit occupied one history entry. |
| **5. Clear Round** | The chord divided the rotunda and kept a split survivor with the original ID. Deleting the chosen exterior arc opened the rotunda and retired that Room under today's closed-face reconciliation. | Cleared the stated fact on the divide survivor and on open. Release cleared only the fact, leaving identical Layout bytes. The round-specific reference stopped resolving in all three cases. Undo/Redo restored the exact snapshots. |
| **6. Stable interior surface** | Compiled physical Walls resolve by authored Wall ID. An oriented Room boundary identifies which face of a shared Wall bounds that Room. | One unchanged fixture `{ roomId, role: 'inside' }` resolved to the original closed Wall and then every current member arc after each attachment. It excluded annex Walls and selected the inward side of a deliberately reversed shared arc. This is a resolver probe for the surface-lineage plan. |

### Cubic measurements at 5 m

The seam remains a degree-two Junction. The first off-seam attachment therefore makes two
ordinary open arc Walls. Subsequent attachments add one each. Measurements use persisted
cubics, with 257 samples per span for radial error and the production cubic arc-length
integrator for length. The closed-circle budgets are `1e-6 m` radial error and `2e-6 m` length
error at this radius.

| Attachment points | Open arc Walls | Max sampled radial error (m) | Absolute length error (m) |
| ---: | ---: | ---: | ---: |
| 1 | 2 | 3.316202e-7 | 1.071586e-6 |
| 2 | 3 | 3.316202e-7 | 1.071586e-6 |
| 4 | 5 | 3.316202e-7 | 1.071586e-6 |

Subdivision preserves the cubic approximation already used for the closed circle. The exact
authored radius and the geometric approximation are separate facts.

## Counterexamples and tradeoffs

- **Rekeying the entire ring loses the Room.** Production correspondence retired the rotunda and
  created a new Room for the same geometric face when both first-split Wall IDs were replaced.
  Retaining one Wall ID authorized correspondence through the existing topology component.
  A plan that changes that ID strategy needs explicit lineage. A radius field alone cannot
  recover this identity.
- **The closed-Wall planners are limited to isolated circles.** The shipped split refuses with
  `closed_wall_isolated` and the shipped closed-Wall radius planner rejects an open member with
  `not_closed_wall`. Model B uses the shipped cubic and topology primitives with a planner that
  handles the closed-to-open transition and validates a whole-ring candidate.
- **Existing Move and Duplicate have different isolation rules.** Move succeeds for the two-Room
  group and refuses the single-Room fixture with a dangling external Wall. Direct Duplicate on
  the shared-boundary rotunda refuses with `room_not_isolated`. The fixture shows that a
  boundary-only copy can compile with fresh IDs and preserve the connected source. The plan owns
  what moves with a dangling attachment and what a connected Duplicate includes.
- **Detach has a canonicalization cost.** A concatenation of subdivided pieces would contain extra
  spans and fail the closed Wall's symmetric 16-span encoding. The fixture rebuilt that encoding
  from the stated centre and surviving seam. It used uniform member dimensions and one Opening
  on the seam fragment. Dissimilar dimensions, Opening rehosting across fragments and seam
  crossings require an explicit policy. The fixture retains the seam in the existing graph,
  so it needs no extra stored seam datum.
- **Model C would change the topology contract.** Station-hosted Junctions would create connectivity
  through a Wall interior without a shared endpoint. Noding, component membership, face traversal,
  junction clearance, Opening relations, Room reconciliation, surface lineage and downstream
  consumers would all have to account for it. B adds Room-owned data and operation rules while
  keeping the existing Wall representation and endpoint connectivity.

## Still unproven

The subsequent plan owns the production Round encoding, compatibility for already-authored
isolated circles, guarded member edits, and full acceptance and history wiring. The resize
probe uses straight neighbours, one adjoining Room and an Opening-fit refusal. Curved
neighbours, more complex adjacency, competing Round Rooms, other geometric refusals and general
Opening migration were outside the sample. The fixture uses the existing near-edge Opening
station convention. The consequence text, virtual-edge Space opening and durable surface
references across Layout and Scene remain work for their approved plans.

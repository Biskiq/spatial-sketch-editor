# Native Form Lab findings

## Status

The prototype implements editable extrusion, revolution and sweep journeys,
with saved authored source and role-addressed references. It is evidence for
P3/P5 exploration, not a product decision. The reproducible
[agent-run browser check](./qa/browser-check.mjs) passed on the rebuilt
preview. No creator study or performance measurement has been run.

## What this prototype demonstrates

- Extrusion, revolution and sweep are generated from a retained keyed profile;
  the sweep also keeps keyed carrier points and a fixed frame-anchor point.
  Preview and commit use the same evaluator, invalid candidates are refused,
  and accepted edits enter one snapshot-based undo step.
- A role address names the form and authored part key. Splitting a painted
  segment broadcasts its finish to both descendants; a singular attachment to
  the retired segment stays unresolved at its last pose. Removing an inserted
  point retains the incoming finish on the merged side and diagnoses a
  conflicting secondary finish.
- Partial-revolve cap keys belong to one cap lifetime. The model and geometry
  integration tests cover 270° → 360° → 270° without reviving an old cap
  address. Undo restores the previous authored snapshot and its exact keys;
  evaluator tests also compare sweep bounds and role frames after reversal.
- Child forms and visual markers retain their authored work when a host role
  disappears. Resolved child links transport the child frame and sweep path
  with host motion; an attachment outside a shrunken cap becomes unresolved
  without clamping its anchor.
- The **Review** drawer compares contextual geometric handles with explicit
  Pull/Revolve/Follow path choices on the same model. Numeric fields provide a
  second route for the same validated edits. This is an interaction
  alternative, not a usability comparison.

Model and geometry tests are executable implementation evidence, not evidence
of task success by target creators. The agent-run browser check exercises four
bounded workflows with actual pointer, keyboard and UI input. It does not
complete the full P5 identity agenda.

## Browser evidence

The runner passed all four groups:

1. **Blank profile:** the first ground click places the first point, Escape
   cancels a draft, and a four-point profile creates a form. The earlier
   preview swallowed the first click while latching the ground plane; the
   pointer path was fixed to latch and place on that click.
2. **Pedestal:** height-handle drag previews and commits, Undo restores the
   prior height, an oversized radius is refused without changing the accepted
   shape, and a real page reload followed by File → Load local draft preserves
   the edited height and marker ID/pose.
3. **Revolve:** a marker is attached by picking the actual 270° end cap. After
   270° → 360° → 270°, the marker to `cap:2` remains unresolved and the
   returning caps receive fresh `cap:5` and `cap:6` addresses.
4. **Sweep:** a non-anchor carrier point is revised by pointer drag; reversing
   traversal keeps the keyed points, segments and fixed anchor identity.

Evidence: [blank profile](./qa/evidence/01-blank-profile.png),
[pedestal reload](./qa/evidence/02-pedestal-marker-reload.png),
[revolve cap lifetime](./qa/evidence/03-revolve-cap-lifetime.png), and the
[tilted host revision](./qa/evidence/04-tilted-host-revision.png).

The additional tilted-host run drew a four-point child on a 15° cap, applied a
`0.2 m` offset, and raised slab height from `0.24 m` to `0.4 m`. The child moved
by `0.16 m` along the host normal and retained its resolved host link. Face
profile → Return to perspective restored the exact prior camera position,
target, up vector and field of view.

Additional agent-run checks: a ground-plane X lock preserved the second point's
`V = 0.4 m` despite an off-axis click. On the 15° cap, world-Y lock refused a
non-tangent point with an explanation and did not add it; local-V lock then
placed a point while preserving `U = -0.1 m`. Moving the fixed trim carrier
anchor by pointer kept the carrier point, frame anchor and form frame together
(`(0, 0.08, 0) → (-0.2, 0.08, 0)`). Editing Carrier 1 X to `-0.4 m` kept the
same three values synchronized. The compact-layout capture at 1024×768 measured
1024 px body width without horizontal overflow, a 550×598 px viewport, a 124 px
profile list and a 140 px carrier list; both lists scrolled while retaining
their numeric fields. See [compact trim and constraints](./qa/evidence/05-trim-compact.png).

Explicit repair was also exercised: the old `cap:2` marker stayed unresolved
after `cap:5` appeared; selecting its unresolved row, picking a point on the
new cap and choosing **Repair on selected face** resolved the same `attachment:4`
to `cap:5`.

An earlier child placement retained the host cap origin rather than the picked
surface point, which could put the child's anchor outside the cap boundary.
The UI now rebases the child source frame at its first drawn point; the tilted
host revision above exercises that repair. A first-point loss in blank Draw was
also corrected and covered by the runner.

## Limits and next experiments

There is no free three-anchor plane or curved/nonplanar host surface. Profiles
are a single closed contour; this does not cover holes, general booleans,
unconstrained 3D sketching, or robust CAD-kernel operations. Sweep carriers are
keyed polylines with explicit XYZ edits; sharp spatial corners are refused.
Only planar roles can host child profiles or markers. These are prototype
limits, not conclusions about what production needs. No advanced free-plane
workflow has been built or studied.

The current interaction hypothesis is contextual geometric handles paired
with a precise source Card and profile/face reading, with explicit operation
choice kept as a comparison. This is an experiment to test, not a production
decision. Next, compare the modes with target creators and test whether their
ordinary work needs free planes or curved hosts; neither need is established.

The tested identity subset covers segment split/finish broadcast, singular
attachment retirement and explicit repair, cap-lifetime replacement, local
save/reload, undo and sweep reversal. Full P5 remains open: pattern/member
correspondence, booleans, copy/version migration and cross-browser address
determinism have not been tested. P3 comparison with direct solid editing is
also unrun. No human-study, latency or memory claim follows from this prototype.

The prototype suite has 34 passing tests, with UI typecheck and build green. The
repository architecture lane passed for 22 files and 178 tests in single-worker
mode.

## Provenance and authority

This lab is a narrow runnable study for [PR #192](https://github.com/Biskiq/spatial-sketch-editor/pull/192)'s
[P3 profile-family proof](../../broad-research/native-creative-depth/proof-agenda.md#p3-profile-families-stay-editable)
and [P5 identity proof](../../broad-research/native-creative-depth/proof-agenda.md#p5-identity-through-ordinary-revision),
using the role-address policy proposed in
[geometry identity §5](../../broad-research/native-creative-depth/geometry-identity-and-performance.md#5-identity-and-correspondence).
[Vellum (P3)](../p3-vellum/README.md) is a separate, broader spatial-authoring
prototype and does not supply this lab’s data model. The destination World
authoring design is [PLATE §0.8.4](../../docs/reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination).
This prototype is not an adopted production contract or shell.

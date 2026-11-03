# R217.S25 — acceptance record: Experience shared homes

**Slice:** R217.S25 · **Status:** accepted 2026-11-03 at tested revision `703712d7` (owner-override: owner visual acceptance; see the ruling below) · **Plan:** [implementation-plan.md](./implementation-plan.md) (closed to a stub; owns the criteria in its recovery line) · **Design decisions:** [design-harvest.md](./design-harvest.md) (D1–D13) · **Phase:** [R217](../README.md) · **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

**AUTHORITY: NONE.** This record reports the delivered homes, the owner's ruling, the gates and the residuals. The [phase slice register](../README.md#slice-register) owns status.

## Owner ruling

**owner-override, 2026-11-03, revision `703712d7`.** The owner personally reviewed the working UI and accepted the S25 visual and interaction design. Scope: owner accepted the S25 UI after direct review; the Opus independent-review gate was replaced by owner visual acceptance for UI slices from S25 under the owner's process change of 2026-11-02. Waived: the independent-review verdict for this UI slice. This is the owner's acceptance, not an independent `reviewed` verdict, and it applies to this slice and this revision only.

Tested revision: `703712d7` on `claude/r217-s25-experience-shared-homes`, from `e9e778a0` on `main`. Code commits `66041049`, `fb4b2dea`, `f31683e7`, `703712d7`.

## What the slice did

| Part | Where | Change |
| --- | --- | --- |
| Head | `stage/shell/EditorHead.svelte` | Experience lens and the single Preview entry |
| Index | `stage/shell/EditorIndex.svelte`, `experience-index-groups.ts` | Experience crumb with New Experience, Presentations with their Views, then Guides, in Round 2 row metrics |
| Card | `stage/shell/EditorCard.svelte`, `experience/Experience*Writer.svelte` | One Card subject (D10); Conservatory interiors for Presentation, View, Stop, Transition, Guide and Scene object; unsupported actions disabled with their reason |
| Lower edge | `experience/ExperienceDock.svelte`, `ExperienceHomesHost.svelte` | Select, Capture and Guide keys |
| Guide | `experience/ExperienceGuide.svelte` | Round 2 820 px instrument, closed by default; ordinal bar, holds on the Stop cards (D9) |
| Stage | `stage/stage-facade.ts`, spatial route | No World marks or gizmo in the Experience lens (D13); a World selection shows its Experience Card on lens entry |
| Controller | `experience/experience-controller.svelte.ts` | S24 behaviour; fading messages and readable refusals |
| Retired | `ExperienceSurface.svelte` | Removed; no full-surface overlay remains |

Shell contract Experience sections were reconciled in `17cd8780`, before this close. The drift register's Experience anchors (D24) point at the shared homes.

## Gates (reused from the implementer and reviewer; not re-run at close-out)

| Command | Result |
| --- | --- |
| `npm run check` | 0 errors, 0 warnings |
| `test:fast` | 3335 passed (243 files) |
| `test:arch` | 203 passed (23 files) |
| `test:heavy` | 138 passed (11 files) |

## Browser and visual evidence

The main session compared the shared homes with `prototypes/production-shell-wireframe` at 1440×900 at `703712d7`. No screenshots are kept, by the owner's rule against evidence archives. The owner's visual acceptance is the manual-owed row; it is carried by the ruling above, not by automated evidence.

## Deliberate differences (approved)

- The Experience switcher stays in the Index crumb, as the approved harvest decision. The Round 2 wireframe places it in the Head.
- There is no total time readout and the ordinal bar waits for S26 (D9).

## Residuals

- The two deliberate differences above.
- The integrated journeys and the coarse-pointer, native-touch and Safari rows stay with R217.S11.
- The plan's criteria remain as recorded in the plan's recovery line.

## Closeout and preservation

Capability outcome, routed to the [phase slice register](../README.md#slice-register): R217.S25 puts Experience into the shared Head, Index, Card, lower edge and Guide, and retires the full-surface Experience overlay. No persisted format, gate or F interface changed.

```text
CLOSEOUT PRESERVATION — R217.S25 (2026-11-03)
prose compacted:                 1   implementation-plan.md → stub at its own path
reference promotions:            0   shell contract reconciled earlier in 17cd8780
renderable evidence archived:    0   none kept (owner rule)
evidence stubs / manifests:      0
transient artifacts removed:     0   design-harvest.md stays live as the decisions home
historical anchor:               660410499a7b76c18419907b32ea3bfb332cd9b9 · tag closed/r217.s25 (not yet created; created after the P1 merge)
new live → archive prose links:  0
manual-owed verification rows:   1   owner visual acceptance, carried by the 2026-11-03 ruling
remaining deferred items:        see Residuals
permanent stubs added:           1
```

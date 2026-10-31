# R217.S17A — acceptance record

**AUTHORITY: NONE.** The phase [slice register](../README.md#slice-register) owns status;
[R217.S11](../r217.s11-integrated-final-gate/acceptance.md) owns integrated acceptance.

## Delivered

- Objects panel, compact row and All; no Place selector; Shape removed from Ink.
- Box and Round click and drag, Free corners with closing on the start, and Sphere, in Plan and 3D.
- Placement on the datum in a genuinely empty project for native forms, primitives and approved models. My Objects copies share the same planner path and are covered at planner level.
- Room floor precedence; a move or duplicate that would change resting elevation refuses.

## Browser evidence

Chromium, real pointer input, private database:
`perf/flows/s17a-objects-acceptance.spec.ts` and the empty-project leg of
`perf/flows/s03-own-model-acceptance.spec.ts` both passed. The compact row was measured at
1440×900, 1280×800, 1180×820 and 820×1180.

## Residuals

- **Catalogue models.** Placement in a project without the asset resource was refused by envelope closure, independent of floor support, and that predates this slice. The panel now offers a catalogue model only where the resource exists, so a new project shows none. Introducing the resource is follow-up work.
- Find-only Place plinth, unused `ink-readings-v1` plumbing, and the other perf flows that use old labels stay as recorded debt.
- Native touch and Safari remain owed to S11. A My Objects copy on the datum was not driven in a browser here.

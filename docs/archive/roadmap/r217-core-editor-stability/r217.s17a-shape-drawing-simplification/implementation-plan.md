# R217.S17A — Shape drawing simplification

AUTHORITY: active slice plan until closed. Decisions: O10 and O11 in
[owner-decisions](../post-s10-convergence/owner-decisions.md).
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: S11

## Outcome

Objects is the single entry point for creating and inserting objects, and placing one needs no Room.

## Scope

- Shape leaves Ink. The Place selector is removed. The panel holds Box, Round, Free, Sphere, Models, My Objects, Import and one Exact position.
- `draw-session.ts` replaces the Ink reading: click standard, drag corners, Free corners and runs. Height comes after creation, from the Card or the Height ray.
- `resolveSceneSupport` falls back to the Layout datum where no Room floor covers a point, and the Stage previews through the same function.

## Boundaries

No schema, format, F4, Camera or snap resolver change. `planCreateForm`, primitives and elevation forms keep working. The planners are not bypassed: the support rule changed inside the one resolver they share.

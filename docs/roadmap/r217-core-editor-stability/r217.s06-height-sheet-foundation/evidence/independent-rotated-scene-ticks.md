# Independent repair evidence — rotated Scene height ticks

**Finding:** S06-P2-2 (independent review of PR #227)
**Scope:** Scene-owned Height Sheet bounds for tilted primitives and native forms.

The Scene adapter now asks the existing `sceneBounds` query first for every
entity. When mounted bounds are unavailable, primitive bounds are used only
when pitch and roll are zero, where the existing yaw-aware analytic bounds are
sound. Evaluated native-form bounds keep their prior translated fallback only
for yaw-only orientations. A tilted primitive or form without mounted bounds
contributes no tick. Models still require mounted bounds.

The owner integration regression mounts the real Scene adapter and supplies
authoritative bounds for a pitched box and a rotated native form. It verifies
their reported top heights are 1.1 m and 1.25 m. A companion regression removes
those bounds and verifies neither tilted entity contributes a guessed tick.
The existing upright table fixture continues to verify the 0.75 m analytic
primitive tick. The 5 cm floor datum check and host-only merge/sort behavior are
unchanged; the host performs no surface computation.

## Verification

- `npx vitest run tests/lib/authoring/stage-height-owner-integration.test.ts` — 1 file, 4 tests passed.
- `npm run test:arch` — 23 files, 193 tests passed.
- `npm run check` — Svelte check passed with 0 errors and 0 warnings.

This records the bounded finding repair only. It does not claim S06 acceptance
or closeout. Changes remain uncommitted on `codex/r217-s06-height-sheet`.

# T1.P01.S04 — acceptance record: Existing Layout precision

**Slice:** T1.P01.S04 · **Status:** implemented, in review — no acceptance claimed · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:**
[T1.P01](../README.md)

```text
AUTHORITY: NONE YET — evidence for review, not an acceptance outcome.
STATUS:    implementation complete on T1-P01-S04 (committed 3bc8999e plus the review-fix
           changes pushed with it); three independent review rounds run, the last blocking
           finding fixed and re-confirmed; owner acceptance and the S06 integration gate
           are still owed. Nothing here marks a gate implemented or accepted.
TIER:      affected-subsystem · INTEGRATION ROUTE: ../t1.p01.s06-integrated-final-gate/
```

## Delivered

- **Layout precision adapter** (`apps/editor/src/lib/authoring/adapters/layout/`): five planners
  registered through the S07 contribution points — Wall height, Wall thickness, Opening
  measure, entity name and Place → Layout plinth. Full typed values go to the planners; the
  displayed text is never re-parsed from a rounded value.
- **Dimensions instrument**: one settled-fact proposal per subject, Enter commits, Esc/blur
  discard without committing, blank/non-finite/zero input is refused with a reason and never
  becomes `0`. A live proposal holds the host gesture lease, so Undo reports `live-proposal`.
- **Place → Layout plinth**: typed working-plane X/Z plus the selected floor datum, object id
  captured before evaluation, one ordinary Layout box, one history entry, Undo removes it.
  Invalid/stale placement creates no object and no history.
- **Card name writer**: delegated to canonical metadata planning; unnamed kinds keep read-only
  identity. The Card's *draft* deliberately holds no gesture lease (transient UI state, cannot
  enter history); the committed rename is one ordinary history entry against the current
  accepted revision.
- **Head Save integration** (ruling D3): the route builds the epoch's Save state and passes it
  to the Head, an accepted change refreshes it, pending sign-in drafts resume, *Reload remote*
  routes through the host's replacement guard, and project exit/replacement consult unsaved
  work.

## Criteria → evidence

| Plan criterion | Evidence |
| --- | --- |
| Valid scalar edit compiles and updates once with one undo | `layout-precision-adapter.test.ts` — Wall height, Opening sill, placement: one install, `depth: 2, position: 1`, Undo restores the boot value |
| Invalid dimensions / overrun / overlap reject locally with the typed reason, geometry intact | `layout-precision-adapter.test.ts` — retained planner message (`does not fit Wall`) carried through a `planner-rejected` refusal; depth and source unchanged. Host overrun/overlap is covered by the retained kernel test `tests/lib/layout/layout-openings.test.ts` (not re-driven through the adapter) |
| Blank, non-finite and invalid input never become zero or a false `:invalid` | `layout-precision-adapter.test.ts` — blank/non-finite refused; blur/Esc never commit |
| Precision preserves typed values | `layout-precision-adapter.test.ts` — `2.734567890123` and `0.9123456789012345` survive exactly |
| Enter accepts, Esc cancels, blur does not commit | `LayoutDimensionsInstrument.svelte` + instrument tests; browser pass |
| Undo unavailable during a live proposal, with a reason | `layout-precision-adapter.test.ts` (measure, placement, and lost-grant re-acquire), `stage-facade.test.ts` (a granted lease notifies no adapter listener) |
| Call-site proof fails if a UI writer bypasses the planner or shared acceptance | `editor-host-no-write.test.ts` (no forbidden write path, one Save controller, refresh in the acceptance subscription) |
| Cloud Save only under the Head Save integration; JSON round-trips with no generated state | `save-state.test.ts`, `head-save.test.ts`, `save-call-sites.test.ts`, `save-admission-parity.test.ts`; browser Save create/update/conflict passes |
| Empty boot → place → dimension edit → Undo/Redo → reopen, both readings | Browser pass through the local stack; reopen restores the accepted source |
| Invalid/stale placement creates no object/history; replacement clears its ghost | `layout-precision-adapter.test.ts` (stale datum, mismatched captured id); browser replacement pass |

## Verification (this branch, after the review fixes)

| Command | Observed result |
| --- | --- |
| `npm run check` | 0 errors / 0 warnings |
| `npm run test:fast` | 134 files / 1,883 tests passed |
| `npm run test:arch` | 20 files / 163 tests passed |
| `npm run test:heavy` | 8 files / 118 tests passed |
| `npm test` (full editor suite) | 162 files / 2,164 tests passed |
| `npm run build` | production build passed |
| `check:layout-core`, `check:project-model`, `check:camera-core`, `check:api` | all passed |
| `npm run test:api` | **not run** for this change: no API route, schema or fixture is touched; `check:api` is clean |

Browser evidence was taken on the local stack (editor dev server against the local API and
database) with a real signed-in session and a real project, not a test-only harness:

- Save: create a project, edit, Save → `Saved`; edit again → `Save changes`; a concurrent
  remote write → conflict with the typed proposal intact and *Reload remote* offered.
- Sign-in resume: an unsaved draft survives the sign-in round trip and reopens in the editor.
- Unsaved exit/replacement: the confirm guard appears on project exit and on replacement.
- Card rename: commit renames through canonical planning; no object rename is offered.
- Proposal Undo: typing a measure or X/Z disables Undo with "A proposal is live…"; Enter
  settles it and Undo becomes available; Esc releases it without committing.
- Reading change mid-proposal: with X typed, switching Plan↔3D ends the lease (Undo reported
  available); typing again re-takes it (Undo reports `live-proposal` again).
- Placement: Place creates the box, Undo is enabled and the Head reports unsaved work.

## Review rounds

1. First independent review: ACCEPT WITH REQUIRED FIXES — an untracked Head subscription, a
   missing save-state refresh on acceptance, and a gesture acquisition that notified adapter
   listeners (rebuilding and disposing the instrument that had just taken the lease). All
   three fixed with regression tests.
2. Second independent review: ACCEPT WITH REQUIRED FIXES — one blocking finding: the placement
   instrument trusted its own `proposal` flag, so a reading change that ended the lease left a
   typed X/Z unguarded while Undo reported it available. Fixed by asking the port on every
   keystroke (the port re-acquires a spent grant), with a session-level regression test and a
   browser re-check.
3. Delta review of that fix: CONFIRMED FIXED.

## Known limits

- Overrun/overlap refusal is proven by the retained kernel planner test, not driven end to end
  through the adapter.
- A full page unload (tab close/refresh) is guarded by SvelteKit `beforeNavigate` only; the
  plan's "project exit" wording is read as leaving the route. A `beforeunload` guard is not
  implemented.
- While another surface holds the gesture lease (e.g. a camera drag), typed measure/X-Z text is
  not guarded; that is the host's recorded rule for what counts as an authoring proposal.
- A Card rename can install while a Dimensions draft holds the lease; the rebind ends the draft
  without corrupting history, but cross-surface exclusivity is not enforced.
- Placement Esc releases the lease and leaves the typed X/Z visible; Place then re-proposes that
  visible value.
- Bounded conformance evidence against the local stack; the phase's exhaustive gate is
  [S06](../t1.p01.s06-integrated-final-gate/implementation-plan.md).

## Entry points

```text
implementation  apps/editor/src/lib/authoring/adapters/layout/{instrument.ts,adapter-support.ts,precision.ts,layout.adapter.ts}
                apps/editor/src/lib/authoring/adapters/layout/{LayoutDimensionsInstrument.svelte,LayoutPlacementInstrument.svelte}
                apps/editor/src/lib/authoring/stage/shell/{EditorHead.svelte,EditorCard.svelte}
                apps/editor/src/lib/authoring/save/{save-state.ts,head-save.ts}
                apps/editor/src/routes/project/[projectId]/spatial/+page.svelte
validation      apps/editor/tests/lib/authoring/layout-precision-adapter.test.ts
                apps/editor/tests/lib/authoring/save-state.test.ts
                apps/editor/tests/lib/authoring/head-save.test.ts
                apps/editor/tests/lib/authoring/editor-host-no-write.test.ts
regressions     apps/editor/tests/lib/authoring/stage-facade.test.ts
                apps/editor/tests/lib/authoring/save-call-sites.test.ts
                apps/editor/tests/lib/layout/layout-openings.test.ts (retained planner refusal)
```

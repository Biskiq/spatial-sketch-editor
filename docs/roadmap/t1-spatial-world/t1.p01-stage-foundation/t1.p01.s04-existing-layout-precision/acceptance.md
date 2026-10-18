# T1.P01.S04 — accepted and closed record — CLOSED STUB

```text
AUTHORITY: NONE — this is closed work. Current truth lives in the phase README's slice register,
           the gate register and the owning track's baton.
STATUS:    ACCEPTED and SHIPPED 2026-10-18 via PR #148 (owner accepted the implementation at
           `2d37adef`; routine `slice-closeout` ran on the same branch and records the outcome here).
           Owner-authorized 2026-10-17 as batch B
           ([record](../../../../reference/decisions/batch-b-authorization-2026-10-17.md)); the Head
           Save mount and the three composition-root gaps were closed under the owner's
           [narrow host-integration exception](../../../../reference/decisions/t1-s04-host-integration-2026-10-17.md).
           Three review rounds; the last blocking finding was fixed and its delta re-confirmed.
           `slice-closeout` compacted the plan body into a stub and wrote this record; no criterion
           was inferred from skill invocation or green tests alone. A post-acceptance review fix
           (`aa26e04a`) removed leftover selection diagnostics found at closeout (see the resolution
           below); PR #148 carries it.
ROLE:      acceptance outcome and preservation route for T1.P01.S04.
NOT:       product contract · plan · status store · authority for residual capabilities.
```

## Delivered and accepted

- **Layout precision adapter** (`apps/editor/src/lib/authoring/adapters/layout/`): five planners
  registered through the S07 contribution points — Wall height, Wall thickness, Opening measure,
  entity name and Place → Layout plinth. Full typed values reach the planners; the displayed text is
  never re-parsed from a rounded value.
- **Dimensions instrument**: one settled-fact proposal per subject, Enter commits, Esc/blur discard
  without committing, blank/non-finite/zero input is refused with a reason and never becomes `0`. A
  live proposal holds the host gesture lease, so Undo reports `live-proposal`; a reading change that
  releases the grant is re-taken on the next keystroke.
- **Place → Layout plinth**: typed working-plane X/Z plus the selected floor datum, object id captured
  before evaluation, one ordinary Layout box, one history entry, Undo removes it. Invalid/stale
  placement creates no object and no history.
- **Card name writer**: delegated to canonical metadata planning; unnamed kinds keep read-only
  identity. The Card *draft* holds no gesture lease (transient UI state that cannot enter history);
  the committed rename is one ordinary history entry against the current accepted revision.
- **Head Save integration** (ruling D3): the route builds the epoch's Save state and passes it to the
  Head, an accepted change refreshes it, pending sign-in drafts resume, *Reload remote* routes through
  the host's replacement guard, and project exit/replacement consult unsaved work.

The slice replaced the stale "not implemented" placeholder with the review evidence (anchor above)
and, at close, this accepted record. It introduces no new gate, gate version, capability scope or
authored format.

## Criteria → evidence (recorded, reused — not re-run at close)

| Plan criterion | Evidence |
| --- | --- |
| Valid scalar edit compiles and updates once with one undo | `layout-precision-adapter.test.ts` — Wall height, Opening sill, placement: one install, `depth: 2, position: 1`, Undo restores the boot value |
| Invalid dimensions / overrun / overlap reject locally with the typed reason, geometry intact | `layout-precision-adapter.test.ts` — retained planner message (`does not fit Wall`) carried through a `planner-rejected` refusal; depth and source unchanged. Host overrun/overlap is covered by the retained kernel test `tests/lib/layout/layout-openings.test.ts` (not re-driven through the adapter) |
| Blank, non-finite and invalid input never become zero or a false `:invalid` | `layout-precision-adapter.test.ts` — blank/non-finite refused; blur/Esc never commit |
| Precision preserves typed values | `layout-precision-adapter.test.ts` — `2.734567890123` and `0.9123456789012345` survive exactly |
| Enter accepts, Esc cancels, blur does not commit | `LayoutDimensionsInstrument.svelte` + instrument tests; browser pass (recorded at the anchor) |
| Undo unavailable during a live proposal, with a reason | `layout-precision-adapter.test.ts` (measure, placement, and lost-grant re-acquire), `stage-facade.test.ts` (a granted lease notifies no adapter listener) |
| Call-site proof fails if a UI writer bypasses the planner or shared acceptance | `editor-host-no-write.test.ts` (no forbidden write path, one Save controller, refresh in the acceptance subscription) |
| Cloud Save only under the Head Save integration; JSON round-trips with no generated state | `save-state.test.ts`, `head-save.test.ts`, `save-call-sites.test.ts`, `save-admission-parity.test.ts`; browser Save create/update/conflict passes (recorded at the anchor) |
| Empty boot → place → dimension edit → Undo/Redo → reopen, both readings | Browser pass through the local stack (recorded at the anchor); reopen restores the accepted source |
| Invalid/stale placement creates no object/history; replacement clears its ghost | `layout-precision-adapter.test.ts` (stale datum, mismatched captured id); browser replacement pass |

## Verification

**Tier:** `affected-subsystem` · **Integration route:** the phase's exhaustive final gate,
[`../t1.p01.s06-integrated-final-gate/implementation-plan.md`](../t1.p01.s06-integrated-final-gate/implementation-plan.md).
The narrowed tier never stood in for that route, which remains owed by S06.

**Accepted code head** `2d37adef151a097e96b8bae9f9a8d8fcd9948556` (the review-fix commit; the review
rounds above cover it). **Merge candidate** `38f4669a888d6a091a4e3ad0100d0d49fbe0cff8` —
`origin/main` `a351c4bf` merged into `T1-P01-S04`, no conflicts. The complete gate was rerun on that
merge candidate per the batch B merge protocol ("every merge reruns the complete merge gate on the
then-current `main`"):

| Command (at merge candidate `38f4669a`) | Observed result |
| --- | --- |
| `npm run check` | 0 errors / 0 warnings |
| `npm run test:arch` | 20 files / 163 tests passed |
| `npm run test:fast` | 134 files / 1,883 tests passed |
| `npm run test:heavy` | 8 files / 118 tests passed |
| `npm test` (full editor suite) | 162 files / 2,164 tests passed |
| `npm run build` | production build passed |
| `check:layout-core`, `check:project-model`, `check:camera-core`, `check:api` | all passed |
| `git show --check` | clean on `2d37adef` and `38f4669a` |
| `npm run test:api` | **not run** — no `apps/api` route, schema or fixture is touched; `check:api` is clean |

The same counts were recorded on the branch at `2d37adef`; the merge candidate adds no product source
change over it (the merged range is docs/research/T3-preflight only).

## Review rounds

1. First independent review: ACCEPT WITH REQUIRED FIXES — an untracked Head subscription, a missing
   save-state refresh on acceptance, and a gesture acquisition that notified adapter listeners
   (rebuilding and disposing the instrument that had just taken the lease). All three fixed with
   regression tests.
2. Second independent review: ACCEPT WITH REQUIRED FIXES — the placement instrument trusted its own
   `proposal` flag, so a reading change that ended the lease left a typed X/Z unguarded while Undo
   reported it available. Fixed in `2d37adef` by asking the port on every keystroke, with a
   session-level regression test and a browser re-check.
3. Delta review of that fix: CONFIRMED FIXED.

## Known limits

- Overrun/overlap refusal is proven by the retained kernel planner test, not driven end to end through
  the adapter.
- A full page unload (tab close/refresh) is guarded by SvelteKit `beforeNavigate` only; the plan's
  "project exit" wording is read as leaving the route. A `beforeunload` guard is not implemented.
- While another surface holds the gesture lease (e.g. a camera drag), typed measure/X-Z text is not
  guarded; that is the host's recorded rule for what counts as an authoring proposal.
- A Card rename can install while a Dimensions draft holds the lease; the rebind ends the draft
  without corrupting history, but cross-surface exclusivity is not enforced.
- Placement Esc releases the lease and leaves the typed X/Z visible; Place then re-proposes that
  visible value.
- Bounded conformance evidence against the local stack; the phase's exhaustive gate is
  [S06](../t1.p01.s06-integrated-final-gate/implementation-plan.md).

## Residual finding — undisclosed debug instrumentation (closeout)

The accepted revision `2d37adef` carries two leftover diagnostics in production code,
`apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` `selectSource()`:

```text
console.debug('[s04-diag] pre-select', … , stage.session.select(diagSelection));
stage.select(diagSelection);
console.debug('[s04-diag] post-select', …);
```

The diagnostics are not mentioned in the plan, the acceptance evidence above, or the PR body, and
`[s04-diag]` appears nowhere else in the tree. The pre-select line also performs a **side-effecting**
`stage.session.select(diagSelection)` call inside a `console.debug` argument, so the diagnostic is
not inert. `slice-closeout` is forbidden to edit production code, so this record only reports it:

- **Disposition owed before/with the merge commit.** Either remove the lines in a follow-up
  review-fix commit on PR #148 (preferred; then re-run the affected contract and the full gate at the
  new revision), or the owner explicitly waives it in a ruling. This is the skill's
  "return to review" trigger (an unresolved implementation issue discovered at closeout), not something
  closeout may silently accept.

### Resolution — owner-authorized review fix

The owner directed the removal. Review-fix commit `aa26e04a` drops both `console.debug` calls and
restores the reviewed body of `selectSource()`: a single `stage.select({ … })`, which already selects
through the session and echoes adapters. The redundant direct `session.select` that sat inside the
debug argument is gone, and `[s04-diag]` now appears nowhere in `src/` or in a fresh production build.

The complete merge gate was re-run at `aa26e04a` on the then-current `main` (`a351c4bf`): `check` 0/0 ·
`test:arch` 20 files/163 tests · `test:fast` 134/1,883 · `test:heavy` 8/118 · `npm test` 162/2,164 ·
`build` pass · `check:layout-core`, `check:project-model`, `check:camera-core` and `check:api` pass ·
`git diff --check` clean. The restored body is the reviewed baseline the acceptance evidence above was
gathered against; no suite keys on `selectSource()`, and no lane regressed.

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

## Recovery

```text
git show 2d37adef151a097e96b8bae9f9a8d8fcd9948556:docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s04-existing-layout-precision/acceptance.md   (this record, pre-compaction body)
git show 3bc8999e83ea5a8270aa07be8608fa07034b765e:docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s04-existing-layout-precision/implementation-plan.md   (full approved plan)
anchor   2d37adef151a097e96b8bae9f9a8d8fcd9948556 (plan anchor 3bc8999e is an ancestor)
tag      closed/T1.P01.S04 at that anchor (local only — not pushed)
REQUIRED MERGE METHOD — P1    merge commit via PR #148; no squash, no rebase, no amend
POST-MERGE VERIFICATION OWED   after PR #148 lands as a merge commit:
  git merge-base --is-ancestor 2d37adef151a097e96b8bae9f9a8d8fcd9948556 main
```

## Closeout preservation

```text
CLOSEOUT PRESERVATION — T1.P01.S04 (2026-10-18)
prose compacted:                 1   implementation plan → stub at its own path
reference promotions:            0   the durable conclusion (the narrow host-integration exception) is
                                     already owned by a decision record; no live reference/* claim changed
renderable evidence archived:    0 files   the browser evidence is prose in this record only; no PNG/HTML
                                     evidence existed in the slice tree to archive
evidence stubs / manifests:      0
transient artifacts removed:     0
historical anchor:               2d37adef151a097e96b8bae9f9a8d8fcd9948556 · tag closed/T1.P01.S04 (local only — not pushed)
new live → archive prose links:  0
manual-owed verification rows:   0
remaining deferred items:        2   S06 integration gate (route above) · the known limits
                                     (the debug instrumentation residual was cleared by review-fix
                                     commit `aa26e04a` — see the resolution above)
permanent stubs added:           1   (the owner-ratified 2026-09-22 hybrid cost: one per closed prose artifact)
```

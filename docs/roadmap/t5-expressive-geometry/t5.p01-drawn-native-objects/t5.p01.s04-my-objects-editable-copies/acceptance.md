# T5.P01.S04 — acceptance record: My Objects: save and insert editable copies

**Slice:** T5.P01.S04 · **Status:** accepted by owner ruling 2026-10-28; routine closeout and P1 merge
authorized on [PR #216](https://github.com/Biskiq/spatial-sketch-editor/pull/216) · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:**
[T5.P01](../README.md)

## Decision and authorization

The owner accepted the `form` library scope under decision D8 and the T2 review it required, approved
the two recorded implementation deviations, and authorized acceptance, routine same-PR closeout and
the P1 merge on 2026-10-28. Browser evidence and the suspended performance rows remain deferred to
`T5.P01.S03`, the plan's declared integration route. This ruling accepts S04 only; it does not accept
the S03 gate, close T5.P01, complete T5 or declare a performance pass.

Prerequisites at the trusted base `edf1fb72` (the S02 merge on `main`):

- `T5.P01.S01` is accepted; its native form source, strict codec and evaluation are the consumed
  capability.
- D8's T2 library-scope review is accepted by the owner ruling above. The Card-fields Save surface and
  the `private, no-store` library read are approved as recorded deviations, not exact §4.3/§4.2
  conformance.
- Migration 008 holds the only `apps/api` migration slot used by this branch; no dependency was
  added beyond the resident workspace packages.
- No F, Head, Save, Camera, PLATE or Stage-host change was made.

## Reviewed revision

The production head is `de9451ba7ce41ad4ddc046859b88882df834b55d`. Four independent review rounds
covered the implementation; the final round found no remaining material code blocker. The reviews
were run in the implementation thread, not submitted as separate GitHub review objects. The only
commits after the production head are documentation: `cf8c8441` and `f92b47b`. `git diff
de9451ba..f92b47b -- apps packages` is empty, so the tested code is the reviewed code.

Review rounds found and the implementation fixed: a fresh-owner foreign-key failure, a two-click My
Objects open, stale ready words, an unknown material accepted by the payload reader, an unpinned
pointer support choice, a stale Save source, a duplicate Save path, owner-scoped list/read caching,
and missing cross-project acceptance evidence. The final round's only remaining items were the
recorded limitations below, which the owner accepted or deferred.

## Verification evidence

These are the recorded author runs at the reviewed code head. Closeout changed documentation only.

| Check | Command | Result |
| --- | --- | --- |
| Editor typecheck | `npm run check` | 0 errors, 0 warnings |
| Project-model typecheck | `npm run check:project-model` | exit 0 |
| API typecheck | `npm run check:api` | exit 0 |
| Editor suite | `npm test` in `apps/editor` | 232 files, **2,938 tests passed**, 0 failed, 0 skipped |
| API suite | `DATABASE_URL=postgresql://localhost:5432/biskiq npm run test:api` | full suite exit 0, **zero skips**, including the DB-backed `form-library` routes and migration |
| S04 codec/planner | `npx vitest run tests/lib/project-model/form-library.test.ts` | 8 tests passed |
| S04 client/Save | `npx vitest run tests/lib/authoring/scene/form-library-client.test.ts` | 7 tests passed |
| S04 panel/wrapper | `npx vitest run tests/lib/authoring/scene/my-objects-section.test.ts` | 9 tests passed |
| S04 coordinator acceptance | `npx vitest run tests/lib/authoring/scene-operation-acceptance.test.ts` | 16 tests passed |
| S04 editing surface | `npx vitest run tests/lib/authoring/scene-editing-surface.test.ts` | 51 tests passed |

The editor count includes the three coordinator-level cross-project journeys: exact copy
source/keys/scale/`nextKey`, golden digest, one history entry, exact Undo/Redo, both-direction
independence, two insertions, cold reopen and no project-side item link.

## Criteria

1. **Save — met at code and UI level.** The saved payload equals the accepted entity source, the
   content id matches its canonical bytes, Save adds no history entry and leaves the project clean.
2. **Cross-project insert — met at coordinator level.** The copy is one new form entity with the
   item's exact source and A's golden digest; one history entry; exact Undo and Redo.
3. **Independence — met at coordinator level.** Refining either side leaves the item and the other
   project unchanged; two insertions are two entities.
4. **Save and reopen — met at coordinator and API level.** Cold reopen reproduces the copy's source
   and digest; the project holds no resource, lock entry or reference for the item.
5. **Lifecycle — met at API and remove level.** Project deletion leaves the item; Remove leaves
   inserted copies intact and B opens and saves. The combined two-project browser journey is deferred
   to S03.
6. **Refusals — met at codec, API and panel level.** Another owner cannot list, read, insert or
   remove; malformed, wrong-format and content-id-mismatched payloads store nothing; failed or
   unconfirmed Save stores nothing; a full library refuses in words. An API-level oversize request
   test, Save abort/cancel and concurrent 1,000-item stress are not run.
7. **Isolation — met.** The architecture lane and the Preview/public-surface closure suites pass; the
   library client and section are editor-only and lazily loaded.
8. **Verification — partially met by owner deferral.** The repository checks, full editor suite,
   DB-backed API suite and focused S04 suites pass. The plan's agent E2E journeys 1–5 across two
   browser projects are deferred to S03 and are not claimed as passed.
9. **Performance — deferred, not passed.** Insert commit, Undo and Redo timings, the 100-item/50 ms
   row and the 25 KiB Stage first-load row are owned by S03 under the suspended performance mandate.
10. **References — met.** The assets contract records the landed `form` library scope, persistence
    records the library storage, and Scene content records `place-form-copy`.
11. **Older formats — met at codec and panel level.** An item with another format number stays
    listed as unusable with Remove, refuses insertion with its reason and adds no history.

## Deviations approved by the owner

- **Save surface.** Save is a button in the adapter-owned Card form fields (`FormCardFields`), not a
  host `cardActions` entry. This keeps §4.6's no-Stage-host-change boundary and gives inline feedback;
  it is not claimed as exact §4.3 conformance.
- **Library read caching.** List and read send `private, no-store` rather than a content-id-cacheable
  read, because the bytes are owner-scoped and must disappear on Remove and after an owner switch.

## Residuals and ownership

- **S03:** browser E2E journeys 1–5 across two projects; performance rows; the exhaustive integrated
  gate. None is a pass here.
- **Residual edge coverage:** Save abort/cancel, API-level oversize, CORS `Expose-Headers`, a
  concurrent 1,000-item lock stress and a stacked-floor support fixture remain unexercised.
- **Carry:** Wall-face reading waits for T1's face-frame query; preserve the existing side-quad
  texture seam. T4 owns the visitor `/p` first-load target.
- **Not claimed:** S03 acceptance, T5.P01 phase closure, T5 completion, a performance pass or a
  browser acceptance.

## Merge

Routine closeout is on the same branch under the P1 rule: PR #216 lands by merge commit, never squash
or rebase, so the full-record anchor remains reachable. The acceptance and preservation stub records
the anchor and the post-merge tag.

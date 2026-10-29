# T5.P01.S04 — acceptance record: My Objects: save and insert editable copies

**Slice:** T5.P01.S04 · **Status:** proposed; no acceptance recorded, no closeout claimed · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:**
[T5.P01](../README.md)

This record claims no acceptance, capability entry, gate state or closeout. The plan is completed
and approved only after `T5.P01.S01` is accepted and T2 agrees the library-scope design (D8). S01 is
accepted; **T2's library-scope review remains outstanding on the implementation PR**. The owner
released S04 for implementation on 2026-10-28; that release is not acceptance.

Its verification tier is `architecture-integration`; the exhaustive integrated proof, including the
full cross-project browser journey and the suspended performance rows, lives in the phase's
[final gate](../t5.p01.s03-integrated-final-gate/acceptance.md).

## Implementation verification evidence (not acceptance)

Recorded 2026-10-28 on branch `t5/p01-s04-my-objects`, based on `edf1fb72` (the S02 merge on
`main`). These are the author's runs before the review PR; a trust base, T2 review and the final
gate still have to confirm them.

| Check | Command | Result |
| --- | --- | --- |
| Editor typecheck | `npm run check` | 0 errors, 0 warnings |
| Project-model typecheck | `npm run check:project-model` | exit 0 |
| API typecheck | `npm run check:api` | exit 0 |
| Editor suite | `npm test` in `apps/editor` | 232 files, **2,938 tests passed**, 0 failed, 0 skipped |
| API suite | `DATABASE_URL=postgresql://localhost:5432/biskiq npm run test:api` | full suite exit 0, **zero skips**, including the DB-backed `form-library` routes/migration test |
| S04 codec/planner | `npx vitest run tests/lib/project-model/form-library.test.ts` | 8 tests passed (canonical bytes, content id, non-canonical refusal, unknown material, older format, detached planner, contact refusal, duplicate id) |
| S04 client/Save | `npx vitest run tests/lib/authoring/scene/form-library-client.test.ts` | 7 tests passed (canonical POST, ETag/format pin, refusals, full library, unconfirmed save) |
| S04 panel/wrapper | `npx vitest run tests/lib/authoring/scene/my-objects-section.test.ts` | 9 tests passed (one-click lazy open, list/older format, arm contact, stale/failed arm, footprint, remove) |
| S04 coordinator acceptance | `npx vitest run tests/lib/authoring/scene-operation-acceptance.test.ts` | 16 tests passed; the S04 journeys cover exact copy source/keys/scale/`nextKey`, golden digest, one history entry, exact Undo/Redo, both-direction independence, two insertions, cold reopen, no project-side item link and refusals |
| S04 editing surface | `npx vitest run tests/lib/authoring/scene-editing-surface.test.ts` | 51 tests passed (accepted-source Save, live re-read, pointer/typed insertion and lifecycle) |

What the evidence supports: criteria 1–4 in full at codec, planner and coordinator level; the
storage, ownership, older-format and refusal parts of criteria 5, 6 and 11 at DB/API/panel level;
criterion 7's isolation through the existing public-route and Preview-surface closure suites; and
criterion 10's contract updates in this change set. Criterion 5's “B still opens and saves after
Remove” is evidenced structurally (the copy has no item link) plus the separate project-deletion
API test, not as one browser journey. **Not evidenced here:** criterion 8's agent E2E cross-project
browser journeys and criterion 9's performance rows, both owned by S03 and the suspended
performance mandate. No browser acceptance is claimed.

## Review and residual limitations

- **T2 library-scope review:** outstanding (D8). T1 review is also needed for any host-facing
  deviation; the Stage host shell is intentionally untouched by this slice.
- **Save surface deviation:** Save is a button in the adapter-owned Card form fields
  (`FormCardFields`), not a host `cardActions` entry. This keeps §4.6's no-Stage-host-change
  boundary and gives inline feedback; it is recorded here for T2 review rather than claimed as exact
  §4.3 conformance.
- **Library read caching:** list and read routes send `private, no-store`, not the plan's
  content-id-cacheable read, because the bytes are owner-scoped and must disappear immediately on
  Remove and be re-authorized after an owner switch. Security wins; T2 should review the deviation.
- **Support evidence:** a pointer preview pins the resolved floor by elevation and generation and
  the commit carries it; typed X/Z re-resolves support deterministically. No stacked-floor fixture
  exercises two eligible supports at one X/Z.
- **Not run / not claimed:** agent E2E journeys 1–5 across two browser projects, 100-item/50 ms and
  25 KiB rows, Save abort/cancel, an API-level oversize request test, a CORS `Expose-Headers` test
  and a concurrent 1,000-item lock stress test.
- The independent review found and the implementation fixed: a fresh-owner FK failure, a two-click
  My Objects open, stale ready words, an unvalidated material, an unpinned support choice, a stale
  Save source, a duplicate Save path, owner-scoped list/read caching, and missing cross-project
  acceptance evidence. The final independent verdict belongs on the pull request that carries this
  change set; no verdict, acceptance or closeout is claimed here.

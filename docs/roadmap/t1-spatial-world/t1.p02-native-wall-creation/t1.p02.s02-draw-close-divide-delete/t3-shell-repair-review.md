# T1.P02.S02 — T3 review: narrow-shell repair and completed browser matrix

```text
AUTHORITY: NONE — this records T3's review of one repair and its evidence. The phase README owns
           slice status; the acceptance artifact owns acceptance; the owner owns performance direction.
STATUS:    reviewer verdict — ACCEPTED WITH ONE NON-BLOCKING NIT for the shell repair and evidence
           added after the shared Head/F4 verdict at `bf9007ff`.
SCOPE:     branch `t1-p02-s02-draw-close-divide-delete`, `bf9007ff..64b9435d`; the two product changes
           are `8db7baf2` and `f26b227c`, the journey is `132a7aac`, and `dc877396`/`64b9435d` complete
           the matrix. The earlier shared Head/F4 review remains
           [t3-implementation-review.md](./t3-implementation-review.md).
```

## 1. What was reviewed

The repair adds a measured lower-column height to the Stage frame and, below 72 rem, lifts the Card
above that column and clamps its height. The height comes from the `ResizeObserver` entry's border
box, not from a second element read. The completed journey adds the empty division/deletion path,
chain Undo/Redo, a Scene Library task, the Experience Guide, and a palette-open clearance row.

Checked against the earlier T3 conditions:

| Seam | Result |
| --- | --- |
| One viewport measurement | Pass. The observer supplies its own box; the route still has exactly one `getBoundingClientRect` function and one `clientWidth`/`clientHeight` pair. The arch invariant test passes. |
| Card/lower-column arbitration | Pass. The CSS variable is set on the Card's ancestor, the 72 rem media query matches the JS `matchMedia`, and the Card is clamped rather than clipped. The dock-only and palette-open rows both pass at 900×700. |
| Lifecycle | Pass with the nit below. The observer disconnects on teardown and re-binds after replacement. |
| Cross-track compatibility | Pass. No facade, contribution, planner, capture, admission or adapter contract changes; no T2/T3 consumer reads the new variable. The #199 route does not contain the repair and will inherit it on merge. |
| Evidence integrity | Pass after repair. 28/28 rows in Chromium and branded Chrome at `64b9435d`, all naming the revision; screenshots and machine facts are present and no row failed. |

## 2. Findings and dispositions

| Finding | Severity | Disposition |
| --- | --- | --- |
| **T3-S1 — stale height while the lower column is unmounted** | Low, non-blocking | The effect returns early when the bound node is absent and does not reset `lowerColumnHeight`; Preview can leave the last value in the variable until the next observer callback. The Card is not interactive under the takeover and the next observed frame corrects it. Recorded as a residual, not a merge blocker. |
| **T3-S2 — the journey did not cover the empty divide/delete path, chain Undo/Redo, Library/Guide or palette-open clearance** | Blocking for evidence completeness | Repaired in `dc877396` and `64b9435d`. The empty journey now divides, reads the division in 3D, deletes the divider, reconciles the Room and reads the result in 3D; both journeys exercise chain Undo/Redo; the shell exercises a Scene Library task, the Experience Guide and the palette-bearing lower column. |
| **T3-S3 — the performance runbook named the S06-only milestone profile** | Blocking for the owner runbook | Corrected to the formal acceptance profile with all hard tiers: `npm run perf:bench -- --label t1-s02-acceptance --profile acceptance --tiers grid-L,grid-M,grid-S`. The milestone amendment cannot discharge S02. |
| **T3-S4 — “full gate” overstated the unrerun DB-backed API suite** | Low, records | Corrected to the applicable gate and the API limitation is stated in the closeout blockers. |

## 3. Verification at the reviewed head

Run on the committed tree at `64b9435d`, from the repository root:

```text
npm run check               editor svelte-check: 0 errors, 0 warnings
npm run test:arch           documentation and architecture lanes pass
npm run test:full           editor suite passes
npm run build               production build succeeded
```

The browser journey ran through `apps/editor/perf/run-t1-s02-browser-qa.mjs` against a fresh private
Postgres database:

| Project | Result | Evidence |
| --- | --- | --- |
| `chromium` | 4/4 tests, 28/28 rows | [JSON](./evidence/2026-10-27/64b9435d/t1-s02-browser-evidence.json) |
| `chrome` (branded 156.0.8078.48) | 4/4 tests, 28/28 rows | [JSON](./evidence/2026-10-27/64b9435d-chrome/t1-s02-browser-evidence.json) |

Machine facts record the designated Apple M2, macOS, AC power, Low Power Mode off and the pinned
Chrome build. The DB-backed API suite was last recorded at `78705c0d`; this repair changes no API
contract and was not re-run.

## 4. Verdict and what remains

**Verdict: the narrow-shell repair and the completed browser matrix are accepted by T3**, with
T3-S1 recorded as a non-blocking residual. No blocking T3 finding remains.

This verdict does not record T1.P02.S02 acceptance, does not waive the performance rows, does not
re-arm M4 and does not merge anything. Still owed:

- the owner-run **formal** M2 acceptance pass for S02 (S and M rows, F2/F13 and the Stage first-load
  delta, with L included because the harness refuses a partial-tier formal pass);
- the owning track's acceptance record and slice-closeout decision after that evidence exists.

## 5. Omissions, named rather than implied

No production code outside the reviewed repair was changed by this review. No owner-run performance
row was produced, and the milestone profile was not used as evidence. #199 remains unmerged and NOT
ACCEPTED; its post-#201 integration re-run is a separate T2 obligation.

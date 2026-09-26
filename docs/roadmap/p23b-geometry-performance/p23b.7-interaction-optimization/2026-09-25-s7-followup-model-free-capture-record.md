# P23B.7 S7 follow-up — the model-free capture: the bounded fix S7's attribution named (2026-09-25)

AUTHORITY: the ratified plan `./2026-09-22-P23B.7-interaction-optimization.md` §0.9 (the owner's
           review-time direction of 2026-09-25) + S7's own record §3 (the bounded next action). This
           record is that follow-up's evidence. It does not close the slice, it does not amend S7's
           findings, and it changes no acceptance state.
STATUS:    EXECUTED on `P23B.7` as its OWN commit — reverting that one commit restores the S7
           revision exactly. PR #92 remains OPEN for owner review; nothing here is merged, accepted
           or marked closed.

## 1. What S7 left, and what this changes

```text
S7 (§1–§2) measured, on the committed 40-Wall all-curved fixture, that `commit-capture`'s
`captureLayoutPreviewSnapshot` paid for a JSON round-trip over THREE streams — `project`, `issues`
and the DERIVED preview `model` — with `geometry` handed by reference. The derived model was
3,412,257 of the 3,434,187 payload bytes (99.4 %) and 39,106 of its 39,746 objects, and NOTHING in
production installed the captured copy: `restoreLayoutPreviewSnapshotUnmeasured` re-projects the
model from the shared `geometry`, `layoutPreviewSnapshotMatchesLive` reads `project.layout` only, and
a repository-wide search found exactly one reader of `snapshot.model` — a test assertion.

CHANGE NOW MADE: `captureLayoutPreviewSnapshot` no longer clones `model`, and
`LayoutPreviewSnapshot` no longer declares it. That is the whole of the production change — the
deletion of work no reader consumed, not a new mechanism.
```

## 2. The fix (by symbol)

```text
apps/editor/src/lib/editor/layout/layout-preview-state.svelte.ts
  · `LayoutPreviewSnapshot` — the `model` member is GONE. The type's doc comment now carries why
    (pure projection of `geometry`, 99.4 % of the payload, no reader) and names its guard.
  · `captureLayoutPreviewSnapshot` — the line `model: cloneJson(state.model)` is deleted.
    EVERYTHING ELSE IS UNCHANGED, deliberately: `project` and `issues` remain deep clones (the
    snapshot-isolation property S7 pinned), `geometry` remains the state's own object by reference
    (the identity S6's mesh cache is keyed on), the scalars and copied `bounds` are unchanged, and
    the DEV `p2311ObserveMeshIdentity('capture', …)` observation is untouched.
  · `restoreLayoutPreviewSnapshotUnmeasured` — NOT CHANGED. It already re-projected
    (`state.model = p2311Measure('restore-model-project', () => projectLayoutPreviewModel(snapshot.geometry))`),
    so the restore contract is exactly the function it already was; this fix only stops paying for a
    second copy nobody installed.

NO production consumer needed a change — verified rather than assumed:
  · both layout history hosts (`EditorApp.svelte`, `MuseumEditorApp.svelte`) hand the snapshot
    straight to the restore and compare `project.layout` in their own `matches`;
  · `LayoutPlanViewport.svelte`'s three snapshot variables (`dragSnapshot`, `roomUnitSnapshot`,
    `architectureEditSnapshot`) only capture and hand back;
  · `layout-transient-edit.ts`'s guard reads `project.layout`;
  · `layout-mutation-runner.ts`, `arrange-delete.ts`, `EditorViewport.svelte`,
    `layout-gizmo-adapter.svelte.ts` and the dev bend route only capture → commit/restore.
```

## 3. Why it is safe (the reasoning a reviewer should check)

```text
1. THE MODEL IS A PURE PROJECTION OF `geometry`. `projectLayoutPreviewModel(geometry)` is the same
   function the install path uses (`derivePreviewBundle` → `model: projectLayoutPreviewModel(
   reuse.geometry)`), and the restore has used it since P23B.5 — so a captured copy can only ever
   equal what the snapshot's own `geometry` projects to.
2. NO READER EXISTED. The only reads of a captured model in the repository were test assertions
   (S7 §2). Nothing in production depended on it, so the removal cannot change behaviour; it can
   only change cost.
3. HISTORY DECISIONS CANNOT FLIP. `HistoryController.commitLayout` compares `before` and `next` with
   the host's `matches` — and BOTH SHIPPING HOSTS compare `project.layout` authored-canonical JSON.
   (The controller's default fallback JSON-compares the whole snapshot; `model` was a function of
   `geometry`, itself a member, so its presence never added information to that comparison either.)
   The `commit-matches` decision is therefore unchanged by construction, and so are undo/redo,
   `commit-replace` and `cancel()` — none of which read the removed member.
4. SNAPSHOT ISOLATION IS PRESERVED WHERE IT MATTERS. `project` and `issues` are still deep clones —
   the probe still asserts that a post-capture live mutation cannot reach the snapshot — and
   `geometry` was ALREADY by reference before this fix, with the restore's mesh install reading that
   same identity (S6's fix keys the cache on it).
```

## 4. The oracle: what pins the contract now

```text
· `apps/editor/tests/lib/bench/p23b7-capture-attribution.test.ts` (the S7 probe, UPDATED in the same
  commit): the snapshot carries no `model`; the cloned streams are DISCOVERED from the snapshot
  (never declared) and must contain `project` and never `model`; the removed stream is still measured
  by construction and must still dominate; and the restore must reproduce the FROZEN model CONTENT
  from the captured geometry into a FRESH object with no captured copy to install. S7's PRE-fix
  accounting stays frozen in the S7 record §2 — the probe no longer claims it as current.
· `apps/editor/tests/lib/editor/layout/layout-preview-state.test.ts` (the one reader of the removed
  field): its reactive-proxy capture test now asserts `projectLayoutPreviewModel(snapshot.geometry)`
  equals the live model — i.e. the pure-projection property the fix's safety argument rests on,
  rather than a captured field.
```

## 5. The permanent guard

```text
`apps/editor/tests/lib/editor/layout/p23b7-snapshot-payload-guard.test.ts` — four tests, all cheap:
  1. RUNTIME PAYLOAD BOUND — on the biggest committed fixture: no `model` member; the identity guard
     still decides from the snapshot; EVERY captured object stream stays below a tenth of the removed
     projection; the whole payload stays below 4× the document's own objects. The bound is relative to
     the document and the projection, never a fixed byte count: not a budget, no metric, no baseline.
  2. SOURCE CONTRACT — the snapshot type declares no `model` member, the capture clones none, and the
     restore still contains `projectLayoutPreviewModel(snapshot.geometry)`.
  3. NO PRODUCTION READER — a per-file scan over ~380 production sources (the editor's `$lib` and
     routes, the visitor routes, `packages/camera-core/src`): no `<snapshot binding>.model`, no
     `["model"]` access, no `{ model } = snapshot` destructuring. Non-vacuity: the recogniser must
     FIND the bindings in the files that really hold snapshots (`layout-transient-edit.ts`,
     `LayoutPlanViewport.svelte`, `EditorApp.svelte`, `MuseumEditorApp.svelte`), and the scan must
     have a population > 300 files, so a broken pattern or root cannot pass silently.
  4. DETECTOR SELF-TEST — five negative controls that MUST be flagged and three clean sources that
     must not be.

WHY THE CONTROLS ARE NOT DECORATION: while this guard was being written, its own controls caught
THREE real recogniser defects before it ever landed — a `\b` that cannot terminate a match ending on
`>`, the contextually-typed `snapshot` parameters of the two host callbacks (which have no type
annotation to match), and a destructuring straight off the capture, where no binding name exists at
all. Without the controls the scan would have shipped unable to see the two files most likely to grow
a reader.

HONEST LIMITS, stated in the file itself: the scan is a NAME-BASED recogniser over raw source
(comments and strings included), so it can OVER-report — a comment mentioning `<binding>.model` trips
it — and it does not follow an alias (`const alias = snapshot; alias.model`). The runtime members of
test 1 are what make that shape pointless: the member is gone, and a re-added clone fails the payload
bound whatever it is named.
```

## 6. Evidence (one session; ms are advisory and printed, never asserted)

```text
DETERMINISTIC (asserted, committed fixtures, node):
  snapshot members now: source · project · geometry · issues · bounds · messages   (NO model)
  cloned streams on the 40-Wall all-curved fixture: project 21,928 B / 639 objects ·
    issues 2 B / 1 object · bounds 92 B / 3 objects        = 22,022 B / 643 objects
  removed stream (the live derived model): 3,412,257 B / 39,106 objects
  → the payload is 0.64 % of what it was, and 643 of 39,746 objects (1.6 %)

ADVISORY, SAME SESSION, SAME CONSTRUCTION (the S6/S7 proxy harness, one reactive state):
  the REMOVED work — the JSON round-trip over the proxied model —   p50 114.23 ms
  the SHIPPED capture through the same proxy                        p50   1.41 ms
  plain fixture state, per stream: project 0.1 · issues 0 · bounds 0 ms; removed model 14.9 ms;
  capture end-to-end p50 0.19 ms. The proxy multiplier S7 measured (~6.7×) is visible in the removed
  stream (14.9 → 114.2 ms), and the shipped capture no longer touches the graph that pays it.
```

## 7. What this record does NOT claim

```text
· NO BROWSER CAPTURE WAS RE-RUN. `commit-capture`'s 107–149 ms stays S1's/S6's committed browser
  evidence, taken PRE-fix; the post-fix browser number is NOT measured here and is not claimed. The
  node A/B above is the same clone construction in one session — it explains the direction and the
  order of magnitude, not the browser value. A browser re-measure remains the next verification the
  owner may call for.
· NO budget, target, gate or metric was added: `g3-baseline.json` was neither read nor rewritten
  (`bench:record` stays its only writer), and `reuse-counter-ratchet.json` was not touched
  (`reuse:record` was not run).
· This is NOT a new slice or step: S2–S7 are not renumbered, re-opened or rescoped, and the slice's
  review, acceptance, merge and `slice-closeout` stay owner actions on PR #92.
· P23B.6/P23B.8 are untouched and their optimization stays unauthorized.
```

## 8. Reversibility

```text
One commit on `P23B.7`, on top of S7's `1e6c7d9f`: the production deletion, the two updated test
files, the new guard, and these docs. `git revert <sha>` returns the tree to the S7 revision exactly
(the probe's pre-fix assertions and the reading test come back with it), which is the state the PR
body's review summary was written against.
```

## 9. Gates at the fix commit

```text
npm run check:layout-core                     PASS
npm run check (editor + museum)               PASS — 0 errors / 0 warnings
the touched suites (guard · S7 probe · preview-state · mesh-identity · transient-allocation)
                                              PASS — 51 tests
npm test (full suite)                         PASS — 347 files passed | 1 skipped,
                                              4,912 tests passed | 1 skipped
                                              (+1 file / +4 tests: this guard)
npm run test:arch                             PASS — 23 files / 254 tests
npm run test:perf                             PASS — 8 files passed | 1 skipped, 62 passed |
                                              1 skipped (the ratchet reproduces the committed counts
                                              through the scoped path; no re-record)
npm run build (root; editor + museum)         PASS (adapter-vercel)
```

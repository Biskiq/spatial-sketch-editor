# Pre-P23B.8 follow-up — the release-to-presented wait, split into restore, commit and the tail

Date: 2026-09-27. Phase: `pre-p23b.8-follow-up`. Status: MEASURED, IN PROTOCOL, BOTH RUNTIMES.
Authority: DEV/harness instrumentation only (`apps/editor/src/lib/bench`, the DEV harness route, the
runner). **No product behaviour changed by this pass. No commit. No baseline. No cache, no Worker, no
WASM.** P23B.8's compute-bound prerequisite stays **UNPROVEN**.

## 0. The question this answers

> Price the post-release restore path in steady state by running the new preparation marks inside the
> M1 protocol, and report how much of the release-to-presented wait is the baseline restore versus the
> commit.

**The answer, in one line: none of it — 0.0 ms of restore and 0.0 ms of commit in all 38 class rows
across both runtimes. Both land INSIDE the release.** The wait's page-side component is Plan
presentation rendering, and it *ends* p50 11.3–88.8 ms after the release; **47–78 % of the wait
(Electron) and 43–59 % (Chrome) comes after the page's own JavaScript has finished**, which is now a
bounded number instead of an unknown.

This supersedes the cold live observation in `2026-09-27-D4-D5-D6-live-attribution-record.md` §4 that
the post-release window "contains the app's own baseline restore and a mesh reinstall". In protocol, in
steady state, it contains neither. That record's §4 is marked in place.

## 1. What was added, and what it is not

DEV-only, harness/bench modules and the runner. No product behaviour changed by this pass. The table is
the full instrument set this split reads; the row marked *(preceding pass)* was added by the authorized
D4/D5/D6 pass and is listed because this pass runs it in protocol — those editor-side marks are
`import.meta.env.DEV`-gated and inert in a production build.

| file | addition | authority |
|---|---|---|
| `apps/editor/src/lib/bench/p23b-m1-record.ts` | per-class `postRelease` (marks placed INSIDE the release and AFTER its end, bucketed `restore` / `commit` / `other`, union-per-action and never summed, each bucket reported as a distribution over a stated population) and `postReleaseVsPresented` (the same rows paired against the presented-frame instant); `containmentMarks` + `unattributedOutsideActions` (the containment record's own pool, named and counted) | DEV record only |
| `apps/editor/src/lib/bench/p23b-containment.ts` | the walk now exposes each mark's placement and the unattributed pool per class | DEV record only |
| `apps/editor/tests/lib/bench/p23b-m1-browser-runner.cli.ts` | hands the presented-frame instants to that pairing | DEV runner only |
| `apps/editor/src/lib/editor/layout/prepared-wall-meshes.ts`, `p23b-mesh-identity.ts`, `layout-preview-state.svelte.ts` *(preceding pass)* | the preparation's own accounting as a `prebuild-stats` row, and four additive phase marks (`mesh-inputs`, `mesh-input-validate`, `mesh-room-meshes`, `mesh-build`) inside the existing `mesh-prebuild` | DEV-gated (`import.meta.env.DEV`); `mesh-prebuild` keeps its meaning, nothing is summed |
| `apps/editor/tests/lib/bench/p23b-m1-record.test.ts` | regression tests for this split: placement, bucketing, union-not-sum, the pool counters and the pairing's coverage | DEV test only |

**What the split is not.** It is a *component* read of a latency, never the latency: the window is the
union of marks the action's own containment tree holds after the release ended, and the remainder —
what the page was not running attributed JavaScript for — is reported as `unexplained`, not absorbed.
Every per-action window is a **lower bound** on the page's post-release work, because a mark outside
every action's span appears in no window; that is exactly what `containmentMarks` and
`unattributedOutsideActions` now state, and §5 prices that pool.

## 2. The split — release end → next presented frame, p50, milliseconds

`wait` = the release row's own presented-frame latency. `page after` = the union of the action's
post-release marks (its `%` is of this run's `wait`, a ratio of medians). `restore` / `commit` after =
the two families this pass exists to separate. `tail` = `wait` − (the instant the page's post-release
work ended), as a share of `wait`.

### Electron 35.0.2 (Chromium 134, offscreen DEV host)

| fixture / class | wait | page after | % | restore after | commit after | tail | % |
|---|---:|---:|---:|---:|---:|---:|---:|
| straight rigid-wall-drag | 24.8 | 8.9 | 36 | **0.0** | **0.0** | 13.1 | 53 |
| straight whole-room-move-bridge | 51.1 | 8.7 | 17 | **0.0** | **0.0** | 39.7 | 78 |
| straight wall-authoring | 52.4 | 13.4 | 26 | **0.0** | **0.0** | 36.5 | 70 |
| straight room-creation-commit | 54.9 | 9.3 | 17 | **0.0** | **0.0** | 42.7 | 78 |
| all-curved rigid-wall-drag | 174.9 | 75.0 | 43 | **0.0** | **0.0** | 95.4 | 55 |
| all-curved bend | 168.5 | 75.3 | 45 | **0.0** | **0.0** | 88.7 | 53 |
| all-curved whole-room-move-bridge | 172.7 | 78.1 | 45 | **0.0** | **0.0** | 90.0 | 52 |
| all-curved wall-authoring | 187.1 | 83.7 | 45 | **0.0** | **0.0** | 99.1 | 53 |
| all-curved room-creation-commit | 188.6 | 83.1 | 44 | **0.0** | **0.0** | 99.7 | 53 |
| owner-40-curved rigid-wall-drag | 86.0 | 28.7 | 33 | **0.0** | **0.0** | 51.7 | 60 |
| owner-40-curved bend | 83.9 | 29.3 | 35 | **0.0** | **0.0** | 49.7 | 59 |
| owner-40-curved whole-room-move-bridge | 92.5 | 28.5 | 31 | **0.0** | **0.0** | 58.1 | 63 |
| owner-40-curved wall-authoring | 76.9 | 30.2 | 39 | **0.0** | **0.0** | 40.9 | 53 |
| owner-40-curved room-creation-commit | 67.8 | 30.5 | 45 | **0.0** | **0.0** | 31.9 | 47 |
| connected-grid rigid-wall-drag *(advisory)* | 92.6 | 32.5 | 35 | **0.0** | **0.0** | 57.7 | 62 |
| connected-grid bend *(advisory)* | 5.1 | 33.8 | — | **0.0** | **0.0** | — | — |
| connected-grid whole-room-move-bridge *(advisory)* | 97.0 | 33.0 | 34 | **0.0** | **0.0** | 62.0 | 64 |
| connected-grid wall-authoring *(advisory)* | 92.6 | 34.1 | 37 | **0.0** | **0.0** | 56.5 | 61 |
| connected-grid room-creation-commit *(advisory)* | 72.9 | 33.1 | 45 | **0.0** | **0.0** | 37.4 | 51 |

### Google Chrome for Testing 152.0.7977.54 (headless, one harness tab)

| fixture / class | wait | page after | % | restore after | commit after | tail | % |
|---|---:|---:|---:|---:|---:|---:|---:|
| straight rigid-wall-drag | 26.1 | 8.9 | 34 | **0.0** | **0.0** | 14.8 | 57 |
| straight whole-room-move-bridge | 26.0 | 8.5 | 33 | **0.0** | **0.0** | 14.5 | 56 |
| straight wall-authoring | 34.2 | 14.3 | 42 | **0.0** | **0.0** | 17.3 | 51 |
| straight room-creation-commit | 33.3 | 10.4 | 31 | **0.0** | **0.0** | 19.8 | 59 |
| all-curved rigid-wall-drag | 152.0 | 78.6 | 52 | **0.0** | **0.0** | 69.5 | 46 |
| all-curved bend | 159.7 | 81.4 | 51 | **0.0** | **0.0** | 73.5 | 46 |
| all-curved whole-room-move-bridge | 154.8 | 78.9 | 51 | **0.0** | **0.0** | 71.7 | 46 |
| all-curved wall-authoring | 162.9 | 83.0 | 51 | **0.0** | **0.0** | 75.3 | 46 |
| all-curved room-creation-commit | 157.1 | 78.3 | 50 | **0.0** | **0.0** | 74.5 | 47 |
| owner-40-curved rigid-wall-drag | 54.3 | 25.8 | 48 | **0.0** | **0.0** | 24.5 | 45 |
| owner-40-curved bend | 54.7 | 26.7 | 49 | **0.0** | **0.0** | 24.0 | 44 |
| owner-40-curved whole-room-move-bridge | 53.2 | 24.2 | 46 | **0.0** | **0.0** | 24.8 | 47 |
| owner-40-curved wall-authoring | 55.5 | 28.0 | 51 | **0.0** | **0.0** | 23.6 | 43 |
| owner-40-curved room-creation-commit | 60.8 | 26.7 | 44 | **0.0** | **0.0** | 29.3 | 48 |
| connected-grid rigid-wall-drag *(advisory)* | 62.4 | 30.0 | 48 | **0.0** | **0.0** | 30.8 | 49 |
| connected-grid bend *(advisory)* | 64.2 | 31.4 | 49 | **0.0** | **0.0** | 31.1 | 48 |
| connected-grid whole-room-move-bridge *(advisory)* | 62.4 | 30.6 | 49 | **0.0** | **0.0** | 29.8 | 48 |
| connected-grid wall-authoring *(advisory)* | 64.6 | 31.9 | 49 | **0.0** | **0.0** | 30.6 | 47 |
| connected-grid room-creation-commit *(advisory)* | 72.2 | 31.4 | 44 | **0.0** | **0.0** | 38.0 | 53 |

Readouts that hold in every one of the 38 rows:

1. **`restore after` = 0.0 and `commit after` = 0.0.** Not "small": the p50 is zero and the p95 is
   zero. Across all 38 classes, **zero** `commit`-family marks and **three** stray `restore`-family
   marks fall after a release at all (`restore-bookkeeping` once, `restore-issues-clone` once,
   `restore-mesh-install` once — one action each, 0.0 ms p50 each). The wait is not restore and not
   commit.
2. **The page-side component is Plan rendering only.** Every non-zero label in every post-release
   window is `plan-render-model` (2.0–60.7 ms), `svg-attributes` (785 occurrences per action at ~0.1 ms
   each, 5.0–22.7 ms as an action's union), `plan-salience` (0.4–1.8 ms), and a sub-0.1 ms sliver of
   `plan-svg-context-ink` / `plan-presentation`. They are disjoint in time, not nested: each window's
   p50 is the SUM of its labels' p50s (8.9 against 8.8 straight; 75.0 against 74.6 all-curved), never
   their maximum — so no reader may treat `plan-render-model` as already containing `svg-attributes`,
   and none may add these two documents' columns together either. No geometry, no compile, no install:
   the release is where those live (§3).
3. **The page starts work almost immediately and stops well before the frame is presented.**
   First post-release page mark at p50 **1.6–5.3 ms** after the release ends; the window's last instant
   at p50 **11.3–88.8 ms**. Everything after that — **47–78 % of the wait (Electron), 43–59 %
   (Chrome)** — happens when the page is running no attributed JavaScript. That tail, not the restore
   and not the commit, is what the wait is mostly made of. The wait therefore decomposes into 1.6–5.3 ms
   of nothing-but-scheduling, the Plan render (17–52 % of the wait), and the tail; the release's own
   synchronous work is *before* the wait starts and is part of the release row, never of this window.
4. **`unexplained` is the same statement as the tail** and is reported per class: 16.3–107.2 ms
   (Electron), 17.5–79.3 ms (Chrome), 83 % of the straight whole-Room wait and 52–56 % of the curved
   ones.

One class is flagged rather than read: **connected-grid bend** has a `wait` p50 of 5.1 ms against a
33.8 ms post-release window (a ratio of 661 %). The class is bimodal — the pairing's p50s come from
different actions — so its row is reported and not used for any ratio, exactly as the pooled-percentile
rules in S4 forbid.

## 3. Which side of the release the work landed on

The same rows, read INSIDE the release: all the geometry, compile, install and teardown work is there,
and the whole-Room class is the one class where the split inverts.

| fixture / class | inside-release page work | inside restore | inside commit |
|---|---:|---:|---:|
| straight rigid-wall-drag | 25.7 / 24.2 | 0.1 / 0.1 | 12.0 / 10.1 |
| **straight whole-room-move-bridge** | 78.3 / 74.8 | **7.2 / 7.4** | 1.2 / 1.3 |
| straight wall-authoring | 37.3 / 32.7 | 0.1 / 0.1 | 19.3 / 18.1 |
| straight room-creation-commit | 31.1 / 32.7 | 0.1 / 0.1 | 18.9 / 21.6 |
| all-curved rigid-wall-drag | 57.0 / 53.0 | 0.2 / 0.2 | 22.4 / 18.2 |
| all-curved bend | 54.4 / 53.3 | 0.2 / 0.2 | 21.0 / 17.8 |
| **all-curved whole-room-move-bridge** | 151.4 / 142.4 | **9.9 / 10.8** | 2.5 / 2.4 |
| all-curved wall-authoring | 83.6 / 79.2 | 0.1 / 0.2 | 27.3 / 26.8 |
| all-curved room-creation-commit | 81.7 / 73.4 | 0.2 / 0.2 | 28.6 / 25.8 |
| owner-40-curved rigid-wall-drag | 41.5 / 36.4 | 0.2 / 0.1 | 17.4 / 12.5 |
| owner-40-curved bend | 41.0 / 37.0 | 0.2 / 0.2 | 16.5 / 12.2 |
| **owner-40-curved whole-room-move-bridge** | 107.4 / 88.4 | **8.3 / 7.0** | 2.9 / 2.4 |
| owner-40-curved wall-authoring | 63.7 / 54.5 | 0.2 / 0.2 | 22.0 / 18.4 |
| owner-40-curved room-creation-commit | 57.7 / 49.3 | 0.2 / 0.2 | 22.0 / 18.3 |
| connected-grid rigid-wall-drag *(advisory)* | 42.3 / 36.5 | 3.6 / 3.2 | 1.0 / 0.9 |
| connected-grid bend *(advisory)* | 20.3 / 20.0 | 0.1 / 0.1 | 9.2 / 7.1 |
| connected-grid whole-room-move-bridge *(advisory)* | 43.4 / 37.2 | 3.7 / 3.2 | 1.0 / 0.9 |
| connected-grid wall-authoring *(advisory)* | 31.8 / 28.4 | 0.1 / 0.1 | 8.4 / 7.9 |
| connected-grid room-creation-commit *(advisory)* | 31.4 / 28.4 | 0.1 / 0.1 | 9.3 / 8.7 |

*(both runtimes, Electron / Chrome, union p50 in ms)*

Two structural facts, both new:

- **The restore path is only real on a whole-Room move.** Every other class reports 0.1–0.2 ms (and
  3.6 / 3.2 on the connected grid's drag) because the transient baseline is installed and released per
  action there; the whole-Room bridge carries 3.2–10.8 ms of it — **6.5–9.9 % of that release's own
  page work** (`baseline-restore` 3.2–10.8, essentially all of it `restore-reactive-write`, with
  `restore-project-clone` at 0.4–1.2 and `restore-mesh-install` at 0.0). It is the largest single
  non-geometry item in that release, and it is still the wrong place to look for the wait: it is inside
  a boundary the wait is measured *from*.
- **The bridge inverts restore and commit.** On every other class the commit is the bigger of the two
  (12.0–28.6 ms of compile/install versus a 0.1–0.2 ms restore). On the bridge the release commits
  almost nothing (1.0–2.9 ms) and tears the baseline down instead — consistent with the edit having
  already landed during the drag, which is where the bridge's per-pointermove compile/install cost
  (§4) is paid.
- **The restore path's MESH INSTALL is free in steady state, and that is the term the cold observation
  blew up.** `restore-mesh-install` reports p50 **0.00 ms, exclusive self 0.00 ms, no children and no
  withheld self** — 20 `restore-mesh-install` per accepted action on a drag and 120 (6 per action) on
  the bridge, in both legs. No `mesh-prebuild` is nested inside any of them, which is exactly what a
  reuse hit looks like: the generation it installs is already in the derived set, so the install is
  bookkeeping. In the cold probe the same mark wrapped a preparation of `{ built: 0, reused: 40 }` and
  read 129.2 ms — i.e. the cold number was a first-preparation cost (the whole-generation comparison a
  `reused: 40` preparation still pays), not a per-action cost. See §4 for that comparison priced in
  protocol.

## 4. In protocol: what the new preparation marks report

Same two legs, using the class rows' own mark counts over the measured population. `xN` is
occurrences per **accepted action**; ms are the row's own p50; `remainder` is `mesh-prebuild` minus its
three named children for the same action — stated as a difference of this action's own rows, because
the containment rule withholds `mesh-prebuild`'s exclusive self (its children do not nest).

| runtime | fixture / class | `mesh-prebuild` | `mesh-input-validate` | `mesh-build` | remainder | `preview-compile` |
|---|---|---:|---:|---:|---:|---:|
| Electron | straight rigid-wall-drag | 1× 10.5 | 1× 7.1 | 4× 0.4 | 3.0 | — |
| Electron | **straight whole-room-move-bridge** | **6× 52.9** | 6× 5.1 | 20× 0.3 | **47.5** | 5× 9.9 |
| Electron | all-curved rigid-wall-drag | 1× 12.7 | 1× 6.9 | 3× 0.4 | 5.4 | — |
| Electron | **all-curved whole-room-move-bridge** | **6× 70.6** | 6× 7.2 | 20× 0.4 | **63.0** | 5× 31.0 |
| Electron | owner-40-curved rigid-wall-drag | 1× 7.7 | 1× 4.2 | 3× 0.3 | 3.2 | — |
| Electron | **owner-40-curved whole-room-move-bridge** | **6× 47.1** | 6× 4.5 | 20× 0.3 | **42.3** | 5× 22.5 |
| Electron | connected-grid rigid-wall-drag *(advisory)* | 6× 10.8 | 6× 2.2 | 60× 0.4 | 8.2 | 5× 13.7 |
| Electron | connected-grid whole-room-move-bridge *(advisory)* | 6× 10.8 | 6× 2.2 | 60× 0.4 | 8.2 | 5× 14.1 |
| Chrome | straight rigid-wall-drag | 1× 11.2 | 1× 4.9 | 4× 0.5 | 5.8 | — |
| Chrome | **straight whole-room-move-bridge** | **6× 49.2** | 6× 5.1 | 20× 0.4 | **43.7** | 5× 8.6 |
| Chrome | all-curved rigid-wall-drag | 1× 12.1 | 1× 6.2 | 3× 0.7 | 5.2 | — |
| Chrome | **all-curved whole-room-move-bridge** | **6× 64.1** | 6× 6.6 | 20× 0.5 | **57.0** | 5× 28.0 |
| Chrome | owner-40-curved rigid-wall-drag | 1× 7.3 | 1× 4.0 | 3× 0.4 | 2.9 | — |
| Chrome | **owner-40-curved whole-room-move-bridge** | **6× 38.1** | 6× 3.9 | 20× 0.3 | **33.9** | 5× 17.6 |
| Chrome | connected-grid rigid-wall-drag *(advisory)* | 6× 9.3 | 6× 1.9 | 60× 0.4 | 7.0 | 5× 11.5 |
| Chrome | connected-grid whole-room-move-bridge *(advisory)* | 6× 9.4 | 6× 1.9 | 60× 0.4 | 7.1 | 5× 11.6 |

- The D4 structure is confirmed **in protocol**: a whole-Room move prepares **6×** per accepted action
  against a single-wall drag's **1×**, on the same fixture and session (`maxPerAction` is 6 for the
  bridge's `mesh-prebuild` and 1 for the drag's). On the connected grid the drag also previews per
  pointer move (6× both classes), which is why its two gesture intervals are the only pair that do not
  differ (77.8 against 78.9 ms in the earlier corrected capture).
- The comparison stays the cost: `mesh-build` is 0.3–0.7 ms p50 per preparation however many Walls are
  rebuilt, and the remainder — the per-Wall value comparison across the whole generation — is
  33.9–63.0 ms of a 38.1–70.6 ms preparation. Read the DEV column with care: `mesh-input-validate` is
  the DEV-only structural validation and is a child of `mesh-prebuild`, so it is *excluded* from the
  remainder by construction (3.9–7.2 ms per preparation) and a production build does not run it at all
  — the remainder is the comparison in both cases, never the comparison plus the validation.
- `mesh-inputs` (the walk that collects the per-Wall inputs) p50 is 0.0 ms and `mesh-room-meshes` is
  0.0 ms in every class: neither is where the time is.

## 5. The pool: the second restore, priced

One full restore chain per action sits **outside every action's span** — `baseline-restore`,
`restore-reactive-write`, `restore-project-clone`, `restore-model-project`, `restore-issues-clone`,
`restore-mesh-install`, `restore-bookkeeping`, **n = 25 in every class of both legs** (one per action of
the path: 20 measured + 5 warm-up; the wall-authoring classes report 25 for 23 measured + 2 warm-up
actions of their path). Summed p50s across that chain: **0.2–0.9 ms**.

So the restore exists in two places and is negligible in exactly one of them:

| placement | magnitude | in the wait? |
|---|---|---|
| after the release, inside the action's span | 0.0 ms p50 (three single-action strays) | no |
| outside every action's span (the pool) | 0.2–0.9 ms of p50s, once per action | no — it is between actions |
| inside the release, whole-Room bridge only | 3.2–10.8 ms | it is part of the release row, not the wait |
| the restore's own mesh install, wherever it lands | 0.00 ms p50, 0.00 ms exclusive self, no children | it is a reuse hit in steady state (§3) |

That is why the pool counters were published in this pass: without them, "0.0 ms after the release"
would be a claim about a window that cannot see the pool. With them the claim is bounded — the pool
holds 2.4k–10.6k marks per class (`containmentMarks.attributed` 6.8k–85.2k, `unbound` 0–1,968 — the 1,968
is the straight fixture's drag class, whose unbound marks are inside the action but outside every
boundary — and the pool's largest member is `svg-attributes` at 1.5k–7.6k occurrences of ≤0.3 ms), and
the restore chain inside it is under 1 ms per action.

## 6. What this changes

- **D6's falsifier was already negative** (the idle surface paces at 60 Hz — 481 frames in 8,000.1 ms,
  gaps p50 16.668 ms / p95 17.360, M1 runner preflight on the Electron host), so the wait is real work
  and not measurement-surface pacing. This pass says *where* that work is not: it is not the restore,
  not the commit, and not the page's JavaScript at all for 47–78 % of it (Electron) / 43–59 % (Chrome).
- **The mechanism candidate is now bounded, not found.** Within the wait, the page's own post-release
  Plan render accounts for 17–45 % of it (Electron) and 31–52 % (Chrome), and it is over by p50
  11.3–88.8 ms while the frame arrives at 24.8–188.6 ms. What is left is a tail that begins when the
  page's last attributed mark ends and ends at the presented frame — **47–78 % of the wait (Electron),
  43–59 % (Chrome)**. A compositor/raster/present stage is the remaining candidate, and this pass does
  not price it: the trace keeps event counts, not durations, and the harness has no paint-end instant.
- **P23B.8's entry gate is unaffected in the direction that matters.** A wait the page spends not
  running JavaScript for cannot be shortened by moving JavaScript to a Worker, and the restore has a
  measured home inside the release (3.2–10.8 ms of baseline teardown, its mesh install a 0.00 ms reuse
  hit). The prerequisite stays UNPROVEN.

## 7. Limitations

- ADVISORY, one machine, one DEV session, two runtimes. Absolute numbers are session-conditioned (the
  corrected pair established ×0.38–×1.03 between sessions with no code change); the *placement* facts
  here (0.0 after the release, both families inside it, 6 preparations against 1) are structural and
  did not vary between the two runtimes or the four fixtures.
- The connected-grid fixture is **advisory** by schema: it is evidence that the protocol runs it, not a
  recorded row, and its bend class is additionally degenerate (§2).
- The pairing is a ratio of medians, never a median of ratios; `%` columns must not be summed across
  rows or added to the tail.
- The split cannot see work outside an action's span (bounded in §5) or outside the page process (that
  is the tail).
- `treeDirty: true` — the worktree carried this pass's DEV instrument, not yet committed at capture
  time (it lands with this record), so every row is a dirty-tree row on `33d532f5`.
- Both legs ran the **full** protocol, not the preflight, so the idle-cadence readout cited in §6 is the
  one taken earlier on the same host; this pass's legs contribute no cadence row of their own.

## 8. Live evidence / reproduce

```text
LIVE  ./2026-09-27-M1-restore-split-electron.json   (both legs: provenance, 19 class rows each, the
      ./2026-09-27-M1-restore-split-chrome.json      postRelease split, the presented pairing, the
                                                     containment pool, mark and gesture rows)
      The captures keep every row this record quotes; each action's raw per-occurrence mark list is
      folded to a per-label count (`labelsFolded`), because those lists are 785 `svg-attributes`
      entries per action and 16.5 MB per leg against 1.8 MB.
      ./2026-09-27-M1-electron-leg.json / -chrome-leg.json remain the earlier corrected pair (same
      protocol, without the split columns); this pass did not overwrite them. BOTH LEGS ARE WORKING
      TREE ONLY AND NOT COMMITTED (gitignored); this record's own split captures above are committed.

Electron leg — an Electron host on the harness route with `--remote-debugging-port=9225`, one window,
  viewport 1500x1000 DPR 1, throttling disabled, then:
  cd apps/editor && npm exec -- vite-node --config vitest.config.ts \
    tests/lib/bench/p23b-m1-browser-runner.cli.ts -- \
    --port 9225 --runtime "Electron 35.0.2 (Chromium 134.0.6998.88, offscreen host, one harness tab, viewport 1500x1000 DPR 1)" \
    --out <path>.json --budget-ms 10000

Chrome leg — the pinned Google Chrome for Testing 152.0.7977.54, headless, one tab, same viewport:
  ... --port 9223 --runtime "Google Chrome for Testing 152.0.7977.54 (headless, one harness tab, viewport 1500x1000 DPR 1)" \
    --out <path>.json --budget-ms 10000

Both legs: 19 class rows, all four fixtures settled, 0 dropped boundaries, calibration residual
  0.045 ms (Electron) and 0.333 ms (Chrome); 4,403 and 4,418 presented frames.
```

## 9. Verification

```text
check                    0 errors / 0 warnings, both workspaces
test                     360 files / 5,129 passed (2 files, 4 tests skipped)
test:arch                23 files / 254 passed
test:heavy               7 files / 89 passed
test:perf                8 files / 63 passed (1 skipped)
build                    ok
visitor bundle           3 server / 9 client entries
focused suites           6 files / 139 tests — the record + containment + mesh-identity + snap + snap
                         parity + snap input-probe suites, including the split's own regression tests
no baseline, no ratchet  g3-baseline.json untouched; no baseline file read or written; no cache,
                         Worker or WASM path added
no commit by this pass   `git status` carried every change of this pass, uncommitted at the time; the
                         pass landed no commit of its own
```

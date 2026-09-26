# P23B.7 S7 — the `commit-capture` residual, targeted (2026-09-25)

AUTHORITY: the ratified plan `./2026-09-22-P23B.7-interaction-optimization.md` §7 MEASUREMENT +
           §0.8.3 (the owner's minimum-reps measurement-routing amendment, 2026-09-25): after S4 the
           slice measures the ONE residual the numbers named — `commit-capture`'s snapshot clone —
           and does NOT re-run the full wall-authoring sweep. This record is S7 under that amendment;
           it changes no production behaviour and adds no budget metric.
STATUS:    S7 EXECUTED (targeted). The residual is now ATTRIBUTED and still UNADDRESSED, with the
           bounded next action named below.

## 1. What `commit-capture` is (mechanism, by symbol)

```text
`PlanWorkspace.svelte:437` wraps the commit's snapshot in the `commit-capture` mark:
    store.commitLayoutTransaction(
        p2311Measure('commit-capture', () => captureLayoutPreviewSnapshot(layoutPreview))
    );
`layout-preview-state.svelte.ts:2789` `captureLayoutPreviewSnapshot` returns
    project:  cloneJson(state.project)     // the WHOLE project document (layout + scene)
    model:    cloneJson(state.model)       // the derived preview model (compiled render projection)
    issues:   cloneJson(state.issues)
    geometry: state.geometry               // BY REFERENCE — free
    + scalars (source, messages, bounds)
`cloneJson` is `JSON.parse(JSON.stringify(value))` — the proxy-safe clone (Svelte `$state` proxies
break `structuredClone`, so this is the JSON round-trip the measurement priced at 107–149 ms).

CADENCE (source contract, asserted by the probe): in the architecture path the capture runs ONCE
per gesture start (`beginArchitectureEditGesture`, the frozen baseline) and never on the per-move
path (`previewArchitectureEdit`); the commit path runs exactly the one marked capture. Other
gestures capture their own baselines the same way.
```

## 2. Targeted measurement (the committed probe)

```text
`apps/editor/tests/lib/bench/p23b7-capture-attribution.test.ts` — 6 tests, deterministic claims
asserted, timing only PRINTED. Fixtures: the committed matrix fixtures installed through
`importLayoutPreviewJson(serializeWallFirstLayoutDocument(...))`.

PAYLOAD ACCOUNTING (deterministic) — 40-Wall all-curved fixture:
    project    21,928 bytes ·    639 nodes · 0.6 % of bytes
    model   3,412,257 bytes · 39,106 nodes · 99.4 % of bytes
    issues          2 bytes ·      1 node
    TOTAL   3,434,187 bytes · 39,746 nodes per capture
  The payload GROWS with the document (empty < 12-Wall < 40-Wall), and the derived `model`
  dominates BOTH measures on every committed fixture. The project — the thing a history entry
  conceptually needs — is under 1 % of what is cloned.

WHY THE BROWSER NUMBER IS 107–149 ms AND NOT ~13 ms (advisory, node, one session):
  the capture reads the LIVE graph, and `EditorApp.svelte:248` holds it as
  `$state(createEmptyWallFirstLayoutPreviewState())`, so `state.model` is a Svelte state PROXY.
  Cloning the SAME 3,412,257-byte model: p50 19.97 ms on a plain state vs p50 132.96 ms through
  the editor-style proxy (the probe builds the proxy with `svelte/internal/client`'s `proxy`, the
  S6 harness's own construction). Per-stream plain p50: project 0.11 ms · model 12.84 ms ·
  issues 0 ms; end-to-end capture plain p50 20–73 ms depending on GC state. These are single-node
  numbers, ADVISORY, and are not asserted anywhere.

NO PRODUCTION READER INSTALLS THE CLONED MODEL (asserted):
  `restoreLayoutPreviewSnapshotUnmeasured` re-projects the model from the shared `geometry`
  (`state.model = projectLayoutPreviewModel(snapshot.geometry)`), so a restore installs a DIFFERENT
  object with equal content (the probe pins `toEqual` but `not.toBe`), and
  `layoutPreviewSnapshotMatchesLive` reads only `project.layout`. A repository search finds exactly
  one reader of `snapshot.model`: a test assertion in `layout-preview-state.test.ts:204`.
```

## 3. What this means (advisory, for the owner's next ruling — NOT taken here)

```text
The dominant share of the residual clones a DERIVED PROJECTION that no production reader installs:
restore re-projects it and the transient guard never looks at it. The bounded next action is to
stop cloning `model` in the capture (keep `project`, `geometry` by reference, the scalars and
`issues`), which removes ~99.4 % of the payload and the proxy-multiplied JSON round-trip with it.
WHY IT IS NOT DONE IN P23B.7: the capture is the history/undo snapshot's payload, its contract is
pinned by the round-trip suites (and one test reads `snapshot.model`), and the owner's §0.8.3 ruling
authorizes a MEASUREMENT at this residual, not a commit-path change. It belongs to a follow-up with
its own oracle (the commit-capture identity/round-trip contract), most naturally beside
P23B.5-family cache work rather than inside S4's topology mechanism.
```

## 4. Moved and unmoved costs (slice-wide, honest)

```text
MOVED by this slice (durable, count-based):
  · S6 — the accepted edit's Wall-mesh builds: TWO → ONE (all install-side), `commit-replace` builds
    200/200 actions → 0; between-action restore 0 builds, 475/475 hits (S6's own record).
  · S4 — the per-move preflight evaluates only each move's affected extent after ONE clean
    initialization; invariant predicate evaluations on moves 2..k are ZERO (S4's record).
UNMOVED (carried, named):
  · `commit-capture` 107–149 ms per accepted edit — NOW ATTRIBUTED (§1–§2); unaddressed by ruling.
  · the between-action restore's reactive write p50 17.2 ms (`restore-reactive-write`; 75 curved /
    50 straight) — unchanged, and out of this slice's named targets.
  · the acceptance-side install builds (p50 11.9/13.4/23.7 ms) — unchanged.
CARRIED LIMITS (unchanged): every ms above is single-machine / single-session and advisory; the
  committed browser capture's long tasks remain NON-ATTRIBUTABLE; all-curved-40 aborted on the
  driver's 6000 ms guard in the measurement step; `g3-baseline.json` was neither read nor rewritten
  and no budget metric was added.
```

## 5. Gates

```text
npm run check:layout-core · npm run check (editor + museum)    PASS, 0 errors / 0 warnings
the S7 probe (6 tests)                                          PASS
full suite at the S4 commit (this probe added after)            PASS — see §5.1 for the PR-gate
                                                                re-run with this probe in place
```

### 5.1 PR-gate re-run and the test-budget fix (2026-09-25)

```text
FOUND AT THE PR GATE, by the re-run rather than by a claim: with this probe in place the FULL suite
failed exactly one test — this file's own advisory proxy comparison — on vitest's DEFAULT 5000 ms
test timeout. The mechanism is the one this record measures: `advisoryP50` cloned the 40-Wall model
12 times, and through the proxy that is >1.5 s idle and several times that beside 346 files on 8
logical CPUs. Nothing deterministic failed; the measurement was simply allowed to cost more than
the runner budgets for one test.

FIX (test budget only — no assertion, no payload, no fixture, no mechanism changed):
  · `advisoryP50(run, { warmups = 3, samples = 9 })` — the repetition count is now a caller knob;
    the proxy comparison asks for 1 + 3, the per-stream printer keeps its defaults.
  · both advisory tests carry `{ timeout: 120000 }` (the repo's convention for its recording
    tests), so a loaded machine cannot fail a printed-never-asserted number.
  This does not weaken §2's findings: the contrast reproduces in the same regime — this session's
  re-run prints p50 14.55 ms plain vs 122.34 ms through the proxy, per-stream project 0.1 / model
  11.3 / issues 0 ms, capture 14.41 ms end-to-end — and the numbers stay advisory and
  single-session exactly as §2 states. The probe file's identity (six tests, same describe
  structure) and the S6/S1 browser numbers it cites are untouched.

GATES AT THE PR GATE (S7 probe in place, after the fix):
  npm run check:layout-core                                    PASS
  npm run check (editor + museum)                              PASS — 0 errors / 0 warnings
  npm test (full suite)                                        PASS — 346 files passed | 1 skipped,
                                                               4,908 tests passed | 1 skipped
  npm run test:arch                                            PASS — 23 files / 254 tests
  npm run test:perf                                            PASS — 8 files passed | 1 skipped,
                                                               62 passed | 1 skipped (the reuse
                                                               ratchet reproduces the committed
                                                               counts through the scoped path)
  npm run build (root; editor + museum, adapter-vercel)         PASS
```

## 6. Limits

```text
· No new browser capture was run (the §0.8.3 ruling): the ms evidence stays S1's/S6's committed
  captures; this record adds the mechanism, the payload accounting and the proxy factor.
· The proxy comparison is a node measurement of the SAME clone construction, not a browser trace;
  it explains the gap's direction and order of magnitude, not its exact browser value.
· The payload numbers are the committed fixtures'; a real project's `project`/`model` sizes scale
  with its own content, and the model-dominance claim is asserted on those fixtures.
· No fix is claimed, started or staged here; the snapshot contract is untouched.
```

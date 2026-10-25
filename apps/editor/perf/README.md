# On-demand performance harness (T3.P03.S02)

Owner-authorized 2026-10-22 by the
[product-convergence ratification](../../../docs/reference/decisions/product-convergence-ratification-2026-10-22.md)
and installed by T3.P03.S02. It is a permanent **on-demand** workflow: no CI job,
no schedule, no benchmark registry and no Vitest timing assertion. `npm test`,
`npm run check` and `npm run build` never collect or call it.

The owning contract is
[browser performance and delivery](../../../docs/reference/components/performance.md);
the workflow rule lives in
[the test contract](../tests/README.md#product-convergence-performance-workflow).

```sh
npm run perf                 # from the repository root: production build + all flows
npm run perf:bundle          # delivery report over the current production build

# one flow / one browser, reusing an existing preview server
cd apps/editor
npx playwright test --config perf/playwright.config.ts flows/drag-correlation.spec.ts --project=chromium
PERF_BASE_URL=http://127.0.0.1:4173 npx playwright test --config perf/playwright.config.ts
```

`npm run perf` builds with `vite build` and serves the ordinary production build
with `vite preview` on `http://127.0.0.1:4173`. The Playwright/CDP runner stays
outside that bundle. Product marks are inert until a Playwright init script sets
`__BISKIQ_PERF__.enabled`; the diagnostic overlay also requires `traceProof`.
Browsers come from
Playwright's own cache (Chromium, plus branded Chrome where installed); every
cold run uses a fresh context, and warm/repeat-use reuse one context for their
series, never a user profile.

## Flows

| Spec | Flow | What it records |
| --- | --- | --- |
| `flows/startup.spec.ts` | F1 startup | hub interactive, Stage first **architectural** frame (rAF proxy, not the contract's first interactive frame), FCP, LCP, long tasks, script bytes/requests, cold, warm and repeat-use |
| `flows/project-open.spec.ts` | F2 open | each tier's cached workload: admission → first **architectural** frame (rAF proxy), cold, warm and repeat-use, with per-stage spans, work counts, render counters and setup share; plus the A.6 old-method rows `F2-old-S/M` |
| `flows/orbit.spec.ts` | F7 orbit | per tier: 10 s scripted orbit + dolly (extended only until the run reaches 600 frames), frame-interval p50/p95/p99, dropped frames, long tasks, render counters per frame (draws, triangles, shadow passes/draws), compiles per frame, frames rendered at rest, cold, warm and repeat-use |
| `flows/save.spec.ts` | F9 Save | save:submit → Saving-label DOM update → parsed durable receipt → Saved-label DOM update, through the API test-auth seam on a local stack, cold, warm and repeat-use; label mutations do not prove presentation |
| `flows/cycles.spec.ts` | F13 repeated open/close | per tier: cold (10 measured cycles), warm (1 discarded + 1 measured) and repeat-use (1 discarded + 10 measured); 20 edits per cycle and JS heap after forced GC, with entry heap reported separately from the measured baseline; the Stage's live geometries/textures/programs per cycle |
| `flows/head-lifetime.spec.ts` | Route head ownership regression | cold SSR/hydration, dynamic publication title/noindex and exact connected head-node counts over repeated client navigation; isolated metadata correctness, not a flow baseline |
| `flows/renderer-lifetime.spec.ts` | Concurrent renderer ownership regression | actual WebGL secondary-Canvas collection while a survivor keeps identical rendered pixels and render-target state; isolated correctness fixture, not a flow baseline |
| `flows/drag-correlation.spec.ts` | F3/F4/F8 methodology | per tier, in-session at the loaded peak: distinct drags and typed lengths each reset by Undo (cache-served samples counted apart), input sequence → matching preview presentation, latest-input age, final-result completion, 20 Undo/Redo cycles, per-stage spans and work counts, cold, warm and repeat-use, plus the deliberately delayed-preview proof (grid-S) |
| `flows/trace-proof.spec.ts` | Separate trace-image diagnostic | exact preview sequence/geometry identity and marker pixel in Chrome trace images, exact compositor presentation-feedback span, clock anchors, mismatch and delayed-preview controls; no hard budget claim |
| `flows/stage-trace.spec.ts` | Per-stage traces (S06 C) | one traced window per flow and tier (F2, F3, F4, F8, F7): main-thread busy/idle, GC, script, style/layout, paint and GPU-process time beside the window's stage spans; attribution, never a timing row |
| `flows/e5-sweep.spec.ts` | E5 browser counts (S06 C) | museum ×1 and the H/D sweeps: render counters at rest, the fixed edit's work, and framebuffer equality at the fixed View before and after the edit (H must match ×1); count, not timing |
| `flows/calibration.spec.ts` | CPU calibration | grid-7 compile + Stage admission, 20 runs, CDP throttling search when a reference median is supplied |

## Bench setup (T1.P02.S06)

T1.P02.S06 builds the method, the workloads and the counters before its three
owner-run benches ([plan](../../../docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/implementation-plan.md)).
Agents never run a pass; they run only the smoke check and the censuses.

```sh
cd apps/editor
npm run perf:workloads                     # generate missing/stale workloads (setup, ~25 min for all)
npm run perf:workloads -- --verify         # reproducibility: rebuild S, M and museum, compare digests (~1.5 min)
npm run perf:census                        # E1–E5 Node censuses: census, not timing (~15 min)
npm run perf:bench -- --smoke              # smoke check of every flow at every tier: smoke, not evidence
npm run perf:bench -- --label bench-1      # one owner-run pass on the M2
```

**Workloads (A.1, B).** `perf/generate-workloads.ts` builds every workload once
through the public layout-core planners, the canonical compiler and, for the
museum family, T3's public Experience operations, admits it through
`admitSourceJson` with no blocking issue, closure or diagnostic, and writes the
canonical envelope plus a meta file into the git-ignored cache. Captured ids come
from fixed sequences, so identical inputs give byte-identical JSON; the meta's
input key covers the workload parameters, every unit's format number and the
generator sources, and a stale, missing or corrupt workload refuses every measured
run (`loadWorkload`). Flows load the JSON under their own project id
(`workloadJsonFor` rewrites only the id token; setup, outside every window).

| Workload | What | Role |
| --- | --- | --- |
| `grid-S`, `grid-M`, `grid-L`, `grid-XL` | grid-3/7/14/20 with doors and windows | bench tiers (XL report-only) |
| `realistic-L` | grid-14 + approved GLB derivatives | bench tier, **blocked** (below) |
| `museum` | 328 Walls, 56 Rooms, 137 Openings (115 doors with `connectsRoomIds`), enfilade, corridor ring, central hall, 92 catalogue placements, 18 Views with Camera connections, an 18-Stop Experience route | censuses, E5 base, optional latency rows |
| `sweep-H3/H10`, `sweep-D3/D10` | the museum plus independent 7×7 blocks (H: hidden, behind Walls, outside the focus wing's shadow camera, no lights; D: on the enfilade axis beyond the wing) | E5 irrelevance sweep |

The museum and sweep placements use the shipped catalogue GLBs (product assets
with recorded licenses) until the realistic-L derivatives are approved. ×30 is not
built: generation grows about quadratically (≈ 2 h extrapolated), beyond the bound,
so E5 slopes above ×10 are arithmetic only.

**Realistic-L.** Blocked on two owner prerequisites: per-source approval of each
CC0/permissive GLB source (download outside the repository, source and license
recorded), and `creator-import@1` seeding as resource revisions on an isolated
per-lane API/Compose stack, never a shared database. Until then every flow
reports a `…-unrun` row with that reason, and the pass manifest records it.

**Counters (C).** Product code exposes two inert seams that do nothing without the
harness flag: `perfRenderer` hands each surface's WebGL renderer to the harness,
which counts Three's own `renderer.info` per frame (main-pass draws, triangles,
shadow-map passes and shadow draws, programs, geometries, textures, frames at
rest; `drawCalls` excludes the shadow pass, which `shadowDrawCalls` counts), and
`installPerfWorkObserver` aggregates layout-core's work observer into
`__BISKIQ_PERF_WORK__`: spans for compile, admission (parse, runtime, digest,
serialize, freeze), envelope validation, Scene resolve and Layout representation,
and deterministic counts (compiles, entity sets, pair visits, digests and bytes,
serializations, F4 clones and frozen objects). Flows diff both around each
measured window; `stage-trace.spec.ts` adds one traced window per flow for
GC/idle attribution. `readResidentBytes` traverses a surface's last rendered
scene once at a fixed point (after F2's open, after F7's orbit, at E5's fixed
View): unique textures with stored and RGBA8+mips bytes, geometry-buffer bytes,
shadow-map and drawing-buffer bytes, materials and meshes. GPU time and
shader-compile time at the first frame are not captured (the traced windows show
the main-thread cost of the first render).

**A pass (`perf:bench`).** One invocation: the machine-wide lock
(`/tmp/biskiq-perf.lock`), load average, top processes, `pmset -g therm` and power
source at the start and end (a start above 4.0 or a running Vitest process marks
it contaminated), one production build, then the tiers peak first — realistic-L,
L, XL, M, S — each running F2 (+ A.6 at S/M), F3/F4/F8, F7, F13 and the traced
windows, with the thermal state at every boundary and a recorded cool-down before
M and S; then the E5 browser counts and the transferred rows (F1, F10, and F5/F6
when `PERF_API_ORIGIN` and `E2E_TEST_AUTH_SECRET` name a local stack). The
manifest in the pass directory records commit, dirty tree, fixture digests,
contamination, every phase's wall time and exit, and the setup share. A failed
phase marks the pass aborted with its cause; nothing is retried. Ctrl-C stops the
pass at the next phase boundary, records the interrupt, writes the manifest and
releases the lock. Exit codes: 0 clean, 1 aborted, 5 contaminated, 130/143
interrupted. The report-only
sweep latency rows (F3/F4/F8 on the focus Wall and F7, museum ×1 and sweep-H10)
run in every pass unless the owner drops them, and the bundle report written
after the build supplies the Stage initial-load delta.

**Chrome crash-handler watchdog.** After a heavy session (observed at grid-XL),
branded Chrome's `chrome_crashpad_handler` can outlive the browser while holding
its stderr, a socket to the Playwright worker, which then never exits after its
last test. During a pass, a watchdog stops only such orphans (re-parented to
launchd, absent at the pass start, stderr a socket, no Playwright-launched Chrome
running); the owner's own Chrome keeps its handler. Its actions are listed in the
manifest. Running a tiered spec directly, outside `perf:bench`, has no watchdog;
start one beside it with `node perf/lib/crash-handler-watchdog.mjs <log> $(pgrep -f chrome_crashpad_handler)`.
The watchdog is a file, not an inline `node -e` script, so that its own command
line can never match the Playwright-Chrome check (an inline version always did).

**Node.** The S06 setup ran on Node 26.7. Node 22.11 fails the editor's jsdom
suites (`ERR_REQUIRE_ESM` from jsdom's encoding dependency) and Node 23.7 fails
them in undici's zlib decompressor; use a current Node release for the gates and
the passes.

## Correlation (why the ledger exists)

Continuous inputs are not Event Timing. Each `pointermove` calls
`perfInput()`, which assigns a monotonic sequence; the Layout adapter's preview
installation records it, and the route marks `overlay:updated` only when the
overlay it paints actually changed. The harness pairs the input with the first
frame at or after that mark, so a delayed callback is reported as **latency**,
never as a sample that never arrived. Every input keeps a row with status
`presented`, `superseded`, `refused` or `unresolved`. The `drag-correlation`
spec reruns the same drag with every application rAF callback delayed by 500 ms
and asserts that all 60 samples still exist and the presented latency distribution
shifts beyond the baseline.

Presentation is attributed to the rendering-opportunity frame (rAF). That is an
approximation for the hard presentation gate, not the plan's trace-of-presented-
frame proof; the deviation is recorded in
[the decision record](../../../docs/reference/decisions/t3p03s02-trace-correlation-deviation-2026-10-22.md)
and must be accepted by the owner before this harness can be the final-gate
evidence for presentation.

`trace-proof.spec.ts` is a separate diagnostic rather than an untraced timing
row. A second runtime flag enables an identity grid and a marker at the actual
preview position in one SVG update. Chrome trace images must match the sequence,
geometry signature, trace mark and marker pixel; nearest timestamps never select
a match. Two User Timing anchors normalize supported capture clocks. Legacy or
unknown Screenshot clocks retain image identity with null latency and an explicit
reason. Every input keeps a row, including previews omitted by screenshot sampling.
Ordinary rAF rows start at the product's handler mark and omit pre-handler
queueing; trace rows use normalized `event.timeStamp` and retain handler time
separately. Their intervals and workloads are not interchangeable.
The mismatch and delayed-preview controls check the method separately from the
ordinary rAF delay proof. The demonstrated Chrome diagnostic also joins the exact
image source/frame IDs to one host and one nonforked `STATE_PRESENTED_ALL` reporter,
then requires an unambiguous complete span or scoped async completion. Missing or
duplicate completions, PARTIAL-only feedback and ambiguous hosts/reporters refuse
presentation time. The raw identities and span endpoints remain in the artifact.

The trace diagnostic retains five conditions: untraced, ordinary trace, global
500 ms rAF delay, a causal frame gate, and a real zero-hold negative. Global delay
also throttles unrelated rendering; independent cold-run maxima can reverse and
are retained as observations. The causal gate arms after setup/tracing, captures
pending callbacks, drives 60 real inputs, then observes at least 500 ms after the
final install before explicit trace-confirmed release. Any overlay, matching image
or matching feedback before release refuses the proof. The zero-hold case still
requires a matching final image/ALL completion but must fail the 500 ms oracle;
incidental slowness cannot substitute for an observed hold. Pure controls also
cover early/missing release, bypass and callback cancellation/disposal.

Runtime health observes contexts returned by the application's existing Canvas
calls; it does not create another context. Renderer/context-loss information and
long trace events disclose software-rendering/load differences. Local validation
observed Chromium SwiftShader and branded Chrome M2 Metal, so these browser rows
do not imply equivalent GPU execution or an owner-operated reference pass.

Tracing and the added visual identity perturb this workload. Decoding runs after
recording. Screenshot-event latency ends at the modern event observed after bitmap
acquisition and may include consumer/delivery delay; it does not name the exact
capture instant. Separate trace-reported presentation latency uses the exact
compositor feedback completion. It identifies the earliest captured matching frame
with supported feedback; sampling cannot prove that no earlier uncaptured frame
existed. Estimated display metadata does not establish physical display
presentation, and physical scanout time remains null. Raw traces, decoded images and correlation rows
stay outside Git under `PERF_RESULTS_DIR`. Normal measurement flags do not enable
the diagnostic UI, and disabled helpers do not inspect marker geometry.

**First interactive frame is not measured.** The contract's F1/F2
"first interactive frame" means the first architectural frame after which a
pointer event is handled within 50 ms. This harness records the first
architectural rAF frame after the activation/admission mark. Reports must call
that row **first architectural frame (rAF proxy)** and must not present it as
the contract's first-interactive row. Per-operation completion is reported
separately; page INP is **not computed** in this pass (the ledger buffers Event
Timing entries at a 16 ms threshold, but no row reduces them), and it is listed
as unrun in the acceptance inventory. With ten milestone samples p95/p99 are
coarse and the report says so.

## Environment

| Variable | Meaning |
| --- | --- |
| `PERF_BASE_URL` | reuse an already-running preview instead of building one |
| `PERF_PORT` | preview port (default `4173`) |
| `PERF_RUNS` | measured runs per flow × workload × cache state (default 10) |
| `PERF_WARMUP` | discarded warm-up runs (default 1) |
| `PERF_SAMPLES` | pointer samples per continuous drag (default 60) |
| `PERF_TIERS` | comma list of workloads for the tiered flows (default: the bench tiers, peak first; the order never changes) |
| `PERF_SMOKE` | `1` = smoke check: one run, no warm-up, one sample, rows labelled “smoke, not evidence” |
| `PERF_DRAG_SAMPLES` | in-session F3/F4 samples per run at the loaded peak (default 5) |
| `PERF_WORKLOAD_DIR` | workload cache (default `perf/.workloads`, git-ignored) |
| `PERF_PROJECT` / `--project` | Playwright project for `perf:bench` (default `chrome`, the gating browser) |
| `PERF_COOLDOWN_SECONDS` | recorded cool-down before the M and S tiers (default 180; 0 in smoke) |
| `PERF_LOAD_THRESHOLD` (+ `_REASON`) | contamination threshold on the 1-minute load average (default 4.0; a change needs a recorded reason) |
| `PERF_SWEEP_LATENCY=0` / `--no-sweep-latency` | drop the report-only sweep latency rows (F3/F4/F8 on the focus Wall and F7, at museum ×1 and sweep-H10) for one pass; they run by default |
| `PERF_NETWORK` | `N0`, `N1` (default) or `N2` |
| `PERF_RESULTS_DIR` | raw result directory (default `$TMPDIR/biskiq-perf-results`) |
| `PERF_POWER_STATE` | declared power state, recorded with each result |
| `PERF_REFERENCE_CALIBRATION_MS` | the reference machine's owner-run calibration median |
| `PERF_API_ORIGIN` / `E2E_TEST_AUTH_SECRET` | local API stack for F9 (never production) |
| `PUBLIC_API_ORIGIN` | set on the preview server to the same loopback API origin as `PERF_API_ORIGIN`; the shipped UI reads the dynamic public environment |

N1 configures 40 ms latency, 20 Mbit/s download and 5 Mbit/s upload. CDP throughput
arguments use bytes/s (2,500,000 / 625,000). N2 configures 150 ms, 1.6 Mbit/s down
and 750 kbit/s up; N0 applies no throttling.

A reduced pass (`PERF_RUNS<10` or `PERF_SAMPLES<60`) is labelled a pre-flight
pass in every row and is never acceptance evidence.

Every flow row runs **cold, warm and repeat-use**. Cold creates a fresh browser
context for every measured run (the contract's definition); warm and repeat-use
reuse one context and never clear. For the navigation and drag flows, repeat-use
is ten cycles in that context, one measured cycle per run, closing back to the
hub before the next open (F1's next run begins at the hub; the others close
explicitly). These F1/F2/F3/F4/F7/F8/F9 helpers use full document navigation:
their repeat-use rows measure cache reuse and do not establish persistent-app
lifecycle cleanup. F13's repeat-use row is the contract's ten measured-cycle state in a single run
after one discarded warm-up; its cold row starts in one fresh context and clears
cache/cookies before each open, but already-loaded modules remain resident and the
renderer's V8 code cache is not reset inside the run. Only the first entry is cold;
this is a cache-cleared lifecycle series, not ten independent cold loads.
F13 records entry heap before the warm-up separately from the measured baseline
after it, so first Stage/module load is visible but does not inflate measured
repeat-use growth. The warm row measures one cycle after its discarded cycle has
warmed the Stage, so it is not a disguised cold load. Across cold, warm, and
repeat-use, the run accepts 460 edits including both discarded cycles. The
delayed-preview proof remains a warm-only diagnostic, not a flow row.

F13 opens with the real **New Project** button and closes with browser Back,
accepting the shipped discard confirmation when present. A window sentinel and
`performance.timeOrigin` must survive every cycle. Harness observation buffers
and User Timing marks are released before GC; application/module state is kept.
`flows/lifecycle-regression.spec.ts` separately injects retained JS arrays, checks
that they accumulate and increase post-GC heap, then proves a full navigation
clears them. That diagnostic is not a product leak measurement. Earlier F13
numbers from document-reloading cycles are withdrawn as lifecycle evidence.

The same regression file also observes real Stage/canvas nodes through `WeakRef`
over a warm cycle and six further cycles of ten accepted edits. Closed project
nodes must collect, documents/listeners must stay bounded, and precision edits must
emit no Svelte `derived_inert` warnings. Native DOM totals remain visible in the
samples, with a coarse guard against whole-project accumulation; this does not
assert zero aggregate native-node drift. Exact head-child/Text counts separately
detect the previously abandoned Svelte head anchor. This ownership proof is separate from F13's
twenty-edit baseline workload. Source upload still opens the shipped chooser,
assigns a bounded JSON `File` through its public element handle, and dispatches
input/change before disposing that handle in `finally`. It avoids Playwright
1.63's extra retained handle in `setInputFiles` and creates no temporary fixture files.

`renderer-lifetime.spec.ts` separately compiles the production renderer owner with
Three into an isolated browser correctness fixture. It keeps one Canvas alive
while six secondary Canvases open/render/close. Retired Canvas, renderer and scene
objects must collect; the survivor must render identical pixels with unchanged
target, cube face, mip level, viewport and scissor state. Default framebuffer,
render-target defaults, explicit overrides at DPR 2 and cube mip rendering are
covered. Texture counts demonstrate one small shared-LUT reupload per teardown;
draw timings are observations only. The ordinary steady render path has no wrapper
after lookup discovery. These fixture results are not product budget evidence.

`head-lifetime.spec.ts` checks the released Svelte head-anchor repair while keeping
the original route metadata architecture. It tests title/robots ownership during
SSR, hydration and repeated publication/editor/hub navigation. After warming, head
children/Text and connected node counts must remain exact; native DOM totals may
fall through later browser collection but cannot grow in the empty-project control.
The dynamic publication-title case uses intercepted read-only responses and needs
a nonempty loopback `PUBLIC_API_ORIGIN` on the preview server; the full local F9
stack supplies it. No real publication or owner credentials are required.

F7 paces its 60-step orbit to a 10 s wall-clock deadline. On a 60 Hz presented
clock that is the contract's ≥600 frames. If the browser presents below 60 Hz,
the same orbit continues past 10 s until it reaches 600 frames and the row
reports the actual duration, so a 30 Hz environment is visible rather than
hidden behind a "10 s" label.

## Results and budgets

Raw results are written outside Git; only the slice's acceptance record
summarizes machine, browser, power, cache, network, workload, commit and
limitations. **Hard rows — including this slice's baseline and calibration
medians — are run and accepted only on the designated reference machine, the
owner's MacBook Air M2 with 16 GB, operated by the owner** (batch E, E6
amendment). A run on another machine is pre-flight unless it is calibrated
against that machine's calibration median; with no matching rate the report says
there is no calibrated equivalence and extrapolates nothing.

Browser row labels use the context's user agent. Playwright's Desktop Chrome
profile can override that value, so it does not establish the actual browser
binary version. Record the binary/channel version separately. Renderer health
from a separate trace diagnostic also does not establish the rendering path of
every flow row; software and native GPU timing must not be treated as equivalent.

## Bundle report

`perf:bundle` reproduces the convergence packet's per-route load sets on the
current tree and can refuse an injected load-set entry:

```sh
BUNDLE_PROVENANCE=1 npx vite build --sourcemap
node perf/bundle-report.mjs \
  --provenance .svelte-kit/output/client/bundle-provenance.json \
  --forbid '/p/[publicationId]=src/lib/authoring/' --json /tmp/bundle.json
npm run build  # restore the ordinary production output
```

`--forbid` checks emitted filenames and source-module identities. It requires
usable maps for every route JS file, or an explicitly selected Rollup provenance
sidecar from the same trusted build. Current SvelteKit emits empty maps for its
environment shim and start facade, so `--sourcemap` alone cannot establish this
build's module absence. The optional build hook records actual Rollup chunk and
facade identities, verifies them against the module graph, and hashes final JS
bytes. Ordinary builds emit no sidecar and run no measurement/browser workflow.

`--provenance` validates schema, integrity digest, the complete client JS inventory
and every file hash; missing, malformed, partial, edited or stale selected evidence
fails closed. Every first-load JS file must have module identities; emitted assets
cannot stand in for those identities. The sidecar is local build evidence, not a
signed attestation against a producer able to replace and reseal all artifacts.

JSON distinguishes `moduleEvidence.kind`, `moduleAttributed` and map-based byte
`attributed`. Rollup identities do not fill missing source-map byte attribution.
Ordinary output remains suitable for total byte reports but cannot prove source
absence without evidence. `--forbid-file` checks only emitted filenames and works
without maps; use the actual chunk name for that narrower check. Forbidden hits or
unavailable module evidence exit 1. Verify the assertion mechanisms with
`node --test apps/editor/perf/bundle-report.test.mjs` from the repository root.

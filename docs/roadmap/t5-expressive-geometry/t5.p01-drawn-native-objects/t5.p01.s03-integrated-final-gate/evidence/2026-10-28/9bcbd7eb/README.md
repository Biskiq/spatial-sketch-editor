# T5.P01.S03 — integrated final-gate evidence at `9bcbd7eb`

Captured on 2026-10-28 from the clean product/test tree frozen as
`9bcbd7ebe4142d59d2b82d6ef428e7ffdcbfde4c`. The only later changes in this slice are
documentation and this evidence bundle. This bundle records gate evidence; it does not itself
record owner acceptance or close T5.P01.

## Revision and environment

```text
tested revision   9bcbd7ebe4142d59d2b82d6ef428e7ffdcbfde4c
trusted base      c13a949d (PR #216 merge on main)
Node              v26.7.0
machine           Mac14,2 · Apple M2 · 16 GB · macOS 15.8.2
browser           Playwright Chromium 153.0.8010.12
viewport          1440x900
reduced motion    false for journeys 1–2; true for journey 3
preview           http://127.0.0.1:4173 (build identity matched the runner revision)
API               http://127.0.0.1:8794 (real PostgreSQL)
```

The browser runner and preview both identified `9bcbd7eb…`; the browser evidence JSON repeats the
revision, viewport and reduced-motion state on every row. Machine facts are in
`browser/t1-s04-machine-facts.json`.

## Repository contract

| Check | Result |
| --- | --- |
| `npm test` / `test:full` | 232 files / 2,938 tests passed, exit 0 |
| `test:fast` | 198 files / 2,612 tests passed, exit 0 |
| `test:heavy` | 11 files / 138 tests passed, exit 0 |
| `test:arch` (unconditional) | 23 files / 188 tests passed, exit 0 |
| `npm run check` | svelte-check 0 errors / 0 warnings, exit 0 |
| `check:geometry-core` | clean, exit 0 |
| `check:layout-core` | clean, exit 0 |
| `check:project-model` | clean, exit 0 |
| `check:camera-core` | clean, exit 0 |
| `check:api` | clean, exit 0 |
| `test:api` (DB-backed) | 6 passed / 0 failed / **0 skipped**, exit 0 |
| `npm run build` (editor) | succeeded, exit 0 |
| `npm run build:api` | succeeded, exit 0 |

The full suite ran on the product tree frozen into `9bcbd7eb` before the perf-only harness was
added; the harness lives under `apps/editor/perf` and is outside the Vitest lanes. Root `check`,
package checks and both builds were run against the frozen harness tree. No product or test-lane
file changed after those rows. Raw logs are in `logs/`.

The unconditional suite includes the cold-release refusal proof
(`visitor-cold-runtime.test.ts`: “refuses a native form in a cold release” and “refuses to compose
a release that carries a native form”), the format-3 refusal and malformed-form validation, and
the native-form renderer/Plan-footprint suites.

## Browser acceptance

Three Chromium journeys / **27 scenario rows passed, 0 failed**. Every row records the tested
revision, `1440x900` viewport and reduced-motion state.

| Journey | Rows | Coverage |
| --- | ---: | --- |
| Integrated creator journey from an empty project | 19 | Room close + Undo/Redo; floor rectangle, floor triangle and upright-sheet elevation form; Move, Turn, Size per axis, Duplicate and Delete with exact Undo/Redo; no-op, self-crossing, depth-cancel and depth-range refusals add no history; Save to My Objects; Experience/Capture; Save and cold reopen with identical entities and golden digests; Plan/3D geometry equality and Plan picking; Preview geometry equality with unchanged source; Scene format 3 and malformed-form refusal |
| Two-project My Objects lifecycle | 7 | Project B starter; insert editable copy with exact item source and no item reference; insertion history; two independent copies; copy refinement does not mutate the item or project A; Save/cold reopen B; delete project A while item and B copies survive; remove item while B copies stay editable and B still saves |
| Starter journey | 1 | Draw/create from the starter with reduced motion, Save/reload, identical form digest |

The three creator objects required by the owner walkthrough are all present: a floor rectangle, a
floor triangle and an upright elevation form. The rectangle is the form saved to My Objects and
reused in the second project. Wall-face drawing remains deferred to T1's face-frame query; the
approved hand-aligned upright sheet is exercised.

Evidence:

- [Browser JSON](./browser/t5-p01-s03-integrated-evidence.json)
- [Machine facts](./browser/t1-s04-machine-facts.json)
- [Final browser log](./logs/s03-final-browser.log)
- [Archived screenshots — 18 files / 2,579,018 bytes](../../../../../../../archive/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s03-integrated-final-gate/evidence/2026-10-28/9bcbd7eb/CLOSED.md)
- [Integration harness](../../../../../../../../apps/editor/perf/flows/t5-p01-s03-integrated-final-gate.spec.ts)

## V8 / non-V8 digest parity

The golden corpus was executed in V8 and in two non-V8 engines at the same revision and clean tree.
All three produce one identical pin over the 48 valid forms; all 48 pinned digests match and all
27 invalid profiles return the same typed refusals.

```text
V8            Node v26.7.0        pin 9679388d3437d929db09ac0de1267bd920a89a707f582bfd53386e4a1cd892e3
JavaScriptCore WebKit 26.6         pin 9679388d3437d929db09ac0de1267bd920a89a707f582bfd53386e4a1cd892e3
SpiderMonkey  Firefox 155.0        pin 9679388d3437d929db09ac0de1267bd920a89a707f582bfd53386e4a1cd892e3
```

- [Digest parity JSON](./digest-parity.json)
- [Parity runner](../../../../../../../../apps/editor/perf/digest-parity.mjs)

## Authorized spot check

One `npm run perf:spot` was run at `9bcbd7eb` as the final-gate checkpoint. Provenance was
`verified` (runner and preview revision matched, runner clean). It measured one session per tier
and did not hit the wall-time cap; raw start, acceptance, render and presentation clocks are in the
JSON.

| Tier | Label | Open (editor / presented) | Drag presented | Pan editor | Commit editor / presented |
| --- | --- | ---: | ---: | ---: | ---: |
| M (`grid-7`) | `not-usable` | 584.4 / 976.2 ms | 48.1–56.6 ms | 439.9–598.8 ms | 8.0 / 104.6 ms |
| L (`grid-14`) | `not-usable` | 5,213.1 / 5,573.4 ms | 158.8–310.2 ms | 1,067.4–1,176.2 ms | 28.2 / 415.9 ms |

The M drag presentation series is 3–3.4 display periods at the measured 16.7 ms idle-rAF period;
the L drag series exceeds the half-rate allowance, and the L typed commit exceeds its 200 ms
completion allowance. **These labels are not a performance pass.** The run began at load average
9.10 on an 8-core M2, and the harness explicitly treats load average as context rather than
attribution; it cannot assign these costs to the editor or to GC/other processes. No second session
was run: the decision rule permits one only for a threshold-margin result, and this result is past
threshold. The comprehensive matrix remains suspended, so every unmeasured row remains unmeasured.

- [Raw spot JSON](./perf/spot-9bcbd7eb.json)
- [Spot log](./logs/s03-final-spot.log)

## Harness changes and defects

The gate exposed no product defect. Corrections made while building the integration harness were
confined to the harness and Playwright flow list; they were committed as `9bcbd7eb` and re-run from
a clean tree. The final harness uses the shipped UI and real API/database; it does not read or write
product source directly except through the product's import/download and library routes.

## File integrity

`SHA256SUMS` covers every live raw artifact in this folder except this README and the manifest
itself. The archived screenshot copies and their hashes are listed in the archive `CLOSED.md`.

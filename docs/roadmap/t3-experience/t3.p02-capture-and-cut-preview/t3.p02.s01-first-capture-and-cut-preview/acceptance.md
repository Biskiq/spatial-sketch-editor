# T3.P02.S01 — acceptance record: First capture and Cut Preview

**Slice:** T3.P02.S01 · **Status:** implemented on `t3/p02-s01-capture-cut-preview` from base
`55683981`; **awaiting independent review — no acceptance recorded** · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the scope and criteria) ·
**Phase:** [T3.P02](../README.md) · **Register:** [phase slice register](../README.md#slice-register)

This record claims implementation and recorded verification only. It claims no acceptance, no
merge, no gate state, no capability entry and no shipped revision. The independent reviewer
decides acceptance; routine `slice-closeout` owns the later status edits. The phase's deferred
exhaustive proof (two Experiences over one world, the full editorial matrix, DOM reach with gap
explanation and the complete repository gate) routes to
[`T3.P02.S02`](../t3.p02.s02-integrated-final-gate/acceptance.md).

## Settled implementation-review decisions

The plan defers the [format draft](./experience-format-draft.md)'s two open points to this
implementation review; both are settled there, in its **Implementation-review decisions** section:

1. **Text bound: 4,000 Unicode code points, Presentation-only.** `body` is measured in code
   points so the authoring surface and the reader count the same text; a longer body refuses as a
   structural issue rather than being truncated. No Stop-local text exists: a Stop is an
   occurrence of a Presentation, and distinct copy is a second Presentation over the same View.
2. **`entryViewId` alone carries a Stop's entry role.** Hold, continuation target and Cut/Travel
   already differ per Stop; a second per-Stop field would duplicate one of them. A role that needs
   different text or subject is a different Presentation, per decision 1.

## Delivered

- **Experience format 2** (`packages/project-model/src/units/types.ts`, `validate.ts`,
  `canonical.ts`): Presentation `viewIds`/`defaultViewId`/F.1 `subject`/closed `plain` text,
  Stop-local `entryViewId`, and a `cut`/`travel` selector on the continuation edge. Format 1 is
  refused; nothing migrates. Readers reject unknown keys and unresolved View references stay
  authored with diagnostics.
- **One lowering and interpreter** (`units/experience/lowering.ts`, `interpreter.ts`,
  `companion.ts`): lowering derives the invocation for every authored edge (Guide adjacency,
  explicit continuation, detour) from the real Camera connections and refuses a Travel with no
  route rather than cutting; it emits every enterable Presentation, reports unenterable ones with
  a reason, and returns the per-edge transition table. The interpreter gains the Presentation
  entry event, starts a run at that Default View with no Stop, and keeps every event guarded by
  run identity, epoch and source content.
- **`ExecutionProgram@2`** (`src/program/types.ts`, `validate.ts`): Presentation
  `viewIds`/`defaultViewId`/content, and a Stop occurrence's own `viewId`; the codec refuses the
  previous version.
- **Experience planners** (`units/planning.ts`): `experience-create`, `experience-capture-bind`,
  `experience-stop-create`, `experience-guide-order`, `experience-presentation-update`,
  `experience-stop-update` — each one admitted domain, one candidate source, one undo payload,
  with `guide-order` the only order writer. The camera View update planner is unchanged in
  behavior.
- **Editor surface** (`apps/editor/src/lib/authoring/experience/`): the Experience lens surface
  (Presentations with Views/Default/subject/text/Used-in, Guide Stop list with insert, reorder by
  stable id and Cut/Travel + gap hint), the one focus owner, the command builders, and the Preview
  entry rule over the shared lowering. The domain adapter registers the planners and contributes
  the Experience task/Find entry through AM-5.
- **Head Preview and takeover** (owned integration patch): the Head's Preview control now enters
  the shell draft's rule — selected Stop of an open Guide, otherwise that Guide's entry Stop, a
  selected Presentation alone, the Experience's entry Guide, or the visitor list — and mounts the
  visitor surface as a lazy chunk over the unmounted Stage. Exit (button or Escape) returns to the
  same lens with focus, selection and history intact; a source change closes a stale run.
  `createStageAdapterServices` is the only host-seam addition, so the lens and the adapter edit
  through the same Stage and F4 boundary; `EditorHead` gained the already-declared
  `canPreview`/`onPreview` props.

## Recorded verification

Tested tree: the working tree of this branch at base `55683981`; the implementation commit is the
one carrying this record. Commands ran from the repository root unless stated.

```text
type checks        npm run check:project-model   pass
                   npm run check                 pass — svelte-check 0 errors, 0 warnings
                   npm run check:api             pass
fast lane          npm run test:fast             143 files / 1957 tests pass
arch lane          npm run test:arch             21 files / 172 tests pass
heavy lane         npm run test:heavy            8 files / 118 tests pass
bundle             npm run build                  pass (SvelteKit + adapter-vercel)
```

Focused contracts for the changed behavior:

```text
tests/lib/experience/experience-authoring.test.ts      10 tests (new: capture/bind/order/text bound + Preview entry rule)
tests/lib/experience/experience-runtime.test.ts        44 tests (format-2 lowering, interpreter, companion)
tests/lib/authoring/unit-acceptance-conformance.test.ts 25 tests (F.4 one-install/one-history, refusal, undo)
tests/lib/visitor/visitor-runtime-state.test.ts         8 tests (Presentation entry, holds, run identity)
tests/lib/visitor/visitor-camera-director.test.ts       7 tests (program-2 handoff)
```

The format cutover's fixture updates were exercised through the lanes above, not through `-t`
narrowing: every touched file ran whole, and the arch lane ran whole.

### Lazy Preview delivery (machine-independent row)

Built client output from this tree: the visitor surface is chunk `TTDk855n.js`, **29,329 bytes**
raw / **9,862 bytes** gzip, loaded by a dynamic import of `TTDk855n.js` from the spatial route
chunk `7.DPSOR44o.js` (445,398 bytes). The preview chunk contains none of the authoring
identifiers checked (`StageInstrumentHost`, `EditorCard`, `host-acceptance`, `stage-facade`,
`ExperienceSurface`, `captureBindIntent`), so the Stage first-load set carries no visitor
machinery and a repeat entry reuses the loaded component. Hashes and sizes change with any
rebuild; this row records the build of the tested tree.

### Real-route browser observation

Dev server `vite` on loopback `:5217` (no API origin in this session), route
`/project/local-demo/spatial?create=1`, starter **Enclosed room** (locally minted baseline
`project:local-demo`; no cloud revision exists for it).

| State | Observed |
| --- | --- |
| Starter mounted, World lens | Head Preview disabled with the reason *Create an Experience in the Experience lens to Preview it*; Experience task visible in the Index |
| Experience lens, empty | Surface mounted with the explicit empty state and *Create Experience*; *Enter Preview* disabled |
| Create Experience | one accepted result, Undo enabled, *Accepted.* |
| Capture View | one accepted result: Presentation 1 with 1 View, Default set, subject *Environment / region*, no Stop |
| Head Preview | takeover mounted (`.preview-takeover`), Stage unmounted, visitor pill *VISITOR PREVIEW · Viewing Current Draft*, presentation list, Exit control |
| Escape | takeover gone, Stage back, Experience lens retained, Undo still enabled |
| Undo → Redo after exit | capture removed, then restored as one history step |
| 760 × 900 viewport, reduced motion **on** | takeover mounted (408 CSS px wide in this layout), canvas rendered, pill and Exit present, no console errors (only Vite connection debug lines) |

The first journey above ran at the Browser panel's default viewport with reduced motion **off**;
the narrow check ran at 760 × 900 with reduced motion **on**.

## Not verified here, and why

- **Guide path in the browser.** The starter source has no Guide and this slice adds no
  Guide-creation action (no such plan item), so the open-Guide/selected-Stop and entry-Stop
  branches of the Preview entry rule are proven by unit tests
  (`experience-authoring.test.ts` → *Preview entry rule*), not by a route journey. A real-route
  Guide journey needs an authored Guide and belongs to `T3.P02.S02`'s integrated gate.
- **Save/conflict/reload with the API lane.** The slice does not change the Save path: it reuses
  T3.P01.S02's conditional Save unchanged, and this session has no cloud client or
  `DATABASE_URL`, so `npm run test:api` was not run. The implementation-PR merge gate still owes
  `check:api` (run, pass) and `test:api` with zero skips (not run) as the plan records.
- **F10 performance rows.** Owner-run on the MacBook Air M2 with 16 GB (batch E, E6 amendment):
  first/repeated Preview entry and return timing, repeated enter/exit memory behavior, and any
  frame-time or disclosure row remain **owner-run**, not filled in here. The lazy-chunk delivery
  row above needs no designated machine and is recorded.

## Environment notes / flakes

- `tests/lib/layout/p23b8-d5-identity-falsifier.test.ts` and
  `tests/lib/layout/p23b11-correspondence-reference.test.ts` each contain a case near the 5 s
  default timeout; under full-lane parallel load they timed out twice, and both files passed when
  run alone (4.95 s and 2.89 s for the slow cases). Neither file is touched by this slice.
- `tests/docs/documentation-references.test.ts` timed out once under load and passed on rerun and
  with a longer timeout; the documentation tree resolves.

## Boundary with T3.P03.S02

No file owned by the parallel measurement slice and no shared measurement harness file was
edited. The visitor files changed here are the Preview surface this slice owns/extends
(`VisitorPreviewSurface.svelte`'s Presentation-entry prop, `visitor-runtime-state.svelte.ts`'s
use of the interpreter's Presentation entry) and its tests. `docs/reference/components/performance.md`,
the measurement workflow and its harness are untouched.

## Residuals

```text
integration     exhaustive integrated result routes to T3.P02.S02 (two Experiences, full editorial matrix,
                DOM reach with gap explanation, complete repository gate)
review          independent review of this branch decides acceptance; no merge performed
api lane        DB-backed test:api not run in this session (no DATABASE_URL / cloud client); Save path unchanged
owner-run       F10 performance rows on the MacBook Air M2 (E6); Preview delivery row recorded above
experience-ui   no Guide-creation action in this slice, so a route-level Guide journey needs an authored Guide
```

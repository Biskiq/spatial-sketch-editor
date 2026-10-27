# T1.P02.S02 — T3 implementation review: shared Head/F4 and contribution compatibility

```text
AUTHORITY: NONE — this records T3's implementation review verdict on one diff. The phase README
           owns slice status; the acceptance artifact owns acceptance; the release list and the
           next-wave authorization own the release. This artifact accepts no slice, closes no
           phase and authorizes no merge.
STATUS:    reviewer verdict — ACCEPTED for the shared Head/F4 diff at implementation revision
           `bf9007ff`, with the owner-run obligations named below still outside this verdict.
SCOPE:     branch `t1-p02-s02-draw-close-divide-delete`, diff `9e0fcb50..bf9007ff`, against the
           registration conditions in [plan-review.md](./plan-review.md) §5 and the standing
           review obligation in [review-handoff.md](./review-handoff.md).
```

## 1. What T3 reviewed

The review covered the files the plan's condition 1 names, not the whole slice:

| Seam | Files | What was checked |
| --- | --- | --- |
| Contribution contract and defaults | `stage-facade.ts`, `stage-contributions.ts` | `home`, `pressWhenNoTask`, `keyIntent`, `cardWriter`, `cardActions` are additive with defaults; a binding that declares none behaves exactly as before; dock entries have one arm route and are not duplicated in the Index. |
| Card writers and actions | `stage-facade.ts` (`cardWriter`/`cardActions`), `EditorCard.svelte`, `LayoutCardFields.svelte`, `drawing-planners.ts` | one deterministic writer per subject; actions are adapter-owned, destructive actions disclose before running; the Card holds no domain intent; a confirmation is bound to one action of one subject and one disclosure. |
| Keyboard and Find arbitration | `stage-input.ts`, `EditorHead.svelte`, route `handleKey`, `LayoutInkPalette.svelte` | the viewing map is unchanged; `Enter`/`Backspace`/`Delete` stay with a focused control; the Head's Find is bounded, additive and does not claim the scope Index; Escape unwinds palette-first before task and selection. |
| Proposal leases and lifecycle release | `stage-session.ts`, `host-acceptance.ts`, `layout.adapter.ts` | one lease per live chain; release on accept/refuse/cancel, install, replacement and teardown; navigation leases do not block history; the returned reason survives until release. |
| Live-proposal admission | `host-acceptance.ts`, `stage-session.ts` | Undo/Redo reports and commands agree while any authored lease is live; an accepted install settles every proposal made against the previous source; no hidden lease blocks history. |
| Operation capture, scope and correspondence | `drawing-planners.ts`, `chain.ts`, `layout-wall-chain-policy.ts` | one capture per operation reused by preview and commit; explicit working level; canonical planner and one registry; created/retired correspondence; no second compiler or identity allocator. |
| Existing consumers | `scene.adapter.ts`, `experience.adapter.ts`, `layout.adapter.ts`, adapters' contribution records | T2/T3 adapters need no edit: their find entries have no `home` and remain Index entries, their tasks keep their instruments, and their pointer/keyboard hooks are unchanged. |

The F4 capture/admission wiring, Save/Preview state machines, Undo/Redo semantics and lens switching
are unchanged by the diff beyond the Stage-owned proposal lease and the host's history reason.

## 2. Findings confirmed against the code

Each finding was reproduced from the diff, repaired on the T1 branch, and pinned by a regression that
runs through the mounted route or the real facade and F4 host.

| Finding | Consequence | Repair | Regression |
| --- | --- | --- | --- |
| **T3-1 — a global command key stole a focused control's activation** | With Ink armed, `Enter` on the palette's Backtrack/Cancel button, a Find result or any Head button ran the chain's Finish instead of the control (the handler called `preventDefault` after claiming it). `Backspace`/`Delete` could likewise act on the Wall while a control was focused. | `stage-input.ts` adds `stageKeyFromControl`; the route defers `finish`/`backtrack`/`delete` to a focused button, link, summary or role-button so native activation wins. The viewing map is untouched. | `stage-input.test.ts` (control recognition and fallbacks) and `spatial-route-gesture.test.ts` (“leaves Enter to a focused palette control…”): the accept spy is not called and the chain is unchanged. |
| **T3-2 — a click stopped selecting whenever *any* task was open** | The route suppressed Stage selection on `task !== null`, not on an armed dock tool. Opening T2's Compose/Arrange/Import (or any retained task) made the Stage's own Select stop working, a cross-track regression the plan's condition 3 forbids. | The guard now requires the dock tool actually armed (`task !== null && armedTool !== null`). A task that no adapter claimed a press for leaves selection to the host. | `spatial-route-gesture.test.ts` (“keeps Stage selection while a non-dock contributed task is open”): clicking a different Wall while Place plinth is open selects it. |
| **T3-3 — invoking another operation left the dock tool armed** | `invokeContribution` did not clear `armedTool`. Opening another Index operation replaced Ink's task but kept the stale arm; when that task later closed on install, `rearmDockTool` reopened Ink — a tool the creator had already left. Project replacement also kept it. | `invokeContribution` clears the arm unless it is re-arming that same dock tool; `resetViewContext` clears it with the replaced source. | `spatial-route-gesture.test.ts` (“does not re-arm the dock tool after another operation closes”): after Place plinth closes, the session task is null. |
| **T3-4 — Wall handles painted under a foreign task** | Layout's `overlay` returned manipulation marks whenever its own task was closed, even while another adapter's task owned the pointer; the marks could not be pressed. | `overlay` returns no handles while any session task is open (Ink still gets its own overlay). | Covered by the pointer-ownership contract in `layout-wall-manipulation.test.ts` (“picks from the selection alone, and never through another task”) plus the route suite; the overlay guard is the render-side mirror of the same rule. |
| **T3-5 — the dock keyed its tools by entry id alone** | Entry ids are unique per adapter, not across adapters; two adapters contributing a dock entry with the same id would raise a duplicate key, the same class of defect the Card's action list already fixed. | `StageDock.svelte` keys by `${adapterId}:${id}`. | No current duplicate contributor exists; the key now matches the Card action and Head Find contracts. |

No finding required a new contract, a second authority, or an edit to a T2/T3 adapter. The repairs are
shell-local state and one render guard; no capture, admission, correspondence, save or history
semantic changed.

## 3. Compatibility with existing consumers

- **Additive defaults hold.** `home` defaults to the Index, `pressWhenNoTask` is off, `keyIntent`,
  `cardWriter` and `cardActions` are optional, and `navigation` defaults to authored work. The T2
  Scene and T3 Experience adapters appear unchanged in the mounted contribution surface.
- **One armed tool, one surface.** Pointer presses go to the open task's owner first; with no task,
  only bindings that declare `pressWhenNoTask` are asked, in registration order. T2's tasks are
  therefore never pre-empted, and Layout handles appear only in Select.
- **One writer per fact.** The Card's writer is selected in adapter-ID order and the Wall fields are
  the only Layout facts it writes. T2/T3 facts keep their adapter disambiguation and are not shadowed.
- **History is proposal-based, not owner-named.** T2's `scene-compose` and `scene-transform` leases
  now correctly block history while their candidate is uncommitted; the host's navigation press
  declares itself and does not.

## 4. Verification at the reviewed revision

At `bf9007ff`, from the repository root on the committed tree:

```text
npm run check               editor svelte-check: 0 errors, 0 warnings
npm run test:fast           181 files / 2,335 tests passed
npm run test:arch           22 files / 180 tests passed
npm run test:heavy          11 files / 138 tests passed
npm run test:full           214 files / 2,653 tests passed
npm run build               production build succeeded
npm run check:layout-core   tsc clean
npm run check:project-model tsc clean
npm run check:camera-core   tsc clean
npm run check:api           tsc clean
```

The focused drawing, Card, Wall-manipulation and mounted-route suites were also run directly:
`stage-input` 10, `layout-drawing-adapter` 6, `layout-wall-manipulation` 19,
`editor-card-confirmation` 4, `spatial-route-gesture` 17 — all passed.

### Integration check with T2.P02.S03 (not S03 acceptance)

A scratch branch at `origin/main` (`83c79c40`) merged this branch and then
`t2/p02-s03-integrated-final-gate` with no conflicts. On that tree:

- `npm run check`, `npm run test:arch` (22/180) and `npm run test:full` (214/2,653) passed.
- T2's repaired S03 acceptance flow passed 2/2 in Chrome against a dedicated local Postgres
  database; this is an integration smoke, not S03 acceptance evidence, and it was agent-operated.
- T2's diagnostics recorded that a pointer placement now leaves the new **model entity** selected
  (the #199 blocker), while Compose still disables Resize and Duplicate with “A model needs a
  verified contact…” and enables Delete.
- A separate cross-track smoke drew an enclosure in an empty project through Ink's typed path, then
  imported, approved and placed a model; the stored project had one Room and one entity. On the
  pre-#201 base the same leg was unreachable. This shows the structural cause is removed once #201
  lands; it does not accept T2's empty-project line or decide what that line means.
- `npm run perf:bundle` measured the Stage route at **456.0 KiB JS br**, against **447.0 KiB JS br**
  at the tested #199 base: a **+9.0 KiB br** delta from #201, under the 25 KiB per-slice growth
  allowance but still over the ≤400 KiB hard budget, which was already missed before #201.

None of these rows is slice acceptance for T1 or T2, and none substitutes for the owner-run browser
and performance obligations below.

## 5. Verdict and what remains

**Verdict: the shared Head/F4 implementation is accepted by T3 at `bf9007ff`.** No blocking T3
finding remains; the five findings above are repaired with regressions, and the existing T2/T3
consumers need no edit. The plan-review conditions are met: the Head change is additive and bounded,
it does not touch Save, Preview, history or F4 capture/admission, the Find is bounded, and no new F4
surface was introduced.

This verdict does **not** record T1.P02.S02 acceptance, does not re-arm M4, does not touch the phase
register or baton, and does not merge anything. Still owed by the owning track and the owner:

- the browser journey the handoff's known limits name (empty/starter draw/close/divide/delete in 2D
  and 3D, keyboard-only, narrow shells, reduced motion, Card precision, Find arbitration,
  replacement);
- the plan's performance acceptance at S and M on the designated M2 under S06's method, including
  the Stage first-load delta;
- the owning track's acceptance record and slice-closeout decision.

## 6. Omissions, named rather than implied

No production code outside the reviewed diff was changed for this review. No browser, GPU,
performance or owner-run row was produced as acceptance evidence. No T2/T3 adapter edit was made, and
no T2 or T3 ownership sign-off beyond the shared Head/F4 verdict is claimed.

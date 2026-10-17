# PR #137 verification evidence — 2026-10-17

**Acceptance withheld.** [Owning record](../acceptance.md) · [unresolved AM-5 requirements](../am5-reconciliation.md).

## Tested source identity

Pre-commit verification HEAD: `bdaf5721` on `T1-P01-S07`; original trusted base: `fcf1fbaa`.
The review increment was subsequently committed and pushed for PR review at the owner's request.
Its tested implementation/test/configuration files are individually hashed in
[source-manifest.json](./source-manifest.json), SHA-256
`95ee5251038526cd8d69ca1203d052e0c056f34bcb2ef891d263776104a21ae1`.
Documentation and browser screenshots are outside that source manifest.

Integration candidate: the complete PR delta applied without conflict on main
`d2607caf85e35d9ae54241b5fb72fd2f45b31cbe`, in a detached disposable validation worktree.
The validation candidate performed no branch rewrite, merge or capability acceptance. The later
review commit/push preserves the tested source manifest and does not claim acceptance.

## Check results

The final full editor, arch, app/package and API checks ran against the candidate above after a
clean `npm ci`. Separate fast/heavy totals are additional observations from the preceding increment,
not substitutes for the final full run, which contains their entire union after the narrow-shell
fix. All 20 final source-manifest files match the branch and final integrated candidate. The only
main-to-main delta during this task was PR #139's research documentation.

| Command | Observed result |
| --- | --- |
| `npm run test:arch` | 20 files / 161 tests passed, including public/visitor/preview isolation |
| `npm test` | 156 files / 2,056 tests passed, including the full heavy population |
| `npm run test:fast` (preceding increment) | 128 files / 1,777 tests passed |
| `npm run test:heavy` (preceding increment) | 8 files / 118 tests passed, dense cases retained |
| `npm run check` | 0 errors / 0 warnings |
| `npm run build` | ordinary production build passed |
| `npm run check:layout-core`, `npm run check:project-model`, `npm run check:camera-core` | all passed |
| `npm run check:api` | passed |
| `npm run test:api` | all 8 API contracts passed: 53 tests, 0 failures, **0 skips** |
| `git diff --check fcf1fbaa` (branch) and `git diff --check HEAD` (candidate) | passed |

The API run used a newly created, disposable **local Postgres** database
`biskiq_pr137_20261017` on localhost:5432, with explicit `DATABASE_URL` pointing only there.
It did not use the user's working database. It was removed after the run. An initial attempt using
shared dependency symlinks failed resolving AWS SDK before tests; `npm ci` in the isolated candidate
removed that environmental failure, and the complete zero-skip run above is the recorded result.
No package/lockfile change was made.

[Raw check summaries](./check-summaries.txt) preserve command output and API per-file totals.
The [production-exclusion scan](./production-exclusion.json) inspected 349 normal build output files
under SvelteKit and Vercel outputs: **zero matches** for the conformance writer, operation, instrument
button, replacement hook or plugin sentinels. The source is the same manifest as the browser run.

Two failing-path mutation controls ran the **whole 33-test host contract** on the earlier candidate
before the final shell-only edits:
restoring the captured original disposer failed only the current-binding lifecycle regression
(32 controls passed); committing the replacement baseline before host validation failed only the
atomicity regression (32 controls passed). Source was restored in `finally` before the green gate.
The [mutation summaries](./mutation-summaries.txt) record both expected failures.

Fresh independent full-diff review reported **no remaining actionable implementation findings** after
fixes and independently ran 8 relevant suites / 105 tests. Its code verdict is distinct from
[withheld slice acceptance](../acceptance.md#exact-acceptance-and-merge-blockers).

## Browser reproduction

From `apps/editor`, run:

```sh
npx vite --config vite.stage-conformance.config.ts --host 127.0.0.1 --port 5177 --strictPort
```

Open `/project/probe-s07/spatial?create=1` and choose **Enclosed room**. In each reading:
open **Conformance height**, observe 3 m; apply the adapter's button, reopen and observe 4 m;
Undo and reopen (3 m); Redo and reopen (4 m); use **Replace conformance starter**, confirm the real
host's replacement guard, reopen (3 m, both history buttons disabled). Replacement resets the
Camera baseline; explicitly choose the reading again before its replacement screenshot.

The test-only configuration adds both the adapter catalogue injection and the visible replacement
route hook. It is never selected by ordinary dev/build scripts. This is the approved S07 test-hook
allowance, not a new production writer or permission bypass. The probe uses retained canonical
Wall-height planning and the live F4 coordinator.

[Action transcript and DOM observations](./browser-actions.json) include all operations, settled
reading, content hash, rendered instrument, history-button availability, canvas dimensions and
browser errors. Observed baseline hash:
`sha256-4525f51d10787400dce43d04131c9af36f8a8407db69889d9089dc7cea1d2754`;
edited hash: `sha256-e5364103646a1559b0d9ee1aabee9754c7b175819a2f639ff512ea93a34d5f7b`.
Undo and replacement restore the first; Redo restores the second. The recorded run reports no
browser exceptions. Screenshots were visually inspected for the Plan and 3D edited states.

| Reading | Baseline | Edit | Undo | Redo | Replacement |
| --- | --- | --- | --- | --- | --- |
| Plan | [3 m](./plan-baseline.png) | [4 m](./plan-edit.png) | [3 m](./plan-undo.png) | [4 m](./plan-redo.png) | [3 m, empty history](./plan-replacement.png) |
| 3D | [3 m](./3d-baseline.png) | [4 m](./3d-edit.png) | [3 m](./3d-undo.png) | [4 m](./3d-redo.png) | [3 m, empty history](./3d-replacement.png) |

This is bounded conformance evidence, not production authoring, Scene selection, lens/task Resume
or capability acceptance. The owned browser and development server are released after verification.

## Additional shell-state browser evidence

The narrow sweep exposed two real layout failures: the Index body’s `display:flex` overrode its
`hidden` attribute, and the expanding Index reduced the Stage to 24 pixels at 640px. The fix restores
hidden-state display, constrains the host to its viewport and lets the Index scroll while retaining
Stage space. These changes were independently reviewed and the final editor gate/browser cycles
reran afterward.

[Shell actions and DOM observations](./shell-actions.json) record:

- 640px expanded Index: canvas **640×398**, no horizontal overflow; long canonical floor identity
  truncates with ellipsis while its full text remains in the DOM.
- The lower contributed task is reachable by scrolling (Index scrollTop **374**), while the canvas
  stays **640×398**; [scrolled task](./narrow-index-scrolled.png).
- Collapsed Index: the body is actually hidden and canvas grows to **640×639**;
  [collapsed](./narrow-index-collapsed.png).
- 390px with collapsed Index and reduced motion on: canvas **390×493**, no horizontal overflow,
  settled 3D and visible controls; [phone](./phone-3d-reduced.png).
- Reduced-motion Plan and long identity in the expanded narrow Index:
  [640px Plan](./narrow-plan-reduced.png). No browser exceptions were reported.

These bounded responsive/long-identity/reduced-motion observations supplement the desktop workflow;
Scene identity selection and inactive-lens Resume remain the explicit blockers in the owning record.

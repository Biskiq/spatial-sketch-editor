# PR #114 — Experience UX implementation: evidence

> **Historical target evidence (2026-10-13):** this record preserves #114's
> prior UX implementation and actual captures. Its final UX4–UX6 follow-up
> supersedes earlier WIP bullets. New design work starts at the unratified
> [V3 package](../../../docs/roadmap/p25-experience/design/experience-ux-v3/README.md).
> These measurements/captures are not owner visual acceptance or V3 conformance.

**Role:** the evidence record for [#114][plan], the slice at a time. Each slice appends its own
section: what changed, the real-browser readings, and the regression proofs that carry its exit gate.
This record is evidence, not authority — the plan owns the work, [PLATE §0.8.1][plate] owns the
locked design, and the [composition axis][axis] owns the executable assertions.

**Branch / head:** `prototype-v2-ux-overhaul`, started from the #113 closeout head
`48447fb4d26c4285d956d0b09c84587a93db99a8` (identical to `origin/main` at the time) with a clean
working tree. No commit is made by this record.

**Verification policy (owner-ratified 2026-10-12):** [plan §9][plan]'s lightweight policy supersedes the
earlier full-suite gate for the remainder of #114. UX0–UX3's records below were written under the earlier
policy and keep their readings as history; from **UX4** on, each slice records only the focused checks it
actually ran — the axes/Node tests covering the control it moved plus a small real-browser smoke path —
and defers broad regression or mutation sweeps to the owner. An unrun or stale check is recorded as
unrun, never as green.

---

## UX0 — harness and baseline (landed)

**Exit gate:** full baseline green (24 axes, Node suite, mutations) recorded at the #114 start head.

### What UX0 added

| Artifact | What it is |
| --- | --- |
| [`qa/experience-shell-check.sh`][axis] | the Experience shell's composition axis: 21 assertions, one browser, ~9 s, registered in `qa/run-all.sh` as `experience-shell` and inserted into the `all` run after the Experience wiring axis |
| [`qa/capture-experience-shell.sh`][capture] | the four-state capture pass (ordinary, Guide, Preview at 1440×900; ordinary and Guide at 1024×768) — the before/after pair tool, deliberately not part of `run-all.sh` |
| `data-home` on the six home elements | semantic home names: `head`, `index`, `stage`, `card` (static markup) and `deck`, `preview` (built by `experience-ui.js`) |
| `data-deck-posture` | the deck declares its own posture, so an assertion names a posture instead of the `exp-deck <depth>` class |
| [`qa/experience-ux-selector-inventory.md`][inventory] | the plan's required inventory: 357 vocabulary occurrences and 158 distinct coupled selectors across 41 checked files, each with its owning slice |
| [`screens/experience-ux-before/`](../screens/experience-ux-before/) | five before-state captures (1440×900 ordinary, Guide and Preview; 1024×768 ordinary and Guide), taken from the start-head source |
| this record | the numbers below, with the commands that produced them |

The markup additions are attributes only: no class, layout, behaviour, history or selection change.
`docs/operations/current.md`'s baton now records #114 as open with UX0 landed and UX1 next.

### The new axis is not a tautology

Three regressions were reintroduced in disposable copies, and the axis rejected each one while its
unaffected controls stayed green (the repo's own replacement-proof discipline):

| Reintroduced defect | Result |
| --- | --- |
| the Deck does not declare its home | rejected at *a Guide mounts, with one Deck naming its own posture*; 12 controls still green |
| the band is forced to 70 % of the viewport | rejected at *the band sits under the reserved share in every posture reached so far*; 20 controls still green |
| the Deck stays mounted while Preview is open | rejected at *Preview hides every authoring home and unmounts the Deck*; 20 controls still green |

### Baseline at the #114 start head

Taken from a pristine copy of the start head (`/tmp/p114-baseline`, this checkout's tree at
`48447fb4` with `screens/` and `qa/out/` excluded) so no UX0 edit could be measured:

| Proof | Result |
| --- | --- |
| `qa/run-all.sh` (the 24 pre-existing axes) | **23 of 24 axes green**; `composition-check` alone reported 3 failures of 27 |
| `qa/composition-check.sh`, re-run alone | **27 of 27 green** — the three failures were *keyboard observes the same Gate*, *genuine casing completion releases authored permission* and *new Stop visit cannot borrow prior Gate completion*, all Gate-completion reads that pass on their own run |
| `node --test prototypes/spatial-authoring/tests/*.test.mjs` | **140 / 140 pass**, exit 0 |
| `qa/mutation-check.sh` | **103 regressions rejected, 0 failures, exit 0** — run against this slice's tree, because the proof's model leg cannot run outside the checkout (see the mutations section) |

The three composition failures are recorded rather than explained away: they could not be reproduced
on an isolated re-run, and they match the harness's own documented symptom class ("an empty result is
a harness symptom; re-run the axis before reading it as a defect"), but a reader of this record should
treat the start-head composition axis as **green on isolation, red once under full-suite load** and
re-run it before drawing a conclusion.

The Node suite cannot be run from a bare copy: three test files import `app/navigation.js`, which
imports `three` from the monorepo root `node_modules`. The pristine copy is outside the repository, so
those files fail to load there (`ERR_MODULE_NOT_FOUND`) and the count collapses to 77 tests / 3 failed
files. The 140/140 reading above is taken from the real checkout, which resolves `three`.

### The working tree after UX0

| Proof | Result |
| --- | --- |
| all 25 axes (the 24 plus `experience-shell`) | **green**: journeys 59, interaction 56, flows 44, lifecycle 41, World shell 47, tasks/Precision 38, Browse 60, repair 47, lens 81, Experience 30, **experience-shell 21**, conformance 105, creator 23, composition 27, revision 38, rich 35, precision-c9 55, presenter 59, walkthrough 33, walkthrough-demo 59, visitor 42, reconciliation 13, continuity 55, responsive 15, correctness 11 — 0 failures |
| `qa/experience-shell-check.sh` alone | 21 pass, 0 fail, ~9 s, exit 0 |
| `node --test prototypes/spatial-authoring/tests/*.test.mjs` | 140 / 140 pass, exit 0 |
| `qa/mutation-check.sh` | 103 regressions rejected, 0 failures, exit 0 |

Two axes in the first full run of the working tree (`conformance`, `presenter`) failed with
off-by-one cursor, edit-count and Undo-depth reads, and both re-ran clean (`105/0`, `59/0`) with an
isolated browser session. The cause is measured, not guessed: `qa/run-all.sh` names each axis's
browser session `p26-qa-<axis>` **globally**, so a second checkout running the same axis on this
machine drives the same session, and two agents clicking one page interleave. The composition axis
UX0 added is not immune to this, so **any full-suite run on a shared machine should give the axes
unique session names** (`QA_SESSION=...`), which is what the clean runs above used.

### Recorded facts and deviations from the §6/§7 laws

- **Five Preview entries exist today** — Head `Preview`, Index `Preview Guide`, Deck `Preview Guide`,
  Stop Card `Preview Guide`, Index `Preview Experience`. UX0 asserts only that the visitor has exactly
  one visible Exit; the one-Head-`Preview ▾` consolidation is UX1's exit gate.
- **The band's worst measured share is 33.2 %**, in the deepest posture (edge → coordination) at
  1440×900, against the §6 40 % reservation. The ordinary lane is 3.8 % (34 px) and the Guide home
  22.3 % (201 px); at 1024×768 the Guide home is 26.2 %.
- **No nested scrollers and no document horizontal scroll** in any posture or at either review size,
  by the strict definition (an element the author can actually scroll: `auto`/`scroll`/`overlay` with
  overflowing content). The Overview strip does clamp `.stop-summary` to 143 px of text in a 29 px box
  with `overflow-y: hidden` — a density fact, not a scroller; UX4 retires the strip.
- **A layout change writes nothing**: opening the Guide home, the deepest posture or an invoked
  narrow sheet leaves the source digest, Undo/Redo depth, selection and realized pose identical, and
  invoking a sheet does not resize the Stage (1024×702 before and after at 1024×768).
- **Preview is the only visible home**: every authoring home is hidden, the Deck is unmounted, no
  authoring writer or nested home exists inside the visitor surface, and exiting restores the exact
  authoring context including the Deck's posture.

### Before-state captures

| File | Size | State |
| --- | --- | --- |
| [`experience-shell-1440-ordinary.png`](../screens/experience-ux-before/experience-shell-1440-ordinary.png) | 1440×900 | the ordinary Guide lane at the start head |
| [`experience-shell-1440-guide.png`](../screens/experience-ux-before/experience-shell-1440-guide.png) | 1440×900 | the Guide home (Overview strip with Expand, thumbnails) |
| [`experience-shell-1440-preview.png`](../screens/experience-ux-before/experience-shell-1440-preview.png) | 1440×900 | the visitor surface |
| [`experience-shell-1024-ordinary.png`](../screens/experience-ux-before/experience-shell-1024-ordinary.png) | 1024×768 | the narrow ordinary lane |
| [`experience-shell-1024-guide.png`](../screens/experience-ux-before/experience-shell-1024-guide.png) | 1024×768 | the narrow Guide home |

Regenerate the before side exactly as taken, from a start-head copy of the prototype:

```sh
cd /tmp/p114-baseline   # start-head tree, plus qa/capture-experience-shell.sh
QA_SESSION=ux0-before QA_OUT=<checkout>/prototypes/spatial-authoring/screens/experience-ux-before \
  bash qa/capture-experience-shell.sh
```

The same script run against this slice's tree is the after side. Per the plan §10.2 this directory is
an interim set: UX7 assembles the final bounded packet in `screens/experience-ux/` and retires it.

### Mutations

`qa/mutation-check.sh` — which chains `conformance-mutation-check.sh` and
`composition-mutation-check.sh` — reintroduces each protected historical defect in a disposable copy
and requires the assertion that protects it to reject the copy while an unaffected control stays
green:

```
qa/mutation-check.sh  →  exit 0
  103 regressions rejected
    0 top-level failures
   69 inner-axis failures, each the caught mutation rather than a run defect
```

**It must be run from the checkout, not from a bare copy.** `composition-mutation-check.sh` copies
the prototype into `$TMPDIR` and runs `node --test` there; three of the test files it names import
`app/navigation.js`, which imports `three` from the monorepo root `node_modules`. Outside the
repository those files fail to load, and the script's own guard — which insists the *named* protected
test is the one that failed — would report a false failure rather than a vacuous pass. The reading
above is therefore taken from this slice's tree, and UX0's changes are attributes only, so it covers
the start-head behaviour as well.

### Exit-gate statement

UX0's gate is met as follows: the 24 pre-existing axes are green at the start head (with the one
composition re-run recorded above), the Node suite is 140/140, the new axis is green and rejects the
three regressions it protects, and the before-state captures exist at both review sizes. Anything the
gate does **not** cover is named in §Recorded facts rather than implied: the one-Head-Preview
consolidation, the Guide/Camera Path/Journey postures and the visitor-surface audit belong to
UX1–UX7, and the missing P23B fixture remains a separate repository-gate blocker that no #114 slice
touches.

## UX1 — shared chrome and the one locator (landed)

**Exit gate (plan §5):** one Head `Preview ▾` with scopes, the duplicate Preview entries removed, the
trail/counts/fake-Saved retired from chrome, the Index restructured (`+ Present`, `Browse World`, Guide
row), locator coverage (§3.9) and the Scene list retired — **every formerly listed subject reachable by
pointer and keyboard, exactly one Preview control, World shell/return regressions green.**

### What UX1 changed

| Artifact | Change |
| --- | --- |
| `index.html` | the Head's single control is `<details id="headPreview"><summary>Preview ▾</summary><div id="previewScopes"></div></details>`; the status rail no longer carries `#trail`, and the Head no longer carries `#undoCount`, `#undoLabel` or `#docState` |
| `app/ui.js` | `previewScopes()` renders the scopes that can actually start (Presentation, Guide, world-only Experience) and hides the control when none can; `records()` now appends the Scene's own subjects, deduplicated by identity, marked `register:false` and, when logical, as having no Stage geometry; `inContext`'s register context follows the `register` flag instead of “no geometry”; the status rail draws no trail |
| `app/experience-ui.js` | Index restructured: Presentations, Guide row, retained contributions, then `+ Present`, `Present environment`, `Present region` and `Browse World`; the “Scene subjects” column and the Index/Deck/Stop-Card `Preview Guide` entries are gone |
| `app/main.js` | one shared `searchRequest` (the locator works from both lenses), the `find-world` act, and no `data-trail` dispatch |
| `app/fixtures.js` | metadata rows declare `register: true` — the register context regression this slice found and fixed (see below) |
| `app/experience.js` | the Preview menu closes behind the visit it starts, so Exit returns to a plain shell |
| `styles/app.css` | `.head-preview` is a disclosure with a scope menu; `.trail*`, `.tr-*`, `.doc-state` and `.undo-label` are deleted |
| [`qa/locator-check.sh`][locator] | the new UX1 axis: 25 assertions, one browser, registered in `qa/run-all.sh` as `locator` (order: after `experience-shell`) |
| `qa/experience-shell-check.sh` | its UX0 deferral is now asserted: one Preview control, every scope inside it, the open menu's scopes as real hit targets with no sideways scroll, and the menu closed behind the visit (24 assertions) |
| `qa/lib.sh` | `qa_click`, `qa_preview[_presentation|_guide|_experience]` and `qa_locator_open/query/row/select` — the one place every axis now reaches the Preview menu and the locator |
| [`qa/locator-mutation-check.sh`][locmut] | the successor proof this slice adds to `qa/mutation-check.sh` |

Two facts are stated rather than implied. First, `present()` and the two logical-subject presenters
(`exp-environment`, `exp-region`) are unchanged: UX1 moved the entry points, and UX2 owns the
aggregate Present. Second, the shell still lists its own `+ Present` row because presenting an identity
is explicit and the locator never presents anything by selecting.

### Readings

| Proof | Result |
| --- | --- |
| `qa/locator-check.sh` | **25 / 25 green** — one Preview control at rest in both lenses, the menu's scopes, the menu closing behind the visit, one Exit Preview, the retired Scene list, `Browse World`, 7/7 formerly listed subjects by **pointer** and 7/7 by **keyboard** (ArrowDown to the row, Enter), one row per identity, a logical subject marked “no Stage geometry · Select only”, the register never borrowing a Scene subject, selection presenting/writing nothing, the control **absent rather than inert** when nothing can start (probed against the live Experience and restored), and the World shell unchanged |
| `qa/experience-shell-check.sh` | **24 / 24 green** — its UX0 deferral (“the axis deliberately does NOT assert exactly one Preview control”) is now asserted: one control, every scope inside it, the open menu's scopes hit-reachable with no sideways scroll, and the menu closed behind the visit |
| the other 24 axes | **green**, each on its own run: journey 59, interaction 56, flows 44, policy 41, shell 47, precision 38, browse 60, repair 47, lens 82, experience 30, conformance 105, creator 23, composition 27, revision 38, rich 35, precision-c9 55, presenter 59, walkthrough 33, walkthrough-demo 59, visitor 42, reconciliation 13, continuity 55, responsive 15, correctness 11 |
| `node --test prototypes/spatial-authoring/tests/*.test.mjs` | **140 / 140 pass**, exit 0 |
| `qa/locator-mutation-check.sh` | **5 regressions rejected, 0 accepted** — see the table below |
| `qa/mutation-check.sh` (the whole chain, UX1 chained in) | **exit 0** — 49 mutation legs rejected, none accepted, run from this checkout so the model leg of `composition-mutation-check.sh` can load `three` |
| captures | `screens/experience-ux1/` — the same five states as the UX0 before-state pair, from this slice's source |

### The new axis is not a tautology

| Reintroduced defect | Rejected at | Unaffected controls |
| --- | --- | --- |
| a second Preview entry, restored in the Index | *the shell offers exactly one Preview control…* (experience-shell) | green |
| the retired “Scene subjects” column, restored | *no longer lists Scene subjects as its own Select buttons* (locator) | green |
| the locator stops listing the Scene's own subjects | *every formerly listed subject is reachable by pointer through the locator* — 0 / 7, then the keyboard row | green |
| a record without Stage geometry is no longer a register record | *the register lists records only, and no Scene subject is borrowed into it* (locator, and browse) | green |
| the one control stops being conditioned on what can start (offered while inert) | *…and with nothing that can start, the one control is absent rather than inert* (locator) | green |

### One defect this slice found and fixed

Introducing the `register` flag exposed that the metadata rows never carried one: `inContext`'s register
context was `!r.geom`, and once the Scene's logical subjects (which also have no geometry) joined the
shared list, “no geometry” stopped meaning “a record”. The flag was added to the fixture in the same
slice, and the assertion that protects it is `the register lists records only, and no Scene subject is
borrowed into it` — with the fourth mutation above proving the assertion rejects its absence.

### Recorded limits

- The keyboard proof walks the locator's own rows with ArrowDown/Enter from the real search field; it
does not claim screen-reader or assistive-device coverage, which stays a prototype-acceptance limit.
- The Preview menu is chrome, so its visual treatment (the scope menu's paper, spacing and caret) is
  reviewed by eye against PLATE §0.7, not asserted here.
- `screens/experience-ux-before/` remains UX0's before-state baseline and is deliberately **not**
  overwritten: `qa/capture-experience-shell.sh` still defaults to that directory, so a UX1 capture pass
  must name its own output path (as `screens/experience-ux1/` here does).

## UX2 — Presentation and Views (landed · functional gate verified after its review round, visual acceptance deferred to the single post-UX7 review)

**Exit gate (plan §5):** QA 3 acceptance (§7), the creator narration/capture/offer jobs still executing
through the new doors, and a first-time creator working Present → explain → capture → Preview without the
Presenter.

### What UX2 changed

| Artifact | Change |
| --- | --- |
| `app/experience.js` | aggregate `present()`/`commitPresent()`: one command writes the Presentation, its first View use as the Default and the Camera View that use reads, capturing the live framing through the same interruption the cancellation policy uses. A Plan reading asks first (`planCaptureSupport`, `acceptPlanIntent` — compose in 3D, or use the plan as a visitor View only where the visitor kernel really reproduces it, or cancel) and creates nothing before the choice. `setDefaultView` is the one Default writer (the shared-use writer, so every Stop that enters through that View is disclosed first), `removeViewUse` is the bounded local unlink whose consequences are stated as they happen, `openExplanation`/`noteExplanationDisclosure` are the one ordinary explanation door, `toggleAdvanced` is the one advanced home, `lookThroughView` is the View's explicit framing operation. The Framing Hints posture and its Stage toolbar are retired: the recommended framing is asked for in the Card that offers it, and accepted by the same `+ Capture view` that authors any View. |
| `app/experience-ui.js` | one ordinary Presentation Card (identity, Focus line, `+ Capture view`, the Views list with exactly one ★ Default, the recommended-framing tray, one `Add explanation` door, the Presentation menu carrying Rename / Advanced authoring / Remove / **Change focus…**), the View Card (rendered preview, its own operations — Set as Default, Rename, Remove from Presentation — with the consequences of a removal named before it happens, Look through, Edit Camera), and the single Advanced authoring home (intent, narration/behaviors/offers, View switching, derived suggestions). The Index keeps one creation entry (`+ Present`) and one locator door (`Browse World`); `Present environment` and `Present region` are now focus operations on the Presentation they belong to. |
| `app/experience-image.js` (new) | the derivative image pass: one small target at the Stage's own aspect, a ≤32-image session cache keyed by resolved pose + World generation + aspect, at most one draw per idle turn, nothing drawn while a command, flight, gesture, numeric draft or visit is in progress, a refusal remembered rather than retried every turn, and a failure named rather than thrown. |
| `app/stage.js` | `snapshotPose()` — the Stage's own renderer, Scene and builders, on a camera of the Stage's own, as a normal-World projection (no paper, selection, ghost, drafting aid or clipping) — with every state it touches restored in a synchronous `finally`; and `lastSnapshot`, the projection it actually drew, recorded beside the picture. |
| `app/main.js` | one image turn per frame pass, and `qa.images()` — drawn, cached, queued, worst backlog, last draw in ms, last failure and last projection — as a read-only probe. |
| `styles/app.css` | the Views list, the View Card and its preview box, the pending/unavailable placeholder, the advanced home. |
| `qa/lib.sh` | the Card-door helpers (`qa_card_door`, `qa_card_explanation`, `qa_card_menu`, `qa_card_remove`, `qa_card_advanced`): one place that opens a native disclosure the way an author does, and never toggles one shut. |
| `qa/experience-shell-check.sh` | +10 assertions (27 → 37), all of them the image pass's two laws read as numbers. |
| `qa/conformance-check.sh` | the QA-1 journey re-pointed onto the new doors (aggregate Present, the explanation door, Advanced authoring, the Views list, Remove from Presentation, Set as Default, the recommended-framing tray in the Card that offers it), plus the one-creation-entry and Change-focus readings — 134 assertions, including the review round's two-door creation readings (each door's own reading, in 3D, in Plan and with motion in flight) and the constellation's three laws. |
| `qa/capture-experience-views.sh` (new) | the QA 3 capture pass: five states at both review sizes, each paired with a reading of what was photographed (the Views list really unordered with one ★ Default, the preview a render rather than its placeholder, the same controls reachable inside the narrow sheet). |
| `qa/views-mutation-check.sh` (new) | this slice's replacement proof, chained into `qa/mutation-check.sh`; one leg can be re-run by name. |
| `qa/creator-check.sh`, `composition-check.sh`, `locator-check.sh`, `presenter-check.sh`, `precision-c9-check.sh`, `reconciliation-check.sh`, `revision-check.sh`, `rich-check.sh`, `visitor-check.sh`, `walkthrough-check.sh`, `walkthrough-demo-check.sh` | re-pointed to the controls this slice moved, in this slice — never weakened to keep an old recipe green. |
| `app/experience.js`, `app/experience-image.js`, `app/experience-scene.js`, `app/stage.js`, `app/state.js`, `app/actions.js`, `app/experience-ui.js`, `styles/app.css` | the review round after this slice's first review (below): the presented reading's own precedence, one door per creation intent, the source generation a held picture is keyed on, per-projection fog, the Index door rows' own second line, the constellation without metric claims, and the quiet rows in the Presentation Card. |
| `screens/experience-ux2/` | the five QA 3 captures, regenerated from this slice's source after the last edit. |

### Readings

| Proof | Result |
| --- | --- |
| all 26 axes (`qa/run-all.sh all`, after the review round) | **green, 0 failures: 1,177 assertions** — journeys 59, interaction 56, flows 44, policy 41, World shell 47, precision 38, browse 60, repair 47, lens 82, Experience 30, **experience-shell 42**, locator 30, **conformance 134**, creator 25, composition 27, revision 38, rich 35, precision-c9 55, presenter 59, walkthrough 33, walkthrough-demo 59, visitor 42, reconciliation 13, continuity 55, responsive 15, correctness 11 |
| `qa/capture-experience-views.sh` | **14 readings green, six captures** — the Presentation with its unordered Views list and its one ★ Default, the View's own operations with the rendered picture, the Advanced authoring home photographed as its **contents** at both sizes (expanded, its four sections read back from the captured state, its controls scrolled into the Card's view and hit-reachable there, native-Enter toggling and return), and the same states reachable inside the narrow Card sheet, with the standpoint unmoved by any selection |
| `node --test prototypes/spatial-authoring/tests/*.test.mjs` | **140 / 140 pass**, exit 0 |
| `qa/mutation-check.sh` (all five proof scripts) | **120 replacement legs, every reintroduced regression rejected, none accepted, exit 0** — including the four legs this review round adds (`plan-pose`, `view-metric`, `image-world`, `image-fog`), each one caught by the assertion that protects it with unaffected controls green |
| `qa/views-mutation-check.sh` alone | **12 regressions rejected, none accepted** |
| QA 1–6 recipes on the moved controls | re-pointed in this slice through `lib.sh`'s Card doors and the Views list; the whole set is the 26-axis row above |

### The image pass, as numbers

The audited draw is taken with live session state the pass has to put back — an audition, projected and
realized on the Stage — and the comparison is between the state the selection left and the state the pass
left behind, with the draw provably inside that window.

| Reading | Result |
| --- | --- |
| cold draw | one draw for one new pose, nothing left pending, worst backlog 1 |
| draw time | cold **40 ms**, second View **3 ms**, asserted against the §3.6 ceiling of 50 ms |
| cache | 1 entry after one pose, 2 after two, reported against the ≤32 bound |
| warm re-selection | **0 draws**: the picture is served from the session cache |
| neutrality | source digest, Undo/Redo depth, selection, audition, standpoint, realized camera and Stage rect identical; the live camera object is the same object afterwards |
| realization | the restored audition is realized on the Stage (`lid.rotation.z = 0.72`), not merely remembered in session state |
| projection | paper 0, authoring treatment off, no clipping — a normal-World reading |
| refused draw | a named reason where the picture would be (`Camera preview unavailable · …`), no image pretending to be one, the refusal remembered rather than retried, live state intact, nothing counted as drawn |

### The review round after this slice's first pass

Every finding was treated as a hypothesis and investigated against the running page before anything was
changed. Two of the nine were answered by the investigation itself — one of them withdrawn — and the rest
are fixed, each with the reading that now holds it. Nothing was re-pointed or loosened to make a finding go
away; where a recipe did move it was because a control genuinely moved, and the assertion was strengthened
at the same time, never weakened.

| Finding (review of head `74de163`) | Verdict | Fix, and the reading that holds it |
| --- | --- | --- |
| **P1 ·** `commitPresent()` preferred `derived?.pose` over the pose it was given, so *Use the plan as the visitor View* could save recommended 3D framing | **confirmed · fixed** | The derivation is now only asked for when no reading was supplied (`recommended && !pose`), and the authored order is `pose || derived?.pose || live`. Both doors keep a law of their own: `Present this` authors Camera's recommended framing for the subject's extent, asserted against `deriveFraming().pose` read back from the authored Camera View; `+ Present` captures the **live composition**, asserted against `nav.plainPose()` in 3D, from a Plan reading, and with motion in flight (where the sampled pose is authored and the move stops rather than being hurried to its destination); and *Use the plan as the visitor View* authors the plan reading (`flat = 1`) **and not** the recommended framing of the same subject. |
| **P1 ·** `worldSignature()` memoized by museum object identity and Scene revision, so an in-place World edit could leave a cached picture stale | **confirmed mechanism · fixed** | The World writers do mutate the museum in place (`applyWallTop` writes `w.top`, `applyArtPlacement` writes `a.wall`), so object identity cannot be a source generation. Invalidation was moved onto the authority that already exists — `S.sourceEpoch`, advanced where the source's history settles (`commitEdit()` for an accepted write, `restoreQuiet()` for cancel, Undo, Redo and reset) — and folded into `worldSignature()` beside the Scene's revision. No parallel state system: the epoch is session bookkeeping, never authored, never in Undo. Held by a real write through the same writer the wall-top control calls (`…an accepted World write moves the generation every held picture is keyed on…`) and by the picture itself (`…the View whose World changed is drawn again from the new World, never served the old picture` — 2 re-drawn, `src` not the stale one, nothing left queued); the `image-world` leg reintroduces the identity-only key and is rejected. |
| **P2 ·** the thumbnail's fog read the live Camera's `this.dist` | **confirmed · fixed** | Each picture is fogged at `lastSnapshot.dist` — the eye distance of the projection it actually drew. The reading is non-vacuous by construction: `…fogged at its own eye distance, not at the standpoint the author is standing at` answers `true` for the picture's own distance and `false` for the live standpoint, and that state really does have the two distances differ; the `image-fog` leg restores the live-camera read and is rejected. |
| **P2 ·** a suspected permanent fog leak through `applyCamera()` | **withdrawn** | `snapshotPose()` restores through `applyCamera()`, and the neutrality reading (source digest, Undo/Redo depth, selection, audition, standpoint, realized camera, Stage rect, and the *same* camera object afterwards) was already green over that restore. There is no leak in this source; the reading stays as evidence, no change was made for it. |
| **V1 ·** visible Index overlap at 1440×900 involving `+ Present`, `Browse World` and their explanations | **confirmed · fixed** | A door's explanation is now the door's own second line (`.ix-go .ix-note`, the form the Records register row has always used) instead of a sibling racing its button for the row. Measured as **painted line boxes**, not boxes: `every line the Index paints is on its own line, inside its row and inside the column` → 1440×900 `{"index":292,"rows":3,"overflow":0,"collide":0,"escape":0}`, invoked 1024×768 sheet `{"index":420,"rows":7,"overflow":0,"collide":0,"escape":0}`. |
| **V2 ·** semi-spatial View markers and long leaders against PLATE §0.8.1 | **confirmed · fixed** | The constellation is compact named markers around the focus, each carrying **its own** direction glyph drawn with it; the projected standpoint, the leader joining a metric position to a schematic one, and the origin square are gone. Three readings hold it: each glyph is its own visible element and not part of the identity plate, each glyph is drawn beside its own marker, and the constellation makes no metric claim (no standpoint glyph, no leader, no origin square). Orientation and identity survive (the glyph is the View's own direction); no metric precision and no View ordering is implied. The `view-metric` leg restores the reviewed drawing and is rejected. |
| **V3 ·** Presentation Card hierarchy | **confirmed · fixed** | One primary write (`+ Capture view`) with its companion (`Recommended framing…`); `Bring Views into view` (a Camera navigation aid) and `Add to Guide` (a structural write) became two quiet rows, so four stacked full-weight buttons no longer read as four co-primary actions. Every act kept its name, its place and its reachability: no recipe had to be re-pointed for this change, and all 26 axes stayed green with it. |
| **V4 ·** the Advanced screenshot showed its entry, not its contents | **confirmed · fixed** | `qa/capture-experience-views.sh` now photographs the **expanded** home at both review sizes: all four sections read back from the captured state, its controls scrolled into the Card's own view and hit-reachable there, every control inside it natively focusable and enabled, and keyboard access proved with the browser's **real** Enter on a focused summary (which toggles it, and a second Enter returns it to the photographed state) — a dispatched key is not accepted as that proof, because a disclosure's default action is only performed by a real one. Two captures are new: `qa3-1440-advanced.png` and `qa3-1024-advanced.png`. |

### The new slice is not a tautology

| Reintroduced defect | Rejected at | Unaffected controls |
| --- | --- | --- |
| aggregate Present writes the Presentation but no View use | conformance · *Present this is one aggregate command…* | 116 green |
| …and writes that View as a visitor choice instead of the Default | conformance · *Present this is one aggregate command…* | 116 green |
| Presenting from a Plan reading captures the plan without asking | conformance · *Presenting from a Plan reading offers the intent choice…* | 111 green |
| unlinking one View use takes two history steps | conformance · *Remove from Presentation unlinks one use in one history step* | 111 green |
| Set as Default writes straight to source, bypassing the shared-use Ask | conformance · *shared Set role change asks before source/history changes* | 111 green |
| the retired `Present region` row restored beside the one `+ Present` | conformance · *the Index offers exactly one creation entry…* | 116 green |
| the derivative image drawn with the authoring treatment | experience-shell · *one idle turn drew the picture once…* | 34 green |
| the image pass never gives the live camera back | experience-shell · *the pass wrote nothing…* | 34 green |
| the Plan door saves the recommended framing instead of the reading it was asked for | conformance · *Use the plan as the visitor View authors the plan reading itself* (6 assertions trip, including both `+ Present` laws and *…never the recommended framing of the same subject*) | 128 green |
| the constellation drawn at projected standpoints, with a leader and an origin square | conformance · *the constellation makes no metric claim…* (2 assertions trip) | 132 green |
| a picture keyed on the museum's object identity instead of the source's own generation | experience-shell · *an accepted World write moves the generation…* (2 assertions trip) | 40 green |
| a picture fogged at the live camera's distance instead of its own projection's | experience-shell · *the picture is fogged at its own eye distance…* (1 assertion trips) | 41 green |

### Recorded facts and limits

- **An audition cannot already be live when a View is selected**: selecting a View use drops a
  subject-local audition (the subject has stopped being the subject of work), so the audited reading sets
  the audition through the same writer the Subject Card's own control calls, in the same synchronous turn
  as the selection. The reading says so, and asserts it (`the audited draw is taken with live session
  state, not an idle page`), so the neutrality claim is never vacuous.
- **Set-aside/ghost geometry is reported, not asserted.** `lastSnapshot.awayHidden` is in the reading, but
  the example authors no set-aside geometry at the moment of the audited draw, so it is a fact about the
  fixture rather than a proof. The authoring-treatment law it belongs to is asserted through
  `paper === 0`, `authoring === false` and `clips === 0`, and the `image-paper` mutation reintroduces an
  authoring projection and is rejected.
- **The draw-time ceiling is asserted per draw, not averaged.** The draws measured here are well inside
  the 50 ms the plan allows; a machine under load could exceed it, and the assertion would report that
  honestly rather than be loosened to pass.
- **Re-focusing a Presentation on its environment is a real change of what it presents**, and nothing in
  the product re-focuses one back onto a subject, so the one-creation-entry and Change-focus readings sit
  at the end of the QA-1 journey, after everything that depends on that Presentation naming the machine
  subject.
- **What UX2 deliberately leaves where it is**: the Stop Card's own projection of a shared Presentation's
  Views (the schematic L2 Set the accepted composition axis reads), the Deck and its postures, the Seam
  triptych, the coordination strip and the Stop Card itself belong to UX4–UX6. UX2 moved creation, the
  Views and the View operations, and re-pointed every recipe that reached them.
- **The retired Framing Hints posture** is replaced by the Card's recommended-framing tray. The C9.2/C9.3
  obligations still hold: the `route-writer` mutation leg's anchor follows the procedure list without the
  retired posture, and the axis still rejects that defect.
- **Visual acceptance of UX2 is deferred, not claimed.** Everything in this record is agent verification:
  readings, assertions and captures. The review round's own visual findings (the Index rows, the
  constellation, the Card's hierarchy, the Advanced home's contents) are fixed and measured as geometry,
  painted line boxes, hit reachability and real-key behaviour — the appearance itself (colour, type,
  spacing, density) is reviewed by the owner. Human visual acceptance happens **once**, on the integrated
  prototype after UX7; UX2's functional gate is verified and its visual gate is pending.
- **The keyboard proof in the capture pass is a real browser key, not a dispatched event**, because a
  dispatched `KeyboardEvent` cannot perform a native disclosure's default action. It runs the moment the
  Advanced home is on screen (the home's own summary always exists), so the reading can never be skipped by
  a state that happens to have no contributions authored yet.
- **A picture's generation is session bookkeeping, not authored state.** `S.sourceEpoch` advances only in
  the two places the World source already settles (an accepted write and a restore); it is never written to
  a document, never in Undo, and never read by the Experience model. It exists because the World writers
  mutate in place, which is exactly why object identity was the wrong key rather than a missing signal.

---

## UX3 — Scene subject (landed · functional gate verified, visual acceptance deferred to the single post-UX7 review)

**Exit gate (plan §5):** QA 5 acceptance (§7) — a visible subject selects on click, `Browse World` reaches
the rest through that same selection, the Card reads identity → `Present this` → Used in Experience →
Add behavior / Visitor interaction, no capability control is on screen at rest, and no Presentation looks
selected — with the audition still writing nothing and capture, update and ambiguity semantics unchanged.

### What UX3 changed

| Artifact | Change |
| --- | --- |
| `app/experience-ui.js` | the Scene subject Card restructured into the order QA 5 fixes: identity, `Present this` (the subject's own door, authoring Camera's recommended framing for its extent), the derived `Used in Experience` reach (`usedInExperienceHtml`), then `Behavior · visitor interaction` with the subject's two doors. Capability rows are no longer rendered at rest: `chooserHtml` lists the declared descriptors under `[data-exp-chooser]`, and `capabilityWorkHtml` is the UX2 audition/capture row rendered only for the one invoked operation (`[data-exp-invoked]`), with `Clear audition` and `Close` beside it. |
| `app/experience.js` | `openCapabilityChooser` / `closeCapabilityChooser` / `invokeCapability` / `closeInvokedCapability`: session-only door and invocation writers, all consulting the one `isRealized` eligibility, writing no source and no history. `+ Visitor interaction` opens the existing offer draft with this subject as its target and activation, so the offer writers are the ones the Advanced home already used. The audition's own cancellation reasons drop the chooser and the invoked operation with it, and every Experience reset clears them. |
| `app/state.js` | `expChoose` / `expInvoked`, documented as session bookkeeping: never authored, never in Undo. |
| `app/ui.js` | a pending decision, and the operation it led to, are brought into the Card's own view once — the chooser and the offer draft from their own first row, the invoked operation as a row — because replacing the Card's content resets its scroll. Nothing is written, the Stage and Camera are untouched, and the state that brought it in is remembered, so a later re-render never yanks a reading the author has scrolled. |
| `styles/app.css` | the derived reach's rows: one reference row per fact, its note under it, no selection treatment. |
| `qa/lib.sh` | `qa_subject_operation` / `qa_subject_invoke`: the author's own three steps to an audition or a capture (select the subject, open `+ Add behavior`, choose the descriptor), in two evals because the chooser is rendered by the click that opens it. |
| `qa/conformance-check.sh` | +9 QA 5 readings (134 → 143): the Card's order, no capability control at rest, no Presentation looking selected, the chooser over exactly the declared descriptors operating nothing, Cancel leaving nothing operated or written, the derived reach as references to their owners, reading it selecting and writing nothing, one row opening its owner, and the door writing nothing on the way to the operation. |
| `qa/creator-check.sh`, `composition-check.sh`, `revision-check.sh`, `walkthrough-check.sh` | re-pointed to the door path where they reached an audition or a capture directly, plus two readings re-pointed where they named a control that legitimately no longer exists at rest (the "Use at Experience scope" text, and a narrow reachability reading that now scrolls to the operation it invokes). Nothing was weakened: the assertions state the same domain facts through the controls that now carry them, and the narrow one is stricter about *what* is reachable. |
| `qa/capture-experience-subject.sh` (new) | the QA 5 capture pass: the subject's Card at rest, the chooser its behavior door opens, the offer draft its interaction door opens, and the invoked operation, at 1440×900 and inside the 1024×768 sheet — each capture paired with a reading of what was photographed. |
| `qa/subject-mutation-check.sh` (new) | this slice's replacement proof, chained into `qa/mutation-check.sh`; one leg can be re-run by name. |
| `screens/experience-ux3/` | the six QA 5 captures, taken from this slice's source after the last edit. |

### Readings

| Proof | Result |
| --- | --- |
| all 26 axes (`qa/run-all.sh all`) | **green, 0 failures: 1,187 assertions** — journeys 59, interaction 56, flows 44, policy 41, World shell 47, precision 38, browse 60, repair 47, lens 82, Experience 30, experience-shell 42, locator 30, **conformance 143**, creator 25, composition 27, **revision 39**, rich 35, precision-c9 55, presenter 59, walkthrough 33, walkthrough-demo 59, visitor 42, reconciliation 13, continuity 55, responsive 15, correctness 11 |
| `qa/capture-experience-subject.sh` (new) | **16 readings green, six captures** — the subject's Card at rest with both doors and no capability control, its QA 5 order, its derived reach as references and not a second editor, the chooser over exactly the declared descriptors with nothing operated (and Cancel writing nothing), the offer draft opened by the interaction door with this subject as its target and activation and in view, the invoked operation brought into the Card's view with its audition and capture writer (and that opening the door and invoking wrote nothing), and the same states inside the narrow sheet |
| `node --test prototypes/spatial-authoring/tests/*.test.mjs` | **140 / 140 pass**, exit 0 |
| `qa/mutation-check.sh` (all six proof scripts) | **126 replacement legs, every reintroduced regression rejected, none accepted, exit 0** — six of them UX3's (`rest-controls`, `door-direct`, `door-writes`, `derived-selected`, `order`, `unrealized-offered`) |

### The new slice is not a tautology

| Reintroduced defect | Rejected at | Unaffected controls |
| --- | --- | --- |
| a capability control rendered at rest, before anything was invoked | conformance · *no capability control is at rest on a Scene subject Card* (3 assertions trip) | 140 green |
| `+ Add behavior` invokes the first declared descriptor instead of opening the chooser | conformance · *the behavior door opens a chooser over the declared descriptors and operates nothing* | 140 green |
| opening the door authors a capture, so reading what a subject declares writes source and history | conformance · *Cancel closes the chooser, leaving nothing operated and nothing written* | 140 green |
| a derived row marks its Presentation as the current selection | conformance · *no Presentation looks selected while a Scene subject is* | 142 green |
| the derived reach promoted above `Present this` | conformance · *a Scene subject Card is ordered identity…* | 142 green |
| the chooser offers a descriptor this Stage does not realize | revision · *the unrealized Annotate is reported in the chooser and never offered as an invocation* | 38 green |

### Recorded facts and limits

- **The subject's Card is not an operator at rest, and that is the whole slice.** The audition and capture
  writers are the UX2 ones, unchanged: what UX3 changed is *when* they appear. A reader of this record can
  check that directly — the conformance readings for capturing, updating and disambiguating an Activity
  (`Use in this Presentation captures one Activity holding the auditioned value`, `updating the captured
  value reuses that Activity and never duplicates it`, `two matching captures ask which Activity to update`,
  `Capture another creates a third Activity…`) are the pre-existing ones and were not rewritten; only the
  three clicks that reach them are new.
- **The two doors are distinguishable by what they author.** `Present this` authors Camera's recommended
  framing for the subject's extent (and the live view for a logical subject with no extent); `+ Visitor
  interaction` opens the ordinary offer draft, whose kind, target, capability, value, activation and
  availability are the same writers the Advanced home reaches. Neither writes unless it is accepted.
- **The derived reach is a derivation, not a document.** It is computed on every render from the existing
  references (Presentation focus, control definitions targeting the subject, an offer's activation) and the
  Stops that present the Presentations those live in. Removing a Presentation, a behavior or a Stop removes
  its row; nothing is cached and nothing is authored. `Used in Experience · 0` is a real state with its own
  hint, reached on a subject nothing uses yet.
- **A row opens its owner, and only that.** A Presentation row is `data-act=exp-open`; a behavior or offer
  row is `data-act=pres-ref`, the same selection the Views list and the Stage markers make; a Stop row is
  `data-act=exp-stop`. None of them edits, and the reading asserts that opening one leaves the source and
  the history untouched.
- **What UX3 deliberately left where it is**: the Deck and its postures, the Stop Card, the Seam and
  Journey surfaces and the visitor runtime belong to UX4–UX6; the Advanced authoring home keeps its own
  offer and narration writers, since an offer authored there is the same offer this slice's door opens.
  `Present this` on a *World museum identity* keeps the Card body UX2 gave it (`foreignExperienceCard`),
  which is a different Card from a Scene subject's.
- **Two recipe readings moved for honest reasons, and both are recorded rather than described as
  equivalent.** `creator-check.sh`'s Undo-invalidation reading named the string `Use at Experience scope`,
  which cannot be on a Card at rest any more: it now reads the same fact (the replaced working context is
  invalid while the World selection still resolves) through the subject's own Card. Its narrow reading now
  scrolls to the invoked operation before asserting reachability, because the operation sits below the
  derived reach in the order QA 5 fixes — reachability is what is asserted, not that the sheet happened to
  open with the control on screen.
- **Visual acceptance of UX3 is deferred, not claimed.** The captures and the geometry/behaviour readings
  are agent verification; density, hierarchy and the visual weight of the derived rows are the owner's
  review, which happens once on the integrated prototype after UX7.

---

## UX3 review corrections (landed · lightweight policy)

**Findings repaired (review of head `949caab`), each verified through its own scenario rather than
re-described as equivalent:**

- **Focus-only Stop reach.** `usedInExperienceHtml()` derived Stops from the homes of behaviours/offers
  only, so a Presentation that merely *focuses* the subject — the ordinary `Present → Add to Guide` case,
  which authors no behaviour — contributed no Stop row. The Stops are now the union of the focus
  Presentations and the behaviour/offer homes. A focused smoke drove the real workflow: `Present this` on
  a Scene subject → `+ Add to Guide` → the subject's Card shows exactly one `[data-exp-used=stop]` row whose
  button is `data-act=exp-stop` and whose id is `guide[0]`; before the Guide Stop existed the section had
  none (`0`), which is the defect the fix closes.
- **Choose vs author wording.** The chooser's per-capability button read `Add <capability>`, which implied
  the click authored a behaviour; it actually opens that capability's audition/configuration, and nothing is
  authored until a capture is accepted. The button now reads `Configure <capability>…`, and the chooser says
  so explicitly. Verified: the button text is `Configure Open casing…` and the chooser contains *nothing is
  authored until you accept a capture there*.
- **Density of `Used in Experience`.** The section was a stacked two-line row per reference and could
  dominate the Card. Rows are now one compact line each — the owner's name as the hit target, its short
  kind/scope note beside it, elided rather than wrapped — so the section reads as a reference index, not a
  second inspector. QA 5's order (identity → `Present this` → `Used in Experience` → the two doors) and the
  row contract recipes read are unchanged.

Focused checks run: `node --test tests/*.test.mjs` **140/140**, `qa/run-all.sh conformance`
**143/0**, and the dedicated scenario above. Broad suites and mutation chains were not run (plan §9).

---

## UX4 — Guide, Stops and edges (landed · functional gate verified, visual acceptance deferred)

**Exit gate (plan §5):** QA 4 acceptance (§7) — one Guide home in a bounded Deck; Stop and edge each have
 their own Card, never both; Cut/Travel lives on the edge; edge chips show the resolved outgoing
 continuation (order-default, explicit destination, End, needs-repair); connectors join only truly adjacent
 destinations; no Camera paths on Stage in Guide posture; the resolved entry View is labelled by its own
 name.

### What UX4 changed

| Artifact | Change |
| --- | --- |
| `app/experience-ui.js` | `renderDeck()` now renders **one Guide lane** (`guideLane`, `.gd-lane`) in every posture instead of the Peek pip strip and the Overview L2 cards. Each Stop is a named chip (`.gd-stop-card` + `.peek-stop.gd-stop`, showing `◉ n · Presentation`) followed by its own **edge chip** (`edgeChip`): `→ Stop m · Name` when the resolved destination is the truly adjacent Guide position, `⇥ Stop m · Name` when it is an explicit non-adjacent Next, `⊘ End` for an explicit End / end of Guide, and a non-interactive `! needs repair` status for an unresolvable destination. The band head carries **Edit Guide** (`guideOrderHtml`: move ←/→, repeat, remove) and Close. `stopDetails` is restructured to QA 4's order (Entry, Next, then a `Stop detail` disclosure for Pacing/Gate/choices); ordering/repeat/removal moved to the Deck. The **edge Card** (`edgeCard`, exported) replaces the Seam triptych: continuation identity, Cut/Travel, aggregate `Reachable from n of m Views` with the one `Prepare missing routes` repair, the `Edit Camera Path` door, an `Origins from this Stop` list, the destination entry, and the coordination strip. `staleEdgeCard` reports a pair whose destination no longer resolves and never retargets. The retired `seamHtml`, `occurrenceHtml`, `subjectThumbnail`, `setHtml` and `constellation` exports are removed. |
| `app/experience.js` | `openSeam` is the edge selection (kept `data-act=exp-seam` with `data-from`/`data-to`, so the moved control keeps its recipe); `openPresentation` clears a selected edge so opening a Presentation inspects the Presentation; `exp-remove-stop` clears an edge that named the removed Stop rather than leaving a stale bookend. |
| `styles/app.css` | the lane, Stop chip, edge chip, Edit Guide menu, origin rows, and the narrow rule that keeps the band under its reserved share. |
| `qa/experience-check.sh`, `qa/composition-check.sh`, `qa/conformance-check.sh`, `qa/reconciliation-check.sh`, `qa/rich-check.sh` | re-pointed the recipes the slice genuinely moved: the retired L2 Set / thumbnail strip / stop-summary and the two `#experienceDeck` coverage strings now read the edge Card (`#card [data-edge-coverage]`), the coordination strip's home is the Card, and a View use is selected from the shared Presentation's own Views list. No assertion was loosened. |
| `tests/experience-travel-agency.test.mjs` | the coverage reading now calls the edge Card (`UI.edgeCard`) where `UI.seamHtml` used to be. |
| `screens/experience-ux4/` | four captures: the ordinary Guide lane at 1440×900, the open Guide band, the edge Card, and the narrow band at 1024×768. |

### Readings (focused)

| Proof | Result |
| --- | --- |
| `node --test prototypes/spatial-authoring/tests/*.test.mjs` | **140 / 140 pass**, exit 0 |
| `qa/run-all.sh experience` | **30 / 0** |
| `qa/run-all.sh composition` | **27 / 0** |
| `qa/run-all.sh experience-shell` | **42 / 0** (including the band's ≤ 40 % share at 1440×900 and 1024×768) |
| `qa/run-all.sh conformance` | **143 / 0** |
| `qa/run-all.sh reconciliation` | **13 / 0** |
| `qa/run-all.sh rich` | **35 / 0** |
| `qa/run-all.sh walkthrough` / `walkthrough-demo` / `presenter` | **33 / 0**, **59 / 0**, **59 / 0** |
| `qa/run-all.sh creator` / `visitor` / `continuity` | **25 / 0**, **42 / 0**, **55 / 0** |

The banned §9 sweeps (`run-all.sh all`, `mutation-check.sh`, the mutation chains) were **not** run; the
mutation scripts remain in the tree unchanged and unrun. That is the owner-ratified policy, not a pass.

### The lane, as read from the page (conformance fixture, 1440×900)

```
○ 1 · Materials          Entry · Gallery entry · auto   → Stop 2 · Piano
○ 2 · Piano              Entry · Gallery entry · auto   → Stop 3 · Power switch
○ 3 · Power switch       Entry · Gallery entry · auto   → Stop 4 · How the drive works
○ 4 · How the drive works Entry · Entry · auto           → Stop 5 · Gallery light
○ 5 · Gallery light      Entry · Gallery entry · auto   → Stop 6 · How the drive works
○ 6 · How the drive works Entry · Entry · auto           ⊘ End of Guide
```

Each edge chip carries `data-act=exp-seam` with `data-from`/`data-to` (the control the recipes already
used) and `data-continuation=order|explicit|end|repair`; every Stop chip is `data-act=exp-stop`. The narrow
band measured **~33 %** of a 768 px viewport after the ≤1060 px rule, against the 40 % reservation; no
document horizontal scroll and no scroller inside the lane.

### The new slice is not a tautology (focused replacement checks, in-tree)

| Reintroduced defect | Rejected at |
| --- | --- |
| the Peek pip strip restored beside the lane | experience-shell · *a Guide mounts, with one Deck naming its own posture* / conformance · *Overview … the one Guide lane naming every Stop* |
| Stops derived from behaviour homes alone (the UX3 defect) | the focused smoke: `[data-exp-used=stop]` count `1` after `Add to Guide`, `0` before |
| the L2 thumbnail strip restored | conformance · *…the one Guide lane naming every Stop* (`!document.querySelector(".stop-thumbnail")`) |
| the edge Card rendered inside the Deck home | conformance · *Coordination lives on the edge Card, inside the one Card home…* |
| a removed Stop leaving a stale edge that retargets | `staleEdgeCard` reports it; `exp-remove-stop` clears the selection |

### Recorded facts and limits

- **Deferred to later slices (recorded, not fixed):** the edge Card's per-origin list is a plain open
disclosure rather than the Path posture's dedicated *From* list (UX5); the coordination strip is still the
C9 surface restyled only in home (UX6 owns the Journey timeline, Cues, Hold/Invoke authoring, grouped
station movement and Rehearse); the Route/Camera-Path Deck band is still the C9 route reading (UX5).
- **Rehearse, Cues and the Journey timeline do not exist yet** — UX4 deliberately left the coordination
  strip's behaviour untouched so UX6 can replace its surface without re-litigating the model.
- **The `exp-guide`/`exp-close` pair still opens and closes the Guide band**, and `data-deck-posture` still
  names the posture, so the shell axis's band laws and continuity's `overview` read are unchanged.
- **Visual acceptance of UX4 is deferred, not claimed.** The four captures and the readings are agent
  verification; density, hierarchy and the visual weight of the lane and the edge Card are the owner's
  single integrated review after UX7.

---

## UX5 — Camera Path posture (landed · functional gate verified, visual acceptance deferred)

**Exit gate (plan §5):** QA 1 acceptance (§7) — the Stage shows the endpoints, the evaluated path and its
points, with the selected point marked and no Cues or timing on it; `+ Path point` is the only creation
path; the Point Card carries Remove, an evaluated Camera preview, Look through and Used by; the Deck lane
is a straightened path that names the Guide edge occurrence; *From* lists origins with connected/gap
status. Plus the shared-path Ask, refusal and Undo, and the law that an ordinary click adds nothing.

### What UX5 changed

| Artifact | Change |
| --- | --- |
| `app/experience-ui.js` | **`pathCard(seam)`** is the Path posture's one Card: the routing head (`Camera Path · Camera`, `View → View`, `Owner · Camera · pace`, `Guide edge · Stop n → Stop m`, `Reach · n Guide edges`), the **`From`** list (`originCoverage` rows with `connected` / `gap` / `needs repair` status and the route or Connect door, the current route marked), the **Path points** chips, `+ Path point`, the armed guidance line, **`pathPointDetail`** (identity, `n% along the route`, observer position, the evaluated preview, `Look through`, `Remove path point`, `Used by`), and Pace/Camera. **`pathLane()`** adds the straightened lane to `guideLane` in the Path posture. `edgeCard` keeps Cut/Travel, aggregate coverage and the one `Edit Camera Path` door, and keeps the edge's own cue-timing door, which the Path Card also offers as a quiet reference. |
| `app/experience.js` | `armPathPoint()` (reflects the armed state, writes nothing), `selectPathPoint()`, `removePathPoint()` (through the one route proposal, so a shared route asks), `lookThroughPoint()` (Camera's own `nav.lookThrough`, evaluated from the route kernel). `routePoint()` now refuses unless the insertion is armed and disarms on success. The armed reading and the selected point are session state on the one context and are cleared by every depth change, by `editRoute`, by the return crumb and by Escape. `acceptRoutePace`'s writer gained `removeAnchor`. |
| `app/experience-model.js` | `removeAnchor(c,id,anchorId)` — one point removed, every other point, the pace and the Experience references untouched. |
| `app/experience-image.js` | `imageForPose(pose)` — the same image pass, keyed on the same resolved pose, now serves any evaluated Camera reading; `imageFor(view)` delegates to it. One renderer, one cache. |
| `app/main.js` | a Stage press becomes a path point only while the insertion is armed; otherwise the shell's ordinary click runs and the route is untouched. |
| `styles/app.css` | the lane, the point chips, the point Card, the pressed-action rule (a pressed `primary` action keeps ink text, so the armed control can never read as a blank box). |
| `qa/experience-check.sh`, `qa/conformance-check.sh` | arming added where a press authors a point; the Card's controls are clicked through the Card's own scroll container (`card_click`) because the fixed Guide band can cover a control at the foot of a tall Card. No assertion was loosened. |
| `screens/experience-ux5/` | five captures: the empty Path posture, the armed insertion, the Point Card with its preview, the shared-route removal Ask, and the posture at 1024×768. |

### Readings (focused)

| Proof | Result |
| --- | --- |
| `node --test prototypes/spatial-authoring/tests/*.test.mjs` | **140 / 140 pass**, exit 0 |
| `qa/run-all.sh experience` | **37 / 0** (includes the new Path readings) |
| `qa/run-all.sh conformance` | **146 / 0** |
| `qa/run-all.sh experience-shell` | **42 / 0** |
| `qa/run-all.sh composition` | **27 / 0** |
| `qa/run-all.sh rich` | **35 / 0** |
| `qa/run-all.sh reconciliation` | **13 / 0** |

The banned §9 sweeps (`run-all.sh all`, `mutation-check.sh`, the mutation chains) were **not** run; the
mutation scripts remain in the tree unchanged and unrun. That is the owner-ratified policy, not a pass.

### The Path posture, as read from the page (conformance fixture, 1440×900)

```
CAMERA PATH · CAMERA            Gallery entry → Gallery entry
Owner · Camera · auto pace      Guide edge · Stop 1 → Stop 2      Reach · 1 Guide edge
FROM · 1        Gallery entry · connected        [This route]
PATH POINTS · 1  ◉ 1                                            [+ Path point]
                The only creation path: arm this, then click the Stage.
                A plain click selects and adds nothing.
SELECTED POINT · 1   Anchor 1 · 42% along the route · observer -6.14, 1.50, -1.57
                     [rendered Camera preview]   [Look through] [Remove path point]
PACE · CAMERA  auto    Camera owns this geometry · 1.14s travel · 1 point · 0 named stations
[Bring route into view] [Edit cue timing] [Put it back]
Deck lane: Camera Path · Stop 1 → Stop 2   Materials → Piano · auto pace   ◉ 1
```

### The new slice is not a tautology (focused replacement checks, in-tree)

| Reintroduced defect | Rejected at |
| --- | --- |
| a Stage press authors a path point without being asked | experience · *a plain Stage press adds no Camera path point*; conformance · *an unarmed Stage press adds no path point* |
| the Path posture routed through the Seam triptych/L2 reading instead of one Camera home | conformance · *the Path posture is one Camera home with an armed-only point insertion* |
| a removed point taking the route's other points, pace or references with it | experience · *removing the selected point is one ordinary Camera edit* + *Undo restores the removed path point* |
| Look through writing source or history instead of only the standpoint | experience · *Look through a path point moves the standpoint and writes no history* |
| the point preview introducing a second renderer or cache | `imageForPose` is the same keyed pass; `imageStats()` is unchanged in shape |
| a pressed control rendering as a blank box | the pressed rule keeps ink on the recess background; re-captured armed state reads `Cancel point` |

### Recorded facts and limits

- **Path points are the authored interior anchors, and their identity is the Camera station id.** Selecting
  one selects the same identity a Seam station names, so a Hold or Invocation authored at that station keeps
  its reference across a move, and the Experience side is never renamed by a Camera edit.
- **The Point Card's preview is the View preview's pass.** It is drawn at the evaluated pose of the point,
  so the picture is the Camera's own reading of that point rather than a second rendering path; while it is
  being drawn the Card names that (`Rendering this point…`), and a pose that cannot resolve is reported in
  words rather than shown as an empty box.
- **Deferred to UX6 (recorded, not fixed):** the coordination strip is still the C9 surface restyled only in
  home; Hold/Invoke authoring, the Journey timeline, grouped station movement and Rehearse are untouched.
- **Visual acceptance of UX5 is deferred, not claimed.** The five captures and the readings are agent
  verification; the density and hierarchy of the Path Card and the straightened lane are the owner's single
  integrated review after UX7.

## UX5 review correction — the Deck in the boards' language (landed · checkpoint)

**What was wrong.** The Deck was still the pre-reconciliation reading: a full-width head row above the
lane, and every Stop drawn as a cramped mini-card — a truncated `n · Presentation` line, an `Entry · …`
reading and a full-width `Detail` button stacked inside the retired 50 px Peek width. Set against the
locked specimens (QA 1 Camera Path, QA 2 Journey, QA 4 Guide) the deviation is hierarchy and proportion,
not behaviour: the boards draw **one shallow band** whose left **name block** carries the posture's
label, its one reading and its own actions, and whose right **lane** carries that posture's content.

**What changed** (`app/experience-ui.js`, `styles/app.css`):

- `deckBlock({k,t,s,ops})` — one name block per posture; the band is a flex row of block + lane.
- **Guide (QA 4):** `GUIDE · <Guide name> · n Stops`, then compact named Stop chips in order reading the
  occurrence number, the Stop's own name and `Presentation · <name>`. `Entry`/`Next`/pacing stay the
  selected Stop's Card and ordering stays `Edit Guide`, so the chip carries no second inspector. The
  continuation chip names its continuation in one word (`Cut` / `Travel`, `⇥ Stop n`, `⊘ End`,
  `! needs repair`) instead of a sentence, and its `aria-label` still names the destination.
- **Path (QA 1):** `CAMERA PATH`, `<origin View> → <destination View>`, `Guide · Stop n → Stop m`; the
  lane keeps the straightened topology, and its tail now reads only pace / armed state rather than
  repeating the Guide occurrence the name block already names.
- **Journey (QA 2):** `JOURNEY`, the View pair, the Guide occurrence, `Rehearse` as the block's primary
  action (Pause/Stop appear while a rehearsal is live; `Look through` is Camera's own exit), and a real
  time axis — `0:00 → total`, one ◆ per Cue carrying that Cue's name beneath it, the playhead, and the
  axis itself as the scrub surface, so no second control repeats it.
- **Index header:** keeps the one `Path | Journey` switch and carries the Journey's own
  origin → destination, `Total · n s` and `n Cues`. The Deck no longer repeats the switch
  (`postureSwitch()` is retired): one control, one home.
- **Narrow review:** under 1060 px the chips drop to one line and the name block narrows, so the band
  stays inside the §6 40 % reservation and the Card stays reachable.

**A defect the comparison found, and fixed.** `cueCard` handed the *selected pair* to `coordinationHtml`,
whose `coordinateTiming` reads the resolved seam's beats. The resulting `TypeError` was thrown inside
`renderUI()` **before** `renderExperienceSurfaces()`, so entering the Journey left the Card and the whole
Deck showing the Path posture while the Index looked current — a silent half-render. `cueCard` now
resolves its seam and `coordinationHtml(seam, pair)` takes the pair separately. The probe that found it
(a console-error capture plus posture/Card readings after each click) now reads clean.

### Readings (conformance fixture, driven by pointer/keyboard)

| Reading | Result |
| --- | --- |
| Band, Guide posture (6 Stops, 1440×900) | first child `.deck-block` is the element a pointer hits; 6 `.gd-stop-card.compact`, 6 `.gd-edge`; one deck, `[data-deck-posture]` = `overview` |
| Band, 1024×768 | 99 px · 12.8 % of the viewport; chips one line, no nested scroller, no sideways document scroll |
| Postures reached | `overview` → `route` (`[data-path-lane]`) → `coordination` (`[data-journey-deck]`), Card `Camera Path · Camera` → `Cue · Journey` |
| Console errors across the Journey path | none (was `TypeError: … reading 'map'` in `coordinateTiming`) |
| Node tests | `node --test tests/*.test.mjs` → **144/144 pass** (incl. the new `experience-journey.test.mjs`) |

## UX6 — the Journey (checkpoint · behaviour and surfaces landed, browser gate unrun)

**What landed.** One clock (`journeyClock` in `app/experience-coordination.js`) mapping Camera movement
time plus Experience pauses through the same `movementTiming` the visitor runtime uses; Cue identity as
the (Guide edge, connection, station) triple with `cueMembers` / `cueDestinations`; the atomic cue move as
one history transaction (`moveCueCommand`) and the origin choice (`setJourneyOrigin`); the session
playhead (`rehearsePlay` / `Pause` / `Stop` / `rehearsalAt` / `rehearsalLook`, driven by `rehearseTurn`
and drawn as the Stage rig plus the Deck playhead); the Journey Deck and the Cue Card; and a focused Node
test file (`tests/experience-journey.test.mjs`) plus the Experience axis's Journey smoke block.

### Recorded WIP at this checkpoint (not claimed as done)

**Superseded in part (2026-10-12).** The items below are kept as history, not as the current state:
the review follow-up at the end of this file ran the covering axes, retired the C9 strip from every Card
and retired the chip's `Detail` control. Each bullet says so where it changed; nothing above is deleted,
because a checkpoint's own record is what the follow-up was asked to correct.

- **The covering QA axes are unrun after the last edits.** `qa/run-all.sh experience` (which owns the
  Journey block) and `experience-shell` (which owns the band's share/heading laws) have not been run at
  this commit; #114 makes those owner-directed per slice, and this checkpoint records them as **unrun**,
  not green. The Node suite is green (144/144). *Closed 2026-10-12: `qa/run-all.sh` at `QA_JOBS=1`
  passes all 26 axes, `experience` at 58/58 and `experience-shell` at 50/50 among them — see the
  follow-up section. The follow-up then added two readings to that same axis, so the final serial sweep
  below records it at **52/52**.*
- **The coordination strip still writes holds.** `.coord-hold` keeps its `[data-exp-hold]` input in the
  Journey posture while the Cue Card's Pause writes the same field. §0.8.1 wants the strip to be the
  projection; the change is a control-ownership decision (the historical `qa/rich-check.sh` asserts an
  input inside `.coord-hold`), so it is deferred rather than smuggled into a layout correction.
  *Decided in the [plan][plan] §5.6: the strip leaves every Card, and the Cue Card's Edit cue holds the
  hold writer; the recipes move per §5.8.* *Closed 2026-10-12: the C9 strip is retired from every Card
  (Stop, edge and Cue); the hold writer is the Cue Card's Edit cue's `[data-exp-hold]`, and
  `qa/rich-check.sh` reaches it there.*
- **The Guide chip keeps a `Detail` disclosure.** The boards' chip has no expansion; `Expand` is still a
  live conformance assertion (QA 3), so the chip keeps one quiet `Detail` control until that reading is
  re-pointed. *Decided in the plan §5.4: `Detail` is retired, and the Expand readings are retired or
  re-pointed per §5.8.* *Closed 2026-10-12: the chip is a shallow row with one disclosure
  (`data-act=exp-expand-stop`) and no `Detail`; the retired Expand readings were re-pointed per §5.8 in
  the reconciliation pass this record's last section verifies.*
- **UX7 is not started**, and **owner visual acceptance remains once, after UX7** — the captures in
  `screens/experience-ux4`, `-ux5` and `-ux6` are agent verification, not acceptance.

---

## UX4–UX6 review follow-up (2026-10-12 · the five implementation-review findings)

**What this is.** The 2026-10-12 implementation review of `6dd4ebce` named five findings against the
reconciled shell. Each was verified against the code and the accepted [plan][plan] before anything
changed; the table below is the outcome — two findings corrected as described, one corrected against the
reviewer's proposed remedy, and the two label/lifecycle findings fixed. The slices stay UX4, UX5 and
UX6; no new planning cycle was opened and UX7 was not started.

### Findings: confirmed, corrected and rejected

| Finding | Outcome |
| --- | --- |
| **P1 · Camera Path and Journey on Cut edges** (`app/experience-draw.js`, `drawSeam`) | **Confirmed.** The guard returned whenever `seam.mode !== 'travel'`, so entering the Path or Journey posture on a Cut edge drew no route, no point handles and no Cue chips — the Camera half was authored but invisible. The drawn half is now chosen by the **posture** (Path or Journey) and only the ordinary edge reading keeps §5.4's mode-gated drawing, which still shows its two resolved ends and its Travel routes and gaps. |
| **P1 · Path-point insertion geometry** (`app/experience.js`, `nearestSegment`) | **Confirmed.** The old measure was the closest **3-D midpoint** between successive observers; §3.2 specifies the nearest **point on a segment of the evaluated path, in plan (x, z)**, with `at` = the number of authored points whose station progress is below it. The insertion now measures the route's own evaluated samples through `nav.routeGeometry` / `nav.stationProgress` — the same evaluator the Stage drawing and every station reader use, so the measure and the station order cannot disagree. `addAnchor(c, id, position, at)` splices; the shared-route Ask and its one Undo step are unchanged. |
| **P1 · Removing a point can orphan authored Cues** | **Confirmed as a real consequence; the proposed remedy was rejected.** The review asked to refuse the removal. The accepted §3.2 rule is explicit — *"Remove still deletes by id."* — and the codebase's own precedent for a structural removal (`removeStop`, `removePresentation`) is remove-and-report, with Undo as the remedy; refusing here would also make a point unremovable until its Cue was moved, a one-way door the plan does not authorize. Verified in code instead: nothing refuses a beat whose station its route no longer has (`movementTiming` filters unresolved stations, `journeyClock` projects resolved stations only, and `coordinateTiming`'s "Camera station unresolved" reason has no reader since the C9 strip was retired) — so the reviewer's premise that the visit refuses is not what the tree does either. What changed: the write **names the count**, and the edge Card keeps a repair reading (`[data-edge-orphans]`) that says the events no longer run, so the consequence is stated rather than only visible in source. |
| **P2 · Outside-selection lifecycle** (`app/experience.js`, `ctx.onSelect`) | **Confirmed in part, corrected.** The hook cleared the reading but left the posture's own task running, left the return the posture had captured in the one navigation slot, and exempted both bookends. Now: the edge's **from-Stop alone** keeps the reading open (the accepted §3.1 owner — `openSeam` selects it); the reading's own task ends, `S.derivedView` is cleared, **Guide posture** is what the pick leaves (`depth='overview'` with its `experience-overview` task, exactly as `selectStop` leaves a procedure), and the return is **discarded** (`nav.discardReturn()`) rather than applied, so an outside selection moves no Camera (§5.5). |
| **P2 · Cut destination label** (`app/experience-ui.js`, `edgeCard`) | **Confirmed.** `at()` already returns a one-based Stop number, and the Cut sentence printed `at(to) + 1` — one Stop too far. Corrected, and read back in the capture pass below by comparing the printed number with `guide.indexOf(to) + 1`. |

### Verification this follow-up ran

| Check | Result |
| --- | --- |
| `node --test tests/*.test.mjs` | **148/148 pass** (146 before; the two new §3.2 cases in `tests/experience-path-points.test.mjs`) |
| `qa/run-all.sh` at `QA_JOBS=1` | **all 26 axes pass** — `qa: all requested axes passed`, exit 0. Focused totals: Experience **58/58**, Experience shell **52/52** (50 before this follow-up's two added lifecycle readings), conformance **155/155**, C9.7 rich example **36/36**, shared shell and narrow Experience **14/14** |
| Mutation proof for the insertion change | the two new §3.2 tests were run against a scratch copy carrying `6dd4ebce`'s `experience.js`, `experience-ui.js` and `experience-draw.js`: both **fail** (nearest-midpoint and three-dimensional measures), the file's other two tests pass — the cases discriminate the algorithm they claim to |
| New focused browser readings | shell axis: the reading's own task ended, the point and armed insertion dropped, the posture's own exit gone, and Guide posture left with its lane. Experience axis: `nav.putBack()` answers **false** after an outside pick — the captured return is disposed, not applied — with the standpoint unchanged. Conformance axis: an unarmed Stage press adds no point **and writes nothing**, the pick leaves a readable Guide posture, a Cut edge keeps its own edge reading, and a Cut edge still opens its Camera half (route, point, standpoint and Camera source all read back unchanged) |
| Re-pointed recipes (never loosened) | `check '<deck door>'` steps that opened the ordinary strip's own door now run only from the ordinary state (§3.1 leaves Guide posture, whose band is already open): `qa/conformance-check.sh`, `qa/rich-check.sh`; the shell axis's outside-selection expectation moved from `ordinary` to the accepted `overview` with the new task/exit readings beside it |

### Current captures (`screens/experience-ux456/` · 10 states)

Taken on purpose by `qa/capture-experience-ux456.sh`, which writes only its own directory: the dense Guide
comes from the six-Stop conformance fixture, the Camera Path images are of a **Cut** edge, and the Journey
images are the loaded example's authored Seam. Each capture carries a reading of the state under the
camera, and every image was confirmed to be a real full-size render.

| Capture | Size | Reading |
| --- | --- | --- |
| [`ux4-1440-guide-lane-dense.png`](../screens/experience-ux456/ux4-1440-guide-lane-dense.png) | 1440×900 | the ordinary Guide strip: six Stop chips, each with its own edge chip, one row |
| [`ux4-1440-guide-band-dense.png`](../screens/experience-ux456/ux4-1440-guide-band-dense.png) | 1440×900 | the same dense lane opened as the band, one home, six chips |
| [`ux4-1024-guide-band-dense.png`](../screens/experience-ux456/ux4-1024-guide-band-dense.png) | 1024×768 | the band under its reserved share, chips scrolling inside their own lane, no sideways page scroll |
| [`ux4-1440-edge-card.png`](../screens/experience-ux456/ux4-1440-edge-card.png) | 1440×900 | the edge at Cut, whose sentence names the one-based Stop the edge really ends at (the P2 fix) |
| [`ux5-1440-path-cut.png`](../screens/experience-ux456/ux5-1440-path-cut.png) | 1440×900 | the Camera half of a **Cut** edge: drawn route, From list, Camera Path Card, transition still Cut (the P1 fix) |
| [`ux5-1440-point-inserted.png`](../screens/experience-ux456/ux5-1440-point-inserted.png) | 1440×900 | the point just placed by `+ Path point`: its own inspector, drawn once on the Stage and once in the lane |
| [`ux5-1024-path.png`](../screens/experience-ux456/ux5-1024-path.png) | 1024×768 | the Path posture at the narrow size, its Card an invoked sheet over the band, no sideways scroll |
| [`ux6-1440-journey.png`](../screens/experience-ux456/ux6-1440-journey.png) | 1440×900 | the Journey: one marker per authored Cue, a `0:00.0` start, the Journey Card and its station choice |
| [`ux6-1440-cue-card.png`](../screens/experience-ux456/ux6-1440-cue-card.png) | 1440×900 | one Cue: occurrence, time, pause and actions, mirrored by the Deck marker and the Stage chip |
| [`ux6-1024-journey.png`](../screens/experience-ux456/ux6-1024-journey.png) | 1024×768 | the same Journey at the narrow size, its Deck above the invoked Cue Card sheet |

`screens/experience-ux-before/` is untouched: `qa/capture-experience-shell.sh` no longer defaults into
it (a bare run writes `screens/experience-shell/`), so the pre-overhaul baseline can only be rewritten by
naming it deliberately, as the branch recipe above does.

### Recorded limits of this follow-up

- **The two image-pass laws fail in a concurrent sweep on this machine.** `qa/run-all.sh` at its default
  `QA_JOBS=3` failed the Experience shell axis's two image-pass readings ("one idle turn drew the picture
  once" and "a warm selection costs no draw") while every other axis passed; the same axis passes alone
  and in the serial sweep, and the harness header already records those two as load-sensitive. Reported
  here as a load artefact of this run, not as green and not as a product failure — the sweep quoted above
  is the serial one.
- **Visual acceptance is not claimed.** The captures and the readings above are agent verification. The
  owner's by-eye comparison of these states against QA boards 4/5/6 stays where §5.5 puts it: once, after
  UX7.
- **The removed-point consequence is stated, not prevented.** By the accepted §3.2 rule an author can
  remove a point a Cue holds; the count is named at the write, the edge Card keeps reporting the events
  that no longer run, and Undo is the remedy. Refusing the removal was considered and rejected above.
- **No mutation chain was re-run** (owner-ratified lightweight policy, plan §9). The single mutation above
  is the focused replacement claim for the one algorithm that changed.

[plan]: ../../../docs/roadmap/p25-experience/design/experience-v2-prototype/ux-pruning-and-shell-reconciliation-plan.md
[plate]: ../../../docs/reference/design-system/editor-shell-and-visual-system.md#081-finalized-experience-shell-expression
[axis]: ./experience-shell-check.sh
[locator]: ./locator-check.sh
[locmut]: ./locator-mutation-check.sh
[capture]: ./capture-experience-shell.sh
[inventory]: ./experience-ux-selector-inventory.md

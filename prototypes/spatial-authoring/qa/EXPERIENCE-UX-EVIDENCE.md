# PR #114 — Experience UX implementation: evidence

**Role:** the evidence record for [#114][plan], the slice at a time. Each slice appends its own
section: what changed, the real-browser readings, and the regression proofs that carry its exit gate.
This record is evidence, not authority — the plan owns the work, [PLATE §0.8.1][plate] owns the
locked design, and the [composition axis][axis] owns the executable assertions.

**Branch / head:** `prototype-v2-ux-overhaul`, started from the #113 closeout head
`48447fb4d26c4285d956d0b09c84587a93db99a8` (identical to `origin/main` at the time) with a clean
working tree. No commit is made by this record.

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

[plan]: ../../../docs/roadmap/p25-experience/design/experience-v2-prototype/ux-pruning-and-shell-reconciliation-plan.md
[plate]: ../../../docs/reference/design-system/editor-shell-and-visual-system.md#081-finalized-experience-shell-expression
[axis]: ./experience-shell-check.sh
[capture]: ./capture-experience-shell.sh
[inventory]: ./experience-ux-selector-inventory.md

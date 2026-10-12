# Experience UX selector and vocabulary inventory (PR #114 · UX0)

**Role:** the UX0 inventory required by the [#114 plan][plan] §5. It records every QA string and
selector coupled to the vocabulary #114 retires or moves — Peek, Overview, the unordered Set, the Seam,
beat, Expand/L2, the coordination strip and the Deck's posture tokens — so each slice re-points the
recipe that owns a moved control **in the slice that moves it**, instead of an assertion quietly
passing because nobody ran it.

Nothing here is a status authority. A selector migrates only when its control moves; a row is closed
by the slice that re-points it, and the deck's own [composition axis][axis] is where the moved control
is re-asserted.

**How to regenerate the counts** (from `prototypes/spatial-authoring`; patterns as printed below):

```sh
python3 - <<'PY'
import pathlib, re
PATS = {
 'Peek': r'(?i)\bpeek\b', 'Overview': r'(?i)\boverview\b', 'Seam': r'(?i)\bseam', 'beat': r'(?i)\bbeat',
 'triptych': r'(?i)triptych', 'Expand/L2': r'(?i)\b(expand|L2)\b',
 'unordered Set': r'(?i)unordered set|\bexp-set\b|set-node|data-exp-set',
 'coordination': r'(?i)coordination|coord-beat|coord-hold|coordination-strip',
 'deck depth token': r"(?i)depth\s*===?\s*['\"](seam|overview|coordination|route)['\"]",
}
for f in sorted(pathlib.Path('qa').glob('*.sh')) + sorted(pathlib.Path('tests').glob('*.mjs')) + [pathlib.Path('scripts/shoot.sh')]:
    t = f.read_text()
    row = {k: len(re.findall(p, t)) for k, p in PATS.items()}
    if sum(row.values()):
        print(f"{str(f):42s} {sum(row.values()):4d} {row}")
PY
```

## 1. Where the retiring vocabulary is asserted

Occurrences of the terms above, per file, at the #114 start head (`48447fb4`). A count is coupling
mass, not a defect: it is how much of an axis has to be re-pointed when its surface moves.

| File | Total | Owning slice | What has to be re-pointed |
| --- | --- | --- | --- |
| `qa/conformance-check.sh` | 72 | UX4, UX5, UX6 | the Peek/Overview depth reads, the Seam triptych's `Reachable from n of m` / `All origins supported` strings, `.seam-instrument`/`.coordination-strip`/`.coord-beat`/`.coord-hold` geometry, `.set-node` |
| `qa/rich-check.sh` | 64 | UX4, UX6 | the loaded example's Seam, its station-only invocation and its interior Hold: `Object.values(e.seams)[0].beats`, `.coordination-strip`, `[data-hold-duration]`, `[data-act=exp-invoke-beat]` |
| `qa/composition-mutation-check.sh` | 46 | UX4, UX6 | the mutation anchors that protect Seam traversal, beats and Peek forcing L2 |
| `qa/experience-check.sh` | 28 | UX2, UX4, UX6 | `Guide begins at Peek`, Overview occurrence cards, `opening Seam keeps pose`, Travel completion strings, beat/timing identity |
| `tests/experience-mp2-review.test.mjs` | 23 | UX2, UX4 | Set/Overview/Seam model assertions |
| `qa/composition-check.sh` | 17 | UX4 | `Peek selects the Stop`, Overview L1/Expand, compact Stop Card, advanced dwell/Gate at Peek |
| `tests/experience-travel-agency.test.mjs` | 15 | UX4, UX5 | Travel/Cut origins and route invariants |
| `tests/experience-c9-review.test.mjs` | 13 | UX4, UX6 | seam beats and coordination |
| `qa/experience-shell-check.sh` | 12 | UX0 (new) | this axis names the edge posture in labels only; its selectors are `[data-home]`, `[data-act]`, `[data-deck-posture]` |
| `qa/continuity-check.sh` | 10 | UX1, UX4 | `guideOverview()` resume depth and its Overview expectations |
| `tests/experience-model.test.mjs` | 9 | UX4, UX6 | model-level seam/beat facts |
| `qa/browse-check.sh` | 8 | — | incidental: "Expand" is the Details grammar's own verb, not the Overview strip's. Not #114 |
| `qa/presenter-check.sh` | 7 | UX1, UX3, UX4, UX7 | Peek credit, `exp-expand-stop`, Stop Card and preview-guide recipes re-pointed to the new homes |
| `qa/run-all.sh` | 6 | UX0, UX4 | axis labels and the axis list |
| `tests/experience-runtime.test.mjs` | 5 | UX6 | coordination/runtime timing |
| `qa/correctness-check.sh` | 3 | UX4, UX5 | seam references inside nested-lifecycle checks |
| `qa/reconciliation-check.sh` | 3 | UX4 | "deliberately return to Peek for local Card work" narrow reachability |
| `qa/creator-check.sh` | 3 | UX1, UX2 | Overview absence and the narrow Card path |
| `qa/policy-check.sh` | 3 | — | incidental: the knife/patrol "seam" sense, not the Guide edge |
| `qa/conformance-mutation-check.sh` | 3 | UX4 | Overview mutation anchor |
| `qa/walkthrough-check.sh`, `qa/walkthrough-demo-check.sh` | 2 + 2 | UX7 | the Guide Start/Next and `#experienceDeck` entry the Q-recipes use |
| `qa/precision-c9-check.sh`, `qa/precision-check.sh`, `qa/shell-check.sh`, `tests/camera-conformance.test.mjs` | 1 each | UX5 (keep) | Edit Camera is kept; only its `#experienceDeck` entry and labels move |

**TOTAL: 357 vocabulary occurrences** across 26 files (of 41 files scanned; 158 distinct coupled
selectors, 594 selector uses in all).

### The plan's pre-audit estimate, against this measurement

The plan records "~40 selector uses in conformance-check, 17 rich, 13 experience, 11 composition".
The audit behind those numbers is not in the repository, and no two counting rules agree exactly, so
both readings are given for the four files it names — they describe the same surfaces:

| File | Selector uses | Distinct coupled selectors | Vocabulary occurrences | Plan estimate |
| --- | --- | --- | --- | --- |
| `qa/conformance-check.sh` | 71 | 21 | 72 | ~40 |
| `qa/rich-check.sh` | 69 | 12 | 64 | 17 |
| `qa/experience-check.sh` | 29 | 12 | 28 | 13 |
| `qa/composition-check.sh` | 23 | 10 | 17 | 11 |

Every reading is larger than the plan's estimate except composition-check's distinct-selector count, so
the estimate understates the re-pointing work rather than overstating it. The surfaces it names are the
ones in §3; no surface is missing from this inventory.

## 2. The exact coupled selectors and state reads

| File | Coupled selector / state string |
| --- | --- |
| `qa/conformance-check.sh` | `#experienceDeck` `.beats` `.coord-beat` `.coord-hold` `.coordination-strip` `.exp-stop-pin` `.seam` `.seam-instrument` `.seams` `.set-node` `.stop-card` `.stop-details` `.stop-thumbnail` `.stopId` `.stops` `data-coordination-detail` `data-stop` |
| `qa/experience-check.sh` | `#experienceDeck` `.beatBefore` `.beats` `.coord-hold` `.seamPose` `.seams` `.set-node` `.stop-card` `.stopId` `.stops` |
| `qa/rich-check.sh` | `#experienceDeck` `.beat` `.beats` `.coord-beat` `.coord-hold` `.coordination-strip` `.seams` `.stopId` `.stops` `data-beat` |
| `qa/composition-check.sh` | `#experienceDeck` `.peek-stop` `.set-node` `.stop-card` `.stop-details` `.stopId` `.stops` `data-exp-stop-number` `data-stop` |
| `qa/composition-mutation-check.sh` | `.beats` `.peeks` `.seams` `.stopId` `.stops` |
| `qa/presenter-check.sh` | `.coordination` `.peeks` `.stop-card` `.stopId` `.stops` |
| `qa/experience-shell-check.sh` | `#experienceDeck` `data-deck-posture` (via `[data-home=deck]` / `[data-deck-posture]`; the id is used for the Guide entry only) |
| `qa/walkthrough-check.sh` | `#experienceDeck` `.peek-stop` `.seams` `.stops` |
| `qa/reconciliation-check.sh` | `#experienceDeck` `.stop-card` `.stop-details` `data-stop` |
| `qa/walkthrough-demo-check.sh` | `#experienceDeck` `.stop-card` `data-stop` |
| `qa/creator-check.sh`, `qa/continuity-check.sh`, `qa/precision-c9-check.sh`, `qa/capture-experience-shell.sh` | `#experienceDeck` (mount point) |
| `qa/visitor-check.sh` | `.stopId` `.stops` |

`#experienceDeck` is the mount point for every Guide surface; UX4 owns replacing it with the Guide
Deck home. Because UX0 added `data-home="deck"` and `data-deck-posture`, a re-pointed recipe can name
the home and posture instead of the id and the `exp-deck <depth>` class.

## 3. Surface → owning slice

| Current surface | Vocabulary it drags | Owning slice |
| --- | --- | --- |
| Index `+ Presentation` / `Present environment` / `Present region`; "Scene subjects" list; Head trail, undo counts, `All changes saved` | Scene list, trail, Saved | **UX1 — landed**: the Index names Presentations, the Guide, `+ Present`, `Present environment`, `Present region` and `Browse World`; **UX2 — landed** consolidated the two logical-subject entries into the Presentation's own `Change focus…` menu (`data-act=exp-focus-environment`, `data-act=exp-focus-region`), so exactly one creation entry (`data-act=exp-create`) remains in the Index and both focus operations are exercised on the real controls in [`conformance-check.sh`](./conformance-check.sh); the Scene list is retired (every subject it named is reached through the shared locator, proven in [`locator-check.sh`](./locator-check.sh)); the trail, the transaction count, the last-change label and the fabricated Saved state are gone from chrome while the trail machinery and Undo stay |
| Guide Preview entries (Head, Index, Deck, Stop Card, Experience-wide) | `exp-preview*`, Overview | **UX1 — landed**: one Head `Preview ▾` menu (`#headPreview` + `#previewScopes`), whose scopes are the ones that can start; every other entry is removed and asserted absent |
| "Show · unordered Set" rows, `.exp-set` / `.set-node`, Auto/Hints/Capture/Bring into view, reuse-a-Camera-View | unordered Set | **UX2 — landed**: the Presentation Card carries the Focus line, the unordered Views list (`[data-exp-views]`, one ★ Default, no order cue), `+ Capture view` / *Recommended framing…* / *Bring Views into view* / *Add to Guide*, *Use an existing Camera View*, one ordinary explanation door (`[data-exp-explain]`) and one Advanced authoring home (`[data-exp-advanced-home]`); the View Card carries the rendered preview, *Look through*, *Set as Default*, *Edit Camera*, *Rename* and *Remove from Presentation*; the Stage marks Views semi-spatially around the focus (`.exp-view-pin`, `.exp-focus-mark`). `.exp-set` / `.set-node` survive only on the Stop Card, which UX4 restructures. Recipes reach the moved controls through the named hooks and the doors in `qa/lib.sh` (`qa_card_explanation`, `qa_card_menu`, `qa_card_remove`, `qa_card_advanced`, `qa_card_door`) rather than by a Card's element order. The View preview's own hooks are `[data-exp-preview]` (the use it belongs to), `[data-exp-preview-image]` (the Stage's rendered picture) and `[data-exp-preview-pending]`, and the pass behind them is read through `qa.images()` rather than through the picture |
| Scene subject capability rows, audition/Use | Peek (Card at Peek) | **UX3** |
| Peek band, Overview strip, Expand/L2, stop cards, stop thumbnails, Seam triptych (Cut/Travel, coverage, Prepare) | Peek, Overview, Seam, Expand/L2, triptych | **UX4** |
| Path anchors/points, `exp-route`, `exp-connect`, `exp-prepare`, stations | Seam (Camera half) | **UX5** |
| Coordination strip: station select, beats, holds, Hold here, Invoke here | Seam, beat, coordination | **UX6** |
| Visitor surface, Q1–Q8/A1–A10 presenter recipes, responsive/keyboard pass | Peek (credit), Overview | **UX7** |
| Precise Camera task, tapes, postures, Camera Card | — (kept as Edit Camera) | **UX5**, density/label residue only |

## 4. What UX0 measured, at the start head

Real-browser readings from the new [composition axis][axis] (1440×900 and 1024×768), recorded so the
later slices can be compared against them:

| Reading | 1440×900 | 1024×768 |
| --- | --- | --- |
| Homes declared | `head 1 · index 1 · stage 1 · card 1 · preview 1`, deck built with the Guide | same, deck 1 |
| Ordinary Deck (Guide band inside the Stage home) | 34 px · **3.8 %** of the viewport | 34 px · 4.4 % |
| Guide home (band over the viewport, `--guide-band-h` 202 px inset on the Card) | 201 px · **22.3 %** | 201 px · **26.2 %** |
| Deepest posture today (edge → coordination) | 299 px · **33.2 %** | not re-measured (UX6 owns the Journey band) |
| Nested scrollers inside the Deck | 0 | 0 |
| Document horizontal scroll | none | none |
| Stage resized by an invoked sheet | — | no (1024×702 before and after) |
| Authoring write/navigation from a layout change | none (source digest, history, selection and realized pose identical) | none |

Deviations and facts this inventory records rather than hides:

- **Five Preview entries existed at UX0** — Head `Preview`, Index `Preview Guide`, Deck `Preview Guide`,
  Stop Card `Preview Guide`, Index `Preview Experience`. UX1 consolidated them into the Head's one
  `Preview ▾` menu and now asserts it in both axes: `experience-shell-check.sh` for the control (one
  control, every scope inside it, closed behind the visit) and `locator-check.sh` for the scopes it
  offers and the strict “nothing outside the menu can start a visit”.
- **The band's worst measured share is 33.2 %** against the §6 40 % reservation at 1440×900 — it holds,
  with little headroom, before UX4/UX6 reorganise the Deck.
- **The Overview strip clamps its summaries**: `.stop-summary` renders 143 px of text in a 29 px box
  with `overflow-y: hidden`. That is a density fact, not a scroller; the strip it belongs to is
  retired by UX4 (the Guide Deck replaces it).
- **`data-home` and `data-deck-posture` are UX0 additions.** They name a home and a posture; they
  change no behaviour, no class and no layout. `data-home` values are the six homes of the frozen
  shell sketch: `head`, `index`, `stage`, `card`, `deck`, `preview`.

[plan]: ../../../docs/roadmap/p25-experience/design/experience-v2-prototype/ux-pruning-and-shell-reconciliation-plan.md
[axis]: ./experience-shell-check.sh

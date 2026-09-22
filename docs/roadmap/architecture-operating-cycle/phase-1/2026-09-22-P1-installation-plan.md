# Architecture Operating Cycle — Phase 1 installation plan (one bounded PR)

```text
STATUS:   DRAFT FOR INDEPENDENT REVIEW — plan only. Nothing in this document is installed,
          ratified or classified. Every classification, ruling and contract delta below is
          PENDING OWNER RATIFICATION at the gates in §10. Writing this plan does not advance
          PHASE_0_ACTIVE, ADJUDICATION or PHASE_1, and it is not Phase-0 evidence.
ROLE:     the implementation plan for one bounded Phase 1 PR, including the P23B → P26 lifecycle
          handoff reconciliation (§6) and the durable reminders that carry the remaining cycle
          actions through P23B, P26, Phase 3 and STEADY (§7).
NOT:      a second authority · a status tracker · an activity log · a contract · a ratification ·
          Phase-0 evidence · authorization to implement · a replacement for the Phase-0 outputs
OWNER:    coordination workspace (meta/phase1). The owner ratifies the candidate classifications,
          each contract delta, the guard correction and the PR scope.
STATE:    ../../operations/architecture-cycle.md   (sole live meta-state authority)
METHOD:   ../../architecture-operating-cycle-plan.md §8–§13 (canonical lifecycle rules)
EVIDENCE: ../architecture-operating-cycle/phase-0/review-a.md · review-b.md · structural-workflow.md ·
          mechanical-control-pass.md — frozen, independent, read as they stand; §2.3 records only
          evidence-reading notes about them, and never rewrites them
RANGE:    f8411f7..b5f75e7 (the frozen P23 range) for retrospective claims; current `main` HEAD for
          present behaviour, contracts and paths
```

**Read order for a reviewer:** §1 (what is already verified) → §2 (all ten architecture topics,
plus the separate contradictions set) → §3 (the junction ruling) → §4–§5 (workflow lane) → §6 (the
lifecycle defect this PR must fix) → §9 (the exact change set) → §10 (the owner gates). §§11–18 are
execution, verification and scope detail.

---

## 1. Verified planning basis

Everything below was checked at planning time; it is the factual floor the rest of the plan stands on.

```text
repository          branch main, HEAD 722280f (clean); no Phase-0 output file exists on main
evidence PRs        #77 review-a (draft) · #78 review-b (draft) · #79 structural-workflow (draft)
                    — all three frozen and pushed, mutually unread by their authors, open as drafts
                    and NOT merged; #75 (workspace) and #76 (mechanical pass) are merged
phase-0 workspace   ../architecture-operating-cycle/phase-0/ holds README.md, the frozen brief,
                    the frozen range and mechanical-control-pass.md; review-a.md, review-b.md,
                    structural-workflow.md and adjudication.md do not exist on main yet
live cycle state    PHASE_0_ACTIVE · OWNER ACTION: not required · VALIDATION WINDOW: empty ·
                    ACTIVE MECHANISMS: none
product state       P23 shipped; P23B planning (no approved child plan); P26 planning (no design
                    brief); pipeline P23 → P23B → P26 → P24 → P25
```

Current-behaviour facts this plan relies on (checked at HEAD, not taken from the reviews):

| Fact | Anchor at HEAD |
|---|---|
| The pure Layout planning boundary is real and broad: 41 `export function plan*` across 9 `packages/layout-core/src` modules | `grep -rn "^export function plan[A-Z]" packages/layout-core/src` → 41, 9 files |
| Vertical authority is Wall-owned and Floor-datum-only, documented only in code | `layout-wall-first-types.ts:35-38,129-142,199-214`; `layout-wall-heights.ts:1-30` |
| The persisted curve model is a `line` or `cubic-chain` centerline with Junction-owned endpoints and identity-less spans | `layout-wall-first-types.ts:66-122,144-156`; codec validates `spans.length === knots.length + 1` |
| Canonical Wall orientation (start → end) is stable and identity-bearing because Opening offsets are measured from start | `layout-wall-first-types.ts:10-16`; `persistence.md` "Opening `offset` = meters along a segment" |
| The reference ledger has **one shared** document-level `cursor`, not per-family cursors; it is persisted and optional-on-read | `layout-wall-first-types.ts:250-297` |
| Junction coincidence is a named 1e-9 identity tolerance, adopted by the chain, curve and curve-algebra planners | `layout-junction-identity.ts:1-17`; callers in `layout-wall-chain.ts` (12), `layout-wall-curve-algebra.ts` (3), `layout-geometry-curve.ts` (2) and the related curve modules |
| **No durable contract states the planner boundary, the vertical allocation, the curve model or the coincidence rule** | `grep -rn "coincid\|height" docs/reference/*.md docs/reference/components/*.md` → no qualifying clause; `persistence.md` says only "one floor datum, junctions → walls → reconciled rooms → openings" |
| The museum builder mirror **is** already asserted byte-identical | `apps/editor/tests/lib/editor/layout-mesh-parity.test.ts:133-135` (`ships the two builder copies byte-identical`); that file is not in `ARCH_FILES` (`apps/editor/test-lanes.ts`) |
| `$lib/layout` carries ~30 one-line whole-package compatibility facades beside real modules | `apps/editor/src/lib/layout/` (34 files); `persistence.md` states app layout paths are compatibility facades |
| The replacement-seam guard is a hard-coded expected count, not a derived predicate | `apps/editor/tests/lib/editor/app/hierarchy-projection.test.ts:2171` |
| The menu has five `onReset?.()` document-replacement seams; the guard names three imports explicitly and pins two app-level counts | `EditorProjectMenu.svelte:173,207,299,345,358` (scene import, layout import, layout reset, package import, scene reset) |
| `phase-closeout` allows a close only from `WAITING`, `PHASE_2_VALIDATING`, `STEADY` | `.agents/skills/phase-closeout/SKILL.md:68-81` |
| Early mechanism verdicts may enter `PHASE_3_EVALUATE` **before** the window closes, and the window phase still closes normally | `docs/operations/architecture-cycle.md:106-108` |

Two consequences worth stating before any ruling:

- **The capture gap is real and narrow.** The Layout planning boundary, the Wall vertical allocation
  and the persisted curve model are strongly documented *in code comments and slice plans* and absent
  from `docs/reference/*`. That is the "intended but undocumented" shape, not an accident, so the
  Phase 1 response is capture — not detection machinery.
- **P23B is the first product phase to run under an installed cycle.** Its owner-close must be legal
  while the cycle is still `PHASE_1` — installed, and ready for validation once the window phase's
  plan is reconciled. Today it is not closable (§6).

---

## 2. Architecture lane — all ten topics (PENDING OWNER RATIFICATION)

Reviewer A and Reviewer B are independent; they overlap on three topics and each has material the
other lacks. Their outputs are frozen and stay unedited. Below, the **ten architecture topics** are
unified by subject with both reviewers' identifiers kept; the historical written-rule contradictions
are recorded separately in §2.2, outside A/B/C/D. Every classification is a *proposal*.

Enums: **A** real unratified precedent · **B** intended but undocumented · **C** already caught ·
**D** not architecture.

| # | Topic | Evidence (frozen) | Proposed | Disposition |
|---|---|---|---|---|
| AC-1 | Layout semantic-planning boundary: topology-changing authoring operations are pure `layout-core` planners returning a planned replacement document or a named rejection; the editor owns interaction, transient preview, selection and the history transaction | A §2 (6 slice occurrences, P23.1→P23.6c; 41 `plan*` at end, 0 at base); B C1 | **B** | One clause in `docs/reference/architecture.md` (§9). **Explicitly not** a generic command framework, a shared result type or any protocol |
| AC-2 | Wall-owned vertical authority: `Wall.height` is the only authored vertical extent, `Floor.elevation` is a datum with no extent, a Room ceiling is the derived maximum of its boundary-wall heights, and new/split walls inherit height in layout-core | A §3 (`746aa16`, P23.6H/I); `layout-wall-heights.ts`; `layout-wall-first-types.ts:35-38,199-214` | **B** | One clause in `docs/reference/components/persistence.md` (§9), keeping the landed **one-floor** limit |
| AC-3 | Persisted canonical curve geometry: `line`/`cubic-chain` centerline, Junction-owned endpoints, identity-bearing interior knots, positional spans, stored control points authoritative on read, and stable Wall start→end orientation because Opening offsets measure from start | A §4 (`9118696`, P23.11); `layout-wall-first-types.ts:10-16,66-156` | **B** | One clause in `persistence.md` (§9). Read-path authority does **not** forbid the canonical compiler sampling a curve to render it |
| AC-4 | Display identity and its persisted reference ledger / single allocation cursor | A §5 (P23.12/P23.13); `shell.md` §Display identity (landed); `layout-wall-first-types.ts:250-297` | **C** for the behavior / **D** for the ledger and its single cursor | **No change.** The user-visible contract is landed and authoritative; the representation stays an implementation detail. Promoting it is an owner decision this plan does not propose |
| AC-5 | Junction coincidence: a draft endpoint within the identity tolerance adopts an existing Junction's stored coordinate and ID | B C2 (`d5ec0df`, `5f20aaa`, `89012d8`, `b5f75e7`); `layout-junction-identity.ts` | **B** | **Contract clause under ruling R1** — see §3. Adjudication cannot leave it open: canonical §8 requires a real precedent to be ratified or contracted against |
| AC-6 | New persisted fields take one of two treatments ("fresh-authority" vs "optional on read"), each *policy*-labelled in code, chosen per field | B C3 (`d36695c` → `d41cfd5` reversal in one day; `fa50564`; `810bc8c`) | **C** | **No clause.** The North Star's Development-stage schema compatibility rule already states the default and requires an explicit, documented product reason for an exception (`north-star.md:1145-1160`); a new sentence would duplicate that authority |
| AC-7 | The frozen museum relic keeps a hand-mirrored `wall-mesh-builder.ts` in lockstep with the editor | B C5; parity asserted at `layout-mesh-parity.test.ts:133-135`; the two files are blob-identical at base **and** at HEAD | **D** | **No change and no ratification.** The mirror predates P23 (present at `f8411f7`), so P23 formed no new precedent, and a parity assertion already exists. Lane membership of that parity test is a separate, owner-callable question — not a Phase 1 mechanism |
| AC-8 | The app-local `$lib/layout` family gains a whole-package "compatibility facade" for each new core module and holds editor-only Plan tuning | B C6; `apps/editor/src/lib/layout/` (34 files, ~30 one-line facades); `persistence.md` already says app layout paths are compatibility facades | **C** for the facade pattern / **D** for extending it to new modules | **No change.** Already-contracted compatibility behavior |
| AC-9 | Slice-numbered diagnostics and identifiers in production and shared-package APIs (`p2311*`, `__P2311_PERF__`) | B C7 (`6b71f53`, reused by `4cae710`/`bad5e89`) | **D** | **No change and no A ratification.** A bench/diagnostic naming accident with no architectural meaning; existing test-contract rule 16 already prefers durable names, and production naming is a naming question, not an architecture precedent |
| AC-10 | Scene canonical and legacy shapes share one runtime type; `roomId` presence (not `formatVersion`) selects the coordinate frame | B C4 (`41a5cde`); `persistence.md:8` CURRENT/LEGACY split | **C** for the boundary / **D** for the runtime discriminator | **No change.** The compatibility boundary is already contracted in `persistence.md`; the discriminator is a local encoding of it |

### 2.1 What is deliberately not proposed

```text
no generic command framework, planner base class or shared plan-result shape        (AC-1)
no multi-level / storey / slab vertical model                                       (AC-2)
no prohibition on the compiler sampling a curve to render it                        (AC-3)
no promotion of the identity ledger or its cursor                                   (AC-4)
no new clause for field evolution, facades, the relic mirror, diagnostic naming or
   the Scene dual shape                                                             (AC-6…AC-10)
no recurring semantic review, no standing audit, no schema/format change
```

### 2.2 Contradicted rules — recorded separately, not A/B/C/D

These are historical text conflicts, not architecture candidates; none is a Phase 1 mechanism.

| Contradiction | Text vs change | Status |
|---|---|---|
| X1 — the persistence contract said "no version field, no migrations" while wall-first `formatVersion`, migration and Scene `formatVersion: 1` were live (09-09 → 09-17) | `docs/components/persistence.md` (identical at `f8411f7`, `41a5cde`, `d41cfd5`, `810bc8c`, `368a799`) vs `13a96a0`, `41a5cde`, `d36695c`/`d41cfd5` | **Resolved inside the frozen range** by `650f7c1` (09-18), which rewrote the contract. A ~9-day overlap; no Phase 1 change |
| X2 — `AGENTS.md` hard rules 2 and 3 named superseded sources of truth while P23.0 changed them (09-09 → 09-17) | `AGENTS.md` (last changed 08-30) vs the P23.0 cutover | **Resolved inside the frozen range** by `650f7c1`. Caveat kept: the rules were already contradicted at `f8411f7`, so P23 widened a pre-existing drift |
| X3 — P23.0's cutover crossed the then-written Scene SoT and visitor-gating rules | A §6 (`41a5cde`, `b5427d8`, `2c9b04d`, `32b2e8f`) vs the same `AGENTS.md` rules | **Resolved inside the frozen range** by `650f7c1`; the direction itself was covered by the ratified North Star and the active P23.0 staged-rollout plans |
| Historical authority caveat (load-bearing) | Until `f7a31e2` (09-19), rule 10 placed "source code + tests" first **when live docs conflicted**; that helps interpret X1 but does not override `AGENTS.md`'s express precedence for its hard rules. X2/X3 remained hard-rule contradictions until `650f7c1` repaired the text. The ratified North Star and active P23.0 staged-rollout plans establish the intended direction, not authorization from rule 10 to ignore the interim contradiction | Carry the direction, contradiction and in-range repair into `adjudication.md` without calling the hard-rule drift precedence-resolved |
| Considered and **not** established | Visitor isolation vs the `layout-core` barrel (no chunk build performed); museum "frozen"/"read-only" vs source edits; the geometry boundary vs snap CSS-px parameters and dev-gated perf marks; test rule 16 vs production code (out of its stated scope) | Recorded, not resolved — no Phase 1 change either way |

### 2.3 Evidence-reading notes (about the frozen outputs)

How to read the frozen evidence, so two reviewers' units are not mistaken for a conflict. The frozen
outputs are not edited and nothing here is a finding.

1. **Reviewer A and Reviewer B agree on the planner count in magnitude** (41 exports) and this is
   independently reproduced at HEAD. Their module lists differ only because A counts modules and B
   counts landing commits. Reviewer B additionally counts **named** callers per export
   (one non-editor caller) — a per-symbol measure, not a whole-package import measure.
2. **The mechanical-pass defects corrected by `722280f` are pre-Phase-1 history**, and
   `structural-workflow.md` §7.4 already labels them as out-of-range context. Nothing here depends on
   an uncorrected number from that pass.
3. **`650f7c1` (#59, 09-18) is inside the frozen range** (`git merge-base --is-ancestor 650f7c1
   b5f75e7`), which is why §2.2's contradictions are recorded as in-range resolution evidence.

---

## 3. Junction coincidence — decided by ruling, not left open

`AC-5` is the one topic whose *product* meaning is still a decision, but adjudication cannot simply
leave it open: canonical §8 requires a real precedent to be either explicitly ratified or explicitly
contracted against. This plan therefore proposes a ruling and records the alternative.

### 3.1 The four distinctions the ruling must keep apart

```text
(1) numerical identity tolerance   JUNCTION_COINCIDENCE_EPSILON = 1e-9 absorbs numerical noise that
                                   cannot express a separate authored node; explicitly "an identity
                                   tolerance, not a screen-space acquisition radius and not a
                                   geometry/intersection tolerance" (layout-junction-identity.ts:1-9)
(2) accepted snapping              a snap suggestion that the user accepts adopts the winner's stored
                                   coordinate; accepting a snap therefore equals reusing its Junction
(3) committed Junction identity    connectivity authority is the Junction record; noding retires
                                   coincident duplicate records in favour of the kept one
                                   (layout-wall-chain.ts:609,637 — identity adoption, not a merge)
(4) core vs UI chain closure       the planner closes by coincidence (a final point coinciding with the
                                   first), while the UI run closes by Junction ID
                                   (resolvedEndJunctionId === runStartJunctionId)
```

### 3.2 Proposed ruling — R1 (recommended)

```text
R1  Resolution is global: at commit, a draft endpoint that falls within the 1e-9 IDENTITY tolerance
    of any Junction in the baseline adopts that Junction's stored coordinate and its ID, and
    connectivity follows from the committed record. That is a baseline-wide lookup.

    Retirement is scoped: when noding meets coincident duplicate records, only those participating in
    the committed relationship are retired in favour of the kept record. A baseline that already
    carried two records for one node is a pre-existing identity defect and is left untouched, because
    a draw must not rewrite walls the gesture never touched.

    Snapping is separate: an unaccepted snap suggestion, a hover/acquire radius and screen-space
    proximity have no effect by themselves. What connects is the COMMITTED coordinate falling within
    the identity tolerance — so exact or near-exact unsnapped input can connect, and that is stated
    plainly rather than implied.
```

R1 is capture (a **B** ruling), not new behavior: it describes what the planners already do, and it
puts the identity tolerance beside the North Star's proximity rule so the two are read together.
Residual risk to record, not hide: resolution is world-space and baseline-wide, so an unsnapped
near-exact point can join an existing node — the scoped paragraph limits what is *retired*, not what
is *found*.

### 3.3 Alternative and rejected options

| Option | What it would require |
|---|---|
| **R2 — accepted snap identity is mandatory.** Coincidence never joins topology; only an accepted snap reuses a Junction ID, and unsnapped coincidence must not connect | This **changes product behavior** → a P23B/P26 work item with its own acceptance cases, not a Phase 1 mechanism. Phase 1 would then record the ruling and the resulting work item instead of a clause |
| **R3 — leave open** | **Rejected:** the canonical plan does not allow a real precedent to be left unresolved, and an unclassified open candidate cannot complete adjudication |

Acceptance cases any ruling must be checked against — the test list under R1, and the recorded open
questions under R2: unsnapped exact-coordinate reuse; a third coincident record (pre-existing identity
defect, deliberately untouched today); migration output; duplicate/repeat output; preview abandonment
followed by commit; and the UI run's ID-based closure.

---

## 4. Structural-workflow lane — proposed disposition (PENDING OWNER RATIFICATION)

The diagnostic's own §6 is the input; the decision sequence in canonical §8 is the owner's. Proposed:

| # | Finding | Proposed disposition |
|---|---|---|
| WF-1 | Recurring graph-shaped question shape: "**which members of this set must change?**" over surfaces the change itself named (D2–D6, D7 partly). Six of ten demonstrated misses were answerable with installed tooling and were not answered | **Existing-tool / workflow correction — already applied in range. No new mechanism.** The corrections landed as verification discipline plus test-contract rules 3, 4, 7 and 16 (`38c5701`) |
| WF-2 | Checks that ran, reported clean, and were structurally blind or self-certifying (D8, D9, D10). The in-range correction was to the check: one resolution-based dependency predicate, mutation-proved call-site pins, a paired-clears structural test, a stateless ownership/overlap oracle | **Existing-tool / workflow correction — already applied. No new mechanism**, no persistent graph, no index, no custom platform |
| WF-3 | The single candidate where installed tools structurally cannot answer the question: the Navigator document-replacement seam guard (`hierarchy-projection.test.ts:2171`) asserts literal expected counts over component source | **Bounded correction proposed** — §5. Suspected, not demonstrated: no in-range instance slipped past it |
| WF-4 | Navigation capability itself | **No gap.** Criterion 4/§7.2: the read-side questions were answerable and were answered; cost-only observations do not establish a gap |

Consequence for Phase 1: the workflow lane contributes **one bounded test change and no tooling**.
If the owner declines WF-3, the workflow lane contributes nothing and that is a valid outcome — the
architecture lane still justifies Phase 1 through AC-1/AC-2/AC-3/AC-5 capture.

```text
NOT PROPOSED: a repository graph or persistent index · a recurring semantic audit · a speculative
guard · an eslint/dependency-cruiser/CI installation · a new script · ARCH_FILES membership change
```

---

## 5. Bounded correction of the Navigator replacement-seam guard

**The claim does not match the seams verified.** The test at
`apps/editor/tests/lib/editor/app/hierarchy-projection.test.ts:2171` is titled
`resets the Navigator on every document-replacing seam` and proves it with:

```ts
expect(appSource.match(/^\t\t\t?resetDocumentScopedState\(\);/gm)?.length).toBe(2);
expect(appSource.match(/onReset=\{resetDocumentScopedState\}/g)?.length).toBe(2);
expect(appSource).not.toContain('onReset={() => activeSelection.reset()}');
```

plus a companion `describe` covering three import functions. Verified against HEAD: the menu holds
**five** `onReset?.()` document-replacement seams — `importSceneJson` (via `store.importDocument(`),
`importLayoutJson` (via `requestLayoutImportReplacement(`), `resetLayout` (via `resetLayoutPreview(`),
`importPackageArchive` (via `store.importPackageArchive(`) and `resetScene` (via
`store.resetToCheckedInDocument(`) — while the guard names three imports explicitly. The app has
exactly two `onReset={resetDocumentScopedState}` props and two direct calls, which is what the counts
certify. A seam added anywhere else changes no count, so the pins cannot fail on it, and
`resetLayout`/`resetScene` are covered by no named assertion.

**Proposed change (bounded, no new mechanism):**

```text
1  Retitle and re-scope the test so its title names the surfaces it covers, e.g.
   "resets document-scoped Navigator state across the five current menu replacements and two shell
   replacement sites", and state the limitation inline: it does not discover a replacement type that
   bypasses those surfaces.
2  Replace the literal counts with derived predicates over the same named surfaces:
   (a) find the EditorProjectMenu instances in EditorApp.svelte; require at least one, require each
       to bind `onReset={resetDocumentScopedState}`, and reject any differently wired `onReset` prop
       in that app (fails on a missing or differently wired menu callback without a count of two);
   (b) every function in EditorProjectMenu.svelte that performs a document-replacing mutation —
       `store.importDocument(` · `requestLayoutImportReplacement(` · `resetLayoutPreview(` ·
       `store.importPackageArchive(` · `store.resetToCheckedInDocument(` — must call `onReset?.()`
       after the mutation. This covers all five current seams, including `resetLayout` and
       `resetScene`, which no named assertion covers today, and including layout import through
       `requestLayoutImportReplacement`;
   (c) find every `installLayoutPreviewBundle(` replacement site in EditorApp.svelte (currently
       `resumePendingCloudSave` and `loadProject`), require at least one, and require the owning
       function to call `resetDocumentScopedState()` after the install on its success path. This
       preserves coverage of the two shell entry points without freezing their count.
3  Keep the retired-pattern assertion; replace the companion `describe`'s literal prop count too.
   Drop raw counts unless the owner keeps one as an explicit change-detector with an honest comment.
4  Mutation proof recorded in the PR body, per test-contract rule 4: remove `onReset?.()` from
   `resetScene` → (b) fails and names that function; remove it from `importLayoutJson` → (b) fails on
   the `requestLayoutImportReplacement` seam; add a third seam wired as
   `onReset={() => activeSelection.reset()}` → (a) fails; remove one menu's `onReset` prop → (a)
   fails; remove `resetDocumentScopedState()` from each shell replacement site in turn → (c) fails
   and names its owning function; restore; unrelated controls green.
```

**Honest limit:** even corrected, the guard proves the menu's named replacement mutations and the
shell's `installLayoutPreviewBundle` replacement sites. It does not prove the seam *set* is complete —
the workflow diagnostic shows that set has no single denotation (import/reset via `onReset`, project
load via `installLayoutPreviewBundle`, pending-draft replacement, scene-JSON and archive import). The
corrected title and comment say exactly that.

**Lane membership: no change proposed.** Neither this file nor the existing
`layout-mesh-parity.test.ts` is in `ARCH_FILES`; moving either there would be a larger claim than the
evidence supports, and `ARCH_FILES` is a curated harvest-backed list.

---

## 6. Lifecycle correctness check — the P23B → P26 handoff

This is the required architecture/process correctness check. It is **not** Phase-0 evidence and not a
product finding: it is a defect in the installed cycle machinery, discovered by inspection.

### 6.1 The actual incompatibility (verified)

`.agents/skills/phase-closeout/SKILL.md:68-81` ("Preflight — stage compatibility") computes the legal
transition before any close write:

```text
WAITING            → PHASE_0_DUE
PHASE_2_VALIDATING → PHASE_3_EVALUATE
STEADY             → STEADY (unchanged; record the close only)
any other stage    → no legal transition      → STOP before any phase-status change
```

The ratified pipeline is `P23 (closed) → P23B → P26 → P24 → P25`, and the cycle sequence is
`ADJUDICATION → Phase 1 installed (PHASE_1, mechanisms listed, window selected) → P23B implementation
and owner-close while PHASE_1 remains in place → P26 first slice (only after its implementation plan is
reconciled and PHASE_1 says ready for validation) → PHASE_2_VALIDATING → … → P26 close →
PHASE_3_EVALUATE → verdicts → STEADY`. P26 plan reconciliation may land before or during P23B work;
it is a planning event, not a product close.

P23B is a real product phase and **not** the formal validation window (the expected window is P26).
Two distinct defects follow:

```text
(i)  PHASE_1 + P23B owner-close  → "any other stage" → STOP. The owner cannot legally close P23B,
     and PHASE_1 is exactly where the cycle must sit through P23B implementation.
(ii) PHASE_3_EVALUATE + the selected window's close → STOP. The cycle explicitly permits early entry
     to Phase 3 before the window closes (architecture-cycle.md:106-108) and says the window phase
     still closes normally, but the preflight blocks that close — the window could then never close
     at all, because PHASE_3 admits no legal transition today.
```

### 6.2 The smallest reconciliation

Precedent already exists in the same preflight: `STEADY → STEADY (unchanged; record the close only)`.
Phase 1 extends that exact shape, qualified by **window identity** rather than by phase count:

```text
WAITING                                                → PHASE_0_DUE    (any close; unchanged)
PHASE_1 | PHASE_2_VALIDATING | PHASE_3_EVALUATE,
  closing phase ≠ selected validation window            → same stage (unchanged; record the close
                                                          only; stage and window preserved)
PHASE_2_VALIDATING, closing phase = selected window      → PHASE_3_EVALUATE (existing rule, now
                                                          window-qualified)
PHASE_3_EVALUATE, closing phase = selected window        → same stage (unchanged; the window is now
                                                          CLOSED; verdicts stay owed)
PHASE_1, closing phase = selected window                 → no legal transition (STOP: the window
                                                          closed without ever starting)
PHASE_0_ACTIVE | ADJUDICATION, any close                 → no legal transition (unchanged)
STEADY, any close                                        → STEADY (unchanged; record the close only)
```

Why this is the right shape and not a loosening:

- It adds **no** automatic cycle transition. The owner-invoked closeout remains the writer; among
  installed stages, only the selected window's close can advance the cycle, in the one direction
  already ratified.
- It distinguishes the cases the current text conflates using a value the cycle file must hold anyway
  (`VALIDATION WINDOW`), so no new authority, tracker or field is created.
- `PHASE_0_ACTIVE`/`ADJUDICATION` deliberately keep **no** legal transition: implementation is gated
  behind adjudication (P23B README gate), so a product close landing there means the ratified
  SEQUENCE was violated — that should fail loudly, not pass quietly.
- It preserves the ratified product pipeline: P23B closes as an ordinary product phase, P26 remains
  the selected window, and the window can close from Phase 3.

Required supporting deltas (exact text in §9):

```text
architecture-cycle.md  PHASE_1 row: the required action names BOTH writes, because they are separate
                       events —
                         (a) the installation writes ACTIVE MECHANISMS and VALIDATION WINDOW, with
                             STATUS: mechanisms installed — window plan not yet reconciled;
                         (b) reconciling the window phase's prepared implementation plan writes
                             STATUS: ready for validation.
                       The canonical rule (plan §10) makes reconciliation part of the state, so (a)
                       must NOT report ready-for-validation. Its exit condition requires STATUS:
                       ready for validation BEFORE the selected window's first implementation slice
                       can move the cycle to PHASE_2_VALIDATING; P26's GATE states the same condition.
                       Transitions block: the same-state rows above, plus
                         PHASE_1 + window implementation plan reconciled → PHASE_1
                                                              (STATUS: ready for validation)
                         PHASE_1 + selected window's first implementation slice + STATUS:
                                   ready for validation → PHASE_2_VALIDATING
                         PHASE_1 + first slice while still installed-not-ready → STOP
                       VALIDATION WINDOW value convention:
                         empty                        … WAITING → ADJUDICATION
                         <phase> — selected, not open … PHASE_1
                         <phase> — open (started <date>) … from the window's first implementation slice
                                                      through PHASE_2_VALIDATING, and it STAYS open if
                                                      PHASE_3_EVALUATE was entered early
                         <phase> — closed (<date>)    … once the window phase itself closes
                       An **open** window with an empty mechanism list stays a defect.
                       PHASE_2_VALIDATING exit condition: window closes OR an early mechanism verdict
                       with its reason recorded.
                       PHASE_3_EVALUATE entry trigger: window closes OR an early verdict is recorded;
                       early entry leaves the window open until its phase closes. Its exit condition
                       requires verdicts recorded AND the window closed.
phase-closeout step 4  CYCLE TARGET enum gains `PHASE_1 (unchanged)`, `PHASE_2_VALIDATING (unchanged)`
                       and `PHASE_3_EVALUATE (unchanged; window closed)` beside
                       PHASE_0_DUE | PHASE_3_EVALUATE | STEADY
phase-closeout step 8  a same-state case writes no stage; it performs the "ensure value" pass (stage,
                       ACTIVE MECHANISMS intact). On BOTH window-close paths — the existing
                       PHASE_2_VALIDATING → PHASE_3_EVALUATE transition AND the same-state close from
                       an early PHASE_3_EVALUATE — it also flips VALIDATION WINDOW to `closed (<date>)`.
                       A non-window close in any installed stage changes no window value. Continue to
                       step 9 in every case: ensure the META pointer matches OWNER ACTION, including
                       the required Phase-3 verdict pointer after an ordinary window close.
canonical plan         one short strategic clause: a product phase may close during PHASE_1 /
                       PHASE_2_VALIDATING / PHASE_3_EVALUATE without advancing the cycle; and the
                       phase's readiness has two steps — mechanisms installed, then the window
                       phase's prepared implementation plan reconciled. Window closure and recorded
                       verdicts, never phase count, decide STEADY
```

**Not changed:** entry guard (owner-invoked only), owner-ratification requirement, steps 5–7, the
META-line condition, and the rule that only the authorized closeout procedure applies a close-driven
cycle transition. Phase-closeout's preflight is extended, never bypassed.

**Ordering inside the cycle.** The installation must not jump `PHASE_0_ACTIVE → PHASE_1`. The owner
rulings are made in `ADJUDICATION`, which requires the `PHASE_0_ACTIVE → ADJUDICATION` transition
first (stage, `OWNER ACTION: required`, the `current.md` META line). That transition is prerequisite
**E1** in §11 and is not part of the installation batch. `ADJUDICATION → PHASE_1` (or `→ STEADY`) is
then the owner's single overall transition, and the installation commit records it.

**Readiness has two steps, and installation is only the first.** Canonical §10 defines the
ready-for-validation state as *mechanisms installed **and** the validation-window phase's prepared
implementation plan reconciled once against them*. P26 currently has no design brief and no plan
(`p26-spatial-depth/README.md`: `STAGE: synthesis`, `NEXT: design brief`). So the installation commit
writes `STATUS: mechanisms installed — window plan not yet reconciled`, and `STATUS: ready for
validation` is written later, when P26's implementation plan is reconciled against the installed
mechanisms (the §7 P26 row owns that encounter). Treating the two as one event would report a
validation window that no plan yet exists to validate.

**Window selection stays the owner's.** This plan assumes **P26** as the selected window (the expected
window) and marks that as gate D8, not a decision. If the owner selects P23B instead, the existing
`PHASE_2_VALIDATING → PHASE_3_EVALUATE` row applies to P23B's close and P26's reconciliation line in
§7 changes accordingly.

### 6.3 Deterministic state-transition check (acceptance for §6)

Run as a table, not by judgement. Given a product phase close, with the cycle in the left column and
the closing phase named:

| Stage | Closing phase | Expected preflight result | Expected step 4 `CYCLE TARGET` |
|---|---|---|---|
| `WAITING` | any | `PHASE_0_DUE` | `PHASE_0_DUE` |
| `PHASE_1` | P23B (≠ window) | stage unchanged; window preserved | `PHASE_1 (unchanged)` |
| `PHASE_1` | P26 (= selected window) | **STOP** | none written |
| `PHASE_2_VALIDATING` | P26 (= selected window) | `PHASE_3_EVALUATE`; window flips to `closed` | `PHASE_3_EVALUATE` |
| `PHASE_2_VALIDATING` | a phase ≠ window | stage unchanged; window preserved | `PHASE_2_VALIDATING (unchanged)` |
| `PHASE_3_EVALUATE` (entered early) | P26 (= selected window) | stage unchanged; window now `closed` | `PHASE_3_EVALUATE (unchanged; window closed)` |
| `PHASE_3_EVALUATE` | a phase ≠ window (e.g. P24) | stage unchanged | `PHASE_3_EVALUATE (unchanged)` |
| `PHASE_0_ACTIVE` · `ADJUDICATION` | any | **STOP** | none written |
| `STEADY` | any | `STEADY` | `STEADY` |

One stage-internal event is not a close and gets no preflight row: `PHASE_1` + the window phase's
implementation plan reconciled → `PHASE_1` with `STATUS: ready for validation`. It is recorded by
the agent doing the reconciliation (the §7 P26 row), and it does not touch the stage. A first P26
implementation slice while `PHASE_1` still says installed-not-ready is a **STOP**, not the Phase-2
trigger; the cycle and P26 gate must both state this precondition.

The close preflight must STOP on two inconsistent states before computing: `PHASE_1` with an empty
`VALIDATION WINDOW`, or an **open** window with `ACTIVE MECHANISMS: none` (already a defect in the
cycle file). Separately, the `PHASE_3_EVALUATE → STEADY` transition requires **both** the window closed
and verdicts recorded. That condition applies only to this transition, so the windowless
`ADJUDICATION → STEADY` branch is unaffected.

Verification compares the skill preflight and steps 8–9, the cycle file's Transitions and affected
stage rows, and this table, with expected results recorded (§12, A1). A machine check is available as
an owner option (§10, D9) and is **not** part of the default scope: no existing test reads repository
docs or skills, so adding one would be a new mechanism the Phase-0 evidence does not justify.

---

## 7. Durable reminders — where each remaining action is encountered

A future agent must meet each remaining lifecycle action **through existing routing and gates**, not
from a parallel checklist. Each row names the milestone, the authority that owns the surface, and the
**smallest** edit that makes the action unavoidable. "No change" rows are deliberate: the action is
already owned and adding text would duplicate it.

| Milestone | Where the agent already is | Edit |
|---|---|---|
| Owner adjudication | `architecture-cycle.md` `ADJUDICATION` row + the `current.md` META line | **No change** — the row already requires the two-lane classification, and the META pointer is the mechanical route |
| Phase 1 PR accepted (installed) | `architecture-cycle.md` `PHASE_1` row (the installation transition writes it) | Row's required action names the fields written: `STATUS: mechanisms installed — window plan not yet reconciled`, `ACTIVE MECHANISMS: <per-mechanism>`, `VALIDATION WINDOW: <phase> — selected, not open`. It also names the second write, so "ready for validation" is not claimed here |
| P23B implementation | P23B README §`PHASE 0 GATE` | One line: the installed contracts apply to P23B work; material early evidence is recorded in P23B artifacts, and P23B does not open formal validation |
| P23B owner-close | `phase-closeout` preflight (§6.2) + P23B README close path | Same-state row; the P23B `PHASE CLOSE` block persists `CYCLE TARGET: PHASE_1 (unchanged)` — the durable record that the P26 trigger survived |
| P26 planning reconciliation (writes the ready state) | P26 README §`STATUS`/`GATE` + `architecture-cycle.md` `PHASE_1` row | One line: when P26's implementation plan is written or reconciled, account for the installed mechanisms, do not redesign P26 around them, and record `STATUS: ready for validation` in the cycle file — that reconciliation, not the installation, is what makes the window ready |
| First P26 implementation slice | P26 README `GATE` line + `architecture-cycle.md` `PHASE_1` exit condition | One line in P26 README: STOP while the cycle still says installed-not-ready; only after `STATUS: ready for validation` may the first implementation slice start `PHASE_2_VALIDATING` through the authorized procedure, recorded in the cycle file before implementation proceeds |
| P26 development | `architecture-cycle.md` `PHASE_2_VALIDATING` row | **No change** — it already says "none — observe" and names calibration on material scope change |
| P26 owner-close (window close) | `phase-closeout` preflight (window-qualified row) | Covered by §6.2; the window flips to `closed` |
| Early mechanism verdict | `architecture-cycle.md` `PHASE_2_VALIDATING → PHASE_3_EVALUATE` early-entry rule and both stage rows | Keep the early-entry rule; reconcile the Phase-2 exit and Phase-3 entry cells so an early verdict with its reason recorded can enter Phase 3 while the window remains open |
| Phase 3 owner decision | `current.md` META line → `architecture-cycle.md` `PHASE_3_EVALUATE` row | **No change** — the META pointer is the mechanical route and the row requires a verdict per mechanism |
| STEADY | `architecture-cycle.md` `STEADY` row + `PHASE_3_EVALUATE` exit | Exit sharpened to require window closure **and** recorded verdicts (§6.2) |
| Future ordinary phase closes | `phase-closeout` preflight `STEADY` row + cycle file | **No change** — already "reconcile · subtract · close work", never a new Phase 0 |

Ownership is respected: `roadmap/README.md` keeps P-level status (untouched — no phase is added or
reordered), phase READMEs keep phase-local gates, `current.md` keeps the baton, `architecture-cycle.md`
alone owns live meta-state, the canonical plan owns strategic rules, `phase-closeout` owns the applied
procedure, `docs/reference/*` owns landed contracts. **Nothing is injected into `AGENTS.md` startup,
ordinary slice boot context, or unrelated product tasks.**

---

## 8. Retained-mechanism register

Every mechanism the PR would install, with its origin, exact responsibility, verification, honest
limitation, expected cost and the eventual Phase 3 criterion. Verdicts are Phase 3's, not this PR's.

| ID | Mechanism | Originating failure | Responsibility | Verification | Limitation | Cost | Phase 3 criterion |
|---|---|---|---|---|---|---|---|
| M1 | Layout semantic-mutation clause (`architecture.md`) | P23.1→P23.6c planners recurred across six slices with no durable statement (AC-1) | Fix the layering rule only: canonical Layout semantic mutation is planned in layout-core, results and inputs stay operation-specific, and interaction/preview/selection/history stay in the editor | Doc clause reviewed against 41 planners at HEAD; Phase 2 asks whether a new operation was authored outside the boundary unnoticed | States a boundary, not a protocol; implies no shared result shape and no enforcement | ~6 lines | KEEP if P23B/P26 authors follow it without discussion; SIMPLIFY to one sentence if the effort/exception prose is unused; DELETE if it is never cited and ownership alone conveys it |
| M2 | Vertical-authority clause (`persistence.md`) | P23.6H/I made Wall height the only authored vertical extent; nothing durable said so (AC-2) | Persist the rule: Wall owns extent, Floor is datum, ceilings are derived; one-floor scope | Compared against `layout-wall-heights.ts` and the types header at HEAD | Says nothing about storeys/slabs; explicitly scoped to the landed one-floor model | ~4 lines | KEEP if a P26 vertical slice reads it before designing; SIMPLIFY when P26 supersedes it with a multi-level contract; DELETE then, not before |
| M3 | Persisted-curve clause (`persistence.md`) | P23.11 selected the persisted `line`/`cubic-chain` model; only the code and the slice plan said so (AC-3) | Persist the shape, the identity-bearing Wall direction (Opening offsets measure from start) and read-path authority | Compared against `layout-wall-first-types.ts:10-16,66-156` and the codec invariants at HEAD | Architectural wall centerlines only; transfers to no other curve consumer; does not constrain how the compiler renders | ~5 lines | KEEP if it prevents a re-fit/orientation regression in P23B/P26; DELETE if the code and API make it evident |
| M4 | Junction identity-tolerance clause (`persistence.md`) — **ruling R1** | P23.1→P23.15 commit-time coincidence identity exists in code and slice plans but in no reference contract (AC-5) | State the commit-time identity rule beside the North Star proximity rule: global resolution, participant-scoped retirement, and snapping kept separate | Clause checked against `layout-junction-identity.ts`, the global resolution site and the scoped retirement site; the §3.3 acceptance cases listed as the test surface | Resolution is baseline-wide and world-space, so a near-exact unsnapped point can join an existing node — stated, not hidden | ~5 lines | KEEP if P26 vertical work does not re-litigate identity; SIMPLIFY/DELETE if R2 is later adopted and the rule is replaced by mandatory snap identity |
| M5 | Bounded guard correction (§5) | D4/S1: a seam guard whose claim exceeded the seams it verified | Make a test's claim match what it verifies, deriving checks for all five menu mutations, their app callback wiring and the two shell replacement sites | Mutation proof for menu calls, callback wiring and each shell site + unchanged pass + full-suite run | Still cannot discover seams that bypass the named surfaces; the title and comment say so | ~45 lines in one test file | KEEP if it fails on a real future seam; SIMPLIFY to the derived predicates alone if the prose is unused; DELETE if it certifies nothing over behavioral coverage |
| M6 | Same-state close rule (§6.2) | Cycle-machinery defect found here: P23B could not close from `PHASE_1`, and the window could not close from an early Phase 3 | Let a product close (and the window's own close from Phase 3) record without advancing the cycle | The §6.3 truth table, checked line-by-line against the three documents | Adds same-state rows; the STOP cases stay deliberate | one table + ~10 lines | KEEP if P26's window opens and closes correctly after P23B closes; SIMPLIFY if window identity can be derived without the extra rows; DELETE never — a broken close path is worse than a redundant rule |
| M7 | Durable reminders (§7) | Installed mechanisms would otherwise be forgotten between Phase 1 and Phase 3 | Put each remaining action where the milestone is already read, including the ready-for-validation write | §12 A1–A3 and A10 (state/routing consistency checks) | Five one-line edits across three documents; each depends on its owning document staying authoritative | ~6 lines total | KEEP if a Phase 2/3 agent arrives without re-reading this plan; SIMPLIFY by removing lines never encountered |

Ruled **not installed** (recorded so the absence is deliberate): the new-persisted-field sentence
(AC-6 → C, no clause), the Scene dual-shape clause (AC-10 → C/D, no clause), the facade clause
(AC-8 → C/D, no clause), and any ratification of the relic mirror (AC-7 → D, no clause) or of
slice-numbered identifiers (AC-9 → D, no clause).

---

## 9. Exact file-level change set and ownership

```text
CHANGE  FILE                                                        OWNER / AUTHORITY
C1      docs/roadmap/architecture-operating-cycle/phase-0/
          adjudication.md                              (NEW)        coordination (its assigned
                                                                   destination); owner adjudication
C2      docs/roadmap/architecture-operating-cycle/phase-1/
          2026-09-22-P1-installation-plan.md           (this file, already in this PR)
C3      docs/reference/architecture.md                (EDIT)       landed architecture contract — M1
C4      docs/reference/components/persistence.md      (EDIT)       persisted-format contract — M2, M3,
                                                                   M4 (AC-6/AC-8/AC-10 add nothing)
C5      apps/editor/tests/lib/editor/app/
          hierarchy-projection.test.ts                 (EDIT)       test-design authority
                                                                   (apps/editor/tests/README.md) — M5
C6      .agents/skills/phase-closeout/SKILL.md        (EDIT)       applied close procedure — M6
C7      docs/operations/architecture-cycle.md         (EDIT)       live meta-state — PHASE_1 install,
                                                                   transitions, window values — M6, M7
C8      docs/roadmap/architecture-operating-cycle-plan.md (EDIT)    canonical lifecycle rules — one
                                                                   strategic clause + one artifact
                                                                   route in §13 — M6, M7
C9      docs/roadmap/p23b-geometry-performance/README.md (EDIT)     phase-local gates — M7
C10     docs/roadmap/p26-spatial-depth/README.md       (EDIT)       phase-local gates — M7
C11     docs/operations/current.md                      (EDIT)       product baton — reconcile the
                                                                   cycle sentence; META line follows
                                                                   OWNER ACTION
```

Clause text to be installed (draft — the owner's wording wins at gate D3):

```text
C3 architecture.md §Ownership / §Geometry boundary (M1):
  "Canonical Layout semantic mutation is planned in @portfolio/layout-core: each operation has its own
   pure planning function that accepts the state the decision needs (the canonical layout document or
   its compiled geometry) and returns either a planned result or a named rejection. The editor owns
   interaction, transient preview, selection and the single history transaction. This is a layering
   boundary, not a protocol: inputs and results stay operation-specific — a topology-changing operation
   plans a replacement document with changed-object lineage, an alignment or measurement operation
   plans a value for the editor to apply, and neither shape is imposed on the other — and no shared
   result type, base class or command framework is required or implied. Scene edits are not covered by
   this clause."

C4 persistence.md §Layout (M2):
  "Vertical authority: LayoutWall.height is the only authored vertical extent, measured upward from the
   Floor elevation; the Floor carries a horizontal datum only (elevation, no vertical extent), and a
   Room ceiling is derived as the maximum of its boundary Wall heights. New and split Walls acquire
   height through layout-core's birth/inheritance rule. The landed model is one floor — this records
   the P23 allocation, not a multi-level model."

C4 persistence.md §Layout (M3):
  "Canonical Wall geometry: centerline is either a straight line between its Junctions or a
   cubic-chain. Endpoints are Junction-owned; interior knots carry stable identity; spans are
   positional (spans.length === knots.length + 1) and carry no identity of their own. Wall orientation
   (start → end) is stable and identity-bearing, because Opening offsets are measured from start. The
   stored control points are the read-path authority: consumers read them rather than re-fitting or
   reconstructing canonical geometry — the canonical compiler may sample a curve in order to render it."

C4 persistence.md §Layout (M4 — ruling R1):
  "Junction identity at commit. Resolution is global: a draft endpoint falling within the 1e-9
   identity tolerance of any Junction in the baseline adopts that Junction's stored coordinate and ID,
   and connectivity follows from the committed record. Retirement is scoped: when noding meets
   coincident duplicate records, only those participating in the committed relationship are retired in
   favour of the kept record, and a baseline already carrying two records for one node is a
   pre-existing identity defect that a gesture must not silently rewrite. This is an identity tolerance
   only — an unaccepted snap suggestion, a hover/acquisition radius and screen-space proximity have no
   effect by themselves — but the committed coordinate is what connects, so exact or near-exact
   unsnapped input can join an existing Junction, deliberately."
```

---

## 10. Owner decision gates (must be resolved before implementation)

| ID | Decision | Blocks | Recommendation |
|---|---|---|---|
| D1 | Scope and timing: one bounded installation PR, **after** the `PHASE_0_ACTIVE → ADJUDICATION` transition (§6.2 ordering, prerequisite E1) and the corrected candidate table; installation leaves `PHASE_1` installed, and "ready for validation" is a separate later write | all implementation | Approve as scoped; no direct jump to `PHASE_1`; no ready claim at installation |
| D2 | Classifications for all ten topics: AC-1/AC-2/AC-3 **B** · AC-4 **C/D** · AC-5 **B** (with the R1 ruling) · AC-6 **C** · AC-7 **D** · AC-8 **C/D** · AC-9 **D** · AC-10 **C/D**; X1–X3 kept as resolved historical contradictions outside A/B/C/D | C1, C3, C4 | As listed |
| D3 | Clause wording for M1–M4 | C3, C4 | As drafted — M1 describes the layering boundary only and prescribes no input or result shape (alignment returns a value, topology planners return a document); M2 keeps the one-floor limit; M3 adds the identity-bearing direction and permits compiler sampling; M4 separates global resolution from scoped retirement |
| D4 | AC-6: **no clause** — the North Star already owns the default and the exception requirement | C4 | No clause |
| D5 | AC-7/AC-8/AC-9/AC-10: no clauses and no A ratification; the relic mirror and diagnostic naming stay **D** | C3, C4 | No clauses |
| D6 | Junction coincidence: **R1** (commit-time identity tolerance ratified as a clause — global resolution, scoped retirement, snapping separate, unsnapped coincidence can connect) or **R2** (accepted snap identity mandatory → a recorded product work item, no clause) | C4, possibly a new work item | **R1** |
| D7 | Workflow lane: approve "no custom tool, corrections already applied" plus the §5 guard correction covering all five menu seams, callback wiring and both shell replacement sites; confirm no `ARCH_FILES` change | C5 | Approve §5; keep lane membership |
| D8 | Lifecycle/window: select **P26** as the formal window; allow P23B's close to leave `PHASE_1` and its window unchanged; split installed from ready-for-validation, require the ready status before Phase 2, and let the window-plan reconciliation write it; reconcile early Phase-3 entry in the stage rows; add the early-Phase-3 window-close path, mark the window closed on both close paths, and continue through META step 9; require window closure **and** verdicts for `PHASE_3_EVALUATE → STEADY` only | C6, C7, C8, C9, C10 | Approve as specified |
| D9 | Optional: a machine doc-consistency test for the transition table | C5 scope only | Decline for now; the deterministic checks in §12 A1 suffice until Phase 0 justifies a guard |
| D10 | Confirm the direct-to-STEADY branch stays legal: if adjudication justifies no mechanism, this plan is not executed | this PR's implementation | Confirm |

The real owner choices reduce to four: **the Layout planner boundary**, **which landed Wall
representation facts become durable**, **junction-coincidence semantics**, and **P26 as the window**.
The remaining gates can be settled from existing evidence and authority.

---

## 11. Ordered implementation slices inside the single PR

The PR is docs-plus-one-test; each slice is a separate commit and independently revertable. Nothing
below is started by this plan.

```text
E1  prerequisite     NOT part of this batch. Once both lanes' frozen evidence is integrated
                     (#77/#78/#79 merged), the cycle moves PHASE_0_ACTIVE → ADJUDICATION through the
                     authorized transition: STAGE, TRIGGER, OWNER ACTION: required, and the current.md
                     META line. The owner's rulings are made there. Without E1, the installation would
                     jump from PHASE_0_ACTIVE to PHASE_1 and skip the stage in which adjudication is
                     owner-required. GATE: evidence frozen.
S0  dependency      merge main (with #77/#78/#79) into meta/phase1. No file change.
                    GATE: adjudication links cannot resolve before this.
S1  adjudication    C1 — write adjudication.md: the ten topics with their classifications, per-topic
                    evidence links to the frozen outputs, counterevidence kept beside each, the
                    §2.2 contradictions set with its historical authority caveat, the §2.3 notes, the
                    rulings, and the register's origin column.
                    GATE D2, D4, D5, D6, D7.
S2  contracts       C3, C4 — the minimal reference deltas only (M1–M4 as ruled). No clause without a
                    gate. GATE D3, D4, D5, D6.
S3  guard           C5 — the bounded test correction covering the menu, its app wiring and the shell
                    replacement sites, with mutation proof recorded in the PR body.
                    GATE D7. Independent of S4–S5: may be dropped alone.
S4  lifecycle       C6, C8 — preflight rows (including the Phase-3 window close), CYCLE TARGET enum,
                    step-8/step-9 continuity, Phase-2 exit and Phase-3 entry cells, the Phase-1
                    ready-status precondition, and one canonical-plan clause. GATE D8.
S5  installation    C7, C9, C10, C11 — one atomic commit: cycle file → PHASE_1 with ACTIVE MECHANISMS,
                    VALIDATION WINDOW (selected, not open), STATUS: mechanisms installed — window plan
                    not yet reconciled, OWNER ACTION: not required; META line removed if present; P23B
                    gate line, P26 gate lines and the baton's cycle sentence reconciled. This commit
                    does NOT report ready-for-validation (canonical §10): that is a later write made
                    by whoever reconciles P26's implementation plan against the mechanisms.
                    GATE D1, D8. This is the only commit that changes live state.
S6  routing        C8 §13 route line for the phase-1 plan (may fold into S4) — discovery for the
                    installed plan without touching the cycle file's three-seam ROUTES rule.
```

Order is deliberate: adjudication precedes the contract changes it justifies, the lifecycle rule
precedes the transition it governs, and the single live-state commit lands last so a mid-batch stop
never leaves the cycle pointing at a mechanism that was not installed.

---

## 12. Acceptance criteria and verification

```text
A1  Transitions agree. Compare closeout preflight and the §6.3 close table for the same-state rows
    (non-window close in each installed stage, the window close from an early Phase 3, STEADY), the
    PHASE_2_VALIDATING window close and the STOP cases. Separately compare architecture-cycle.md's
    Transitions and stage rows to §6.2–§6.3 for the Phase-1 reconciliation write, the ready-status
    precondition on entry to Phase 2, and early Phase-3 entry while the window remains open. Verify
    both window-close paths continue through step 9 and preserve the OWNER ACTION ↔ META invariant;
    record the expected values in the PR.
A2  State consistency. After S5 no document says PHASE_0_ACTIVE or ADJUDICATION as the current stage;
    architecture-cycle.md, current.md, P23B README, P26 README and roadmap/README.md agree on stage,
    mechanism list and window value; PHASE_1 shows the window as selected-not-open and its STATUS as
    installed-not-yet-reconciled; no document claims ready-for-validation or that Phase 2 has started.
A3  Field semantics. "selected", "open" and "closed" are distinct in the cycle file; an open window
    with no mechanisms remains a defect; PHASE_1 with no selected window is a STOP condition; the
    closed-window requirement applies to the PHASE_3_EVALUATE → STEADY transition only, so
    ADJUDICATION → STEADY (no window ever opened) is unaffected; and both window-close paths — the
    PHASE_2_VALIDATING transition and the same-state close from an early PHASE_3 — flip the value.
A4  Guard correction. The retitled test passes unmutated and its title names the five menu seams and
    two shell replacement sites. Removing `onReset?.()` from resetScene or importLayoutJson fails a
    named menu assertion; a third differently wired menu callback or a missing menu callback fails the
    app-wiring predicate; removing `resetDocumentScopedState()` from either shell replacement site
    fails a named shell assertion. The predicates are non-vacuous and unrelated controls stay green.
A5  Contracts. Each installed clause (i) cites the P23 revision it derives from, (ii) is verified
    against the named source at HEAD, (iii) makes no claim beyond the landed model, (iv) is shaped as
    rule / why / limits, and (v) does not prohibit compiler sampling for rendering.
A6  No duplication. No new tracker, dashboard, roadmap, tool or permanent process tier appears; the
    plan itself does not restate live status; the canonical plan is not duplicated.
A7  Existing live copies updated: SEQUENCE stays the single authority in the P23B README; the P23B gate
    text no longer blocks on a completed stage; the E1 transition is recorded before S5 runs.
A8  Verification run: `npm test` (complete suite) · `npm run check` · `npm run test:arch` (never
    path-gated). The test change alone is not sufficient evidence for a PR.
A9  Subtract. The PR leaves no superseded sentence behind: every sentence replaced in C3–C11 is
    rewritten in place rather than appended to.
A10 Readiness. The installed state and the ready-for-validation state are distinct everywhere: S5's
    commit does not claim the latter, and the reconciliation write (P26 plan reconciled against the
    mechanisms) is the only thing that produces it. A first P26 implementation slice while the cycle
    still says installed-not-ready is a STOP in both the cycle transition and the P26 gate.
```

Because the deliverable is a process change, A1–A3 are deterministic documentation/state-transition
checks rather than executable tests — with the exact expected values printed here so a reviewer can
falsify them. A9 exists because the Phase 3 rule is subtraction, and the install should not start that
debt.

---

## 13. Reversible failure handling

```text
stop before E1    nothing installed and no cycle move; the plan PR may merge as a plan only, or stay
                  draft. The cycle is still PHASE_0_ACTIVE.
stop after E1     the cycle is ADJUDICATION with OWNER ACTION: required and a META line — a legal,
                  self-consistent state that simply awaits the owner's rulings. No mechanism is named.
stop after S1     state untouched; adjudication.md exists (a record, not state; re-committing is
                  idempotent).
stop after S2/S3  contracts or test change landed without state: legal and independently revertable.
                  The stage is unchanged, so ACTIVE MECHANISMS cannot yet name an uninstalled mechanism.
stop inside S4    the skill/plan text may change before the cycle does. Safe by construction: the
                  preflight is read only at a close and its new rows are additive. Recovery: re-run the
                  edit or revert C6/C8; no state field references the preflight text.
stop inside S5    the only risky point. S5 is one commit for that reason: either the cycle is PHASE_1
                  installed (mechanisms, selected window, reconciled dependents) or nothing changed.
                  If the commit is undone, the cycle returns to the previously persisted stage
                  (ADJUDICATION); re-apply S5 once, never partially. The installation is "ensure
                  value", so a second run writes the same values.
stop at ready     S5 done but P26 has no reconciled plan: the cycle legitimately stays PHASE_1 with
                  STATUS: mechanisms installed. Nothing is broken and nothing is owed to Phase 2 —
                  the stage simply has not reached its ready state.
reverting S5 only  leaves contracts/guard (S2/S3) landed while the cycle returns to ADJUDICATION:
                  acceptable, because M1–M5 are reference/test changes and reference contracts are
                  authoritative only for what actually landed. Record the split in adjudication.md.
never             leave ACTIVE MECHANISMS naming a mechanism whose contract delta was reverted or never
                  gated; leave a META line while OWNER ACTION is `not required`; run S5 without E1; or
                  claim the lifecycle is complete because this PR merged.
```

---

## 14. Non-goals and scope exclusions

```text
NOT  a generic command framework, planner interface, base class or shared plan-result shape
NOT  a persistent graph, index, dependency tool, eslint/dependency-cruiser install, CI, or script
NOT  a recurring semantic audit, standing review ritual, or speculative guard
NOT  a new status tracker, dashboard, process tier, standing roadmap or cycle field without a job
NOT  an ARCH_FILES/lane-membership change (owner option only)
NOT  product-scope mutation: no P23B or P26 implementation, no performance work, no schema,
     persisted-format, route or capability change, no P23 reopened decision
NOT  the R2 junction behavior change (it would be a recorded work item, not a Phase 1 clause)
NOT  promotion of the identity ledger/cursor, the compatibility facades, the relic mirror, the
     slice-numbered diagnostic names, or the Scene runtime discriminator
NOT  a multi-level vertical model, storey/slab generalization, or a NURBS/CAD curve model
NOT  rewriting, re-scoring or summarising the frozen Phase-0 outputs; the notes in §2.3 and
     adjudication.md annotate how to read them
NOT  executing the direct-to-STEADY branch, or pre-empting the owner's adjudication by installing
     mechanisms "in anticipation"
NOT  any change to AGENTS.md startup, ordinary slice boot context, or unrelated product tasks
```

---

## 15. Completion semantics — five different checkpoints

```text
PHASE 1 INSTALLED    approved mechanisms installed · contracts updated and verified · live state
                     consistent · the cycle is PHASE_1 with ACTIVE MECHANISMS listed, VALIDATION
                     WINDOW selected-but-not-open, and STATUS: mechanisms installed — window plan not
                     yet reconciled. This is what the installation commit produces.
                     Phase 1 installed does NOT mean Phase 2 started, NOT that the window is ready,
                     and NOT that P23B is unblocked by anything other than its own gate.

PHASE 1 COMPLETE     the selected window phase's prepared implementation plan has been reconciled
                     once against the installed mechanisms, and the cycle records STATUS: ready for
                     validation — mechanisms installed, window selected, still not open, stage still
                     PHASE_1. Only here does the canonical ready-for-validation state exist.

PHASE 2 STARTED      after PHASE_1 records STATUS: ready for validation, the first implementation
                     slice of the explicitly selected window (P26) begins, and the transition to
                     PHASE_2_VALIDATING is recorded through the authorized procedure. P23B's close,
                     and any other non-window close, does not start it.

PHASE 3 TRIGGERED    either the validation window closes through the owner-invoked phase-closeout
                     procedure (expected: P26's owner-close), or a reasoned early mechanism verdict
                     moves the cycle here while P26 remains open. In the early case P26 still closes
                     normally afterwards. Remaining verdicts per mechanism stay owed.

PROJECT COMPLETE     Phase 3 verdicts (KEEP / SIMPLIFY / DELETE per mechanism), the window recorded
                     as closed, subtraction of obsolete authority, and the STEADY transition are
                     recorded. Only then is the architecture-cycle design project over.
```

**Merging this PR does not complete the lifecycle, and it does not even reach "ready for
validation".** It installs the response to Phase 0; readiness waits on P26's plan reconciliation, and
the later completion records are the P23B close (`CYCLE TARGET: PHASE_1`), the P26 window's first
slice, the P26 close, the Phase 3 verdicts and the STEADY transition.

### 15.1 Recorded future opportunity (non-blocking, not authorized here)

Once STEADY is reached and the method has been kept/simplified, the proven operating method may be
extracted as a repository-independent template. That extraction is a *later* decision with its own
evidence; it authorizes nothing now. **No framework, portability package or abstraction layer is built
during Phase 1**, and no Phase 1 change is justified by future portability (canonical §9 custom-tooling
rule 6).

---

## 16. Residual roadmap after this PR

```text
immediately after merge   cycle = PHASE_1 installed — mechanisms listed, window selected, status
                          "window plan not yet reconciled" (NOT yet ready for validation)
next product work         P23B planning continues (SEQUENCE step 4 onward); the installed contracts
                          apply to P23B work; early material evidence recorded in P23B artifacts
parallel                  P26 design brief, then implementation-plan reconciliation against the
                          installed mechanisms → PHASE_1 STATUS: ready for validation
window opens              first P26 implementation slice → PHASE_2_VALIDATING, window open
window closes             P26 owner-close (from PHASE_2 or from an early PHASE_3) → window recorded
                          closed on either path → PHASE_3_EVALUATE once the stage is not already there
finish                    Phase 3 verdicts → subtraction → STEADY
carried forward           · the R2 alternative, if the owner prefers mandatory snap identity: recorded
                            as a product work item with its acceptance cases (§3.3)
                          · the AC-7 parity test's lane membership, if the owner wants it always-on
                          · the guard's stated limitation (recorded in the test comment)
                          · P23's 13 owner-carried verification rows and 5 deferred debt items —
                            untouched by this PR and not claimed by it
discovery                 live stage and fields      → architecture-cycle.md
                          which mechanism and why    → adjudication.md + the §8 register
                          the P23B gate              → p23b-geometry-performance/README.md
                          the window transitions     → p26-spatial-depth/README.md + phase-closeout
                          the strategic rule         → architecture-operating-cycle-plan.md
                          this plan                  → routed from the canonical plan's artifact list
```

---

## 17. Traceability — topic → disposition → change

| Topic | Reviewer(s) | Classification | Disposition | Change | Gate |
|---|---|---|---|---|---|
| AC-1 Layout planner boundary | A §2 · B C1 | B | Contract clause: layering only, operation-specific inputs and results | C3 | D2, D3 |
| AC-2 Wall vertical authority | A §3 | B | Contract clause, one-floor limit | C4 | D2, D3 |
| AC-3 persisted curve model + Wall direction | A §4 | B | Contract clause (direction; sampling allowed) | C4 | D2, D3 |
| AC-4 identity ledger / single cursor | A §5 | C / D | No change; not promoted | — | D2, D5 |
| AC-5 junction coincidence | B C2 | B | Ruling **R1** captured as a clause (R2 = product work item) | C4 | D2, D6 |
| AC-6 field evolution treatments | B C3 | C | No clause — North Star owns it | — | D2, D4 |
| AC-7 relic mirror | B C5 | D | No change, no ratification; parity already asserted | — | D2, D5 |
| AC-8 compatibility facades | B C6 | C / D | No change — already-contracted compatibility | — | D2, D5 |
| AC-9 slice-numbered diagnostics | B C7 | D | No change, no ratification | — | D2, D5 |
| AC-10 Scene dual shape | B C4 | C / D | No change — boundary already contracted | — | D2, D5 |
| X1–X3 contradicted rules | A §6 · B X1/X2 | separate set | Repaired in-range by `650f7c1`; historical hard-rule contradiction and authority caveat recorded without claiming precedence authorized it | C1 | D2 |
| WF-1 set-enumeration misses | C §6 | — | Existing workflow correction, already applied | — | D7 |
| WF-2 blind/self-certifying checks | C §6 | — | Existing correction, already applied | — | D7 |
| WF-3 Navigator seam guard | C §4.1 (S1) | — | Bounded correction, five menu seams, app wiring and both shell replacement sites | C5 | D7 |
| WF-4 navigation reach | C C1/C4 | — | No gap | — | D7 |
| Cycle close defects (i) and (ii) | found here (§6) | — | Same-state close rule + window values + ordering E1; installed/ready split; window closed on both close paths | C6, C7, C8, C9, C10 | D1, D8 |

No topic is dropped silently; every "no change" row carries its reason in §2, §3, §4 or §8.

---

## 18. Self-check against the plan-quality rules

```text
all ten architecture topics present, contradictions recorded separately   ✓ §2, §2.2
does not duplicate live status        ✓ live state is cited, never restated; §7 routes to it
does not invent an authority          ✓ every change lands in the document that already owns it
does not mutate product scope         ✓ no product behavior, schema, route or performance change;
                                        R2 is recorded as a work item, not smuggled in
does not restart diagnosis at P23B close ✓ no Phase 0, no audit, no auto-transition
does not resolve owner decisions      ✓ classifications, clauses, ruling and scope are gated (§10)
does not duplicate the canonical plan ✓ §6 quotes only the one preflight block it must change
keeps frozen evidence intact          ✓ reading notes in §2.3 and adjudication.md; reviews unedited
is reviewable as one PR               ✓ 11 files, one of them a test; S5 is the only state commit
```

If adjudication ultimately justifies **no** mechanism, this plan is simply not executed: the cycle goes
`ADJUDICATION → STEADY` and P23B is unblocked without Phase 1. That branch stays legal and unmodified.

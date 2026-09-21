# Architecture Operating Cycle — Workflow Harvest

Prerequisite 2 of `architecture-operating-cycle-plan.md`. This is a workflow
harvest, not a product-code harvest and not Phase 0.

## 0. Scope and evidence

```text
MAIN SHA:   bac8858e8d6b160e71b115d4de6304a5be17dbcd
            = merge of PR #65 (docs: remove the mandatory slice-README layer)
TREE:       clean; branch head == main head at harvest time
METHOD:     read live artifacts + bounded Git history (representative commits only)
REVISION:   r2 — owner review at 9aa3ca1 applied (four findings + two wording corrections);
            the two lifecycle questions that review re-opened are recorded in §15
            "Withdrawn in review". Findings still labeled CURRENT / REQUIRED BY RATIFIED
            PLAN / IMPLEMENTATION GAP.
```

**Post-harvest resolution (2026-09-21, added after `b2aa383`; the harvest body is unchanged).**
This harvest was written before the owner decisions and remains correct as pre-decision evidence.
The open questions it recorded have since been settled by owner ruling and folded into current
authority, which now owns them:

```text
canonical strategic meaning       → architecture-operating-cycle-plan.md
applied close / anchor mechanics  → .agents/skills/slice-closeout/SKILL.md
current live cycle state          → docs/operations/architecture-cycle.md
```

In particular, the **closed-work mechanism** this harvest deliberately left neutral — the
"mechanism still an owner choice" cell in §12, the owner-preference note in §7.2, §15 Q4, and
the major-unknown list in the verdict — was ratified as the **hybrid** model: a path-preserving
compact stub at the artifact's original path plus a `git show <A>:<path>` exact-recovery line,
with an archive copy only for multi-file bundles and non-text evidence. The authoritative close
event (§15 Q1/Q2) and the next phase's state and sequencing (§15 Q3), and Q5–Q9, were likewise
settled and folded into those owners. The owner-decision record lived in the now-closed
implementation plan, which is historical evidence only and prescribes nothing. Read the items
below as the pre-decision record they are.

**Read in full:** `AGENTS.md`, `docs/README.md`, `docs/roadmap/README.md`,
`docs/roadmap/architecture-operating-cycle-plan.md`, `docs/operations/current.md`,
`.agents/skills/slice-closeout/SKILL.md`, `.agents/skills/work-checkpoint/SKILL.md`,
`docs/archive/README.md`, `docs/operations/checkpoints/README.md`,
`docs/operations/tech-debt/README.md`,
`docs/roadmap/p23-layout-depth/README.md`,
`docs/roadmap/p26-spatial-depth/README.md`,
`docs/roadmap/p23-layout-depth/2026-09-08-P23.16-final-whole-product-integration-closeout.md`,
`docs/roadmap/p23-layout-depth/2026-09-14-P23-remaining-roadmap-reconciliation.md` (head + §),
`apps/editor/tests/README.md`, `apps/editor/test-lanes.ts`, vitest lane configs,
root + editor + museum `package.json` scripts.

**Git history inspected (representative, not exhaustive):** `94ae0a2` (P23.13 slice close),
`62b2ebd` (P23.14 owner re-scope), `f7a31e2` (durable contract promotion),
`02744b2` (owner ruling R4 captured), `953d5af` (reference reconciliation + QA record),
`a479f78` (PR #61 merge), `2716f61` (PR #57 junction-dissolve merge),
`d68ae79` + `38c5701` (test-suite refactor closeout + rule promotion),
`650f7c1` (PR #59 docs restructure, introduced the current topology),
`f8411f7` (P22 shipped — last historical phase close), `a96f35d` (P11 close),
`1492860` (P20 ship), `ca23956`/`0d8bd0f`/`d1201ca` (PR #65).

**Explicit exclusions:** no Phase 0 execution; no A/B/C/D classification of history;
no 30–60-PR semantic sweep; no Layout/Scene implementation archaeology; no writer-set
selection; no changes to any live router, skill, or roadmap scope. `Repo-Audit/**` and
`docs/archive/**` were read only for the closed-work/evidence question in §7.

`CURRENT` / `REQUIRED BY RATIFIED PLAN` / `IMPLEMENTATION GAP` labels are used
throughout and never blurred.

---

## 1. Current documentation authority model

### 1.1 Fact owners (CURRENT)

| Artifact | Owns today | Anchor |
| --- | --- | --- |
| `AGENTS.md` | bootstrap, hard rules (no commits, one nav/motion, one authored project, visitor isolation), authority-by-concern rule, boot contract | `AGENTS.md` rules 1–10, `## Boot contract` |
| `docs/README.md` | context router: reading depths, "where truth lives" table, promote/don't-promote rules, update-rule list | `## Update rules` |
| `docs/roadmap/README.md` | **P-level** status + order only; pipeline; status enum; "authoritative when a plan doc's `**Status:**` drifts"; `META` pointer; `OPS` pointer | `docs/roadmap/README.md` |
| phase `README.md` | phase goal/invariants, child status + order, `CURRENT`/`NEXT`/`GATE`, direct routes to exact artifacts | `docs/roadmap/p23-layout-depth/README.md` |
| exact plan / QA / context artifact | its own slice scope, decisions, task sequence, acceptance rows, dated QA findings | `…/p23.14-shell-visual-system/2026-09-19-P23.14-plate-shell-visual-system.md`, `qa/2026-09-19-P23.14-shell-qa-record.md` |
| `docs/operations/current.md` | the **baton**: `PHASE`/`CHILD`/`STAGE`/`NEXT`/`ROUTE`/`BLOCKER` | `docs/operations/current.md` |
| `docs/reference/**` | landed durable truth (architecture, north star, component contracts, shell contract); `apps/editor/tests/README.md` for test rules | `docs/README.md` table; `apps/editor/tests/README.md` §Test design rules |
| `docs/operations/tech-debt/README.md` | durable *deferred* defect diagnosis (`TD-n`, status `open｜fixed｜superseded`) | ledger template + `TD-1`, `TD-2` |
| `docs/operations/checkpoints/**` | transient interrupted-work recovery only (directory currently holds only its `README.md`) | `docs/operations/checkpoints/README.md` |
| `docs/archive/**` | history/evidence, never current authority; live tree wins | `docs/archive/README.md` |
| `.agents/skills/slice-closeout/SKILL.md` | HOW a slice is closed | skill steps 1–11 |
| `.agents/skills/work-checkpoint/SKILL.md` | HOW interrupted work is checkpointed/resumed | skill §Procedure/§Complete |

### 1.2 Who changes which file on which transition (CURRENT)

| Transition | File that changes | Who does it | Evidence |
| --- | --- | --- | --- |
| work unit advances inside a slice | `docs/operations/current.md` | the implementing agent | `current.md` history: `953d5af`, `74162d4`, `1d8fd92`, `fc8a2f6`, `f7a31e2`, `02744b2` all inside the P23.14 PR |
| slice status/order/direct routes | phase `README.md` | implementing agent / closeout | phase README touched by `ba2e42a`, `1d8fd92`, `f7a31e2`, `ca23956` |
| slice scope/decisions/acceptance | its plan | plan author, owner-ratified | `62b2ebd` re-scopes P23.14 in the reconciliation + plan + phase README |
| landed durable truth | `docs/reference/**` | agent, owner-approved | `f7a31e2` (contract promotion), `38c5701` (test rules → `apps/editor/tests/README.md`) |
| deferred defect | `docs/operations/tech-debt/README.md` | agent, owner-deferred | `TD-1` (P24 owner), `TD-2` (created in `02744b2`) |
| P-level status/order | `docs/roadmap/README.md` | owner / closeout **only on P-level change** | skill step 6; file history is only 4 commits |
| history | `docs/archive/**` | closeout (per skill step 8) | rule stated in phase README; **no post-restructure execution** (§7) |

**Finding (CURRENT):** after PR #65 every **concern** has a designated authority surface.
This is deliberately one owner per concern, not one copy per fact: a status or rule may
legitimately appear in a baton/status line and again as evidence elsewhere, provided exactly
one surface *owns* it. No second live surface owns slice state. This is the topology the
ratified plan assumes in §21 — the assumption holds.

---

## 2. Current slice-close lifecycle

Derived from `.agents/skills/slice-closeout/SKILL.md` and cross-checked against real
closeouts (§4). "Owner" = who the written procedure assigns it to.

| # | Step | Owner | Scope | Mandatory? | Sufficient for the operating cycle? |
| --- | --- | --- | --- | --- | --- |
| 1 | acceptance rows + `npm test`/`check`/`build` | agent | slice | mandatory | yes for slice; **no CI exists** — evidence is author-side (§9) |
| 2 | drain active checkpoint; promote findings; delete checkpoint | agent | slice | mandatory if a checkpoint exists | yes |
| 3 | reconcile durable `reference/*` contracts | agent | slice | conditional ("only if durable knowledge changed") | yes — this is the promotion hook the cycle expects |
| 4 | write/update closeout evidence (acceptance record, rulings, residuals) | agent | slice | mandatory | yes |
| 5 | mark slice shipped in the **phase README** | agent | slice | mandatory | yes for slice status; **silent about the parent phase** |
| 6 | update `docs/roadmap/README.md` **only if P-level execution/planning/order changed** | agent | P-level | conditional | partial — no rule decides "this slice completes the phase" |
| 7 | advance `docs/operations/current.md` (baton, not history) | agent | P-level | mandatory | yes |
| 8 | archive the whole slice bundle under `docs/archive/roadmap/…` + one-line phase-README stub | agent | slice | mandatory per skill | **rule exists, never executed post-restructure** (§7) |
| 9 | prune transient/stale artifacts | agent | slice | conventional | yes |
| 10 | repair links for moved paths | agent | repo | mandatory if paths moved | yes |
| 11 | verify no live router treats archive as authority; run existing docs/link checks | agent | repo | mandatory | yes, but **no docs/link check exists to run** (§9) |

### 2.1 Sequence actually observed (CURRENT)

```text
implementation commits (+ current.md baton updates per work unit)
→ acceptance evidence in a dated QA/closeout artifact
→ durable findings promoted (often DURING the PR, not at close: f7a31e2, 02744b2)
→ deferred defect registered in tech-debt (TD-2 in 02744b2)
→ phase README status/child line updated
→ current.md advanced to the next action
→ (archive step) not performed by any post-restructure slice
```

### 2.2 Ambiguities (CURRENT → REQUIRED BY RATIFIED PLAN)

1. **No phase-completion concept.** The skill's step 5 marks a *slice* shipped; nothing
   states that the last slice therefore closes the phase. `P23.16` is described as a
   "P23 closeout gate" in the phase README `GATE` line and in the umbrella child list,
   but no procedure reads that.
2. **Closeout is not the only promotion moment.** In the P23.14 era, durable promotion
   happened inside the PR (`f7a31e2`, `02744b2`), while the slice stayed
   owner-review-open. Promotion and closure are already independent — good for the
   cycle's "same-PR capture" branch, and evidence that a closeout-only safety net would
   already be incomplete.
3. **Slice acceptance can end without closure.** P23.14 is *implemented* and *not closed*
   (`current.md` STAGE, phase README STAGE). The skill has no "review-open" state; the
   baton carries it instead.
4. **The archive contract is unexercised**, so its cost is unknown (§7).

---

## 3. Current major-phase close lifecycle

### 3.1 What defines P23's final acceptance gate (CURRENT)

| Question | Answer | Anchor |
| --- | --- | --- |
| Which artifact defines the final gate? | `2026-09-08-P23.16-final-whole-product-integration-closeout.md` — "roadmap gate — not implementation-ready"; its `**Exit criteria:**` paragraph | P23.16 §Exit criteria |
| What must be true before P23 is `shipped`? | one canonical project completes the whole Build loop and round-trips identities through Undo/Redo, Save/Load, Preview, Publish; Plan/3D/visitor agree; architecture edits don't move Scene/Camera; included accessibility flows pass; repo checks/builds + visitor bundle gates pass; no prerequisite issue open; closeout docs record post-P23 debt | P23.16 §Exit criteria |
| Who updates `docs/roadmap/README.md`? | nobody is assigned. Only skill step 6 ("only if P-level … changed") and the tracker's own drift rule | skill step 6; `roadmap/README.md` |
| Who updates the P23 phase README? | the closeout agent (skill step 5 covers slice status; the phase `STATUS:` line has no explicit step) | phase README header |
| What happens to `operations/current.md`? | skill step 7 advances the baton; no phase-close-specific rule | skill step 7 |
| How does the final child closeout differ? | only in that P23.16 is dependency-last and its exit criteria are phase-wide. **Nothing in the procedure treats it differently.** | P23.16; skill |
| Does `slice-closeout` recognize parent-phase completion? | **No.** | skill steps 5–6 |
| Does any procedure already perform a phase-level handoff? | Not under the current topology. The last real one is pre-restructure (`f8411f7`, P22) | `f8411f7`, `a96f35d` |

### 3.2 Current-state transition (repo-grounded, not assumed)

```text
P23.16 acceptance rows pass (P23.16 §Exit criteria)
→ P23.16's plan records its acceptance evidence + Status: shipped (PR/#SHA)
→ phase README "Completed slices" gains P23.16; STATUS:/STAGE: line updated
→ roadmap/README.md P23 row: in-progress → shipped
→ current.md: PHASE: P26 and CHILD: the next work item
→ (closed-work step) bundle archived + one-line stub (rule never executed post-restructure)
```

Steps 3–5 have **no assigned owner and no procedure**; they are what the owner or the
closeout agent currently improvises.

**Which phase comes next is not in question.** `docs/roadmap/README.md` pins the pipeline
`P23 → P26 → P24 → P25` and P23's `GATE` line says "P24 implementation waits for accepted
P23 minimum", so the product baton moves toward **P26** — nothing established here implies
P24, and this harvest makes no P24 claim.

What is genuinely unstated is **what happens inside P26 immediately after P23 closes**:
whether P26 stays `planning` while the operating cycle's Phase 0 runs, when it moves to
`approved`/`in-progress`, whether its design brief or implementation may begin before Phase 0
adjudication completes, and whether Phase 1 must be installed before P26 implementation
starts. Those are §15 Q3, not a phase-order question.

### 3.3 Historical precedent (pre-restructure, still informative)

`f8411f7` "P22 shipped: hosted acceptance closeout, archive plan, P23 next" changed:
the P22 plan (+ship record), the tracker, `docs/README.md`, `docs/architecture.md`,
three component contracts, `model-assessment.md`, the P23 umbrella, and the hand-off
file. Its hand-off diff shows the baton rotating from "P22.5 implementation" to "P23 is
the sole next action". `a96f35d` (P11) and `1492860` (P20) show the same shape:
**acceptance proof → archive plan → collapse tracker + stub → update contracts/router →
advance the baton → register the next phase.**

`IMPLEMENTATION GAP` (small): the current topology has the same *files* (tracker, router,
contracts, phase README, baton) but no procedure that walks them at phase close.

> **Still unresolved (§15 Q1).** The repository establishes only that satisfying P23.16's
> `**Exit criteria:**` makes P23 *closable*. It does not establish whether the close event is
> an explicit owner ratification or a deterministic closeout transition in which closing the
> dependency-last gate closes the phase. The harvest does not choose; either way, the phase
> README `STATUS:` line, the tracker row, the baton and the closed-work step are consequences
> the closing agent records, and no written phase-close owner exists today.

---

## 4. Representative closeout evidence

| Case | Before | Trigger | Files changed | Status transition | Reference promotion | `current.md` | Archive | Residual/debt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **P23.13 slice close** `94ae0a2` (2026-09-17, pre-PR-#59 layout) | slice implemented, rows open | S9/S10 complete + driven live | `docs/README.md`, the P23.13 plan, `docs/hand-off/CURRENT.md`, `docs/plans/README.md` | plan → shipped/archived; tracker rotated | P23.13 ink rules now live in `reference/design-system/design-specs.md` §Plan drafting ink | hand-off advanced to P23.14 | plan → `docs/archive/plans/`; old tracker kept "recent 5 only" | 3 rows carried forward by ruling (opening-insert, undo-with-field-open, coarse-pointer) |
| **P23.14 slice, promotion without closure** `f7a31e2` + `02744b2` + `953d5af`, merged `a479f78` (PR #61) | slice implemented, design direction local | owner reviewed shell against Atlas; approved R1–R4 | registry: new `docs/reference/design-system/editor-shell-and-visual-system.md` + annex + atlas; old slice path gutted to a pointer; `AGENTS.md`, `docs/README.md`, phase README, `current.md`, plan, QA record, `tech-debt/README.md` (TD-2) | **not closed** — "owner review OPEN" | full durable promotion (contract + ratifications annex + QA companion) | baton updated several times mid-PR | none | TD-2 opened; manual-owed QA rows; slice stays review-open |
| **Junction-dissolve child slice** (PR #57, merge `2716f61`, 2026-09-17) | slice implemented | merge to `main` | plan + phase README only (plus source) | plan `**Status:** shipped — merged to main through PR #57 (merge commit 2716f61)` | none (entry points deferred into P23.14) | baton advanced | **none** — plan stays in the live phase folder | 3 shell entry points carried into P23.14 |
| **Test-suite refactor T1–T6** `d68ae79` + `38c5701` (PR #64) | 6 executed slices, harvest report open | final lane/closeout slice | `docs/operations/test-suite-harvest-2026-09-19.md` (§R closeout appended), `apps/editor/tests/README.md` (+87 lines of durable rules) | harvest marked executed/closed; durable rules promoted to a routed authority | durable rules → `apps/editor/tests/README.md`; harvest explicitly demoted to "evidence and migration history" | not a roadmap slice — `current.md` untouched | **none** — a 212 KB harvest stays in `docs/operations/` in full | deferred debt + "not achieved" metrics recorded honestly in §R |
| **P22 phase close** `f8411f7` (2026-09-08, pre-restructure) | P22.1–P22.5 complete, production proof run | owner accepted hosted gate | plan+ship record, tracker, router, `architecture.md` + 3 component contracts, assessment, P23 umbrella, hand-off | phase → shipped; next phase registered | `architecture.md` + three component contracts updated in the same commit | hand-off rotated to "P23 sole next action" | P22 plan → `docs/archive/plans/` | deferred list kept in hand-off |

**Pattern (CURRENT):** the repository's real closeout is *promotion-first*: durable rules
are moved to `reference/*` (or a routed README) and the work artifact becomes evidence,
**whether or not** a roadmap status line flips. Archive is the least consistent step: it
happened under the old tracker model (`94ae0a2`, `f8411f7`) and never under the current
one. Promotion does **not** imply closure (§P23.14 case).

---

## 5. Current durable-ruling promotion path

### 5.1 Written instructions (CURRENT)

| Instruction | Location | Effect |
| --- | --- | --- |
| promote / do-not-promote lists | `docs/README.md` §Progressive project knowledge | defines what becomes durable knowledge |
| "Ratified design contracts are promoted, not duplicated" | same section | one live copy; supersession pointer at the old slice path; slice stays history |
| descriptive vs normative | same section | normative needs an owner ruling/approved decision, never implementation accident |
| authority by concern | `AGENTS.md` rule 10 | landed `reference/*` owns durable truth; plan owns slice scope; baton owns current state |
| closeout promotion steps | `slice-closeout` steps 2–3 | checkpoint findings → tech-debt/reference/rulings; reconcile contracts only if durable knowledge changed |
| checkpoint promotion list | `work-checkpoint` §Complete | `reference/*` / tech-debt / owning research artifact / phase README |
| reconciliation triage A/B/C | `docs/README.md` | resolves source-vs-reference contradictions; C escalates to the owner |

### 5.2 What an agent actually does with a durable ruling today (CURRENT)

```text
owner ruling inside a slice
→ if it is shell/visual-system shaped: write it into the durable contract
  (+ annex evidence, + QA record, + current.md), same PR     [f7a31e2, 02744b2]
→ if it is a behavioural rule for a subsystem: reconcile the owning reference doc
                                                             [38c5701 → tests/README.md]
→ if it is a defect: tech-debt entry with an owner and a "must not fix incidentally" note
                                                             [TD-1, TD-2]
→ if it is slice-local: stay in the plan (decisions/non-goals)
→ if it is future product scope: stay in roadmap (plan/reconciliation)
```

### 5.3 Answers to the harvest question

- **Does same-PR promotion already happen informally?** Yes, and recently it is the
  *dominant* pattern (P23.14: three commits touching `reference/`). It is not required by any step.
- **Is `slice-closeout` the main promotion safety net?** Not exclusively. It is the
  written safety net, but the strongest recent examples did not wait for closeout; the
  test refactor promoted at its own close (comparable to a closeout, not a roadmap slice).
- **Do important durable decisions wait until closeout?** Sometimes by ruling: P23.13
  carried four rows forward rather than deciding them, and P23.14's TD-2 was *deferred*
  rather than accepted. Both are deliberate deferrals, not misses.
- **Can the model distinguish intended future scope from landed truth?** Yes:
  `roadmap/**` vs `reference/**` is explicit in `docs/README.md` ("Promote … only landed
  behavior moves") and is exercised by the P23.14 promotion. `REQUIRED BY RATIFIED PLAN`
  (Phase 0 Outcome 3) targets capture *problems*, and the repository already has the
  destination for a captured ruling — what it lacks is a *trigger* that says "this ruling
  is durable, write it now" rather than leaving it to agent judgement.

`IMPLEMENTATION GAP` (two different kinds, and they must not be conflated):

```text
PREREQUISITE INFRASTRUCTURE (must exist before Phase 0 can run)
  - the explicit major-phase close transition (§3)
  - the live cycle-state file, because something must be able to record
    `Phase 0 due` / `Phase 0 active` / `adjudication complete` / `Phase 1 installed`

PHASE-0-SELECTED MECHANISMS (installed only if evidence justifies them)
  - a same-PR capture rule naming when a durable ruling must be written
  - concise contracts, seam guards, ratchets, a Direction, semantic range review
```

A one-line capture rule naming when a ruling must be captured (and its destination) would
cover Outcome 3 without a new artifact — but that is a *mechanism*, so it is Phase 0's call,
not this harvest's. The cycle-state file is not: without it no metadata stage can be
represented at all.

---

## 6. Existing migration / Direction-like patterns

| Pattern | Where it lives | Kind | Mechanical enforcement | Completion condition | What happens at completion |
| --- | --- | --- | --- | --- | --- |
| "legacy compatibility only" for versionless room-frame payloads | `AGENTS.md` rule 2 | scoped permission (TARGET/FORBIDDEN pair) | source-level compat adapters (`packages/project-model/src/project-compat.ts`, `standalone-scene-import.ts`, `compat-runtime.ts`) | not stated | not stated |
| frozen `/museum/editor` relic | `docs/reference/architecture.md` | FORBIDDEN-to-grow | arch lane: `visitor-import-boundary`, `preview-surface-boundary`, `editor-entry-boundary`, relic-isolation tests (T2c) | permanent by design | n/a |
| canonical writer set / document-format policy | `apps/editor/tests/lib/editor/project-format-writers.test.ts`, `project-format-policy.test.ts`, `project-format-visitor-parity.test.ts` + `layout-gizmo-adapter` facade markers test | RATCHET + TARGET | yes, direct | implicit (canonical format landed) | tests stay as the guard |
| P24 R9 minimum-freeze | `docs/roadmap/p24-scene-staging/reconciliation/2026-09-10-P24-R9-minimum-freeze.md` | fixed reference commit (`bdd99bf…`) + byte-identical fixture + "must run unchanged on both builds" | no (harness runs at acceptance) | P24.5 candidate measured against the reference | reference + fixture retained as evidence |
| TD-1 deferral | `docs/operations/tech-debt/README.md` | FORBIDDEN-for-a-window ("P23.14–P23.16 must not fix or work around it incidentally") | no | fix lands in P24 | `Status: fixed (<commit>)` in the same entry |
| grandfathered flat slice plans | phase README + `docs/roadmap/README.md` | RATCHET by convention ("do not add new slice-specific plans here") | no | never (legacy) | n/a |
| P23.14 plan "Global constraints" / "Explicit non-goals" | the plan | slice-scoped FORBIDDEN | partially (contract tests) | slice acceptance | plan becomes evidence |

**Finding (CURRENT):** every ratified-`Direction` component already exists somewhere in
the repository, but they are **scattered across four artifact types** (AGENTS rule,
reference contract, plan non-goals, tech-debt note) with **no shared shape**. The two
weakest components are `DONE WHEN` (only P24 R9 and TD-1 name a completion owner) and
`RATCHET` (exists as test pins but is never described as a migration ratchet).

`REQUIRED BY RATIFIED PLAN` (§4): a Direction is "a current contract used while
architecture is intentionally in transition", with the option to delete the prose layer
when a deprecation marker + ratchet already communicate it.

`IMPLEMENTATION GAP` (small → medium): a *format* is genuinely new; the *content* is
not. A future Direction could reuse the contract shape (anchor/rule/why/exception) plus
an explicit `DONE WHEN` owner — but whether any live example needs it is a Phase 0
finding, not a harvest conclusion.

---

## 7. Current archive / closed-work model

### 7.1 What exists (CURRENT)

| Question | Answer | Evidence |
| --- | --- | --- |
| What does `slice-closeout` archive? | the whole slice bundle under `docs/archive/roadmap/...` + one-line phase-README stub (step 8) | skill step 8 |
| Has that ever been executed post-restructure? | **No.** `docs/archive/roadmap/` contains 17 files, all P23 *design* bundles moved by PR #59 (`650f7c1`) | `find docs/archive/roadmap` |
| What remains as the phase-README stub? | one compact "Completed slices" paragraph naming the slice | phase README §Completed slices |
| Are exact historical SHAs recorded today? | Yes, in prose: plan `Status:` lines (`shipped on main via PR #9 (d5ec0df)`), umbrella closeout entries, commit bodies, the test harvest §R (`baseline a479f78`), P24 R9 (`bdd99bf…` + fixture SHA-256) | plan headers; `f8411f7`; `d68ae79` |
| Does any convention use `git show <sha>:<path>` recovery? | Only one mention, in the test harvest (`git show d9896dc:…`) | harvest §P |
| Are active plans moved, copied, or deleted? | Under the old model: moved + archived (`94ae0a2`, `f8411f7`). Under the current model: **left in place** — 26 artifacts live in the P23 folder (excluding its `README.md`), 19 of them already carrying a shipped/merged/implemented status line | `ls`/`grep` over `docs/roadmap/p23-layout-depth/*.md` |
| Do archived bundles stay complete? | Yes — bundles are moved whole; `docs/archive/README.md` describes them as historical, not authority | archive README; `docs/archive/plans/2026-09-07-P22-…` with ship record |
| What live links point into archive? | several, e.g. the shell-design context's sources table → `docs/archive/plans/2026-09-16-P23.13-…` and → `docs/archive/roadmap/p23/P23.13-final-design-specification-Designer-D.md`; `docs/reference/components/shell.md` identity rationale → `docs/archive/roadmap/p23/p23.12-final-design-contract.md` | grep of live docs |
| How do recent closeouts differ from grandfathered plans? | grandfathered flat plans stay complete in the live folder with only a `Status:` line; pre-restructure archived ones moved out | §4 |
| Is the current archive contract sufficient for exact reconstruction? | Yes for the archived bundles (git history preserves everything; the bundle is whole). No for the **live** shipped plans — nothing distinguishes "closed work" from "active work" except a prose `Status:` line, and no SHA-recovery convention exists | §7.2 |

### 7.2 Delta vs the ratified requirement

| Dimension | CURRENT (whole bundle archived + one-line stub — stated, not executed) | RATIFIED REQUIREMENT (closed work sheds authority + stays exactly recoverable by verified SHA/path; **mechanism left open** — the plan's compact stub + SHA is one candidate) |
| --- | --- | --- |
| Cost per closeout | move N files, repair links, add stub | write a small stub; no file moves, no link repair |
| Live-tree clarity | shipped plans stay live and complete until someone archives them (today: they just stay) | closed artifacts lose authority immediately and become stubs |
| Reconstruction | `git log --follow` + the archived bundle | `git show <sha>:<path>` (explicit, one hop) |
| Clickability | archived docs remain linkable (links tend to rot, but resolve while the bundle exists) | a SHA/path is not clickable — needs a documented recovery command instead of a link |
| Removes | duplication of authority in the live tree | requires the same, plus a retention decision for pre-existing live plans |
| Migration cost | unknown (never executed) | the 19 already-landed live plans (+ phase-README stubs + `docs/archive/README.md` wording + link repair), plus a decision on the grandfathered flat plans |
| Contradiction with current rules? | — | **Mechanism only, not semantics.** Skill step 8 prescribes one mechanism (whole-bundle archive). The ratified plan fixes the *semantic* requirement — closed work sheds authority and remains exactly recoverable via a verified SHA/path — and explicitly leaves truncation/archive mechanics to reconciliation. Whole-bundle archive, an in-place stub, or a hybrid can each satisfy that contract |

**Tradeoff to hand to the planner (mechanism-neutral).** Whole-bundle archive costs N file
moves and link repair per closeout but keeps documents clickable. An in-place stub costs one
small write and no link repair but loses clickability (a SHA/path needs a documented recovery
command). A hybrid — stub the prose-heavy artifacts, archive whole multi-file bundles — keeps
the common case cheap. The current rule's real defect is not its mechanism: it is that it has
**never been executed**, so 19 already-landed plans still sit in the live P23 folder beside
the active one, with only a prose `Status:` line distinguishing closed work from open work.

> **Owner note 2026-09-20 (see §15 Q4).** The owner expressed a preference for the in-place
> compact-stub + exact-SHA mechanism. It is recorded here as a *preference*, not as a fixed
> mechanism: the harvest stays neutral, and the implementation plan should present the
> alternatives (stub / hybrid / archived bundle) against the ratified semantic requirement
> before one is chosen.
>
> **Resolved 2026-09-21 — OD-4.** The mechanism is now ratified: the **hybrid** model
> (path-preserving compact stub + `git show <A>:<path>` recovery; archive copy only for
> multi-file bundles and non-text evidence). See the implementation plan §1 (OD-4) / §7 and the
> post-harvest resolution in §0.

---

## 8. Product roadmap / scope-change lifecycle

| Question | Answer (CURRENT) | Anchor |
| --- | --- | --- |
| What records changed phase scope? | the phase **remaining-roadmap reconciliation** — explicitly "active umbrella reconciliation", superseding the umbrella's older ordering/deferral statements | `2026-09-14-P23-remaining-roadmap-reconciliation.md` header; umbrella header |
| How is a new child added? | edit the reconciliation's "Proposed remaining slices" (§ per child) + the umbrella's child list + the phase README + the baton; P-level tracker only if P-level changed | `62b2ebd` changed reconciliation + umbrella + design context + `docs/plans/README.md` + hand-off in one commit |
| What makes something a child vs a new P-number? | no written admission rule. Observed: a P-number = a product phase in the pipeline; children keep the shared prefix (`P23.14`) and live in the phase folder; one child shipped with no tracker number at all (PR #57) | phase README §Completed slices; `2026-09-17-P23-junction-dissolve-wall-join.md` |
| Where do owner sequencing rulings live? | reconciliation + umbrella + phase README `NEXT`; the June-14-dated reconciliation's "Final dependency-ordered P23 sequence" | reconciliation §Final dependency-ordered P23 sequence (line ~423) |
| What updates `roadmap/README.md` vs only the phase README? | tracker: P-level only (skill step 6). Phase README: child status/order. Tracker is authoritative if a plan's `Status:` drifts | `roadmap/README.md`; skill step 6 |
| Is there a natural moment to ask a future calibration question? | Candidates, none wired: (a) the owner ruling commit that re-scopes/adds a child (`62b2ebd`), (b) a reconciliation revision, (c) the phase README `NEXT`/`CURRENT` update, (d) `slice-closeout` step 6 when the tracker changes | `62b2ebd`; skill step 6 |

**Observed scope-growth shape for P23 (CURRENT):** the phase grew P23.10–P23.16, and
P23.14 was *re-scoped* mid-phase from "Plan/shell finish" to "Editor Shell & Visual
System Foundation" by an owner ruling (`62b2ebd`). Scope change is a **one-commit,
multi-file documentation event** today; the calibration question the ratified plan wants
("does this invalidate what we are currently testing?") has no place to be asked.

---

## 9. Existing checks and automation

### 9.1 What exists

| Mechanism | Command / path | What it covers | Reusable for Phase 0's mechanical arm? |
| --- | --- | --- | --- |
| Full suite | `npm test` (root → editor) | everything | yes (evidence harness) |
| Lanes | `npm run test:fast｜arch｜heavy｜perf｜full`; `apps/editor/test-lanes.ts` + 4 vitest configs | `ARCH_FILES` = **23 curated files**, never path-gated; lanes pairwise disjoint and their union equals full (a written invariant) | **yes** — this *is* the model of a cheap curated structural control set |
| Architecture lane | `npm run test:arch` | visitor/editor isolation, one-camera-motion/navigation ownership, Layout/Scene format ownership, transaction guards, import direction, plan-render, camera-core, wall-mesh shell, project-model boundary, bind/wiring migration, relic isolation | yes |
| Boundary suites (usable as sets) | `tests/lib/editor/project-format-writers.test.ts` (+ fixtures, visitor parity), `project-format-policy.test.ts`, `tests/lib/project-model-boundary.test.ts`, `tests/lib/museum/visitor-import-boundary.test.ts`, `tests/lib/visitor/preview-surface-boundary.test.ts`, `tests/vite/*-boundary-plugin.test.ts`, `tests/lib/editor/gizmo/editor-gizmo-boundary.test.ts` | canonical writer set, format policy, package/import direction, surface closure | **yes** — these are the "already meaningful bounded structural sets" the plan wants |
| Surface verifiers | `apps/editor/scripts/verify-preview-surface.mjs`, `verify-public-surface.mjs`, `apps/museum/scripts/verify-visitor-bundle.mjs` (`npm run verify:visitor-bundle` exists only in `apps/museum`) | bundle/route isolation | yes (existing command; the editor two have no npm script wrapper) |
| Test design rules | `apps/editor/tests/README.md` §Test design rules / §Lanes (promoted by T6) | how tests may be split, named, deleted | yes — the routed authority a future test rule must update |
| CI | **none** — `.github/` does not exist | — | **gap**: every "runs in CI" claim in lane configs is aspirational |
| Docs checks | **none** — no link checker, stale-path check, or roadmap-consistency check | — | **gap**: skill step 11 says "run any existing docs/link checks"; there are none, so it degrades to ad-hoc manual checks (the Repo-Audit did one; so did PR #65) |

### 9.2 Reuse verdict

```text
EXISTING REUSABLE COMMANDS:  npm test / test:arch (23 curated boundaries) / test:full
                             verify:visitor-bundle + the two editor verify scripts
                             the boundary suites themselves as named structural sets
POSSIBLE NEW TOOLING:        docs link-path check; roadmap/phase status consistency check;
                             lane-invariant check (union/disjoint) — all currently manual
```

Phase 0's "at most a few high-value sets, no tooling project" constraint is satisfiable
with what already exists **except** for any documentation-surface measurement, which
today has no command at all.

---

## 10. Candidate trigger integration seams

| Trigger family | Existing detection point | Existing artifact owner | Smallest likely future hook | Confidence |
| --- | --- | --- | --- | --- |
| child/slice accepted | `slice-closeout` step 1 acceptance + step 5 phase README | phase README + QA artifact | none / existing | confirmed |
| **major product phase closes** | *nothing detects it*: the close gap in §3.2, decision made by an owner ruling commit | phase README `GATE` + `roadmap/README.md` table + `current.md` | one line in `slice-closeout` (phase-completion step) and one line in the phase README `GATE` pointing at the cycle file; possibly a `current.md` `META:` line while a Phase 0 window is open | confirmed (gap) |
| durable architectural ruling occurs | owner ruling inside a slice; promotion instructions exist but no trigger | reference contract (destination), plan (source) | a capture rule line in `slice-closeout` step 3 and/or `docs/README.md` update-rules block ("durable ruling during work → owning `reference/*` in the same PR") | partial — the destination is confirmed, the trigger is the Phase 0 question |
| active Direction changes | would be a `reference/*` migration contract; today the nearest owners are plan non-goals and tech-debt "must not fix" notes | reference contract / plan / tech-debt | a `Direction` block inside the owning `reference/*` contract; no new file unless Phase 0 justifies one | partial |
| material product-scope change | the reconciliation/umbrella revision commit (`62b2ebd` pattern) + phase README `NEXT` | reconciliation doc (+ umbrella) | one calibration line in the reconciliation header or the phase README `GATE` line: "material scope change → answer the calibration question" | partial — no hook exists today |
| mechanism clearly succeeds/fails early | mechanism-local observation (e.g. a test lane flaking, a ratchet blocking) | mechanism owner (test config / contract / plan) | kill-condition line beside the mechanism (the ratified plan §23 asks for these) | unverified — no live mechanism yet |

**Explicit non-decisions (per task §6):** this harvest does **not** install same-PR
contract capture, does not choose a Direction format, does not add any trigger, and does
not decide whether the phase-close trigger should live in the skill, the phase README, or
`current.md`.

---

## 11. Proposed live meta-state ownership (evidence only)

### 11.1 Does the split fit? (CURRENT + REQUIRED BY RATIFIED PLAN)

| Proposed artifact | Fits the current topology? | Evidence / reasoning |
| --- | --- | --- |
| `docs/roadmap/architecture-operating-cycle-plan.md` = ratified design/provenance | yes — already routed as `META` in `docs/roadmap/README.md`, outside the pipeline | `docs/roadmap/README.md` BLOCK |
| `docs/operations/architecture-cycle.md` = live meta-roadmap state | yes — `docs/operations/` already holds sibling live artifacts (`current.md`, `tech-debt/`, `checkpoints/`) and is the correct tier ("operations = live work") | `docs/README.md` §Where truth lives; `docs/operations/` layout |
| `docs/operations/current.md` = product baton | yes — no overlap if the cycle file owns *meta stage* only | `current.md` is 22 lines, product-scoped |
| `docs/roadmap/README.md` = P-level product status/order | yes — the cycle is not a phase and must not enter the pipeline | `roadmap/README.md` META paragraph |

### 11.2 Duplication risks

- **Would `architecture-cycle.md` duplicate `current.md`?** Only if it restated the
  product baton (`PHASE`/`CHILD`/`NEXT`). It must not. The baton answers "what product
  work is next"; the cycle answers "which meta stage is open on which trigger".
- **What would `current.md` need?** Two options, both fits:
  (a) nothing at all — discovery happens at the trigger moment through the phase README;
  (b) **one** conditional line, present only while a cycle stage is open, e.g.
  `META: architecture cycle — Phase 0 due after P23 close → ../operations/architecture-cycle.md`.
  Option (b) is the minimum that survives an agent switching context mid-window; it is
  also what the current `BLOCKER`/`ROUTE` block already does for the P23.14 review.
- **Must not own** (authority boundaries to write into the future file): product status
  (tracker), product next-work (baton), durable architecture (reference), slice detail
  (plan/QA), deferred defects (tech-debt), ratification evidence (annex).

### 11.3 Discovery without preload

| Situation | Route that exposes the cycle | Why it stays out of ordinary tasks |
| --- | --- | --- |
| ordinary implementation PR | none — not referenced from `AGENTS.md` boot contract, nor from the `IMPLEMENT/DESIGN/RESEARCH` block, nor from the phase README `ROUTE` block | nothing new appears in the L0/L1 read path |
| phase close / gate work | phase README `GATE` line (the file already names the P23.16 gate) → cycle file | the phase README is already read for phase status |
| slice closeout | `slice-closeout` step 5/6, where phase completion is decided | the skill is only read when closing a slice |
| owner asks "what is the architecture cycle doing?" | `docs/README.md` "Where truth lives" table, new row beside `Current work / baton` and `Tech debt` | table rows are pull-based |
| mechanism succeeded/failed early | the mechanism's own kill-condition line | local to that mechanism |

`REQUIRED BY RATIFIED PLAN` (§19): "Most ordinary PRs should trigger nothing in the
meta-roadmap." The above achieves that with **no startup cost**.

---

## 12. Ratified-plan → current-repo gap matrix

| Ratified requirement | Current mechanism | Gap | Likely integration point | Confidence |
| --- | --- | --- | --- | --- |
| Phase 0 fires after P23 fully closes | nothing detects phase close; the close event's identity is itself unresolved (§15 Q1) | **prerequisite plumbing**, not a Phase-0 outcome: the written phase-close transition + a recordable `Phase 0 due` state | `slice-closeout` + phase README `GATE` (+ optional `current.md` line) | confirmed |
| Live meta-state file `docs/operations/architecture-cycle.md` | none (plan says "do not create yet") | the file + its route row — **must exist before Phase 0**, since stages such as `Phase 0 due/active` have nowhere to live otherwise | `docs/operations/` + one `docs/README.md` table row | confirmed |
| Phase-close reconciliation/subtraction | promotion exists; subtraction does not | a subtraction step has no owner | `slice-closeout` | confirmed |
| Closed-work artifacts shed authority and stay exactly recoverable by verified SHA/path | stated archive rule, never executed; the live P23 folder keeps 19 already-landed plans with `Status:` lines | execution under the fixed semantics; **mechanism still an owner choice** (stub / hybrid / archived bundle — §15 Q4); **resolved after the harvest by OD-4 → hybrid stub + SHA** (§0) | closed-work step in `slice-closeout` | confirmed |
| Durable-ruling capture (Outcome 3, if justified) | same-PR promotion happens informally; destination is clear | a trigger/rule naming when capture is mandatory | `slice-closeout` step 3 / `docs/README.md` update rules | partial |
| Direction format | scattered equivalents (AGENTS rule, reference note, plan non-goals, tech-debt "must not fix") | shared shape; `DONE WHEN` ownership is weakest | owning `reference/*` contract | partial |
| Scope-change calibration | scope changes are a documentation commit (`62b2ebd`) | no place to ask the calibration question | reconciliation header / phase README `GATE` | partial |
| Phase 0 mechanical control pass | lanes + 23 curated arch boundaries + boundary suites + 3 verify scripts exist | no doc-surface measurement; no CI | existing commands only | confirmed |
| Phase 2 validation window = P26 | `p26-spatial-depth/README.md` `STATUS: planning`, `NEXT: design brief` | nothing links a mechanism to P26's close | cycle file + P26 phase README | partial |
| Phase 3 keep/simplify/delete | does not exist | the whole step | cycle file + `slice-closeout` | confirmed |
| Evidence-driven admission rule for contracts | `docs/README.md` promote/normative rules + ticket-free prose in contracts | no explicit incident-derived/preemptive marker convention | `reference/*` authoring guidance | partial |
| Agent discovery without preload | router is pull-based; `AGENTS.md` boot contract names only `docs/README.md` | none — this is already satisfied | n/a | confirmed |

---

## 13. Exact implementation-planning inputs

The next plan works on these files. Nothing else in the repository needs to change.

```text
MUST CHANGE (candidate, plan to decide)
  .agents/skills/slice-closeout/SKILL.md
      - phase-completion step: recognize the dependency-last gate and record the phase-close
        transition (the authoritative close event is §15 Q1, resolved by the plan/owner)
      - closed-work step: encode the ratified semantics (authority shed + exact SHA/path
        recovery); the mechanism is a plan-time owner choice (§15 Q4)
      - PREREQUISITE, not Phase-0-conditional
      - optional mechanism line: capture rule (only if Phase 0 concludes capture is the failure)
  docs/roadmap/p23-layout-depth/README.md
      - GATE line becomes the phase-close pointer (and later the P26 handoff)
  docs/operations/architecture-cycle.md            (NEW — live meta-state)
      - PREREQUISITE: must exist before Phase 0, so `Phase 0 due/active` is representable
  docs/README.md
      - one "Where truth lives" table row; nothing in the reading-depth or route blocks
  docs/operations/current.md
      - decision: no META line, or one conditional line only while a stage is open

MAY CHANGE (only if the owner picks that branch)
  docs/roadmap/README.md        - nothing structural; at most the META paragraph wording
  apps/editor/tests/README.md   - only if a new validation lane/rule is introduced
  docs/operations/tech-debt/README.md - only if a mechanism's kill condition belongs there
  docs/archive/README.md        - only if the archive policy changes

MUST NOT CHANGE in that plan
  AGENTS.md; the ratified plan; any P23/P26 scope, order or status; reference contracts'
  current content; any source or test file; index/contract schemas; CI (none exists)
```

**Reusable unchanged:** the whole slice-close promotion path (steps 2–5, 7), the baton
shape, the phase-README routing model, `test:arch` + the 23 curated boundaries, the three
verify scripts, `apps/editor/tests/README.md` as the test-rule authority.

---

## 14. Things the next plan must NOT build yet

- Phase 0 execution, or any A/B/C/D classification.
- New guards, ratchets, contract schemas, metadata/provenance databases, generated indexes.
- Per-PR fresh-agent architectural review, or any new reviewer role.
- Semantic repository maps, vector retrieval, locality files.
- Any CI (the repo has none today; adding one is not implied by this cycle).
- A Direction format, unless Phase 0 justifies one.
- Truncation of existing work artifacts (the archive policy must be decided first).
- Changes to `work-checkpoint` (it is already correctly scoped to interrupted work).
- Any change to `AGENTS.md` or the product pipeline.

---

## 15. Open questions requiring owner decision

### Withdrawn in review (2026-09-20)

Two items were briefly recorded here as owner-resolved. Both are **withdrawn** — the harvest
cannot settle either, and both are open questions again:

- former **OD-1** (phase-close trigger = explicit owner declaration): **withdrawn.** Current
  evidence establishes only that `P23.16 exit criteria satisfied → P23 may be closed`; it does
  not establish whether closure requires separate owner ratification or is a deterministic
  closeout transition. See Q1/Q2.
- former **OD-2** (closed-work mechanism = in-place stub + exact SHA): **withdrawn as a
  decision; retained as a recorded owner preference** (§7.2). The ratified plan fixes the
  semantics (authority shed + exact recovery by verified SHA/path) and leaves the mechanism
  open — see Q4.

### Still open

1. **What is the authoritative P23 close event?** Current evidence establishes that
   satisfying P23.16's `**Exit criteria:**` makes P23 *closable*. It does **not** establish
   whether closure requires an explicit owner ratification (precedent `f8411f7`) or is a
   deterministic closeout transition in which closing the dependency-last gate implies the
   phase closes. The plan/owner must choose; `P23 = shipped` is then the machine-readable
   observable.
2. **Which surface records that close?** The `roadmap/README.md` phase row, the phase README
   `STATUS:` line, or the owner's ruling commit as source of record — the answer follows from
   Q1, so this cannot be settled first.
3. **Which phase is next, and in what state?** *Not* a phase-order question: the pipeline pins
   P26 as next. Open: does P26 remain `planning` while Phase 0 runs, when does it move to
   `approved`/`in-progress`, may its design brief or implementation start before Phase 0
   adjudication completes, and must Phase 1 be installed before P26 implementation begins?
4. **Closed-work mechanism** (its semantics are already fixed by the ratified plan: closed
   work sheds authority and stays exactly recoverable through a verified SHA/path):
   whole-bundle archive, in-place compact stub, or a hybrid? The owner's stated preference is
   the compact stub + SHA (§7.2); the implementation plan should present the alternatives
   before choosing, and the 19 already-landed live plans are the migration set either way.
   → **Resolved 2026-09-21 by OD-4: the hybrid** (path-preserving compact stub +
   `git show <A>:<path>`; archive copy only for multi-file bundles and non-text evidence). The
   19 already-landed live plans migrate as one bounded batch at P23 close.
5. **Does `operations/current.md` carry a META line** while a cycle stage is open, or does
   discovery happen only through the phase README / skill?
6. **Is `docs/operations/architecture-cycle.md` the right home** (plan's proposal), and does
   it need a `docs/README.md` row, or is phase-README + skill routing sufficient?
7. **Who runs Phase 0's semantic review** — a fresh-context agent, two independent agents
   (as the plan says), or owner-assisted — and where does its output live?
8. **Do the grandfathered flat P23 plans count as "closed work"** for the authority/truncation
   policy, or are they a permanent exception like the frozen relic?
9. **Is a lightweight doc/link check acceptable** to make skill step 11 executable, or does
   the plan's "no new tooling" rule forbid it even as a script?

---

## 16. Harvest questions — direct answers

1. **What exact event should trigger Phase 0 after P23?** Current evidence establishes only
   the first half: satisfying P23.16's `**Exit criteria:**` makes P23 *closable*. The
   authoritative close event is **unresolved** and is a plan/owner decision (§15 Q1) — either
   an explicit owner ratification (precedent `f8411f7`) or a deterministic closeout
   transition where closing the dependency-last gate closes the phase. Either way,
   `P23 = shipped` is the observable Phase 0 keys off.
2. **How can an agent mechanically know?** It cannot today: nothing detects the close. The
   observable proxies are the P23.16 plan's `Status:` line, the phase README
   `STATUS:`/`CURRENT:`, and the `roadmap/README.md` row; the tracker is written as
   drift-authoritative, so `roadmap/README.md` P23 = `shipped` is the cleanest mechanical
   signal. Making that transition happen is **prerequisite plumbing** (a written phase-close
   step), not a Phase-0-selected mechanism: Phase 0's own `due` state has nothing to read
   without it.
3. **Which current procedure is the natural host?** `.agents/skills/slice-closeout`, at
   steps 5–6, because that is the only place a slice close and a P-level decision are
   considered together. The phase README `GATE` line is the natural *storage* for
   "what closing this gate means".
4. **Does `slice-closeout` need a major-phase-completion concept?** Yes — a minimal one:
   recognize when the slice being closed is the phase's dependency-last gate, and then
   walk the phase-close transitions (phase README status, tracker row, baton, archive).
   No other artifact provides this today.
5. **Where should the future `architecture-cycle.md` be routed from?** A pull-based
   `docs/README.md` table row (beside `Current work / baton`), plus the phase README
   `GATE` line and `slice-closeout`. Not from `AGENTS.md` and not from the
   `IMPLEMENT/DESIGN/RESEARCH` route block.
6. **How to keep it out of ordinary startup context?** By adding it nowhere on the L0/L1
   read path: no `AGENTS.md` mention, no route-block mention, no phase `ROUTE` entry for
   ordinary children. Evidence: the router's rows are only read when the task matches.
7. **Should `current.md` mention meta-stage at all?** Only conditionally. The minimum
   useful pointer is one line, present only while a stage is open, naming the stage and
   linking the cycle file; it is unnecessary during normal product work.
8. **What exact lifecycle event updates `architecture-cycle.md`?** Its own state changes:
   a stage opening (phase close / adjudication complete / validation window start) and a
   stage closing (Phase 3 verdict). Not per-PR, and not per-slice.
9. **What closeout/promotion behavior can be reused unchanged?** The promotion path (skill
   steps 2–5), the baton shape and step 7, and child-status routing through the phase
   README — plus the tech-debt ledger, the QA/closeout evidence pattern and the
   harvest-report genre (`docs/operations/test-suite-harvest-2026-09-19.md`). What
   demonstrably **cannot** be reused unchanged: the parent-phase close transition (absent
   today) and the closed-work step (§7.2, mechanism still undecided).
10. **What conflicts with current archive behavior?** The *semantics* are fixed; the
    *mechanism* is not. Skill step 8 prescribes whole-bundle archive (stated, never
    executed); the ratified plan requires only that closed work sheds authority and stays
    exactly recoverable by a verified SHA/path, explicitly leaving truncation/archive
    mechanics to reconciliation. Whole-bundle archive, an in-place compact stub, or a hybrid
    can each satisfy that contract; the owner's preference for the stub + SHA mechanism is
    recorded in §7.2, and the 19 already-landed live plans are the migration set whichever
    mechanism is chosen (§15 Q4).
11. **How are durable owner rulings promoted today?** Informally but consistently:
    same-PR write into the owning `reference/*` contract with evidence in an annex, a QA
    record and `current.md` (`f7a31e2`, `02744b2`); or at close into a routed authority
    (`38c5701` → `apps/editor/tests/README.md`); or deliberately deferred with an owner
    (TD-1 → P24, P23.13's carried rows).
12. **What existing migration/ratchet patterns can support a future Direction?** The
    relic/compat rules (`AGENTS.md` rule 2, `reference/architecture.md` relic, source
    compat adapters), the format-policy/writer/parity pins, P24 R9's frozen reference
    fixture, TD-1's windowed prohibition, and the "grandfathered, do not add new" plan
    convention. No shared shape exists; `DONE WHEN` is the weakest part.
13. **What existing commands/checks could support Phase 0's mechanical arm?** `npm test`,
    `npm run test:arch` (23 curated, never path-gated, union/disjoint invariant),
    `test:fast|heavy|perf`, the boundary suites as named sets, and the three surface
    verify scripts. No docs-surface check exists; there is no CI.
14. **How is material product scope change represented, and where could calibration hook
    in?** In the phase reconciliation (+ umbrella + phase README + baton), as a
    multi-file documentation commit (`62b2ebd`). A calibration question could hook into
    that revision or into the phase README `GATE`/`NEXT` line.
15. **What should the next implementation plan change, file by file?** §13.
16. **What should it explicitly leave alone?** §14, plus: product scope and P-number order,
    the ratified plan, `AGENTS.md`, `work-checkpoint`, and every current reference contract.

---

HARVEST VERDICT:

- **workflow integration feasibility:** high. The post-PR-65 topology already gives every
  fact one owner, promotion already happens in practice, and the router is pull-based. The
  lifecycle needs **one new artifact** (`docs/operations/architecture-cycle.md`), **one
  new phase-close step** in `slice-closeout`, **one trigger pointer** in the P23 phase
  README `GATE` line, and **one optional baton line**. The cycle-state file and the
  phase-close transition are **prerequisite infrastructure that must exist before Phase 0**
  — Phase 0 has no way to record `due`/`active` without them. Phase 0 then decides which
  *mechanisms* (capture rule, guards, Direction, range review, or none) are justified.
- **likely change surface:** `.agents/skills/slice-closeout/SKILL.md`,
  `docs/operations/architecture-cycle.md` (new), `docs/README.md` (one table row),
  `docs/roadmap/p23-layout-depth/README.md` (`GATE`), optionally `docs/operations/current.md`.
  No source, test, schema, CI or roadmap-scope change.
- **major unknowns:** (a) the authoritative phase-close event — explicit owner ratification
  vs a deterministic closeout transition (§15 Q1); (b) P26's internal status and sequencing
  while Phase 0 runs, and how P26's own close is recognized as the Phase 2 window exit;
  (c) which mechanisms Phase 0 will actually justify (capture, guards, Direction, range
  review, or none); (d) the closed-work *mechanism* (stub / hybrid / archived bundle) given
  the already-fixed semantics, and the migration of the 19 landed live plans.
  **→ (d) resolved after the harvest** as the hybrid stub + SHA model (§0; mechanics now in
  `.agents/skills/slice-closeout/SKILL.md`); (a) and (b) settled and folded into
  `docs/operations/architecture-cycle.md`; (c) remains Phase 0's finding by design.
- **deeper code harvest required before planning:** **no.** The remaining questions are
  owner/policy questions and one documentation-surface measurement gap. If a plan later
  needs the mechanical arm to be concrete, the exact bounded sets already exist in
  `apps/editor/test-lanes.ts` (`ARCH_FILES`, 23 files), the boundary suites listed in §9.1,
  and the three verify scripts — no repository-wide deep harvest is needed.

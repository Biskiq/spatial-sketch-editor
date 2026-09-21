# Architecture Operating Cycle — Implementation Plan

**Status:** implementation-ready, not executed. Owner review pending (r3 — review corrections
R1–R6 applied in §15.5).
**Scope:** prerequisite infrastructure only. No Phase 0 execution. No Phase-0-selected mechanism.
**Inputs:** `architecture-operating-cycle-plan.md` (ratified direction) ·
`architecture-operating-cycle-workflow-harvest.md` (accepted planning evidence, r2).

```text
BASELINE:   main @ bac8858 (PR #65 merge) + PR #66 branch head
BRANCH:     architecture-operating-cycle (PR #66)
HARVEST:    accepted; §12 gap matrix is the input to §10 here
DECISIONS:  OD-1…OD-9 ratified (this plan's §1 is their implementing record)
```

**Prerequisite-2 relationship.** The harvest determined *where* the lifecycle can plug in.
This plan determines *exactly what changes*, in what order, with what acceptance evidence.
Nothing here requires a further harvest.

---

## 0. Status, scope and inputs

### 0.1 What this plan changes

```text
FIVE REQUIRED EDITS (three documents + one new file + one status wording)
  .agents/skills/slice-closeout/SKILL.md      — major-phase close behavior (additive)
  docs/operations/architecture-cycle.md      — NEW live state (compact)
  docs/README.md                             — one pull-based route row
  docs/roadmap/p23-layout-depth/README.md    — explicit final-gate declaration (+2 lines)
  docs/roadmap/README.md                     — META paragraph status wording (becomes true)

TWO CONDITIONAL EDITS (justified in §10, both one-line-class)
  docs/archive/README.md                     — the hybrid closed-work rule
  docs/operations/current.md                 — only gains a META line at PHASE_0_DUE
```

### 0.2 What this plan does not touch

`AGENTS.md` · `work-checkpoint` skill · any source or test file · CI (there is none) · any
existing `reference/*` contract · product roadmap scope, order or status · the ratified plan ·
P23/P26 status or scope · the harvest's accepted wording.

### 0.3 Why the surface is this small

The accepted harvest established that the repository already owns almost everything the cycle
needs — promotion, baton, child-status routing, a pull-based router, an archive tier, curated
architecture tests. The missing pieces are a *written phase-close transition*, a *place to
record meta state*, and *trigger routing*. That is infrastructure, not machinery.

---

## 1. Locked owner decisions

Each entry: ratified choice → repository consequence → pushback state. No decision is reopened
without implementation evidence; the findings that surfaced during planning are recorded in
§1.11 and are plan-level fixes, not re-decisions.

### OD-1 — Major phase closure is explicitly owner-ratified

**Ratified.** Passing the dependency-last gate makes the phase *closable*; only explicit owner
ratification closes it. The repository must never infer "highest-numbered child passed → shipped".

**Repo consequence.**

```text
closable:  the phase explicitly declares its final gate; that gate's exit criteria are met
closed:    the owner ratifies closure; the closeout agent then writes the consequences
```

- The final gate is declared **by the phase**, in the phase README (§5) — never inferred.
- The owner interaction stays lightweight: one recorded ratification line in the phase-close
  record. No approval form, no workflow engine, no separate governance artifact.
- The ratification is **provenance**; the persistent machine-read state is the tracker row (OD-2).

**Pushback:** none. The historical precedent (`f8411f7`, P22; `a96f35d`, P11) is owner-declared
closure, so this codifies practice rather than inventing it.

### OD-2 — P-level status source of record

**Ratified.** `docs/roadmap/README.md` owns P-level phase status/order. The owner instruction is
authorization, not state; the repository records the outcome.

**Repo consequence.** Each surface owns exactly one concern — no circular authority:

| Surface | Owns | Never owns |
| --- | --- | --- |
| `docs/roadmap/README.md` | P-level status/order, pipeline | phase-local stage, child detail |
| phase `README.md` | phase-local stage, child status/order, gates, direct routes, phase-close record | P-level status |
| final-gate artifact | the gate's acceptance evidence + closeout record | phase or P-level status |
| owner ruling (recorded in the phase-close record) | provenance/authorization | any live state |
| `docs/operations/current.md` | the product baton | meta state |
| `docs/operations/architecture-cycle.md` | meta stage | product status |

**Write order (single direction, no cycles):**

```text
1. final gate accepted        → gate artifact records acceptance (§4 step 2)
2. owner ratification         → recorded in the phase-close record (provenance) (§4 step 3)
3. phase-local close state    → phase README "PHASE CLOSE" block (§4 step 4)
4. P-level status             → roadmap/README.md row → shipped (§4 step 5)
5. product baton              → current.md advances toward P26 (§4 step 6)
6. closed work                → stubs/archive for the closed artifacts (§4 step 7, §7)
7. meta stage                 → architecture-cycle.md → PHASE_0_DUE (§4 step 8)
8. baton META pointer         → current.md gains the conditional META line (§4 step 9)
```

Every later step reads only earlier steps. Nothing reads the owner chat.

**Pushback:** none.

### OD-3 — P26 continues; only its implementation start is gated

**Ratified.** P26 design research, designer pass, reconciliation and implementation planning
proceed independently of Phase 0. The boundary is **the first P26 implementation slice**.

**Repo consequence.**

```text
before P23 closes      P26 design/planning may be in any state, including complete
after P23 closes       Phase 0 runs; P26 design/planning continues
before P26 impl #1     Phase 0 adjudication complete; Phase 1 (if any) installed;
                       one bounded reconciliation of the prepared P26 impl plan
first P26 impl #1      starts the Phase 2 validation window
```

- Contamination rule: **P26 design/planning is not Phase 0 evidence.** Phase 0 stays
  retrospective over P23; reviewers must not manufacture preemptive failures from anticipated
  P26 architecture.
- If Phase 0 returns mostly C/D, no mechanism is installed, the reconciliation is a
  confirmation that there is nothing to reconcile, and P26 implementation may start (§13 E).

**Pushback:** none, and the sequencing is not an imminent product blocker. Evidence: P26 is
`STATUS: planning` with `NEXT: design brief` and `plan → none yet`
(`docs/roadmap/p26-spatial-depth/README.md`), and P23's own remaining work (P23.15, P23.16) is
still ahead, so a design→plan→implementation runway sits between P23 close and P26 impl #1.
Phase 0 (two agent audits + one owner adjudication) fits inside that runway.

### OD-4 — Hybrid closed-work model

**Ratified.** Closed work ≠ current authority, and closed work = exactly reconstructable. Three
layers: compact live stub (useful routing/history presence), archive bundle (where preserving the
full artifact stays useful), Git SHA/path (deterministic reconstruction).

**Repo consequence.** Semantics are mandatory; the *mechanism* is now decided at the layer level
(§7 gives the mechanical rule that removes per-artifact judgment). The plan's §7 supersedes the
harvest's mechanism-neutral framing — the harvest stays correct as pre-decision evidence.

**Pushback:** none required. Two mechanical findings are folded into §7 rather than raised as
re-decisions: (a) the SHA anchor's durability depends on how the closeout PR is merged — PR #59
shows squash is a live possibility here (§1.11 F-2), and (b) "when is archive useful" needs a
structural rule, not taste (§1.11 F-3). See §7.3–§7.4 for the self-reference solution and the
merge-style-independent variant.

### OD-5 — Conditional `current.md` META pointer

**Ratified.** The baton surfaces the cycle only when the next agent/owner must act on it. Never
merely because a stage exists.

**Repo consequence.** `current.md` gains one line only when `OWNER ACTION: required`:

```text
META: Architecture cycle — <what action> → ../operations/architecture-cycle.md
```

The condition is **owned by the cycle file** (`OWNER ACTION` field, §3.1), so the rule cannot
drift between two documents. During `STEADY` and during Phase 2 quiet validation, no line.

**Pushback:** none. The pointer is never duplicated meta-state — it names an action and a route.

### OD-6 — Live cycle ownership and pull-based routing

**Ratified.** `docs/operations/architecture-cycle.md` is the live state; the ratified plan is
provenance; the harvest is planning evidence; this implementation plan is instructions until
executed. Routing is pull-based from exactly three places (§9).

**Repo consequence.** One `docs/README.md` table row; one final-gate pointer in the owning phase
README; `slice-closeout` discovers it at a major-phase close. Explicitly **not** in `AGENTS.md`,
the normal IMPLEMENT/DESIGN/RESEARCH routes, every child route, or ordinary startup context.

**Clarification the plan must add (new, small):** OD-6 names this implementation plan's role
"instructions until executed" but not what it becomes *after*. Defined in §10.6: on execution it
gains `Status: executed` + `AUTHORITY: NONE`, and it is **out of scope of the closed-work
machinery** — cycle provenance documents are not product work artifacts.

**Pushback:** none.

### OD-7 — Phase 0 = two independent fresh-context audits, then owner adjudication

**Ratified.** Agent A and Agent B audit independently (neither reads the other's output first),
generate candidates only, and never ratify. The owner compares, adjudicates A/B/C/D, and answers
"if this happens again next month, what catches it?". Temporary bounded evidence while Phase 0 is
active.

**Repo consequence.** Exact file set and lifecycle in §8. Raw audits carry `AUTHORITY: NONE`;
`architecture-cycle.md` points at the active evidence; durable results move to their real owners;
temporary evidence sheds authority when Phase 0 closes.

**Pushback:** none. No permanent reviewer role or database is created; the audits are two
one-shot agent runs recorded as ordinary dated operations evidence.

### OD-8 — Existing flat P23 plans are not migrated now

**Ratified.** Migration happens as **one bounded phase-close activity at P23 close**;
P1–P22 and the rest of the historical repository are untouched; correctly archived material stays.

**Repo consequence.** Until P23 closes, the 19 already-landed plans stay in the live P23 folder.
One cheap mitigation is added in §5.3 so they cannot be mistaken for active instructions
(a two-line wording change in the P23 README — not a migration).

At P23 close the boundary applies to the phase's closed work as a whole — landed slice plans,
closed slice workspaces, the P23.16 gate artifact and the closed phase-wide planning hubs (§7.2)
— while the live P23 phase README is left alone.

**Pushback:** none. The interim risk is real but bounded by the P23 README note in §5.3 and by
each plan's own `Status:` line.

### OD-9 — No checked-in docs/link tooling in this prerequisite

**Ratified.** Use existing means: search every moved path, verify relative links, verify
case-sensitive paths, run existing checks. If the eventual P23 migration demonstrates repeated
link failures or unreasonable manual cost, that becomes evidence for a tiny checker later.

**Repo consequence.** `slice-closeout` step 11's "run existing docs/link checks" stays as-is
(there are none) plus an explicit manual search step. §7.3 makes the migration cheap enough that
this remains defensible.

**Pushback:** none, and §1.11 F-1 quantifies why: path-preserving stubs make inbound links keep
working, and no live link targets an anchor inside a P23 plan.

### 1.10 Decisions explicitly *not* taken here

Phase-0-selected mechanisms (§14): same-PR capture, new contracts, seam guards, ratchets,
Direction format, semantic range review, per-PR fresh-agent review, novelty detection, any
knowledge/index system, CI, docs tooling. Phase 0 must remain able to conclude **install nothing**.

### 1.11 Pushback findings (plan-level; no OD requires reconsideration)

```text
OWNER RECONSIDERATION REQUIRED: none
PLAN-LEVEL FINDINGS: 3 (all resolved mechanically inside this plan)
```

- **F-1 — link-repair cost is near zero, so OD-9 is safe.** Measured on the branch: **0** live
  links target an anchor inside a `docs/roadmap/p23-layout-depth/*.md` plan, and references are
  concentrated in hubs that stay live (umbrella 21 files, reconciliation 12, addendum 12,
  directive 6; every landed slice plan ≤5). Because the stub stays **at the original path**
  (§7.1), the ~100 path references keep resolving after compaction. No tooling is needed.
- **F-2 — the SHA anchor's durability must not depend on merge style.** A recorded
  `git show <A>:<path>` resolves on `main` only if commit A is an ancestor of `main`. Measured on
  the branch: **8 of the last 9 PRs used merge commits** (`#57`, `#58`, `#60`, `#61`, `#62`, `#63`,
  `#64`, `#65`), but **PR #59 did not** — `650f7c1` is a squash-style single-parent commit whose
  branch commits are not ancestors of `main`. So the risk is real, not theoretical. §7.3 therefore
  makes the merge-style-**independent** route canonical (P2: land the body first, compact after)
  and keeps the single merge-commit PR (P1) as an optimisation available only when guaranteed;
  §4 step 2 requires post-merge anchor verification and §13.4 records the recovery if an anchor is
  ever invalidated despite that.
- **F-3 — "archive where useful" would be arbitrary per artifact, which OD-4/OD-8 ask to avoid.**
  §7.2 replaces judgment with a structural rule (multi-file bundle or non-text evidence → archive
  copy; single prose file → path-preserving stub + exact Git recovery; already archived → leave
  alone). The rule is keyed on artifact structure, not on anyone's opinion of the content, and a
  genuine exception is an explicit owner call rather than a third evaluation category.

---

## 2. Boundary

### 2.1 Prerequisite infrastructure — must exist **before** Phase 0

```text
- explicit major-phase close procedure            (§4)
- owner-ratified close transition                 (§4 steps 3–4)
- live architecture-cycle state                   (§3, new file)
- event-driven routing (pull-based, 3 seams)      (§9)
- representation of Phase 0 due/active            (§3 states)
- representation of later cycle stages            (§3 states)
- closed-work lifecycle semantics + mechanics     (§7)
- P23 final-gate trigger wiring                   (§5)
- P26 validation-window capability (record + reconcile hook, not P26 content) (§6)
```

### 2.2 Phase-0-selected mechanisms — **must not** be installed now

```text
- mandatory same-PR capture
- new architectural contracts
- seam guards · new ratchets · Direction format
- semantic range review · per-PR fresh-agent architecture review
- novelty detection · repository knowledge/index systems
- CI · docs/link tooling
```

### 2.3 Explicit non-goals

Not a product-code change; not a P23/P26 scope change; not a P26 design input; not a roadmap
reorder; not an `AGENTS.md` boot-contract change; not a `work-checkpoint` redesign; not a
reference-contract edit; not a migration of landed P23 artifacts (OD-8); not Phase 0 itself.

---

## 3. Live cycle state model

### 3.1 Fields — minimal, each with a use

```text
STAGE              the state below (one of §3.2)
STATUS             one line: why the stage is what it is
TRIGGER            the event that moved the cycle here (with its artifact anchor)
PRODUCT CONTEXT    which product phase/close the stage depends on (P23 close, P26 window…)
OWNER ACTION       required | not required      ← drives the conditional META pointer (OD-5)
NEXT               the single next action, or "none pending"
EXIT CONDITION     what ends this stage
VALIDATION WINDOW  the product window a Phase 2 validation runs in (e.g. P26); empty otherwise
ACTIVE MECHANISMS  the mechanisms actually installed by Phase 1; "none" is a valid value
CALIBRATION        whether a scope change has invalidated the active validation + the answer
EVIDENCE           pointer to the Phase 0 evidence set while it exists; empty otherwise
ROUTES             the three routing seams (§9), written once
```

`OWNER ACTION` and `EVIDENCE` are additions to the ratified field sketch: `OWNER ACTION` is what
makes OD-5 mechanical instead of judged, and `EVIDENCE` is what lets Phase 0 resume without
reading the whole evidence set. No other fields without a demonstrated use.

### 3.2 States

| Stage | Meaning | Entry trigger | Required action | Exit condition | Next | META |
| --- | --- | --- | --- | --- | --- | --- |
| `WAITING` | Cycle installed; nothing due | S1–S5 landed | none | the owning phase is owner-closed | `PHASE_0_DUE` | no |
| `PHASE_0_DUE` | A product phase closed; retrospective diagnosis is owed | phase close recorded (§4 step 8) | owner authorizes Phase 0 to start | owner authorizes start | `PHASE_0_ACTIVE` | **yes** |
| `PHASE_0_ACTIVE` | Two independent audits in progress | owner authorization | run audits A and B independently; do not read each other | both audits complete | `ADJUDICATION` | no |
| `ADJUDICATION` | Owner classifies and decides | both audits exist | owner adjudicates A/B/C/D + "what catches it next time?" + outcome | outcome recorded | `PHASE_1` or `STEADY` | **yes** |
| `PHASE_1` | Smallest justified response is being installed | an outcome that justifies ≥1 mechanism | install only the justified mechanisms | mechanisms landed + recorded | `PHASE_2_VALIDATING` | no (unless action pending) |
| `PHASE_2_VALIDATING` | Prospective validation during normal product work | first implementation slice of the window phase starts | none — observe; answer calibration if scope materially changes | the window phase closes | `PHASE_3_EVALUATE` | no |
| `PHASE_3_EVALUATE` | Keep / simplify / delete | validation window closed | record a verdict per mechanism | verdicts recorded; survivors folded into normal practice | `STEADY` | **yes** |
| `STEADY` | No meta action; normal development; every phase close performs ordinary reconciliation/subtraction/closed-work hygiene and **stays** `STEADY` | verdicts recorded, or Outcome 1 (nothing installed) | none | a **new demonstrated architectural failure**, or an explicit owner request for a fresh diagnosis | `PHASE_0_DUE` | no |

### 3.3 Transition table (including the Outcome-1 shortcut)

```text
install (S1–S5)                        → WAITING
WAITING      + phase owner-closed      → PHASE_0_DUE
PHASE_0_DUE  + owner authorizes        → PHASE_0_ACTIVE
PHASE_0_ACTIVE + audits A and B done   → ADJUDICATION
ADJUDICATION + Outcome 1 (C/D)         → STEADY              (no PHASE_1, no PHASE_2)
ADJUDICATION + Outcome 2/3/4           → PHASE_1
PHASE_1      + justified mechanisms    → PHASE_2_VALIDATING  (window = next product phase)
PHASE_2_VALIDATING + window phase ends → PHASE_3_EVALUATE
PHASE_3_EVALUATE + verdicts            → STEADY
STEADY       + ordinary major phase close → STEADY   (reconcile · subtract · close work; §4)
STEADY       + new demonstrated failure, or owner-requested fresh diagnosis → PHASE_0_DUE
```

**Steady state does not re-run Phase 0.** A major phase close is *hygiene*, not *diagnosis*: it
performs the ordinary closeout work (reconciliation, subtraction of stale guidance, closed-work
compaction, §4) and the cycle remains `STEADY`. Diagnosis restarts only on evidence — a new
demonstrated architectural failure — or because the owner explicitly asks for a fresh
retrospective. This follows the ratified plan's steady state (*"further mechanisms are introduced
only in response to new demonstrated failures"*) and it is the point of the correction: a
`PHASE_0_DUE` means two fresh independent audits plus owner adjudication, so making it automatic at
every close would institutionalize the audits we are currently only *considering*.

**Outcome-1 handling (OD-3, corrected).** With nothing installed, `PHASE_2_VALIDATING` is **not**
entered — no validation obligation is manufactured. The cycle goes straight to `STEADY` with
`TRIGGER: none pending` and `ACTIVE MECHANISMS: none`, where it stays across future phase closes
until a failure or an owner request reopens diagnosis. The Outcome-1 result ("the current loop is
sufficient") is therefore not silently converted into a permanent audit obligation.

**Early mechanism verdicts.** A mechanism that clearly succeeds or fails early may move
`PHASE_2_VALIDATING → PHASE_3_EVALUATE` before the window closes; the file records the reason.
The window phase still closes normally.

### 3.4 `current.md` META behavior

```text
META line present  ⇔  architecture-cycle.md OWNER ACTION: required
line shape:  META: Architecture cycle — <action> → ../operations/architecture-cycle.md
writer:      the closeout agent at §4 step 9, or the owner's ruling when a stage changes
removal:     when OWNER ACTION returns to not required (e.g. Phase 0 authorized)
```

The cycle file owns the condition; `current.md` only mirrors it. `current.md` is otherwise
unchanged by this plan.

---

## 4. Major-phase close contract

### 4.1 Ordinary slice/child close (unchanged)

`slice-closeout` steps 1–11 behave exactly as today, with one guard inserted at the top:

```text
0. Read the phase README. Does it declare FINAL PHASE GATE == this child?
      no  → ordinary child close; run steps 1–11; STOP after step 7 (baton) and 8–11 as today
      yes → ordinary child close FIRST (steps 1–7), then the phase-close procedure (§4.2)
```

A normal child close therefore cannot accidentally close its parent. A child close never
touches P-level status.

### 4.2 Final-gate close (new procedure)

```text
Step 1  Declared finality
        The phase README must declare the final gate explicitly (§5). If the README has no
        final-gate line, STOP and report — never infer finality from numbering.

Step 2  Gate acceptance verified  →  phase is CLOSABLE
        Run the gate artifact's exit criteria; record the acceptance evidence in that artifact
        (existing plan-status convention). "Closable" is a phase-local fact; nothing P-level
        has changed yet.
        If already recorded for this content, reuse the evidence (no re-run for its own sake).
        Merge requirement: if this closeout performs the closed-work step (7) in the same PR,
        use the §7.3 P2 route (land the accepted body first, compact afterwards), which is immune
        to merge style; P1 (single merge-commit PR) is allowed only when that merge behaviour is
        guaranteed. Whichever route, verify anchor reachability after merge.

Step 3  Owner ratification  →  provenance
        An explicit owner ruling is required. Recorded as one line in the phase-close record
        together with its date and anchor:
            Owner ratification: closed by owner ruling <date> (<PR/commit anchor>)
        No form, no workflow, no separate governance artifact. If the owner has not ratified,
        STOP here: the phase stays in-progress, the cycle stays WAITING, no META appears.

Step 4  Phase-local close state
        Phase README gains/replaces a "PHASE CLOSE" block:
            STATUS: closed
            CLOSED: <date> — owner ratification recorded in <anchor>
            FINAL GATE: <child> (<artifact>) — accepted <date>
            CLOSED WORK: <stubs/archive summary or pointer>
        The phase's STAGE:/CURRENT:/NEXT: lines are reconciled to the closed state.

Step 5  P-level status (OD-2)
        docs/roadmap/README.md row for the phase → shipped. This is the machine-readable
        "phase is closed" state everything else keys off.

Step 6  Product baton
        docs/operations/current.md → PHASE: <next in pipeline> (P26), CHILD/STAGE/NEXT set to
        the next real work item. Baton stays product-only at this point.

Step 7  Closed-work procedure (§7) for this close's artifacts.

Step 8  Meta stage
        docs/operations/architecture-cycle.md → PHASE_0_DUE with TRIGGER, PRODUCT CONTEXT and
        OWNER ACTION: required.

Step 9  Baton META pointer (§3.4) — added last, because it reflects OWNER ACTION.
```

### 4.3 Idempotence

No locking, no state machine, no database. Three cheap conventions:

```text
- The phase README "PHASE CLOSE" block (§4 step 4) is the close marker. It proves owner
  authorization and prevents the closure *decision* from being repeated. It does NOT mean the
  batch finished.
- A re-run therefore never re-asks for owner ratification (step 3), inspects steps 5–9, and
  ensures each consequence — WRITING any that are missing — then stops when all are satisfied.
  A close that stopped after step 4 is completed by the re-run, not merely reported on.
- Every step is "ensure value", never "increment". Re-running writes the same values.
- Step 7 is a no-op for any artifact already carrying "AUTHORITY: NONE" (§7.1), so a second
  run cannot double-compact or lose a body.
```

The marker's job is authorization and short-circuit of step 3; completion is judged by the four
consequence surfaces (steps 5–8) plus the META line (step 9), never by the marker alone.

Drift report shape (kept in the closeout record, not in the cycle file):

```text
phase README: closed ✓ | roadmap row: shipped ✓ | baton: P26 ✓ | cycle: PHASE_0_DUE ✓ | META ✓
```

### 4.4 Failure and partial-transition handling

See §13 for the full table. Core rule: the close is **one ordered batch**; if a step fails,
later steps are simply not performed (nothing downstream of a missing write), the closeout
record notes where it stopped, and re-running resumes from the first unsatisfied step —
executing it, per §4.3. A `PHASE CLOSE` marker written at step 4 with, say, step 5 failed
therefore means *authorized but incomplete*: the next run finishes steps 5–9.

---

## 5. P23 concrete wiring

### 5.1 The final-gate declaration (the one semantic addition)

Today `docs/roadmap/p23-layout-depth/README.md` says
`GATE: P23.16 closeout gate below; P24 implementation waits for accepted P23 minimum + approval`
and routes the gate artifact in its ROUTE block. That is *discoverable by a human* but not
*declared as the phase gate* in the form `slice-closeout` can act on.

Planned edit (S3) — add an explicit block, keep the existing GATE line:

```text
FINAL PHASE GATE: P23.16 — Final whole-product integration and P23 closeout gate
  gate artifact → 2026-09-08-P23.16-final-whole-product-integration-closeout.md
  satisfying its exit criteria makes P23 CLOSABLE, not closed.
  CLOSED requires explicit owner ratification; closure then updates P-level status/baton
  (slice-closeout, phase-close procedure) and makes Architecture Cycle Phase 0 DUE.
  Landed P23 slice plans are evidence; they are not active instructions (§5.3).
```

**Not changed:** P23 `STATUS: in-progress`, the `STAGE:` line, P23.16's content, the pipeline.

### 5.2 Why P23 needs no other wiring

P23.16 already owns the exit criteria; the phase README already routes it; the tracker already
owns P-level status. The missing link was only that nothing *declared* the gate as final in a
form the procedure reads.

### 5.3 Interim note while the 19 landed plans are un-migrated (OD-8)

Added in the same S3 edit, in the "Completed slices" section — one sentence:

```text
Landed P23 slice plans below are historical evidence (each carries its own Status line);
they are not current instructions, and their full bodies become compact stubs at P23 close.
```

This addresses the OD-8 interim risk without migrating anything.

### 5.4 Not in this plan

Do not close P23, do not change its status, do not execute P23.16, do not migrate plans.

---

## 6. P26 sequencing and prospective-validation boundary

### 6.1 What may proceed when

| Moment | P26 design/planning | P26 implementation | Cycle |
| --- | --- | --- | --- |
| now → P23 close | free to proceed | not ready (no plan) | `WAITING` |
| P23 closed, Phase 0 open | free to proceed | may not start | `PHASE_0_DUE` → `PHASE_0_ACTIVE` → `ADJUDICATION` |
| adjudication done | free to proceed | may start **after** the boundary check below | `PHASE_1` or `STEADY` |
| first P26 impl slice | free to proceed | running | `PHASE_2_VALIDATING` (window = P26) |

**Boundary check before P26 impl #1** (one bounded reconciliation, no redesign):

```text
- Phase 0 adjudication is complete.
- Phase 1 mechanisms, if any, are installed and recorded in ACTIVE MECHANISMS.
- The prepared P26 implementation plan is read once against those mechanisms.
    conflict found → resolve the conflict (owner-ruled), do not redesign P26
    no conflict    → record "reconciled, no change" and proceed
- Outcome 1 (nothing installed) → the check is a confirmation; record and proceed.
```

### 6.2 What the cycle records

```text
VALIDATION WINDOW: P26
ACTIVE MECHANISMS:
  - <only what Phase 1 actually justified>      (may be "none")
```

An empty list is a legitimate value and must not trigger the invention of a validation
mechanism (OD-3).

### 6.3 Scope creep during Phase 2 only

Hook the calibration question to an **existing roadmap moment** — the phase reconciliation
revision (the `62b2ebd` pattern) or the phase README `NEXT`/`GATE` update — never to every PR:

```text
ordinary new child / scope evolution        → CALIBRATION: unchanged (no entry needed)
material change to the active assumptions   → CALIBRATION: <question> → <answer>
                                              → adjust the validation boundary if needed
                                              → never auto-install another mechanism
```

Outside Phase 2, scope change needs no calibration entry.

### 6.4 P26 is not touched

No architecture-cycle requirement is added to P26's product design, its README, or its
researcher/designer briefs. The cycle only records the window and the reconciliation hook.

---

## 7. Closed-work lifecycle

### 7.1 Layer 1 — the live stub

Replaces the artifact **at its existing path** (this is what keeps links working — F-1):

```text
STATUS: CLOSED
AUTHORITY: NONE

Outcome:
  1–3 lines: what landed, where it is used.

Residuals:
  carried rows / deferred items, or "none".

Current contracts:
  reference/* paths that now own the truth this artifact produced, or "none".

Relevant durable decisions:
  one line each with its owner/register anchor, or "none".

Historical evidence:
  docs/archive/<...> (only if an archive copy exists)

Exact recovery:
  git show <A>:<path>
```

Nothing else survives — no task sequence, no plan content, no acceptance rows, no design
detail. The stub is a router plus a recovery anchor, never a summary that competes with
`reference/*`.

### 7.2 Layer 2 — archive rule (structural, not judged)

```text
ARCHIVE A COPY  (copy the full body into docs/archive/roadmap/<phase>/<slice>/…, keep a stub)
  - the artifact is a multi-file bundle/workspace (design/QA/research directories, assets), or
  - its body is non-text evidence (HTML/PNG/SVG/prototypes)

STUB + EXACT GIT RECOVERY  (no archive copy)
  - any single prose work artifact (a plan, a QA record, a reconciliation, an addendum)

LEAVE ALONE
  - already-correctly-archived material · P1–P22 · the phase README (see below)
```

Two mechanical facts, no judgment: does the artifact consist of one prose file or more than one
file / non-text evidence, and is it already archived? A prose file that genuinely deserves an
archive copy later is an explicit owner exception recorded in the closeout, not a third category
the closing agent evaluates case by case.

**Closed phase-wide planning hubs.** The P23 umbrella, the remaining-roadmap reconciliation and
the cross-view addendum are themselves **completed work artifacts** once P23 closes. Leaving their
full planning bodies live indefinitely is exactly the state OD-4 exists to end: they remain the
phase's most-linked documents (umbrella 21 referencing files, reconciliation 12, addendum 12 —
F-1), so a later reader can still mistake ended planning for current instruction. They therefore
compact like every other closed artifact:

```text
P23 README (phase router/status surface)          → stays live, never stubbed
closed umbrella · reconciliation · addendum      → path-preserving compact stubs
closed slice workspaces (incl. multi-file ones)  → stub at the live path + archive copy
```

Because the stubs keep the original paths, the inbound links F-1 measured keep resolving — which
is the real reason the hub argument favours *stubbing in place* rather than *leaving the body*.

### 7.3 Layer 3 — exact Git recovery

**Anchor definition.** For each compacted artifact, the authoritative anchor `A` is *the last
commit that contained the artifact's full body*:

```text
A = git log -1 --format=%H -- <path>        # run BEFORE creating the compaction commit
Exact recovery line: git show <A>:<path>
```

**Two-commit protocol** (solves the self-reference problem; do not use `--amend`):

```text
commit A (last content commit)  full body present — this is the accepted closeout state
commit B (compaction commit)    body replaced by the stub; stub records `git show <A>:<path>`
                                + optional archive copy in the same commit
```

Commit A is knowable before commit B is written, because A already exists in history.
`--amend` is forbidden here: amending rewrites A and invalidates the written anchor.

**Multi-commit / multi-PR work.** A is always the *last* commit touching that path, so work
spanning several commits or PRs needs no special handling — earlier commits remain recoverable
too, but A is the accepted state. A batch compaction of several artifacts may produce different
A anchors; compute per artifact.

**Is the anchor durable?** Only if A is an ancestor of `main`. Two ways to guarantee that.
**The canonical route is the merge-style-independent one (P2); P1 is an optimisation that is only
allowed when merge-commit behaviour is explicitly guaranteed.**

```text
P2  CANONICAL — land the body first, compact afterwards.
    PR/commit 1 publishes the accepted full body under any merge style; A is therefore an
    ancestor of main immediately, before any stub exists. A later commit/PR (or the next
    closeout) replaces it with the stub recording A. Cost: one extra commit boundary.
    Benefit: closed-work durability does not depend on repository merge settings — which is
    the whole point of the anchor.

P1  OPTIMISATION — one PR, two commits, merged with a MERGE COMMIT (not squash).
    Allowed only when that merge behaviour is guaranteed for this PR (stated in the PR itself).
    Repo evidence it usually holds: #57, #58, #60–#65 produced `Merge pull request #…` commits.
    Counter-example: PR #59 landed as a squash commit (`650f7c1`, single parent), so the style
    is never automatic. If the guarantee cannot be made, use P2.
```

Rationale for flipping the previous default: closeout is infrequent, so an extra commit boundary
is cheap, while a silently invalidated recovery anchor is expensive and invisible until someone
tries to recover. P1 remains available for the common case, but correctness no longer rests on it.

Post-merge verification, before the close is declared complete:

```bash
git merge-base --is-ancestor <A> main && echo "anchor reachable"
git show <A>:<path> | head -3          # spot-check recovery
```

If the closeout was squashed, or a force-push rewrote the branch, the stub's recovery line is
annotated to the reachable form (`git fetch origin refs/pull/<n>/head && git show <A>:<path>`) and
the degradation is recorded in the closeout record — recoverable, but never silent (§13.4).

**Verification at stub time** (S4 acceptance): every written `git show <A>:<path>` line is
executed once in the same session.

### 7.4 Why a one-commit method is not used

A single commit cannot name itself. The alternatives are worse: recording the merge SHA is
unknowable before merge; recording the branch tip after the fact drifts (a later commit to the
same PR invalidates it); `--amend` invalidates the anchor; and a `<path>@<branch>`-style
recovery line is not deterministic across clones. The two-commit protocol needs no tooling and
no post-hoc edit.

**Which variant to use.** P2 (above) is the default: it removes the F-2 class of risk entirely at
the cost of one extra commit boundary. P1 is used when the guarantee it needs is explicit — the
closeout PR states that it lands with a merge commit — which keeps the single-PR path available
without making correctness depend on it.

### 7.5 P23 migration boundary (OD-8)

```text
WHEN      at actual P23 close, inside the §4 phase-close batch (step 7) — not now
SCOPE     the P23 folder only: **every closed P23 work artifact**, i.e. the ~19 already-landed
          flat slice plans + closed slice workspaces (incl. multi-file bundles) + the P23.16
          gate artifact + the closed phase-wide planning hubs (umbrella, reconciliation,
          cross-view addendum, §7.2)
LEAVES    P1–P22 · already-archived bundles · the live P23 phase README · reference/* · code
SIZE      ~19 landed slice plans + ~3 phase-wide hubs + closed slice workspaces + this close's
          own artifacts — a single bounded batch executed once, not an ongoing programme
COST      stub writes are path-preserving, so inbound references keep resolving (F-1);
          archive copies apply only to bundle/non-text artifacts
ORDER     (a) record A per artifact, (b) write stubs, (c) archive copies where §7.2 requires,
          (d) verify every recovery line, (e) run the manual link search (OD-9)
```

The P23 README then carries the closed-work summary line written at §4 step 4.

---

## 8. Phase 0 evidence workflow

### 8.1 Structure — bounded and temporary

```text
docs/operations/architecture-cycle/            created when PHASE_0_ACTIVE begins
  phase0-audit-a.md        AUTHORITY: NONE · independent audit (Agent A)
  phase0-audit-b.md        AUTHORITY: NONE · independent audit (Agent B)
  phase0-adjudication.md   owner rulings per candidate + the outcome + what-catches-it
```

Naming follows the existing dated-operations-evidence habit (`test-suite-harvest-2026-09-19.md`)
while staying stage-scoped; the directory is created at `PHASE_0_ACTIVE` (git does not track empty
directories, so nothing exists at `WAITING`).

### 8.2 Lifecycle

```text
1  PHASE_0_DUE      → owner authorizes; cycle records EVIDENCE: docs/operations/architecture-cycle/
2  PHASE_0_ACTIVE   → Agent A and Agent B each run independently, from P23 history only;
                      neither reads the other's output before producing its own audit;
                      both write AUTHORITY: NONE; candidates only, never ratification
3  ADJUDICATION     → owner compares, classifies A/B/C/D, answers "what catches it next time?",
                      and records the outcome in phase0-adjudication.md
4  outcome recorded → cycle STAGE/ACTIVE MECHANISMS/EXIT CONDITION updated;
                      PHASE_1 installs only the justified mechanisms (or STEADY for Outcome 1)
5  promotion        → any durable result moves to its real owner:
                        ratified contract        → docs/reference/*
                        genuine deferred defect  → docs/operations/tech-debt/
                        changed process rule     → the owning skill/router
                        mechanism + kill rule    → the mechanism's own file + cycle ACTIVE MECHANISMS
6  close            → promotion done ⇒ the three evidence files lose authority and are deleted
                      (an archive copy is optional and is an explicit owner call, not a default;
                      the cycle file keeps the compact outcome)
```

### 8.3 What survives

```text
architecture-cycle.md          the compact outcome/state needed to continue
reference/*                    ratified contracts, if any
tech-debt/                     genuine deferred defect, if any
archive or exact SHA           only if raw audit retention is judged useful
raw audit files                no current authority, and normally deleted at step 6
```

Nothing here creates a reviewer role, a candidate database, or a permanent audit register.

---

## 9. Routing and progressive disclosure

### 9.1 The three seams (and nothing else)

```text
1  docs/README.md "Where truth lives"
   one row, pull-based:
     | Architecture cycle (meta) | operations/architecture-cycle.md — states and triggers only |
2  phase README final-gate line (§5.1)
   the close path discovers the cycle from the phase it is closing
3  slice-closeout §4.2 step 8
   the procedure that performs the close writes the PHASE_0_DUE state and the META pointer
```

### 9.2 Explicitly excluded

```text
AGENTS.md boot contract · IMPLEMENT/DESIGN/RESEARCH route blocks · every phase child route ·
ordinary implementation startup context · work-checkpoint
```

### 9.3 Acceptance for context discipline

| Actor | Path | Must be able to reach the cycle? |
| --- | --- | --- |
| ordinary implementation agent | `AGENTS.md → docs/README.md → roadmap → phase → exact plan` | **no** — must not load it |
| phase-close agent | `slice-closeout` on the declared final gate | **yes**, at step 1/8 |
| owner / meta work | `docs/README.md` row | **yes**, deliberately |
| baton reader | `docs/operations/current.md` | only when `OWNER ACTION: required` |

---

## 10. File-by-file implementation tasks

### 10.1 `.agents/skills/slice-closeout/SKILL.md` — required

```text
WHY            the only procedure that can discover and perform a major-phase close (OD-1, OD-6)
CURRENT ROLE   slice lifecycle: 11 steps, slice-scoped promotion/archive/verify; step 5 marks the
               phase README slice status; step 6 touches the tracker only on P-level change
NEW ROLE       same, plus a phase-close branch entered only when the phase declares this child
               its final gate; ordinary child close is untouched
EXACT SECTIONS new "## Guard — does this close also close the phase?" before step 1;
               new "## Phase close (final gate only)" containing §4.2 steps 1–9 + §4.3 idempotence;
               step 5 gains "step 5 applies to an ordinary child; the final gate also runs the
               phase-close block"; step 8 gains "closed-work uses the §7 hybrid rule: stub at the
               original path + `git show <A>:<path>`; archive copy only for bundles/non-text";
               step 11 gains "manual link search (no checker exists — OD-9)"
EXACT EDITS    additive only; no step renumbered; no existing rule weakened
DEPENDENCIES   §3 (states), §4 (contract), §7 (mechanics), §5 (P23 declaration)
ACCEPTANCE     acceptance matrix A–C, J; a normal child close performs no phase action
```

### 10.2 `docs/operations/architecture-cycle.md` — NEW

```text
WHY            the cycle needs a live state surface; stages like PHASE_0_DUE must be recordable
               (prerequisite infrastructure, not a Phase-0 outcome)
CURRENT ROLE   does not exist
NEW ROLE       live meta state; compact; never a plan, never an activity diary
EXACT SECTIONS §3.1 field block; §3.2 stage table; §3.3 transition table; §3.4 META rule;
               ROUTES (three seams)
EXACT EDITS    initial content = STAGE: WAITING, STATUS: installed, OWNER ACTION: not required,
               PRODUCT CONTEXT: P23 (in progress), NEXT: none pending, ACTIVE MECHANISMS: none,
               VALIDATION WINDOW: empty, CALIBRATION: unchanged, EVIDENCE: empty
DEPENDENCIES   §3; referenced by §10.3, §10.4, §10.5
ACCEPTANCE     a reader can resume the cycle from this file alone; no duplicated product state
```

### 10.3 `docs/README.md` — required

```text
WHY            pull-based discovery for deliberate meta work (OD-6)
CURRENT ROLE   context router; "Where truth lives" table; update rules
NEW ROLE       same + one row for the live cycle
EXACT SECTION  "Where truth lives" table (beside `Current work / baton` and `Tech debt`)
EXACT EDIT     one row: Architecture cycle (meta) → operations/architecture-cycle.md
DEPENDENCIES   the file existing (§10.2)
ACCEPTANCE     no change to reading depths, route blocks, or the update-rule list; ordinary
               tasks are unaffected (matrix K)
```

### 10.4 `docs/roadmap/p23-layout-depth/README.md` — required

```text
WHY            the phase must declare its final gate for the procedure to act (OD-1); landed
               plans need one interim evidence note (OD-8)
CURRENT ROLE   phase status/order + direct routes; GATE line mentions P23.16
NEW ROLE       same + explicit FINAL PHASE GATE declaration + landed-plan evidence note
EXACT SECTIONS the STATUS/ROUTE block; "## Completed slices"
EXACT EDITS    §5.1 block (kept alongside the existing GATE/ROUTE lines) and the §5.3 sentence
DEPENDENCIES   §4.2; the gate artifact path (unchanged)
ACCEPTANCE     the gate is discoverable mechanically (procedure reads a declared line); no status,
               scope, order or route change (matrix L)
```

### 10.5 `docs/roadmap/README.md` — required (status wording becomes true)

```text
WHY            its META paragraph currently says the operating-cycle plan is
               "ratified direction; non-operational pending targeted workflow harvest +
               implementation". Once this prerequisite lands that sentence is false.
CURRENT ROLE   P-level status/order + the META pointer to the ratified plan
NEW ROLE       same + an accurate status for the META track
EXACT SECTION  the BACKLOG/META/OPS/MODEL block and its clarifying paragraph
EXACT EDIT     replace the second META line with: "live state → ../operations/architecture-cycle.md;
               ratified design → architecture-operating-cycle-plan.md"; keep the sentence that
               META is not a pipeline phase and adds no P-number
DEPENDENCIES   §10.2; no pipeline/status change (§ acceptance matrix L)
ACCEPTANCE     `P23 → P26 → P24 → P25` and every phase status byte-identical
```

### 10.6 `docs/operations/current.md` — conditional (no edit at S1)

```text
WHY            OD-5: the baton surfaces the cycle only when action is required
CURRENT ROLE   product baton (PHASE/CHILD/STAGE/NEXT/ROUTE/BLOCKER)
NEW ROLE       unchanged; gains one META line only at PHASE_0_DUE and loses it when the action
               is satisfied
EXACT SECTION  between STAGE and NEXT, or immediately after NEXT (writer's choice — one rule:
               it is a pointer line, not a state block)
EXACT EDIT     **none in S1–S5**: at install the cycle is WAITING, so OWNER ACTION is not
               required and no line may appear. The line is written by §4 step 9 at a real close.
DEPENDENCIES   §3.4 (one owner for the condition), §4 step 9
ACCEPTANCE     matrix A/G: no META line during ordinary work or waiting states
```

### 10.7 `docs/archive/README.md` — conditional (recommended)

```text
WHY            the archive tier's role changes under OD-4: an archive copy is now one layer of a
               three-layer closed-work model, not the whole mechanism
CURRENT ROLE   describes archived buckets as history, not authority; names the roadmap bundles
NEW ROLE       same + one line stating the hybrid rule and that the live stub + SHA is what
               guarantees reconstruction
EXACT SECTION  the `### roadmap/` bullet
EXACT EDIT     one sentence: closed-work artifacts keep a path-preserving stub in the live tree
               and a `git show <A>:<path>` recovery line; archive copies are used for bundles and
               non-text evidence only
DEPENDENCIES   §7; harmless if S4 is deferred (the skill already carries the rule)
ACCEPTANCE     no bucket moved; no existing archive description weakened
```

### 10.8 `docs/roadmap/architecture-operating-cycle-implementation-plan.md` (this file) — after execution

```text
WHY            OD-6 defines this file as "instructions until executed" but not afterwards
NEW ROLE       on execution: gain "Status: EXECUTED <date> (<merge anchor>) · AUTHORITY: NONE";
               body retained as provenance of the skill/state-file rules
EXACT EDIT     header status line only
DEPENDENCIES   S5 acceptance
ACCEPTANCE     it is never mistaken for pending instructions; it is explicitly out of scope of
               the §7 closed-work machinery (cycle provenance, not product work)
```

### 10.9 Not changed (asserted, not merely omitted)

```text
AGENTS.md · work-checkpoint skill · all source and test files · package.json / CI (none exists) ·
reference/* contracts · P26 docs · P23/P26 scope, order, status · the ratified plan · the harvest
```

---

## 11. Ordered implementation slices

```text
S1 — live cycle state + routing contract
     §10.2 (new file) · §10.3 (one row) · §10.5 (status wording now true)
     Acceptance: matrix K (ordinary agent never loads it); the file alone is sufficient to resume

S2 — major-phase-close behavior
     §10.1 (guard + phase-close block + step 8/11 additions)
     Acceptance: matrix A (ordinary child close is unchanged), B (ordered close), C (write order)

S3 — P23 final-gate wiring + conditional baton behavior
     §10.4 (FINAL PHASE GATE + landed-plan note) · §10.6 (no-edit assertion recorded)
     Acceptance: matrix L (no status change); the procedure finds the declared gate

S4 — closed-work contract and mechanics
     §10.1 step 8 amendment (already in S2 as the rule) · §10.7 · §7.3 verification steps
     Acceptance: matrix J (stub + verified recovery line; a compacted artifact cannot look live)

S5 — acceptance and transition rehearsal
     Re-read against the ratified plan + harvest; walk matrices A–L as a table-top rehearsal on
     a scratch branch (no product state touched); run the manual link search (OD-9);
     §10.8 status update
     Acceptance: §12 fully satisfied; plan self-review list in §0/§15 clean
```

Dependencies: S2 depends on §3 (S1) for the state file's shape; S3 depends on S2 for the
procedure; S4 is independent of S3 but shares §10.1; S5 last. Each slice is one reviewable commit.

**Phase 0 execution is not a slice.**

---

## 12. Acceptance matrix

| # | Scenario | Expected result | Verified by |
| --- | --- | --- | --- |
| A | ordinary child closes | parent stays open; P-level unchanged; cycle unchanged (`WAITING`); no META | S2 rehearsal; `slice-closeout` guard reads a false final-gate comparison |
| B | final gate passes, owner has not closed | phase is *closable*; phase stays `in-progress`; gate artifact records acceptance; cycle stays `WAITING` | §4.2 steps 1–2 STOP |
| C | owner closes the final phase | ratification recorded → phase README `PHASE CLOSE` → roadmap row `shipped` → baton → closed work → cycle `PHASE_0_DUE` → META appears | §4.2 steps 3–9 in order; drift report ✓ |
| D | Phase 0 starts | `phase0-audit-a.md` + `phase0-audit-b.md` created `AUTHORITY: NONE`; cycle `PHASE_0_ACTIVE`; P26 design/planning unaffected | §8.2 steps 1–2 |
| E | Phase 0 Outcome 1 (mostly C/D) | no Phase 1 mechanism; no Phase 2 obligation; cycle → `STEADY` with `TRIGGER: none pending` / `ACTIVE MECHANISMS: none`; P26 implementation may proceed once OD-3's Phase 0 step is satisfied | §3.3 shortcut; §6.1 boundary check |
| F | Phase 0 requires Phase 1 | only justified mechanisms installed; one bounded reconciliation of the prepared P26 plan; P26 impl #1 then starts; cycle `PHASE_2_VALIDATING`, `VALIDATION WINDOW: P26` | §6.1/§6.2 |
| G | ordinary P26 implementation PR | cycle not updated; no META in `current.md` | §3.4; §9.2 |
| H | material P26 validation change | calibration entry recorded at the existing roadmap moment; boundary updated if needed; no new mechanism | §6.3 |
| I | P26 closes | `PHASE_3_EVALUATE`; KEEP/SIMPLIFY/DELETE recorded per mechanism; → `STEADY` | §3.2/§3.3 |
| J | closed work | artifact cannot be read as live instructions (`AUTHORITY: NONE` stub at its path); historical body readable where archived; `git show <A>:<path>` verified | §7.1–§7.5 |
| K | cold-start context | ordinary agent never loads `architecture-cycle.md`; phase-close agent and deliberate meta work do | §9.3 table |
| L | later phase closes while `STEADY` | ordinary reconciliation/subtraction/closed-work runs; cycle **stays** `STEADY`; no audits, no META | §3.2/§3.3 steady-state rule |
| M | close authorized but a step failed | `PHASE CLOSE` marker present, later surface missing; re-run writes the missing steps 5–9 and does not repeat owner ratification | §4.3, §13.1 |
| L | no collateral change | pipeline `P23 → P26 → P24 → P25`, all phase statuses, scopes and routes byte-identical; `AGENTS.md`, `work-checkpoint`, source, tests, CI untouched | diff review per slice |

---

## 13. Failure / rollback / partial-transition handling

### 13.1 Partial close

```text
symptom   authorization written (step 3/4) but a later step missing (e.g. tracker row not updated)
handling  re-run §4.2. The "PHASE CLOSE" marker proves closure was authorized, so step 3 is
          never repeated; steps 5–9 are "ensure value" and the re-run WRITES what is missing.
          The drift report names the surfaces still unsatisfied. No step except step 3 depends on
          the owner being present.
result    "marker present + surface absent" means authorized-but-incomplete, never "already closed".
```

### 13.2 Wrong gate closure

```text
symptom   a non-final child was treated as the phase gate (should be impossible after §4.1)
handling  revert in inverse write order (step 9 → 5), restore the phase README stage lines, and
          record the correction in the closeout record. If Phase 0 has already produced durable
          findings, an owner ruling is required before reverting.
```

### 13.3 Ratified-gate amendment (no pre-designed bypass)

The plan deliberately contains **no** state in which product implementation may proceed while
Phase 0/Phase 1 is outstanding. OD-3 is a ratified gate: Phase 0 and any justified Phase 1
response complete before the first P26 implementation slice. An earlier draft of this plan
carried a `DEFERRED` stage as a recorded escape hatch; it has been **removed** in review, because
pre-designing the bypass weakens the gate it exists to enforce and because no such condition is
currently anticipated.

```text
If, later, a real emergency requires P26 implementation to start with the cycle outstanding:
  owner explicitly amends OD-3 (a new owner decision + this plan's successor change), OR
  the cycle records the violation as debt against a named future trigger.
Neither is a supported stage; both are owner-level events, not agent choices.
```

### 13.4 Broken SHA anchor

```text
symptom   the closeout PR was squash-merged or the branch was force-pushed; `git show A:path`
          resolves only via the GitHub PR ref, not on main   (precedent: PR #59 / 650f7c1)
handling  1. correct the stub's recovery line to the reachable form:
             git fetch origin refs/pull/<n>/head && git show <A>:<path>
          2. note the degradation in the closeout record
          3. re-verify with `git show <A>:<path> | head -3`
prevention  §7.3 P2 (land the accepted body first, compact after) — the canonical route, immune to
            merge style. P1 (one merge-commit PR) is allowed only when that behaviour is
            guaranteed for the closeout PR.
```

### 13.5 Missing or stale state file

```text
symptom   architecture-cycle.md is absent, or its STAGE contradicts the tracker row
handling  the tracker row is authoritative for product status (OD-2); reconstruct the cycle file
          from the tracker row + the phase-close record, and correct it in one commit.
```

### 13.6 Audit contamination

```text
symptom   one audit saw the other's output, or an audit read P26 material as evidence
handling  discard the contaminated audit and re-run that agent; Phase 0 is not adjudicated on
          contaminated input (OD-3 contamination rule, OD-7 independence).
```

---

## 14. Explicitly deferred Phase-0-selected mechanisms

Not installed by S1–S5, and not justified by the harvest: same-PR capture, new architectural
contracts, seam guards, ratchets, Direction format, semantic range review, per-PR fresh-agent
architecture review, novelty detection, knowledge/index systems, CI, docs/link tooling,
reviewer roles, and any permanent governance database.

Phase 0 remains fully able to conclude **install nothing** and route the cycle straight to
`STEADY` (matrix E).

---

## 15. Owner-ratification record

### 15.1 Ratified inputs (not reopened)

```text
OD-1 explicit owner ratification closes a major phase        → applied §1, §4
OD-2 roadmap/README.md owns P-level status                   → applied §1, §4 steps 3–5
OD-3 P26 continues; implementation start is the boundary     → applied §1, §6
OD-4 hybrid closed-work model                                → applied §7
OD-5 conditional current.md META pointer                     → applied §1, §3.4
OD-6 live cycle ownership + pull-based routing               → applied §1, §9
OD-7 two independent audits + owner adjudication             → applied §8
OD-8 no migration now; P23 close is the boundary             → applied §5.3, §7.5
OD-9 no checked-in docs/link tooling                         → applied §7.3, §10.1
```

### 15.2 Reconsideration surfaced by planning

```text
OWNER RECONSIDERATION REQUIRED: none
```

Three plan-level findings (§1.11) are resolved mechanically inside this plan: link-repair cost
is measurable and near zero (F-1), the SHA anchor must not depend on merge style (F-2, canonical
route is now P2), and the archive layer needs a structural rule rather than judgment (F-3). None
contradicts a ratified choice; all three are implementation details of OD-4/OD-9.

### 15.3 New considerations recorded for the owner (informational, no re-decision needed)

```text
N-1  §3.1 OWNER ACTION + EVIDENCE fields — two additions to the ratified field sketch, each
     carrying one job (mechanical META condition; Phase 0 resumability).
N-2  §7.2 closed phase-wide hubs (umbrella/reconciliation/addendum) compact to stubs while the
     phase README stays live — recorded because the hubs hold most inbound references, which is
     why they stub *in place* rather than staying live in full.
```

### 15.5 Review corrections applied at r3 (requested changes, `1339ed1` → this revision)

```text
R1  §3.2/§3.3 STEADY no longer auto-restarts Phase 0: a phase close does hygiene
    (reconcile/subtract/close work) and stays STEADY; PHASE_0_DUE requires new demonstrated
    failure or an explicit owner request. Outcome 1 no longer creates a recurring audit.
R2  DEFERRED state removed from §3.2/§3.3; §13.3 rewritten as a ratified-gate amendment note
    (no pre-designed OD-3 bypass). N-1 (§13.3) retired.
R3  §4.3 marker semantics fixed: "PHASE CLOSE" short-circuits owner ratification only; a re-run
    WRITES steps 5–9 that are missing. §4.4 and §13.1 made consistent with that.
R4  §7.2 closed phase-wide planning hubs now compact to path-preserving stubs; only the phase
    README stays live. §7.5 migration scope expanded to all closed P23 work artifacts and closed
    slice workspaces.
R5  §7.2 archive rule made deterministic (multi-file/non-text → archive copy; single prose file →
    stub + Git recovery; already archived → leave alone). F-3 updated accordingly.
R6  §7.3/§7.4 flip: P2 (land body first, compact after) is canonical; P1 (merge-commit PR) is an
    optimisation allowed only when the merge behaviour is explicitly guaranteed.
```

No ratified owner decision (OD-1…OD-9) is reopened by these corrections; R1, R2, R3 and R4 remove
internal inconsistencies that would otherwise have contradicted the ratified plan, and R5/R6 make
two OD-4 mechanics deterministic. `OWNER RECONSIDERATION REQUIRED: none`.

### 15.4 Self-review before commit

```text
✓ agrees with the ratified plan (§21 ownership, §25 prerequisites, §19 triggers, §20 steady state)
✓ r3 review corrections R1–R6 applied and internally consistent (§15.5)
✓ agrees with the accepted harvest (§12 gap matrix → §10 tasks; §13 planning inputs → §11 slices)
✓ OD-1…OD-9 each represented (§15.1)
✓ P26 design/planning unblocked before Phase 0 (§6.1)
✓ P26 *implementation*, not planning, is the prospective boundary (§6.1)
✓ no Phase-0-selected mechanism in the prerequisite surface (§2.2, §14)
✓ no planned change to AGENTS.md / work-checkpoint / source / tests / CI / roadmap order (§10.9)
✓ paths and cross-references verified; no anchor-dependent links introduced
✓ implementation-ready: an executing agent needs no further harvest (§10 is file-by-file)
```

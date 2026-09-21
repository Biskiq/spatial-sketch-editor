# Architecture Operating Cycle — Ratified Plan

**Status:** ratified direction; implementation pending targeted workflow harvest
**Scope:** project-development process, parallel to the P-number product roadmap
**Current product pipeline:** P23 → P26 → P24 → P25
**Operational authority:** none yet — this document describes the planned operating model, not a currently active procedure.

---

## 1. Purpose

AI-assisted implementation can increase code throughput much faster than one project owner can continuously supervise every architectural implication.

The problem this plan addresses is not primarily agent memory.

It is the possibility that implementation choices become project conventions faster than they are deliberately reviewed, captured, enforced, or retired.

The operating objective is:

> **Make durable architectural change deliberate, propagating change visible, and stale guidance disposable.**

This should be achieved with the smallest amount of permanent process possible.

The system must not become a second product or a repository-knowledge platform.

---

## 2. Core principle

Do not build project-knowledge or architecture-governance machinery because it seems theoretically useful.

First establish that the repository has the failure the mechanism would solve.

The lifecycle is therefore:

```text
observe
→ adjudicate
→ install smallest justified response
→ use during normal product work
→ evaluate
→ keep / simplify / delete
```

The desired steady state is ordinary development with a few proven architectural safeguards, not a permanent experimental program.

---

## 3. What this is not

This plan does not currently justify:

* vector retrieval;
* semantic repository maps;
* knowledge graphs;
* claim databases;
* global decision/commitment registers;
* generated contract indexes;
* path-to-contract selectors;
* generated locality files;
* generic architectural novelty detection;
* per-PR fresh-agent architectural review;
* provisional-decision infrastructure;
* a generic second-instance ratchet;
* mass ADR backfill;
* a machine-readable contract database.

Any such mechanism requires a concrete future failure that the simpler system cannot address.

---

## 4. Project knowledge model

The semantic distinction survives even though no formal database/schema is proposed.

### Current Contract

What currently binds implementation.

Normally lives in:

```text
docs/reference/*
```

Contracts should be small, current, project-specific, and falsifiable enough that a reviewer can understand what kind of change would contradict them.

Typical shape:

```text
stable anchor
rule
one-line why
important exception, if needed
```

Partial enforcement belongs primarily with the enforcement mechanism unless omitting it from the contract would create a dangerous misconception.

---

### Decision provenance

Why an important current rule exists.

Decision history is secondary to the current contract.

Separate durable provenance is justified selectively when a decision is:

* expensive to reverse;
* about persisted/public shape or domain ownership;
* a recurring rejected alternative;
* intentionally temporary/scoped;
* a meaningful cross-domain tradeoff.

For smaller decisions, Git/PR history or a lightweight ratification reference may be sufficient.

---

### Direction

A current contract used while architecture is intentionally in transition.

It may state:

```text
TARGET
TEMPORARILY PERMITTED
FORBIDDEN
RATCHET
DONE WHEN
```

A Direction matters because it constrains unrelated future work while the migration is incomplete.

If it communicates nothing beyond an existing deprecation marker and mechanical ratchet, the extra prose should be removed.

---

### Enforcement

Code, types, tests, dependency boundaries, API shape, and ratchets can enforce parts of a contract.

Enforcement must be honest.

Each important guard should make clear:

```text
what it detects
what it does not detect
```

Prefer:

1. code/API structure that naturally communicates the architecture;
2. enforcement at real structural seams;
3. focused behavioral tests for known dangerous operations;
4. prose for irreducibly semantic intent.

Do not create elaborate types or abstractions solely to make governance easier.

---

### Work artifacts

Plans, research, QA and implementation records help produce durable knowledge but are not automatically permanent authority.

At completion they should shed authority.

The intended future closeout direction is:

```text
STATUS: CLOSED
AUTHORITY: NONE

Outcome:
...

Current contracts:
...

Relevant decisions:
...

Historical full version:
git show <exact-sha>:<exact-path>
```

The exact truncation/archive mechanics remain to be reconciled with the existing closeout workflow during implementation planning.

---

## 5. Admission rule for durable guidance

Do not document every conceivable misunderstanding.

A new operational architectural rule normally enters the durable layer when either:

1. a real incident, correction or repeated implementation pattern demonstrates the need; or
2. the first failure would create a durable, costly or difficult-to-detect architectural state.

The default is therefore evidence-driven authoring.

Each newly introduced contract should be identifiable as approximately:

```text
incident-derived
```

or:

```text
preemptive — first failure unacceptable
```

without requiring a formal metadata system.

---

## 6. Incident-derived counterexamples

When an actual repeated wrong implementation explains why a contract exists, preserve that concrete attractor where useful.

Shape:

```text
GENERAL RULE

Observed wrong shape:
...

Correct direction:
...
```

The general rule remains authoritative.

The example is one concrete instance, not the complete definition of the rule.

Do not invent counterexamples merely to make documentation look complete.

---

# 7. The meta-roadmap

This operating project progresses through event-driven phases while normal P-number product development continues independently.

```text
PHASE 0 — diagnose

PHASE 1 — install smallest response

PHASE 2 — prospective validation during normal product work

PHASE 3 — ratify / simplify / delete

STEADY STATE — surviving practices become ordinary development
```

The phases are triggered by project events, not calendar dates.

---

# 8. Phase 0 — retrospective diagnosis

## Trigger

Phase 0 becomes due when P23 is fully accepted and closed.

P23 provides the retrospective evidence set.

Do not materially change the documentation/process system in anticipation of the result.

---

## Goal

Determine what kind of architecture/process failure Museum actually exhibits.

Phase 0 asks:

> What consequential architecture-related behavior occurred during recent work that our existing development loop did not deliberately manage?

It distinguishes four outcomes.

### A — real unratified precedent

Implementation established a convention that nobody deliberately selected, and future contributors could reasonably infer the convention from the code.

### B — intended but undocumented

The owner deliberately made the decision, but that decision failed to reach current project authority.

### C — already caught

Existing review/checks already identified and managed the issue.

### D — not architecture

Ordinary implementation detail, duplication, framework convention, or local choice.

This classification is central because A and B require different solutions.

---

# 9. Phase 0 inputs

Use a bounded recent range, approximately:

```text
30–60 meaningful merged PRs
```

or:

```text
the previous 2–3 architecture-heavy completed slices/phases
```

depending on which gives the clearest coherent range after P23 closes.

Inputs may include:

* merged diffs;
* authoritative contracts applicable at the time;
* phase/plan context where necessary;
* PR review history only when owner adjudication needs it.

Do not clean history before inspecting it.

The goal is to evaluate the system that actually operated.

---

# 10. Phase 0 mechanical control pass

Before semantic review, inspect a very small number of structural sets only when they are already cheaply and honestly observable.

Possible examples, subject to code harvest:

* persisted document-schema surface;
* canonical writer set;
* known compatibility callers;
* visitor/editor dependency boundary.

Constraints:

* at most a few high-value sets;
* no new analysis framework;
* no tooling project merely to obtain the measurement;
* no semantic conclusion from count alone.

Question:

> Did an already meaningful bounded structural set expand or change?

The mechanical pass acts as a control.

If it explains every meaningful later finding, semantic recurring review may be unnecessary.

---

# 11. Phase 0 semantic review

Run the review independently at least twice.

A suitable question is:

> Across these merged changes, find places where two or more changes make the same non-obvious choice about how something is represented, owned, or named, where a contributor reading only the code could reasonably conclude that this is how the project does it.
>
> For each candidate:
>
> * cite each concrete occurrence;
> * state the inferred convention in one sentence;
> * state whether later occurrences appear to repeat/copy the earlier shape.
>
> Skip:
>
> * language/framework/library conventions;
> * ordinary local duplication;
> * behavior already stated by current contracts.
>
> If there are fewer than three candidates, report fewer than three.

Separately ask:

> Did any change contradict a rule that was explicitly written at the time?

That distinguishes newly formed precedent from `NOT FOLLOWED`.

The reviewer generates candidates only.

It never ratifies architecture.

---

# 12. Owner adjudication

The owner classifies each candidate as A/B/C/D.

For every meaningful finding also ask:

> **If this happens again next month, what catches it?**

Possible answers include:

* ordinary owner review;
* existing architecture test;
* dependency boundary;
* current contract;
* nothing.

“Normal review catches it” is an acceptable outcome.

No new mechanism is justified merely because a pattern exists.

For a real precedent, explicitly decide:

```text
RATIFY THIS PATTERN
```

or:

```text
CONTRACT AGAINST ITS FURTHER SPREAD
```

Do not leave discovered precedent unresolved.

---

# 13. Phase 0 branch outcomes

## Outcome 1 — mostly C/D

The existing development loop is sufficient.

Response:

* retain normal review;
* retain existing architecture checks;
* continue documentation/closeout cleanup;
* build no new architecture-cycle machinery.

This is a successful falsification result.

---

## Outcome 2 — A exists, but all meaningful A is visible at structural seams

Response:

* concise contracts for the implicated seams;
* honest guards/ratchets where mechanically representable.

Do not introduce semantic range review as a recurring process.

---

## Outcome 3 — B dominates

This is primarily a capture problem.

Response:

```text
owner makes durable architectural ruling
→ agent drafts corresponding current-contract delta in same PR
→ owner edits/approves
→ merge
```

Do not solve a capture problem with detection machinery.

---

## Outcome 4 — A exists outside obvious structural seams

If real semantic precedent repeatedly forms outside cheap mechanical boundaries and existing review fails to make it deliberate, the richer V0 is justified.

Only this result earns recurring semantic range reconciliation.

---

# 14. Phase 1 — install the smallest response

## Trigger

Owner adjudication of Phase 0 completes.

## Goal

Install only the mechanisms justified by the observed failure.

Phase 1 is therefore branch-dependent.

It may contain almost nothing.

Potential mechanisms:

* same-PR contract capture;
* one or more concise current contracts;
* honest seam guard;
* compatibility ratchet;
* one real Direction;
* semantic range review.

Mechanisms not justified by Phase 0 remain absent.

---

# 15. Phase 2 — prospective validation

## Trigger

Phase 1's smallest response is installed.

The next substantial architecture-heavy product phase becomes the validation window.

Expected first window:

```text
P26
```

assuming P23 supplied Phase 0 evidence.

Normal product development continues.

Do not turn P26 into an experiment-specific roadmap.

The installed mechanisms should operate quietly alongside normal work.

---

## Validation question

For every mechanism we retain, we should be able to say:

> We added this because P23 showed ______.

At P26 close, ask:

> Did ______ happen again, and did the mechanism handle it better?

Examples:

| Mechanism       | Historical reason                                   | Validation                                                                     |
| --------------- | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| Same-PR capture | Owner rulings were stranded in review discussion    | Did P26 rulings reach current contracts?                                       |
| Writer guard    | New canonical writers appeared unintentionally      | Did expansion become visible?                                                  |
| Range review    | Semantic convention propagated without ratification | Did phase-close reconciliation find meaningful precedent normal review missed? |
| Direction       | Legacy path kept receiving new usage                | Did unrelated work stop extending it?                                          |

The project does not need statistical proof.

Obvious cost is measurable; prevented failures usually are not.

Therefore mechanisms should be cheap and fail-safe.

---

# 16. Scope-change calibration

Product phases may grow or split without automatically resetting the operating cycle.

Example:

```text
P26
→ additional elevation work
→ arches
→ multi-storey implications
```

Ordinary scope growth does not advance the meta-roadmap.

The current validation stage continues until its semantic exit condition is reached.

A calibration check is required only when scope expansion materially changes the assumptions behind the active validation.

Ask:

> Does this new scope invalidate or materially broaden what we are currently testing?

If no:

```text
continue
```

If yes:

```text
record changed assumption
adjust validation scope if necessary
do not automatically add a new mechanism
```

A product phase split may extend the validation window deliberately if the mechanism has not received enough relevant real-world exposure.

---

# 17. Phase 3 — ratify, simplify or delete

## Trigger

The prospective validation window closes, expected initially at P26 close.

For every experimental mechanism:

```text
KEEP
SIMPLIFY
DELETE
```

Questions:

* Did it address the observed historical failure?
* Did it generate useful owner decisions?
* Did it impose noticeable friction?
* Does a cheaper mechanism now cover the same failure?
* Is the documented rule stale?
* Can code/API structure now communicate the truth instead?

Only survivors become normal project practice.

---

# 18. Steady state

Once Phase 3 finishes, the architecture-cycle design project ends.

Surviving practices become ordinary project development.

A mature loop may be only:

```text
normal implementation

when owner makes durable ruling:
    update current contract

when real structural seam is crossed:
    honest guard makes expansion visible

during active migration:
    Direction constrains new work

at major phase close:
    reconcile
    subtract stale guidance
    close/truncate work artifacts
```

Further mechanisms are introduced only in response to new demonstrated failures.

The desired outcome is for this process to become small and boring.

---

# 19. Trigger model

The meta-roadmap is event-driven.

Relevant trigger families:

### Major product phase closes

May:

* start retrospective diagnosis;
* end prospective validation;
* trigger reconciliation/subtraction.

### Durable architectural ruling occurs

May trigger same-PR capture if that mechanism has been justified.

### Active Direction changes

Update the Direction itself.

### Material roadmap/scope change

Run a calibration check.

### Mechanism clearly succeeds or fails early

Record the result; do not artificially wait for phase close when the conclusion is already obvious.

Most ordinary PRs should trigger nothing in the meta-roadmap.

---

# 20. Operating-cycle state

Once implemented, the live cycle should expose a compact state approximately like:

```text
STAGE:
CURRENT PRODUCT PHASE:
VALIDATION WINDOW:
MECHANISMS UNDER VALIDATION:
NEXT TRIGGER:
CALIBRATION CONDITIONS:
```

This should not become an activity diary.

Update the live cycle only when its state, next trigger, or active validation changes.

Durable domain artifacts remain the primary records of actual architectural changes.

---

# 21. Relationship to project documentation

The intended final ownership model is:

```text
AGENTS.md
= bootstrap + genuinely cross-cutting invariants

docs/README.md
= context router

docs/roadmap/README.md
= P-level product roadmap

Pxx/README.md
= phase/child state + direct artifact routes

exact plan/design/research/QA artifact
= owns its work detail

docs/reference/*
= landed current architectural truth

docs/operations/current.md
= current work baton

docs/operations/architecture-cycle.md
= live meta-roadmap once implemented

docs/operations/checkpoints/*
= interrupted work only

docs/operations/tech-debt/*
= durable deferred diagnosis

docs/archive/*
= history/evidence, never current authority
```

No mandatory slice README layer.

---

# 22. Relationship to agent skills

The intended future integration is small.

### work-checkpoint

Remain focused on interrupted-work recovery.

Do not turn checkpoints into architectural decision storage.

### slice-closeout

Likely future integration point for:

* contract promotion check;
* Direction completion/revisit;
* phase-close architecture-cycle trigger;
* stale-guidance subtraction;
* closed-work authority removal.

The exact changes require a targeted harvest of the cleaned workflow first.

Do not implement them from this plan alone.

---

# 23. Cost and kill philosophy

At Museum's scale, process cost is easier to measure than prevented failures.

Therefore every mechanism should be almost free and removable.

Examples of local kill conditions:

### Range reconciliation

Remove if repeated runs produce no actionable owner decision.

### Structural guard

Reconsider if it repeatedly blocks legitimate changes or the bounded set proves semantically meaningless.

### Direction

Remove the prose layer if deprecation + ratchet already communicate everything relevant.

### Same-PR capture

Simplify if it creates documentation churn without preserving actual durable rulings.

Kill conditions belong beside the mechanism when implemented.

Do not create a central governance metrics system.

---

# 24. AI-specific rationale

Most of this plan is ordinary architecture discipline.

AI changes the pressure in several ways.

### Loop compression

```text
code
→ agent infers convention
→ agent emits more matching code
→ convention becomes stronger evidence
```

can happen quickly.

### Uniform priors

Different agents may make the same plausible inference from the same misleading code shape.

### Review-capacity inversion

Implementation throughput can scale much faster than one owner's architectural attention.

### Testable readers

Agents can occasionally be tested against explicit guidance to determine whether prominent documentation still adds value.

These factors justify careful architecture hygiene.

They do not currently justify substantial custom AI infrastructure.

---

# 25. Preconditions before implementation

Before constructing the live architecture cycle:

## Prerequisite 1 — documentation routing cleanup

Complete the removal of mandatory slice READMEs and restore clear artifact ownership.

PR #65 is intended to establish this prerequisite.

## Prerequisite 2 — targeted workflow harvest

After the cleanup lands, inspect only the cleaned project workflow needed to determine:

* exact major-phase close semantics;
* exact phase status ownership;
* `operations/current.md` update lifecycle;
* `slice-closeout` hooks;
* `work-checkpoint` interaction;
* how the parallel operating-cycle state should be routed;
* how closed-work authority currently changes;
* what existing checks already support these transitions.

This is a docs/workflow harvest, not a deep product-code harvest.

## Prerequisite 3 — implementation-ready lifecycle plan

Use that harvest to design the exact changes required to introduce the live meta-roadmap.

## Prerequisite 4 — P23 fully closes

Only then does Phase 0 trigger.

---

# 26. Initial expected sequence

Assuming the current product roadmap remains:

```text
P23 → P26 → P24 → P25
```

the likely operating sequence is:

```text
PR #65
documentation topology cleanup

        ↓

targeted workflow harvest

        ↓

implement live architecture-cycle workflow

        ↓

P23 completes

        ↓

PHASE 0
P23 retrospective diagnosis

        ↓

PHASE 1
install smallest justified response

        ↓

P26
PHASE 2 prospective validation during normal work

        ↓

P26 closes
PHASE 3 keep / simplify / delete

        ↓

P24+
surviving mechanisms are ordinary project practice
```

This operating sequence is parallel to the product roadmap.

It does not create a new P-number phase.

---

# 27. End goal

This project succeeds when it ceases to require special attention.

The desired mature repository:

* does not require giant context packages;
* makes current architectural intent easy to find;
* lets code express everything it honestly can;
* keeps semantic contracts small;
* does not strand durable owner rulings in chats or reviews;
* makes important structural expansion visible where possible;
* prevents active migrations from silently growing;
* periodically reconciles only where evidence proves the need;
* removes stale guidance;
* prevents closed work from competing with current authority.

The mature system should be smaller than this plan.

If Phase 0 proves that the existing review loop is already sufficient, that smaller outcome is a success.

---

# 28. Current next step

Do not implement the mechanisms in this document yet.

After PR #65 establishes the cleaned documentation topology:

> **Harvest the cleaned workflow and write the implementation-ready plan for the live architecture-cycle/meta-roadmap.**

The harvest should determine integration details from the repository rather than this document inventing them.

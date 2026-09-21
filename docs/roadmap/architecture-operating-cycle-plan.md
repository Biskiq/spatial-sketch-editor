# Architecture Operating Cycle — Canonical Plan

```text
STATUS: RATIFIED — 2026-09-21
AUTHORITY: canonical strategic model
```

**Scope:** project-development process, parallel to the P-number product roadmap.
**Current product pipeline:** P23 → P26 → P24 → P25.

---

## 1. Purpose

AI-assisted implementation can increase code throughput much faster than one project owner
can continuously supervise every architectural implication.

The problem this plan addresses is not primarily agent memory. It is the possibility that
implementation choices become project conventions faster than they are deliberately
reviewed, captured, enforced, or retired.

The operating objective is:

> **Make durable architectural change deliberate, propagating change visible, and stale
> guidance disposable.**

This is achieved with the smallest amount of permanent process possible. The system must
not become a second product or a repository-knowledge platform.

---

## 2. Operating principles

These principles are applied together. None of them alone justifies machinery.

```text
Evidence is not architecture.
Repetition is not precedent.
Only explicit owner adjudication creates architectural authority.
```

Frequency, centrality, repetition, tool output, or graph shape may serve as evidence.
None of them is authority.

```text
Facts are recomputed from repository state.
Decisions and commitments are persisted.
```

A durable record carries what was decided and why — not a frozen copy of what the code
happened to look like on some date.

```text
Architecture knowledge must be able to disappear as well as accumulate.
```

Every installed mechanism carries its own removal condition. Subtraction is ordinary work,
not an exceptional event.

```text
Existing tools first.
Custom tooling only for demonstrated gaps.
```

Commodity questions are answered with commodity tooling (search, language tooling,
typecheck, tests, dependency analysis). Custom code is admitted only for a demonstrated,
precisely named gap — never in anticipation of generality.

The lifecycle that follows from these principles is:

```text
observe
→ adjudicate
→ install smallest justified response
→ use during normal product work
→ evaluate
→ keep / simplify / delete
```

The desired steady state is ordinary development with a few proven safeguards, not a
permanent experimental program.

---

## 3. What this is not

This plan does not justify, unless a demonstrated future failure requires it:

* vector retrieval, embeddings, or semantic repository search;
* a persistent repository index, code graph, graph database, or knowledge graph;
* filesystem watchers, incremental graph sync, or a structural history database;
* a general symbol resolver, call-graph engine, or multi-language abstraction;
* a custom MCP server or shared structural platform;
* centrality / god-node / architecture-smell metrics;
* automatic architecture-candidate generation;
* a global decision/commitment register or machine-readable contract database;
* generated contract indexes, path-to-contract selectors, or generated locality files;
* generic architectural novelty detection;
* per-PR fresh-agent review or provisional-decision infrastructure;
* a generic second-instance ratchet;
* mass ADR backfill;
* standing non-blocking structural audits or persistent structural counters.

Any such mechanism requires a concrete failure that the simpler system cannot address.

---

## 4. Project knowledge model

### Current contract

What currently binds implementation. Normally lives in `docs/reference/*`.

Contracts persist commitments, not recomputable observations. A contract contains only
what needs durable authority:

```text
rule
why
exceptions
```

Do not persist file/path/symbol coverage maps as architecture. Statements such as "these
files currently write X" or "these five modules currently consume Y" are recomputable
facts, not commitments; recompute them when needed instead of freezing them into a
contract.

Partial enforcement belongs primarily with the enforcement mechanism unless omitting it
from the contract would create a dangerous misconception.

### Decision provenance

Why an important current rule exists. Decision history is secondary to the current
contract. Separate durable provenance is justified selectively when a decision is
expensive to reverse, governs persisted or public shape, rejects a recurring
alternative, is intentionally temporary or scoped, or records a meaningful cross-domain
tradeoff. For smaller decisions, Git and PR history or a lightweight ratification
reference is sufficient.

### Direction

A current contract used while architecture is intentionally in transition. It constrains
unrelated future work while the migration is incomplete, and its shape is:

```text
TARGET
PERMITTED INTERMEDIATE STATE
FORBIDDEN
RATCHET
DONE WHEN
```

A Direction is temporary. When the migration finishes, the Direction is removed — not
preserved as permanent historical instruction. If it communicates nothing beyond an
existing deprecation marker and mechanical ratchet, the extra prose is removed.

### Enforcement

Code, types, tests, dependency boundaries, API shape, and ratchets can enforce parts of
a contract. Enforcement must be honest. Each important guard states what it detects and
what it does not prove.

Prefer, in order:

1. code and API structure that naturally communicates the architecture;
2. enforcement at real structural seams;
3. focused behavioral tests for known dangerous operations;
4. prose for irreducibly semantic intent.

Do not create elaborate types or abstractions solely to make governance easier.

### Work artifacts

Plans, research, QA, and implementation records help produce durable knowledge but are
not automatically permanent authority. At completion they shed authority under the
closed-work hybrid rule: a path-preserving stub at the original path records outcome,
residuals, current contracts, and exact Git recovery, while an archive copy is kept only
for multi-file bundles and non-text evidence. Archive is opt-in evidence, never
authority. The exact mechanics belong to the applied closeout procedure, not to this
plan.

---

## 5. Admission rule for durable guidance

Do not document every conceivable misunderstanding. A new durable architectural rule is
normally admitted when either:

1. a real incident, correction, or repeated implementation pattern demonstrates the
   need; or
2. the first failure would create a durable, costly, or difficult-to-detect
   architectural state.

The default is evidence-driven authoring: each new contract is approximately either
incident-derived or preemptive-because-the-first-failure-is-unacceptable, without
requiring a formal metadata system.

When a real repeated wrong implementation explains why a contract exists, the concrete
attractor may be preserved beside the general rule — observed wrong shape versus
correct direction — where it helps. The general rule remains authoritative; the example
is one instance, not the definition. Do not invent counterexamples to make
documentation look complete.

---

## 6. Lifecycle overview

The operating project progresses through event-driven stages while normal P-number
product development continues independently:

```text
PHASE 0 — diagnose
PHASE 1 — install smallest justified response
PHASE 2 — prospective validation during normal product work
PHASE 3 — keep / simplify / delete
STEADY  — surviving practices become ordinary development
```

The installed state machine is:

```text
WAITING
→ PHASE_0_DUE
→ PHASE_0_ACTIVE
→ ADJUDICATION
→ PHASE_1
→ PHASE_2_VALIDATING
→ PHASE_3_EVALUATE
→ STEADY
```

When neither adjudication lane justifies a mechanism, the cycle goes directly from
adjudication to `STEADY` with no manufactured validation window. When either lane
justifies at least one mechanism, the cycle passes through `PHASE_1` and prospective
validation before reaching `STEADY`.

---

## 7. Triggers and ownership

* **Phase 0 becomes due when the owning product phase is owner-closed.** Passing the
  final gate makes a phase closable; only explicit owner ratification closes it. The
  repository never infers closure from numbering. P23's close is the trigger that opens
  the first diagnosis.
* **Major phase closure stays explicitly owner-ratified.** The owner ruling is
  provenance recorded in the phase-close record; the persistent machine-read state is
  the tracker row.
* **`docs/roadmap/README.md` is the P-level status authority.** Phase READMEs own
  phase-local stage, child status, gates, and the phase-close record. `current.md` is
  the product baton. `architecture-cycle.md` is the live meta-state. Each surface owns
  exactly one concern.
* **Reference contracts own landed architectural truth.** Only landed behavior moves
  into `docs/reference/*`; roadmap proposals never silently become reference truth.
* **The applied close procedure performs transitions; this plan does not.** Exact
  phase-close write ordering, anchor mechanics, and recovery verification live in the
  slice-closeout skill and the live cycle file — not here.

---

## 8. Phase 0 — retrospective diagnosis

### Trigger and boundary

Phase 0 becomes due when P23 is fully accepted and owner-closed. P23 supplies the
retrospective evidence set.

P26-adjacent rule, fixed for the first cycle and generalizable: design, research, and
implementation planning for the next phase may proceed before and during Phase 0, but
implementation of the validation-window phase waits for Phase 0 adjudication and any
justified Phase 1 response. P26 design and planning work is never Phase 0 evidence —
Phase 0 stays retrospective and reviewers do not manufacture preemptive failures from
anticipated work.

Do not materially change the documentation or process system in anticipation of the
result.

### Goal

Determine what kind of architecture or process failure the project actually exhibits:

> What consequential architecture-related behavior occurred during recent work that the
> existing development loop did not deliberately manage?

Each candidate is classified by the owner as:

* **A — real unratified precedent.** Implementation established a convention nobody
  deliberately selected, and future contributors could reasonably infer it from the code.
* **B — intended but undocumented.** The owner deliberately decided, but the decision
  never reached current project authority. This is a capture problem, not a detection
  problem.
* **C — already caught.** Existing review or checks identified and managed the issue.
* **D — not architecture.** Ordinary implementation detail, duplication, framework
  convention, or local choice.

A and B require different responses, so the classification is load-bearing. The reviewer
generates candidates only and never ratifies architecture.

### Inputs

Use a bounded recent range — approximately 30–60 meaningful merged PRs, or the previous
2–3 architecture-heavy completed slices or phases, whichever gives the clearest
coherent range. Inputs may include merged diffs, the contracts authoritative at the
time, and phase or plan context where necessary. PR review history is consulted only
when owner adjudication needs it. Do not clean history before inspecting it; the goal is
to evaluate the system that actually operated.

### Mechanical control pass

Before semantic review, inspect a very small number of structural sets, and only those
already cheaply and honestly observable — for example the persisted document-schema
surface, the canonical writer set, known compatibility callers, or the visitor/editor
dependency boundary. At most a few high-value sets; no new analysis framework; no
tooling project merely to obtain the measurement; no semantic conclusion from a count
alone.

The guiding question is whether an already meaningful bounded structural set expanded
or changed. If the mechanical pass explains every meaningful later finding, recurring
semantic review is unnecessary.

Any mechanical result elevated into architectural evidence states its limits compactly:

```text
source / anchor
method / provenance
revision / SHA range
coverage limitation
```

This prevents structured output from appearing more authoritative than it is. It does
not decorate ordinary searches — no paperwork is required for routine agent
investigation.

### Fresh semantic reviews

Run two fresh-context semantic reviews over the same historical range. They do not read
each other's output before owner adjudication. Different reviewer/model perspectives
are preferred where practical. Reviewers look for repeated non-obvious choices about representation, ownership, or naming that a
contributor reading only the code could reasonably take for project convention — citing
each concrete occurrence, stating the inferred convention in one sentence, and noting
whether later occurrences repeat the earlier shape. Language, framework, and library
conventions, ordinary local duplication, and behavior already stated by current
contracts are skipped. If there are fewer than three candidates, fewer than three are
reported. Separately, reviewers ask whether any change contradicted a rule explicitly
written at the time, which distinguishes newly formed precedent from rules not
followed. Reviewers generate candidates only and never ratify architecture.

### Structural-workflow companion diagnostic

The Phase-0 diagnosis window carries one bounded companion diagnostic alongside the
architecture-loss audit above. It asks a different question:

```text
A. architecture-loss diagnostic
   → are architectural commitments being lost or propagating accidentally?

B. structural-workflow diagnostic
   → are scoped agents failing to inspect or verify downstream impact,
     and would existing tooling materially help?
```

The two may share timing and owner adjudication, but their conclusions stay separate:
an architecture finding never automatically justifies a tooling or workflow mechanism,
and a workflow finding never automatically justifies an architecture contract.

The structural-workflow diagnostic uses agent-session evidence where available
(navigation calls, wrong-path exploration, repeated reconstruction of the same
relationship, didn't-look versus didn't-find, recurring caller/dependent/dispatch/state
questions) together with Git, PR, and review correctness evidence (follow-up fixes from
missed dependents, review comments catching overlooked downstream impact, regressions
outside the original task scope). Correctness failures weigh more heavily than token
savings, and review criteria are predefined so results are not classified
opportunistically.

Its decision sequence is fixed: if graph-shaped work is rare, continue with native
search and existing verification and stop; if it is common and ordinary language-level
relationships dominate, use existing tooling (language-server and compiler tooling,
dependency analysis, narrow structural queries where measured work benefits); only if a
repeated gap survives existing tools is one narrow stateless script built for that one
precisely named relation — recomputed from repository state, provenance-labelled, and
creating no architectural authority of its own. No persistent repository graph, index,
or platform is created.

### Owner adjudication

Adjudication runs in two lanes inside one lifecycle: one state machine, one overall
transition, no second meta-track.

**Architecture lane.** The owner classifies each architecture candidate as A, B, C, or
D. For every meaningful finding, the owner answers:

> **If this happens again next month, what catches it?**

Ordinary owner review, an existing architecture test, a dependency boundary, or a
current contract are all acceptable answers. "Normal review catches it" is a valid
outcome — no new mechanism is justified merely because a pattern exists.

A real precedent is never left unresolved. It is either explicitly ratified or
explicitly contracted against so it cannot spread further.

**Structural-workflow lane.** The owner classifies the workflow evidence separately as
one of:

```text
no consequential gap
→ continue with existing tools and verification; stop

existing-tool or workflow correction justified
→ correct verification or adopt existing tooling; no custom code

narrow custom-tool gap justified
→ one narrow stateless script for the precisely named relation,
  admitted only under the rule in §9
```

A workflow finding never automatically justifies an architecture contract, and an
architecture finding never automatically justifies a tooling or workflow mechanism.

**Single overall transition.** The two lanes adjudicate separately but transition
together:

```text
neither lane justifies a mechanism → STEADY (no validation window)
either lane justifies ≥ 1 mechanism → PHASE_1 (install only what was justified)
```

An architecture Outcome 1 (mostly C/D) combined with a real consequential workflow gap
therefore enters `PHASE_1` for the workflow correction alone — the architecture branch
never vetoes the workflow lane, and the workflow lane never manufactures architecture
machinery.

### Branch outcomes

* **Outcome 1 — neither lane justifies a mechanism (architecture mostly C/D, no
  consequential workflow gap).** The existing development loop is sufficient. Retain
  normal review and existing architecture checks, continue documentation and closeout
  cleanup, and build no new architecture-cycle machinery. The cycle goes directly to
  `STEADY` with no validation window. This is a successful stop outcome.
* **Outcome 2 — real precedent concentrated at structural seams.** Write concise
  contracts for the implicated seams with honest guards or ratchets where mechanically
  representable. Do not introduce recurring semantic review.
* **Outcome 3 — intended-but-undocumented dominates.** This is a capture problem: the
  owner makes a durable ruling and the corresponding current-contract delta is drafted
  in the same PR, edited and approved by the owner, and merged. Do not solve a capture
  problem with detection machinery.
* **Outcome 4 — real precedent outside obvious seams.** Only if semantic precedent
  repeatedly forms outside cheap mechanical boundaries and existing review fails to
  make it deliberate is recurring semantic range reconciliation justified.

---

## 9. Phase 1 — install the smallest justified response

### Trigger

Owner adjudication of Phase 0 completes. Phase 1 installs only the mechanisms the
observed failure justified — it may contain almost nothing, and mechanisms not
justified by Phase 0 remain absent.

### Candidate mechanisms

* **Concise current contracts** for implicated seams or rulings, shaped as rule, why,
  and exceptions.
* **Same-PR contract capture:** when review reveals an architectural correction
  significant enough to change the implementation materially, the governing contract is
  updated in the same PR so the commitment does not disappear into review history.
* **One real temporary Direction** with the TARGET / PERMITTED INTERMEDIATE STATE /
  FORBIDDEN / RATCHET / DONE WHEN shape, removed when the migration finishes.
* **An honest seam guard or ratchet** where the repository exposes a real closed seam
  (forbidden import direction, single-owner mutation path, closed writer allowlist,
  compatibility boundary).
* **A workflow or verification correction** justified by the structural-workflow
  diagnostic.
* **Use of existing structural tooling** for the demonstrated gap.
* **One narrow stateless custom structural script,** but only under the admission rule
  below.

### Guard discipline

A guard is allowed only when the architectural meaning exists before the check.
Checkability never justifies a rule. The allowlist lives in the guard implementation,
not the contract. The guard states what it detects, the governing contract it enforces,
the mechanical evidence it relies on, and what it does not prove. A standing
mechanical check either blocks honestly or does not exist — there is no permanent
warn-only or audit tier. One-off mechanical queries remain ordinary investigation.

### Custom tooling admission rule

Custom structural tooling is introduced only when all of the following hold:

1. a specific structural question recurs in real tasks or caused consequential rework;
2. existing tools have been tried and demonstrably fail to answer it reliably;
3. the missing relation can be named precisely;
4. the proposed solution addresses only that relation;
5. its output states provenance and limitations;
6. it introduces no architectural authority of its own.

A single narrow script answering one demonstrated relation is the acceptable outcome; a
general intelligence package with graph, provider, history, and inference layers is
not. Further gaps reconsider abstraction only from demonstrated repetition — never in
anticipation of portability.

---

## 10. Phase 2 — prospective validation during normal product work

### Trigger and boundary

Installing Phase 1 mechanisms does **not** begin Phase 2. Phase 1 remains in a
ready-for-validation state — mechanisms installed, and the prepared implementation plan
of the validation-window phase reconciled once against them — until the first
implementation slice of the selected validation-window phase starts. That first
implementation slice begins Phase 2.

The expected first window is P26, assuming P23 supplied the Phase 0 evidence. Normal
product development continues; the validation-window phase is never turned into an
experiment-specific roadmap, and its scope is never redesigned to suit the mechanism.
The installed mechanisms operate quietly alongside normal work.

### Validation question

For every retained mechanism, the project must be able to say what historical failure
motivated it ("we added this because P23 showed ___"), and at window close it asks
whether that failure recurred and whether the mechanism handled it better. No
statistical proof is required: obvious cost is measurable and prevented failures
usually are not, so mechanisms must be cheap and fail-safe.

### Scope-change calibration

Product phases may grow or split without automatically resetting the operating cycle.
Ordinary scope growth does not advance the meta-roadmap; the active validation
continues until its semantic exit condition is reached. A calibration check is required
only when scope expansion materially changes the assumptions behind the active
validation ("does this new scope invalidate or materially broaden what we are
currently testing?"). If it does, the changed assumption is recorded and the
validation scope adjusted if necessary — never by automatically adding a new
mechanism. A phase split may deliberately extend the validation window when the
mechanism has not yet received enough relevant real-world exposure.

---

## 11. Phase 3 — keep, simplify, delete

### Trigger

The prospective validation window closes, expected initially at P26 close. For every
experimental mechanism the verdict is one of:

```text
KEEP
SIMPLIFY
DELETE
```

The evaluation asks whether the mechanism addressed the observed historical failure,
generated useful owner decisions, imposed noticeable friction, is now covered by
something cheaper, or rests on a stale rule — and whether code or API structure can now
communicate the truth instead. Only survivors become normal project practice. A
mechanism that clearly succeeds or fails early may be judged before the window closes
with its reason recorded; the window phase itself still closes normally.

### Subtraction

Phase 3 actively removes obsolete authority: completed Direction sections, stale or
unsupported clauses, obsolete implementation instructions, accumulated deltas that
should be resynthesized rather than appended indefinitely, and closed work still
presenting as authority. Where guards exist, the close reconciliation may inspect
allowlist growth — cumulative growth is never automatically accepted, and the question
is whether the architectural rule still describes reality, with tightening the
implementation or rewriting the contract as the two honest outcomes.

Recurring semantic range reconciliation is justified only if Phase 0 demonstrated the
failure it solves. It is never a mandatory ritual at every close.

---

## 12. Steady state

Once Phase 3 finishes, the architecture-cycle design project ends and surviving
practices become ordinary development:

```text
normal implementation

when the owner makes a durable ruling:
    update the current contract

when a real structural seam is crossed:
    an honest guard makes expansion visible

during an active migration:
    a Direction constrains new work

at a major phase close:
    reconcile
    subtract stale guidance
    close and truncate work artifacts
```

Future ordinary major-phase closes while `STEADY` stay `STEADY`: each close performs
reconciliation, subtraction, and closed-work hygiene without restarting diagnosis.
Fresh diagnosis restarts only for a demonstrated architecture failure or an explicit
owner request. Further mechanisms are introduced only in response to new demonstrated
failures. The desired outcome is for this process to become small and boring.

---

## 13. Relationship to project documentation

The ownership model is:

```text
canonical plan (this document)
= ratified strategic model

docs/operations/architecture-cycle.md
= live cycle state

.agents/skills/slice-closeout/SKILL.md
= applied close and transition procedure

docs/reference/*
= landed and current architecture contracts

workflow harvest
= historical bounded planning evidence
```

The workflow harvest is provenance: it explains how the installed behavior came to
exist, but it carries no authority and prescribes nothing further. Exact phase-close
write ordering, shell commands, anchor mechanics, acceptance matrices, and rehearsal
records belong to the applied skill and to Git/PR history — never to this plan.
PR #66 implementation and review chronology remains recoverable through Git/PR history.

`docs/roadmap/README.md` remains the P-level status authority and the stable route to
this plan. The temporary reconciliation input used to produce this plan was unrouted,
carried no authority, and has been deleted.

---

## 14. Scope versus verification

Strategic rule, owned by the cross-cutting agent workflow (`AGENTS.md`):

> Task scope limits what may be changed, not what may be inspected or verified.

A scoped task may inspect callers, dependents, wiring, tests and adjacent code needed
to establish impact. Task scope is never a reason to narrow verification that is
otherwise applicable:

```text
implementation/code tasks
→ the standard repository verification owned by the applicable test contract

documentation / other non-product work
→ the verification appropriate to that work

task scope itself
→ never a reason to narrow otherwise-applicable verification
```

Implementation scope stays narrow; verification is allowed to see consequences outside
that scope, and a change that appears necessary outside the assigned scope is reported
rather than made unless scope is explicitly expanded.

The concrete verification set — the editor suite, the typecheck, and the architecture
lane with its never-path-gated semantics — and its lane semantics remain owned by the
test documentation (`apps/editor/tests/README.md`) and are deliberately not duplicated
here, where they would rot.

---

## 15. Cost and kill philosophy

At this scale, process cost is easier to measure than prevented failures, so every
mechanism is almost free and removable, with its kill condition beside it. Repeated
reconciliation runs that produce no actionable owner decision are removed; a guard that
repeatedly blocks legitimate changes or watches a semantically meaningless set is
reconsidered; a Direction whose deprecation marker and ratchet already communicate
everything is reduced to prose-free enforcement; same-PR capture that creates churn
without preserving durable rulings is simplified. No central governance metrics system
is created.

---

## 16. AI-specific rationale

Most of this plan is ordinary architecture discipline. AI changes the pressure: inferred
conventions can amplify quickly from code to agent to more matching code; different
agents may draw the same plausible inference from the same misleading shape; and
implementation throughput can scale faster than one owner's architectural attention.
Agents can also occasionally be tested against explicit guidance to see whether
prominent documentation still adds value. These factors justify careful hygiene. They
do not by themselves justify substantial custom AI infrastructure.

---

## 17. End goal

This project succeeds when it ceases to require special attention. The desired mature
repository does not require giant context packages; makes current architectural intent
easy to find; lets code express everything it honestly can; keeps semantic contracts
small; does not strand durable owner rulings in chats or reviews; makes important
structural expansion visible where possible; prevents active migrations from silently
growing; reconciles only where evidence proves the need; removes stale guidance; and
prevents closed work from competing with current authority.

The mature system is smaller than this plan. If Phase 0 proves the existing review loop
already sufficient, that smaller outcome is a success.

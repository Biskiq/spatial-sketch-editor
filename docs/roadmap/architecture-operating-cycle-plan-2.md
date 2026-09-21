# Architecture Operating Cycle — Final Plan

## Status

This plan incorporates the completed multi-round review.

The original “self-correcting/evolving codebase” concept has been deliberately narrowed.

The system does **not** infer architecture from repetition, automatically promote implementation patterns into rules, maintain a knowledge graph of architectural observations, or require a persistent structural index.

The core operating model is:

```text
implementation evidence
        ↓
candidate finding
        ↓
human / owner adjudication
        ↓
explicit architectural commitment
```

Only the final step creates authority.

A second governing principle is:

> **Facts are recomputed from repository state. Decisions and commitments are persisted.**

---

# 1. Phase 0 — Falsify the Need

## Goal

Before building architecture-capture machinery, determine whether consequential architectural information is actually being lost by the current implementation/review process.

Phase 0 is a retrospective control exercise.

It must run **without introducing a new index, graph, structural platform, or architecture-capture mechanism**.

A valid Phase 0 result is:

> No additional system is justified.

## Review range

Use approximately:

* the last 30–60 merged PRs; or
* the last 2–3 architecture-heavy completed phases.

Choose a range large enough to contain repeated architectural work, but bounded enough for reproducible review.

Record the exact SHA range used.

---

## 1.1 Mechanical pass

Run only the small predefined structural sets already justified by the project.

Examples include:

```text
new persisted fields/types
new writers
new cross-boundary imports
repeated structural changes relevant to known seams
existing contract / invariant coverage where applicable
```

Do not invent additional metrics because they are easy to compute.

Each mechanical result used as architectural evidence must include:

```text
source / file:line
how the fact was obtained
revision or SHA range
coverage limitation
```

Example:

```text
Finding:
  packages/foo.ts:184 introduces a new writer of X

How known:
  compiler/reference inspection

Range:
  abc123..def456

Covers:
  identifier-level references

Does not see:
  string-key dispatch or runtime event routing
```

The purpose is to prevent structured output from appearing more authoritative than it actually is.

---

## 1.2 Fresh semantic reviews

Run two fresh-agent semantic reviews over the same historical range.

The agents should independently look for:

* repeated non-obvious architectural choices;
* choices that propagated through implementation;
* architectural corrections that mattered;
* patterns that appear to have become precedent without being made durable.

These reviews are evidence channels, not authorities.

Where practical, vary reviewer/model perspective rather than treating two samples from the same prior distribution as fully independent.

---

## 1.3 Owner adjudication

Every candidate is classified into one of:

```text
A. Real precedent worth capturing

B. Intended architecture that was not documented

C. Already caught adequately by ordinary review/process

D. Not architecture / incidental implementation
```

The adjudication—not the frequency of the pattern—determines whether anything deserves architectural authority.

---

## 1.4 Phase 0 outcomes

### Outcome A — Stop

Normal review catches essentially everything consequential.

Most proposed findings are incidental, already visible, or not durable architectural knowledge.

Result:

```text
do not build Phase 1 machinery
```

This is a successful outcome.

### Outcome B — Small controls justified

There are occasional consequential misses concentrated around recognizable structural seams.

Proceed to the smallest Phase 1 controls that directly address those misses.

### Outcome C — Stronger evidence of information loss

There are multiple consequential misses, repeated owner corrections that failed to become durable, or failures outside obvious seams.

Phase 1 may justify somewhat broader controls, but still only mechanisms supported by actual evidence.

---

# 2. Separate Structural-Workflow Retrospective

This is **not Phase 0**.

Phase 0 asks:

> Are architectural decisions being lost?

This retrospective asks:

> Are scoped coding agents missing structural impact, and would existing tooling materially help?

Do not combine their conclusions.

---

## 2.1 Primary new failure mode: scope-induced blindness

The discovered workflow risk is not primarily that fresh agents forget repository topology.

It is that tightly scoped tasks make local exploration efficient while potentially suppressing verification outside the requested area.

Therefore adopt this workflow rule now:

> **Task scope limits what you may change, not what you may inspect or verify. Before finishing, run the project's full verification (svelte-check plus tests) regardless of scope. If a change outside scope looks necessary, report it instead of making it.**

The implementation scope remains narrow.

Verification is allowed to see consequences outside that scope.

---

## 2.2 Retrospective evidence

Use two evidence channels.

### Agent-session transcripts

Measure:

```text
structural-navigation calls
wrong-path exploration
repeated reconstruction of the same relationship
didn't-look vs didn't-find
recurring questions about callers/dependents/dispatch/state flow
```

### Git / PR / review history

Measure actual correctness loss:

```text
follow-up fixes caused by missed dependents
review comments discovering an overlooked downstream impact
regressions outside the original task scope
changes revised because the agent misunderstood structural impact
```

Correctness failures matter more than token savings.

Predefine the coding criteria before reviewing the sample so results are not classified opportunistically.

---

## 2.3 Decision sequence

If graph-shaped work is rare:

```text
continue using native search and existing verification
stop
```

If it is common and ordinary TS/module relationships dominate:

```text
use existing tools
LSP / compiler tooling
dependency-cruiser
Serena / CodeGraph narrow queries if useful
```

If a repeated gap survives existing tools:

```text
build one script for that one gap
```

Likely examples might include:

```text
command name
→ registration
→ handler
→ dispatch sites
```

or another demonstrably missing framework/project-specific relationship.

The script must be:

```text
stateless
deterministic
recomputed from repo state
provenance-labelled
narrowly scoped
```

No shared structural platform should be created merely because one script exists.

---

# 3. Phase 1 — Smallest Validated Controls

Phase 1 exists only if Phase 0 justifies it.

## 3.1 Architecture contracts

Contracts persist commitments, not observations.

A contract contains only what needs durable authority:

```text
rule
why
exceptions
```

Coverage information should not become a persistent file/path/symbol mapping.

Do not encode observations such as:

```text
these files currently write X
these five modules currently consume Y
```

inside the contract.

Those facts can be recomputed when needed.

---

## 3.2 Direction for active migrations

Temporary architectural transitions may use a `Direction` section containing:

```text
target
permitted intermediate state
forbidden state
ratchet
done-when
```

Directions are temporary.

Once the migration completes, remove the Direction rather than preserving it as permanent historical instruction.

---

## 3.3 Seam guards

A mechanical guard is allowed only when the repository exposes an honest, closed architectural seam.

Examples might include:

```text
forbidden import direction
single-owner mutation path
closed allowlist of writers
compatibility boundary
```

Rules:

1. The architectural meaning must exist before the check.
2. Checkability is never a reason to ratify a rule.
3. The allowlist lives in the guard implementation, not the contract.
4. The guard must have no realistic false-alarm mode for its claimed coverage.
5. A failure must clearly identify:

   * the violated rule;
   * the governing contract;
   * the mechanical evidence;
   * what the check covers;
   * what it does not prove.

A standing mechanical check either blocks or does not exist.

Do not create a persistent warn-only/audit tier.

One-off mechanical queries remain ordinary investigation under the evidence rules.

---

## 3.4 Same-PR contract delta

If PR review reveals an architectural correction significant enough that the implementation must materially change, that knowledge should not disappear into review history.

Update the governing contract in the same PR.

This produces the smallest legitimate feedback loop:

```text
implementation
    ↓
meaningful architectural correction
    ↓
same-PR contract update
```

The contract captures the commitment.

It does not capture the complete implementation history that led to it.

---

# 4. Phase 2 — Range Review and Subtraction

Phase 2 runs at phase close.

Its purpose is to identify what individual PR review cannot easily see across a range of completed work.

Look for:

* repeated unguided architectural choices;
* repeated owner corrections;
* contracts that no longer match intended architecture;
* expired migration guidance;
* accumulated exceptions that indicate a rule has stopped being true.

---

## 4.1 Mandatory subtraction

Phase close must actively remove obsolete authority.

Candidates include:

```text
completed Direction sections
stale or unsupported clauses
obsolete implementation instructions
duplicated accumulated deltas
closed work artifacts that still appear authoritative
```

Contracts should be resynthesized rather than indefinitely appended.

Historical implementation plans may remain as evidence, but not as current authority.

---

## 4.2 Guard allowlist review

Once Phase 1 guards exist, phase close should inspect how their allowlists changed over the phase.

If an allowlist grows:

```text
do not automatically accept cumulative growth
```

Ask whether the underlying architectural rule remains true.

Possible outcomes:

```text
tighten the implementation

or

rewrite the architectural contract
```

Do not simply continue expanding the allowlist phase after phase.

A persistently growing allowlist is evidence that the rule itself may no longer describe the architecture.

---

# 5. Evidence Discipline

Mechanical evidence elevated into architecture review should carry:

```text
source anchor
method / provenance
revision or range
coverage limitation
```

This applies to:

```text
Phase 0 findings
guard failures
Phase 2 architectural evidence
same-PR architectural adjudication
```

It does **not** need to decorate ordinary coding-agent searches.

Use wording such as:

```text
How known:
  compiler

As of:
  SHA abc123

Covers:
  static import edges

Does not prove:
  runtime dispatch or .svelte event wiring
```

The goal is to prevent “machine-generated” from being confused with “complete” or “authoritative.”

---

# 6. Explicit Non-Goals

Do not build:

```text
custom repository index
persistent code graph
graph database
filesystem watcher / incremental graph sync
general symbol resolver
general call-graph engine
structural history database
automatic architecture candidate generator
knowledge graph linking prose to code
embeddings / semantic repository search
centrality / god-node / architecture-smell metrics
general multi-language abstraction
custom MCP server
standing non-blocking structural audits
persistent structural counters
```

Do not infer architectural truth from:

```text
frequency
centrality
repetition
tool output
graph shape
```

These may be evidence only.

---

# 7. Existing Tools Before Custom Code

Use commodity tooling for commodity questions.

Examples:

```text
rg / glob / reads
    local discovery

TypeScript / Svelte language tooling
    definitions, references, type-visible relationships

svelte-check
    repository-wide Svelte/TS validation

tests
    behavioral verification

dependency-cruiser / equivalent
    module dependencies and honest import-boundary guards

Serena / CodeGraph narrow operations
    optional structural queries if actual measured work benefits
```

Do not require CodeGraph or any equivalent tool as part of the architecture operating cycle.

---

# 8. Custom Tool Admission Rule

Custom structural tooling may be introduced only when all of the following are true:

1. A specific structural question recurs in real tasks or caused consequential rework.
2. Existing tools have been tried and demonstrably fail to answer it reliably.
3. The missing relation can be named precisely.
4. The proposed solution addresses only that relation.
5. Output states its provenance and limitations.
6. It introduces no architectural authority of its own.

Example acceptable result:

```text
scripts/trace-command-dispatch.ts
```

Example unacceptable result:

```text
packages/repo-intelligence/
    graph/
    providers/
    history/
    inference/
```

If additional gaps later appear, reconsider abstraction only from demonstrated repetition—not in anticipation of portability.

---

# 9. Final Operating Principles

### Authority

```text
Evidence is not architecture.
Repetition is not precedent.
Only explicit adjudication creates architectural authority.
```

### Persistence

```text
Facts are recomputed.
Decisions and commitments are persisted.
```

### Scope

```text
Scope limits changes, not verification.
```

### Automation

```text
Automate only honest seams.
A mechanical check either reliably blocks or does not become a standing check.
```

### Knowledge hygiene

```text
Architecture knowledge must be able to disappear as well as accumulate.
```

### Tooling

```text
Existing tools first.
Custom code only for demonstrated gaps.
```

---

# 10. Immediate Sequence

1. Add the scope-vs-verification rule to the agent workflow instructions and confirm repository full verification includes `svelte-check` plus the appropriate test suite.
2. Run Phase 0 exactly as already planned, with the SHA/range and limitation annotations added to mechanical evidence.
3. Separately run the structural-workflow retrospective using transcripts plus Git/PR evidence.
4. Classify Phase 0.
5. If Outcome A: stop.
6. If Outcome B/C: implement only the Phase 1 controls supported by the findings.
7. At later phase closes, perform Phase 2 subtraction and inspect guard allowlist growth once guards actually exist.
8. Introduce structural tooling only if the separate retrospective demonstrates one recurring gap that existing tools cannot cover.

No additional review round is required before Phase 0 execution.

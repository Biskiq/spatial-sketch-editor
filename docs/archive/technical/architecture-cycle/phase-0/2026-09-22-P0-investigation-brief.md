# Phase 0 — investigation brief (assignment freeze)

```text
STATUS:   FROZEN 2026-09-22 — the three Phase-0 assignments are fixed as written here, before any
          investigation output exists. The commit that adds this file is the freeze point.
ROLE:     assignment freeze — who runs which lane, over which evidence, under which boundaries,
          with which questions fixed. Preparation only.
NOT:      a plan · a contract · evidence · a result · a candidate list · a status field ·
          a tracker · authorization to run anything · a second authority
OWNER:    coordination workspace (meta/phase0)
RANGE:    ./2026-09-22-P0-frozen-evidence-range.md   (frozen; both reviewers receive exactly this)
STATE:    ../../../operations/architecture-cycle.md   (sole live meta-state authority)
METHOD:   ../../architecture-operating-cycle-plan.md §8 — canonical. Candidate form, A/B/C/D
          classification, adjudication and the workflow lane's decision sequence stay owned there.
```

Three isolated investigations are owed by `PHASE_0_ACTIVE`. This brief freezes their assignments — the
range, the inputs, the questions and the boundaries — so that neither lane can widen, narrow or
re-word its own task once it has seen an outcome. It records nothing about what any lane will find,
launches nothing, and advances nothing: `PHASE_0_ACTIVE`, `OWNER ACTION: not required`,
`VALIDATION WINDOW: empty` and `ACTIVE MECHANISMS: none` are unchanged by this file.

## Frozen common terms

- **Frozen range.** `f8411f7..b5f75e7` (P23, 2026-09-08 → 2026-09-22) exactly as fixed in
  `./2026-09-22-P0-frozen-evidence-range.md`. A range change is a coordination decision recorded
  there, never a reviewer's judgement call.
- **Mechanical pass evidence.** `./mechanical-control-pass.md`, read as the artifact stands, not as a
  summary of it. It is one input to each lane; it is not a starting hypothesis, not a candidate list
  and not a scope.
- **Historical contract comparison.** Every candidate is compared against the contract authoritative
  **at the time of the occurrence**, retrieved as of the commit under review
  (`git show <commit>:<path>`) — not against the current text. The contracts did not stand still
  inside the range.
- **Provenance minimum.** Every output records, for every claim: source (path and revision), method
  (how it was established), revision range, concrete evidence (quote, path, line or diff),
  counterevidence where it exists (the occurrence that cuts the other way, or "none found"), and
  limitations (what the method cannot establish). An output without its revision range is not usable
  as Phase-0 evidence.
- **Publication embargo — both or neither.** Neither review is pushed, published, posted, summarised
  or integrated until **both** independent outputs are frozen. Finishing first is not a licence to
  publish. The workflow diagnostic is likewise held until both reviews are frozen.
- **Isolation is information isolation, not just directory separation.** Each reviewer uses a fresh
  independent context and its own worktree/branch. A reviewer must not read the other review's branch,
  commits, worktree or output — no `git log <other-branch>`, no `git show <other-branch>:<path>`, no
  cross-worktree file reads — before both outputs are frozen. The embargo is an instruction, because
  the filesystem does not enforce it.

## Assignment A and Assignment B — semantic architecture review (identical assignment)

Two reviewers, A and B, receive **this identical assignment** and run it independently to two separate
outputs (`review-a.md`, `review-b.md`). Neither reads the other's output. Zero candidates is a valid
result.

The frozen assignment:

1. **Same frozen P23 range and the same mechanical-control-pass evidence** for both reviewers —
   nothing withheld from either, nothing extra given to either.
2. **Independently inspect consequential non-obvious implementation choices about representation,
   ownership and naming** — choices a contributor reading only the code could reasonably take for
   project convention.
3. **Cite concrete occurrences, their recurrence, and the contract authoritative at each occurrence.**
   An occurrence without its revision and its then-authoritative contract is not a candidate.
4. **Separately identify changes that contradicted a rule already written at the time** — this is what
   separates newly formed precedent from a rule that was written and not followed, and it is reported
   as its own set, not folded into the candidates.
5. **Exclude ordinary implementation detail, framework and library convention, and already-contracted
   behaviour.**
6. **The mechanical pass informs but must not narrow the semantic search.** It measured three
   structural sets at the range's two endpoints. A lane may use it as context and may check whether a
   structural change explains something it saw; a lane may not treat its three sets as the search
   space, nor treat a zero in it as a zero in the semantic lane.
7. **Candidates only.** No A/B/C/D classification, no ratification, no mechanism recommendation, no
   "what should catch this next time" answer — those are the owner's, at adjudication, per §8.
8. **Never manufacture findings to meet a quota.** Fewer than three candidates is a normal outcome;
   zero is a valid outcome and is reported as such, with the method and limitations that produced it.

Each review output states its own revision range, method, evidence and limitations, and says plainly
where it found nothing. Convergence between A and B is not required and is not a goal: two independent
nulls are stronger evidence than one shared narrative.

## Assignment C — structural-workflow diagnostic (separate assignment)

A separate lane over the same range, asking a different question. It is **not** a third architecture
reviewer: an architecture finding never justifies a tooling or workflow mechanism, and a workflow
finding never justifies an architecture contract.

**Assessment criteria — fixed here, before any session outcome was examined,** so that results cannot
be classified opportunistically:

1. Did **graph-shaped questions recur in actual work** (callers, dependents, dispatch, ownership,
   state reachability), or were the recurring questions ordinary local ones?
2. Did **missed downstream impact cause correctness failures or consequential rework** — not
   inconvenience, not style?
3. For each consequential miss, does the evidence distinguish **"didn't look" from "looked but
   couldn't find"**? These have different dispositions and must not be merged.
4. **Would existing search, language-server, compiler or dependency tooling have answered the
   demonstrated question?** — asked of the concrete question actually faced, not of tooling in the
   abstract.
5. **Is any repeated consequential gap still unresolved after considering existing tools?** Only then
   is a narrow custom-tool gap in question at all.
6. **Correctness matters more than token savings.** A cheaper loop that misses a real defect loses;
   token cost alone never establishes a gap.
7. **Missing agent-session evidence is a limitation, not permission to infer behaviour.** Where
   session evidence is unavailable, the criterion is recorded as unassessable rather than answered
   from assumption, memory or reconstruction after the fact.

**Evidence classes available to this lane.** Agent-session evidence where it exists (navigation
calls, wrong-path exploration, repeated reconstruction of the same relationship, recurring
caller/dependent/dispatch/state questions), together with Git, PR and review correctness evidence
(follow-up fixes for missed dependents, review comments that caught overlooked downstream impact,
regressions outside the original task's scope).

**Output.** Evidence and candidate dispositions only — this lane produces **no authorization for
tooling**. The decision sequence itself (continue with existing tooling / adopt existing tooling /
one narrow stateless script under §9) stays canonical in §8 and is the owner's to apply; this lane
supplies the evidence each branch of it would need, and records which branches its evidence does and
does not support.

## Lane boundary

```text
A and B   architecture lane — representation, ownership, naming precedent + contradicted rules
          → candidates only; classification is the owner's
C         structural-workflow lane — recurrence, correctness impact, didn't-look vs didn't-find,
          existing-tool sufficiency → evidence and dispositions; no tooling authorization
neither   a finding in one lane never manufactures a mechanism in the other; adjudication runs in
          two lanes but transitions once (§8)
```

## Freeze mechanics

- All three assignments are frozen as written above, effective 2026-09-22, before any output exists.
- A change to a lane's questions or boundaries **after that lane has started** invalidates that lane's
  output rather than silently re-scoring it; a change before it starts is a coordination decision
  recorded in this file, with the reason.
- The two-review embargo, the isolation rules above and the both-or-neither publication rule cannot be
  relaxed by a lane, a deadline, or a partial result.
- This brief does not authorize running anything, and its existence is not evidence for either lane.

## Limitations of this brief

- **Assignment text is not evidence.** Nothing here was measured; the range's properties are owned by
  the frozen-range document and the mechanical pass.
- **The workflow lane's evidence base is not yet known.** Whether session evidence exists for the
  window is unestablished; criterion 7 anticipates its absence rather than assuming its presence, and
  a lane that cannot assess a criterion says so.
- **Identical assignment does not yield identical coverage.** A and B share the task by design; where
  their coverage differs, the difference is a result, not a defect to be smoothed over.
- **Reviewer independence is instructionally enforced only.** Shared worktrees, branches and one Git
  object store mean the isolation rules are rules, not barriers; a review that violates them is
  unusable and must be re-run in a fresh context.
- **No result is predicted here.** This brief fixes questions and boundaries so that whatever the
  investigations find can be adjudicated on its evidence rather than on an improvised method.

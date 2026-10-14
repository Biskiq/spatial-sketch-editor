# Phase 0 — structural-workflow diagnostic

```text
STATUS:    written 2026-09-22 · one run, over the frozen range · evidence and candidate
           dispositions only — nothing is classified, ratified or authorized here
ROLE:      Phase-0 evidence, structural-workflow lane. Answers: are scoped agents failing to
           inspect or verify downstream impact, and would existing tooling materially help?
NOT:       a third architecture review · A/B/C/D classification · a contract · a mechanism or
           tooling recommendation · an authorization to build anything · a status field ·
           a tracker · a second authority
RANGE:     f8411f7f0dc8cd0bb8e05683259d7c2aa6a9fdbb .. b5f75e7ecba5149ed03a26237402ba5a41266372
           (432 commits, 45 merged PRs; ./2026-09-22-P0-frozen-evidence-range.md)
CRITERIA:  ./2026-09-22-P0-investigation-brief.md §Assignment C — seven criteria, frozen
           2026-09-22 before any session outcome was examined; applied as written, not
           reinterpreted after results were seen
METHOD:    ../../architecture-operating-cycle-plan.md §8 — the workflow lane's question, decision
           sequence and branch outcomes stay owned there and are not restated as authority here
INPUTS:    the canonical plan §8, the frozen brief, the frozen range, and
           ./mechanical-control-pass.md read as the artifact stands
STATE:     docs/operations/architecture-cycle.md is the sole live meta-state authority
BOUNDARY:  architecture candidates, ratification and any mechanism decision belong to the other
           lanes and to the owner. This document never manufactures a mechanism.
```

## 0. The question this lane had to answer

`A. architecture-loss diagnostic → are architectural commitments being lost or propagating accidentally?`

`B. structural-workflow diagnostic  → are scoped agents failing to inspect or verify downstream`
`                                     impact, and would existing tooling materially help?`

This document answers only **B**, over the frozen P23 range, and supplies the evidence each branch
of §8's workflow decision sequence would need. It does not choose a branch.

## 1. Sources — and what each one can and cannot establish

| # | Source | Revision / range | Method | Can establish | Cannot establish |
|---|---|---|---|---|---|
| S1 | Git history of the frozen range | `f8411f7..b5f75e7` (432 commits, 45 merged PRs) | `git log`/`show`/`grep`/`blame`, read-only; commit subjects **and bodies**, which in this repository carry the review-and-rework account | that a change happened, when, what it fixed, what the author said it fixed, and (often) which review round found it | whether an agent *looked*, what it searched, or why it stopped — a diff never shows navigation |
| S2 | In-range test-suite harvest | `docs/operations/test-suite-harvest-2026-09-19.md` (2,210 lines), landed 2026-09-20 by `9600600`, `0607bfd`, `38c5701`, `d68ae79` (PRs #63–#65) | read in full sections; claims cross-checked against the commits it names | three recorded review rounds, each finding a **blocker in the verification itself**, with the mutation evidence and the retired-mechanism probe results printed | agent navigation; it reports verification outcomes, not how the author searched |
| S3 | Exported agent-session evidence | `Repo-Audit/agent-harness-audit-subagent-logs.md` (1,949 lines), landed 2026-09-18 by `650f7c1` (PR #59) — **inside the range**; export date 2026-09-18 | read the task assignments, every recorded tool call and the final reports for probes A–L; counted tool-call kinds | the **tool surface actually available to agents** (45/45 calls were shell `exec`), and how navigation questions were concretely posed and resolved in 12 fresh-context probes | anything about the P23 *implementation* sessions: these 12 probes are an audit of the agent **harness** (routing, checkpoints, handoff), G–J ran on **synthetic fixtures**, and the export excludes private reasoning |
| S4 | Audit author's synthesis | `Repo-Audit/Repo-audit-summary.md`, same commit as S3 | read in full | what the auditor concluded, flagged as the auditor's finding rather than transcript fact | independent verification of each synthesis claim; the summary is an interpretation of S3 |
| S5 | PR discussion | fetched read-only via `gh pr view <N> --json reviews,comments` for the in-range PRs | enumerated every PR in the frozen range for reviews and comments | the one substantive review thread and two author response notes that exist (below) | anything where the thread is empty: see §1.1 |
| S6 | Post-range coordination commits | `272e1ac`, `722280f` (PR #76, after `b5f75e7`) | read as artifacts | — | not counted as range evidence; recorded only as labelled adjacent context in §7.4 |

### 1.1 PR-discussion coverage is nearly empty, and that is a finding

Enumerated over the frozen range's PRs (`gh pr view <N>`), **43 of 45 carry zero reviews and zero
comments.** Three carry anything at all:

- **PR #55** (P23.12, merged 2026-09-16, merge `f3efed9`) — two substantive owner reviews
  (`COMMENTED`, 2026-09-16). This is the range's only real review thread, and it is the richest
  evidence in this document for *"a review comment that caught overlooked downstream impact"*.
- **PR #45** (P23.6c, merged 2026-09-13) — one comment, the **author's** summary of second-round
  review fixes pushed as `453f084`. The review text itself is not in GitHub.
- **PR #62** (test lanes, merged 2026-09-20) — one comment, the **author's** response recording three
  review-found false successors. Review text not in GitHub.
- PR #9 carries one bot (Vercel) comment; PR #22 one further comment, non-substantive.

Everything else is zero. The review process for the frozen range ran **outside** GitHub's PR
interface; the review findings survive in commit bodies, in S2, and — for P23.12 only — in S5.
This bounds criterion 3 for every case except D1: I usually have the *fix*, rarely the *review
words*.

## 2. Method, and how claims are labelled

- **Two evidence classes are kept apart.** *Artifact evidence* (S1, S2, S6) shows what happened and
  is reproducible from the commands below. *Session evidence* (S3, S4) shows navigation behaviour,
  and only for the 12 harness probes. No claim about agent behaviour is inferred from a diff.
- **Claim labels.** `[artifact]` — established from S1/S2 as printed. `[session]` — established
  from S3/S4 and quoting it. `[derived]` — counted or computed by a step printed with it.
  `[unassessable]` — the evidence class that could establish it is absent.
- **The distinction that carries the diagnosis.** For each case I separate the **question type**
  (what had to be found), the **mechanism's discriminating power** (did a check run and report
  clean while being unable to see the defect?), and the **search recipe** (was the answer reachable
  by a query the agent could have written?). These have different dispositions and are not merged.
- **Correctness outranks cost** (criterion 6). Findings whose only impact is context cost are
  labelled **cost-only** and are not allowed to establish a gap; several are reported precisely
  because they *look* like failures and are not.
- **Revisions are read as they stood.** Where a code fact is cited it is read at `b5f75e7` (the
  range's end), not at the working tree, because post-range commits exist on this branch.
- **The two rebased duplicates count once.** `f678ee8` is the revision in the range's ancestry;
  `247528c` is the pre-rebase duplicate of the same patch (`git patch-id --stable` → `756693b9…` on
  both, and `247528c` is not an ancestor of `b5f75e7`). The frozen range warns P23.15 landed by
  rebase. Every count below treats them as one change.
- **Isolation respected.** `review-a.md` and `review-b.md` were neither read nor listed for
  content; they did not exist in this worktree at the time of writing. No other branch, worktree or
  commit of either reviewer was inspected.

## 3. Criterion-by-criterion assessment

### C1 — Did graph-shaped questions recur in actual work?

**Supported** `[artifact]`. The recurring question was not "where is symbol X declared" — it was
**"which other sites must also change?"**: set enumeration over a surface that no single symbol
denotes. Demonstrated recurrences, all inside the range:

| Recurring question shape | In-range instances | Case |
|---|---|---|
| Which consumers must be routed through a new shared authority? | P23.12 identity layer, three review rounds (2026-09-15/16) | D1 |
| Which write/serialize paths must the new format rule gate? | writer contract split in two; generic serializer missed | D2 |
| Which document-replacement seams must reset this state? | wall-run (×2 passes), shared history, Navigator state, scene-JSON and archive import ordering | D3, D4 |
| Which dispatch sites can reach this destructive branch? | viewport Wall Delete vs the hierarchy context menu — "same bypass class" | D5 |
| Which release paths write this state? | salience freeze released directly instead of through the closing effect | D6 |
| Which input shapes does this cutover actually cover? | multi-floor legacy documents; per-floor issue paths | D7 |
| Which emitter owns this surface at a seam? | tangent-continuation step surfaces, per-band ownership | D8 |
| Which modules reach across this boundary, transitively? | import-boundary sweeps, both directions | D9 |
| Does the call site still invoke this, and does its pin prove it? | tear-down chain, adapter polarity, 6 false successors | D10 |

**Refinement, and the honest half of this criterion.** On the *read side*, the graph-shaped question
was always answered: in every recorded session the agent found the declaration, the consumer or the
dispatch path with shell search (`rg` over a widened root, then narrow `sed` windows) — see E1, E2.
The recurrence that caused rework was **set enumeration**: which seams, which writers, which
dispatch sites, which consumers — a *conceptual set* whose membership is not the referent set of any
one symbol. That is the distinction this criterion turns on, and it is why C4 and C5 are not the
same question.

`[unassessable]` for the P23 **implementation** sessions: their transcripts are not available (U1),
so "did they ask these questions while working" cannot be observed. The recurrence is established
from landed rework, which is a different (and permitted) evidence class.

### C2 — Did missed downstream impact cause correctness failures or consequential rework?

**Supported.** Correctness, not inconvenience `[artifact]`:

| Case | Concrete impact |
|---|---|
| D1 | The new identity authority was not consumed: parallel formatting authorities survived, `name === reference` still rendered one token twice on the pinned strip, and the acceptance test "gives a false green for the stated acceptance" (S5, owner review, round 1) |
| D2 | The generic `serializeProject()` could still emit a **format-4 document with pre-H `wall.height` meaning**, through a serializer the editor facade exposes directly — the wall-first cutover's fail-closed guarantee was bypassed |
| D3 | A stale `wallChainRunHeight` could cross into the replacement document **as an explicit planner input** |
| D4 | Page/query/filters/emphasis/Back history could outlive the document they described |
| D5 | Destructive Wall delete reachable from an authority-inert mode against a **remembered** selection |
| D6 | A frozen gate vocabulary stayed active across later zooms after a mid-gesture mode switch |
| D7 | Legacy multi-floor documents compiled **only `floors[0]`** |
| D8 | A start Wall's mesh grew to its neighbour's height and the step surface was **pick-owned by the wrong Wall** — user-visible picking was wrong |
| D9 | The range's most load-bearing invariant was guarded by sweeps that were blind to whole import forms; the guards reported clean while unable to see the dependency |
| D10 | An inverted adapter shipped green and swallowed the first Enter (broken group entry and numeric door); a tear-down call site could be deleted with every assertion green |

Consequential rework `[derived]`: of 432 in-range commits, **95 mention "review"** and **34 carry a
review-closing subject** ("close/address review gaps | blockers | findings | regressions", "review
round", "review pass"). Whole slices landed as implementation + review-close pairs:
P23.6a–P23.6e produced `b3ba778`, `3ff1e29`, `6213aca`, `6ccf140`, `b00fa88`, `3782c1b` across
2026-09-13/14; P23.12 recorded **three review rounds** (`f0ceaff`, `99e849d`, `8b8d1e3`,
`03406fd`, `07449ac`); the test-suite refactor recorded **three rounds** each finding a blocker in
its own verification (S2 §N, §O, §R).

### C3 — For each consequential miss, does the evidence distinguish "didn't look" from "looked but couldn't find"?

**Assessable at artifact level for most cases; not assessable behaviourally at all (U1).** The
distinction is made on *what kind of question it was* and *whether a mechanism ran and was blind*:

**"Didn't look" — answerable by a query over a surface the author had already named.** `[artifact]`
In D2, D3 (first pass), D4, D5, D7 the missing members were reachable by searching the very
vocabulary the change introduced: the writer set (`serialize*`) that S1's own commit
(`20fa7f9`) then enumerated; the replacement-seam callback the change wired (`onLayoutReplaced`,
`installLayoutPreviewBundle`); the destructive-branch dispatch sites; the input shapes of the
compiler the cutover rewrote. The subsequent fixes are themselves the proof that the set was
enumerable — each fix pinned the members it had missed. This class is a **verification-discipline**
gap: the check could have been written with in-repo search and was not.

**"Looked but couldn't find" — a mechanism ran, reported clean, and could not see the defect.**
`[artifact]` D8: *"The raster coverage oracle cannot see this — coverage and area are identical
either way, only attribution was wrong"* (`f678ee8`). The oracle executed and was structurally blind
to ownership attribution. D9: the boundary sweeps executed and were blind to whole import forms
(`§O.1`: a bare `import '../editor/foo';` "passed both the museum-side sweep and the visitor
reachability walk"; the retired extractor "captured only `['./bar']` — **missed** the violation").
D10: the tear-down pin executed and passed after the call site was deleted, because
`toContain('projectRequestController?.abort();')` matches 2/5/3 other places in the same file; and
the adapter pin executed and **certified the inverted mapping** (`toContain('numericEntryOpen:
!numericEntry')` pinned the wrong polarity — `§K.7`). This class is not a search problem at all; it
is a problem of the check's **discriminating power**.

**The case that is neither, and matters most.** D3/D4's seam set has **no single denotation**. At
`b5f75e7` the replacement-seam obligation is threaded as a prop through four components
(`EditorLeftSidebar` → `EditorProjectMenu` → `ProjectRow` → `EditorApp`/`MuseumEditorApp`) and the
wall-run cancellation has **one definition and 12 call sites in 4 files** (`[derived]`
`git grep -c cancelWallChainRun` at `b5f75e7` → `MuseumEditorApp` 2, `EditorApp` 5,
`LayoutPlanViewport` 4, `layout-interaction` 2, the last pair being definition + internal call).
"Who calls `onLayoutReplaced`?" is trivially answerable; "**which seams replace the document?**" is
not, because the seams are heterogeneous — import and reset via `onLayoutReplaced`, project
load/resume via `installLayoutPreviewBundle`, relic sidebar reset wired separately, pending-draft
replacement, scene-JSON import, package-archive import. The project's own guard for this question
is a **hard-coded expected count** — see S1. That is a genuine "couldn't find", and it is
**suspected**, not demonstrated, because no in-range instance of a seam slipping past that pin was
found.

### C4 — Would existing search, language-server, compiler or dependency tooling have answered the demonstrated question?

Asked of the concrete question each time, against what actually exists `[derived]` — `svelte-check`
(editor, museum) via `npm run check`; `tsc -p tsconfig.json --noEmit` in `camera-core`,
`layout-core`, `project-model`; `vitest` under five lane configs with a curated 23-file
`ARCH_FILES` architecture lane; **no** eslint, **no** dependency-cruiser/madge, **no** root
`tsconfig.json`, **no** CI (`.github/` absent at `b5f75e7`); and — from S3 — an agent tool surface
of **shell `exec` only** (`[derived]` 45/45 recorded tool calls are `exec`; no language server, no
editor, no index).

| Case | The question actually faced | Would existing tooling have answered it? |
|---|---|---|
| D1 | Which modules must consume the new identity authority? | **Partly.** Import/symbol search finds candidate consumers; nothing answers "is this authority now the *only* one". Migration incompleteness is exactly what review caught, twice. |
| D2 | Which writers must the format rule gate? | **Yes, to enumerate.** The exported write-side surface is greppable — and S1's own fix enumerated it by hand. The tolerant `validateProject()` was deliberate, so no compiler diagnostic fires. |
| D3, D4 | Which seams replace the document, and does each reset the state? | **Call sites of a chosen symbol: yes** (`rg`, or find-references). **The seam set itself: no** — it is a conceptual set with no single denotation; see C3 and S1. |
| D5 | Which dispatch sites reach the destructive branch? | **Yes.** Symbol search on the branch's handlers enumerates them; the fix then pinned gate-before-dispatch. |
| D6 | Which paths release the gesture baseline? | **Yes.** `rg` on the release/clear vocabulary enumerates them; the fix added "a structural test [that] keeps the two clears paired". |
| D7 | Which input shapes does the cutover cover? | **Partly.** Type checking cannot see a runtime iteration over `floors[0]`; the regression fixture did the work. |
| D8 | Which emitter owns this surface? | **No.** No installed tool answers per-surface ownership at a geometric seam. The working answer was probing per-Wall meshes in the running editor plus a new ownership/overlap oracle (`b745c2b`), built stateless. |
| D9 | Does anything reach across this boundary, transitively? | **Not with what was installed.** A resolution-based dependency predicate answers it — and the range's fix *was* one (`reachesEditorInternals`/`reachesMuseumApp` over one extracted specifier list), replacing parallel regexes. Nothing off-the-shelf was adopted. |
| D10 | Is this claim actually proven by its check? | **No tool answers this.** Only mutation — delete the call site, reintroduce the defect, require the named owner to fail — separates a proof from a certification. The range adopted exactly that method (`§R.6`) and promoted it to the test contract. |

Two findings this criterion forces, both stated against the lane's own interest:
**the read-side navigation questions were all answerable and were all answered** (E1, E2), and the
questions that defeated tooling were about **a check's discriminating power**, not about finding
things.

### C5 — Is any repeated consequential gap still unresolved after considering existing tools?

Two answers, kept apart:

**D9/D10 — a repeated gap that survived existing tooling but not existing review.** `[artifact]`
The gap "a verification that runs, reports clean, and certifies a claim it cannot prove" recurs
**at least eight times** in the range: three false successors shipped by T2a and restored in review,
three unowned assertions restored by the T3 audit, one containment pin replaced by the T6 call-site
pass, and the adapter polarity pin that certified an inverted mapping — plus the three boundary-sweep
holes that took three separate rounds to close. No installed tool detects any of it. It did **not**
survive review: every instance was caught, corrected, and — for the durable half — written into
`apps/editor/tests/README.md` in-range (`38c5701`, 2026-09-20: "Machinery correctness ≠ call-site
correctness … keep a narrow call-site proof alongside the machinery test"; "Replacement claims are
proved by mutation"). So: **repeated — yes; unresolved at range end — no.** The correction was to
existing verification plus a documented rule, with no new tool and no persistent index.

**S1 — the one structural candidate for "existing tools cannot answer this".** `[artifact]` The
guard for the replacement-seam question,
`apps/editor/tests/lib/editor/app/hierarchy-projection.test.ts:2171`
`it('resets the Navigator on every document-replacing seam')`, proves the seam contract by asserting
**literal expected counts** over component source:

```ts
expect(seamBody).toContain('activeSelection.reset();');
expect(seamBody).toContain('hierarchyNavigator.reset();');
expect(appSource.match(/^\t\t\t?resetDocumentScopedState\(\);/gm)?.length).toBe(2);
expect(appSource.match(/onReset=\{resetDocumentScopedState\}/g)?.length).toBe(2);
expect(appSource).not.toContain('onReset={() => activeSelection.reset()}');
```

A seam added anywhere else does not appear in either count, so the pin cannot fail on it. The pin
encodes the author's belief about the seam set rather than deriving it. **Suspected, not
demonstrated:** I found no in-range instance of a new seam slipping past it, and the file is not in
`ARCH_FILES` (`[derived]` `grep -n hierarchy-projection apps/editor/test-lanes.ts` → no match), so
it does not sit in the always-on architecture lane. This is the only place in the range where the
evidence is consistent with "the question survives existing tools **and** the existing guard cannot
generalise" — and even here, what closed the misses was review plus a targeted regression, not a
tool.

### C6 — Correctness matters more than token savings

**Applied, and it changes the conclusion.** Every cost-only observation is recorded and then
excluded from gap-finding: E1 (wrong-path gizmo search — the audit's own verdict is "initial gizmo
search and broad direction matches avoidable"), E2 (three searches for one relationship through two
guessed non-existent paths), E3 (a durable existing record not discovered), and the harness audit's
context-budget findings generally (`Probe D` requested ~138 KB and re-read after truncation;
`Probe L` broad archive search when `shell.md` held the exact pointer). **None of these carries a
correctness failure.** Criterion 6 therefore forbids them from establishing a gap, and they do not.
Conversely, the cases that do establish impact are the ones where something was wrong or shipped
wrong — D1–D10 — and those stand on their own.

### C7 — Missing agent-session evidence is a limitation, not permission to infer behaviour

**Honoured.** See U1–U3 in §4.4. In particular: the only exported session evidence is an audit of
the **harness** (S3), its synthesis is the auditor's interpretation (S4), and probes G–J ran on
synthetic fixtures. Using it to characterise how agents behaved during P23 implementation would be
exactly the inference criterion 7 forbids. It is used here for three things only: the tool surface
actually available (C4), how navigation questions were concretely posed (E1, E2), and the token
audit's own cost-only findings (E3). Each of D1–D10 marks its behavioural half unassessable.

## 4. Cases

Format per case: source · revision · PR · method → the concrete structural question → evidence of
navigation / inspection / verification / omission → correctness impact or rework → existing-tool
sufficiency → counterevidence, uncertainty, limitations. Demonstrated (D), session-evidence (E),
suspected (S) and unassessable (U) are kept separate and labelled.

### 4.1 Demonstrated cases

---

**D1 — A new shared authority whose consumers were not migrated (P23.12).**
*Source* S1, S5 · *revision* `f0ceaff`, `7df8f27`, `99e849d`, `8b8d1e3`, `03406fd`, `07449ac`
(2026-09-15), merge `f3efed9` · *PR* #55 · *method* commit archaeology plus the only substantive PR
review thread in the range.

- **The structural question.** P23.12 establishes one display-identity vocabulary. After adding the
  shared module, **which modules must now resolve identity through it** — Navigator, Inspector, Plan,
  search, status?
- **Evidence — inspection and omission.** Round 1 (owner review, `COMMENTED` 2026-09-16 on PR #55):
  *"`identity/layout-identity-view.ts` is added as D5's shared layer, but Navigator/source projection,
  Inspector, and Plan still resolve/format identity independently … The new module appears effectively
  unused."* Round 2, on head `99e849d`: *"the round-2 commit fixes most of the first review, but I would
  still not merge this head"* — `hierarchyEntityLabel()` still did `name ?? reference ?? fallback`
  itself, `hierarchyEntityReference()` decided separately, Inspector headers still composed manually,
  and *"the new duplicate-collapse regression only covers Wall/Opening rows and misses these surfaces."*
  A third round is recorded in-repo (`07449ac docs(plan): record the third P23.12 review round`).
- **Correctness impact.** Not inconvenience: a contract whose entire purpose is *one* vocabulary was
  left with parallel authorities, with a concrete behavioural consequence (`name === reference`
  rendered the identical token twice on the pinned strip), and the acceptance test *"gives a false
  green for the stated acceptance."* Rework: at least three review rounds and five fix commits.
- **Existing-tool sufficiency.** Search enumerates *candidate* consumers but cannot answer "is this
  authority now the only one" — that is a property of a set, not of a reference. The compiler cannot
  help: every parallel path type-checks. The reviewer's own note — *"GitHub has no CI/status checks
  attached to head; PR body reports local checks only, so I could not independently rely on CI"* — is
  an existing-tooling limitation stated by the reviewer.
- **Counterevidence / uncertainty / limits.** The task's own automation caught the *identical* defect
  class twice (round 1 and round 2), which is the strongest single piece of evidence in the range for
  this lane's question — and simultaneously evidence that review *did* catch it. Whether the agent
  believed the module was consumed, or never enumerated the consumers, is `[unassessable]` (U1).

---

**D2 — The writer contract split in two: the generic serializer was not gated.**
*Source* S1 · *revision* `20fa7f9` (2026-09-12) · *PR* #25 · *method* commit body, read at the
revision that introduces the rule.

- **The question.** The wall-first cutover introduces a fail-closed format rule. **Which write and
  serialize paths must apply it?**
- **Evidence — omission then enumeration.** *"Review of PR #25 found the writer contract split in
  two: the wall-first Layout serializer and the wall-first Project writer reject a pre-H payload, but
  the generic `serializeProject()` called the tolerant `validateProject()`, so it could still emit a
  format-4 document unchanged with pre-H `wall.height` meaning. The editor facade exposes that
  serializer directly."* The fix *"adds one exported rule … and applies it inside `serializeProject()`
  and inside the editor writePendingCloudSave session handoff, so every project writer fails closed by
  name."*
- **Correctness impact.** A **data-integrity** defect: a reachable path could persist a document whose
  version says nothing about the new meaning of its fields. This is the range's clearest
  silent-wrong-write case.
- **Existing-tool sufficiency.** Enumeration was available: the exported write-side surface is
  greppable, and the mechanical pass's own Set-2 probe counts exported write-side entry points. Not a
  capability gap — the author of the *new* writers did not enumerate the *existing* one. No compiler
  diagnostic fires, because tolerance was deliberate.
- **Counterevidence / uncertainty / limits.** The review caught it before merge, inside the same PR.
  The quoted account is the fix commit's; the review's own words are not in GitHub (§1.1).

---

**D3 — In-flight Wall-run state across document-replacement seams (two passes in one day).**
*Source* S1 · *revision* `768d1a1` → `1bdcf1a` (both 2026-09-12) · *PR* #27 · *method* commit bodies
of both passes compared.

- **The question.** A new piece of document-scoped planner state exists mid-gesture. **Which seams
  replace the document, and which of them must cancel it?**
- **Evidence — first pass enumerates a subset.** `768d1a1`: *"EditorProjectMenu fires
  `onLayoutReplaced` after a successful layout import or reset; the shell (EditorApp via ProjectRow)
  wires it to `cancelWallChainRun`, so a stale `wallChainRunHeight` can never cross into the
  replacement document as an explicit planner input."* Same day, `1bdcf1a`: *"Editor: end in-flight
  Wall run on project load/resume plus relic sidebar reset, matching the import/reset
  `onLayoutReplaced` seam, so a stale wallChainRunHeight can never cross documents."* The second pass
  names the members the first missed: project load/resume (a different seam,
  `installLayoutPreviewBundle`) and relic sidebar reset.
- **Correctness impact.** Stale dimension state entering the replacement document **as an explicit
  planner input** — wrong geometry authored from a dead gesture.
- **Existing-tool sufficiency.** Call sites of `onLayoutReplaced` are enumerable by search; the
  *seam set* is not, because load/resume and relic reset do not route through that callback. At
  `b5f75e7` the obligation is 1 definition + 12 call sites in 4 files `[derived]`. Answerable with
  existing tooling once the seam vocabulary is known; the miss is that only the seam being edited was
  considered.
- **Counterevidence / uncertainty / limits.** The gap closed within the same day and within the same
  PR; the range's own frozen-range note records that P23.15 later needed rebasing, not this. Whether
  the author searched for other seams and found none, or did not search, is `[unassessable]` (U1).

---

**D4 — Document-scoped UI state across replacement seams, and the guard that has to count.**
*Source* S1 · *revision* `6ccf140` (2026-09-13), plus the pin it added · *PR* #46 · *method* commit
body, then the added test and its call-site inventory read at `b5f75e7`.

- **The question.** The Navigator holds page, query, filters, disclosure, emphasis and Back history.
  **At which seams must it reset?**
- **Evidence — the omission, named.** *"The Navigator store's `reset()` was never called, so reset,
  import, project load and pending-draft replacement could keep another document's page, query,
  filters, emphasis and Back history. All document-replacing seams now go through one reset that
  clears selection and Navigator together."* A second describe block added in the same commit
  ("every successful import routes through the document-scoped reset") slices `importSceneJson`,
  `importLayoutJson` and `importPackageArchive` out of `EditorProjectMenu.svelte` by regex and
  asserts `onReset?.()` fires after the successful import and before the success status.
- **Correctness impact.** Cross-document state leak — another project's search results, filters and
  navigation history presented as this document's.
- **Existing-tool sufficiency, and its limit.** The fix created the missing single owner
  (`resetDocumentScopedState()`) — a good correction, and exactly the shape that makes the question
  answerable. But the guard that protects it asserts a **literal count of 2** seam call sites and
  absence of one old pattern, so it certifies the two seams the author knew about and cannot fail on
  a third (S1). Demonstrated for the miss; the guard's generalisation limit is suspected.
- **Counterevidence / uncertainty / limits.** Six P23.6e review-closing commits landed across
  2026-09-13/14, so review was clearly effective here; the count-pin above is the artifact this case
  contributes, and I did not read it to judge it as *wrong*, only as *bounded*.

---

**D5 — A destructive dispatch branch missed by a gate, in a class that had already occurred.**
*Source* S1, S5 · *revision* `453f084` (2026-09-13) · *PR* #45 · *method* commit body; PR #45's
comment records it as the second review round.

- **The question.** Wall Delete is destructive and must be gated to Layout mode. **Which dispatch
  sites reach that branch?**
- **Evidence — the bypass, and the recurrence.** *"LayoutPlanViewport Delete/Backspace Wall branch
  requires `planViewMode` 'layout': `setPlanViewMode` keeps a committed Layout selection as memory in
  Arrange, so the ungated branch let Delete reach a remembered `physicalWall` after the Arrange
  owner-delete branches fell through (**same bypass class as the hierarchy context menu**)".* The PR
  comment: *"the ungated branch let the Arrange owner-delete branches fall through into the remembered
  Wall and delete it from an authority-inert mode."*
- **Correctness impact.** Destructive deletion of an entity the active mode should not be able to
  touch — the strongest correctness class in this document after D2's silent bad write.
- **Existing-tool sufficiency.** The dispatch sites are enumerable by search over the key handlers;
  the fix's own regression pins *"the gate-before-dispatch contract."* The recurrence is stated by the
  author, which makes it the range's clearest **repeat** of a dispatch-enumeration miss.
- **Counterevidence / uncertainty / limits.** The author self-identified the class, which is a
  discipline signal, and the PR comment shows a two-round review that closed it properly. The
  hierarchy context menu instance itself is outside the range's commit set as I read it (pre-range
  behaviour, referenced mid-range), so the "recurrence" is established from the author's assertion
  about the earlier instance, not from a second in-range diff.

---

**D6 — A second release path bypassed the single transaction closer.**
*Source* S1 · *revision* `fe259dc` (2026-09-16) · *PR* #51 · *method* commit body.

- **The question.** A plan interaction freeze is released by one effect that also closes the
  transaction. **Which other paths release the same state, and do they pair the clears?**
- **Evidence.** *"Review follow-ups on S2. `cancelLocalPlanInteraction` dropped the gesture baseline
  directly, which bypasses the tool-change effect that otherwise closes the transaction, so a mode
  switch mid-gesture left the frozen gate vocabulary active across later zooms. It now releases the
  freeze with the baseline, and a structural test keeps the two clears paired."* The same commit
  records a second review-found defect (dense-ink bucketing missed staggered-parallel mid-overlap) and
  a deferral with an owner.
- **Correctness impact.** Leaked frozen state changes later behaviour (zoom salience) after an
  unrelated gesture — wrong rendering rather than data loss.
- **Existing-tool sufficiency.** Enumerable by searching the release vocabulary; the fix used a
  **structural pairing test** — a stateless in-repo check, not new tooling. This is the range's model
  case for "correct the existing verification rather than build a graph".
- **Counterevidence / uncertainty / limits.** Two distinct review follow-ups in one commit is
  ambiguous about which review round found which; the commit does not separate them.

---

**D7 — A cutover that covered one floor.**
*Source* S1 · *revision* `96fedca` (2026-09-09), "review round 1" · *PR* none — the review-round-1
fixes reached `main` through the branch merge `37e16f8` · *method* commit body listing four blocker
classes.

- **The question.** The compiler is cut over to the wall-first core. **Which input shapes does the new
  path actually cover?**
- **Evidence.** *"B1: the compiler cutover compiled only `floors[0]` of legacy documents; the shared
  core now iterates a per-floor list with legacy-identical `floors[i].rooms[j]` issue paths
  (multi-floor regression fixture added)."* The same review round found diagonal collinear
  misclassification, bogus zero-area faces beside dangles, and `reconcileRooms` namespace/claim rules.
- **Correctness impact.** Legacy multi-floor documents compiled wrongly — silently, since the issue
  paths the feature produces would not have existed for the missing floors.
- **Existing-tool sufficiency.** Type checking cannot see a runtime iteration over one index; the
  reviewer's regression fixture did the work. Reachable by reasoning about the input surface, not by
  a query.
- **Counterevidence / uncertainty / limits.** A four-blocker review round on the first day of the
  range is evidence of a *working* review loop as much as of a gap. The pre-range F0 research and the
  P23.15 rebase both complicate the ancestry (frozen-range note); this commit is on `main` inside the
  range.

---

**D8 — Surface ownership at a junction seam, invisible to the coverage oracle.**
*Source* S1 · *revision* `f678ee8` (canonical; `247528c` is its pre-rebase duplicate), then
`b745c2b` (2026-09-21) · *PR* #72 (P23.15, landed rebased) · *method* commit bodies, `patch-id`
de-duplication.

- **The question.** At a tangent continuation, two Walls share a seam. **Which leg owns the emitted
  step surface**, and does ownership hold in both seam orders?
- **Evidence — a verification that ran and could not see it.** *"The exposed difference surfaces of a
  tangent continuation were emitted by the seam's start leg instead of the leg that owns the material,
  so a shorter/thinner start Wall borrowed its neighbour's cross-section: its mesh grew to the
  neighbour's height and the step surface was packaged and pick-owned by the wrong Wall. The thickness
  case only looked right because the thicker Wall happened to be the start leg. … **The raster
  coverage oracle cannot see this — coverage and area are identical either way, only attribution was
  wrong.** Found by probing per-Wall meshes through the running editor."* `b745c2b` then adds an
  independent ownership/overlap oracle (`assertWallOwnershipAtJunction`: a point deep inside an
  authored Wall box must be contained by exactly one emitted Wall mesh) plus per-Wall bounds and
  per-band exposure oracles — *"Coverage alone cannot prove correct Junction material."*
- **Correctness impact.** Wrong mesh height and wrong pick ownership — a user-visible interaction
  defect that no coverage, area or pixel oracle could distinguish.
- **Existing-tool sufficiency.** **No installed tool answers this.** Per-surface ownership at a
  geometric seam is not expressible as a type, an import or a boundary; the working answer was a
  purpose-built, stateless oracle in the test suite. The in-repo response was a verification
  correction, not a tool.
- **Counterevidence / uncertainty / limits.** Found by the author's own probing before merge — this
  case is evidence *for* existing practice, and against a tooling gap. It also fits the range's
  recurring **ownership** question (the frozen brief names ownership explicitly), and it is the
  cleanest instance of "looked, mechanism blind".

---

**D9 — Dependency reachability guards blind to whole import forms (three rounds).**
*Source* S2 (`§N.1`, `§O.1`, `§O.2`, `§O.3`) + S1 · *revision* `0607bfd`, `9600600`, `c8204eb`,
`38c5701` (2026-09-20) · *PRs* #62–#64 · *method* harvest sections with their mutation tables, plus
the commits that implemented them.

- **The question.** The range's most load-bearing invariant is visitor/editor isolation. **Does
  anything in visitor/museum scope reach editor internals — transitively, in either direction?**
- **Evidence — three rounds, each a blocker, each proven by mutation.** §N.1: the sweep's pattern was
  anchored with `^`, which in a regex over raw source anchors to the start of the **file**, so
  `import x from '../editor/foo'` matched neither alternative — *"that is exactly the editor-internal
  dependency the sweep exists to forbid"* — and *"two subtly different patterns for one invariant
  means two different holes."* §O.1: the replacement extractor handled `import X from`, `export … from`
  and `import(…)` but not the bare side-effect form, so *"a runtime dependency … written that way
  passed both the museum-side sweep and the visitor reachability walk"*; the retired extractor, run
  against the probe, *"captured only `['./bar']` — missed the violation."* §O.2: the editor → museum
  direction was *"still a text regex … the same pattern shape the round-2 blocker was about — and it
  inherited the same side-effect blind spot."* Fix: one extracted specifier list plus one
  **resolution-based** predicate per direction, so *"hop count is irrelevant instead of enumerated …
  One extractor, one resolution rule, two directions."*
- **Correctness impact.** No production defect is demonstrated — no production file was touched in
  those rounds. The impact is **false assurance on the range's most load-bearing invariant**: for
  whole classes of import the guard reported clean while unable to see the dependency. That is a
  verification-correctness failure with a latent correctness consequence, and I record it as such
  rather than as a shipped defect.
- **Existing-tool sufficiency.** The demonstrated question is answered by a resolution-based
  dependency predicate — which the project now has, hand-written and stateless, recomputed from
  repository state, creating no architectural authority. Nothing off-the-shelf (dependency-cruiser,
  import rules, TS project references) is installed; the fix did not adopt one. Mechanical-pass Set 3
  independently read this boundary as 0/0 at both endpoints and noted it is "decidable from imports
  alone".
- **Counterevidence / uncertainty / limits.** Three review rounds found three blockers in the same
  guard — evidence of a weak mechanism, and equally of a review process that would not let a
  false-green guard ship. The `BY-DESIGN: import type` row (§O.4) is an explicit scope decision
  recorded rather than silently chosen, which cuts against reading these rounds as sloppiness.

---

**D10 — Claims the checks certified but did not prove.**
*Source* S2 (`§J.4`, `§K.7`, `§R.6`, `§R.7`, `§R.9`) + S1 + S5 · *revision* `f06fb36`, `154908a`,
`c4f13dd`, `51c3586`, `38c5701`, `d68ae79` (2026-09-20) · *PRs* #62–#65 · *method* harvest execution
logs with their mutation tables; PR #62's author response.

- **The question.** A guard is removed, replaced or trusted because a successor is said to cover it.
  **Does the successor actually fail when the defect returns — and does it prove the call site or only
  the machinery?**
- **Evidence — the same lesson at four levels.** (a) T2a shipped **three** false-successor deletions;
  review restored them, and PR #62's response names the reason: *"You are right that the successor
  pins the machinery, not the call site"* and *"`snap-input-validation` never touches
  `EditorViewportToolbar.svelte`, so the parser suite was the wrong successor."* (b) The T3 audit
  restored **three** assertions the review found unowned. (c) §R.6: the session tear-down pin asserted
  **containment**, not the call site — the three asserted strings appear 2/5/3 times elsewhere in
  `EditorApp.svelte`, so *"deleting the teardown call alone left every assertion green"*; the control
  probe proves the repaired pin is now site-specific. (d) §K.7: the adapter polarity pin
  (`toContain('numericEntryOpen: !numericEntry')`) **pinned the wrong mapping** and so *"certified the
  inverted adapter, which is why the regression shipped green"* — a real behaviour regression that
  swallowed the first Enter.
- **Correctness impact.** (d) is a shipped behaviour regression; (c) is a resource-lifetime chain whose
  removal no test noticed; (a) and (b) are coverage losses that certify themselves. Rework: three
  review rounds, eight restored/proved claims, and the method `§R.6` adopted — *"delete the call site,
  keep the machinery, and require the owning test to fail."*
- **Existing-tool sufficiency.** **No tool answers this question.** A test runner reports green
  whether the assertion proves the invariant or merely matches a string; nothing in `svelte-check`,
  `tsc`, eslint or a dependency analyzer distinguishes them. The in-range answer was a method, plus
  four rules promoted into `apps/editor/tests/README.md` (`38c5701`) — including rule 3, *"Machinery
  correctness ≠ call-site correctness"*, and rule 4, *"Replacement claims are proved by mutation."*
- **Counterevidence / uncertainty / limits.** S2 is written by the lane under audit, so its
  self-report is interested evidence; the mutation tables and the negative controls ("control: an
  unrelated editor file gains a comment → PASSES") are what make the claims checkable, and I verified
  the promoted rules exist in the test contract at `b5f75e7`. The final table's verdict — *"no false
  successors — ACHIEVED at the final head"* — is the author's own claim at the range's end, one day
  before the range closed.

### 4.2 Session-evidence cases (navigation behaviour; cost-only unless stated)

---

**E1 — A routed ownership map that pointed away from the code (Probe F).** `[session]` *Source* S3
(lines 688–902) · *date* 2026-09-18 · *method* read the recorded tool calls.

- **The question.** Why is the Room rotation handle a silent no-op on wall-first documents — which
  path consumes the drag, and is yaw reachable?
- **Evidence.** The agent was routed by `docs/README.md`'s table, which maps *placement / transforms*
  to `apps/editor/src/lib/editor/gizmo/`. It then searched `rotateRoom|room-rotate|roomRotate|
  rotation.handle|rotationHandle` across `apps/editor/src` **and** `packages/layout-core/src`, took
  narrow `sed` windows in `layout-interaction.ts`, `LayoutPlanViewport.svelte` and `plan-overlays.ts`,
  then ran a **second, differently-worded sweep** (`previewLayoutRoomUnitTransform|previewWallFirstRoom|
  planRoomMove`) and `rg -n 'room-rotation' … plan-overlays.ts`. It reached the right conclusion.
- **Correctness impact.** None: the probe was read-only and its answer matches the defect the slice
  README already carried ("silent no-op drag in wall-first docs"). **Cost-only** (the audit's own
  judgement: *"Initial gizmo search and broad direction matches avoidable"*).
- **Existing-tool sufficiency.** Sufficient, and demonstrably used: the cross-cutting symbol sweep
  found the dispatch that the routed ownership map did not point at. The relevant structural fact is
  the *map's* accuracy, not the tooling's power — and S4 separately records that some routed contracts
  "describe obsolete behavior as current" (see S2 in §4.3).
- **Limits.** A synthetic probe on the harness, not P23 implementation work; two sweeps is
  indistinguishable from normal triangulation on a cross-cutting symbol.

---

**E2 — One relationship, three searches, two guessed paths (Probe H).** `[session]` *Source* S3
(1,107–1,329) · *date* 2026-09-18 · *method* read the recorded tool calls.

- **The question.** Where is `SceneNavigationNode` declared, does it carry `roomId`, and who owns the
  world-local conversion?
- **Evidence.** Search 1 named an explicit file list
  (`scene-document.ts`, `scene-codec`, `project-layout-semantics.ts`); search 2 named
  `scene-types.ts` — a path that does not exist at the range's end `[derived]`
  (`git ls-tree -r --name-only b5f75e7 -- packages/project-model/src` returns `scene.ts` and no
  `scene-types.ts`) — and produced no match for the interface; search 3 widened the root to the whole
  package (`packages/project-model/src --glob '*.ts'`) and found it.
  S4 characterises the probe as containing *"failed guessed paths"*, *"broad test search"* and *"small
  registry reread"*, and notes it *"did not redo full diagnosis"*.
- **Correctness impact.** None — the answer was found. **Cost-only.**
- **Existing-tool sufficiency.** Sufficient. This is a textbook "looked but couldn't find" **at the
  level of the query**, not of the capability: a guessed explicit path list returns a *silent empty
  result*, and widening the root resolved it immediately. A language server's go-to-definition would
  have collapsed the three searches into one — but the recorded tool surface was **shell `exec` only**
  (`[derived]` 45/45 calls across probes A–L), so no such affordance was present.
- **Limits.** Synthetic harness probe; read-only; no production mutation.

---

**E3 — A durable record that existed and was not found (Probes G and H).** `[session]` *Source* S3
(903–1,106, 1,107–1,329) and S4 · *date* 2026-09-18.

- **Evidence.** S4: probe G *"omitted the existing TD-1 record, which already establishes the format
  issue and explicit P24 deferral"*; probe H *"recovered the schema answer but never discovered that
  durable diagnosis"*; and separately *"did repeat a small registry lookup and rediscover information
  already present in TD-1."*
- **Correctness impact.** Duplicated effort only — **cost-only**, and it is exactly the kind of
  finding criterion 6 forbids from establishing a gap.
- **Existing-tool sufficiency.** The record existed in `docs/operations/tech-debt/README.md`, which
  the routing table points at. This is a **discovery-recipe** observation about the documentation
  graph, not a code-reachability one: no search tool was going to surface a record whose existence the
  agent did not suspect.
- **Counterevidence.** S4 also records that same TD-1 entry carries an incorrect introduction anchor
  (`2c9b04d` vs `d5ec0df`), i.e. the durable record itself was partly wrong — so "the durable diagnosis
  already existed" is true but not unqualified.

---

**E4 — The tool surface, as actually observed.** `[session, derived]` *Source* S3 · *date* 2026-09-18.

45 of 45 recorded tool calls across probes A–L are `tools.exec_command` (`cat`, `rg`, `sed`,
`git`, `wc`). No language server, no editor tooling, no symbol index, no glob/read primitive appears
anywhere in the export. Every navigation question in the range's session evidence was therefore
answered with **shell text search over an explicit path scope**. This is the grounding for criterion 4:
where I say "existing tooling would have answered this", the tooling that demonstrably existed is
shell search, `tsc`/`svelte-check` as commands, and `vitest`. **Limit:** probes G–J used synthetic
fixtures, and the export excludes private reasoning, so this establishes the *surface*, not the
*strategy*.

### 4.3 Suspected cases (evidence consistent with a gap; not demonstrated)

**S1 — The replacement-seam question has no denotation, and its guard cannot generalise.**
`[artifact]` Established in C3/C5 with the quoted pin and the call-site census. **Suspected, not
demonstrated:** no in-range instance of a seam being added and slipping past the `toBe(2)` pin was
found; the pin's file is not in `ARCH_FILES`; and the misses that did occur were closed by review plus
targeted regressions, which is existing practice working. **Uncertainty:** I read the pin as bounded,
not as wrong — it does what it says for the two seams it names. **Limitation:** judging whether a
future seam would be missed requires prospective evidence the retrospective range cannot supply.

**S2 — Stale or superseded authority misdirecting navigation.** `[session/artifact]` *Source* S4
(High findings) and S1. The in-range audit records that `AGENTS.md`'s hard rules still declare
`rooms.ts` authoritative until B4/B5 and `scene.json` v6 authoritative, that the museum runtime
already compiles `project.layout`, and that three directly routed contracts
(`persistence.md`, `camera-tour.md`, `shell.md`) *"describe obsolete behavior as current"* — with the
consequence that *"an agent must reinterpret a supposedly superior hard rule to follow current
architecture."* E1's wrong-path search is consistent with the same shape. **Suspected:** no
consequential correctness failure is traced to a stale route in the range's artifact evidence.
**Counterevidence:** the same audit says routing *succeeded* while delivering stale authority, and the
range's own docs restructure (`650f7c1`, PR #59) landed maintenance against exactly this.

### 4.4 Unassessable (recorded, not answered from assumption, memory or reconstruction)

- **U1 — Whether the agents behind D1–D8 *looked* and failed, or never looked.** The P23
  implementation sessions are not available. The sessions that are exported audit the **harness**, and
  probes G–J ran on synthetic fixtures (S3, S4). Criterion 3's behavioural half is therefore
  **unassessable** for every artifact case; what is assessable is the *kind* of question and whether a
  mechanism ran and was blind, which is why D8/D9/D10 are separated from D2–D7.
- **U2 — Review words.** 43 of 45 in-range PRs carry no discussion at all; three carry anything
  (§1.1). Only D1 has the reviewer's own text. For the rest, "review caught it" is established from
  commit bodies and S2, never from a review thread.
- **U3 — Whether any demonstrated miss reached a shipped state and survived.** I found no in-range
  case where a missed dependent produced a defect that shipped to `main`, survived the slice, and was
  later discovered as a regression. **This is not the same as proving none occurred** — the range
  inspects merged PRs at diff granularity with 19 of 45 squash-collapsed (frozen-range note), so
  intra-PR chronology and any reverted later change are partly invisible.

## 5. Recurrence and rework, in numbers

All `[derived]`, all over the frozen range, each reproducible from the printed step:

| Measure | Value | How |
|---|---|---|
| Commits / merged PRs | 432 / 45 | `git rev-list --count`; `--merges` at range endpoints |
| Commits whose subject mentions "review" | 95 | `git log f8411f7..b5f75e7 -i --grep=review` |
| Commits with a review-closing subject | 34 | `-i --grep='review gap|review blocker|review finding|review regression|review round|review pass|review fix|address review'` |
| Consecutive P23.6a–e review-closing commits (2026-09-13/14) | 6 | `b3ba778`, `3ff1e29`, `6213aca`, `6ccf140`, `b00fa88`, `3782c1b` |
| Recorded review rounds on P23.12 | 3 | `f0ceaff`, `99e849d`, `8b8d1e3`/`03406fd`, `07449ac` |
| Review rounds on the test-suite refactor, each finding a blocker in the verification | 3 | S2 §N, §O, §R |
| False-successor / unproved-coverage instances found and corrected in-range | ≥ 8 | S2 §J.4 (3), T3 audit (3), §R.6 (1), §K.7 (1) |
| `cancelWallChainRun` definition + call sites at `b5f75e7` | 1 + 12 in 4 files | `git grep -c` → 2, 5, 4, 2 |
| In-range PRs carrying any review or comment | 3 of 45 | `gh pr view <N> --json reviews,comments` |
| Agent tool calls in the exported session evidence that are not shell `exec` | 0 of 45 | S3, counted by grepping the tool-call headers |

Two cautions against over-reading these numbers, in the spirit of the mechanical pass's own
labelling discipline. First, a "review" commit is a *fix that cites review*, not a failure rate: the
same numbers would look identical in a project with excellent review discipline. Second, the counts
are **two-endpoint-free but subject-string-based** — a commit that fixed a missed dependent without
saying "review" does not appear, and a commit that says "review" may be documentation. The cases in §4
are the evidence; these numbers only establish that the shape was frequent, not how frequent.

## 6. Which dispositions the evidence supports — and which it does not

Stated as evidence bearings. **No branch is chosen, recommended or authorized here**; §8's sequence
is the owner's, and the brief's lane boundary forbids this lane from producing tooling
authorization.

**Supported: a consequential gap exists, and it is not a navigation-capability gap.**
C2 lists ten demonstrated cases with correctness or rework impact; C4 shows that for six of them the
answer was reachable with the tooling actually present (shell search over a named surface, plus
`tsc`/`svelte-check`/`vitest`). The gap's shape is **verification reach**: which members of a set
must change, and whether the check that claims to prove it can fail at all.

**Supported: choosing to act within existing tooling or existing verification.**
The demonstrated misses divide cleanly into (a) enumerations the author did not write but could have,
over surfaces already named by the change itself (D2, D3, D4, D5, D6, D7), and (b) checks that ran and
were blind or self-certifying, where the in-range correction was **to the existing check** —
one resolution-based predicate replacing parallel regexes (D9), mutation-proved call-site pins
(D10), a paired-clears structural test (D6), an ownership/overlap oracle (D8) — every one stateless,
recomputed from repository state, and creating no architectural authority. Two of those corrections
were promoted into the test contract as rules (`38c5701`). The evidence is at least as consistent
with a **verification/workflow correction** reading as with a tooling one, and the range's own
practice during the window is the strongest instance of that reading.

**Not supported: one narrow custom-tool gap, on the evidence as it stands.**
Criterion 5's precondition is *"a repeated consequential gap still unresolved after considering
existing tools."* The repeated gap is demonstrated (C5, first answer) but was **resolved inside the
range** by correcting existing verification and by review, and §R.6's final pass reports no further
instance in the audited classes at the range's end. The two purpose-built mechanisms that did work in
this window — the resolution-based reachability predicate and the junction ownership oracle — are
narrow, stateless, in-repo test-shaped checks, i.e. corrections to existing verification rather than a
new tool. **No case in this document shows a repeated consequential gap surviving existing tools and
their correction.** S1 is the single candidate where existing tools structurally cannot answer the
question, and it is **suspected, not demonstrated**, and narrow.

**Not supported: "graph-shaped work is rare, so stop."**
C1 shows recurrence across at least nine distinct question shapes, with rework. This branch's
condition is not met by the range.

**Not assessable here: anything about mechanism design, scope, or which lane transitions.** Selecting
among the branches, sizing a response, and whether any of this warrants `PHASE_1` at all are the
owner's at adjudication, in two lanes, with one transition (§8).

## 7. Counterevidence

Recorded because it cuts against the reading above, and because the brief asks for it explicitly.

**7.1 Every demonstrated miss was caught — inside the slice, by review.** D1 (two review rounds, then
a third recorded), D2 (PR #25 review), D3 (same-day second pass), D4 (six review-closing commits
across P23.6a–e), D5 (second review round), D7 (review round 1), D8 (author's own probing before
merge), D9 and D10 (three rounds each). **The existing loop worked on all ten.** An architecture-lane
Outcome-1-style reading — "normal review catches it" — is available here as evidence, and this lane
does not get to dismiss it; §8 explicitly names ordinary owner review as an acceptable answer.

**7.2 The session evidence contains no correctness failure attributable to a failed lookup.** Across
12 probes, every question was answered; the audit's complaints are context volume, wrong-path
exploration and redundant reads (E1, E2, E3). Criterion 6 makes those non-establishing. If the
workflow lane's question is read narrowly — "do agents fail to *find* downstream impact?" — the
session evidence answers **no**, for the navigation it covers.

**7.3 The mechanical pass found the structural sets unmoved.** Set 2's host-write surface is identical
at both endpoints (10 code sites, 2 files) and Set 3's visitor/editor boundary is 0/0 with an
identical 31-specifier set. Whatever these recurring questions cost, they did not visibly expand the
model seam or breach the dependency boundary within the range — and the pass itself warns that its
"unchanged" readings are two-endpoint readings only.

**7.4 Adjacent, outside the frozen range, not counted.** Two commits after `b5f75e7` (`272e1ac`,
`722280f`; PR #76, 2026-09-22) record a review that found **two evidence-integrity defects in the
mechanical control pass itself** — endpoint-versus-whole-range wording, and derived counts carrying
labels their printed probes did not produce (including one transcribed number, `6 → 14` corrected to
`5 → 13`). This is the same shape as D10 — a label certifying a claim it cannot support — in the
*documentation* domain, and it is the same remediation: re-derive each number from the printed
command. It is recorded here as labelled context because the shape corroborates C5's first answer. It
is **not** range evidence, it concerns a coordination artifact rather than product work, and it is not
used in any count or finding above.

## 8. Coverage limitations

- **Sessions of the actual work are absent.** The range's implementation sessions do not exist in any
  artifact I can read (U1). Everything about *omission* is inferred from landed rework, which shows
  what was missed, never why.
- **PR discussion is effectively absent** (U2): 43 of 45 in-range PRs carry no reviews or comments, so
  "review caught it" rests on commit bodies and one self-audit for all cases but D1.
- **The one large in-range session artifact audits the harness, not the work.** 12 probes, G–J
  synthetic, private reasoning excluded, and its synthesis (S4) is an interpretation of its own
  transcript — interested evidence, useful for tool surface and query shape, unusable for P23
  behaviour.
- **The self-audit is written by the lane it audits.** S2's claims about its own verification are
  corroborable only through its mutation tables and negative controls, which I checked but did not
  re-execute.
- **Merged-PR granularity, 19 of 45 squash-collapsed.** Intra-PR chronology, and any reverted
  intermediate, is partly invisible; P23.15's rebase adds a second-order ancestry caveat
  (frozen-range note). I de-duplicated the one rebase pair I found; another may exist.
- **Subject-string and filename-based classification throughout.** The rework counts in §5 are
  proxies; no diff-by-diff semantic classification of all 432 commits was performed.
- **Path- and name-based reading only.** I did not build a graph, index, script or time series, and
  the brief forbids it. Every count is a grep, a log or a `patch-id` comparison, printed above.
- **One machine, one read.** Counts that depend on the working tree were taken at `b5f75e7`;
  post-range commits exist on this branch, so anything read from the working tree would be a
  different revision. Where I read the working tree I said so.
- **No architecture conclusions.** C1–C10 touch representation, ownership and naming only as the
  *subject* of a structural-question recurrence. Nothing here classifies a candidate, ratifies a rule,
  or bears on the architecture lane's A/B/C/D work; conversely, nothing in the architecture lane's
  results can manufacture a mechanism out of this document.

## 9. Boundary statement

This is evidence and candidate dispositions for the structural-workflow lane only. It proposes no
contract, mechanism, script, index, graph, enforcement, or workflow change; it authorizes nothing and
changes no live cycle state. It is not a third architecture review, it does not read either reviewer's
output, and it does not classify architecture candidates. Whether the result justifies correcting
existing verification, adopting existing tooling, or no change at all is the owner's, applied through
§8's decision sequence and recorded in `adjudication.md` at the single overall transition.

Per the both-or-neither embargo, this document stays local and unpublished until both independent
architecture reviews are frozen and coordination releases the evidence.

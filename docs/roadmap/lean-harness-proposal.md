# Lean harness proposal — documentation and agent-workflow prune

**Status:** reconciled proposal and implementation plan for **one PR, #259**; baseline
`origin/main` at `ce4e232c` (2026-11-06, includes merged #271). The harness decisions below are
settled; this pass reconciles their application, references and pruning scope. **This step is
proposal-only:** no harness implementation, pruning, merge or routine closeout. The current rules
remain in force until the replacement is enforced and #259 merges. Implementation proceeds in
stages inside this PR, without separate proposal approvals, planning rounds or closeout PRs.
After implementation, preserve this plan as history rather than a second live work entry.

**Owner ruling, 2026-11-06:** R217 is complete and closed, with Core Product Stability accepted
effective at #271's merge (`ce4e232c`). The owner personally tested and accepted the integrated
product, including the final Experience changes. R217.S11 is **owner-accepted by override;
separate gate execution waived** because that hands-on product review already occurred. This
records product acceptance, not a claim that each planned automated, browser/device or seam check
was separately executed. Historical evidence remains; no R217 gate, A–Q rerun, acceptance plan or
closeout remains ahead of #259. The harness retains its own CI, architecture, regression and
verification requirements below.

| Verified baseline | Consequence for #259 |
| --- | --- |
| R217.S25 is shipped: [phase register](./r217-core-editor-stability/README.md#slice-register), PR #261, owner acceptance at `703712d7` | S24/S25 are no longer future prerequisites; no additional S25 closeout is requested |
| S26–S30 code and the Experience corrections are on `main`; [#271](https://github.com/Biskiq/spatial-sketch-editor/pull/271) merged as `ce4e232c` | Seed against Experience unit format 4 / Program v4, not the earlier placeholder shell or format 3. Owner personally tested and accepted the integrated product, including #271, effective at this merge; individual unexecuted checks are not claimed as passed |
| **R217: closed, Core Product Stability accepted** at `ce4e232c`; [S11](./r217-core-editor-stability/r217.s11-integrated-final-gate/acceptance.md) is owner-accepted by override | Separate S11 execution is waived because the owner performed and accepted the product review. S11, A–Q and R217 closeout are not future prerequisites; #259 implementation is next |
| [#266](https://github.com/Biskiq/spatial-sketch-editor/pull/266) is an open research-only draft at `e2e3aea7` | Register proposed T5 capability coverage; ratify no Studio UX, modeling source or implementation release |
| Only `.github/workflows/native-form-goldens.yml` is checked in; active [default-branch ruleset](https://github.com/Biskiq/spatial-sketch-editor/rules/22803329) requires PRs and prevents deletion/force-push, but has no required status checks | Add and enforce the complete merge gate in #259. An active ruleset is not evidence that CI is required |

## Why

The repository's routing and documentation exist so that agents can maintain the project and move
it toward the [North Star](../reference/north-star.md) with the owner reviewing occasionally. The
intent is right. The cost has outgrown it:

- At this `main` baseline, `docs/` holds 399 Markdown files and about 653k whitespace-delimited words
  (archive included); 260 roadmap files account for about 322k words. These are cost observations,
  not deletion quotas.
- R217 keeps separate plans, acceptance packets and closed-plan stubs. Merge anchors have received
  their own pull requests (for example #257 after #256).
- [The release list](./now.md) stores permission as paragraphs of authorization history.
- Agents follow the rules too literally: slices end in documentation-only acceptance plus bug
  fixes, closeouts stall waiting for review, and planning requests cross-track review.
- Planning reconciled approved designs down to the current shell instead of building the design,
  which produced the drift R217 had to unwind.

The durable reference tier (North Star, architecture, F contract, design system and component
contracts) stays. Stale claims within it still need the focused reconciliation listed below.

## Goals

1. **Lean onboarding.** A new agent or contributor asks "what's next?" and learns what works, what
   is broken, what is undecided and what is already claimed, in a handful of reads.
2. **Parallel work without duplication or gates.** Anyone can pick up independent work in any area.
3. **Self-building toward the North Star.** An agent can find the next gap, build it, prove it and
   merge it, escalating only for real judgment calls.
4. **Honest, recoverable status.** "Shipped" can never be a stale claim; a broken feature shows as
   broken as soon as anyone proves it.
5. **Self-aware maintenance.** Undecided product choices, missing UX, missing research and
   ambiguity are surfaced as visible flags instead of being guessed around or blocking everything.
6. **Bounded context without reading rules.** Structure gives agents the right context; judgment,
   not a reading quota, decides when they have read enough.

## Principles

- **Durable truth in the repo, flow in GitHub.** Code, tests, the capability ledger, reference
  contracts and decisions live in the repository. Claims, plans, flags and review conversations
  live in GitHub issues and pull requests.
- **Status is computed, never claimed.** Tests and confirmed bug reports drive a report that
  derives each capability's maturity and health from the latest complete run on `main`.
- **Checks over prose.** A rule that can be a test or lint becomes one. Other guidance blocks
  nothing, with one exception: the retained hard rules and approved designs bind whether or not
  tests fully cover them.
- **Areas, not gates.** Tracks organize code, context and expertise. Anyone may change any area.
- **Design leads.** An owner-approved design is the target for the surface it covers; the shell
  reference follows what ships.
- **Flag, don't guess and don't stall.** Open a flag, continue on the most reversible reading, or
  pick other work.
- **Judgment clause.** When following a guideline costs more than the risk it guards, say so in one
  line in the pull request and proceed. It never applies to the retained hard rules, approved
  designs or Tier 2 work.
- **Enforcement before autonomy.** No mechanism is retired until its replacement is enforced.

## Changes

### A — Capability ledger with computed status

A root `capabilities.json` lists what the product should do: one entry per thing a creator would
say they can do. It holds definitions and the owner's review record, never status.

```json
{
  "id": "layout.roof.gable-join",
  "area": "T1",
  "summary": "Two gable roofs meeting at a corner join automatically with a correct valley",
  "northStar": "north-star.md#product-convergence-destination",
  "surface": ["layout-core: roof evaluation", "editor: roof authoring tools"],
  "design": null,
  "review": null
}
```

A review record, once the owner accepts design-led work, names what was reviewed:
`{ "implementation": "<commit>", "design": "<design revision>", "date": "...", "verdict": "accepted" }`.

**Tests carry the claims.** Each test declares the capability and level it proves in its title, for
example `[cap:layout.roof.gable-join core]` or `[cap:layout.roof.gable-join edge]`. A reproducer
for a confirmed defect merges as an **expected failure** linked to its issue
(`[cap:layout.roof.gable-join core known-failing:#301]`, using the runner's expected-failure mode).
CI stays green because the test is expected to fail, the report counts it as failing, and when a
fix makes it pass CI flags the stale marker so the fix pull request removes it. A skipped check
also counts as failing.

**Two axes, reported separately.** Maturity says what has been proven; health says whether it works
right now. Health is never hidden behind maturity.

| Maturity | Meaning |
| --- | --- |
| `missing` | no core check is defined, or none passes |
| `partial` | some core checks pass |
| `working` | at least one core check exists, and every core check passes |
| `polished` | `working`, every edge check passes, and the owner's review is current |

| Health | Meaning |
| --- | --- |
| `healthy` | no failing checks and no confirmed open bug |
| `degraded` | an edge check fails, or a confirmed bug that does not block the main journey is open |
| `broken` | a core check fails, or a confirmed bug labelled `blocks-core` is open, even before any reproducer exists |
| `unknown` | the latest report for this capability is stale, incomplete or missing |

A capability whose maturity or health worsened since the previous report is marked **regressed**.

**The report states its own provenance:** the commit it tested, when it ran, which suites ran and
whether each completed. A report older than the current `main` head, or with an interrupted or
missing suite, marks the affected capabilities `unknown` instead of presenting old results as
current.

**Owner reviews are bound to both design and implementation.** A review goes stale when its design
changes, or when a later merge touches the capability's `surface` (path globs in practice; shown as
descriptions above). Changes elsewhere keep it. A stale review drops `polished` to `working` until
the owner looks again.

**When a "shipped" feature turns out broken** (for example, gable roofs fail to join on a T-shape):

1. Whoever finds it reproduces it on current `main` and opens a `bug` issue with the steps,
   labelled with the capability, adding `blocks-core` if the main journey fails. The report reads
   issues live, so health changes at once, before any test exists.
2. If the defect can be automated, a reproducer merges as an expected failure linked to the issue,
   so the report keeps showing it through the test. If it cannot be automated yet (a visual
   defect, for example), the issue alone carries it.
3. The fix pull request makes the reproducer pass and removes its marker, or, for an issue-only
   defect, closes the issue with the evidence that it is fixed. Health recovers on the next report.

Nobody edits a status field, reopens a slice or writes a document at any step.

**The hard guards,** enforced in CI: removing a tagged check, retagging it to a lower level,
dropping `blocks-core` from a confirmed bug, or closing a `blocks-core` bug without a linked fix all
need the owner's label on the pull request or issue.

Agents may add capabilities and checks freely. The initial seeding from the North Star is reviewed
by the owner once.

### B — Claims and flags in GitHub

- **Claims:** a draft pull request or self-assigned issue whose title names the capability id. An
  agent checks open issues and pull requests before starting, and again right after creating its
  claim, because two agents can both see "unclaimed" first. If another claim for the same
  capability exists, the earlier one keeps it and the later one closes or narrows its scope. The
  status report also lists duplicate claims.
- **Flags:** issues with a capability label and one of these flag labels.

| Label | Meaning | What an agent does |
| --- | --- | --- |
| `needs-decision` | a product choice is undecided | proceed only on a reversible default and record the assumption; otherwise pick other work |
| `needs-ux` | the flow or UI is not designed | build the logic behind it with a minimal surface; never invent final UX |
| `needs-research` | the technical foundation is unknown | run a bounded spike whose exit is a decision, not an open-ended study |
| `ambiguous` | the spec or design is unclear or contradicts itself | ask in the issue and proceed on the most reversible reading |
| `bug` | behavior is wrong | write a failing tagged test first, then fix |

Agents open flags whenever they hit one; that is the self-aware maintenance loop. Research output
lands as a short conclusion linked from its issue and, when it settles something, as a decision or
a ledger change.

A single command (`npm run status`) discovers the complete report from the successful `Merge gate`
push run for the current main head via `gh`, then prints the report's commit, age and completeness,
and, per capability: maturity, health, regressions, failing checks, open flags and claims. Pass
`--report`/`--previous` for explicit artifacts, or `--offline` to use `.harness/report.json`. That is
the lean scan a new agent starts from.

### C — Autonomy by risk tier

```text
Tier 0  everything not listed below
        → one fresh-context agent review, merge on green CI
Tier 1  changes a contract's details within the retained hard rules, the visitor/public
        surface or shared shell rules; or changes a persisted format that the previous
        reader can still read, or that ships a tested migration and recovery path
        → agent review, merge on green CI; the owner reviews it at the next
          significant-change checkpoint; revert is the recovery path
Tier 2  changes a retained hard rule, the North Star, an approved design or the ledger's
        shape; any persisted-format change without that compatibility or tested recovery;
        removes or downgrades a check; records an owner review; production data or
        activation; licence; new dependency
        → owner decides before merge
```

- **The highest applicable tier wins.** A change's tier follows what it does, whether or not a test
  notices.
- **Why the persisted-format line:** reverting code does not make newly written files readable by
  the old reader, so "revert is the recovery path" only holds for formats that stay readable or
  ship a tested way back.
- **Autonomous merges start only after the required merge gate exists** (see Sequencing). Until
  then, the current rules apply.

### D — Areas, not gates

- T1–T5 remain names for areas: Spatial world, Composition, Experience, Release, Expressive
  geometry. They organize code, local context and expertise.
- **Fix it where you find it.** An agent working mostly in T2 may complete something T4 missed; T5
  may build a foundation T1 lacks. Nobody delegates a gap to "the owning track".
- Touching another area means reading its local AGENTS.md, keeping its tests green and respecting
  its invariants (which tests enforce). Nothing more.
- Reviews are area-aware without area owners: the reviewer subagent receives the touched areas'
  AGENTS.md files.
- If ownership files are added for human teammates, they notify and never block. Risk tier, not
  area, decides escalation.
- Parallel safety comes from claims and small pull requests. Whoever merges second rebases.

**T5 Object Studio is a proposed capability group.** Seed links to the
[#266 proposal at its inspected revision](https://github.com/Biskiq/spatial-sketch-editor/blob/e2e3aea74317fd3f84d15c68dd4e4896b217fc1f/broad-research/native-modeling-freedom/PROPOSAL.md#4-capability-sequence-dependencies-and-workflow-alignment-c1c6),
not local links to files absent from `main`. Candidate ids below describe coverage, not status or
new gates. Proposed designs have no accepted `review`; maturity/health still come only from §A.
Landed native-form checks must not be relabelled as proof of an unbuilt Studio journey.

| Candidate capability | #266 coverage and dependency |
| --- | --- |
| `studio.dual-entry` — C1 | World-origin and standalone entry, framing/return, canonical Scene v4 operations, F4/HeadSave and My Objects copy semantics; Studio entry/UI is proposed, existing planners alone do not prove it |
| `studio.geometry-research` — C2 | Headless Stretch Q4 and Manifold experiments, drift, grazing and shear falsifiers; research evidence, independent of C1 |
| `studio.modeling-engine` — C3 | UI-free operators, holes/offset/push-pull and fair incumbent comparison; consumes C2 findings, independent of C1 |
| `studio.experimental-modeling` — C4 | C1 + C2 + C3; visibly experimental, fixture-only modeling with explicit local history and leave guards; no experimental F4/HeadSave payload |
| `studio.integrated-demonstration` — C5 | C1–C4 live demo plus C2–C3 headless evidence; source proposal's owner choices `D-Studio-UX` / `D-T5-Source` remain unresolved, with no C6 work needed to demonstrate it |
| `studio.canonical-promotion` — C6 | Conditional source/library/delivery cutover and approved expansion after those choices; neither Scene v5 nor My Objects v2 is ratified by this ledger link |

Use the existing `needs-ux`, `needs-research` and `needs-decision` flags for these uncertainties.
C1–C6 are #266's proposed dependency sequence, not six required approvals or a new gate register.
Its standalone route, Studio posture/dock/Index and source-model departures challenge the
[T5 umbrella](./t5-expressive-geometry/umbrella-plan.md) and PLATE; #259 does not settle them.
After harness cutover, the existing risk tiers apply to that work; no extra T5 workflow is added.

### D2 — Parallel work, focus and holds

The owner still drives work by prompting agents; nothing runs on a schedule.

- **Starting a batch is a prompt, not a pull request.** The owner tells one or more agents what to
  pursue ("the next unclaimed T4 capabilities", "these three gaps", or "whatever `npm run status`
  ranks next"). Each agent claims its item with a draft pull request and runs the post-claim
  collision check, so parallel agents do not build the same thing. Each pull request merges on its own; there is no batch-level greenlight.
- **Focus line.** A short focus file at the repository root states the current priority in a few
  lines (for example "T4 publish loop first; T5 depth paused"). `npm run status` prints it, and
  agents prefer work that matches it. Changing it is a one-line owner commit.
- **Hold.** When a new research idea or design rethink needs everything to stop, the owner sets the
  focus file to a hold: no new claims, in-flight work either finishes its current pull request or
  parks as a draft. The hold names its question and what ends it (a decision, a design, a research
  conclusion). Lifting the hold is editing the same file.
- **Converge.** If the idea changes direction, its outcome lands as ledger changes, an approved
  design or a North Star amendment (Tier 2), and parked drafts rebase onto it or close.

### E — Design leads

- An explicitly owner-approved design is the target for the surface it covers. Its approval scope
  and revision must be recoverable; a README label or ledger link alone cannot confer approval or
  revive superseded chrome. It outranks stale descriptive shell text for that surface, while
  ratified domain contracts and retained hard rules still bind. Designs marked `exploring` or
  `proposed` inform but do not direct. The accepted interaction sheets and their limits are
  reconciled under §I.
- Agents build toward the approved design. They never reshape it to fit the current shell. If the
  design cannot be built without breaking an invariant, or is unclear, they open `needs-decision`
  or `ambiguous` rather than reconciling silently.
- Acceptance for design-led work is the owner's review against the design; it is the review that
  makes a capability `polished`.
- After acceptance, the [shell and visual-system contract](../reference/design-system/editor-shell-and-visual-system.md)
  is updated, in the same pull request or the next, to describe what shipped. The design is the
  destination; the reference describes the accepted current.

### F — Work units and plans

- New work is identified by capability ids, not phase and slice numbers. Existing T/P/S identifiers
  stay valid as history.
- **The unit of work is a pull request** that adds or passes checks for one or more capabilities.
  Small work needs no plan.
- **A plan is written when the work needs one:** multi-PR work, Tier 2 work, or any work where an
  implementer would otherwise have to invent an interaction, an algorithm or a data shape.
- **Detail is judged by the no-invention test, not by length.** A plan is complete when an
  implementer can follow it without inventing new interaction, algorithm or format decisions. A
  novel algorithm or interaction gets as much specification as it needs (states, edge cases,
  pseudocode, worked examples); routine work gets a few lines. What a plan leaves out is
  ceremony: authorization history, evidence logistics, and restated contracts it can link to.
- **The plan is the first commit of the work's own draft pull request**, in a plans folder under
  docs. It is reviewed in that draft before code is written (by the owner for Tier 2, otherwise by
  a fresh-context agent), then the same pull request implements it. There is no separate plan pull
  request. On merge, durable decisions from the plan (an algorithm, an interaction rule, a format)
  move into the owning reference contract or code comments, and the plan file moves to the archive.
- Plan sections, used as needed:

```text
Goal         capability ids + North Star link
Design       approved design reference, or "none"
Scope        in / out
Specification  interactions, states, algorithms, data shapes, edge cases — enough that
               nothing has to be invented during implementation
Checks       tagged tests to add, written first and failing
Flags        open decisions, UX, research or ambiguity this work depends on
Risks        what could go wrong and how it would show
```

- **One review round:** a fresh-context reviewer subagent, spawned by the implementer, receives
  the diff, the touched areas' AGENTS.md files, the linked design and the capability's checks.
  P0 and P1 findings block; P2 and below become issues unless trivial. Disagreement goes to the
  owner.
- **No closeout step.** Merging is the closeout; the status report updates itself. No acceptance
  documents, anchor pull requests or phase-close records.
- Durable knowledge discovered while planning goes into reference contracts or a one-page decision
  record, never into a plan.

The [slice-closeout skill](../../.agents/skills/slice-closeout/SKILL.md) and
[phase-closeout skill](../../.agents/skills/phase-closeout/SKILL.md) retire; the
[work-checkpoint skill](../../.agents/skills/work-checkpoint/SKILL.md) stays for long resumable work.

### G — Context without reading rules

- **Understanding check, not a reading quota.** Before changing code, an agent should be able to
  state what it will change, what could break and who consumes it, and how it will prove the
  change. Read until it can; stop when it can. Review is not a substitute for reading.
- **Wide reading goes to explorer subagents** that return short summaries, so the main session
  stays clean.
- **Structure carries the routing:** nested AGENTS.md files per package or area; a header box of at
  most ten lines at the top of each durable doc (what it covers, invariants, governed paths, when
  to read further); a path-to-doc map; the [docs router](../README.md) reduced to an index of about
  40 lines.
- **Three levels of authority:** code and tests state current behavior; reference contracts and
  approved designs state invariants and targets; the North Star states intent.
- [AGENTS.md](../../AGENTS.md) drops current rules 9 and 10 and the boot contract, and stays at or
  under about 100 lines. A line is added only after an observed agent failure.

### H — Onboarding

- A "first ten minutes" section in the root README: clone, install, `npm run status`, read
  AGENTS.md, the glossary and the North Star header box, pick an unclaimed item.
- A one-page glossary of domain terms (Layout, Scene, Camera, Experience, Presentation, Guide,
  Stop, World and Experience lenses, PLATE, Stage, Object Focus).
- Human contributors and agents use the same path.

### I — Reference tier: keep and trim

- **Keep** the North Star, architecture, the F contract, component contracts and the shell
  contract.
- **Trim** the design system to rules and tokens; tokens live in code and the doc points to them.
  Designer-brief summaries are generated on demand.
- **Decision records:** Tier 2 decisions only, one page each. Authorization records move to the
  archive.

**Reference ownership after #271.** PLATE owns shell composition and visual/state roles;
[spatial-instrument grammar](../reference/design-system/spatial-instrument-grammar.md) owns Stage
instruments; [F / AM-11](../reference/composition-execution.md#am-11-guide-pacing-explore-and-return)
and [Camera](../reference/components/camera-tour.md), Scene and persistence contracts own domain
semantics. The accepted [World sheet](../reference/design-system/world-interaction-sheet.html)
and [Experience sheet](../reference/design-system/experience-interaction-sheet.html) own consolidated
visual/demo evidence, not independent production evaluators. Production code/tests establish what
is implemented; ratified contracts retain invariants and destination intent. Resolve material
contradictions by concern, with explicit uncertainty where approval scope is unclear. Keep this
distinction in the shorter router and nested context; shortening must not flatten authority.

#### Focused shell hardening inventory

These are bounded reconciliation tasks for #259's implementation, not a shell redesign. Mechanical
reference corrections can ship there; any newly discovered behavioral repair is a named capability
defect, not permission to expand this PR into feature work.

| Paths / concern | Verified drift and recommended hardening | Dependencies / proof |
| --- | --- | --- |
| `docs/reference/design-system/editor-shell-and-visual-system.md` introduction, state table, typography | The owner-acceptance update reconciles the introduction/state table to the landed R217 shell. Remaining typography/rebuild-from-zero wording still needs focused hardening; preserve the accepted shared homes and distinguish remaining destination depth | `apps/editor/src/lib/authoring/stage/shell/`, `apps/editor/src/lib/authoring/experience/ExperienceHomesHost.svelte`, R217 S20–S25 and world-shell-recovery evidence; do not mark every destination capability shipped |
| PLATE Experience information homes, Guide/Stops, playback and advanced authoring; `docs/reference/components/camera-tour.md` | Older Stop View sequences, explicit continuation/Gates and generic Preview prose conflict with AM-11's implemented linear Guide. Describe one Stop entry/stay, Guide pacing/order, strip-owned Guide editing, Experience Card welcome/opening Guide, explicit Look through, automatic Camera-path reconciliation, paused/seeking Preview and public autoplay. Retain one Camera evaluator and one writable home | AM-11; `packages/project-model/src/units/types.ts`, `units/planning.ts`, `units/experience/{lowering,interpreter}.ts`; `ExperienceGuide.svelte`, `ExperienceStopWriter.svelte` and `ExperienceExperienceWriter.svelte` under `apps/editor/src/lib/authoring/experience/`. The wider ratified Gates destination is the owner conflict below, not a feature to restore |
| `docs/reference/composition-execution.md` AM-11 implementation status; `docs/roadmap/README.md` cutover row; R217 phase/`now.md` | Owner-acceptance reconciliation records format 4 / Program v4, the accepted current cutover, R217 closure and S11 execution waiver. Verify remaining locators against that baseline during implementation; preserve the in-place amendment/refusal history and never invent per-check passes or a converter | `EXPERIENCE_UNIT_FORMAT_VERSION` in `packages/project-model/src/units/types.ts`, strict reader in `units/validate.ts`, lowering and #271 merge. Update current locators; earlier plans/acceptance records stay historical |
| `apps/editor/src/lib/authoring/stage/shell/shell-roles.css`, `EditorHead.svelte`, `EditorCard.svelte`, `StageDock.svelte`, spatial route and Experience components | Shared roles exist, while literal type/control metrics remain in components. Inventory equivalent values and consume existing roles where equivalent; preserve exceptions with a concrete use. Fix the stale roles comment describing draft ink as white when the token and accepted World grammar are black | Existing `--shell-text-*`, control/Head sizes and material roles; shell composition/coarse-target tests and accepted sheets. Preserve calibrated density, narrow layout, 44 px coarse targets and current behavior; no new scaling system or visual restyle |
| Shared homes/lower-edge composition and World `Soon` controls | Keep Card/Instrument avoidance, canonical selection, gesture fade, lens return, F4 history and session-only preferences. The disabled Card actions/Base/Top remain explicit unbuilt capabilities, not active features or arbitrary deletion candidates | `apps/editor/tests/lib/authoring/stage-shell-composition.test.ts`, `stage-shell-coarse-targets.test.ts`, `editor-host-no-write.test.ts`; S11 exposure list, seam checks and matrix. Tag existing guarantees; repair only a demonstrated defect |
| `docs/reference/design-system/world-interaction-sheet.html`, `world-interaction-sheet/{opening.js,opening.bundle.js}`, `experience-interaction-sheet.html` | Keep the accepted pair and World offline bundle/source together. Opening source imports real Layout planners plus production Paper/refusal helpers; its rebuild instructions still live in a roadmap review document. Put the exact rebuild recipe beside the source before archiving that review | `docs/roadmap/r217-core-editor-stability/world-shell-recovery/opening-design-review.md`; verify the source/bundle and offline specimen after any move. The SVG/state/clocks remain demonstrations, never Camera/runtime or persisted-format authorities |

#### Prototype pruning inventory

Audit scope: tracked files in all 15 prototype directories; root/workspace manifests, source imports,
prototype-local tests/QA/build/capture scripts, `.claude/launch.json`, docs and research consumers.
No production import of a prototype was found in `apps/` or `packages/`. That does **not** make
every prototype disposable: production scripts exclude them, their local tests still matter, and
the docs scanner walks their Markdown. Paths below are current sources; archive destinations go
under the existing `docs/archive/` family, with self-contained executable assets moved together.
These are recommendations only; nothing is removed or moved in this reconciliation.

| Candidate paths | Disposition and rationale | Consumers / dependency treatment |
| --- | --- | --- |
| `prototypes/spatial-authoring/` World executable, `app/`, `tests/`, World QA and captures | **Keep.** Advanced A–F World journeys (Rotunda/partial Unroll, Section, Ceiling Lift, nested Look/return) remain unique and are not replaced by the accepted World sheet | World app imports Experience modules through `app/main.js` and `app/journeys.js`; navigation shares `camera-evaluation.js`. Removing Experience files by filename would break this retained executable |
| `prototypes/spatial-authoring/app/experience*.js`, `tests/experience-*.test.mjs`, Experience QA/scripts/captures | **Keep as historical regression evidence**, not active Experience UX. Set/Seam/Coordinate, offers, Cues, repair and visitor cases exceed the current production loop. Do not port their old model or run its entire sweep as a #259 gate | Local `qa/run-all.sh`, mutation scripts and World coupling above. **Keep** `qa/EXPERIENCE-UX-EVIDENCE.md`: `apps/editor/tests/helpers/docs-references.ts` explicitly protects this sentinel. Update context links, not its historical claims |
| `prototypes/spatial-authoring/plans/experience-v2-prototype/`, `plans/unified-design-reconciliation/`, `design/visual-system-refinement/specification-plan.md` | **Archive.** Inactive UX/V2 delivery instructions compete with current plans; useful reasoning/provenance does not make them active | Prototype README, QA evidence, V3 reconciliation, T3 planning evidence and cutover plan link them. Rewrite those links to historical locations; preserve World scripts/fixtures and the protected evidence file in place |
| `prototypes/experience-ux-alternative/` (Conservatory) | **Keep.** Reproducible dense Presentation/View, long-Guide and creator scenarios remain a useful donor; its obsolete shell is not the current target | Root/prototype READMEs, S25 harvest, S26 execution/card-metrics and PLATE/grammar evidence links. Route normal design work to the accepted sheets; retain donor fixtures/rationale without treating its old timing or data shapes as AM-11 |
| `prototypes/experience-authoring/` including `src/`, `tests/`, manifests and plans | **Archive intact.** Superseded donor shell, but narration, activities/offers, interruptions and regression cases remain historical evidence beyond today's implementation | Local Vitest/Playwright and Vite scripts form a runnable unit; root workspaces/CI do not import it. Prototype hub and historical research links must follow the archived package; replace README's misleading “current experimental” claim |
| `prototypes/experience-ux-v3/design/`, `README.md`, `review.md` | **Archive.** Rejected/superseded UX3 rationale and reconciliation can explain choices, but its inactive plan must leave active discovery | PLATE/grammar evidence, prototype hub, Conservatory README, T3 planning evidence, Paper plan and V2 selector inventory. Retarget historical links; remove forward instructions to execute V3-A–F or return to #115 |
| `prototypes/experience-ux-v3/boards/`, `boards.html`, `gallery.html`, `specimens.js`, `specimens.css`, `scripts/` | **Remove.** Fifteen generated layout PNGs, their compositor/gallery and regeneration pipeline implement abandoned UX3 appearance; they prove no production behavior and supply no unique executable test | `boards.html` loads specimens, `capture.sh` generates PNGs and invokes `build-gallery.py`; design/README/gallery embed them. Remove those embeds/commands with the packet, replace material historical citations with pinned Git locators. Current sheets and retained donor scenarios cover the useful interactions; Git keeps the old pixels |
| `prototypes/integrated-experience-authoring/` design and `Design-QAs/` | **Archive.** Earlier V2 synthesis/QA, including Camera-precision rationale, is historical comparison evidence; neither eight PNGs nor former approval is a current acceptance target | World/Experience reconciliation decision, PLATE/grammar evidence, V3 and spatial plans link it. Preserve the historical bundle and repair links; do not present old Stop/View or compressed-camera assumptions as production rules |
| `prototypes/world-experience-shell-round/` | **Archive.** Earlier shell experiment is superseded; discovery/procedure/return reasoning remains historical evidence | Paper proposal embeds its dense-search board; Conservatory, integrated V2 and PLATE/grammar cite it. Move the whole design/QA package together and redirect citations, not just its README |
| `prototypes/paper-authoring-commission/` | **Archive.** The commission, original proposal, specimens and inactive PA0–PA12 are historical; old rail/families/Dimensions instructions must not direct new shell work | Docs router, PLATE, T1/T2 planning and V2 plans reference it. Route current World work to PLATE plus the accepted World sheet; preserve cited original rationale and relative specimen assets |
| `prototypes/production-shell-wireframe/` incl. atlas, tours, Compare and generators | **Keep.** Much core chrome is adopted, but roof Section, Slice, Unroll and retained alternatives still provide unique future-depth evidence | Active `.claude/launch.json` entry, root README, PLATE/ratification/grammar and R217 recovery measurements use live files. Keep its own modules, static/story generators and assets together; do not mistake every Compare alternative for an accepted product decision |
| `prototypes/p2-smart-wall/`, `prototypes/p3-vellum/` | **Keep.** Wall revision relationships and Vellum roof/storey/profile/hold/section evidence are incompletely adopted, not duplicates of R217 | North Star/research/T5 sources; Vellum's 23 local test files, research `probes/rr4/README.md` test commands and `.claude/launch.json`. Preserve runnable source/fixtures, not just approval records |
| `prototypes/p3-depth/` | **Keep.** Thirty architectural fixtures and three evaluator test files remain unique roof/section/depth research | Root README and T5 G0 evidence cite it; local `tools/serve.mjs` and tests have no production substitute. Correct its stale worktree-status prose when touched |
| `prototypes/object-composition-prototype/` | **Keep.** Unratified but unique assembly/provenance/reach/revision-repair demonstrations; production composition has not replaced them | `.claude/launch.json`, T2 planning/research, local `qa/checks.js` and self-contained vendored Three.js. Preserve its stated simulated-vs-real boundary |
| `prototypes/native-form-lab/`, `prototypes/native-object-shaping/`, `prototypes/living-drawing/` | **Keep as research.** Form Lab's five test files and carrier/role findings, Shape Focus UX and Living Drawings revision model remain distinct inputs to T5/#266 | T5 umbrella/G0 evidence, `broad-research/native-object-creation-ux/PROPOSAL.md`, Shape Focus cross-links and #266. Shape Focus is a proposed design, not a functioning or ratified Studio; #266 challenges some of it without superseding all evidence |

Approval history alone preserves none of the Remove packet. Conversely, an old implementation
is not a duplicate test merely because a new one covers the same feature: the successor must fail
on the same defect. No prototype-derived product authority or new archive-exclusion prefix is added.

#### Roadmap and operations pruning inventory

| Current paths | Disposition / dependency treatment |
| --- | --- |
| `docs/roadmap/now.md`, `cross-track-execution.md`; `docs/operations/current.md` and per-area `current.md` | **Archive at workflow cutover.** Repeated permission/DAG/baton text already disagrees with merged #271 and shipped S25. Replace discovery with focus + status/claims, retaining unresolved residuals as flags. This audit does not rewrite another area's baton |
| Closed phase trees: `docs/roadmap/t1-spatial-world/{t1.p01-stage-foundation,t1.p02-native-wall-creation}/`, `t2-composition/{t2.p01-supported-composition,t2.p02-own-model-import}/`, `t3-experience/{t3.p01-camera-experience-foundation,t3.p02-capture-and-cut-preview,t3.p03-shared-acceptance-and-measurement,t3.p04-project-lifecycle}/`, `t5-expressive-geometry/t5.p01-drawn-native-objects/` | **Archive** closed plan/acceptance/evidence packets after preserving live contract and test/fixture consumers. Keep short area context pointing to code/contracts; do not copy their registers into the ledger as claimed maturity. T4's unimplemented prepared release plan is future scope, not a closed packet |
| `docs/roadmap/parallel-track-cutover/`, `docs/operations/architecture-cycle.md`, `docs/operations/README.md`, per-area runbooks; `.agents/skills/{slice-closeout,phase-closeout}/` | **Archive/retire** obsolete process at the same cutover as its test assertions. Keep useful development/testing commands in existing contributor/test docs, checkpoint workflow and browser hygiene. The tests manual still cites §7.4/§7.7 in the cutover plan: inline the complete required command contract there before retiring that route |
| `docs/roadmap/r217-core-editor-stability/{post-s10-convergence,s12-s15-corrections,post-s19-owner-manual-review,world-shell-recovery,r217.s26-experience-authoring-depth,experience-review}/` | **Archive historical plans/round logs once current rules and open evidence are extracted.** Reference sheets already replace the redundant roadmap HTML retired by #271: do not plan to delete it again. Preserve the owner acceptance/waiver and historical A–Q/check evidence; neither is a future R217 prerequisite. Opening rebuild recipe must survive the move |
| Shipped R217 slice plan stubs/acceptance packets and `docs/roadmap/core-editor-stability.md` | **Archive historical packets** after ledger/test/reference mapping; **keep the owner acceptance/waiver and useful historical evidence**. R217 is closed by the owner's ruling at #271; no future integrated gate or routine phase-close record/PR is required |
| `docs/reference/decisions/*authorization*.md`, `r217-convergence-campaign-2026-10-30.md`; T5 `e0-execution-plan.md` and G0 proposal packets | **Archive** permission-only/withdrawn execution history and superseded alternatives once normative conclusions are linked from existing references. **Keep** ratified North Star/F/shell/T5 decision provenance and the adopted T5 umbrella. Extract unresolved performance/import/activation residuals; closed phase status never proves them resolved |

Pruning must update every affected inbound link, embedded asset and command in the same #259 diff,
including research consumers. Preserve exact test/format/acceptance evidence where still useful;
do not create per-file approval documents or satisfy a word-count target by dropping obligations.
The on-demand gardener remains archive-only (§J); explicit removals above are this bounded prune,
not an expanded deletion power for that skill.

### J — On-demand agent skills

These are skills the owner (or an agent finishing a significant change) invokes when useful. None
runs on a schedule and none is a required step in a plan.

- **Checkpoint:** after a significant functionality change, summarizes for the owner what changed,
  status movements and regressions, Tier 1 merges since the last checkpoint, open flags ranked by
  how much work they block, and the next unclaimed capabilities. This replaces any fixed digest.
- **Gardener:** moves dead or closed material to the archive (it never deletes outright), flags
  drift between docs and code, and opens one reviewable pull request. Useful before onboarding
  someone, after a large merge, or when context starts to feel heavy.
- **Breaker:** exploratory testing of `working` and `polished` capabilities. Every defect it finds
  lands as a failing tagged test or a `bug` issue.

## Sequencing

All stages implement **inside #259**. This reconciliation is the first stage; it is not a
separately merged proposal. Stages are implementation order, not approval gates. Current rules
govern #259 until the enforced replacement and owner merge; no stage enables autonomous merges
on its own, and no closeout PR or further planning round is required.

1. **Reconcile the base (this pass).** Rebase onto `ce4e232c`, preserve the settled design, record
   actual status and the inventories above. Do not implement or prune yet. At implementation
   start, refresh `main` and recheck only changed dependencies; do not reopen the harness design.
2. **Enforcement first:**
   - a repository merge-gate workflow running `npm run check`, `npm run test:arch`, `npm test`,
     `npm run test:heavy`, `npm run build`, `npm run check:api` and DB-backed `npm run test:api`
     with zero skips, plus affected package type checks per the existing test contract. Keep the
     native-form Linux goldens job. The repository-wide gate must run unconditionally for PRs and
     `main`, with stable check names enforced by default-branch rules. Read back the actual
     configuration and show a failing check prevents merge before retiring the current mechanism;
   - the status script with main-branch reporting, provenance and the `unknown` state;
   - the hard guards on checks and confirmed bugs;
   - the ledger seeded from the North Star and current code/tests, including the proposed T5 group;
     existing tests tagged, flag and `blocks-core` labels. Owner seed review is part of this PR's
     final review, not a separate approval. The first report may look lower than reality where
     checks are missing; that is the honest starting point. A pre-merge rehearsal of reporting
     must identify the tested base/head accurately; no fabricated current-main report. After merge,
     reports stay `unknown` until the first complete run for the actual new `main` head.
3. **Context and focused shell reconciliation:** new/nested AGENTS.md, doc header boxes, shorter
   router, glossary and path-to-doc map; the §I ownership/status/semantic corrections and equivalent
   role reuse. Preserve the accepted sheets, current behavior, domain contracts and invariants.
4. **Workflow cutover and bounded pruning:** install the tier table, existing plan rules, focus,
   claims/flags and on-demand skills; replace retired process assertions and route-coverage
   sentinels atomically with their replacements. Apply the §I Keep/Archive/Remove inventory,
   updating imports/links/scripts together. Keep useful evidence and the explicit R217 acceptance/waiver;
   no arbitrary deletion quota, separate approvals or per-phase closeout sweeps.
5. **Verify #259's implementation independently.** Demonstrate both regression/report paths,
   stale and incomplete reports, zero-core behavior, review invalidation, claim collision handling
   and hard guards. Run the complete CI contract from stage 2, including architecture/isolation,
   regression coverage, editor build/checks and DB-backed API checks with zero skips, plus affected
   package checks. Verify the accepted reference specimens and surviving pruning consumers.

   R217 is already closed and Core Product Stability accepted at `ce4e232c`. S11's separate
   execution is waived by owner override after hands-on integrated product acceptance, not because
   stability verification was abandoned. Its historical plan/checklist and #271's A–Q remain useful
   evidence and regression material, with no claim that every individual cell/check ran. They are
   not a future gate, walkthrough, waiver request or closeout prerequisite for #259. Do not copy
   them into #259 as mandatory R217 acceptance work. #259's own changed-code verification and
   independent review remain required, and existing product tests/architecture guarantees stay.
6. **One owner merge of #259 (Tier 2).** Final review includes the seed, enforcement and cutover;
   no earlier proposal-only merge. Autonomous Tier 0/1 merges begin only after the required gate
   is active. If repository administration access prevents installing it, report that concrete
   blocker and retain current merge restrictions; do not compensate with another planning PR.
   Subsequent T4/T5 work uses the same capability workflow and owner focus, without declaring
   T4 the “first” new-rules area or imposing an unrequested T5 pause.

**Test migration.** Replace router/baton/release/closeout/cycle process assertions in
`apps/editor/tests/docs/parallel-track-gates.test.ts` with checks of ledger validity, report/guard
behavior and replacement routing in the same #259 cutover. Preserve interface, format, ownership
and isolation guarantees in durable tests; retiring the register does not retire domain validity.
The docs helper's `REQUIRED_WALKED_DOCUMENTS` in
`apps/editor/tests/helpers/docs-references.ts` also pins soon-to-be-retired batons/cutover routes:
retarget those coverage entries to retained replacement docs. Keep its protected prototype sentinel,
non-vacuous walk controls, reference/anchor resolution and exact permanent exclusions unchanged.
This is the necessary correction to “documentation tests stay unchanged”: their guarantee stays,
while obsolete path fixtures migrate. Every other product architecture, isolation and boundary
contract remains intact. No guarantee disappears unnamed.

## After it is in effect

**What disappears**

- Owner release rows and authorization records. Permission comes from the tier table, not from a
  per-slice release.
- Closeout, anchor and phase-close pull requests. Merging is the closeout; status updates itself.
- Acceptance documents. Evidence is tests plus the pull request description.
- Baton and register updates. Claims are draft pull requests; status is computed.
- Required cross-area review.

**What remains documentation-only, by design**

- North Star changes, Tier 2 decision records and approved-design updates (owner decisions).
- Gardener pull requests, when the owner invokes it (doc drift and archive sweeps).
- Focus and hold changes (a one-line owner commit).
- Reference-contract updates that follow an accepted design, when they cannot ride in the
  implementing pull request.

**What the owner still does**

- Approves designs and reviews design-led work to mark it `polished`.
- Decides Tier 2 items and answers `needs-decision` and `needs-ux` flags.
- Reviews at a checkpoint after each significant functionality change: regressions, Tier 1 merges,
  top flags, next capabilities. This is the owner's habit, not a step written into plans.
- Starts batches by prompting agents, and sets focus or a hold when direction needs to change.
- Reviews plans for Tier 2 work in their draft pull requests.

**A typical cycle**

1. An agent runs `npm run status`, sees `layout.roof.gable-join` at `partial` with no claim, opens
   a draft pull request claiming it and re-checks for a colliding claim.
2. If the work needs a plan, the first commit is the plan; it is reviewed in the draft.
3. The agent writes the tagged checks (failing), implements until they pass, gets one
   fresh-context review and fixes P0/P1 findings.
4. Tier 0 or 1: it merges on green CI. Tier 2: it waits for the owner.
5. The next report shows `working` and `healthy`. Any open question it hit is now a flag issue.
6. Later, when the owner runs the breaker, it finds a T-shape failure and adds an expected-failure
   edge test linked to a `bug` issue. The capability reads `degraded` and regressed until someone
   fixes it. Had the main journey broken, the issue's `blocks-core` label would have shown it as
   `broken` immediately.

## What does not change

- The hard rules on Camera authority, distinct semantic authorities, authored-truth exclusions,
  visitor isolation and no second compiler.
- The public-surface and preview-surface boundary tests and the documentation-reference gate.
- The North Star's ratified direction and the creative-depth admission test.
- Owner control of the North Star, approved designs, check removal, production activation, licence
  and dependencies.

## Risks

- **Weak tests make status look better than reality.** Mitigated by the breaker agent, owner
  review for `polished`, and the guard on removing checks.
- **Seeding the ledger is a large one-time job.** Seed coarsely, refine as work touches each area.
- **Review invalidation churn.** Scoped `surface` paths keep unrelated changes from expiring an
  owner review.
- **Status trusted while CI is missing.** Mitigated by building the merge gate and report first,
  and by the `unknown` state for stale or incomplete runs.
- **Detailed plans go stale.** Mitigated by moving durable decisions into references on merge and
  archiving the plan file.
- **Lower review bar, more slop.** Mitigated by the tier table, checks written first and the
  gardener.
- **GitHub dependence for flow.** Durable truth stays in the repository, so losing GitHub loses
  conversation, not product knowledge.
- **The prune becomes its own governance project.** Mitigated by bounded stages inside #259 and no
  new process documents beyond this one.

## Acceptance for this proposal

- A fresh agent, given only the repository and `gh`, answers "what's next, what's broken, what's
  undecided and is anyone on it?" from `npm run status` plus at most five file reads.
- Both defect paths are demonstrated once, with no documentation edits: an automatable defect
  (bug issue, expected-failure reproducer, fix) and an issue-only defect. Health drops on
  confirmation and recovers after the fix.
- A capability with zero core checks never reads `working`.
- A report from an older commit or with an incomplete suite shows `unknown`, and the report prints
  its commit, run time and completeness.
- The required merge gate is enforced on `main` before any change merges without owner action.
- AGENTS.md is about 100 lines or fewer; the router index is about 40 lines or fewer.
- Live discovery uses capability status, contracts and the concise context routes; superseded
  instructions leave active routing. Report the reduction, but prune by the audited inventory,
  dependencies and retained evidence rather than a percentage deletion target.
- A Tier 0 change goes from claim to merge with no owner action and no documentation-only commits.
- Product architecture/isolation/boundary guarantees and the documentation-reference gate stay
  green; obsolete process assertions and required-route fixtures migrate as specified above.
- #259 is the single harness implementation PR, with enforcement before cutover; no extra plan,
  approval or routine closeout PR. The accepted sheets and offline Opening specimen remain usable,
  and every pruned packet's surviving consumers resolve.
- This planning update records the owner's R217 acceptance and waiver in relevant existing status
  and reference records. No future harness implementation demonstration is claimed as passed.

## Open questions for the owner

The harness decisions and R217 acceptance are settled. #259 implementation is the immediate next
step; no S11 execution, A–Q rerun or R217 closeout remains as a prerequisite.

**Older ratified Gates/continuation wording** remains the narrow reference concern: AM-11
supersedes it for format 4, while older destination statements remain. Reconcile landed descriptions
to AM-11 and flag any broader future-direction ambiguity without restoring removed behavior or
silently amending the North Star. This does not reopen accepted R217 product review or block
#259 implementation. T5 Studio's proposed UX/source choices remain flags on that capability group.

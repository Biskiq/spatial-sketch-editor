# T1.P02.S02 — plan review: shared Head/F4 and T2/T3 contribution compatibility

AUTHORITY: NONE — the phase README owns slice status; the [release list](../../../now.md) entry and
the [next-wave authorization record](../../../../reference/decisions/next-wave-authorization-2026-10-27.md)
own the release. This artifact records a **pre-build plan review** completed in the 2026-10-27 owner
coordination round against the contracts and code named below. This is a recorded plan-level
compatibility assessment, not a separately submitted GitHub review or independent T2/T3 owner
sign-off on an implementation diff; those implementation reviews remain required.

STATUS: complete 2026-10-27. The reviewed allocation passes with the conditions in §5. The standing
**implementation** reviews — T3 for the shared Head/F4 diff, the owning track for any T2/T3 adapter
edit — remain merge-time obligations and are not discharged here.

## 1. Scope reviewed

- [S02 implementation plan](./implementation-plan.md) — the complete plan: bounded F4 operations,
  the chain state machine, delete-with-consequences, the bounded Round 2 shell cutover and its
  acceptance and performance obligations.
- [Shell draft — bounded S02 cutover](../shell-draft.md) — dock Select/Ink, the Card migration of
  ordinary Layout facts, the bounded Find in Head access and the contributor-home audit.
- The registration prerequisites the [slice register](../README.md#slice-register), the
  [batch E decision](../../../../reference/decisions/batch-e-authorization-2026-10-22.md) (E1) and
  the [current coordination](../../../cross-track-execution.md#next-parallel-batch) name: the T3
  review of the shared Head/F4 shell allocation and the T2/T3 contribution-compatibility review.

Not in scope, and not claimed: implementation correctness, browser or performance evidence, the
independent implementation review, and ownership sign-off of the implementation.

## 2. Authority and seam evidence read

| Source | What it establishes |
| --- | --- |
| [Round 2 shell ratification](../../../../reference/decisions/production-shell-round-2-ratification-2026-10-23.md) | D2 bottom dock and Esc collapse; D8 Experience tools in the shared dock; D9 the Card is the one writer for ordinary dimensions and the Dimensions Instrument is retired; D10 Find in the Head with explicit verbs. The destination map retires the pointer rail into dock readings, "More" into Find, and keeps the Instrument for Library, repair and Guide |
| [PLATE shell and visual system](../../../../reference/design-system/editor-shell-and-visual-system.md) | the shell authority the cutover consumes; Head owns project/lens/Save/Preview, and the lower working edge owns dock/Card composition |
| [`stage-contributions.ts`](../../../../../apps/editor/src/lib/authoring/stage/stage-contributions.ts) | the host consumes contributions generically: Find entries group by declared `railFamily`/`capability`, Card facts are contributed per subject and label-disambiguated by adapter |
| [`stage-facade.ts`](../../../../../apps/editor/src/lib/authoring/stage/stage-facade.ts) | the registration contract — adapter tasks, `findEntries`, `cardFacts` and the invoked `instrument` content, mounted with explicit capability refusal |
| [`EditorIndex.svelte`](../../../../../apps/editor/src/lib/authoring/stage/shell/EditorIndex.svelte) | contributed task entries render from whatever adapters registered; a domain reaches the Index without editing a shell module |
| [`EditorHead.svelte`](../../../../../apps/editor/src/lib/authoring/stage/shell/EditorHead.svelte) | the Head's current contents: project identity, lens, project lifecycle actions, Undo/Redo, T3's Save control and state, Preview, source download, reduced motion |
| Adapter registrations (`layout`, `scene`, `experience`) | the current contributors: Layout `inspect`/`place`, Scene `place`/`arrange`/`library`, Experience `experience` |

## 3. T3 review — shared Head/F4 shell allocation

Review performed in the coordination round against the sources above; T3's merge-time review of the
actual diff is unchanged (§5).

**H1 — the Head change is additive and bounded; no T3-owned state is touched at plan level.** The
plan adds a bounded *Find in Head* access for arming dock tools and invoking migrated tasks, and moves
ordinary Layout precision fields from the retired Dimensions writer into the Card. It does not change
the Save state machine or its control contract, Preview entry, Undo/Redo semantics, lens switching or
the F4 capture/admission wiring. Round 2 D9/D10 and PLATE own those surfaces; the plan consumes them
rather than redefining them.

**H2 — no shared F4 contract change is proposed.** The two new intents (chain commit, Wall delete)
register through the existing captured-intent path and the per-planner declared scope landed by
H0/`T3.P03.S01`; the plan keeps preview and final acceptance on one immutable capture and forbids an
uncaptured standalone noding allocator. The consumed scopes (`unit-acceptance-v1`,
`conditional-save-units-v1`) are unchanged.

**H3 — the Undo-block generalization is Stage-owned.** "Generalize Undo/Redo blocking from named
gesture owners to the active proposal/lease contract" changes the Stage host's proposal ownership,
not T3's Save or F4 history behavior. It must keep the block's reason until finish/cancel and leave no
hidden proposal; the plan already states that.

Findings: **no blocking defect at plan level.**

## 4. T2/T3 review — contribution compatibility

**C1 — the seam is already generic; the cutover requires no foreign adapter edit.** Adapters declare
capabilities (`findEntries` with `railFamily`/`capability`, `cardFacts`, `instrument`) and the host
renders them. A dock presentation, a Find list and one invoked Instrument can be derived from the
existing declarations without the shell hard-coding a T1 family or a T2/T3 adapter editing a shell
module.

**C2 — the plan's own constraint is the correct one.** "Contributions describe capabilities and homes;
the shell does not hard-code a T1 family that T2/T3 must edit", with an audit before any Index task is
removed, matches Round 2's destination map (Experience tools in the shared dock; Library/Guide/repair
in the invoked Instrument).

Findings: **compatible as planned; no blocking incompatibility at plan level.**

## 5. Conditions

**T3 review conditions.**

1. The actual shared **Head diff** is reviewed by T3 at implementation review before merge, as the
   phase register already requires. If the Head change turns out to require touching Save, Preview,
   history or the F4 wiring, S02 stops and reports rather than absorbing it.
2. The bounded Find must not claim the full scope-model Index, global subject search or every future
   Find command; S02's acceptance repeats that claim.
3. No new shared F4 capture or admission surface is introduced; a requirement discovered during
   implementation goes to the reviewer or the F amendment path, never a phase-local encoding.
4. T3 ownership acknowledgement of the implementation remains a merge-time sign-off, not something
   this plan review discharges.

**T2/T3 review conditions.**

1. Any change to the adapter registration contract (for example a new `home` field) is **additive with
   a default**, so no T2/T3 adapter must change to keep working.
2. If a T2/T3 adapter edit is genuinely required, that track owns and reviews it — the standing
   batch E shared-file rule — and it does not ride inside S02's PR.
3. No current Index or contributed entry is retired until its dock/Find/invoked route is verified
   reachable with keyboard access audited; a stranded or duplicated foreign contribution blocks the
   cutover.
4. Card facts keep adapter disambiguation; migrated Layout fields do not displace or shadow a
   contributed T2/T3 fact.

## 6. Verdict and what remains

**Verdict: pass for the plan, with the conditions above.** The release is recorded in the
[next-wave authorization record](../../../../reference/decisions/next-wave-authorization-2026-10-27.md)
and the [release list](../../../now.md). S02 starts after that coordination PR merges, on its own
trusted base, with:

- the standing T3 implementation review of the Head/F4 diff;
- the owning-track review of any T2/T3 adapter edit;
- the contributor-home audit before any Index retirement;
- every existing acceptance, performance, merge-gate and independent-review requirement unchanged.

**Omissions, named rather than implied.** No browser journey, performance measurement, production
edit or review beyond the modules named in §2 was made for this review. No T3 or T2 ownership
sign-off of an implementation is claimed.

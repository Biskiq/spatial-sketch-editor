# T2.P02.S03 — failed final-gate disposition and preservation

```text
AUTHORITY: NONE — the phase README owns slice status; the acceptance record owns the gate verdict;
           the release list and owner decisions own any re-run or scope change. This artifact
           preserves a failed gate and routes the decision; it accepts nothing, closes nothing and
           authorizes no merge or successor work.
STATUS:    FAILED FINAL GATE, dispositioned 2026-10-27. T2.P02.S03 stays **in-progress** and
           **NOT ACCEPTED**; T2.P02 stays **active** and is not closable. Evidence is preserved at
           its tested revision and is historical once a different product base is proposed.
```

## 1. Verdict preserved

The gate **ran 2026-10-27 and is not accepted**. The full verdict, row-by-row observations,
performance qualifications and owner decisions stay in
[acceptance.md](./acceptance.md); this disposition does not rewrite them. In summary, as the record
already states:

- pointer move/turn was **blocked as a pointer gesture**, and resize/duplicate/delete on a placed
  creator model were **blocked** because Compose had no entity to act on;
- the plan's “from an empty project” line was **unreachable** on the tested base because an empty
  project has no Room floor and placement installs nothing;
- the Stage route’s first-load JS was **447.0 KiB br against the ≤400 KiB hard budget**;
- the integrated performance recheck produced **measurements, not pass-scoped evidence** — wrong
  method authority, no pass-scoped bench manifest, no recorded power state, an agent rather than
  the owner as operator, and the remaining owner-run rows unrun.

No acceptance, phase close, track completion, readiness, gate state, capability entry or merge
result is claimed. S01 and S02 remain accepted and untouched.

## 2. Status and provenance

```text
S03 status          in-progress (failed final gate; not accepted)
T2.P02 status       active (not closable, not closed)
PR                  #199, branch t2/p02-s03-integrated-final-gate
tested revision     a025e2dd (evidence and records)
product code        9e0fcb50 (unchanged by this PR; every later commit edits the harness,
                    evidence and documentation, not product code)
trusted base        origin/main 9e0fcb50 (PR #198 merge)
evidence            ./evidence/2026-10-27/
harness             apps/editor/perf/run-s03-own-model-qa.mjs,
                    perf/flows/s03-own-model-acceptance.spec.ts,
                    perf/flows/s03-diagnostics.spec.ts
```

The evidence remains valid **for the revision it names**. It is not evidence for a tree that
contains a different product change. In particular, PR #201 (T1.P02.S02) changes the shared Stage
and the creator surface that this gate drove; once #201 or any other product change is part of the
base, the affected rows must be re-run and re-recorded, not carried forward. Historical
measurements describe `9e0fcb50`, not the eventual `main`.

## 3. Cross-track observations (integration only — not acceptance)

These observations come from a scratch integration branch at `origin/main` (`83c79c40`) that merged
#201 and this branch with no conflicts and passed `npm run check`, `test:arch` (22/180) and
`test:full` (214/2,653). They are **integration observations**, not S03 acceptance evidence and not
T1 acceptance evidence:

| Observation | What it changes for this gate |
| --- | --- |
| PR #201’s T3 implementation review is accepted at `bf9007ff` (later commits docs-only); its product change is not merged. | A future S03 verdict must re-run on the resulting `main`, not on `a025e2dd`/`9e0fcb50`. |
| On the merged tree, T2’s repaired S03 acceptance flow passed 2/2 in Chrome against a dedicated local Postgres database (agent-operated, 16.5 s). | The accepted-path journey still runs after #201; this is a smoke, never a pass-scoped row. |
| The S03 diagnostics on the merged tree now show a pointer placement leaving the new **model entity** selected. Compose opens on that entity. Resize and Duplicate remain **disabled** (“A model needs a verified contact…”); Delete is enabled. | The old “no canonical selection” blocker is removed by #201, but the required resize/duplicate/delete row is still not passable for a creator model. A re-run must record the new refusal, not the old one. |
| An empty project still has no Room floor. With Ink, a creator can draw an enclosure first; a typed-Ink smoke then imported, approved and placed a model and stored one Room and one entity. The Place instrument still refuses a floor click silently when no floor exists. | The structural cause is removable, but whether “from an empty project” means “draw first, then import” is an **owner decision**; the silent refusal remains a product observation. |
| Stage route first-load JS on the merged tree is **456.0 KiB br** versus 447.0 KiB br at the #199 base: #201 adds +9.0 KiB br, under the 25 KiB per-slice growth allowance but still over the ≤400 KiB hard budget. | The hard miss is not erased by #201 and may grow; the owner disposition for the budget still applies. |

The #201 merge order is a coordinator decision. The observation above does not authorize that merge,
does not re-accept the empty-project line, and does not turn the 2/2 smoke into a gate pass.

## 4. Remaining owner decisions

The five decisions in the [acceptance record](./acceptance.md#required-owner-decisions) remain
open. Restated for the next action, they are:

1. **Creator-model manipulation.** Decide whether S03’s manipulation row is re-run after #201 (the
   selection blocker is removed, but Resize/Duplicate are still refused for lack of verified
   contact), or whether T2.P02’s outcome is amended. The gate does not absorb this product change.
2. **Stage first-load budget.** Dispose of the ≤400 KiB hard miss on the resulting `main` (now
   measured at 456.0 KiB br with #201) — attribution/reduction in the owning code, or an explicit
   owner disposition. A failed final gate cannot defer it.
3. **F6 method.** Decide whether to authorize the contract’s ten-run extension with the sequenced
   drag the F6 row defines; the single floor-click proxy is not the row.
4. **Owner-run rows and formal performance method.** Complete shell observations, Draco/KTX2, the
   real >50 MiB decode, real R2, worker-boundary timing and GPU memory, or record a disposition for
   each; and decide how the hard rows are discharged given the formal method’s ten measured runs,
   declared power state, owner operator and pass-scoped bench manifest.
5. **The empty-project line.** Decide whether “from an empty project” means *draw an enclosure, then
   import and place* — now demonstrably possible with Ink — or a starter-only journey, and whether
   the Place instrument must say why a click installs nothing when no floor supports it.

No successor slice, no phase close, no acceptance and no merge is implied by this list.

## 5. Next legal action

```text
1. Owner disposes the decisions above (or explicitly re-scopes/withdraws the gate).
2. If the gate is retained, re-run the S03 harness on the resulting main at a recorded revision,
   with the owner as operator for the pass-scoped rows; preserve the old evidence as historical.
3. Re-review the new evidence. Only a recorded acceptance can authorize ordinary slice-closeout;
   this disposition is not that record.
```

Until then, T2.P02 remains **active**, S03 remains **in-progress / NOT ACCEPTED**, and the phase
stays **not closable**. The evidence is retained, not deleted or relabelled as a pass.

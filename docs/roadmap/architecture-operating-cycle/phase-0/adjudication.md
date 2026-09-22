# Phase 0 adjudication — record and evidence integration

```text
ROLE:     the owner's adjudication record for the Phase 0 diagnosis: the architecture lane's
          classification of every candidate, the structural-workflow lane's separate disposition,
          the rulings taken, and the integration point for the four frozen outputs.
NOT:      evidence · a second review · a re-scoring, summary or rewrite of the frozen outputs ·
          live cycle state · a contract · a tracker · an activity log
STATE:    ../../../operations/architecture-cycle.md      (sole live meta-state authority)
PLAN:     ../phase-1/2026-09-22-P1-installation-plan.md  (the installation plan this record gates)
RANGE:    f8411f7..b5f75e7 — the frozen P23 range, for every retrospective claim; current `main`
          for present behaviour, contracts and paths
EVIDENCE: ./mechanical-control-pass.md · ./review-a.md · ./review-b.md · ./structural-workflow.md
          — frozen, mutually independent, cited as they stand and never edited here
```

## 1. Purpose and standing

This is the record the Phase-0 workspace assigns to `adjudication.md`: the integration point for
completed, frozen evidence, written only after both independent reviews and the workflow diagnostic
were frozen. It is **not** a third review and it does not re-score anything. Where this record
disagrees with a frozen output on a *fact*, the disagreement is written here as an erratum (§5)
rather than by editing the output, so the independence the two-review design exists to produce
survives the adjudication.

The classification enums are the canonical ones:

```text
A  a real precedent that P23 established but never ratified    → may become a contract
B  intended but not durably documented                         → capture: write the missing rule
C  already caught by a current contract or an existing check    → no new authority
D  not architecture — a local implementation or naming choice   → no action, no ratification
```

A is deliberately the rarest outcome. A real precedent is only ratified when the frozen evidence
shows both the recurrence *and* the absence of any durable statement; where a current contract or a
check already covers the behaviour, the honest classification is **C**, and manufacturing a clause
for it would duplicate authority the repository already holds.

## 2. Architecture lane — all ten topics

Both reviews ran over the same frozen range without reading each other. They overlap on three topics
(planner boundary, vertical authority, mirror) and each holds material the other lacks; both
identifiers are kept. The historical written-rule contradictions are **not** candidates and are
recorded separately in §4.

| # | Topic | Class | Basis (frozen) | Counterevidence / limit | Disposition |
|---|---|---|---|---|---|
| AC-1 | Layout semantic-planning boundary: topology-changing authoring operations are pure `layout-core` planners; the editor owns interaction, preview, selection and history | **B** | A §2 — six slice occurrences P23.1→P23.6c; 41 `plan*` exports at the range end, 0 at base. B C1 | Measured at HEAD: the planners' inputs and results are operation-specific — object alignment takes compiled geometry and returns a position the editor applies, while topology planners return a replacement document. A clause prescribing one shape would describe a protocol that does not exist | One clause in `docs/reference/architecture.md`, stating the layering boundary only. **No** shared result type, base class or command framework |
| AC-2 | Wall-owned vertical authority: `Wall.height` is the only authored vertical extent, `Floor.elevation` is a datum, a Room ceiling is the derived maximum of its boundary-wall heights, new/split walls inherit height in layout-core | **B** | A §3 (`746aa16`, P23.6H/I); `layout-wall-heights.ts`; `layout-wall-first-types.ts:35-38,199-214` | Landed model is **one floor**; nothing in the code generalises to storeys, slabs or multiple levels, and the clause must not imply it does | One clause in `docs/reference/components/persistence.md`, scoped explicitly to the landed one-floor allocation |
| AC-3 | Persisted canonical curve geometry: `line`/`cubic-chain` centerline, Junction-owned endpoints, identity-bearing interior knots, positional spans, stored control points authoritative on read, stable start→end orientation | **B** | A §4 (`9118696`, P23.11); `layout-wall-first-types.ts:10-16,66-156`; codec validates `spans.length === knots.length + 1` | "Read-path authority" could be misread as forbidding rendering work. The canonical compiler samples a curve in order to draw it, and the clause must say so rather than ban it | One clause in `persistence.md`: shape, identity-bearing direction (Opening offsets measure from start) and read-path authority, with compiler sampling expressly permitted |
| AC-4 | Display identity and its persisted reference ledger / allocation cursor | **C** behavior · **D** ledger | A §5 (P23.12/P23.13); `shell.md` §Display identity (landed); `layout-wall-first-types.ts:250-297` | The user-visible contract is already landed and authoritative, so the behaviour needs no clause. The ledger holds **one shared** document-level cursor — not per-family cursors — and it is persisted and optional on read; that is representation detail | **No change, no promotion.** Elevating the ledger or its cursor is an owner decision this adjudication does not take |
| AC-5 | Junction coincidence: a draft endpoint within the identity tolerance adopts an existing Junction's stored coordinate and ID | **B** | B C2 (`d5ec0df`, `5f20aaa`, `89012d8`, `b5f75e7`); `layout-junction-identity.ts` | The *product* meaning is a live choice: exact unsnapped input can currently connect. A planned precedent may not be left open, so it is ruled rather than deferred | **Contract clause under owner ruling R1** — §3.1. Global resolution, participant-scoped retirement, snapping kept separate |
| AC-6 | New persisted fields take one of two treatments (fresh authority vs optional on read), each policy-labelled in code, chosen per field | **C** | B C3 (`d36695c` → `d41cfd5` reversal within a day; `fa50564`; `810bc8c`) | `north-star.md:1145-1160` already states the default and requires an explicit, documented product reason for an exception, so a new sentence would restate an authority that already owns the rule | **No clause** |
| AC-7 | The frozen museum relic keeps a hand-mirrored `wall-mesh-builder.ts` in lockstep with the editor | **D** | B C5; parity asserted at `layout-mesh-parity.test.ts:133-135` | The mirror predates P23 — the two files are blob-identical at base `f8411f7` **and** at HEAD — so P23 formed no new precedent, and a parity assertion already exists. The earlier claim that no parity check existed was wrong | **No change and no ratification.** Lane membership of that parity test stays a separate, owner-callable question |
| AC-8 | The app-local `$lib/layout` family gains a whole-package compatibility facade for each new core module and holds editor-only Plan tuning | **C** pattern · **D** extending it | B C6; `apps/editor/src/lib/layout/` (34 files, ~30 one-line facades); `persistence.md` | The facade pattern is already contracted as compatibility behaviour; extending it to a new module is a local implementation choice with no architectural content | **No change** |
| AC-9 | Slice-numbered diagnostics and identifiers in production and shared-package APIs (`p2311*`, `__P2311_PERF__`) | **D** | B C7 (`6b71f53`, reused by `4cae710`/`bad5e89`) | A bench/diagnostic naming accident. Existing test-contract rule 16 already prefers durable names, and production naming is a naming question, not a representation, ownership or naming precedent in the architectural sense | **No change and no A ratification** |
| AC-10 | Scene canonical and legacy shapes share one runtime type; `roomId` presence selects the coordinate frame | **C** boundary · **D** discriminator | B C4 (`41a5cde`); `persistence.md:8` CURRENT/LEGACY split | The canonical/legacy boundary is already contracted; the runtime discriminator is one local encoding of it, not a separate commitment | **No change** |

### 2.1 The capture gap is narrow, and that is the finding

The three **B** topics share one shape: each is strongly documented in code comments and slice plans
and absent from `docs/reference/*`. That is the "intended but undocumented" profile, not an
accident — so the Phase 1 response is **capture**, not detection machinery. No generalised guard,
audit or tool is justified by a documentation gap.

## 3. Owner rulings

### 3.1 R1 — commit-time Junction identity resolution (APPROVED)

The owner approved **R1** explicitly. It is capture, not new behaviour: it writes down what the
planners already do, and places the identity tolerance next to the North Star's proximity rule so
the two are read together.

```text
Resolution is global      at commit, a draft endpoint falling within the 1e-9 IDENTITY tolerance of
                          any Junction in the baseline adopts that Junction's stored coordinate and
                          its ID; connectivity follows from the committed record
Retirement is scoped      when noding meets coincident duplicate records, only those participating in
                          the committed relationship are retired in favour of the kept record; a
                          baseline already carrying two records for one node is a pre-existing
                          identity defect and a gesture must not silently rewrite it
Snapping is separate      an unaccepted snap suggestion, a hover/acquire radius and screen-space
                          proximity have no effect by themselves. What connects is the COMMITTED
                          coordinate within tolerance — so exact or near-exact unsnapped input can
                          connect, and that is stated plainly rather than implied
Core vs editor closure    the core planner closes a chain by coincidence (a final point coinciding
                          with the first), while the editor run closes it by Junction ID
                          (resolvedEndJunctionId === runStartJunctionId). Both are preserved and
                          neither is described as the other
```

Four distinctions the ruling deliberately keeps apart — conflating any two of them is the failure
mode this clause exists to prevent:

```text
(1) numerical identity tolerance   absorbs noise that cannot express a separate authored node; it is
                                   explicitly NOT a screen-space acquisition radius and NOT a
                                   geometry/intersection tolerance
(2) accepted snapping              accepting a suggestion equals reusing the winner's Junction
(3) committed Junction identity    the Junction record is the connectivity authority
(4) core vs UI chain closure       coincidence (core) vs resolved Junction ID (editor run)
```

Honest residual, recorded rather than hidden: resolution is **world-space and baseline-wide**, so an
unsnapped near-exact point can join an existing node. The scoped paragraph limits what is *retired*,
not what is *found*.

**Not approved: R2** — making an accepted snap the only way to reuse a Junction ID. It would change
product behaviour, so it is not a Phase 1 mechanism. If it is ever selected it needs an explicit
target contract **and** an owned migration of the landed commit-time behaviour; recording a future
product work item alone would not resolve the precedent that AC-5 rests on.

**Rejected: R3 — leave open.** The canonical plan does not permit a real precedent to be left
unresolved, and an unclassified open candidate cannot complete adjudication.

### 3.2 Dispositions resolved by existing evidence and authority

The owner authorized the bounded implementation direction on 2026-09-22; R1 is the explicit ruling
above, and the remaining gates are settled by evidence and by authorities that already exist. Each
is listed with the basis, so a later reader can tell a ruling from a derivation.

| Gate | Disposition | Basis |
|---|---|---|
| D1 — scope | One bounded installation PR, entered **after** the `PHASE_0_ACTIVE → ADJUDICATION` transition; installation does not claim readiness | The ADJUDICATION stage is where rulings are made, and readiness has a second step (§9) |
| D2 — classifications | AC-1/AC-2/AC-3/AC-5 **B** · AC-4/AC-6/AC-8/AC-10 **C/D** · AC-7/AC-9 **D** | §2; each counterevidence column |
| D3 — clause wording | M1–M4 exactly as installed, verified against source at HEAD before promotion | §8 of the installation plan; verified in this PR |
| D4 — new persisted fields | **No clause** | `north-star.md:1145-1160` already owns the default and the exception requirement |
| D5 — Scene, mirror, diagnostics | No clauses and no A ratification | `persistence.md:8` already owns the boundary; parity already asserted; naming is not architecture |
| D6 — junctions | **R1** | §3.1 — owner ruling |
| D7 — workflow lane | No custom tool and no `ARCH_FILES` change; one bounded guard correction | §6 — corrections in range already addressed the demonstrated misses |
| D8 — lifecycle and window | **P26** is the selected window; P23B closes without changing the stage; installed and ready are distinct; the window closes on both close paths; `STEADY` needs window closure **and** verdicts | Canonical §10 and the live cycle's own early-Phase-3 rule |
| D9 — machine doc check | Declined | No existing test reads repository docs; adding one would be a new mechanism the evidence does not justify |
| D10 — direct `STEADY` | Retained and unmodified | Canonical §8 already permits `ADJUDICATION → STEADY` when neither lane justifies a mechanism |

The four choices that genuinely required the owner were the **Layout planner boundary**, **which
landed Wall representation facts become durable**, **junction-coincidence semantics** and **P26 as
the window**. Everything else above followed from evidence or from an authority that already owned
the rule.

## 4. Historical written-rule contradictions — recorded separately

These are text contradictions found during retrospective reading, **not** architecture candidates.
None is a Phase 1 mechanism, and none enters A/B/C/D.

| Contradiction | Text vs change | Status |
|---|---|---|
| X1 — the persistence contract said "no version field, no migrations" while wall-first `formatVersion`, migration and Scene `formatVersion: 1` were live (09-09 → 09-17) | the persistence contract (identical at `f8411f7`, `41a5cde`, `d41cfd5`, `810bc8c`, `368a799`) vs `13a96a0`, `41a5cde`, `d36695c`/`d41cfd5` | **Resolved inside the frozen range** by `650f7c1` (09-18) |
| X2 — the agent hard rules named superseded sources of truth while P23.0 changed them (09-09 → 09-17) | `AGENTS.md` (last changed 08-30) vs the P23.0 cutover | **Resolved inside the frozen range** by `650f7c1`. Caveat kept: the rules were already contradicted at `f8411f7`, so P23 widened a pre-existing drift |
| X3 — P23.0's cutover crossed the then-written Scene source-of-truth and visitor-gating rules | A §6 (`41a5cde`, `b5427d8`, `2c9b04d`, `32b2e8f`) vs the same hard rules | **Resolved inside the frozen range** by `650f7c1`; the direction itself was covered by the ratified North Star and the active staged-rollout plans |

**Historical authority caveat (load-bearing).** Until `f7a31e2` (09-19), the documentation-precedence
rule placed "source code + tests" first *when live docs conflicted*. That helps interpret X1 but does
**not** override the agent file's express precedence for its own hard rules. X2 and X3 remained
hard-rule contradictions until `650f7c1` repaired the text. The ratified North Star and the active
staged-rollout plans establish the intended direction — not authorization from the precedence rule to
ignore the interim contradiction. The contradiction and its in-range repair are carried forward
**without** claiming precedence resolved it.

Considered and **not** established: visitor isolation vs the `layout-core` barrel (no chunk build was
performed); museum "frozen"/"read-only" vs source edits; the geometry boundary vs snap CSS-pixel
parameters and dev-gated perf marks; test-contract rule 16 vs production code (out of its stated
scope). Recorded, not resolved — no Phase 1 change either way.

## 5. Evidence-reading notes and errata

How to read the frozen outputs, plus the corrections this adjudication owes them. Nothing here edits
a frozen file.

```text
E1  Units  Reviewer A and Reviewer B agree on the planner count in magnitude (41 exports), which is
           independently reproduced at HEAD. Their module lists differ only because A counts modules
           and B counts landing commits.
E2  Measure Reviewer B's caller figure is a PER-SYMBOL probe over 41 named `plan*` exports, and its
           finding is one named non-editor caller. It is not a whole-package import measure, so
           whole-package museum imports and an API type import do not refute it. An earlier erratum in
           the installation plan asserted the opposite and is WITHDRAWN here.
E3  Direction Both semantic reviews and the workflow diagnostic are frozen and published together,
           after both reviews were complete, per the workspace embargo. Their independence is a
           property of how they were run; this record does not re-open it.
E4  Range  `650f7c1` (#59, 09-18) is INSIDE the frozen range (`git merge-base --is-ancestor
           650f7c1 b5f75e7`), which is why §4 records the contradictions as repaired in range rather
           than as open debts.
E5  Ledger The persisted reference ledger holds ONE shared document-level cursor, not per-family
           cursors. A frozen-output description that said otherwise is corrected here; the
           classification is unaffected (AC-4 stays C/D).
E6  Machine The mechanical-pass defects corrected by `722280f` are pre-Phase-1 history, and
           `structural-workflow.md` §7.4 already labels them out-of-range context. No classification
           depends on an uncorrected number from that pass.
E7  Mirror The relic mirror IS parity-asserted (`layout-mesh-parity.test.ts:133-135`) and predates
           the range. Any reading of AC-7 as a P23 precedent is unsupported.
```

## 6. Structural-workflow lane — separate question, separate disposition

The workflow lane asks whether scoped agents failed to inspect or verify downstream impact, and
whether existing tooling would materially help. It is **not** a third architecture reviewer, and its
disposition does not depend on the architecture lane's.

| # | Finding | Disposition |
|---|---|---|
| WF-1 | The recurring question shape "which members of this set must change?" over surfaces the change itself named; six of ten demonstrated misses were answerable with installed tooling and were not answered | **Existing-tool/workflow correction — already applied in range. No new mechanism.** Landed as verification discipline plus the test-contract rules (`38c5701`) |
| WF-2 | Checks that ran, reported clean, and were structurally blind or self-certifying | **Existing-tool/workflow correction — already applied. No new mechanism** — no persistent graph, index or custom platform |
| WF-3 | The Navigator document-replacement seam guard — the one candidate where installed tools structurally cannot answer the question | **Bounded correction** (the installation plan's §5). Suspected, not demonstrated: no in-range instance slipped past it |
| WF-4 | Navigation capability itself | **No gap** — the read-side questions were answerable and were answered; cost-only observations do not establish a gap |

**Lane outcome: no custom tool, no index, no recurring audit, and no speculative guard.** The lane
contributes one bounded test correction; if the owner later declines even that, the lane contributes
nothing and that remains a valid outcome, because the architecture lane independently justifies
capture through AC-1/AC-2/AC-3/AC-5.

## 7. Deliberately not installed

```text
no generic command framework, planner base class or shared plan-result shape        (AC-1)
no multi-level / storey / slab vertical model                                       (AC-2)
no prohibition on the compiler sampling a curve to render it                        (AC-3)
no promotion of the identity ledger or its single cursor                            (AC-4)
no clause for field evolution, facades, the relic mirror, diagnostic naming or the
   Scene dual shape                                                                 (AC-6…AC-10)
no repository graph, persistent index, dependency tool, CI job or new script         (WF-1, WF-2)
no recurring semantic review, standing audit, dashboard or process tier
no ARCH_FILES / lane-membership change
no product behaviour, schema, persisted-format, route or capability change
no R2 junction behaviour change — it would need its own contract and migration
```

## 8. Integration provenance

```text
integrated    2026-09-22 — the three evidence outputs were merged into `main` on explicit owner
              authorization, verbatim, after all three were frozen:
                review-a.md              PR #77 — merge commit aee8ba4
                review-b.md              PR #78 — merge commit f809261
                structural-workflow.md   PR #79 — merge commit 1b8cc4b
              each merge added exactly its one file (178 / 680 / 821 insertions, no deletions) and
              the blobs on `main` are identical to the frozen branch blobs
              mechanical-control-pass.md was already on `main` (#76, 722280f)
cycle         this record exists inside the ADJUDICATION stage; the stage transition itself is
              recorded in the cycle file, and the installation that follows it records the single
              overall transition (PHASE_1) — see the installation plan §11 (E1, S5)
authority     no second tracker, evidence registry or standing audit is created by this record
```

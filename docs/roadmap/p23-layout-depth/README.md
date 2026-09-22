# P23 — Layout Depth

**Phase goal:** credible wall-first architectural Plan editor: first-class
Junctions/Walls/Wall-hosted Openings, `boundary | partition` semantics, robust
straight-wall topology, persistent Room correspondence, explicit Layout/Scene
compatibility, trustworthy legacy conversion, project/world-local Scene/Camera
placement, compiler/query/adapter cutover, then precise dimensions, deterministic
snapping, continuous sketching, openings, duplicate/presets, direct manipulation,
bounded curved-Wall authoring, stable display identity, Plan/shell finish and
junction-correct wall-first 3D.

**Phase invariants:** one `LayoutDocument` → `compileLayoutGeometry()` → Plan/3D/visitor
authority; Layout and Scene ownership separate; one camera graph/route/motion;
wall-first Junction/Wall/Opening ownership with persistent semantic Rooms.

```text
STATUS: in-progress
STAGE: P23.15 closed (accepted 2026-09-21); P23.16 verification plan written — owner review pending
CURRENT: P23.16 — Final whole-product integration and P23 closeout gate (plan awaiting review; no QA run)
NEXT: owner reviews the P23.16 verification plan, then QA executes; satisfying its exit criteria makes
      P23 CLOSABLE, not closed
GATE: P23.16 closeout gate below; P24 implementation waits for accepted P23 minimum + approval
```

```text
FINAL PHASE GATE: P23.16 — Final whole-product integration and P23 closeout gate
  (On-demand — final closeout. Startup keeps only the safety rule: satisfying
  the exit criteria makes P23 CLOSABLE, not closed.)
  gate artifact → 2026-09-08-P23.16-final-whole-product-integration-closeout.md
  satisfying its exit criteria makes P23 CLOSABLE, not closed.
  CLOSED requires an explicit owner request and ruling; closure then runs the owner-invoked
  phase-closeout procedure, which updates P-level status/baton and runs the close preflight.
  For P23 the cycle is WAITING, so the preflight's target is PHASE_0_DUE; the target is computed,
  never assumed.
  Landed P23 slice plans are evidence; they are not active instructions (see "Completed slices").
```

```text
ROUTE (active child P23.16 — direct; no intermediate slice router):
verification plan (awaiting owner review) →
  p23.16-whole-product-integration-closeout/2026-09-22-P23.16-verification-plan.md
gate artifact (exit criteria, authoritative scope) →
  2026-09-08-P23.16-final-whole-product-integration-closeout.md
remaining scope → 2026-09-14-P23-remaining-roadmap-reconciliation.md §P23.16
dependencies → every P23 slice through P23.15 (P23.15 accepted 2026-09-21, PR #72)
shell grammar (any UI P23.16 touches enters through it) →
  ../../reference/design-system/editor-shell-and-visual-system.md
closed slice, evidence only → p23.14-shell-visual-system/ (stubs) +
  ../../archive/roadmap/p23/p23.14-shell-visual-system/ (bundle copies)
closed slice, evidence only → p23.15-junction-correct-wall-first-3d/ (stubs; plan, QA record and
  research are single prose artifacts, so no archive copy)
```

**Startup stop:** an implementation-start agent has what it needs once phase
status, current/next child, the exact route, invariants and authorities above
are read — unless a contradiction requires deeper context. Gate and closeout
detail in this file is on-demand.

## Authorities

- Umbrella: [`2026-09-07-P23-layout-depth-minimum-build.md`](./2026-09-07-P23-layout-depth-minimum-build.md)
- Cross-view direction: [`2026-09-09-P23-P24-unified-plan-3d-authoring-addendum.md`](./2026-09-09-P23-P24-unified-plan-3d-authoring-addendum.md)
- **Shell design — durable authority:**
  [`../../reference/design-system/editor-shell-and-visual-system.md`](../../reference/design-system/editor-shell-and-visual-system.md),
  whose §0.1 states the authority graph, §0.2 records the owner ratifications (R1–R4), §0.3
  keeps the open owner calls unresolved even after P23.14 closed, and §0.6 records the
  authority migration. It is slice-independent: the slice-local design direction is promoted
  there and is now closed work. This shell grammar is the **stable baseline later phases fit
  into and depend on**: P23.15, P23.16, P24 and P26 enter through it rather than re-deciding
  shell composition, material, type or state language. Evidence annexes (evidence, not
  authority): [`editor-shell-ratifications.md`](../../reference/design-system/editor-shell-ratifications.md)
  and [`editor-shell-atlas/`](../../reference/design-system/editor-shell-atlas/index.html).
  P23.14's acceptance record is its QA stub at
  [`p23.14-shell-visual-system/qa/`](./p23.14-shell-visual-system/qa/2026-09-19-P23.14-shell-qa-record.md)
  (full body via the anchor inside it). Pre-PLATE shell numbers — the
  `docs/reference/design-system/*` shell-placement/type/control tables and
  `design-plan-p21.md`'s 32 px ribbon — are **superseded for the shell** and carry header
  notes saying so; `docs/reference/design-system/*` and `docs/reference/components/shell.md`
  remain canonical for capability, ownership, exposure and the frozen Plan/identity/icon
  contracts, and are descriptive only for shell placement, dimension and type.

## Completed slices

P23.0, P23.8, P23.1–P23.6e, P23.9 (+regression), P23.10, P23.11, P23.12, P23.13,
**P23.14** (shell visual system; accepted 2026-09-21 — implementation PR #61, closeout PR #71),
**P23.15** (junction-correct wall-first 3D; accepted 2026-09-21 — PR #72 carries plan,
implementation and closeout on one branch and landed by **rebase** under an owner decision
(2026-09-22), so the pushed tag `closed/p23.15` is the recovery form for its three closeout
anchors rather than an `main`-ancestry fallback),
plus the concurrent Junction-dissolve / Wall join child slice (PR #57, no tracker
P-number; its Inspector/Navigator-row/Plan-menu entry points landed in P23.14).
Flat `P23.x` plan docs in this folder are legacy/grandfathered only
(pre-migration shipped slices); do not add new slice-specific plans here — active slice
plans/artifacts live in that slice's workspace, and this phase README routes the exact
plan path.

Landed P23 slice plans below are historical evidence (each carries its own Status line);
they are not current instructions, and their full bodies become compact stubs at P23 close.

Carried rows: P23.13 carried four rows into P23.14 by owner ruling (Task 5's two behaviour
rows — opening-insert commit, undo-with-field-open cancel — the Task 8 coarse-pointer pass,
and locked Decision 7 on the wall-first Room rotation handle). Task 8's coarse-pointer row and
Decision 7 are recorded as landed in the QA closeout; **the two Task 5 behaviour rows are not
separately re-verified there**, so treat them as owed if a later slice depends on them.
P23.14 leaves no new carried rows: its residuals are held in its QA closeout record — TD-2
(Inspector numeric `:invalid`), the manual-owed accessibility rows, the Inspector
role-migration residue, the §0.3 open owner calls, and the two unverified Task 5 rows above.
They are not P23.15 scope unless P23.15 touches the surface; they route to their owners.
P23.15 adds J1–J9: by owner decision (2026-09-22) the visual half of each is owner-carried to
P23.16 rather than blocking PR #72's merge, and no interactive session was run at closeout — so all
nine rows are owed, not claimed. P23.16's whole-product integration pass is their natural verifier.
**P23.16 QA executed 2026-09-22**
([record](./p23.16-whole-product-integration-closeout/qa/2026-09-22-P23.16-qa-gate-record.md)):
all nine J-rows remain **owed** — they need nine purpose-built junction fixtures plus the published
visitor half — with the same single owner action (a signed-in publish session). The carried P23.13
Task 5 rows and the P23.14 accessibility rows are resolved or re-recorded there: opening-insert on
click passes live; the undo-while-a-field-is-open row RE-CONFIRMS the P23.13 owner decision
(display-only, commit honest) rather than a cancel; the reference capture is taken, the
screen-reader and device rows stay owed. The legacy relic smoke is **waived by owner decision**
(frozen relics, no active maintenance).
Incremental Junction invalidation stays an accepted non-goal (Decision 13), not a carried row.

Issue re-dispositions by owner ruling (2026-09-22), landed with the P23.16 gate: **#35** (canonical
axis tokens in number fields) was not landed by P23.14, so it left the P23 prerequisite list and was
recorded as **TD-3** in [`../../operations/tech-debt/README.md`](../../operations/tech-debt/README.md);
the owner then amended it back into P23.16 as a bounded correction, and it was delivered (`be4e23b`)
with the gate's A12 promoted from baseline audit to required-pass regression check. **#6** (legacy
Bézier commit/render gap) is closed and re-disposed to post-P23 legacy-stack retirement (#26), which
owns the path it describes. The authoritative disposition table is the reconciliation §Issue
disposition; with both ruled, no prerequisite P23 issue remains open, which is what the P23.16
plan's E7 row records.

(On-demand — closeout mechanics; read at slice closeout, not at slice start.)
All new slice closeouts leave closed artifacts as path-preserving stubs holding a
`git show <A>:<path>` recovery line, with an archive copy only for **renderable evidence** —
PNG/SVG/HTML atlases, screenshots, plates, measurements (mechanics: `slice-closeout`). This is
OD-4's hybrid mechanism with its archive-copy scope narrowed by owner ruling 2026-09-22, from
"multi-file bundles and non-text evidence" — a scope that had swept prose directories in with the
evidence. The superseded wording is kept in the operating-cycle harvest §7.2. P23.14 is the first slice closed under the
hybrid rule: 11 prose artifacts stubbed at their own paths, its renderable evidence
(screenshots, atlas HTML, proposal plates) copied to
`docs/archive/roadmap/p23/p23.14-shell-visual-system/`. P23.15 is the first slice whose
plan, implementation and closeout share one branch (P1): its three prose artifacts are stubs with
`git show <A>:<path>` anchors (no archive copy), tagged `closed/p23.15` so they stay reachable
even if the branch is rewritten.

First use of the durable-anchor tag convention (`slice-closeout`): **`closed/p23.15`** — an annotated
tag over the QA-record anchor `1f1d265` (all three P23.15 anchors are its ancestors), created and
**pushed to `origin`** 2026-09-22. Naming: `closed/<slice-id>` for a slice, `closed/<phase>` for a
phase close. Shipped narrative for
P23.13 lives in `docs/archive/plans/`.

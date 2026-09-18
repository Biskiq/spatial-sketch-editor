# Plan tracker — single source of truth for plan status

**Created:** 2026-08-18 · **Pruned:** 2026-09-05 (owner decision: shipped
history lives on disk under `docs/archive/plans/`, not in this file).
**Status enum:** `proposed | approved | in-progress | shipped | archived`.
The tracker is authoritative when a plan doc's `**Status:**` drifts.

**Active P23/P24 direction:** [Unified Plan / 3D authoring addendum](2026-09-09-P23-P24-unified-plan-3d-authoring-addendum.md) (ratified 2026-09-09; existing statuses and gates unchanged). Pascal direct-reference harvest is closed; [P24 reconciliation sequence](2026-09-09-P24-reconciliation-sequence.md) is the active P24 planning route.

## Rules

1. **One flat namespace.** New top-level plans are
   `docs/plans/YYYY-MM-DD-P<number>-<slug>.md` — the P-number is assigned on
   registration and written into the filename (e.g.
   `2026-08-18-P1-camera-overhaul.md`). No letter codes beyond the P-number.
   **Child-plan exception (2026-09-08):** child slice plans and umbrella-internal
   annexes may use parent-derived IDs — `P23.0`–`P23.9` style names and
   `P24A`-style labels — without consuming tracker P-numbers; only umbrella/
   top-level roadmap plans are registered in the Active table with a P-number.
2. **Numbers live in filenames and this tracker.** Sequential numbers
   (`P1`, `P2`, …) are assigned on registration and carried in the filename;
   this tracker is the register that owns them (status, depends-on, order)
   and never renumbers files. The renewal that created the tracker is an
   **unnumbered process row** (a tracker cannot number its own bootstrap).
3. **Dependencies by tracker number**, never by letter family.
4. **Archive on close.** When a plan ships, its doc moves to
   `docs/archive/plans/` and this tracker lists stubs for the **5 most recent
   archived artifacts only** (see `Archived plans`). Older history stays on
   disk, unlisted (owner decision 2026-09-05).
5. **Re-registration, not re-lettering.** Approved-but-unscheduled work keeps
   its content and gains a tracker number; that content lives **folded into
   the plan's umbrella doc**. Only shipped/superseded docs archive.
6. Execution order is **pinned in the table's depends-on column**, not implied
   by the numbers (registration order ≠ priority).
7. **No narrative in this tracker.** Rows and stubs stay one line each;
   shipped detail lives in the plan doc (archived on close), never here.
8. **Collapse on ship.** Archiving a doc and collapsing its Active row happen
   in the same edit — shipped rows never linger in the table.

### Development compatibility policy

Museum Editor is **pre-Compatibility-Baseline**. Superseded development schemas and saved development data are disposable unless a plan explicitly identifies an external durability requirement.

Therefore, plans and implementation agents must default to the **current canonical schema only**. Do not add or preserve migrations, historical decoders, multi-version canonical types, or compatibility-only runtime paths merely because an older development revision existed. **A schema having shipped, or having existed on `main`, does not by itself create a compatibility obligation before the baseline.**

If compatibility is genuinely required, the owning plan must name the durable consumer and acceptance criterion explicitly.

```text
LEGACY ADAPTER EXISTS
≠
LEGACY FORMAT IS A SUPPORTED PRODUCT CONTRACT
```

An adapter retained for internal demo content, benchmark fixtures or another not-yet-migrated internal asset is a temporary development dependency with a planned removal path — not a promise that the old format keeps loading. Such a dependency must be documented as temporary where it is introduced, and removing it is its own slice.

See `docs/north-star.md` → **Development-stage schema compatibility** for the normative policy.


## Progressive planning model (2026-09-08)

Roadmap tiers follow one structure — umbrella plan → targeted research / code
harvest / technical spike **where required** → implementation-ready child
slice plan → implementation:

- **Umbrella plans** define the durable product contract, architecture
  boundaries, slice order and evidence gates (WHAT/WHY/BOUNDARIES/ORDER/
  RESEARCH GATES/high-level acceptance).
- **Evidence artifacts** (code harvest, product/UX research, technical spike,
  feasibility investigation) answer what was learned; they inform
  implementation but never silently override umbrella product/architecture
  contracts — conflicts go to owner review.
- **Child slice plans** carry implementation detail. Existing implementation
  detail is preserved in child-plan seeds rather than discarded. Only
  implementation-ready child plans may proceed to implementation.

Evidence selection: do not reopen broad research when prior discovery already
selected the relevant references — use bounded capability-specific
harvest/recheck work. Do not impose research on slices whose implementation
uncertainty is already sufficiently resolved.

Maximum planning chain (avoid bureaucracy): umbrella → evidence artifact, only
if required → implementation-ready child plan → implementation. A child seed is
the preserved draft form of the future child plan, not an extra layer.

Child-plan status vocabulary (a child plan existing ≠ implementation-ready):

```text
seed — pre-evidence
seed — evidence pending
evidence complete — reconciliation pending
implementation-ready
in progress
shipped / archived
```

Applied: P23 umbrella with P23.0–P23.6e, P23.10, P23.11, P23.12 and P23.13 landed; the
remaining sequence is P23.14–P23.15 → P23.16, and no remaining child plan is
implementation-ready (P23.13 merged 2026-09-17, PR #58, with S7's three rows carried to
P23.14, plus the selected-Room rotation row the post-PR review added). **P23.14 was
re-scoped by owner review (2026-09-17) from *Build shell, Navigator and Inspector finish*
to *Editor Shell & Visual System Foundation* — the visual-system slice whose grammar
P23.15/P24/P26 are expected to extend. Its slice context is
`docs/design/P23.14-shell-design-context.md`; the re-scope is recorded in the
[remaining roadmap](2026-09-14-P23-remaining-roadmap-reconciliation.md) §P23.14.** One
further concurrent P23 child slice **shipped** — Junction dissolve / Wall join,
**merged through PR #57** (`2716f61`, implementation `e43ecf4`, 2026-09-17),
`docs/plans/2026-09-17-P23-junction-dissolve-wall-join.md`. It consumed **no tracker
P-number** (Rule 1's child-plan exception), its Inspector / Navigator-row / Plan-menu entry
points are deferred to P23.14, and its live file is listed under *pending archival* below.
Completed H1/H2/H3/H5 and the existing curve machinery
inform the bounded P23.11 curve slice; no broad research gate is implied. The
completed Pascal harvest is optional bounded evidence, not an execution gate.
P24 umbrella has the P24A annex at `minimum frozen — implementation pending` after R9 closed 2026-09-10, plus the completed
[P24 reconciliation sequence](2026-09-09-P24-reconciliation-sequence.md);
Pascal direct-reference evidence is closed and P24 may reconcile in parallel
with P23, while P24 implementation remains dependent on the accepted P23
minimum. P25 focused research now closes E1–E4 product semantics and the main
E5 authoring direction; P25.x child plans still wait for targeted E0 post-F0/
P24 seam rechecks, E5 reference-integrity reconciliation and E6 persistence/
operations closure.

## Model routing

Per-increment difficulty (1–100) and model routing live in the living
assessment doc — [`model-assessment.md`](model-assessment.md) — not in this
tracker. Update it as increments ship.
Policy rules:

- **DeepSeek V4 Flash substitution (2026-08-20):** Luna max ≈ DeepSeek V4
  Flash. Any increment rated at **Luna difficulty (any effort)** routes to
  **DeepSeek V4 Flash** — the Luna effort is retained as the capability
  reference, not replaced. Sol tiers unchanged.
- **Never route to Terra (all efforts) or Sol low** — dominated points on the
  cost/intelligence frontier.
- **Escalate by evidence, not habit:** start at the cheapest tier clearing the
  required index; escalate one tier on a demonstrated capability failure,
  sending the stronger model the original failure state (not a summary).
- **Margin** = chosen tier index − required index. Margin 0 → escalate on
  first failure; don't pre-pay.
- Adjacent tiers differ 2–8% capability for 1.3–2.6× per-task cost — pay the
  jump only when the threshold matters.

## Active (live work only)

| # | Plan | Status | Depends on | Doc |
|---|------|--------|------------|-----|
| P13 | Sequence stop-at-node playback | proposed — nice-to-have, unscheduled (owner 2026-08-27) | P12 | [2026-08-27-P13-stop-at-node-playback.md](2026-08-27-P13-stop-at-node-playback.md) |
| P23 | Layout Depth — credible wall-first architectural Plan editor | active — P23.0/P23.8 and P23.1–P23.6e merged on `main` through PR #47; PR #48 merged the independent wall-engine split; P23.10 landed through PR #49, PR #50/#53 landed endpoint-noding hardening and transient direct-manipulation preview, and **P23.11 merged through PR #51** (`9118696`, 2026-09-15); remaining sequence is **P23.13 → P23.14 (now *Editor Shell & Visual System Foundation*, re-scoped 2026-09-17) → P23.15 → P23.16 final closeout**, with **P23.12 merged through PR #55** (`f3efed9`, 2026-09-15, S1–S8) plus the PR #56 anchor-release fix (`8a5a87f`); **P23.13 merged through PR #58** (`368a799`, 2026-09-17; S0–S10 across `27372a0`/`619d6ce`/`4904eb0`/`43931d2` plus the post-PR review fix), and the concurrent **Junction dissolve / Wall join child slice merged through PR #57** (`2716f61`, `e43ecf4`, 2026-09-17) — **`main` @ `5cfe4d0` is stable with all P23 work to date merged** | P22 | [remaining roadmap](2026-09-14-P23-remaining-roadmap-reconciliation.md) · [P23.12 plan](2026-09-15-P23.12-names-and-stable-display-identity.md) · [umbrella](2026-09-07-P23-layout-depth-minimum-build.md) |
| P24 | Scene / Staging Depth — P24A supply + P24B authoring | proposed — **R0–R9 planning complete; minimum frozen; P24.0–P24.5 implementation-ready for owner review.** Execution waits for accepted P23 minimum and approval; implementation/ship gates open. | P23 | [freeze](2026-09-10-P24-R9-minimum-freeze.md) · [child briefs](2026-09-10-P24-minimum-child-plans.md) · [umbrella](2026-09-08-P24-scene-staging-depth-umbrella.md) · [annex](2026-09-08-P24A-asset-supply-canonical-ingest-annex.md) |
| P25 | Experience Foundation umbrella | proposed — focused research reconciled 2026-09-09: Destination + guided Stop/occurrence + Content/Info Panel + bounded Interaction + visitor/a11y product semantics closed; implementation remains blocked on targeted post-F0/P24 seam rechecks, E5 reference integrity and E6 persistence/operations; no P25.x implementation-ready child plans yet | P24 | [umbrella](2026-09-08-P25-experience-foundation-umbrella.md) |
| — | Branch rejoin — experiment, no schedule | proposed | P8 conceptually | [2026-08-21-branch-rejoin-experiment.md](2026-08-21-branch-rejoin-experiment.md) |
| … | future work re-registers here | | | |

**Pending archival (live files for shipped work — not tracked rows; owner follow-up):**

- Shipped 2026-09-17: the concurrent P23 child slice
  [`2026-09-17-P23-junction-dissolve-wall-join.md`](2026-09-17-P23-junction-dissolve-wall-join.md)
  (Junction dissolve / Wall join, merged through PR #57 `2716f61`; carries no tracker
  number per the child-plan exception). The live file has **not** been moved to
  `docs/archive/plans/` yet.
- Done 2026-09-05: P7 umbrella + P7.6 annex + P8 umbrella moved to
  `docs/archive/plans/` (moved as a set — the annex link at umbrella `:1179`
  is relative and survives); byte-identical P11.2 annex deleted (archive holds
  the copy); 0-byte P12.2 live husk deleted (archive holds the content).
- Reconcile-then-delete (live copy has **diverged** from the archived copy —
  diff before dropping either side): `2026-08-18-P1-camera-overhaul.md`.
  Done 2026-09-08 (P22 closeout cleanup): reconciled — the archived copy holds
  the evolved record (review amendments F1–F7, shipped status, compressed §D);
  the live copy's 366 diverged lines were all pre-review text §D/F2 had
  replaced with pointers. Live husk deleted; archive copy is canonical.
  Also removed the `2026-08-29-backend-persistence-migration-review.md`
  pointer husk (archive copy confirmed present, zero live inbound links).
- Done 2026-09-05: `hand-off/designer-context-packet.md` moved to
  `docs/archive/designer-context-packet-2026-09-03.md` (one-off 2026-09-03
  packet; its output already landed as the P21.5 brief; `hand-off/` holds
  `CURRENT.md` only per the folder map).
- Done 2026-09-05: superseded `Design-specs/Camera-plan-objects-brief.md`
  moved to `docs/archive/plans/`, stub left behind pointing at frozen
  `Camera-layout-design.md`.
- Done 2026-09-08: P19 umbrella + P19.4 annex, P20 umbrella + S2/S3/S4 briefs,
  and the P21 set (umbrella + P21.4 + P21.5 + P21.6 + slice-2B annex) moved to
  `docs/archive/plans/` as sets at P21 closeout (cross-links survive — each
  set's relative links stay inside the set, same as the P7 precedent).

### P24 minimum child execution register (2026-09-10)

All rows are implementation-ready **briefs for owner review**, not approved execution or shipped capability. P24 remains proposed. Details and exact gates: [child briefs](2026-09-10-P24-minimum-child-plans.md); inclusion authority: [R9](2026-09-10-P24-R9-minimum-freeze.md).

| Child | Outcome | Depends on | Status |
|---|---|---|---|
| P24.0 | Canonical Stage reachability/cancellation | Accepted P23 minimum + P24 approval | ready brief; execution blocked |
| P24.1 | Static proof supply and retained source authority | P24.0 | ready brief; dependency blocked |
| P24.2 | Shared floor placement and transform correctness | P24.1 | ready brief; dependency blocked |
| P24.3 | Bounded material authoring | P24.2 | ready brief; dependency blocked |
| P24.4 | Authored lights/environment/Gallery reset | P24.3 | ready brief; dependency blocked |
| P24.5 | Combined minimum acceptance | P24.0–P24.4 | ready brief; dependency blocked |

P24.5 acceptance clears only P25's P24 dependency; P25 E5/E6 and its other gates remain. Catalogue/arrangement/renderer and other R9 depth tails never block that handoff. Earlier roadmap narrative is historical planning context where it says minimum inclusion is pending.

## Gate status

Ship narrative for P1–P21 (execution order, scope decisions, the P12/P3B hard
gate) now lives in the archived docs, not here.

- Next: P23.0/P23.8, P23.1–P23.6e and P23.10 are merged on `main`; P23.6e
  landed through PR #47 (`80ea541`), the independent wall-engine split through
  PR #48 (`86027a7`), P23.10 direct Wall/Junction editing through PR #49, PR #50
  landed endpoint-noding hardening and PR #53 the transient
  direct-manipulation preview, and **P23.11 (canonical curved Walls) merged
  through PR #51 (`9118696`, 2026-09-15)**. The revised good-enough architectural
  Plan-editor boundary is recorded by the [remaining P23 roadmap](2026-09-14-P23-remaining-roadmap-reconciliation.md).
  **P23.12 (names and stable display identity) merged through PR #55**
  (`f3efed9`, 2026-09-15, S1–S8); the PR #56 anchor-release fix (`8a5a87f`)
  and the PR #54 text-selection/fast-drag fix (`45187ab`) are also on `main`.
  The plan text records the implementation status
  ([names and stable display identity](2026-09-15-P23.12-names-and-stable-display-identity.md),
  which ratifies the compact-reference mechanism, resolves the Undo-branching
  reference-reuse blocker with a mark held outside the history snapshot, makes
  transient/rejected/cancelled derivation allocation-free with a per-operation
  latched allocation base, and promotes before every persistence seam — cloud Save,
  resumed save and the Layout **Copy JSON / Download JSON** exports — so no saved or
  exported payload can sit below the session mark). **P23.13 (Architectural Plan
  drafting finish) merged through PR #58** (`368a799`, 2026-09-17) — S0–S10
  landed across `27372a0` (S9 step 1), `619d6ce` (S9 steps 2–4: empty/dense
  states, the icon family under the 2026-09-17 ruling, the seven surrounds),
  `4904eb0` (S10 steps 1–2: control-group keyboard traversal and announcements,
  the thin-wall pins, D5), `43931d2` (the driven acceptance pass and the
  spec-vs-atlas sweep) and the post-PR review-fix commit (the announcement's
  missing value+units per §9, arrow keys no longer entering the control group
  without Enter, the readout released with its focus, and two record
  corrections). **Gate: 4362 passed / 1 skipped, `svelte-check` 0/0,
  `check:layout-core` clean**, and `619d6ce` was verified **standalone** at 4333
  passed with the S10 half held aside, so every commit on the branch is green.
  Both open owner decisions are ruled — **D5** names `layout-core` as the
  extension-guide predicate's owner (deferred, guide-less close) and the
  S9-step-1 Scene-ink eyeball is accepted pinned-not-looked-at. P23.13 closes
  carrying four rows by owner ruling: S7's three (the Opening-insert gesture, the
  undo-while-the-field-is-open display question, the coarse-pointer visual pass,
  with the 44 px coarse target as P23.14's to meet) plus the **selected Room's
  rotation handle** (painted and draggable, no keyboard path, a silent no-op drag
  in wall-first documents) added by the post-PR review. Then
  P23.14 → P23.15 → P23.16 final closeout remain child-plan-pending. P24 remains blocked on accepted P23
  completion.
- Long-term tiers renumbered 2026-09-05 (owner): P23 Layout Depth, P24
  Scene/Staging Depth, P25 Experience Foundation, P26+ platform expansion;
  typed DB is conditional infrastructure, not a tier. Owner reconciliation
  2026-09-06: P23/P24 are staged (minimum useful slices first, optional
  depth tails later); P25 may follow the minima before the tails; a bounded
  agent/reuse proof follows the first complete visitor-authoring slice. P24
  umbrella registered 2026-09-08 with internal P24A asset-supply/canonical-
  ingest and P24B Rich Scene / Staging Authoring subtracks. Phase 2 was reviewed
  2026-09-08 and the detailed P24A annex is registered; Phase 4 compact research
  is reviewed directionally, and the Pascal direct-reference harvest is now
  closed. The active [P24 reconciliation sequence](2026-09-09-P24-reconciliation-sequence.md)
  runs current-code maturity audit → cross-view placement/selection contract →
  transform/material/light/environment reconciliation → B6 minimum freeze.
  P24 planning may run in parallel with P23, but P24 implementation remains
  dependent on P23 and any seam changed by F0 receives a targeted post-F0 recheck
  before implementation-ready child plans freeze. P25 focused research was
  reconciled into the umbrella 2026-09-09: E1–E4 product semantics and E5
  authoring direction are closed; P25 remains research/reconciliation only until
  targeted E0 seam rechecks, E5 reference integrity and E6 close. See Long-term roadmap.
- Deferred / non-blocking: P3B.7b (incl. the P3.4/P3.5 acceptance tail).
- Proposed / unscheduled: P13, branch rejoin.
- Shipped baseline: P12 + core P3B gate 2026-08-28; P14–P18 extraction slice;
  P19 live smoke 2026-09-03; P20 local-vs-R2 smoke 2026-09-04
  (production-topology smoke deferred); P21 acceptance gate 2026-09-08.

## Archived plans (recent 5 only)

- `archived → [2026-09-16-P23.13-architectural-plan-drafting-finish.md](../archive/plans/2026-09-16-P23.13-architectural-plan-drafting-finish.md)` (shipped 2026-09-17 — S0–S10: wall/opening/room/label/state/snap/dimension/preview ink, keyboard and announcements, icons, empty/dense and seven-surround QA; D1–D5 ruled; carries S7's three rows to P23.14 plus the selected-Room rotation row found by the PR review)
- `archived → [2026-09-07-P22-basic-publish-visitor-runtime.md](../archive/plans/2026-09-07-P22-basic-publish-visitor-runtime.md)` (shipped 2026-09-08 — P22.1–P22.5 + hosted acceptance incl. public-route untrack fix)
- `archived → [2026-09-04-P21-unified-project-shell-spatial-reconciliation.md](../archive/plans/2026-09-04-P21-unified-project-shell-spatial-reconciliation.md)` (shipped 2026-09-08 — P21.1–P21.6 + final acceptance gate; set includes P21.4, P21.5, P21.6, slice-2B annex)
- `archived → [2026-08-19-P20-Project-assets-registry-R2.md](../archive/plans/2026-08-19-P20-Project-assets-registry-R2.md)` (shipped 2026-09-04 — local live smoke vs real R2; set includes S2/S3/S4 briefs)
- `archived → [2026-08-30-P19-project-persistence.md](../archive/plans/2026-08-30-P19-project-persistence.md)` (shipped 2026-09-03 — live smoke passed; set includes P19.4 annex)

Older history — P14 and earlier, the letter-era A–H tracks, prior scope
decisions — lives on disk under `docs/archive/plans/` (renewal era) and
`docs/archive/plans/pre-h1-letters/` (letter era), unlisted by owner decision
2026-09-05. When a plan ships, its stub enters this list and the oldest stub
drops off (Rule 4).

## Long-term roadmap (registered plans above; future tiers are direction only)

Ratified 2026-08-31 with the north-star amendment: the project shell has two
primary creative modes — **Spatial** (the current editor) and **Experience**
(future) — plus project-level **Assets** and **Publish** surfaces, all
operating on one portable project truth. Direction lives in
[`../north-star.md`](../north-star.md) and its final conceptual hierarchy;
this section records the sequencing tiers. The Active table owns registered
P-numbers; future numbered tiers below are next-free-number reservations
(direction only) that become registered only when their plan docs are filed
(owner roadmap revised 2026-09-03; tiers renumbered 2026-09-05 — authoring
depth owns the P23/P24 slots, Experience moved to P25, typed DB demoted to
conditional infrastructure):

- **Now — Design track in parallel** (no P-number; design only — no major
  implementation yet): product flow / IA / shell / Hub / editor UX concepts
  running alongside the implementation tiers. Concepts and specs land in
  [`../Design-specs`](../Design-specs/); nothing commits to implementation
  until its plan doc is filed.
- **P20 — Project Asset Registry + R2.** Shipped 2026-09-04 (local live smoke
  vs real R2 passed; production-topology smoke deferred).
- **P21 — Product shell + Project Hub + core editor UX polish.** Shipped
  2026-09-08 (P21.1–P21.6 + final acceptance gate; see the archive).
- **P22 — Basic Publish + visitor runtime.** Registered above. Publish an owned project, resolve
  project assets, hosted visitor-safe output, and basic preview/publish
  status. Brief written assuming P21 complete (owner 2026-09-07); implementation
  depends on P21 closeout. Strategic rationale: P22 establishes the
  reusable execution target for every human- or agent-authored project
  (canonical project → deterministic asset resolution → cold visitor-safe
  runtime → published version → URL) while protecting visitor/editor
  isolation. The eventual proof is a cold boot in a fresh browser without
  `EditorApp`, editor stores, selection, history, gizmos, or editor-only
  asset setup. No Experience authoring, no agent API, no general Assets
  workspace, no collaboration, no generic SDK.
- **P23 — Layout Depth family (staged, wall-first reconciliation ratified
  2026-09-09).** The minimum useful Build set begins with a coupled Foundation
  Gate: first-class Junctions/Walls/Wall-hosted Openings; `boundary | partition`
  semantics; robust straight-wall topology and persistent Room correspondence;
  explicit Layout/Scene format compatibility; trustworthy legacy Room-frame
  conversion; project/world-local Scene/Camera physical placement; compiler/
  query/editor-adapter cutover; and old Save/Publish compatibility before new
  writers enable. It then adds precise Wall/Junction dimensions, deterministic
  snapping/alignment, continuous Wall/Partition sketching, openings, repeat/
  isolated-room duplicate, small presets, direct Wall/Junction manipulation,
  bounded canonical curved-Wall authoring with render-safe validation, stable
  architectural display identity, final Plan/shell finish and junction-correct
  wall-first 3D before closeout. Layout objects stay document-level/project-world-local.
  Optional depth tail (stairs, railings, richer parametric components,
  arbitrary/general curve intersection/noding and broader CAD curve tooling,
  profile/extrude, sweep/revolve, roof helpers, general constraint sophistication)
  remains demand/evidence-gated and never blocks Experience. Everything continues
  through one `LayoutDocument` → `compileLayoutGeometry()` → Plan/3D/visitor geometry
  authority, with Layout and Scene ownership kept separate. P23 implementation
  proceeds from its own umbrella/child dependencies; completed Pascal evidence is
  optional and should be read only for a materially overlapping slice, never as a
  prerequisite.
- **P24 — Scene / Staging Depth umbrella (registered, staged).** The umbrella
  is registered above and split internally into **P24A — Asset Supply +
  Canonical Ingest** and **P24B — Rich Scene / Staging Authoring**. Phase 2
  research is reviewed; P24A R1 closed 2026-09-10 and its annex is now
  `minimum frozen — implementation pending`. The static-first minimum keeps
  one stable `SceneModelEntity.assetId`, derives PlanProxy through the existing
  `AssetFootprint`, uses deterministic normalization + rights/provenance gates,
  and delivers built-in Wave-1 models through the append-only shipped-static
  compatibility authority. Generic project/upload/provider GLB ingestion is a
  deferred depth path outside the R9 minimum; if later selected it must extend
  P20/R2 + P22 release pinning rather than form a parallel registry. The frozen
  10–12 cross-source proof set (Poly Haven + Kenney + Sweet Home 3D) plus bounded
  material/HDRI supply remain execution work; the research JSON's 32-object Wave
  1 remains acquisition backlog, not a P24/P25 gate. P24B Phase 4 compact
  research is reviewed directionally; the pinned Pascal direct-reference harvest
  is closed and is now evidence, not another research gate. The active
  [P24 reconciliation sequence](2026-09-09-P24-reconciliation-sequence.md)
  runs R0–R9 over current Museum code: P23 delta map, P24A readiness, B0 maturity
  matrix, B2 shared Plan/3D placement, B5 cross-view behavioral contract, B1/B3/B4
  depth decisions, final B5 presentation, then B6 minimum freeze. P24 planning may
  run in parallel with P23; implementation still depends on P23. R1 leaves four
  concrete integration/acceptance items rather than more broad research: remove
  Room ownership from canonical Stage placement/selectability, integrate explicit
  Layout-query support/Y choice, make cold static-model loading resolve from
  shipped-static authority, and run the frozen corpus through Save/Load + cold
  visitor acceptance. Material/texture/HDRI assets originate in P24A while
  assignment/editing/light/environment operations belong to P24B. Both preserve
  one project asset registry, `SceneDocument` ownership, canonical
  selection/history, existing gizmo/transform authority, Threlte patterns and
  visitor/editor isolation; they consume the spatial coordinate model shipped by
  P23. P25 waits only for the accepted useful minimum from both subtracks, never
  for catalogue/DCC depth tails. See [P24 umbrella](2026-09-08-P24-scene-staging-depth-umbrella.md),
  [P24A annex](2026-09-08-P24A-asset-supply-canonical-ingest-annex.md), and
  [P24 reconciliation](2026-09-09-P24-reconciliation-sequence.md).
- **P25 — Experience Foundation umbrella (registered, research/reconciliation).**
  Focused research is now canonical at
  [`../Deep-research/P25-research/P25-research-compact.md`](../Deep-research/P25-research/P25-research-compact.md)
  and has been reconciled into the umbrella. The minimum product vocabulary is
  **Destination + guided Stop/occurrence + reusable Content/Info Panel + bounded
  semantic Interaction**, composed over existing Spatial/Camera/Assets meaning.
  Stop is Sequence-relative only: it owns no pose/path/timing/connectivity or
  second next/previous graph. Core interaction remains `Activate`,
  `DestinationReached`, `ShowContent`, `NavigateTo`, `OpenUrl`; one rule owns one
  action and multiple independent non-conflicting rules may share an event.
  Narration is first-depth, not a minimum gate. Semantic DOM companion navigation,
  keyboard/touch equivalence and same-Destination reduced/no-motion behavior are
  platform contracts. Product semantics are closed; exact persistence ownership,
  durable Stop/Sequence representation, Destination/Scene reference forms, media
  resolution, reference integrity and operation/codecs remain unfrozen pending
  targeted post-F0/P24 rechecks and E6. P25 still begins after the accepted
  P23/P24 useful minima, before optional depth tails, and must prove one complete
  occurrence-aware visitor journey rather than a generic app-builder feature set.
- **Bounded agent/reuse proof (after first complete visitor-authoring
  slice, before broad expansion).** Test whether a strong agent can inspect,
  semantically edit, stage, author camera/experience changes, validate,
  preview, publish, and revise through the same canonical behavior as human
  authoring. Small useful operation set only; no custom planner, chat UI,
  generic agent framework, four transports, or large MCP surface. Transport
  stays replaceable per client need. Registered as its own brief when due;
  no P-number is consumed by this direction entry.
- **P26+ — Evidence-led platform expansion.** Later expansion arrives as
  several separately registered slices rather than one milestone, scheduled
  only against measured reuse/delivery/adoption needs: richer P23/P24/P25
  depth tails, templates / camera kits / provider adapters, richer asset
  workflows / My Assets, collaboration / teams, richer Publish / domains /
  embeds, runtime SDK / headless runtime. No permanent P-numbers now —
  direction until individual plan docs are filed, starting at P26.
- **Typed DB layer — conditional infrastructure, not a numbered milestone**
  (owner decision 2026-09-05, demoted from the former P23). A typed database
  layer (Drizzle/Kysely-style schema-owned types, typed query access) is
  adopted only when code pressure on the raw-parameterized-SQL surface from
  P19–P22 proves it — as a small technical slice inside or before a later
  tier, never as a product milestone owning a P-number. The P19/P20 no-ORM
  pins hold until then.
- **Cross-cutting planning rules (apply from P23 authoring work):**
  operation-first — UI is one client of domain behavior: separate semantic
  intent → validation → deterministic mutation → transaction/history →
  rendering from button/toolbar/gesture/Inspector presentation, extracting
  only the abstraction current code pressure justifies (see north-star
  Shared authoring operations). Validation/observability — establish
  domain-level checks incrementally as primitives grow (broken refs,
  constraint validity, room membership, route integrity, shot
  visibility/clipping, perf signals); structured facts first, render
  inspection as complement, no giant validator subsystem now.

- **Current / near-term platform work** (grounded in active rows): core
  extraction / app boundaries (P15–P17 shipped), backend provisioning (P18
  shipped), project Save/Load + first Google OIDC + app-owned secure-session
  integration + single-user ownership (P19 shipped 2026-09-03 — live smoke
  passed), then the numbered tier sequence above:
  R2-backed project assets with Spatial integration (P20, shipped 2026-09-04 —
  local live smoke vs real R2; production-topology smoke deferred), the
  product shell + Project Hub + editor UX polish (P21, shipped 2026-09-08 —
  P21.1–P21.6 plus the P21.5 presentation-only polish pass, closed by the
  six-reference + axe/contrast acceptance gate), the basic
  publish/visitor-runtime boundary (P22, shipped 2026-09-08 — the first
  complete product loop: author → preview → publish → visitor sees it, closed
  by hosted cold-boot acceptance through the deployed proxy/API/Postgres/R2),
  then minimum useful authoring
  slices split by document ownership (P23 Layout Depth minimum, P24 Scene /
  Staging minimum split internally into P24A asset supply/ingest + P24B Rich
  Scene / Staging Authoring), the registered P25 Experience research/
  reconciliation umbrella, a bounded agent/reuse proof, then evidence-led
  depth tails and expansion (P26+). The design track runs in parallel from Now.
  Auth UX/hardening and richer permissions ride with the P26+ collaborative
  tier, not P19/P20.
- **Medium-term product infrastructure** (possible direction, unscheduled):
  hosted project loading and published project versions ride with P22;
  portable project/export hardening, project asset management, and generic
  visitor/player extraction when genuinely needed.
- **Long-term Experience work** (unscheduled beyond the P25 foundation):
  Narration/transcripts, transient Highlight, bounded first-visit state,
  richer wayfinding/resume, richer media, semantic hotspots where no existing
  Scene identity exists, deep-linked destinations, derived visitor maps,
  multiple tours/richer story structures, reusable Experience templates/presets,
  localization, analytics, richer visitor-state persistence, XR-specific behavior,
  developer runtime SDK, headless runtime, and community/gallery surfaces.
  **Guided Stop/occurrence semantics are no longer deferred here; they are part
  of the P25 minimum product vocabulary.** Experience remains composed of
  **Navigation · Content · Interactions**; Interactions are an authoring lens
  within Experience (an `Event → Target → Action` semantic model), never a
  separate mode — ratified 2026-08-31
  ([scope decision](../archive/plans/2026-08-31-scope-decision-experience-interaction-boundary.md)).

Constraints: no Experience implementation tickets are created merely by
registering or product-reconciling the P25 umbrella, and Experience work must
not displace persistence or Spatial completion. `ExperienceDocument` remains
a P25 architecture hypothesis to study, not a ratified schema: no codecs,
migrations or backend endpoints exist until the E6 implementation-ready gate
closes. P19 includes the first Google OIDC (Authorization Code + PKCE) +
app-owned secure-session integration and single-user ownership required for
Save/Load; broader auth UX/hardening and richer permissions remain later. P19
has no Experience schema and no R2.

P19–P22 stay raw parameterized SQL: the no-ORM pins in the P19/P20 plans are
scope-limited to those tiers and are revisited only when code pressure on
that surface justifies a typed layer — conditional infrastructure (owner
decision 2026-09-05), never a numbered milestone. P21/P22 hold no Experience
authoring or Experience schema; P25 schema/persistence ownership remains
unfrozen until the P25 E6 gate, and P25 may follow the accepted minimum P23/P24
slices without waiting for their optional depth tails. No Experience
implementation tickets or codecs are created by roadmap direction or external
research alone.

# Phase 0 — semantic architecture review B

```text
STATUS:  FROZEN (local) 2026-09-22 — Reviewer B output, held under the both-or-neither embargo
ROLE:    Phase-0 evidence, architecture lane (Assignment B). Input to owner adjudication.
NOT:     A/B/C/D classification · ratification · mechanism recommendation · an answer to
         "what catches it next time" · a contract · a status field · a tracker
RANGE:   f8411f7f0dc8cd0bb8e05683259d7c2aa6a9fdbb .. b5f75e7ecba5149ed03a26237402ba5a41266372
         (frozen — ./2026-09-22-P0-frozen-evidence-range.md; not extended by the newer workspace HEAD)
BRIEF:   ./2026-09-22-P0-investigation-brief.md, Assignment A/B, read as frozen
METHOD:  ../../architecture-operating-cycle-plan.md §8 "Fresh semantic reviews"
STATE:   docs/operations/architecture-cycle.md is the sole live meta-state authority; unchanged here
```

Seven candidates are reported, plus a separate contradicted-rules set of two established items
and ten items considered and not established. The order is presentation only: it is not a
ranking or a classification. Nothing here says whether a candidate is precedent,
intended-but-undocumented, already caught, or not architecture. That call belongs to the owner.

## 1. Range, inputs and method

### Workspace verification

- PR #76 ("Phase 0 — mechanical control pass over the frozen P23 range") is `MERGED` at
  2026-09-22T17:50:40Z as `722280f` (`gh pr view 76`).
- Branch `meta/phase0-review-b` HEAD at start was `a6ae436`, a merge of `main` (`722280f`) into
  the branch. `git merge-base --is-ancestor origin/main HEAD` held after `git fetch origin main`,
  so no further sync was needed. The worktree was clean and contained the frozen brief, the
  frozen range and `mechanical-control-pass.md`.
- No other reviewer branch, ref, worktree, commit or output was read.

### Inputs read

- `docs/roadmap/architecture-operating-cycle-plan.md` §8 (canonical method).
- `2026-09-22-P0-investigation-brief.md` (frozen assignment).
- `2026-09-22-P0-frozen-evidence-range.md` (frozen range: 432 commits, 45 merged PRs).
- `mechanical-control-pass.md`, used as context only. Its three sets (persisted-format
  surface, host-write surface, visitor/editor import boundary) were **not** used as the
  search space.

### Method

1. **History map.** `git log --first-parent f8411f7..b5f75e7` (179 first-parent commits) and a
   non-test code diffstat over `packages` and `apps` (418 files, +107,765/−6,339). Each key
   commit was mapped to its landing first-parent commit or PR by testing
   `git merge-base --is-ancestor <commit> <first-parent>` in chronological order.
2. **Where the new code landed.** For every module that exists at `end` in
   `packages/layout-core/src`, `apps/editor/src/lib/layout` and `apps/museum/src/lib`, I found
   the introducing commit with `git log --diff-filter=A`, then read the representative module
   headers and exported surface at the revision that introduced them.
3. **Candidate search.** Candidates came from reading the code, not from the mechanical sets.
   I looked at representation (schema fields, discriminators, coordinate frames, identity),
   ownership (which package or app owns an operation, rule or copy) and naming (identifiers,
   module labels). Each candidate was then tested for recurrence with `git log -S` / `-G` and
   `git grep <rev>` at the two endpoints and at intermediate revisions.
4. **Historical contracts.** For each occurrence, the contract was read **as of that
   revision** with `git show <rev>:<path>`. The paths were `AGENTS.md`,
   `docs/architecture.md` / `docs/reference/architecture.md`, `docs/north-star.md` /
   `docs/reference/north-star.md`, `docs/components/*.md` / `docs/reference/components/*.md`,
   `apps/editor/tests/README.md`, and, where then-current `AGENTS.md` rule 10 made an active
   plan authoritative, the active plan.
   - Until `f7a31e2` (2026-09-19), rule 10 ranked `source code + tests →` CURRENT/current.md
     `→ active plan → component contract → architecture.md → north-star.md → archive`.
   - From `f7a31e2`, code was removed from that ordering. From `0d8bd0f` (2026-09-20),
     authority is concern-based.
   - Plans are cited only as the contract in force at the time. They are never cited as
     evidence of landed behaviour.
5. **Contradicted rules.** For each written rule that a candidate or a landed change could
   touch, I checked whether the rule existed **before** the occurrence, using its introducing
   or removing commit and its timestamp. Only then is a contradiction reported.

Tooling note: all probes are `git log` / `git grep` / `git show` against commits, not the
working tree. The shell was zsh, so revision-qualified paths were written `"${r}:path"` (to
avoid the `:a` history modifier) and word lists were expanded with `${=var}`. Those two
pitfalls produced two discarded probe runs, which are not reported.

## 2. Candidates

Each candidate states the inferred convention in one sentence. It then gives the
occurrences with revision and then-authoritative contract, the recurrence, counterevidence,
limitations and provenance.

---

### C1 — Layout authoring operations are owned by `@portfolio/layout-core`, not by the editor

**Inferred convention.** A new Layout authoring operation is written as a pure `plan*`
function in the shared `@portfolio/layout-core` package, exported through its root barrel,
and the editor only adapts intent to it. Scene-side operations meanwhile remain editor-store
mutators.

**Occurrences** (module added in the range; `plan*` exports counted at `end`):

| Revision | Landing | Date | Module(s) added to `packages/layout-core/src` |
| --- | --- | --- | --- |
| `b5427d8` | first-parent | 09-09 | `layout-wall-topology-ops.ts` ("canonical writers (planners…)") |
| `d5ec0df` | #9 (P23.1) | 09-10 | `layout-wall-first-precision.ts` (`planExact*`, later 2,166 lines) |
| `a369a15` | #13 (P23.2) | 09-10 | `layout-snap.ts`, `layout-align.ts` (`planLayoutObjectAlign`) |
| `5f20aaa` | #18 (P23.9) | 09-11 | `layout-wall-chain.ts` (`planWallChain`, `planWallSegment`) |
| `d1705b7` | #19 (P23.3) | 09-11 | `layout-wall-openings.ts`, `layout-opening-set.ts` |
| `c6601f2` | #21 (P23.4) | 09-11 | `layout-duplicate.ts` (`planRepeat*`, `planDuplicateIsolatedRoom`) |
| `4f3ffe6` | #27 (P23.6a) | 09-12 | `layout-room-move.ts`, `layout-room-isolation.ts` |
| `fa50564`…`c56509a` | #51 (P23.11) | 09-14/15 | curve planners added to the precision module |
| `e43ecf4` | #57 | 09-17 | `layout-wall-dissolve.ts` (`planDissolveJunction`) |

- **Measured:** `git grep -hE '^export (async )?function plan[A-Z]' <rev> -- packages/layout-core/src`
  gives **0** at `f8411f7` and **41** at `b5f75e7`.
- Of the 41, **37** are referenced from `apps/editor/src`. Exactly **1**
  (`planWallSplitAtPoint`) is referenced from a non-editor caller (`layout-migration.ts`).
  **None** is referenced from `packages/project-model`, `apps/museum` or `apps/api`. (Probe:
  `git grep -lw <name> b5f75e7 -- <paths>` per name.)
- `layout-core/src` grew from 13 to 43 modules.
- Scene side at the same endpoints: `apps/editor/src/lib/editor/store/*mutator*` is 4 modules
  at `base` and the same 4 at `end` (`navigation-graph`, `path-anchor`, `placement-cluster`,
  `material-resource`). `packages/project-model` has 0 `plan*` exports at both.

**Recurrence.** The shape repeats across at least nine landings and seven slices, and never
reverts. Later slices extend the barrel (`index.ts` `export *` of every new module) rather
than introducing a different home.

**Then-authoritative contract.**
- **Range base, active umbrella plan**
  (`f8411f7:docs/plans/2026-09-07-P23-layout-depth-minimum-build.md:131-135`): "Pure layout
  operations can live beside existing helpers, with canonical package imports and no
  DOM/store dependency. Move them into `layout-core` only when a real shared caller needs
  that boundary."
- **`c123c23`, 2026-09-09 01:02.** This commit, a reconcile of the umbrella plan, **removed**
  that paragraph (`git log -S'only when a real shared caller'`). It added no replacement
  placement rule. The only related line it added is: "selection is an editor input/result,
  never an implicit mutation target for headless domain operations". Every occurrence above
  post-dates the removal.
- **Architecture ownership table**, identical at `f8411f7:docs/architecture.md` and at
  `b5f75e7:docs/reference/architecture.md` except for the 3D wall-mesh row. It assigns
  `@portfolio/layout-core` "Rooms, frames, boundaries, openings" (`LayoutDocument`) and
  "Derived geometry" (`compileLayoutGeometry()`). It names no owner for authoring
  operations.
- **Persistence contract, whole range:** "The authored layout contract and renderer-neutral
  compiler live in `@portfolio/layout-core`". No operations are mentioned.
- **North-star "Shared authoring operations (future direction)"** (`650f7c1^:docs/north-star.md:972-1019`):
  domain operations are to be "independent of toolbar/button presentation" and "UI remains
  one client of domain behavior". It also says: "No complete generic command framework is
  claimed to exist today … inspect the current mutator/store/history abstractions and reuse
  them where appropriate". It says nothing about package placement.
- **Architecture "Geometry boundary"**, in force the whole range: "No SVG strings, `THREE.*`,
  DOM, WebGL/WebGPU handles, materials, cameras, or UI state below the layout boundary". The
  P23.2 occurrence brought Plan acquisition inputs into the package:
  `LAYOUT_PLAN_SNAP_RADIUS_CSS_PX = 8`, `pixelsPerMeter`, `snapRadiusCssPx`
  (`a369a15:packages/layout-core/src/layout-snap.ts:35-177`). They are parameters, not held
  state; see §3.

**Counterevidence.**
- The package placement was stated as deliberate in at least one commit. `d41cfd5`: "Wall
  birth moves into the domain … so a headless `planWallSegment()` and the editor resolve the
  same height instead of the UI owning a second rule."
- The north-star direction toward headless domain operations supports the move, even though
  it does not locate it.
- Several slice plans record the placement in their implementation-status sections, for
  example the P23.2 plan at `a369a15`, line 185 ("Foundations:
  `packages/layout-core/src/layout-snap.ts` …"). Those are after-the-fact records, not
  prescriptions.
- Topology/reconciliation modules (face extraction, noding, reconciliation) have a real
  shared caller, migration → `project-compat` → visitor. That is consistent with the removed
  rule.

**Limitations.**
- Caller reach is static name reference only. Transitive use inside `layout-core` (planners
  calling planners) was not traced.
- Chunk membership (whether planners reach visitor bundles through the root barrel) was not
  measured. No build was run.
- Whether the removal at `c123c23` was a deliberate re-decision cannot be established from
  Git. Its commit subject is a general reconcile.

**Provenance.** `git grep -hE '^export (async )?function plan[A-Z]' <rev> -- packages/layout-core/src`
at both endpoints; per-name `git grep -lw` over `apps/editor/src` and over
`packages/layout-core/src/layout-migration.ts packages/layout-core/src/layout-compat.ts packages/project-model/src apps/museum/src apps/api`;
`git log --diff-filter=A` per layout-core module; `git log -S'only when a real shared caller' f8411f7..b5f75e7`.

---

### C2 — Junction reuse at commit is resolved from coordinates, not carried as the snapped Junction's identity

**Inferred convention.** Authoring planners receive points, not Junction IDs. A point joins an
existing Junction when its coordinate coincides with that Junction's stored coordinate, and
connectivity follows from that match. Coincidence meant exact `===` equality until 09-14, then
distance ≤ `JUNCTION_COINCIDENCE_EPSILON = 1e-9`.

**Occurrences.**

| Revision | Landing | Date | Evidence |
| --- | --- | --- | --- |
| `d5ec0df` | #9 (P23.1) | 09-10 | `layout-wall-first-precision.ts:709` `samePoint` = exact `a[0] === b[0] && a[1] === b[1]` |
| `5f20aaa` | #18 (P23.9) | 09-11 | `layout-wall-chain.ts:52-54` "Exact coordinate equality — the same junction-identity bar P23.1 holds"; `:189-194` "Resolve each draft point to an existing junction when its coordinate matches (snap is a suggestion; explicit junction reuse is the commit semantic)"; `:197-203` a final point equal to the first point "closes the chain implicitly" |
| `d41cfd5` | #25 (P23.6I) | 09-12 | commit body: `resolveWallBirthHeight()` "inherits the unique incident Wall height at the exact-coordinate start Junction" |
| `89012d8` | #48 | 09-14 | new `layout-junction-identity.ts`: "Canonical coordinate identity for Layout Junctions", `coincidesAsJunction` at 1e-9, adopted by `layout-wall-chain.ts` |
| `b801266`, `1ae341f`, `c98b13b`, `8f31a5e` | #51 (P23.11) | 09-14/15 | curve planners and `layout-geometry-curve.ts` adopt `coincidesAsJunction` |
| `b5f75e7` (end) | — | — | `planWallSegment` (`layout-wall-chain.ts:1083-1085`) finds `startJunction` by `coincidesAsJunction(junction.point, options.start)`; `planWallChain` options carry `points`, plus `endpointHostSnaps` for Wall-span hosts only |
| `b5f75e7` (end) | — | — | `duplicateJunctionsAt` (`layout-wall-chain.ts:612-637`): during noding, Junction records of the participating Walls that coincide with the classified point are **retired** "in favour of the kept record … retiring that record is what turns a would-be degenerate split into an identity adoption" |

**Recurrence.** The shape runs through five slices. It was centralised and **relaxed** from
exact equality to a named 1e-9 identity tolerance in #48, and it is present unchanged at `end`.

**Then-authoritative contract.**
- **North-star (ratified 2026-09-09, present through `end`):** "Proximity may suggest a
  snap/join; it never becomes implicit authored topology or ownership by itself."
- **Wall-first types header** (`13a96a0` onward): "Junction IDs are the only normal-authoring
  connectivity authority."
- **Active P23.9 plan at the time of `5f20aaa`**
  (`5f20aaa:docs/plans/2026-09-09-P23.9-wall-partition-sketching.md`):
  - line 205: "If the snap winner is accepted, reuse that Junction ID."
  - line 96: run closure is "explicit Junction identity (`resolvedEndJunctionId === runStartJunctionId`),
    never coordinate proximity alone".
- **Umbrella after `c123c23`:** "Snap suggestions never create topology until the committed
  operation records explicit Junction/Wall relationships."
- **No reference contract** at any revision in range names coordinate coincidence as a
  Junction identity rule. `git grep` over `docs/reference`, `docs/components`,
  `docs/architecture.md` and `AGENTS.md` found no `coincid` / `coordinate identity` rule.

**Counterevidence.**
- The editor-side *run closure* does use Junction IDs
  (`5f20aaa:apps/editor/src/lib/editor/layout/LayoutPlanViewport.svelte:1791`, and
  `wallChainRunStartJunctionId` at `end`). The plan's closure rule was followed in the UI.
- The tolerance is explicitly documented as "not a screen-space acquisition radius and not a
  geometry/intersection tolerance" (`layout-junction-identity.ts` header). Identity adoption
  is limited on purpose to the records in the current relationship. A baseline that already
  has two records for one node is called "a pre-existing identity defect" and is left
  untouched (`layout-wall-chain.ts:619-622`).
- For snapped input the outcome equals ID reuse, because a snapped point adopts the
  Junction's stored coordinate.
- **Partial correction in range.** `c56509a` (#51, 09-15) moved one relation from
  coordinates to carried identity: "Carry snapped Wall identity through segment authoring so
  curved T junctions split against the authored host instead of sampler tolerance." That
  added `endpointHostSnaps` / `endpointHostWallId`. Junction reuse was not changed.

**Limitations.**
- It was not established whether any unsnapped path (exact numeric entry, duplicate/repeat
  output, migration) produces a coincident point that silently joins topology. No runtime
  exercise was done.
- Whether "proximity" in the north-star sentence includes 1e-9 coincidence is interpretive.
  That is why this is a candidate and not a contradiction.

**Provenance.** `git log -S'coincidesAsJunction' f8411f7..b5f75e7`; `git show <rev>:packages/layout-core/src/layout-wall-chain.ts`
at `5f20aaa`, `89012d8`, `b5f75e7`; `git show 5f20aaa:<P23.9 plan>`; `git log -S'endpointHostSnaps'`.

---

### C3 — New persisted fields get one of two opposite evolution treatments, each labelled a "policy" in code, chosen per field

**Inferred convention.** A new persisted wall-first field is either **required** with no
missing-field tolerance ("fresh-authority policy") or **optional on read and always written**
("optional on read"). Which one applies is decided locally. Each variant is described in
source comments as a policy.

**Occurrences.**

| Revision | Landing | Date | Field / change | Treatment |
| --- | --- | --- | --- | --- |
| `d36695c` | #25 (P23.6H) | 09-12 11:29 | format 4 → 5, `LayoutWall.height` authoritative | tolerant: "Pre-H (format 4) snapshots … normalized once at the compatible read/decode boundary and canonicalized to format 5" |
| `d41cfd5` | #25 (P23.6I) | 09-12 13:51 | same | reversed: "removes the compatibility machinery H added"; `4` now fails `unsupported_format_version` |
| `fa50564` | #51 (P23.11) | 09-14 | required `LayoutWall.centerline` | "The fresh-authority codec rejects missing … centerlines in place, so no migration machinery exists" |
| `35aaa49` | #51 (P23.11) | 09-14 | `centerline` `auto-bezier` → `cubic-chain` | "`auto-bezier` is deliberately no longer accepted … the fresh-authority policy decodes only the current shape" (`b5f75e7:layout-wall-first-codec.ts:610-620`) |
| `810bc8c` | non-PR merge `c2a2404` (P23.12) | 09-15 | `LayoutDocumentWallFirst.identity` ledger (+ optional `name`) | "**optional on read**: every already-saved project and every already-published release predates it … The canonical writers always emit it" (`layout-wall-first-types.ts:274-277`, codec `:267`) |

**Recurrence.** The question arises for every new persisted field in the range. The two
treatments were applied one day apart. After `810bc8c` no further persisted fields were
added: the only later codec touch is `650f7c1`, per
`git log f8411f7..b5f75e7 -- packages/layout-core/src/layout-wall-first-codec.ts`. So there
is no third data point showing which shape a later contributor would copy.

The implementers themselves recorded the fork. The active P23.12 plan
(`810bc8c:docs/plans/2026-09-15-P23.12-names-and-stable-display-identity.md` §C3) is titled
"P23.11's fresh-authority precedent vs the required default for documents without the new
metadata". It resolves the P23.12 case alone: "optional on read and always present on
write … completeness is guaranteed at the single install seam rather than by the codec. No
version bump, no migration."

**Then-authoritative contract.**
- **North-star "Development-stage schema compatibility"**, added `b1929a3` 09-12 13:44
  inside #25, before `d41cfd5` and all later rows:
  - "new schema work must **not** add migration layers, tolerant historical decoders,
    multi-version canonical types, compatibility-only visitor branches, or legacy writer
    support by default";
  - "A migration or compatibility path before the baseline requires an explicit product
    reason and acceptance criterion";
  - examples include "a published snapshot that has been intentionally declared durable";
  - "These exceptions must be documented explicitly."
  - The "Compatibility Baseline" subsection has no baseline ratified through `end`.
- **The term "fresh-authority policy"** appears in no contract at any revision. It first
  appears in code at `fa50564`, and at `end` it exists only in
  `layout-wall-first-codec.ts`, `layout-wall-first-types.ts` and the P23.12 roadmap plan
  (`git grep -l 'fresh-authority' b5f75e7`).
- **Persistence contract:** `docs/components/persistence.md`, unchanged 09-09→09-17, still
  read "No version field". The version `b5f75e7:docs/reference/components/persistence.md`
  states the current/legacy format split but no rule for new fields. It mentions neither the
  ledger nor `centerline`.

**Counterevidence.**
- The P23.12 departure was reasoned and documented in the active plan (§C3, §C11). The plan
  cites a concrete product reason: released documents are re-validated by the visitor
  through `prepareCompatibleRuntime`.
- The P23.6H → P23.6I reversal shows the 09-12 policy applied within minutes of being
  written, in the same PR.

**Limitations.**
- The P23.12 plan says required-field treatment of `centerline` would invalidate
  already-published releases with Walls. That was not verified against any stored release.
- A published-release re-validation path was read in code comments and plans only. No API or
  visitor run was made.

**Provenance.** `git log --format='%h %ai %s' -1` for `b1929a3`, `d36695c`, `d41cfd5`; `git show -s --format=%B`
for `d36695c`, `d41cfd5`, `fa50564`; `git show 810bc8c:<P23.12 plan>` lines 260-285 and 436-450;
`git log -S'fresh-authority' f8411f7..b5f75e7`.

---

### C4 — Scene canonical and legacy shapes share one runtime type; `roomId` presence selects the coordinate frame

**Inferred convention.** A single `SceneDocument` type family carries both the world-local
canonical shape and the legacy room-local shape. Consumers decide which coordinate frame a
`position` is in by whether the record has a `roomId`, not by `formatVersion`. The Layout
side took the opposite route: `LayoutDocumentWallFirst` is a separate type whose
`formatVersion` is "narrowed to the constant's value … so no downstream consumer needs a
`formatVersion` branch at all" (`layout-wall-first-types.ts`, P23.6I).

**Occurrences.**
- **`41a5cde` (09-09, P23.0b), `packages/project-model/src/scene.ts`:**
  - four required `roomId` fields become optional (`roomId?: RoomId` / `roomId?: string`);
  - `formatVersion?: typeof SCENE_WORLD_LOCAL_FORMAT_VERSION` is added;
  - field docs change to "Room-local eye position (legacy) or world position (absent roomId)";
  - runtime build becomes `position: node.roomId ? rooms.point(node.roomId, node.position) : cloneVec3(node.position)`.
- **Same commit, relic app:**
  - `apps/museum/src/lib/museum/MuseumEntities.svelte`: "absent roomId is the world-local
    identity frame", `room?.position ?? [0, 0, 0]`;
  - `apps/museum/src/lib/state/runtime-state.svelte.ts`: "world-local nodes carry no room gate".
- **Continued in later commits:** `2c9b04d`, `0d66aed`, `442f85a` (F0 stages, 09-09) add
  presence branches in the compat runtime and codec.
- **`ff78930` (#61 P23.14, 09-18):** the Inspector shows the discriminator to users,
  `Camera path · {anchor.roomId ? 'room-local' : 'world-space'}`.
- **`f77e2ab` (#58 P23.13, 09-16):** dimension lanes branch on `span.roomId !== undefined`.

**Recurrence.**
- By a rough, over-inclusive probe, presence-branch lines (`roomId (===|!==) undefined`,
  `.roomId ?`, `.roomId ??`) in non-test source number **52** at `base` and **135** at `end`.
- Commits adding such lines span 09-09 to 09-19
  (`git log -G … f8411f7..b5f75e7`: 14 commits).

**Then-authoritative contract.**
- **09-09 → 09-17:** `docs/components/persistence.md` read "Scene: … One canonical shape; no
  version field, no migrations" (verified at `41a5cde`, `d41cfd5`, `810bc8c`, `368a799`).
- **Active P23.0 plan** (`41a5cde:docs/plans/2026-09-09-P23.0-wall-first-foundation-migration.md:160-200`):
  convert legacy Room-local Scene "once to world-local", or reject. It also notes that
  "Camera records already stored without `roomId` remain byte-equivalent in spatial meaning."
- **From 09-12,** the north-star pre-baseline policy forbids "multi-version canonical types"
  and "compatibility-only visitor branches" by default for **new** schema work.
- **From 09-18:**
  - `AGENTS.md` rule 2 says "canonical Scene is world-local (`formatVersion: 1`, …, no
    `roomId`). Versionless room-frame payloads are legacy compatibility only."
  - `reference/components/persistence.md` says legacy is "converted on import/migration,
    never authored".
  - Neither says whether runtime types and consumers may keep a dual interpretation.

**Counterevidence.**
- The convention partly predates the range. The P23.0 plan says some camera records at
  `base` already lacked `roomId` with world meaning, and the rough probe finds 52 presence
  lines at `base`.
- The dual type follows from the plan-sanctioned "legacy-compatible" fallback in the
  project-compat decode matrix (`41a5cde` body: "fallback to legacy-compatible on migration
  rejection"). That fallback means runtime consumers can receive legacy documents.
- The dual type was introduced before the 09-12 policy existed. Later occurrences consume it
  rather than adding schema.

**Limitations.** The presence probe cannot tell Scene `roomId` from Layout Room associations
(for example `LayoutObject.roomId?`), so the 52 → 135 counts are an upper bound. Only the cited
sites were read.

**Provenance.** `git diff f8411f7 b5f75e7 -- packages/project-model/src/scene.ts`;
`git diff f8411f7 b5f75e7 -- apps/museum/src/lib/state/runtime-state.svelte.ts apps/museum/src/lib/museum/MuseumEntities.svelte`;
presence probe
`git grep -nE 'roomId (===|!==) undefined|roomId \?|\.roomId \?\?|roomId\) \?' <rev> -- packages apps/editor/src apps/museum/src | grep -v /tests/ | wc -l`;
`git show <rev>:docs/components/persistence.md` at the four revisions above.

---

### C5 — The "frozen" museum relic is kept in hand-mirrored lockstep with editor modules

**Inferred convention.** When a shared-shape module in `apps/editor/src/lib/…` changes, the
same edit is copied byte-for-byte into `apps/museum/src/lib/…`. The "frozen Chopin visitor"
still receives current-architecture changes through these copies. No test or tool enforces
parity.

**Occurrences.**
- `apps/{editor,museum}/src/lib/layout/wall-mesh-builder.ts` are blob-identical at `base` and at
  `end`.
- Across the range, **11** commits touched the editor copy and the **same 11** touched the
  museum copy: 0 editor-only, 0 museum-only. They include:
  - `41a5cde` (P23.0b), `5f20aaa` (#18), `d36695c`/`d41cfd5` (#25), `b207565` (#51);
  - `173adc9`, `8cb940c`, `21c1830`, `f678ee8`, `bad5e89`, `8044c33`, `4cae710` (P23.15,
    09-21).
  - The museum copy changed by 743 diffstat lines over the range, and now carries
    junction-aware wall-first meshing.
- `41a5cde` also changed relic **runtime behaviour** in
  `apps/museum/src/lib/state/runtime-state.svelte.ts` and `MuseumEntities.svelte`
  (world-local node gating, identity frame; see C4). The relic serves only the checked-in
  legacy `chopin-project.json`.
- **Mirror census over `apps/museum/src/lib` files with an editor twin at the same path:**
  43 identical / 11 different at `base`, 41 / 13 at `end`. Two files newly diverged:
  `project/project-codec.ts` and `state/runtime-state.svelte.ts`.

**Recurrence.** The shape is consistent in every geometry-touching slice from 09-09 to 09-21.
The mirror itself predates the range.

**Then-authoritative contract.**
- **`AGENTS.md` repo facts (whole range):** "apps are `@portfolio/editor` and read-only
  `@portfolio/museum`".
- **Architecture:** "`apps/museum` (frozen Chopin visitor)"; "`/museum` stays frozen"; "Shared
  visitor-safe geometry/render modules may serve both lanes". This is the same at `f8411f7`
  and `b5f75e7`. From `650f7c1` the product-routes table adds "`/museum` | Frozen Chopin
  visitor relic".
- No contract at any revision names the mirror, a sync rule, or which copy is authoritative
  (`git grep` for `apps/museum/src/lib/layout`, `mirror`, `keep … in sync` over the
  contract paths at `f8411f7`, `41a5cde`, `8cb940c`).

**Counterevidence.**
- The mirror and its identical-copy discipline existed at `base` (43 identical files), so the
  shape was inherited, not formed, in P23.
- Copying is needed at least partly because the relic depends on `@portfolio/layout-core`
  (`apps/museum/package.json`), and the relic must still build against it (`AGENTS.md`: root
  `build`/`check` cover both apps).

**Limitations.**
- Whether the relic can ever reach the world-local branches at runtime was not tested. Its
  content is legacy.
- "Frozen" is not defined anywhere with respect to source edits (see §3).

**Provenance.** `git rev-parse "${r}:<museum path>"` vs `"${r}:<editor path>"` for every museum
file with an editor twin, at both endpoints; `comm` over `git log --format=%h f8411f7..b5f75e7 -- <each copy>`.

---

### C6 — The app-local `$lib/layout` family gains a whole-package "compatibility facade" for every new layout-core module, and holds editor-only Plan tuning

**Inferred convention.** Each new `@portfolio/layout-core` module gets a same-named file in
`apps/editor/src/lib/layout/`. That file re-exports the **entire** package and is labelled a
"compatibility facade", even for brand-new modules. The family is also where editor-only Plan
UI tuning goes when it must be reachable without importing `lib/editor`.

**Occurrences.**
- **Facade count:** one-line facades in `apps/editor/src/lib/layout/` go from **11** at
  `base` to **31** at `end`. 30 of the 31 are `export * from '@portfolio/layout-core';`
  and one is `export { orientXZ } …`.
- **Where the 20 new facades came from:**
  - `13a96a0` (layout-compat, wall-first-codec);
  - `41a5cde` (geometry-source, migration, migration-math);
  - `7d9df94` (face-extraction, robust-orientation, room-reconciliation, wall-noding,
    wall-topology);
  - `b5427d8` (wall-topology-ops);
  - `d5ec0df` (#9: wall-first-precision, wall-first-types);
  - `5f20aaa` (#18: wall-chain);
  - `d1705b7` (#19: opening-set, wall-openings);
  - `c6601f2` (#21: duplicate);
  - `4f3ffe6` (#27: room-isolation, room-move);
  - `7f4416e` (P23.12: identity, "add the layout-identity facade the editor already imports").
- **Labels:**
  - `b5f75e7:apps/editor/src/lib/layout/layout-room-move.ts` is
    `/** Compatibility facade for the P23.6a wall-first Room move planner. */ export * from '@portfolio/layout-core';`.
    That is a "compatibility" label on a module created in the range, and its body
    re-exports every planner, codec and compiler.
- **Mixed import styles at `end`:**
  - 41 editor source files import `'@portfolio/layout-core'` directly;
  - 63 import through `$lib/layout/layout-*`.
- **Editor-only Plan tuning in the family:** `19b5f0c` (#58 P23.13) adds
  `apps/editor/src/lib/layout/plan-control-grammar.ts`, with pointer target px and coarse
  pointer radii. It is imported only by `lib/editor/layout/*`, `editor-shell.css` and tests.
  Its header places it there "without the resolver having to import editor-side code".

**Recurrence.** Facades were added in 10 separate commits across 8 slices (P23.0, P23.8,
P23.1, P23.9, P23.3, P23.4, P23.6a, P23.12). There is one
editor-only tuning module (plus `plan-render-model.ts`, already in this family at `base`).

**Then-authoritative contract.**
- **Persistence contract, whole range:** "The authored layout contract and renderer-neutral
  compiler live in `@portfolio/layout-core`; app layout paths are compatibility facades
  **where retained**."
- **Architecture:** "Shared visitor-safe geometry/render modules may serve both lanes;
  session, selection, hierarchy, gizmo, import, and asset-store code stay editor-only."
- No contract defines the `$lib/layout` family, when a facade is created, or whether
  `$lib/layout` means shared or editor.
- The mechanical pass also declined to express a rule here (Set 3, "A rule about the shared
  `$lib` families").

**Counterevidence.**
- The facade form is inherited: all 11 base facades are the same `export *` shape labelled
  "Compatibility facade".
- The facades change no behaviour. Every facade resolves to the same package root.

**Limitations.** Import counts are per file and match on specifier text. Visitor chunk content
was not built.

**Provenance.** Per-file line and `export … from` counts over `git ls-tree --name-only <rev> apps/editor/src/lib/layout/`
at both endpoints; `git log --diff-filter=A` per new facade; `git grep -lE "from '@portfolio/layout-core'"`
vs ``git grep -lE "from '\$lib/layout/layout-"`` at `end`.

---

### C7 — Slice-numbered identifiers enter production code and the shared package API

**Inferred convention.** Diagnostics and bench helpers are named after the slice that created
them (`p2311*`, `__P2311_PERF__`, `p2311:` performance-mark namespace). They are exported from
the shared package root, and later slices reuse the slice-named API instead of a durable name.

**Occurrences.**
- **`6b71f53` (#51 P23.11, 09-15)** adds `packages/layout-core/src/p2311-perf.ts`, which:
  - exports `p2311Measure` and is re-exported by `layout-core/src/index.ts`;
  - reads `globalThis.__P2311_PERF__` and `import.meta.env.DEV`;
  - emits `p2311:<name>` marks.
- **#51 also adds** `apps/editor/src/lib/bench/p2311-bend-fixtures.ts` and
  `p2311-proxy-probe.svelte.ts`.
- **Hot-path use at `end`:**
  - `layout-geometry.ts` (compile: `room-geometry-compile`, `finite-thickness`);
  - `git grep -c 'p2311' b5f75e7` lines: `layout-wall-first-precision.ts` 16,
    `LayoutPlanViewport.svelte` 11, `layout-preview-state.svelte.ts` 14.
- **Reuse by a later slice:** `e951138` / `4cae710` / `bad5e89` (P23.15, 09-21) wrap the new
  compile stage as `p2311Measure('junction-resolution', …)`. They add
  `p2311Measure('standalone-wall-build', …)` to **both** `wall-mesh-builder.ts` copies. The QA
  record calls this "shipped `p2311Measure`".
- **Tests still bound to the slice namespace after the naming cleanup:** `bend-perf.test.ts`
  (8 references), `layout-transient-preview.test.ts`, `project-format-policy.test.ts`,
  `layout-snap-extent-parity.test.ts`.

**Recurrence.** Slice-numbered production **filenames**: 0 at `base`
(`git ls-tree -r … | grep -v /tests/ | grep -iE '/p[0-9]{2}'`), 3 at `end`. Identifier use
spreads across two later slices (P23.11 → P23.15). By contrast, slice codes in source
*comments* were already an established practice at `base` (155 `Pnn.n` mentions in 52 non-test
files) and grew to 1,490 in 200 files. That is context, not part of the candidate.

**Then-authoritative contract.**
- **09-15 (introduction):** no naming rule for source or tests in any contract.
- **From `38c5701` (#64, 09-20), `apps/editor/tests/README.md` rule 16:** "Prefer durable
  subsystem/contract names over roadmap/slice-era names once the behavior is a stable product
  contract."
  - Its scope is test design ("Test-design authority for adding/replacing tests").
  - The companion rename `cc0dc7f` renamed 114 test files "so a reader can find the owner
    without knowing the roadmap" and states "no production file touched".
- The P23.15 reuse (09-21) post-dates rule 16 but sits outside its stated scope (§3).

**Counterevidence.**
- The helper is dev-gated: `viteDev === false` short-circuits, and the flag is opt-in.
- The T5 cleanup shows slice naming was recognised and corrected where a rule applied.

**Limitations.** Whether rule 16 was meant to reach production code is not determinable from
its text.

**Provenance.** `git log -S'p2311Measure' f8411f7..b5f75e7`; `git grep -n 'p2311\|__P2311_PERF__' b5f75e7 -- packages apps`;
`git show -s --format=%B cc0dc7f`; `git show 38c5701:apps/editor/tests/README.md | grep -n 'Prefer durable'`.

## 3. Contradicted rules — separate set

A contradiction is reported only where a rule was **written before** the occurrence and the
occurrence is inconsistent with its text. The precedence in force at the time is stated,
because until `f7a31e2` (09-19) `AGENTS.md` rule 10 placed "source code + tests" first.

### Established

**X1 — The component persistence contract said "no version field, no migrations" while the
canonical formats and migrations were live (09-09 → 09-17).**
- **Rule:** `docs/components/persistence.md`, identical at `f8411f7`, `41a5cde`, `d41cfd5`,
  `810bc8c` and `368a799`:
  - "Scene: … One canonical shape; no version field, no migrations."
  - "Layout: … No version field; rooms always carry a finite `frame.origin` …"
- **Change:**
  - `13a96a0` (09-09) introduced wall-first `formatVersion` and compat scaffolding.
  - `41a5cde` (09-09) introduced migration and Scene `formatVersion: 1`.
  - `d36695c`/`d41cfd5` (#25, 09-12) introduced format 5.
- **Reconciled by:** `650f7c1` (#59, 09-18), which rewrote the contract to current/legacy
  language.
- **Precedence caveat:** during the window, the active P23.0 plan and "source code + tests"
  outranked component contracts under rule 10. By the rules then in force, the conflict
  resolved against the component text. This is a written-rule/implementation mismatch that
  lasted about nine days. It is not evidence of a rule being overridden against its
  precedence.

**X2 — `AGENTS.md` hard rules 2 and 3 named superseded sources of truth while P23 changed
them (09-09 → 09-17).**
- **Rule** (`AGENTS.md` last changed `69206f5` on 08-30; identical at `41a5cde`):
  - rule 2: "Architecture SoT today — `rooms.ts` until B4/B5 … layout must not drive `/museum`
    before those gates";
  - rule 3: "Scene SoT — `scene.json` v6".
  - The same file says it "wins for hard rules".
- **Change:** P23.0 made wall-first Layout and world-local Scene (`formatVersion: 1`)
  canonical from 09-09.
- **Reconciled by:** `650f7c1` (#59, 09-18) rewrote rules 2, 3 and 6.
- **Caveat, limiting evidential value:** the rules were already contradicted at `base`.
  `f8411f7:apps/editor/src/lib/content/rooms.ts` opens with "@deprecated Editor compatibility
  projection … no architecture is authored in this module", and the base persistence contract
  already said Scene had "no version field". P23 widened a pre-existing drift; it did not
  create it.

### Considered and not established

| Rule (and when written) | Tested against | Why not established |
| --- | --- | --- |
| Umbrella plan: move pure layout operations "into `layout-core` only when a real shared caller needs that boundary" (present at `f8411f7`) | C1 (41 planners, 1 with a non-editor caller) | Removed by `c123c23` (09-09 01:02) **before** the first occurrence (`b5427d8`, later 09-09). No replacement rule existed at the time of any occurrence. |
| North-star: proximity "never becomes implicit authored topology" (09-09); P23.9 plan: "If the snap winner is accepted, reuse that Junction ID" (at `5f20aaa`) | C2 | For snapped input the outcome equals ID reuse. Whether 1e-9 / exact coincidence is "proximity" is interpretive. UI run closure follows the plan's ID rule. |
| North-star pre-baseline policy: no tolerant historical decoders by default; exceptions documented (`b1929a3`, 09-12 13:44) | P23.12 optional-on-read ledger (C3) | Exception reasoned and documented in the active plan (§C3/§C11) with a product reason. The policy does not say where documentation must live. |
| Same policy: no "multi-version canonical types", no "compatibility-only visitor branches" for new schema work | Scene dual type (C4) | Introduced 09-09, before the policy. Post-policy occurrences consume the type rather than adding schema. |
| Architecture geometry boundary: no DOM / "UI state below the layout boundary" (whole range) | `layout-snap.ts` CSS-px radius and `pixelsPerMeter` (C1); `p2311-perf.ts` `performance` marks, `import.meta.env`, `globalThis` flag (C7) | These are parameters and dev-gated diagnostics, not held UI state or DOM handles. Text does not clearly cover them. |
| Test README rule 16, prefer durable names (`38c5701`, 09-20) | Test files added after `38c5701`; P23.15 `p2311Measure` reuse (C7) | No slice-named test file was added after `38c5701` (`git log --diff-filter=A 38c5701..b5f75e7 -- apps/editor/tests`). Production code is outside the rule's stated scope. |
| Persistence: door `connectsRoomIds` "explicit, validated, never inferred from geometry" (whole range) | `layout-room-reconciliation.ts:715-758`, migration, duplicate | Relations are remapped by reconciliation lineage, cleared on unambiguous disappearance, and otherwise rejected (`unresolved_portal_remap`). None is newly inferred. |
| Architecture hard don't: "infer room ownership/adjacency from coordinates" (whole range) | P23.8 face extraction and reconciliation (`7d9df94`) | Faces derive from Junction-ID connectivity plus role. Persistent Rooms over derived faces were ratified in the north-star on 09-09 (`a69d7bf`) before `7d9df94`. |
| Hard rule 4, visitor isolation (whole range) | Visitor and relic import the `layout-core` barrel, which now also exports planners/snap (C1) | Static visitor import specifiers are identical at both endpoints (mechanical Set 3). Chunk content was not built, so the question is open, not answered. |
| `apps/museum` "frozen" / `@portfolio/museum` "read-only" (whole range) | `41a5cde` relic runtime edits; 11 lockstep geometry edits (C5) | "Frozen" and "read-only" are not defined with respect to source edits. They can read as product and content freeze. |

## 4. Areas investigated where no meaningful candidate was found

- **Plan presentation pipeline.** New editor Plan modules (`plan-dimensions`,
  `plan-room-labels`, `plan-overlays`, `plan-salience`, `plan-attention`,
  `plan-architecture-grammar`) consume `PlanRenderModel`, compiled geometry and view
  transforms. None reads `LayoutDocumentWallFirst` collections directly: the
  `document.(walls|junctions|rooms|openings)` count is 0 in each. No app consumer evaluates
  wall cubics (`cubicBezierPoint`, `wallCurveChainCubics`, `spansToCubics` have no call
  sites in `apps/*/src`). This matches the architecture rule "no consumer resamples curves".
- **P23.15 junction resolution.** A representation and ownership change (compiled
  per-Wall resolved ends, material ownership, `junction_partition_failed`) was written into
  `reference/architecture.md` in the same work (`4cae710`, `ae3e724`, reconciled at `end`).
  The contract kept pace with the code.
- **Display identity (P23.12).** Behaviour (references, families, no reassignment, exact
  restore) is contracted in `reference/components/shell.md` "Display identity (P23.12,
  landed)", written from `650f7c1`. The side-table ledger and persisted `cursor` follow from
  the active plan (§C3/§C4 of the P23.12 plan). The one open representation question it
  raises is covered by C3.
- **Vertical authority and Wall orientation.**
  - `LayoutWall.height` is the sole vertical, the Floor has no extent, and a Room ceiling is
    the maximum of its boundary Wall heights (`d36695c`/`d41cfd5`).
  - Canonical Wall start→end is identity-bearing for Opening offsets (`13a96a0`).
  - Both are single deliberate decisions, plan-contracted when made, and consumed
    consistently. Neither is recorded in `reference/components/persistence.md` or
    `architecture.md` at `end` (`git grep` for `ceiling|wall.height|centerline|partition`
    over the contract paths at `d41cfd5` and `b5f75e7`). That is a reference-capture
    observation only. No competing shape formed, so it is not reported as a candidate.
- **No-op and history semantics** of planners ("`no_op` means no history"): contracted in
  `persistence.md` History ("no-op skips entry") and `placement.md` throughout.
- **Planner result shape** (`{ kind: 'rejected', rejection: { code, message } }`,
  snake_case issue codes): ordinary local implementation style with no competing shape.
- **Editor store write surface and format dispatch**
  (`document-format-policy.svelte.ts`): covered by mechanical Set 2. The dispatch
  implements `AGENTS.md` rule 2 as written from 09-18. No semantic shape beyond that was
  found.
- **Hierarchy navigator** (`lib/editor/hierarchy/*`, P23.6b/e): editor-only placement
  matches the architecture rule on hierarchy code.
- **Shell and visual system (P23.14).** The durable contract was ratified mid-range
  (`f7a31e2`, 09-19) with "one writable owner per fact" (`02744b2`), and landed with its
  implementation in #61. Post-ratification merges #62, #64 and #65 touched no non-test app
  or package source. #63 (`eb309a4`) extracted `plan-keyboard-readout.ts` and
  `plan-keyboard-session.ts` out of `LayoutPlanViewport.svelte`. That is a local
  extraction with no competing ownership shape. This area was sampled, not read exhaustively
  (see §5).
- **`apps/api` and `packages/camera-core`.** No `apps/api` change in range. `camera-core`
  changed by +5/−1 in `scene-types.ts`.

## 5. Limitations of this review

- **One reviewer, one pass, static reading.** No build, bundle, test or runtime exercise was
  run. Every claim is a source, diff or contract-text fact at a named revision.
- **Coverage is targeted, not exhaustive.** 418 changed source files cannot all be read. I
  read module headers, exported surfaces and the specific sites cited, chosen by diffstat
  weight and module-introduction history. A representation choice made quietly inside a
  large file (`LayoutPlanViewport.svelte` +4,234, `EditorInspector.svelte` +2,089) without a
  distinctive name or comment could be missed.
- **Granularity.** 19 of 45 PRs are squash-landed. P23.12 landed through a non-PR merge of
  `main` (`c2a2404`), and some commit messages carry little rationale (for example `810bc8c`).
  Intent was taken from plans in force at the time where commit text was thin.
- **Contracts at the time include active plans** because `AGENTS.md` rule 10 made them
  authoritative until 09-19 and slice-authoritative after 09-20. Only the plan sections cited
  were read, not whole plans.
- **Probe precision.** Regex probes are recorded with their commands. Two are over-inclusive
  and labelled so: the C4 `roomId`-presence count, and C6 import-style counts by specifier
  text. `git grep -E` word boundaries (`\b`) were not relied on; `-w` was used where needed.
- **Out of scope by the frozen range.** PR #74, P24/P25/P26 planning, pre-range P23 research,
  PR review discussion, agent-session evidence, and any other reviewer's work.
- **Zero-finding areas are bounded by the reading above.** "No candidate found" means none
  was found by this method, not that none exists.

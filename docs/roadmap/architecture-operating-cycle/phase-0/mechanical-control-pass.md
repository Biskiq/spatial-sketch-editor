# Phase 0 — mechanical control pass

```text
SCOPE:   three already-meaningful bounded structural sets, measured at both ends of the frozen
         retrospective range; no set was built for this pass
ROLE:    Phase-0 evidence, mechanical lane. Input to owner adjudication.
NOT:     A/B/C/D classification · mechanism recommendation · architecture ratification ·
         a second tracker · a status field · a contract
RANGE:   f8411f7f0dc8cd0bb8e05683259d7c2aa6a9fdbb .. b5f75e7ecba5149ed03a26237402ba5a41266372
         (frozen retrospective range — ./2026-09-22-P0-frozen-evidence-range.md)
STATE:   docs/operations/architecture-cycle.md is the sole live meta-state authority
METHOD:  ../../architecture-operating-cycle-plan.md §8 "Mechanical control pass"
```

This pass asks one question of each set: **did an already meaningful bounded structural set expand
or change between the two endpoints of the frozen range?** Every number below is an observation
about those two revisions. **Every comparison here is a two-endpoint comparison:** membership is
read at `base` and at `end`, and "unchanged" / "identical" always means "the same at those two
revisions" — never "nothing moved inside the range". A set that expanded and contracted mid-range
reads as unchanged here, and no per-set time series was built (see Coverage limitations). No
observation here is a finding about architecture, and none is classified — classification is the
owner's, at adjudication. A set that did not change is recorded as plainly as one that did.

## Method

Every probe is a `git ls-tree`, `git grep` or `git log` invocation recorded verbatim with its result,
run against the two frozen revisions and nothing else — `git grep <sha> -- <pathspec>` reads the
commit's tree, never the working directory. No analysis framework was written and no script was
committed. Test files are excluded from the code sets and counted separately, because a test that
names a concept is not that concept owning code.

Provenance discipline: each reported number states its source, its command, the revision range, and
what the check cannot establish. Where a set's membership is decided by a filename pattern, that is
stated as the limitation rather than hidden — a name-based set is a *named surface*, not the whole
surface.

**Count labelling.** A reported number is one of three things, and the tables now say which:

- **probe output** — the printed command, run exactly as printed, prints that number;
- **derived** — a filter, de-duplication or subtraction step applied to probe output, with that step
  printed next to the number (for example counting distinct exported names rather than grep lines);
- **inspection-derived** — read out of the tree by hand, because no single printed command produces
  it. Labelled so it is not mistaken for reproducible probe output, and its derivation is stated as
  *not reproducible from this document* where that is the case.

A label the printed command does not produce is a defect, not a rounding difference. Where a label
and its command disagreed, the correction is recorded below and the command is printed with the
filter it needs.

Two probes were corrected mid-pass, and the corrections are recorded because they changed numbers
(the corrected commands are the ones printed below):

- the codec/module pattern was first anchored to the token immediately before `.ts`, which silently
  dropped `compat-runtime.ts` and `standalone-scene-import.ts` from the end set. The final pattern is
  a substring match on the module path;
- a first write-path probe on `.replace(` matched `String.replace` throughout the editor and was
  discarded in favour of the host-and-document-qualified form below.

A later review of this artifact corrected four labels and one number. None of them changes a measured
set; they are recorded because a reader must be able to recompute every number from the printed
commands:

- the `formatVersion` file count was labelled **non-test** while the printed probe carried no test
  filter. The filter is now printed on the probe, and both totals are reported (2 → 109 unfiltered;
  0 → 32 non-test). The reported 0 → 32 was correct and is unchanged;
- the test-file row reported **6 → 14**. The printed probe yields **5 → 13** at the endpoints, and
  the artifact's own narrative names exactly 8 end-only guard files against 5 shared ones. The row
  is corrected to 5 → 13;
- the exported write-side row reported **15 → 17** without stating how it was produced. 15 → 17 is
  the count of **distinct exported names**; the printed probe without de-duplication prints 19 → 21
  lines. Both counts are now printed with the row;
- the explicit-constant row mixed a probe count with a hand-derived one in a single `+4` cell. It is
  split into a probe row (0 → 3) and a labelled inspection row (0 → 1), and the packages-only
  `FORMAT_VERSION` row now carries the probe that produces it.

Ranges are abbreviated `base` = `f8411f7`, `end` = `b5f75e7` throughout.

## Set 1 — persisted format / schema surface

Selected because the range's declared theme (P23, "one authored project, two domains", a wall-first
canonical format) is expressed exactly here: which shapes persist, under which identity, and which
compatibility paths accept what. It is cheaply observable — the surface is named, exported and
greppable.

### Probes

```bash
git grep -lE 'formatVersion' <rev> -- packages apps | grep -vE '\.test\.|\.spec\.|/tests?/'   # non-test
git grep -nE "export const [A-Z_]+FORMAT_VERSION" <rev> -- 'packages/*' 'apps/*'      # probe-matched
git grep -lE 'FORMAT_VERSION' <rev> -- 'packages/*' | grep -vE '\.test\.'            # packages only
git ls-tree -r --name-only <rev> \
  | grep -E '(codec|compat|legacy|standalone|shipped-static)' | grep -E '\.ts$' | grep -v '/tests/'
git grep -hE "^export (async )?function [A-Za-z]*([Cc]ompat|[Ll]egacy|[Vv]ersionless|Decode)[A-Za-z]*" \
  <rev> -- 'packages/*' 'apps/*'
git ls-tree -r --name-only <rev> -- apps/editor/tests | grep -iE 'format|codec|compat|migration'
```

### Observation

| Measure | base | end | Change |
| --- | --- | --- | --- |
| Files mentioning `formatVersion` — probe output, non-test | 0 | 32 | +32 |
| ↳ the same probe before its test-exclusion step | 2 | 109 | +107 |
| Explicit `*_FORMAT_VERSION` constants — probe output | 0 | 3 | +3 |
| ↳ derived version constant — inspection-derived, the probe's regex does not match it | 0 | 1 | +1 |
| Packages modules mentioning a `FORMAT_VERSION` constant, non-test — probe output | 0 | 10 | +10 |
| Named codec/compat/legacy modules (non-test `.ts`) — probe output | 13 | 21 | +8, −0 |
| Exported compat/legacy/decode entry points — probe output | 1 | 9 | +8 |
| Test files naming format/codec/compat/migration — probe output | 5 | 13 | +8 |

Row provenance, because a count is only usable with it: the `probe output` rows are the printed
commands run as printed; the `↳` rows are the two derived/inspection rows the Method section
describes. The packages row is packages-only **by construction** — the eleventh non-test module
mentioning the constant, `apps/editor/src/lib/editor/store/document-format-policy.svelte.ts`, sits
in the editor app and is outside that row's pathspec — and it counts modules that *mention* the
constant, declaration sites included, so it is a mention census, not a reference-site census. All
six Set-1 `probe output` rows stay reproducible from the block above, one printed probe per row;
the one inspection row does not, and says so. All rows are two-endpoint readings.

At `base` the range's own base commit contains **no** `formatVersion` occurrence outside tests and
no format-version constant: persisted identity was carried by shape alone. At `end`:

```text
LAYOUT_WALL_FIRST_FORMAT_VERSION = 5      packages/layout-core/src/layout-wall-first-types.ts:49   probe
KNOWN_LAYOUT_FORMAT_VERSIONS = [LAYOUT_WALL_FIRST_FORMAT_VERSION]
                                          packages/layout-core/src/layout-wall-first-types.ts:52   derived
PACKAGE_MANIFEST_FORMAT_VERSION = 2       packages/project-model/src/package-format.ts:14       probe
SCENE_WORLD_LOCAL_FORMAT_VERSION = 1      packages/project-model/src/scene.ts:383               probe
```

`KNOWN_LAYOUT_FORMAT_VERSIONS` is the `+1` inspection row: it is plural and built from the constant
above it, so the `export const [A-Z_]+FORMAT_VERSION` regex does not match it. It is the only constant
listed here that the probe does not itself find, which is why the row that carried it was split.

The eight modules added to the named set (no module removed — the base set is a strict subset of the
end set):

```text
apps/editor/src/lib/layout/layout-compat.ts                packages/layout-core/src/layout-compat.ts
apps/editor/src/lib/layout/layout-wall-first-codec.ts      packages/layout-core/src/layout-wall-first-codec.ts
apps/editor/src/lib/project/compat-runtime.ts              packages/project-model/src/compat-runtime.ts
                                                          packages/project-model/src/project-compat.ts
                                                          packages/project-model/src/standalone-scene-import.ts
```

Eight of the nine compat/legacy entry points are new; `legacyBezierToAutoBezier` is the one that
existed at `base`. The guard set grew in step: `project-format-writers`, `project-format-policy`,
`project-format-visitor-parity`, `project-format-writer-fixtures`, `layout-migration`,
`layout-migration-math`, `layout-wall-first-codec` and `project-compat` test files are all end-only —
those 8 end-only files against the 5 naming files already present at `base` are exactly the 5 → 13
test-file row above.

### Provenance anchors

All Set-1 additions land on **2026-09-09**, the first full day of the range, and all of them belong
to the P23.0 wall-first foundation work:

```text
13a96a0  2026-09-09  feat(P23.0a): wall-first schema + explicit format compatibility scaffolding
                     → scene-format.ts · layout-wall-first-codec.ts · layout-compat.ts · project-compat.ts
21c8657  2026-09-09  Stage 1 wriing p23            → document-format-policy.svelte.ts
b5427d8  2026-09-09  P23.0 F0 stage 2: canonical writers (planners, Save writer, manifest version)
2c9b04d  2026-09-09  P23.0 F0 stage 4: shared compat runtime preparation for Preview and visitor
0d66aed  2026-09-09  P23.0 F0 stage 5: standalone scene import, portal save-blocker, no-second-transform regression
41a5cde  2026-09-09  feat(P23.0b): legacy-to-wall-first migration + compiler/runtime cutover
```

### What this check cannot establish

- **That any individual compatibility path is reachable, exercised or correct.** The probes count
  named members of a set; they do not run the codecs. A compatibility path that exists but is
  unreachable is indistinguishable here from one that is live.
- **That the surface is *complete*.** Membership is decided by filename for the module set and by
  identifier for the entry-point set. Compatibility work carrying no compat-ish name, or performed
  inside a differently named module, is invisible to both.
- **Whether the expansion was deliberate.** The distinction between intended-but-unrecorded and
  recording-by-implementation is exactly the classification this pass withholds.
- **Semantics of the rejected-input surface.** The count of `unsupported_format_version` sites is not
  reported here, because a count of rejection messages says nothing about which inputs are accepted.
- **Anything about the `.scenepack.zip` container beyond its manifest constant** — the package/import
  orchestration in the editor was not enumerated.

## Set 2 — canonical document-writer surface

Selected because the range's own naming concentrates writes into few places (a document store, a
layout host, and a set of mutator modules), which makes "did the number of ways to write the
document grow?" cheap to ask with existing tooling.

### Probes

```bash
git grep -nE '(document|documentStore|host|Host|#layoutHost|layoutHost|state)\.replace\(' <rev> \
  -- 'apps/editor/src/**/*.ts' 'apps/editor/src/**/*.svelte'
diff <(git ls-tree -r --name-only <base> -- apps/editor/src/lib/editor/store | sed 's|.*/||' | sort) \
     <(git ls-tree -r --name-only <end>  -- apps/editor/src/lib/editor/store | sed 's|.*/||' | sort)
git grep -hE "^export (async )?function (serialize|encode|write|to)[A-Za-z0-9]*" <rev> \
  -- 'packages/*' 'apps/editor/src' 'apps/museum/src'
```

### Observation

| Measure | base | end | Change |
| --- | --- | --- | --- |
| Host-qualified `.replace(` code sites | 10 | 10 | none |
| Files carrying those code sites | 2 | 2 | none |
| Comment references to the same call | 0 | 2 | +2 (comments only) |
| `apps/editor/src/lib/editor/store/` modules | 21 | 22 | +1, −0 |
| Exported write-side entry points — distinct exported names (derived); the same probe un-deduplicated prints 19 → 21 lines | 15 | 17 | +2, −0 |

The host-write surface is **unchanged between the two endpoints**: the same ten code sites in the
same two files (`editor-store.svelte.ts` once, `history-controller.svelte.ts` nine times), with only
line numbers shifted. The end tree adds two comment references to the same call
(`LayoutPlanViewport.svelte`, `layout-preview-state.svelte.ts`) and no code site, so counting raw
grep lines at `end` yields 12 where counting code sites yields 10. The store layer gained exactly one module and lost none —
`apps/editor/src/lib/editor/store/document-format-policy.svelte.ts` — whose own header describes it
as the central document-format dispatch that funnels both authoring transaction domains through one
guard call each. The two added write-side entry points are `serializeWallFirstLayoutDocument` and
`serializeWallFirstProject`; nothing was removed, so `serializeLayoutDocument`,
`serializeSceneDocument`, `serializeProject` and `serializeBaseline` all still exist at `end`.

The write-side row is the pass's clearest derived count, and it is labelled as such: the probe
prints **lines**, and three names are declared in more than one module (`serializeProject` three
times, `serializeSceneDocument` and `toWallBufferGeometry` twice), so it prints 19 lines at `base`
and 21 at `end`. De-duplicating to distinct exported names gives the reported 15 → 17. No name was
dropped from the set to get there; the de-duplication step is `| sed 's/(.*//' | sort -u | wc -l`,
appended to the probe printed above.

### What this check cannot establish

- **That the write-side entry-point set is what its name says.** The `write*`/`to*` prefixes also
  catch non-document helpers (`writeEditorCameraFrustumLinePositions`, `writePlacementTransform`,
  `toWallBufferGeometry`, the `toggle*` UI switches). The 15 → 17 numbers — distinct names, as the
  row now states — are therefore a deliberate over-inclusive superset, not a document-writer census;
  only the two *additions* were inspected, and both are serializers.
- **Growth *inside* an existing writer.** Module and symbol membership is blind to a writer doubling
  in size, gaining branches, or acquiring a second responsibility without a new name.
- **Whether a write path exists that is not a host-qualified `.replace(`.** The store's own comment
  asserts that all mutators funnel through the facade; that claim is asserted in source, and this
  pass did not verify it. A document mutation reaching the store by another route is invisible here.
- **Transaction/guard coverage.** The pass observed that a dispatch module exists; it did not check
  which mutation paths route through it, nor whether any path is unguarded.

## Set 3 — visitor/editor dependency boundary

Selected because it is the range's most load-bearing structural invariant (visitor isolation, no
editor code in visitor chunks) and because it is decidable from imports alone.

### Probes

```bash
SCOPE='apps/editor/src/lib/visitor/**' 'apps/editor/src/routes/museum/**' 'apps/editor/src/routes/p/**' 'apps/museum/src/**'
git grep -cE "from ['\"][^'\"]*lib/editor|from ['\"][^'\"]*/editor/" <rev> -- $SCOPE
git grep -hE "^\s*import .*from ['\"]" <rev> -- $SCOPE          # → distinct specifier set, both revs
git grep -nE 'import\(|require\(' <rev> -- $SCOPE                # dynamic reach
git grep -nE "from ['\"](@portfolio/editor|@biskiq/|editor)" <rev> -- $SCOPE   # alias reach
```

### Observation

| Measure | base | end | Change |
| --- | --- | --- | --- |
| Editor-scope imports from visitor/museum scope | 0 | 0 | none |
| Distinct import specifiers from that scope | 31 | 31 | **identical at the two endpoints** |
| One-level transitive reach from those imports into `lib/editor` | 0 | 0 | none · inspection-derived |
| Dynamic `import()` / `require()` in that scope | 0 | 0 | none |
| Bare `@portfolio/editor` reach from that scope | 0 | 0 | none |

The two endpoint specifier sets diff **empty** — 31 specifiers from 21 files in that scope at
`base`, and the same 31 from the same 21 files at `end` (counted with `git grep -l`; `git ls-tree`
does not expand these `**` pathspecs in this environment, so it is not the source of the file
count). Stated precisely, because the wording matters: this is a two-endpoint result. It shows the
specifier set is identical at the two revisions measured; it does **not** show that no specifier was
added and removed inside the 432 commits between them, which this probe cannot see. The one-level
transitive-reach row above is inspection-derived — no command in this document produces that count —
so unlike the four probe rows it is not reproducible from the artifact, and the direct-dependency
walk it rests on is not reconstructable here. The visitor scope's imports resolve to `$lib/content`,
`$lib/layout` (geometry and wall-mesh only), `$lib/project` (codec and types), `$lib/render`
(wall-geometry adapter), `$lib/types`, `@portfolio/camera-core`, `@portfolio/project-model` and
`three`, plus relative siblings. The guard files also hold: `visitor-import-boundary.test.ts` and
`public-surface-boundary-plugin.ts` (both present at base) plus `visitor-identity-isolation.test.ts`
and `tests/vite/public-surface-boundary-plugin.test.ts` (end-only).

### What this check cannot establish

- **A rule about the shared `$lib` families.** "Editor scope" here means the `lib/editor` path
  family. Visitor code legitimately imports `$lib/layout/*` and `$lib/project/*`, which are
  editor-app-local modules outside it; this pass records that shape and expresses no rule about it.
- **Deep transitive reach.** Transitivity was checked **one level**, over the visitor scope's own
  direct dependencies. A chain of three or more modules reaching editor scope is not covered.
- **Chunk-level truth.** Import edges are static source facts. Whether an editor module actually
  lands in a visitor bundle depends on the build, and no bundle was produced or inspected.
- **Test and dynamic-route reach.** Visitor routes were included by path, but a route or test that
  reaches editor code through a framework mechanism rather than an import statement would not appear.
- **Only 21 files carry static imports at all** in that scope. Files with no import statement
  contribute to neither the 0 nor the 31, and the set is small enough that one added import in a
  new file would move it materially.

## Guard surface across all three sets

A cross-set observation, stated factually: the durable architecture lane itself did not exist at
`base`. `apps/editor/test-lanes.ts`, which carries the curated `ARCH_FILES` list, was added on
**2026-09-20** by `9c837a9` ("test: add fast arch heavy perf lanes") and holds 23 entries at `end`.
The boundary tests it curates were *not* absent at `base` — `visitor-import-boundary.test.ts`,
`project-model-boundary.test.ts` and `public-surface-boundary-plugin.ts` all existed there — so the
lane-curation change is a change in how checks are grouped and labelled, not in whether checks
existed. Any comparison of "guards at base vs guards at end" must be made against the curated lane
*and* the plain test tree; the lane alone understates the base.

## Coverage limitations

- **Two endpoints only.** Change is measured between `base` and `end`. A set that expanded and
  contracted mid-range — or oscillated — reads as "unchanged" in these tables. The
  `2026-09-09` concentration in Set 1 is visible only because an introducing commit was looked up
  for the added members; no per-set time series was built. Every "unchanged", "identical" and
  "no module removed" statement above is a two-endpoint statement and inherits this limit: none of
  them is evidence about the 432 commits between the endpoints.
- **Merged-PR granularity, code-only reach.** Probes read the final tree at each endpoint. Nothing
  here observed review behaviour, and PR discussion is not consulted (frozen-range rule).
- **Path- and name-based membership throughout.** Each set's boundary is a path family or a filename
  pattern, chosen before the numbers were known. Renames register as membership change; work inside a
  differently-named module registers as nothing.
- **Tests excluded from code sets.** Non-test membership only, with test-file counts reported
  separately. A concept that exists solely as test scaffolding therefore does not appear in Set 1.
- **No count is a conclusion.** Three tables of numbers, several of which are zero, are a measurement
  of set membership — not a statement about whether any behaviour was right, deliberate, or managed.
- **Not a substitute for the semantic reviews.** This pass covers three structural sets. It says
  nothing about representation, ownership or naming choices, which is the semantic lane's question,
  and it does not claim to explain anything the reviews will find.

## Status of this pass

```text
PASS:      complete, one run, over the frozen range at both endpoints
CARRIED:   none — every probe reported here terminated in the numbers shown
OWED:      nothing further from this lane; it is complete evidence, not a partial one
UNCHANGED: PHASE_0_ACTIVE — this pass does not advance, transition or adjudicate anything
```

The two semantic reviews and the structural-workflow diagnostic remain owed and unrun. Nothing in
this document is classified, and no candidate is proposed: the owner adjudicates, and per §8 the
mechanical result is one input to that, not a decision.

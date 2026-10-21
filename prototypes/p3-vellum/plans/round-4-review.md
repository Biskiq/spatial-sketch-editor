# Round 4 — what is done, for review

A reading guide for the implementation behind [effortless-creation.md](effortless-creation.md). Every claim below was
re-checked against the commit it names, not remembered: the per-commit test counts come from checking each commit out
into a scratch worktree and running that commit's own suite (commands at the end).

Three things to know before reading:

- **The newest batch is `eb1095e6`.** The offer cards, the group cover and their tests were written after the commit
  that documents Phase 0, and committed on request once they were green; §6 is that commit. This report itself is
  the commit after it.
- **§6b is a correction, not a claim.** Six review findings (unsupported roofs committed and drawn single-span, posts
  standing in their own stair, headroom through ceilings and width, the cottage conclusion, the resize guard's
  coordinates, and id-only revalidation) were reproduced and then fixed in the working tree after this report was
  first written. That section replaces the affected sentences above it; the fixes are the commit
  `fix(p3-vellum): one answer for what a cover and an offer may claim`, straight after this report.
- **§6c is open work, not a claim.** A review of `ff117342` found four more corrections (F1–F4) and reproduced each
  of them. F1–F3 come before Phase 2 is wired, and F4 before any gesture calls the resize guard.
- **Only the model and the offer cards are claimable.** Hold's pointer lifecycle, the Edit Shape sheet, ink and the
  pen tips are designed in the plan and absent from the code. Nothing here is a Round 4 acceptance claim.

---

## 1. The commits, in order

| Commit | Date | What it proves | New code / tests | Suite at that commit |
| --- | --- | --- | --- | --- |
| `bc4299af` | 2026-10-21 | Compound roof geometry for L, T, U and plus plans | `wings.ts` 520, mesher `scene/build/overheads.ts` 512, `tests/wings.test.ts` 440 | 10 files, **79 tests** |
| `c547526e` | 2026-10-21 | The section model: joints, families, validated edits | `section.ts` 736, `tests/section.test.ts` 506 | 11 files, **127 tests** |
| `258127e0` | 2026-10-21 | Hold zones and detents, pure and unwired | `roofZones.ts` 315, `detents.ts` 113, `tests/zones.test.ts` 285 | 12 files, **151 tests** |
| `2a5fa0e5` | 2026-10-21 | Qualified mezzanine and stair offers, with the cottage fixture | `offers.ts` 522, `tests/offers.test.ts` 159, `tests/journey.test.ts` 161 | 14 files, **165 tests** |
| `96bc7d32` | 2026-10-21 | The plan's status rewritten from evidence | `plans/effortless-creation.md` 1535 | 14 files, 165 tests (docs only) |
| `eb1095e6` | 2026-10-21 | Group cover, offer cards, commit-time revalidation | see §6 | 14 files, **171 tests** |

`7a95f40f` immediately before this sequence is a `chore` that adds `scene/build/{geo,parts,walls}.ts` to git; it
contains no behaviour change to review. `7061a385` ("Vellum update") is the earlier rename of
`P3-Claude` → `p3-vellum` plus `ProfilePad` and snapping, i.e. the prototype's starting point, not part of Round 4.

---

## 2. `bc4299af` — compound roofs (Phase 5's model, and its headers)

**The problem it removes:** a roof stretched across a whole L/T/U outline used to leave 1.0–1.4 m cliffs at the inner
edges, because one section cannot be scaled across a non-convex plan.

**What to review:**

- `src/model/wings.ts` — the decomposition is a *candidate* that must qualify: edges within 2° of the frame, at most
  four rectangles, no stepped or asymmetric section, and no wing whose scaled peak rises above the roof it joins. It
  returns a plain reason when it refuses, so a refusal is never mistaken for geometry.
- `src/scene/build/overheads.ts` — the mesher builds the per-cell upper envelope from the same evaluator `ohH` uses,
  which is why mesh and evaluator agree within 5 mm in the tests rather than by coincidence.
- `oneSpan` is opt-in. An absent `oneSpan` leaves every previously saved roof exactly single-span, so no saved project
  changes behaviour.
- `continuedWings` is the resize guard: same massing within 8 cm survives a resize, otherwise the change is refused
  with a reason so the caller can hold its last valid preview instead of previewing a primary-wing jump. **Two
  corrections in §6b:** the comparison now ignores a pure translation, and nothing calls the guard yet — no gesture is
  protected by it.

**Not in this commit:** the Hold zones over wings, the Settings toggle and the group-cover card all come later or not
at all; nothing in this commit touches the pointer.

---

## 3. `c547526e` — the section model (Phase 1)

**What to review:**

- Every edit is recomputed from the gesture-start snapshot and passes one idempotent validator *including ids*, so a
  preview and a commit are the same function on the same input — the property the sheet and 3D handles both rely on.
- An invalid candidate is not committed; the limit is named in words ("at the eave", "close step", "straight slope
  limit"). Check the message list in `section.ts` for whether the wording is one you would say out loud.
- The tidy rule only drops a redundant smooth point whose removal moves the sampled curve under 1 cm, so a real bow
  survives tidying. There is a test that a genuine bow is *not* tidied away.
- The nearest-preset reading is bounded by `PRESET_TOL(span) = max(0.12 m, 0.035 · span)`, tested in both directions
  and across spans, and step topology is preserved — a distant shape is never given a preset's name.

**Not in this commit:** there is no sheet, no pointer, and no route into these functions from the UI.

---

## 4. `258127e0` — Hold zones and detents, model only

Zones answer "what is the pointer over" on a single-span *and* a compound roof (ridge, ridge end, end face, slope,
eave, plus the wing parts actually visible). Detents answer "where should the drag click": structural stops before
pitch stops, with 45°, even-hip, ends-meeting and a truly-straight limit, plus hysteresis so a stop does not flicker at
its capture edge.

**This is deliberately half a phase.** The commit message says it: nothing is wired to the pointer; the highlights,
handles, readout, card hint and cancellation lifecycle are still Phase 2's UI work. Reproduce the gap with
`grep -r "zoneHandle" src` (no matches).

---

## 5. `2a5fa0e5` — offers, with the cottage as the fixture (Phase 6's qualification)

**What to review:**

- The offer exists only when a deck outline *and* a stair both qualify against the real roof surface: 2.40 m clear
  below the 0.30 m slab, 2.10 m above it over the whole footprint, 5 m² with a 2.0 m short side and a 1.2 m neck, and
  a 1.3 m stair that reaches the deck edge and lands on a floor.
- The candidate set was widened here, and the reason matters: end strips alone rejected a room whose clear floor sits
  in the middle of a steep roof, so there is now a 0.25 m lattice scan, maximal rectangles with a 0.12 m margin, and
  3–6 m bands from either end so a stair can still approach along the loft. Test `previews equal the committed
  outline` is the guard that preview and commit describe the same deck.
- `tests/journey.test.ts` is the plan's cottage built from operations: two rooms, one grouped cover with wings, ridge
  at 45°, even hip, bowed section, 0.6 m overhang. **Corrected after review:** at a 3.0 m wall top with the default
  flat ceiling it offers nothing (0.30 m over the deck); with the same 3.0 m walls opened to the roof it qualifies
  **two 12.9 m² lofts at 2.285 m**, and that clearance is the hip's. At 5.0 m with a flat ceiling it offers two
  30.6 m² lofts at exactly 2.30 m — the ceiling, not the hip (the roof over them is >3.1 m clear). So the taller room
  is one route, not a requirement, and the 4.80 m arithmetic belongs to the flat-ceiling route.

**The honest weak point to scrutinise:** these are fit heuristics, not construction code, and the mezzanine thresholds
are constants (`MIN_BELOW`, `MIN_ABOVE`, `MIN_AREA`, `MIN_NECK` in `offers.ts`) chosen by the plan, not measured
against anything external.

---

## 6. `eb1095e6` — offer cards and the group cover

Files: `src/model/derive.ts`, `src/model/ops.ts`, `src/ui/Inspector.tsx`, `tests/model.test.ts`,
`tests/offers.test.ts`, `tests/journey.test.ts`, `plans/effortless-creation.md` (+357 / −40).

**Model.**

- `coverGroup(d, roomId)` walks derived wall pieces and joins only rooms on the same level, still unroofed, with a top
  within 0.3 m of the *starting* room's top (not the previous room's, so a chain cannot drift), through a shared piece
  of at least 0.3 m. Start first, rest name-ordered, so preview and commit name the same group.
- A room is added only if the group still unions into one shape with no hole: a ring around a roofed courtyard stops
  one room short instead of roofing the court. Verified as load-bearing — with the guard removed, the new test fails.
- `opAddMezzanine` and `opAddStairTo` revalidate the candidate at commit time and refuse a stale one with a note
  instead of placing anything. A mezzanine is committed with the posts its own support rule asks for, so it does not
  arrive as a "nothing under…" issue the newcomer has to repair.
  **Corrected in §6b:** revalidation by id alone was not enough, and the original post layout could stand in the
  stair it came with.

**UI.** `RoomCard` headlines *Cover A and B* / *Cover all N rooms*, hover-previews the whole grouped roof, and offers
*Only A*. `DeckCard` gains *Getting up here*. The cards read their offers from the **committed** project — a hover
preview used to hide the very chip under the pointer, which made the click impossible.

**How to review it in the browser.** `npm run dev` (port 5191), open the *Galleries* sample, select *West gallery*:
the chips read *Cover all 3 rooms*; hovering *clerestory* previews one roof over all three while the chip stays put;
clicking makes it in one undo step with the toast *Covered West gallery, East gallery, Middle gallery …*; *Only West
gallery* narrows to one room. On *Compression and release*, select *The hall*: **+ Add a mezzanine** commits a deck and
its posts in one step and selects it, and the deck card then offers a 1.30 m stair which disappears once it is built.
After §6b, the same check on an L shows *raked* and *clerestory* disabled with their reasons and *flat* / *gable* /
*vault* live; committing the mezzanine clears its own stair by 0.98 m (half width 0.65 m).

**Known gap in this batch:** the courtyard/island guard is on the *group* path only. A freehand-drawn outline can still
swallow a courtyard, because `coverOutline` keeps just the largest ring. That is recorded in §8.7 of the plan and is
the next geometry fix, not a hidden failure.

---

## 6b. Corrections after review (committed after this report)

Six findings were reproduced against the code above, then fixed. Each is now a test in
`tests/qualification.test.ts` (five) or `tests/journey.test.ts` / `tests/wings.test.ts` (one each).

| Finding | Reproduced as | Fix |
| --- | --- | --- |
| **Unsupported roofs still committed and drawn single-span.** A grouped clerestory over an L is unsupported, yet the op reported success and the mesher quietly used `buildSingle` (mesh area 120.66 m² = outline area). | `runTxn` over an L with `{ wings: true }` | `coverCheck` is the one answer for chip, preview and commit; `opCoverRooms` refuses, places nothing and spends no id; the chip is disabled with the reason; `derive` reports a saved one and `buildOverhead` draws no surface rather than one stretched span. Flat is exempt from wings because it is the same surface. |
| **The mezzanine's posts crossed all three of its stairs** (nearest post to the offered stair: 0.00 m, half width 0.65 m). | `opAddMezzanine` then `stairCandidates` on a 10×6 flat-roof room | The stair is chosen first, posts are packed into the stretches it does not use, and the stair is re-checked against those posts. Measured after: nearest post 1.63 m from the stair's centre line in the 10×6 flat case (half width 0.65 m), 0.98 m in the L exercised in the browser, and the same stair id is still offered after the commit. `postsUnder` is now part of the offer, not the op. |
| **Stair headroom ignored flat ceilings and the stair's width.** With a ceiling at 3.0 m, roof at 5.2 m, deck at 2.7 m: three stairs qualified with 0.30 m clear at the top. | `stairPlansFor` under a flat ceiling | Headroom is sampled at the centre line and both edges of the 1.3 m walk, capped by the landing room's flat ceiling. The ceiling case is now refused, and a test places a low strip beside a run so the centre line passes but the width does not. |
| **The cottage conclusion was wrong.** The 3.0 m cottage *opened to its roof* offers two 12.9 m² lofts at 2.285 m; the 5.0 m flat fixture offers 30.6 m² at exactly 2.30 m, i.e. its ceiling, so it proves nothing about the hip. | `mezzanineOffer` on `cottage(3, 'follow')` and `cottage(5, 'flat')` | `cottage()` takes the ceiling; the open-to-roof case is fixtured as the hip-constrained one (the reported clearance equals the lowest hipped underside over the footprint), the 5 m case is fixtured as ceiling-limited, and the plan's "taller room is required" is corrected to "one route". |
| **The resize guard compared absolute coordinates,** so translating an unchanged roof by 1 m was refused as "different massing", and it has no runtime caller. | `continuedWings(prev, translated)` | The comparison removes the outline's translation in the roof's frame first; a translated roof is kept, a different plan is still refused. The plan and this report now say it is model-only, with no gesture calling it. |
| **Id-only revalidation committed a different stair.** Moving a deck 20 cm kept the plan id `stair:1:0.50` with a path 20 cm away, and the op committed it silently. | stale `StairPlan` against a moved deck | Both ops compare the previewed geometry exactly (ring, height, surface refs) and refuse with *"That stair moved since it was offered… hover the offer again"*; a fresh preview commits exactly. The same guard covers a doctored mezzanine outline. |

Suite after the fixes: **15 files, 181 tests**, typecheck and build clean. The six fixes and this section went in
together, as `fix(p3-vellum): one answer for what a cover and an offer may claim`; until that request the plan's
no-commit-unless-asked rule held.

---

## 6c. Next corrections — open, for the implementing agent

Reproduced on `ff117342` (181 tests green) with a scratch script. **None of these is fixed yet.** F1–F3 come before
Phase 2 is wired to the pointer: Hold will make the unsupported wing state common (a steep pitch on an L, a section
dragged asymmetric), so that state has to be safe and repairable first. F4 comes before any gesture calls
`continuedWings`.

Each fix lands with its test in `tests/qualification.test.ts` (F1–F3) or `tests/wings.test.ts` (F4); typecheck, the
suite and the build stay green. No commit unless the owner asks.

### F1 — a roof with no surface has no heights

**Reproduce.** `L(3)` from `tests/qualification.test.ts`, both rooms `ceiling: 'follow'`, then
`opCoverRooms(ids, 'gable', { wings: true })`: compound, walls up to 6.12 m. Then
`opOverhead(id, { profile: presetProfile('raked', ohSpan(oh)) })`, which the profile pad can do today. The state
becomes `unsupported` ("the section has no ridge") and `buildOverhead` returns empty geometry, but:

- the walls still rise to 4.90 m, the single-span raked underside, with nothing on them;
- `ohRidge` reports 5.25 m and `derive` adds a ridge snap at 5.25 m;
- `overheadAbove`, `postSpan`, the roof-vs-ceiling issue, voids and every offer headroom probe read the same
  single-span surface;
- the zones (`roofZones.ts`) and the overhead handles (`handles.ts:228`) would sit on it.

Other routes into the same state today: *Spun it round* on a wing roof (only an extruded section takes wings), the
*Span direction* slider at any angle more than 2° off the plan, and a stepped preset drawn in the pad.

**Fix.**

1. `overheadGeom.ts`: `export function ohHasSurface(oh: Overhead): boolean`, false exactly when
   `oh.oneSpan === false && roofWingsState(oh).kind === 'unsupported'`. This is the one definition:
   `buildOverhead` (`scene/build/overheads.ts`) and the `wings:` issue in `derive.ts` call it instead of repeating
   the condition.
2. `ohCovers(oh, p, pad)` returns false when `!ohHasSurface(oh)`. That one gate fixes `overheadAbove`,
   `overheadForWall` (walls fall back to their own tops), `postSpan`, the voids in `scene/build/parts.ts` and
   `overheadsAbove` in `offers.ts`.
3. `ohRidge(oh)` returns `oh.baseY + oh.thick` when there is no surface, so the ridge snap disappears (its rise is
   under the 0.3 m threshold) and `bounds.top` stops counting a phantom peak.
4. Ownership is not height. `derive`'s `coveredBy` tests the outline directly:
   `pointInPoly(q, oh.outline) && (ohHasSurface(oh) ? ohUndersideAt(oh, s.at) : oh.baseY) > s.floorY + 0.5`. The
   rooms stay claimed by the broken roof, so the room card does not offer a second roof over it.
5. `computeIssues`: after pushing the `wings:` issue, `continue`. A roof with no surface gets no support stretches
   and no pencil posts.
6. Offers never read a no-surface roof as open sky. `mezzanineOffer` refuses when the room's `coveredBy` roof has no
   surface, with `why: '{roof} has no surface yet, so there is no headroom to measure.'` `stairCandidates` refuses the
   same way when a no-surface roof's outline covers any point of the deck's outline. Without this, a flat-ceiling
   room would qualify against its ceiling under a roof that is not there.
7. `Inspector.tsx` overhead card: when `!ohHasSurface(oh)`, show "no surface — see the note on the roof" instead of
   "highest point …".
8. `roofZones.ts` returns no zones, and `handles.ts` places no top-surface handles, for a no-surface roof. Outline
   and eave handles sit at `oh.baseY`.

**Test** ("a wing roof with no surface has no heights"): the reproduction above, asserting:

- the state is `unsupported` and the mesh is empty;
- every wall's `maxTop ≤ 3.01`;
- `ohRidge === baseY + thick`, and there is no `ridge` snap for that roof;
- both rooms' `coveredBy` is still the roof's id;
- `mezzanineOffer` returns no candidates, with `why` matching `/no surface/`.

A second case, `L(5)` with flat ceilings, asserts that the mezzanine offer is refused too. It would otherwise
qualify on the 5 m ceiling.

### F2 — the no-surface state can be repaired, and says so when it happens

**Reproduce.** Same as F1. The `wings:` issue has `fixes: []`, and the `opOverhead` that caused it returns no note. A
roof with no mesh cannot be clicked in 3D, so the issue marker and the room card are the only ways back to it.

**Fix.**

1. Give the `wings:` issue two `Fix` entries. Each is offered only if applying it to a clone gives the state it
   promises, so a fix that leaves the roof broken is never offered:
   - **Make it a gable**: `profile = presetProfile('gable', span)` at the primary span. Set it once, read `ohSpan`
     of the result (now the compound primary span), then set it again. `hip`, `fit` and `dir` stay as they are. If
     the plan itself is the reason (an off-axis edge, too many rectangles), the trial is not `compound` and the fix
     is not offered.
   - **Cover as one span**: `oneSpan = true`. This is the explicit, owner-chosen single span; the Settings toggle
     (§8.6 of the plan) will expose the same field. It is always valid.
2. `opOverhead`: when the roof had a surface before the patch and has none after, return an info note with the
   reason and both ways out, `ids: [id]`: *"{name} can't carry this section across its wings ({reason}), so it has
   no surface. Make it a gable, or cover it as one span."* When the existing "has its own outline now" note also
   applies, return both.
3. On a wing roof, *Spun it round* is disabled, with the reason in its title ("only an extruded section can cover
   several wings"). This is the cover chips' pattern: the chip, the preview and the commit give one answer. The free
   *Span direction* slider is left alone here; Phase 2's *Turn the ridge* replaces it for wing roofs.

**Test**: from F1's state:

- both fixes are present;
- *Make it a gable* gives `compound`, with a mesh area equal to the outline area (as in `wings.test.ts`);
- *Cover as one span* gives `single`;
- the raked `opOverhead` returns the note.

A failure the plan causes (an outline edge 3° off the frame) offers only *Cover as one span*.

### F3 — a mezzanine commit compares its supports and its stair too

**Reproduce.**

1. `room10x6(5)`, then `opCoverRooms([id], 'flat')`.
2. Take `c = mezzanineOffer(p, id).candidates[0]`: `mezz:m2:0:0:5:2.7`, 2 posts, `stair:1:0.50`.
3. `opAddPost` at `c.stair.path[Math.floor(len / 2)]`.

The fresh candidate keeps the same id, outline and height but has different posts and a different stair. Even so,
`opAddMezzanine(id, c)` commits ("A mezzanine in Room 1, on 2 posts"), with posts that do not match the preview.

**Fix.** In `opAddMezzanine` (`ops.ts`), after the outline and height check, also require that `ok.posts` equals
`candidate.posts` point for point, and `sameStair(ok.stair, candidate.stair)`. `sameRing` already compares point lists
exactly; rename or alias it, because posts are not a ring. Otherwise refuse with *"That loft's supports changed since
it was offered in {name}. Nothing was placed; hover the offer again."* The preview runs the same op, so a fresh hover
still commits exactly.

**Test**: the reproduction. The stale candidate places no deck and no posts and returns the note; the fresh candidate
commits with posts equal to `fresh.posts`.

### F4 — "same massing" means the same structure, not the same sizes

Do this before any gesture calls `continuedWings`.

**Reproduce.** The `tests/wings.test.ts` case "keeps a wall move under the tolerance continuous…" asserts that
widening the wing from 4 m to 4.5 m is refused. `sameMassing` compares every rectangle to within 8 cm, so once the
guard is wired a wing roof could never follow a wall moved more than 8 cm. That contradicts the plan's *extend sides*
goal. The guard exists to stop the primary wing flipping, not to freeze resizing.

**Fix** in `wings.ts`: compare structure instead of dimensions. After removing `frameShift`, two decompositions are the
same massing when:

- they have the same number of wings;
- each previous wing matches exactly one next wing, by largest overlap in the roof frame (overlap > 0), one to one;
- matched wings have the same `span` axis and the same `ends`;
- the primary wing matches the primary wing. Record which wing is primary on `CompoundState` (e.g. `primary: number`)
  rather than inferring it from `primarySpan`.

Sizes, scales and hips are free and are recomputed for the new outline, as today. The existing reasons and the
single-span and one-span rules stay unchanged.

**Test changes**:

- The sweep keeps every width whose primary is unchanged and refuses exactly the widths where the primary flips.
  Assert that both sets are non-empty.
- The translation test stays.
- The "different plan" case uses a genuine change of structure (an L becoming a T, or a primary flip), not a longer
  wing.

In `effortless-creation.md` §8, the sentence "every larger step is refused" is corrected to match.

### A rule for Phase 2 that follows from these

Hold makes the no-surface state reachable in the middle of a drag. During a Hold, Edit Shape or pad drag, a candidate
with no surface is not previewed. The last valid preview stays, the readout gives the reason (the plan's own
gesture-validation rule), and release commits what was shown. The visible no-surface state from F1 and F2 remains the
outcome only for one-shot edits: a freehand redraw in the pad, the card controls and imports.

---

## 7. What is not done

Held against the plan's own phase table. Order: §6c F1–F3 first, then Phase 2's wiring. F4 goes before any gesture
calls `continuedWings`.

| Not started | Plan | Size |
| --- | --- | --- |
| §6c corrections: F1 a roof with no surface has no heights, F2 its repairs and note, F3 the mezzanine's supports | §6c | S |
| §6c F4: structural massing comparison for the resize guard | §6c, plan §8 | S |
| Hold wired to the pointer: `zoneHandle`, drag branches, highlights, readouts, card hint | §5.3–5.5 | M |
| Edit Shape: entry/exit, 3D view while shaping, `SectionSheet.tsx`, `sectionContext.ts` | §6 | L |
| Ink from meaning: `facets`/`ink`, `roofInk.ts`, revolve rings, ghost twins, `tests/ink.test.ts` | §7 | M |
| Pen tips (Box/Round, *Room beside*), the Platform label, `tests` for both | §9.1, §9.2, §9.5 | M |
| Hold zones and Edit Shape over wings; the Settings *one span* toggle | §8.4–8.6 | S/M |
| Phase 7 (optional) room-sides push/pull | §10 | M |
| §11 acceptance: per-phase gates, browser checks, the full §11.3 script, screenshots, the five-person test | §11 | M |
| §12 docs and in-app help | §12 | S |

The acceptance script's step 2 (*Cover Room 1 and Room 2* → one roof) and half of step 4 (mezzanine, then stair) are
now clickable. Step 3 — raise the ridge to 45°, drag a ridge end to an even hip, bow a slope, pull the eave — needs
Hold's wiring and cannot be run yet.

---

## 8. Reproducing the evidence

From `prototypes/p3-vellum`:

```sh
npm run typecheck     # tsc --noEmit
npm test              # 15 files, 181 tests with the §6b fixes in the working tree
npm run build         # tsc --noEmit && vite build
```

Per-commit counts were produced without touching this checkout:

```sh
git worktree add /tmp/wt <commit>
ln -s "$PWD/prototypes/p3-vellum/node_modules" /tmp/wt/prototypes/p3-vellum/node_modules
cd /tmp/wt/prototypes/p3-vellum && npx tsc --noEmit && npx vitest run
git worktree remove --force /tmp/wt
```

Result: `bc4299af` 79, `c547526e` 127, `258127e0` 151, `2a5fa0e5` 165, `96bc7d32` 165, `eb1095e6` 171. Typecheck is
clean at every one of them. The §6b fixes commit raises the count to 181 on this same command.

One number worth knowing before this becomes anything real: the production build emits a single ~960 kB bundle (281 kB
gzipped), almost all of it three.js — there is no code-splitting yet.

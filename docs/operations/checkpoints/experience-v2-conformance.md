# Experience V2 conformance replacement — checkpoint

TYPE: implementation / behavioral and visual conformance
STATUS: paused by owner interruption, 2026-10-03
GOAL: implement the approved standalone C1–C8 replacement contract end-to-end;
produce real product-reachable QA-1–QA-6, blocking visual review and accurate
acceptance evidence, then stop ready for final external review of #113.

CONSTRAINTS:
- [Replacement plan](../../roadmap/p25-experience/design/experience-v2-prototype/conformance-plan.md)
  is active. S0–S9 plan/record and `pr113-experience-v2.md` are historical only;
  leave them unchanged and do not inherit their acceptance.
- One Camera/navigation authority; neutral Resume; shared Stage/canonical selection;
  aggregate history/cancellation; visitor/editor isolation; existing World A–F and
  donor A0–A22 behavior; PLATE semantics and relative visual rank remain required.
- Fixture loading may supply authored content, never task/selection/standpoint.
  All acceptance states thereafter use actual DOM controls, pointer or keyboard.
- Work stays in the existing native ESM/DOM prototype. No production migration,
  alternate executable, F/T cutover, or deferral of a failed V2 requirement to Paper.
- No commit, push, merge, #113 closure or major-phase closure authorized. Do not
  restore the absent P23B fixture or repair production gates without scope approval.
- No subagents authorized. Apply browser-hygiene to each browser run; owned
  sessions/servers must close on pass, failure and interruption.

READ:
- `docs/README.md`; active replacement plan §§1–7 and its routed authorities.
- `docs/reference/design-system/editor-shell-and-visual-system.md` §§0.8–0.8.2;
  `prototypes/integrated-experience-authoring/design/Prototype-V2-final-synthesis.md`
  relevant complete requirements/canonical states, especially §§4–18, 22–23.
- All eight original boards in `prototypes/integrated-experience-authoring/Design-QAs/`.
- Relevant architecture, ratification and F ownership sections; editor test contract
  `apps/editor/tests/README.md`; current prototype QA README/manifest and implementation reference.
- Old S0–S9 plan/acceptance and captures inspected as historical evidence only.
- `.agents/skills/browser-hygiene/SKILL.md`, agent-browser skill, work-checkpoint skill;
  slice-closeout skill read but not applied: acceptance is incomplete.

ESTABLISHED:
- Branch `prototype-v2`, local HEAD and remote PR head
  `4d5e3c3eadf79c505ec6fbdab054563815888d27`. #113 is OPEN, non-draft, base `main`
  ([PR](https://github.com/Biskiq/spatial-sketch-editor/pull/113), rechecked at interruption).
  All new work is uncommitted/unpushed. Owner's initial dirty conformance-plan edits
  were preserved. No production source changes.
- **C1–C7 implemented; none formally accepted/closed under the replacement contract.**
  **C8 remains incomplete.** Draft acceptance is explicitly unfinished.
- C1: authored-only six-Stop fixture (Materials, Piano, Power switch, Machine,
  Gallery light, repeated Machine), three unequal Machine Views and distinct light
  destination; no loaded connections/anchors/beats/session state. Journeys author
  those through product controls. New manifest and test/mutation harness preserve old proof.
- C2: Camera resolves relative/fixed framing, observer route geometry, stations,
  timing, interpolation and realization; navigation owns input/projection/detents,
  neutral activation and opaque fresh returns. Existing World motion profiles retained.
  Anchors mean interior observer positions in project space; endpoints are generated.
  Travel refuses until the actual departure View is reached, rather than jumping there.
- C3/C4: quiet Meaning/Focus/Show Card; derived Auto/Hints, explicit atomic Capture;
  existing PLATE control roles; shared edits ask at proposal/acceptance; cancel adds
  no history. Peek/L0/L1/L2, shared schematic/spatial unordered Set, distinct repeated
  pins and canonical occurrence selection implemented. Supported local entry detach is atomic.
- C5/C6: scoped Plan observer graph with three origins, destination, 2/3 reach and gap,
  authored anchor/generated endpoint distinction, normal pace/bookends/unrelated context.
  Real pointer/keyboard edits and Undo. Coordination retains that route with stable
  mirrored station IDs, local hold/invoke lanes and explicit multi-route resolution.
- C7: no-Guide real spatial Through gate/horizon/target/grips with one active tape;
  Outside observer/frustum and truthful Plan; all postures edit the same View.
  Preview removes authoring input/rig, freezes source and restores complete Camera/inspection.
  Neutral Resume after World Plan keeps NOW; explicit invocation takes a fresh return.
- Latest shared CSS fix fits all six occurrence cards at L2 in 1440×900: compact
  minimum width 50, expanded width 330, seam gaps reduced, long name references ellipsized
  with full accessible names/Stop numbers retained. Latest browser hit-reachability check passes.
- Last spatial fixes: view direction glyphs distinct from nameplates, honest label leaders,
  `.ov-svg .exp-view-glyph` specificity preserves visible glyph fill; normal Plan framing
  minimum 12 instead of 20; coordination lanes reduced so Stage dominates. Existing Camera token used.

EVIDENCE:
- [Paused provenance](./experience-v2-conformance-evidence/paused-provenance.json)
  stores current executable SHA256, recipe, capture checksums and evidence limits.
  Current SHA256: `4609b093eedc23716d33faa8470c46bd31f889077a8fca7ab72922f1e17776d9`.
  Hash recipe: sorted `app/*.js`, then `index.html`, `styles/app.css`, repository-relative
  path bytes NUL file bytes NUL. Pre-density provenance is retained separately and stale.
- [Latest product log](./experience-v2-conformance-evidence/v2-captures-final.txt):
  **73 PASS, 0 FAIL**, latest source/captures, owned shell session 70103 exited 0.
- [Integrated checkpoint](./experience-v2-conformance-evidence/v2-integrated-final.txt):
  all 16 axes, **683 PASS, 0 FAIL**, before the last density CSS/assertion change;
  conformance then had 72 checks. Must rerun on the frozen final executable.
- [Mutation log](./experience-v2-conformance-evidence/v2-mutations-final.txt):
  three World plus seven V2 injected regressions rejected, but the run overlapped
  density changes and station/Preview copies have unrelated QA-3 failures.
  This is diagnostic evidence, not final isolated successor proof. Rerun unchanged source.
- [Narrow log](./experience-v2-conformance-evidence/v2-narrow-final.txt): 13/13,
  predates final density CSS. [Domain](./experience-v2-conformance-evidence/v2-domain-final.txt):
  40/40. [Donor](./experience-v2-conformance-evidence/v2-donor-final.txt): 62/62 and typecheck green.
- Root [architecture](./experience-v2-conformance-evidence/v2-root-arch-final.txt),
  [test](./experience-v2-conformance-evidence/v2-root-test-final.txt),
  [check](./experience-v2-conformance-evidence/v2-root-check-final.txt),
  [build](./experience-v2-conformance-evidence/v2-root-build-final.txt) all exited 1:
  missing `docs/roadmap/p23b-geometry-performance/40-walls.json`. Architecture:
  23 files pass/1 fail, 275 tests pass/1 fail (two historical missing-fixture references).
  Root test: 338 files pass/34 fail/1 skip; 4950 tests pass/2 fail/1 skip, including
  missing-fixture collection failures. Check: one missing-module error; build: Rollup
  cannot resolve fixture after 2625 modules, museum build not reached.
- Current canonical PNG + read-only JSON sidecars:
  `prototypes/spatial-authoring/screens/experience-conformance/qa-{1…6}-*.{png,json}`.
  Latest 1440×900 DPR1 `shot=1&motion=instant` run captured ordinary/Peek/Plan,
  overview/selected, occurrence/scope, route, coordination, Through/visitor/Outside/Plan Resume.
  **Board-pair/transition/gallery JPGs and narrow PNGs are stale after final CSS.**
  [Comparison generator](./experience-v2-conformance-evidence/v2-comparisons.py)
  preserves all eight full-window board pairs and four mandatory transition pairs;
  regenerate before review. No masking/cropping substitutes for full-window review.
- Core files: `app/camera-evaluation.js`, `navigation.js`, `experience*.js`,
  `main.js`, `stage.js`, `overlay.js`, `styles/app.css`; new
  `app/conformance-fixture.js`, `tests/camera-conformance.test.mjs`,
  `qa/CONFORMANCE-MANIFEST.md`, `qa/conformance-check.sh`,
  `qa/conformance-mutation-check.sh` (both executable).
- [Draft acceptance](../../../prototypes/spatial-authoring/qa/EXPERIENCE-CONFORMANCE-ACCEPTANCE.md)
  has fixture/reproducibility, implemented-slice table and material decisions; final
  recipes/dimensional verdicts/gate results/provenance are not filled in.
  Live routers and Paper PA0 already point to the replacement plan/new proof.
- Cleanup verified: `agent-browser session list` = no active sessions; no owned
  ephemeral QA server remains. External terminal server on port 8826 (PID 90060,
  parent interactive zsh 24543, started 12:33) left intact. Do not kill it on resume.

RULED OUT:
- Label/control presence and named screenshot files are insufficient visual acceptance.
- Neutral Resume cannot be implemented by moving and restoring a saved pose; the
  canonical lifecycle now freezes realization before setup and blocks setup writers.
- The first empty direction-glyph observation was Bash quoting/brace expansion,
  not absent product geometry. The later actual CSS glyph fill/label overlap defects were fixed.

DO NOT REPEAT:
- Do not restart broad authority/old-plan inspection or reconstruct the initial drift audit.
- Do not lower tolerances or remove World baselines. Complete realized-Camera comparisons
  include eye/up/target/direction/FOV/mirror/aspect with established World tolerance .002.
- `qa_js` JavaScript containing object-literal commas should use a single-quoted shell
  argument (double-quoted JS selectors inside); nested double quotes can trigger macOS
  Bash brace expansion. Anchor selectors for `qa_drag`: `[data-exp-anchor=\"$anchor\"]`.
- `qa_press Escape|Enter` sends focused keydown/default button action/keyup; navigation
  keys remain native. `qa_move/down/up` settle frames; screenshot-only 12 render turns
  settle the paper/material transition, without writing Camera state.
- `__me.qa.render` includes resize/layout settling; prior stale Preview aspect was a
  render-observation race. Avoid changing the Camera contract to hide that race.
- Mutation shared-ask bypass is limited to Presentation Meaning, Preview leak only
  to precision, so protected failures remain observable without unrelated early crashes.
- Old checkpoint, old acceptance and old captures remain untouched. Do not turn a
  green prototype into merge readiness while repository gates remain red.

CURRENT:
- Paused during C8 immediately after final density correction and latest 73/73 capture
  run. Fresh native QA-3 was inspected and all six cards fit; comprehensive fresh
  seven-dimension board verdicts for all six states are still pending.
- Behavioral QA-1–QA-6 journeys pass; **final visual verdicts are unissued**. Earlier
  board review identified now-corrected glyph overlap, tiny route framing, tall Deck
  and offscreen sixth occurrence. Re-review every state after the final shared change.
- Sidecars use `experience`, `cameraSource`, `sceneSource`; verify QA-4/QA-5 have equal
  Camera source/realization on latest captures. Their canonical Stop is 16, destination
  Stop17; route connection9 plus connection8, anchor10, missing third-origin reach.
  Coordination adds hold beat21/invoke beat22 on contribution20. QA-6 selects use2/view1,
  frameH4, active frameH grip, no Guide. Scope companion covers repeated Machine Stop18.
- Active plan §§6/7 retain a couple of planning-only closing sentences; reconcile the
  plan's delivery/status wording when final acceptance is completed, preserving owner edits.

NEXT:
1. Resume this checkpoint and inspect Git/provenance. Regenerate board/transition
   JPGs from current PNGs with the saved generator; review all six against written
   V2 and eight original boards, explicitly verdict all seven required dimensions,
   including Outside/scope/narrow companions. Fix any material failure and recapture.
2. Freeze executable/assertions, then rerun prescribed integrated and mutation proof,
   narrow captures, proportional domain/donor and final repository gates:
   `QA_SHOT=0 bash prototypes/spatial-authoring/qa/run-all.sh`;
   `bash prototypes/spatial-authoring/qa/mutation-check.sh`;
   canonical `conformance-check.sh` and narrow `reconciliation-check.sh` with
   `QA_OUT=prototypes/spatial-authoring/screens/experience-conformance` and unique
   owned `QA_SESSION`; `node --test prototypes/spatial-authoring/tests/*.test.mjs`;
   donor test/typecheck; `npm run test:arch`, `npm test`, `npm run check`, `npm run build`,
   `git diff --check`. Inspect every failure; preserve complete logs and final provenance.
3. Complete new conformance acceptance with exact recipes, visual verdicts, tolerated
   differences and gate results; self-review/fix/re-review and update live/Paper handoff.
   Apply slice-closeout only on actual acceptance under owner instructions. Remove this
   checkpoint/RESUME once durable findings are promoted. Stop ready for external review;
   do not commit/push/merge/close #113.

OPEN:
- Final visual acceptance and final frozen-revision integrated/mutation/narrow evidence.
- Missing P23B fixture blocks repository gates; restoration requires owner scope approval
  or an external fix. No new product/architecture decision identified at interruption.

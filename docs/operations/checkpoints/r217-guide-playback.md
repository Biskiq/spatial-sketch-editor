# R217 Guide playback (format 4) — checkpoint

IDENTITY: T3 · R217 · Experience review correction pass (guide-playback plan)
RESUME ROUTE: docs/roadmap/r217-core-editor-stability/README.md → experience-review/guide-playback-plan.md
TYPE: implementation
STATUS: paused
GOAL: slices 1–7 of the guide-playback plan; draft PR Biskiq/spatial-sketch-editor#271

CONSTRAINTS:
- Locked model and §32 placement are owner-accepted; do not redesign.
- Slice 7 (owner direction 2026-11-05): one quick full loop on one guided Experience, visual UI/UX; owner runs journeys A–H.

READ:
- guide-playback-plan.md, sheet §31/§32, fix-plan.md closing sections

ESTABLISHED:
- Slices 1–3 landed (c117d54): types/validate/planning/experience-structure, program v4, lowering, policy, interpreter, companion.
- Slices 4–5 landed (c18c702): apps/editor/src/lib/visitor/guide-run-map.ts, director time-aligned, runtime store, Preview surface.
- Presentation step occurrence is `{ kind: 'step', presentationId, toViewId }` (playback-map already uses it).

EVIDENCE:
- Green: tests/lib/experience/experience-runtime, tests/lib/project-model/*, tests/lib/visitor/*, guide-time-map, playback.

CURRENT:
- Slice 6 (editor Cards) not started; `npm run check` fails in src/lib/authoring/experience/* and their tests until it lands.

VERIFICATION:
- iteration only (focused files); full lanes owed at slice 7.

NEXT:
1. Slice 6: controller intents (setGuidePacing, setStopEntry, setStopStay, setStopInvitation, setPresentationStep, movePresentationView), Cards per §32, the View rail with fold past 10.
2. Fix remaining editor tests; run test:fast, test:arch, test:heavy, check, build.
3. Slice 7 quick browser loop; close out; delete this checkpoint.

OPEN:
- none

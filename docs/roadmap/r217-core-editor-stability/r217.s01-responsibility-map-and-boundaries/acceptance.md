# R217.S01 — acceptance record: Responsibility map and boundaries

**Status:** implementation in progress; review and acceptance pending. **Trusted base:** `686e724d`
(PR #217); T5.P01.S03 shipped in PR #218 before that base. [Plan](./implementation-plan.md) ·
[Phase](../README.md) · [Integration route](../r217.s11-integrated-final-gate/acceptance.md).

The four consumed gates were accepted and all five required scopes active at the trusted base.
The owner released S01 on 2026-10-28; the T1 cycle check found S01 absent from the exposure list.
No shared-file claim, production behavior change or package move. New boundary checks found no
violations at the base. T2, T3 and T5 review remains outstanding; this is not acceptance.

## Gesture and picking inventory

The following repository search was run at `686e724d` over production editor and package sources.
It returns **54 lines and 54 rows** below, including contract declarations and forwarding sites so
that S03 can follow the whole route. No `visibilitychange` or window `blur` listener matched; the
Card field blur and visitor pointer interruption are included. Search results are evidence at that
revision, not a promise of current line numbers.

```sh
rg -n 'acquireGesture\s*\(|registerProposal\s*\(|(?:pointerIntent|hoverIntent|hitProvider|pressWhenNoTask)\??\s*[:(]|new (?:THREE\.)?Raycaster\s*\(|pickScene\s*[:(]|function on(?:PointerCancel|LostPointerCapture)\s*\(|onpointercancel|onlostpointercapture|onblur\s*=|addEventListener\([^\n]*(?:pointercancel|lostpointercapture|blur|visibilitychange)' apps/editor/src packages --glob '*.{ts,svelte}'
```

EVIDENCE-PATHS: start — production source locations at trusted base `686e724d`

| File and line | Symbol / matched operation | Trigger or role |
| --- | --- | --- |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte:1916` | `facade.pointerIntent({ phase: 'move', css, evaluationId: id });` | Stage pointer routing |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte:1917` | `facade.pointerIntent({ phase: 'cancel', css, evaluationId: id });` | Stage pointer routing |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte:2257` | `if (stage.pointerIntent({ phase: 'down', css, evaluationId: pointerEvaluationId, shift: event.shiftKey }).claimed) {` | Stage pointer routing |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte:2260` | `stage.pointerIntent({ phase: 'cancel', css, evaluationId: pointerEvaluationId, shift: event.shiftKey });` | Stage pointer routing |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte:2272` | `const acquisition = stage.acquireGesture({` | Stage navigation press |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte:2303` | `stage.pointerIntent({ phase: 'move', css: stageCss(event), evaluationId: id, shift: event.shiftKey });` | Stage pointer routing |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte:2323` | `stage.pointerIntent({ phase: 'move', css: stageCss(event), evaluationId: id, shift: event.shiftKey });` | Stage pointer routing |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte:2390` | `stage.pointerIntent({ phase, css: stageCss(event), evaluationId: id, shift: event.shiftKey });` | Stage pointer routing |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte:2412` | `stage.pointerIntent({ phase: 'cancel', css: stageCss(event), evaluationId: id, shift: event.shiftKey });` | Stage pointer routing |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte:3079` | `onpointercancel={onPointerCancel}` | pointer interruption |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte:3080` | `onlostpointercapture={onLostPointerCapture}` | pointer interruption |
| `apps/editor/src/lib/authoring/scene/scene-pick-source.ts:10` | `const raycaster = new Raycaster();` | rendered Scene raycast construction |
| `apps/editor/src/lib/authoring/stage/stage-facade.ts:291` | `pickScene(ray: PointerRay): SceneRenderedHit \| null;` | facade contract/delegation or dispatch |
| `apps/editor/src/lib/authoring/stage/stage-facade.ts:451` | `readonly hitProvider?: (candidate: StageHitCandidate, context: StageAdapterContext) => StageSourceHit \| null;` | facade contract/delegation or dispatch |
| `apps/editor/src/lib/authoring/stage/stage-facade.ts:457` | `readonly pointerIntent?: (intent: StagePointerIntent, context: StageAdapterContext) => boolean;` | facade contract/delegation or dispatch |
| `apps/editor/src/lib/authoring/stage/stage-facade.ts:463` | `readonly hoverIntent?: (intent: StagePointerIntent, context: StageAdapterContext) => boolean;` | facade contract/delegation or dispatch |
| `apps/editor/src/lib/authoring/stage/stage-facade.ts:504` | `readonly pressWhenNoTask?: boolean;` | facade contract/delegation or dispatch |
| `apps/editor/src/lib/authoring/stage/stage-facade.ts:734` | `pointerIntent(intent: StagePointerIntent): { readonly claimed: boolean; readonly adapterId: string \| null };` | facade contract/delegation or dispatch |
| `apps/editor/src/lib/authoring/stage/stage-facade.ts:746` | `acquireGesture(request: {` | facade contract/delegation or dispatch |
| `apps/editor/src/lib/authoring/stage/stage-facade.ts:2104` | `acquireGesture: (request) => active() ? facade.acquireGesture(request) : { kind: 'refused', code: 'stale-epoch', owner: request.owner }` | facade contract/delegation or dispatch |
| `apps/editor/src/lib/authoring/stage/stage-facade.ts:2174` | `pointerIntent(intent) {` | facade contract/delegation or dispatch |
| `apps/editor/src/lib/authoring/stage/stage-facade.ts:2303` | `acquireGesture(request) {` | facade contract/delegation or dispatch |
| `apps/editor/src/lib/authoring/stage/stage-facade.ts:2305` | `const outcome = session.acquireGesture({` | facade contract/delegation or dispatch |
| `apps/editor/src/lib/visitor/VisitorCameraDirector.svelte:367` | `canvas.addEventListener('pointercancel', onPointerEnd);` | visitor camera pointer end |
| `apps/editor/src/lib/visitor/VisitorCameraDirector.svelte:368` | `canvas.addEventListener('lostpointercapture', onPointerEnd);` | visitor camera pointer end |
| `apps/editor/src/lib/authoring/stage/stage-session.ts:238` | `registerProposal(input: { readonly owner: string; readonly reason: string }): ProposalLease;` | session lease/proposal contract or implementation |
| `apps/editor/src/lib/authoring/stage/stage-session.ts:248` | `acquireGesture(request: {` | session lease/proposal contract or implementation |
| `apps/editor/src/lib/authoring/stage/stage-session.ts:576` | `registerProposal(request) {` | session lease/proposal contract or implementation |
| `apps/editor/src/lib/authoring/stage/stage-session.ts:600` | `acquireGesture(request) {` | session lease/proposal contract or implementation |
| `apps/editor/src/lib/authoring/adapters/scene/placement.ts:69` | `acquireGesture(request: {` | placement port contract |
| `apps/editor/src/lib/authoring/adapters/scene/placement.ts:1077` | `lease = input.port.acquireGesture({` | begin Scene resize |
| `apps/editor/src/lib/authoring/adapters/scene/placement.ts:1154` | `lease = input.port.acquireGesture({` | begin Scene transform |
| `apps/editor/src/lib/authoring/adapters/scene/placement.ts:1181` | `lease = input.port.acquireGesture({` | begin primitive placement |
| `apps/editor/src/lib/authoring/adapters/scene/placement.ts:1567` | `acquireGesture: (request) => input.services.stage.acquireGesture(request)` | bind placement port |
| `apps/editor/src/lib/authoring/adapters/scene.adapter.ts:524` | `const acquisition = services.stage.acquireGesture({` | Scene direct-manipulation press |
| `apps/editor/src/lib/authoring/adapters/scene.adapter.ts:803` | `hitProvider(candidate, live) {` | Scene click hit provider |
| `apps/editor/src/lib/authoring/adapters/scene.adapter.ts:808` | `const drawn = live.pickScene(ray);` | rendered hit |
| `apps/editor/src/lib/authoring/adapters/scene.adapter.ts:826` | `if (probeRay === null \|\| live.pickScene(probeRay)?.entityId !== hit.entityId) return null;` | halo occlusion probe |
| `apps/editor/src/lib/authoring/adapters/scene.adapter.ts:936` | `pressWhenNoTask: true,` | no-task press admission |
| `apps/editor/src/lib/authoring/adapters/scene.adapter.ts:941` | `pointerIntent(intent: StagePointerIntent, adapterContext) {` | Scene pointer dispatch |
| `apps/editor/src/lib/authoring/adapters/layout/adapter-support.ts:66` | `const outcome = services.stage.acquireGesture({` | Layout instrument gesture request |
| `apps/editor/src/lib/authoring/adapters/scene/shape/reading.ts:670` | `const lease = services.stage.acquireGesture({` | Shape depth handle down |
| `apps/editor/src/lib/authoring/adapters/scene/shape/reading.ts:689` | `const lease = services.stage.acquireGesture({` | Shape drawing down |
| `apps/editor/src/lib/authoring/adapters/layout/LayoutCardFields.svelte:214` | `onblur={(event) => {` | Layout Card field blur discards edit |
| `apps/editor/src/lib/authoring/adapters/layout.adapter.ts:855` | `const acquisition = services.stage.acquireGesture({` | Opening pointer down |
| `apps/editor/src/lib/authoring/adapters/layout.adapter.ts:1051` | `inkProposal = services.stage.session.registerProposal({` | begin Wall chain proposal |
| `apps/editor/src/lib/authoring/adapters/layout.adapter.ts:1359` | `const acquisition = services.stage.acquireGesture({` | Ink pointer down |
| `apps/editor/src/lib/authoring/adapters/layout.adapter.ts:1682` | `pressWhenNoTask: true,` | no-task press admission |
| `apps/editor/src/lib/authoring/adapters/layout.adapter.ts:1683` | `hoverIntent(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean {` | Layout hover |
| `apps/editor/src/lib/authoring/adapters/layout.adapter.ts:1694` | `pointerIntent(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean {` | Layout pointer dispatch |
| `apps/editor/src/lib/authoring/adapters/layout.adapter.ts:1726` | `const acquisition = services.stage.acquireGesture({` | selected Wall handle down |

| `apps/editor/src/lib/authoring/stage/stage-facade.ts:1394` | `pickScene: (ray) => …` | facade rendered-pick binding |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte:2416` | `function onPointerCancel(event: PointerEvent): void {` | pointer cancellation handler |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte:2428` | `function onLostPointerCapture(event: PointerEvent): void {` | lost capture handler |

EVIDENCE-PATHS: end

## Verification and review

On the working diff based on `686e724d`, `npm run check` passed with 0 errors and
0 warnings; `npm run test:arch` passed 23 files / 191 tests, including documentation
references and the release-list gate. The owner expanded scope to correct that gate's
repository-phase ID handling; its positive control checks both a released row and baton.
`npm test` passed 232 files / 2,941 tests on the working diff; it ran while the
final status and adapter positive-control edits were being completed, which were
then covered by the final arch run and type check. The complete pre-merge gate
remains owed separately. T2 owns Scene review, T3 owns F4 and
Camera review, and T5 owns geometry-core review. All three are pending.

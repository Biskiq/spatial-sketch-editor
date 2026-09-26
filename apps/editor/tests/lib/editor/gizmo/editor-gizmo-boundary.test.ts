/**
 * Gizmo + layout-adapter ownership boundary: unique writable owners, forbidden
 * mutators, renderer-neutral pure modules, and the pick/candidate seams.
 *
 * These are unconditional ownership/import-direction invariants over the
 * source tree, so they live with the other `*-boundary` suites and run in the
 * arch lane. Absorbed verbatim from the dismantled `contracts.test.ts`
 * accumulator (T3a).
 */
import { describe, expect, it } from 'vitest';

import { readAllSourceFiles, readCameraCoreSource, readLibSource } from '../../../helpers/lib-source';

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('layout 3D pick metadata', () => {
	it('keeps the pure builder + pick module free of renderer/Svelte imports', () => {
		const builder = readLibSource('layout/wall-mesh-builder.ts');
		const picking = readLibSource('editor/layout/layout-3d-picking.ts');
		for (const source of [builder, picking]) {
			expect(source).not.toMatch(/from\s+['"](three|svelte|@threlte|\$app)['"]/);
			expect(source).not.toMatch(/\$lib\/museum/);
		}
	});
	it('ships the selection-highlight shell while anchor helpers + hover stay deferred', () => {
		const scene = readLibSource('editor/layout/LayoutPreviewScene.svelte');
		// Ceiling is pick-identifiable (surfaceType 'ceiling' + roomId) but carries
		// no editorSurface, so placement grounding still ignores it.
		expect(scene).toMatch(/surfaceType: 'ceiling'/);
		// 2026-08-16 revision: the selection-highlight shell is LIVE again — it
		// renders from `interaction.selection` alone, so hierarchy (tree) wall
		// picks highlight even though direct 3D wall picks are deferred. The
		// anchor-helper octahedra and the hover shell stay commented out
		// (deferred); their authored identity and the pure placement derivation
		// are preserved inside the commented blocks for re-enabling.
		expect(scene).toContain('LayoutWallHighlight');
		expect(scene).toContain('buildWallHighlightMesh');
		expect(scene).toContain('matchWallRanges');
		expect(scene).toContain('matchOpeningRanges');
		expect(scene).toContain('WALL_HIGHLIGHT_MATERIAL');
		expect(scene).toContain('Deferred (2026-08-16)');
		expect(scene).toContain("editorEntity: 'layout-anchor'");
		expect(scene).toContain('layoutAnchorHelperPlacements');
		expect(scene).toContain('JSON.stringify([placement.roomId, placement.segmentId, placement.anchorId])');
	});
	it('defers direct 3D wall/interior-anchor picks behind isLayoutDirectPickDeferred', () => {
		const ws3d = readLibSource('editor/app/Workspace3DView.svelte');
		const picking = readLibSource('editor/layout/layout-3d-picking.ts');
		// The gate is pure + exported (unit-tested) and the coordinator falls
		// through to the normal dispatch for deferred resolutions; the wall/anchor
		// commit cases are gone from the shell.
		expect(picking).toContain('export function isLayoutDirectPickDeferred');
		expect(ws3d).toContain('isLayoutDirectPickDeferred(resolved.selection)');
		expect(ws3d).not.toContain('selectLayoutWall');
		expect(ws3d).not.toContain('selectLayoutInteriorAnchor');
	});
	it('disconnects the highlight feed: no showAnchors/hoverSelection/onLayoutHover passes remain', () => {
		const scene = readLibSource('editor/layout/LayoutPreviewScene.svelte');
		const ws3d = readLibSource('editor/app/Workspace3DView.svelte');
		// The S6 click coordinator still owns its optional props (onLayoutPick /
		// onLayoutHover — the contract), but the editor shell no longer feeds any of
		// the disconnected surfaces, so EditorSelection's hover guard makes the
		// whole hover resolution a no-op.
		expect(ws3d).not.toContain('showAnchors');
		expect(ws3d).not.toContain('hoverSelection');
		// Assert the wiring shape, not the bare identifier: the KNOWN DEBT
		// comment in Workspace3DView legitimately mentions the prop name.
		expect(ws3d).not.toContain('onLayoutHover={');
		expect(ws3d).toContain('onLayoutPick={store.isVisitorCameraPreview ? undefined : handleLayoutPick}');
	});
	it('fails the wall-mesh build closed on an untagged face (pick-tag guard)', () => {
		const builder = readLibSource('layout/wall-mesh-builder.ts');
		expect(builder).toContain('untagged face');
		expect(builder).toMatch(/if \(!face\.pick\) \{/);
	});
	it('carries pickRanges through the adapter as userData, never geometry groups', () => {
		const adapter = readLibSource('render/wall-geometry-adapter.ts');
		expect(adapter).toContain('geometry.userData.pickRanges = mesh.pickRanges');
		// Exactly one geometry.addGroup( call — the material-group loop only.
		// pickRanges is metadata on userData and must never add a group (zero
		// draw-call delta). The other addGroup mentions are doc comments.
		expect(adapter.match(/geometry\.addGroup\(/g)?.length).toBe(1);
	});
	it('keeps the one derived-mesh cache in the pure preparation module', () => {
		const state = readLibSource('editor/layout/layout-preview-state.svelte.ts');
		const preparation = readLibSource('editor/layout/prepared-wall-meshes.ts');
		const ownerCount = (sources: readonly string[]) =>
			sources.filter((source) => /const derivedWallMeshes\s*=\s*new WeakMap/.test(source)).length;
		expect(preparation).toContain('buildLayout3dTriangleIndex');
		expect(state).toContain('prepareWallMeshes(key, referenceKey)');
		expect(state).toContain('layout3dPickIndexByRoom');
		expect(ownerCount([preparation, state]), 'D-4 has one weak cache owner').toBe(1);
		// Negative control: restoring the cache declaration in preview state must fail this boundary.
		expect(ownerCount([preparation, `${state}\nconst derivedWallMeshes = new WeakMap();`])).not.toBe(1);
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('centralized 3D layout selection', () => {
	it('extends the single coordinator with an optional onLayoutPick prop, absent on the relic', () => {
		const selection = readLibSource('editor/EditorSelection.svelte');
		expect(selection).toContain('onLayoutPick?:');
		expect(selection).toContain('competingSceneDistance: number | null');
		expect(selection).toContain('layoutCandidatesFromIntersections');

		const viewport = readLibSource('editor/EditorViewport.svelte');
		expect(viewport).toContain('<EditorSelection {store} {transformControls} />');
		expect(viewport).not.toContain('onLayoutPick');
	});
	it('wires the editor shell behind a visitor-preview gate', () => {
		const ws3d = readLibSource('editor/app/Workspace3DView.svelte');
		expect(ws3d).toContain('onLayoutPick={store.isVisitorCameraPreview ? undefined : handleLayoutPick}');
		expect(ws3d).toContain('resolveLayout3dHits');
		expect(ws3d).toContain('layoutPickBeatsSceneDistance');
	});
	it('tags the wall mesh with authored object-level identity in the shared scene', () => {
		const scene = readLibSource('editor/layout/LayoutPreviewScene.svelte');
		expect(scene).toContain("userData={{ surfaceType: 'wall', roomId: room.roomId }}");
	});
	it('exports the S6 resolution contracts from the pure picking module', () => {
		const picking = readLibSource('editor/layout/layout-3d-picking.ts');
		expect(picking).toContain('export type Layout3dHitCandidate');
		expect(picking).toContain('export type Layout3dResolvedHit');
		expect(picking).toContain('export function resolveLayout3dHits');
		expect(picking).toContain('export function layoutCandidatesFromIntersections');
		expect(picking).toContain('LAYOUT_3D_SAME_DEPTH_EPSILON = 1e-4');
	});
});

// The sweep marker sets moved verbatim from the dismantled `contracts.test.ts`
// accumulator (T3a) — they are module-scope here because the describes below
// share them.
/**
 * Scene/camera session + raw-transaction mutators. The scene and camera
 * *adapters* are the sanctioned session owners (the extraction moved the
 * monolith's inline calls into them), so these markers are forbidden in
 * every other gizmo file: host, controller, policy, contract, composer
 * glue. Add tokens as adapters land.
 */
const SESSION_MUTATION_MARKERS = [
	'updatePlacementTransform',
	'beginDocumentTransaction',
	'commitDocumentTransaction',
	'cancelDocumentTransaction',
	'updateNavigationNodePoint',
	'updateConnectionAnchorWorldPoint',
	'updateSelectedViewKeyframeTargetWorldPoint'
];
/**
 * The layout Plan mutators: forbidden in every gizmo file, including the
 * layout adapter (the S8 adapter uses its own candidate path, never these).
 */
const LAYOUT_MUTATION_MARKERS = [
	'updateLayout',
	'previewLayoutRoomUnit',
	'restoreLayoutPreviewSnapshot'
];
/**
 * The layout transaction facade (S8 owns it): the layout *adapter* is the
 * sanctioned session owner, so these markers are exempted for that basename
 * only — mirroring the SESSION_MUTATION_MARKERS exemption. `beginLayoutTransaction`
 * joins the banned list in S8 (it was absent from the S7 markers).
 */
const LAYOUT_FACADE_MARKERS = [
	'beginLayoutTransaction',
	'commitLayoutTransaction',
	'cancelLayoutTransaction'
];
const ADAPTER_BASENAMES = new Set([
	'scene-gizmo-adapter.svelte.ts',
	'camera-gizmo-adapter.svelte.ts'
]);
/** The layout adapter basename exempted from the facade markers (S8 step 2). */
const LAYOUT_ADAPTER_BASENAMES = new Set(['layout-gizmo-adapter.svelte.ts']);

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('single gizmo host', () => {
	it('relocates the sole live TransformControls constructor into EditorTransformControlsHost.svelte', () => {
		const constructions = readAllSourceFiles('editor').reduce(
			(count, entry) =>
				count + (entry.source.match(/new ThreeTransformControls\(/g)?.length ?? 0),
			0
		);
		expect(constructions).toBe(1);
		// The one construction lives in the host; the composer is constructor-free.
		expect(
			readLibSource('editor/gizmo/EditorTransformControlsHost.svelte').match(/new ThreeTransformControls\(/g)
		).toHaveLength(1);
		expect(readLibSource('editor/EditorTransformControls.svelte')).not.toContain('new ThreeTransformControls');
	});
	it('mounts the shared composer exactly once from Workspace3DView and the relic viewport; neither constructs controls or helpers', () => {
		for (const [relativePath, label] of [
			['editor/app/Workspace3DView.svelte', 'Workspace3DView'],
			['editor/EditorViewport.svelte', 'EditorViewport']
		] as const) {
			const source = readLibSource(relativePath);
			expect((source.match(/<EditorTransformControls/g) ?? []).length, `${label} mounts`).toBe(1);
			expect(source, `${label}`).not.toContain('new ThreeTransformControls');
			expect(source, `${label}`).not.toContain('getHelper');
			expect(source, `${label}`).toContain('bind:controls');
		}
	});
	it('keeps the selected camera helper mounted while its gizmo owns the drag', () => {
		for (const path of ['editor/app/Workspace3DView.svelte', 'editor/EditorViewport.svelte']) {
			const source = readLibSource(path);
			expect(source, path).toContain(
				"!store.isFramingBlocked || (store.transformInteractionActive && store.transformInteractionKind === 'camera')"
			);
		}
	});
	it('keeps EditorSelection on the bound controls with axis/dragging precedence before the S6 layout flow', () => {
		const selection = readLibSource('editor/EditorSelection.svelte');
		expect(selection).toContain('transformControls?: TransformControls;');
		// Pointerdown priority gate and the pointerup commit gate both check
		// the bound controls before the layout/normal selection flow runs.
		expect(selection).toContain('if (transformControls?.axis || transformControls?.dragging) return;');
		expect(selection).toContain('!transformControls?.axis &&');
	});
	it('scopes scene/camera session mutations to the adapters only; layout mutations stay out of every gizmo file (facade only in the layout adapter)', () => {
		for (const { name, source } of readAllSourceFiles('editor/gizmo')) {
			const isAdapter = ADAPTER_BASENAMES.has(name);
			const isLayoutAdapter = LAYOUT_ADAPTER_BASENAMES.has(name);
			for (const marker of SESSION_MUTATION_MARKERS) {
				if (isAdapter) continue; // adapters are the session owners (S7 step 3)
				expect(source, `${name}: ${marker}`).not.toContain(marker);
			}
			for (const marker of LAYOUT_MUTATION_MARKERS) {
				expect(source, `${name}: ${marker}`).not.toContain(marker);
			}
			for (const marker of LAYOUT_FACADE_MARKERS) {
				if (isLayoutAdapter) continue; // the layout adapter is the layout session owner (S8 step 2)
				expect(source, `${name}: ${marker}`).not.toContain(marker);
			}
		}
	});
	it('keeps the adapters constructor- and listener-free (host owns the Three surface)', () => {
		for (const [relativePath, label] of [
			['editor/gizmo/scene-gizmo-adapter.svelte.ts', 'scene adapter'],
			['editor/gizmo/camera-gizmo-adapter.svelte.ts', 'camera adapter']
		] as const) {
			const source = readLibSource(relativePath);
			expect(source, label).not.toContain('new ThreeTransformControls');
			expect(source, label).not.toContain('window.addEventListener');
		}
	});
	it('resolves the editor composer from the S3 active domain; the relic omits it and falls back to the legacy target', () => {
		// editor mounts with the S3 active-domain selector; the relic mount omits it.
		expect(readLibSource('editor/app/Workspace3DView.svelte')).toContain('activeSelection={activeSelection ?? undefined}');
		expect(readLibSource('editor/EditorViewport.svelte')).not.toContain('activeSelection=');
		// Composer: active domain wins; absent selector → legacy arbitration.
		const composer = readLibSource('editor/EditorTransformControls.svelte');
		expect(composer).toContain('if (activeSelection) return null;');
		expect(composer).toContain('getActiveTransformTarget');
	});
	it('keeps the policy helper renderer-neutral (no Three/Svelte/runes)', () => {
		const policy = readLibSource('editor/gizmo/editor-gizmo-policy.ts');
		expect(policy).not.toMatch(/from\s+['"](three|svelte|@threlte)['"]/);
		expect(policy).not.toContain('$state');
	});
	it('keeps layout, G4 render, camera route/motion, and visitor sources free of gizmo imports', () => {
		for (const source of [
			...readAllSourceFiles('layout').map((entry) => entry.source),
			...readAllSourceFiles('render').map((entry) => entry.source),
			...readAllSourceFiles('museum').map((entry) => entry.source)
		]) {
			expect(source).not.toContain('editor/gizmo');
		}
		const cameraRoute = readCameraCoreSource('camera-route.ts');
		const cameraMotion = readCameraCoreSource('camera-motion.ts');
		expect(cameraRoute).not.toContain('TransformControls');
		expect(cameraMotion).not.toContain('TransformControls');
	});
	it('pins the shared FSM sync event and the shell-level-only ESC branch', () => {
		const fsm = readLibSource('editor/store/interaction-fsm.ts');
		expect(fsm).toContain("type: 'ACTIVE_TARGET_CHANGE'");
		expect(fsm).toContain('targetKey: string | null');
		const escCase = fsm.slice(fsm.indexOf("case 'ESC':"), fsm.indexOf("case 'KEY_W':"));
		// A live gizmo drag never dispatches ESC (every cancel reason routes
		// through the adapter's cancel + DRAG_END { cancelled: true }), so the
		// ESC branch must contain no Dragging-revert path.
		expect(escCase).not.toContain('RevertDragSideEffect');
		expect(escCase).not.toContain("state === 'Dragging'");
	});
	it('keeps the layout descriptor module renderer-neutral and mutation-free (S7 step 5)', () => {
		const descriptor = readLibSource('editor/gizmo/layout-gizmo-target.ts');
		expect(descriptor).not.toMatch(/from\s+['"](three|svelte|@threlte)['"]/);
		expect(descriptor).not.toContain('$state');
		// The descriptor exports the two S7 seams (S8 consumes the delta).
		expect(descriptor).toContain('export function resolveLayoutGizmoTarget');
		expect(descriptor).toContain('export function deriveLayoutGizmoDelta');
		// No layout preview/history mutation surface is reachable from it —
		// additionally enforced for every gizmo file by the layout-mutation
		// markers test above.
		expect(descriptor).not.toContain('updateLayout');
		expect(descriptor).not.toContain('commitLayoutTransaction');
		expect(descriptor).not.toContain('previewLayoutRoomUnit');
	});
	it('keeps the gizmo host descriptor-free while the composer resolves the live layout adapter (S8 flip)', () => {
		// S8 flips the S7 detached state: the composer's layout-domain branch now
		// resolves the descriptor and builds the live adapter. The host stays
		// constructor- and descriptor-free — it only forwards the input bag.
		expect(readLibSource('editor/EditorTransformControls.svelte')).toContain('layout-gizmo-target');
		expect(readLibSource('editor/gizmo/EditorTransformControlsHost.svelte')).not.toContain(
			'layout-gizmo-target'
		);
	});
	it('publishes the layout gate to the toolbar and shortcuts (stale identity, S8)', () => {
		// editor toolbar accepts the optional transformDisabled gate; the relic
		// mount omits it (no layout domain there). After S8 the gate fires only
		// for a stale/missing layout identity — a live one publishes its policy.
		const toolbar = readLibSource('editor/EditorViewportToolbar.svelte');
		expect(toolbar).toContain('transformDisabled?: boolean');
		expect(toolbar).toContain('transformDisabledFlag');
		expect(readLibSource('editor/app/EditorApp.svelte')).toContain(
			"transformDisabled={activeSelection.active.domain === 'layout' && layoutDescriptor === null}"
		);
		expect(readLibSource('editor/EditorViewport.svelte')).not.toContain('transformDisabled');
		// Shortcuts refuse W/E/R/T/X while a detached layout selection is active.
		const shortcuts = readLibSource('editor/hooks/shortcuts.svelte.ts');
		expect(shortcuts).toContain('isLayoutSelectionActive');
		expect(shortcuts).toContain('if (isLayoutSelectionActive?.()) return;');
	});
	it('drives the toolbar from the generic capability projection, legacy relic fallback intact (S7 step 6)', () => {
		const toolbar = readLibSource('editor/EditorViewportToolbar.svelte');
		// The toolbar consumes the projection, not a hasNavigationTransform
		// special case, and the scale chain is scene-placement-only.
		expect(toolbar).toContain('gizmoCapabilities?: EditorGizmoCapabilities | null');
		expect(toolbar).toContain('caps.allowedModes.has(mode)');
		expect(toolbar).toContain("caps.scaleControl === 'scene-scale-mode'");
		// The relic keeps the legacy camera restriction when no projection is fed.
		expect(toolbar).toContain('hasNavigationTransform');
		expect(toolbar).toContain('toolDisabled');
	});
	it('shares one domain→capability projection between the toolbar and shortcuts (S7 step 6)', () => {
		const ws3d = readLibSource('editor/app/Workspace3DView.svelte');
		const app = readLibSource('editor/app/EditorApp.svelte');
		// P21.1: the single projection lives in EditorApp (fed to the ribbon);
		// the 3D viewport no longer computes it.
		expect(app).toContain('projectDomainGizmoCapabilities');
		expect(app).toContain('SCENE_GIZMO_POLICY');
		expect(app).toContain('CAMERA_GIZMO_POLICY');
		expect(ws3d).not.toContain('projectDomainGizmoCapabilities');
		expect(readLibSource('editor/app/WorkspaceRibbon.svelte')).toContain('gizmoCapabilities');
		// The policies are one source shared with the host through the adapters.
		expect(readLibSource('editor/gizmo/scene-gizmo-adapter.svelte.ts')).toContain(
			'export const SCENE_GIZMO_POLICY'
		);
		expect(readLibSource('editor/gizmo/camera-gizmo-adapter.svelte.ts')).toContain(
			'export const CAMERA_GIZMO_POLICY'
		);
	});
	it('refuses unsupported W/E/R/T modes through the same capability policy (S7 step 6)', () => {
		const shortcuts = readLibSource('editor/hooks/shortcuts.svelte.ts');
		expect(shortcuts).toContain('getGizmoCapabilities');
		expect(shortcuts).toContain('caps.allowedModes.has(modeForKey)');
		// Relic camera targets refuse rotate/scale keys, matching the toolbar's
		// existing restriction; the Escape cascade and preview locks are intact.
		expect(shortcuts).toContain("hasNavigationTransform && modeForKey !== 'translate'");
		expect(shortcuts).toContain('const inPreview = store.cameraPreview !== null;');
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('layout candidate session', () => {
	it('keeps $lib/layout/** renderer-neutral; the S8 candidate pipeline is editor-side', () => {
		// The candidate pipeline (deriveLayoutCandidate + per-kind builders)
		// lives under $lib/editor/gizmo, never $lib/layout — which stays
		// Three/Svelte/DOM-free and gizmo-import-free (the S7 gizmo-import
		// assertion is extended here to the full renderer surface).
		for (const source of readAllSourceFiles('layout').map((entry) => entry.source)) {
			expect(source).not.toMatch(/from\s+['"](three|svelte|@threlte|\$app)['"]/);
			expect(source).not.toContain('editor/gizmo');
			expect(source).not.toContain('deriveLayoutCandidate');
		}
	});
	it('resolves a live layout adapter for a non-null descriptor and null for a stale/missing one; the relic never receives it', () => {
		const composer = readLibSource('editor/EditorTransformControls.svelte');
		// The S3 layout-domain branch resolves the descriptor and builds the
		// live adapter; a stale/missing identity resolves no adapter.
		expect(composer).toContain("active.domain === 'layout'");
		expect(composer).toContain('createLayoutGizmoAdapter');
		expect(composer).toContain('resolveLayoutGizmoTarget');
		expect(composer).toContain('if (!descriptor) return null;');
		// The composer stays constructor-free; the shared proxy is adapter-module-owned.
		expect(composer).not.toContain('new ThreeTransformControls');
		// The relic mount passes no active-selection/layout inputs, so the
		// layout branch is unreachable there.
		expect(readLibSource('editor/EditorViewport.svelte')).not.toContain('activeSelection=');
	});
	it('publishes the descriptor policy through a nullable layout slot; a stale identity stays disabled (explicit gate, not caps === null)', () => {
		const policy = readLibSource('editor/gizmo/editor-gizmo-policy.ts');
		expect(policy).toContain('layout: EditorGizmoPolicy | null');
		// Both editor call sites resolve the active selection's descriptor and pass
		// its per-kind policy (null for a stale/missing identity).
		for (const source of [
			readLibSource('editor/app/EditorApp.svelte')
		]) {
			expect(source).toContain('resolveLayoutGizmoTarget');
			expect(source).toContain('layout: layoutDescriptor?.policy ?? null');
		}
		// The toolbar gate is explicit (layout domain AND descriptor null), not
		// caps === null — a live layout publishes its policy.
		expect(readLibSource('editor/app/EditorApp.svelte')).toContain(
			"transformDisabled={activeSelection.active.domain === 'layout' && layoutDescriptor === null}"
		);
		// Shortcuts refuse only a stale layout identity outright; a live one
		// falls through to the per-mode caps refusal.
		expect(readLibSource('editor/app/EditorApp.svelte')).toContain(
			"activeSelection.active.domain === 'layout' && layoutDescriptor === null"
		);
	});
	it('accepts the optional transient prop and feeds it from the adapter onTransient slot threaded through the composer', () => {
		const scene = readLibSource('editor/layout/LayoutPreviewScene.svelte');
		expect(scene).toContain('transient?: LayoutGizmoCandidateBundle | null');
		expect(scene).toContain('transient?.geometry ?? geometry');
		const ws3d = readLibSource('editor/app/Workspace3DView.svelte');
		expect(ws3d).toContain('transient={layoutTransient}');
		expect(ws3d).toContain('onLayoutTransient={(bundle) => (layoutTransient = bundle)}');
		// The composer forwards the editor slot setter into the adapter.
		expect(readLibSource('editor/EditorTransformControls.svelte')).toContain('onTransient: onLayoutTransient');
	});
	it('deriveLayoutCandidate returns { bundle | null, issue | null } and the adapter input includes isShiftHeld', () => {
		const candidate = readLibSource('editor/gizmo/layout-gizmo-candidate.ts');
		expect(candidate).toContain('export function deriveLayoutCandidate');
		expect(candidate).toContain('{ bundle: LayoutGizmoCandidateBundle | null; issue: string | null }');
		// The pure pipeline never throws — failures map to { bundle: null, issue }.
		expect(candidate).not.toContain('throw new Error');
		const adapter = readLibSource('editor/gizmo/layout-gizmo-adapter.svelte.ts');
		expect(adapter).toContain('isShiftHeld(): boolean');
		expect(adapter).toContain('beginLayoutTransaction');
	});
});

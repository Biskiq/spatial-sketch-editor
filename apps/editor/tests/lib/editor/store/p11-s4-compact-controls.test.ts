import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chopinRuntime } from '$lib/content/chopin-project';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { cloneFixtureDocument } from '../../content/__fixtures__/load-fixture-scene';
import { createFixtureEditorStore } from '../editor-test-utils';
import { useCameraTimeline } from '$lib/editor/hooks/use-camera-timeline.svelte';
import fs from 'node:fs';

const LIB_DIR = fileURLToPath(new URL('../../../../src/lib', import.meta.url));

function readLibSource(relativePath: string): string {
	return readFileSync(LIB_DIR + '/' + relativePath, 'utf8');
}

function createUnsequencedStore() {
	const document = cloneFixtureDocument();
	for (const node of document.navigationNodes) {
		delete (node as { nextNodeId?: string }).nextNodeId;
		delete (node as { previousNodeId?: string }).previousNodeId;
	}
	return createEditorStore({ document, rooms: chopinRuntime.rooms });
}

/**
 * P11.4 frozen-relic controls. P12 moved live mode/transport ownership into
 * EditorCameraTimelineFrame. This suite pins only retained relic behavior:
 * segmented Observer/Through; icon-only transport + Observer
 * tools with names/tooltips; Follow/Recenter Observer-only; Edge Reverse is
 * the paused-edge direction SWAP (main editor resets to 0; relic preserves
 * pose via the 1 − e flip); Repeat
 * is edge-only and never touches Sequence topology/duration; visible Stop is
 * gone from the timeline UI while `stopCameraPreview()` teardown stays
 * reachable via Escape/lifecycle only; the duplicate Preview Edge affordance
 * is removed from CameraFlowPanel + CameraPlanInspector.
 */

describe('P11.4 frozen-relic segmented mode + icon-only a11y', () => {
	const controls = readLibSource('editor/camera/EditorCameraPreviewControls.svelte');

	it('one accessible segmented Camera-mode control with aria-pressed segments', () => {
		expect(controls).toContain('role="group" aria-label="Camera mode"');
		expect(controls).toContain("aria-pressed={preview.mode === 'director'}");
		expect(controls).toContain("aria-pressed={preview.mode === 'visitor'}");
	});

	it('icon-only transport + Observer tools carry names and tooltips', () => {
		expect(controls).toContain('aria-label="Follow camera"');
		expect(controls).toContain('title="Follow camera"');
		expect(controls).toContain('aria-label="Recenter camera"');
		expect(controls).toContain('title="Recenter camera"');
		expect(controls).toContain('aria-label="Pause"');
		expect(controls).toContain('aria-label="Play"');
	});

	it('Follow/Recenter render only in Observer (director) mode — hidden in Through', () => {
		expect(controls).toContain("{#if preview.mode === 'director'}");
	});

	it('main-editor Ruler no longer owns Edge Reverse or Repeat controls; relic keeps them', () => {
		const ruler = readLibSource('editor/camera/EditorCameraTimelineRuler.svelte');
		const frame = readLibSource('editor/camera/EditorCameraTimelineFrame.svelte');
		const liveFrame = frame.slice(frame.indexOf('<header class="s4-header"'));
		expect(ruler).toContain('timelineApi.swapEdgeReverse()');
		expect(frame).not.toContain('aria-label="Repeat edge"');
		expect(liveFrame).not.toContain('Repeat edge');
		expect(liveFrame).not.toContain('>Reverse</button>');
	});

	it('relic toolbar keeps its dense row and narrow wrap', () => {
		expect(controls).toContain('grid-auto-flow: column;');
		expect(controls).toContain('@media (max-width: 44rem)');
		expect(controls).not.toContain('>Stop preview</button>');
	});
});

describe('P11.4 visible Stop removed from the timeline UI (§11.3)', () => {
	it('Stop is absent from PreviewControls, the Ruler, and the Panel', () => {
		const controls = readLibSource('editor/camera/EditorCameraPreviewControls.svelte');
		const ruler = readLibSource('editor/camera/EditorCameraTimelineRuler.svelte');
		const panel = readLibSource('editor/camera/EditorCameraTimelinePanel.svelte');
		for (const source of [controls, ruler, panel]) {
			expect(source).not.toContain('store.stopCameraPreview()');
			expect(source).not.toContain('Stop preview');
		}
	});

	it('internal stop teardown stays reachable through the store command', () => {
		const store = createFixtureEditorStore();
		expect(store.previewSequence('director')).toBe(true);
		expect(store.stopCameraPreview()).toBe(true);
		expect(store.cameraPreview).toBeNull();
	});
});

describe('P12.3 Edge Flip migration (§3)', () => {
	it('refuses outside paused edge state (idle, camera, playing)', () => {
		const store = createFixtureEditorStore();
		expect(store.swapEdgePreviewDirection()).toBe(false); // idle

		const camera = createUnsequencedStore();
		expect(camera.previewCamera('tour-a', 'director')).toBe(true);
		expect(camera.swapEdgePreviewDirection()).toBe(false); // camera scope

		expect(store.previewEdge('tour-a-b', 'forward', 'director')).toBe(true);
		expect(store.playCameraPreview()).toBe(true);
		expect(store.swapEdgePreviewDirection()).toBe(false); // playing
	});

	it('hook enable matrix: disabled unless paused edge with no active gesture', () => {
		const store = createFixtureEditorStore();
		const api = useCameraTimeline(store);
		expect(api.edgeReverseDisabled).toBe(true); // idle candidate

		expect(store.previewEdge('tour-a-b', 'forward', 'director')).toBe(true);
		expect(api.edgeReverseDisabled).toBe(false); // paused edge

		expect(store.playCameraPreview()).toBe(true);
		expect(api.edgeReverseDisabled).toBe(true); // playing
		expect(store.pauseCameraPreview()).toBe(true);

		store.transformInteractionActive = true;
		expect(api.edgeReverseDisabled).toBe(true); // active gesture
		store.transformInteractionActive = false;
		expect(api.edgeReverseDisabled).toBe(false);
	});
});

describe('P11.4 Edge Repeat is edge-only and never touches Sequence state (§11.3)', () => {
	it('repeat flag flips only for an active edge preview', () => {
		const store = createFixtureEditorStore();
		// Sequence scope — the guarded setter refuses.
		expect(store.previewSequence('director')).toBe(true);
		store.edgeRepeat = true;
		expect(store.edgeRepeat).toBe(false);

		// Edge scope — the flag lands and is session-only.
		expect(store.previewEdge('tour-a-b', 'forward', 'director')).toBe(true);
		store.edgeRepeat = true;
		expect(store.edgeRepeat).toBe(true);
		expect(store.cameraPreview).toMatchObject({ kind: 'edge' });
	});

	it('repeat toggling never changes document topology, timing, or history', () => {
		const store = createFixtureEditorStore();
		expect(store.previewEdge('tour-a-b', 'forward', 'director')).toBe(true);
		const connectionCount = store.document.connections.length;
		const historyVersion = store.historyVersion;

		store.edgeRepeat = true;

		expect(store.document.connections.length).toBe(connectionCount);
		expect(store.historyVersion).toBe(historyVersion);
	});

	it('hook repeat getter tracks the store flag; disabled outside edge scope', () => {
		const store = createFixtureEditorStore();
		const api = useCameraTimeline(store);
		expect(api.edgeRepeatDisabled).toBe(true); // no edge preview

		expect(store.previewEdge('tour-a-b', 'forward', 'director')).toBe(true);
		expect(api.edgeRepeatDisabled).toBe(false);
		store.edgeRepeat = true;
		expect(api.edgeRepeat).toBe(true);
	});
});

describe('P11.4 duplicate Preview Edge affordance disposition (§11.3)', () => {
	it('EditorCameraEdgePreviewActions stays only in the Editor Inspector', () => {
		expect(readLibSource('editor/camera/EditorCameraInspector.svelte')).toContain(
			'EditorCameraEdgePreviewActions'
		);
		expect(readLibSource('editor/CameraFlowPanel.svelte')).not.toContain(
			'EditorCameraEdgePreviewActions'
		);
		expect(readLibSource('editor/app/CameraPlanInspector.svelte')).not.toContain(
			'EditorCameraEdgePreviewActions'
		);
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('camera context contracts', () => {
	it('keeps P11 preview controls mounted only for the frozen relic', () => {
		const timeline = readLibSource('editor/camera/EditorCameraTimelinePanel.svelte');
		const controls = readLibSource('editor/camera/EditorCameraPreviewControls.svelte');
		const sidebar = readLibSource('editor/app/EditorSidebar.svelte');
		const relicSidebar = readLibSource('editor/EditorLeftSidebar.svelte');
		// Live P12 scope/chrome ownership lives in p12-s4-header-chrome.test.ts.
		// This component survives only inside the relic branch.
		expect(timeline).not.toContain('Camera flow unavailable');
		expect(timeline).toContain("scope === 'camera'");
		expect(timeline).toContain('{#if store.isRelic && preview}');
		// Retained-scope diagnostics and live lanes remain shared panel behavior.
		expect(timeline).toContain('{targetKindLabel} unavailable');
		expect(timeline).toContain('<EditorCameraTimelineDots {store} {viewMode} {contextMenu} />');
		expect(controls).toContain('preview.kind !== \'camera\'');
		expect(controls).toContain('store.playCameraPreview()');
		// Frozen P11.4 relic controls keep binary transport/mode tools; teardown
		// stays reachable through relic Escape/lifecycle.
		// P11.4 §11.3 — one accessible segmented Camera-mode control.
		// P11.2 §3 — the editor surface is locked only for a *visitor* preview;
		// a Director preview keeps the sidebar interactive (AA inspection + AP
		// authoring auto-pause). Migrated deliberately from isDocumentMutationBlocked.
		expect(sidebar).toContain('<div class="sidebar-content" inert={store.isVisitorCameraPreview}>');
		expect(sidebar).not.toContain('Back to museum');
		expect(relicSidebar).not.toContain('Back to museum');
	});
	it('fronts AP/AA/CH controls with the interaction/visitor predicates (P11.2 §3)', () => {
		// Sidebar inertness is visitor-only (Director playing/paused interactive).
		expect(readLibSource('editor/EditorLeftSidebar.svelte')).toContain(
			'<div class="sidebar-content" inert={store.isVisitorCameraPreview}>'
		);
		expect(readLibSource('editor/app/EditorSidebar.svelte')).toContain(
			'<div class="sidebar-content" inert={store.isVisitorCameraPreview}>'
		);
		// App bars keep only the interaction bar for domain/workspace switching (CH·AA).
		const appBar = readLibSource('editor/EditorAppBar.svelte');
		expect(appBar).toContain('canSwitchWorkspace = $derived(!store.isEditorInteractionActive)');
		expect(appBar).not.toContain('canSwitchWorkspace = $derived(!store.isDocumentMutationBlocked');
		const appAppBar = readLibSource('editor/app/WorkspaceRibbon.svelte');
		expect(appAppBar).toContain('const canSwitch = $derived(!store.isEditorInteractionActive)');
		expect(appAppBar).not.toContain('const canSwitch = $derived(!store.isDocumentMutationBlocked');
		// Timeline frame resize + toggle are CH·AA (no mutation-blocked term).
		const frame = readLibSource('editor/camera/EditorCameraTimelineFrame.svelte');
		expect(frame).not.toContain('isDocumentMutationBlocked');
		expect(frame).toContain('if (!expanded || store.isEditorInteractionActive) return;');
		// Director shield is non-blocking (visitor-only pointer-events: auto).
		for (const source of [
			readLibSource('editor/EditorViewport.svelte'),
			readLibSource('editor/app/Workspace3DView.svelte')
		]) {
			expect(source).toContain('class:non-blocking={!store.isVisitorCameraPreview}');
			expect(source).toContain('.preview-shield.non-blocking {');
			expect(source).toContain('pointer-events: none;');
		}
		// P21.6 review (A/B P1, second pass) — three-state ownership: playback
		// keeps the playhead owner; a paused Director preview yields the
		// filled helper to an editable selection, and paused with no
		// editable selection owns `none` (deselect never resurrects the
		// wireframe). Frame off suppresses both implementations. A playing
		// visitor keeps framing hidden and a paused visitor still shows it
		// (paused framing stays editable).
		const framingHelpers = readLibSource('editor/camera/EditorCameraFramingHelpers.svelte');
		expect(framingHelpers).toContain(
			'(store.isVisitorCameraPreview && store.isCameraPreviewPlaying)'
		);
		expect(framingHelpers).not.toContain('store.isDirectorCameraPreview ||');
		expect(framingHelpers).not.toContain('store.isCameraPreviewPlaying ||');
		// The playhead frustum renders for Director playback; a paused
		// editable selection hides the competing preview helper; paused
		// with no editable selection hides both — timeline scope,
		// transport, and playhead are untouched.
		const cameraRig = readLibSource('editor/camera/EditorCameraRig.svelte');
		expect(cameraRig).toContain("preview.mode !== 'director'");
		expect(cameraRig).toContain('computeBoundingSphere()');
		expect(cameraRig).not.toContain("preview.transport === 'playing' || !selectedFraming");
		// Room selection is AA (drop the broad mutation gate).
		const sceneTree = readLibSource('editor/EditorSceneTree.svelte');
		expect(sceneTree).not.toContain('if (store.isDocumentMutationBlocked) return;');
		expect(sceneTree).toContain('store.selectionActions.selectRoom(roomId);');
		// Inspector framing rows use the Inspector framing predicate; document rows
		// use the AP predicate — neither references the old broad gate.
		const inspector = readLibSource('editor/camera/EditorCameraInspector.svelte');
		expect(inspector).not.toContain('store.isDocumentMutationBlocked');
		expect(inspector).not.toContain('store.isCameraFramingMutationBlocked');
		expect(inspector).toContain('store.isInspectorFramingBlocked');
		expect(inspector).toContain('store.isAuthoringPauseBlocked');
		// Drag entry resolves, pauses, then captures; the transaction opens only
		// after the threshold. Pin the ordering inside each relevant function.
		const selectionSource = readLibSource('editor/EditorSelection.svelte');
		const beginPathPointer = selectionSource.slice(
			selectionSource.indexOf('function beginPathPointer'),
			selectionSource.indexOf('function beginDirectPathDrag')
		);
		expect(beginPathPointer.indexOf('requestAuthoringPause()')).toBeGreaterThan(-1);
		expect(beginPathPointer.indexOf('requestAuthoringPause()')).toBeLessThan(
			beginPathPointer.indexOf('setPointerCapture(event.pointerId)')
		);
		const planSource = readLibSource('editor/camera-plan/CameraPlanViewport.svelte');
		const beginPlanDrag = planSource.slice(
			planSource.indexOf('function beginDragSession'),
			planSource.indexOf('function startDragging')
		);
		expect(beginPlanDrag.indexOf('requestAuthoringPause()')).toBeGreaterThan(-1);
		expect(beginPlanDrag.indexOf('requestAuthoringPause()')).toBeLessThan(
			beginPlanDrag.indexOf('setPointerCapture(event.pointerId)')
		);
	});
});

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CAMERA_DIR = fileURLToPath(
	new URL('../../../../src/lib/editor/camera', import.meta.url)
);
const EDITOR_DIR = fileURLToPath(new URL('../../../../src/lib/editor', import.meta.url));

function readSource(relative: string): string {
	const absolute = relative.startsWith('camera/')
		? path.join(CAMERA_DIR, relative.slice('camera/'.length))
		: path.join(EDITOR_DIR, relative);
	return fs.readFileSync(absolute, 'utf8');
}

/**
 * P21.6 Slice B — cinematic 3D rework source contract. Headless pins for the
 * token swap + clutter removal; the §5 browser gate (occlusion, drag feel,
 * focus mode, frame-time impact) still needs live validation.
 */
describe('P21.6 Slice B — 3D camera visualization source contract', () => {
	it('renders a translucent invariant frustum fill with in-place updates', () => {
		const helpers = readSource('camera/EditorCameraFramingHelpers.svelte');
		expect(helpers).toContain('EditorSelectedVirtualCameraFrustumFill');
		expect(helpers).toContain('cameraFrustumFill');
		expect(helpers).toContain('DoubleSide');
		expect(helpers).toContain('opacity: 0.09');
		expect(helpers).toContain('writeEditorCameraFrustumVolumePositions');
		expect(helpers).toContain('writeEditorCameraFrustumLinePositions');
		expect(helpers).toContain('cameraFrustumLine');
		expect(helpers).not.toContain('0xffcf67');
		expect(helpers).not.toContain('BoxGeometry');
	});

	it('mounts blue FOV handles with invisible 24px pick shells', () => {
		const helpers = readSource('camera/EditorCameraFramingHelpers.svelte');
		expect(helpers).toContain('SphereGeometry(0.09');
		expect(helpers).toContain('cameraNodeSeq');
		expect(helpers).toContain('colorWrite = false');
		expect(helpers).toContain('pickShellScale');
	});

	it('unifies 3D nodes with the 2D badge grammar + dashed look-at ray', () => {
		const helpers = readSource('camera/EditorCameraHelpers.svelte');
		expect(helpers).toContain('LineDashedMaterial');
		expect(helpers).toContain('cameraLookAtRay');
		expect(helpers).toContain('lineDistance');
		expect(helpers).not.toContain('computeLineDistances');
		expect(helpers).toContain('cameraTarget');
		expect(helpers).toContain('RingGeometry');
		expect(helpers).toContain('cameraNodeSeq');
		expect(helpers).toContain('cameraNodeUnseq');
		expect(helpers).toContain('cameraNodeSeqActive');
		expect(helpers).not.toContain('0xd6b35f');
		expect(helpers).not.toContain('0x5bc8ff');
		expect(helpers).not.toContain('0xe9dfc5');
		expect(helpers).not.toContain('OctahedronGeometry');
	});

	it('shrinks anchors to invariant dots with pick shells', () => {
		const paths = readSource('camera/EditorCameraPathHelpers.svelte');
		expect(paths).toContain('SphereGeometry(0.07');
		expect(paths).toContain('cameraAnchor');
		expect(paths).toContain('colorWrite = false');
		expect(paths).not.toContain('0xffe29a');
		expect(paths).not.toContain('0xffd36b');
	});

	it('reconciles view keyframes with diamonds + crosshairs', () => {
		const views = readSource('camera/EditorCameraViewHelpers.svelte');
		expect(views).toContain('OctahedronGeometry');
		expect(views).toContain('cameraPathSelected');
		expect(views).toContain('cameraTarget');
		expect(views).toContain('cameraLookAtRay');
		expect(views).toContain('lineDistance');
		expect(views).not.toContain('setFromPoints');
		expect(views).not.toContain('0xff9ed2');
		expect(views).not.toContain('0x79d8ff');
	});

	it('freezes the FOV-drag basis with a slider fallback + arbitration', () => {
		const selection = readSource('EditorSelection.svelte');
		expect(selection).toContain('createEditorCameraFovDragBasis');
		expect(selection).toContain('evaluateEditorCameraFovDrag');
		expect(selection).toContain('sortIntersectionsBySameClassProjectedCenter');
		expect(selection).toContain('ns-resize');
		expect(selection).not.toContain('verticalFovFromEditorCameraFrustumPoint');
	});

	it('badges 3D nodes with the invariant 2D grammar', () => {
		const overlay = readSource('camera/EditorCameraLabelsOverlay.svelte');
		expect(overlay).toContain('--editor-camera-node-seq');
		expect(overlay).toContain('--editor-camera-node-unseq');
		expect(overlay).not.toContain('--editor-accent');
	});
});

describe('P21.6 review (A/B) — lifecycle transition source contract', () => {
	it('initializes every framing object hidden and invalidates on hide', () => {
		const helpers = readSource('camera/EditorCameraFramingHelpers.svelte');
		expect(helpers).toContain('body.visible = false;');
		expect(helpers).toContain('fill.visible = false;');
		expect(helpers).toContain('frustum.visible = false;');
		expect(helpers).toContain('topHandleRoot.visible = false;');
		expect(helpers).toContain('bottomHandleRoot.visible = false;');
	});

	it('keys the pose cache on selection identity and retags outside geometry writes', () => {
		const helpers = readSource('camera/EditorCameraFramingHelpers.svelte');
		expect(helpers).toContain('framingOwnerKey');
		expect(helpers).toContain('lastOwnerKey');
	});

	it('resolves paused-preview ownership in both frustum owners', () => {
		const helpers = readSource('camera/EditorCameraFramingHelpers.svelte');
		expect(helpers).toContain('resolveCameraPreviewFramingOwner');
		const rig = readSource('camera/EditorCameraRig.svelte');
		expect(rig).toContain('resolveCameraPreviewFramingOwner');
		// Stale focus never reaches strict getNode(): the store reconciles
		// on every document swap and the rig guards the boundary.
		expect(rig).toContain('graph.nodeById.has');
		expect(rig).toContain('clearCameraFocusRequest');
	});

	it('reconciles stale camera-focus IDs on every document swap', () => {
		const storeSource = readSource('editor-store.svelte.ts');
		expect(storeSource).toContain('reconcileCameraFocus');
	});
});

describe('P21.6 review (A/B second pass) — findings 1–9 source contract', () => {
	it('owns paused-no-selection as `none` and gates both owners on Frame + eligibility', () => {
		const framing = readSource('camera/editor-camera-framing.ts');
		expect(framing).toContain("'playhead' | 'selection' | 'none'");
		expect(framing).toContain('isFramingSelectionEligible');
		const helpers = readSource('camera/EditorCameraFramingHelpers.svelte');
		expect(helpers).toContain("!== 'selection'");
		expect(helpers).toContain('isFramingSelectionEligible');
		const rig = readSource('camera/EditorCameraRig.svelte');
		expect(rig).toContain("=== 'playhead'");
		expect(rig).toContain('store.viewportShowFraming');
		// Framing picking follows the same ownership decision.
		const selection = readSource('EditorSelection.svelte');
		expect(selection).toContain("!== 'selection'");
		expect(selection).toContain('isFramingSelectionEligible');
	});

	it('restricts arbitration to camera handles with a total CSS-pixel order', () => {
		const selection = readSource('editor-selection.ts');
		expect(selection).toContain('camera-fov-handle');
		expect(selection).toContain('CAMERA_ARBITRATION_RANK');
		expect(selection).toContain('viewportWidth / 2');
		// Placements keep distance order; hover/click/drag-entry share it.
		const component = readSource('EditorSelection.svelte');
		expect(component).toContain('selectionIntersections(event).map((hit) => hit.object)');
		expect(component).toContain('selectionIntersections(event).map((hit) => ({');
		expect(component).not.toContain('keep raw raycast order');
	});

	it('rechecks drag alignment per move and holds grazing blowups', () => {
		const framing = readSource('camera/editor-camera-framing.ts');
		expect(framing).toContain('movementRayDirection');
		expect(framing).toContain('basis.depth * 1000');
		const component = readSource('EditorSelection.svelte');
		expect(component).toContain('raycaster.ray.direction.toArray()');
	});

	it('excludes hidden helpers from picking without losing colorWrite-off shells', () => {
		const selection = readSource('editor-selection.ts');
		expect(selection).toContain('current.visible === false) return null;');
		const component = readSource('EditorSelection.svelte');
		expect(component).toContain('current.visible === false) return false;');
	});

	it('orients nub + preview from the shared basis and refreshes preview bounds', () => {
		const framing = readSource('camera/editor-camera-framing.ts');
		expect(framing).toContain('setEditorCameraFramingOrientation');
		const rig = readSource('camera/EditorCameraRig.svelte');
		expect(rig).toContain('setEditorCameraFramingOrientation(currentCamera');
		expect(rig).toContain('virtualCameraFrustum.geometry.computeBoundingSphere();');
		const helpers = readSource('camera/EditorCameraFramingHelpers.svelte');
		expect(helpers).toContain('setEditorCameraFramingOrientation(body');
		expect(helpers).not.toContain('body.lookAt(target);');
	});

	it('gives the visible path material the unlit editor-color treatment', () => {
		const helpers = readSource('camera/EditorCameraPathHelpers.svelte');
		const visualBlock = helpers.slice(
			helpers.indexOf('const visualMaterial = new LineMaterial({'),
			helpers.indexOf('const visual = new Line2(')
		);
		expect(visualBlock).toContain('toneMapped: false');
	});
});

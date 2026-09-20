import { describe, expect, it } from 'vitest';
import {
	createCameraPlanState,
	setCameraPlanTool
} from '$lib/editor/camera-plan/camera-plan-state.svelte';
import fs from 'node:fs';
import path from 'node:path';
import { LIB_DIR, readAllSourceFiles, readLibSource } from '../../../helpers/lib-source';

describe('createCameraPlanState', () => {
	it('boots into Select with an initialized pan/zoom viewport', () => {
		const state = createCameraPlanState();
		expect(state.tool).toBe('select');
		expect(state.planView.width).toBeGreaterThan(0);
		expect(state.planView.height).toBeGreaterThan(0);
		expect(state.planView.pixelsPerMeter).toBeGreaterThan(0);
		expect(state.planView.initialized).toBe(false);
		expect(state.planView.gridEnabled).toBe(true);
		expect(state.planView.snapEnabled).toBe(true);
		expect(state.hover).toBeNull();
	});
});

describe('setCameraPlanTool', () => {
	it('switches between Select and View and reports change', () => {
		const state = createCameraPlanState();
		expect(setCameraPlanTool(state, 'view')).toBe(true);
		expect(state.tool).toBe('view');
		expect(setCameraPlanTool(state, 'view')).toBe(false);
		expect(setCameraPlanTool(state, 'select')).toBe(true);
		expect(state.tool).toBe('select');
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('P21.3 camera reconciliation', () => {
	it('orders the Camera Plan ribbon Select | Add Camera Connect | View | Snap Grid', () => {
		const toolbar = readLibSource('editor/camera-plan/CameraPlanToolbar.svelte');
		// P21.5 §1.4 — command labels pair with 14px Lucide icons; the order
		// contract (Select | Add Camera Connect | View | Snap Grid) is unchanged.
		const order = ['Select</button>', 'Add Camera</button>', 'Connect</button>', 'View</button>', 'Snap</button>', 'Grid</button>'].map(
			(label) => toolbar.indexOf(label)
		);
		for (const [index, position] of order.entries()) {
			expect(position, `missing Row 2 control ${index}`).toBeGreaterThanOrEqual(0);
			if (index > 0) expect(position).toBeGreaterThan(order[index - 1]!);
		}
	});
	it('keeps FOV/frustum/look-target authoring out of Camera Plan', () => {
		const inspector = readLibSource('editor/app/CameraPlanInspector.svelte');
		expect(inspector).not.toContain('EditorCameraFovField');
		expect(inspector).not.toContain('EditorCameraFramingControls');
		expect(inspector).not.toContain('EditorVec3Field');
		expect(inspector).not.toContain('commitSelectedNodeFov');
		expect(inspector).not.toContain('viewportShowFraming');
		const toolbar = readLibSource('editor/camera-plan/CameraPlanToolbar.svelte');
		expect(toolbar).not.toContain('FOV');
		expect(toolbar).not.toContain('Frame');
		const viewport = readLibSource('editor/camera-plan/CameraPlanViewport.svelte');
		expect(viewport).not.toContain('viewportShowFraming');
		expect(viewport).not.toContain('EditorCameraFramingHelpers');
	});
	it('binds camera-plan world X/Z fields at Vec3 indices 0/2', () => {
		// World positions are Vec3 [x, y, z]. Z fields and both X/Z commits
		// must use index 2 — a prior regression bound World Z to [1]
		// (elevation Y), so dragging moved Z while the sidebar never updated,
		// and X-field commits wrote the node's height as world Z.
		const inspector = readLibSource('editor/app/CameraPlanInspector.svelte');
		expect(inspector).toContain('value={nodeWorld[2]}');
		expect(inspector).toContain('oncommit={(x) => commitNodeXZ(x, nodeWorld[2])}');
		expect(inspector).toContain('oncommit={(z) => commitNodeXZ(nodeWorld[0], z)}');
		expect(inspector).toContain('value={anchorWorld[2]}');
		expect(inspector).toContain('oncommit={(x) => commitAnchorXZ(x, anchorWorld[2])}');
		expect(inspector).toContain('oncommit={(z) => commitAnchorXZ(anchorWorld[0], z)}');
		expect(inspector).not.toContain('value={nodeWorld[1]}');
		expect(inspector).not.toContain('value={anchorWorld[1]}');
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('P1.5 Camera Plan source contracts', () => {
	it('EditorApp mounts the live Camera Plan workspace, never a placeholder', () => {
		const editorApp = readLibSource('editor/app/EditorApp.svelte');
		expect(editorApp).toContain('CameraPlanWorkspace');
		expect(editorApp).toContain('createCameraPlanState');
		// P1.5 reactivity pin: the session state must be deep-proxied via
		// `$state`, or the viewport's pan/zoom/hover/tool mutations are
		// invisible and the surface renders frozen (no pan/zoom, stale
		// framing, ghost misalignment after resize).
		expect(editorApp).toContain('$state(createCameraPlanState())');
		expect(editorApp).not.toContain('CameraPlanPlaceholder');
		expect(
			fs.existsSync(path.join(LIB_DIR, 'editor/app/CameraPlanPlaceholder.svelte'))
		).toBe(false);
	});
	it('Camera Plan helpers carry no layout-selection mutation path', () => {
		for (const { name, source } of readAllSourceFiles('editor/camera-plan')) {
			expect(source, `${name} contains no selectLayout*`).not.toContain('selectLayout');
			expect(source, `${name} contains no clearLayoutSelection`).not.toContain('clearLayoutSelection');
			expect(source, `${name} never touches layoutInteraction`).not.toContain('layoutInteraction');
		}
		const projection = readLibSource('editor/layout/plan-camera-projection.ts');
		expect(projection).toContain('buildPlanCameraAuthoringProjection');
		expect(projection).toContain('resolvePlanSceneGraphFromDocument');
		expect(projection).not.toContain('selectLayout');
		expect(projection).not.toContain('clearLayoutSelection');
	});
});

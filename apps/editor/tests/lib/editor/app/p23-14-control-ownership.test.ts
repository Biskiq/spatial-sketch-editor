import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../../../src/lib/editor', import.meta.url));

function read(relative: string): string {
	return fs.readFileSync(path.join(SRC, relative), 'utf8');
}

/** Body of a svelte `{#if …}` block, nested blocks included. */
function ifBlock(source: string, opener: string, from = 0): string {
	const start = source.indexOf(opener, from);
	expect(start, `${opener} must exist`).toBeGreaterThanOrEqual(0);
	const token = /\{#if\b|\{\/if\}/g;
	token.lastIndex = start;
	let depth = 0;
	let match: RegExpExecArray | null;
	while ((match = token.exec(source))) {
		if (match[0] === '{#if') depth += 1;
		else {
			depth -= 1;
			if (depth === 0) return source.slice(start, match.index);
		}
	}
	throw new Error(`unterminated ${opener}`);
}

/**
 * P23.14 §14 — one fact, one authoritative control owner.
 *
 * The 3D views mount the SAME toolbar component twice (View Bar in its
 * `ribbon` form, Tool Tray in its `tray` form), so ownership has to be decided
 * by the host or the shell grows two live writers for one fact. These are the
 * acceptance assertions for the seam that produced View menus in both hosts,
 * and duplicated panel / grid / camera-helper / preview-mode controls.
 */
describe('P23.14 §14 — one writable owner per fact in the 3D chrome', () => {
	const toolbar = read('EditorViewportToolbar.svelte');
	const ribbon = read('app/WorkspaceRibbon.svelte');
	const trayHost = read('app/Workspace3DView.svelte');
	const gridControls = read('EditorViewportGridControls.svelte');
	const drawer = read('camera/EditorCameraTimelineFrame.svelte');
	const previewControls = read('camera/EditorCameraPreviewControls.svelte');
	const flat = (source: string) => source.replace(/\s+/g, ' ');

	it('the View menu renders exactly once, for a host that owns it', () => {
		// The tray renders the same component, so the menu is gated on the HOST:
		// the tray never paints it, and the camera ribbon's own site (inside its
		// group order) suppresses the shared one instead of stacking a second
		// menu beside it.
		expect(toolbar).toContain(
			'const viewMenuHost = $derived(!tray && !(ribbon && isCameraContext));'
		);
		const menuHost = ifBlock(toolbar, '{#if viewMenuHost}');
		expect(menuHost).toContain('{@render viewMenu()}');
		expect(toolbar.match(/\{@render viewMenu\(\)\}/g) ?? []).toHaveLength(2);
	});

	it('the tray host paints the tool vocabulary and mounts no bar utility', () => {
		expect(trayHost).toContain('<EditorViewportToolbar tray');
		expect(trayHost).not.toContain('<EditorViewportGridControls');
		expect(ribbon).toContain('<EditorViewportToolbar ribbon');
	});

	it('panel visibility is written only by the View Bar utilities', () => {
		for (const write of ['toggleLeftSidePanel', 'toggleRightSidePanel', 'toggleFocusMode']) {
			expect(ribbon, `${write} must be reachable from the View Bar`).toContain(`store.${write}()`);
			expect(toolbar, `${write} must not have a second writer in the toolbar`).not.toContain(write);
		}
	});

	it('grid visibility and opacity are written only by the grid control the bar mounts', () => {
		expect(gridControls).toContain('store.toggleGrid()');
		expect(ribbon).toContain('<EditorViewportGridControls {store} />');
		// The menu used to carry a second Grid row for the same fact.
		expect(toolbar).not.toContain('store.gridVisible');
		expect(toolbar).not.toContain('store.toggleGrid()');
	});

	it('camera helper visibility has exactly one owner per host', () => {
		// Where a bar exists it paints Path and Frame as direct toggles, so the
		// menu must not also offer them.
		expect(toolbar).toContain('>Path</button>');
		expect(toolbar).toContain('>Frame</button>');
		const tourPaths = toolbar.indexOf('<span>Tour paths</span>');
		expect(tourPaths).toBeGreaterThanOrEqual(0);
		const barOnlyRows = ifBlock(
			toolbar,
			'{#if !ribbon}',
			toolbar.lastIndexOf('{#if !ribbon}', tourPaths)
		);
		expect(barOnlyRows).toContain('<span>Tour paths</span>');
		expect(barOnlyRows).toContain('Framing &amp; FOV');
		// …while the two rows with no other owner anywhere stay outside that gate.
		expect(barOnlyRows).not.toContain('Node handles');
		expect(barOnlyRows).not.toContain('Retained paths');
		expect(toolbar).toContain('<span>Node handles</span>');
		expect(toolbar).toContain('<span>Retained paths</span>');
	});

	it('the camera preview mode is written only by the Camera Drawer transport', () => {
		// The drawer carries the switch in both its states and in both camera
		// views (collapsed mini-player always; the expanded panel while a
		// preview is live), so it is the owner and the bar keeps no copy.
		expect(drawer).toContain('function choosePreviewMode(');
		expect(drawer).toContain('<span>POV</span>');
		expect(previewControls).toContain("store.setCameraPreviewMode('visitor')");
		expect(toolbar).not.toContain('chooseCameraPreviewMode');
		expect(toolbar).not.toContain('setCameraPreviewMode');
		expect(toolbar).not.toContain('previewMode');
	});
});

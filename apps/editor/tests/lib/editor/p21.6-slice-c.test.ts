import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chopinRuntime } from '$lib/content/chopin-project';
import { cloneFixtureDocument } from '../content/__fixtures__/load-fixture-scene';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEditorShortcutHandler } from '$lib/editor/hooks/shortcuts.svelte';
import { createEditorCameraFramingGeometry } from '$lib/editor/camera/editor-camera-framing';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB_DIR = path.resolve(HERE, '../../../src/lib');

function readLibSource(relativePath: string): string {
	return fs.readFileSync(path.join(LIB_DIR, relativePath), 'utf8');
}

function createFixtureEditorStore() {
	return createEditorStore({ document: cloneFixtureDocument(), rooms: chopinRuntime.rooms });
}

function makeKeyEvent(key: string): KeyboardEvent {
	let defaultPrevented = false;
	return {
		key,
		metaKey: false,
		ctrlKey: false,
		altKey: false,
		shiftKey: false,
		target: null,
		get defaultPrevented() {
			return defaultPrevented;
		},
		preventDefault() {
			defaultPrevented = true;
		},
		stopPropagation() {}
	} as KeyboardEvent;
}

const nullShortcutHost = {
	getViewportElement: () => null,
	getOutlinerElement: () => null,
	getClusterNameInput: () => null
};

describe('P21.6 Slice C — focus-mode state', () => {
	it('defaults to full chrome (six-PNG baseline unaffected)', () => {
		const store = createFixtureEditorStore();
		expect(store.leftSidePanelCollapsed).toBe(false);
		expect(store.rightSidePanelCollapsed).toBe(false);
		expect(store.focusMode).toBe(false);
		expect(store.hasPendingSidePanels).toBe(false);
	});

	it('collapses sides independently without touching history', () => {
		const store = createFixtureEditorStore();
		const beforeJson = store.canonicalJson;
		const beforeHistory = store.historyVersion;
		expect(store.toggleLeftSidePanel()).toBe('applied');
		expect(store.leftSidePanelCollapsed).toBe(true);
		expect(store.rightSidePanelCollapsed).toBe(false);
		expect(store.focusMode).toBe(false);
		expect(store.toggleRightSidePanel()).toBe('applied');
		expect(store.focusMode).toBe(true);
		expect(store.toggleLeftSidePanel()).toBe('applied');
		expect(store.focusMode).toBe(false);
		expect(store.canonicalJson).toBe(beforeJson);
		expect(store.historyVersion).toBe(beforeHistory);
	});

	it('restores the independent configuration on focus exit', () => {
		const store = createFixtureEditorStore();
		expect(store.toggleLeftSidePanel()).toBe('applied');
		expect(store.toggleFocusMode()).toBe('applied');
		expect(store.focusMode).toBe(true);
		expect(store.toggleFocusMode()).toBe('applied');
		expect(store.leftSidePanelCollapsed).toBe(true);
		expect(store.rightSidePanelCollapsed).toBe(false);
	});

	it('expands both on focus exit with no snapshot', () => {
		const store = createFixtureEditorStore();
		// Manually collapsing both reaches derived focus with no entry
		// snapshot — exiting then expands both instead of restoring stale.
		expect(store.toggleLeftSidePanel()).toBe('applied');
		expect(store.toggleRightSidePanel()).toBe('applied');
		expect(store.focusMode).toBe(true);
		expect(store.toggleFocusMode()).toBe('applied');
		expect(store.leftSidePanelCollapsed).toBe(false);
		expect(store.rightSidePanelCollapsed).toBe(false);
	});
});

describe('P21.6 Slice C — drag deferral', () => {
	it('defers requests mid-gesture, coalesces repeats, applies on teardown', () => {
		const store = createFixtureEditorStore();
		store.setDirectFramingInteractionActive(true);
		expect(store.toggleFocusMode()).toBe('deferred');
		expect(store.focusMode).toBe(false);
		expect(store.hasPendingSidePanels).toBe(true);
		// A repeat coalesces from the effective (pending) state: pending is
		// focus, so toggling left expands it — latest wins.
		expect(store.toggleLeftSidePanel()).toBe('deferred');
		// Gesture teardown (commit/cancel path) flushes.
		store.setDirectFramingInteractionActive(false);
		expect(store.hasPendingSidePanels).toBe(false);
		expect(store.leftSidePanelCollapsed).toBe(false);
		expect(store.rightSidePanelCollapsed).toBe(true);
	});

	it('defers across lane scrub and flushes on scrub end', () => {
		const store = createFixtureEditorStore();
		store.setTimelineScrubActive(true);
		expect(store.toggleRightSidePanel()).toBe('deferred');
		expect(store.rightSidePanelCollapsed).toBe(false);
		store.setTimelineScrubActive(false);
		expect(store.rightSidePanelCollapsed).toBe(true);
	});

	it('computes mid-gesture toggles from pending-wins-current', () => {
		const store = createFixtureEditorStore();
		store.setDirectFramingInteractionActive(true);
		expect(store.toggleLeftSidePanel()).toBe('deferred');
		// Second press inverts the first (pending), not stale live state.
		expect(store.toggleLeftSidePanel()).toBe('deferred');
		store.setDirectFramingInteractionActive(false);
		expect(store.leftSidePanelCollapsed).toBe(false);
		expect(store.hasPendingSidePanels).toBe(false);
	});

	it('drops a deferred focus snapshot when overwritten mid-gesture', () => {
		const store = createFixtureEditorStore();
		store.setDirectFramingInteractionActive(true);
		expect(store.toggleFocusMode()).toBe('deferred');
		// Overwrite with an individual toggle (from the pending focus
		// state, so left expands): the entry op and its snapshot are gone.
		expect(store.toggleLeftSidePanel()).toBe('deferred');
		store.setDirectFramingInteractionActive(false);
		expect(store.leftSidePanelCollapsed).toBe(false);
		expect(store.rightSidePanelCollapsed).toBe(true);
		// A fresh focus cycle snapshots the flushed state — exit restores
		// right-collapsed, proving no stale all-expanded snapshot survived
		// (it would have expanded the right panel on exit).
		expect(store.toggleFocusMode()).toBe('applied');
		expect(store.focusMode).toBe(true);
		expect(store.toggleFocusMode()).toBe('applied');
		expect(store.leftSidePanelCollapsed).toBe(false);
		expect(store.rightSidePanelCollapsed).toBe(true);
	});

	it('external resize clears lane scrub and applies pending', () => {
		const store = createFixtureEditorStore();
		store.setTimelineScrubActive(true);
		expect(store.toggleFocusMode()).toBe('deferred');
		store.cancelActiveGestureForExternalResize();
		expect(store.isSidePanelChangeDeferred).toBe(false);
		expect(store.focusMode).toBe(true);
		expect(store.hasPendingSidePanels).toBe(false);
	});

	it('keeps the stash while any gesture is still active', () => {
		const store = createFixtureEditorStore();
		store.setDirectPathInteractionActive(true);
		store.setDirectFramingInteractionActive(true);
		expect(store.toggleFocusMode()).toBe('deferred');
		store.setDirectPathInteractionActive(false);
		// Framing still active: nothing applies yet.
		expect(store.focusMode).toBe(false);
		expect(store.hasPendingSidePanels).toBe(true);
		store.setDirectFramingInteractionActive(false);
		expect(store.focusMode).toBe(true);
	});

	it('applies pending on workspace exit', () => {
		const store = createFixtureEditorStore();
		store.setDirectFramingInteractionActive(true);
		expect(store.toggleFocusMode()).toBe('deferred');
		// Workspace switches refuse mid-gesture; once teardown runs the
		// switch flushes the released config.
		expect(store.setWorkspace('camera')).toBe(false);
		store.setDirectFramingInteractionActive(false);
		expect(store.focusMode).toBe(true);
		expect(store.setWorkspace('camera')).toBe(true);
		expect(store.focusMode).toBe(true);
	});

	it('cancels the active gesture on external resize', () => {
		const store = createFixtureEditorStore();
		// Production wiring: the pointer session owner registers a canceler
		// that clears its flag (EditorSelection.cancelDirectDrag).
		store.setDirectPathDragCanceler(() => {
			store.setDirectFramingInteractionActive(false);
			return true;
		});
		store.setDirectFramingInteractionActive(true);
		store.cancelActiveGestureForExternalResize();
		expect(store.isEditorInteractionActive).toBe(false);
		// Idle resize is a no-op.
		store.cancelActiveGestureForExternalResize();
		expect(store.isEditorInteractionActive).toBe(false);
	});
});

describe('P21.6 Slice C — focus shortcut', () => {
	it('toggles focus on backslash outside editable targets', () => {
		const store = createFixtureEditorStore();
		const handle = createEditorShortcutHandler(store, nullShortcutHost);
		handle(makeKeyEvent('\\'));
		expect(store.focusMode).toBe(true);
		handle(makeKeyEvent('\\'));
		expect(store.focusMode).toBe(false);
	});

	it('leaves the frozen relic chrome untouched', () => {
		const store = createEditorStore({
			document: cloneFixtureDocument(),
			rooms: chopinRuntime.rooms,
			relic: true
		});
		const handle = createEditorShortcutHandler(store, nullShortcutHost);
		handle(makeKeyEvent('\\'));
		expect(store.focusMode).toBe(false);
		expect(store.leftSidePanelCollapsed).toBe(false);
	});
});

describe('P21.6 Slice C — observer-relative framing aspect', () => {
	it('widens the far-plane rectangle with aspect at fixed vertical FOV', () => {
		const eye: [number, number, number] = [0, 1, 0];
		const target: [number, number, number] = [0, 1, -4];
		const square = createEditorCameraFramingGeometry(eye, target, 90, 1);
		const wide = createEditorCameraFramingGeometry(eye, target, 90, 2);
		// Vertical FOV is the authored invariant: depth, center, and handle
		// height never move with aspect (focus mode widens, never stretches).
		expect(wide.depth).toBe(square.depth);
		expect(wide.center).toEqual(square.center);
		expect(wide.topHandle).toEqual(square.topHandle);
		expect(wide.bottomHandle).toEqual(square.bottomHandle);
		// Horizontal half-extent doubles with aspect.
		for (let index = 0; index < 4; index += 1) {
			expect(wide.corners[index]![0]).toBeCloseTo(2 * square.corners[index]![0], 9);
			expect(wide.corners[index]![1]).toBeCloseTo(square.corners[index]![1], 9);
		}
	});
});

describe('P21.6 Slice C — shell wiring source contract', () => {
	it('collapses grid tracks toward 0 1fr 0 without unmounting the canvas', () => {
		const app = readLibSource('editor/app/EditorApp.svelte');
		expect(app).toContain('--editor-side-left');
		expect(app).toContain('--editor-side-right');
		expect(app).toContain('.page.panels-left-collapsed');
		expect(app).toContain('.page.panels-right-collapsed');
		expect(app).toContain('class:panels-left-collapsed={store.leftSidePanelCollapsed}');
		expect(app).toContain('class:panels-right-collapsed={store.rightSidePanelCollapsed}');
		// Focus restore + external-resize gesture cancel.
		expect(app).toContain('viewportElement?.focus()');
		expect(app).toContain('cancelActiveGestureForExternalResize');
		// The 3D cell stays mounted across collapse states: no panel flag
		// may gate Workspace3DView itself.
		const centerCell = app.slice(
			app.indexOf('<Workspace3DView'),
			app.indexOf('/>', app.indexOf('<Workspace3DView')) + 3
		);
		expect(centerCell).not.toContain('SidePanelCollapsed');
	});

	it('clips collapsed panels and marks them inert with focus restore refs', () => {
		const sidebar = readLibSource('editor/app/EditorSidebar.svelte');
		expect(sidebar).toContain('collapsed = false');
		expect(sidebar).toContain('inert={collapsed}');
		expect(sidebar).toContain('.panel.collapsed');
		const inspector = readLibSource('editor/EditorInspector.svelte');
		expect(inspector).toContain('collapsed = false');
		expect(inspector).toContain('bind:this={inspectorElement}');
		expect(inspector).toContain('inert={collapsed}');
		expect(inspector).toContain('.panel.collapsed');
		const app = readLibSource('editor/app/EditorApp.svelte');
		expect(app).toContain('collapsed={store.leftSidePanelCollapsed}');
		expect(app).toContain('collapsed={store.rightSidePanelCollapsed}');
		expect(app).toContain('bind:inspectorElement');
	});

	it('exposes Zone C toggles, View-menu rows, shortcut, and hint', () => {
		const ribbon = readLibSource('editor/app/WorkspaceRibbon.svelte');
		expect(ribbon).toContain('aria-label="Panel visibility"');
		expect(ribbon).toContain('store.toggleLeftSidePanel()');
		expect(ribbon).toContain('store.toggleRightSidePanel()');
		expect(ribbon).toContain('store.toggleFocusMode()');
		const toolbar = readLibSource('editor/EditorViewportToolbar.svelte');
		// P23.14 §14 — panel visibility is View Bar chrome and is painted there as
		// the `.utilities` group (asserted above). The View menu carried a second
		// Panels section until the ownership pass; one fact, one writer now, so
		// the toolbar must not redirect panel state at all.
		expect(toolbar).not.toContain('>Panels</div>');
		expect(toolbar).not.toContain('toggleLeftSidePanel');
		expect(toolbar).not.toContain('toggleRightSidePanel');
		expect(toolbar).not.toContain('toggleFocusMode');
		// The shortcut hint survives on the owning control (the View Bar's Focus
		// button), not in a second copy inside the menu.
		expect(toolbar).not.toContain('Focus 3D ( \\ )');
		const shortcuts = readLibSource('editor/hooks/shortcuts.svelte.ts');
		expect(shortcuts).toContain("event.key === '\\\\'");
		expect(shortcuts).toContain('store.toggleFocusMode()');
		// P23.14 §14 — the Status Rail is readout-only; the retired status-bar
		// keyboard-hint band is gone. Discoverability survives on the owning
		// surfaces (the View menu carries 'Focus 3D ( \ )' and the View Bar's
		// focus toggle carries the shortcut in its title).
		const status = readLibSource('editor/app/StatusBar.svelte');
		expect(status).not.toContain('\\ Focus');
	});

	it('resyncs scrub + Line2 projections on the resized viewport', () => {
		// Lane scrub owns the pointer capture and seeks idempotently; the
		// flag only gates panel deferral, never projection math.
		const dots = readLibSource('editor/camera/EditorCameraTimelineDots.svelte');
		expect(dots).toContain('store.setTimelineScrubActive(true)');
		expect(dots).toContain('store.setTimelineScrubActive(false)');
		// Fat-line resolution already resyncs every task tick (no Slice C
		// change needed — pinned so a regression is caught here).
		const paths = readLibSource('editor/camera/EditorCameraPathHelpers.svelte');
		expect(paths).toContain('useTask(updateResolution)');
	});
});

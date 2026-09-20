/**
 * `/museum/editor` **relic smoke** (T2c) — the dedicated safety net for the
 * frozen relic shell.
 *
 * **Why it exists.** The relic's proof is currently scattered across ~20
 * historical pins, most of them source slices of files the *live* shell also
 * owns (`p11-s4`, `p12-s3 B2b`, `p12-s4 C2b`, `p21.6-slice-c E3b`,
 * `contracts.test.ts` route/relic its). Those pins are the reason relic
 * consolidation cannot start: there is no single, independent artifact that says
 * "the relic still works". This is that artifact, and it is **additive** — no
 * historical relic pin is deleted here (see §K.4 of the harvest for the
 * replacement map and the future deletion candidates).
 *
 * **The six durable assertions** (C.1.4):
 *
 * 1. the relic route still mounts, through the virtual entry;
 * 2. it mounts the relic implementation, not greenfield `EditorApp`;
 * 3. its frozen interactions still work (Paris-only focus, placement arming);
 * 4. its frozen transport is still reachable (relic header/panel controls);
 * 5. shared-store changes cannot silently route the relic into live shell
 *    behaviour (Flip: the relic keeps its physical pose, the live shell resets);
 * 6. current editor shell ownership changes stay isolated from the relic.
 *
 * **Mechanism.** The transport assertion renders the shipped
 * `EditorCameraTimelineFrame` with a relic store via `svelte/server`, so it
 * proves what the frozen surface *emits* rather than what its source says;
 * everything else is driven through the real store, the real shortcut handler and
 * the real Vite plugin. Only genuine composition/route boundaries stay static —
 * those are import and mount boundaries, where static inspection is the correct
 * mechanism.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from 'svelte/server';

import { createEditorShortcutHandler } from '$lib/editor/hooks/shortcuts.svelte';
import { useCameraTimeline } from '$lib/editor/hooks/use-camera-timeline.svelte';
import EditorCameraTimelineFrame from '$lib/editor/camera/EditorCameraTimelineFrame.svelte';
import { createCameraMotionSample, sampleCameraMotion } from '@portfolio/camera-core';
import { museumEditorEntryPlugin } from '../../../../vite/museum-editor-entry-plugin';
import { createFixtureEditorStore, createRelicFixtureEditorStore } from '../editor-test-utils';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB_DIR = path.resolve(HERE, '../../../../src/lib');
const ROUTES_DIR = path.resolve(HERE, '../../../../src/routes');

function readLibSource(relativePath: string): string {
	return readFileSync(path.join(LIB_DIR, relativePath), 'utf8');
}

function readRouteSource(relativePath: string): string {
	return readFileSync(path.join(ROUTES_DIR, relativePath), 'utf8');
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

/** The shortcut host the relic shell has: no viewport, no outliner, no input. */
const nullShortcutHost = {
	getViewportElement: () => null,
	getOutlinerElement: () => null,
	getClusterNameInput: () => null
};

/**
 * Rendered markup of the timeline frame for a store. `expanded` puts the
 * expanded chrome in the tree: the live `s4-header`, or the relic Panel's own
 * ruler toolbar.
 */
function frameMarkup(
	store: ReturnType<typeof createFixtureEditorStore>,
	options: { expanded?: boolean } = { expanded: true }
): string {
	store.timelineExpanded = options.expanded ?? true;
	return render(EditorCameraTimelineFrame, { props: { store } }).body;
}

// ---------------------------------------------------------------------------
// 1 + 2. Mount: the route, the virtual entry, and the implementation
// ---------------------------------------------------------------------------

describe('relic smoke — the route mounts the relic implementation', () => {
	it('mounts the virtual entry and never the greenfield EditorApp', () => {
		const route = readRouteSource('museum/editor/+page.svelte');
		expect(route).toContain("from 'virtual:museum-editor-entry'");
		expect(route).toContain('<MuseumEditorEntry relic />');
		expect(route).not.toContain('EditorApp');
	});

	it('resolves the virtual entry through the real plugin, to the frozen shell', () => {
		const plugin = museumEditorEntryPlugin();
		const resolveId = plugin.resolveId as (id: string) => string | null | undefined;
		const load = plugin.load as (id: string, options?: unknown) => unknown;
		const resolved = resolveId.call({}, 'virtual:museum-editor-entry');
		expect(resolved).toBe('\0virtual:museum-editor-entry');
		const loaded = load.call({}, resolved as string);
		expect(typeof loaded).toBe('string');
		const source = loaded as string;
		// The entry is the frozen `MuseumEditorApp`, and it is exported as the
		// default — the route's `<MuseumEditorEntry />` is that module and nothing
		// else. (`MuseumEditorApp` matches a bare `EditorApp` substring, so the
		// assertion names the module boundary, not a substring.)
		expect(source).toMatch(/export \{ default \} from ".*\/src\/lib\/editor\/MuseumEditorApp\.svelte";/);
	});

	it('mounts the relic shell, not the greenfield editor surface', () => {
		// An import/mount boundary: this is a composition decision taken at mount
		// time, which is exactly what static inspection is for.
		const shell = readLibSource('editor/MuseumEditorApp.svelte');
		expect(shell).toContain("import EditorLeftSidebar from './EditorLeftSidebar.svelte';");
		expect(shell).toContain('<EditorLeftSidebar');
		expect(shell).not.toContain('UnifiedProjectTree');
		expect(shell).not.toContain('EditorApp.svelte;');
	});
});

// ---------------------------------------------------------------------------
// 3. Frozen interactions
// ---------------------------------------------------------------------------

describe('relic smoke — frozen relic interactions still work', () => {
	it('keeps the relic room-focus gate literally Paris-only', () => {
		const store = createRelicFixtureEditorStore();
		expect(store.focusRoom('paris')).toBe(true);
		expect(store.cameraFocusRoomId).toBe('paris');
		// `entrance` is a real Chopin room and the relic still refuses it: the
		// widened-gate regression this smoke exists to catch.
		expect(store.focusRoom('entrance')).toBe(false);
	});

	it('arms and cancels a relic placement without mutating the document', () => {
		const store = createRelicFixtureEditorStore();
		const before = store.document.entities.length;
		expect(store.beginAssetPlacement('paris-salon-chair')).toBe(true);
		expect(store.pendingPlacementAssetId).toBe('paris-salon-chair');
		expect(store.cancelPrimitivePlacement('Placement cancelled')).toBe(true);
		expect(store.pendingPlacementAssetId).toBeNull();
		expect(store.document.entities).toHaveLength(before);
	});
});

// ---------------------------------------------------------------------------
// 4. Frozen transport (rendered, not sliced)
// ---------------------------------------------------------------------------

describe('relic smoke — the frozen transport is still reachable', () => {
	it('renders the relic header, tour selector and frozen mini-player transport', () => {
		const markup = frameMarkup(createRelicFixtureEditorStore(), { expanded: false });
		expect(markup).toContain('relic-header');
		expect(markup).toContain('tour-selector');
		// The frozen P11.4 mini-shell is still what the relic mounts when collapsed.
		expect(markup).toContain('mini-player__transport');
		expect(markup).toContain('mini-player__timecode');
	});

	it('renders the relic’s own ruler and preview controls when a preview is live', () => {
		const store = createRelicFixtureEditorStore();
		expect(store.previewEdge('tour-a-b', 'forward', 'director')).toBe(true);
		const markup = frameMarkup(store);
		// The Panel's toolbar and PreviewControls are mounted under `isRelic` only,
		// so their presence is the frozen transport being reachable: the relic keeps
		// its own ruler scrubber where the live shell has the Dots playhead (C1b).
		expect(markup).toContain('Camera preview transport');
		expect(markup).toContain('Edge playhead');
		expect(markup).toContain('type="range"');
	});

	it('and the live shell renders the live header instead, in the same frame', () => {
		const markup = frameMarkup(createFixtureEditorStore());
		expect(markup).toContain('s4-header');
		expect(markup).not.toContain('relic-header');
		expect(markup).not.toContain('tour-selector');
		// The live header owns POV/Observer and the timecode (P12.4 C1a).
		expect(markup).toContain('aria-label="POV"');
		expect(markup).toContain('aria-label="Observer"');
	});
});

// ---------------------------------------------------------------------------
// 5. Shared-store detector
// ---------------------------------------------------------------------------

describe('relic smoke — shared-store changes cannot silently retune the relic', () => {
	it('keeps the relic’s frozen Flip semantics while the live shell resets', () => {
		// The *pair* is the detector: one shared store API, two branches. If a live
		// shell change (like P12's playhead reset) leaks into the relic path, the
		// relic half fails; if the relic's pose preservation is dropped, so does it.
		const relic = createRelicFixtureEditorStore();
		expect(relic.previewEdge('tour-a-b', 'forward', 'director')).toBe(true);
		expect(relic.setCameraPreviewPlayhead(0.5)).toBe(true);
		const relicBefore = createCameraMotionSample();
		sampleCameraMotion(useCameraTimeline(relic).edgeTimeline!.motion, relic.cameraPreview!.playhead, relicBefore);
		expect(relic.swapEdgePreviewDirection()).toBe(true);
		const relicAfter = createCameraMotionSample();
		sampleCameraMotion(useCameraTimeline(relic).edgeTimeline!.motion, relic.cameraPreview!.playhead, relicAfter);
		// Frozen P11.4 behaviour: the physical pose survives the Flip, so the
		// playhead stays where the user was standing (within float tolerance).
		expect(relic.cameraPreview!.playhead).toBeCloseTo(0.5, 6);
		expect(relicAfter.position.distanceTo(relicBefore.position)).toBeLessThan(1e-5);

		const live = createFixtureEditorStore();
		expect(live.previewEdge('tour-a-b', 'forward', 'visitor')).toBe(true);
		expect(live.setCameraPreviewPlayhead(0.5)).toBe(true);
		expect(live.swapEdgePreviewDirection()).toBe(true);
		// Current P12.3 behaviour: the non-relic Edge playhead resets on Flip.
		expect(live.cameraPreview!.playhead).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// 6. Shell ownership stays isolated
// ---------------------------------------------------------------------------

describe('relic smoke — the relic is isolated from live shell ownership', () => {
	it('refuses the Layout workspace on the relic and allows it on the live store', () => {
		const relic = createRelicFixtureEditorStore();
		expect(relic.setWorkspace('layout')).toBe(false);
		expect(relic.currentWorkspace).toBe('scene');

		const live = createFixtureEditorStore();
		expect(live.setWorkspace('layout')).toBe(true);
		expect(live.currentWorkspace).toBe('layout');
	});

	it('registers no layout history domain on a relic mount', () => {
		// `MuseumEditorApp` seeds Chopin and registers the layout history bridge
		// only when the mount is not a relic; the relic never gains or loses Layout
		// mid-session. This is a mount-time composition branch (the store cannot
		// observe "someone forgot to register"), so the guard is pinned where it is
		// decided, together with the behavioural refusal above.
		const shell = readLibSource('editor/MuseumEditorApp.svelte');
		const guardAt = shell.indexOf('if (!untrack(() => relic)) {');
		expect(guardAt).toBeGreaterThan(-1);
		const registerAt = shell.indexOf('store.registerLayoutHistory({', guardAt);
		expect(registerAt).toBeGreaterThan(guardAt);
		expect(shell).toContain('relic: untrack(() => relic)');
	});

	it('keeps a shell focus shortcut from reaching the relic shell', () => {
		const relic = createRelicFixtureEditorStore();
		createEditorShortcutHandler(relic, nullShortcutHost)(makeKeyEvent('\\'));
		expect(relic.focusMode).toBe(false);
		expect(relic.leftSidePanelCollapsed).toBe(false);
		expect(relic.rightSidePanelCollapsed).toBe(false);

		// …and the same key is the live shell's focus-mode toggle, so the isolation
		// is in the store branch rather than in a shortcut that never ran.
		const live = createFixtureEditorStore();
		createEditorShortcutHandler(live, nullShortcutHost)(makeKeyEvent('\\'));
		expect(live.focusMode).toBe(true);
	});

	it('keeps two editor stores independent (no shared live/shell state)', () => {
		const relic = createRelicFixtureEditorStore();
		const live = createFixtureEditorStore();
		const relicEntities = relic.document.entities.length;

		// The live shell moves on in every way this smoke cares about.
		expect(live.setWorkspace('layout')).toBe(true);
		expect(live.beginPrimitivePlacement('box')).toBe(true);
		expect(live.cancelPrimitivePlacement('Placement cancelled')).toBe(true);
		live.timelineExpanded = true;

		// None of it reaches the frozen relic instance.
		expect(relic.currentWorkspace).toBe('scene');
		expect(relic.pendingPlacementPrimitiveKind).toBeNull();
		expect(relic.timelineExpanded).toBe(false);
		expect(relic.document.entities).toHaveLength(relicEntities);
		expect(relic.isRelic).toBe(true);
	});
});

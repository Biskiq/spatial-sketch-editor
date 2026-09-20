import { describe, expect, it } from 'vitest';

import {
	EditorSelectionStore,
	navigationSelectionFromState
} from '$lib/editor/store/selection-store.svelte';
import { EditorSessionState } from '$lib/editor/store/session-state.svelte';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { chopinRuntime } from '$lib/content/chopin-project';
import { cloneFixtureDocument } from '../../content/__fixtures__/load-fixture-scene';
import { createEmptySceneDocument } from '$lib/content/scene';
import { deriveActiveSelection } from '$lib/editor/app/active-editor-selection.svelte';
import type { LayoutSelection } from '$lib/editor/layout/layout-interaction';

describe('EditorSelectionStore', () => {
	it('delegates tree expansion to its bound session', () => {
		const selection = new EditorSelectionStore();
		const session = new EditorSessionState();
		selection.bindSession(session);

		expect(selection.expandRoom('music-chamber')).toBe(true);
		expect(selection.expandCluster('cluster-1')).toBe(true);
		expect(selection.expandCameraConnection('connection-1')).toBe(true);
		expect(selection.expandCameraDirection('connection-1', 'reverse')).toBe(true);

		expect(session.treeExpandedRoomIds).toContain('music-chamber');
		expect(session.treeExpandedClusterIds).toContain('cluster-1');
		expect(session.treeExpandedCameraConnectionIds).toContain('connection-1');
		expect(session.treeExpandedCameraDirectionKeys).toContain('connection-1::reverse');
	});

	it('setNavigation(connection) mirrors connectionId and direction into discovery', () => {
		const selection = new EditorSelectionStore();
		selection.setNavigation({
			kind: 'connection',
			connectionId: 'c1',
			direction: 'reverse'
		});
		expect(selection.discoveryConnectionId).toBe('c1');
		expect(selection.discoveryDirection).toBe('reverse');
		expect(selection.navigation).toEqual({
			kind: 'connection',
			connectionId: 'c1',
			direction: 'reverse'
		});
	});

	it('setNavigation(anchor) preserves discovery direction', () => {
		const selection = new EditorSelectionStore();
		selection.setDiscovery('c1', 'reverse');
		selection.setNavigation({
			kind: 'anchor',
			connectionId: 'c1',
			anchorId: 'a1'
		});
		expect(selection.discoveryConnectionId).toBe('c1');
		expect(selection.discoveryDirection).toBe('reverse');
	});

	it('setNavigation(view-keyframe) mirrors direction into discovery', () => {
		const selection = new EditorSelectionStore();
		selection.setNavigation({
			kind: 'view-keyframe',
			connectionId: 'c1',
			direction: 'reverse',
			keyframeId: 'k1'
		});
		expect(selection.discoveryConnectionId).toBe('c1');
		expect(selection.discoveryDirection).toBe('reverse');
	});

	it('setNavigation(node|none) clears discovery', () => {
		const selection = new EditorSelectionStore();
		selection.setNavigation({
			kind: 'connection',
			connectionId: 'c1',
			direction: 'reverse'
		});
		selection.setNavigation({ kind: 'node', nodeId: 'n1', handle: 'position' });
		expect(selection.discoveryConnectionId).toBeNull();
		expect(selection.discoveryDirection).toBe('forward');

		selection.setNavigation({
			kind: 'connection',
			connectionId: 'c1',
			direction: 'reverse'
		});
		selection.setNavigation({ kind: 'none' });
		expect(selection.discoveryConnectionId).toBeNull();
	});

	it('setWorkspace with real placement clears nav and discovery', () => {
		const selection = new EditorSelectionStore();
		selection.setNavigation({
			kind: 'connection',
			connectionId: 'c1',
			direction: 'reverse'
		});
		selection.setWorkspace({
			kind: 'placement',
			ids: ['p1'],
			clusterId: null,
			roomId: 'paris'
		});
		expect(selection.navigation).toEqual({ kind: 'none' });
		expect(selection.discoveryConnectionId).toBeNull();
		expect(selection.discoveryDirection).toBe('forward');
	});

	it('setWorkspace room-only (empty placement) does not clear nav', () => {
		const selection = new EditorSelectionStore();
		selection.setNavigation({
			kind: 'node',
			nodeId: 'n1',
			handle: 'position'
		});
		selection.setWorkspace({
			kind: 'placement',
			ids: [],
			clusterId: null,
			roomId: 'paris'
		});
		expect(selection.navigation).toEqual({
			kind: 'node',
			nodeId: 'n1',
			handle: 'position'
		});
	});

	it('setWorkspace(cluster) clears nav', () => {
		const selection = new EditorSelectionStore();
		selection.setNavigation({
			kind: 'node',
			nodeId: 'n1',
			handle: 'position'
		});
		selection.setWorkspace({
			kind: 'cluster',
			clusterId: 'cl1',
			roomId: 'paris'
		});
		expect(selection.navigation).toEqual({ kind: 'none' });
	});

	it('setNavigation non-none clears placement pick but keeps room', () => {
		const selection = new EditorSelectionStore();
		selection.setWorkspace({
			kind: 'placement',
			ids: ['p1'],
			clusterId: null,
			roomId: 'paris'
		});
		selection.setNavigation({
			kind: 'connection',
			connectionId: 'c1',
			direction: 'forward'
		});
		expect(selection.workspace).toEqual({
			kind: 'placement',
			ids: [],
			clusterId: null,
			roomId: 'paris'
		});
	});

	it('setDiscovery(non-null) clears placement pick but keeps room', () => {
		const selection = new EditorSelectionStore();
		selection.setWorkspace({
			kind: 'placement',
			ids: ['p1'],
			clusterId: null,
			roomId: 'paris'
		});
		selection.setDiscovery('c1', 'reverse');
		expect(selection.workspace).toEqual({
			kind: 'placement',
			ids: [],
			clusterId: null,
			roomId: 'paris'
		});
		expect(selection.discoveryConnectionId).toBe('c1');
		expect(selection.discoveryDirection).toBe('reverse');
	});

	// P7.1 — the read adapter moved off the facade into this module; pin its
	// contract: direction dropped on read (discovery owns it, H1 s4), all
	// other kinds round-trip exactly.
	it('navigationSelectionFromState drops direction on connection reads', () => {
		const selection = new EditorSelectionStore();
		selection.setNavigation({
			kind: 'connection',
			connectionId: 'c1',
			direction: 'reverse'
		});
		expect(navigationSelectionFromState(selection.navigation)).toEqual({
			kind: 'connection',
			connectionId: 'c1'
		});
	});

	it('navigationSelectionFromState round-trips none / node / anchor / view-keyframe', () => {
		const selection = new EditorSelectionStore();
		selection.setNavigation({ kind: 'none' });
		expect(navigationSelectionFromState(selection.navigation)).toBeNull();

		selection.setNavigation({ kind: 'node', nodeId: 'n1', handle: 'position' });
		expect(navigationSelectionFromState(selection.navigation)).toEqual({
			kind: 'node',
			nodeId: 'n1',
			handle: 'position'
		});

		selection.setNavigation({ kind: 'anchor', connectionId: 'c1', anchorId: 'a1' });
		expect(navigationSelectionFromState(selection.navigation)).toEqual({
			kind: 'anchor',
			connectionId: 'c1',
			anchorId: 'a1'
		});

		selection.setNavigation({
			kind: 'view-keyframe',
			connectionId: 'c1',
			direction: 'forward',
			keyframeId: 'k1'
		});
		expect(navigationSelectionFromState(selection.navigation)).toEqual({
			kind: 'view-keyframe',
			connectionId: 'c1',
			direction: 'forward',
			keyframeId: 'k1'
		});
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('cross-domain selection contracts', () => {
	it('forwards onSelectionActivate from the store options into the reducer', () => {
		let fired = 0;
		const store = createEditorStore({
			document: cloneFixtureDocument(),
			rooms: chopinRuntime.rooms,
			onSelectionActivate: () => {
				fired += 1;
			}
		});
		const entityId = store.document.entities[0]!.id;

		// Room-only latent context never fires the hook.
		expect(store.selectionActions.selectRoom(store.document.entities[0]!.roomId!)).toBe(true);
		expect(fired).toBe(0);

		// An actionable placement pick fires it.
		expect(store.selectionActions.selectPlacement(entityId)).toBe(true);
		expect(fired).toBe(1);
	});
	it('preserves the active domain across view switches (pure mapping over untouched slots)', () => {
		const store = createEditorStore({ document: cloneFixtureDocument(), rooms: chopinRuntime.rooms });
		const entityId = store.document.entities[0]!.id;
		expect(store.selectionActions.selectPlacement(entityId)).toBe(true);

		// Synthetic fixture: the wrapper derives the active domain from the
		// untouched workspace/nav slots plus the (shell-owned) layout selection,
		// so a Plan↔3D switch cannot change it.
		const layoutSelection: LayoutSelection = { kind: 'room', roomId: 'paris' };
		const before = deriveActiveSelection(
			'scene',
			store.selection.workspace,
			store.selection.navigation,
			layoutSelection
		);

		expect(store.setWorkspace('layout')).toBe(true);
		expect(store.setWorkspace('camera')).toBe(true);
		expect(store.setWorkspace('scene')).toBe(true);

		const after = deriveActiveSelection(
			'scene',
			store.selection.workspace,
			store.selection.navigation,
			layoutSelection
		);
		expect(after).toEqual(before);
	});
	it('importDocument clears the scene selection slots; import begins with no active selection', () => {
		const store = createEditorStore({ document: cloneFixtureDocument(), rooms: chopinRuntime.rooms });
		const entityId = store.document.entities[0]!.id;
		expect(store.selectionActions.selectPlacement(entityId)).toBe(true);
		expect(
			store.selectionActions.selectNavigationNode(store.document.navigationNodes[0]!.id)
		).toBe(true);

		expect(store.importDocument(createEmptySceneDocument())).toBe(true);
		expect(store.selectedPlacementIds).toEqual([]);
		expect(store.selectedRoomId).toBeNull();
		expect(store.navigationSelection).toBeNull();
		expect(store.canUndo).toBe(false);
	});
});

<script lang="ts">
	import { Canvas } from '@threlte/core';
	import MuseumScene from '$lib/museum/MuseumScene.svelte';
	import type { EditorPlacementRegistry } from '$lib/museum/placement-registry';
	import EditorSceneEntities from './EditorSceneEntities.svelte';
	import EditorCameraHelpers from './camera/EditorCameraHelpers.svelte';
	import EditorCameraFramingHelpers from './camera/EditorCameraFramingHelpers.svelte';
	import EditorGrid from './EditorGrid.svelte';
	import { viewportPalette } from './theme.svelte';
	import EditorCameraPathHelpers from './camera/EditorCameraPathHelpers.svelte';
	import EditorCameraViewHelpers from './camera/EditorCameraViewHelpers.svelte';
	import EditorCameraRig from './camera/EditorCameraRig.svelte';
	import EditorPlacementTools from './EditorPlacementTools.svelte';
	import EditorSelection from './EditorSelection.svelte';
	import EditorSelectionHelper from './EditorSelectionHelper.svelte';
	import EditorTransformControls from './EditorTransformControls.svelte';
	import EditorViewportToolbar from './EditorViewportToolbar.svelte';
	import PlacementGhost from './placement-ghost.svelte';
	import LayoutPreviewScene from './layout/LayoutPreviewScene.svelte';
	import LayoutPlanViewport from './layout/LayoutPlanViewport.svelte';
	import LayoutDraftToolbar from './layout/LayoutDraftToolbar.svelte';
	import LayoutRenderGate from './layout/LayoutRenderGate.svelte';
	import { selectLayoutRoom, wallChainRoleForTool, type LayoutInteractionState } from './layout/layout-interaction';
	import type { LayoutPreviewState } from './layout/layout-preview-state.svelte';
	import {
		captureLayoutPreviewSnapshot,
		commitLayoutDraftRoom,
		commitLayoutOpening,
		commitWallChain,
		commitWallSegment,
		createWallFirstOpening,
		deleteLayoutOpening,
		deleteLayoutRoom,
		deleteWallFirstOpening,
		deleteWallFirstWall,
		removeWallFirstRoom,
		wallFirstRoomExclusiveBoundaryWallIds
	} from './layout/layout-preview-state.svelte';
	import { layoutMutationRunnerFor, runLayoutMutation } from './layout/layout-mutation-runner';
	import {
		createDefaultWallFirstOpeningIntent,
		type LayoutOpeningKind
	} from './layout/layout-opening-editing';
	import { wallFirstWallLength } from '$lib/layout/layout-wall-openings';
	import type { EditorStore } from './editor-store.svelte';
	import { resolveEditorPlacementScale } from './scale-vector';
	import type { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
	import { getContext } from 'svelte';
	import {
		EDITOR_INTERACTION_STORE_KEY,
		type EditorInteractionStore
	} from './store/editor-interaction-store.svelte';

	let {
		store,
		layoutPreview,
		layoutInteraction
	}: {
		store: EditorStore;
		layoutPreview: LayoutPreviewState;
		layoutInteraction: LayoutInteractionState;
	} = $props();
	const interactionStore = getContext<EditorInteractionStore | undefined>(
		EDITOR_INTERACTION_STORE_KEY
	);

	const placementRegistry: EditorPlacementRegistry = {
		registerPlacementRoot: (id, root) => store.registerPlacementRoot(id, root),
		unregisterPlacementRoot: (id, root) => store.unregisterPlacementRoot(id, root),
		notifyPlacementRootChanged: (id) => store.notifyPlacementRootChanged(id),
		// Getters keep the registry object identity stable (avoids remounting
		// EditorPlacementRoot register effects on every independent scale write)
		// while still exposing reactive session scale memory to MuseumEntities.
		get scaleVersion() {
			return store.placementScaleVectorVersion;
		},
		getPlacementScale: (id) => {
			const entity = store.document.entities.find((candidate) => candidate.id === id);
			return resolveEditorPlacementScale(
				entity?.scale,
				store.getPlacementScaleVector(id)
			);
		}
	};

	let transformControls = $state<TransformControls>();

	function commitDraftRoom(points: [number, number][]): boolean {
		// P23.9 — on a wall-first document the Rect/Polygon convenience tools
		// commit the same canonical Junction/Wall chain the chain tools do.
		if ('formatVersion' in layoutPreview.project.layout) {
			return commitDraftWallChain(points, true);
		}
		const outcome = runLayoutMutationGuarded(
			() => commitLayoutDraftRoom(layoutPreview, points),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return false;
		}
		const result = outcome.result;
		if (result.success) {
			store.setStatusMessage(`Created ${result.roomId}`);
		} else {
			store.setStatusMessage(`Room draft rejected: ${result.message}`);
		}
		return result.success;
	}

	/** P23.9 — bounded compound convenience tools (Rectangle/Polygon) commit one atomic chain. */
	function commitDraftWallChain(points: [number, number][], close: boolean): boolean {
		// P23.9 — boundary (Rect/Polygon close a boundary; Wall tool) vs
		// partition is fixed at commit time, not read from the live tool, so a
		// tool switch mid-commit can never flip the role of a drawn chain.
		const role = close && layoutInteraction.tool !== 'partition-chain'
			? 'boundary'
			: wallChainRoleForTool(layoutInteraction.tool) ?? 'boundary';
		const commitRole = role;
		const outcome = runLayoutMutationGuarded(
			() => commitWallChain(layoutPreview, points, commitRole, { close }),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			setWallChainStatus('Finish the current layout interaction first');
			return false;
		}
		const result = outcome.result;
		if (result.success) {
			// P23.6 — no verbose success messaging (see PlanWorkspace).
			setWallChainStatus('');
			if (result.operation === 'wall-chain-commit' && result.roomIds.length > 0) {
				selectLayoutRoom(layoutInteraction, result.roomIds[0]);
			}
		} else {
			setWallChainStatus(`Wall rejected: ${result.message}`);
		}
		return result.success;
	}

	/**
	 * P23.9 segment-first — one completed straight segment = one Wall
	 * authoring command and one Layout transaction. Preserves selection
	 * throughout the continuous run; never selects newborn Rooms mid-run.
	 */
	function commitDraftWallSegment(
		start: [number, number],
		end: [number, number]
	): {
		success: boolean;
		startJunctionId?: string;
		endJunctionId?: string;
		closedRun?: boolean;
		/** P23.6I — height the committed segment authored (run continuation state). */
		wallHeight?: number;
	} {
		const role = wallChainRoleForTool(layoutInteraction.tool) ?? 'boundary';
		const runStartBefore = layoutInteraction.wallChainRunStartJunctionId;
		const outcome = runLayoutMutationGuarded(
			// P23.6I — an in-progress run passes its own height explicitly; the first
			// segment of a run passes nothing and lets the canonical birth rule decide.
			() =>
				commitWallSegment(
					layoutPreview,
					start,
					end,
					role,
					layoutInteraction.wallChainRunHeight ?? undefined
				),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			setWallChainStatus('Finish the current layout interaction first');
			return { success: false };
		}
		const result = outcome.result;
		if (!result.success) {
			setWallChainStatus(`Wall rejected: ${result.message}`);
			return { success: false };
		}
		if (result.operation !== 'wall-segment-commit') {
			setWallChainStatus(`Wall rejected: unexpected commit result`);
			return { success: false };
		}
		// P23.6 — the committed Wall on Plan is the confirmation; no counts.
		setWallChainStatus('');
		const effectiveRunStart = runStartBefore ?? result.startJunctionId;
		const closedRun = role === 'boundary' && result.endJunctionId === effectiveRunStart;
		return {
			success: true,
			startJunctionId: result.startJunctionId,
			endJunctionId: result.endJunctionId,
			closedRun,
			...(result.wallHeight !== undefined ? { wallHeight: result.wallHeight } : {})
		};
	}

	/** P23.9 — mirror a chain outcome onto the plan surface (see PlanWorkspace). */
	function setWallChainStatus(message: string) {
		layoutPreview.statusMessage = message;
		store.setStatusMessage(message);
	}

	function createOpening(roomId: string, segmentId: string, kind: LayoutOpeningKind, clickOffset: number) {
		const outcome = runLayoutMutationGuarded(
			() => commitLayoutOpening(layoutPreview, roomId, segmentId, kind, clickOffset, layoutInteraction.planView.snapEnabled),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (outcome.result.success) {
			layoutInteraction.selection = { kind: 'opening', roomId, segmentId, openingId: outcome.result.openingId };
		}
		store.setStatusMessage(outcome.result.success ? `Created ${kind} opening` : `Opening rejected: ${outcome.result.message}`);
	}

	/** P23.3 — canonical Opening create/delete (see PlanWorkspace; relic parity). */
	function createWallOpening(wallId: string, kind: LayoutOpeningKind, clickOffset: number) {
		const layout = layoutPreview.project.layout;
		if (!('formatVersion' in layout)) return;
		const wallLength = wallFirstWallLength(
			layout as unknown as Parameters<typeof wallFirstWallLength>[0],
			wallId
		);
		if (wallLength === undefined) {
			store.setStatusMessage('Wall no longer exists');
			return;
		}
		const intent = createDefaultWallFirstOpeningIntent({
			wallId,
			kind,
			clickOffset,
			wallLength,
			snapEnabled: layoutInteraction.planView.snapEnabled
		});
		const outcome = runLayoutMutationGuarded(
			() => createWallFirstOpening(layoutPreview, intent),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		const result = outcome.result;
		if (result.success) {
			layoutInteraction.selection = {
				kind: 'wallOpening',
				wallId,
				openingId: result.openingId
			};
		}
		store.setStatusMessage(result.success ? `Created ${kind} opening` : `Opening rejected: ${result.message}`);
	}

	function deleteWallOpening(openingId: string) {
		const selection = layoutInteraction.selection;
		const outcome = runLayoutMutationGuarded(
			() => deleteWallFirstOpening(layoutPreview, openingId),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		const result = outcome.result;
		if (result.success && selection.kind === 'wallOpening' && selection.openingId === openingId) {
			layoutInteraction.selection = { kind: 'none' };
		}
		store.setStatusMessage(result.success ? 'Deleted opening' : `Opening delete failed: ${result.message}`);
	}

	/** P23.6c — canonical Wall delete: one history entry, post-delete selection fixed to `none`. */
	function deleteWall(wallId: string) {
		const outcome = runLayoutMutationGuarded(
			() => deleteWallFirstWall(layoutPreview, wallId),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		const result = outcome.result;
		if (result.success) {
			// Fixed policy — never a nearest-survivor or dangling `wallId`.
			layoutInteraction.selection = { kind: 'none' };
		}
		store.setStatusMessage(result.success ? 'Deleted wall' : `Wall delete failed: ${result.message}`);
	}

	/**
	 * P23.6d — canonical wall-first Room removal (viewport context menu + Delete
	 * key). Removes the Room and its own boundary Walls in one atomic step (Walls
	 * shared with a neighbour stay) and clears the canonical selection to `none`
	 * on success — never a dangling `roomId`.
	 */
	function removeRoom(roomId: string): boolean {
		if (wallFirstRoomExclusiveBoundaryWallIds(layoutPreview, roomId).length === 0) {
			store.setStatusMessage(
				'Every boundary wall is shared with a neighbouring room; delete a shared wall instead'
			);
			return false;
		}
		const outcome = runLayoutMutationGuarded(
			() => removeWallFirstRoom(layoutPreview, roomId),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return false;
		}
		const result = outcome.result;
		if (result.success) layoutInteraction.selection = { kind: 'none' };
		store.setStatusMessage(result.success ? 'Removed room' : `Room remove failed: ${result.message}`);
		return result.success;
	}

	function beginLayoutTransaction(): boolean {
		return store.beginLayoutTransaction();
	}

	function commitLayoutTransaction(): boolean {
		return store.commitLayoutTransaction(captureLayoutPreviewSnapshot(layoutPreview));
	}

	function cancelLayoutTransaction(): boolean {
		return store.cancelLayoutTransaction();
	}

	// one layout mutation = one undo entry: begin → mutate → commit/cancel.
	function runLayoutMutationGuarded<T>(mutate: () => T, didSucceed: (result: T) => boolean) {
		return runLayoutMutation(layoutMutationRunnerFor(store, layoutPreview), mutate, didSucceed);
	}

	function deleteOpening(roomId: string, openingId: string) {
		const selection = layoutInteraction.selection;
		const outcome = runLayoutMutationGuarded(
			() => deleteLayoutOpening(layoutPreview, roomId, openingId),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (outcome.result.success && selection.kind === 'opening' && selection.openingId === openingId) {
			layoutInteraction.selection = { kind: 'wall', roomId: selection.roomId, segmentId: selection.segmentId };
		}
		store.setStatusMessage(outcome.result.success ? 'Deleted opening' : `Opening delete failed: ${outcome.result.message}`);
	}

	// room deletion: guarded layout transaction + reject-when-
	// scene-referenced policy. (Unreachable in the relic, which cannot enter
	// the layout workspace, but kept in parity with the editor shell.)
	function deleteRoom(roomId: string): boolean {
		const outcome = runLayoutMutationGuarded(
			() => deleteLayoutRoom(layoutPreview, roomId, store.document),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return false;
		}
		if (!outcome.result.success) {
			store.setStatusMessage(`Room delete failed: ${outcome.result.message}`);
			return false;
		}
		layoutInteraction.selection = { kind: 'none' };
		store.setStatusMessage('Deleted room');
		return true;
	}
</script>

<div
	class="viewport"
	class:placing={Boolean(
		store.pendingPlacementAssetId ||
		store.pendingPlacementPrimitiveKind ||
			store.pendingPlacementLightKind ||
		store.pendingNavigationCommand?.kind === 'place-camera'
	)}
	class:bending={Boolean(store.hoveredConnectionId || store.hoveredAnchorId)}
	class:dragging-camera-key={store.viewKeyframeProgressDrag !== null}
	style:cursor={interactionStore?.cursor ?? 'default'}
	aria-label="Editor viewport"
>
	{#if store.currentWorkspace === 'layout'}
		<LayoutDraftToolbar interaction={layoutInteraction} preview={layoutPreview} onCancelLayoutTransaction={cancelLayoutTransaction} />
		<Canvas dpr={[1, 1.5]} shadows>
			<LayoutRenderGate interaction={layoutInteraction} />
			<MuseumScene
				scene={store.scene}
				state={store.state}
				showNavigationNodes={false}
				ambientIntensity={store.ambientIntensity}
				directionalIntensity={store.directionalIntensity}
				fogEnabled={store.fogEnabled}
				fogNear={store.fogNear}
				fogFar={store.fogFar}
				forceParisAssets
				showArchitecture={false}
				background={viewportPalette.background}
			>
				{#snippet camera(graph, _state)}
					<EditorCameraRig
						{store}
						{graph}
						layoutBounds={layoutPreview.bounds}
						layoutFrameVersion={layoutPreview.previewVersion}
					/>
				{/snippet}
				{#snippet entityRenderer(scene, rooms, _activation)}
					<EditorSceneEntities {scene} {rooms} {placementRegistry} />
				{/snippet}
			</MuseumScene>
			<LayoutPreviewScene
				model={layoutPreview.model}
				geometry={layoutPreview.geometry}
				wallMeshesByRoom={layoutPreview.wallMeshesByRoom}
				wallMeshesByWall={layoutPreview.wallMeshesByWall}
				interaction={layoutInteraction}
				showCeilings={layoutPreview.showCeilings}
				floorColor={store.floorColor}
			/>
			<EditorGrid
				visible={store.gridVisible && !store.isVisitorCameraPreview}
				opacity={store.gridOpacity}
			/>
		</Canvas>
		{#if layoutInteraction.viewMode === 'plan'}
			<LayoutPlanViewport
				model={layoutPreview.model}
				preview={layoutPreview}
				interaction={layoutInteraction}
				onCommit={commitDraftRoom}
				onWallSegmentCommit={commitDraftWallSegment}
				onOpeningCreate={createOpening}
				onOpeningDelete={deleteOpening}					onWallOpeningCreate={createWallOpening}
					onWallOpeningDelete={deleteWallOpening}
					onWallDelete={deleteWall}
				onRoomDelete={deleteRoom}
				onRoomRemove={removeRoom}
				onLayoutTransactionBegin={beginLayoutTransaction}
				onLayoutTransactionCommit={commitLayoutTransaction}
				onLayoutTransactionCancel={cancelLayoutTransaction}
			/>
		{/if}
	{:else}
		<EditorViewportToolbar {store} />
		<Canvas dpr={[1, 1.5]} shadows>
			<MuseumScene
				scene={store.scene}
				state={store.state}
				showNavigationNodes={false}
				ambientIntensity={store.ambientIntensity}
				directionalIntensity={store.directionalIntensity}
				fogEnabled={store.fogEnabled}
				fogNear={store.fogNear}
				fogFar={store.fogFar}
				forceParisAssets
				showArchitecture
				background={viewportPalette.background}
			>
				{#snippet camera(graph, _state)}
					<EditorCameraRig
						{store}
						{graph}
						layoutBounds={layoutPreview.bounds}
						layoutFrameVersion={layoutPreview.previewVersion}
					/>
				{/snippet}
				{#snippet entityRenderer(scene, rooms, _activation)}
					<EditorSceneEntities {scene} {rooms} {placementRegistry} />
				{/snippet}
			</MuseumScene>
			<EditorGrid
				visible={store.gridVisible && !store.isVisitorCameraPreview}
				opacity={store.gridOpacity}
			/>
			{#if store.viewportShowPaths}
				<EditorCameraPathHelpers {store} />
			{/if}
			{#if store.viewportShowFraming}
				<EditorCameraViewHelpers {store} />
				<EditorCameraFramingHelpers {store} />
			{/if}
			{#if store.viewportShowNodes || store.forceMountCameraNodeHandles}
				{#if (store.pendingNavigationCommand?.kind === 'connect-existing' || store.pendingNavigationCommand?.kind === 'connect-pending-node') && !store.isDocumentMutationBlocked}
					{#each store.document.navigationNodes as node (node.id)}
						<EditorCameraHelpers {store} nodeId={node.id} positionOnly />
					{/each}
					{#if store.pendingNavigationCommand?.kind === 'connect-pending-node'}
						<EditorCameraHelpers {store} nodeId={store.pendingNavigationCommand.node.id} />
					{/if}
				{:else if store.cameraSelection && !store.pendingPlacementAssetId && !store.pendingPlacementPrimitiveKind && !store.pendingPlacementLightKind && (!store.isFramingBlocked || (store.transformInteractionActive && store.transformInteractionKind === 'camera'))}
					{#key store.cameraSelection.nodeId}
						<EditorCameraHelpers {store} nodeId={store.cameraSelection.nodeId} />
					{/key}
				{/if}
			{/if}
			<EditorSelection {store} {transformControls} />
			<EditorPlacementTools {store} />
			<!-- Selection-bound Three helpers must be disposed and recreated for a new root. -->
			{#if !store.isVisitorCameraPreview}
				{#key store.selectionKey}
					<EditorSelectionHelper {store} />
				{/key}
			{/if}
			<EditorTransformControls {store} bind:controls={transformControls} />
			<!-- Phase 1b — placement ghost preview. Renders only while a placement
			     is armed; pure visual cue, click pipeline stays in EditorSelection. -->
			{#if !store.isVisitorCameraPreview}
				<PlacementGhost {store} />
			{/if}
		</Canvas>
	{/if}
	{#if store.isCameraPreviewPlaying}
		<!-- P11.2 §3 — only a visitor preview shields the canvas; the Director
		     label stays visible but non-blocking so selection/framing can
		     auto-pause through the seam (pointer-events: none). -->
		<div
			class="preview-shield"
			class:non-blocking={!store.isVisitorCameraPreview}
			role="status"
		>
			{#if store.isVisitorCameraPreview}
				Visitor preview · Stop or press Escape to return
			{:else}
				Director playback · Stop or press Escape to return
			{/if}
		</div>
	{/if}
	{#if store.pendingPlacementAssetId}
		<div class="placement-hint" role="status">
			Click a Paris floor to place · Escape cancels
		</div>
	{/if}
	{#if store.pendingPlacementPrimitiveKind}
		<div class="placement-hint" role="status">
			Click a tagged room floor to place · Escape cancels
		</div>
	{/if}
	{#if store.pendingPlacementLightKind}
		<div class="placement-hint" role="status">
			Click a tagged room floor to place light · Escape cancels
		</div>
	{/if}
	{#if store.pendingNavigationCommand?.kind === 'place-camera'}
		<div class="placement-hint" role="status">
			Click any tagged room floor to place · Escape cancels
		</div>
	{:else if store.pendingNavigationCommand?.kind === 'connect-pending-node'}
		<div class="placement-hint" role="status">
			Adjust pose or choose an existing camera node · Escape cancels
		</div>
	{:else if store.pendingNavigationCommand?.kind === 'connect-existing'}
		<div class="placement-hint" role="status">
			Choose a destination camera node · Escape cancels
		</div>
	{/if}
</div>

<style>
	.viewport {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
		background: var(--editor-bg-app);
	}

	.viewport.placing :global(canvas) {
		cursor: crosshair;
	}

	.viewport.bending :global(canvas) {
		cursor: grab;
	}

	.viewport.dragging-camera-key :global(canvas) {
		cursor: grabbing;
	}

	.placement-hint {
		position: absolute;
		left: 50%;
		bottom: 1rem;
		transform: translateX(-50%);
		padding: 0.48rem 0.7rem;
		border: 1px solid var(--editor-accent-border);
		border-radius: 999px;
		background: var(--editor-bg-panel-raised);
		color: var(--editor-text-primary);
		font: 600 0.73rem/1.2 var(--editor-font);
		pointer-events: none;
	}

	.preview-shield {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		box-sizing: border-box;
		padding: 1rem;
		background: linear-gradient(to top, rgb(5 5 8 / 46%), transparent 22%);
		color: var(--editor-text-primary);
		font: 600 0.73rem/1.2 var(--editor-font);
		pointer-events: auto;
	}

	/* P11.2 §3 — the Director playback label must not block the canvas; only a
	   visitor preview shields it (pointer-events: auto above). */
	.preview-shield.non-blocking {
		pointer-events: none;
	}

	.viewport :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>

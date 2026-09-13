<script lang="ts">
	import LayoutPlanViewport from '$lib/editor/layout/LayoutPlanViewport.svelte';
	import type { LayoutPreviewState } from '$lib/editor/layout/layout-preview-state.svelte';
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
	} from '$lib/editor/layout/layout-preview-state.svelte';
	import { layoutMutationRunnerFor, runLayoutMutation } from '$lib/editor/layout/layout-mutation-runner';
	import {
		createDefaultWallFirstOpeningIntent,
		type LayoutOpeningKind
	} from '$lib/editor/layout/layout-opening-editing';
	import { wallFirstWallLength } from '$lib/layout/layout-wall-openings';
	import type { EditorStore } from '$lib/editor/editor-store.svelte';
	import type { EditorContextMenuStore } from '$lib/editor/context-menu/context-menu-state.svelte';
	import {
		hasLayoutTransientInteraction,
		selectLayoutRoom,
		setPlanViewMode,
		wallChainRoleForTool,
		type PlanViewMode,
		type LayoutInteractionState
	} from '$lib/editor/layout/layout-interaction';
	import { resolveEditorPlacementScale } from '$lib/editor/scale-vector';
	import { placementTransformFromDocument } from '$lib/editor/editor-transform';
	import type { PlanSceneTransformPatch } from '$lib/editor/layout/plan-scene-transform';
	import type { SceneEntity } from '$lib/content/scene';
	import { getContext } from 'svelte';
	import {
		ACTIVE_EDITOR_SELECTION_KEY,
		type EditorActiveSelectionStore
	} from './active-editor-selection.svelte';

	let {
		store,
		layoutPreview,
		layoutInteraction,
		active = true,
		contextMenu = null
	}: {
		store: EditorStore;
		layoutPreview: LayoutPreviewState;
		layoutInteraction: LayoutInteractionState;
		/** Scene Plan visibility; false while keep-mounted Camera Plan owns the viewport. */
		active?: boolean;
		contextMenu?: EditorContextMenuStore | null;
	} = $props();
	const activeSelection = getContext<EditorActiveSelectionStore | undefined>(
		ACTIVE_EDITOR_SELECTION_KEY
	);

	function effectiveSceneScale(entity: SceneEntity) {
		void store.placementScaleVectorVersion;
		return resolveEditorPlacementScale(entity.scale, store.getPlacementScaleVector(entity.id));
	}

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
			// P23.6 — no verbose success messaging: the born geometry/Room on
			// Plan is the confirmation. Rejections still message below.
			setWallChainStatus('');
			// Bounded tools are atomic (not continuous runs): a birth may
			// select through the existing authority.
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
	 * throughout the continuous run (never selects newborn Rooms mid-run);
	 * continuous drawing never depends on selection. Returns the canonical
	 * Junctions for continuation; closure is Junction identity.
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
		// Closure: boundary runs end when the final endpoint resolves to the
		// canonical run-start Junction. Partitions end via Escape only.
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

	/**
	 * P23.9 — mirror a chain outcome onto the plan surface. The store status
	 * line only renders in the Inspector's empty-selection branch, so a
	 * rejection would otherwise be invisible while the Plan is focused.
	 */
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

	/**
	 * P23.3 — create one canonical Opening on a document-global `wallId`.
	 * Click positioning is the only clamped step (creation parity); the commit
	 * itself validates the whole hosting-Wall set and rejects rather than
	 * clamping.
	 */
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

	/** P23.3 — delete the selected canonical Opening (one history entry). */
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
		// No canonical wall selection target yet (full cutover deferred), so a
		// deleted opening clears rather than demoting to a fake parent.
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
	 * key). Removes the Room and its own boundary Walls in one atomic step and
	 * clears the canonical selection to `none` on success.
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

	function choosePlanMode(mode: PlanViewMode): void {
		if (mode === layoutInteraction.planViewMode) return;
		if (hasLayoutTransientInteraction(layoutInteraction)) cancelLayoutTransaction();
		setPlanViewMode(layoutInteraction, mode);
	}

	function enterStaging(entityId: string): void {
		choosePlanMode('staging');
		if (!store.selectionActions.selectPlacement(entityId)) {
			store.setStatusMessage('Scene item is no longer available');
			return;
		}
		layoutInteraction.arrangeOwner = 'scene';
	}

	function selectSceneEntity(
		entityId: string,
		modifiers: { additive: boolean; toggle: boolean }
	): boolean {
		if (modifiers.toggle) return store.selectionActions.togglePlacement(entityId);
		if (modifiers.additive) {
			const ids = store.selectedPlacementIds.includes(entityId)
				? [...store.selectedPlacementIds]
				: [...store.selectedPlacementIds, entityId];
			return store.selectionActions.selectPlacements(ids);
		}
		return store.selectionActions.selectPlacement(entityId);
	}

	function deselectPlanActive(): boolean {
		if (layoutInteraction.planViewMode !== 'staging') return activeSelection?.deselectActive() ?? false;
		// P10 — an empty Arrange click clears whichever owner is the active
		// target and preserves the inactive slot as memory. Routing by the
		// derived active domain (not the raw remembered owner) also covers
		// the first-entry fallback where arrangeOwner is still null.
		return activeSelection?.active.domain === 'layout'
			? activeSelection?.deselectActive() ?? false
			: activeSelection?.deselectSceneSelection() ?? false;
	}

	function beginSceneGesture(): boolean {
		if (!store.beginDocumentTransaction()) return false;
		store.setTransformInteractionActive(true, 'placement');
		return true;
	}

	function previewSceneGesture(patches: readonly PlanSceneTransformPatch[]): boolean {
		for (const patch of patches) {
			const entity = store.document.entities.find((candidate) => candidate.id === patch.id);
			if (!entity) return false;
			const transform = placementTransformFromDocument(
				entity,
				store.getPlacementScaleVector(entity.id)
			);
			if (!store.updatePlacementTransform(entity.id, {
				...transform,
				position: [...patch.position],
				rotation: [...patch.rotation]
			})) return false;
		}
		return true;
	}

	function commitSceneGesture(): boolean {
		store.setTransformInteractionActive(false);
		return store.commitDocumentTransaction();
	}

	function cancelSceneGesture(): boolean {
		store.setTransformInteractionActive(false);
		return store.cancelDocumentTransaction();
	}

	function deleteSceneSelection(): boolean {
		return store.deleteSelection();
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
	// scene-referenced policy (blockers read the store's authoritative scene).
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

<div class="plan-view" role="application" aria-label="Plan drafting surface">
	<LayoutPlanViewport
		model={layoutPreview.model}
		preview={layoutPreview}
		interaction={layoutInteraction}
		scene={store.document}
		rooms={store.rooms}
		getEffectiveSceneScale={effectiveSceneScale}
		selectedPlacementIds={store.selectedPlacementIds}
		selectedClusterId={store.selectedClusterId}
		active={active}
		onPlanModeChange={choosePlanMode}
		onEnterStaging={enterStaging}
		onSceneSelect={selectSceneEntity}
		onSceneGestureBegin={beginSceneGesture}
		onSceneGesturePreview={previewSceneGesture}
		onSceneGestureCommit={commitSceneGesture}
		onSceneGestureCancel={cancelSceneGesture}
		onSceneDelete={deleteSceneSelection}
		onCommit={commitDraftRoom}
		onWallSegmentCommit={commitDraftWallSegment}
		onOpeningCreate={createOpening}
		onOpeningDelete={deleteOpening}								onWallOpeningCreate={createWallOpening}
								onWallOpeningDelete={deleteWallOpening}
								onWallDelete={deleteWall}
		onRoomDelete={deleteRoom}
		onRoomRemove={removeRoom}
		onLayoutTransactionBegin={beginLayoutTransaction}
		onLayoutTransactionCommit={commitLayoutTransaction}
		onLayoutTransactionCancel={cancelLayoutTransaction}
		onDeselect={activeSelection ? deselectPlanActive : undefined}
		{store}
		{contextMenu}
	/>
</div>

<style>
	.plan-view {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		background: var(--editor-bg-app);
		/* S10.1.6 amendment — Plan ↔ 3D swaps are instant (no fade). */
	}
</style>

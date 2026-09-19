<!--
	P23.14 §14 — the Status Rail. Readout-only: current domain and view, current
	selection, save state, grid/snap/metric state and the per-workspace
	work-state readout.

	The P21 keyboard-hint group is gone: §14 allows only low-noise work-state
	readouts, and a shell band that teaches shortcuts is chrome for empty space
	(§24). It must not duplicate toolbar actions — one fact, one authoritative
	control owner (the View Bar / Tool Tray own the controls; this rail only
	echoes state).
-->
<script lang="ts">
	import type { EditorStore } from '$lib/editor/editor-store.svelte';
	import type { LayoutInteractionState } from '$lib/editor/layout/layout-interaction';
	import {
		layoutPreviewIsDirty,
		type LayoutPreviewState
	} from '$lib/editor/layout/layout-preview-state.svelte';
	import type { EditorActiveSelectionStore } from './active-editor-selection.svelte';
	import type { EditorViewState } from './editor-view-state.svelte';
	import { LAYOUT_PLAN_GRID_STEP } from '$lib/layout/layout-wall-first-precision';

	let {
		store,
		layoutPreview,
		layoutInteraction,
		viewState,
		activeSelection,
		transformSpace = 'local'
	}: {
		store: EditorStore;
		layoutPreview: LayoutPreviewState;
		layoutInteraction: LayoutInteractionState;
		viewState: EditorViewState;
		activeSelection: EditorActiveSelectionStore;
		/** Scene 3D transform space (Local/World) — P21.2 status string. */
		transformSpace?: 'local' | 'world';
	} = $props();

	const domainLabel = $derived(viewState.domain === 'scene' ? 'Scene' : 'Camera');
	const viewLabel = $derived(viewState.activeView === 'plan' ? 'Plan' : '3D');
	const isPlan = $derived(viewState.activeView === 'plan');
	const dirty = $derived(store.isDirty || layoutPreviewIsDirty(layoutPreview));
	const gridLabel = $derived(
		(isPlan ? layoutInteraction.planView.gridEnabled : store.gridVisible) ? 'Grid on' : 'Grid off'
	);
	const transformSnapEnabled = $derived(
		store.transformMode === 'translate'
			? store.translationSnapEnabled
			: store.transformMode === 'rotate'
				? store.rotationSnapEnabled
				: store.scaleSnapEnabled
	);
	const snapLabel = $derived(
		isPlan
			? `Snap ${LAYOUT_PLAN_GRID_STEP} m ${layoutInteraction.planView.snapEnabled ? 'on' : 'off'}`
			: `Snap ${transformSnapEnabled ? 'on' : 'off'}`
	);
	const selectionLabel = $derived.by(() => {
		const active = activeSelection.active;
		switch (active.domain) {
			case 'none':
				return 'No selection';
			case 'layout':
				return 'Layout selection';
			case 'camera':
				return 'Camera selection';
			case 'scene': {
				const selection = active.selection;
				if (selection.kind === 'cluster') return 'Cluster selected';
				if (selection.kind === 'placement') {
					return `${selection.ids.length} ${selection.ids.length === 1 ? 'item' : 'items'} selected`;
				}
				return 'No selection';
			}
		}
	});
	// P21.2 — per-workspace status strings (§9 visual QA). Behavior unchanged;
	// presentation only. Camera Plan Y-preserved is included (P21.3 owns Camera
	// reconciliation but the string is low-risk and shared with the gap matrix).
	const isScenePlanLayout = $derived(
		viewState.domain === 'scene' && viewState.activeView === 'plan' && layoutInteraction.planViewMode === 'layout'
	);
	const isArrange = $derived(
		viewState.domain === 'scene' && viewState.activeView === 'plan' && layoutInteraction.planViewMode === 'staging'
	);
	const isScene3D = $derived(viewState.domain === 'scene' && viewState.activeView === '3d');
	const isCameraPlan = $derived(viewState.domain === 'camera' && viewState.activeView === 'plan');
	const isCamera3D = $derived(viewState.domain === 'camera' && viewState.activeView === '3d');
	// §14 — the local mode is part of the domain·view·mode readout (Scene Plan
	// only; Camera has no parallel local-mode system, §2.4).
	const modeLabel = $derived(isScenePlanLayout ? ' · Layout' : isArrange ? ' · Arrange' : '');
	// P21.3 — Camera 3D status reuses the preview FSM (no new state):
	// Observer/POV mode, Edge/Sequence scope from the preview kind, play
	// state, and selection count. Scope must follow the preview kind —
	// Sequence scope intentionally preserves an Edge selection, so deriving
	// scope from selection would misreport "Edge".
	const cameraModeLabel = $derived(store.cameraPreview?.mode === 'visitor' ? 'POV' : 'Observer');
	const cameraScopeLabel = $derived(store.cameraPreview?.kind === 'edge' ? 'Edge' : 'Sequence');
	const cameraPlayLabel = $derived(store.isCameraPreviewPlaying ? 'playing' : 'paused');
	const cameraSelectionCount = $derived(store.navigationSelection ? 1 : 0);
	const transformModeLabel = $derived(
		!store.transformGizmoVisible
			? 'Select'
			: store.transformMode === 'translate'
				? 'Move'
				: store.transformMode === 'rotate'
					? 'Rotate'
					: 'Scale'
	);
	const spaceLabel = $derived(transformSpace === 'world' ? 'World' : 'Local');
	const sceneSelectionCount = $derived(
		activeSelection.active.domain === 'scene' && activeSelection.active.selection.kind === 'placement'
			? activeSelection.active.selection.ids.length
			: store.selectedCluster
				? store.selectedPlacementIds.length
				: 0
	);
	const workspaceStatus = $derived(
		isScenePlanLayout
			? 'X/Z Grid Orthogonal WallSnap Angle Scene>Plan>Layout'
			: isArrange
				? 'Yaw Snap 15°'
				: isScene3D
					? `${transformModeLabel} ${spaceLabel} snaps ${sceneSelectionCount} selected`
					: isCameraPlan
						? 'Y Preserved'
						: isCamera3D
							? `${cameraModeLabel} ${cameraScopeLabel} ${cameraPlayLabel} ${cameraSelectionCount} selected`
							: null
	);
</script>

<footer class="status-bar" aria-label="Editor status" style="grid-area: status;">
	<div class="status-left">
		<span class="workspace">{domainLabel} · {viewLabel}{modeLabel}</span>
		<span class="selection">{selectionLabel}</span>
		<span class="save-state" class:dirty aria-live="polite">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
	</div>
	{#if workspaceStatus}
		<span class="workspace-status" role="status">{workspaceStatus}</span>
	{/if}
	<div class="status-right">
		<span>{gridLabel}</span>
		<span>{snapLabel}</span>
		<span>Metric (m)</span>
	</div>
</footer>

<style>
	/* Atlas `.status`: 10 px chrome text, 20 px gaps, 12 px inline padding — the
	   quietest band in the shell (role: `--editor-type-status`). */
	.status-bar {
		display: flex;
		align-items: center;
		gap: 20px;
		/* P21.5 §2.2 — standalone height locked to the row token; the shell also
		   enforces it (.project-editor > .status-bar). */
		min-height: var(--editor-status-height, 1.7rem);
		padding: 0 12px;
		box-sizing: border-box;
		border-top: 1px solid var(--editor-border-subtle);
		background: var(--editor-bg-app);
		/* #34 — the rail is chrome text on the Chassis, so its base ink is the
		   readable secondary tier: muted measures only ~3.9:1 on the PLATE Light
		   Chassis and fails AA at this size. Quietness comes from weight and from
		   the tiers below, not from under-contrast ink. */
		color: var(--editor-text-secondary);
		font: var(--editor-type-status);
	}
	.status-left,
	.status-right {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}
	.status-right { margin-left: auto; }
	.workspace { font-weight: 650; color: var(--editor-text-primary); }
	.workspace-status { color: var(--editor-text-secondary); font-weight: 600; white-space: nowrap; }
	.selection { color: var(--editor-text-secondary); }
	/* A readable text role, never the success glyph/border family (#34). */
	.save-state { color: var(--editor-text-success); }
	.save-state.dirty { color: var(--editor-text-primary); }

	@media (max-width: 62rem) {
		.workspace-status { display: none; }
	}
	@media (max-width: 44rem) {
		.save-state { display: none; }
		.status-right span:nth-child(2) { display: none; }
	}
</style>

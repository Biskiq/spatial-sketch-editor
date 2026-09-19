<!--
	P23.14 §10 — the View Bar. Renamed in role from the P21 "workspace ribbon":
	it spans the CENTRAL WORK COLUMN only (never over Navigator/Inspector) and
	is mounted inside the editor `.center` column, below the Project Head.

	Left: the durable Plan/3D view axis as *engraved chassis tabs* — they must
	never look like ordinary tool buttons (§10), so they carry no control
	surface at rest and an inset ink underline when active.

	Middle: the contextual work tools of the current domain×view (the Scene Plan
	MODE Layout/Arrange switch is subordinate to the view tabs, §10). P23.14
	Task 3 moves the tool vocabulary onto the Paper-attached Tool Tray; this
	region keeps the subordinate MODE/utility controls.

	Right: subordinate utilities — panel visibility (Panels), which is shell
	chrome in every view.

	The Scene/Camera domain axis lives in the Domain Spine, never here
	(§3/§8): one fact, one owner.
-->
<script lang="ts">
	import type { EditorStore } from '../editor-store.svelte';
	import type { EditorViewState } from './editor-view-state.svelte';
	import type { LayoutPreviewState } from '../layout/layout-preview-state.svelte';
	import { toggleLayoutCeilings } from '../layout/layout-preview-state.svelte';
	import { hasLayoutTransientInteraction, setPlanViewMode, type LayoutInteractionState } from '../layout/layout-interaction';
	import type { CameraPlanState } from '../camera-plan/camera-plan-state.svelte';
	import type { EditorGizmoCapabilities } from '../gizmo/editor-gizmo-policy';
	import LayoutDraftToolbar from '../layout/LayoutDraftToolbar.svelte';
	import CameraPlanToolbar from '../camera-plan/CameraPlanToolbar.svelte';
	import EditorViewportToolbar from '../EditorViewportToolbar.svelte';
	import EditorViewportGridControls from '../EditorViewportGridControls.svelte';
	import { Maximize, Minimize, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-svelte';

	let { store, viewState, layoutPreview, layoutInteraction, cameraPlan, gizmoCapabilities, transformDisabled } : {
		store: EditorStore; viewState: EditorViewState; layoutPreview: LayoutPreviewState;
		layoutInteraction: LayoutInteractionState; cameraPlan: CameraPlanState;
		gizmoCapabilities: EditorGizmoCapabilities | null; transformDisabled: boolean;
	} = $props();
	const canSwitch = $derived(!store.isEditorInteractionActive);
	function choosePlanMode(mode: 'layout' | 'staging') {
		if (mode === layoutInteraction.planViewMode) return;
		if (hasLayoutTransientInteraction(layoutInteraction)) store.cancelLayoutTransaction();
		setPlanViewMode(layoutInteraction, mode);
	}
</script>

<div class="view-bar" aria-label="View bar" style="grid-area:viewbar;">
	<div role="group" aria-label="Editor views" class="view-tabs">
		{#each ['plan', '3d'] as view}
			<button
				type="button"
				class="view-tab"
				class:active={viewState.activeView === view}
				aria-pressed={viewState.activeView === view}
				disabled={!canSwitch}
				onclick={() => { if (canSwitch) viewState.setView(viewState.domain, view as 'plan' | '3d'); }}
			>{view === 'plan' ? 'Plan' : '3D'}</button>
		{/each}
	</div>
	<div class="contextual-tools">
		{#if viewState.activeView === 'plan' && viewState.domain === 'scene'}
			<!-- §10 — the View Bar keeps the subordinate MODE switch and the
			     Snap/Grid/Tour utilities; the tool vocabulary lives on the
			     Paper-attached Tool Tray (§11), mounted by the workspace. -->
			<LayoutDraftToolbar ribbon interaction={layoutInteraction} preview={layoutPreview}
				showViewToggle={false} showPlanModeToggle onPlanModeChange={choosePlanMode}
				onCancelLayoutTransaction={() => store.cancelLayoutTransaction()} />
		{:else if viewState.activeView === 'plan'}
			<CameraPlanToolbar ribbon {store} {cameraPlan} />
		{:else}
			<EditorViewportToolbar ribbon {store} context={viewState.domain} {gizmoCapabilities} {transformDisabled}
				showCeilings={layoutPreview.showCeilings} onToggleCeilings={() => toggleLayoutCeilings(layoutPreview)} />
			<EditorViewportGridControls {store} />
		{/if}
	</div>
	<!-- §10 — subordinate utilities: span/zoom controls stay visually quieter
	     than the durable view tabs. Panel visibility is shell chrome in every
	     view (P23.3): one icon per panel that collapses/expands it (the glyph
	     reports the state) plus the combined focus toggle. Collapse is CSS-grid
	     only; the canvas is never unmounted, and requests during an active
	     gesture defer to gesture end (store-owned). -->
	<div class="utilities" role="group" aria-label="Panel visibility">
		<button type="button" class="utility-btn" aria-pressed={store.leftSidePanelCollapsed}
			aria-label={store.leftSidePanelCollapsed ? 'Expand left sidebar' : 'Collapse left sidebar'}
			title={store.leftSidePanelCollapsed ? 'Expand left sidebar' : 'Collapse left sidebar'}
			onclick={() => store.toggleLeftSidePanel()}>
			{#if store.leftSidePanelCollapsed}<PanelLeftOpen size={15} aria-hidden="true" />{:else}<PanelLeftClose size={15} aria-hidden="true" />{/if}
		</button>
		<button type="button" class="utility-btn" aria-pressed={store.rightSidePanelCollapsed}
			aria-label={store.rightSidePanelCollapsed ? 'Expand right sidebar' : 'Collapse right sidebar'}
			title={store.rightSidePanelCollapsed ? 'Expand right sidebar' : 'Collapse right sidebar'}
			onclick={() => store.toggleRightSidePanel()}>
			{#if store.rightSidePanelCollapsed}<PanelRightOpen size={15} aria-hidden="true" />{:else}<PanelRightClose size={15} aria-hidden="true" />{/if}
		</button>
		<button type="button" class="utility-btn" class:active={store.focusMode} aria-pressed={store.focusMode}
			aria-label="Focus — collapse both sidebars"
			title="Focus — collapse both sidebars ( \ )"
			onclick={() => store.toggleFocusMode()}>
			{#if store.focusMode}<Minimize size={15} aria-hidden="true" />{:else}<Maximize size={15} aria-hidden="true" />{/if}
		</button>
	</div>
</div>

<style>
	.view-bar {
		display: flex;
		align-items: center;
		gap: 6px;
		box-sizing: border-box;
		height: var(--editor-viewbar-height, 34px);
		min-height: var(--editor-viewbar-height, 34px);
		min-width: 0;
		padding: 0 8px;
		background: var(--editor-bg-app);
		border-bottom: 1px solid var(--editor-border-subtle);
		z-index: 20;
	}
	/* Engraved view tabs: no resting control surface, no radius — the tab is
	   cut into the chassis and marked by an inset ink underline. */
	.view-tabs {
		display: flex;
		align-items: stretch;
		align-self: stretch;
		gap: 2px;
	}
	/* Engraved tabs, Atlas metrics: min-width 54 px, no padding, no control
	   surface at rest, bold ink, and an inset 2 px underline when active. */
	.view-tab {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 54px;
		height: 100%;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: var(--editor-text-muted);
		font: var(--editor-type-control-strong);
		cursor: pointer;
	}
	.view-tab:hover:not(:disabled) { color: var(--editor-text-primary); }
	.view-tab.active {
		background: var(--editor-bg-panel-raised);
		color: var(--editor-text-primary);
		box-shadow: inset 0 -2px var(--editor-text-secondary);
	}
	.view-tab:disabled { opacity: 0.45; cursor: default; }
	.contextual-tools { display:flex; align-items:center; gap:6px; flex:1; min-width:0; padding:0 4px; }
	/* Subordinate utility region: quieter ink, smaller targets than the tabs. */
	.utilities { display:flex; align-items:center; gap:2px; flex:0 0 auto; box-sizing:border-box; padding-left:6px; border-left:1px solid var(--editor-border-subtle); }
	/* Subordinate utility targets: icon-sized, Atlas 24 px tier, and the Atlas's
	   pressed grammar (edge border + inset bottom rule) rather than a fill. */
	.utility-btn {
		justify-content: center;
		display: inline-flex;
		align-items: center;
		width: var(--editor-control-sm-height);
		height: var(--editor-control-sm-height);
		padding: 0;
		border: 1px solid transparent;
		border-radius: var(--editor-control-radius);
		background: transparent;
		color: var(--editor-text-muted);
		cursor: pointer;
	}
	.utility-btn:hover { background: var(--editor-bg-hover); color: var(--editor-text-primary); }
	.utility-btn.active { border-color: var(--editor-accent); box-shadow: inset 0 -2px var(--editor-accent); color: var(--editor-text-primary); }
</style>

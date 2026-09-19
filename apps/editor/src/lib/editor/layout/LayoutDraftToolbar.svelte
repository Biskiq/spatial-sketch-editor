<script lang="ts">
	import { BrickWall, DoorOpen, Grid2x2, Pentagon, Square, Trash2, X } from 'lucide-svelte';
	import PlanDraftIcon from './PlanDraftIcon.svelte';
	import {
		cancelLayoutPresetDraft,
		cancelLayoutPrimitiveDraft,
		clearLayoutDraft,
		isLayoutPresetTool,
		setLayoutDraftTool,
		setPlanViewMode,
		setLayoutViewMode,
		togglePlanViewportOption,
		type LayoutInteractionState,
		type LayoutDraftTool,
		type LayoutViewMode
	} from './layout-interaction';
	import type { LayoutPreviewState } from './layout-preview-state.svelte';
	import { toggleLayoutCeilings } from './layout-preview-state.svelte';
	import { LAYOUT_PLAN_GRID_STEP } from '$lib/layout/layout-wall-first-precision';

	const gridStepLabel = `${LAYOUT_PLAN_GRID_STEP}m`;

	/**
	 * P23.9/P23.3 — tools a wall-first document can host. The chain tools and
	 * the Rect/Polygon convenience frontends author canonical Junction/Wall
	 * records; the door/window tools author canonical Openings against a
	 * document-global `wallId` (P23.3). P23.5 presets author ordinary
	 * document-level LayoutObjects through the canonical planner. Only the
	 * legacy room-owned primitive tools remain unavailable for wall-first
	 * layouts.
	 */
	const WALL_FIRST_DRAFT_TOOLS: ReadonlySet<LayoutDraftTool> = new Set<LayoutDraftTool>([
		'select',
		'wall-chain',
		// P23.6 — one primary Wall concept: `partition-chain` stays a valid
		// tool (the internal `boundary | partition` role is authoritative and
		// `wallChainRoleForTool` still maps it), but it is no longer a primary
		// toolbar button. `partition` is an internal Wall semantic, not a
		// separate user-facing object family.
		'partition-chain',
		'rectangle',
		'polygon',
		'door',
		'window',
		'preset-column',
		'preset-platform',
		'preset-plinth'
	]);

	let {
		ribbon = false,
		tray = false,
		interaction,
		preview,
		onCancelLayoutTransaction = () => false,
		showViewToggle = true,
		showPlanModeToggle = false,
		onPlanModeChange,
		onDeleteArrange
	}: {
		/** P23.14 §10 — View Bar (shell) presentation: the subordinate MODE switch
		 *  and the Snap/Grid/Tour utilities. Never the tool vocabulary: the tools
		 *  live on the Paper-attached Tool Tray (§11). */
		ribbon?: boolean;
		/** P23.14 §11 — Tool Tray presentation: the tool vocabulary only. */
		tray?: boolean;
		interaction: LayoutInteractionState;
		preview: LayoutPreviewState;
		onCancelLayoutTransaction?: () => boolean;
		/** the editor hides this when the top-level Plan | 3D switch owns view selection. */
		showViewToggle?: boolean;
		/** Scene Plan only; absent on Camera Plan, Scene 3D, and the relic. */
		showPlanModeToggle?: boolean;
		onPlanModeChange?: (mode: 'layout' | 'staging') => void;
		/** Arrange owner-aware Delete (P21.2); absent keeps the toolbar selection-only. */
		onDeleteArrange?: () => boolean;
	} = $props();
	const wallFirstLayout = $derived('formatVersion' in preview.project.layout);

	function chooseView(mode: LayoutViewMode) {
		if (interaction.roomUnitDrag) onCancelLayoutTransaction();
		setLayoutViewMode(interaction, mode);
	}

	function chooseTool(tool: LayoutDraftTool) {
		if (wallFirstLayout && !WALL_FIRST_DRAFT_TOOLS.has(tool)) {
			preview.statusMessage = 'Legacy primitive tools are unavailable for wall-first layouts; use Architecture · exact.';
			return;
		}
		// P23.9 — chains author the canonical wall-first Junction/Wall graph, so
		// they need a wall-first document; a legacy room-owned layout cannot
		// host them and the commit would reject after the whole chain was drawn.
		if (!wallFirstLayout && (tool === 'wall-chain' || tool === 'partition-chain')) {
			preview.statusMessage = 'Wall and Partition sketching requires a wall-first layout; this project uses the legacy room-owned layout.';
			return;
		}
		// P23.5 — presets commit through the wall-first planner only; a legacy
		// room-owned layout keeps its drag-based primitive tools instead.
		if (!wallFirstLayout && isLayoutPresetTool(tool)) {
			preview.statusMessage = 'Column, Platform and Plinth placement requires a wall-first layout; this project uses the legacy room-owned layout.';
			return;
		}
		if (interaction.roomUnitDrag) onCancelLayoutTransaction();
		setLayoutDraftTool(interaction, tool);
	}

	function choosePlanMode(mode: 'layout' | 'staging') {
		if (onPlanModeChange) onPlanModeChange(mode);
		else setPlanViewMode(interaction, mode);
	}

	function cancel() {
		if (interaction.roomUnitDrag) onCancelLayoutTransaction();
		clearLayoutDraft(interaction);
		cancelLayoutPrimitiveDraft(interaction);
		cancelLayoutPresetDraft(interaction);
		if (interaction.tool === 'door' || interaction.tool === 'window' || isLayoutPresetTool(interaction.tool)) setLayoutDraftTool(interaction, 'select');
	}
</script>

<div class="layout-toolbar" class:ribbon class:tray role="toolbar" aria-label={interaction.planViewMode === 'staging' ? 'Scene Plan arrange tools' : 'Layout drafting tools'}>
	{#if showPlanModeToggle && !tray}
		<!-- P21.5 §1.3 — [Layout|Arrange]. The floating (relic) form keeps the
		     enclosed segmented grammar from the scoped styles below; the P23.14
		     ribbon drops the enclosure entirely in the shell scope
		     (`controls.css`), where the pair is two plain buttons preceded by a
		     muted `MODE` caption (`--editor-type-mode`, Atlas `.mode`). -->
		<div class="segmented mode-group" role="group" aria-label="Scene Plan mode">
			<button type="button" class:active={interaction.planViewMode === 'layout'} aria-pressed={interaction.planViewMode === 'layout'} onclick={() => choosePlanMode('layout')}>Layout</button>
			<button type="button" class:active={interaction.planViewMode === 'staging'} aria-pressed={interaction.planViewMode === 'staging'} onclick={() => choosePlanMode('staging')}>Arrange</button>
		</div>
	{/if}
	{#if showViewToggle && !tray}
		<div class="tool-group" aria-label="Layout view">
			<button type="button" class:active={interaction.viewMode === 'plan'} aria-pressed={interaction.viewMode === 'plan'} onclick={() => chooseView('plan')}>Plan</button>
			<button type="button" class:active={interaction.viewMode === '3d'} aria-pressed={interaction.viewMode === '3d'} onclick={() => chooseView('3d')}>3D</button>
		</div>
	{/if}
	<!-- P23.14 §11 — Scene Plan tray vocabulary: SELECT / DRAW / OPENINGS /
	     OBJECTS. One Wall concept (no separate Partition primary button);
	     newly drawn Walls default to `boundary` and the per-Wall Defines-room
	     boundary control flips the internal `partition` role. The View Bar owns
	     the utilities (Snap/Grid/Tour), so this group is tray/floating only. -->
	{#if !ribbon}
		<div class="tool-group" aria-label="Selection tool" data-group-label="SELECT">
			<button type="button" class:active={interaction.tool === 'select'} aria-pressed={interaction.tool === 'select'} onclick={() => chooseTool('select')}><PlanDraftIcon name="select" /> Select</button>
			{#if interaction.planViewMode === 'staging' && onDeleteArrange}
				<button type="button" aria-label="Delete arrange selection" onclick={() => onDeleteArrange?.()}><Trash2 size={14} aria-hidden="true" /> Delete</button>
			{/if}
		</div>
		{#if interaction.planViewMode === 'layout'}
			<div class="tool-group" aria-label="Draw tools" data-group-label="DRAW">
				<button type="button" disabled={!wallFirstLayout} title={!wallFirstLayout ? 'Wall sketching requires a wall-first layout' : undefined} class:active={interaction.tool === 'wall-chain'} aria-pressed={interaction.tool === 'wall-chain'} onclick={() => chooseTool('wall-chain')}><BrickWall size={14} aria-hidden="true" /> Wall</button>
				<button type="button" title={wallFirstLayout ? 'Draws one closed boundary chain of canonical Walls' : undefined} class:active={interaction.tool === 'rectangle'} aria-pressed={interaction.tool === 'rectangle'} onclick={() => chooseTool('rectangle')}><Square size={14} aria-hidden="true" /> Rect Room</button>
				<button type="button" title={wallFirstLayout ? 'Draws one closed boundary chain of canonical Walls' : undefined} class:active={interaction.tool === 'polygon'} aria-pressed={interaction.tool === 'polygon'} onclick={() => chooseTool('polygon')}><Pentagon size={14} aria-hidden="true" /> Poly Room</button>
			</div>
			<div class="tool-group" aria-label="Opening tools" data-group-label="OPENINGS">
				<button type="button" title={wallFirstLayout ? 'Places one canonical Opening on the clicked Wall' : undefined} class:active={interaction.tool === 'door'} aria-pressed={interaction.tool === 'door'} onclick={() => chooseTool('door')}><DoorOpen size={14} aria-hidden="true" /> Door</button>
				<button type="button" title={wallFirstLayout ? 'Places one canonical Opening on the clicked Wall' : undefined} class:active={interaction.tool === 'window'} aria-pressed={interaction.tool === 'window'} onclick={() => chooseTool('window')}><Grid2x2 size={14} aria-hidden="true" /> Window</button>
			</div>
			<div class="tool-group" aria-label="Object presets" data-group-label="OBJECTS">
				<button type="button" disabled={!wallFirstLayout} title={!wallFirstLayout ? 'Preset placement requires a wall-first layout' : 'Places one ordinary Column object (cylinder creation default)'} class:active={interaction.tool === 'preset-column'} aria-pressed={interaction.tool === 'preset-column'} onclick={() => chooseTool('preset-column')}><PlanDraftIcon name="column-preset" /> Column</button>
				<button type="button" disabled={!wallFirstLayout} title={!wallFirstLayout ? 'Preset placement requires a wall-first layout' : 'Places one ordinary Platform object (box creation default)'} class:active={interaction.tool === 'preset-platform'} aria-pressed={interaction.tool === 'preset-platform'} onclick={() => chooseTool('preset-platform')}><PlanDraftIcon name="platform-preset" /> Platform</button>
				<button type="button" disabled={!wallFirstLayout} title={!wallFirstLayout ? 'Preset placement requires a wall-first layout' : 'Places one ordinary Plinth object (box creation default)'} class:active={interaction.tool === 'preset-plinth'} aria-pressed={interaction.tool === 'preset-plinth'} onclick={() => chooseTool('preset-plinth')}><PlanDraftIcon name="plinth-preset" /> Plinth</button>
			</div>
		{/if}
	{/if}
	{#if !tray}
		{#if ribbon || interaction.viewMode === 'plan'}
			<div class="tool-group options" aria-label="Plan options" data-group-label="VIEW">
				<button type="button" class:active={interaction.planView.snapEnabled} aria-pressed={interaction.planView.snapEnabled} onclick={() => togglePlanViewportOption(interaction, 'snapEnabled')}><PlanDraftIcon name="snap" /> Snap {gridStepLabel}</button>
				<button type="button" class:active={interaction.planView.gridEnabled} aria-pressed={interaction.planView.gridEnabled} onclick={() => togglePlanViewportOption(interaction, 'gridEnabled')}><PlanDraftIcon name="grid" /> Grid</button>
				{#if interaction.planViewMode === 'layout'}
					<button type="button" class:active={interaction.planView.showTourOverlay} aria-pressed={interaction.planView.showTourOverlay} onclick={() => togglePlanViewportOption(interaction, 'showTourOverlay')}>Tour</button>
				{/if}
			</div>
		{:else}
			<button type="button" class:active={preview.showCeilings} aria-pressed={preview.showCeilings} onclick={() => toggleLayoutCeilings(preview)}>Ceiling</button>
		{/if}
	{/if}
	{#if interaction.planViewMode === 'layout' && (interaction.polygonPoints.length > 0 || interaction.wallChainStart !== null || interaction.rectangleStart || interaction.primitiveDraft || interaction.presetDraft || isLayoutPresetTool(interaction.tool) || interaction.roomUnitDrag || interaction.tool === 'door' || interaction.tool === 'window')}
		<button type="button" class="cancel" onclick={cancel}><X size={14} aria-hidden="true" /> Cancel</button>
	{/if}
</div>

<style>
	.layout-toolbar { position: absolute; top: 0.75rem; left: 0.75rem; z-index: 4; display: flex; gap: 0.3rem; padding: 0.3rem; border: 1px solid var(--editor-border-normal); border-radius: 0.42rem; background: var(--editor-bg-panel-raised); box-shadow: var(--editor-shadow-toolbar); }
	.tool-group { display: flex; gap: 0.22rem; padding-right: 0.32rem; border-right: 1px solid var(--editor-border-subtle); }
	.tool-group.options { border-right: 0; }
	/* Floating [Layout|Arrange] keeps the enclosed segmented grammar too; the
	   P21.5 ribbon grammar in styles/controls.css wins inside the shell. */
	.segmented { display: flex; align-items: center; padding: 1px; gap: 1px; border: 1px solid var(--editor-border-subtle); border-radius: 6px; background: var(--editor-bg-control); }
	.segmented button { height: 24px; padding: 0 8px; border: 0; border-radius: 4px; background: transparent; color: var(--editor-text-secondary); font: 600 0.68rem/1 var(--editor-font); cursor: pointer; }
	.segmented button:hover { background: var(--editor-bg-hover); color: var(--editor-text-primary); }
	.segmented button.active { background: var(--editor-accent-soft); color: var(--editor-text-primary); }
	button { padding: 0.38rem 0.52rem; border: 1px solid transparent; border-radius: 0.3rem; background: transparent; color: var(--editor-text-secondary); font: 600 0.68rem/1 var(--editor-font); cursor: pointer; }
	button:hover { border-color: var(--editor-border-strong); color: var(--editor-text-primary); }
	button.active { border-color: var(--editor-accent-border); background: var(--editor-bg-selected); color: var(--editor-text-primary); }
	button.cancel { border-color: var(--editor-danger-border); color: var(--editor-danger-fg); }
	@media (max-width: 44rem) {
		.layout-toolbar { top: 0.5rem; left: 0.5rem; right: 0.5rem; flex-wrap: wrap; }
		.tool-group { flex: 1 1 auto; }
		.tool-group button { flex: 1; }
	}
	.layout-toolbar.ribbon { position:relative; inset:auto; transform:none; flex:1; min-width:0; height:28px; padding:0; border:0; border-radius:0; box-shadow:none; background:transparent; backdrop-filter:none; flex-wrap:nowrap; align-items:center; }
	/* P23.14 §11 — Tool Tray presentation: the rail chrome lives in
	   styles/controls.css under `.project-editor .tool-tray`; here we only drop
	   the floating chrome so the same markup can stack vertically. */
	.layout-toolbar.tray { position:static; inset:auto; display:flex; flex-direction:column; align-items:stretch; gap:0; padding:0; border:0; border-radius:0; background:transparent; box-shadow:none; }
	.ribbon button { height:28px; padding:0 6px; white-space:nowrap; }
	.ribbon button.cancel { display:inline-flex; align-items:center; gap:6px; height:24px; padding:0 8px; background:var(--editor-danger-soft); border:1px solid var(--editor-danger-border); border-radius:4px; }
	.ribbon .options { margin-left:auto; }
</style>

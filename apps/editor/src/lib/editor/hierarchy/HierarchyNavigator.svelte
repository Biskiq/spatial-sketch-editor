<script lang="ts">
	// P23.6e slice 4 — the page-based, relationship-aware Scene Navigator.
	//
	// Mounted by `UnifiedProjectTree` for canonical wall-first documents in place
	// of the accordion tree. The surface is a projection: rows come from the pure
	// page builders, page/query/filter/disclosure/scroll state from the UI-only
	// `HierarchyNavigatorStore`. Row activation calls the existing canonical
	// selection writers and nothing else — opening a page never selects, and
	// selecting never navigates.
	import { EllipsisVertical, Eye, EyeOff, Scan, Trash2 } from 'lucide-svelte';
	import type { SceneEntity } from '$lib/content/scene';
	import { formatPlacementLabel } from '../editor-outliner';
	import type { EditorStore } from '../editor-store.svelte';
	import { layoutPreviewDocument, type LayoutPreviewState } from '../layout/layout-preview-state.svelte';
	import {
		selectLayoutJunction,
		selectLayoutObject,
		selectLayoutPhysicalWall,
		selectLayoutRoom,
		selectLayoutWallOpening,
		setArrangeOwner,
		type LayoutInteractionState
	} from '../layout/layout-interaction';
	import {
		isUnifiedTreeRowInteractive,
		type UnifiedTreeRow
	} from '../unified-project-tree-model';
	import type { EditorActiveSelectionStore } from '../app/active-editor-selection.svelte';
	import {
		hierarchyDisclosureOpen,
		type HierarchyNavigatorStore
	} from '../app/hierarchy-navigator-state.svelte';
	import type { EditorDomain } from '../app/editor-view-state.svelte';
	import type { EditorViewMode } from '../app/editor-view-mode';
	import type { EditorContextMenuStore } from '../context-menu/context-menu-state.svelte';
	import {
		activeSelectionToHierarchyEntity,
		buildHierarchyPageProjection,
		type HierarchyDestination,
		type HierarchyPage,
		type HierarchyProjectedRow
	} from './hierarchy-page-projection';
	import { buildHierarchySourceIndex, type HierarchyEntityKey } from './hierarchy-source-index';
	import HierarchyRow from './HierarchyRow.svelte';

	let {
		store,
		layoutPreview,
		layoutInteraction,
		activeSelection,
		navigator,
		domain,
		view,
		contextMenu = null,
		onSelectSceneEntity,
		onSelectCluster,
		onWallContextMenu,
		onRoomContextMenu
	}: {
		store: EditorStore;
		layoutPreview: LayoutPreviewState;
		layoutInteraction: LayoutInteractionState;
		activeSelection: EditorActiveSelectionStore;
		navigator: HierarchyNavigatorStore;
		domain: EditorDomain;
		view: EditorViewMode;
		contextMenu?: EditorContextMenuStore | null;
		onSelectSceneEntity: (entity: SceneEntity, event?: MouseEvent) => void;
		onSelectCluster: (clusterId: string) => void;
		onWallContextMenu: (event: MouseEvent, wallId: string) => void;
		onRoomContextMenu: (event: MouseEvent, roomId: string) => void;
	} = $props();

	const index = $derived(
		buildHierarchySourceIndex({
			layout: layoutPreview.project.layout,
			scene: store.document
		})
	);
	const entry = $derived(navigator.current);
	const projection = $derived(
		buildHierarchyPageProjection(index, entry.page, {
			wallFilter: entry.wallFilter,
			openingFilter: entry.openingFilter
		})
	);
	const active = $derived(activeSelection.active);
	const activeEntity = $derived(activeSelectionToHierarchyEntity(active));
	const sceneInteractive = $derived(domain === 'scene' && view === '3d');
	const sceneEntitiesById = $derived(
		new Map(store.document.entities.map((entity) => [entity.id, entity]))
	);

	let openMenuFor = $state<string | null>(null);
	let scrollElement = $state<HTMLElement | null>(null);

	// ── page validity / reconciliation ───────────────────────────────────

	function pageValid(page: HierarchyPage): boolean {
		return page.kind !== 'room' || index.roomById.has(page.roomId);
	}

	// A page parameter that no longer exists falls back (rooms → root) without
	// selecting anything or creating document history.
	$effect(() => {
		navigator.reconcile({ isPageValid: pageValid });
	});

	const pageLabel = $derived.by(() => {
		switch (entry.page.kind) {
			case 'root':
				return 'Hierarchy';
			case 'rooms':
				return 'Rooms';
			case 'room':
				return index.roomById.get(entry.page.roomId)?.name ?? formatPlacementLabel(entry.page.roomId);
			case 'walls':
				return 'Walls';
			case 'openings':
				return 'Openings';
			case 'junctions':
				return 'Junctions';
			case 'layoutObjects':
				return 'Layout Objects';
			case 'sceneContent':
				return 'Scene Content';
		}
	});

	const emptyMessage = $derived(
		entry.page.kind === 'rooms'
			? 'Draw a wall or room in Plan to begin'
			: entry.page.kind === 'room'
				? 'This room has no renderable content'
				: 'Nothing here yet'
	);

	// ── row state and gestures (presentation → canonical writers) ────────

	function entityToTreeRow(entity: HierarchyEntityKey): UnifiedTreeRow {
		if (entity.owner === 'layout') {
			switch (entity.kind) {
				case 'room':
					return { kind: 'room', roomId: entity.roomId };
				case 'wall':
					return { kind: 'physicalWall', wallId: entity.wallId };
				case 'opening':
					return { kind: 'wallOpening', wallId: entity.wallId, openingId: entity.openingId };
				case 'junction':
					return { kind: 'junction', junctionId: entity.junctionId };
				case 'object':
					return { kind: 'object', objectId: entity.objectId };
			}
		}
		return entity.kind === 'cluster'
			? { kind: 'cluster', clusterId: entity.clusterId }
			: { kind: 'entity', entityId: entity.entityId };
	}

	function rowSelected(row: HierarchyProjectedRow): boolean {
		const entity = row.entity;
		if (!entity) return false;
		// Room-only *latent* context: the same read the legacy tree ORs in.
		if (
			entity.owner === 'layout' &&
			entity.kind === 'room' &&
			active.domain === 'none' &&
			store.selectedRoomId === entity.roomId
		) {
			return true;
		}
		return activeEntity?.id === entity.id;
	}

	function rowInteractive(row: HierarchyProjectedRow): boolean {
		if (row.kind !== 'entity' || !row.entity) return false;
		return isUnifiedTreeRowInteractive(
			entityToTreeRow(row.entity),
			domain,
			view,
			layoutInteraction.planViewMode
		);
	}

	function rowOpen(row: HierarchyProjectedRow): boolean {
		return hierarchyDisclosureOpen(entry, row);
	}

	function toggleRow(row: HierarchyProjectedRow): void {
		if (row.disclosureKey) navigator.toggleDisclosure(row.disclosureKey);
	}

	function selectRow(row: HierarchyProjectedRow): void {
		const entity = row.entity;
		if (!entity) return;
		if (entity.owner === 'layout') {
			switch (entity.kind) {
				case 'room':
					selectLayoutRoom(layoutInteraction, entity.roomId);
					return;
				case 'wall':
					selectLayoutPhysicalWall(layoutInteraction, entity.wallId);
					return;
				case 'opening':
					selectLayoutWallOpening(layoutInteraction, entity.wallId, entity.openingId);
					return;
				case 'junction':
					selectLayoutJunction(layoutInteraction, entity.junctionId);
					return;
				case 'object':
					selectLayoutObject(layoutInteraction, entity.objectId);
					if (layoutInteraction.planViewMode === 'staging') {
						setArrangeOwner(layoutInteraction, 'layout-object');
					}
					return;
			}
		}
		if (entity.kind === 'cluster') {
			onSelectCluster(entity.clusterId);
			return;
		}
		const sceneEntity = sceneEntitiesById.get(entity.entityId);
		if (sceneEntity) onSelectSceneEntity(sceneEntity);
	}

	function runAction(destination: HierarchyDestination): void {
		// `showIn` degrades to an ordinary entry when the destination carries no
		// reveal target, so one call covers both `Open ›` and `Show in… ›`.
		navigator.showIn(destination);
	}

	function rowContextMenu(event: MouseEvent, row: HierarchyProjectedRow): void {
		const entity = row.entity;
		if (!entity || entity.owner !== 'layout') return;
		if (entity.kind === 'wall') onWallContextMenu(event, entity.wallId);
		else if (entity.kind === 'room') onRoomContextMenu(event, entity.roomId);
	}

	function emphasize(row: HierarchyProjectedRow): void {
		if (row.entity) navigator.setEmphasis(row.entity);
	}

	function deEmphasize(row: HierarchyProjectedRow): void {
		if (row.entity) navigator.clearEmphasis(row.entity);
	}

	function back(): void {
		navigator.back({ isPageValid: pageValid });
	}

	// ── Scene row extras (mutations stay outside the projection) ─────────
	// Visibility/frame/delete/cluster membership keep the legacy gating: the
	// destructive 3D-only actions follow `sceneInteractive`, while selection
	// itself stays mode-aware through `rowInteractive`.

	function toggleMenu(key: string): void {
		openMenuFor = openMenuFor === key ? null : key;
	}
</script>

<div class="hierarchy-navigator">
	<nav class="tree-nav" aria-label="Hierarchy pages">
		<button
			type="button"
			class="tree-nav__back"
			disabled={!navigator.canGoBack}
			onclick={back}
		>
			<span aria-hidden="true">←</span> Back
		</button>
		<span class="tree-nav__page" title={pageLabel}>{pageLabel}</span>
	</nav>

	{#snippet rowExtras(row: HierarchyProjectedRow)}
		{@const entity = row.entity}
		{#if entity?.owner === 'scene' && entity.kind === 'entity' && sceneInteractive}
			{@const clusterId = index.clusterByMemberId.get(entity.entityId) ?? null}
			<div class="row-actions">
				{#if clusterId}
					<button
						type="button"
						class="mini-action"
						aria-label={`Remove ${row.label} from its cluster`}
						onclick={() => store.removeMemberFromCluster(clusterId, entity.entityId)}
					>−</button>
				{:else if store.selectedClusterId}
					<button
						type="button"
						class="mini-action"
						aria-label={`Add ${row.label} to the selected cluster`}
						onclick={() => store.addMemberToCluster(store.selectedClusterId!, entity.entityId)}
					>+</button>
				{/if}
				<button
					type="button"
					class="eye"
					aria-pressed={!store.isEntityHidden(entity.entityId)}
					aria-label={`${store.isEntityHidden(entity.entityId) ? 'Show' : 'Hide'} ${row.label}`}
					title={store.isEntityHidden(entity.entityId) ? 'Show in viewport' : 'Hide in viewport'}
					onclick={() => store.toggleEntityVisibility(entity.entityId)}
				>{#if store.isEntityHidden(entity.entityId)}<EyeOff size={14} aria-hidden="true" />{:else}<Eye size={14} aria-hidden="true" />{/if}</button>
				<button
					type="button"
					class="kebab"
					aria-label={`Actions for ${row.label}`}
					aria-expanded={openMenuFor === `entity:${entity.entityId}`}
					onclick={() => toggleMenu(`entity:${entity.entityId}`)}
				><EllipsisVertical size={14} aria-hidden="true" /></button>
				{#if openMenuFor === `entity:${entity.entityId}`}
					<div class="row-menu" role="menu">
						<button type="button" role="menuitem" onclick={() => store.focusPlacement(entity.entityId)}><Scan size={13} aria-hidden="true" /> Frame</button>
						<button type="button" role="menuitem" class="danger" onclick={() => store.deletePlacements([entity.entityId])}><Trash2 size={13} aria-hidden="true" /> Delete</button>
					</div>
				{/if}
			</div>
		{/if}
	{/snippet}

	<div class="tree-scroll" bind:this={scrollElement}>
		{#if projection.rows.length === 0}
			<p class="empty">{emptyMessage}</p>
		{:else}
			<ul class="tree-page" role="tree" aria-label={pageLabel}>
				{#each projection.rows as row (row.rowKey)}
					<HierarchyRow
						{row}
						isSelected={rowSelected}
						isInteractive={rowInteractive}
						isOpen={rowOpen}
						onSelect={selectRow}
						onToggle={toggleRow}
						onAction={runAction}
						onContextMenu={contextMenu ? rowContextMenu : undefined}
						onEmphasis={emphasize}
						onEmphasisLeave={deEmphasize}
						{rowExtras}
					/>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<style>
	.hierarchy-navigator {
		display: flex;
		min-width: 0;
		min-height: 0;
		flex: 1 1 auto;
		flex-direction: column;
		gap: 0.5rem;
	}
	.tree-nav {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.45rem;
	}
	.tree-nav__back {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.22rem 0.5rem;
		border: 1px solid var(--editor-border-normal);
		border-radius: 0.28rem;
		background: var(--editor-bg-panel-raised);
		color: var(--editor-text-secondary);
		font: inherit;
		font-size: 0.68rem;
		cursor: pointer;
	}
	.tree-nav__back:hover:not(:disabled) {
		border-color: var(--editor-accent-border);
		background: var(--editor-bg-selected);
		color: var(--editor-text-primary);
	}
	.tree-nav__back:disabled { opacity: 0.4; cursor: default; }
	.tree-nav__page {
		min-width: 0;
		overflow: hidden;
		color: var(--editor-text-muted);
		font-size: 0.68rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tree-scroll {
		display: flex;
		min-width: 0;
		min-height: 0;
		flex: 1 1 auto;
		flex-direction: column;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.tree-page { display: flex; min-width: 0; flex-direction: column; gap: 0.12rem; }
	:global(.hierarchy-node) { display: flex; min-width: 0; flex-direction: column; gap: 0.1rem; }
	:global(.hierarchy-heading) {
		margin: 0.35rem 0.45rem 0.05rem;
		color: var(--editor-text-muted);
		font-size: 0.6rem;
		font-weight: 650;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	:global(.hierarchy-line) {
		display: grid;
		min-width: 0;
		grid-template-columns: 1.7rem minmax(0, 1fr) auto;
		gap: 0.1rem;
		align-items: stretch;
	}
	:global(.hierarchy-section) { min-height: 1.8rem; }
	:global(.hierarchy-entity) { min-height: 1.9rem; }
	:global(.hierarchy-relation) { min-height: 1.6rem; color: var(--editor-text-muted); font-size: 0.68rem; }
	:global(.hierarchy-children) {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.1rem;
		margin-left: 0.85rem;
		padding-left: 0.62rem;
		border-left: 1px solid var(--editor-border-subtle);
	}
	:global(.hierarchy-actions) { display: flex; align-items: center; gap: 0.12rem; }
	:global(.hierarchy-action) {
		padding: 0.2rem 0.4rem;
		border: 1px solid var(--editor-border-normal);
		border-radius: 0.24rem;
		background: transparent;
		color: var(--editor-text-secondary);
		font: inherit;
		font-size: 0.64rem;
		cursor: pointer;
	}
	:global(.hierarchy-action:hover) {
		border-color: var(--editor-accent-border);
		background: var(--editor-bg-selected);
		color: var(--editor-text-primary);
	}

	/* Scene row extras — the same presentation the legacy Scene rows used. */
	.row-actions { position: relative; display: flex; align-items: center; gap: 0.12rem; }
	.eye,
	.kebab {
		display: inline-flex;
		width: 1.45rem;
		min-height: 1.7rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid transparent;
		border-radius: 0.24rem;
		background: transparent;
		color: var(--editor-text-muted);
		cursor: pointer;
	}
	.eye:hover,
	.kebab:hover,
	.kebab[aria-expanded='true'] {
		border-color: var(--editor-border-normal);
		background: var(--editor-bg-control);
		color: var(--editor-text-primary);
	}
	.eye[aria-pressed='false'] { color: var(--editor-text-disabled); }
	.mini-action {
		width: 1.8rem;
		min-height: 1.9rem;
		padding: 0;
		border: 1px solid var(--editor-border-normal);
		border-radius: 0.28rem;
		background: var(--editor-bg-panel-raised);
		color: var(--editor-text-primary);
		cursor: pointer;
	}
	.mini-action:hover { border-color: var(--editor-accent-border); background: var(--editor-bg-selected); }
	.row-menu {
		position: absolute;
		top: calc(100% + 0.2rem);
		right: 0;
		z-index: 30;
		display: flex;
		min-width: 8rem;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.3rem;
		border: 1px solid color-mix(in srgb, var(--editor-border-normal) 88%, transparent);
		border-radius: 0.34rem;
		background: var(--editor-bg-panel-raised);
		box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 42%);
	}
	.row-menu button {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.34rem 0.5rem;
		border: 1px solid transparent;
		border-radius: 0.26rem;
		background: transparent;
		color: var(--editor-text-secondary);
		font: inherit;
		font-size: 0.68rem;
		text-align: left;
		cursor: pointer;
	}
	.row-menu button:hover { border-color: var(--editor-border-normal); background: var(--editor-bg-control); color: var(--editor-text-primary); }
	.row-menu button.danger { color: var(--editor-danger-fg); }
	.row-menu button.danger:hover { border-color: var(--editor-danger-border); background: var(--editor-danger-soft); color: var(--editor-danger-fg); }
</style>

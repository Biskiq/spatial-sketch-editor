<script lang="ts">
	// P23.6e slice 4 — the page-based, relationship-aware Scene Navigator.
	//
	// Mounted by `UnifiedProjectTree` for canonical wall-first documents in place
	// of the accordion tree. The surface is a projection: rows come from the pure
	// page builders, page/query/filter/disclosure/scroll state from the UI-only
	// `HierarchyNavigatorStore`. Row activation calls the existing canonical
	// selection writers and nothing else — opening a page never selects, and
	// selecting never navigates.
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { EllipsisVertical, Eye, EyeOff, Scan, Search, Trash2 } from 'lucide-svelte';
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
		canonicalHierarchyHome,
		evaluateHierarchyReveal,
		explainHierarchyExclusion,
		findHierarchyRepresentation,
		hierarchyEntityPresentation,
		hierarchyHomeLabel,
		OPENING_FILTER_LABELS,
		WALL_FILTER_LABELS,
		type HierarchyDestination,
		type HierarchyPage,
		type HierarchyProjectedRow,
		type HierarchyRevealObservation,
		type OpeningFilter,
		type WallFilter
	} from './hierarchy-page-projection';
	import { buildHierarchySearchProjection } from './hierarchy-search';
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
		onRoomContextMenu,
		onJunctionContextMenu
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
		/**
		 * P23.14 §13 — the Junction row's reason-coded destructive entry point.
		 * The row surface stays presentation-only: the owner resolves the planner's
		 * refusal reason and opens the shared menu.
		 */
		onJunctionContextMenu: (event: MouseEvent, junctionId: string) => void;
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

	// ── representation, pinned strip and reveal (slice 5) ────────────────

	// The calm/default projection for the active page, so an active filter can be
	// told apart from the page itself never containing the entity.
	const baseProjection = $derived(buildHierarchyPageProjection(index, entry.page));
	// Search is a global projection over the same documents while the underlying
	// page stays in the current entry: it is not a page, and it never pushes.
	const searchProjection = $derived(
		entry.query.trim().length > 0 ? buildHierarchySearchProjection(index, entry.query) : null
	);
	const searching = $derived(searchProjection !== null);
	// Whichever surface is actually rendered owns representation and reveal.
	const activeProjection = $derived(searchProjection ?? projection);
	const activeRepresentation = $derived(
		activeEntity ? findHierarchyRepresentation(activeProjection, activeEntity) : null
	);

	// Neutral bottom-pinned strip: derived, never stored, never a second selection.
	// Rows under collapsed ancestors and rows outside the viewport are
	// represented, so only projection absence pins (plan §Reason priority).
	const pinned = $derived.by(() => {
		const entity = activeEntity;
		if (!entity || activeRepresentation) return null;
		const reason = explainHierarchyExclusion({
			page: entry.page,
			current: activeProjection,
			base: baseProjection,
			entity,
			queryActive: searching,
			roomName:
				entry.page.kind === 'room'
					? index.roomById.get(entry.page.roomId)?.name
					: undefined
		});
		if (!reason) return null;
		const home = canonicalHierarchyHome(index, entity);
		if (!home) return null;
		return {
			entity,
			// P23.12 D5 — the pin composes through the SAME presentation the row
			// builders use (one call, one pair), so a pinned selection cannot render
			// a reference the row collapsed away.
			...hierarchyEntityPresentation(index, entity),
			reason,
			home,
			homeLabel: hierarchyHomeLabel(home)
		};
	});

	let openMenuFor = $state<string | null>(null);
	let scrollElement = $state<HTMLElement | null>(null);
	// Non-reactive scheduling state: one pending scroll per cycle, replaced by a
	// newer reveal and applied after the disclosure render has produced the row.
	let pendingScroll: { rowKey: string } | { top: number } | null = null;
	let revealObservation: HierarchyRevealObservation | null = null;
	// Was the selected row actually rendered last cycle? A manual disclosure
	// gesture may scroll only when it newly produced that row (DOM knowledge the
	// pure reveal model deliberately does not have).
	let renderedSelectionRowKey: string | null = null;

	// ── page validity / reconciliation ───────────────────────────────────

	function pageValid(page: HierarchyPage): boolean {
		return page.kind !== 'room' || index.roomById.has(page.roomId);
	}

	// A page parameter that no longer exists falls back (rooms → root) without
	// selecting anything or creating document history.
	$effect(() => {
		navigator.reconcile({ isPageValid: pageValid });
	});

	// ── reveal / scroll ownership (slice 5) ──────────────────────────────

	/** The exact row element for a canonical row key, if it is rendered now. */
	function findRenderedRow(rowKey: string): HTMLElement | null {
		if (!scrollElement) return null;
		for (const element of scrollElement.querySelectorAll<HTMLElement>('[data-row-key]')) {
			if (element.dataset.rowKey === rowKey) return element;
		}
		return null;
	}

	/**
	 * Apply after the disclosure render: `tick()` waits for the state change,
	 * and one animation frame guards against a paint still in flight. A row that
	 * is still not rendered (for example a collapse) simply does not scroll.
	 */
	function scheduleScroll(next: { rowKey: string } | { top: number }): void {
		pendingScroll = next;
		const scheduled = next;
		void tick().then(() => {
			requestAnimationFrame(() => {
				if (pendingScroll !== scheduled) return;
				pendingScroll = null;
				if (!scrollElement) return;
				if ('top' in scheduled) {
					scrollElement.scrollTop = scheduled.top;
					return;
				}
				findRenderedRow(scheduled.rowKey)?.scrollIntoView({ block: 'nearest' });
			});
		});
	}

	/**
	 * Event/cause-aware reveal. The decision is pure (slice-1 model); this effect
	 * only performs the side effects: disclose, then scroll. It never writes page
	 * history or canonical selection, and it never scrolls on ordinary entry or
	 * a Back restoration - those restore the entry's own saved scroll instead.
	 */
	$effect(() => {
		const transition = navigator.transition;
		const observation: HierarchyRevealObservation = {
			transitionRevision: transition.revision,
			transitionKind: transition.kind,
			// The target travels on its own: an explicit `Show in…` reveals the row
			// it names even with nothing selected, and discloses that row's
			// ancestors rather than the selection's.
			targetRowKey: transition.kind === 'show-in' ? (transition.target?.rowKey ?? null) : null,
			targetAncestorDisclosureKeys:
				transition.kind === 'show-in' ? (transition.target?.ancestorDisclosureKeys ?? []) : [],
			selectionId: activeEntity?.id ?? null,
			representedRowKey: activeRepresentation?.rowKey ?? null,
			ancestorDisclosureKeys: activeRepresentation?.ancestorDisclosureKeys ?? [],
			userDisclosureRevision: navigator.disclosureRevision
		};
		const previous = revealObservation;
		revealObservation = observation;
		// First render is an ordinary entry: highlight only, never scroll.
		if (!previous) {
			renderedSelectionRowKey = findRenderedRow(observation.representedRowKey ?? '')
				? observation.representedRowKey
				: null;
			return;
		}
		const decision = evaluateHierarchyReveal(previous, observation);
		switch (decision.kind) {
			case 'reveal':
				if (decision.disclose.length > 0) navigator.revealDisclosure(decision.disclose);
				scheduleScroll({ rowKey: decision.scrollTo });
				break;
			case 'scroll': {
				// Scroll only when this gesture actually produced the selected row.
				const rowKey = observation.representedRowKey;
				if (
					rowKey !== null &&
					renderedSelectionRowKey !== rowKey &&
					findRenderedRow(rowKey) !== null
				) {
					scheduleScroll({ rowKey });
				}
				break;
			}
			case 'restore-scroll':
				// Back/history-restore and ordinary entry put the viewport back where
				// the entry says; the restored scroll wins over any selection reveal.
				scheduleScroll({ top: untrack(() => navigator.current.scrollTop) });
				break;
			default:
				break;
		}
		const rowKey = observation.representedRowKey;
		renderedSelectionRowKey =
			rowKey !== null && findRenderedRow(rowKey) !== null ? rowKey : null;
	});

	// The Navigator remounts when the editor sidebar switches domain. Restore the
	// saved entry offset only after this instance has rendered its rows; mount-time
	// selection must not disclose or reveal anything.
	onMount(() => {
		scheduleScroll({ top: untrack(() => navigator.current.scrollTop) });
	});

	/** Scroll capture: the entry owns the offset, never a separate scroll store. */
	function captureScroll(): void {
		if (scrollElement) navigator.setScrollTop(scrollElement.scrollTop);
	}

	// Row emphasis is transient presentation only: unmounting the Scene Navigator
	// must never leave the Plan surface highlighting a row that no longer exists.
	onDestroy(() => navigator.clearEmphasis());

	// ── transient search / filters (slice 6) ─────────────────────────────

	function setQuery(next: string): void {
		const wasSearching = entry.query.trim().length > 0;
		const willSearch = next.trim().length > 0;
		const restoredPageScrollTop = navigator.setQuery(next);
		if (willSearch && !wasSearching) scheduleScroll({ top: 0 });
		else if (!willSearch && wasSearching && restoredPageScrollTop !== null) {
			scheduleScroll({ top: restoredPageScrollTop });
		}
	}

	function clearQuery(): void {
		if (entry.query.length > 0) setQuery('');
	}

	const wallFilterOptions = $derived(
		(Object.keys(WALL_FILTER_LABELS) as WallFilter[]).map((value) => ({
			value,
			label: WALL_FILTER_LABELS[value]
		}))
	);
	const openingFilterOptions = $derived(
		(Object.keys(OPENING_FILTER_LABELS) as OpeningFilter[]).map((value) => ({
			value,
			label: OPENING_FILTER_LABELS[value]
		}))
	);

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
		if (
			entity.owner === 'scene' &&
			entity.kind === 'entity' &&
			active.domain === 'scene' &&
			active.selection.kind === 'placement'
		) {
			return active.selection.ids.includes(entity.entityId);
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
		if (row.disclosureKey) {
			navigator.toggleDisclosure(row.disclosureKey, row.defaultOpen === true, row.alwaysOpen === true);
		}
	}

	function selectRow(row: HierarchyProjectedRow, event?: MouseEvent): void {
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
		// Forward the originating event: Shift-click must still reach the existing
		// additive Scene-selection path instead of a plain replace.
		if (sceneEntity) onSelectSceneEntity(sceneEntity, event);
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
		else if (entity.kind === 'junction') onJunctionContextMenu(event, entity.junctionId);
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

	<div class="tree-search" role="search">
		<span class="tree-search__icon"><Search size={14} aria-hidden="true" /></span>
		<input
			type="search"
			class="tree-search__input"
			value={entry.query}
			placeholder="Search Rooms, Walls, Openings…"
			aria-label="Search hierarchy"
			oninput={(event) => setQuery(event.currentTarget.value)}
			onkeydown={(event) => {
				if (event.key === 'Escape') {
					event.preventDefault();
					clearQuery();
				}
			}}
		/>
		{#if entry.query.length > 0}
			<button
				type="button"
				class="tree-search__clear"
				aria-label="Clear search"
				onclick={clearQuery}>×</button>
		{/if}
	</div>

	{#if !searching && entry.page.kind === 'walls'}
		<label class="tree-filter-select">
			<span class="tree-filter-select__label">Walls</span>
			<select
				value={entry.wallFilter}
				onchange={(event) => navigator.setWallFilter(event.currentTarget.value as WallFilter)}
			>
				{#each wallFilterOptions as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</label>
	{:else if !searching && entry.page.kind === 'openings'}
		<label class="tree-filter-select">
			<span class="tree-filter-select__label">Openings</span>
			<select
				value={entry.openingFilter}
				onchange={(event) => navigator.setOpeningFilter(event.currentTarget.value as OpeningFilter)}
			>
				{#each openingFilterOptions as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</label>
	{/if}

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

	<div class="tree-scroll" bind:this={scrollElement} onscroll={captureScroll}>
		{#if searchProjection}
			{#if searchProjection.empty}
				<p class="empty">No matches for “{searchProjection.query.trim()}”</p>
			{:else}
				{#each searchProjection.blocks as block (block.category)}
					<section class="search-block">
						<p class="hierarchy-heading">{block.label}</p>
						{#each block.groups as group (group.kind)}
							<p class="search-group">{group.label}</p>
							<ul class="tree-page" role="tree" aria-label={`${block.label} ${group.label}`}>
								{#each group.rows as row (row.rowKey)}
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
						{/each}
					</section>
				{/each}
			{/if}
		{:else if projection.rows.length === 0}
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

	{#if pinned}
		<!-- Neutral, in-place pinned selection: no icon, colour or animation. -->
		<div class="hierarchy-pin" role="status">
			<span class="hierarchy-pin__text">
				<!-- P23.12 — the name and the reference are separate flex items: the
					name takes the ellipsis, the reference never does. Nesting the
					reference inside the truncating title let a long name clip it away. -->
				<span class="hierarchy-pin__identity">
					<span class="hierarchy-pin__title" title={pinned.entity.id}>
						Selected {pinned.label}
					</span>
					{#if pinned.reference}<span class="hierarchy-pin__reference">{pinned.reference}</span>{/if}
				</span>
				<span class="hierarchy-pin__reason">{pinned.reason.text}</span>
			</span>
			<button
				type="button"
				class="hierarchy-pin__action"
				title={`Show ${pinned.label} in ${pinned.homeLabel}`}
				onclick={() => navigator.showIn(pinned.home)}
			>Show in {pinned.homeLabel} ›</button>
		</div>
	{/if}
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
		font-size: var(--editor-font-size-xs);
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
		font-size: var(--editor-font-size-xs);
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
		/* P23.14 §23 — progressive density is measured against the *column*, not
		   the window: the Navigator can be 240 px wide inside a 1600 px window.
		   Rows adapt through a container query on this scroll surface. */
		container-type: inline-size;
	}
	.tree-search {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.3rem;
		padding: 0.22rem 0.35rem;
		border: 1px solid var(--editor-border-normal);
		border-radius: 0.3rem;
		background: var(--editor-bg-panel-raised);
	}
	.tree-search__icon { display: inline-flex; color: var(--editor-text-muted); }
	.tree-search__input {
		min-width: 0;
		flex: 1 1 auto;
		border: 0;
		background: transparent;
		color: var(--editor-text-primary);
		font: inherit;
		font-size: var(--editor-font-size-md);
		outline: none;
	}
	.tree-search__input::-webkit-search-cancel-button { display: none; }
	.tree-search__clear {
		display: inline-flex;
		width: 1.2rem;
		height: 1.2rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 0;
		border-radius: 0.2rem;
		background: transparent;
		color: var(--editor-text-muted);
		font: inherit;
		font-size: var(--editor-font-size-lg);
		line-height: 1;
		cursor: pointer;
	}
	.tree-search__clear:hover { background: var(--editor-bg-control); color: var(--editor-text-primary); }
	.tree-filter-select {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.35rem;
	}
	.tree-filter-select__label {
		color: var(--editor-text-muted);
		font-size: var(--editor-font-size-xs);
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.tree-filter-select select {
		min-width: 0;
		flex: 1 1 auto;
		padding: 0.2rem 0.3rem;
		border: 1px solid var(--editor-border-normal);
		border-radius: 0.26rem;
		background: var(--editor-bg-panel-raised);
		color: var(--editor-text-secondary);
		font: inherit;
		font-size: var(--editor-font-size-xs);
	}
	.search-block { display: flex; min-width: 0; flex-direction: column; }
	.search-group {
		margin: 0.25rem 0.45rem 0.1rem;
		color: var(--editor-text-muted);
		font-size: var(--editor-font-size-xs);
		opacity: 0.75;
	}
	.tree-page {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.12rem;
		/* Reset the UA list indent/markers: these are tree rows, not bullets. */
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.empty {
		margin: 0.5rem 0.45rem;
		color: var(--editor-text-muted);
		font-size: var(--editor-font-size-md);
		line-height: 1.4;
	}
	.hierarchy-pin {
		display: flex;
		min-width: 0;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
		padding: 0.34rem 0.45rem;
		border-top: 1px solid var(--editor-border-subtle);
		background: var(--editor-bg-panel);
	}
	.hierarchy-pin__text { display: flex; min-width: 0; flex-direction: column; }
	.hierarchy-pin__identity {
		display: flex;
		min-width: 0;
		align-items: baseline;
		gap: 0.3rem;
	}
	.hierarchy-pin__title {
		/* The only truncating tier of the pin's identity line. */
		min-width: 0;
		overflow: hidden;
		color: var(--editor-text-secondary);
		font-size: var(--editor-font-size-xs);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* P23.12 — protected identity span: never shrinks, never truncates, and
		never sits inside an `overflow: hidden` container. */
	.hierarchy-pin__reference {
		flex: 0 0 auto;
		color: var(--editor-text-muted);
		font-family: var(--editor-font-mono, ui-monospace, monospace);
		font-size: var(--editor-font-size-xs);
		letter-spacing: 0.01em;
		white-space: nowrap;
	}
	.hierarchy-pin__reason {
		min-width: 0;
		overflow: hidden;
		color: var(--editor-text-muted);
		font-size: var(--editor-font-size-xs);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.hierarchy-pin__action {
		flex: 0 0 auto;
		padding: 0.2rem 0.4rem;
		border: 1px solid var(--editor-border-normal);
		border-radius: 0.24rem;
		background: transparent;
		color: var(--editor-text-secondary);
		font: inherit;
		font-size: var(--editor-font-size-xs);
		cursor: pointer;
	}
	.hierarchy-pin__action:hover {
		border-color: var(--editor-accent-border);
		background: var(--editor-bg-selected);
		color: var(--editor-text-primary);
	}
	:global(.hierarchy-node) { display: flex; min-width: 0; flex-direction: column; gap: 0.1rem; }
	:global(.hierarchy-heading) {
		margin: 0.35rem 0.45rem 0.05rem;
		color: var(--editor-text-muted);
		font-size: var(--editor-font-size-xs);
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
	:global(.hierarchy-relation) { min-height: 1.6rem; color: var(--editor-text-muted); font-size: var(--editor-font-size-xs); }
	:global(.hierarchy-children) {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.1rem;
		/* P23.14 §12.5 — shallow indentation: ~10 px per level, never the
		   oversized folder-tree step. A deeply expanded Room → Architecture →
		   Walls branch must stay usable at the reference 268 px Navigator. */
		margin-left: 0;
		padding-left: 0.65rem;
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
		font-size: var(--editor-font-size-xs);
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
		font-size: var(--editor-font-size-xs);
		text-align: left;
		cursor: pointer;
	}
	.row-menu button:hover { border-color: var(--editor-border-normal); background: var(--editor-bg-control); color: var(--editor-text-primary); }
	.row-menu button.danger { color: var(--editor-danger-fg); }
	.row-menu button.danger:hover { border-color: var(--editor-danger-border); background: var(--editor-danger-soft); color: var(--editor-danger-fg); }
</style>

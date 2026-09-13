<script lang="ts">
	// P23.6e slice 4 — one projected Navigator row, rendered recursively.
	//
	// Presentation only: it renders exactly the rows the pure page/search
	// projection produced (label, secondary text, disclosure, actions) and
	// forwards every gesture to the owner. It never selects, mutates, navigates
	// or invents a row — the parent owns the canonical writers and the row
	// authority gate.
	import type { Snippet } from 'svelte';
	import type {
		HierarchyDestination,
		HierarchyProjectedRow
	} from './hierarchy-page-projection';
	import HierarchyRow from './HierarchyRow.svelte';

	let {
		row,
		depth = 0,
		isSelected,
		isInteractive,
		isOpen,
		onSelect,
		onToggle,
		onAction,
		onContextMenu = undefined,
		onEmphasis = undefined,
		onEmphasisLeave = undefined,
		rowExtras = undefined
	}: {
		row: HierarchyProjectedRow;
		depth?: number;
		isSelected: (row: HierarchyProjectedRow) => boolean;
		isInteractive: (row: HierarchyProjectedRow) => boolean;
		isOpen: (row: HierarchyProjectedRow) => boolean;
		onSelect: (row: HierarchyProjectedRow) => void;
		onToggle: (row: HierarchyProjectedRow) => void;
		onAction: (destination: HierarchyDestination) => void;
		onContextMenu?: (event: MouseEvent, row: HierarchyProjectedRow) => void;
		onEmphasis?: (row: HierarchyProjectedRow) => void;
		onEmphasisLeave?: (row: HierarchyProjectedRow) => void;
		/** Owner-supplied per-row actions (mutations live outside this renderer). */
		rowExtras?: Snippet<[HierarchyProjectedRow]>;
	} = $props();

	const selected = $derived(isSelected(row));
	const interactive = $derived(isInteractive(row));
	const open = $derived(isOpen(row));
	const hasChildren = $derived((row.children?.length ?? 0) > 0);
</script>

<li
	class="hierarchy-node"
	class:hierarchy-node--depth={depth > 0}
	role="treeitem"
	aria-expanded={row.disclosureKey ? open : undefined}
	aria-selected={row.kind === 'entity' ? selected : undefined}
	data-row-key={row.rowKey}
>
	{#if row.kind === 'heading'}
		<!-- Presentational eyebrow: not focusable, not selectable, not a page. -->
		<p class="hierarchy-heading">{row.label}</p>
	{:else if row.kind === 'destination'}
		<button type="button" class="tree-root__row" onclick={() => row.destination && onAction(row.destination)}>
			<span class="tree-row__label tree-root__label">{row.label}</span>
			{#if row.count !== undefined}<span class="tree-row__meta">{row.count}</span>{/if}
		</button>
	{:else if row.kind === 'section'}
		<div class="hierarchy-line">
			<button
				type="button"
				class="tree-row__chevron"
				aria-expanded={open}
				aria-label={`${open ? 'Collapse' : 'Expand'} ${row.label}`}
				onclick={() => onToggle(row)}
			>
				<span class="chevron" class:open={open}>›</span>
			</button>
			<button
				type="button"
				class="tree-row hierarchy-section"
				title={row.tooltip}
				onclick={() => onToggle(row)}
			>
				<span class="tree-row__label">{row.label}</span>
			</button>
		</div>
	{:else}
		<!-- `relation` (non-selectable, e.g. `Ends J1 · J2`) and `entity` rows. -->
		<div class="hierarchy-line">
			{#if row.kind === 'entity' && row.disclosureKey}
				<button
					type="button"
					class="tree-row__chevron"
					aria-expanded={open}
					aria-label={`${open ? 'Collapse' : 'Expand'} ${row.label}`}
					onclick={() => onToggle(row)}
				>
					<span class="chevron" class:open={open}>›</span>
				</button>
			{:else}
				<span class="tree-row__chevron-spacer" aria-hidden="true"></span>
			{/if}
			{#if row.kind === 'entity'}
				<button
					type="button"
					class="tree-row hierarchy-entity"
					class:tree-row--selected={selected}
					aria-disabled={!interactive}
					title={row.tooltip ?? row.canonicalId}
					onclick={interactive ? () => onSelect(row) : undefined}
					oncontextmenu={onContextMenu ? (event) => onContextMenu(event, row) : undefined}
					onpointerenter={() => onEmphasis?.(row)}
					onpointerleave={() => onEmphasisLeave?.(row)}
					onfocus={() => onEmphasis?.(row)}
					onblur={() => onEmphasisLeave?.(row)}
				>
					<span class="tree-row__label">{row.label}</span>
					{#if row.secondary}<span class="tree-row__meta">{row.secondary}</span>{/if}
				</button>
			{:else}
				<p class="tree-row hierarchy-relation">
					<span class="tree-row__label">{row.label}</span>
					{#if row.secondary}<span class="tree-row__meta">{row.secondary}</span>{/if}
				</p>
			{/if}
			{#if row.actions?.length}
				<div class="hierarchy-actions">
					{#each row.actions as action (action.actionKey)}
						<button
							type="button"
							class="hierarchy-action"
							onclick={() => onAction(action.destination)}
						>{action.label}</button>
					{/each}
				</div>
			{/if}
			{#if rowExtras}{@render rowExtras(row)}{/if}
		</div>
	{/if}

	{#if hasChildren && (row.kind === 'heading' || row.kind === 'destination' || open)}
		<ul class="hierarchy-children" role="group">
			{#each row.children ?? [] as child (child.rowKey)}
				<HierarchyRow
					row={child}
					depth={depth + 1}
					{isSelected}
					{isInteractive}
					{isOpen}
					{onSelect}
					{onToggle}
					{onAction}
					{onContextMenu}
					{onEmphasis}
					{onEmphasisLeave}
					{rowExtras}
				/>
			{/each}
		</ul>
	{/if}
</li>

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
		/**
		 * Row activation. The originating event is forwarded so owners can keep
		 * modifier semantics (Scene Shift-click adds to the selection) rather than
		 * flattening every activation into a plain replace.
		 */
		onSelect: (row: HierarchyProjectedRow, event?: MouseEvent) => void;
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
					onclick={interactive ? (event) => onSelect(row, event) : undefined}
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

<style>
	/*
	 * P23.6e review — row primitives live here, not in `UnifiedProjectTree`.
	 * Svelte scopes a parent's stylesheet to its own markup, so the classes the
	 * legacy tree stylesheet defines (`.tree-row`, `.tree-row__label`, …) never
	 * reached this child component: the Navigator rows rendered as native gray
	 * buttons in the UA font, with default list markers and indent.
	 *
	 * `.hierarchy-node`/`.hierarchy-line`/`.hierarchy-children` structure and the
	 * shared `--editor-*` tokens still come from the surface that owns them.
	 */
	ul {
		min-width: 0;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tree-root__row {
		display: flex;
		width: 100%;
		min-width: 0;
		min-height: 2.125rem;
		box-sizing: border-box;
		align-items: center;
		gap: 0.45rem;
		padding: 0.28rem 0.45rem;
		border: 1px solid transparent;
		border-radius: 0.28rem;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.tree-root__row:hover {
		border-color: var(--editor-border-normal);
		background: var(--editor-bg-control);
	}
	.tree-root__label { font-size: 0.8rem; font-weight: 650; letter-spacing: 0.02em; }
	.chevron {
		display: block;
		font-size: 1rem;
		line-height: 1;
		transform: rotate(0);
		transition: transform 120ms ease;
	}
	.chevron.open { transform: rotate(90deg); }
	.tree-row {
		display: flex;
		width: 100%;
		min-width: 0;
		min-height: 2rem;
		box-sizing: border-box;
		align-items: center;
		gap: 0.45rem;
		padding: 0.28rem 0.45rem;
		border: 1px solid transparent;
		border-radius: 0.28rem;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
	}
	button.tree-row { cursor: pointer; }
	button.tree-row:hover:not([aria-disabled='true']) {
		border-color: var(--editor-border-normal);
		background: var(--editor-bg-control);
	}
	button.tree-row[aria-disabled='true'] { opacity: 0.6; }
	.tree-row--selected {
		border-color: var(--editor-accent-border);
		background: var(--editor-bg-selected);
		box-shadow: inset 0 0 0 1px var(--editor-accent-pressed);
		color: var(--editor-text-primary);
	}
	.tree-row--selected[aria-disabled='true'] { opacity: 1; }
	.tree-row__chevron {
		display: grid;
		width: 1.7rem;
		min-height: 2rem;
		place-items: center;
		padding: 0;
		border: 1px solid transparent;
		border-radius: 0.28rem;
		background: transparent;
		color: var(--editor-accent);
		cursor: pointer;
	}
	.tree-row__chevron:hover {
		border-color: var(--editor-border-normal);
		background: var(--editor-bg-control);
	}
	.tree-row__chevron-spacer { display: block; width: 1.7rem; min-height: 2rem; }
	.tree-row__label {
		min-width: 0;
		overflow: hidden;
		font-size: 0.74rem;
		font-weight: 570;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tree-row__meta {
		min-width: 0;
		margin-left: auto;
		overflow: hidden;
		color: var(--editor-text-muted);
		font-size: 0.62rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tree-row--selected .tree-row__meta { color: var(--editor-text-primary); }
</style>

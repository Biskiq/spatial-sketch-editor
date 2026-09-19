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
	import {
		exactReferenceEmphasis,
		identityMatchTargets,
		identitySegments
	} from './hierarchy-identity-presentation';
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
	// P23.14 §12.2/§12.3 — a contextual occurrence is the SAME canonical entity
	// as its home row (same reference, same name, same selection), presented as a
	// projection through another context rather than a second owner. It renders
	// with the entity row's grammar plus an occurrence marker, so "shown through
	// Gallery North" can never masquerade as "owned by Gallery North".
	const isEntityRow = $derived(row.kind === 'entity' || row.kind === 'occurrence');
	const isOccurrence = $derived(row.kind === 'occurrence');

	// ── P23.12 identity presentation ──────────────────────────────────────

	/**
	 * A reference-led label *is* the reference, so the whole six-character token
	 * is the entity's identity and must never be clipped.
	 */
	const referenceLed = $derived(row.referenceLed === true);

	/**
	 * A search hit emphasises the identity the user actually typed, and an exact
	 * reference match is the strongest claim: it emphasises whichever span renders
	 * that token (the module decides, so the rule is testable).
	 */
	const matchEmphasis = $derived(exactReferenceEmphasis(row));

	// Which visible span may highlight the hit, and how the matched substring is
	// marked — both answered by the pure presentation module.
	const matchTargets = $derived(identityMatchTargets(row));
	const labelSegments = $derived(
		identitySegments(row.label, row.match?.query, matchTargets.label)
	);
	const referenceSegments = $derived(
		row.reference === undefined
			? []
			: identitySegments(row.reference, row.match?.query, matchTargets.reference)
	);

</script>

<li
	class="hierarchy-node"
	class:hierarchy-node--depth={depth > 0}
	role="treeitem"
	aria-expanded={row.disclosureKey ? open : undefined}
	aria-selected={isEntityRow ? selected : undefined}
	data-row-key={row.rowKey}
	data-row-kind={row.kind}
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
	{:else if row.kind === 'empty'}
		<!-- §12.3 species 6 — authored empty/teaching state. Never a selectable
		     entity, never an error: guidance for a page that projects no rows. -->
		<p class="hierarchy-empty">{row.label}</p>
	{:else}
		<!-- `relation` count/summary rows (non-selectable), `entity` rows and
		     contextual `occurrence` rows. -->
		<div class="hierarchy-line">
			{#if isEntityRow && row.disclosureKey}
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
			{#if isEntityRow}
				<button
					type="button"
					class="tree-row hierarchy-entity"
					class:hierarchy-occurrence={isOccurrence}
					class:tree-row--selected={selected}
					class:tree-row--match-reference={matchEmphasis === 'reference'}
					class:tree-row--match-label={matchEmphasis === 'label'}
					aria-disabled={!interactive}
					title={row.tooltip ?? row.canonicalId}
					onclick={interactive ? (event) => onSelect(row, event) : undefined}
					oncontextmenu={onContextMenu ? (event) => onContextMenu(event, row) : undefined}
					onpointerenter={() => onEmphasis?.(row)}
					onpointerleave={() => onEmphasisLeave?.(row)}
					onfocus={() => onEmphasis?.(row)}
					onblur={() => onEmphasisLeave?.(row)}
				>
					<!-- P23.12 — a reference-led label is protected exactly like the
						reference span: six characters always fit, and an ellipsised token is
						an unreadable identity. Named and fallback labels stay truncatable. -->
					<span
						class="tree-row__label"
						class:tree-row__label--reference={referenceLed}
					>{#each labelSegments as segment, index (index)}{#if segment.hit}<mark
									class="tree-row__hit">{segment.text}</mark
								>{:else}{segment.text}{/if}{/each}</span>
					<!-- P23.12 — the reference is the protected identity span: it never
						truncates and relationship context never displaces it. -->
					{#if row.reference}<span class="tree-row__reference">{#each referenceSegments as segment, index (index)}{#if segment.hit}<mark
									class="tree-row__hit">{segment.text}</mark
								>{:else}{segment.text}{/if}{/each}</span>{/if}
					<!-- P23.12 — a search hit states *why* it is here: a raw-ID query
						can surface a row whose authored name looks unrelated. -->
					{#if row.match}<span class="tree-row__match">{row.match.text}</span>{/if}
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
	/* Roles, not numbers (R3): scope header + disclosure glyph follow the knobs. */
	.tree-root__label { font: var(--editor-type-row-head); letter-spacing: 0.02em; }
	.chevron {
		display: block;
		font-size: var(--editor-icon-size-sm);
		line-height: 1;
		transform: rotate(0);
		transition: transform 120ms ease;
	}
	.chevron.open { transform: rotate(90deg); }
	.tree-row {
		display: flex;
		width: 100%;
		min-width: 0;
		/* Atlas `.row` — 29 px row with a 28 px entity target. */
		min-height: var(--editor-row-height);
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
	/* Atlas `.row .disclosure` — 18 px target, 26 px tall. */
	.tree-row__chevron {
		display: grid;
		width: var(--editor-disclosure-size);
		min-width: var(--editor-disclosure-size);
		min-height: var(--editor-control-sm-height);
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
	.tree-row__chevron-spacer { display: block; width: var(--editor-disclosure-size); min-width: var(--editor-disclosure-size); min-height: var(--editor-control-sm-height); }
	.tree-row__label {
		min-width: 0;
		overflow: hidden;
		/* Role, not a number: the ladder scales with `--editor-type-scale`. */
		font: var(--editor-type-row);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* P23.12 — a reference-led label is the identity, not prose: it never
		shrinks and never ellipsises, so a narrow Navigator cannot turn `W-7K3M`
		into `W-7…`. */
	.tree-row__label--reference {
		flex: 0 0 auto;
		overflow: visible;
		text-overflow: clip;
		white-space: nowrap;
	}
	.tree-row__hit {
		/* Highlighting must not change a row's metrics: no background bleed, no
			weight change, and inheriting colour keeps the selected-state rules. */
		background: transparent;
		color: var(--editor-accent);
		font-weight: 700;
	}
	.tree-row__reference {
		/* Protected: no shrink, no ellipsis — four glyphs plus prefix always fit. */
		flex: 0 0 auto;
		color: var(--editor-text-muted);
		/* §7 two voices + the Atlas's 10 px compact reference. */
		font: var(--editor-type-ref);
		letter-spacing: 0.01em;
		white-space: nowrap;
	}
	/* P23.12 — the search match explanation: subordinate to identity, never the
		primary label, and the first tier to ellipsise under width pressure. */
	.tree-row__match {
		min-width: 0;
		overflow: hidden;
		color: var(--editor-text-muted);
		font-size: var(--editor-font-size-xs);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* P23.12 — an exact-reference hit emphasises whichever span renders the
		token, so an unnamed (reference-led) entity's exact match is never left
		unstyled just because it has no separate reference span. */
	.tree-row--match-reference .tree-row__reference,
	.tree-row--match-label .tree-row__label {
		color: var(--editor-text-primary);
		font-weight: 600;
	}
	/* P23.14 §12.3 species 4 — contextual occurrence. The canonical identity is
		kept verbatim (name, protected full reference, same selection), and the
		`↳` cue plus the quieter name weight make the projection explicit: a
		shared Wall shown through a Room can never read as a second owner. */
	.hierarchy-occurrence::before {
		content: '↳';
		flex: 0 0 auto;
		color: var(--editor-text-muted);
		font-size: var(--editor-font-size-xs);
		line-height: 1;
	}
	.hierarchy-occurrence .tree-row__label { font-weight: 500; }
	.hierarchy-occurrence .tree-row__label--reference { font-weight: 600; }
	/* P23.14 §12.3 species 6 — authored empty/teaching state: guidance, not an
		entity, and never an error treatment. */
	.hierarchy-empty {
		margin: 0.35rem 0.45rem;
		color: var(--editor-text-muted);
		font-size: var(--editor-font-size-sm);
		font-style: italic;
		line-height: 1.4;
	}
	.tree-row__meta {
		min-width: 0;
		margin-left: auto;
		overflow: hidden;
		color: var(--editor-text-muted);
		font: var(--editor-type-ref);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tree-row--selected .tree-row__meta,
	.tree-row--selected .tree-row__reference { color: var(--editor-text-primary); }
	/*
	 * P23.14 §23 — progressive density. When the Navigator is squeezed the row
	 * sheds its trailing metadata first (`row.secondary` — counts, kinds, derived
	 * numbers) and keeps identity (the label), selection and its place in the
	 * tree. Shedding is the last resort, not the first: the measured surface is
	 * the scroll track inside the column (reference 268 − 36 chrome = 232; the
	 * 240 minimum leaves 204), so 216 px fires only once the column is genuinely
	 * squeezed and never at the reference width. The tooltip still carries the
	 * full id, so nothing becomes unreachable.
	 */
	@container (max-width: 216px) {
		.tree-row__meta { display: none; }
	}
</style>

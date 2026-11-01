<script lang="ts">
	/**
	 * PLATE **Index** — the collapsible locator (T1.P01.S02).
	 *
	 * The Index answers *where am I, and where is that thing?* It is a locator and
	 * orientation surface, never a property editor: it lists canonical sources and
	 * the four separate subject operations (**Select**, **Open location**, **Bring
	 * into view**, **Reveal**). Selecting never navigates, and navigation,
	 * location and inspection never require a prior selection.
	 *
	 * R217.S21 — one compact row per subject at the role's Index width. The row's
	 * main control is **Select** and nothing else; the locator operations sit behind
	 * the row's **Actions** disclosure, so each stays a separate, keyboard-reachable
	 * control without repeating itself on every row. The label is the subject's
	 * authored name, or a session-stable `Kind n` (see `index-labels.ts`); the full
	 * canonical identity lives in the row's accessible name.
	 *
	 * Group headings are visually distinct from selectable entities; a group with
	 * no items renders nothing. An excluded source stays **visible and
	 * findable** with its declared membership reason as text, but is not
	 * selectable — its row is announced `aria-disabled` (still focusable, so it can
	 * be located) while its locator operations remain available. **Bring into view**
	 * needs placeable geometry, so it is disabled with its reason on an excluded row;
	 * **Open location** works for every listed subject.
	 *
	 * A **revealed** item carries the evaluator's own `revealed` flag rather than
	 * re-deriving it: the declared membership reason and the display/hit eligibility
	 * are two independent facts, and a revealed source is styled distinctly from an
	 * `included` one without hiding the reason it was excluded for.
	 */
	import { membershipLabel } from './index-labels';

	let {
		open,
		groups,
		selectionId,
		query,
		onQuery,
		onSelect,
		onBringIntoView,
		onReveal
	}: {
		/** Whether the locator shows. The Head's Index toggle is its one control, so the Index holds none. */
		open: boolean;
		groups: readonly {
			id: string;
			label: string;
			items: readonly {
				sourceId: string;
				/** The display label: the authored name, or a generated `Kind n`. */
				label: string;
				/** `false` when the label is generated rather than authored. */
				authored: boolean;
				/** The human kind word shown before the label. */
				kind: string;
				eligible: boolean;
				/** The evaluator's own revealed flag: Reveal keeps the declared reason. */
				revealed: boolean;
				membership: string;
			}[];
		}[];
		selectionId: string | null;
		query: string;
		onQuery: (query: string) => void;
		onSelect: (sourceId: string) => void;
		onBringIntoView: (sourceId: string) => void;
		onReveal: (sourceId: string) => void;
	} = $props();

	/**
	 * Locating is a locator's own operation, not a Stage one: it focuses the
	 * subject's row and scrolls it into view, so the creator can see *where* the
	 * subject is in the list. It works for every listed subject — including an
	 * excluded one, which is exactly when "where is it?" matters — and it is
	 * deliberately distinct from **Select** (which changes the canonical selection)
	 * and from **Bring into view** (which moves the camera to the geometry).
	 */
	const rows = new Map<string, HTMLElement>();

	function locate(node: HTMLElement, sourceId: string) {
		rows.set(sourceId, node);
		return {
			update(next: string) {
				rows.delete(sourceId);
				rows.set(next, node);
			},
			destroy() {
				rows.delete(sourceId);
			}
		};
	}

	function openLocation(sourceId: string): void {
		const row = rows.get(sourceId);
		if (row === undefined) return;
		row.scrollIntoView({ block: 'nearest' });
		row.focus();
	}

	/** Which rows have their Actions disclosure open. Closed by default on every row. */
	let disclosed = $state<ReadonlySet<string>>(new Set());

	function toggleActions(sourceId: string): void {
		const next = new Set(disclosed);
		if (next.has(sourceId)) next.delete(sourceId);
		else next.add(sourceId);
		disclosed = next;
	}

	/** A DOM id that is safe for any canonical identity, which contains colons. */
	function domId(prefix: string, sourceId: string): string {
		return `${prefix}-${sourceId.replace(/[^A-Za-z0-9_-]/g, '_')}`;
	}

	/**
	 * Only non-empty groups are rendered, and a group with items is never hidden.
	 *
	 * Gated on `open` deliberately: the body is `hidden`, not `{#if}`-ed, so every
	 * expression inside it still evaluates. A closed Index that read `groups` here
	 * would turn the complete located-subject list into a per-evaluation dependency
	 * of a panel nobody is looking at.
	 */
	const visibleGroups = $derived(
		open ? groups.filter((group) => group.items.length > 0) : []
	);

	const items = $derived(visibleGroups.flatMap((group) => group.items));
	const hasItems = $derived(items.length > 0);

	const searchedNothing = $derived(query.trim() !== '' && !hasItems);

	/** The row's accessible name: the kind, the full label and the canonical identity. */
	function accessibleName(item: { kind: string; label: string; sourceId: string; revealed: boolean; eligible: boolean; membership: string }): string {
		const badge = item.revealed ? 'Revealed' : !item.eligible ? membershipLabel(item.membership) : '';
		return `${item.kind} ${item.label}. Identity ${item.sourceId}.${badge === '' ? '' : ` ${badge}.`}`;
	}
</script>

<nav
	id="plate-index"
	class="plate-index"
	aria-label="Project locator"
	data-plate-landmark="index"
	class:collapsed={!open}
	hidden={!open}
>
	<div id="plate-index-body" class="index-body" hidden={!open}>
		<div class="index-search">
			<label class="search-label" for="plate-index-search">Find a subject</label>
			<input
				id="plate-index-search"
				type="search"
				class="search-input"
				placeholder="Search by name, kind or identity…"
				value={query}
				oninput={(event) => onQuery((event.currentTarget as HTMLInputElement).value)}
			/>
		</div>

		{#if searchedNothing}
			<p class="index-empty" role="status">No matching subjects</p>
		{:else if !hasItems}
			<p class="index-empty">This project has no located subjects yet.</p>
		{:else}
			{#each visibleGroups as group (group.id)}
				<section class="index-group" aria-labelledby={`plate-index-group-${group.id}`}>
					<h3 class="group-heading" id={`plate-index-group-${group.id}`}>{group.label}</h3>
					<ul class="group-items">
						{#each group.items as item (item.sourceId)}
							{@const selected = item.sourceId === selectionId}
							{@const expanded = disclosed.has(item.sourceId)}
							<li
								class="item"
								class:revealed={item.revealed}
								class:excluded={!item.eligible}
								class:expanded
								data-source-id={item.sourceId}
							>
								<div class="item-head">
									<button
										type="button"
										class="item-row"
										use:locate={item.sourceId}
										aria-current={selected ? 'true' : undefined}
										aria-disabled={!item.eligible}
										aria-label={accessibleName(item)}
										title={item.eligible ? item.label : membershipLabel(item.membership)}
										onclick={() => {
											// An excluded subject stays focusable and locatable, but it is
											// not selectable: selection means "this is the subject now".
											if (!item.eligible) return;
											onSelect(item.sourceId);
										}}
									>
										<span class="item-kind">{item.kind}</span>
										<span class="item-name" class:generated={!item.authored}>{item.label}</span>
										{#if item.revealed}
											<span class="item-badge revealed-badge" aria-hidden="true">Revealed</span>
										{:else if !item.eligible}
											<span class="item-badge excluded-badge" aria-hidden="true">{membershipLabel(item.membership)}</span>
										{/if}
									</button>
									<button
										type="button"
										class="item-actions-toggle"
										aria-expanded={expanded}
										aria-controls={domId('plate-index-actions', item.sourceId)}
										aria-label={`Actions for ${item.label}`}
										onclick={() => toggleActions(item.sourceId)}
									>
										Actions
									</button>
								</div>

								{#if expanded}
									<div class="item-ops" id={domId('plate-index-actions', item.sourceId)}>
										<button type="button" class="op" onclick={() => openLocation(item.sourceId)}>
											Open location
										</button>
										<button
											type="button"
											class="op"
											disabled={!item.eligible}
											title={item.eligible
												? `Bring ${item.label} into view`
												: `${membershipLabel(item.membership)} — Reveal it to navigate to it`}
											onclick={() => onBringIntoView(item.sourceId)}
										>
											Bring into view
										</button>
										{#if item.membership !== 'included' || item.revealed}
											<button
												type="button"
												class="op op-reveal"
												onclick={() => onReveal(item.sourceId)}
											>
												{item.revealed ? 'Hide' : 'Reveal'}
											</button>
										{/if}
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		{/if}

	</div>
</nav>

<style>
	/*
	 * PLATE shell roles (shell-roles.css). The Index is a pale stone working surface
	 * at the role's density; no colour is introduced here.
	 */
	.plate-index {
		box-sizing: border-box;
		min-height: 0;
		display: flex;
		width: var(--shell-index-width, 256px);
		max-width: 100%;
		min-width: 0;
		flex-direction: column;
		border: 1px solid var(--shell-paper, #e9ebe6);
		border-radius: 0.5rem;
		background: var(--shell-index, #f5f6f4);
		color: var(--shell-forest, #11291f);
		font-family: var(--shell-sans, Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif);
		font-size: var(--shell-text-body, 13px);
	}

	.plate-index[hidden] { display: none; }

	.index-body[hidden] {
		display: none;
	}

	.index-body {
		min-height: 0;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.55rem;
	}

	.index-search {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.search-label {
		color: var(--shell-forest-raised, #22503c);
		font-size: var(--shell-text-utility, 12px);
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.search-input {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		min-height: var(--shell-control-height, 32px);
		padding: 0.3rem 0.45rem;
		border: 1px solid var(--shell-hairline, #2f4a3d);
		border-radius: 0.35rem;
		background: var(--shell-card, #ffffff);
		color: inherit;
		font: inherit;
		font-size: var(--shell-text-body, 13px);
	}

	.index-empty {
		margin: 0;
		color: var(--shell-forest-raised, #22503c);
		font-size: var(--shell-text-utility, 12px);
		line-height: 1.4;
	}

	.index-group {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.group-heading {
		margin: 0;
		color: var(--shell-forest-raised, #22503c);
		font-size: var(--shell-text-utility, 12px);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.group-items {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.item {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
		border: 1px solid transparent;
		border-radius: 0.4rem;
		background: var(--shell-card, #ffffff);
	}

	.item.revealed {
		border-style: dashed;
		border-color: var(--shell-hairline, #2f4a3d);
	}

	.item-head {
		display: flex;
		align-items: stretch;
		gap: 0.2rem;
		min-width: 0;
	}

	/* One line: the kind, the label (ellipsized, full in its title) and a badge. */
	.item-row {
		display: flex;
		align-items: center;
		flex: 1 1 auto;
		gap: 0.4rem;
		min-width: 0;
		min-height: var(--shell-control-height, 32px);
		padding: 0.2rem 0.4rem;
		border: 1px solid transparent;
		border-radius: 0.3rem;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.item-row:hover:not(:disabled) {
		background: var(--shell-paper, #e9ebe6);
	}

	/* Canonical selection: the gold contour and its gold ink, never a page flood. */
	.item-row[aria-current='true'] {
		border-color: var(--shell-gold, #d4ad45);
		box-shadow: inset 0 0 0 1px var(--shell-gold, #d4ad45);
		color: var(--shell-gold-ink, #74560c);
	}

	.item-row[aria-disabled='true'] {
		cursor: not-allowed;
		opacity: 0.72;
	}

	.op:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.item-kind {
		flex: none;
		color: var(--shell-forest-raised, #22503c);
		font-size: var(--shell-text-utility, 12px);
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.item-name {
		min-width: 0;
		flex: 1 1 auto;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* A generated `Kind n` reads as a quiet placeholder, never as an authored name. */
	.item-name.generated {
		color: var(--shell-forest-raised, #22503c);
		font-style: italic;
	}

	.item-badge {
		flex: none;
		padding: 0.05rem 0.3rem;
		border-radius: 999px;
		font-size: 0.64rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.revealed-badge {
		border: 1px solid var(--shell-hairline, #2f4a3d);
		color: var(--shell-forest, #11291f);
	}

	.excluded-badge {
		border: 1px solid var(--shell-paper, #e9ebe6);
		color: var(--shell-forest-raised, #22503c);
	}

	.item-actions-toggle {
		flex: none;
		min-height: var(--shell-control-height, 32px);
		padding: 0 0.45rem;
		border: 1px solid var(--shell-paper, #e9ebe6);
		border-radius: 0.3rem;
		background: var(--shell-index, #f5f6f4);
		color: var(--shell-forest-raised, #22503c);
		font: inherit;
		font-size: var(--shell-text-utility, 12px);
		cursor: pointer;
	}

	.item-actions-toggle[aria-expanded='true'] {
		border-color: var(--shell-hairline, #2f4a3d);
		color: var(--shell-forest, #11291f);
	}

	.item-ops {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		padding: 0 0.35rem 0.3rem;
	}

	.op {
		min-height: var(--shell-control-height, 32px);
		padding: 0.2rem 0.45rem;
		border: 1px solid var(--shell-hairline, #2f4a3d);
		border-radius: 0.3rem;
		background: var(--shell-index, #f5f6f4);
		color: var(--shell-forest, #11291f);
		font: inherit;
		font-size: var(--shell-text-utility, 12px);
		cursor: pointer;
	}

	.op:hover {
		background: var(--shell-paper, #e9ebe6);
	}

	.op-reveal {
		border-style: dashed;
	}

	/* Focus is an independent, non-hue cue (never the selection contour). */
	.item-row:focus-visible,
	.item-actions-toggle:focus-visible,
	.op:focus-visible,
	.search-input:focus-visible {
		outline: 2px solid var(--shell-forest-raised, #22503c);
		outline-offset: 2px;
	}

	@media (max-width: 720px) {
		.plate-index {
			width: 100%;
			max-width: none;
			max-height: 45%;
		}
	}
</style>

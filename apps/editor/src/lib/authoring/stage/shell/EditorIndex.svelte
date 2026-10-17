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
	let {
		open,
		onToggle,
		groups,
		contributions = [],
		selectionId,
		query,
		onQuery,
		onSelect,
		onBringIntoView,
		onReveal,
		onInvokeContribution = () => {}
	}: {
		open: boolean;
		onToggle: () => void;
		groups: readonly {
			id: string;
			label: string;
			items: readonly {
				sourceId: string;
				label: string;
				kind: string;
				eligible: boolean;
				/** The evaluator's own revealed flag: Reveal keeps the declared reason. */
				revealed: boolean;
				membership: string;
			}[];
		}[];
		/**
			* Contributed rail-family / capability-Find entries, from whatever adapters
			* are registered. The Index renders them generically: a domain adapter never
			* edits this component to appear here.
			*/
		contributions?: readonly {
			id: string;
			label: string;
			family: string;
			capability: string;
			entries: readonly { id: string; label: string; adapterId: string; taskKind: string }[];
		}[];
		selectionId: string | null;
		query: string;
		onQuery: (query: string) => void;
		onSelect: (sourceId: string) => void;
		onBringIntoView: (sourceId: string) => void;
		onReveal: (sourceId: string) => void;
		onInvokeContribution?: (adapterId: string, id: string) => void;
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

	/** Only non-empty groups are rendered, and a group with items is never hidden. */
	const visibleGroups = $derived(
		groups.filter((group) => group.items.length > 0)
	);

	const items = $derived(visibleGroups.flatMap((group) => group.items));
	const hasItems = $derived(items.length > 0);

	const selectedLabel = $derived(
		selectionId === null ? null : (items.find((item) => item.sourceId === selectionId)?.label ?? null)
	);

	const searchedNothing = $derived(query.trim() !== '' && !hasItems);

	const KIND_LABELS: Record<string, string> = {
		wall: 'Wall',
		opening: 'Opening',
		object: 'Object',
		'room-floor': 'Floor'
	};

	const MEMBERSHIP_LABELS: Record<string, string> = {
		included: 'In the current Plan',
		'filtered-type': 'Hidden by the source-kind filter',
		'outside-depth': 'Below the Plan depth',
		'outside-span': 'Outside the Plan lateral span',
		'no-meaningful-projection': 'No meaningful projection'
	};

	function kindLabel(kind: string): string {
		return KIND_LABELS[kind] ?? kind;
	}

	function membershipLabel(membership: string): string {
		return MEMBERSHIP_LABELS[membership] ?? membership;
	}
</script>

<nav
	class="plate-index"
	aria-label="Project locator"
	data-plate-landmark="index"
	class:collapsed={!open}
>
	<div class="index-head">
		<button
			type="button"
			class="index-toggle"
			aria-expanded={open}
			aria-controls="plate-index-body"
			onclick={onToggle}
		>
			<span class="index-title">Index</span>
			<span class="index-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
		</button>
		{#if !open}
			<p class="collapsed-selection" aria-live="polite">
				{#if selectedLabel !== null}
					Selected: <strong>{selectedLabel}</strong>
				{:else}
					No selection
				{/if}
			</p>
		{/if}
	</div>

	<div id="plate-index-body" class="index-body" hidden={!open}>
		<div class="index-search">
			<label class="search-label" for="plate-index-search">Find a subject</label>
			<input
				id="plate-index-search"
				type="search"
				class="search-input"
				placeholder="Search walls, openings, objects…"
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
							<li class="item" class:revealed={item.revealed} class:excluded={!item.eligible}>
								<button
									type="button"
									class="item-row"
									use:locate={item.sourceId}
									aria-current={selected ? 'true' : undefined}
									aria-disabled={!item.eligible}
									title={item.eligible ? item.label : membershipLabel(item.membership)}
									onclick={() => {
										// An excluded subject stays focusable and locatable, but it is
										// not selectable: selection means "this is the subject now".
										if (!item.eligible) return;
										onSelect(item.sourceId);
									}}
								>
									<span class="item-kind">{kindLabel(item.kind)}</span>
									<span class="item-name">{item.label}</span>
									{#if item.revealed}
										<span class="item-badge revealed-badge">Revealed</span>
									{:else if !item.eligible}
										<span class="item-badge excluded-badge">{membershipLabel(item.membership)}</span>
									{/if}
								</button>

								<div class="item-ops">
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
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		{/if}

		<!-- Contributed operations: whatever registered adapters offer, grouped by
		     their declared rail family and capability. Nothing is listed when no adapter
		     contributes, so the Index stays a locator rather than a menu of unknowns. -->
		{#each contributions as group (group.id)}
			<section
				class="index-group contributed-group"
				aria-labelledby={`plate-index-contributed-${group.id}`}
				data-contributed-family={group.family}
				data-contributed-capability={group.capability}
			>
				<h3 class="group-heading" id={`plate-index-contributed-${group.id}`}>{group.label}</h3>
				<ul class="group-items">
					{#each group.entries as entry (JSON.stringify([entry.adapterId, entry.id]))}
						<li class="item contributed-item" data-contributed-adapter={entry.adapterId}>
							<button
								type="button"
								class="item-row"
								title={`${entry.label} — contributed by ${entry.adapterId}`}
								onclick={() => onInvokeContribution(entry.adapterId, entry.id)}
							>
								<span class="item-kind">Task</span>
								<span class="item-name">{entry.label}</span>
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
</nav>

<style>
	/* Chassis (quiet neutral / pale stone). The Index locates identity; it never
	   borrows the selection gold as its own surface. */
	.plate-index {
		box-sizing: border-box;
		min-height: 0;
		display: flex;
		width: 100%;
		min-width: 0;
		max-width: 22rem;
		flex-direction: column;
		border: 1px solid #d8dcd6;
		border-radius: 0.5rem;
		background: #f5f6f4;
		color: #1b201c;
		font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
	}

	.index-head {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.6rem 0.7rem;
		border-bottom: 1px solid #e2e5df;
	}

	.plate-index.collapsed .index-head {
		border-bottom: none;
	}

	.index-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-height: 2.5rem;
		padding: 0.35rem 0.4rem;
		border: 1px solid transparent;
		border-radius: 0.35rem;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.index-toggle:hover {
		background: #e9ebe6;
	}

	.index-title {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #4b5349;
	}

	.index-chevron {
		font-size: 0.8rem;
		color: #6b7466;
	}

	.collapsed-selection {
		margin: 0;
		padding: 0 0.4rem 0.2rem;
		overflow: hidden;
		color: #4b5349;
		font-size: 0.78rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.index-body[hidden] {
		display: none;
	}

	.index-body {
		min-height: 0;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.7rem;
	}

	.index-search {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.search-label {
		color: #6b7466;
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.search-input {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		padding: 0.4rem 0.5rem;
		border: 1px solid #c9cec5;
		border-radius: 0.35rem;
		background: #ffffff;
		color: inherit;
		font: inherit;
		font-size: 0.85rem;
	}

	.index-empty {
		margin: 0;
		color: #6b7466;
		font-size: 0.82rem;
		line-height: 1.4;
	}

	.index-group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.group-heading {
		margin: 0;
		color: #6b7466;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.group-items {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.3rem;
		border: 1px solid transparent;
		border-radius: 0.4rem;
		background: #ffffff;
	}

	.item.revealed {
		border-style: dashed;
		border-color: #b9c3b3;
		background: #fbfcf9;
	}

	.item-row {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		width: 100%;
		min-height: 2.5rem;
		padding: 0.35rem 0.4rem;
		border: 1px solid transparent;
		border-radius: 0.3rem;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.item-row:hover:not(:disabled) {
		background: #eef1ec;
	}

	.item-row[aria-current='true'] {
		border-color: #d4ad45;
		box-shadow: inset 0 0 0 1px #d4ad45;
		background: #fdf7e6;
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
		color: #6b7466;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.item-name {
		min-width: 0;
		flex: 1 1 auto;
		overflow: hidden;
		font-size: 0.85rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-badge {
		flex: none;
		padding: 0.1rem 0.35rem;
		border-radius: 999px;
		font-size: 0.64rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.revealed-badge {
		border: 1px solid #6a7c63;
		color: #43503d;
	}

	.excluded-badge {
		border: 1px solid #c9cec5;
		color: #6b7466;
	}

	.item-ops {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		padding: 0 0.4rem 0.15rem;
	}

	.op {
		padding: 0.28rem 0.45rem;
		border: 1px solid #cfd4cb;
		border-radius: 0.3rem;
		background: #f5f6f4;
		color: #3c4239;
		font: inherit;
		font-size: 0.72rem;
		cursor: pointer;
	}

	.op:hover {
		border-color: #6a7c63;
		background: #e9ebe6;
	}

	.op-reveal {
		border-color: #a9b6a2;
	}

	/* Focus is an independent, non-hue cue (never the selection contour). */
	.index-toggle:focus-visible,
	.item-row:focus-visible,
	.op:focus-visible,
	.search-input:focus-visible {
		outline: 2px solid #2f6b4f;
		outline-offset: 2px;
	}

	@media (max-width: 720px) {
		.plate-index {
			max-width: none;
			max-height: 45%;
		}
	}
</style>

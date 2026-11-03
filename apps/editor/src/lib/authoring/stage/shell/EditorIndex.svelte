<script lang="ts">
	/** Ephemeral scope locator over accepted source relationships. Selection, scope and Camera requests stay distinct. */
	import { membershipLabel } from './index-labels';

	import ShellIcon from './ShellIcon.svelte';
	import { worldScopeRows, type WorldScope, type WorldIndexModel } from './world-index-model';
	import type { ExperienceIndexGroups } from './experience-index-groups';
	let {
		open,
		model,
		scope,
		onScope,
		onClose = () => {},
		selectionId,
		query,
		onQuery,
		onSelect,
		onBringIntoView,
		onReveal,
		onRename = () => {},
		experience = null
	}: {
		open: boolean;
		model: WorldIndexModel;
		scope: WorldScope;
		onScope: (scope: WorldScope) => void;
		onClose?: () => void;
		selectionId: string | null;
		query: string;
		onQuery: (q: string) => void;
		onSelect: (id: string) => void;
		onBringIntoView: (id: string) => void;
		onReveal: (id: string) => void;
		/** Double-click on a row renames through the selected subject's Card writer. */
		onRename?: (id: string) => void;
		/**
		 * R217.S25: the Experience lens's groups. When present the Index shows them in place
		 * of the World locator: the Presentations list with its filter and empty-state
		 * create, and the Guide that opens the lower-edge instrument. Same crumbs and rows.
		 */
		experience?: ExperienceIndexGroups | null;
	} = $props();
	let facet = $state('all');
	let limit = $state(40);
	const result = $derived(worldScopeRows(model, scope, facet, query, limit));
	const current = $derived(model.contexts.find((c) => c.id === scope) ?? model.contexts[0]!);
	const crumbs = $derived(
		model.contexts.filter(
			(c) => c.id === 'project' || c.id === scope
		)
	);
	const siblings = $derived(
		model.contexts.filter((c) => c.parent === current.parent && c.id !== scope)
	);
	const facets = $derived([
		...new Set(
			model.rows
				.filter((r) => scope === 'project' || r.relations.includes(scope))
				.map((r) => r.group)
		)
	]);
	$effect(() => {
		void scope;
		void query;
		void facet;
		limit = 40;
	});

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



	/** The row's accessible name: the kind, the full label and the canonical identity. */
	function accessibleName(item: {
		kind: string;
		label: string;
		sourceId: string;
		revealed: boolean;
		eligible: boolean;
		membership: string;
	}): string {
		const badge = item.revealed
			? 'Revealed'
			: !item.eligible
				? membershipLabel(item.membership)
				: '';
		return `${item.kind} ${item.label}.${badge === '' ? '' : ` ${badge}.`}`;
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
	{#if open}
		{#if experience}
		<div class="index-search">
			<label
				><ShellIcon name="search" size={15} />
				<input
					id="plate-index-search"
					type="search"
					aria-label="Filter presentations"
					placeholder="Filter presentations"
					value={experience.query}
					oninput={(e) => experience.onQuery(e.currentTarget.value)}
				/>
			</label><button type="button" aria-label="Hide Index" onclick={onClose}
				><ShellIcon name="chevronLeft" size={15} /></button
			>
		</div>
		<div class="crumbs" role="group" aria-label="Experience">
			{#if experience.current !== null}
				<span class="crumb" aria-current="location">{experience.current.label}</span>
				{#if experience.experiences.length > 1}<details class="siblings">
						<summary aria-label="Switch Experience"
							><ShellIcon name="chevronDown" size={12} /></summary
						>
						<div>
							{#each experience.experiences.filter((entry) => entry.id !== experience.current?.id) as entry (entry.id)}<button
									type="button"
									onclick={(event) => { experience.onOpenExperience(entry.id); event.currentTarget.closest('details')?.removeAttribute('open'); }}>{entry.label}</button
								>{/each}
						</div>
					</details>{/if}
			{:else}
				<span class="index-empty">No Experience yet</span>
			{/if}
		</div>
		<section class="group" aria-labelledby="index-presentations">
			<h3 id="index-presentations" class="group-title">Presentations</h3>
			{#if experience.pending}
				<p class="index-empty">The Experience lens mounts with the admitted project source.</p>
			{:else if experience.current === null}
				<p class="index-empty">
					This world has no Experience yet. Creating one is explicit: selecting or editing a world subject never creates it.
				</p>
			{:else}
				<ul class="group-items">
					{#each experience.presentations as presentation (presentation.id)}
						<li class="item" class:selected={presentation.selected} data-presentation-id={presentation.id}>
							<button
								type="button"
								class="item-row"
								aria-current={presentation.selected ? 'true' : undefined}
								aria-label={`Presentation ${presentation.label}`}
								onclick={() => experience.onSelectPresentation(presentation.id)}
								ondblclick={() => {
									experience.onSelectPresentation(presentation.id);
									onRename(presentation.id);
								}}
							>
								<ShellIcon name="camera" size={16} />
								<span class="item-name">{presentation.label}</span>
							</button>
						</li>
					{:else}
						<li class="index-empty">
							{experience.query.trim() === ''
								? 'No Presentation yet. Capture a View to make one.'
								: 'No Presentation matches this filter.'}
						</li>
					{/each}
				</ul>
			{/if}
			{#if !experience.pending}
				<div class="group-action">
					<button type="button" onclick={experience.onCreateExperience} disabled={experience.busy}>Create Experience</button>
				</div>
			{/if}
		</section>
		{#if experience.current !== null && experience.guide !== null}
			<section class="group" aria-labelledby="index-guide">
				<h3 id="index-guide" class="group-title">Guide</h3>
				<button
					type="button"
					class="guide-toggle"
					aria-expanded={experience.guide.open}
					onclick={experience.onToggleGuide}
				>
					<ShellIcon name="guide" size={16} />
					<span class="item-name">{experience.guide.label ?? 'No Guide yet'}</span>
				</button>
			</section>
		{/if}
		{:else}
		<div class="index-search">
			<label
				><ShellIcon name="search" size={15} />
				<input
					id="plate-index-search"
					type="search"
					aria-label="Filter places and things"
					placeholder="Filter places and things"
					value={query}
					oninput={(e) => onQuery(e.currentTarget.value)}
				/>
			</label><button type="button" aria-label="Hide Index" onclick={onClose}
				><ShellIcon name="chevronLeft" size={15} /></button
			>
		</div>
		<div class="crumbs" role="group" aria-label="Location">
			{#each crumbs as crumb (crumb.id)}<button
					type="button"
					aria-current={scope === crumb.id ? 'location' : undefined}
					onclick={() => onScope(crumb.id)}>{crumb.label}</button
				>{#if crumb.id !== scope}<ShellIcon name="chevronRight" size={12} />{/if}{/each}
			{#if siblings.length}<details class="siblings">
					<summary aria-label="Switch sibling location"
						><ShellIcon name="chevronDown" size={12} /></summary
					>
					<div>
						{#each siblings as sibling (sibling.id)}<button
								type="button"
								onclick={(event) => { onScope(sibling.id); event.currentTarget.closest('details')?.removeAttribute('open'); }}>{sibling.label}</button
							>{/each}
					</div>
				</details>{/if}
		</div>
		<div class="facets" role="group" aria-label="Subject kinds">
			<button type="button" aria-pressed={facet === 'all'} onclick={() => (facet = 'all')}
				>All</button
			>{#each facets as kind}<button
					type="button"
					aria-label={kind.replace('-', ' ')}
					title={kind.replace('-', ' ')}
					aria-pressed={facet === kind}
					onclick={() => (facet = kind)}
					><ShellIcon
						name={kind === 'wall'
							? 'wall'
							: kind === 'opening'
								? 'opening'
								: kind === 'scene'
									? 'object'
									: 'plan'}
						size={16}
					/></button
				>{/each}
		</div>

		{#if scope === 'project' && model.rows.some(row => row.relations.includes('free'))}
			<button type="button" class="floor-scope" onclick={() => onScope('free')}><ShellIcon name="object" size={16} />Free objects <ShellIcon name="chevronRight" size={15} /></button>
		{/if}
		<ul class="group-items">
			{#each result.rows as item (item.sourceId)}
				<li
					class="item"
					data-source-id={item.sourceId}
					class:selected={selectionId === item.sourceId}
				>
					<div class="item-head">
						<button
							type="button"
							class="item-row"
							use:locate={item.sourceId}
							aria-current={selectionId === item.sourceId ? 'true' : undefined}
							aria-disabled={!item.eligible}
							aria-label={accessibleName(item)}
							title={item.eligible ? item.label : membershipLabel(item.membership)}
							onclick={() => {
								if (item.eligible) onSelect(item.sourceId);
							}}
							ondblclick={() => {
								if (!item.eligible) return;
								onSelect(item.sourceId);
								onRename(item.sourceId);
							}}
						>
							<ShellIcon
								name={item.group === 'wall'
									? 'wall'
									: item.group === 'opening'
										? 'opening'
										: item.group === 'scene'
											? 'object'
											: 'plan'}
								size={16}
							/>
							<span class="item-name" class:generated={!item.authored}>{item.label}</span>
							{#if item.revealed || !item.eligible}
								<span class="badge"
									>{item.revealed ? 'Revealed' : membershipLabel(item.membership)}</span
								>
							{/if}
						</button>
						{#if item.membership !== 'included' || item.revealed}
							<button type="button" class="item-actions-toggle" aria-label={`${item.revealed ? 'Hide' : 'Reveal'} ${item.label}`} onclick={() => onReveal(item.sourceId)}><ShellIcon name="eye" size={15} /></button>
						{/if}
						{#if item.context}<button
								type="button"
								class="scope-entry"
								aria-label={`Go into ${item.label}`}
								onclick={() => onScope(item.context!)}
								><span class="room-count">{worldScopeRows(model, item.context!, 'all', '', Number.MAX_SAFE_INTEGER).rows.filter(row => row.context !== item.context).length}</span><ShellIcon name="chevronRight" size={15} /></button
							>{/if}
					</div>

				</li>
			{/each}
		</ul>
		{#if result.total > result.rows.length}<button type="button" onclick={() => (limit += 40)}
				>Show more ({result.total - result.rows.length})</button
			>{:else if result.total === 0}<p class="index-empty">No matching subjects</p>{/if}
		{/if}
	{/if}
</nav>

<style>
	.plate-index {
		display: flex;
		flex-direction: column;
		width: var(--shell-index-width, 256px);
		min-width: 0;
		min-height: 0;
		overflow: auto;
		border-right: 1px solid var(--shell-hairline, #e1e4de);
		background: var(--shell-index, #f6f7f5);
		color: var(--shell-ink, #1b201c);
		font: 13px/1.35 var(--shell-sans, system-ui);
	}

	.plate-index[hidden] {
		display: none;
	}
	button {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		min-height: 26px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	button:hover {
		background: var(--shell-hover, #eef0ed);
	}

	.index-search {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px 6px 6px 8px;
	}
	.index-search label {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
		height: 28px;
		padding: 0 7px;
		background: #fff;
		border: 1px solid var(--shell-hairline, #e1e4de);
		border-radius: 7px;
		color: var(--shell-ink-3, #79817b);
	}
	input {
		min-width: 0;
		width: 100%;
		border: 0;
		background: none;
		color: var(--shell-ink, #1b201c);
		font: 12px var(--shell-sans, system-ui);
	}

	.crumbs {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 3px;
		padding: 0 10px 6px;
		font-size: 12px;
	}
	.crumbs button {
		padding: 2px 4px;
	}
	.crumbs [aria-current] {
		font-weight: 600;
	}
	.siblings {
		position: relative;
	}
	.siblings summary {
		cursor: pointer;
		list-style: none;
	}

	.siblings div {
		position: absolute;
		z-index: 30;
		top: 24px;
		left: -80px;
		width: 180px;
		display: grid;
		padding: 6px;
		background: white;
		border: 1px solid var(--shell-hairline, #e1e4de);
		border-radius: 8px;
		box-shadow: var(--shell-shadow);
	}

	.facets {
		display: flex;
		gap: 2px;
		margin: 0 8px 4px;
		padding: 2px;
		border-radius: 7px;
		background: #eaede7;
	}
	.facets button {
		flex: 1;
		justify-content: center;
		height: 24px;
		min-height: 24px;
		padding: 0 4px;
		color: var(--shell-ink-3, #79817b);
	}
	.facets [aria-pressed='true'] {
		background: #fff;
		color: var(--shell-ink, #1b201c);
		box-shadow: 0 1px 2px #0002;
	}
	.group-items {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.item-head {
		display: flex;
		align-items: center;
	}
	.item-row {
		flex: 1;
		min-width: 0;
		min-height: 28px;
		padding: 4px 6px 4px 10px;
		border-radius: 0;
		text-align: left;
	}

	.item-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.item.selected {
		background: var(--shell-gold-tint, #f8efd6);
	}
	.item.selected .item-name {
		font-weight: 600;
	}

	.item-actions-toggle {
		opacity: 0;
		padding: 0;
		width: 26px;
		justify-content: center;
	}
	.item:hover .item-actions-toggle,
	.item:focus-within .item-actions-toggle {
		opacity: 1;
	}
	.scope-entry {
		min-width: 40px;
		justify-content: center;
		padding: 0;
		margin-right: 4px;
	}

	.badge {
		font-size: 10px;
		color: var(--shell-ink-3, #79817b);
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: 6px;
	}
	.group-title {
		margin: 0;
		padding: 6px 10px 2px;
		color: var(--shell-ink-3, #79817b);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.group-action {
		padding: 4px 10px 8px;
	}
	.item > .item-row,
	.guide-toggle {
		width: 100%;
		min-height: 28px;
		padding: 4px 10px;
		border-radius: 0;
		text-align: left;
	}
	/* An open Guide is a neutral state, not the gold selection role the Presentation row uses. */
	.guide-toggle[aria-expanded='true'] {
		background: var(--shell-hover, #eef0ed);
		font-weight: 600;
	}
	.index-empty {
		padding: 10px;
		font-size: 12px;
		color: var(--shell-ink-3, #79817b);
	}
	@media (pointer: coarse) {
		button,
		.facets button,
		.index-search label,
		input {
			min-height: 44px;
		}
		.item-actions-toggle,
		.scope-entry {
			min-width: 44px;
			opacity: 1;
		}
		.facets {
			flex-wrap: wrap;
		}
		.facets button {
			min-width: 44px;
		}
	}
</style>

<script lang="ts">
	/** Ephemeral scope locator over accepted source relationships. Selection, scope and Camera requests stay distinct. */
	import { membershipLabel } from './index-labels';

	import ShellIcon from './ShellIcon.svelte';
	import { worldScopeRows, type WorldScope, type WorldIndexModel } from './world-index-model';
	import type { ExperienceIndexGroups } from './experience-index-groups';
	import ExperienceSnapshot from '$lib/authoring/experience/ExperienceSnapshot.svelte';
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
		 * of the World locator: the Experience crumb with its sibling menu, the Guides, and the
		 * Presentations with their Views. Same Index shell and rows.
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

	/* R217.S26 — the Experience crumb's inline rename: Enter or blur commits, Esc cancels. */
	let renamingExperience = $state(false);
	let experienceDraft = $state('');
	let renameBusy = $state(false);
	let renameError = $state<string | null>(null);
	function startExperienceRename(): void {
		if (!experience?.current) return;
		experienceDraft = experience.current.label;
		renameError = null;
		renamingExperience = true;
	}
	async function commitExperienceName(): Promise<void> {
		if (!experience || renameBusy || !renamingExperience) return;
		renameBusy = true;
		try {
			const outcome = await experience.onRenameExperience(experienceDraft);
			if (outcome.kind === 'accepted') {
				renamingExperience = false;
				renameError = null;
			} else {
				renameError = outcome.message ?? 'The name was not accepted.';
			}
		} finally {
			renameBusy = false;
		}
	}
	function focusSelect(input: HTMLInputElement) {
		input.focus();
		input.select();
	}

	/** A Presentation row's Stop numbers: the first three, then how many follow. */
	function stopsLabel(numbers: readonly number[]): string {
		const shown = numbers.slice(0, 3).join(', ');
		return numbers.length > 3 ? `${shown} +${numbers.length - 3}` : shown;
	}

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
					aria-label="Find a Presentation or View"
					placeholder="Find a Presentation or View"
					value={experience.query}
					oninput={(e) => experience.onQuery(e.currentTarget.value)}
				/>
			</label>
			<button type="button" class="hide-index" aria-label="Hide Index" onclick={onClose}
				><ShellIcon name="chevronLeft" size={15} /></button
			>
		</div>
		<div class="crumbs" role="group" aria-label="Experience">
			{#if experience.current !== null && renamingExperience}
				<input
					class="crumb-input"
					aria-label="Experience name"
					value={experienceDraft}
					disabled={renameBusy}
					use:focusSelect
					oninput={(event) => (experienceDraft = event.currentTarget.value)}
					onblur={() => { if (!renameBusy) void commitExperienceName(); }}
					onkeydown={(event) => {
						if (event.key === 'Enter') { event.preventDefault(); void commitExperienceName(); }
						else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); renamingExperience = false; renameError = null; }
					}}
				/>
			{:else if experience.current !== null}
				<span class="crumb" aria-current="location">{experience.current.label}</span>
			{:else}
				<span class="index-empty">No Experience yet</span>
			{/if}
			<details class="siblings">
				<summary aria-label="Switch or create Experience"
					><ShellIcon name="chevronDown" size={12} /></summary
				>
				<div>
					{#if experience.current !== null}<button
							type="button"
							class="menu-rename"
							disabled={experience.busy}
							onclick={(event) => { startExperienceRename(); event.currentTarget.closest('details')?.removeAttribute('open'); }}>Rename…</button
						>{/if}
					{#each experience.experiences.filter((entry) => entry.id !== experience.current?.id) as entry (entry.id)}<button
							type="button"
							onclick={(event) => { experience.onOpenExperience(entry.id); event.currentTarget.closest('details')?.removeAttribute('open'); }}>{entry.label}</button
						>{/each}
					<button
						type="button"
						class="menu-create"
						disabled={experience.busy}
						onclick={(event) => { experience.onCreateExperience(); event.currentTarget.closest('details')?.removeAttribute('open'); }}>New Experience</button
					>
				</div>
			</details>
		</div>
		{#if renameError}<p class="crumb-error" role="alert">{renameError}</p>{/if}
		<section class="group" aria-labelledby="index-presentations">
			<h3 id="index-presentations" class="group-title">
				Presentations <span class="count">{experience.totalPresentations}</span>
			</h3>
			{#if experience.pending}
				<p class="index-empty">The Experience lens mounts with the admitted project source.</p>
			{:else if experience.current === null}
				<p class="index-empty">Create an Experience from the menu above to start presenting.</p>
			{:else if experience.presentations.length === 0}
				<p class="index-empty">
					{experience.query.trim() === ''
						? 'Nothing presented yet. Select an object and choose Present this, or press Capture in the dock.'
						: `Nothing matches "${experience.query.trim()}".`}
				</p>
			{:else}
				<ul class="group-items">
					{#each experience.presentations as presentation (presentation.id)}
						<li class="item" data-presentation-id={presentation.id}>
							<!-- Only the Presentation's own row carries its selection; its Views keep their own. -->
							<div class="item-head" class:selected={presentation.selected}>
								<button
									type="button"
									class="item-row presentation-row"
									draggable="true"
									aria-current={presentation.selected ? 'true' : undefined}
									aria-label={`Presentation ${presentation.label}`}
									ondragstart={(event) => {
										if (!event.dataTransfer) return;
										event.dataTransfer.setData('application/x-biskiq-presentation', presentation.id);
										event.dataTransfer.effectAllowed = 'copy';
									}}
									onclick={() => experience.onSelectPresentation(presentation.id)}
									ondblclick={() => {
										experience.onSelectPresentation(presentation.id);
										onRename(presentation.id);
									}}
								>
									<ExperienceSnapshot label={presentation.label} ratio="row" selected={presentation.selected} />
									<span class="item-text">
										<span class="item-name">{presentation.label}</span>
										<span class="item-meta"
											>{presentation.viewCount} {presentation.viewCount === 1 ? 'View' : 'Views'} · {#if presentation.stopNumbers.length > 0}Stops {stopsLabel(presentation.stopNumbers)}{:else}<span class="free-tag">free</span>{/if}</span
										>
									</span>
								</button>
								<button
									type="button"
									class="twist"
									aria-expanded={presentation.expanded}
									aria-label={`${presentation.expanded ? 'Hide' : 'Show'} Views of ${presentation.label}`}
									disabled={presentation.views.length === 0}
									onclick={() => experience.onToggleExpand(presentation.id)}
								>
									<ShellIcon name={presentation.expanded ? 'chevronDown' : 'chevronRight'} size={12} />
								</button>
							</div>
							{#if presentation.expanded}
								<ul class="view-list">
									{#each presentation.views.slice(0, 8) as view (view.id)}
										<li>
											<button
												type="button"
												class="view-row"
												class:selected={view.selected}
												aria-current={view.selected ? 'true' : undefined}
												aria-label={`${view.label}, ${view.onTour ? 'on tour' : 'free'}${view.isDefault ? ', Default View' : ''}`}
												onclick={() => experience.onSelectView(view.id, presentation.id)}
											>
												<span class="tour-mark" class:on={view.onTour} aria-hidden="true"></span>
												<span class="view-name">{view.label}</span>
												{#if view.isDefault}<span class="default-mark" title="Default View" aria-hidden="true">◆</span>{/if}
											</button>
										</li>
									{/each}
									{#if presentation.views.length > 8}
										<li>
											<button type="button" class="view-more" onclick={() => experience.onSelectPresentation(presentation.id)}>+{presentation.views.length - 8} more — see all in the Card</button>
										</li>
									{/if}
								</ul>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
		<!-- Round 2 order: the Presentations, then the Guides that order them. -->
		{#if !experience.pending && experience.current !== null}
			<section class="group" aria-labelledby="index-guides">
				<h3 id="index-guides" class="group-title">Guides</h3>
				{#each experience.guides as guide (guide.id)}
					<div class="item" class:selected={guide.selected} class:open={guide.open} data-guide-id={guide.id}>
						<button
							type="button"
							class="guide-row"
							aria-current={guide.selected ? 'true' : undefined}
							onclick={() => experience.onOpenGuide(guide.id)}
						>
							<ShellIcon name="guide" size={15} />
							<span class="item-text">
								<span class="item-name">{guide.label}</span>
								<span class="item-meta">{guide.stopCount} stops</span>
							</span>
							{#if guide.opening}<span class="opens-tag" data-opening-guide>opens</span>{/if}
							{#if guide.open}<span class="chip">Open</span>{/if}
						</button>
					</div>
				{:else}
					<div class="item">
						<button type="button" class="guide-row" onclick={() => experience.onOpenGuide(null)}>
							<ShellIcon name="guide" size={15} />
							<span class="item-text">
								<span class="item-name muted">No Guide yet</span>
							</span>
						</button>
					</div>
				{/each}
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
	/* R217.S26: the crumb's inline rename uses the crumb's own metrics. */
	.crumb-input {
		box-sizing: border-box;
		min-width: 0;
		flex: 1 1 auto;
		padding: 1px 4px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 5px;
		font: 600 12px/1.3 var(--shell-sans, system-ui);
		color: inherit;
	}
	.crumb-error {
		margin: -2px 10px 6px;
		color: var(--shell-refuse, #7e2718);
		font-size: 11.5px;
	}
	.opens-tag {
		flex: none;
		padding: 0 4px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 3px;
		color: var(--shell-ink-2, #4a524c);
		font: 500 10px/1.5 var(--shell-mono, ui-monospace, monospace);
		letter-spacing: 0.02em;
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
	.item.selected,
	.item-head.selected {
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
	}
	/* Round 2 igroup: 10 px uppercase labels. */
	.group-title {
		margin: 0;
		padding: 8px 10px 2px 12px;
		color: var(--shell-ink-3, #79817b);
		font: 600 10px var(--shell-sans, system-ui);
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}
	.index-search .hide-index {
		margin-left: auto;
	}
	.siblings div button {
		width: 100%;
		min-height: 28px;
		justify-content: flex-start;
	}
	.siblings div .menu-create {
		margin-top: 4px;
		border-top: 1px solid var(--shell-hairline, #e1e4de);
		border-radius: 0 0 6px 6px;
	}
	.siblings div button:disabled {
		background: transparent;
		color: var(--shell-ink-3, #79817b);
		cursor: default;
	}
	.group-title .count {
		margin-left: 4px;
		letter-spacing: 0;
	}
	.item-text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.item-meta {
		overflow: hidden;
		color: var(--shell-ink-3, #79817b);
		font-size: 11px;
		line-height: 1.3;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.item-name.muted {
		color: var(--shell-ink-3, #79817b);
	}
	.free-tag {
		padding: 0 4px;
		border: 1px dashed var(--shell-hairline-strong, #cdd2ca);
		border-radius: 4px;
		font-size: 10px;
	}
	.chip {
		flex: none;
		padding: 0 6px;
		border: 1px solid var(--shell-leaf, #4f8f6c);
		border-radius: 999px;
		background: #fff;
		color: var(--shell-forest-3, #2d5e48);
		font-size: 10px;
		line-height: 15px;
		font-weight: 600;
	}
	/* An open Guide is a leaf state; the gold role stays with selection alone. */
	.item.open:not(.selected) {
		background: var(--shell-leaf-tint, #e7f1ea);
	}
	/* Round 2 irow: one 28 px line, the stop count on the right. */
	.guide-row {
		width: 100%;
		min-height: 28px;
		padding: 4px 6px 4px 10px;
		gap: 7px;
		border-radius: 0;
		text-align: left;
	}
	.guide-row .item-text {
		flex-direction: row;
		align-items: center;
		gap: 7px;
	}
	.guide-row .item-name {
		flex: 1;
	}
	.guide-row .item-meta {
		flex: none;
	}
	/* Selecting a Presentation opens its Views (Round 2); the twist only reveals on hover or focus. */
	.twist {
		flex: none;
		width: 26px;
		height: 26px;
		margin-right: 4px;
		padding: 0;
		justify-content: center;
		border-radius: 6px;
		color: var(--shell-ink-3, #79817b);
		opacity: 0;
	}
	.item-head:hover .twist:enabled,
	.twist:focus-visible {
		opacity: 1;
	}
	.twist:hover {
		background: rgb(0 0 0 / 0.07);
		color: var(--shell-ink, #1b201c);
	}
	.twist:disabled {
		visibility: hidden;
	}
	.presentation-row {
		min-height: 28px;
		padding: 4px 6px 4px 10px;
		gap: 7px;
		cursor: grab;
	}
	/* Round 2 Index rows read in the sans at 13 px; only the selected row is bold. */
	.presentation-row .item-name {
		font: 400 13px/1.35 var(--shell-sans, system-ui);
	}
	.item-head.selected .item-name {
		font-weight: 600;
	}
	.view-list {
		display: grid;
		gap: 0;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Round 2 nested irow: 14 px indent, then the row's own 10 px. */
	.view-row {
		width: 100%;
		min-height: 28px;
		padding: 4px 6px 4px 24px;
		gap: 7px;
		border-radius: 0;
		text-align: left;
		color: var(--shell-ink, #1b201c);
		font-size: 13px;
	}
	.view-row:hover {
		background: rgb(0 0 0 / 0.035);
	}
	.view-row.selected {
		background: var(--shell-gold-tint, #f8efd6);
		font-weight: 600;
	}
	.view-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tour-mark {
		flex: none;
		width: 8px;
		height: 8px;
		/* Sits in the 14 px icon slot of a Round 2 row. */
		margin: 0 3px;
		border: 1.5px solid var(--shell-ink-3, #79817b);
		border-radius: 50%;
	}
	.tour-mark.on {
		border-color: var(--shell-leaf, #4f8f6c);
		background: var(--shell-leaf, #4f8f6c);
	}
	.default-mark {
		flex: none;
		color: var(--shell-ink-3, #79817b);
		font-size: 10px;
	}
	.view-more {
		width: 100%;
		min-height: 28px;
		padding: 3px 6px 3px 24px;
		border-radius: 6px;
		color: var(--shell-ink-3, #79817b);
		font-size: 12px;
		text-align: left;
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

<script lang="ts">
	/** Ephemeral scope locator over accepted source relationships. Selection, scope and Camera requests stay distinct. */
	import { tick, untrack } from 'svelte';
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
	const result = $derived(worldScopeRows(model, scope, query.trim() ? 'all' : facet, query, limit));
	const project = $derived(model.contexts[0]!);
	const location = $derived(model.contexts.find((context) => context.id === scope));
	const locations = $derived(model.contexts.filter((context) => context.parent === 'project'));
	let locationsOpen = $state(false);
	function changeScope(next: WorldScope): void {
		locationsOpen = false;
		facet = 'all';
		onScope(next);
	}

	const kinds = [
		{ id: 'room-floor', label: 'Rooms', icon: 'plan' },
		{ id: 'wall', label: 'Walls', icon: 'wall' },
		{ id: 'opening', label: 'Openings', icon: 'opening' },
		{ id: 'objects', label: 'Objects', icon: 'object' }
	];
	const rowKind = (group: string) => kinds.find((kind) =>
		kind.id === (group === 'object' || group === 'scene' ? 'objects' : group)
	);
	const groups = $derived.by(() => {
		if (query.trim() === '' && facet !== 'all') return [{ label: `${rowKind(facet)?.label ?? facet} in ${scope === 'project' ? 'the project' : location?.label}`, rows: result.rows, count: result.total }];
		if (query.trim() !== '' || !scope.startsWith('room:')) return [{ label: '', rows: result.rows, count: result.total }];
		return [
			{ label: 'Walls', id: 'wall' },
			{ label: 'Openings', id: 'opening' },
			{ label: 'In the room', id: 'objects' }
		].map(({ label, id }) => ({
			label,
			rows: result.rows.filter((row) => rowKind(row.group)?.id === id),
			count: worldScopeRows(model, scope, id, query, 0).total
		})).filter((group) => group.rows.length > 0);
	});
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
	/* D-2: a Guide's name renames in place on its Index row; its ⋯ menu renames or removes it. */
	let renamingGuideId = $state<string | null>(null);
	let guideDraft = $state('');
	let guideMenuId = $state<string | null>(null);
	let guideBusy = $state(false);
	let guideRenameInput = $state<HTMLInputElement | null>(null);

	function startGuideRename(guideId: string, label: string): void {
		guideMenuId = null;
		renamingGuideId = guideId;
		guideDraft = label;
		void tick().then(() => {
			guideRenameInput?.focus();
			guideRenameInput?.select();
		});
	}
	function cancelGuideRename(): void {
		renamingGuideId = null;
		guideDraft = '';
	}
	async function commitGuideRename(): Promise<void> {
		const guideId = renamingGuideId;
		if (guideId === null || guideDraft.trim() === '' || !experience) return;
		guideBusy = true;
		const result = await experience.onRenameGuide(guideId, guideDraft.trim());
		guideBusy = false;
		if (result.kind === 'accepted') cancelGuideRename();
	}
	function onGuideRenameKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			void commitGuideRename();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			cancelGuideRename();
		}
	}
	function toggleGuideMenu(guideId: string): void {
		guideMenuId = guideMenuId === guideId ? null : guideId;
	}
	let renameError = $state<string | null>(null);
	function startExperienceRename(): void {
		if (!experience) return;
		experienceDraft = experience.current?.label ?? experience.draftLabel;
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
	function renameKeys(event: KeyboardEvent): void {
		if (event.key === 'Enter') { event.preventDefault(); void commitExperienceName(); }
		else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); renamingExperience = false; renameError = null; }
	}

	/*
	 * Experience review 1 — the Experiences list. Folded, it shows the current
	 * Experience and the most recently opened ones (at most EXPERIENCE_FOLD_ROWS);
	 * "Show all" lists every one in authored order inside a capped scroll, with a
	 * filter from EXPERIENCE_FILTER_FROM. The fold choice is a per-browser convenience.
	 */
	const EXPERIENCE_FOLD_ROWS = 3;
	const EXPERIENCE_FILTER_FROM = 8;
	const EXPANDED_KEY = 'museum.index.experiences-expanded';
	function readExpanded(): boolean {
		try {
			return globalThis.localStorage?.getItem(EXPANDED_KEY) === 'true';
		} catch {
			return false;
		}
	}
	let expanded = $state(readExpanded());
	function setExpanded(next: boolean): void {
		expanded = next;
		experienceFilter = '';
		try {
			globalThis.localStorage?.setItem(EXPANDED_KEY, String(next));
		} catch {
			// A blocked store only forgets the choice.
		}
	}
	let experienceFilter = $state('');
	let recentExperienceIds = $state<string[]>([]);
	$effect(() => {
		const id = experience?.current?.id ?? null;
		if (id === null) return;
		untrack(() => {
			recentExperienceIds = [id, ...recentExperienceIds.filter((entry) => entry !== id)].slice(0, 12);
		});
	});
	const shownExperiences = $derived.by(() => {
		const all = experience?.experiences ?? [];
		if (expanded || all.length <= EXPERIENCE_FOLD_ROWS) {
			const needle = experienceFilter.trim().toLowerCase();
			return needle === '' ? all : all.filter((entry) => entry.label.toLowerCase().includes(needle) || entry.id === experience?.current?.id);
		}
		const byId = new Map(all.map((entry) => [entry.id, entry]));
		const order = [...recentExperienceIds, ...all.map((entry) => entry.id)];
		const picked: typeof all[number][] = [];
		for (const id of order) {
			const entry = byId.get(id);
			if (entry !== undefined && !picked.includes(entry)) picked.push(entry);
			if (picked.length === EXPERIENCE_FOLD_ROWS) break;
		}
		return picked;
	});
	function experienceMeta(entry: { readonly stopCount: number; readonly presentationCount: number }): string {
		if (entry.stopCount > 0) return `${entry.stopCount} ${entry.stopCount === 1 ? 'stop' : 'stops'}`;
		if (entry.presentationCount > 0) return `${entry.presentationCount} presented`;
		return 'empty';
	}

	let creatingName = $state<string | null>(null);
	function startCreate(): void {
		if (!experience) return;
		renamingExperience = false;
		creatingName = `Experience ${experience.experiences.length + 1}`;
	}
	async function commitCreate(): Promise<void> {
		if (!experience || creatingName === null) return;
		const name = creatingName.trim();
		creatingName = null;
		if (name === '') return;
		await experience.onCreateExperience(name);
	}

	function focusSelect(input: HTMLInputElement) {
		input.focus();
		input.select();
	}

	/** A Presentation row's snapshot shows its default View, or its first View when none is marked. */
	function representativeViewId(views: readonly { readonly id: string; readonly isDefault: boolean }[]): string | null {
		return (views.find((view) => view.isDefault) ?? views[0])?.id ?? null;
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

<svelte:window onkeydown={(event) => {
	if (event.key === 'Escape' && locationsOpen) {
		locationsOpen = false;
		if (event.target instanceof HTMLElement && event.target.closest('#plate-index')) {
			document.getElementById('world-location-toggle')?.focus();
			event.stopPropagation();
		}
	}
	if (event.key === 'Escape' && guideMenuId !== null) guideMenuId = null;
}} onpointerdown={(event) => {
	if (!(event.target instanceof Element) || !event.target.closest('.world-location, #world-locations')) locationsOpen = false;
	if (!(event.target instanceof Element) || !event.target.closest('.guide-menu-wrap')) guideMenuId = null;
}} />

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
		<!-- Experience review 1: the Experiences of this World, listed like a file's pages. -->
		<section class="group experiences" aria-labelledby="index-experiences" data-experience-list>
			<h3 id="index-experiences" class="group-title group-title-row">
				<span>Experiences <span class="count">{experience.experiences.length || ''}</span></span>
				<button
					type="button"
					class="group-add"
					aria-label="New Experience"
					title="New Experience"
					disabled={experience.busy || creatingName !== null}
					onclick={startCreate}><ShellIcon name="plus" size={14} /></button
				>
			</h3>
			{#if expanded && experience.experiences.length > EXPERIENCE_FILTER_FROM}
				<label class="exp-filter"
					><ShellIcon name="search" size={13} /><input
						type="search"
						aria-label="Filter Experiences"
						placeholder="Filter Experiences"
						bind:value={experienceFilter}
					/></label
				>
			{/if}
			<ul class="group-items exp-list" class:scrolls={expanded && experience.experiences.length > EXPERIENCE_FOLD_ROWS}>
				{#if experience.current === null}
					<li class="exp-row current draft" data-experience-draft>
						{#if renamingExperience}
							<input class="crumb-input" aria-label="Experience name" value={experienceDraft} disabled={renameBusy} use:focusSelect
								oninput={(event) => (experienceDraft = event.currentTarget.value)}
								onblur={() => { if (!renameBusy) void commitExperienceName(); }}
								onkeydown={renameKeys} />
						{:else}
							<button type="button" class="exp-open" aria-current="location" ondblclick={startExperienceRename} title="Double-click to rename"
								><i class="exp-ic"></i><span class="exp-name">{experience.draftLabel}</span><span class="exp-meta">draft</span></button
							>
						{/if}
					</li>
				{/if}
				{#each shownExperiences as entry (entry.id)}
					{@const isCurrent = entry.id === experience.current?.id}
					<li class="exp-row" class:current={isCurrent} data-experience-row={entry.id}>
						{#if isCurrent && renamingExperience}
							<input class="crumb-input" aria-label="Experience name" value={experienceDraft} disabled={renameBusy} use:focusSelect
								oninput={(event) => (experienceDraft = event.currentTarget.value)}
								onblur={() => { if (!renameBusy) void commitExperienceName(); }}
								onkeydown={renameKeys} />
						{:else}
							<button
								type="button"
								class="exp-open"
								aria-current={isCurrent ? 'location' : undefined}
								onclick={() => { if (!isCurrent) experience.onOpenExperience(entry.id); }}
								ondblclick={() => { if (isCurrent) startExperienceRename(); }}
								><i class="exp-ic"></i><span class="exp-name">{entry.label}</span><span class="exp-meta">{experienceMeta(entry)}</span></button
							>
							{#if isCurrent}
								<button type="button" class="exp-more" aria-label={`Rename ${entry.label}`} title="Rename" disabled={experience.busy}
									onclick={startExperienceRename}><ShellIcon name="more" size={14} /></button
								>
							{/if}
						{/if}
					</li>
				{/each}
				{#if creatingName !== null}
					<li class="exp-row current creating">
						<input class="crumb-input" aria-label="New Experience name" value={creatingName} disabled={experience.busy} use:focusSelect
							oninput={(event) => (creatingName = event.currentTarget.value)}
							onblur={() => { if (!experience.busy) void commitCreate(); }}
							onkeydown={(event) => {
								if (event.key === 'Enter') { event.preventDefault(); void commitCreate(); }
								else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); creatingName = null; }
							}} />
					</li>
				{/if}
			</ul>
			{#if experience.experiences.length > EXPERIENCE_FOLD_ROWS}
				<button type="button" class="exp-more-toggle" aria-expanded={expanded} onclick={() => setExpanded(!expanded)}
					>{expanded ? 'Show less' : `Show all ${experience.experiences.length}`}<ShellIcon name={expanded ? 'chevronUp' : 'chevronDown'} size={12} /></button
				>
			{/if}
			{#if renameError}<p class="crumb-error" role="alert">{renameError}</p>{/if}
		</section>
		<section class="group" aria-labelledby="index-presentations">
			<h3 id="index-presentations" class="group-title">
				Presentations <span class="count">{experience.totalPresentations}</span>
			</h3>
			{#if experience.pending}
				<p class="index-empty">The Experience lens mounts with the admitted project source.</p>
			{:else if experience.current === null}
				<p class="index-empty">Nothing presented yet. Start from the Stage.</p>
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
									<ExperienceSnapshot label={presentation.label} viewId={representativeViewId(presentation.views)} ratio="row" selected={presentation.selected} />
									<span class="item-text">
										<span class="item-name">{presentation.label}</span>
										<span class="item-meta"
											>{presentation.viewCount} {presentation.viewCount === 1 ? 'View' : 'Views'} · {#if presentation.stopNumbers.length > 0}Stops {stopsLabel(presentation.stopNumbers)}{:else}<span class="free-tag">{presentation.explorable ? 'free' : 'hidden'}</span>{/if}</span
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
										<li class="view-line">
											<button
												type="button"
												class="view-row"
												class:selected={view.selected}
												aria-current={view.selected ? 'true' : undefined}
												aria-label={`${view.label}, ${view.onTour ? 'on tour' : presentation.explorable ? 'free' : 'hidden from free exploration'}${view.isDefault ? ', Default View' : ''}`}
												onclick={() => experience.onSelectView(view.id, presentation.id)}
											>
												<span class="tour-mark" class:on={view.onTour} aria-hidden="true"></span>
												<span class="view-name">{view.label}</span>
												{#if view.isDefault}<span class="default-mark" title="Default View" aria-hidden="true">◆</span>{/if}
											</button>
											<button
												type="button"
												class="view-add"
												data-view-add={view.id}
												aria-label={`Add Stop from ${view.label}`}
												title={`Add a Stop that enters at ${view.label}`}
												onclick={() => experience.onAddStopFromView(view.id, presentation.id)}
											>+ Stop</button>
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
					<div class="item" class:open={guide.open} data-guide-id={guide.id}>
						{#if renamingGuideId === guide.id}
							<input
								class="guide-rename-input"
								type="text"
								aria-label="Guide name"
								bind:value={guideDraft}
								bind:this={guideRenameInput}
								disabled={guideBusy}
								onkeydown={onGuideRenameKeydown}
								onblur={() => void commitGuideRename()}
							/>
						{:else}
							<div class="guide-line">
								<button
									type="button"
									class="guide-row"
									onclick={() => experience.onOpenGuide(guide.id)}
								>
									<ShellIcon name="guide" size={15} />
									<span class="item-text">
										<span class="item-name">{guide.label}</span>
										<span class="item-meta">{guide.stopCount} {guide.stopCount === 1 ? 'stop' : 'stops'}</span>
									</span>
									{#if guide.opening}<span class="opens-tag" data-opening-guide>opens</span>{/if}
									{#if guide.open}<span class="chip">Open</span>{/if}
								</button>
								<span class="guide-menu-wrap">
									<button
										type="button"
										class="icon guide-actions-toggle"
										aria-label={`${guide.label} actions`}
										aria-haspopup="menu"
										aria-expanded={guideMenuId === guide.id}
										onclick={() => toggleGuideMenu(guide.id)}
									>⋯</button
									>
									{#if guideMenuId === guide.id}
										<div class="menu guide-menu" role="menu" tabindex="-1" aria-label={`${guide.label} actions`}>
											<button
												type="button"
												role="menuitem"
												onclick={() => startGuideRename(guide.id, guide.label)}>Rename</button
											>
											<button
												type="button"
												role="menuitem"
												class="danger"
												onclick={() => {
													guideMenuId = null;
													experience.onRemoveGuide(guide.id);
												}}>Remove Guide</button
											>
										</div>
									{/if}
								</span>
							</div>
						{/if}
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

		<div class="index-search world-search">
			<label
				><ShellIcon name="search" size={14} />
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
			<span class="crumb world-location">
				{#if scope !== 'project'}
					<button type="button" title={project.label} onclick={() => changeScope('project')}>Project</button>
				{/if}
				{#if locations.length > 0}
					<button type="button" class:current={scope === 'project'} class:location-toggle={scope !== 'project'}
						id="world-location-toggle" aria-label="Project locations" title={project.label}
						aria-current={scope === 'project' ? 'location' : undefined} aria-expanded={locationsOpen}
						aria-controls={locationsOpen ? 'world-locations' : undefined} onclick={() => (locationsOpen = !locationsOpen)}>
						{#if scope === 'project'}Project{/if}
						<ShellIcon name="chevronDown" size={11} />
					</button>
				{:else if scope === 'project'}
					<span class="crumb current" aria-current="location">Project</span>
				{/if}
			</span>
			{#if scope !== 'project'}
				<span aria-hidden="true">›</span>
				<span class="crumb current" aria-current="location">{location?.label}</span>
			{/if}
		</div>
		{#if locationsOpen && locations.length > 0}
			<div id="world-locations" class="location-list" role="group" aria-label="Project locations">
				{#each locations as entry (entry.id)}
					<button type="button" aria-current={scope === entry.id ? 'location' : undefined}
						onclick={() => { changeScope(entry.id); document.getElementById('world-location-toggle')?.focus(); }}>
						<ShellIcon name={entry.id === 'free' ? 'object' : 'plan'} size={15} />{entry.label}
					</button>
				{/each}
			</div>
		{/if}
		{#if query.trim() === ''}
			<div class="facets" role="group" aria-label="Subject kinds">
				<button type="button" aria-pressed={facet === 'all'} onclick={() => (facet = 'all')}>All</button>
				{#each kinds as kind}
					{@const count = worldScopeRows(model, scope, kind.id, '', 0).total}
					<button type="button" aria-label={kind.label} title={`${kind.label} · ${count} here`}
						aria-pressed={facet === kind.id} onclick={() => (facet = kind.id)}>
						<ShellIcon name={kind.icon} size={14} />
					</button>
				{/each}
			</div>
		{/if}
		<div class="world-list">
		{#each groups as group (group.label)}
			{#if group.label}
				<h3 class="group-title world-group"><span>{group.label}</span><span>{group.count}</span></h3>
			{/if}
		<ul class="group-items">
			{#each group.rows as item (item.sourceId)}
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
								name={rowKind(item.group)?.icon ?? 'dot'}
								size={15}
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

					</div>

				</li>
			{/each}
		</ul>
		{/each}
		{#if result.total > result.rows.length}<button type="button" class="world-more" onclick={() => (limit += 40)}
				>Show more ({result.total - result.rows.length})</button
			>{:else if result.total === 0}<p class="index-empty">No matching subjects</p>{/if}
		</div>
		{/if}
	{/if}
</nav>

<style>
	.plate-index {
		display: flex;
		flex-direction: column;
		width: var(--shell-index-width);
		min-width: 0;
		min-height: 0;
		overflow: auto;
		border-right: 1px solid var(--shell-hairline);
		background: var(--shell-index);
		color: var(--shell-ink);
		font: var(--shell-text-body)/1.35 var(--shell-sans);
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
		background: var(--shell-hover);
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
		background: var(--shell-field);
		border: 1px solid var(--shell-field-line);
		border-radius: 7px;
		color: var(--shell-ink-3);
	}
	input {
		min-width: 0;
		width: 100%;
		border: 0;
		background: none;
		color: var(--shell-ink);
		font: 12px var(--shell-sans);
	}

	/* Experience review 1 — the Experiences list, in the Index's own row grammar. */
	.group-title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-right: 6px;
	}
	.group-add {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		min-height: 22px;
		padding: 0;
		border-radius: 6px;
		color: var(--shell-ink-3);
	}
	.group-add:hover:not(:disabled) {
		background: var(--shell-hover);
		color: var(--shell-ink);
	}
	.exp-list.scrolls {
		max-height: 224px;
		overflow-y: auto;
		box-shadow: inset 0 -8px 8px -8px rgb(0 0 0 / 0.12);
	}
	.exp-row {
		display: flex;
		align-items: center;
		min-height: 28px;
	}
	.exp-row.current {
		background: var(--shell-selected);
	}
	.exp-open {
		flex: 1;
		min-width: 0;
		min-height: 28px;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px 4px 12px;
		border-radius: 0;
		text-align: left;
		font: 400 var(--shell-text-body)/1.35 var(--shell-sans);
	}
	.exp-row:not(.current) .exp-open:hover {
		background: var(--shell-hover);
	}
	.exp-ic {
		flex: none;
		width: 9px;
		height: 9px;
		border: 1.5px solid var(--shell-ink-3);
		border-radius: 2px;
	}
	.exp-row.current .exp-ic {
		border-color: var(--shell-forest);
		background: var(--shell-forest);
	}
	.exp-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.exp-row.current .exp-name {
		font-weight: 600;
	}
	.exp-row.draft .exp-name {
		font-style: italic;
		color: var(--shell-ink-2);
	}
	.exp-meta {
		flex: none;
		color: var(--shell-ink-3);
		font-size: 11px;
	}
	.exp-more {
		width: 26px;
		padding: 0;
		justify-content: center;
		opacity: 0;
	}
	.exp-row:hover .exp-more,
	.exp-row:focus-within .exp-more {
		opacity: 1;
	}
	.exp-row .crumb-input {
		margin: 3px 8px 3px 12px;
		border: 0;
		border-bottom: 2px solid var(--shell-leaf);
		border-radius: 0;
		background: none;
		font: 600 13px/1.35 var(--shell-sans);
		outline: none;
	}
	.exp-filter {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 2px 8px 4px;
		padding: 0 8px;
		height: 26px;
		border: 1px solid var(--shell-field-line);
		border-radius: 7px;
		background: var(--shell-field);
		color: var(--shell-ink-3);
	}
	.exp-more-toggle {
		display: flex;
		align-items: center;
		gap: 4px;
		width: 100%;
		min-height: 26px;
		padding: 0 12px;
		color: var(--shell-ink-3);
		font: 500 12px var(--shell-sans);
	}
	.exp-more-toggle:hover {
		background: var(--shell-hover);
		color: var(--shell-ink);
	}
	/* R217.S26: the crumb's inline rename uses the crumb's own metrics. */
	.crumb-input {
		box-sizing: border-box;
		min-width: 0;
		flex: 1 1 auto;
		padding: 1px 4px;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 5px;
		font: 600 12px/1.3 var(--shell-sans);
		color: inherit;
	}
	.crumb-error {
		margin: -2px 10px 6px;
		color: var(--shell-refuse);
		font-size: 11.5px;
	}
	.opens-tag {
		flex: none;
		padding: 0 4px;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 3px;
		color: var(--shell-ink-2);
		font: 500 10px/1.5 var(--shell-mono);
		letter-spacing: 0.02em;
	}


	.world-search input { font-size: 12.5px; }
	.world-search > button { width: 28px; height: 28px; padding: 0; justify-content: center; }
	.crumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px 3px;
		padding: 0 10px 6px;
		font-size: 12px;
		color: var(--shell-ink-3);
	}
	.crumb { display: inline-flex; align-items: center; }
	.crumb > button, .crumb.current { padding: 2px 4px; }
	.crumb > button { min-height: 0; color: var(--shell-ink-2); border-radius: 5px; }
	.crumb > .current, .crumb.current { color: var(--shell-ink); font-weight: 600; }
	.crumb > .location-toggle { padding: 2px; color: var(--shell-ink-3); }
	.location-list {
		flex: none;
		margin: 0 10px 6px;
		padding: 3px;
		max-height: 220px;
		overflow: auto;
		background: var(--shell-popover);
		border: 1px solid var(--shell-hairline);
		border-radius: 8px;
		box-shadow: 0 1px 2px #0001, 0 8px 24px #0002;
	}
	.location-list button { width: 100%; padding: 4px 8px; min-height: 0; text-align: left; font-size: 12px; }
	.location-list [aria-current] { background: var(--shell-leaf-tint); font-weight: 600; }
	.world-list { flex: 1; overflow: auto; padding-bottom: 14px; }
	.world-group { display: flex; justify-content: space-between; }
	.world-list .item-row { color: var(--shell-ink-3); font-weight: 400; }
	.world-list .item-name { color: var(--shell-ink); }
	.world-list .selected .item-name { font-weight: 600; }
	.world-list .item:hover:not(.selected) { background: rgb(0 0 0 / 3.5%); }
	.world-list .item-row:hover { background: transparent; }
	.world-more { margin: 4px 10px 4px 12px; font-size: 12px; color: var(--shell-forest-raised); }
	.facets {
		display: flex;
		gap: 2px;
		margin: 0 8px 4px;
		padding: 2px;
		border-radius: 7px;
		background: var(--shell-surface-sunken);
	}
	.facets button {
		flex: 1;
		display: grid;
		place-items: center;
		font-size: 11.5px;
		height: 24px;
		min-height: 24px;
		padding: 0 4px;
		color: var(--shell-ink-3);
	}
	.facets [aria-pressed='true'] {
		background: var(--shell-field-focus);
		color: var(--shell-ink);
		box-shadow: 0 0 0 1px var(--shell-hairline-strong);
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
	/* Index selection mirrors the Stage; gold stays on the drawing itself. */
	.item.selected,
	.item-head.selected {
		background: var(--shell-selected);
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

	.badge {
		font-size: 10px;
		color: var(--shell-ink-3);
	}
	.group {
		display: flex;
		flex-direction: column;
	}
	/* Round 2 igroup: 10 px uppercase labels. */
	.group-title {
		margin: 0;
		padding: 8px 10px 2px 12px;
		color: var(--shell-ink-3);
		font: 600 10px var(--shell-sans);
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}
	.index-search .hide-index {
		margin-left: auto;
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
		color: var(--shell-ink-3);
		font-size: 11px;
		line-height: 1.3;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.item-name.muted {
		color: var(--shell-ink-3);
	}
	.free-tag {
		padding: 0 4px;
		border: 1px dashed var(--shell-hairline-strong);
		border-radius: 4px;
		font-size: 10px;
	}
	.chip {
		flex: none;
		padding: 0 6px;
		border: 1px solid var(--shell-leaf);
		border-radius: 999px;
		background: var(--shell-surface-raised);
		color: var(--shell-forest-3);
		font-size: 10px;
		line-height: 15px;
		font-weight: 600;
	}
	/* An open Guide is a leaf state; the gold role stays with selection alone. */
	.item.open:not(.selected) {
		background: var(--shell-leaf-tint);
	}
	/* Round 2 irow: one 28 px line, the stop count on the right. */
	.guide-line {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.guide-line .guide-row {
		flex: 1;
		min-width: 0;
	}
	.guide-menu-wrap {
		position: relative;
		display: inline-flex;
		flex: none;
	}
	.guide-actions-toggle {
		width: 24px;
		height: 24px;
		min-height: 24px;
		padding: 0;
		justify-content: center;
		opacity: 0;
	}
	.item:hover .guide-actions-toggle,
	.item:focus-within .guide-actions-toggle {
		opacity: 1;
	}
	.guide-menu {
		position: absolute;
		top: calc(100% + 2px);
		right: 0;
		z-index: 20;
		display: grid;
		min-width: 148px;
		padding: 4px;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 8px;
		background: var(--shell-popover);
		box-shadow: var(--shell-shadow);
	}
	.guide-menu button {
		justify-content: flex-start;
		min-height: 26px;
		padding: 4px 7px;
		border: 0;
		border-radius: 5px;
		background: transparent;
		font-size: 11.5px;
		text-align: left;
	}
	.guide-menu button:hover,
	.guide-menu button:focus-visible {
		background: var(--shell-hover);
	}
	.guide-menu button.danger {
		color: var(--shell-refuse);
	}
	.guide-rename-input {
		box-sizing: border-box;
		width: 100%;
		min-height: 28px;
		margin: 2px 0;
		padding: 3px 7px;
		border: 1px solid var(--shell-field-line-strong);
		border-radius: 5px;
		background: var(--shell-field);
		color: var(--shell-ink);
		font: inherit;
	}
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
		color: var(--shell-ink-3);
		opacity: 0;
	}
	.item-head:hover .twist:enabled,
	.twist:focus-visible {
		opacity: 1;
	}
	.twist:hover {
		background: rgb(0 0 0 / 0.07);
		color: var(--shell-ink);
	}
	.twist:disabled {
		visibility: hidden;
	}
	.presentation-row {
		min-height: 28px;
		padding: 4px 6px 4px 10px;
		gap: 7px;
		cursor: default;
	}
	/* Round 2 Index rows read in the sans at 13 px; only the selected row is bold. */
	.presentation-row .item-name {
		font: 400 var(--shell-text-body)/1.35 var(--shell-sans);
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
	.view-line {
		display: flex;
		align-items: center;
	}
	.view-line .view-row {
		flex: 1;
		min-width: 0;
	}
	.view-add {
		flex: none;
		min-height: 24px;
		padding: 0 6px;
		border: 0;
		border-radius: 5px;
		background: transparent;
		color: var(--shell-ink-3);
		font: 500 10.5px/1 var(--shell-sans);
		white-space: nowrap;
		opacity: 0;
	}
	.view-line:hover .view-add,
	.view-add:focus-visible {
		opacity: 1;
		color: var(--shell-forest-3);
	}
	.view-add:hover {
		background: var(--shell-hover);
	}
	.view-row {
		width: 100%;
		min-height: 28px;
		padding: 4px 6px 4px 24px;
		gap: 7px;
		border-radius: 0;
		text-align: left;
		color: var(--shell-ink);
		font-size: var(--shell-text-body);
	}
	.view-row:hover {
		background: rgb(0 0 0 / 0.035);
	}
	.view-row.selected {
		background: var(--shell-selected);
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
		border: 1.5px solid var(--shell-ink-3);
		border-radius: 50%;
	}
	.tour-mark.on {
		border-color: var(--shell-leaf);
		background: var(--shell-leaf);
	}
	.default-mark {
		flex: none;
		color: var(--shell-ink-3);
		font-size: 10px;
	}
	.view-more {
		width: 100%;
		min-height: 28px;
		padding: 3px 6px 3px 24px;
		border-radius: 6px;
		color: var(--shell-ink-3);
		font-size: 12px;
		text-align: left;
	}
	.index-empty {
		padding: 10px;
		font-size: 12px;
		color: var(--shell-ink-3);
	}
	@media (pointer: coarse) {
		button,
		.facets button,
		.crumb > button,
		.location-list button,
		.index-search label,
		input {
			min-height: 44px;
		}
		.item-actions-toggle {
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

<script lang="ts">
	import { membershipLabel } from './index-labels';
	import ShellIcon from './ShellIcon.svelte';
	import { worldScopeRows, type WorldScope, type WorldIndexModel } from './world-index-model';

	let { visible, model, scope, onScope, selectionId, query, onSelect, onReveal, onRename, locationsOpen = $bindable() }: {
		visible: boolean;
		model: WorldIndexModel;
		scope: WorldScope;
		onScope: (scope: WorldScope) => void;
		selectionId: string | null;
		query: string;
		onSelect: (id: string) => void;
		onReveal: (id: string) => void;
		onRename: (id: string) => void;
		locationsOpen: boolean;
	} = $props();

	let facet = $state('all');
	let limit = $state(40);
	const result = $derived(worldScopeRows(model, scope, query.trim() ? 'all' : facet, query, limit));
	const project = $derived(model.contexts[0]!);
	const location = $derived(model.contexts.find((context) => context.id === scope));
	const locations = $derived(model.contexts.filter((context) => context.parent === 'project'));
	function changeScope(next: WorldScope): void {
		locationsOpen = false;
		facet = 'all';
		onScope(next);
	}

	const kinds = [
		{ id: 'room-floor', label: 'Rooms', icon: 'plan' },
		{ id: 'wall', label: 'Walls', icon: 'wall' },
		{ id: 'opening', label: 'Openings', icon: 'opening' },
		{ id: 'region', label: 'Regions', icon: 'terrace' },
		{ id: 'objects', label: 'Objects', icon: 'object' },
		{ id: 'lights', label: 'Lights', icon: 'light' }
	];
	const rowKind = (group: string) => kinds.find((kind) =>
		kind.id === (group === 'object' || group === 'scene' ? 'objects' : group === 'light' ? 'lights' : group)
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

{#if visible}
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

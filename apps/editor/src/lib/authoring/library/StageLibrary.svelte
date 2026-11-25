<script lang="ts">
	/**
	 * The professional Library sheet (T2.S8 U5).
	 *
	 * One Stage-bounded surface in the measured shell lanes (a bottom sheet above
	 * the dock in portrait): a kind rail with the Materials families nested under
	 * it, sources, attribute filters, a searchable grid of square cards and a
	 * detail pane. Browse cards use `FinishTile` sample-tile derivatives only;
	 * the one active detail asks the Stage's E7 inspection host for a live draw
	 * and releases it on change or close.
	 *
	 * **One action per card.** Click and keyboard activation do what the
	 * invocation says, shown before activation in the context line:
	 * Paint arms (zero writes), Replace assigns to the captured target, Swap
	 * changes the Card target's material and keeps its treatment, and ordinary
	 * browse arms Paint for curated cards or selects a project Finish's users.
	 * The separate detail control never chooses. Shift keeps the Library open
	 * for Paint, Replace and Swap. A stale or unsupported target refuses in place.
	 *
	 * The last browse view is session state the route holds; detail is local and
	 * ends with the sheet. *Customise…* hands the chosen Finish to the Material
	 * editor, which owns the draft.
	 */
	import { onMount, untrack } from 'svelte';
	import type { ArtworkLibraryEntry } from '@portfolio/project-model/artwork';
	import type { MaterialId } from '@portfolio/project-model/scene';
	import FinishTile from '$lib/authoring/look/FinishTile.svelte';
	import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';
	import type { LookLibraryShelf } from '$lib/authoring/look/look-authoring.svelte';
	import type { LibrarySwapRequest } from '$lib/authoring/look/finish-authoring.svelte';
	import type { StageLibraryView } from '$lib/authoring/stage/route/stage-shell-state.svelte';
	import FinishInspectionView from './FinishInspectionView.svelte';
	import { LIBRARY_INSPECTION_DEFAULT, type LibraryInspectionSettings } from './library-inspection';
	import {
		LIBRARY_FILTERS,
		LIBRARY_SOURCES,
		browseLibrary,
		libraryCardsOf,
		libraryCategoryOptions,
		librarySourceCount,
		type LibraryCard,
		type LibraryCategory,
		type LibraryFilter,
		type LibraryFinishEntry,
		type LibrarySource
	} from './library-catalogue';
	import type { LibraryTarget } from './library-target';

	type LibraryKind = StageLibraryView['kind'];
	type Intent = 'browse' | 'paint' | 'replace' | 'swap';
	type Outcome = { readonly ok: true } | { readonly ok: false; readonly message: string };

	let {
		entries,
		intent = 'browse',
		target = null,
		swap = null,
		view,
		openKind = null,
		busy = false,
		tileSource,
		objects = [],
		artwork = null,
		looks = null,
		inspection = LIBRARY_INSPECTION_DEFAULT,
		onInspection = () => {},
		onView,
		onClose,
		onPaint,
		onReplace,
		onSwap,
		onSelectUsers,
		onCustomise,
		onToggleFavourite,
		onObject,
		onArtwork,
		onArtworkImport,
		onMaterialImport,
		onLook
	}: {
		entries: readonly LibraryFinishEntry[];
		intent?: Intent;
		/** The qualified selected target now; Replace requalifies against it. */
		target?: LibraryTarget | null;
		/** The Card's captured Swap target and reach. */
		swap?: LibrarySwapRequest | null;
		/** The last browse view, from session state. */
		view: StageLibraryView;
		/** The kind this invocation opens on, overriding the remembered one. */
		openKind?: LibraryKind | null;
		busy?: boolean;
		tileSource: (entry: LibraryFinishEntry) => FinishTileSource | null;
		objects?: readonly { readonly id: string; readonly name: string }[];
		artwork?: readonly ArtworkLibraryEntry[] | null;
		looks?: LookLibraryShelf | null;
		/** Detail geometry and lighting, remembered in the Library session. */
		inspection?: LibraryInspectionSettings;
		onInspection?: (next: LibraryInspectionSettings) => void;
		onView: (view: StageLibraryView) => void;
		onClose: () => void;
		/** Arm Paint with this Finish: zero project writes. */
		onPaint: (entry: LibraryFinishEntry, keepOpen: boolean) => void;
		onReplace: (entry: LibraryFinishEntry, keepOpen: boolean) => Promise<Outcome>;
		onSwap: (materialId: MaterialId, keepOpen: boolean) => Promise<Outcome>;
		onSelectUsers: (entry: LibraryFinishEntry) => Promise<boolean>;
		onCustomise: (entry: LibraryFinishEntry) => void;
		onToggleFavourite: (key: string) => void;
		onObject: (assetId: string) => void;
		onArtwork: (entry: ArtworkLibraryEntry) => void;
		onArtworkImport: (files: File[]) => void;
		onMaterialImport?: (files: readonly File[], invoker?: HTMLElement | null) => void;
		onLook: (id: string) => void;
	} = $props();

	const FILTER_IDS = new Set<string>(LIBRARY_FILTERS.map((option) => option.id));
	const SOURCE_IDS = new Set<string>(LIBRARY_SOURCES.map((option) => option.id));
	/**
	 * The project shelf renders at most this many; container queries show only the
	 * cards that fit one row (`display: none`, so hidden cards leave the Tab order).
	 */
	const SHELF_MAX = 8;

	// The sheet opens on the remembered view; an invocation may name its kind.
	const start = untrack(() => view);
	let kind = $state<LibraryKind>(untrack(() => openKind) ?? start.kind);
	let source = $state<LibrarySource>(SOURCE_IDS.has(start.source) ? (start.source as LibrarySource) : 'all');
	let category = $state<LibraryCategory>(start.category as LibraryCategory);
	let filters = $state<ReadonlySet<LibraryFilter>>(
		new Set(start.filters.filter((id) => FILTER_IDS.has(id)) as LibraryFilter[])
	);
	let query = $state(start.query);
	let selectedKey = $state<string | null>(null);
	let variantChoice = $state<Record<string, MaterialId>>({});
	let working = $state(false);
	let refusal = $state<string | null>(null);
	let note = $state<string | null>(null);
	let searchEl = $state<HTMLInputElement>();
	let sectionEl = $state<HTMLElement>();
	let artworkInput = $state<HTMLInputElement>();
	let materialImportInput = $state<HTMLInputElement>();
	let materialImportBtn = $state<HTMLButtonElement>();

	function chooseMaterialFiles(files: FileList | null): void {
		if (!files || files.length === 0 || !onMaterialImport) return;
		const list = [...files];
		if (materialImportInput) materialImportInput.value = '';
		onMaterialImport(list, materialImportBtn ?? null);
	}

	function onDropFiles(event: DragEvent): void {
		if (!onMaterialImport || kind !== 'materials') return;
		const files = event.dataTransfer?.files;
		if (!files || files.length === 0) return;
		event.preventDefault();
		onMaterialImport([...files], materialImportBtn ?? null);
	}

	/** Replace writes to the target the sheet opened with, or refuses. */
	const capturedTarget = untrack(() => (intent === 'replace' ? target : null));

	const groups = $derived(browseLibrary(entries, { source, category, filters, query }, variantChoice));
	const cards = $derived(libraryCardsOf(groups));
	const selectedCard = $derived(cards.find((card) => card.key === selectedKey) ?? null);
	const categories = $derived(libraryCategoryOptions(entries, source));
	const curatedCount = $derived(librarySourceCount(entries, 'curated', variantChoice));
	const projectCount = $derived(librarySourceCount(entries, 'project'));
	const allCount = $derived(librarySourceCount(entries, 'all', variantChoice));
	const hasProject = $derived(entries.some((entry) => entry.source === 'project'));
	const keepable = $derived(intent !== 'browse');

	const needle = $derived(query.trim().toLowerCase());
	const filteredObjects = $derived(objects.filter((object) => object.name.toLowerCase().includes(needle)));
	const filteredArtwork = $derived((artwork ?? []).filter((entry) => entry.name.toLowerCase().includes(needle)));
	const filteredLooks = $derived(
		(looks?.entries ?? []).filter((entry) => `${entry.label} ${entry.summary ?? ''}`.toLowerCase().includes(needle))
	);

	// The browse view outlives the sheet (session state), detail does not.
	$effect(() => {
		const next: StageLibraryView = { kind, source, category, filters: [...filters], query };
		untrack(() => onView(next));
	});

	// A selected card that a filter hides closes its detail rather than pointing at nothing.
	$effect(() => {
		if (selectedKey !== null && !cards.some((card) => card.key === selectedKey)) selectedKey = null;
	});

	$effect(() => {
		if (!categories.some((option) => option.id === category)) category = 'all';
	});

	onMount(() => {
		searchEl?.focus();
	});

	function toggleFilter(id: LibraryFilter): void {
		const next = new Set(filters);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		filters = next;
	}

	function clearFilters(): void {
		filters = new Set();
		category = 'all';
		query = '';
	}

	function selectKind(next: LibraryKind): void {
		if (kind === next) return;
		kind = next;
		selectedKey = null;
		query = '';
		refusal = null;
	}

	function selectCategory(next: LibraryCategory): void {
		kind = 'materials';
		category = next;
		selectedKey = null;
	}

	/** Close detail and hand focus back to the card's detail control. */
	function closeDetail(): void {
		const key = selectedKey;
		selectedKey = null;
		if (key === null) return;
		queueMicrotask(() => sectionEl?.querySelector<HTMLElement>(`[data-library-detail-open="${CSS.escape(key)}"]`)?.focus());
	}

	function toggleDetail(card: LibraryCard): void {
		selectedKey = selectedKey === card.key ? null : card.key;
	}

	function switchVariant(card: LibraryCard, id: MaterialId): void {
		if (card.primary === null) return;
		variantChoice = { ...variantChoice, [card.primary]: id };
	}

	/** What activating a card does now, shown in its title and the context line. */
	function verb(entry: LibraryFinishEntry): string {
		if (intent === 'swap') {
			return entry.source === 'curated' && entry.curatedId !== null
				? 'swap to this material'
				: 'Swap takes a curated material';
		}
		if (intent === 'replace' && capturedTarget !== null) return `apply to ${capturedTarget.label}`;
		if (intent === 'browse' && entry.source === 'project' && entry.usage > 0) return 'select every surface using it';
		return 'pick for Paint';
	}

	async function run(work: () => Promise<Outcome>): Promise<void> {
		if (working || busy) return;
		working = true;
		refusal = null;
		try {
			const outcome = await work();
			if (!outcome.ok) refusal = outcome.message;
		} finally {
			working = false;
		}
	}

	/** The one card action, from click, Enter or Space. */
	function choose(entry: LibraryFinishEntry, keepOpen: boolean): void {
		const keep = keepable && keepOpen;
		note = null;
		if (intent === 'swap') {
			if (entry.source !== 'curated' || entry.curatedId === null) {
				refusal = 'Swap takes a curated material. Apply a project Finish from Replace instead.';
				return;
			}
			const id = entry.curatedId;
			void run(() => onSwap(id, keep)).then(() => {
				if (keep && refusal === null) note = `${entry.name} · Library stays open`;
			});
			return;
		}
		if (intent === 'replace') {
			const stale = capturedTarget === null || target === null || target.key !== capturedTarget.key;
			if (stale) {
				refusal = 'The selection changed since the Library opened. Nothing changed.';
				return;
			}
			void run(() => onReplace(entry, keep)).then(() => {
				if (keep && refusal === null) note = `${entry.name} · Library stays open`;
			});
			return;
		}
		if (intent === 'browse' && entry.source === 'project' && entry.usage > 0) {
			void selectUsers(entry);
			return;
		}
		refusal = null;
		onPaint(entry, keep);
		if (keep) note = `${entry.name} · Library stays open`;
	}

	async function selectUsers(entry: LibraryFinishEntry): Promise<void> {
		await run(async () => ((await onSelectUsers(entry)) ? { ok: true } : { ok: false, message: `No present surface uses ${entry.name}.` }));
	}

	function cardKeydown(event: KeyboardEvent, entry: LibraryFinishEntry): void {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		choose(entry, event.shiftKey);
	}

	function chooseArtwork(files: FileList | null): void {
		if (files === null || files.length === 0) return;
		onArtworkImport(Array.from(files));
		if (artworkInput !== undefined) artworkInput.value = '';
	}

	function focusables(): HTMLElement[] {
		if (sectionEl === undefined) return [];
		return Array.from(
			sectionEl.querySelectorAll<HTMLElement>(
				'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
			)
		).filter((element) => element.offsetParent !== null && getComputedStyle(element).visibility !== 'hidden');
	}

	function onKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			if (selectedKey !== null) {
				closeDetail();
				return;
			}
			onClose();
			return;
		}
		if (event.key !== 'Tab') return;
		const items = focusables();
		if (items.length === 0) return;
		const first = items[0]!;
		const last = items[items.length - 1]!;
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	function variantLabel(card: LibraryCard): string {
		return card.variant === null ? '' : `, ${card.variants.find((variant) => variant.id === card.variant)?.label ?? ''}`;
	}

	function tileSizeOf(entry: LibraryFinishEntry): string {
		return entry.subline.split('·').at(-1)?.trim() ?? '—';
	}
</script>

{#snippet card(item: LibraryCard, shelf: boolean)}
	{@const entry = item.entry}
	{@const blocked = intent === 'swap' && (entry.source !== 'curated' || entry.curatedId === null)}
	<article class="mc" class:open={selectedKey === item.key} class:blocked data-library-card={item.key} data-library-shelf={shelf ? 'project' : undefined}>
		<button
			type="button"
			class="choose"
			title={`${item.title} — ${verb(entry)}`}
			aria-label={`${item.title}${variantLabel(item)} — ${verb(entry)}`}
			aria-disabled={blocked}
			disabled={working || busy}
			data-library-choose={item.key}
			onclick={(event) => choose(entry, event.shiftKey)}
			onkeydown={(event) => cardKeydown(event, entry)}
		>
			<span class="th">
				<FinishTile source={tileSource(entry)} color={entry.color} imageUri={entry.imageUri} size={124} />
			</span>
			<span class="mt">
				<span class="mn">
					<span class="mnt">{item.title}</span>
					{#if entry.changes > 0}<i class="edm" title={`Edited · ${entry.changes} change${entry.changes === 1 ? '' : 's'}`}></i>{/if}
				</span>
				<span class="ms">{entry.subline}</span>
			</span>
		</button>
		<button
			type="button"
			class="star"
			class:on={entry.favourite}
			aria-label={entry.favourite ? `Remove ${item.title} from favourites` : `Add ${item.title} to favourites`}
			title={entry.favourite ? 'In your Paint tray — click to remove' : 'Keep in your Paint tray'}
			aria-pressed={entry.favourite}
			data-library-favourite={item.key}
			onclick={() => onToggleFavourite(entry.key)}
		>★</button>
		<button
			type="button"
			class="xp"
			aria-label={`Show detail for ${item.title}`}
			aria-expanded={selectedKey === item.key}
			title="Detail"
			data-library-detail-open={item.key}
			onclick={() => toggleDetail(item)}
		>⤢</button>
		{#if entry.usage > 0}
			<button
				type="button"
				class="users"
				title={`Used by ${entry.usage} — select every surface using it`}
				aria-label={`Used by ${entry.usage}, select them`}
				data-library-users={item.key}
				onclick={() => void selectUsers(entry)}
			>{entry.usage}</button>
		{/if}
		{#if item.variants.length > 0}
			<div class="vchips" role="group" aria-label={`${item.title} variant`}>
				{#each item.variants as variant (variant.id)}
					<button
						type="button"
						class:on={item.variant === variant.id}
						aria-pressed={item.variant === variant.id}
						onclick={() => switchVariant(item, variant.id)}
					>{variant.label}</button>
				{/each}
			</div>
		{/if}
	</article>
{/snippet}

<button class="scrim" type="button" tabindex="-1" aria-label="Close Library" onclick={onClose}></button>

<div
	class="library"
	class:with-detail={selectedCard !== null && kind === 'materials'}
	bind:this={sectionEl}
	role="dialog"
	tabindex="-1"
	aria-modal="true"
	aria-labelledby="library-title"
	data-stage-library
	data-library-intent={intent}
	onkeydown={onKeydown}
	ondragover={(event) => {
		if (kind === 'materials' && onMaterialImport) event.preventDefault();
	}}
	ondrop={onDropFiles}
>
	<header class="lb-h">
		<h2 id="library-title" class="lb-t">Library</h2>
		<label class="search">
			<span class="sr">Search the Library</span>
			<input
				bind:this={searchEl}
				bind:value={query}
				type="search"
				placeholder={kind === 'materials'
					? 'Search materials and finishes'
					: kind === 'objects'
						? 'Search objects'
						: kind === 'artwork'
							? 'Search artwork'
							: 'Search lights'}
				aria-label="Search the Library"
				data-library-search
			/>
			{#if query !== ''}
				<button type="button" class="clear-search" aria-label="Clear search" onclick={() => (query = '')}>×</button>
			{/if}
		</label>
		{#if kind === 'materials'}
			<div class="sources" role="group" aria-label="Material sources">
				{#each LIBRARY_SOURCES as option (option.id)}
					<button
						type="button"
						class:on={source === option.id}
						aria-pressed={source === option.id}
						data-library-source={option.id}
						onclick={() => { source = option.id; selectedKey = null; }}
					>
						{option.label}
						<span>{option.id === 'all' ? allCount : option.id === 'curated' ? curatedCount : projectCount}</span>
					</button>
				{/each}
			</div>
			<label class="sources-menu">
				<span class="sr">Material source</span>
				<select
					value={source}
					data-library-source-menu
					onchange={(event) => { source = event.currentTarget.value as LibrarySource; selectedKey = null; }}
				>
					{#each LIBRARY_SOURCES as option (option.id)}
						<option value={option.id}>{option.label} · {option.id === 'all' ? allCount : option.id === 'curated' ? curatedCount : projectCount}</option>
					{/each}
				</select>
			</label>
			{#if onMaterialImport}
				<input
					type="file"
					accept="image/png,image/jpeg,image/webp"
					multiple
					hidden
					bind:this={materialImportInput}
					onchange={() => chooseMaterialFiles(materialImportInput?.files ?? null)}
				/>
				<button
					type="button"
					class="btn sm"
					bind:this={materialImportBtn}
					data-library-import
					onclick={() => materialImportInput?.click()}
				>Import…</button>
			{/if}
		{/if}
		{#if kind === 'artwork' && artwork !== null}
			<input
				type="file"
				accept="image/png,image/jpeg,image/webp"
				multiple
				hidden
				bind:this={artworkInput}
				onchange={() => chooseArtwork(artworkInput?.files ?? null)}
			/>
			<button type="button" class="btn sm" onclick={() => artworkInput?.click()}>+ Import artwork</button>
		{/if}
		<button type="button" class="lb-x" aria-label="Close Library" title="Close (Esc · L)" data-library-close onclick={onClose}>×</button>
	</header>

	<div class="lb-f">
		<span class="ctx" data-library-context>
			{#if intent === 'swap' && swap !== null}
				Swap the material of <b>{swap.place}</b> · {swap.reachLine} — keeps its colour and sheen
			{:else if intent === 'replace' && capturedTarget !== null}
				Replace <b>{capturedTarget.label}</b>
			{:else if intent === 'paint'}
				Pick for Paint
			{:else}
				Browse{#if target !== null}<span class="sel"> · Selection <b>{target.label}</b></span>{/if}
			{/if}
		</span>
		{#if kind === 'materials'}
			{#each LIBRARY_FILTERS as option (option.id)}
				<button
					type="button"
					class="fchip"
					aria-pressed={filters.has(option.id)}
					data-library-filter={option.id}
					onclick={() => toggleFilter(option.id)}
				>{option.label}</button>
			{/each}
			{#if filters.size > 0 || category !== 'all' || query !== ''}
				<button type="button" class="fchip clear" onclick={clearFilters}>Clear</button>
			{/if}
		{/if}
		{#if keepable}<span class="note-sm push">Shift-click keeps it open</span>{/if}
	</div>
	{#if refusal !== null}
		<p class="refusal" role="alert" data-library-refusal>{refusal}</p>
	{:else if note !== null}
		<p class="kept" role="status" data-library-note>{note}</p>
	{/if}

	<div class="lb-b">
		<nav class="lb-rail" aria-label="Library kinds">
			<button
				type="button"
				class="ix parent"
				class:on={kind === 'materials'}
				aria-current={kind === 'materials' ? 'page' : undefined}
				data-library-kind="materials"
				onclick={() => selectKind('materials')}
			>
				<span class="nm">Materials</span>
				<span class="sub">{allCount}</span>
			</button>
			{#if kind === 'materials'}
				{#each categories as option (option.id)}
					<button
						type="button"
						class="ix sub2"
						class:on={category === option.id}
						aria-current={category === option.id ? 'true' : undefined}
						data-library-family={option.id}
						onclick={() => selectCategory(option.id)}
					><span class="nm">{option.label}</span></button>
				{/each}
			{/if}
			<button
				type="button"
				class="ix parent"
				class:on={kind === 'objects'}
				aria-current={kind === 'objects' ? 'page' : undefined}
				data-library-kind="objects"
				onclick={() => selectKind('objects')}
			>
				<span class="nm">Objects</span>
				<span class="sub">{objects.length}</span>
			</button>
			{#if artwork !== null}
				<button
					type="button"
					class="ix parent"
					class:on={kind === 'artwork'}
					aria-current={kind === 'artwork' ? 'page' : undefined}
					data-library-kind="artwork"
					onclick={() => selectKind('artwork')}
				>
					<span class="nm">Artwork</span>
					<span class="sub">{artwork.length}</span>
				</button>
			{/if}
			{#if looks !== null && looks.entries.length > 0}
				<button
					type="button"
					class="ix parent"
					class:on={kind === 'lights'}
					aria-current={kind === 'lights' ? 'page' : undefined}
					data-library-kind="lights"
					onclick={() => selectKind('lights')}
				>
					<span class="nm">{looks.label}</span>
					<span class="sub">{looks.entries.length}</span>
				</button>
			{/if}
		</nav>

		<div class="lb-grid-wrap">
			{#if kind === 'materials'}
				{#if cards.length === 0}
					<div class="lb-empty">
						{#if !hasProject && source === 'project'}
							<strong>No project Finishes yet.</strong>
							<span>Paint a material onto a surface, then customise it here.</span>
							<button type="button" onclick={() => { source = 'curated'; }}>Browse curated materials</button>
						{:else}
							<strong>No materials match.</strong>
							<span>Try another source, family or filter, or clear the search.</span>
							<button type="button" onclick={clearFilters}>Clear filters</button>
						{/if}
					</div>
				{:else}
					<div class="lb-grid">
						{#each groups as group (group.label ?? 'all')}
							{@const shelf = source === 'all' && needle === '' && group.label === 'This project'}
							{#if group.label !== null}
								<h3 class="lb-g">
									{group.label}<span>{group.cards.length}</span>
									{#if shelf && group.cards.length > 1}
										<button type="button" class="see" class:overflowing={group.cards.length > SHELF_MAX} data-library-see-all="project" onclick={() => { source = 'project'; selectedKey = null; }}>See all {group.cards.length} ›</button>
									{/if}
								</h3>
							{/if}
							{#if shelf}
								<div class="shelf" data-library-shelf-row>
									{#each group.cards.slice(0, SHELF_MAX) as item (item.key)}
										{@render card(item, true)}
									{/each}
								</div>
							{:else}
								{#each group.cards as item (item.key)}
									{@render card(item, false)}
								{/each}
							{/if}
						{/each}
					</div>
				{/if}
			{:else if kind === 'objects'}
				{#if filteredObjects.length === 0}
					<div class="lb-empty"><strong>No objects match.</strong><span>Clear the search to see every approved object.</span><button type="button" onclick={() => (query = '')}>Clear search</button></div>
				{:else}
					<div class="lb-grid">
						{#each filteredObjects as object (object.id)}
							<article class="mc simple">
								<button type="button" class="choose" data-library-simple data-library-object={object.id} onclick={() => onObject(object.id)}>
									<span class="th glyph" aria-hidden="true">◇</span>
									<span class="mt"><span class="mn"><span class="mnt">{object.name}</span></span><span class="ms">Approved object</span></span>
								</button>
							</article>
						{/each}
					</div>
				{/if}
			{:else if kind === 'artwork'}
				{#if filteredArtwork.length === 0}
					<div class="lb-empty">
						<strong>{artwork === null || artwork.length === 0 ? 'No artwork in this project.' : 'No artwork matches.'}</strong>
						<span>{artwork === null || artwork.length === 0 ? 'Import an image to pin it in this World.' : 'Clear the search to see every artwork.'}</span>
						{#if artwork === null || artwork.length === 0}
							<button type="button" onclick={() => artworkInput?.click()}>Import artwork</button>
						{:else}
							<button type="button" onclick={() => (query = '')}>Clear search</button>
						{/if}
					</div>
				{:else}
					<div class="lb-grid">
						{#each filteredArtwork as entry (entry.assetId)}
							<article class="mc simple">
								<button type="button" class="choose" data-library-simple data-library-artwork={entry.assetId} onclick={() => onArtwork(entry)}>
									<span class="th glyph artwork" aria-hidden="true">{entry.name.slice(0, 1).toUpperCase()}</span>
									<span class="mt"><span class="mn"><span class="mnt">{entry.name}</span></span><span class="ms">Project artwork</span></span>
								</button>
							</article>
						{/each}
					</div>
				{/if}
			{:else}
				{#if filteredLooks.length === 0}
					<div class="lb-empty"><strong>No lights match.</strong><span>Clear the search to see every light.</span><button type="button" onclick={() => (query = '')}>Clear search</button></div>
				{:else}
					<div class="lb-grid">
						{#each filteredLooks as entry (entry.id)}
							<article class="mc simple">
								<button type="button" class="choose" data-library-simple data-library-look={entry.id} onclick={() => onLook(entry.id)}>
									<span class="th glyph light" aria-hidden="true">☼</span>
									<span class="mt"><span class="mn"><span class="mnt">{entry.label}</span></span><span class="ms">{entry.summary ?? 'Place in this World'}</span></span>
								</button>
							</article>
						{/each}
					</div>
				{/if}
			{/if}
		</div>

		{#if selectedCard !== null && kind === 'materials'}
			{@const entry = selectedCard.entry}
			{@const swappable = entry.source === 'curated' && entry.curatedId !== null}
			<aside class="lb-d" aria-label={`${selectedCard.title} details`} data-library-detail={selectedCard.key}>
				<div class="lbd-h">
					<button type="button" class="back" data-library-detail-back onclick={closeDetail}>‹ Back</button>
					<div class="tt">
						<span class="k">{entry.source === 'curated' ? 'Material' : 'Finish'}</span>
						<h3>{selectedCard.title}</h3>
					</div>
					<button
						type="button"
						class="star big"
						class:on={entry.favourite}
						aria-pressed={entry.favourite}
						aria-label="Favourite"
						title={entry.favourite ? 'In your Paint tray' : 'Keep in your Paint tray'}
						onclick={() => onToggleFavourite(entry.key)}
					>★</button>
					<button type="button" class="lbd-x" aria-label="Close detail" data-library-detail-close onclick={closeDetail}>×</button>
				</div>

				<FinishInspectionView
					source={tileSource(entry)}
					color={entry.color}
					imageUri={entry.imageUri}
					label={selectedCard.title}
					materialKey={entry.key}
					settings={inspection}
					onSettings={onInspection}
				/>

				{#if selectedCard.variants.length > 0}
					<div class="detail-variants" role="group" aria-label="Variant">
						{#each selectedCard.variants as variant (variant.id)}
							<button
								type="button"
								class:on={selectedCard.variant === variant.id}
								aria-pressed={selectedCard.variant === variant.id}
								onclick={() => switchVariant(selectedCard, variant.id)}
							>{variant.label}</button>
						{/each}
					</div>
					<p class="note-sm">Two presets of one image set that differ only in sheen; the chip says which you get.</p>
				{/if}

				<dl class="facts">
					<dt>{entry.source === 'curated' ? 'Material' : 'From'}</dt>
					<dd>{entry.source === 'curated' ? entry.familyLabel : `${entry.materialLabel}${entry.changes > 0 ? ` · ${entry.changes} change${entry.changes === 1 ? '' : 's'}` : ''}`}</dd>
					<dt>Real size</dt><dd>{tileSizeOf(entry)}</dd>
					<dt>Sheen</dt><dd>{entry.reading.steps.find((step) => step.id === entry.reading.current)?.label ?? 'Custom'} · r {entry.sheen.toFixed(2)}{entry.metalness >= 0.5 ? ' · metal' : ''}</dd>
					<dt>Maps</dt><dd>{entry.hasColourImage ? 'colour · relief · sheen' : 'relief · sheen'}</dd>
					<dt>Source</dt><dd>{entry.source === 'curated' ? 'Curated · CC0 source' : 'In this project'}</dd>
					<dt>Used by</dt><dd>{entry.usage === 0 ? 'nothing' : `${entry.usage} ${entry.usage === 1 ? 'surface' : 'surfaces'}`}</dd>
					{#if entry.warning !== null}<dt class="warn">Image</dt><dd class="warn">{entry.warning}</dd>{/if}
				</dl>

				<div class="acts">
					{#if intent === 'swap'}
						<button
							type="button"
							class="btn pri"
							disabled={!swappable || working || busy}
							title={swappable ? 'Keeps its colour and sheen' : 'Swap takes a curated material.'}
							data-library-detail-primary
							onclick={(event) => choose(entry, event.shiftKey)}
						>Swap to this</button>
					{:else if intent === 'replace' && capturedTarget !== null}
						<button type="button" class="btn pri" disabled={working || busy} data-library-detail-primary onclick={(event) => choose(entry, event.shiftKey)}>Apply to {capturedTarget.label}</button>
						<button type="button" class="btn" onclick={() => onPaint(entry, false)}>Use for Paint</button>
					{:else}
						<button type="button" class="btn pri" data-library-detail-primary onclick={() => onPaint(entry, false)}>Use for Paint</button>
						{#if target !== null}
							<button
								type="button"
								class="btn"
								disabled={working || busy}
								data-library-detail-apply
								onclick={() => void run(() => onReplace(entry, false))}
							>Apply to {target.label}</button>
						{/if}
					{/if}
					<button
						type="button"
						class="btn"
						title="Open it in the Material editor as a draft — nothing is written until you apply"
						data-library-customise
						onclick={() => onCustomise(entry)}
					>Customise…</button>
					{#if entry.usage > 0}
						<button type="button" class="btn ghost" disabled={working} onclick={() => void selectUsers(entry)}>Select all {entry.usage}</button>
					{/if}
				</div>
			</aside>
		{/if}
	</div>
</div>

<style>
	/*
		The Library is bounded to the usable Stage: between the visible Index lane
		(--index-cover on desktop, --library-index-cover where the Index floats) and the Card lane (--card-cover: the span from
		the Stage's right edge to a shown Card's left edge, set by the route), above the dock's measured lower column, with
		a band of Stage left above it. It starts near 900 × 560 and shrinks to the
		lanes; its bounds never depend on what is open inside it.
	*/
	.scrim,
	.library {
		--lane-l: calc(var(--library-index-cover, var(--index-cover, 0px)) + var(--sheet-lane-left, 0px));
		--lane-r: max(var(--card-cover, 0px), var(--sheet-lane-right, 0px));
		--lane-b: var(--lower-column-height, 168px);
	}
	.scrim {
		position: absolute;
		top: 0;
		left: var(--lane-l);
		right: var(--lane-r);
		bottom: calc(var(--lane-b) + 4px);
		z-index: 50;
		/* Outside-click only: the Stage is never dimmed; the panel's own shadow separates it. */
		background: transparent;
		border: 0;
		padding: 0;
	}
	.library {
		--lib-w: min(900px, calc(100% - var(--lane-l) - var(--lane-r) - 24px));
		position: absolute;
		z-index: 51;
		width: var(--lib-w);
		height: min(560px, calc(100% - var(--lane-b) - 12px - 96px));
		left: calc(var(--lane-l) + (100% - var(--lane-l) - var(--lane-r) - var(--lib-w)) / 2);
		bottom: calc(var(--lane-b) + 12px);
		box-sizing: border-box;
		display: grid;
		grid-template-rows: auto auto auto minmax(0, 1fr);
		min-height: 0;
		color: var(--shell-ink);
		background: var(--shell-card);
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 14px;
		box-shadow: 0 14px 40px color-mix(in srgb, var(--shell-forest) 26%, transparent);
		overflow: hidden;
		container: library / inline-size;
	}
	.library:focus { outline: none; }
	.lb-h {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px 8px;
		min-width: 0;
	}
	.lb-t { margin: 0; font-size: 14px; white-space: nowrap; }
	.search { position: relative; flex: 1; min-width: 120px; }
	.search input {
		width: 100%;
		box-sizing: border-box;
		padding: 7px 28px 7px 12px;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 999px;
		font: inherit;
		font-size: 13px;
		background: var(--shell-ivory);
		color: inherit;
	}
	.search input:focus-visible { outline: 2px solid var(--shell-forest); border-color: var(--shell-forest); }
	.clear-search {
		position: absolute;
		right: 6px;
		top: 50%;
		transform: translateY(-50%);
		border: 0;
		background: transparent;
		color: var(--shell-ink-2);
		font-size: 16px;
		cursor: pointer;
	}
	.sources {
		display: inline-flex;
		flex: none;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 8px;
		overflow: hidden;
	}
	.sources button {
		border: 0;
		border-right: 1px solid var(--shell-hairline);
		background: transparent;
		color: var(--shell-ink-2);
		font: inherit;
		font-size: 12px;
		padding: 6px 10px;
		cursor: pointer;
		white-space: nowrap;
		min-height: 30px;
	}
	.sources button:last-child { border-right: 0; }
	.sources button span { margin-left: 5px; font-size: 10px; opacity: 0.65; }
	.sources button.on { background: var(--shell-forest); color: var(--shell-ivory); }
	.sources-menu { display: none; flex: none; }
	.sources-menu select {
		font: inherit;
		font-size: 12px;
		min-height: 30px;
		padding: 4px 8px;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 8px;
		background: var(--shell-card);
		color: var(--shell-ink);
	}
	.sources-menu select:focus-visible { outline: 2px solid var(--shell-forest); }
	.lb-x, .lbd-x {
		border: 0;
		background: transparent;
		color: var(--shell-ink);
		font-size: 20px;
		line-height: 1;
		width: 30px;
		height: 30px;
		border-radius: 8px;
		cursor: pointer;
		flex: none;
	}
	.lb-x:hover, .lbd-x:hover { background: var(--shell-paper); }
	.lb-f {
		display: flex;
		gap: 6px;
		padding: 0 12px 8px;
		flex-wrap: wrap;
		align-items: center;
		border-bottom: 1px solid var(--shell-hairline);
	}
	.ctx { font-size: 12px; color: var(--shell-ink-2); margin-right: 4px; }
	.ctx b { color: var(--shell-ink); }
	.push { margin-left: auto; }
	.note-sm { font-size: 11px; color: var(--shell-ink-2); margin: 0; }
	.fchip {
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 999px;
		background: transparent;
		color: var(--shell-ink-2);
		font: inherit;
		font-size: 11px;
		padding: 3px 9px;
		cursor: pointer;
		white-space: nowrap;
	}
	.fchip[aria-pressed='true'] { background: var(--shell-forest); border-color: var(--shell-forest); color: var(--shell-ivory); }
	.fchip.clear { text-decoration: underline; color: var(--shell-ink); }
	.refusal, .kept { margin: 0; padding: 6px 12px; font-size: 12px; border-bottom: 1px solid var(--shell-hairline); }
	.refusal { color: var(--shell-refuse); background: var(--shell-refuse-bg); }
	.kept { color: var(--shell-ink-2); }
	.lb-b {
		position: relative;
		display: grid;
		grid-template-columns: 176px minmax(0, 1fr);
		min-height: 0;
	}
	.library.with-detail .lb-b { grid-template-columns: 176px minmax(0, 1fr) minmax(260px, 300px); }
	.lb-rail {
		border-right: 1px solid var(--shell-hairline);
		overflow: auto;
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.ix {
		all: unset;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 4px 6px;
		border-radius: 7px;
		cursor: pointer;
		color: var(--shell-ink);
		font-size: 12.5px;
		min-height: 28px;
	}
	.ix:hover { background: var(--shell-paper); }
	.ix:focus-visible { outline: 2px solid var(--shell-forest); outline-offset: -2px; }
	.ix .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.ix .sub { font-size: 10.5px; color: var(--shell-ink-2); }
	.ix.parent.on { font-weight: 600; }
	.ix.sub2 { padding-left: 22px; min-height: 24px; font-size: 12px; color: var(--shell-ink-2); }
	.ix.sub2.on { color: var(--shell-ink); background: color-mix(in srgb, var(--shell-gold, #c9a54a) 18%, transparent); }
	.lb-grid-wrap { overflow: auto; min-height: 0; container: grid / inline-size; }
	.lb-grid {
		padding: 12px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(124px, 1fr));
		gap: 12px;
		align-content: start;
		grid-auto-rows: max-content;
	}
	/*
		One row of the project's own Finishes; the rest are a See all away. The grid
		fits floor((w - 12) / 136) columns of 124 px + 12 px gap in a wrap w wide, so
		each step hides the cards past one row with display: none (out of the Tab
		order) and shows See all only when something is hidden.
	*/
	.shelf {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(124px, 1fr));
		column-gap: 12px;
	}
	.lb-g .see { display: none; }
	.lb-g .see.overflowing { display: inline; }
	@container grid (width < 1100px) {
		.shelf > :nth-child(n + 8) { display: none; }
		.lb-grid:has(.shelf > :nth-child(8)) .see { display: inline; }
	}
	@container grid (width < 964px) {
		.shelf > :nth-child(n + 7) { display: none; }
		.lb-grid:has(.shelf > :nth-child(7)) .see { display: inline; }
	}
	@container grid (width < 828px) {
		.shelf > :nth-child(n + 6) { display: none; }
		.lb-grid:has(.shelf > :nth-child(6)) .see { display: inline; }
	}
	@container grid (width < 692px) {
		.shelf > :nth-child(n + 5) { display: none; }
		.lb-grid:has(.shelf > :nth-child(5)) .see { display: inline; }
	}
	@container grid (width < 556px) {
		.shelf > :nth-child(n + 4) { display: none; }
		.lb-grid:has(.shelf > :nth-child(4)) .see { display: inline; }
	}
	@container grid (width < 420px) {
		.shelf > :nth-child(n + 3) { display: none; }
		.lb-grid:has(.shelf > :nth-child(3)) .see { display: inline; }
	}
	@container grid (width < 284px) {
		.shelf > :nth-child(n + 2) { display: none; }
		.lb-grid:has(.shelf > :nth-child(2)) .see { display: inline; }
	}
	.lb-g {
		grid-column: 1 / -1;
		margin: 2px 0 -4px;
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--shell-ink-2);
		display: flex;
		gap: 6px;
		align-items: baseline;
	}
	.lb-g .see {
		margin-left: auto;
		border: 0;
		background: transparent;
		color: var(--shell-forest);
		font: inherit;
		font-size: 12px;
		letter-spacing: 0;
		text-transform: none;
		text-decoration: underline;
		cursor: pointer;
	}
	.mc {
		position: relative;
		display: flex;
		flex-direction: column;
		border-radius: 12px;
		border: 1px solid var(--shell-hairline-strong);
		background: var(--shell-card);
		overflow: hidden;
		transition: box-shadow 0.12s, border-color 0.12s;
	}
	.mc:hover { border-color: var(--shell-forest); box-shadow: 0 2px 10px color-mix(in srgb, var(--shell-forest) 12%, transparent); }
	.mc.open { border-color: var(--shell-forest); box-shadow: 0 0 0 1px var(--shell-forest); }
	.mc.blocked .th { filter: grayscale(0.6); opacity: 0.7; }
	.choose {
		all: unset;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		cursor: pointer;
		width: 100%;
	}
	.choose:focus-visible { outline: 2px solid var(--shell-forest); outline-offset: -2px; border-radius: 12px; }
	.choose:disabled { cursor: progress; }
	.th {
		display: block;
		aspect-ratio: 1 / 1;
		background: #e9e6dd;
		position: relative;
		overflow: hidden;
	}
	.th :global(*) { width: 100% !important; height: 100% !important; border-radius: 0 !important; }
	.th.glyph { display: grid; place-items: center; font-size: 28px; color: var(--shell-ink-2); }
	.mt { padding: 6px 8px 8px; display: grid; gap: 1px; align-content: start; min-height: 47px; }
	.mn { font-size: 12.5px; font-weight: 600; line-height: 1.25; display: flex; align-items: flex-start; gap: 5px; }
	.mnt { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; }
	.edm { width: 7px; height: 7px; margin-top: 5px; border-radius: 50%; background: var(--shell-gold, #c9a54a); flex: none; }
	.ms { font-size: 11px; color: var(--shell-ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.mc .star, .mc .xp, .mc .users {
		position: absolute;
		border: 0;
		background: rgb(255 255 255 / 92%);
		box-shadow: 0 1px 3px rgb(18 38 29 / 20%);
		cursor: pointer;
		display: grid;
		place-items: center;
		font: inherit;
	}
	.mc .star { left: 6px; top: 6px; width: 26px; height: 26px; border-radius: 8px; color: var(--shell-ink-2); font-size: 13px; }
	.mc .star.on { color: #b8892a; }
	.mc .xp { right: 6px; top: 6px; width: 26px; height: 26px; border-radius: 8px; color: var(--shell-forest); font-size: 14px; }
	.mc .users {
		right: 6px;
		top: calc(min(100%, 1px) * 0 + 6px + 26px + 4px);
		height: 22px;
		min-width: 26px;
		padding: 0 7px;
		border-radius: 999px;
		font-size: 11px;
		color: var(--stage-proposal);
	}
	.mc .star:focus-visible, .mc .xp:focus-visible, .mc .users:focus-visible { outline: 2px solid var(--shell-forest); }
	.vchips { position: absolute; left: 6px; top: calc(6px + 26px + 4px); display: flex; gap: 4px; }
	.vchips button {
		font-size: 10px;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 999px;
		padding: 1px 7px;
		color: var(--shell-ink-2);
		background: rgb(255 255 255 / 92%);
		cursor: pointer;
	}
	.vchips button.on { background: var(--shell-forest); color: var(--shell-ivory); border-color: var(--shell-forest); }
	.lb-empty {
		display: grid;
		gap: 6px;
		justify-items: center;
		color: var(--shell-ink-2);
		padding: 30px;
		text-align: center;
		font-size: 12px;
	}
	.lb-empty strong { color: var(--shell-ink); }
	.lb-empty button, .btn {
		border: 1px solid var(--shell-hairline-strong);
		background: var(--shell-card);
		color: var(--shell-ink);
		border-radius: 7px;
		padding: 6px 11px;
		font: inherit;
		font-size: 12px;
		min-height: 30px;
		cursor: pointer;
	}
	.btn.sm { padding: 5px 9px; font-size: 11px; white-space: nowrap; }
	.btn.pri { background: var(--shell-forest); border-color: var(--shell-forest); color: var(--shell-ivory); }
	.btn.ghost { border-color: transparent; text-decoration: underline; }
	.btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn:focus-visible { outline: 2px solid var(--shell-forest); outline-offset: 1px; }
	.lb-d {
		border-left: 1px solid var(--shell-hairline);
		overflow: auto;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		background: var(--shell-ivory);
		min-height: 0;
	}
	.lb-d > :global(*) { flex: none; }
	.lbd-h { display: flex; gap: 6px; align-items: flex-start; }
	.back {
		display: none;
		flex: none;
		border: 1px solid var(--shell-hairline-strong);
		background: var(--shell-card);
		color: var(--shell-ink);
		border-radius: 7px;
		padding: 4px 9px;
		font: inherit;
		font-size: 12px;
		min-height: 30px;
		cursor: pointer;
	}
	.back:focus-visible { outline: 2px solid var(--shell-forest); }
	.tt { flex: 1; min-width: 0; }
	.k { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--shell-ink-2); }
	.tt h3 { margin: 0; font-size: 16px; overflow-wrap: anywhere; }
	.star.big {
		border: 1px solid var(--shell-hairline-strong);
		background: var(--shell-card);
		width: 30px;
		height: 30px;
		border-radius: 8px;
		cursor: pointer;
		color: var(--shell-ink-2);
	}
	.star.big.on { color: #b8892a; }
	.detail-variants { display: flex; gap: 4px; }
	.detail-variants button {
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 999px;
		padding: 3px 10px;
		font-size: 11px;
		background: transparent;
		color: var(--shell-ink-2);
		cursor: pointer;
	}
	.detail-variants button.on { background: var(--shell-forest); color: var(--shell-ivory); border-color: var(--shell-forest); }
	.facts { display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; font-size: 12px; margin: 0; }
	.facts dt { color: var(--shell-ink-2); }
	.facts dd { margin: 0; overflow-wrap: anywhere; }
	.facts .warn { color: var(--shell-caution); }
	.acts { display: flex; gap: 6px; flex-wrap: wrap; }
	.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

	/* Not room for rail, grid and inspector: the rail folds into a row and the sources into a menu. */
	@container library (width < 780px) {
		.lb-b { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
		.library.with-detail .lb-b { grid-template-columns: minmax(0, 1fr) minmax(250px, 280px); grid-template-rows: auto minmax(0, 1fr); }
		.lb-rail {
			grid-column: 1 / -1;
			flex-direction: row;
			overflow-x: auto;
			border-right: 0;
			border-bottom: 1px solid var(--shell-hairline);
			padding: 6px 8px;
			gap: 4px;
		}
		.ix { width: auto; flex: none; }
		.ix.sub2 { padding-left: 8px; }
		.sources { display: none; }
		.sources-menu { display: block; }
	}
	/*
		Not room for grid and inspector side by side: detail becomes an in-panel view
		with Back over the same bounds; the browse behind it leaves the Tab order.
	*/
	@container library (width < 600px) {
		.library.with-detail .lb-b { grid-template-columns: minmax(0, 1fr); }
		.library.with-detail .lb-rail,
		.library.with-detail .lb-grid-wrap { visibility: hidden; }
		.lb-d {
			position: absolute;
			inset: 0;
			z-index: 2;
			border-left: 0;
		}
		.back { display: inline-flex; align-items: center; }
	}
	/* Portrait: a bottom sheet above the dock, the upper third of the usable Stage left visible. */
	@media (max-width: 860px) {
		.scrim { left: 0; right: var(--card-cover, 0px); }
		.library {
			--lib-w: 100%;
			left: 0;
			width: 100%;
			bottom: var(--lane-b);
			height: calc((100% - var(--lane-b)) * 2 / 3);
			border-radius: 16px 16px 0 0;
		}
		.lb-h { flex-wrap: wrap; }
		.search { order: 3; flex-basis: 100%; }
	}
	@media (pointer: coarse) {
		.ix, .fchip, .sources button, .btn, .lb-empty button { min-height: 44px; }
		.mc .star, .mc .xp { width: 36px; height: 36px; }
		.lb-x, .lbd-x { width: 44px; height: 44px; }
	}
</style>

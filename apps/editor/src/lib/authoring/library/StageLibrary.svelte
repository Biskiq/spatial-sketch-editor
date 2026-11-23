<script lang="ts">
	/**
	 * The professional Library sheet (T2.S8 U5).
	 *
	 * One route-level surface above the Stage: a kind rail, sources, family and
	 * attribute filters, a searchable grid, and a detail pane that inspects one
	 * Finish before any action. Cards and the detail use `FinishTile` only, so
	 * opening the Library leases 256 px masters or a project's retained preview,
	 * never a full-resolution catalogue texture.
	 *
	 * Nothing here writes. *Use for Paint* arms; *Select all* selects; *Apply*
	 * hands one explicit action to the route's authoring host; *Customise…* opens
	 * a local draft whose Apply is the one write. U6 replaces the draft control,
	 * and U7 owns saving a Finish to the private Library.
	 */
	import { onMount } from 'svelte';
	import type { ArtworkLibraryEntry, MaterialId } from '@portfolio/project-model';
	import FinishTile from '$lib/authoring/look/FinishTile.svelte';
	import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';
	import type { LookLibraryShelf } from '$lib/authoring/look/look-authoring.svelte';
	import {
		LIBRARY_FILTERS,
		LIBRARY_SOURCES,
		browseLibrary,
		libraryCardsOf,
		libraryCategoryOptions,
		librarySourceCount,
		type LibraryCategory,
		type LibraryFilter,
		type LibraryFinishEntry,
		type LibrarySource
	} from './library-catalogue';
	import type { LibraryDraft } from './library-draft';
	import type { LibraryTarget } from './library-target';

	type LibraryKind = 'materials' | 'objects' | 'artwork' | 'lights';

	type DraftStatus = {
		readonly active: boolean;
		readonly canApply: boolean;
		readonly changed: boolean;
		readonly targetLabel: string | null;
		readonly reason: string | null;
	};

	let {
		entries,
		target = null,
		draft = null,
		draftStatus,
		busy = false,
		tileSource,
		objects = [],
		artwork = null,
		looks = null,
		onClose,
		onUse,
		onApply,
		onSelectUsers,
		onCustomise,
		onDraftStep,
		onDraftApply,
		onDraftCancel,
		onToggleFavourite,
		onObject,
		onArtwork,
		onArtworkImport,
		onLook
	}: {
		entries: readonly LibraryFinishEntry[];
		target?: LibraryTarget | null;
		draft?: LibraryDraft | null;
		draftStatus: DraftStatus;
		busy?: boolean;
		tileSource: (entry: LibraryFinishEntry) => FinishTileSource | null;
		objects?: readonly { readonly id: string; readonly name: string }[];
		artwork?: readonly ArtworkLibraryEntry[] | null;
		looks?: LookLibraryShelf | null;
		onClose: () => void;
		onUse: (entry: LibraryFinishEntry, keepOpen: boolean) => void;
		onApply: (entry: LibraryFinishEntry) => Promise<boolean>;
		onSelectUsers: (entry: LibraryFinishEntry) => Promise<boolean>;
		onCustomise: (entry: LibraryFinishEntry) => void;
		onDraftStep: (step: LibraryDraft['step']) => void;
		onDraftApply: () => Promise<boolean>;
		onDraftCancel: () => void;
		onToggleFavourite: (key: string) => void;
		onObject: (assetId: string) => void;
		onArtwork: (entry: ArtworkLibraryEntry) => void;
		onArtworkImport: (files: File[]) => void;
		onLook: (id: string) => void;
	} = $props();

	let kind = $state<LibraryKind>('materials');
	let source = $state<LibrarySource>('all');
	let category = $state<LibraryCategory>('all');
	let filters = $state<ReadonlySet<LibraryFilter>>(new Set());
	let query = $state('');
	let selectedKey = $state<string | null>(null);
	let variantChoice = $state<Record<string, MaterialId>>({});
	let applying = $state(false);
	let selecting = $state(false);
	let draftApplying = $state(false);
	let searchEl = $state<HTMLInputElement>();
	let sectionEl = $state<HTMLElement>();
	let artworkInput = $state<HTMLInputElement>();

	const groups = $derived(
		browseLibrary(entries, { source, category, filters, query }, variantChoice)
	);
	const cards = $derived(libraryCardsOf(groups));
	const selectedCard = $derived(cards.find((card) => card.key === selectedKey) ?? null);
	const categories = $derived(libraryCategoryOptions(entries, source));
	const curatedCount = $derived(librarySourceCount(entries, 'curated', variantChoice));
	const projectCount = $derived(librarySourceCount(entries, 'project'));
	const allCount = $derived(librarySourceCount(entries, 'all', variantChoice));
	const hasProject = $derived(entries.some((entry) => entry.source === 'project'));
	const draftOnSelected = $derived(
		draft !== null && selectedCard !== null && draft.finishKey === selectedCard.entry.key
	);

	const filteredObjects = $derived(
		objects.filter((object) => object.name.toLowerCase().includes(query.trim().toLowerCase()))
	);
	const filteredArtwork = $derived(
		(artwork ?? []).filter((entry) => entry.name.toLowerCase().includes(query.trim().toLowerCase()))
	);
	const filteredLooks = $derived(
		(looks?.entries ?? []).filter((entry) =>
			`${entry.label} ${entry.summary ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())
		)
	);

	// A selected card that a filter hides closes its detail rather than
	// pointing at nothing.
	$effect(() => {
		if (selectedKey !== null && !cards.some((card) => card.key === selectedKey)) {
			selectedKey = null;
		}
	});

	$effect(() => {
		if (!categories.some((option) => option.id === category)) category = 'all';
	});

	onMount(() => {
		const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		searchEl?.focus();
		return () => previous?.focus();
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
	}

	function selectCard(cardKey: string): void {
		selectedKey = selectedKey === cardKey ? null : cardKey;
	}

	function switchVariant(card: (typeof cards)[number], id: MaterialId): void {
		if (card.primary === null) return;
		variantChoice = { ...variantChoice, [card.primary]: id };
	}

	function pickStep(card: (typeof cards)[number]): void {
		selectedKey = card.key;
		onCustomise(card.entry);
	}

	async function apply(entry: LibraryFinishEntry): Promise<void> {
		if (applying || busy) return;
		applying = true;
		try {
			await onApply(entry);
		} finally {
			applying = false;
		}
	}

	async function selectUsers(entry: LibraryFinishEntry): Promise<void> {
		if (selecting) return;
		selecting = true;
		try {
			await onSelectUsers(entry);
		} finally {
			selecting = false;
		}
	}

	async function applyDraft(): Promise<void> {
		if (draftApplying || busy) return;
		draftApplying = true;
		try {
			await onDraftApply();
		} finally {
			draftApplying = false;
		}
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
		).filter((element) => element.offsetParent !== null);
	}

	function onKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			if (draft !== null) {
				onDraftCancel();
				return;
			}
			if (selectedKey !== null) {
				selectedKey = null;
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

	function canCustomise(entry: LibraryFinishEntry): boolean {
		return entry.reading.steps.some((step) => !step.disabled && step.id !== entry.reading.current);
	}

	function stepWash(id: LibraryDraft['step']): string {
		if (id === 'matte') return 'color-mix(in srgb, #0b120e 26%, transparent)';
		if (id === 'satin') return 'color-mix(in srgb, #ffffff 6%, transparent)';
		return 'color-mix(in srgb, #ffffff 24%, transparent)';
	}
</script>

<button class="scrim" type="button" tabindex="-1" aria-label="Close Library" onclick={onClose}></button>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<section
	class="library"
	bind:this={sectionEl}
	role="dialog"
	aria-modal="true"
	aria-labelledby="library-title"
	onkeydown={onKeydown}
>
	<header class="head">
		<div class="title-row">
			<h2 id="library-title">Library</h2>
			<span class="context">
				{kind === 'materials' ? `${curatedCount} curated · ${projectCount} in this project` : ''}
			</span>
			{#if draft !== null}
				<span class="draft-pill">
					Draft · {draft.name}
					<button type="button" aria-label="Discard draft" onclick={onDraftCancel}>×</button>
				</span>
			{/if}
			<button type="button" class="close" aria-label="Close Library" onclick={onClose}>Close</button>
		</div>

		<div class="search-row">
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
							onclick={() => { source = option.id; selectedKey = null; }}
						>
							{option.label}
							<span>{option.id === 'all' ? allCount : option.id === 'curated' ? curatedCount : projectCount}</span>
						</button>
					{/each}
				</div>
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
				<button type="button" class="import" onclick={() => artworkInput?.click()}>+ Import artwork</button>
			{/if}
		</div>

		{#if kind === 'materials'}
			<div class="filter-row" aria-label="Filter materials">
				{#each categories as option (option.id)}
					<button
						type="button"
						class="chip family"
						class:on={category === option.id}
						aria-pressed={category === option.id}
						onclick={() => { category = option.id; selectedKey = null; }}
					>{option.label}</button>
				{/each}
				<span class="divide" aria-hidden="true"></span>
				{#each LIBRARY_FILTERS as option (option.id)}
					<button
						type="button"
						class="chip"
						class:on={filters.has(option.id)}
						aria-pressed={filters.has(option.id)}
						onclick={() => toggleFilter(option.id)}
					>{option.label}</button>
				{/each}
				{#if filters.size > 0 || category !== 'all' || query !== ''}
					<button type="button" class="chip clear" onclick={clearFilters}>Clear</button>
				{/if}
			</div>
		{/if}
	</header>

	<div class="body">
		<nav class="rail" aria-label="Library kinds">
			<button
				type="button"
				class:on={kind === 'materials'}
				aria-current={kind === 'materials' ? 'page' : undefined}
				onclick={() => selectKind('materials')}
			>
				<span class="rail-name">Materials</span>
				<span class="rail-count">{allCount}</span>
			</button>
			<button
				type="button"
				class:on={kind === 'objects'}
				aria-current={kind === 'objects' ? 'page' : undefined}
				onclick={() => selectKind('objects')}
			>
				<span class="rail-name">Objects</span>
				<span class="rail-count">{objects.length}</span>
			</button>
			{#if artwork !== null}
				<button
					type="button"
					class:on={kind === 'artwork'}
					aria-current={kind === 'artwork' ? 'page' : undefined}
					onclick={() => selectKind('artwork')}
				>
					<span class="rail-name">Artwork</span>
					<span class="rail-count">{artwork.length}</span>
				</button>
			{/if}
			{#if looks !== null && looks.entries.length > 0}
				<button
					type="button"
					class:on={kind === 'lights'}
					aria-current={kind === 'lights' ? 'page' : undefined}
					onclick={() => selectKind('lights')}
				>
					<span class="rail-name">{looks.label}</span>
					<span class="rail-count">{looks.entries.length}</span>
				</button>
			{/if}
			<p class="rail-note">Materials you customise are saved in this project.</p>
		</nav>

		<div class="browse" class:with-detail={selectedCard !== null}>
			{#if kind === 'materials'}
				{#if cards.length === 0}
					<div class="empty">
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
					{#each groups as group (group.label ?? 'all')}
						{#if group.label !== null}
							<h3 class="group">{group.label}<span>{group.cards.length}</span></h3>
						{/if}
						<div class="grid">
							{#each group.cards as card (card.key)}
								<article class="card" class:on={selectedKey === card.key}>
									<button
										type="button"
										class="card-open"
										aria-pressed={selectedKey === card.key}
										aria-label={`${card.title}${card.variant === null ? '' : `, ${card.variants.find((variant) => variant.id === card.variant)?.label ?? ''}`}`}
										onclick={() => selectCard(card.key)}
									>
										<span class="thumb">
											<FinishTile
												source={tileSource(card.entry)}
												color={card.entry.color}
												imageUri={card.entry.imageUri}
												size={92}
											/>
											{#if card.entry.usage > 0}
												<span class="used" title={`Used by ${card.entry.usage}`}>{card.entry.usage}</span>
											{/if}
											{#if card.entry.source === 'project'}
												<span class="project-mark">Project</span>
											{/if}
										</span>
										<span class="name">{card.title}</span>
										<span class="meta">{card.entry.subline}</span>
									</button>
									<button
										type="button"
										class="star"
										class:on={card.entry.favourite}
										aria-label={card.entry.favourite ? `Remove ${card.title} from favourites` : `Add ${card.title} to favourites`}
										aria-pressed={card.entry.favourite}
										onclick={() => onToggleFavourite(card.entry.key)}
									>★</button>
									{#if card.variants.length > 0}
										<div class="variants" role="group" aria-label={`${card.title} variant`}>
											{#each card.variants as variant (variant.id)}
												<button
													type="button"
													class:on={card.variant === variant.id}
													aria-pressed={card.variant === variant.id}
													onclick={() => switchVariant(card, variant.id)}
												>{variant.label}</button>
											{/each}
										</div>
									{/if}
								</article>
							{/each}
						</div>
					{/each}
				{/if}
			{:else if kind === 'objects'}
				{#if filteredObjects.length === 0}
					<div class="empty"><strong>No objects match.</strong><span>Clear the search to see every approved object.</span><button type="button" onclick={() => (query = '')}>Clear search</button></div>
				{:else}
					<div class="grid plain">
						{#each filteredObjects as object (object.id)}
							<article class="simple-card">
								<button type="button" class="simple-open" onclick={() => onObject(object.id)}>
									<span class="glyph" aria-hidden="true">◇</span>
									<span class="name">{object.name}</span>
									<span class="meta">Approved object</span>
								</button>
							</article>
						{/each}
					</div>
				{/if}
			{:else if kind === 'artwork'}
				{#if filteredArtwork.length === 0}
					<div class="empty">
						<strong>{artwork === null || artwork.length === 0 ? 'No artwork in this project.' : 'No artwork matches.'}</strong>
						<span>{artwork === null || artwork.length === 0 ? 'Import an image to pin it in this World.' : 'Clear the search to see every artwork.'}</span>
						{#if artwork === null || artwork.length === 0}
							<button type="button" onclick={() => artworkInput?.click()}>Import artwork</button>
						{:else}
							<button type="button" onclick={() => (query = '')}>Clear search</button>
						{/if}
					</div>
				{:else}
					<div class="grid plain">
						{#each filteredArtwork as entry (entry.assetId)}
							<article class="simple-card">
								<button type="button" class="simple-open" onclick={() => onArtwork(entry)}>
									<span class="glyph artwork" aria-hidden="true">{entry.name.slice(0, 1).toUpperCase()}</span>
									<span class="name">{entry.name}</span>
									<span class="meta">Project artwork</span>
								</button>
							</article>
						{/each}
					</div>
				{/if}
			{:else}
				{#if filteredLooks.length === 0}
					<div class="empty"><strong>No lights match.</strong><span>Clear the search to see every light.</span><button type="button" onclick={() => (query = '')}>Clear search</button></div>
				{:else}
					<div class="grid plain">
						{#each filteredLooks as entry (entry.id)}
							<article class="simple-card">
								<button type="button" class="simple-open" onclick={() => onLook(entry.id)}>
									<span class="glyph light" aria-hidden="true">☼</span>
									<span class="name">{entry.label}</span>
									<span class="meta">{entry.summary ?? 'Place in this World'}</span>
								</button>
							</article>
						{/each}
					</div>
				{/if}
			{/if}
		</div>

		{#if selectedCard !== null}
			<aside class="detail" aria-label={`${selectedCard.title} details`}>
				<div class="detail-head">
					<span class="eyebrow">{selectedCard.entry.source === 'curated' ? 'Curated material' : 'Project Finish'}</span>
					<button type="button" class="detail-close" aria-label="Close details" onclick={() => (selectedKey = null)}>×</button>
				</div>
				<h3>{selectedCard.title}</h3>
				<div class="detail-art">
					<FinishTile
						source={tileSource(selectedCard.entry)}
						color={selectedCard.entry.color}
						imageUri={selectedCard.entry.imageUri}
						size={168}
					/>
					{#if draftOnSelected && draft !== null}
						<span class="draft-wash" style:background={stepWash(draft.step)}></span>
						<span class="draft-mark">Draft preview</span>
					{/if}
				</div>

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
				{/if}

				<dl class="facts">
					<div><dt>Base</dt><dd>{selectedCard.entry.materialLabel}</dd></div>
					<div><dt>Family</dt><dd>{selectedCard.entry.familyLabel}</dd></div>
					<div><dt>Sheen</dt><dd>{selectedCard.entry.sheen.toFixed(2)} effective</dd></div>
					<div><dt>Metal</dt><dd>{Math.round(selectedCard.entry.metalness * 100)}%</dd></div>
					<div><dt>Used by</dt><dd>{selectedCard.entry.usage} {selectedCard.entry.usage === 1 ? 'surface' : 'surfaces'}</dd></div>
					{#if selectedCard.entry.changes > 0}
						<div><dt>Changes</dt><dd>{selectedCard.entry.changes}</dd></div>
					{/if}
					{#if selectedCard.entry.warning !== null}
						<div class="warn"><dt>Image</dt><dd>{selectedCard.entry.warning}</dd></div>
					{/if}
				</dl>

				<div class="target-note">
					{#if target === null}
						No object or surface selected.
					{:else}
						Selection · <strong>{target.label}</strong>
					{/if}
				</div>

				<div class="actions">
					<button
						type="button"
						class="primary"
						disabled={applying || busy}
						onclick={(event) => onUse(selectedCard.entry, event.shiftKey)}
					>Use for Paint <kbd>Shift</kbd> keeps open</button>
					<button
						type="button"
						disabled={applying || busy || target === null}
						title={target === null ? 'Select an object or surface first.' : `Apply to ${target.label}`}
						onclick={() => void apply(selectedCard!.entry)}
					>{applying ? 'Applying…' : target === null ? 'Apply to selection' : `Apply to ${target.label}`}</button>
					{#if selectedCard.entry.usage > 0}
						<button type="button" class="ghost" disabled={selecting} onclick={() => void selectUsers(selectedCard!.entry)}>
							{selecting ? 'Selecting…' : `Select all ${selectedCard.entry.usage}`}
						</button>
					{/if}
					<button
						type="button"
						class="ghost"
						disabled={busy || !canCustomise(selectedCard.entry)}
						title={canCustomise(selectedCard.entry) ? 'Open a draft with another sheen' : 'No other sheen is reachable for this material.'}
						onclick={() => pickStep(selectedCard!)}
					>Customise…</button>
					<button
						type="button"
						class="ghost star-wide"
						aria-pressed={selectedCard.entry.favourite}
						onclick={() => onToggleFavourite(selectedCard!.entry.key)}
					>{selectedCard.entry.favourite ? '★ Favourite' : '☆ Favourite'}</button>
				</div>

				{#if draftOnSelected && draft !== null}
					<section class="draft" aria-label="Draft">
						<header>
							<strong>Draft</strong>
							<span>Preview only · nothing written</span>
						</header>
						<p class="draft-line">Sheen for <strong>{draft.name}</strong></p>
						<div class="steps" role="group" aria-label="Draft sheen">
							{#each draft.reading.steps as step (step.id)}
								<button
									type="button"
									disabled={step.disabled}
									class:on={draft.step === step.id}
									aria-pressed={draft.step === step.id}
									title={step.disabled ? 'This step is rougher than the base image can reach.' : `${step.label} sheen`}
									onclick={() => onDraftStep(step.id)}
								>{step.label}</button>
							{/each}
						</div>
						<button
							type="button"
							class="primary draft-apply"
							disabled={!draftStatus.canApply || draftApplying || busy}
							onclick={() => void applyDraft()}
						>{draftApplying ? 'Applying…' : draftStatus.targetLabel === null ? 'Apply to selection' : `Apply to ${draftStatus.targetLabel}`}</button>
						{#if draftStatus.reason !== null}
							<p class="reason">{draftStatus.reason}</p>
						{:else}
							<p class="reason ok">One edit · one Undo. {draftStatus.changed ? '' : 'Choose a different sheen.'}</p>
						{/if}
						<button type="button" class="discard" onclick={onDraftCancel}>Discard draft</button>
					</section>
				{/if}

				<p class="hint">Sample tile at Library size; the full-resolution map is never loaded just to browse.</p>
			</aside>
		{/if}
	</div>
</section>

<style>
	.scrim {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: calc(var(--lower-column-height, 168px) + 12px);
		z-index: 50;
		background: color-mix(in srgb, var(--shell-forest) 22%, transparent);
		border: 0;
	}
	.library {
		position: absolute;
		z-index: 51;
		top: 12px;
		left: 12px;
		right: 12px;
		bottom: calc(var(--lower-column-height, 168px) + 12px);
		display: flex;
		flex-direction: column;
		min-height: 0;
		color: var(--shell-ink);
		background: var(--shell-card);
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 12px;
		box-shadow: 0 18px 50px color-mix(in srgb, var(--shell-forest) 30%, transparent);
		overflow: hidden;
	}
	.head {
		flex: none;
		padding: 12px 14px 8px;
		border-bottom: 1px solid var(--shell-hairline);
		background: var(--shell-ivory);
	}
	.title-row {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 28px;
	}
	h2 {
		margin: 0;
		font-size: 15px;
		letter-spacing: 0.01em;
	}
	.context {
		font-size: 11px;
		color: var(--shell-ink-2);
	}
	.draft-pill {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 4px 2px 8px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--shell-forest) 10%, transparent);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.draft-pill button {
		border: 0;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font-size: 14px;
		padding: 0 3px;
	}
	.close {
		margin-left: auto;
		border: 1px solid var(--shell-hairline-strong);
		background: transparent;
		color: var(--shell-ink);
		border-radius: 6px;
		padding: 4px 10px;
		font-size: 11px;
		cursor: pointer;
	}
	.close:hover {
		background: var(--shell-paper);
	}
	.search-row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 8px;
	}
	.search {
		position: relative;
		flex: 1 1 220px;
		min-width: 0;
	}
	.search input {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid var(--shell-field-line, var(--shell-hairline-strong));
		border-radius: 7px;
		background: var(--shell-card);
		color: inherit;
		padding: 7px 28px 7px 10px;
		font: inherit;
		font-size: 12px;
	}
	.search input:focus-visible {
		outline: 2px solid var(--shell-forest);
		outline-offset: 1px;
	}
	.clear-search {
		position: absolute;
		right: 4px;
		top: 50%;
		transform: translateY(-50%);
		border: 0;
		background: transparent;
		color: var(--shell-ink-2);
		font-size: 16px;
		cursor: pointer;
		padding: 0 4px;
	}
	.sources {
		display: inline-flex;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 7px;
		overflow: hidden;
	}
	.sources button {
		border: 0;
		border-right: 1px solid var(--shell-hairline);
		background: transparent;
		color: var(--shell-ink-2);
		font: inherit;
		font-size: 11px;
		padding: 6px 9px;
		cursor: pointer;
		white-space: nowrap;
	}
	.sources button:last-child { border-right: 0; }
	.sources button span {
		margin-left: 5px;
		font-size: 10px;
		opacity: 0.65;
	}
	.sources button.on {
		background: var(--shell-forest);
		color: var(--shell-ivory);
	}
	.import {
		border: 1px solid var(--shell-hairline-strong);
		background: transparent;
		color: var(--shell-ink);
		border-radius: 7px;
		padding: 6px 9px;
		font: inherit;
		font-size: 11px;
		cursor: pointer;
		white-space: nowrap;
	}
	.filter-row {
		display: flex;
		gap: 4px;
		align-items: center;
		margin-top: 8px;
		overflow-x: auto;
		padding-bottom: 2px;
		scrollbar-width: thin;
	}
	.chip {
		flex: none;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 999px;
		background: transparent;
		color: var(--shell-ink-2);
		font: inherit;
		font-size: 10px;
		padding: 3px 8px;
		cursor: pointer;
		white-space: nowrap;
	}
	.chip.family {
		font-weight: 600;
		color: var(--shell-ink);
	}
	.chip.on {
		background: var(--shell-forest);
		border-color: var(--shell-forest);
		color: var(--shell-ivory);
	}
	.chip.clear { color: var(--shell-ink); text-decoration: underline; }
	.divide { width: 1px; height: 14px; background: var(--shell-hairline-strong); flex: none; margin: 0 2px; }
	.body {
		position: relative;
		flex: 1 1 auto;
		display: grid;
		grid-template-columns: 128px minmax(0, 1fr);
		min-height: 0;
	}
	.body:has(.detail) {
		grid-template-columns: 128px minmax(0, 1fr) 286px;
	}
	.rail {
		border-right: 1px solid var(--shell-hairline);
		padding: 10px 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-height: 0;
		overflow-y: auto;
	}
	.rail button {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 6px;
		border: 0;
		background: transparent;
		color: var(--shell-ink-2);
		font: inherit;
		font-size: 12px;
		padding: 6px 7px;
		border-radius: 6px;
		cursor: pointer;
		text-align: left;
	}
	.rail button:hover { background: var(--shell-paper); }
	.rail button.on {
		background: var(--shell-forest);
		color: var(--shell-ivory);
	}
	.rail-name { font-weight: 600; }
	.rail-count { font-size: 10px; opacity: 0.7; }
	.rail-note {
		margin-top: auto;
		padding: 10px 7px 2px;
		font-size: 10px;
		line-height: 1.35;
		color: var(--shell-ink-2);
	}
	.browse {
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
		padding: 10px 12px 14px;
	}
	.group {
		display: flex;
		align-items: baseline;
		gap: 6px;
		margin: 2px 0 7px;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--shell-ink-2);
	}
	.group span { font-weight: 400; opacity: 0.7; }
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
		gap: 8px;
		margin-bottom: 14px;
	}
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		min-width: 0;
		border: 1px solid transparent;
		border-radius: 9px;
		padding: 4px;
		background: transparent;
	}
	.card:hover { background: var(--shell-paper); }
	.card.on {
		border-color: var(--shell-forest);
		background: var(--shell-ivory);
		box-shadow: 0 0 0 1px var(--shell-forest);
	}
	.card-open {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 3px;
		border: 0;
		padding: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		min-width: 0;
	}
	.card-open:focus-visible,
	.star:focus-visible,
	.variants button:focus-visible,
	.chip:focus-visible,
	.rail button:focus-visible,
	.actions button:focus-visible,
	.sources button:focus-visible {
		outline: 2px solid var(--shell-forest);
		outline-offset: 1px;
	}
	.thumb {
		position: relative;
		display: flex;
		justify-content: center;
		padding: 4px 0 2px;
	}
	.thumb :global(.finish-tile) {
		width: 100% !important;
		max-width: 104px;
		height: 78px !important;
		border-radius: 6px;
	}
	.thumb :global(.finish-tile img) { object-fit: cover; }
	.used {
		position: absolute;
		left: 3px;
		bottom: 4px;
		min-width: 15px;
		padding: 1px 4px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--shell-forest) 82%, transparent);
		color: var(--shell-ivory);
		font-size: 9px;
		text-align: center;
	}
	.project-mark {
		position: absolute;
		right: 3px;
		top: 4px;
		padding: 1px 4px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--shell-card) 88%, transparent);
		font-size: 8px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.name {
		font-size: 11px;
		font-weight: 600;
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meta {
		font-size: 9.5px;
		line-height: 1.25;
		color: var(--shell-ink-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.star {
		position: absolute;
		right: 5px;
		bottom: 24px;
		border: 0;
		background: transparent;
		color: var(--shell-ink-2);
		font-size: 12px;
		line-height: 1;
		padding: 2px;
		cursor: pointer;
		opacity: 0.65;
	}
	.star.on { color: #b8860b; opacity: 1; }
	.variants {
		display: flex;
		gap: 2px;
		margin-top: 2px;
	}
	.variants button {
		flex: 1;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 4px;
		background: transparent;
		color: var(--shell-ink-2);
		font: inherit;
		font-size: 9px;
		padding: 2px 1px;
		cursor: pointer;
	}
	.variants button.on {
		background: var(--shell-forest);
		border-color: var(--shell-forest);
		color: var(--shell-ivory);
	}
	.grid.plain { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
	.simple-card {
		border: 1px solid var(--shell-hairline);
		border-radius: 8px;
		background: var(--shell-ivory);
	}
	.simple-open {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 3px;
		width: 100%;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		padding: 10px;
		cursor: pointer;
	}
	.glyph {
		display: grid;
		place-items: center;
		width: 100%;
		height: 66px;
		margin-bottom: 4px;
		border-radius: 5px;
		background: color-mix(in srgb, var(--shell-forest) 8%, var(--shell-paper));
		font-size: 24px;
		color: var(--shell-forest);
	}
	.glyph.artwork { font-size: 20px; font-weight: 600; }
	.glyph.light { font-size: 28px; }
	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 5px;
		max-width: 330px;
		margin: 26px auto;
		padding: 18px;
		border: 1px dashed var(--shell-hairline-strong);
		border-radius: 9px;
		font-size: 12px;
		color: var(--shell-ink-2);
	}
	.empty strong { color: var(--shell-ink); font-size: 13px; }
	.empty button {
		margin-top: 4px;
		border: 1px solid var(--shell-hairline-strong);
		background: transparent;
		color: var(--shell-ink);
		border-radius: 6px;
		padding: 4px 8px;
		font: inherit;
		font-size: 11px;
		cursor: pointer;
	}
	.detail {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-height: 0;
		overflow-y: auto;
		border-left: 1px solid var(--shell-hairline);
		padding: 10px 12px 14px;
		background: var(--shell-ivory);
	}
	.detail-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.eyebrow {
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--shell-ink-2);
	}
	.detail-close {
		border: 0;
		background: transparent;
		color: var(--shell-ink-2);
		font-size: 17px;
		cursor: pointer;
		padding: 0 3px;
	}
	.detail h3 {
		margin: 0;
		font-size: 16px;
	}
	.detail-art {
		position: relative;
		display: flex;
		justify-content: center;
		padding: 6px 0;
	}
	.detail-art :global(.finish-tile) {
		width: 100% !important;
		max-width: 178px;
		height: 128px !important;
		border-radius: 7px;
	}
	.draft-wash {
		position: absolute;
		inset: 6px calc(50% - 89px);
		border-radius: 7px;
		pointer-events: none;
	}
	.draft-mark {
		position: absolute;
		left: 50%;
		bottom: 10px;
		transform: translateX(-50%);
		padding: 2px 6px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--shell-forest) 78%, transparent);
		color: var(--shell-ivory);
		font-size: 8px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.detail-variants, .steps {
		display: flex;
		gap: 3px;
	}
	.detail-variants button, .steps button {
		flex: 1;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 5px;
		background: transparent;
		color: var(--shell-ink-2);
		font: inherit;
		font-size: 10px;
		padding: 4px 4px;
		cursor: pointer;
	}
	.detail-variants button.on, .steps button.on {
		background: var(--shell-forest);
		border-color: var(--shell-forest);
		color: var(--shell-ivory);
	}
	.steps button:disabled { opacity: 0.35; cursor: not-allowed; }
	.facts {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 10.5px;
	}
	.facts div {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		padding: 2px 0;
		border-bottom: 1px solid color-mix(in srgb, var(--shell-hairline) 70%, transparent);
	}
	.facts dt { color: var(--shell-ink-2); }
	.facts dd { margin: 0; text-align: right; }
	.facts .warn dd { color: #8a5a00; }
	.target-note {
		font-size: 10.5px;
		color: var(--shell-ink-2);
		padding: 5px 7px;
		border-radius: 6px;
		background: var(--shell-paper);
	}
	.target-note strong { color: var(--shell-ink); }
	.actions {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.actions button {
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 6px;
		background: var(--shell-card);
		color: var(--shell-ink);
		font: inherit;
		font-size: 11px;
		padding: 6px 8px;
		cursor: pointer;
		text-align: center;
	}
	.actions button.primary {
		background: var(--shell-forest);
		border-color: var(--shell-forest);
		color: var(--shell-ivory);
	}
	.actions button.ghost {
		background: transparent;
		border-color: transparent;
		text-align: left;
		color: var(--shell-ink-2);
	}
	.actions button.ghost:hover { background: var(--shell-paper); color: var(--shell-ink); }
	.actions button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.actions kbd {
		margin-left: 5px;
		font-size: 8px;
		font-weight: 400;
		opacity: 0.75;
	}
	.draft {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px;
		border: 1px solid var(--shell-forest);
		border-radius: 8px;
		background: color-mix(in srgb, var(--shell-forest) 6%, var(--shell-card));
	}
	.draft header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 6px;
	}
	.draft header strong {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.draft header span { font-size: 9px; color: var(--shell-ink-2); }
	.draft-line { margin: 0; font-size: 10.5px; }
	.draft-apply { width: 100%; }
	.reason {
		margin: 0;
		font-size: 9.5px;
		line-height: 1.3;
		color: #8a5a00;
	}
	.reason.ok { color: var(--shell-ink-2); }
	.discard {
		align-self: flex-start;
		border: 0;
		background: transparent;
		color: var(--shell-ink-2);
		font: inherit;
		font-size: 9.5px;
		text-decoration: underline;
		padding: 0;
		cursor: pointer;
	}
	.hint {
		margin: auto 0 0;
		font-size: 9px;
		line-height: 1.35;
		color: var(--shell-ink-2);
		padding-top: 8px;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (max-width: 1180px) {
		.body:has(.detail) { grid-template-columns: 112px minmax(0, 1fr) 260px; }
		.grid { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; }
		.thumb :global(.finish-tile) { height: 68px !important; }
	}

	@media (max-width: 900px) {
		.library { top: 8px; left: 8px; right: 8px; bottom: calc(var(--lower-column-height, 150px) + 8px); }
		.body, .body:has(.detail) { grid-template-columns: 94px minmax(0, 1fr); }
		.detail {
			position: absolute;
			top: 0;
			right: 0;
			bottom: 0;
			width: min(300px, 46%);
			box-shadow: -8px 0 24px color-mix(in srgb, var(--shell-forest) 16%, transparent);
			z-index: 2;
		}
		.search-row { flex-wrap: wrap; }
		.sources { order: 3; }
	}

	@media (max-width: 760px) {
		.library {
			top: 6px;
			left: 6px;
			right: 6px;
			bottom: 6px;
			border-radius: 10px;
		}
		.body, .body:has(.detail) { grid-template-columns: minmax(0, 1fr); }
		.rail {
			flex-direction: row;
			overflow-x: auto;
			overflow-y: hidden;
			border-right: 0;
			border-bottom: 1px solid var(--shell-hairline);
			padding: 5px 7px;
			gap: 3px;
		}
		.rail button { flex: none; }
		.rail-note { display: none; }
		.browse { padding-bottom: 30%; }
		.detail {
			position: absolute;
			left: 0;
			right: 0;
			bottom: 0;
			top: auto;
			width: auto;
			max-height: 72%;
			border-left: 0;
			border-top: 1px solid var(--shell-hairline-strong);
			border-radius: 10px 10px 0 0;
			box-shadow: 0 -10px 28px color-mix(in srgb, var(--shell-forest) 18%, transparent);
		}
		.detail-art :global(.finish-tile) { height: 96px !important; }
		.filter-row { padding-bottom: 4px; }
		.context { display: none; }
	}

	@media (pointer: coarse) {
		.rail button, .chip, .sources button, .close, .actions button, .variants button, .detail-variants button, .steps button {
			min-height: 44px;
		}
		.star { min-width: 44px; min-height: 44px; bottom: 16px; }
	}
</style>

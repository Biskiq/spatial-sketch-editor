<script lang="ts">
	/**
	 * The professional Library sheet.
	 *
	 * One Stage-bounded surface in the measured shell lanes (a bottom sheet above
	 * the dock in portrait): a kind rail with the Materials families nested under
	 * it, sources, attribute filters, a searchable grid of square cards and a
	 * detail pane. Browse cards use `FinishTile` sample-tile derivatives only;
	 * the one active detail asks the Stage's inspection host for a live draw
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
	import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';
	import type { LookLibraryShelf } from '$lib/authoring/look/look-authoring.svelte';
	import type { LibrarySwapRequest } from '$lib/authoring/look/finish-authoring.svelte';
	import type { StageLibraryView } from '$lib/authoring/stage/route/stage-shell-state.svelte';
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
	import StageLibraryBody from './StageLibraryBody.svelte';
	import StageLibraryDetail from './StageLibraryDetail.svelte';
	import StageLibrarySources from './StageLibrarySources.svelte';
	import { tryUsePrivateLibrary } from './private-library-provider';

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
	const privateLibrary = tryUsePrivateLibrary();

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
	const targetChanged = 'The selection changed since the Library opened. Nothing changed.';
	function capturedTargetRefusal(next: LibraryTarget | null): string | null {
		return capturedTarget === null || target === null || next === null ||
			target.key !== capturedTarget.key || next.key !== capturedTarget.key
			? targetChanged
			: null;
	}

	const privateEntries = $derived(privateLibrary?.entries() ?? []);
	const allEntries = $derived([...entries, ...privateEntries]);
	const groups = $derived(browseLibrary(allEntries, { source, category, filters, query }, variantChoice));
	const cards = $derived(libraryCardsOf(groups));
	const selectedCard = $derived(cards.find((card) => card.key === selectedKey) ?? null);
	const categories = $derived(libraryCategoryOptions(allEntries, source));
	const curatedCount = $derived(librarySourceCount(allEntries, 'curated', variantChoice));
	const projectCount = $derived(librarySourceCount(allEntries, 'project'));
	const mineCount = $derived(librarySourceCount(allEntries, 'mine'));
	const allCount = $derived(librarySourceCount(allEntries, 'all', variantChoice));
	const hasProject = $derived(allEntries.some((entry) => entry.source === 'project'));
	const hasMine = $derived(mineCount > 0);
	const mineStatus = $derived(privateLibrary?.status ?? 'offline');
	const keepable = $derived(intent !== 'browse');

	$effect(() => {
		if (source === 'all' || source === 'mine') privateLibrary?.ensureLoaded();
	});

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
			const stale = capturedTargetRefusal(capturedTarget);
			if (stale !== null) {
				refusal = stale;
				return;
			}
			if (entry.source === 'mine')
				return void run(() => insertMine(entry, capturedTarget, keep)).then(() => {
					if (keep && refusal === null) note = `${entry.name} · Library stays open`;
				});
			void run(() => onReplace(entry, keep)).then(() => {
				if (keep && refusal === null) note = `${entry.name} · Library stays open`;
			});
			return;
		}
		if (entry.source === 'mine') {
			void run(() => insertMine(entry, null, keep)).then(() => {
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
	/** Inserting a saved item is one G transfer and one independent F4 Finish. */
	async function insertMine(
		entry: LibraryFinishEntry,
		mineTarget: LibraryTarget | null,
		keep: boolean,
	): Promise<Outcome> {
		if (intent === 'replace' && mineTarget !== null) {
			const stale = capturedTargetRefusal(mineTarget);
			if (stale !== null) return { ok: false, message: stale };
		}
		if (privateLibrary === null) return { ok: false, message: 'My library is unavailable here.' };
		const outcome = await privateLibrary.insert(
			entry.key,
			mineTarget,
			mineTarget === null ? 'paint' : 'apply',
		);
		if (!outcome.ok) return { ok: false, message: outcome.message };
		if (!keep) onClose();
		return { ok: true };
	}
	async function saveMine(entry: LibraryFinishEntry): Promise<Outcome> {
		if (privateLibrary === null) return { ok: false, message: 'My library is unavailable here.' };
		const outcome = await privateLibrary.saveFinish({
			finishKey: entry.key,
			name: entry.name,
			tileSource: tileSource(entry),
		});
		return outcome.ok ? { ok: true } : { ok: false, message: outcome.message };
	}
	async function removeMine(entry: LibraryFinishEntry): Promise<Outcome> {
		if (privateLibrary === null || entry.libraryItem === undefined)
			return { ok: false, message: 'My library is unavailable here.' };
		const outcome = await privateLibrary.remove(entry.libraryItem.id);
		if (!outcome.ok) return { ok: false, message: outcome.message };
		selectedKey = null;
		return { ok: true };
	}
	async function selectUsers(entry: LibraryFinishEntry): Promise<void> {
		await run(async () => ((await onSelectUsers(entry)) ? { ok: true } : { ok: false, message: `No present surface uses ${entry.name}.` }));
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

</script>

<button class="scrim" type="button" tabindex="-1" aria-label="Close Library" onclick={onClose}></button>

<div
	class="library"
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
				<StageLibrarySources
					{source}
					{allCount}
					{curatedCount}
					{projectCount}
					{mineCount}
					onSelect={(next) => { source = next; selectedKey = null; }}
				/>
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

	{#snippet materialDetail()}
		{#if selectedCard !== null}
			<StageLibraryDetail
				swapMode={intent === 'swap'}
				replaceTarget={intent === 'replace' ? capturedTarget : null}
				{target}
				{working}
				{busy}
				{selectedCard}
				{inspection}
				{onInspection}
				{tileSource}
				{closeDetail}
				{switchVariant}
				{choose}
				{selectUsers}
				{onCustomise}
				{onToggleFavourite}
				onUseForPaint={(entry) =>
					entry.source === 'mine'
						? void run(() => insertMine(entry, null, false))
						: onPaint(entry, false)}
				onApplyToTarget={(entry) =>
					entry.source === 'mine'
						? void run(() => insertMine(entry, capturedTarget ?? target, false))
						: void run(() => onReplace(entry, false))}
				onInsertMine={(entry, mineTarget) => void run(() => insertMine(entry, mineTarget, false))}
				onSaveMine={(entry) => void run(() => saveMine(entry))}
				onRemoveMine={(entry) => void run(() => removeMine(entry))}
				onRetryMine={() => void privateLibrary?.load(true)}
				{mineStatus}
				privateError={privateLibrary?.error ?? null}
			/>
		{/if}
	{/snippet}

	<StageLibraryBody
		{kind}
		{source}
		{query}
		{selectedKey}
		{category}
		swapMode={intent === 'swap'}
		{working}
		{busy}
		{hasProject}
		{hasMine}
		{mineStatus}
		{groups}
		{cards}
		{categories}
		{allCount}
		{objects}
		{artwork}
		{looks}
		{tileSource}
		{selectKind}
		{selectCategory}
		{clearFilters}
		{toggleDetail}
		{switchVariant}
		{choose}
		{verb}
		{selectUsers}
		onToggleFavourite={onToggleFavourite}
		onObject={onObject}
		onArtwork={onArtwork}
		onLook={onLook}
		detail={selectedCard !== null && kind === 'materials' ? materialDetail : undefined}
		onShowProject={() => { source = 'project'; selectedKey = null; }}
		onShowMine={() => { source = 'mine'; selectedKey = null; }}
		onBrowseCurated={() => (source = 'curated')}
		onClearSearch={() => (query = '')}
		openArtworkImport={() => artworkInput?.click()}
	/>

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
		position: absolute; z-index: 51;
		width: var(--lib-w);
		height: min(560px, calc(100% - var(--lane-b) - 12px - 96px));
		left: calc(var(--lane-l) + (100% - var(--lane-l) - var(--lane-r) - var(--lib-w)) / 2);
		bottom: calc(var(--lane-b) + 12px);
		box-sizing: border-box; display: grid;
		grid-template-rows: auto auto auto minmax(0, 1fr);
		min-height: 0;
		color: var(--shell-ink); background: var(--shell-card);
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 14px;
		box-shadow: 0 14px 40px color-mix(in srgb, var(--shell-forest) 26%, transparent);
		overflow: hidden;
		container: library / inline-size;
	}
	.library:focus { outline: none; }
	.lb-h {
		display: flex; align-items: center;
		gap: 8px;
		padding: 10px 12px 8px;
		min-width: 0;
	}
	.lb-t { margin: 0; font-size: 14px; white-space: nowrap; }
	.search { position: relative; flex: 1; min-width: 120px; }
	.search input {
		width: 100%; box-sizing: border-box;
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
	.lb-x {
		border: 0; background: transparent; color: var(--shell-ink);
		font-size: 20px;
		line-height: 1; width: 30px; height: 30px;
		border-radius: 8px;
		cursor: pointer;
		flex: none;
	}
	.lb-x:hover { background: var(--shell-paper); }
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
	.btn {
		border: 1px solid var(--shell-hairline-strong);
		background: var(--shell-card);
		color: var(--shell-ink);
		border-radius: 7px;
		padding: 6px 11px;
		font: inherit; font-size: 12px; min-height: 30px;
		cursor: pointer;
	}
	.btn.sm { padding: 5px 9px; font-size: 11px; white-space: nowrap; }
	.btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn:focus-visible { outline: 2px solid var(--shell-forest); outline-offset: 1px; }

	.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

	/*
		Not room for grid and inspector side by side: detail becomes an in-panel view
		with Back over the same bounds; the browse behind it leaves the Tab order.
	*/
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
		.fchip, .btn { min-height: 44px; }
		.lb-x { width: 44px; height: 44px; }
	}
</style>

<script lang="ts">
	import type { ArtworkLibraryEntry } from '@portfolio/project-model/artwork';
	import type { MaterialId } from '@portfolio/project-model/scene';
	import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';
	import type { LookLibraryShelf } from '$lib/authoring/look/look-authoring.svelte';
	import FinishTile from '$lib/authoring/look/FinishTile.svelte';
	import FinishInspectionView from './FinishInspectionView.svelte';
	import type { LibraryInspectionSettings } from './library-inspection';
	import type {
		LibraryCard,
		LibraryCategory,
		LibraryFinishEntry,
		LibrarySource
	} from './library-catalogue';
	import type { LibraryTarget } from './library-target';

	type Intent = 'browse' | 'paint' | 'replace' | 'swap';
	type LibraryKind = 'materials' | 'objects' | 'artwork' | 'lights';
	type CapturedTarget = LibraryTarget | null;

	const SHELF_MAX = 8;

	let {
		kind = $bindable(),
		category = $bindable(),
		source = $bindable(),
		query = $bindable(),
		selectedKey = $bindable(),
		intent,
		capturedTarget,
		target,
		working,
		busy,
		needle,
		hasProject,
		groups,
		cards,
		categories,
		allCount,
		objects,
		artwork,
		looks,
		filteredObjects,
		filteredArtwork,
		filteredLooks,
		selectedCard,
		inspection,
		onInspection,
		tileSource,
		tileSizeOf,
		selectKind,
		selectCategory,
		clearFilters,
		closeDetail,
		toggleDetail,
		switchVariant,
		choose,
		cardKeydown,
		verb,
		variantLabel,
		selectUsers,
		onUseForPaint,
		onApplyToTarget,
		onCustomise,
		onToggleFavourite,
		onObject,
		onArtwork,
		onLook,
		openArtworkImport
	}: {
		kind: LibraryKind;
		category: LibraryCategory;
		source: LibrarySource;
		query: string;
		selectedKey: string | null;
		intent: Intent;
		capturedTarget: CapturedTarget;
		target: LibraryTarget | null;
		working: boolean;
		busy: boolean;
		needle: string;
		hasProject: boolean;
		groups: ReturnType<typeof import('./library-catalogue').browseLibrary>;
		cards: readonly LibraryCard[];
		categories: readonly { readonly id: LibraryCategory; readonly label: string }[];
		allCount: number;
		objects: readonly { readonly id: string; readonly name: string }[];
		artwork: readonly ArtworkLibraryEntry[] | null;
		looks: LookLibraryShelf | null;
		filteredObjects: readonly { readonly id: string; readonly name: string }[];
		filteredArtwork: readonly ArtworkLibraryEntry[];
		filteredLooks: NonNullable<LookLibraryShelf['entries']>;
		selectedCard: LibraryCard | null;
		inspection: LibraryInspectionSettings;
		onInspection: (next: LibraryInspectionSettings) => void;
		tileSource: (entry: LibraryFinishEntry) => FinishTileSource | null;
		tileSizeOf: (entry: LibraryFinishEntry) => string;
		selectKind: (next: LibraryKind) => void;
		selectCategory: (next: LibraryCategory) => void;
		clearFilters: () => void;
		closeDetail: () => void;
		toggleDetail: (card: LibraryCard) => void;
		switchVariant: (card: LibraryCard, id: MaterialId) => void;
		choose: (entry: LibraryFinishEntry, keepOpen: boolean) => void;
		cardKeydown: (event: KeyboardEvent, entry: LibraryFinishEntry) => void;
		verb: (entry: LibraryFinishEntry) => string;
		variantLabel: (card: LibraryCard) => string;
		selectUsers: (entry: LibraryFinishEntry) => Promise<void>;
		onUseForPaint: (entry: LibraryFinishEntry) => void;
		onApplyToTarget: (entry: LibraryFinishEntry) => void;
		onCustomise: (entry: LibraryFinishEntry) => void;
		onToggleFavourite: (key: string) => void;
		onObject: (assetId: string) => void;
		onArtwork: (entry: ArtworkLibraryEntry) => void;
		onLook: (id: string) => void;
		openArtworkImport: () => void;
	} = $props();
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


	<div class="lb-b" class:with-detail={selectedCard !== null && kind === 'materials'}>
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
							<button type="button" onclick={openArtworkImport}>Import artwork</button>
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
						<button type="button" class="btn" onclick={() => onUseForPaint(entry)}>Use for Paint</button>
					{:else}
						<button type="button" class="btn pri" data-library-detail-primary onclick={() => onUseForPaint(entry)}>Use for Paint</button>
						{#if target !== null}
							<button
								type="button"
								class="btn"
								disabled={working || busy}
								data-library-detail-apply
								onclick={() => onApplyToTarget(entry)}
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

<style>

	.lb-b {
		position: relative;
		display: grid;
		grid-template-columns: 176px minmax(0, 1fr);
		min-height: 0;
	}
	.lb-b.with-detail { grid-template-columns: 176px minmax(0, 1fr) minmax(260px, 300px); }
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
	.lbd-x {
		border: 0;
		background: transparent;
		color: var(--shell-ink-2);
		font-size: 18px;
		line-height: 1;
		cursor: pointer;
	}
	.lbd-x:hover { background: var(--shell-paper); }
	.note-sm { font-size: 11px; color: var(--shell-ink-2); margin: 0; }
	@container library (width < 780px) {
		.lb-b { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
		.lb-b.with-detail { grid-template-columns: minmax(0, 1fr) minmax(250px, 280px); grid-template-rows: auto minmax(0, 1fr); }
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
	}
	@container library (width < 600px) {
		.lb-b.with-detail { grid-template-columns: minmax(0, 1fr); }
		.lb-b.with-detail .lb-rail,
		.lb-b.with-detail .lb-grid-wrap { visibility: hidden; }
		.lb-d {
			position: absolute;
			inset: 0;
			z-index: 2;
			border-left: 0;
		}
		.back { display: inline-flex; align-items: center; }
	}
	@media (pointer: coarse) {
		.ix, .lb-empty button, .btn { min-height: 44px; }
		.mc .star, .mc .xp { width: 36px; height: 36px; }
		.lbd-x { width: 44px; height: 44px; }
	}
</style>

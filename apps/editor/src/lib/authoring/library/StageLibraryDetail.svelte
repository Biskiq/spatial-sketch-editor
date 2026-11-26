<script lang="ts">
	import type { MaterialId } from '@portfolio/project-model/scene';
	import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';
	import FinishInspectionView from './FinishInspectionView.svelte';
	import type { LibraryInspectionSettings } from './library-inspection';
	import type { LibraryCard, LibraryFinishEntry } from './library-catalogue';
	import type { LibraryTarget } from './library-target';

	let {
		swapMode,
		replaceTarget,
		target,
		working,
		busy,
		selectedCard,
		inspection,
		onInspection,
		tileSource,
		closeDetail,
		switchVariant,
		choose,
		selectUsers,
		onUseForPaint,
		onApplyToTarget,
		onCustomise,
		onToggleFavourite
	}: {
		swapMode: boolean;
		replaceTarget: LibraryTarget | null;
		target: LibraryTarget | null;
		working: boolean;
		busy: boolean;
		selectedCard: LibraryCard;
		inspection: LibraryInspectionSettings;
		onInspection: (next: LibraryInspectionSettings) => void;
		tileSource: (entry: LibraryFinishEntry) => FinishTileSource | null;
		closeDetail: () => void;
		switchVariant: (card: LibraryCard, id: MaterialId) => void;
		choose: (entry: LibraryFinishEntry, keepOpen: boolean) => void;
		selectUsers: (entry: LibraryFinishEntry) => Promise<void>;
		onUseForPaint: (entry: LibraryFinishEntry) => void;
		onApplyToTarget: (entry: LibraryFinishEntry) => void;
		onCustomise: (entry: LibraryFinishEntry) => void;
		onToggleFavourite: (key: string) => void;
	} = $props();

	const entry = $derived(selectedCard.entry);
	const swappable = $derived(entry.source === 'curated' && entry.curatedId !== null);

	function tileSizeOf(entry: LibraryFinishEntry): string {
		return entry.subline.split('·').at(-1)?.trim() ?? '—';
	}
</script>

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
		{#if swapMode}
			<button
				type="button"
				class="btn pri"
				disabled={!swappable || working || busy}
				title={swappable ? 'Keeps its colour and sheen' : 'Swap takes a curated material.'}
				data-library-detail-primary
				onclick={(event) => choose(entry, event.shiftKey)}
			>Swap to this</button>
		{:else if replaceTarget !== null}
			<button type="button" class="btn pri" disabled={working || busy} data-library-detail-primary onclick={(event) => choose(entry, event.shiftKey)}>Apply to {replaceTarget.label}</button>
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

<style>
	.btn {
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
	@container library (width < 600px) {
		.lb-d {
			position: absolute;
			inset: 0;
			z-index: 2;
			border-left: 0;
		}
		.back { display: inline-flex; align-items: center; }
	}
	@media (pointer: coarse) {
		.btn { min-height: 44px; }
		.lbd-x { width: 44px; height: 44px; }
	}
</style>

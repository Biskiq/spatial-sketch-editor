<script lang="ts">
	/**
	 * Swap › (T2.S8 U4): the curated catalogue, grouped by family, with D1 variant
	 * cards. Choosing an entry asks the Card to swap; the picker itself never
	 * writes and holds no state beyond the variant shown on a card. U5 routes
	 * Swap through the Library with intent = swap and replaces this entry point.
	 */
	import type { MaterialId } from '$lib/types/materials';
	import { materials } from '$lib/content/materials';
	import { foldVariantCards, groupByMaterialFamily } from '$lib/content/material-presentation';
	import FinishTile from './FinishTile.svelte';

	let {
		current,
		onChoose,
		onClose
	}: {
		/** The Finish's material today; it is marked, and choosing it does nothing. */
		current: MaterialId | null;
		onChoose: (id: MaterialId) => void;
		onClose: () => void;
	} = $props();

	let shown = $state<Record<string, MaterialId>>({});
	let root = $state<HTMLElement>();

	const entries = materials.map((material) => ({
		id: material.id,
		label: material.label,
		color: material.swatchColor ?? material.fallbackColor
	}));
	const groups = $derived(
		groupByMaterialFamily(entries).map((group) => ({
			...group,
			cards: foldVariantCards(group.entries, (primary) => shown[primary] ?? (current !== null && entries.some((entry) => entry.id === current) ? current : undefined))
		}))
	);

	$effect(() => {
		// Open on the current material (or the first entry) for keyboard users.
		const target = root?.querySelector<HTMLButtonElement>('button[aria-current="true"]') ?? root?.querySelector<HTMLButtonElement>('button.entry');
		target?.focus({ preventScroll: false });
	});

	function onKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.stopPropagation();
			event.preventDefault();
			onClose();
			return;
		}
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		const buttons = [...(root?.querySelectorAll<HTMLButtonElement>('button.entry') ?? [])];
		const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const next = buttons[Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))];
		next?.focus();
		event.preventDefault();
	}
</script>

<div class="swap" role="dialog" aria-label="Swap material" bind:this={root} onkeydown={onKeydown} tabindex="-1" data-finish-swap-picker>
	<div class="swap-head">
		<span>Swap material</span>
		<span class="hint">Keeps this colour and sheen</span>
		<button type="button" class="close" aria-label="Close" title="Close (Esc)" onclick={onClose}>×</button>
	</div>
	<div class="swap-list">
		{#each groups as group (group.id)}
			<div class="family" role="group" aria-label={group.label}>
				<span class="family-label">{group.label}</span>
				{#each group.cards as card (card.id)}
					<div class="card-entry">
						<button
							type="button"
							class="entry"
							aria-current={card.id === current ? 'true' : undefined}
							data-finish-swap-entry={card.id}
							onclick={() => (card.id === current ? onClose() : onChoose(card.id))}
						>
							<FinishTile source={{ kind: 'catalogue', id: card.id }} color={card.color} size={28} label={card.label} />
							<span class="entry-label">{card.cardLabel ?? card.label}</span>
							{#if card.id === current}<span class="now">Now</span>{/if}
						</button>
						{#if card.variants.length > 0}
							<span class="variants" role="group" aria-label={`${card.cardLabel ?? card.label} variant`}>
								{#each card.variants as variant (variant.id)}
									<button
										type="button"
										class="chip"
										aria-pressed={variant.id === card.id}
										onclick={() => (shown = { ...shown, [card.variants[0]!.id]: variant.id })}
									>{variant.label}</button>
								{/each}
							</span>
						{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	.swap {
		display: grid;
		gap: 0.3rem;
		padding: 0.4rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.35rem;
		background: var(--shell-popover);
		box-shadow: 0 0.4rem 1rem rgb(6 20 14 / 12%);
	}
	.swap-head {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		font-weight: 600;
	}
	.hint {
		color: var(--shell-ink-quiet);
		font-weight: 400;
		font-size: var(--shell-text-utility);
	}
	.close {
		margin-left: auto;
		min-width: var(--shell-control-height);
		min-height: var(--shell-control-height);
		border: 0;
		background: transparent;
		color: var(--shell-ink-quiet);
	}
	.swap-list {
		display: grid;
		gap: 0.35rem;
		max-height: 16rem;
		overflow-y: auto;
	}
	.family {
		display: grid;
		gap: 0.1rem;
	}
	.family-label {
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-utility);
	}
	.card-entry {
		display: grid;
		gap: 0.15rem;
	}
	.entry {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-height: var(--shell-control-height);
		padding: 0.1rem 0.25rem;
		border: 1px solid transparent;
		border-radius: 0.25rem;
		background: transparent;
		color: inherit;
		text-align: left;
	}
	.entry:hover,
	.entry:focus-visible {
		border-color: var(--shell-hairline);
	}
	.entry[aria-current='true'] {
		border-color: var(--shell-hairline);
	}
	.entry-label {
		flex: 1;
	}
	.now {
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-utility);
	}
	.variants {
		display: flex;
		gap: 0.25rem;
		padding-left: 2.2rem;
	}
	.chip {
		min-height: 1.5rem;
		padding: 0 0.45rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 999px;
		background: transparent;
		color: inherit;
		font-size: var(--shell-text-utility);
	}
	.chip[aria-pressed='true'] {
		border-color: currentColor;
	}
	@media (pointer: coarse) {
		.entry,
		.close {
			min-height: var(--shell-touch-target);
		}
	}
</style>

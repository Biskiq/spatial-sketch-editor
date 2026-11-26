<script lang="ts">
	import type { ArtworkLibraryEntry } from '@portfolio/project-model/artwork';
	import type { LookLibraryShelf } from '$lib/authoring/look/look-authoring.svelte';
	import { WORLD_LIBRARY_CATEGORIES, type WorldLibraryCategory } from './registry';

	let {
		category,
		onCategory,
		artworkShelf,
		lookShelf,
		onClose
	}: {
		category: WorldLibraryCategory | 'look' | 'artwork';
		onCategory: (category: WorldLibraryCategory | 'look' | 'artwork') => void;
		artworkShelf: readonly ArtworkLibraryEntry[] | null;
		lookShelf: LookLibraryShelf | null;
		onClose: () => void;
	} = $props();
</script>

<div class="tabs">
	{#each WORLD_LIBRARY_CATEGORIES as item (item.id)}
		<button
			type="button"
			class="sub"
			class:on={category === item.id}
			aria-pressed={category === item.id}
			onclick={() => onCategory(item.id)}
		>{item.label}</button>
	{/each}
	{#if artworkShelf !== null}
		<button type="button" class="sub" class:on={category === 'artwork'}
			aria-pressed={category === 'artwork'} onclick={() => onCategory('artwork')}>Artwork</button>
	{/if}
	{#if lookShelf !== null && lookShelf.entries.length > 0}
		<button
			type="button"
			class="sub"
			class:on={category === 'look'}
			aria-pressed={category === 'look'}
			onclick={() => onCategory('look')}
		>{lookShelf.label}</button>
	{/if}
	<button type="button" class="close-word" aria-label="Close Library" onclick={onClose}>Close</button>
</div>

<style>
	.tabs {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.sub {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 30px;
		padding: 0 8px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--shell-ink-2);
		font: 500 var(--shell-text-label)/1 var(--shell-sans);
		white-space: nowrap;
		cursor: pointer;
	}
	.sub:hover {
		background: var(--shell-hover);
		color: var(--shell-ink);
	}
	.sub.on {
		background: var(--shell-mode-active-bg);
		color: var(--shell-ink);
	}
	.close-word {
		height: 30px;
		padding: 0 8px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--shell-ink-2);
		font: 500 var(--shell-text-utility)/1 var(--shell-sans);
		cursor: pointer;
	}
	.close-word:hover {
		background: var(--shell-hover);
		color: var(--shell-ink);
	}
	@media (pointer: coarse) {
		.sub,
		.close-word {
			min-height: 44px;
		}
	}
</style>

<script lang="ts">
	type LensId = 'world' | 'experience';
	type LensEntry = { readonly id: LensId; readonly label: string };

	let {
		entries,
		lens,
		selectedIndex,
		onLens,
		onKeydown,
		buttonRef
	}: {
		entries: readonly LensEntry[];
		lens: LensId;
		selectedIndex: number;
		onLens: (id: LensId) => void;
		onKeydown: (event: KeyboardEvent, index: number) => void;
		buttonRef: (node: HTMLButtonElement) => void;
	} = $props();

	const tabIndex = (index: number, selected: number) => (index === selected ? 0 : -1);
</script>

{#each entries as entry, index (entry.id)}
	<button
		type="button"
		class="lens-button"
		class:active={lens === entry.id}
		aria-pressed={lens === entry.id}
		tabindex={tabIndex(index, selectedIndex)}
		use:buttonRef
		onclick={() => onLens(entry.id)}
		onkeydown={(event) => onKeydown(event, index)}
	>
		{entry.label}
	</button>
{/each}

<style>
	button {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		gap: 4px;
		min-height: 24px;
		padding: 0 7px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	button:hover {
		background: var(--shell-on-forest-wash);
	}
	.lens-button {
		height: 26px;
		padding: 0 11px;
		border-radius: 6px;
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-control);
	}
	.lens-button.active {
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
	}
	@media (max-width: 860px) {
		.lens-button {
			padding: 0 8px;
		}
	}
	@media (pointer: coarse) {
		button {
			min-width: 44px;
			min-height: 44px;
		}
	}
</style>

<script lang="ts">
	let { onDone }: { onDone: () => void } = $props();
</script>

<div class="select-more" role="group" aria-label="Select more">
	<span>Tap to add or remove</span>
	<button type="button"
		onpointerdown={(event) => event.stopPropagation()}
		onclick={(event) => { event.stopPropagation(); onDone(); }}>Done</button>
</div>

<style>
	.select-more {
		position: absolute;
		top: 10px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 13;
		display: flex;
		align-items: center;
		gap: 9px;
		white-space: nowrap;
		padding-inline: 12px 4px;
		border: 1px solid var(--shell-hairline);
		border-radius: 25px;
		background: var(--shell-surface-raised);
		color: var(--shell-ink);
		font: var(--shell-text-utility) var(--shell-sans);
	}
	.select-more button {
		pointer-events: auto;
		min-height: 44px;
		min-width: 44px;
		padding-inline: 12px;
		border: 0;
		border-radius: 22px;
		background: var(--shell-hover);
		color: inherit;
		font: inherit;
	}
</style>

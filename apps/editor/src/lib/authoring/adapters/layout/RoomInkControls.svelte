<script lang="ts">
	import { inkSurface, type InkPaletteSnapshot } from './ink';

	let { room }: { room: InkPaletteSnapshot['room'] } = $props();
</script>

<div class="room-ink-controls" role="group" aria-label="Room tool">
	<span class="hint">{room?.hint ?? 'Hover inside Walls'}</span>
	<button type="button" aria-pressed={room?.mode === 'draw'} disabled={room?.canDraw === false}
		onclick={() => inkSurface()?.controller.drawOpenSide?.()}>Draw open side</button>
	{#if room && room.mode !== 'hover'}
		<button type="button" aria-pressed={room.mode === 'follow'} disabled={!room.canFollow}
			onclick={() => inkSurface()?.controller.followWall?.()}>Follow Wall</button>
		<button type="button" disabled={!room.canBacktrack}
			onclick={() => inkSurface()?.controller.backtrack()}>Back</button>
		{#key room.confirmationId}
			<button type="button" disabled={!room.canCreate}
				onclick={() => inkSurface()?.controller.finish()}>Create Space</button>
		{/key}
	{/if}
</div>

<style>
	.room-ink-controls { display: flex; align-items: center; gap: 2px; }
	.hint { color: var(--shell-ink-3); font: 400 var(--shell-text-utility)/1.2 var(--shell-sans); padding-inline: 6px; }
	button {
		min-height: 30px;
		padding-inline: 6px;
		white-space: nowrap;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--shell-ink);
		font: 500 var(--shell-text-utility)/1 var(--shell-sans);
		cursor: pointer;
	}
	button:hover:not(:disabled) { background: var(--shell-hover); }
	button[aria-pressed='true'] { background: var(--shell-forest); color: var(--shell-ink-light); }
	button:disabled { opacity: 0.55; cursor: default; }
	button:focus-visible { outline: var(--shell-focus-ring-light); outline-offset: -2px; }
	@media (max-width: 560px) {
		.room-ink-controls { display: grid; grid-template-columns: repeat(4, max-content); column-gap: 1px; }
		.hint { grid-column: 1 / -1; }
	}
	@media (pointer: coarse) { button { min-height: 44px; } }
</style>

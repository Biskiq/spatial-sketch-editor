<script lang="ts">
	/**
	 * V1c — the Terrace and Flat Roof palette. It is a reader: Box and Line are
	 * the same grammar the Wall reading uses, elevation is the Height Sheet's
	 * height, and Finish/Backtrack/Cancel drive the region drawing session.
	 */
	import type { InkPaletteSnapshot } from './ink';
	import { inkSurface } from './ink';

	let { region }: { region: NonNullable<InkPaletteSnapshot['region']> } = $props();
	const roleWords = $derived(region.role === 'overhead' ? 'Flat Roof' : 'Terrace');
</script>

<div class="region" data-region-palette>
	<div class="head">
		<span class="role">{roleWords}</span>
		<span class="height">{region.elevation.toFixed(2)} m</span>
		<span class="thickness">{region.thickness.toFixed(2)} m thick</span>
	</div>
	<div class="modes" role="radiogroup" aria-label="Region shape">
		{#each ['box', 'line'] as const as mode}
			<button
				type="button"
				role="radio"
				aria-checked={region.mode === mode}
				data-region-mode={mode}
				onclick={() => inkSurface()?.controller.setRegionMode(mode)}>{mode === 'box' ? 'Box' : 'Line'}</button
			>
		{/each}
	</div>
	<p class="hint">{region.hint}</p>
	<div class="commands">
		{#if region.mode === 'line'}
			<button
				type="button"
				data-ink-finish
				disabled={region.points.length < 3}
				onclick={() => inkSurface()?.controller.finish()}>Finish (Enter)</button
			>
		{/if}
		<button
			type="button"
			data-ink-backtrack
			disabled={region.points.length === 0}
			onclick={() => inkSurface()?.controller.backtrack()}>Backtrack</button
		>
		<button type="button" data-ink-cancel onclick={() => inkSurface()?.controller.cancel()}
			>Cancel</button
		>
	</div>
</div>

<style>
	.region {
		display: grid;
		gap: 6px;
		width: 240px;
		padding: 8px;
		border: 1px solid var(--shell-line-on-forest);
		border-radius: 12px;
		background: var(--shell-popup-dark);
		box-shadow: var(--shell-shadow);
	}
	.head {
		display: flex;
		gap: 8px;
		align-items: baseline;
		font-size: 11px;
	}
	.role {
		font-weight: 600;
	}
	.height,
	.thickness {
		color: var(--shell-ink-quiet);
		font-family: var(--shell-mono);
	}
	.modes,
	.commands {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}
	button {
		min-height: 26px;
		padding: 2px 8px;
		border: 0;
		border-radius: 6px;
		background: var(--shell-on-forest-wash);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	button[aria-checked='true'] {
		background: var(--shell-on-forest-wash-strong);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--shell-ink-light) 55%, transparent);
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.hint {
		margin: 0;
		color: var(--shell-ink-quiet);
		font-size: 10.5px;
		line-height: 1.35;
	}
	@media (pointer: coarse) {
		button {
			min-height: 44px;
		}
	}
</style>

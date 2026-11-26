<script lang="ts">
	import type { GuideConnector } from './experience-guide-card-model';

	let {
		connector,
		stopId,
		selected,
		tabindex,
		progress,
		playhead,
		onselect
	}: {
		connector: GuideConnector | null;
		stopId: string;
		selected: boolean;
		tabindex: number;
		progress: number;
		playhead: number | null;
		onselect: () => void;
	} = $props();
</script>
<span
	class="slot"
	class:adjacent={connector?.shape === 'adjacent'}
	data-track-id={connector?.transition === 'travel' ? `travel:${stopId}` : undefined}
>
	{#if connector !== null && connector.shape !== 'end'}
		<button
			type="button"
			class="chip {connector.shape}"
			data-connector={stopId}
			class:cut={connector.transition === 'cut'}
			class:travel={connector.transition === 'travel'}
			class:gap={connector.gap}
			class:selected
			aria-pressed={selected}
			aria-label={connector.name}
			title={connector.name}
			{tabindex}
			onclick={onselect}
		>
			{#if connector.shape !== 'adjacent'}
				{connector.text}
			{:else if connector.gap}
				<span aria-hidden="true">⚠</span>
			{:else if connector.transition === 'travel'}
				<span class="gutter-time">{connector.text}</span>
			{:else}
				<svg class="glyph" viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M1 4h10" stroke-dasharray="0.1 2.3" /></svg>
			{/if}
		</button>
		{#if connector.transition === 'travel'}
			<span class="slot-progress" aria-hidden="true"
				><i style:width={`${progress}%`}></i>{#if playhead !== null}<b class="knob" style:left={`${playhead}%`}></b>{/if}</span
			>
		{:else if connector.transition === 'cut'}
			<span class="slot-cut" aria-hidden="true"></span>
		{/if}
	{/if}
</span>
<style>
	.slot-progress {
		position: absolute;
		bottom: 3px;
		height: 3px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--shell-ink-light) 14%, transparent);
		pointer-events: none;
		left: 0;
		right: 0;
		border-radius: 0;
	}
	.slot-progress i {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		border-radius: inherit;
		background: var(--shell-gold);
	}
	.slot-cut {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 4px;
		border-top: 1px dotted color-mix(in srgb, var(--shell-ink-light) 30%, transparent);
		pointer-events: none;
	}
	.knob {
		position: absolute;
		top: 50%;
		z-index: 1;
		width: 10px;
		height: 10px;
		margin: -5px 0 0 -5px;
		border: 2px solid var(--shell-forest);
		border-radius: 50%;
		background: var(--shell-gold);
	}
	.knob::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 6px;
		width: 2px;
		height: 12px;
		margin-left: -1px;
		border-radius: 1px;
		background: var(--shell-gold);
	}
	.slot {
		position: relative;
		flex: 0 0 58px;
		width: 58px;
		display: grid;
		place-items: center;
	}
	.slot.adjacent::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		border-top: 1px solid color-mix(in srgb, var(--shell-ink-light) 28%, transparent);
	}
	.chip {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 18px;
		min-width: 24px;
		max-width: 56px;
		padding: 0 5px;
		border: 1px solid transparent;
		border-radius: 999px;
		background: color-mix(in srgb, var(--shell-ink-light) 10%, var(--shell-forest));
		color: var(--shell-ink-light);
		font: 600 var(--shell-text-meta)/1 var(--shell-mono);
		white-space: nowrap;
		overflow: hidden;
		cursor: pointer;
	}
	.chip .glyph {
		display: block;
		width: 12px;
		height: 8px;
	}
	.chip.cut {
		border: 1px dashed color-mix(in srgb, var(--shell-ink-light) 40%, transparent);
		background: transparent;
	}
	.chip.travel {
		background: var(--shell-gold);
		color: var(--shell-on-gold);
	}
	.chip.jump,
	.chip.end {
		border: 1px solid color-mix(in srgb, var(--shell-ink-light) 22%, transparent);
	}
	.chip.gap {
		border: 1px dashed var(--shell-caution);
		background: transparent;
		color: color-mix(in srgb, var(--shell-caution) 45%, var(--shell-ink-light));
	}
	.chip.selected {
		background: var(--shell-gold);
		color: var(--shell-on-gold);
		box-shadow: 0 0 0 2px var(--shell-ivory);
	}
	.gutter-time {
		font-size: 9px;
		letter-spacing: -0.01em;
	}
	@media (pointer: coarse) {
		.chip { min-height: 44px; min-height: var(--shell-touch-target); }
	}
</style>

<script lang="ts">
	/**
	 * R217.S05 — the Stage's **scale bar**, at the bottom left.
	 *
	 * It is a reading, not a control: the round length and its projected width are
	 * derived from the evaluation's own target-plane scale, so the bar cannot
	 * disagree with the drawing. It never takes a pointer (the Stage underneath
	 * remains draggable) and it writes nothing.
	 */
	import { formatMeters } from '../stage-drafting';

	let {
		bar
	}: {
		/** `null` while no evaluation supplies a target-plane scale. */
		bar: { readonly meters: number; readonly cssPx: number } | null;
	} = $props();
</script>

{#if bar !== null}
	<div
		class="scale-bar"
		data-stage-scale-bar
		role="img"
		aria-label={`Scale bar: ${formatMeters(bar.meters)}`}
	>
		<span class="length">{formatMeters(bar.meters)}</span>
		<span class="rule" style={`width: ${Math.max(24, Math.round(bar.cssPx))}px`}></span>
	</div>
{/if}

<style>
	.scale-bar {
		position: absolute;
		/* Clear the centered lower column instead of being painted under it. */
		bottom: calc(0.7rem + var(--lower-column-height, 0px));
		left: 0.8rem;
		display: grid;
		gap: 0.18rem;
		padding: 0.22rem 0.4rem;
		border: 1px solid rgb(244 240 233 / 24%);
		border-radius: 0.3rem;
		background: rgb(21 44 38 / 82%);
		color: #f4f0e9;
		pointer-events: none;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.72rem;
		letter-spacing: 0.02em;
	}
	.length {
		line-height: 1;
	}
	.rule {
		display: block;
		height: 0;
		border-top: 1px solid #f4f0e9;
		border-bottom: 1px solid rgb(21 44 38 / 90%);
	}
	@media (pointer: coarse) {
		.scale-bar {
			bottom: calc(0.55rem + var(--lower-column-height, 0px));
			left: 0.6rem;
			font-size: 0.76rem;
		}
	}
</style>

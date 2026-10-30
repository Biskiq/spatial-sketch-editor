<script lang="ts">
	/**
	 * R217.S13 — the Stage's **scale ruler**, at the bottom left (D41).
	 *
	 * It is a reading, not a control: the round length and its projected width are
	 * derived from the evaluation's own target-plane scale, so the bar cannot
	 * disagree with the drawing. It is a 1 px rule with 5 px perpendicular end
	 * ticks and its label below — no fill, border or badge. The route mounts it in
	 * Plan only, because a perspective length is true only at the target plane.
	 * It never takes a pointer and writes nothing.
	 */
	import { formatMeters } from '../stage-drafting';

	let {
		bar,
		quiet = false
	}: {
		/** `null` while no evaluation supplies a target-plane scale. */
		bar: { readonly meters: number; readonly cssPx: number } | null;
		/** Paper's quiet dark ink instead of the mat's light ink. */
		quiet?: boolean;
	} = $props();
</script>

{#if bar !== null}
	<div
		class="scale-bar"
		class:quiet
		data-stage-scale-bar
		role="img"
		aria-label={`Scale bar: ${formatMeters(bar.meters)}`}
	>
		<span class="rule" style={`width: ${Math.max(24, Math.round(bar.cssPx))}px`}>
			<span class="tick start"></span>
			<span class="tick end"></span>
		</span>
		<span class="length">{formatMeters(bar.meters)}</span>
	</div>
{/if}

<style>
	.scale-bar {
		position: absolute;
		bottom: 0.7rem;
		left: 0.8rem;
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		color: #f4f0e9;
		pointer-events: none;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.72rem;
		letter-spacing: 0.02em;
		text-shadow: 0 1px 2px rgb(6 20 14 / 55%);
	}
	.scale-bar.quiet {
		color: #233a2e;
		text-shadow: none;
	}
	.rule {
		position: relative;
		display: block;
		height: 1px;
		background: currentColor;
	}
	.tick {
		position: absolute;
		bottom: 0;
		width: 1px;
		height: 5px;
		background: currentColor;
	}
	.tick.start {
		left: 0;
	}
	.tick.end {
		right: 0;
	}
	.length {
		line-height: 1;
		text-align: center;
	}
	/* The ruler rises only when the centred lower column can reach it. */
	@media (max-width: 760px) {
		.scale-bar {
			bottom: calc(0.7rem + var(--lower-column-height, 0px));
		}
	}
	@media (pointer: coarse) {
		.scale-bar {
			left: 0.6rem;
			font-size: 0.76rem;
		}
	}
</style>

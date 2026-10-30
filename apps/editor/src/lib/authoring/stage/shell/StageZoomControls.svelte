<script lang="ts">
	/**
	 * R217.S13 — the lower-right **zoom cluster** (O8, D40).
	 *
	 * Three native buttons: zoom in, zoom out and Fit. Each requests the route's
	 * existing Camera intent — the same `zoom` the wheel drives and the same `fit`
	 * intent Scale used to reach. Nothing here composes a pose, retargets or
	 * rescales the Camera on its own.
	 */
	let {
		quiet = false,
		onZoomIn,
		onZoomOut,
		onFit
	}: {
		/** Paper's quiet light ink instead of the mat's chassis ink. */
		quiet?: boolean;
		onZoomIn: () => void;
		onZoomOut: () => void;
		onFit: () => void;
	} = $props();
</script>

<div class="zoom" class:quiet data-stage-zoom role="group" aria-label="Zoom and framing">
	<button type="button" data-stage-zoom-in title="Zoom in" onclick={onZoomIn}>+</button>
	<button type="button" data-stage-zoom-out title="Zoom out" onclick={onZoomOut}>−</button>
	<button type="button" data-stage-fit title="Fit all (F)" onclick={onFit}>Fit</button>
</div>

<style>
	.zoom {
		display: inline-flex;
		overflow: hidden;
		border: 1px solid #405d4c;
		border-radius: 0.4rem;
		background: #11291f;
		color: #f4f0e9;
	}
	.zoom.quiet {
		border-color: #a9b7a9;
		background: #f4f0e9;
		color: #14231b;
	}
	button {
		min-width: 2.25rem;
		min-height: 2.25rem;
		padding: 0 0.6rem;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 0.86rem;
		line-height: 1;
		cursor: pointer;
	}
	button + button {
		border-left: 1px solid #405d4c;
	}
	.zoom.quiet button + button {
		border-left-color: #a9b7a9;
	}
	button:hover {
		background: rgb(109 143 123 / 22%);
	}
	button:focus-visible {
		outline: 2px solid #9fd0b4;
		outline-offset: -2px;
	}
	.zoom.quiet button:focus-visible {
		outline-color: #22503c;
	}
	@media (pointer: coarse) {
		button {
			min-width: 44px;
			min-height: 44px;
		}
	}
</style>

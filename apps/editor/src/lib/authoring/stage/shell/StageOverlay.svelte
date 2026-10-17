<script lang="ts">
	/**
	 * The Stage's overlay layer.
	 *
	 * Overlays are **not** a second projection: every marker's CSS position was
	 * produced by `projectWorld` through the same `ViewportEvaluation` the meshes
	 * were drawn with (the parent projects them and passes CSS points). This
	 * component only paints them, so an overlay can never disagree with the render.
	 *
	 * It is an absolutely positioned, `pointer-events: none` layer above the canvas:
	 * card, instrument and sheets sit in their own surfaces, and nothing here
	 * resizes or reframes the Stage.
	 */
	let {
		markers,
		selectionMarker
	}: {
		markers: readonly { id: string; css: readonly [number, number]; label: string }[];
		selectionMarker: { css: readonly [number, number]; label: string } | null;
	} = $props();
</script>

<svg class="overlay" aria-hidden="true" focusable="false">
	{#each markers as marker (marker.id)}
		<g class="marker" transform={`translate(${marker.css[0]} ${marker.css[1]})`}>
			<circle r="4" />
			<title>{marker.label}</title>
		</g>
	{/each}
	{#if selectionMarker}
		<g class="selection" transform={`translate(${selectionMarker.css[0]} ${selectionMarker.css[1]})`}>
			<circle r="7" />
			<circle class="echo" r="11" />
			<title>{selectionMarker.label}</title>
		</g>
	{/if}
</svg>

<style>
	.overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		overflow: visible;
	}
	.marker circle {
		fill: none;
		stroke: #a6a6ad;
		stroke-width: 1.5;
	}
	.selection circle {
		fill: #d4ad45;
		stroke: #f4f0e9;
		stroke-width: 1.5;
	}
	.selection .echo {
		fill: none;
		stroke: #d4ad45;
		stroke-width: 1;
		opacity: 0.7;
	}
</style>

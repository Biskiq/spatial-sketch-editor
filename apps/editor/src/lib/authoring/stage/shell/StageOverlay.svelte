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
		selectionMarker,
		tracePreview = null
	}: {
		markers: readonly { id: string; css: readonly [number, number]; label: string }[];
		tracePreview?: import('$lib/platform/perf-marks').PerfTracePreview | null;
		selectionMarker: { css: readonly [number, number]; label: string } | null;
	} = $props();
</script>

<svg class="overlay" aria-hidden="true" focusable="false">
	{#each markers as marker (marker.id)}
		<g class="marker" transform={`translate(${marker.css[0]} ${marker.css[1]})`}>
			<circle r="4" />
			<title>{marker.label}</title>
			{#if tracePreview && marker.id === 'layout-wall-preview'}
				<!-- Same SVG update and actual preview transform; no separate token clock. -->
				<rect x="-12" y="-12" width="24" height="24" fill="#ff00ff" />
			{/if}
		</g>
	{/each}
	{#if selectionMarker}
		<g class="selection" transform={`translate(${selectionMarker.css[0]} ${selectionMarker.css[1]})`}>
			<circle r="7" />
			<circle class="echo" r="11" />
			<title>{selectionMarker.label}</title>
		</g>
	{/if}
	{#if tracePreview}
		<g data-perf-trace-proof transform="translate(8 8)">
			<rect x="-2" y="-2" width="132" height="132" fill="white" />
			{#each tracePreview.bits as bit, index}
				<rect x={(index % 8) * 16} y={Math.floor(index / 8) * 16} width="16" height="16" fill={bit ? '#000000' : '#ffffff'} />
			{/each}
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

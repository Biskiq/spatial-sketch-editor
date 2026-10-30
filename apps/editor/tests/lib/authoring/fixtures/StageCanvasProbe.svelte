<script lang="ts">
	/**
	 * Non-WebGL StageCanvas double. The route test only needs to see whether the
	 * mounted Stage is still there (and whether it is the same node), not render
	 * the three.js scene. The Height Sheet props are surfaced as data attributes so
	 * the mounted route can assert the plane follows the Sheet's active state.
	 */
	let {
		heightMeters = null,
		heightPlaneVisible = false,
		...rest
	}: {
		heightMeters?: number | null;
		heightPlaneVisible?: boolean;
	} = $props();
	// Referencing the received props keeps this double honest about accepting the
	// real component's surface without claiming any of its behaviour.
	const received = $derived(Object.keys(rest).length);
</script>

<div
	data-testid="stage-canvas"
	data-props={received}
	data-height-meters={heightMeters ?? 'none'}
	data-height-plane={String(heightPlaneVisible)}
></div>

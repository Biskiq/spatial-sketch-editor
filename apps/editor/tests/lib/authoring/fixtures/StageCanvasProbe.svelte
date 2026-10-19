<script lang="ts">
	/**
	 * Non-WebGL StageCanvas double. The route test only needs to see whether the
	 * mounted Stage is still there (and whether it is the same node), not render
	 * the three.js scene.
	 */
	let props = $props();
	// Referencing the received props keeps this double honest about accepting the
	// real component's surface without claiming any of its behaviour.
	const received = $derived(Object.keys(props).length);
</script>

<div data-testid="stage-canvas" data-props={received}></div>

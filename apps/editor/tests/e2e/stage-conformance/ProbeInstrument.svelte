<script lang="ts">
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { heightIntent } from './probe-adapter';
	let { services }: { services: StageAdapterServices } = $props();
	let result = $state('Ready');
</script>
<button type="button" onclick={async () => { result = (await services.authoring.accept(heightIntent(services))).kind; }}>
	Apply conformance height
</button>
<p role="status">{result}</p>

<script lang="ts">
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	let { services }: { services: StageAdapterServices } = $props();
	type Fields = typeof import('./FormCardFields.svelte')['default'];
	let Fields = $state<Fields | null>(null);
	let failed = $state(false);
	$effect(() => {
		let cancelled = false;
		void import('./FormCardFields.svelte').then((module) => { if (!cancelled) Fields = module.default; })
			.catch(() => { if (!cancelled) failed = true; });
		return () => { cancelled = true; };
	});
</script>
{#if Fields}<Fields {services} />
{:else if failed}<p role="alert">Form fields could not load. Select the form again to retry.</p>
{:else}<p role="status">Opening form fields…</p>{/if}

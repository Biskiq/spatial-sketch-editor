<script lang="ts">
	/**
	 * The My Objects lazy boundary.
	 *
	 * Stage first load carries only this toggle. The library client, the shared
	 * payload codec and the evaluator are downloaded when the creator first opens
	 * My Objects, so a project that never uses the library pays none of it.
	 */
	import type { Component } from 'svelte';

	import type { ArmedFormCopy } from '../placement';
	import type { FormLibraryClient } from './client';

	type MyObjectsComponent = Component<{
		client?: FormLibraryClient;
		armedCopy?: ArmedFormCopy | null;
		startOpen?: boolean;
		showToggle?: boolean;
		onArm: (copy: ArmedFormCopy) => boolean;
		onClear: () => void;
	}>;

	let {
		client,
		armedCopy = null,
		onArm,
		onClear
	}: {
		/** Injectable for the one-click wrapper test; production reads the API origin. */
		client?: FormLibraryClient;
		armedCopy?: ArmedFormCopy | null;
		onArm: (copy: ArmedFormCopy) => boolean;
		onClear: () => void;
	} = $props();

	let open = $state(false);
	let Section = $state<MyObjectsComponent | null>(null);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	function load(): void {
		if (Section !== null || loading) return;
		loading = true;
		loadError = null;
		// The library client, payload codec and evaluator arrive only when the
		// creator first opens My Objects, so Stage first load pays only this toggle.
		void import('./MyObjectsSection.svelte')
			.then((module) => {
				Section = module.default as MyObjectsComponent;
			})
			.catch(() => {
				loadError = 'My Objects could not be loaded. Check the connection and try again.';
			})
			.finally(() => {
				loading = false;
			});
	}

	function toggle(): void {
		open = !open;
		if (open) load();
	}
</script>

<section class="my-objects-lazy" aria-label="My Objects library">
	<button
		type="button"
		class="toggle"
		data-my-objects-toggle
		aria-expanded={open}
		aria-controls="my-objects-lazy-panel"
		onclick={toggle}
	>
		My Objects
	</button>
	{#if open}
		<div id="my-objects-lazy-panel">
			{#if Section}
				<Section {client} {armedCopy} {onArm} {onClear} startOpen showToggle={false} />
			{:else if loadError}
				<p class="loading" role="alert">{loadError}</p>
				<button type="button" class="toggle" onclick={load}>Try again</button>
			{:else}
				<p class="loading" role="status">Loading My Objects…</p>
			{/if}
		</div>
	{/if}
</section>

<style>
	.my-objects-lazy {
		border-top: 1px solid #4d4655;
		padding-top: 0.55rem;
	}
	.toggle {
		font: inherit;
		min-height: 2.75rem;
		padding: 0 0.5rem;
		border: 1px solid transparent;
		border-radius: 0.3rem;
		background: transparent;
		color: #d9c9ff;
		font-weight: 650;
		cursor: pointer;
	}
	.loading {
		margin: 0.35rem 0 0;
		color: #8f8a99;
		font-size: 0.74rem;
	}
</style>

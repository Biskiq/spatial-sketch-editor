<script lang="ts">
	/**
	 * T2.S8 G browser gate. It runs the real source authoring fixture, Save,
	 * two independent inserts, one instance edit, removal and cold reopen. The
	 * report is exposed as a data attribute for a browser runner; no product UI
	 * is implied (U owns that).
	 */
	import { onMount } from 'svelte';
	import { buildGGate } from './fixture';

	let report = $state<Record<string, unknown> | null>(null);
	let error = $state<string | null>(null);

	onMount(() => {
		void buildGGate()
			.then((result) => {
				report = result;
				document.documentElement.dataset.s8GReady = result.ok ? 'true' : 'error';
			})
			.catch((cause: unknown) => {
				error = cause instanceof Error ? cause.message : String(cause);
				document.documentElement.dataset.s8GReady = 'error';
			});
	});
</script>

<svelte:head>
	<title>S8 G gate</title>
</svelte:head>

<main
	data-s8-g
	data-s8-g-ready={report !== null ? 'true' : error === null ? 'false' : 'error'}
	data-s8-g-result={report === null ? null : JSON.stringify(report)}
	data-s8-g-error={error}
>
	<h1>S8 G transfer gate</h1>
	{#if report !== null}
		<pre>{JSON.stringify(report, null, 2)}</pre>
	{:else if error !== null}
		<p class="error">{error}</p>
	{:else}
		<p>Running Save, two inserts, one edit, removal and cold reopen…</p>
	{/if}
</main>

<style>
	main {
		padding: 24px;
		font: 13px/1.5 ui-monospace, monospace;
		color: #e8e6df;
		background: #121218;
		min-height: 100vh;
		box-sizing: border-box;
	}
	h1 {
		font-size: 16px;
	}
	pre {
		white-space: pre-wrap;
	}
	.error {
		color: #ffb4a8;
	}
</style>

<script lang="ts">
	/**
	 * `/studio` — the standalone Object Studio launcher.
	 *
	 * A bookmarkable address for "New object": it mints one project identity and
	 * replaces itself with the ordinary spatial route in the Studio posture. There is
	 * no separate editor here and nothing is saved by arriving.
	 */
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { createProjectId } from '$lib/platform/project-identity';
	import { studioProjectUrl } from '$lib/platform/studio-entry';

	let failed = $state(false);

	function open(): void {
		failed = false;
		goto(studioProjectUrl(createProjectId(), { create: true }), { replaceState: true }).catch(() => {
			failed = true;
		});
	}

	onMount(open);
</script>

<svelte:head>
	<title>Object Studio — Biskiq Editor</title>
</svelte:head>

<main class="studio-launch">
	<section aria-labelledby="studio-launch-title">
		<p class="eyebrow">Biskiq Editor</p>
		<h1 id="studio-launch-title">Object Studio</h1>
		{#if failed}
			<p role="alert">Object Studio could not open.</p>
			<div class="actions">
				<button type="button" class="primary" onclick={open}>Try again</button>
				<a href="/projects">Projects</a>
			</div>
		{:else}
			<p role="status">Opening a new object…</p>
		{/if}
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background: var(--shell-forest);
		color: var(--shell-ivory);
		font-family: var(--shell-sans);
	}
	.studio-launch {
		display: grid;
		min-height: 100dvh;
		place-items: center;
		padding: 16px;
		box-sizing: border-box;
	}
	section {
		width: min(26rem, 100%);
		padding: 2rem;
		box-sizing: border-box;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.05);
	}
	.eyebrow {
		margin: 0 0 0.8rem;
		color: var(--shell-gold);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0 0 0.9rem;
		font-family: var(--shell-serif);
		font-weight: 500;
		font-size: 2rem;
	}
	p { margin: 0; color: #cdd8d1; line-height: 1.5; }
	.actions { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 1.25rem; }
	button, a {
		padding: 0.65rem 1rem;
		border: 1px solid rgba(255, 255, 255, 0.28);
		border-radius: 8px;
		background: transparent;
		color: var(--shell-ivory);
		font: inherit;
		font-size: 0.9rem;
		text-decoration: none;
		cursor: pointer;
	}
	button.primary { border-color: var(--shell-gold); background: var(--shell-gold); color: var(--shell-forest); font-weight: 600; }
	button:focus-visible, a:focus-visible { outline: 2px solid var(--shell-gold); outline-offset: 2px; }
</style>

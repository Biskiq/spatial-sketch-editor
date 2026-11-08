<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { createProjectId } from '$lib/platform/project-persistence';

	onMount(() => {
		// `/editor` mints a fresh project id, so its address carries the create intent:
		// the route host reads it to offer the starter gallery on an absent row instead
		// of reporting a project that was never started.
		void goto(`/project/${encodeURIComponent(createProjectId())}/spatial?create=1`, { replaceState: true });
	});
</script>

<svelte:head>
	<title>Museum editor</title>
</svelte:head>

<main class="opening" aria-live="polite" aria-busy="true">
	<header class="opening-head">
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" focusable="false">
			<path d="M5 21V10a7 7 0 0 1 14 0v11" />
			<path d="M9 21v-8a3 3 0 0 1 6 0v8" />
		</svg>
		<span>Spatial</span>
	</header>
	<div class="opening-body">
		<p class="opening-name">Spatial</p>
		<p class="opening-line">Opening…</p>
		<div class="opening-bar" aria-hidden="true"><i></i></div>
	</div>
</main>

<style>
	:global(body) {
		margin: 0;
		background: var(--shell-paper);
	}
	.opening {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
		box-sizing: border-box;
		background: var(--shell-paper);
		font-family: var(--shell-sans);
	}
	.opening-head {
		display: flex;
		align-items: center;
		gap: 8px;
		height: var(--shell-head-height);
		padding: 0 16px;
		box-sizing: border-box;
		background: var(--shell-forest);
		color: var(--shell-ivory);
		font-family: var(--shell-serif);
		font-size: var(--shell-text-identity);
		font-weight: 500;
	}
	.opening-body {
		flex: 1;
		display: grid;
		place-content: center;
		justify-items: center;
		padding: 16px;
		box-sizing: border-box;
		text-align: center;
		background-color: var(--shell-paper);
		background-image:
			linear-gradient(rgba(27, 32, 28, 0.06) 1px, transparent 1px),
			linear-gradient(90deg, rgba(27, 32, 28, 0.06) 1px, transparent 1px);
		background-size: 28px 28px;
	}
	.opening-name {
		margin: 0;
		font-family: 'Iowan Old Style', Palatino, Georgia, serif;
		font-weight: 500;
		font-size: clamp(1.6rem, 6vw, 2.2rem);
		line-height: 1.1;
		color: var(--shell-ink);
	}
	.opening-line {
		margin: 8px 0 0;
		font-size: var(--shell-text-body);
		color: var(--shell-ink-2);
	}
	.opening-bar {
		position: relative;
		width: 120px;
		height: 2px;
		margin-top: 16px;
		border-radius: 2px;
		overflow: hidden;
		background: var(--shell-hairline-strong);
	}
	.opening-bar i {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: 40%;
		border-radius: 2px;
		background: var(--shell-gold);
		animation: opening-slide 1.4s ease-in-out infinite;
	}
	@keyframes opening-slide {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(250%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.opening-bar i {
			animation: none;
			left: 30%;
		}
	}
</style>

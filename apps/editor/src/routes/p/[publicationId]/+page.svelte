<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import VisitorPreviewSurface from '$lib/visitor/VisitorPreviewSurface.svelte';
	import {
		isValidPublicationId,
		loadPublicReleaseBundle,
		PublicVisitorError,
		type ColdReleaseBundle
	} from '$lib/visitor/public-release-client';
	import type { TextureLoadScope } from '$lib/museum/materials/texture-cache';

	type PublicStatus = 'loading' | 'ready' | 'not-found' | 'failed' | 'missing-config';

	const apiOrigin = env.PUBLIC_API_ORIGIN ?? '';
	const publicationId = $derived(page.params.publicationId ?? '');

	let status = $state<PublicStatus>('loading');
	let bundle = $state<ColdReleaseBundle | null>(null);
	let textureScope = $state<TextureLoadScope | null>(null);
	let releaseVersion = $state<number | null>(null);
	let errorMessage = $state<string | null>(null);
	let retryToken = $state(0);
	let reducedMotion = $state(false);
	let activeController: AbortController | null = null;

	function disposeBundle(): void {
		if (bundle) {
			try {
				bundle.dispose();
			} catch {
				// Best effort; a disposed scope never throws.
			}
		}
		bundle = null;
		textureScope = null;
		releaseVersion = null;
	}

	function toStatus(error: unknown): { status: PublicStatus; message: string | null } {
		if (error instanceof PublicVisitorError) {
			if (error.code === 'not-found') return { status: 'not-found', message: null };
			return { status: 'failed', message: error.message };
		}
		return { status: 'failed', message: 'The published project could not be loaded' };
	}

	async function runLoad(id: string, signal: AbortSignal): Promise<void> {
		if (!isValidPublicationId(id)) {
			status = 'not-found';
			errorMessage = null;
			return;
		}
		if (!apiOrigin) {
			status = 'missing-config';
			errorMessage = null;
			return;
		}
		status = 'loading';
		errorMessage = null;
		try {
			const loaded = await loadPublicReleaseBundle({
				publicationId: id,
				apiOrigin,
				signal
			});
			if (signal.aborted) {
				loaded.bundle.dispose();
				return;
			}
			disposeBundle();
			bundle = loaded.bundle;
			releaseVersion = loaded.version;
			// Adapt the release scope to the texture-cache key: one loader per
			// bundle, scoped cache keys so this release never shares bytes
			// with another publication or version.
			const loader = loaded.bundle.textureScope.createSourceLoader();
			textureScope = { scopeId: loaded.bundle.textureScope.scopeId, loader };
			status = 'ready';
		} catch (error) {
			if (signal.aborted) return;
			disposeBundle();
			const mapped = toStatus(error);
			status = mapped.status;
			errorMessage = mapped.message;
		}
	}

	// Key the runtime by public ID + attempt: a new publication ID, Back/
	// Forward navigation, or an explicit retry aborts the obsolete fetch and
	// disposes the previous release (revoking its object URLs) before the
	// next bootstrap starts. Late responses never update the new view.
	$effect(() => {
		const id = publicationId;
		void retryToken;
		activeController?.abort();
		untrack(disposeBundle);
		status = 'loading';
		errorMessage = null;
		const controller = new AbortController();
		activeController = controller;
		void runLoad(id, controller.signal);
		return () => {
			controller.abort();
			if (activeController === controller) activeController = null;
		};
	});

	onMount(() => {
		const query = window.matchMedia('(prefers-reduced-motion: reduce)');
		reducedMotion = query.matches;
		const onChange = (event: MediaQueryListEvent) => {
			reducedMotion = event.matches;
		};
		query.addEventListener('change', onChange);
		return () => query.removeEventListener('change', onChange);
	});

	onDestroy(() => {
		activeController?.abort();
		disposeBundle();
	});

	function retry(): void {
		retryToken += 1;
	}
</script>

<svelte:head>
	<title>{bundle ? `${bundle.projectName} — Published` : 'Published project'}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="public-page">
	{#if status === 'ready' && bundle}
		{@const readyBundle = bundle}
		{@const readyScope = textureScope}
		{@const version = releaseVersion}
		<header class="public-header">
			<p class="eyebrow">Published project</p>
			<h1 class="public-title">{readyBundle.projectName}</h1>
			{#if version !== null}
				<p class="public-meta">Version {version}</p>
			{/if}
		</header>
		<div class="public-canvas">
			{#key readyBundle.releaseId}
				<VisitorPreviewSurface
					scene={readyBundle.scene}
					geometry={readyBundle.geometry}
					rooms={readyBundle.rooms}
					graph={readyBundle.graph}
					resolveTexture={readyBundle.textureScope.resolveTexture}
					textureScope={readyScope}
					artworkScope={readyBundle.artworkScope}
					{reducedMotion}
					mode="public"
					title={readyBundle.projectName}
				/>
			{/key}
		</div>
		<footer class="public-help">
			<p>
				{#if readyBundle.graph.navigationNodes.length === 0}
					Drag to orbit · scroll to zoom · right-drag to pan.
				{:else}
					Left and Right arrows move along the tour · W A S D or drag to look around.
				{/if}
				{#if reducedMotion}Reduced motion is on — tour jumps cut directly.{/if}
			</p>
		</footer>
	{:else if status === 'not-found'}
		<section class="public-card" aria-labelledby="public-missing-title">
			<p class="eyebrow">Published project</p>
			<h1 id="public-missing-title">This link is unavailable</h1>
			<p class="lede">It may never have been published, or the owner may have unpublished it.</p>
			<a class="button" href="/">Start a project</a>
		</section>
	{:else if status === 'missing-config'}
		<section class="public-card" aria-labelledby="public-config-title">
			<p class="eyebrow">Published project</p>
			<h1 id="public-config-title">Publishing is unavailable</h1>
			<p class="lede">The publish service is not configured for this site.</p>
		</section>
	{:else if status === 'failed'}
		<section class="public-card" aria-labelledby="public-failed-title">
			<p class="eyebrow">Published project</p>
			<h1 id="public-failed-title">Could not load this project</h1>
			<p class="lede">{errorMessage ?? 'The published project could not be loaded.'}</p>
			<button type="button" class="button" onclick={retry}>Retry</button>
		</section>
	{:else}
		<section class="public-card" aria-labelledby="public-loading-title" aria-busy="true">
			<p class="eyebrow">Published project</p>
			<h1 id="public-loading-title">Loading published project…</h1>
			<p class="lede" role="status">Fetching the published version and its textures.</p>
		</section>
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		background: #050508;
		color: #f4f0e9;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	.public-page {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		min-height: 100dvh;
		background: #050508;
	}
	.public-header {
		padding: 1rem 1.25rem 0.75rem;
		border-bottom: 1px solid #232229;
	}
	.eyebrow {
		margin: 0 0 0.4rem;
		color: #c9a9ff;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.public-title {
		margin: 0;
		font-size: clamp(1.4rem, 4vw, 2rem);
		line-height: 1.1;
	}
	.public-meta {
		margin: 0.35rem 0 0;
		color: #bcb5c4;
		font-size: 0.85rem;
	}
	.public-canvas {
		position: relative;
		min-height: min(70dvh, 40rem);
		height: calc(100dvh - 12rem);
		min-height: 24rem;
		overflow: hidden;
	}
	.public-help {
		padding: 0.65rem 1.25rem 1rem;
		border-top: 1px solid #232229;
		color: #bcb5c4;
		font-size: 0.85rem;
		line-height: 1.5;
	}
	.public-help p {
		margin: 0;
	}
	.public-card {
		width: min(30rem, calc(100% - 3rem));
		margin: 20dvh auto;
		padding: 1.75rem;
		border: 1px solid #383340;
		border-radius: 0.8rem;
		background: #121218;
		box-sizing: border-box;
	}
	.public-card h1 {
		margin: 0;
		font-size: 1.5rem;
	}
	.lede {
		margin: 0.9rem 0 0;
		color: #bcb5c4;
		line-height: 1.5;
	}
	.button {
		display: inline-block;
		margin-top: 1.25rem;
		padding: 0.6rem 0.85rem;
		border: 1px solid #b997f2;
		border-radius: 0.4rem;
		background: #8f69c8;
		color: var(--shell-white);
		font: inherit;
		cursor: pointer;
		text-decoration: none;
	}
	button.button {
		border-color: #635a6f;
		background: #292632;
		color: inherit;
	}
	@media (max-width: 40rem) {
		.public-canvas {
			height: calc(100dvh - 14rem);
		}
	}
</style>

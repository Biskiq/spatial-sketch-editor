<script lang="ts">
	/**
	 * T2.S8 PR E — the browser acceptance gate.
	 *
	 * `?case=auto` accepts a recognised set (files shuffled) through the real
	 * adapter, `?case=manual` assembles the same draft by hand, and
	 * `?case=edited` accepts the set and then applies one typed patch. Each case
	 * saves, cold-admits and draws its release bundle through the product Scene
	 * description and representation. `auto` and `manual` must save identical
	 * bytes and draw identical pixels; `edited` must differ. `?backend=webgl2`
	 * observes the WebGL2 fallback.
	 */
	import { onDestroy, onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import { T } from '@threlte/core';
	import CanvasHost from '$lib/render/CanvasHost.svelte';
	import { provideRenderResources } from '$lib/render/resources/render-resources';
	import { describeSceneRender } from '$lib/render/scene-render-description';
	import { createSceneEntityRepresentation } from '$lib/render/scene-entity-representation';
	import {
		createProjectTextureScope,
		type ProjectTextureScope
	} from '$lib/render/resources/project-texture-scope';
	import DGateMount from '../s8-d/DGateMount.svelte';
	import { buildEGate, type EGateBundle, type EGateCase } from './fixture';

	// `?backend=webgl2` hides WebGPU before the canvas mounts, exactly as the D
	// gate runner does, so one browser can observe both product backends.
	if (page.url.searchParams.get('backend') === 'webgl2') {
		Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true });
	}
	const requested = page.url.searchParams.get('case');
	const label: EGateCase = requested === 'manual' || requested === 'edited' ? requested : 'auto';
	const resources = provideRenderResources();
	let bundle: EGateBundle | null = null;
	let representation = $state.raw<ReturnType<typeof createSceneEntityRepresentation> | null>(null);
	let ready = $state(false);
	let error = $state<string | null>(null);
	let result = $state<Record<string, unknown> | null>(null);
	let textureScope: ProjectTextureScope | null = null;

	onMount(() => {
		void (async () => {
			try {
				const started = performance.now();
				const built = await buildEGate(label);
				bundle = built;
				textureScope = createProjectTextureScope({
					scopeId: `s8-e-gate-${label}`,
					pins: () => built.pins,
					load: async (assetId) => {
						const bytes = built.bytes.get(assetId);
						if (bytes === undefined) throw new Error(`no bytes for ${assetId}`);
						return { bytes, mime: 'image/png' };
					}
				});
				const description = describeSceneRender(built.scene);
				const rep = createSceneEntityRepresentation({
					store: resources.materials,
					geometry: resources.geometry,
					scope: () => textureScope,
					modelSupport: () => null,
					modelUrls: () => new Map()
				});
				representation = rep;
				await tick();
				rep.update(description);
				await rep.idle();
				await tick();
				await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
				result = {
					case: label,
					savedBytes: built.saved.length,
					savedHash: built.savedHash,
					...built.report,
					textureViews: description.items[0]?.textures?.views?.length ?? 0,
					backend: document.querySelector('[data-canvas-host]')?.getAttribute('data-backend') ?? 'unavailable',
					firstCorrectDrawMs: Math.round(performance.now() - started)
				};
				ready = true;
				document.documentElement.dataset.s8EReady = 'true';
			} catch (cause) {
				error = cause instanceof Error ? cause.message : String(cause);
				document.documentElement.dataset.s8EReady = 'error';
			}
		})();
	});

	onDestroy(() => {
		representation?.dispose();
		textureScope?.dispose();
		resources.dispose();
		bundle?.dispose();
	});
</script>

<svelte:head>
	<title>S8 E gate — {label}</title>
</svelte:head>

<main
	data-s8-e={label}
	data-s8-e-ready={ready ? 'true' : error === null ? 'false' : 'error'}
	data-s8-e-result={result === null ? null : JSON.stringify(result)}
	data-s8-e-error={error}
>
	<div class="viewport">
		<CanvasHost surface="preview" renderMode="always" placeholder="#121218">
			{#snippet children()}
				<T.PerspectiveCamera
					makeDefault
					position={[0, 1.1, 4.6]}
					fov={35}
					onCreate={(camera: import('three').PerspectiveCamera) => camera.lookAt(0, 0.9, 0)}
				/>
				<T.AmbientLight intensity={0.42} />
				<T.HemisphereLight args={['#f0e6d4', '#1a1814', 0.5]} />
				<T.DirectionalLight position={[3.4, 5.2, 4.2]} intensity={1.35} color="#fff4e5" />
				<T.DirectionalLight position={[-3.2, 2.2, -2.4]} intensity={0.45} color="#d9e6ff" />
				<T.Color attach="background" args={['#121218']} />
				{#if representation !== null}
					<DGateMount object={representation.object3d} />
				{/if}
			{/snippet}
		</CanvasHost>
	</div>
	{#if error !== null}
		<p>{error}</p>
	{/if}
</main>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		background: #121218;
	}
	main {
		display: grid;
		place-items: center;
		width: 100vw;
		height: 100vh;
	}
	.viewport {
		width: 512px;
		height: 512px;
	}
	p {
		position: fixed;
		inset: auto 12px 12px 12px;
		color: #ffb4a8;
		font: 12px/1.4 monospace;
	}
</style>

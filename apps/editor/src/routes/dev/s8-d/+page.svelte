<script lang="ts">
	/**
	 * T2.S8 PR D — the visual exit gate.
	 *
	 * `?case=d` builds the real three-image brushed-metal Finish, saves it through
	 * the serializer, admits those bytes in a fresh session and draws the cold
	 * release bundle through the product Scene description and representation.
	 * `?case=b` draws the accepted B path: the same effective inputs carried by a
	 * catalogue base and overrides. Both share geometry, camera and lights, so a
	 * screenshot pair is a controlled pixel comparison.
	 */
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { T } from '@threlte/core';
	import CanvasHost from '$lib/render/CanvasHost.svelte';
	import { provideRenderResources } from '$lib/render/resources/render-resources';
	import { describeSceneRender } from '$lib/render/scene-render-description';
	import { createSceneEntityRepresentation } from '$lib/render/scene-entity-representation';
	import DGateMount from './DGateMount.svelte';
	import DMotion from './DMotion.svelte';
	import { buildDGate, sceneForCase, type DGateBundle } from './fixture';
	import { sceneFinishFor } from '$lib/render/materials/scene-instance-material';
	import {
		createProjectTextureScope,
		type ProjectTextureScope
	} from '$lib/render/resources/project-texture-scope';
	import { textureSourceMemoryStats } from '$lib/render/resources/texture-store';

	const label = page.url.searchParams.get('case') === 'b' ? 'b' : 'd';
	const resources = provideRenderResources();
	let bundle: DGateBundle | null = $state(null);
	let representation = $state.raw<ReturnType<typeof createSceneEntityRepresentation> | null>(null);
	let ready = $state(false);
	let error = $state<string | null>(null);
	let result = $state<Record<string, unknown> | null>(null);
	let textureScope: ProjectTextureScope | null = null;
	let measureMotion = $state(false);
	let motionSample: ((intervals: readonly number[]) => void) | null = null;

	onMount(() => {
		void (async () => {
			try {
				const started = performance.now();
				const built = await buildDGate();
				const builtAt = performance.now();
				bundle = built;
				const pins = new Map(
					built.envelope.units.resources.data.resources
						.filter((resource) => resource.kind === 'texture' && resource.pin !== null)
						.map((resource) => [
							resource.id,
							{ hash: resource.pin!.hash, mime: resource.pin!.mime, size: resource.pin!.size }
						])
				);
				textureScope = createProjectTextureScope({
					scopeId: 's8-d-gate',
					pins: () => pins,
					load: async (assetId) => {
						const bytes = built.imageUris.get(`/project-assets/${assetId}`);
						if (bytes === undefined) throw new Error(`no bytes for ${assetId}`);
						return { bytes, mime: 'image/png' };
					}
				});
				const scene = sceneForCase(built, label);
				const description = describeSceneRender(scene);
				const item = description.items[0];
				const bounds = item === undefined
					? null
					: sceneFinishFor(
							scene,
							{ materialInstanceId: 'finish-d', fallbackCatalogueId: 'plaster-warm' },
							{ kind: 'metric', uvMeters: [1, 1], surfaceMeters: [1, 1] }
						);
				const rep = createSceneEntityRepresentation({
					store: resources.materials,
					geometry: resources.geometry,
					scope: () => textureScope,
					modelSupport: () => null,
					modelUrls: () => new Map()
				});
				representation = rep;
				rep.update(description);
				await rep.idle();
				await new Promise<void>((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
				);
				const firstDrawAt = performance.now();
				const texturesAfterFirstDraw = textureSourceMemoryStats();
				// Warm Finish edits: a new Scene identity and a uniform-only change,
				// through the same description and representation the product uses.
				const editSamples: number[] = [];
				for (let index = 0; index < 15; index += 1) {
					const edited = {
						...scene,
						materials: scene.materials.map((material) => ({
							...material,
							overrides: { ...material.overrides, roughness: 0.3 + index * 0.002 }
						}))
					};
					const editStarted = performance.now();
					rep.update(describeSceneRender(edited));
					await rep.idle();
					if (index >= 3) editSamples.push(performance.now() - editStarted);
				}
				rep.update(description);
				await rep.idle();
				const resourcesAfterEdits = {
					geometry: resources.geometry.stats(),
					materials: resources.materials.stats(),
					textures: textureSourceMemoryStats()
				};
				// The same description again: a fresh rep would take the cached path.
				await rep.idle();
				const resourcesAfterReuse = {
					geometry: resources.geometry.stats(),
					materials: resources.materials.stats(),
					textures: textureSourceMemoryStats()
				};
				const motionIntervals = await new Promise<readonly number[]>((resolve) => {
					motionSample = resolve;
					measureMotion = true;
				});
				measureMotion = false;
				const sorted = [...motionIntervals].sort((left, right) => left - right);
				const percentile = (values: readonly number[], fraction: number): number =>
					values[Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * fraction) - 1))] ?? 0;
				const sortedEdits = [...editSamples].sort((left, right) => left - right);
				result = {
					case: label,
					savedBytes: built.saved.length,
					recipeHash: built.sampled.recipeHash,
					images: built.sampled.images,
					roles: built.sampled.maps,
					sceneRevision: built.envelope.units.scene.header.contentRevision,
					textures: description.items[0]?.textures?.views?.length ?? 0,
					finishEntries: bounds?.material.finish?.entries.map((entry) => ({
						role: entry.role,
						uvSet: entry.uvSet,
						origin: entry.origin,
						repeat: entry.repeat,
						rotation: entry.rotation,
						offset: entry.offset
					})) ?? [],
					issues: bounds?.issues.map((issue) => issue.code) ?? [],
					backend: document.querySelector('[data-canvas-host]')?.getAttribute('data-backend') ?? 'unavailable',
					coldPublic: {
						composer: 'composeColdReleaseBundle',
						savedBytes: built.saved.length,
						textures: built.scene.textures.length,
						entities: built.scene.entities.map((entity) => entity.kind),
						forms: built.scene.entities.filter((entity) => entity.kind === 'form').length,
						modelPlacements: built.scene.objects.length
					},
					timing: {
						buildMs: Math.round(builtAt - started),
						coldLoadAndDrawMs: Math.round(firstDrawAt - builtAt),
						firstCorrectDrawMs: Math.round(firstDrawAt - started),
						warmEditP50Ms: Number((percentile(sortedEdits, 0.5)).toFixed(2)),
						warmEditP90Ms: Number((percentile(sortedEdits, 0.9)).toFixed(2)),
						warmEditSamples: sortedEdits.length,
						motionFrames: sorted.length,
						motionP95Ms: Number((percentile(sorted, 0.95)).toFixed(2)),
						motionMeanMs: Number((sorted.reduce((sum, value) => sum + value, 0) / Math.max(1, sorted.length)).toFixed(2))
					},
					resources: {
						geometry: resources.geometry.stats(),
						materials: resources.materials.stats(),
						texturesAfterFirstDraw,
						resourcesAfterEdits,
						resourcesAfterReuse
					}
				};
				ready = true;
				document.documentElement.dataset.s8DReady = 'true';
				document.documentElement.dataset.s8DCase = label;
				void item;
			} catch (cause) {
				error = cause instanceof Error ? cause.message : String(cause);
				document.documentElement.dataset.s8DReady = 'error';
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
	<title>S8 D visual gate — {label}</title>
</svelte:head>

<main
	data-s8-d={label}
	data-s8-d-ready={ready ? 'true' : error === null ? 'false' : 'error'}
	data-s8-d-result={result === null ? null : JSON.stringify(result)}
	data-s8-d-error={error}
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
				{#if ready && representation !== null}
					<DGateMount object={representation.object3d} />
				{/if}
				{#if measureMotion}
					<DMotion
						onSample={(intervals) => {
							motionSample?.(intervals);
							motionSample = null;
						}}
					/>
				{/if}
			{/snippet}
		</CanvasHost>
	</div>
	{#if error !== null}
		<p data-s8-d-error-text>{error}</p>
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

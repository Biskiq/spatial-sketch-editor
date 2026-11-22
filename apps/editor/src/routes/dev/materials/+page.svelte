<script lang="ts">
	/**
	 * The E7 engineering consumer of material inspection.
	 *
	 * One host on the page's own renderer inspects a catalogue entry, the
	 * fixture's accepted Finish or a provisional draft, on each reference
	 * geometry, light and display. `?gate=e7` runs the technical checks and
	 * publishes its JSON; `?backend=webgl2` observes the compatibility backend.
	 * This is a dev surface, not Materials UX.
	 */
	import { INSPECTION_VERSION } from '$lib/render/materials/inspection';
	import { INSPECTION_GEOMETRY_VERSION } from '$lib/render/materials/inspection-geometry';
	import { INSPECTION_LIGHTING_VERSION } from '$lib/render/materials/inspection-lighting';
	import { onDestroy, onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import type { Camera, Scene } from 'three';
	import type { SceneSky } from '@portfolio/project-model/units';
	import CanvasHost from '$lib/render/CanvasHost.svelte';
	import type { CanvasRendererState } from '$lib/render/renderer-context';
	import { provideRenderResources } from '$lib/render/resources/render-resources';
	import { describeSceneRender } from '$lib/render/scene-render-description';
	import { describeSceneLights } from '$lib/render/scene-light-description';
	import { createSceneEntityRepresentation } from '$lib/render/scene-entity-representation';
	import { createSceneLightRepresentation } from '$lib/render/scene-light-representation';
	import { catalogueThumbnailUri } from '$lib/render/materials/catalogue-thumbnails';
	import type { InspectionGeometryKind } from '$lib/render/materials/inspection-geometry';
	import {
		createInspectionHost,
		type InspectionDisplay,
		type InspectionState,
		type InspectionTexel
	} from '$lib/render/materials/inspection-host';
	import type { InspectionSubject } from '$lib/render/materials/inspection-subject';
	import { worldLightSampleFor } from '$lib/render/materials/inspection-world';
	import { materials } from '$lib/content/materials';
	import type { MaterialId } from '$lib/types/materials';
	import StageReference from './StageReference.svelte';
	import { INSPECTION_ANCHOR, buildInspectionFixture, type InspectionFixture } from './fixture';
	import { runE7Gate, type GateReport } from './gate';

	if (page.url.searchParams.get('backend') === 'webgl2') {
		Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true });
	}
	const gated = page.url.searchParams.get('gate') === 'e7';

	const resources = provideRenderResources();
	const host = createInspectionHost({ materials: resources.materials, lights: resources.lights });

	let fixture = $state.raw<InspectionFixture | null>(null);
	let entities = $state.raw<ReturnType<typeof createSceneEntityRepresentation> | null>(null);
	let worldLights = $state.raw<ReturnType<typeof createSceneLightRepresentation> | null>(null);
	let stageScene: Scene | null = null;
	let stageCamera: Camera | null = null;
	let renderer: CanvasRendererState | null = null;
	let backend = $state('starting');
	let ready = $state(false);
	let error = $state<string | null>(null);
	let report = $state.raw<GateReport | null>(null);

	let subjectId = $state('finish');
	let geometry = $state<InspectionGeometryKind>('sphere');
	let lighting = $state<'studio' | 'grazing' | 'world' | 'paper'>('studio');
	let displayId = $state('lit');
	let size = $state('384x384');
	let uv = $state({ u: 0.5, v: 0.5 });
	let worldSky = $state.raw<SceneSky | null>(null);
	let referencesOpen = $state(true);
	let inspection = $state.raw<InspectionState>({ status: 'pending' });
	let texel = $state.raw<InspectionTexel | null>(null);
	let output = $state<HTMLCanvasElement | undefined>(undefined);

	const references = materials.map((material) => ({
		id: material.id,
		label: material.label,
		color: material.swatchColor ?? material.fallbackColor,
		thumbnail: catalogueThumbnailUri(material.id)
	}));

	function subjectOf(id: string, from: InspectionFixture): InspectionSubject {
		if (id === 'finish') return from.finish;
		if (id === 'draft') return { kind: 'draft', draft: from.drafts.corrected };
		if (id === 'absent-uv1') return { kind: 'draft', draft: from.drafts.secondUv };
		return { kind: 'catalogue', id: id as MaterialId };
	}
	const subject = $derived(fixture === null ? null : subjectOf(subjectId, fixture));

	$effect(() => {
		if (gated || fixture === null || subject === null) return;
		const [width, height] = size.split('x').map(Number);
		const display = (
			displayId === 'lit' || displayId === 'unlit-color' ? displayId : { solo: displayId }
		) as InspectionDisplay;
		return host.observe(
			{
				subject,
				geometry,
				lighting:
					lighting === 'studio' || lighting === 'grazing'
						? lighting
						: {
								world: worldLightSampleFor({
									scene: fixture.scene,
									acceptedRevision: fixture.revision,
									sky: lighting === 'world' ? fixture.sky : null,
									frame: fixture.frame,
									anchorWorld: INSPECTION_ANCHOR
								})
							},
				display,
				sizePx: [width!, height!]
			},
			(next) => (inspection = next)
		);
	});

	$effect(() => {
		if (gated || fixture === null) return;
		if (lighting === 'world') worldSky = fixture.sky;
		if (lighting === 'paper') worldSky = null;
	});

	$effect(() => {
		const state = inspection;
		if (output === undefined) return;
		const context = output.getContext('2d')!;
		if (!('frame' in state)) {
			context.clearRect(0, 0, output.width, output.height);
			return;
		}
		output.width = state.frame.width;
		output.height = state.frame.height;
		context.putImageData(
			new ImageData(new Uint8ClampedArray(state.frame.pixels), state.frame.width, state.frame.height),
			0,
			0
		);
	});

	function onRendererState(state: CanvasRendererState | null): void {
		if (state?.renderer == null || state.backend === null) {
			renderer = null;
			backend = 'starting';
			host.detach();
			return;
		}
		// The host record is mutable; keep this generation's values.
		renderer = { ...state, viewGeneration: { ...state.viewGeneration } };
		backend = state.backend;
		host.attach({ renderer: state.renderer, backend: state.backend, viewGeneration: state.viewGeneration });
	}

	const frames = () =>
		new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

	async function until(condition: () => boolean, what: string): Promise<void> {
		const started = performance.now();
		while (!condition()) {
			if (performance.now() - started > 30_000) throw new Error(`${what} was not ready`);
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
	}

	async function inspectTexel(): Promise<void> {
		if (subject !== null) texel = await host.texel({ subject, geometry, uv: [uv.u, uv.v] });
	}

	let disposed = false;

	onMount(() => {
		void (async () => {
			try {
				const built = await buildInspectionFixture();
				if (disposed) {
					built.dispose();
					return;
				}
				fixture = built;
				worldSky = built.sky;
				await until(() => renderer !== null, 'the renderer');
				const rep = createSceneEntityRepresentation({
					store: resources.materials,
					geometry: resources.geometry,
					scope: () => built.scope,
					modelSupport: () => null,
					modelUrls: () => new Map(),
					viewGeneration: () => renderer?.viewGeneration ?? null
				});
				const lightRep = createSceneLightRepresentation({ lights: resources.lights });
				lightRep.update(describeSceneLights(built.scene));
				entities = rep;
				worldLights = lightRep;
				await tick();
				rep.update(describeSceneRender(built.scene));
				await rep.idle();
				await frames();
				await until(() => stageScene !== null, 'the Stage reference');

				// The thumbnail generator renders through this page's host.
				Object.assign(window, {
					materialInspection: {
						versions: {
							inspection: INSPECTION_VERSION,
							lighting: INSPECTION_LIGHTING_VERSION,
							geometry: INSPECTION_GEOMETRY_VERSION
						},
						catalogue: materials.map((material) => material.id),
						async thumbnail(id: MaterialId) {
							const result = await host.thumbnail({ subject: { kind: 'catalogue', id } });
							if (result.status !== 'ready') return result;
							return { status: result.status, key: result.key, png: [...result.png] };
						}
					}
				});

				if (gated) {
					referencesOpen = false;
					await tick();
					report = await runE7Gate({
						resources,
						fixture: built,
						pageHost: host,
						renderer: () => renderer,
						stageScene: () => stageScene,
						stageCamera: () => {
							if (stageCamera === null) throw new Error('the Stage camera is not mounted');
							return JSON.stringify([stageCamera.matrixWorld.toArray(), stageCamera.projectionMatrix.toArray()]);
						},
						async showWorld(sky) {
							worldSky = sky;
							await tick();
							await rep.idle();
							await frames();
						},
						async showReferences(open) {
							referencesOpen = open;
							await tick();
							if (!open) return;
							await Promise.all(
								[...document.querySelectorAll<HTMLImageElement>('img[data-reference-thumbnail]')].map((image) =>
									image.decode()
								)
							);
						}
					});
				}
				ready = true;
			} catch (cause) {
				error = cause instanceof Error ? `${cause.message}\n${cause.stack}` : String(cause);
			}
		})();
	});

	onDestroy(() => {
		disposed = true;
		host.dispose();
		entities?.dispose();
		worldLights?.dispose();
		fixture?.dispose();
		resources.dispose();
	});
</script>

<svelte:head>
	<title>Material inspection — dev</title>
</svelte:head>

<main
	data-e7-ready={error !== null ? 'error' : ready}
	data-e7-backend={backend}
	data-e7-status={inspection.status}
	data-e7-result={report === null ? null : JSON.stringify(report)}
	data-e7-error={error}
>
	<header>
		<h1>Material inspection</h1>
		<span>{backend} · {inspection.status}</span>
		<label>
			Subject
			<select bind:value={subjectId}>
				<option value="finish">Accepted project Finish</option>
				<option value="draft">Corrected draft</option>
				<option value="absent-uv1">Draft with absent UV1</option>
				{#each materials as material (material.id)}
					<option value={material.id}>{material.label}</option>
				{/each}
			</select>
		</label>
		<label>
			Geometry
			<select bind:value={geometry}>
				<option value="sphere">Sphere</option>
				<option value="plane">Plane</option>
				<option value="block">Block</option>
			</select>
		</label>
		<label>
			Lighting
			<select bind:value={lighting}>
				<option value="studio">Studio</option>
				<option value="grazing">Grazing</option>
				<option value="world">Current World, Sky</option>
				<option value="paper">Current World, Paper</option>
			</select>
		</label>
		<label>
			Display
			<select bind:value={displayId}>
				{#each ['lit', 'unlit-color', 'color', 'normal', 'roughness', 'metalness', 'occlusion'] as id (id)}
					<option value={id}>{id}</option>
				{/each}
			</select>
		</label>
		<label>
			Size
			<select bind:value={size}>
				{#each ['64x64', '192x192', '384x384', '768x768', '384x192', '192x384'] as value (value)}
					<option {value}>{value}</option>
				{/each}
			</select>
		</label>
	</header>

	{#if error !== null}
		<pre role="alert">{error}</pre>
	{/if}

	<section class="views">
		<figure>
			<canvas bind:this={output} width="384" height="384" data-e7-output></canvas>
			<figcaption>Inspection</figcaption>
		</figure>
		<figure>
			<div class="stage">
				<CanvasHost surface="preview" renderMode="always" placeholder="#555555" {onRendererState}>
					{#snippet children()}
						{#if fixture !== null && entities !== null && worldLights !== null}
							<StageReference
								sky={worldSky}
								frame={fixture.frame}
								entities={entities.object3d}
								lights={worldLights.object3d}
								onScene={(scene, camera) => {
									stageScene = scene;
									stageCamera = camera;
								}}
							/>
						{/if}
					{/snippet}
				</CanvasHost>
			</div>
			<figcaption>Stage reference</figcaption>
		</figure>
		<div class="readings">
			{#if inspection.status === 'partial' || inspection.status === 'refused'}
				<ul data-e7-issues>
					{#each inspection.issues as issue, index (index)}
						<li>{issue.code} {issue.role ?? ''} {issue.action ?? ''}</li>
					{/each}
				</ul>
			{/if}
			{#if inspection.status === 'ready' || inspection.status === 'partial'}
				<table>
					<tbody>
						{#each inspection.channels as channel (channel.role)}
							<tr>
								<th>{channel.role}</th>
								<td>{channel.state}</td>
								<td>{channel.component ?? channel.convention ?? ''}{channel.invert ? ' inverted' : ''}</td>
								<td>{JSON.stringify(channel.provenance)}</td>
								<td>{channel.constant}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
			<label>U <input type="number" min="0" max="1" step="0.05" bind:value={uv.u} /></label>
			<label>V <input type="number" min="0" max="1" step="0.05" bind:value={uv.v} /></label>
			<button type="button" onclick={inspectTexel} disabled={subject === null}>Read texel</button>
			{#if texel !== null}
				{#if texel.status === 'refused'}
					<p>{texel.issues[0]?.code}</p>
				{:else}
					<table data-e7-texel>
						<thead><tr><th>role</th><th>source</th><th>converted</th><th>effective</th></tr></thead>
						<tbody>
							{#each texel.channels as channel (channel.role)}
								<tr>
									<th>{channel.role}</th>
									{#each [channel.source, channel.converted, channel.effective] as values, index (index)}
										<td>{values?.map((value) => value.toFixed(3)).join(' ') ?? '—'}</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			{/if}
		</div>
	</section>

	{#if referencesOpen}
		<h2>Engineering reference derivatives (not product thumbnails)</h2>
		<ul class="references">
			{#each references as item (item.id)}
				<li>
					{#if item.thumbnail}
						<img data-reference-thumbnail src={item.thumbnail} alt="" width="96" height="96" />
					{:else}
						<i style:background={item.color}></i>
					{/if}
					{item.label}
				</li>
			{/each}
		</ul>
	{/if}

	{#if report !== null}
		<p>{report.pass ? 'Technical checks passed' : `Technical checks failed: ${report.failed.join('; ')}`}</p>
	{/if}
</main>

<style>
	main {
		min-height: 100vh;
		padding: 16px;
		background: #333;
		color: #f4f4f4;
		font: 12px/1.4 ui-sans-serif, system-ui, sans-serif;
	}

	header,
	.views {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: start;
		margin-bottom: 16px;
	}

	h1 {
		margin: 0;
		font-size: 15px;
	}

	figure {
		margin: 0;
	}

	canvas[data-e7-output],
	.stage {
		width: 384px;
		height: 384px;
		max-width: 100%;
		background: #555;
		object-fit: contain;
	}

	.stage {
		position: relative;
	}

	.readings {
		max-width: 100%;
		overflow-x: auto;
	}

	th,
	td {
		padding: 2px 8px;
		text-align: left;
	}

	.references {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 8px;
		padding: 0;
		list-style: none;
	}

	.references img,
	.references i {
		display: block;
		width: 96px;
		height: 96px;
	}
</style>

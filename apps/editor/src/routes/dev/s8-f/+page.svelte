<script lang="ts">
	/**
	 * T2.S8 F — rendered qualification of the curated catalogue.
	 *
	 * `?view=board` lays every creator-facing entry out as a 1 m panel and a
	 * sphere; `?view=living-room|kitchen|gallery-office` draws the acquisition
	 * manifest's representative scenes as compact vignettes at their design
	 * scales. Lighting is B's versioned inspection recipe: `?light=neutral` is
	 * the studio environment, `?light=grazing` the single low key that rakes
	 * across the panels and walls so relief, seams and flattened detail show. `?backend=webgl2` hides WebGPU before the canvas mounts, as the D
	 * and E gates do, so one browser observes both product backends. Every
	 * surface is drawn by the product `CatalogueMaterial` through the Canvas
	 * material and texture stores.
	 */
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { T } from '@threlte/core';
	import CanvasHost from '$lib/render/CanvasHost.svelte';
	import CatalogueMaterial from '$lib/render/materials/CatalogueMaterial.svelte';
	import { INSPECTION_THUMBNAIL_BACKGROUND } from '$lib/render/materials/inspection';
	import type { WebGPURenderer } from 'three/webgpu';
	import InspectionRig from './InspectionRig.svelte';
	import { provideRenderResources } from '$lib/render/resources/render-resources';
	import type { CanvasRendererState } from '$lib/render/renderer-context';
	import { getMaterial, materials } from '$lib/content/materials';
	import type { MaterialId, MaterialLoadStatus, Vec2 } from '$lib/types/materials';

	if (page.url.searchParams.get('backend') === 'webgl2') {
		Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true });
	}

	const resources = provideRenderResources();
	onDestroy(() => resources.dispose());

	type View = 'board' | 'living-room' | 'kitchen' | 'gallery-office';
	const VIEWS: readonly View[] = ['board', 'living-room', 'kitchen', 'gallery-office'];
	const requestedView = page.url.searchParams.get('view') as View | null;
	const view: View = requestedView !== null && VIEWS.includes(requestedView) ? requestedView : 'board';
	const light = page.url.searchParams.get('light') === 'grazing' ? 'grazing' : 'neutral';

	type Shape = 'plane' | 'box' | 'sphere' | 'cylinder';
	type Item = {
		readonly key: string;
		readonly materialId: MaterialId;
		readonly shape: Shape;
		/** Plane: [w, h]; box: [w, h, d]; sphere: [r]; cylinder: [r, h]. */
		readonly size: readonly number[];
		readonly position: [number, number, number];
		readonly rotation?: [number, number, number];
		/** The metric surface the texture repeat is computed for. */
		readonly surface: Vec2;
	};

	const FLOOR: [number, number, number] = [-Math.PI / 2, 0, 0];

	// `?only=a,b,c` narrows the board to a few entries for close inspection.
	const only = page.url.searchParams.get('only')?.split(',').filter((id) => id.length > 0) ?? [];
	const shelf = only.length === 0 ? materials : materials.filter((material) => only.includes(material.id));
	const columns = Math.min(7, shelf.length);

	function board(): Item[] {
		return shelf.flatMap((material, index) => {
			const x = (index % columns) * 1.35 - ((columns - 1) * 1.35) / 2;
			const y = 3.6 - Math.floor(index / columns) * 1.75;
			return [
				{
					key: `${material.id}-panel`,
					materialId: material.id,
					shape: 'plane' as const,
					size: [1, 1],
					position: [x, y, 0] as [number, number, number],
					surface: [1, 1] as Vec2
				},
				{
					key: `${material.id}-sphere`,
					materialId: material.id,
					shape: 'sphere' as const,
					size: [0.24],
					position: [x, y - 0.78, 0.3] as [number, number, number],
					surface: [1.5, 0.75] as Vec2
				}
			];
		});
	}

	/** A room corner: floor, back wall, side wall and a few furnishings. */
	function vignette(spec: {
		floor: MaterialId;
		back: MaterialId;
		side: MaterialId;
		feature?: MaterialId;
		furniture: readonly Item[];
	}): Item[] {
		const items: Item[] = [
			{ key: 'floor', materialId: spec.floor, shape: 'plane', size: [5, 5], position: [0, 0, 0], rotation: FLOOR, surface: [5, 5] },
			{ key: 'back', materialId: spec.back, shape: 'plane', size: [5, 2.8], position: [0, 1.4, -2.5], surface: [5, 2.8] },
			{ key: 'side', materialId: spec.side, shape: 'plane', size: [5, 2.8], position: [-2.5, 1.4, 0], rotation: [0, Math.PI / 2, 0], surface: [5, 2.8] }
		];
		if (spec.feature !== undefined) {
			items.push({ key: 'feature', materialId: spec.feature, shape: 'plane', size: [1.8, 2.8], position: [1.2, 1.4, -2.49], surface: [1.8, 2.8] });
		}
		return [...items, ...spec.furniture];
	}

	function box(key: string, materialId: MaterialId, size: [number, number, number], position: [number, number, number]): Item {
		return { key, materialId, shape: 'box', size, position: [position[0], position[1] + size[1] / 2, position[2]], surface: [size[0], size[1]] };
	}

	function scene(id: View): Item[] {
		if (id === 'board') return board();
		if (id === 'living-room') {
			// The manifest's painted brick and white marble are excluded (F evidence):
			// plaster and travertine take their places under their own identities.
			return vignette({
				floor: 'wood-herringbone-parquet',
				back: 'plaster-painted',
				side: 'plaster-painted',
				feature: 'stone-travertine',
				furniture: [
					box('cabinet', 'wood-walnut-veneer', [1.4, 0.75, 0.45], [-1.2, 0, -2.2]),
					box('sofa-seat', 'textile-linen', [2, 0.42, 0.9], [0.6, 0, -0.6]),
					box('sofa-back', 'textile-linen', [2, 0.45, 0.22], [0.6, 0.42, -1]),
					box('chair', 'leather-cognac', [0.75, 0.45, 0.75], [-1.3, 0, 0.6]),
					box('table', 'stone-travertine', [1, 0.06, 0.6], [0.6, 0.42, 0.6]),
					{ key: 'fitting', materialId: 'metal-brass-satin', shape: 'cylinder', size: [0.05, 0.42], position: [0.6, 0.21, 0.6], surface: [0.3, 0.42] },
					{ key: 'lamp', materialId: 'metal-brass-satin', shape: 'sphere', size: [0.14], position: [-1.2, 0.9, -2.2], surface: [0.9, 0.45] }
				]
			});
		}
		if (id === 'kitchen') {
			return vignette({
				floor: 'stone-terrazzo',
				back: 'tile-ceramic-white',
				side: 'plaster-painted',
				furniture: [
					box('cabinets', 'wood-oak-veneer', [3, 0.86, 0.6], [0.2, 0, -2.2]),
					box('worktop', 'concrete-polished', [3.05, 0.04, 0.63], [0.2, 0.86, -2.2]),
					box('appliance', 'metal-stainless-brushed', [0.6, 0.86, 0.02], [1.4, 0, -1.89]),
					box('stool', 'synthetic-plastic-matte', [0.4, 0.65, 0.4], [-0.6, 0, -0.8]),
					{ key: 'rail', materialId: 'metal-stainless-brushed', shape: 'cylinder', size: [0.015, 3], position: [0.2, 1.2, -2.46], rotation: [0, 0, Math.PI / 2], surface: [0.1, 3] }
				]
			});
		}
		return vignette({
			floor: 'wood-oak-planks',
			back: 'concrete-smooth',
			side: 'plaster-painted',
			feature: 'masonry-brick-red',
			furniture: [
				{ key: 'rug', materialId: 'textile-carpet-loop', shape: 'plane', size: [2.4, 1.6], position: [0.3, 0.005, 0], rotation: FLOOR, surface: [2.4, 1.6] },
				box('desk', 'wood-oak-veneer', [1.6, 0.04, 0.8], [0.3, 0.72, -1.4]),
				box('pedestal', 'wood-oak-veneer', [0.45, 0.72, 0.75], [-0.3, 0, -1.4]),
				box('chair', 'leather-cognac', [0.6, 0.45, 0.6], [0.5, 0, -0.5]),
				{ key: 'leg', materialId: 'metal-aluminium-brushed', shape: 'cylinder', size: [0.025, 0.72], position: [0.95, 0.36, -1.1], surface: [0.2, 0.72] },
				{ key: 'globe', materialId: 'metal-copper-satin', shape: 'sphere', size: [0.12], position: [0.8, 0.86, -1.5], surface: [0.75, 0.38] },
				{ key: 'frame', materialId: 'metal-gold-satin', shape: 'box', size: [0.8, 1, 0.03], position: [-1, 1.6, -2.48], surface: [0.8, 1] },
				{ key: 'panel', materialId: 'metal-stainless-satin', shape: 'box', size: [0.03, 1.2, 0.8], position: [-2.48, 1.4, 0.8], surface: [0.8, 1.2] }
			]
		});
	}

	const items = scene(view);
	const statuses = $state<Record<string, MaterialLoadStatus>>(
		Object.fromEntries(items.map((item) => [item.key, 'idle' as MaterialLoadStatus]))
	);
	let backend = $state<string>('starting');
	let renderer = $state.raw<WebGPURenderer | null>(null);
	const settled = $derived(
		Object.values(statuses).every((status) => status === 'ready' || status === 'failed' || status === 'fallback')
	);
	const failures = $derived(
		Object.entries(statuses).filter(([, status]) => status === 'failed' || status === 'fallback').map(([key]) => key)
	);

	const camera =
		view === 'board'
			? only.length === 0
				? { position: [0, 2.05, 7.6] as [number, number, number], target: [0, 2.05, 0] as [number, number, number], fov: 50 }
				: { position: [0, 3.6, columns === 1 ? 0.9 : 1.35 + columns * 0.5] as [number, number, number], target: [0, 3.6, 0] as [number, number, number], fov: 50 }
			: { position: [2.3, 1.55, 2.6] as [number, number, number], target: [-0.6, 0.8, -1.6] as [number, number, number], fov: 55 };

	function onRendererState(state: CanvasRendererState | null): void {
		backend = state?.backend ?? 'starting';
		renderer = state?.renderer ?? null;
	}

	function shapeArgs(item: Item): number[] {
		if (item.shape === 'sphere') return [item.size[0]!, 48, 32];
		if (item.shape === 'cylinder') return [item.size[0]!, item.size[0]!, item.size[1]!, 32];
		return [...item.size];
	}
</script>

<svelte:head>
	<title>S8 F catalogue QA</title>
</svelte:head>

<main
	class="page"
	data-s8f-view={view}
	data-s8f-light={light}
	data-s8f-backend={backend}
	data-s8f-settled={settled}
	data-s8f-failures={failures.join(',')}
>
	<div class="label">
		{view} · {light} · {backend} · {settled ? (failures.length === 0 ? 'ready' : `failed: ${failures.join(', ')}`) : 'loading'}
	</div>
	{#if view === 'board'}
		<ol class="legend">
			{#each shelf as material (material.id)}
				<li>{material.label} <small>{getMaterial(material.id).defaultTileSizeMeters?.join('×')} m</small></li>
			{/each}
		</ol>
	{/if}
	<div class="canvas-shell">
		<CanvasHost surface="preview" renderMode="always" placeholder="#555555" {onRendererState}>
			{#snippet children()}
				<T.PerspectiveCamera
					makeDefault
					position={camera.position}
					fov={camera.fov}
					oncreate={(ref) => ref.lookAt(...camera.target)}
				/>
				<T.Color attach="background" args={[INSPECTION_THUMBNAIL_BACKGROUND]} />
				<InspectionRig rig={light === 'grazing' ? 'grazing' : 'studio'} {renderer} />
				{#each items as item (item.key)}
					<T.Mesh position={item.position} rotation={item.rotation ?? [0, 0, 0]}>
						{#if item.shape === 'plane'}
							<T.PlaneGeometry args={shapeArgs(item)} />
						{:else if item.shape === 'box'}
							<T.BoxGeometry args={shapeArgs(item)} />
						{:else if item.shape === 'sphere'}
							<T.SphereGeometry args={shapeArgs(item)} />
						{:else}
							<T.CylinderGeometry args={shapeArgs(item)} />
						{/if}
						<CatalogueMaterial materialId={item.materialId} surfaceSize={item.surface} bind:status={statuses[item.key]} />
					</T.Mesh>
				{/each}
			{/snippet}
		</CanvasHost>
	</div>
</main>

<style>
	.page {
		position: relative;
		min-height: 100vh;
		background: #555555;
		color: #f4f4f4;
		font: 12px/1.4 ui-sans-serif, system-ui, sans-serif;
	}

	.canvas-shell {
		position: absolute;
		inset: 0;
	}

	.label {
		position: absolute;
		z-index: 1;
		top: 8px;
		left: 8px;
		padding: 4px 8px;
		background: rgb(0 0 0 / 0.55);
		border-radius: 4px;
	}

	.legend {
		position: absolute;
		z-index: 1;
		bottom: 8px;
		left: 8px;
		right: 8px;
		margin: 0;
		padding: 4px 8px 4px 28px;
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 0 12px;
		background: rgb(0 0 0 / 0.55);
		border-radius: 4px;
	}

	small {
		opacity: 0.7;
	}
</style>

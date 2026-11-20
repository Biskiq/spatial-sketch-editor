<script lang="ts">
	import { T } from '@threlte/core';
	import { onDestroy, onMount } from 'svelte';
	import CanvasHost from '$lib/render/CanvasHost.svelte';
	import BenchReadback from './BenchReadback.svelte';
	import type { Material, Texture } from 'three';
	import { createInspectionGeometry, type InspectionGeometryKind } from '$lib/render/materials/inspection-geometry';
	import {
		createInspectionLighting,
		type InspectionRig
	} from '$lib/render/materials/inspection-lighting';
	import { inspectionPose } from '$lib/render/materials/inspection';
	import {
		createFinishChannelMaterial,
		createFinishMaterial,
		type FinishTextureViews
	} from '$lib/render/resources/finish-sampling';
	import { loadFinishTexture } from '$lib/render/resources/texture-store';
	import type { StandardMaterialDescriptor } from '$lib/render/resources/material-descriptor';

	type Channel = 'lit' | 'unlit-color' | 'color' | 'roughness' | 'occlusion';

	const geometryKinds: InspectionGeometryKind[] = ['sphere', 'plane', 'block'];
	const channels: Channel[] = ['lit', 'unlit-color', 'color', 'roughness', 'occlusion'];

	let kind = $state<InspectionGeometryKind>('sphere');
	let channel = $state<Channel>('lit');
	let status = $state('loading');
	let error = $state<string | null>(null);
	let views = $state<FinishTextureViews>({});
	let material = $state<Material | null>(null);
	let geometry = $state(createInspectionGeometry('sphere').geometry);
	let pose = $derived(inspectionPose(kind));

	const rig: InspectionRig = 'grazing';
	const lighting = createInspectionLighting(rig);
	const descriptor: StandardMaterialDescriptor = {
		kind: 'standard',
		color: '#c4b4a0',
		roughness: 0.62,
		metalness: 0.18,
		finish: {
			profile: 'pbr-metallic-roughness/v1',
			entries: [
				{
					role: 'color',
					view: 'colour',
					uvSet: 0,
					origin: 'legacy',
					repeat: [1, 1],
					rotation: 0,
					offset: [0, 0]
				},
				{
					role: 'roughness',
					view: 'orm',
					uvSet: 0,
					origin: 'legacy',
					repeat: [1, 1],
					rotation: 0,
					offset: [0, 0],
					component: 'g',
					invert: false
				},
				{
					role: 'occlusion',
					view: 'orm',
					uvSet: 0,
					origin: 'legacy',
					repeat: [1, 1],
					rotation: 0,
					offset: [0, 0],
					component: 'r',
					invert: false
				}
			],
			occlusionStrength: 1,
			normalScale: 1
		}
	};

	function rebuild(): void {
		if (Object.keys(views).length === 0) return;
		material?.dispose();
		material =
			channel === 'lit'
				? createFinishMaterial(descriptor, views)
				: channel === 'unlit-color'
					? createFinishChannelMaterial(descriptor, views, 'unlit-color')
					: createFinishChannelMaterial(descriptor, views, { solo: channel });
	}

	function choose(next: InspectionGeometryKind): void {
		if (next === kind) return;
		kind = next;
		geometry.dispose();
		geometry = createInspectionGeometry(next).geometry;
	}

	onMount(() => {
		Promise.all([
			loadFinishTexture('/s8-fixtures/swatch-rgba.png', 'color'),
			loadFinishTexture('/s8-fixtures/orm-distinct.png', 'roughness')
		])
			.then(([colour, orm]) => {
				views = { colour, orm } satisfies Record<string, Texture>;
				status = 'ready';
				rebuild();
			})
			.catch((cause: unknown) => {
				status = 'failed';
				error = cause instanceof Error ? cause.message : String(cause);
			});
	});

	$effect(() => {
		channel;
		rebuild();
	});

	onDestroy(() => {
		material?.dispose();
		geometry.dispose();
		lighting.dispose();
	});
</script>

<svelte:head>
	<title>S8 inspection bench</title>
</svelte:head>

<main class="bench">
	<header>
		<p class="eyebrow">/dev/s8-bench</p>
		<h1>Finish inspection</h1>
		<p>{status}{error === null ? '' : ` — ${error}`}</p>
	</header>

	<div class="controls">
		<div>
			<strong>Geometry</strong>
			{#each geometryKinds as candidate (candidate)}
				<button class:active={candidate === kind} onclick={() => choose(candidate)}>{candidate}</button>
			{/each}
		</div>
		<div>
			<strong>Channel</strong>
			{#each channels as candidate (candidate)}
				<button class:active={candidate === channel} onclick={() => (channel = candidate)}>{candidate}</button>
			{/each}
		</div>
		<p>Rig: grazing (reference studio runs in the headless chart test).</p>
	</div>

	<div class="viewport">
		<CanvasHost surface="preview" renderMode="always" placeholder="#555">
			<T.PerspectiveCamera
				makeDefault
				fov={pose.fovYDegrees}
				position={[...pose.eye]}
				onCreate={(camera: import('three').PerspectiveCamera) => camera.lookAt(0, 0, 0)}
			/>
			<T is={lighting.group} />
			{#if material !== null}
				<T.Mesh geometry={geometry} {material} />
			{/if}
			<BenchReadback {material} {kind} {rig} />
		</CanvasHost>
	</div>
</main>

<style>
	.bench {
		display: grid;
		grid-template-columns: 320px 1fr;
		min-height: 100vh;
		background: #121218;
		color: #e8e2d8;
		font-family: system-ui, sans-serif;
	}
	header,
	.controls {
		padding: 1rem;
	}
	h1 {
		font-size: 1.2rem;
		margin: 0 0 0.5rem;
	}
	.eyebrow {
		color: #a99f90;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		font-size: 0.7rem;
	}
	button {
		margin: 0.25rem 0.25rem 0 0;
		padding: 0.35rem 0.55rem;
		border: 1px solid #3a3a44;
		background: #1c1c24;
		color: inherit;
		border-radius: 4px;
		cursor: pointer;
	}
	button.active {
		border-color: #c4b4a0;
		background: #2c2a26;
	}
	.viewport {
		min-height: 70vh;
		background: #555;
	}
</style>

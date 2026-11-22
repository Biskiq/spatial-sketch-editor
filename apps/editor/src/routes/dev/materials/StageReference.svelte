<script lang="ts">
	/**
	 * The fixture World as the Stage draws it: the product entity and light
	 * representations under the product World environment, or under the Stage's
	 * neutral rig on Paper. The gate compares inspection's World sample with it.
	 */
	import { onDestroy } from 'svelte';
	import { T, useThrelte } from '@threlte/core';
	import type { Camera, Object3D, Scene } from 'three';
	import type { SceneSky } from '@portfolio/project-model/units';
	import WorldEnvironment from '$lib/render/WorldEnvironment.svelte';
	import type { WorldEnvironmentFrame } from '$lib/render/world-environment';
	import { createInspectionCamera } from '$lib/render/materials/inspection';
	import {
		STAGE_NEUTRAL_AMBIENT_INTENSITY,
		STAGE_NEUTRAL_DIRECTIONALS
	} from '$lib/render/stage-neutral-lighting';
	import DGateMount from '../s8-d/DGateMount.svelte';
	import { INSPECTION_ANCHOR } from './fixture';

	let {
		sky,
		frame,
		entities,
		lights,
		onScene
	}: {
		sky: SceneSky | null;
		frame: WorldEnvironmentFrame;
		entities: Object3D;
		lights: Object3D;
		onScene: (scene: Scene | null, camera: Camera | null) => void;
	} = $props();

	const { scene, camera } = useThrelte();
	const pose = createInspectionCamera('sphere');
	const [x, y, z] = INSPECTION_ANCHOR;
	const eye: [number, number, number] = [pose.position.x + x, pose.position.y + y, pose.position.z + z];

	$effect(() => onScene(scene, $camera));
	onDestroy(() => onScene(null, null));
</script>

<T.PerspectiveCamera makeDefault position={eye} fov={pose.fov} oncreate={(ref) => ref.lookAt(x, y, z)} />
<DGateMount object={entities} />
{#if sky !== null}
	<WorldEnvironment
		{sky}
		bounds={frame.bounds}
		shadowBounds={frame.shadowBounds}
		groundY={frame.groundY}
		flatGround={frame.flatGround}
	/>
	<DGateMount object={lights} />
{:else}
	<T.AmbientLight intensity={STAGE_NEUTRAL_AMBIENT_INTENSITY} />
	{#each STAGE_NEUTRAL_DIRECTIONALS as neutral (neutral.position.join(','))}
		<T.DirectionalLight position={[...neutral.position]} intensity={neutral.intensity} />
	{/each}
{/if}

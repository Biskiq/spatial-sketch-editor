<script lang="ts">
	import { onDestroy } from 'svelte';
	import { T, useThrelte } from '@threlte/core';
	import {
		BufferAttribute,
		CircleGeometry,
		Color,
		FogExp2,
		Group
	} from 'three';
	import type { SceneSky } from '@portfolio/project-model/units';
	import {
		WORLD_ENVIRONMENT_GROUND_RADIUS_METERS,
		colorHex,
		resolveSkySun,
		worldEnvironmentCenter,
		worldEnvironmentLook
	} from './world-environment';
	import { createSkyBackground } from './sky-background';
	import { useRenderResources } from './resources/render-resources';
	import type { LightLease } from './resources/light-store';
	import type { WorldEnvironmentBounds } from './world-environment';
	import StoreMaterial from './resources/StoreMaterial.svelte';
	import type { BasicMaterialDescriptor, LambertMaterialDescriptor } from './resources/material-descriptor';

	/**
	 * The ground's two looks, from the Canvas store. The colours are the
	 * disc's vertex colours, so one descriptor serves every preset.
	 */
	const FLAT_GROUND: BasicMaterialDescriptor = {
		kind: 'basic',
		color: 0xffffff,
		vertexColors: true,
		toneMapped: false,
		depthWrite: false
	};
	const LIT_GROUND: LambertMaterialDescriptor = { kind: 'lambert', vertexColors: true };

	type Bounds = WorldEnvironmentBounds;

	let {
		sky = null,
		bounds = null,
		shadowBounds = null,
		groundY = 0,
		flatGround = false
	}: {
		/** The World's stored Sky; `null` is Paper. */
		sky?: SceneSky | null;
		bounds?: Bounds | null;
		shadowBounds?: Bounds | null;
		/** The floor datum the ground disc sits just under. */
		groundY?: number;
		/**
		 * The editor Stage's ground: unlit, in the preset's own colours, around a
		 * workspace plate that catches the shadows. A visit keeps the lit ground.
		 */
		flatGround?: boolean;
	} = $props();

	const { scene, invalidate } = useThrelte();
	const look = $derived(worldEnvironmentLook(sky));

	const ground = new CircleGeometry(WORLD_ENVIRONMENT_GROUND_RADIUS_METERS, 64, 0, Math.PI * 2);
	ground.setAttribute('color', new BufferAttribute(new Float32Array(ground.getAttribute('position').count * 3), 3));

	const groundKey = $derived(look ? [...look.ground, ...look.groundFar].join('|') : null);
	$effect(() => {
		if (groundKey === null) return;
		const [r, g, b, farR, farG, farB] = groundKey.split('|').map(Number);
		const near = new Color(r!, g!, b!);
		const far = new Color(farR!, farG!, farB!);
		const positions = ground.getAttribute('position');
		const colors = ground.getAttribute('color') as BufferAttribute;
		const mixed = new Color();
		for (let index = 0; index < positions.count; index += 1) {
			const radius = Math.hypot(positions.getX(index), positions.getY(index)) / WORLD_ENVIRONMENT_GROUND_RADIUS_METERS;
			mixed.copy(near).lerp(far, Math.min(1, Math.max(0, (radius - 0.04) / 0.5)) ** 0.8);
			colors.setXYZ(index, mixed.r, mixed.g, mixed.b);
		}
		colors.needsUpdate = true;
		invalidate();
	});

	const previousBackground = scene.background;
	const previousFog = scene.fog;
	const fog = new FogExp2(0xffffff, 0);
	const background = typeof document === 'undefined' ? null : createSkyBackground();
	const backgroundKey = $derived(look ? JSON.stringify({
		zenith: look.zenith, horizon: look.horizon, glow: look.glow
	}) : null);

	$effect(() => {
		if (!background || backgroundKey === null) {
			if (scene.background === background?.texture) scene.background = previousBackground;
			return;
		}
		background.update(JSON.parse(backgroundKey));
		scene.background = background.texture;
		invalidate();
	});
	$effect(() => {
		if (look === null) {
			if (scene.fog === fog) scene.fog = previousFog;
			return;
		}
		fog.color.setRGB(...look.fog.color);
		fog.density = look.fog.density;
		scene.fog = fog;
		invalidate();
	});
	onDestroy(() => {
		if (scene.background === background?.texture) scene.background = previousBackground;
		if (scene.fog === fog) scene.fog = previousFog;
		background?.texture.dispose();
		ground.dispose();
	});

	const center = $derived(worldEnvironmentCenter({ bounds, groundY }));

	/**
	 * The Sky's one Sun: resolved here as a pure descriptor and realized
	 * by the Canvas light store, which owns its construction, shadow camera and
	 * disposal. The lease lives as long as the Sky has a Sun: a changed preset or
	 * frame updates the same light in place; `paper` releases it. The Sun sits in
	 * this component's holder and aims at a target that joins the scene with it.
	 */
	const resources = useRenderResources();
	const sunDescriptor = $derived(resolveSkySun(look, { bounds, shadowBounds, groundY, flatGround }));
	const sunHolder = new Group();
	let sun: LightLease<'sun'> | null = null;
	function releaseSun(): void {
		sun?.release();
		sun = null;
	}
	$effect(() => {
		const descriptor = sunDescriptor;
		if (descriptor === null) {
			if (sun !== null) {
				releaseSun();
				invalidate();
			}
			return;
		}
		if (sun === null) {
			sun = resources.lights.acquire(descriptor);
			sunHolder.add(sun.light);
			scene.add(sun.light.target);
		} else if (!sun.update(descriptor)) {
			return;
		}
		invalidate();
	});
	onDestroy(releaseSun);
</script>

{#if look !== null}
	<T.HemisphereLight color={colorHex(look.hemisphere.skyColor)} groundColor={colorHex(look.hemisphere.groundColor)} intensity={look.hemisphere.intensity} />
	<T.AmbientLight intensity={look.ambient} />
	<T is={sunHolder} />
	<T.Mesh geometry={ground} rotation.x={-Math.PI / 2} position={[center[0], groundY - (flatGround ? 0.05 : 0.02), center[2]]} renderOrder={flatGround ? -1 : 0} receiveShadow={!flatGround}>
		<StoreMaterial descriptor={flatGround ? FLAT_GROUND : LIT_GROUND} />
	</T.Mesh>
{/if}

<script lang="ts">
	/**
	 * Experience review 1 — renders one World environment preset.
	 *
	 * Runtime-safe and shared: the Stage, its snapshots (same scene, world layer)
	 * and the visitor surface mount this one component with the Scene's stored
	 * Sky. The sky is the scene background (a vertical gradient, so it never
	 * clips at the camera's far plane), the ground is one disc fading into the
	 * horizon haze, and the light is a hemisphere fill plus one sun whose shadow
	 * camera fits the World's bounds. The Sun is resolved by `resolveSkySun` and
	 * realized by the Canvas light store; this component constructs no light but
	 * the hemisphere fill. An absent Sky is Paper and renders nothing: the host
	 * keeps its own look.
	 */
	import { onDestroy } from 'svelte';
	import { T, useThrelte } from '@threlte/core';
	import {
		BufferAttribute,
		CanvasTexture,
		CircleGeometry,
		Color,
		Group,
		SRGBColorSpace,
		type Texture
	} from 'three';
	import type { SceneSky } from '@portfolio/project-model/units';
	import {
		WORLD_ENVIRONMENT_GROUND_RADIUS_METERS,
		resolveSkySun,
		worldEnvironmentCenter,
		worldEnvironmentLook
	} from './world-environment';
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

	function skyTexture(top: string, bottom: string): Texture | null {
		if (typeof document === 'undefined') return null;
		const canvas = document.createElement('canvas');
		canvas.width = 2;
		canvas.height = 256;
		const context = canvas.getContext('2d');
		if (context === null) return null;
		const gradient = context.createLinearGradient(0, 0, 0, 256);
		gradient.addColorStop(0, top);
		gradient.addColorStop(1, bottom);
		context.fillStyle = gradient;
		context.fillRect(0, 0, 2, 256);
		const texture = new CanvasTexture(canvas);
		texture.colorSpace = SRGBColorSpace;
		return texture;
	}

	// Ground colours: the preset's ground near the World, its haze at the rim.
	$effect(() => {
		const current = look;
		if (current === null) return;
		const near = new Color(current.ground);
		const far = new Color(current.haze);
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

	// The sky is the scene background; the previous background comes back on leave.
	let installed: Texture | null = null;
	const previousBackground = scene.background;
	$effect(() => {
		const current = look;
		installed?.dispose();
		installed = current === null ? null : skyTexture(current.sky[0], current.sky[1]);
		scene.background = installed ?? previousBackground;
		invalidate();
	});
	onDestroy(() => {
		if (scene.background === installed) scene.background = previousBackground;
		installed?.dispose();
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
	<T.HemisphereLight args={[look.hemisphere[0], look.hemisphere[1], look.hemisphere[2]]} />
	<T is={sunHolder} />
	<T.Mesh geometry={ground} rotation.x={-Math.PI / 2} position={[center[0], groundY - (flatGround ? 0.05 : 0.02), center[2]]} renderOrder={flatGround ? -1 : 0} receiveShadow={!flatGround}>
		<StoreMaterial descriptor={flatGround ? FLAT_GROUND : LIT_GROUND} />
	</T.Mesh>
{/if}

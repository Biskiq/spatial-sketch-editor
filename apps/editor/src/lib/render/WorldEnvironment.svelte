<script lang="ts">
	/**
	 * Experience review 1 (R5) — renders one World environment preset.
	 *
	 * Runtime-safe and shared: the Stage, its snapshots (same scene, world layer)
	 * and the visitor surface mount this one component with the Scene's preset.
	 * The sky is the scene background (a vertical gradient, so it never clips at
	 * the camera's far plane), the ground is one disc fading into the horizon
	 * haze, and the light is a hemisphere fill plus one sun whose shadow camera
	 * fits the World's bounds. `paper` renders nothing: the host keeps its own look.
	 */
	import { onDestroy } from 'svelte';
	import { T, useThrelte } from '@threlte/core';
	import {
		BufferAttribute,
		CanvasTexture,
		CircleGeometry,
		Color,
		type DirectionalLight,
		SRGBColorSpace,
		type Texture
	} from 'three';
	import type { SceneEnvironmentPreset } from '@portfolio/project-model/units';
	import { WORLD_ENVIRONMENT_GROUND_RADIUS_METERS, worldEnvironmentLook } from './world-environment';

	type Bounds = { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] };

	let {
		preset = 'paper',
		bounds = null,
		shadowBounds = null,
		groundY = 0,
		flatGround = false
	}: {
		preset?: SceneEnvironmentPreset | null;
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
	const look = $derived(worldEnvironmentLook(preset));

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

	const center = $derived.by((): [number, number, number] => {
		if (bounds === null) return [0, groundY, 0];
		return [(bounds.min[0] + bounds.max[0]) / 2, groundY, (bounds.min[2] + bounds.max[2]) / 2];
	});
	const sunCenter = $derived<[number, number, number]>(shadowBounds === null ? center : [
		(shadowBounds.min[0] + shadowBounds.max[0]) / 2,
		(shadowBounds.min[1] + shadowBounds.max[1]) / 2,
		(shadowBounds.min[2] + shadowBounds.max[2]) / 2
	]);
	const reach = $derived.by(() => {
		const frame = shadowBounds ?? bounds;
		if (frame === null) return 12;
		const height = shadowBounds === null ? 0 : frame.max[1] - frame.min[1];
		return Math.max(4, Math.hypot(frame.max[0] - frame.min[0], height, frame.max[2] - frame.min[2]) / 2 + 2);
	});
	let sun = $state<DirectionalLight | undefined>(undefined);
	// The sun aims at the World's centre; its target joins the scene with it.
	$effect(() => {
		const light = sun;
		void reach;
		const [x, y, z] = sunCenter;
		if (light === undefined) return;
		light.target.position.set(x, y, z);
		light.target.updateMatrixWorld();
		light.shadow.camera.updateProjectionMatrix();
		light.shadow.needsUpdate = true;
		scene.add(light.target);
		invalidate();
		return () => {
			scene.remove(light.target);
		};
	});
	const sunPosition = $derived.by((): [number, number, number] => {
		if (look === null) return [0, 10, 0];
		const [x, y, z] = look.sun.from;
		const length = Math.hypot(x, y, z) || 1;
		const distance = reach * 2.5;
		return [sunCenter[0] + (x / length) * distance, sunCenter[1] + (y / length) * distance, sunCenter[2] + (z / length) * distance];
	});
</script>

{#if look !== null}
	<T.HemisphereLight args={[look.hemisphere[0], look.hemisphere[1], look.hemisphere[2]]} />
	<T.DirectionalLight
		bind:ref={sun}
		position={sunPosition}
		color={look.sun.color}
		intensity={look.sun.intensity}
		castShadow
		shadow.mapSize.width={2048}
		shadow.mapSize.height={2048}
		shadow.bias={-0.0004}
		shadow.normalBias={flatGround ? 0.05 : 0.02}
		shadow.radius={3}
		shadow.camera.left={-reach}
		shadow.camera.right={reach}
		shadow.camera.top={reach}
		shadow.camera.bottom={-reach}
		shadow.camera.near={0.5}
		shadow.camera.far={reach * 6}
	>
	</T.DirectionalLight>
	<T.Mesh geometry={ground} rotation.x={-Math.PI / 2} position={[center[0], groundY - (flatGround ? 0.05 : 0.02), center[2]]} renderOrder={flatGround ? -1 : 0} receiveShadow={!flatGround}>
		{#if flatGround}
			<T.MeshBasicMaterial vertexColors toneMapped={false} depthWrite={false} />
		{:else}
			<T.MeshLambertMaterial vertexColors />
		{/if}
	</T.Mesh>
{/if}

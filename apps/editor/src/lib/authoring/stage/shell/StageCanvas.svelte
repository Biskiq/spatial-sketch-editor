<script lang="ts">
	/**
	 * The **one persistent Stage Canvas**.
	 *
	 * There is a single Threlte `<Canvas>` for every reading (Plan and 3D) and every
	 * lens: a reading flip or a lens change re-evaluates the camera, it never
	 * launches a second renderer or a second scene. Canonical Layout and the existing
	 * Scene render through the same runtime-safe adapters the visitor runtime uses
	 * (the Junction-aware wall mesh builders and the scene entity/material
	 * resolution), so editor and visitor geometry cannot drift.
	 *
	 * The shadow-map type is selected **explicitly** as the landed r186 upgrade does
	 * (`PCFShadowMap`); the removed PCFSoft filtering path is never reachable through
	 * a boolean `shadows`.
	 */
	import { Canvas, T } from '@threlte/core';
	import { PCFShadowMap } from 'three';
	import type { CompiledLayoutGeometry } from '@portfolio/layout-core';
	import type { LayoutRoomRegistry, RuntimeScene } from '@portfolio/project-model';
	import type { ViewportEvaluation } from '@portfolio/camera-core';
	import VisitorLayoutShell from '$lib/visitor/VisitorLayoutShell.svelte';
	import VisitorEntities from '$lib/visitor/VisitorEntities.svelte';
	import {
		neutralVisitorRoomPresentation,
		type VisitorRoomPresentation
	} from '$lib/visitor/room-presentation';
	import StageCamera from './StageCamera.svelte';

	let {
		geometry,
		scene,
		rooms,
		evaluation
	}: {
		geometry: CompiledLayoutGeometry;
		scene: RuntimeScene;
		rooms: LayoutRoomRegistry;
		evaluation: ViewportEvaluation | null;
	} = $props();

	const presentation = $derived.by(() => {
		const record: Record<string, VisitorRoomPresentation> = {};
		for (const room of geometry.rooms) record[room.roomId] = neutralVisitorRoomPresentation;
		return record;
	});
</script>

<Canvas dpr={[1, 1.5]} shadows={PCFShadowMap}>
	<T.Color attach="background" args={[0x111117]} />
	<T.Fog attach="fog" args={[0x111117, 40, 120]} />
	<T.AmbientLight intensity={0.35} />
	<T.DirectionalLight position={[6, 12, 8]} intensity={1.1} castShadow />
	<T.DirectionalLight position={[-8, 6, -6]} intensity={0.35} />
	<StageCamera {evaluation} />
	<VisitorLayoutShell {geometry} {presentation} />
	<VisitorEntities {scene} {rooms} />
</Canvas>

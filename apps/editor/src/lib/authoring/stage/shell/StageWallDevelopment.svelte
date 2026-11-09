<script lang="ts">
	/**
	 * C3 checkpoint 5 — the developed Wall sheet on the Stage.
	 *
	 * The sheet is the checkpoint-4 display strip: built once per Wall entry from
	 * the same development map and attributed to canonical stations, then
	 * re-evaluated per scrub frame into reused buffers. It is a Canvas child, not
	 * a second scene or a pick root. No camera or document state is written here.
	 */
	import { T, useThrelte } from '@threlte/core';
	import { BufferAttribute, BufferGeometry, Mesh, MeshStandardMaterial, DoubleSide } from 'three';
	import type { CompiledLayoutGeometry } from '@portfolio/layout-core';

	import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
	import {
		buildWallUnfoldDisplay,
		evaluateWallUnfoldDisplay,
		type WallUnfoldDisplay
	} from '$lib/layout/wall-unfold-pick';

	let {
		geometry,
		datumMeters
	}: { geometry: CompiledLayoutGeometry; datumMeters: number } = $props();

	const { invalidate } = useThrelte();
	const sheetGeometry = new BufferGeometry();
	const material = new MeshStandardMaterial({
		color: 0xd9cdb4,
		side: DoubleSide,
		roughness: 0.92,
		metalness: 0,
		// The accepted Wall body occupies the same space. The sheet draws over it
		// with a small depth bias rather than mutating the representation's
		// visibility, which stays owned by the retained Wall representation.
		polygonOffset: true,
		polygonOffsetFactor: -1,
		polygonOffsetUnits: -1
	});
	const root = new Mesh(sheetGeometry, material);
	root.name = 'StageWallDevelopment';
	root.renderOrder = 2;
	root.visible = false;

	let display: WallUnfoldDisplay | null = null;
	let displayWallId: string | null = null;

	$effect(() => {
		const state = wallUnfold.state;
		const wall = state === null ? undefined : geometry.walls.find((candidate) => candidate.wallId === state.wallId);
		if (state === null || wall === undefined) {
			root.visible = false;
			invalidate();
			return;
		}
		if (display === null || displayWallId !== wall.wallId || display.development.cutStation !== state.cutStation) {
			display = buildWallUnfoldDisplay(wall, state, { floorY: datumMeters });
			displayWallId = wall.wallId;
			if (display === null) {
				root.visible = false;
				invalidate();
				return;
			}
		}
		const mapped = evaluateWallUnfoldDisplay(display, state);
		const position = sheetGeometry.getAttribute('position');
		if (position === undefined || position.array.length !== mapped.positions.length) {
			sheetGeometry.setAttribute('position', new BufferAttribute(mapped.positions, 3));
			sheetGeometry.setAttribute('normal', new BufferAttribute(mapped.normals, 3));
		} else {
			(position.array as Float32Array).set(mapped.positions);
			position.needsUpdate = true;
			const normal = sheetGeometry.getAttribute('normal');
			if (normal !== undefined) {
				(normal.array as Float32Array).set(mapped.normals);
				normal.needsUpdate = true;
			}
		}
		const index: number[] = [];
		for (const triangle of display.mesh.triangles) index.push(...triangle.indices);
		const existing = sheetGeometry.getIndex();
		if (existing === null || existing.count !== index.length) {
			sheetGeometry.setIndex(index);
		} else {
			(existing.array as Uint16Array | Uint32Array).set(index);
			existing.needsUpdate = true;
		}
		sheetGeometry.computeBoundingSphere();
		root.visible = true;
		invalidate();
	});

	$effect(
		() => () => {
			sheetGeometry.dispose();
			material.dispose();
		}
	);
</script>

<T is={root} />

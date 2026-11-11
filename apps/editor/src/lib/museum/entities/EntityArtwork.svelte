<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { Path, RGBADepthPacking, Shape, type Texture } from 'three';
	import { artworkFrameLayout, artworkHeight, type SceneArtworkEntity } from '@portfolio/project-model';
	import type { ArtworkScope } from '$lib/render/artwork/artwork-scope';
	let { entity, scope, ghost = false, onError, onReady }: {
		entity: SceneArtworkEntity;
		scope: ArtworkScope | null;
		ghost?: boolean;
		onError?: (message: string) => void;
		onReady?: () => void;
	} = $props();
	const { invalidate } = useThrelte();
	let texture = $state.raw<Texture | null>(null);
	let transparent = $state(false);
	const assetId = $derived(entity.source.assetId);
	const pixelWidth = $derived(entity.source.pixelWidth);
	const pixelHeight = $derived(entity.source.pixelHeight);
	const height = $derived(artworkHeight(entity.widthMeters, entity.source));
	const layout = $derived(artworkFrameLayout(entity.widthMeters, height, entity.frame));
	const frameShape = $derived.by(() =>
		layout.faceMeters > 0
			? ringShape(layout.outerWidth, layout.outerHeight,
					layout.outerWidth - 2 * layout.faceMeters, layout.outerHeight - 2 * layout.faceMeters)
			: null);
	const matShape = $derived.by(() =>
		layout.mat === null
			? null
			: ringShape(layout.mat.width, layout.mat.height, layout.mat.innerWidth, layout.mat.innerHeight));
	const frameGeometryArgs = $derived.by((): [Shape, { depth: number; bevelEnabled: boolean; steps: number }] | null =>
		frameShape === null ? null : [frameShape, { depth: layout.depth, bevelEnabled: false, steps: 1 }]);
	const matGeometryArgs = $derived.by((): [Shape] | null => matShape === null ? null : [matShape]);

	/** One planar ring; the hole winds opposite the outline for ExtrudeGeometry. */
	function ringShape(outerWidth: number, outerHeight: number, innerWidth: number, innerHeight: number): Shape {
		const shape = new Shape();
		shape.moveTo(-outerWidth / 2, -outerHeight / 2);
		shape.lineTo(outerWidth / 2, -outerHeight / 2);
		shape.lineTo(outerWidth / 2, outerHeight / 2);
		shape.lineTo(-outerWidth / 2, outerHeight / 2);
		shape.closePath();
		const hole = new Path();
		hole.moveTo(-innerWidth / 2, -innerHeight / 2);
		hole.lineTo(-innerWidth / 2, innerHeight / 2);
		hole.lineTo(innerWidth / 2, innerHeight / 2);
		hole.lineTo(innerWidth / 2, -innerHeight / 2);
		hole.closePath();
		shape.holes.push(hole);
		return shape;
	}

	$effect(() => {
		texture = null;
		if (scope === null) return;
		const lease = scope.acquire({ assetId, pixelWidth, pixelHeight });
		let active = true;
		void lease.ready.then((loaded) => {
			if (!active) return;
			texture = loaded.texture;
			transparent = loaded.transparent;
			invalidate();
			onReady?.();
		}, (error: unknown) => {
			if (active) onError?.(error instanceof Error ? error.message : 'Artwork could not be displayed.');
		});
		return () => { active = false; lease.release(); };
	});
</script>

{#if texture !== null}
	<T.Group position={entity.position} rotation={entity.rotation}>
		<T.Mesh scale={[entity.widthMeters, height, 1]} castShadow={!ghost} receiveShadow={!ghost}>
			<T.PlaneGeometry args={[1, 1]} />
			<T.MeshLambertMaterial map={texture} transparent={transparent || ghost}
				depthWrite={!transparent && !ghost} opacity={ghost ? 0.65 : 1} />
			{#if transparent && !ghost}
				<T.MeshDepthMaterial attach="customDepthMaterial" map={texture} alphaTest={0.5}
					depthPacking={RGBADepthPacking} />
				<T.MeshDistanceMaterial attach="customDistanceMaterial" map={texture} alphaTest={0.5} />
			{/if}
		</T.Mesh>

		{#if frameGeometryArgs !== null && layout.frameColor !== null}
			<T.Mesh castShadow={!ghost} receiveShadow={!ghost}>
				<T.ExtrudeGeometry args={frameGeometryArgs} />
				<T.MeshLambertMaterial color={layout.frameColor} transparent={ghost}
					opacity={ghost ? 0.65 : 1} depthWrite={!ghost} />
			</T.Mesh>
		{/if}

		{#if matGeometryArgs !== null && layout.mat !== null}
			<T.Mesh position={[0, 0, layout.mat.z]} receiveShadow={!ghost}>
				<T.ShapeGeometry args={matGeometryArgs} />
				<T.MeshLambertMaterial color={layout.matColor} transparent={ghost}
					opacity={ghost ? 0.65 : 1} depthWrite={!ghost} />
			</T.Mesh>
		{/if}

		{#if layout.backing !== null && layout.backingColor !== null}
			<T.Mesh position={[0, 0, layout.backing.z]} receiveShadow={!ghost}>
				<T.PlaneGeometry args={[layout.backing.width, layout.backing.height]} />
				<T.MeshLambertMaterial color={layout.backingColor} transparent={ghost}
					opacity={ghost ? 0.65 : 1} depthWrite={!ghost} />
			</T.Mesh>
		{/if}
	</T.Group>
{/if}

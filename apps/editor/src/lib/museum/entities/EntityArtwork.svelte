<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { RGBADepthPacking, type Texture } from 'three';
	import { artworkHeight, type SceneArtworkEntity } from '@portfolio/project-model';
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
	<T.Mesh position={entity.position} rotation={entity.rotation} scale={[entity.widthMeters, height, 1]}
		castShadow={!ghost} receiveShadow={!ghost}>
		<T.PlaneGeometry args={[1, 1]} />
		<T.MeshLambertMaterial map={texture} transparent={transparent || ghost}
			depthWrite={!transparent && !ghost} opacity={ghost ? 0.65 : 1} />
		{#if transparent && !ghost}
			<T.MeshDepthMaterial attach="customDepthMaterial" map={texture} alphaTest={0.5}
				depthPacking={RGBADepthPacking} />
			<T.MeshDistanceMaterial attach="customDistanceMaterial" map={texture} alphaTest={0.5} />
		{/if}
	</T.Mesh>
{/if}

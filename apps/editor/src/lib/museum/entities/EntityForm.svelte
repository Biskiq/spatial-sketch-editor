<script lang="ts">
	/**
	 * One native form, drawn from its cached canonical evaluation.
	 *
	 * The mesh comes from the shared cache and the geometry adapter turns it into
	 * buffers with metre UVs and computed normals; this component owns the
	 * geometry lease and disposes it whenever the source changes or the entity
	 * unmounts. Editor Stage and Preview both reach this file through
	 * `VisitorEntityGroups`, so they cannot draw different shapes.
	 */
	import { T } from '@threlte/core';
	import type { SceneFormEntity } from '$lib/content/scene';
	import { evaluateFormMesh } from '$lib/content/form-evaluation';
	import type { EffectiveSceneMaterial } from '$lib/museum/materials/scene-instance-material';
	import type { TextureLoadScope } from '$lib/museum/materials/texture-cache';
	import type { Vec2 } from '$lib/types/materials';
	import SceneInstanceMaterial from '$lib/museum/materials/SceneInstanceMaterial.svelte';
	import { buildFormGeometry } from './form-geometry';

	let {
		entity,
		effective,
		scope = null
	}: {
		entity: SceneFormEntity;
		effective: EffectiveSceneMaterial;
		scope?: TextureLoadScope | null;
	} = $props();

	// UVs are metres, so one surface unit is one metre and the material's own
	// `defaultTileSizeMeters` becomes the only tiling scale.
	const metreSurface: Vec2 = [1, 1];

	// `null` only for corrupt in-memory source; an admitted form always evaluates.
	const geometry = $derived.by(() => {
		const mesh = evaluateFormMesh(entity.form);
		return mesh === null ? null : buildFormGeometry(mesh, entity.form.generator.plane);
	});

	$effect(() => {
		const leased = geometry;
		return () => leased?.dispose();
	});
</script>

{#if geometry}
	<T.Mesh
		{geometry}
		castShadow={entity.castShadow}
		receiveShadow={entity.receiveShadow}
	>
		<SceneInstanceMaterial material={effective} surfaceSize={metreSurface} {scope} />
	</T.Mesh>
{/if}

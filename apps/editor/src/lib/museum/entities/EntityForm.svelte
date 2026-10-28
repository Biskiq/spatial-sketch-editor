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
	import { onMount } from 'svelte';
	import { T } from '@threlte/core';
	import type { BufferGeometry } from 'three';
	import type { SceneFormEntity } from '$lib/content/scene';
	import { evaluateFormMesh, formEvaluationKey } from '$lib/content/form-evaluation';
	import type { EffectiveSceneMaterial } from '$lib/museum/materials/scene-instance-material';
	import type { TextureLoadScope } from '$lib/museum/materials/texture-cache';
	import type { Vec2 } from '$lib/types/materials';
	import SceneInstanceMaterial from '$lib/museum/materials/SceneInstanceMaterial.svelte';
	import { buildFormGeometry } from './form-geometry';

	let {
		entity,
		effective,
		scope = null,
		onMounted
	}: {
		entity: SceneFormEntity;
		effective: EffectiveSceneMaterial;
		scope?: TextureLoadScope | null;
		onMounted?: () => void;
	} = $props();

	onMount(() => onMounted?.());

	// UVs are metres, so one surface unit is one metre and the material's own
	// `defaultTileSizeMeters` becomes the only tiling scale.
	const metreSurface: Vec2 = [1, 1];

	/**
	 * Geometry is leased by source identity, not by entity object identity.
	 *
	 * Every accepted edit resolves a new `RuntimeScene` and clones its entities,
	 * so `entity.form` is a new object even when the form did not change. Keying
	 * on `formEvaluationKey` keeps the existing buffers (and the cached mesh) for
	 * an unchanged source; only a real source change builds new geometry and
	 * disposes the old one.
	 */
	let leased: { readonly key: string; readonly geometry: BufferGeometry } | null = null;
	const geometry = $derived.by(() => {
		const key = formEvaluationKey(entity.form);
		if (leased !== null && leased.key === key) return leased.geometry;
		const mesh = evaluateFormMesh(entity.form);
		leased = mesh === null
			? null
			: { key, geometry: buildFormGeometry(mesh, entity.form.generator.plane) };
		return leased?.geometry ?? null;
	});

	$effect(() => {
		const current = geometry;
		return () => {
			if (leased !== null && leased.geometry === current) leased = null;
			current?.dispose();
		};
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

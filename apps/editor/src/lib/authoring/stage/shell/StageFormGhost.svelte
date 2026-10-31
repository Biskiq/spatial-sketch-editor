<script lang="ts">
	/**
	 * One proposed native-form body, drawn by the one Stage Canvas.
	 *
	 * The ghost carries the same authored source the planner would install, so it
	 * is built by the same kernel and geometry adapter the accepted entity uses.
	 * A preview can therefore never be a different shape from its commit.
	 */
	import { T } from '@threlte/core';
	import type { SceneFormSource } from '@portfolio/project-model';
	import { evaluateFormMesh, formEvaluationKey } from '$lib/content/form-evaluation';
	import { buildFormGeometry } from '$lib/museum/entities/form-geometry';

	let {
		form,
		position,
		yaw,
		treatment = 'subject'
	}: {
		form: SceneFormSource;
		position: readonly [number, number, number];
		yaw: number;
		treatment?: 'subject' | 'proxy' | 'refused';
	} = $props();

	function ignoreRaycast(): void {}

	let leased: { readonly key: string; readonly geometry: ReturnType<typeof buildFormGeometry> } | null = null;
	/** Threlte takes a mutable tuple; the ghost contract stays readonly. */
	const at = $derived([position[0], position[1], position[2]] as [number, number, number]);
	const geometry = $derived.by(() => {
		const key = formEvaluationKey(form);
		if (leased !== null && leased.key === key) return leased.geometry;
		const mesh = evaluateFormMesh(form);
		leased = mesh === null
			? null
			: { key, geometry: buildFormGeometry(mesh, form.generator.plane) };
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
	<T.Mesh {geometry} position={at} rotation={[0, yaw, 0]} renderOrder={2} raycast={ignoreRaycast}>
		<T.MeshStandardMaterial
			color={treatment === 'refused' ? 0xe27666 : 0xc9a9ff}
			transparent
			opacity={treatment === 'proxy' ? 0.17 : treatment === 'refused' ? 0.23 : 0.38}
			depthWrite={false}
		/>
	</T.Mesh>
{/if}

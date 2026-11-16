<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { onDestroy } from 'svelte';
	import { BufferAttribute, BufferGeometry, DynamicDrawUsage, GreaterDepth, LessEqualDepth } from 'three';
	import type { CelestialDialModel } from '../../look/celestial-dial';

	let { dial }: { dial: CelestialDialModel } = $props();
	const { invalidate } = useThrelte();
	const noRaycast = () => {};
	const meshes = Array.from({ length: 5 }, () => {
		const geometry = new BufferGeometry();
		const positions = new BufferAttribute(new Float32Array(2 * 3 * 128), 3).setUsage(DynamicDrawUsage);
		geometry.setAttribute('position', positions);
		return { geometry, positions };
	});

	$effect(() => {
		for (const [index, { segments }] of dial.lines.entries()) {
			const { geometry, positions } = meshes[index]!;
			let vertex = 0;
			for (const [from, to] of segments) {
				positions.setXYZ(vertex++, ...from);
				positions.setXYZ(vertex++, ...to);
			}
			geometry.setDrawRange(0, vertex);
			positions.needsUpdate = true;
		}
		invalidate();
	});
	onDestroy(() => { for (const { geometry } of meshes) geometry.dispose(); });
</script>

{#each [false, true] as occluded}
	<T.Mesh position={dial.placement.anchor} scale={44 * dial.placement.scale} rotation.x={-Math.PI / 2} raycast={noRaycast} renderOrder={9}>
		<T.CircleGeometry args={[1, 64]} />
		<T.MeshBasicMaterial color={dial.ink} transparent opacity={occluded ? 0.075 : 0.2}
			depthFunc={occluded ? GreaterDepth : LessEqualDepth} depthWrite={false} fog={false} toneMapped={false} />
	</T.Mesh>
	{#each dial.lines as batch, index (index)}
		<T.LineSegments geometry={meshes[index]!.geometry} raycast={noRaycast} frustumCulled={false} renderOrder={10}>
			<T.LineBasicMaterial color={batch.color} transparent opacity={batch.opacity * (occluded ? 0.38 : 1)}
				depthFunc={occluded ? GreaterDepth : LessEqualDepth} depthWrite={false} fog={false} toneMapped={false} />
		</T.LineSegments>
	{/each}
{/each}

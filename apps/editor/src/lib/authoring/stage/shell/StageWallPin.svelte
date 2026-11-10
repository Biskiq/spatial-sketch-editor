<script lang="ts">
	/**
	 * The one Wall-unroll pin marker.
	 *
	 * The pin is a reading handle, not a second anchor authority. Both the idle
	 * Wall (before Unroll) and the developed sheet draw it at the same canonical
	 * station, so entry and Put back cannot make it jump.
	 */
	import { T, useThrelte } from '@threlte/core';
	import { MeshBasicMaterial, SphereGeometry } from 'three';

	let {
		position,
		hovered = false,
		active = false
	}: {
		position: readonly [number, number, number];
		hovered?: boolean;
		active?: boolean;
	} = $props();

	const { invalidate } = useThrelte();
	const pinGeometry = new SphereGeometry(0.075, 14, 10);
	const pinMaterial = new MeshBasicMaterial({
		color: 0xb9932f,
		toneMapped: false,
		depthTest: false
	});

	$effect(() => {
		pinMaterial.color.set(hovered || active ? 0x4f8f6c : 0xb9932f);
		invalidate();
	});

	$effect(() => () => {
		pinGeometry.dispose();
		pinMaterial.dispose();
	});
</script>

<T.Mesh
	position={[position[0], position[1], position[2]]}
	scale={hovered ? 1.55 : active ? 1.3 : 1}
	geometry={pinGeometry}
	material={pinMaterial}
	renderOrder={4}
	frustumCulled={false}
/>

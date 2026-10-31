<script lang="ts">
	import { T } from '@threlte/core';
	import { BoxGeometry, CylinderGeometry, EdgesGeometry, SphereGeometry } from 'three';
	import type { StageGhostMesh } from '../stage-facade';

	let { ghost }: { ghost: StageGhostMesh & { shape: Exclude<StageGhostMesh['shape'], { kind: 'form' }> } } = $props();
	let cached: { key: string; body: BoxGeometry | CylinderGeometry | SphereGeometry; edges: EdgesGeometry } | null = null;
	const geometry = $derived.by(() => {
		const shape = ghost.shape;
		const key = JSON.stringify(shape);
		if (cached?.key === key) return cached;
		const body = shape.kind === 'box'
			? new BoxGeometry(...shape.size)
			: shape.kind === 'cylinder'
				? new CylinderGeometry(shape.radius, shape.radius, shape.height, 24)
				: new SphereGeometry(shape.radius, 24, 16);
		cached = { key, body, edges: new EdgesGeometry(body, 30) };
		return cached;
	});
	$effect(() => {
		const current = geometry;
		return () => {
			if (cached === current) cached = null;
			current.edges.dispose();
			current.body.dispose();
		};
	});
	const color = $derived(ghost.treatment === 'refused' ? 0xe27666 : 0xc9a9ff);
	const opacity = $derived(ghost.treatment === 'proxy' ? 0.17 : ghost.treatment === 'refused' ? 0.23 : 0.38);
	const edgeOpacity = $derived(ghost.treatment === 'proxy' ? 0.45 : 0.75);
	const position = $derived([...ghost.center] as [number, number, number]);
	function ignoreRaycast(): void {}
</script>

<T.Group {position} rotation={[0, ghost.yaw, 0]}>
	<T.Mesh geometry={geometry.body} renderOrder={2} raycast={ignoreRaycast}>
		<T.MeshBasicMaterial {color} transparent {opacity} depthWrite={false} toneMapped={false} />
	</T.Mesh>
	<!-- A proposed pose must remain legible where it overlaps the accepted body. -->
	<T.LineSegments geometry={geometry.edges} renderOrder={3} raycast={ignoreRaycast}>
		<T.LineBasicMaterial {color} transparent opacity={edgeOpacity} depthTest={false} depthWrite={false} toneMapped={false} />
	</T.LineSegments>
</T.Group>

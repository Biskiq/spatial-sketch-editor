<script lang="ts">
	/**
	 * Observation only: reads the real Threlte scene, the real Canvas renderer
	 * record and the realized model materials. It constructs nothing and changes
	 * nothing; the numbers and material facts are evidence.
	 */
	import { onMount } from 'svelte';
	import { Mesh, type Material } from 'three';
	import { useThrelte } from '@threlte/core';
	import { tryUseCanvasRendererState } from '$lib/render/renderer-context';
	import { markFrame, probe } from './probe-state';

	const { scene } = useThrelte();
	const state = tryUseCanvasRendererState();

	function materialFacts(material: Material): Record<string, unknown> {
		const value = material as Material & {
			transmission?: number;
			thickness?: number;
			ior?: number;
			transparent?: boolean;
			opacity?: number;
			emissive?: { getHexString(): string };
			emissiveIntensity?: number;
			emissiveMap?: unknown;
			map?: unknown;
			alphaMap?: unknown;
			roughness?: number;
			metalness?: number;
			color?: { getHexString(): string };
			side?: number;
		};
		return {
			type: material.type,
			name: material.name,
			color: value.color?.getHexString() ?? null,
			roughness: value.roughness ?? null,
			metalness: value.metalness ?? null,
			transmission: value.transmission ?? 0,
			thickness: value.thickness ?? null,
			ior: value.ior ?? null,
			transparent: value.transparent ?? false,
			opacity: value.opacity ?? 1,
			emissive: value.emissive?.getHexString() ?? null,
			emissiveIntensity: value.emissiveIntensity ?? null,
			emissiveMap: value.emissiveMap !== undefined && value.emissiveMap !== null,
			colourMap: value.map !== undefined && value.map !== null,
			alphaMap: value.alphaMap !== undefined && value.alphaMap !== null,
			side: value.side ?? null
		};
	}

	onMount(() => {
		const timer = setInterval(() => {
			const seen = new Map<string, Record<string, unknown>>();
			let meshes = 0;
			scene.traverse((object) => {
				if (!(object instanceof Mesh)) return;
				meshes += 1;
				const materials = Array.isArray(object.material) ? object.material : [object.material];
				for (const material of materials) {
					if (material === undefined) continue;
					if (!seen.has(material.uuid)) seen.set(material.uuid, materialFacts(material));
				}
			});
			const renderer = state?.renderer ?? null;
			const info = renderer?.info;
			probe.materials = [...seen.values()];
			probe.textures = info?.memory?.textures ?? null;
			probe.drawCalls = info?.render?.calls ?? null;
			probe.triangles = info?.render?.triangles ?? null;
			probe.generation = state?.generation ?? null;
			probe.meshes = meshes;
			// An initialized renderer with a continuous render mode is the readiness
			// proof; the screenshot is the visual one.
			if (state?.renderer != null) markFrame();
		}, 200);
		return () => clearInterval(timer);
	});
</script>

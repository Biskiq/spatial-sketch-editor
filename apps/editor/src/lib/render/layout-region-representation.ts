import type { CompiledLayoutGeometry } from '@portfolio/layout-core';
import { Group, Mesh, type Material } from 'three';
import { buildRegionMeshGeometry } from '$lib/render/layout/region-mesh-builder';
import { DEFAULT_FLOOR_COLOR } from '$lib/visitor/room-presentation';
import { tagRenderIdentity } from './render-identity';
import type { MaterialStore } from './resources/material-store';

/** One retained mesh per slab, mounted by both Stage and Preview. */
export function createRegionRepresentation(store: MaterialStore) {
	const object3d = new Group();
	object3d.name = 'LayoutRegions';
	const floor = { kind: 'standard', color: DEFAULT_FLOOR_COLOR, roughness: 1, metalness: 0 } as const;
	const entries = new Map<string, { cacheKey: string; mesh: Mesh }>();
	let leases: ReturnType<MaterialStore['acquire']>[] = [];
	function materials() {
		if (leases.length === 0) leases = [
			store.acquire(floor),
			store.acquire({ kind: 'standard', color: '#111018', roughness: 0.9, metalness: 0 }),
			store.acquire({ ...floor, polygonOffset: [-2, -2] })
		];
		return leases;
	}
	function remove(id: string): void {
		const entry = entries.get(id);
		if (!entry) return;
		entry.mesh.removeFromParent();
		entry.mesh.geometry.dispose();
		entries.delete(id);
	}
	function releaseUnused(): void {
		if (entries.size !== 0) return;
		for (const lease of leases) lease.release();
		leases = [];
	}
	let compiled: CompiledLayoutGeometry['regions'] | undefined;
	return {
		object3d,
		update(geometry: CompiledLayoutGeometry): boolean {
			if (geometry.regions === compiled) return false;
			compiled = geometry.regions;
			const datum = geometry.floors[0]?.elevation;
			let changed = false;
			const live = new Set<string>();
			for (const region of compiled) {
				const id = region.regionId;
				live.add(id);
				if (entries.get(id)?.cacheKey === region.cacheKey) continue;
				remove(id);
				const [floorTop, edge, datumTop] = materials();
				const biased = region.role === 'floor' && region.topY === datum;
				const top = region.role === 'floor' ? (biased ? datumTop : floorTop) : edge;
				const [x, z] = region.footprint[0]!;
				const origin: [number, number, number] = [x, region.bottomY, z];
				const mesh = new Mesh(buildRegionMeshGeometry(region, origin), [top!.material, edge!.material] as Material[]);
				mesh.position.set(...origin);
				mesh.name = `LayoutRegion:${id}`;
				mesh.renderOrder = biased ? 1 : 0;
				mesh.castShadow = mesh.receiveShadow = true;
				tagRenderIdentity(mesh, 'region', id);
				object3d.add(mesh);
				entries.set(id, { cacheKey: region.cacheKey, mesh });
				changed = true;
			}
			for (const id of entries.keys()) {
				if (live.has(id)) continue;
				remove(id);
				changed = true;
			}
			releaseUnused();
			return changed;
		},
		objectOf(id: string) { return entries.get(id)?.mesh ?? null; },
		*meshes() { for (const { mesh } of entries.values()) yield mesh; },
		dispose() {
			for (const id of entries.keys()) remove(id);
			releaseUnused();
			compiled = undefined;
		}
	};
}

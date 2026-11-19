import type { CompiledLayoutGeometry } from '@portfolio/layout-core';
import { Group, Mesh, type Material } from 'three';
import { buildRegionMeshGeometry } from '$lib/render/layout/region-mesh-builder';
import { createSceneSurfaceMaterials } from '$lib/render/layout/scene-surface-materials';
import type { SceneSurfaceLookResolver } from '$lib/render/layout/surface-look';
import type { TextureLoadScope } from '$lib/render/resources/texture-store';
import { DEFAULT_FLOOR_COLOR } from '$lib/visitor/room-presentation';
import { tagRenderIdentity } from './render-identity';
import { LIFTED_RENDER_LAYER } from './render-layers';
import type { MaterialStore } from './resources/material-store';
import type { MaterialTreatment } from './resources/material-descriptor';

/** One retained mesh per slab, mounted by both Stage and Preview. */
export function createRegionRepresentation(
	store: MaterialStore,
	textureScope: TextureLoadScope | null = null,
	onMaterialChange: () => void = () => {},
	resolveSurfaceLook?: SceneSurfaceLookResolver,
	treatment: MaterialTreatment | undefined = undefined
) {
	const object3d = new Group();
	object3d.name = 'LayoutRegions';
	const floor = { kind: 'standard', color: DEFAULT_FLOOR_COLOR, roughness: 1, metalness: 0 } as const;
	const entries = new Map<string, { cacheKey: string; mesh: Mesh }>();
	let leases: ReturnType<MaterialStore['acquire']>[] = [];
	let scene: object | null = null;
	let activeScope: TextureLoadScope | null = textureScope;
	let activeTreatment = treatment;
	/** Session Lift: a lifted slab moves off the Stage camera and out of rays. */
	let lifted = new Set<string>();
	function materials() {
		if (leases.length === 0) leases = [
			store.acquire(floor),
			store.acquire({ kind: 'standard', color: '#111018', roughness: 0.9, metalness: 0 }),
			store.acquire({ ...floor, polygonOffset: [-2, -2] })
		];
		return leases;
	}
	let surfaceMaterials = createSceneSurfaceMaterials({
		store, scope: textureScope, onMaterialChange: refreshSurfaceMaterials, resolveSurfaceLook
	});
	function refreshSurfaceMaterials(): void {
		if (entries.size === 0) return;
		for (const [id, entry] of entries) {
			const [top, underside, edge] = materials();
			entry.mesh.material = [
				surfaceMaterials.materialFor({ kind: 'region-face', regionId: id, face: 'top' }) ?? top!.material,
				surfaceMaterials.materialFor({ kind: 'region-face', regionId: id, face: 'underside' }) ?? underside!.material,
				edge!.material
			];
		}
		onMaterialChange();
	}
	function replaceSurfaceMaterials(): void {
		const previous = surfaceMaterials;
		surfaceMaterials = createSceneSurfaceMaterials({
			store, scope: activeScope, onMaterialChange: refreshSurfaceMaterials, resolveSurfaceLook
		});
		refreshSurfaceMaterials();
		previous.dispose();
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
				const defaultTop = region.role === 'floor' ? (biased ? datumTop : floorTop) : edge;
				const [x, z] = region.footprint[0]!;
				const origin: [number, number, number] = [x, region.bottomY, z];
				const topMaterial = surfaceMaterials.materialFor({ kind: 'region-face', regionId: id, face: 'top' }) ?? defaultTop!.material;
				const undersideMaterial = surfaceMaterials.materialFor({ kind: 'region-face', regionId: id, face: 'underside' }) ?? edge!.material;
				const mesh = new Mesh(
					buildRegionMeshGeometry(region, origin),
					[topMaterial, undersideMaterial, edge!.material] as Material[]
				);
				mesh.position.set(...origin);
				mesh.name = `LayoutRegion:${id}`;
				mesh.renderOrder = biased ? 1 : 0;
				mesh.castShadow = mesh.receiveShadow = true;
				mesh.layers.set(lifted.has(id) ? LIFTED_RENDER_LAYER : 0);
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
		/** A layer write only for the ids whose state actually changed. */
		setLifted(ids: ReadonlySet<string>): boolean {
			let changed = false;
			const apply = (id: string, isLifted: boolean): void => {
				const entry = entries.get(id);
				if (entry === undefined) return;
				const mask = 1 << (isLifted ? LIFTED_RENDER_LAYER : 0);
				if (entry.mesh.layers.mask === mask) return;
				entry.mesh.layers.set(isLifted ? LIFTED_RENDER_LAYER : 0);
				changed = true;
			};
			for (const id of lifted) if (!ids.has(id)) apply(id, false);
			for (const id of ids) if (!lifted.has(id)) apply(id, true);
			lifted = new Set(ids);
			return changed;
		},
		objectOf(id: string) { return entries.get(id)?.mesh ?? null; },
		/** Re-resolve Scene-owned Region faces without rebuilding geometry. */
		setScene(next: object | null, scope: TextureLoadScope | null): boolean {
			if (next === scene && scope === activeScope) return false;
			scene = next;
			activeScope = scope;
			replaceSurfaceMaterials();
			return true;
		},
		/** A Treatment is resolve-time: re-resolve painted Region faces like Rooms. */
		setTreatment(next: MaterialTreatment | undefined): boolean {
			if (next === activeTreatment) return false;
			activeTreatment = next;
			treatment = next;
			replaceSurfaceMaterials();
			return true;
		},
		*meshes() { for (const { mesh } of entries.values()) yield mesh; },
		dispose() {
			for (const id of entries.keys()) remove(id);
			surfaceMaterials.dispose();
			releaseUnused();
			compiled = undefined;
			lifted = new Set();
		}
	};
}

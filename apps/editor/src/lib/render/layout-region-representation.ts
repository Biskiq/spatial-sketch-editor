import type { CompiledLayoutGeometry, CompiledRegion } from '@portfolio/layout-core/geometry';
import { Group, Mesh, type Material } from 'three';
import { buildRegionMeshGeometry } from '$lib/render/layout/region-mesh-builder';
import { createSceneSurfaceMaterials } from '$lib/render/layout/scene-surface-materials';
import type { FinishViewGeneration } from '$lib/render/resources/finish-views';
import type { FinishOutcomeSink } from '$lib/render/resources/finish-outcome-sink';
import type { SceneSurfaceLookResolver } from '$lib/render/layout/surface-look';
import type { TextureLoadScope } from '$lib/render/resources/texture-store';
import { DEFAULT_FLOOR_COLOR } from '$lib/visitor/room-presentation';
import { tagRenderIdentity } from './render-identity';
import { LIFTED_RENDER_LAYER } from './render-layers';
import type { MaterialStore } from './resources/material-store';
import type { MaterialTreatment } from './resources/material-descriptor';
import { applyTreatment } from './materials/treatment';

/** One retained mesh per slab, mounted by both Stage and Preview. */
export function createRegionRepresentation(
	store: MaterialStore,
	textureScope: TextureLoadScope | null = null,
	onMaterialChange: () => void = () => {},
	resolveSurfaceLook?: SceneSurfaceLookResolver,
	treatment: MaterialTreatment | undefined = undefined,
	viewGeneration?: () => FinishViewGeneration | null,
	onFinishOutcome?: FinishOutcomeSink,
) {
	const object3d = new Group();
	object3d.name = 'LayoutRegions';
	/**
	 * The unpainted defaults, in the one order every reader uses:
	 * `[floor top, dark underside/edge, datum-biased top]`. A floor Region whose
	 * top sits on the datum takes the biased top so its plane cannot z-fight the
	 * compiled floor; an overhead Region's top is the dark slab material, never
	 * the floor's. A Treatment is resolve-time, so it re-leases these descriptors
	 * exactly as a Room re-leases its floor and ceiling.
	 */
	function defaultDescriptors(active: MaterialTreatment | undefined) {
		const floor = applyTreatment(active, {
			color: DEFAULT_FLOOR_COLOR,
			roughness: 1,
			metalness: 0,
			slotUris: {},
			normalScale: null,
		});
		const slab = applyTreatment(active, {
			color: '#111018',
			roughness: 0.9,
			metalness: 0,
			slotUris: {},
			normalScale: null,
		});
		const top = {
			kind: 'standard',
			color: floor.color,
			roughness: floor.roughness,
			metalness: floor.metalness,
		} as const;
		return {
			top,
			slab: {
				kind: 'standard',
				color: slab.color,
				roughness: slab.roughness,
				metalness: slab.metalness,
			} as const,
			datumTop: { ...top, polygonOffset: [-2, -2] as const },
		};
	}
	type RetainedRegion = {
		readonly cacheKey: string;
		readonly mesh: Mesh;
		readonly role: CompiledRegion['role'];
		/** A floor Region whose top sits exactly on the datum. */
		readonly atDatum: boolean;
	};
	const entries = new Map<string, RetainedRegion>();
	let leases: ReturnType<MaterialStore['acquire']>[] = [];
	let scene: object | null = null;
	let activeScope: TextureLoadScope | null = textureScope;
	let activeTreatment = treatment;
	/** Session Lift: a lifted slab moves off the Stage camera and out of rays. */
	let lifted = new Set<string>();
	function materials() {
		if (leases.length === 0) {
			const descriptors = defaultDescriptors(activeTreatment);
			leases = [
				store.acquire(descriptors.top),
				store.acquire(descriptors.slab),
				store.acquire(descriptors.datumTop),
			];
		}
		return leases;
	}
	/** One slab's three face materials: a painted face wins, else its role default. */
	function faceMaterials(id: string, role: CompiledRegion['role'], atDatum: boolean): Material[] {
		const [top, slab, datumTop] = materials();
		const defaultTop =
			role === 'floor' ? (atDatum ? datumTop!.material : top!.material) : slab!.material;
		return [
			surfaceMaterials.materialFor({ kind: 'region-face', regionId: id, face: 'top' }) ??
				defaultTop,
			surfaceMaterials.materialFor({ kind: 'region-face', regionId: id, face: 'underside' }) ??
				slab!.material,
			slab!.material,
		];
	}
	let surfaceMaterials = createSceneSurfaceMaterials({
		store,
		scope: textureScope,
		onMaterialChange: refreshSurfaceMaterials,
		resolveSurfaceLook,
		viewGeneration,
		onFinishOutcome,
	});
	function refreshSurfaceMaterials(): void {
		if (entries.size === 0) return;
		for (const [id, entry] of entries) {
			entry.mesh.material = faceMaterials(id, entry.role, entry.atDatum);
		}
		onMaterialChange();
	}
	function replaceSurfaceMaterials(): void {
		const previous = surfaceMaterials;
		surfaceMaterials = createSceneSurfaceMaterials({
			store,
			scope: activeScope,
			onMaterialChange: refreshSurfaceMaterials,
			resolveSurfaceLook,
			viewGeneration,
			onFinishOutcome,
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
				const biased = region.role === 'floor' && region.topY === datum;
				const [x, z] = region.footprint[0]!;
				const origin: [number, number, number] = [x, region.bottomY, z];
				const mesh = new Mesh(
					buildRegionMeshGeometry(region, origin),
					faceMaterials(id, region.role, biased) as Material[],
				);
				mesh.position.set(...origin);
				mesh.name = `LayoutRegion:${id}`;
				mesh.renderOrder = biased ? 1 : 0;
				mesh.castShadow = mesh.receiveShadow = true;
				mesh.layers.set(lifted.has(id) ? LIFTED_RENDER_LAYER : 0);
				tagRenderIdentity(mesh, 'region', id);
				object3d.add(mesh);
				entries.set(id, { cacheKey: region.cacheKey, mesh, role: region.role, atDatum: biased });
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
		objectOf(id: string) {
			return entries.get(id)?.mesh ?? null;
		},
		/** Ask again for the face images that failed, without rebuilding geometry. */
		reloadTextures(): void {
			surfaceMaterials.reloadTextures();
		},
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
			// Re-lease the solid defaults as well as the painted faces, so an
			// unpainted Region responds to the Look exactly like a Room does.
			const previous = leases;
			leases = [];
			replaceSurfaceMaterials();
			for (const lease of previous) lease.release();
			return true;
		},
		*meshes() {
			for (const { mesh } of entries.values()) yield mesh;
		},
		dispose() {
			for (const id of entries.keys()) remove(id);
			surfaceMaterials.dispose();
			releaseUnused();
			compiled = undefined;
			lifted = new Set();
		},
	};
}

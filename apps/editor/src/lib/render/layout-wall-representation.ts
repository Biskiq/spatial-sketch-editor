/**
 * Retained Layout wall representation (T1.P02.S06 D.3 / H4).
 *
 * The Stage used to rebuild every Wall's `BufferGeometry`, resolved materials and
 * mesh on every compile — including each drag preview — and then dispose the
 * whole previous set. Bench 1 counted that as the representation half of F4/F8
 * (167 ms at grid-L) and as the accumulating live geometries behind F13's
 * "geometries back to baseline" clause (+2,968 per accepted commit at L).
 *
 * This module owns that representation instead:
 *
 * - **Retained.** One `Mesh` per compiled Wall, keyed by a retention key that
 *   names every input the mesh builder reads: the Wall's own `cacheKey` (its
 *   authored geometry, Openings, thickness, height and floor datum) plus the
 *   `cacheKey` of every Junction whose resolved end geometry the builder consumes.
 *   A Wall whose key is unchanged keeps its mesh object, its buffers and its
 *   materials.
 * - **Patched.** A Wall whose key moved is rebuilt and swapped in; it is the only
 *   one rebuilt.
 * - **Released.** A Wall that left the document, and every superseded buffer, is
 *   disposed in the same call — there is no deferred sweep and no second owner.
 * - **Persistent materials.** One material factory for the representation's whole
 *   lifetime and one material per tint across all Walls, so a compile creates no
 *   materials at all. They are disposed once, with the representation.
 *
 * It is imperative on purpose: at grid-L the previous shell created one Svelte
 * component pair per Wall, so every compile also cost the framework thousands of
 * ownership operations. A `THREE.Group` with `Mesh` children has none.
 *
 * What it deliberately does not own: Room floors, ceilings and door portals stay
 * with `VisitorLayoutShell` (they need `MuseumMaterial`'s texture scope, a
 * different concern), and Scene entities stay with `VisitorEntities`. The shell
 * retains their `Shape` objects by Room key so unchanged Rooms do not recreate
 * their geometry either.
 */
import {
	BoxGeometry,
	Group,
	Mesh,
	MeshBasicMaterial,
	type Material,
	type Object3D
} from 'three';
import {
	legJoinsByWall,
	type CompiledLayoutGeometry,
	type CompiledPhysicalWall,
	type LayoutBounds3
} from '@portfolio/layout-core';

import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-builder';
import { toWallBufferGeometry, type WallMeshMaterialFactory } from '$lib/render/wall-geometry-adapter';
import { createVisitorWallMaterialFactory } from '$lib/museum/layout/wall-material-factory';
import { neutralVisitorRoomPresentation } from '$lib/visitor/room-presentation';

/** One retained Wall: what it was built from and how to release it. */
type RetainedWall = {
	readonly key: string;
	readonly object: Object3D;
	readonly release: () => void;
};

/** What one update did, as counts — the H4 oracle reads these, never a stopwatch. */
export type WallRepresentationStats = {
	/** Compiled Walls in the geometry. */
	readonly walls: number;
	/** Meshes built by this update (changed, new, or newly failed). */
	readonly built: number;
	/** Meshes kept from the previous update. */
	readonly retained: number;
	/** Meshes removed and released because their Wall left the document. */
	readonly released: number;
	/** Distinct tint materials the representation has ever created (monotone). */
	readonly materials: number;
};

export type WallRepresentation = {
	/** The subtree to mount; it is never replaced, only reconciled. */
	readonly object3d: Group;
	update(geometry: CompiledLayoutGeometry): WallRepresentationStats;
	/** Release every retained mesh and material. Idempotent. */
	dispose(): void;
};

const MAGENTA = 0xff2fd4;

/**
 * Attach `object` to `parent` at `index`.
 *
 * three has no ordered insert, and assigning `parent.children[index]` directly
 * leaves `object.parent` unset — which silently disables `removeFromParent()` and
 * leaks the mesh. `add()` first (it sets the parent and dispatches the event),
 * then move the child to the slot it belongs in.
 */
function attachAt(parent: Group, object: Object3D, index: number): void {
	parent.add(object);
	const end = parent.children.indexOf(object);
	if (end === index) return;
	parent.children.splice(end, 1);
	parent.children.splice(index, 0, object);
}

function failureBox(bounds: LayoutBounds3): { position: [number, number, number]; size: [number, number, number] } {
	return {
		position: [
			(bounds.min[0] + bounds.max[0]) / 2,
			(bounds.min[1] + bounds.max[1]) / 2,
			(bounds.min[2] + bounds.max[2]) / 2
		],
		size: [bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]]
	};
}

/**
 * A Wall's retention key.
 *
 * The builder reads the compiled Wall and the resolved joins at its two ends;
 * nothing else. A Junction's `cacheKey` names its point and every leg's frame,
 * thickness, height, role and endpoint Opening bands.
 *
 * Two preconditions make an equal key mean an equal mesh:
 *
 * - **The Junction resolution is a pure function of the facts in that key.** A
 *   future resolver input (a tolerance, a global option, a neighbour's datum)
 *   must join the Junction key in `layout-core`, or a changed miter would keep a
 *   stale mesh.
 * - **The sampling derivation is process-constant.** A Wall's samples come from
 *   `sampleSegment` or from a shared derivation whose density and tolerance are
 *   fixed for the life of the page; a change to those parameters would change
 *   the mesh without changing any authored input. If they ever become
 *   configurable, their signature belongs in the Wall key in `layout-core`.
 */
function wallKey(wall: CompiledPhysicalWall, endKeys: ReadonlyMap<string, string>): string {
	return `${wall.cacheKey}\u0000${endKeys.get(wall.wallId) ?? ''}`;
}

/** Junction keys grouped by the Wall they resolve. */
function endKeysByWall(geometry: CompiledLayoutGeometry): Map<string, string> {
	const keys = new Map<string, string>();
	for (const junction of geometry.junctions ?? []) {
		for (const leg of junction.legs) {
			const existing = keys.get(leg.wallId);
			keys.set(leg.wallId, existing === undefined ? junction.cacheKey : `${existing}|${junction.cacheKey}`);
		}
	}
	return keys;
}

export function createWallRepresentation(): WallRepresentation {
	const object3d = new Group();
	object3d.name = 'VisitorLayoutWalls';
	const retained = new Map<string, RetainedWall>();
	// Every distinct material the representation has created: one per tint, which
	// is what makes "materials created per edit = 0" a fact rather than a hope.
	const materialsSeen = new Set<Material>();
	let disposed = false;

	// A physical Wall belongs to no Room: the mesh builder resolves its surface
	// with the Wall's own id as `roomId`, so the tint is always the neutral
	// visitor one. That is what the component-per-mesh shell produced too, and
	// keeping it constant is what lets the factory outlive every compile (a
	// Room-tinted lookup would also make the representation depend on Room
	// presentation, an input no Wall mesh reads).
	const factory = createVisitorWallMaterialFactory(() => neutralVisitorRoomPresentation.color);
	const resolveMaterial: WallMeshMaterialFactory = (surfaceKey, mesh) => {
		const resolved = factory.factory(surfaceKey, mesh);
		materialsSeen.add(resolved.material);
		return resolved;
	};

	function buildWall(
		wall: CompiledPhysicalWall,
		elevation: number,
		ends: Parameters<typeof buildStandaloneWallMesh>[2]
	): { object: Object3D; release: () => void } {
		const result = buildStandaloneWallMesh(wall, elevation, ends ?? null, { classifySurface: () => 'wall' });
		if (!result.mesh) {
			// The explicit failure surface the shell has always drawn: a magenta
			// wireframe box, never a silently missing Wall.
			const box = failureBox(wall.bounds3);
			const geometry = new BoxGeometry(...box.size);
			const material = new MeshBasicMaterial({ color: MAGENTA, wireframe: true });
			materialsSeen.add(material);
			const mesh = new Mesh(geometry, material);
			mesh.name = `VisitorPhysicalWallFailure:${wall.wallId}`;
			mesh.position.set(...box.position);
			return {
				object: mesh,
				release: () => {
					geometry.dispose();
					material.dispose();
				}
			};
		}
		const adapted = toWallBufferGeometry(result.mesh, resolveMaterial);
		const mesh = new Mesh(adapted.geometry, adapted.materials);
		mesh.name = `VisitorPhysicalWall:${wall.wallId}`;
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		return { object: mesh, release: adapted.dispose };
	}

	return {
		object3d,

		update(geometry) {
			if (disposed) throw new Error('the layout wall representation has been disposed');
			const endKeys = endKeysByWall(geometry);
			const endsByWall = legJoinsByWall(geometry.junctions);
			const elevationByFloor = new Map(geometry.floors.map((floor) => [floor.floorId, floor.elevation] as const));

			let built = 0;
			let kept = 0;
			const present = new Set<string>();

			for (const wall of geometry.walls ?? []) {
				present.add(wall.wallId);
				const key = wallKey(wall, endKeys);
				const previous = retained.get(wall.wallId);
				if (previous && previous.key === key) {
					kept += 1;
					continue;
				}
				const next = buildWall(
					wall,
					elevationByFloor.get(wall.floorId) ?? 0,
					endsByWall.get(wall.wallId) ?? null
				);
				const entry: RetainedWall = { key, object: next.object, release: next.release };
				if (previous) {
					// Swap in place so draw order follows the compiled Wall order.
					const index = object3d.children.indexOf(previous.object);
					previous.object.removeFromParent();
					if (index >= 0) attachAt(object3d, next.object, index);
					else object3d.add(next.object);
					previous.release();
				} else {
					object3d.add(next.object);
				}
				retained.set(wall.wallId, entry);
				built += 1;
			}

			let released = 0;
			for (const [wallId, entry] of retained) {
				if (present.has(wallId)) continue;
				entry.object.removeFromParent();
				entry.release();
				retained.delete(wallId);
				released += 1;
			}

			return {
				walls: present.size,
				built,
				retained: kept,
				released,
				materials: materialsSeen.size
			};
		},

		dispose() {
			if (disposed) return;
			disposed = true;
			for (const entry of retained.values()) {
				entry.object.removeFromParent();
				entry.release();
			}
			retained.clear();
			factory.dispose();
			// The failure-surface materials are owned per mesh and released above;
			// clearing the record keeps the set from pinning them.
			materialsSeen.clear();
		}
	};
}

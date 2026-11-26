/**
 * Retained Layout wall representation.
 *
 * This module owns every compiled Wall's mesh across compiles, including each
 * drag preview:
 *
 * - **Retained.** One `Mesh` per compiled Wall, keyed by a retention key that
 *  names every input the mesh builder reads: the Wall's own `cacheKey` (its
 *  authored geometry, Openings, thickness, height and floor datum) plus the
 *  `cacheKey` of every Junction whose resolved end geometry the builder consumes.
 *  A Wall whose key is unchanged keeps its mesh object, its buffers and its
 *  materials.
 * - **Patched.** A Wall whose key moved is rebuilt and swapped in; it is the only
 *  one rebuilt.
 * - **Released.** A Wall that left the document, and every superseded buffer, is
 *  disposed in the same call — there is no deferred sweep and no second owner.
 * - **Shared materials.** Every surface is acquired from the Canvas's
 *  `MaterialStore` by descriptor — one material per tint across all Walls, and
 *  the failure surface from the same store — so a compile constructs no
 *  material at all. The representation gives its leases back once, on dispose;
 *  a tint another representation also draws survives that release.
 *
 * It is imperative on purpose: one Svelte component pair per Wall would cost the
 * framework thousands of ownership operations per compile at large grids. A
 * `THREE.Group` with `Mesh` children has none.
 *
 * What it deliberately does not own: Room floors and ceilings
 * (`layout-room-representation.ts`), door portals and Scene entities.
 */
import { BoxGeometry, Group, Mesh, type Material, type Object3D } from 'three';
import { legJoinsByWall } from '@portfolio/layout-core/wall';
import {
	diffCompiledWalls,
	type CompiledLayoutGeometry,
	type CompiledPhysicalWall,
	type LayoutBounds3,
} from '@portfolio/layout-core/geometry';
import { countWork } from '@portfolio/layout-core/kernel';

import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-standalone';
import {
	toWallBufferGeometry,
	type WallMeshMaterialFactory,
} from '$lib/render/wall-geometry-adapter';
import { createVisitorWallMaterialFactory } from '$lib/render/layout/wall-material-factory';
import { DEFAULT_WALL_COLOR, DEFAULT_WALL_UNLIT_SHARE } from '$lib/visitor/room-presentation';
import { reconcileHidden, tagRenderIdentity } from '$lib/render/render-identity';
import type { MaterialStore } from '$lib/render/resources/material-store';
import type { TextureLoadScope } from '$lib/render/resources/texture-store';
import type {
	BasicMaterialDescriptor,
	MaterialTreatment,
} from '$lib/render/resources/material-descriptor';
import type { SceneSurfaceLookResolver } from '$lib/render/layout/surface-look';
import type { FinishViewGeneration } from '$lib/render/resources/finish-views';
import type { FinishOutcomeSink } from '$lib/render/resources/finish-outcome-sink';

type WallMaterialFactory = ReturnType<typeof createVisitorWallMaterialFactory>['factory'];

/** One retained Wall: what it was built from and how to release it. */
type RetainedWall = {
	readonly key: string;
	readonly object: Object3D;
	readonly release: () => void;
	/**
	 * Re-resolve this Wall's materials onto the retained mesh, without rebuilding
	 * its buffers; null for failure ink. The target is explicit because the
	 * incremental patch path copies a rebuilt mesh into the retained object, so a
	 * closure over the temporary object would write to a detached mesh.
	 */
	readonly rematerialize:
		| ((factory: WallMaterialFactory, target: Mesh) => readonly Material[])
		| null;
};

/** What one update did, as counts — tests read these, never a stopwatch. */
export type WallRepresentationStats = {
	/** Compiled Walls in the geometry. */
	readonly walls: number;
	/** Meshes built by this update (changed, new, or newly failed). */
	readonly built: number;
	/** Meshes kept from the previous update. */
	readonly retained: number;
	/** Meshes removed and released because their Wall left the document. */
	readonly released: number;
	/** Distinct material instances this representation has drawn (monotone). */
	readonly materials: number;
};

export type WallRepresentation = {
	/** The subtree to mount; it is never replaced, only reconciled. */
	readonly object3d: Group;
	update(geometry: CompiledLayoutGeometry): WallRepresentationStats;
	/**
	 * The retained object drawing this Wall (its failure surface when the builder
	 * refused it), or null when no Wall by that id is held. Reads the representation's
	 * own index; never searches the subtree and never reads a name.
	 */
	objectOf(wallId: string): Object3D | null;
	/**
	 * Hide exactly these Walls. Work is proportional to the ids that changed
	 * state, and the set is remembered: a Wall built later with a hidden id is
	 * born hidden, and a rebuilt Wall keeps its state.
	 */
	setHidden(wallIds: ReadonlySet<string>): void;
	/**
	 * Swap the resolve-time Treatment of every Wall surface. Returns whether any
	 * material changed, so a host that renders on demand can ask for one frame.
	 * The old factory's leases are released only after the new meshes hold theirs.
	 */
	setTreatment(treatment: MaterialTreatment | undefined): boolean;
	/** Re-resolve Scene-owned surface assignments without rebuilding geometry. */
	setScene(scene: object | null, scope: TextureLoadScope | null): boolean;
	/** Ask again for the surface images that failed, without rebuilding geometry. */
	reloadTextures(): void;
	/**
	 * The display overlay: exactly these Walls draw through the cutaway twin
	 * material. Work is proportional to the ids that changed state, the set is
	 * remembered so a rebuilt Wall is born cut, and the twin is a store lease per
	 * tint — never a second material system and never a buffer rebuild.
	 *
	 * Failure surfaces are never twinned: a Wall that could not close is not a
	 * surface a cut may present as resolved.
	 */
	setCutaway(wallIds: ReadonlySet<string>): boolean;
	/** Release every retained mesh and material. Idempotent. */
	dispose(): void;
};

const MAGENTA = 0xff2fd4;
/** The explicit failure surface the shell has always drawn: a magenta wireframe box. */
const FAILURE_SURFACE: BasicMaterialDescriptor = { kind: 'basic', color: MAGENTA, wireframe: true };

/**
 * Attach `object` to `parent` at `index`.
 *
 * three has no ordered insert, and assigning `parent.children[index]` directly
 * leaves `object.parent` unset — which silently disables `removeFromParent` and
 * leaks the mesh. `add` first (it sets the parent and dispatches the event),
 * then move the child to the slot it belongs in.
 */
function attachAt(parent: Group, object: Object3D, index: number): void {
	parent.add(object);
	countWork('representation:child-array-scan-bound', parent.children.length);
	const end = parent.children.indexOf(object);
	if (end === index) return;
	parent.children.splice(end, 1);
	parent.children.splice(index, 0, object);
}

function failureBox(bounds: LayoutBounds3): {
	position: [number, number, number];
	size: [number, number, number];
} {
	return {
		position: [
			(bounds.min[0] + bounds.max[0]) / 2,
			(bounds.min[1] + bounds.max[1]) / 2,
			(bounds.min[2] + bounds.max[2]) / 2,
		],
		size: [
			bounds.max[0] - bounds.min[0],
			bounds.max[1] - bounds.min[1],
			bounds.max[2] - bounds.min[2],
		],
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
 *  future resolver input (a tolerance, a global option, a neighbour's datum)
 *  must join the Junction key in `layout-core`, or a changed miter would keep a
 *  stale mesh.
 * - **The sampling derivation is process-constant.** A Wall's samples come from
 *  `sampleSegment` or from a shared derivation whose density and tolerance are
 *  fixed for the life of the page; a change to those parameters would change
 *  the mesh without changing any authored input. If they ever become
 *  configurable, their signature belongs in the Wall key in `layout-core`.
 * - **The key distinguishes every authored value the builder can see.** It is a
 *  JSON serialization, in which `NaN` and `null` both read as `null`; the codec
 *  rejects non-finite authored numbers, so two documents that can be opened
 *  never share a key while differing in a coordinate. Reuse is compared as a
 *  string here, so that domain guarantee is what makes the comparison a proof
 *  rather than an approximation.
 */
function wallKey(wall: CompiledPhysicalWall, endKeys: ReadonlyMap<string, string>): string {
	return `${wall.cacheKey}\u0000${endKeys.get(wall.wallId) ?? ''}`;
}

/** Junction keys grouped by the Wall they resolve. */
function endKeysByWall(geometry: CompiledLayoutGeometry): Map<string, string> {
	const keys = new Map<string, string>();
	for (const junction of geometry.junctions ?? []) {
		for (const leg of junction.legs) {
			countWork('representation:junction-leg-test');
			const existing = keys.get(leg.wallId);
			keys.set(
				leg.wallId,
				existing === undefined ? junction.cacheKey : `${existing}|${junction.cacheKey}`,
			);
		}
	}
	return keys;
}

export function createWallRepresentation(
	store: MaterialStore,
	initialTreatment: MaterialTreatment | undefined = undefined,
	initialScene: object | null = null,
	initialScope: TextureLoadScope | null = null,
	onMaterialChange: () => void = () => {},
	resolveSurfaceLook?: SceneSurfaceLookResolver,
	viewGeneration?: () => FinishViewGeneration | null,
	onFinishOutcome?: FinishOutcomeSink,
): WallRepresentation {
	const object3d = new Group();
	object3d.name = 'VisitorLayoutWalls';
	const retained = new Map<string, RetainedWall>();
	// Every distinct material the representation has created: one per tint, which
	// is what makes "materials created per edit = 0" a fact rather than a hope.
	const materialsSeen = new Set<Material>();
	let disposed = false;
	let previousGeometry: CompiledLayoutGeometry | undefined;
	let hidden: ReadonlySet<string> = new Set();
	/** The Walls drawn through the cutaway twin; a display mask, never authored. */
	let cutaway: ReadonlySet<string> = new Set();
	let treatment: MaterialTreatment | undefined = initialTreatment;
	let activeScene: object | null = initialScene;
	let activeScope: TextureLoadScope | null = initialScope;

	// A physical Wall belongs to no Room: the mesh builder resolves its surface
	// with the Wall's own id as `roomId`, so the tint is always the default
	// Wall colour. Keeping it constant is what lets the factory outlive every compile (a
	// Room-tinted lookup would also make the representation depend on Room
	// presentation, an input no Wall mesh reads).
	let factory: ReturnType<typeof createVisitorWallMaterialFactory>;
	/**
	 * The cutaway twin factory, created on first use.
	 *
	 * Twin materials are leased per tint/finish exactly as normal ones are, so the
	 * store holds at most one twin per distinct Wall material, and a cut that
	 * changes walls only swaps material references — no buffer upload.
	 */
	let cutawayFactory: ReturnType<typeof createVisitorWallMaterialFactory> | null = null;
	function refreshMaterials(): void {
		if (disposed) return;
		for (const [wallId, entry] of retained) {
			if (entry.rematerialize === null) continue;
			for (const material of entry.rematerialize(factoryFor(wallId), entry.object as Mesh))
				materialsSeen.add(material);
		}
		onMaterialChange();
	}
	function createFactory(cutawayNow = false): ReturnType<typeof createVisitorWallMaterialFactory> {
		return createVisitorWallMaterialFactory(
			store,
			() => DEFAULT_WALL_COLOR,
			DEFAULT_WALL_UNLIT_SHARE,
			treatment,
			{
				...(cutawayNow ? { cutaway: true as const } : {}),
				scope: activeScope,
				resolveSurfaceLook,
				onMaterialChange: refreshMaterials,
				viewGeneration,
				onFinishOutcome,
			},
		);
	}
	factory = createFactory();
	function twinFactory(): ReturnType<typeof createVisitorWallMaterialFactory> {
		cutawayFactory ??= createFactory(true);
		return cutawayFactory;
	}

	function factoryFor(wallId: string): WallMaterialFactory {
		return cutaway.has(wallId) ? twinFactory().factory : factory.factory;
	}

	function buildWall(
		wall: CompiledPhysicalWall,
		elevation: number,
		ends: Parameters<typeof buildStandaloneWallMesh>[2],
		cutawayNow: boolean,
	): {
		object: Object3D;
		release: () => void;
		rematerialize: ((factory: WallMaterialFactory, target: Mesh) => readonly Material[]) | null;
	} {
		const result = buildStandaloneWallMesh(wall, elevation, ends ?? null, {
			classifySurface: () => 'wall',
		});
		if (!result.mesh) {
			// The explicit failure surface the shell has always drawn: a magenta
			// wireframe box, never a silently missing Wall.
			const box = failureBox(wall.bounds3);
			const geometry = new BoxGeometry(...box.size);
			// One lease per failure mesh: giving it back never frees another mesh's
			// claim, and the store disposes the instance at the last one.
			const lease = store.acquire(FAILURE_SURFACE);
			materialsSeen.add(lease.material);
			const mesh = new Mesh(geometry, lease.material);
			mesh.name = `VisitorPhysicalWallFailure:${wall.wallId}`;
			tagRenderIdentity(mesh, 'wall-failure', wall.wallId);
			mesh.position.set(...box.position);
			return {
				object: mesh,
				release: () => {
					geometry.dispose();
					lease.release();
				},
				rematerialize: null,
			};
		}
		const surfaceFactory = cutawayNow ? twinFactory().factory : factory.factory;
		const resolveMaterial: WallMeshMaterialFactory = (surfaceKey, mesh, paintSide) => {
			const resolved = surfaceFactory(surfaceKey, mesh, paintSide);
			materialsSeen.add(resolved.material);
			return resolved;
		};
		const adapted = toWallBufferGeometry(result.mesh, resolveMaterial);
		const mesh = new Mesh(adapted.geometry, adapted.materials);
		mesh.name = `VisitorPhysicalWall:${wall.wallId}`;
		tagRenderIdentity(mesh, 'wall', wall.wallId);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		// The compiled surface groups are geometry-stable: a Treatment swap only
		// re-resolves these materials, never the buffers or the mesh object.
		const groups = result.mesh.materialGroups;
		const source = result.mesh;
		const rematerialize = (next: WallMaterialFactory, target: Mesh = mesh): readonly Material[] => {
			const materials = groups.map(
				(group) => next(group.surfaceKey, source, group.paintSide).material,
			);
			target.material = [...materials];
			return materials;
		};
		return { object: mesh, release: adapted.dispose, rematerialize };
	}

	function update(geometry: CompiledLayoutGeometry): WallRepresentationStats {
		if (disposed) throw new Error('the layout wall representation has been disposed');
		const patches = previousGeometry ? diffCompiledWalls(previousGeometry, geometry) : undefined;
		if (patches !== undefined) {
			let built = 0;
			for (const patch of patches) {
				countWork('representation:wall-entry-test');
				const key = `${patch.wall.cacheKey}\u0000${patch.endKey}`;
				const previous = retained.get(patch.wall.wallId);
				if (previous?.key === key) continue;
				const ends: NonNullable<Parameters<typeof buildStandaloneWallMesh>[2]> = {};
				for (const join of patch.joins) ends[join.end] = join;
				const next = buildWall(patch.wall, patch.elevation, ends, cutaway.has(patch.wall.wallId));
				if (!previous)
					throw new Error('compiled Wall membership proof did not match representation');
				// Keep the attached mesh and its child-array slot. Mesh.copy(false)
				// replaces buffers/material/transform without scanning or splicing N children.
				previous.object.copy(next.object, false);
				// `copy` resets visibility with the rest of the transform state.
				previous.object.visible = !hidden.has(patch.wall.wallId);
				previous.release();
				retained.set(patch.wall.wallId, {
					key,
					object: previous.object,
					release: next.release,
					rematerialize: next.rematerialize,
				});
				built += 1;
			}
			previousGeometry = geometry;
			return {
				walls: retained.size,
				built,
				retained: retained.size - built,
				released: 0,
				materials: materialsSeen.size,
			};
		}
		previousGeometry = geometry;
		const endKeys = endKeysByWall(geometry);
		const endsByWall = legJoinsByWall(geometry.junctions);
		const elevationByFloor = new Map(
			geometry.floors.map((floor) => [floor.floorId, floor.elevation] as const),
		);

		let built = 0;
		let kept = 0;
		const present = new Set<string>();

		for (const wall of geometry.walls ?? []) {
			countWork('representation:wall-entry-test');
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
				endsByWall.get(wall.wallId) ?? null,
				cutaway.has(wall.wallId),
			);
			next.object.visible = !hidden.has(wall.wallId);
			const entry: RetainedWall = {
				key,
				object: next.object,
				release: next.release,
				rematerialize: next.rematerialize,
			};
			if (previous) {
				// Swap in place so draw order follows the compiled Wall order.
				countWork('representation:child-array-scan-bound', object3d.children.length);
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
			countWork('representation:wall-removal-test');
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
			materials: materialsSeen.size,
		};
	}

	return {
		object3d,

		update(geometry) {
			return update(geometry);
		},

		setTreatment(next) {
			if (disposed) throw new Error('the layout wall representation has been disposed');
			if (next === treatment) return false;
			const previousFactory = factory;
			const previousCutawayFactory = cutawayFactory;
			treatment = next;
			factory = createFactory();
			// The twin is rebuilt lazily with the same Treatment, so a cut Wall never
			// keeps a material of the previous finish.
			cutawayFactory = null;
			// Material-only swap: every geometry stays attached and untouched. The new
			// leases are taken before the superseded factories give their own back.
			for (const [wallId, entry] of retained) {
				if (entry.rematerialize === null) continue;
				for (const material of entry.rematerialize(factoryFor(wallId), entry.object as Mesh)) {
					materialsSeen.add(material);
				}
			}
			previousFactory.dispose();
			previousCutawayFactory?.dispose();
			return true;
		},

		reloadTextures() {
			if (disposed) return;
			factory.reloadTextures();
			cutawayFactory?.reloadTextures();
		},

		setScene(nextScene, nextScope) {
			if (disposed) throw new Error('the layout wall representation has been disposed');
			if (nextScene === activeScene && nextScope === activeScope) return false;
			const previousFactory = factory;
			const previousCutawayFactory = cutawayFactory;
			activeScene = nextScene;
			activeScope = nextScope;
			factory = createFactory();
			cutawayFactory = null;
			refreshMaterials();
			previousFactory.dispose();
			previousCutawayFactory?.dispose();
			return true;
		},

		setCutaway(wallIds) {
			if (disposed) throw new Error('the layout wall representation has been disposed');
			const next = new Set(wallIds);
			let changed = false;
			for (const wallId of cutaway) {
				if (next.has(wallId)) continue;
				changed = true;
				const entry = retained.get(wallId);
				if (entry?.rematerialize === null || entry === undefined) continue;
				for (const material of entry.rematerialize(factory.factory, entry.object as Mesh)) {
					materialsSeen.add(material);
				}
			}
			for (const wallId of next) {
				if (cutaway.has(wallId)) continue;
				changed = true;
				const entry = retained.get(wallId);
				if (entry?.rematerialize === null || entry === undefined) continue;
				for (const material of entry.rematerialize(twinFactory().factory, entry.object as Mesh)) {
					materialsSeen.add(material);
				}
			}
			cutaway = next;
			return changed;
		},

		objectOf(wallId) {
			return retained.get(wallId)?.object ?? null;
		},

		setHidden(wallIds) {
			if (disposed) throw new Error('the layout wall representation has been disposed');
			hidden = reconcileHidden(hidden, wallIds, (wallId, isHidden) => {
				countWork('representation:visibility-write');
				const entry = retained.get(wallId);
				if (entry !== undefined) entry.object.visible = !isHidden;
			});
		},

		dispose() {
			if (disposed) return;
			disposed = true;
			previousGeometry = undefined;
			hidden = new Set();
			cutaway = new Set();
			for (const entry of retained.values()) {
				entry.object.removeFromParent();
				entry.release();
			}
			retained.clear();
			factory.dispose();
			cutawayFactory?.dispose();
			cutawayFactory = null;
			// The failure-surface leases are owned per mesh and released above;
			// clearing the record keeps the set from pinning them.
			materialsSeen.clear();
		},
	};
}

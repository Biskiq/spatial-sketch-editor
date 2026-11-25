/** Mounted Scene geometry is data for the Stage hit provider, never a selection authority. */
import { Box3, Matrix3, Mesh, Raycaster, type Intersection, type Object3D } from 'three';
import { LAYOUT_SLICE_CONTACT_METERS } from '@portfolio/layout-core/room';
import type { LayoutRegionSurfaceRef } from '@portfolio/layout-core/plan';
import { regionSurfaceOf } from '$lib/render/layout/region-mesh-builder';
import type { PointerRay } from '@portfolio/camera-core/viewport';
import type { Layout3dPickRange } from '$lib/layout/wall-mesh-builder';
import type { RuntimeScene } from '@portfolio/project-model/scene';
import { renderIdentityOf, type LayoutIdentityIndex } from '$lib/render/render-identity';

/**
 * The union group every Wall-owned Layout mesh shares (Walls, bridges, keels: one
 * closed solid, assembled together). A Layout object gets a group of its own.
 */
export const LAYOUT_STRUCTURE_GROUP = 'layout-structure';

/**
 * One drawn mesh as the Slice sees it: local positions, an optional index, and the
 * world matrix that places it. `group` is the cap assembly's union group.
 */
export type SectionSource = {
	readonly identity: string;
	readonly group: string;
	readonly positions: ArrayLike<number>;
	readonly index: ArrayLike<number> | null;
	readonly matrix: number[];
};

export type PickOptions = {
	/**
	 * Whether a world point is currently not drawn (a Slice or X2's cutaway hides it).
	 * A hidden hit is skipped and the ray continues, so a click reaches what is
	 * visible behind it. `object` is the hit's own mesh, which lets the cutaway
	 * answer per Wall rather than per point. Existing callers ignore it.
	 * Absent means today's behaviour exactly.
	 */
	readonly hiddenAt?: (point: readonly [number, number, number], object: Object3D) => boolean;
	/**
	 * Object Studio's scope: when defined, only this entity is walked and the Layout
	 * shell is skipped, so a ray passes through muted bodies to the scoped one.
	 * `null` walks nothing. Absent means today's behaviour exactly.
	 */
	readonly only?: string | null;
};

export type SceneRenderedHit = {
	readonly entityId: string | null;
	readonly kind: 'entity' | 'floor' | 'layout';
	/** The owned Layout subject under this mesh hit, when it has one. */
	readonly layoutId?: string;
	readonly layoutKind?: 'wall' | 'wall-failure' | 'object' | 'floor' | 'lid' | 'region';
	readonly wallId?: string;
	/** A qualified exterior Wall side, only on paintable front/back face strips. */
	readonly wallSide?: 'left' | 'right';
	readonly region?: LayoutRegionSurfaceRef;
	readonly wallNormal?: [number, number, number];
	readonly distanceMeters: number;
	readonly worldPoint: [number, number, number];
	/** World-space surface normal when the hit is a mesh face. */
	readonly normal?: [number, number, number];
};

/** True when this node and every ancestor are visible; the same rule the pick ray uses. */
export function hasVisibleAncestor(node: Object3D): boolean {
	for (let ancestor: Object3D | null = node; ancestor !== null; ancestor = ancestor.parent) {
		if (!ancestor.visible) return false;
	}
	return true;
}

export function createScenePickSource() {
	const roots = new Map<string, Object3D>();
	let layoutRoot: Object3D | null = null;
	/** The Layout shell's owned id → object index; never a subtree search. */
	let layoutIdentity: LayoutIdentityIndex | null = null;
	/** Renderer-only observers; they never participate in picking. */
	const listeners = new Set<() => void>();
	function notify(): void {
		for (const listener of [...listeners]) {
			try { listener(); } catch { /* A render observer must not break the pick source. */ }
		}
	}
	const raycaster = new Raycaster();
	const boxes = new WeakMap<Object3D, { stamp: number[]; bounds: Box3 }>();
	function boundsOf(root: Object3D): Box3 {
		root.updateWorldMatrix(true, true);
		const stamp: number[] = [];
		root.traverse((node) => {
			stamp.push(node.id, ...node.matrixWorld.elements);
			if (node instanceof Mesh) stamp.push(node.geometry.id, node.geometry.attributes.position?.version ?? 0);
		});
		const cached = boxes.get(root);
		if (cached && cached.stamp.length === stamp.length && stamp.every((value, i) => value === cached.stamp[i])) return cached.bounds;
		// Three's Mesh.raycast otherwise builds these on the first pointer event.
		root.traverse((node) => {
			if (node instanceof Mesh) { node.geometry.computeBoundingBox(); node.geometry.computeBoundingSphere(); }
		});
		const bounds = new Box3().setFromObject(root);
		boxes.set(root, { stamp, bounds });
		return bounds;
	}
	let queued = false;
	function refresh() {
		if (queued) return;
		queued = true;
		queueMicrotask(() => {
			queued = false;
			for (const root of roots.values()) boundsOf(root);
			if (layoutRoot) boundsOf(layoutRoot);
			// A lazy model/form can mount after its root was registered; the bounds
			// refresh is also the moment the Stage's renderer-only ink can rebuild from
			// the new children. This is not a pick notification and never writes state.
			notify();
		});
	}
	let source: RuntimeScene | null = null;
	/** A renderable mesh is a mesh with a visible ancestor chain and real vertices. */
	function hasRenderableMesh(root: Object3D): boolean {
		let found = false;
		root.traverse((node) => {
			if (found || !(node instanceof Mesh)) return;
			const position = node.geometry.getAttribute('position');
			if (position === undefined || position.count < 3) return;
			if (!hasVisibleAncestor(node)) return;
			found = true;
		});
		return found;
	}
	/**
	 * One ray hit in the shared vocabulary. Layout wall sides carry the pick
	 * normal A1's placement policy reads; opening reveals, lintels, bridges and
	 * free-end caps carry none (a cap keeps the `side` owner but is excluded by
	 * `isArtworkWallFace`, which reads T1's compiled Wall tangent).
	 */
	function describeHit(hit: Intersection, entityId: string | null): SceneRenderedHit {
		// The caller admits only Mesh hits; `Intersection.object` is the wide base type.
		const object = hit.object as Mesh;
		const triangleOffset = hit.faceIndex == null ? -1 : hit.faceIndex * 3;
		const ranges = object.geometry.userData.pickRanges as readonly Layout3dPickRange[] | undefined;
		const face = entityId === null ? ranges?.find((range) =>
			triangleOffset >= range.start && triangleOffset < range.start + range.count) : undefined;
		const isWall = face?.kind === 'wall' && face.surface === 'side';
		const normal = isWall && hit.face
			? hit.face.normal.clone().applyNormalMatrix(new Matrix3().getNormalMatrix(object.matrixWorld))
			: null;
		const faceNormal = hit.face
			? hit.face.normal.clone().applyNormalMatrix(new Matrix3().getNormalMatrix(object.matrixWorld)).toArray() as [number, number, number]
			: undefined;
		const identity = renderIdentityOf(object);
		const surface = identity?.kind === 'region' && hit.faceIndex != null
			? regionSurfaceOf(object.geometry, hit.faceIndex) : undefined;
		return {
			...(surface ? { region: { kind: 'region-face' as const, regionId: identity!.id, face: surface } } : {}),
			...(identity === null ? {} : { layoutId: identity.id, layoutKind: identity.kind }),
			...(face?.paintSide === undefined ? {} : { wallId: face.segmentId, wallSide: face.paintSide }),
			...(face?.kind === 'wall' && face.paintSide === undefined ? { wallId: face.segmentId } : {}),
			...(normal === null ? {} : { wallNormal: normal.toArray() }),
			...(faceNormal === undefined ? {} : { normal: faceNormal }),
			entityId,
			kind: entityId !== null ? 'entity' : identity?.kind === 'floor' ? 'floor' : 'layout',
			distanceMeters: hit.distance,
			worldPoint: hit.point.toArray()
		};
	}
	function prepare(ray: PointerRay, expected: RuntimeScene): boolean {
		if (source !== expected || ![...ray.origin, ...ray.direction].every(Number.isFinite)) return false;
		raycaster.ray.origin.set(...ray.origin);
		raycaster.ray.direction.set(...ray.direction);
		return true;
	}
	function targetsFor(expected: RuntimeScene, only?: string | null): Array<{ id: string | null; root: Object3D | undefined }> {
		if (only !== undefined) {
			const scoped = only === null ? undefined : expected.entities.find((entity) => entity.id === only);
			return scoped === undefined ? [] : [{ id: scoped.id as string | null, root: roots.get(scoped.id) }];
		}
		const targets = expected.entities.map((entity) => ({ id: entity.id as string | null, root: roots.get(entity.id) }));
		if (layoutRoot !== null) targets.push({ id: null, root: layoutRoot });
		return targets;
	}
	function nearest(candidate: SceneRenderedHit, current: SceneRenderedHit | null): SceneRenderedHit {
		if (current === null) return candidate;
		if (Math.abs(candidate.distanceMeters - current.distanceMeters) <= LAYOUT_SLICE_CONTACT_METERS) {
			if (candidate.region?.face === 'top' && current.kind === 'floor') return candidate;
			if (current.region?.face === 'top' && candidate.kind === 'floor') return current;
		}
		if (candidate.distanceMeters < current.distanceMeters) return candidate;
		if (candidate.distanceMeters === current.distanceMeters && (candidate.entityId ?? '') < (current.entityId ?? '')) return candidate;
		return current;
	}
	return {
		setSource(next: RuntimeScene) { source = next; refresh(); },
		/**
		 * Whether this entity has a mounted, visible body the pick ray can reach.
		 *
		 * A root group can exist before its lazy model or form renderer has mounted
		 * geometry; an empty root is neither drawn nor pickable. This reads the same
		 * roots, visibility and meshes the raycast walks; it never writes `visible`
		 * and is not a second eligibility model.
		 */
		hasPickableBody(id: string): boolean {
			const root = roots.get(id);
			if (root === undefined) return false;
			for (let node: Object3D | null = root; node !== null; node = node.parent) {
				if (!node.visible) return false;
			}
			return hasRenderableMesh(root);
		},
		refresh,
		bounds(id: string, expected: RuntimeScene): { min: [number, number, number]; max: [number, number, number] } | null {
			const root = source === expected ? roots.get(id) : undefined;
			if (root === undefined || !hasRenderableMesh(root)) return null;
			const box = boundsOf(root);
			return box.isEmpty() ? null : { min: box.min.toArray(), max: box.max.toArray() };
		},
		registerLayout(root: Object3D) {
			layoutRoot = root; refresh();
			return () => { if (layoutRoot === root) { layoutRoot = null; notify(); } };
		},
		register(id: string, root: Object3D) {
			roots.set(id, root); refresh();
			return () => { if (roots.get(id) === root) { roots.delete(id); notify(); } };
		},
		/** Register the Layout shell's owned identity index (see `VisitorLayoutShell`). */
		registerLayoutIdentity(index: LayoutIdentityIndex) {
			// Deferred like `registerLayout`: this runs inside the shell's mount effect, and a
			// synchronous observer that writes state would loop that effect.
			layoutIdentity = index; refresh();
			return () => { if (layoutIdentity === index) { layoutIdentity = null; notify(); } };
		},
		/** The object that draws this Layout item, resolved through the owner's index. */
		layoutObjectOf(kind: 'wall' | 'object' | 'floor' | 'region', id: string): Object3D | null {
			return layoutIdentity?.objectOf(kind, id) ?? null;
		},
		entityObject(id: string): Object3D | null {
			return roots.get(id) ?? null;
		},
		/** Observe renderer registration/lifecycle; never used by the hit path. */
		onRenderRootsChanged(listener: () => void): () => void {
			listeners.add(listener);
			return () => { listeners.delete(listener); };
		},
		pick(
			ray: PointerRay,
			expected: RuntimeScene,
			options: PickOptions = {}
		): SceneRenderedHit | null {
			if (!prepare(ray, expected)) return null;
			let result: SceneRenderedHit | null = null;
			for (const target of targetsFor(expected, options.only)) {
				const root = target.root;
				if (root === undefined) continue;
				// Exact hierarchy/matrix/geometry stamps invalidate conservative bounds
				// after lazy arrivals, transforms and source edits; no guessed model box.
				if (!raycaster.ray.intersectsBox(boundsOf(root))) continue;
				let closest: SceneRenderedHit | null = null;
				for (const hit of raycaster.intersectObject(root, true)) {
					if (closest && hit.distance - closest.distanceMeters > LAYOUT_SLICE_CONTACT_METERS) break;
					if (!(hit.object instanceof Mesh)) continue;
					let visible = true;
					for (let node: Object3D | null = hit.object; node !== null; node = node.parent) {
						if (!node.visible) { visible = false; break; }
					}
					if (!visible) continue;
					// A Slice's cut is display geometry, not a document change: the point is
					// still in the world, but it is not what the creator can see or aim at,
					// so the ray continues to the next hit behind it (test 10).
					if (options.hiddenAt?.(hit.point.toArray(), hit.object) === true) continue;
					const candidate = describeHit(hit, target.id);
					if (closest && candidate.region?.face !== 'top') continue;
					closest = nearest(candidate, closest);
					if (closest.kind !== 'floor' || target.id !== null) break;
				}
				if (closest) result = nearest(closest, result);
			}
			return result;
		},
		/**
		 * Every **drawn Layout** mesh that is a cap candidate, as world-space section
		 * inputs.
		 *
		 * The Slice caps come from what is actually drawn — the same Layout meshes the
		 * hit path walks — so a door reveal, an arch head or a keel closes exactly as
		 * it is built. This is a read: it writes no state, changes no visibility and is
		 * never used by the hit path.
		 *
		 * **Scope is decided by identity, not by what happens to be mounted** (§2.2):
		 *
		 * - Scene models are clipped by the planes and **never capped** (owner A-2), so
		 *   no Scene root is visited. An imported model must also never enter a Wall
		 *   union: its triangles are open in arbitrary places and would either break the
		 *   group's balance or fabricate a cap through it.
		 * - Walls and Wall failure surfaces share one structure group — together they
		 *   are the closed solid the builder resolved.
		 * - **Each Layout object gets its own group.** Grouping every object as `object`
		 *   unioned unrelated plinths, so one object's section could eat another's.
		 * - A floor is not a cap candidate: it is a horizontal slab at the datum, and in
		 *   the structure group it would weld into every Wall's bottom edge and close
		 *   their boundaries where the builder had a real end.
		 * - An untagged mesh (a derived ceiling, the floor's shadow catcher) is not
		 *   identified as a Layout cap source and is skipped rather than guessed at.
		 */
		sectionSources(onlyRegions = false): SectionSource[] {
			const sources: SectionSource[] = [];
			const root = layoutRoot;
			if (root === null) return sources;
			const collect = (node: Object3D) => {
				if (!(node instanceof Mesh)) return;
				if (!hasVisibleAncestor(node)) return;
				const position = node.geometry.getAttribute('position');
				if (position === undefined || position.count < 3) return;
				const identity = renderIdentityOf(node);
				if (identity === null) return;
				// Generated horizontal planes are not section caps: a floor is the
				// ground the Walls stand on, and a lid is a derived ceiling.
				if (identity.kind === 'floor' || identity.kind === 'lid') return;
				// A Wall failure surface is the *fallback* body the builder produced for a
				// Wall it could not close. Capping it would draw a solid paper section over
				// a defect and read as a resolved Wall; its edges already say what happened.
				if (identity.kind === 'wall-failure') return;
				sources.push({
					identity: `${identity.kind}:${identity.id}`,
					group: identity.kind === 'region' ? `layout-region:${identity.id}` : identity.kind === 'object' ? `layout-object:${identity.id}` : LAYOUT_STRUCTURE_GROUP,
					positions: position.array as ArrayLike<number>,
					index: node.geometry.getIndex()?.array ?? null,
					matrix: node.matrixWorld.elements
				});
			};
			if (onlyRegions) {
				for (const mesh of layoutIdentity?.regionMeshes?.() ?? []) {
					mesh.updateWorldMatrix(true, false);
					collect(mesh);
				}
			} else {
				root.updateWorldMatrix(true, true);
				root.traverse(collect);
			}
			return sources;
		},
		/**
		 * The nearest **visible** Layout face accepted by `accept`, refusing a face
		 * that a nearer entity or the Floor occludes. Opening reveals, lintels and
		 * bridges carry no acceptance in the caller's predicate and are skipped
		 * rather than treated as an occluder: a ray through a doorway can still
		 * reach the far wall face. Placement policy owns `accept`; this source
		 * owns only the ray walk and the visibility rule.
		 */
		pickVisibleFace(
			ray: PointerRay,
			expected: RuntimeScene,
			accept: (hit: SceneRenderedHit) => boolean,
			options: PickOptions = {}
		): SceneRenderedHit | null {
			if (!prepare(ray, expected)) return null;
			let accepted: SceneRenderedHit | null = null;
			let blockedAt: number | null = null;
			for (const target of targetsFor(expected, options.only)) {
				const root = target.root;
				if (root === undefined) continue;
				if (!raycaster.ray.intersectsBox(boundsOf(root))) continue;
				for (const hit of raycaster.intersectObject(root, true)) {
					if (!(hit.object instanceof Mesh)) continue;
					let visible = true;
					for (let node: Object3D | null = hit.object; node !== null; node = node.parent) {
						if (!node.visible) { visible = false; break; }
					}
					if (!visible) continue;
					// Artwork placement and Layout's occlusion test aim where the creator
					// looks: a face a Slice does not draw is not a place to hang anything,
					// and it must not block the face behind it either (test 10's rule,
					// applied to the placement ray rather than to selection).
					if (options.hiddenAt?.(hit.point.toArray(), hit.object) === true) continue;
					const candidate = describeHit(hit, target.id);
					if (accept(candidate)) accepted = nearest(candidate, accepted);
					else if (candidate.kind === 'entity' || candidate.kind === 'floor') {
						blockedAt = Math.min(blockedAt ?? Infinity, candidate.distanceMeters);
					}
				}
			}
			return accepted !== null && (blockedAt === null || accepted.distanceMeters <= blockedAt) ? accepted : null;
		}
	};
}
export type ScenePickSource = ReturnType<typeof createScenePickSource>;

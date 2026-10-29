/** Mounted Scene geometry is data for the Stage hit provider, never a selection authority. */
import { Box3, Mesh, Raycaster, type Object3D } from 'three';
import type { PointerRay } from '@portfolio/camera-core';
import type { RuntimeScene } from '@portfolio/project-model';

export type SceneRenderedHit = { readonly entityId: string | null; readonly kind: 'entity' | 'floor' | 'layout'; readonly distanceMeters: number; readonly worldPoint: [number, number, number] };
export function createScenePickSource() {
	const roots = new Map<string, Object3D>();
	let layoutRoot: Object3D | null = null;
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
			for (let ancestor: Object3D | null = node; ancestor !== null; ancestor = ancestor.parent) {
				if (!ancestor.visible) return;
			}
			found = true;
		});
		return found;
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
			if (root === undefined) return null;
			const box = boundsOf(root);
			return box.isEmpty() ? null : { min: box.min.toArray(), max: box.max.toArray() };
		},
		registerLayout(root: Object3D) {
			layoutRoot = root; refresh();
			return () => { if (layoutRoot === root) layoutRoot = null; };
		},
		register(id: string, root: Object3D) {
			roots.set(id, root); refresh();
			return () => { if (roots.get(id) === root) roots.delete(id); };
		},
		pick(ray: PointerRay, expected: RuntimeScene): SceneRenderedHit | null {
			if (source !== expected || ![...ray.origin, ...ray.direction].every(Number.isFinite)) return null;
			raycaster.ray.origin.set(...ray.origin);
			raycaster.ray.direction.set(...ray.direction);
			let nearest: SceneRenderedHit | null = null;
			const targets = expected.entities.map((entity) => ({ id: entity.id as string | null, root: roots.get(entity.id) }));
			if (layoutRoot !== null) targets.push({ id: null, root: layoutRoot });
			for (const target of targets) {
				const root = target.root;
				if (root === undefined) continue;
				// Exact hierarchy/matrix/geometry stamps invalidate conservative bounds
				// after lazy arrivals, transforms and source edits; no guessed model box.
				if (!raycaster.ray.intersectsBox(boundsOf(root))) continue;
				for (const hit of raycaster.intersectObject(root, true)) {
					if (!(hit.object instanceof Mesh)) continue;
					let visible = true;
					for (let node: Object3D | null = hit.object; node !== null; node = node.parent) {
						if (!node.visible) { visible = false; break; }
					}
					if (!visible) continue;
					if (nearest === null || hit.distance < nearest.distanceMeters ||
						hit.distance === nearest.distanceMeters && (target.id ?? '') < (nearest.entityId ?? '')) {
						nearest = { entityId: target.id, kind: target.id !== null ? 'entity' : hit.object.name.startsWith('VisitorFloor:') ? 'floor' : 'layout', distanceMeters: hit.distance, worldPoint: hit.point.toArray() };
					}
					break;
				}
			}
			return nearest;
		}
	};
}
export type ScenePickSource = ReturnType<typeof createScenePickSource>;

/** Mounted Scene geometry is data for the Stage hit provider, never a selection authority. */
import { Mesh, Raycaster, Vector3, type Object3D } from 'three';
import type { PointerRay } from '@portfolio/camera-core';
import type { RuntimeScene } from '@portfolio/project-model';

export type SceneRenderedHit = { readonly entityId: string | null; readonly kind: 'entity' | 'floor' | 'layout'; readonly distanceMeters: number; readonly worldPoint: [number, number, number] };
export function createScenePickSource() {
	const roots = new Map<string, Object3D>();
	let layoutRoot: Object3D | null = null;
	const raycaster = new Raycaster();
	let source: RuntimeScene | null = null;
	return {
		setSource(next: RuntimeScene) { source = next; },
		registerLayout(root: Object3D) {
			layoutRoot = root;
			return () => { if (layoutRoot === root) layoutRoot = null; };
		},
		register(id: string, root: Object3D) {
			roots.set(id, root);
			return () => { if (roots.get(id) === root) roots.delete(id); };
		},
		pick(ray: PointerRay, expected: RuntimeScene): SceneRenderedHit | null {
			if (source !== expected || ![...ray.origin, ...ray.direction].every(Number.isFinite)) return null;
			raycaster.set(new Vector3(...ray.origin), new Vector3(...ray.direction));
			let nearest: SceneRenderedHit | null = null;
			const targets = expected.entities.map((entity) => ({ id: entity.id as string | null, root: roots.get(entity.id) }));
			if (layoutRoot !== null) targets.push({ id: null, root: layoutRoot });
			for (const target of targets) {
				const root = target.root;
				if (root === undefined) continue;
				root.updateWorldMatrix(true, true);
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

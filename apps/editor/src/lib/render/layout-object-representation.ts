/**
 * Retained Layout object representation (T1.P02.S06 D.3 / H4).
 *
 * The Stage drew every Layout object as its own Svelte component pair. Bench 1
 * located the cost in the mount itself (characterization §2: Svelte inserting each
 * mesh component's anchors is 86 % of the XL open's self time, × 4.4 per
 * doubling), and a compile paid it again for every object whose output had not
 * changed. At L the fixture carries three objects per Room, so the object rows are
 * a larger component population than the Walls are.
 *
 * This module owns that representation imperatively, on the same terms as the
 * Wall representation:
 *
 * - one `Mesh` per compiled object, keyed by the object's own `cacheKey` (which
 *   names its kind, dimensions, position, rotation, Room and read-only flag), so
 *   an unchanged object keeps its object, buffers and material;
 * - a changed object is rebuilt and swapped in place, in compiled order;
 * - an object that left the document is released in the same update;
 * - one material for every object for the representation's whole lifetime, which
 *   is what makes "materials created per edit = 0" true here as well.
 *
 * Shapes and transforms are the ones the Svelte shell drew — a box, plane or
 * profile is a `BoxGeometry` of its dimensions; a cylinder is a unit-height
 * `CylinderGeometry` scaled to its dimensions; a sphere is the unit sphere scaled
 * by `sphereRenderScale` — so the rendered result is unchanged.
 *
 * What it deliberately does not own: Room floors, ceilings and door portals (they
 * need `MuseumMaterial`'s texture scope) and Scene entities (`VisitorEntities`).
 */
import {
	BoxGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	SphereGeometry,
	type BufferGeometry,
	type Material,
	type Object3D
} from 'three';
import { sphereRenderScale, type CompiledLayoutGeometry, type CompiledLayoutObject } from '@portfolio/layout-core';

/** One retained object: what it was built from, the object and its buffers. */
type RetainedObject = {
	readonly key: string;
	readonly object: Object3D;
	readonly geometry: BufferGeometry;
};

/** What one update did, as counts — the H4 oracle reads these, never a stopwatch. */
export type ObjectRepresentationStats = {
	readonly objects: number;
	readonly built: number;
	readonly retained: number;
	readonly released: number;
};

export type ObjectRepresentation = {
	/** The subtree to mount; it is never replaced, only reconciled. */
	readonly object3d: Group;
	update(geometry: CompiledLayoutGeometry): ObjectRepresentationStats;
	/** Release every retained mesh and the shared material. Idempotent. */
	dispose(): void;
};

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

function bufferFor(object: CompiledLayoutObject): { geometry: BufferGeometry; scale: [number, number, number] } {
	if (object.kind === 'cylinder') {
		return {
			geometry: new CylinderGeometry(object.dimensions[0] / 2, object.dimensions[0] / 2, object.dimensions[1], 24),
			scale: [1, 1, object.dimensions[2] / object.dimensions[0]]
		};
	}
	if (object.kind === 'sphere') {
		const scale = sphereRenderScale(object.dimensions);
		return {
			geometry: new SphereGeometry(0.5, 24, 16),
			scale: [scale[0], scale[1], scale[2]]
		};
	}
	// box, plane and profile: the compiled slab itself.
	return { geometry: new BoxGeometry(...object.dimensions), scale: [1, 1, 1] };
}

export function createObjectRepresentation(): ObjectRepresentation {
	const object3d = new Group();
	object3d.name = 'VisitorLayoutObjects';
	const retained = new Map<string, RetainedObject>();
	// The neutral Layout-object surface the shell drew (`#e7e4dd`, roughness
	// 0.78, metalness 0). One instance for the representation's lifetime.
	const material: Material = new MeshStandardMaterial({ color: 0xe7e4dd, roughness: 0.78, metalness: 0 });
	let disposed = false;

	return {
		object3d,

		update(geometry) {
			if (disposed) throw new Error('the layout object representation has been disposed');
			let built = 0;
			let kept = 0;
			const present = new Set<string>();

			for (const object of geometry.objects) {
				present.add(object.objectId);
				const previous = retained.get(object.objectId);
				if (previous && previous.key === object.cacheKey) {
					kept += 1;
					continue;
				}
				const buffer = bufferFor(object);
				const mesh = new Mesh(buffer.geometry, material);
				mesh.castShadow = true;
				mesh.receiveShadow = true;
				mesh.scale.set(...buffer.scale);
				mesh.name = `VisitorLayoutObject:${object.objectId}`;
				mesh.position.set(...object.position);
				mesh.rotation.set(object.rotation[0], object.rotation[1], object.rotation[2]);

				const entry: RetainedObject = { key: object.cacheKey, object: mesh, geometry: buffer.geometry };
				if (previous) {
					// Swap in place so draw order follows compiled object order.
					const index = object3d.children.indexOf(previous.object);
					previous.object.removeFromParent();
					if (index >= 0) attachAt(object3d, mesh, index);
					else object3d.add(mesh);
					previous.geometry.dispose();
				} else {
					object3d.add(mesh);
				}
				retained.set(object.objectId, entry);
				built += 1;
			}

			let released = 0;
			for (const [objectId, entry] of retained) {
				if (present.has(objectId)) continue;
				entry.object.removeFromParent();
				entry.geometry.dispose();
				retained.delete(objectId);
				released += 1;
			}

			return { objects: present.size, built, retained: kept, released };
		},

		dispose() {
			if (disposed) return;
			disposed = true;
			for (const entry of retained.values()) {
				entry.object.removeFromParent();
				entry.geometry.dispose();
			}
			retained.clear();
			material.dispose();
		}
	};
}

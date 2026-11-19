/**
 * The rendered meshes a selection entry owns, and the Slice ghost's view of them.
 *
 * Both the selection ink and the Slice's ghost need the same answer to "which
 * meshes draw this subject?" — the retained object the representation indexed, or
 * the mounted entity root. Keeping one resolver here is what stops the ghost from
 * being built from a different (second) idea of the subject than the gold contour
 * that represents it.
 *
 * The ghost subject bakes each mesh's world matrix into world-space positions, the
 * shape `subjectWhollyHidden` reads. That is the one cost: it runs on selection,
 * reading or geometry change, never per frame.
 */
import { Box3, Mesh, Vector3, type Object3D } from 'three';
import type { ScenePickSource } from '../../scene/scene-pick-source';
import { hasVisibleAncestor } from '../../scene/scene-pick-source';
import type { StageSelectionEntry } from '../semantic-selection';
import type { SliceTriangleBuffer, SliceGhostSubject } from '../slice/slice-ghost';

/** Every mesh of the subject that the Stage camera actually draws. */
export function drawnMeshesOf(objects: readonly Object3D[]): Mesh[] {
	const meshes: Mesh[] = [];
	for (const object of objects) {
		object.traverse((node) => {
			if (!(node instanceof Mesh)) return;
			const position = node.geometry.getAttribute('position');
			if (position === undefined || position.count < 3) return;
			if (!hasVisibleAncestor(node)) return;
			meshes.push(node);
		});
	}
	return meshes;
}

/**
 * The rendered objects one selection entry owns.
 *
 * An empty array means "nothing draws this subject": a failed Wall resolves to its
 * failure surface (still an object), a missing one resolves to nothing.
 */
export function selectionObjectsOf(scenePick: ScenePickSource, entry: StageSelectionEntry): Object3D[] {
	const id = entry.reference.subject.id;
	if (entry.reference.domain === 'layout') {
		const kind = entry.reference.subject.kind;
		const owned =
			kind === 'wall' ? scenePick.layoutObjectOf('wall', id)
			: kind === 'object' ? scenePick.layoutObjectOf('object', id)
			: kind === 'region' ? scenePick.layoutObjectOf('region', id)
			: kind === 'room' ? scenePick.layoutObjectOf('floor', id)
			: null;
		return owned === null ? [] : [owned];
	}
	const entity = scenePick.entityObject(id);
	return entity === null ? [] : [entity];
}

const scratch = new Vector3();

/** One mesh's triangles in world space, plus the AABB they span. */
function trianglesOf(mesh: Mesh, box: Box3): SliceTriangleBuffer | null {
	mesh.updateWorldMatrix(true, false);
	const matrix = mesh.matrixWorld;
	const position = mesh.geometry.getAttribute('position');
	if (position === undefined || position.count < 3) return null;
	const positions = new Float32Array(position.count * 3);
	for (let index = 0; index < position.count; index += 1) {
		scratch.fromBufferAttribute(position, index).applyMatrix4(matrix);
		positions[index * 3] = scratch.x;
		positions[index * 3 + 1] = scratch.y;
		positions[index * 3 + 2] = scratch.z;
		box.expandByPoint(scratch);
	}
	const index = mesh.geometry.getIndex();
	return { positions, index: index === null ? null : index.array };
}

/**
 * The selection as the ghost rule sees it, or null when nothing is drawn.
 *
 * A mesh whose CPU positions do not describe what is drawn (skinned, morph-targeted
 * or instanced) is marked `approximate`, so the classifier falls back to bounds and
 * errs toward drawing the ghost (§2.4's conservative rule).
 */
export function ghostSubjectOf(objects: readonly Object3D[]): SliceGhostSubject | null {
	const meshes = drawnMeshesOf(objects);
	if (meshes.length === 0) return null;
	const box = new Box3();
	const triangles: SliceTriangleBuffer[] = [];
	let approximate = false;
	for (const mesh of meshes) {
		// A skinned body has driven vertices the CPU positions do not follow, and an
		// instanced mesh draws more copies than its buffer holds: both fall back to
		// the bounds rule, which errs toward drawing the ghost.
		const drawnElsewhere = mesh as Mesh & { isSkinnedMesh?: boolean; isInstancedMesh?: boolean };
		if (drawnElsewhere.isSkinnedMesh === true || drawnElsewhere.isInstancedMesh === true) {
			approximate = true;
			// Its CPU positions do not follow the drawn body, but its world AABB does: the
			// bounds rule needs one, and without it a subject made only of driven meshes
			// resolved to null and never ghosted (§2.4's conservative fallback).
			box.expandByObject(mesh);
			continue;
		}
		// `BufferGeometry.morphAttributes` is always an object; only a non-empty one
		// means the drawn shape differs from the CPU positions.
		const morph = (mesh.geometry as { morphAttributes?: Record<string, unknown> }).morphAttributes;
		if (morph !== undefined && Object.keys(morph).length > 0) approximate = true;
		const buffer = trianglesOf(mesh, box);
		if (buffer !== null) triangles.push(buffer);
	}
	const bounds = box.isEmpty() ? null : { min: box.min.toArray(), max: box.max.toArray() };
	// Nothing to test and nothing to bound: no body to ghost. An approximate subject
	// with bounds **is** a subject the bounds rule can decide.
	if (triangles.length === 0 && (bounds === null || approximate !== true)) return null;
	const min = bounds === null ? [0, 0, 0] : [...(bounds.min as [number, number, number])];
	const max = bounds === null ? [0, 0, 0] : [...(bounds.max as [number, number, number])];
	return {
		triangles,
		bounds: bounds === null ? null : { min: min as [number, number, number], max: max as [number, number, number] },
		approximate
	};
}

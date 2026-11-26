/**
 * Derived Scene contact over an authored floor-region top.
 *
 * OD-4 needs one read-only number before a floor-region move or Erase: how many
 * Scene roots currently rest on that region's upward witness. This is a query,
 * never an attachment and never a Scene write — region edits stay Layout-only,
 * and the count follows the accepted baseline on demand.
 *
 * A root counts once when its contact point (its world X/Z) and its base height
 * resolve to a support candidate that carries this region as a witness at that
 * height. A coincident Room floor is another witness on the same candidate, so
 * it does not add a second count. A lifted root's base is above the support and
 * does not count; an overhead region always counts zero.
 */
import {
	FLOOR_SUPPORT_TOLERANCES,
	floorSupportSnapshotOf,
	queryFloorSupports,
} from '@portfolio/layout-core/room';
import type { CompiledLayoutGeometry } from '@portfolio/layout-core/geometry';
import type { SceneEntity, ScenePrimitiveEntity } from '../scene';
import { sceneFormContactMinY } from '../form';

/** The planners' upright tolerance: pitch and roll this close to zero are level. */
const UPRIGHT_TOLERANCE = 1e-9;

/**
 * The contact height a Scene root would rest with, using the planners' own
 * rules: an upright analytic primitive, an evaluable form, or a verified model
 * contact supplied by the caller. Everything else has no floor contact.
 */
export function sceneRootContactMinY(
	entity: SceneEntity,
	modelContactMinY: number | null,
): number | null {
	if (entity.kind === 'light' || entity.kind === 'artwork') return null;
	const rotation = entity.rotation;
	if (
		!Array.isArray(rotation) ||
		rotation.length !== 3 ||
		rotation.some((value) => !Number.isFinite(value)) ||
		Math.abs(rotation[0]) > UPRIGHT_TOLERANCE ||
		Math.abs(rotation[2]) > UPRIGHT_TOLERANCE
	) {
		return null;
	}
	if (entity.kind === 'form') return sceneFormContactMinY(entity.form);
	if (entity.kind === 'model') {
		return typeof modelContactMinY === 'number' && Number.isFinite(modelContactMinY)
			? modelContactMinY
			: null;
	}
	return primitiveContactMinY(entity);
}

function primitiveContactMinY(entity: ScenePrimitiveEntity): number | null {
	switch (entity.primitive) {
		case 'box':
		case 'cylinder':
			return -entity.dimensions.height / 2;
		case 'sphere':
			return -entity.dimensions.radius;
		case 'plane':
			return null;
	}
}

/**
 * Count the Scene roots whose contact and base height resolve to one floor
 * region's upward witness on this accepted snapshot.
 *
 * `generationId` is the snapshot's Scene support generation; the query is
 * qualified by it exactly as placement is. Every root uses its own X/Z, and a
 * root whose support facts are contradictory or unavailable simply does not
 * count — this query never repairs geometry.
 */
export function countSceneRootsOnFloorRegion(input: {
	readonly geometry: CompiledLayoutGeometry;
	readonly generationId: string;
	readonly scene: { readonly entities: readonly SceneEntity[] };
	readonly regionId: string;
	/** Approved model contact, when the host can read the accepted resource. */
	readonly modelContactMinY?: (entity: SceneEntity) => number | null;
}): number {
	const region = input.geometry.regions.find((candidate) => candidate.regionId === input.regionId);
	if (region === undefined || region.role !== 'floor') return 0;
	const snapshot = floorSupportSnapshotOf(input.geometry);
	let count = 0;
	for (const entity of input.scene.entities) {
		const contact = sceneRootContactMinY(entity, input.modelContactMinY?.(entity) ?? null);
		if (contact === null) continue;
		const scale = entityScale(entity);
		const base = entity.position[1] + contact * scale;
		if (!Number.isFinite(base)) continue;
		const queried = queryFloorSupports(snapshot, {
			generationId: input.generationId,
			x: entity.position[0],
			z: entity.position[2],
		});
		if (queried.kind !== 'candidates') continue;
		const supported = queried.candidates.some(
			(candidate) =>
				Math.abs(candidate.elevation - base) <= FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters &&
				candidate.witnesses.some(
					(witness) =>
						witness.source.kind === 'region' && witness.source.regionId === input.regionId,
				),
		);
		if (supported) count += 1;
	}
	return count;
}

function entityScale(entity: SceneEntity): number {
	// Forms carry their per-axis scale in the authored source; their evaluated
	// contact already includes it.
	if (entity.kind === 'form') return 1;
	const scale = (entity as { readonly scale?: number }).scale;
	return typeof scale === 'number' && Number.isFinite(scale) && scale > 0 ? scale : 1;
}

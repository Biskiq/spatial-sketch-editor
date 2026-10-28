/**
 * T5.P01.S01 — native forms on the Plan projection.
 *
 * A form's ring is the evaluated, source-scaled footprint, so the Plan
 * projection must transform it by yaw and translation only. Applying the
 * entity scale again would draw a form larger than its own evaluation, and the
 * Plan hit path would then select space the body does not occupy.
 */
import { describe, expect, it } from 'vitest';
import type { SceneDocument, SceneFormEntity } from '$lib/content/scene';
import { buildPlanSceneFootprintProjection } from '$lib/authoring/scene/plan-scene-footprint';
import { resolvePlanSceneHit } from '$lib/authoring/scene/plan-scene-hit';

function squareForm(overrides: Partial<SceneFormEntity> = {}): SceneFormEntity {
	return {
		kind: 'form',
		id: 'entity-form-1',
		name: 'Drawn table',
		position: [2, 0, 3],
		rotation: [0, 0, 0],
		form: {
			generator: {
				kind: 'extrude',
				plane: 'plan',
				outline: [
					{ key: 1, u: 0, v: 0, smooth: false },
					{ key: 2, u: 1, v: 0, smooth: false },
					{ key: 3, u: 1, v: 1, smooth: false },
					{ key: 4, u: 0, v: 1, smooth: false }
				],
				extent: 0.75
			},
			scale: [1, 1, 1],
			nextKey: 5
		},
		materialId: 'paper-aged',
		castShadow: true,
		receiveShadow: true,
		...overrides
	};
}

function projectionOf(entities: SceneFormEntity[]) {
	return buildPlanSceneFootprintProjection({ entities } as Pick<SceneDocument, 'entities'>);
}

describe('Plan projection of native forms', () => {
	it('projects the evaluated ring at the entity translation', () => {
		const projection = projectionOf([squareForm()]);
		expect(projection.footprints).toHaveLength(1);
		const footprint = projection.footprints[0]!;
		expect(footprint.kind).toBe('form');
		expect(footprint.entityId).toBe('entity-form-1');
		expect(footprint.points.map(([x, z]) => [Number(x.toFixed(6)), Number(z.toFixed(6))])).toEqual([
			[2, 3],
			[3, 3],
			[3, 4],
			[2, 4]
		]);
	});

	it('applies yaw without re-applying the source scale', () => {
		const projection = projectionOf([
			squareForm({
				rotation: [0, Math.PI / 2, 0],
				form: { ...squareForm().form, scale: [2, 1, 1] }
			})
		]);
		const points = projection.footprints[0]!.points.map(
			([x, z]) => [Number(x.toFixed(6)), Number(z.toFixed(6))] as [number, number]
		);
		// The mesh is already 2 m wide in local x; yaw +90° maps that span onto
		// world z (3 → 1). A second application of scale would span 4 m instead.
		expect(points).toEqual([
			[2, 3],
			[2, 1],
			[3, 1],
			[3, 3]
		]);
		const zs = points.map(([, z]) => z);
		expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(2, 6);
	});

	it('hits the drawn body, not a scaled-up rectangle', () => {
		const projection = projectionOf([squareForm()]);
		const inside = resolvePlanSceneHit(projection.footprints, [2.5, 3.5]);
		expect(inside?.entityId).toBe('entity-form-1');
		const outside = resolvePlanSceneHit(projection.footprints, [3.5, 3.5]);
		expect(outside).toBeNull();
	});
});

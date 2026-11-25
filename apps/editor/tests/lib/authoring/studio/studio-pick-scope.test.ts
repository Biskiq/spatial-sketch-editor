import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import type { RuntimeScene } from '@portfolio/project-model/scene';
import { createScenePickSource } from '../../../../src/lib/authoring/scene/scene-pick-source';
import { pickThroughSlice } from '../../../../src/lib/authoring/stage/slice/stage-slice-pick';
import { resolveStagePick } from '../../../../src/lib/authoring/stage/stage-pick';
import { isStudioOperation } from '../../../../src/lib/authoring/studio/studio-model';
import { SCENE_COMPOSE_TASK, SCENE_IMPORT_KIND, SCENE_PLACE_TASK } from '../../../../src/lib/authoring/adapters/scene/scene-task-ids';
import { STAGE_MEASURE_TASK } from '../../../../src/lib/authoring/stage/stage-measure';
import { STAGE_ERASER_TASK } from '../../../../src/lib/authoring/stage/stage-eraser';
import { STAGE_HOST_ADAPTER_ID } from '../../../../src/lib/authoring/stage/stage-contributions';
import { SCOPE_HOST_OWNER, createSubjectScope, scopeAdmitsEntity, scopeAdmitsOperation } from '../../../../src/lib/authoring/stage/subject-scope';
import type { StageAdapterContext, StageDomainPick, StagePickQuery } from '../../../../src/lib/authoring/stage/stage-facade';

function body(x: number): Group {
	const root = new Group();
	root.position.set(x, 0, 0);
	root.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()));
	root.updateMatrixWorld(true);
	return root;
}
const scene = { entities: [{ id: 'near' }, { id: 'far' }], objects: [], textures: [], materials: [] } as unknown as RuntimeScene;
const ray = { origin: [-10, 0, 0] as [number, number, number], direction: [1, 0, 0] as [number, number, number] };

function source() {
	const pick = createScenePickSource();
	pick.setSource(scene);
	pick.register('near', body(-3));
	pick.register('far', body(3));
	return pick;
}

describe('scene pick scope', () => {
	it('is today’s nearest-hit behaviour when unscoped', () => {
		expect(source().pick(ray, scene)?.entityId).toBe('near');
	});
	it('passes the ray through a muted body to the scoped one behind it', () => {
		expect(source().pick(ray, scene, { only: 'far' })?.entityId).toBe('far');
	});
	it('reaches nothing for a null scope or a scoped id that is not in the scene', () => {
		expect(source().pick(ray, scene, { only: null })).toBeNull();
		expect(source().pick(ray, scene, { only: 'gone' })).toBeNull();
	});
	it('carries the scope through pickThroughSlice live, without re-wiring', () => {
		const cell = createSubjectScope();
		const pick = pickThroughSlice(source(), () => null, cell.get);
		expect(pick(ray, scene)?.entityId).toBe('near');
		cell.set({ entityId: 'far' });
		expect(pick(ray, scene)?.entityId).toBe('far');
		cell.set(null);
		expect(pick(ray, scene)?.entityId).toBe('near');
	});
});

describe('arbitration is unchanged by the scope', () => {
	const context = {} as StageAdapterContext;
	const query: StagePickQuery = { css: [0, 0], evaluationId: 'e', purpose: 'select', tool: null };
	const hit = (id: string, depthMeters: number): StageDomainPick => ({
		hit: { sourceId: id, sourceKind: 'entity', reference: { domain: 'scene', subject: { kind: 'entity', id } } as never, worldPoint: [0, 0, 0] },
		depthMeters, planLayer: 1, cssDistance: 0, refusal: null
	});
	it('keeps the nearest winner: domains drop out-of-scope candidates themselves', () => {
		const providers = [
			{ adapterId: 'scene', binding: { pick: () => hit('root', 4) } },
			{ adapterId: 'light', binding: { pick: () => hit('lamp', 2) } }
		];
		expect(resolveStagePick(query, providers, context, '3d')?.adapterId).toBe('light');
		// A domain that scoped itself out answers null; the remaining winner is the root.
		const scoped = [providers[0]!, { adapterId: 'light', binding: { pick: () => null } }];
		expect(resolveStagePick(query, scoped, context, '3d')?.adapterId).toBe('scene');
	});
	it('admits nothing when the scope names no entity', () => {
		expect(scopeAdmitsEntity({ entityId: null }, 'a')).toBe(false);
		expect(scopeAdmitsEntity(null, 'a')).toBe(true);
		expect(scopeAdmitsEntity({ entityId: 'a' }, 'a')).toBe(true);
		expect(scopeAdmitsEntity({ entityId: 'a' }, 'b')).toBe(false);
	});
});

describe('operation scope', () => {
	it('admits everything unscoped or without an operation filter', () => {
		expect(scopeAdmitsOperation(null, 'layout', 'draw-wall')).toBe(true);
		expect(scopeAdmitsOperation({ entityId: 'a' }, 'layout', 'draw-wall')).toBe(true);
	});
	it('offers exactly the Studio operations, spelled as their owners spell them', () => {
		const scope = { entityId: 'a', admitsOperation: isStudioOperation };
		expect(scopeAdmitsOperation(scope, 'scene', SCENE_PLACE_TASK)).toBe(true);
		expect(scopeAdmitsOperation(scope, 'scene', SCENE_COMPOSE_TASK)).toBe(true);
		expect(scopeAdmitsOperation(scope, SCOPE_HOST_OWNER, STAGE_MEASURE_TASK)).toBe(true);
		expect(scopeAdmitsOperation(scope, SCOPE_HOST_OWNER, STAGE_ERASER_TASK)).toBe(true);
		expect(scopeAdmitsOperation(scope, 'scene', SCENE_IMPORT_KIND)).toBe(false);
		expect(scopeAdmitsOperation(scope, 'layout', 'layout-draw-wall')).toBe(false);
		expect(scopeAdmitsOperation(scope, 'light', 'light-place')).toBe(false);
	});
	it('pins the host owner name to the host adapter id', () => {
		expect(SCOPE_HOST_OWNER).toBe(STAGE_HOST_ADAPTER_ID);
	});
});

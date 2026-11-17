import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import type { RuntimeScene } from '@portfolio/project-model';
import { createScenePickSource } from '../../../../src/lib/authoring/scene/scene-pick-source';
import { pickThroughSlice } from '../../../../src/lib/authoring/stage/slice/stage-slice-pick';
import { resolveStagePick } from '../../../../src/lib/authoring/stage/stage-pick';
import { createSubjectScope, scopeAdmitsEntity } from '../../../../src/lib/authoring/stage/subject-scope';
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

describe('arbitration scope', () => {
	const context = {} as StageAdapterContext;
	const query: StagePickQuery = { css: [0, 0], evaluationId: 'e', purpose: 'select', tool: null };
	const hit = (id: string | null): StageDomainPick => ({
		hit: id === null
			? { sourceId: 'wall', sourceKind: 'wall' as never, generationId: 'g', stream: {} as never, subRef: null, worldPoint: [0, 0, 0] }
			: { sourceId: id, sourceKind: 'entity', reference: { domain: 'scene', subject: { kind: 'entity', id } } as never, worldPoint: [0, 0, 0] },
		depthMeters: 1, planLayer: 1, cssDistance: 0, refusal: null
	});
	it('drops winners outside the scoped root, including Layout sources', () => {
		const providers = [
			{ adapterId: 'layout', binding: { pick: () => hit(null) } },
			{ adapterId: 'scene', binding: { pick: () => hit('other') } }
		];
		expect(resolveStagePick(query, providers, context, '3d', null, { entityId: 'root' })).toBeNull();
		const withRoot = [...providers, { adapterId: 'light', binding: { pick: () => hit('root') } }];
		expect(resolveStagePick(query, withRoot, context, '3d', null, { entityId: 'root' })?.adapterId).toBe('light');
		expect(resolveStagePick(query, providers, context, '3d')).not.toBeNull();
	});
	it('admits nothing when the scope names no entity', () => {
		expect(scopeAdmitsEntity({ entityId: null }, 'a')).toBe(false);
		expect(scopeAdmitsEntity(null, 'a')).toBe(true);
	});
});

/**
 * T2.S8 U3 — the colour-coat port over a real unit coordinator: the port
 * allocates exactly the ids the shared plan asks for, one stroke is one Undo,
 * `isAlready` writes nothing, and a model's own materials are skipped by name.
 */
import { describe, expect, it } from 'vitest';
import type { SceneEntity } from '@portfolio/project-model/scene';
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core/wall';
import type { LayoutSurfaceRef } from '@portfolio/layout-core/plan';
import { SCENE_UNIT_FORMAT_VERSION, type ScenePaletteSlot } from '@portfolio/project-model/units';
import { createFinishPlanners } from '@portfolio/project-model/scene-planning';
import { createColourCoatPort } from '$lib/authoring/look/colour-coat-port';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import {
	admitUnitProject,
	createUnitCoordinator,
	createUnitProject,
	unitRevision
} from '../__fixtures__/unit-envelope-fixtures';

const SAGE: ScenePaletteSlot = { id: 'slot-sage', name: 'Sage', color: '#8a9a7b' };
const LABELS: Record<string, string> = { 'wood-walnut': 'Walnut Wood', 'plaster-warm': 'Warm Plaster' };

function box(id: string): SceneEntity {
	return {
		kind: 'primitive', id, name: id, position: [0, 0, 0], rotation: [0, 0, 0], primitive: 'box',
		dimensions: { width: 1, height: 1, depth: 1 }, materialId: 'wood-walnut', castShadow: true, receiveShadow: true
	} as SceneEntity;
}

async function harness() {
	const layout = createEmptyWallFirstLayoutDocument();
	layout.junctions = [{ id: 'a', point: [0, 0] }, { id: 'b', point: [4, 0] }];
	layout.walls = [{ id: 'wall', startJunctionId: 'a', endJunctionId: 'b', thickness: 0.2, height: 3,
	top: { kind: 'level' }, centerline: { kind: 'line' } }];
	const project = await createUnitProject({
		id: 'project-port', name: 'Port', layout,
		scene: { formatVersion: SCENE_UNIT_FORMAT_VERSION, textures: [], materials: [], entities: [box('a'), box('b')], palette: [SAGE] }
	});
	const revision = unitRevision(project.id);
	const admitted = await admitUnitProject(project, revision);
	if (admitted.kind !== 'admitted') throw new Error('fixture not admitted');
	const coordinator = await createUnitCoordinator({
		baseline: { revision, source: admitted.project, canonicalJson: admitted.canonicalJson, sourceContentId: admitted.sourceContentId },
		planners: createFinishPlanners({ labelForMaterial: (id) => LABELS[id] ?? id }),
		mintRevisionId: (ordinal) => `revision-${ordinal + 1}`
	});
	const accepted: { allocations: number }[] = [];
	const services = {
		stage: {
			snapshot: () => {
				const source = coordinator.current().source;
				return {
					acceptedRevision: coordinator.acceptedRevision(),
					domain: {
						scene: source.units.scene.data,
						layoutLevelId: source.units.layout.data.floor.id,
						unitRevisions: { scene: source.units.scene.header.contentRevision, layout: source.units.layout.header.contentRevision }
					}
				};
			}
		},
		authoring: {
			accept: async (intent: Parameters<typeof coordinator.accept>[0]) => {
				accepted.push({ allocations: intent.allocatedIds.length });
				const result = await coordinator.accept(intent);
				return result.kind === 'accepted'
					? { kind: 'installed' as const }
					: { kind: 'refused' as const, code: (result as { code?: string }).code, reason: null, message: (result as { message?: string }).message ?? '' };
			}
		}
	} as unknown as StageAdapterServices;
	const notices: string[] = [];
	const port = createColourCoatPort({
		services: () => services,
		onNotice: (message) => notices.push(message),
		labelForMaterial: (id) => LABELS[id] ?? id
	});
	return { coordinator, port, notices, accepted };
}

describe('T2.S8 U3 — colour-coat port', () => {
	it('paints two objects Sage in one acceptance with one allocated Finish, and Undo reverses it', async () => {
		const { coordinator, port, accepted } = await harness();
		const sage = { kind: 'slot', slotId: SAGE.id } as const;
		expect(port.isAlready({ entityIds: ['a', 'b'], surfaces: [] }, sage)).toBe(false);
		expect(await port.paintEntities(['a', 'b'], sage)).toBe(true);
		expect(accepted).toEqual([{ allocations: 1 }]);
		const scene = coordinator.current().source.units.scene.data;
		expect(scene.materials.map((material) => material.name)).toEqual(['Walnut Wood · Sage']);
		expect(port.isAlready({ entityIds: ['a', 'b'], surfaces: [] }, sage)).toBe(true);
		expect((await coordinator.undo()).kind).toBe('restored');
		expect(coordinator.current().source.units.scene.data.materials).toEqual([]);
	});

	it('coats an unassigned wall side over plaster and reuses it for the other side', async () => {
		const { coordinator, port, accepted } = await harness();
		const left: LayoutSurfaceRef = { kind: 'wall-side', wallId: 'wall', side: 'left' };
		const right: LayoutSurfaceRef = { kind: 'wall-side', wallId: 'wall', side: 'right' };
		const sage = { kind: 'slot', slotId: SAGE.id } as const;
		expect(port.read({ surface: left })).toEqual({ kind: 'coat', keeps: 'Warm Plaster' });
		expect(await port.paintSurfaces([left], sage)).toBe(true);
		expect(await port.paintSurfaces([right], sage)).toBe(true);
		expect(accepted).toEqual([{ allocations: 1 }, { allocations: 0 }]);
		expect(coordinator.current().source.units.scene.data.materials).toHaveLength(1);
	});
});

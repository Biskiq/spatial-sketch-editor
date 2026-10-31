import { describe, expect, it } from 'vitest';
import { stageLayout, stageScene } from '$lib/authoring/stage/unit-stage-source';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { buildS17MixedProject } from './__fixtures__/s17-mixed-project';
import { planMoveHorizontal, planPlaceOnFloor, planSetYaw, planDuplicateOne } from '@portfolio/project-model/scene-planning';

describe('R217.S17 mixed project fixture', () => {
	it('retains the tilted form refusals without changing its authored source', async () => {
		const { project, ids } = await buildS17MixedProject();
		const admitted = await admitSource(project, { sessionEpoch: 's17-tilted-refusal', acceptedRevision: project.acceptedRevision });
		if (admitted.kind !== 'admitted') throw new Error('S17 fixture was refused');
		const context = { layout: stageLayout(admitted.snapshot), scene: stageScene(admitted.snapshot), sourceContentId: admitted.snapshot.sourceContentId };
		const before = structuredClone(context.scene);
		const target = { context, entityId: ids.tiltedFormId, contactMinY: 0 };
		const frame = { origin: [0, 0, 0] as const, yaw: 0 };
		const results = [
			planMoveHorizontal({ ...target, worldXZ: [1, 1], frame }),
			planPlaceOnFloor({ ...target, worldXZ: [1, 1], frame }),
			planSetYaw({ ...target, yaw: 0.5, frame }),
			planDuplicateOne({ ...target, newEntityId: 's17-tilted-copy' })
		];
		for (const result of results) expect(result).toMatchObject({ kind: 'rejected', code: 'unsupported-transform' });
		expect(context.scene).toEqual(before);
	});

	it('admits the planned room, Layout subjects, Scene objects and native forms through Stage', async () => {
		const { project, ids } = await buildS17MixedProject();
		const admitted = await admitSource(project, {
			sessionEpoch: 's17-mixed-project-admission',
			acceptedRevision: project.acceptedRevision
		});
		expect(admitted.kind).toBe('admitted');
		if (admitted.kind !== 'admitted') throw new Error(`S17 fixture was refused: ${admitted.kind}`);

		const layout = stageLayout(admitted.snapshot);
		const scene = stageScene(admitted.snapshot);
		expect(layout.rooms.map((room) => room.id)).toContain(ids.roomId);
		expect(layout.openings.map((opening) => opening.id)).toEqual([ids.doorId, ids.windowId]);
		expect(layout.objects.map((object) => object.id)).toContain(ids.plinthId);
		expect(layout.walls.find((wall) => wall.id === ids.lowWallId)?.height).toBe(0.9);
		expect(scene.entities.map((entity) => entity.id)).toEqual([
			ids.tableId,
			ids.nativeBoxId,
			ids.catalogueModelId,
			ids.unapprovedModelId,
			ids.approvedModelId,
			ids.rectangularFormId,
			ids.concaveFormId,
			ids.tiltedFormId
		]);
		expect(scene.entities.find((entity) => entity.id === ids.approvedModelId)?.kind).toBe('model');
		const forms = scene.entities.filter((entity) => entity.kind === 'form');
		expect(forms).toHaveLength(3);
		expect(new Set(forms.map((entity) => entity.position.join(','))).size).toBe(3);
	});
});

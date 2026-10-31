import { describe, expect, it } from 'vitest';
import { stageLayout, stageScene } from '$lib/authoring/stage/unit-stage-source';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { buildS17MixedProject } from './__fixtures__/s17-mixed-project';

describe('R217.S17 mixed project fixture', () => {
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

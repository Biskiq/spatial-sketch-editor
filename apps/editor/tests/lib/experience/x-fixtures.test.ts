/**
 * R217.S26 §4 — the x-fixtures are built by the real Experience planners and admitted.
 *
 * They serve the S26–S30 writer's tests and the owner's manual journeys, so their shape
 * is pinned here: what each contains, and that each is an admitted envelope.
 */
import { describe, expect, it } from 'vitest';
import { validateProjectEnvelope, serializeProjectEnvelope } from '@portfolio/project-model/units';
import { buildXFixture } from './__fixtures__/x-fixtures';

function experienceOf(project: Awaited<ReturnType<typeof buildXFixture>>['project']) {
	return project.units.experience.data.experiences[0]!;
}

describe('R217.S26 x-fixtures', () => {
	it('x-empty: a Layout room, one Scene object, no Experience', async () => {
		const { project } = await buildXFixture('x-empty');
		expect(project.units.layout.data.rooms).toHaveLength(1);
		expect(project.units.scene.data.entities.map((entity) => entity.id)).toEqual(['x-pleyel-piano']);
		expect(project.units.experience.data.experiences).toEqual([]);
		expect(validateProjectEnvelope(JSON.parse(serializeProjectEnvelope(project))).success).toBe(true);
	});

	it('x-salon: five Presentations, one about the object, one shared View, a six-Stop Guide', async () => {
		const { project, ids } = await buildXFixture('x-salon');
		const experience = experienceOf(project);
		expect(experience.presentations).toHaveLength(5);
		expect(experience.presentations.filter((entry) => entry.subject !== null).map((entry) => entry.subject?.subject.id)).toEqual([
			'x-pleyel-piano'
		]);
		const listing = experience.presentations.filter((entry) => entry.viewIds.includes(ids.sharedViewId!));
		expect(listing.map((entry) => entry.id)).toEqual(['x-door', 'x-wall']);
		const guide = experience.guides[0]!;
		expect(experience.entryGuideId).toBe(guide.id);
		expect(guide.stopIds).toEqual(ids.stopIds);
		const stops = guide.stopIds.map((stopId) => experience.stops.find((stop) => stop.id === stopId)!);
		expect(stops.map((stop) => stop.presentationId)).toEqual(['x-piano', 'x-window', 'x-door', 'x-piano', 'x-corner', 'x-wall']);
		// The hold-less Stop and the nonadjacent continuation.
		expect(stops.map((stop) => stop.holdSeconds ?? null)).toEqual([4, null, 4, 4, 4, 4]);
		expect(stops[0]!.continuation).toEqual({ kind: 'stop', stopId: ids.stopIds[4], transition: 'cut' });
	});

	it('x-long: the salon world with a 30-Stop Guide', async () => {
		const { project } = await buildXFixture('x-long');
		const experience = experienceOf(project);
		expect(experience.presentations).toHaveLength(5);
		expect(experience.guides[0]!.stopIds).toHaveLength(30);
	});

	it('x-dense: a 50-View Presentation among 40 Presentations', async () => {
		const { project } = await buildXFixture('x-dense');
		const experience = experienceOf(project);
		expect(experience.presentations).toHaveLength(40);
		expect(experience.presentations[0]!.viewIds).toHaveLength(50);
		expect(experience.guides).toEqual([]);
	});
});

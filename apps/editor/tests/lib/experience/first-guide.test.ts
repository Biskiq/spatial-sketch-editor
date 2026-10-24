/**
 * T3.P02.S02 — the first Guide operation and the capture-side first Guide.
 *
 * Behavioral proof for the slice's new F4 Experience operation: one accepted
 * result, one undo payload, explicit entry Guide, a fresh Stop identity that
 * copies no Camera pose/FOV and manufactures no Connection, and refusals that
 * write nothing. Guide membership stays optional for other Presentations.
 */
import { describe, expect, it } from 'vitest';

import { createAcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import {
	captureBindIntent,
	capturedViewPose,
	guideCreateIntent,
	stopCreateIntent
} from '$lib/authoring/experience/commands';
import {
	EXPERIENCE_UNIT_FORMAT_VERSION,
	computeEnvelopeSourceContentId,
	createUnitAcceptanceProfile,
	serializeProjectEnvelope,
	type ExperienceUnitPayload,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

import { EXPERIENCE, VIEWS, experienceEnvelope } from './fixtures';

/** An Experience that has Presentations but carries no Guide and no Stop. */
const GUIDE_FREE: ExperienceUnitPayload = {
	formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
	experiences: [
		{
			...EXPERIENCE.experiences[0]!,
			entryGuideId: null,
			stops: [],
			guides: []
		}
	]
};

async function boot(payload: ExperienceUnitPayload = GUIDE_FREE): Promise<{
	readonly source: ProjectEnvelope;
	readonly coordinator: ReturnType<typeof createAcceptanceCoordinator<ProjectEnvelope>>;
}> {
	const source = await experienceEnvelope({ experience: payload });
	const profile = createUnitAcceptanceProfile({ compound: true, sessionEpoch: 'session-first-guide' });
	const coordinator = createAcceptanceCoordinator<ProjectEnvelope>({
		adapter: profile.adapter,
		sessionEpoch: 'session-first-guide',
		baseline: {
			revision: source.acceptedRevision,
			source,
			canonicalJson: serializeProjectEnvelope(source),
			sourceContentId: await computeEnvelopeSourceContentId(source)
		},
		mintRevisionId: (ordinal) => `revision-${ordinal + 1}`,
		preparation: { registry: profile.registry, prepare: profile.prepare }
	});
	return { source, coordinator };
}

function experienceOf(envelope: ProjectEnvelope) {
	return envelope.units.experience.data.experiences[0]!;
}

describe('first Guide creation', () => {
	it('creates the first Guide and its initial Stop as one accepted result', async () => {
		const { source, coordinator } = await boot();
		const accepted = await coordinator.accept(
			guideCreateIntent({
				envelope: source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-guide', guide: 'guide-new', stop: 'stop-new' },
				experienceId: 'experience-1',
				presentationId: 'presentation-1',
				label: 'Main',
				entryViewId: null,
				holdSeconds: null,
				continuation: { kind: 'sequence-next', transition: 'cut' }
			})
		);
		expect(accepted.kind).toBe('accepted');
		if (accepted.kind !== 'accepted') return;
		expect(accepted.undoResult).toMatchObject({ kind: 'undoable' });
		expect(coordinator.history().depth).toBe(2);

		const installed = coordinator.acceptedSnapshot().domain.source;
		const experience = experienceOf(installed);
		// The first Guide is named the Experience's entry Guide explicitly.
		expect(experience.entryGuideId).toBe('guide-new');
		expect(experience.guides).toEqual([
			{ id: 'guide-new', label: 'Main', stopIds: ['stop-new'], entryStopId: 'stop-new' }
		]);
		// A fresh Stop identity that enters the Presentation's own Default View and
		// copies no Camera truth: the Camera unit is untouched.
		expect(experience.stops).toEqual([
			{ id: 'stop-new', presentationId: 'presentation-1', continuation: { kind: 'sequence-next', transition: 'cut' } }
		]);
		expect(installed.units.camera.data.views).toEqual(VIEWS);
		expect(installed.units.camera.data.connections).toEqual(source.units.camera.data.connections);

		// One undo payload restores the prior entry Guide (none) and both new units.
		const undone = await coordinator.undo();
		expect(undone.kind).toBe('restored');
		const restored = experienceOf(coordinator.acceptedSnapshot().domain.source);
		expect(restored.entryGuideId).toBeNull();
		expect(restored.guides).toEqual([]);
		expect(restored.stops).toEqual([]);

		// Redo replays the captured identities rather than minting new ones.
		const redone = await coordinator.redo();
		expect(redone.kind).toBe('restored');
		const replayed = experienceOf(coordinator.acceptedSnapshot().domain.source);
		expect(replayed.entryGuideId).toBe('guide-new');
		expect(replayed.guides[0]!.stopIds).toEqual(['stop-new']);
	});

	it('captures a View, Presentation, first Guide and Stop in one accepted install', async () => {
		const { source, coordinator } = await boot();
		const accepted = await coordinator.accept(
			captureBindIntent({
				envelope: source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-capture', view: 'view-new', presentation: 'presentation-new', stop: 'stop-new', guide: 'guide-new' },
				experienceId: 'experience-1',
				view: capturedViewPose({ label: 'View 3', eye: [1, 1.5, 3], target: [0, 1.4, 0], fov: 54 }),
				presentationLabel: 'Entrance',
				subjectEntityId: null,
				text: null,
				guideId: null,
				firstGuideLabel: 'Entrance walk',
				afterStopId: null
			})
		);
		expect(accepted.kind).toBe('accepted');
		if (accepted.kind !== 'accepted') return;
		// View + Presentation + Guide + Stop are one accepted install with one undo.
		expect(accepted.undoResult).toMatchObject({ kind: 'undoable' });
		expect(coordinator.history().depth).toBe(2);

		const installed = coordinator.acceptedSnapshot().domain.source;
		const experience = experienceOf(installed);
		expect(experience.entryGuideId).toBe('guide-new');
		expect(experience.guides).toEqual([
			{ id: 'guide-new', label: 'Entrance walk', stopIds: ['stop-new'], entryStopId: 'stop-new' }
		]);
		expect(experience.stops[0]).toMatchObject({ id: 'stop-new', presentationId: 'presentation-new' });
		expect(installed.units.camera.data.views.map((view) => view.id)).toEqual(['view-1', 'view-2', 'view-new']);

		const undone = await coordinator.undo();
		expect(undone.kind).toBe('restored');
		const restored = coordinator.acceptedSnapshot().domain.source;
		expect(experienceOf(restored).guides).toEqual([]);
		expect(experienceOf(restored).entryGuideId).toBeNull();
		expect(restored.units.camera.data.views.map((view) => view.id)).toEqual(['view-1', 'view-2']);
	});

	it('refuses a second Guide and writes no history', async () => {
		const { source, coordinator } = await boot();
		const first = await coordinator.accept(
			guideCreateIntent({
				envelope: source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-guide-1', guide: 'guide-1-new', stop: 'stop-1-new' },
				experienceId: 'experience-1',
				presentationId: 'presentation-1',
				label: 'Main',
				entryViewId: null,
				holdSeconds: null,
				continuation: null
			})
		);
		expect(first.kind).toBe('accepted');
		const depth = coordinator.history().depth;

		const second = await coordinator.accept(
			guideCreateIntent({
				envelope: coordinator.acceptedSnapshot().domain.source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-guide-2', guide: 'guide-2-new', stop: 'stop-2-new' },
				experienceId: 'experience-1',
				presentationId: 'presentation-2',
				label: 'Second',
				entryViewId: null,
				holdSeconds: null,
				continuation: null
			})
		);
		// `planner-rejected` is the coordinator's code for a planner refusal; the
		// planner's own reason stays legible beside it.
		expect(second).toMatchObject({ kind: 'rejected', code: 'planner-rejected', reason: 'guide-exists' });
		expect(coordinator.history().depth).toBe(depth);
		expect(experienceOf(coordinator.acceptedSnapshot().domain.source).guides).toHaveLength(1);
	});

	it('refuses a Presentation with no Default View and a duplicate captured identity', async () => {
		const { source, coordinator } = await boot({
			formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
			experiences: [
				{
					...GUIDE_FREE.experiences[0]!,
					presentations: [
						...GUIDE_FREE.experiences[0]!.presentations,
						{
							id: 'presentation-no-default',
							label: 'Study',
							viewIds: ['view-1'],
							defaultViewId: null,
							subject: null,
							text: null
						}
					]
				}
			]
		});
		const noEntry = await coordinator.accept(
			guideCreateIntent({
				envelope: source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-guide', guide: 'guide-new', stop: 'stop-new' },
				experienceId: 'experience-1',
				presentationId: 'presentation-no-default',
				label: 'Main',
				entryViewId: null,
				holdSeconds: null,
				continuation: null
			})
		);
		expect(noEntry).toMatchObject({ kind: 'rejected', code: 'planner-rejected', reason: 'missing-entry' });
		expect(coordinator.history().depth).toBe(1);

		const duplicate = await coordinator.accept(
			guideCreateIntent({
				envelope: source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-guide-2', guide: 'view-1', stop: 'stop-new' },
				experienceId: 'experience-1',
				presentationId: 'presentation-1',
				label: 'Main',
				entryViewId: null,
				holdSeconds: null,
				continuation: null
			})
		);
		expect(duplicate).toMatchObject({ kind: 'rejected', code: 'planner-rejected', reason: 'duplicate-identity' });
		expect(coordinator.history().depth).toBe(1);
	});

	it('refuses a Stop that names neither an existing Guide nor the first Guide', async () => {
		const { source, coordinator } = await boot();
		// The command builder never produces this shape (a Guide-free capture sends no
		// Stop), so the refusal is probed at the planner with its payload tampered: a
		// Stop no order reaches would install and never be enterable.
		const guideFree = captureBindIntent({
			envelope: source,
			revision: coordinator.acceptedRevision(),
			ids: { operation: 'op-capture', view: 'view-new', presentation: 'presentation-new', stop: 'stop-orphan' },
			experienceId: 'experience-1',
			view: capturedViewPose({ label: 'View 3', eye: [1, 1.5, 3], target: [0, 1.4, 0], fov: 54 }),
			presentationLabel: 'Entrance',
			subjectEntityId: null,
			text: null,
			guideId: null,
			afterStopId: null
		});
		const orphan: typeof guideFree = {
			...guideFree,
			payload: {
				...(guideFree.payload as Record<string, unknown>),
				stop: { guideId: null, afterStopId: null, continuation: { kind: 'sequence-next', transition: 'cut' } }
			} as typeof guideFree.payload,
			allocatedIds: [...guideFree.allocatedIds, { kind: 'stop', id: 'stop-orphan' }]
		};
		const refused = await coordinator.accept(orphan);
		expect(refused).toMatchObject({ kind: 'rejected', code: 'planner-rejected', reason: 'missing-target' });
		expect(coordinator.history().depth).toBe(1);
	});

	it('keeps a Guide-free capture Guide-free', async () => {
		const { source, coordinator } = await boot();
		const accepted = await coordinator.accept(
			captureBindIntent({
				envelope: source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-capture', view: 'view-new', presentation: 'presentation-new', stop: 'stop-unused' },
				experienceId: 'experience-1',
				view: capturedViewPose({ label: 'View 3', eye: [1, 1.5, 3], target: [0, 1.4, 0], fov: 54 }),
				presentationLabel: 'Entrance',
				subjectEntityId: null,
				text: null,
				guideId: null,
				afterStopId: null
			})
		);
		expect(accepted.kind).toBe('accepted');
		const experience = experienceOf(coordinator.acceptedSnapshot().domain.source);
		// Archive-free: no Guide, no Stop, no entry Guide is inferred.
		expect(experience.guides).toEqual([]);
		expect(experience.stops).toEqual([]);
		expect(experience.entryGuideId).toBeNull();
	});

	it('reuses one Presentation at a second Stop with a fresh identity and no Camera copy', async () => {
		const { source, coordinator } = await boot();
		await coordinator.accept(
			guideCreateIntent({
				envelope: source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-guide', guide: 'guide-new', stop: 'stop-1-new' },
				experienceId: 'experience-1',
				presentationId: 'presentation-1',
				label: 'Main',
				entryViewId: null,
				holdSeconds: null,
				continuation: { kind: 'sequence-next', transition: 'cut' }
			})
		);
		const beforeReuse = coordinator.acceptedSnapshot().domain.source;
		const accepted = await coordinator.accept(
			stopCreateIntent({
				envelope: beforeReuse,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-stop', stop: 'stop-2-new' },
				experienceId: 'experience-1',
				presentationId: 'presentation-1',
				guideId: 'guide-new',
				afterStopId: 'stop-1-new',
				entryViewId: null,
				holdSeconds: 2,
				continuation: { kind: 'end' }
			})
		);
		expect(accepted.kind).toBe('accepted');
		const installed = coordinator.acceptedSnapshot().domain.source;
		const experience = experienceOf(installed);
		// Distinct Stop identities over one Presentation: occurrence-local holds and
		// roles, one authoritative Guide order.
		expect(experience.stops.map((stop) => stop.id)).toEqual(['stop-1-new', 'stop-2-new']);
		expect(experience.stops[1]).toMatchObject({ presentationId: 'presentation-1', holdSeconds: 2 });
		expect(experience.guides[0]!.stopIds).toEqual(['stop-1-new', 'stop-2-new']);
		expect(experience.presentations.filter((entry) => entry.id === 'presentation-1')).toHaveLength(1);
		// Reuse copies no Camera truth and manufactures no Connection.
		expect(installed.units.camera.data.views).toEqual(beforeReuse.units.camera.data.views);
		expect(installed.units.camera.data.connections).toEqual(beforeReuse.units.camera.data.connections);
	});
});

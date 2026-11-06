/**
 * R217.S29 — slice 3's property: every accepted Experience edit reconciles Travel.
 *
 * A seeded sequence of reorders, inserts, entry changes, View reorders and a
 * removal runs over an Experience with Guide Travels, a repeated Presentation and
 * a Detour. Each accepted change lowers without `travel-gap`, `travel-same-view`,
 * `travel-after-last` or `stop-guide-membership`, and one Undo restores the exact
 * envelope. R1/R2 (reorder joins or reuses a path), R5/R6 (insert), R7 (Enter at),
 * R8 (Default reorder) and R9 (removal) are the cases the sequence exercises.
 */
import { describe, expect, it } from 'vitest';

import { createAcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import {
	guideOrderIntent,
	presentationUpdateIntent,
	removeIntent,
	stopCreateIntent,
	stopUpdateIntent
} from '$lib/authoring/experience/commands';
import {
	EXPERIENCE_UNIT_FORMAT_VERSION,
	computeEnvelopeSourceContentId,
	createUnitAcceptanceProfile,
	lowerExperienceProgram,
	serializeProjectEnvelope,
	type Experience,
	type ExperienceUnitPayload,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

import { experienceEnvelope } from './fixtures';

const PROPERTY: ExperienceUnitPayload = {
	formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
	experiences: [
		{
			id: 'prop-experience',
			label: 'Property tour',
			welcome: null,
			entryGuideId: 'prop-guide',
			presentations: [
				{
					id: 'prop-p1',
					label: 'Piano',
					views: [{ viewId: 'view-1', transition: 'travel' }, { viewId: 'view-2' }],
					explorable: true,
					subject: null,
					text: null
				},
				{ id: 'prop-p2', label: 'Gallery', views: [{ viewId: 'view-2' }], explorable: false, subject: null, text: null },
				{ id: 'prop-p3', label: 'Corner', views: [{ viewId: 'view-1' }], explorable: false, subject: null, text: null }
			],
			stops: [
				{ id: 'prop-s1', presentationId: 'prop-p1', entryViewId: null, staySeconds: 2, invitation: null, transition: 'travel' },
				{ id: 'prop-s2', presentationId: 'prop-p2', entryViewId: null, staySeconds: 2, invitation: null, transition: 'cut' },
				{ id: 'prop-s3', presentationId: 'prop-p3', entryViewId: null, staySeconds: 2, invitation: null, transition: 'cut' },
				{ id: 'prop-s4', presentationId: 'prop-p1', entryViewId: 'view-2', staySeconds: 2, invitation: null, transition: 'cut' }
			],
			guides: [{ id: 'prop-guide', label: 'Tour', stopIds: ['prop-s1', 'prop-s2', 'prop-s3', 'prop-s4'], pacing: 'automatic' }],
			detours: [{ id: 'prop-detour', fromStopId: 'prop-s1', toStopId: 'prop-s2', returnToStopId: 'prop-s1' }]
		}
	]
};

async function boot(source: ProjectEnvelope) {
	const profile = createUnitAcceptanceProfile({ compound: true, sessionEpoch: 'session-property' });
	const coordinator = createAcceptanceCoordinator<ProjectEnvelope>({
		adapter: profile.adapter,
		sessionEpoch: 'session-property',
		baseline: {
			revision: source.acceptedRevision,
			source,
			canonicalJson: serializeProjectEnvelope(source),
			sourceContentId: await computeEnvelopeSourceContentId(source)
		},
		mintRevisionId: (ordinal) => `property-revision-${ordinal + 1}`,
		preparation: { registry: profile.registry, prepare: profile.prepare }
	});
	const now = () => coordinator.acceptedSnapshot().domain.source;
	return {
		coordinator,
		now,
		experience: (): Experience => now().units.experience.data.experiences[0]!,
		revision: () => coordinator.acceptedRevision()
	};
}

describe('R1–R12 — every accepted edit reconciles Travel', () => {
	it('joins or reuses every Travel pair, lowers cleanly and Undo restores the envelope', async () => {
		const source = await experienceEnvelope({ experience: PROPERTY });
		const s = await boot(source);
		const c = s.coordinator;
		let seed = 7;
		const random = () => {
			seed = (seed * 1664525 + 1013904223) % 4294967296;
			return seed / 4294967296;
		};
		let ids = 0;
		const id = (label: string) => `prop-${label}-${(ids += 1)}`;
		// fix.md 'Captured ids': one id per Travel use, plus one.
		const pool = () => {
			const experience = s.experience();
			const travels =
				experience.stops.filter((stop) => stop.transition === 'travel').length +
				experience.presentations.reduce(
					(total, presentation) => total + presentation.views.filter((view) => view.transition === 'travel').length,
					0
				);
			return Array.from({ length: travels + 1 }, () => id('connection'));
		};
		const lowering = async () => {
			const project = s.now();
			return lowerExperienceProgram(project, {
				experienceId: 'prop-experience',
				guideId: 'prop-guide',
				sourceContentId: await computeEnvelopeSourceContentId(project),
				sessionEpoch: 'property'
			});
		};

		let insertedStopId: string | null = null;
		for (let step = 0; step < 8; step += 1) {
			const before = serializeProjectEnvelope(s.now());
			const experience = s.experience();
			const guide = experience.guides[0]!;
			const accepted =
				step === 0
					? await c.accept(
							stopCreateIntent({
								envelope: s.now(),
								revision: s.revision(),
								ids: { operation: id('op'), stop: (insertedStopId = id('stop')), connections: pool() },
								experienceId: 'prop-experience',
								presentationId: 'prop-p2',
								guideId: 'prop-guide',
								afterStopId: 'prop-s1',
								entryViewId: null,
								staySeconds: null,
								transition: 'cut'
							})
						)
					: step === 7
						? await c.accept(
								removeIntent({
									envelope: s.now(),
									revision: s.revision(),
									ids: { operation: id('op'), connections: pool() },
									experienceId: 'prop-experience',
									subject: 'stop',
									id: 'prop-s4'
								})
							)
						: random() < 1 / 3
							? await c.accept(
									guideOrderIntent({
										envelope: s.now(),
										revision: s.revision(),
										ids: { operation: id('op'), connections: pool() },
										experienceId: 'prop-experience',
										guideId: 'prop-guide',
										stopIds: [...guide.stopIds.slice(1), guide.stopIds[0]!]
									})
								)
							: random() < 1 / 2
								? await c.accept(
										stopUpdateIntent({
											envelope: s.now(),
											revision: s.revision(),
											ids: { operation: id('op'), connections: pool() },
											experienceId: 'prop-experience',
											stopId: 'prop-s1',
											entryViewId: experience.stops.find((stop) => stop.id === 'prop-s1')!.entryViewId === null ? 'view-2' : null
										})
									)
								: await c.accept(
										presentationUpdateIntent({
											envelope: s.now(),
											revision: s.revision(),
											ids: { operation: id('op'), connections: pool() },
											experienceId: 'prop-experience',
											presentationId: 'prop-p1',
											views: [...experience.presentations.find((presentation) => presentation.id === 'prop-p1')!.views]
												.reverse()
												.map((view, index, all) => (index === all.length - 1 ? { viewId: view.viewId } : view))
										})
									);
			expect(accepted.kind, `step ${step}: ${JSON.stringify(accepted)}`).toBe('accepted');
			const lowered = await lowering();
			expect(lowered, `step ${step}`).toMatchObject({ kind: 'lowered' });
			expect(await c.undo()).toMatchObject({ kind: 'restored' });
			expect(serializeProjectEnvelope(s.now()), `step ${step} undo`).toBe(before);
		}
		// The fixture keeps its Detour and its repeated Presentation throughout.
		expect(s.experience().detours).toHaveLength(1);
		expect(s.experience().stops.filter((stop) => stop.presentationId === 'prop-p1')).toHaveLength(2);
	});
});

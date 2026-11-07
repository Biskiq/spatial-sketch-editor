/**
 * R217.S29 — slice 3's property: every accepted Experience edit reconciles Travel.
 *
 * Twenty seeded sequences of reorders, inserts, entry changes, View reorders and
 * removals run over an Experience with Guide Travels, a repeated Presentation and
 * a Detour. Each accepted change lowers without `travel-gap`, `travel-same-view`,
 * `travel-after-last` or `stop-guide-membership`. Undo restores the exact envelope
 * after every sampled step, and Redo restores the accepted one so the sequence
 * keeps accumulating. One removal takes the Detour with its Stop (R29).
 * R1/R2 (reorder joins or reuses a path), R5/R6 (insert), R7 (Enter at), R8
 * (Default reorder) and R9 (removal) are the cases the sequences exercise.
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
	it('joins or reuses every Travel pair, lowers cleanly, and Undo/Redo are exact', async () => {
		const source = await experienceEnvelope({ experience: PROPERTY });
		let ids = 0;
		const id = (label: string) => `prop-${label}-${(ids += 1)}`;
		for (let seedIndex = 0; seedIndex < 20; seedIndex += 1) {
			const s = await boot(source);
			const c = s.coordinator;
			let seed = seedIndex + 1;
			const random = () => {
				seed = (seed * 1664525 + 1013904223) % 4294967296;
				return seed / 4294967296;
			};
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

			let detourTaken = false;
			for (let step = 0; step < 30; step += 1) {
				const before = serializeProjectEnvelope(s.now());
				const experience = s.experience();
				const guide = experience.guides[0]!;
				const stopOf = (id: string) => experience.stops.find((stop) => stop.id === id)!;
				// Step 4 adds a second Stop to the repeated Presentation before step 5
				// removes the Stop that takes the Detour.
				const choice = step === 5 ? 4 : step === 4 ? 0 : Math.floor(random() * 5);
				const removable = guide.stopIds.filter(
					(stopId) =>
						stopOf(stopId).presentationId !== 'prop-p1' &&
						// Keep both Detour endpoints until its one removal at step 5.
						!(step < 5 && (stopId === 'prop-s1' || stopId === 'prop-s2'))
				);
				let accepted;
				if (choice === 4 && (step === 5 || removable.length > 0)) {
					const stopId = step === 5 ? 'prop-s1' : removable[Math.floor(random() * removable.length)]!;
					if (step === 5) {
						expect(s.experience().detours, `seed ${seedIndex} before detour`).toHaveLength(1);
					}
					accepted = await c.accept(
						removeIntent({
							envelope: s.now(),
							revision: s.revision(),
							ids: { operation: id('op'), connections: pool() },
							experienceId: 'prop-experience',
							subject: 'stop',
							id: stopId
						})
					);
					if (step === 5) {
						detourTaken = true;
						expect(accepted.kind, `seed ${seedIndex} detour: ${JSON.stringify(accepted)}`).toBe('accepted');
						if (accepted.kind === 'accepted') {
							expect(accepted.changes, `seed ${seedIndex} detour change`).toContainEqual({
								kind: 'experience.detour.removed',
								subjectIds: ['prop-detour'],
								fields: []
							});
						}
						expect(s.experience().detours, `seed ${seedIndex} detour`).toEqual([]);
					}
				} else if (choice === 0 || (choice === 4 && removable.length === 0)) {
					const afterStopId = guide.stopIds[Math.floor(random() * guide.stopIds.length)]!;
					accepted = await c.accept(
						stopCreateIntent({
							envelope: s.now(),
							revision: s.revision(),
							ids: { operation: id('op'), stop: id('stop'), connections: pool() },
							experienceId: 'prop-experience',
							presentationId: step === 4 ? 'prop-p1' : 'prop-p2',
							guideId: 'prop-guide',
							afterStopId,
							entryViewId: null,
							staySeconds: null,
							transition: 'cut'
						})
					);
				} else if (choice === 1) {
					accepted = await c.accept(
						guideOrderIntent({
							envelope: s.now(),
							revision: s.revision(),
							ids: { operation: id('op'), connections: pool() },
							experienceId: 'prop-experience',
							guideId: 'prop-guide',
							stopIds: [...guide.stopIds.slice(1), guide.stopIds[0]!]
						})
					);
				} else if (choice === 2) {
					const target = experience.stops.find((stop) => stop.presentationId === 'prop-p1')!;
					const presentation = experience.presentations.find((entry) => entry.id === target.presentationId)!;
					// Name a View that is not the current Default, so normalization does
					// not turn this toggle back into the same Stop (a no-op).
					const alternate = presentation.views.find((view) => view.viewId !== presentation.views[0]!.viewId)!.viewId;
					accepted = await c.accept(
						stopUpdateIntent({
							envelope: s.now(),
							revision: s.revision(),
							ids: { operation: id('op'), connections: pool() },
							experienceId: 'prop-experience',
							stopId: target.id,
							entryViewId: target.entryViewId === alternate ? null : alternate
						})
					);
				} else {
					const views = experience.presentations.find((presentation) => presentation.id === 'prop-p1')!.views;
					accepted = await c.accept(
						presentationUpdateIntent({
							envelope: s.now(),
							revision: s.revision(),
							ids: { operation: id('op'), connections: pool() },
							experienceId: 'prop-experience',
							presentationId: 'prop-p1',
							views: [...views]
								.reverse()
								.map((view, index, all) => (index === all.length - 1 ? { viewId: view.viewId } : view))
						})
					);
				}
				expect(
					accepted.kind,
					`seed ${seedIndex} step ${step} choice ${choice} guide ${guide.stopIds.join(',')}: ${JSON.stringify(accepted)}`
				).toBe('accepted');
				const lowered = await lowering();
				expect(lowered, `seed ${seedIndex} step ${step}`).toMatchObject({ kind: 'lowered' });
				if (step % 7 === 0) {
					const after = serializeProjectEnvelope(s.now());
					expect(await c.undo()).toMatchObject({ kind: 'restored' });
					expect(serializeProjectEnvelope(s.now()), `seed ${seedIndex} step ${step} undo`).toBe(before);
					expect(await c.redo()).toMatchObject({ kind: 'restored' });
					expect(serializeProjectEnvelope(s.now()), `seed ${seedIndex} step ${step} redo`).toBe(after);
				}
			}
			expect(detourTaken, `seed ${seedIndex}`).toBe(true);
			// The removal takes its Detour (R29); the repeated Presentation stays.
			expect(s.experience().detours, `seed ${seedIndex}`).toEqual([]);
			expect(s.experience().stops.filter((stop) => stop.presentationId === 'prop-p1')).toHaveLength(2);
		}
	}, 120_000);
});

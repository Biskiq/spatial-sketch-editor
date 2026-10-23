/**
 * T3.P02.S01 — first capture, Cut Guide order and Preview entry.
 *
 * Behavioral proof for the slice's authored operations (one F.4 acceptance port,
 * one history entry each) and for the Head's Preview entry rule. The entry rule
 * is exercised on the shared lowering, so a Preview entry is the same program the
 * visitor executes; no second order or Stop is manufactured here.
 */
import { describe, expect, it } from 'vitest';

import { createAcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import {
	captureBindIntent,
	capturedFovDegrees,
	capturedViewPose,
	guideOrderIntent,
	presentationUpdateIntent,
	stopUpdateIntent
} from '$lib/authoring/experience/commands';
import {
	EMPTY_EXPERIENCE_FOCUS,
	previewEntryFor,
	type ExperienceFocus
} from '$lib/authoring/experience/preview-entry';
import {
	computeEnvelopeSourceContentId,
	createUnitAcceptanceProfile,
	serializeProjectEnvelope,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

import { EXPERIENCE, experienceEnvelope } from './fixtures';

async function boot(): Promise<{
	readonly source: ProjectEnvelope;
	readonly coordinator: ReturnType<typeof createAcceptanceCoordinator<ProjectEnvelope>>;
}> {
	const source = await experienceEnvelope();
	const profile = createUnitAcceptanceProfile({ compound: true, sessionEpoch: 'session-preview' });
	const coordinator = createAcceptanceCoordinator<ProjectEnvelope>({
		adapter: profile.adapter,
		sessionEpoch: 'session-preview',
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

const CAPTURED = capturedViewPose({ label: 'View 3', eye: [1, 1.5, 3], target: [0, 1.4, 0], fov: 54 });

describe('capture, binding and Guide order', () => {
	it('captures a View and binds a Presentation and Stop in one accepted operation', async () => {
		const { source, coordinator } = await boot();
		const accepted = await coordinator.accept(
			captureBindIntent({
				envelope: source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-capture', view: 'view-new', presentation: 'presentation-new', stop: 'stop-new' },
				experienceId: 'experience-1',
				view: CAPTURED,
				presentationLabel: 'Entrance',
				subjectEntityId: null,
				text: { kind: 'plain', body: 'Welcome.' },
				guideId: 'guide-1',
				afterStopId: 'stop-2'
			})
		);
		expect(accepted.kind).toBe('accepted');
		if (accepted.kind !== 'accepted') return;
		expect(accepted.undoResult).toMatchObject({ kind: 'undoable' });
		expect(coordinator.history().depth).toBe(2);

		const installed = coordinator.acceptedSnapshot().domain.source;
		// The capture is a Camera action: the View carries the captured framing and
		// the vertical FOV the caller read from the Stage's evaluated projection,
		// never the viewport aspect.
		expect(installed.units.camera.data.views.find((view) => view.id === 'view-new')).toMatchObject({
			label: 'View 3',
			eye: [1, 1.5, 3],
			target: [0, 1.4, 0],
			fov: 54
		});
		const experience = experienceOf(installed);
		expect(experience.presentations.find((entry) => entry.id === 'presentation-new')).toMatchObject({
			label: 'Entrance',
			viewIds: ['view-new'],
			defaultViewId: 'view-new',
			subject: null,
			text: { kind: 'plain', body: 'Welcome.' }
		});
		const stop = experience.stops.find((entry) => entry.id === 'stop-new');
		expect(stop).toMatchObject({
			presentationId: 'presentation-new',
			continuation: { kind: 'sequence-next', transition: 'cut' }
		});
		// Insertion after stop-2 appends by stable Stop identity, never by array index.
		expect(experience.guides[0]!.stopIds).toEqual(['stop-1', 'stop-2', 'stop-new']);

		// One undo payload restores the whole capture: view, Presentation and Stop.
		const undone = await coordinator.undo();
		expect(undone.kind).toBe('restored');
		const restored = coordinator.acceptedSnapshot().domain.source;
		expect(restored.units.camera.data.views.map((view) => view.id)).toEqual(['view-1', 'view-2']);
		expect(experienceOf(restored).presentations.map((entry) => entry.id)).toEqual([
			'presentation-1',
			'presentation-2'
		]);
		expect(experienceOf(restored).guides[0]!.stopIds).toEqual(['stop-1', 'stop-2']);
	});

	it('reorders a Guide by stable Stop identity without rewriting a Stop', async () => {
		const { source, coordinator } = await boot();
		const accepted = await coordinator.accept(
			guideOrderIntent({
				envelope: source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-order' },
				experienceId: 'experience-1',
				guideId: 'guide-1',
				stopIds: ['stop-2', 'stop-1']
			})
		);
		expect(accepted.kind).toBe('accepted');
		const experience = experienceOf(coordinator.acceptedSnapshot().domain.source);
		expect(experience.guides[0]!.stopIds).toEqual(['stop-2', 'stop-1']);
		// Order is the only thing this operation writes: entry and Stop fields stay
		// exactly as authored.
		expect(experience.guides[0]!.entryStopId).toBe('stop-1');
		expect(experience.stops.map((entry) => entry.id)).toEqual(['stop-1', 'stop-2']);
	});

	it('refuses a Stop entry View that is not one of its Presentation views', async () => {
		const { source, coordinator } = await boot();
		const refused = await coordinator.accept(
			stopUpdateIntent({
				envelope: source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-invalid-entry' },
				experienceId: 'experience-1',
				stopId: 'stop-2',
				entryViewId: 'view-1'
			})
		);
		expect(refused.kind).toBe('rejected');
		expect(coordinator.history().depth).toBe(1);
	});

	it('bounds Presentation text at 4,000 code points and keeps it Presentation-only', async () => {
		const { source, coordinator } = await boot();
		const accepted = await coordinator.accept(
			presentationUpdateIntent({
				envelope: source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-text' },
				experienceId: 'experience-1',
				presentationId: 'presentation-2',
				text: { kind: 'plain', body: 'a'.repeat(4000) }
			})
		);
		expect(accepted.kind).toBe('accepted');
		expect(experienceOf(coordinator.acceptedSnapshot().domain.source).presentations[1]!.text).toEqual({
			kind: 'plain',
			body: 'a'.repeat(4000)
		});

		const refused = await coordinator.accept(
			presentationUpdateIntent({
				envelope: coordinator.acceptedSnapshot().domain.source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-text-long' },
				experienceId: 'experience-1',
				presentationId: 'presentation-2',
				text: { kind: 'plain', body: 'a'.repeat(4001) }
			})
		);
		expect(refused.kind).toBe('rejected');
		expect(coordinator.history().depth).toBe(2);
	});

	it('refuses clearing a Default View a Stop still enters at', async () => {
		const { source, coordinator } = await boot();
		// stop-1 names no entry View, so its own entry is presentation-1's Default.
		const refused = await coordinator.accept(
			presentationUpdateIntent({
				envelope: source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-no-default' },
				experienceId: 'experience-1',
				presentationId: 'presentation-1',
				defaultViewId: null
			})
		);
		expect(refused.kind).toBe('rejected');
		expect(coordinator.history().depth).toBe(1);

		// Giving the Stop its own entry View makes the Default clearable: the run still
		// has a View to arrive at.
		const entry = await coordinator.accept(
			stopUpdateIntent({
				envelope: source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-entry-view' },
				experienceId: 'experience-1',
				stopId: 'stop-1',
				entryViewId: 'view-1'
			})
		);
		expect(entry.kind).toBe('accepted');
		const cleared = await coordinator.accept(
			presentationUpdateIntent({
				envelope: coordinator.acceptedSnapshot().domain.source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-no-default' },
				experienceId: 'experience-1',
				presentationId: 'presentation-1',
				defaultViewId: null
			})
		);
		expect(cleared.kind).toBe('accepted');
		expect(experienceOf(coordinator.acceptedSnapshot().domain.source).presentations[0]!.defaultViewId).toBeNull();

		// The mirror holds too: with no Default left, the Stop cannot give up the entry
		// View that is now its only one.
		const orphaned = await coordinator.accept(
			stopUpdateIntent({
				envelope: coordinator.acceptedSnapshot().domain.source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-no-entry' },
				experienceId: 'experience-1',
				stopId: 'stop-1',
				entryViewId: null
			})
		);
		// `planner-rejected` is the coordinator's code for a planner refusal; the
		// planner's own `invalid-payload` stays in `reason`.
		expect(orphaned).toMatchObject({ kind: 'rejected', code: 'planner-rejected', reason: 'invalid-payload' });
		if (orphaned.kind !== 'rejected') return;
		expect(orphaned.message).toContain('would enter at no View');
	});
});

describe('captured field of view', () => {
	it('reads the vertical FOV a perspective projection actually renders', () => {
		const perspective = (fov: number, aspect: number) => {
			const scale = 1 / Math.tan((fov * Math.PI) / 360);
			const matrix = new Array<number>(16).fill(0);
			matrix[0] = scale / aspect;
			matrix[5] = scale;
			matrix[11] = -1;
			return matrix;
		};
		expect(capturedFovDegrees(perspective(54, 1.6))).toBeCloseTo(54, 10);
		expect(capturedFovDegrees(perspective(75, 0.6))).toBeCloseTo(75, 10);
		// The viewport aspect changes only the horizontal scale, never this reading.
		expect(capturedFovDegrees(perspective(54, 0.4))).toBeCloseTo(
			capturedFovDegrees(perspective(54, 2.4)) ?? Number.NaN,
			10
		);
	});

	it('refuses a matrix that carries no finite perspective scale', () => {
		expect(capturedFovDegrees([])).toBeNull();
		expect(capturedFovDegrees([1, 0, 0, 0, 0, 0])).toBeNull();
		expect(capturedFovDegrees([1, 0, 0, 0, 0, Number.NaN])).toBeNull();
	});
});

function focus(overrides: Partial<ExperienceFocus> = {}): ExperienceFocus {
	return { ...EMPTY_EXPERIENCE_FOCUS, experienceId: 'experience-1', ...overrides };
}

function entryFor(
	envelope: ProjectEnvelope,
	selected: Partial<ExperienceFocus> = {},
	epoch = 1
) {
	return previewEntryFor({
		envelope,
		sourceContentId: 'digest-envelope',
		sessionEpoch: 'session-1',
		epoch,
		focus: focus(selected)
	});
}

describe('Preview entry rule', () => {
	it('enters the Experience entry Guide when nothing more specific is open', async () => {
		const envelope = await experienceEnvelope();
		const entry = entryFor(envelope);
		expect(entry.kind).toBe('program');
		if (entry.kind !== 'program') return;
		expect(entry.program.entryStopId).toBe('stop-1');
		expect(entry.entryPresentationId).toBeNull();
		expect(entry.options.runEpoch).toBe(1);
	});

	it('enters the selected Stop of an open Guide', async () => {
		const envelope = await experienceEnvelope();
		const entry = entryFor(envelope, { guideId: 'guide-1', stopId: 'stop-2' });
		expect(entry.kind).toBe('program');
		if (entry.kind !== 'program') return;
		expect(entry.program.entryStopId).toBe('stop-2');
	});

	it('enters a selected Presentation alone when no Guide is open', async () => {
		const envelope = await experienceEnvelope();
		const entry = entryFor(envelope, { presentationId: 'presentation-2' });
		expect(entry.kind).toBe('program');
		if (entry.kind !== 'program') return;
		expect(entry.entryPresentationId).toBe('presentation-2');
		expect(entry.title).toBe('Gallery');
	});

	it('lists enterable Presentations for a Guide-free Experience and explains an unenterable one', async () => {
		const base = EXPERIENCE.experiences[0]!;
		const envelope = await experienceEnvelope({
			experience: {
				...EXPERIENCE,
				experiences: [
					{
						...base,
						entryGuideId: null,
						guides: [],
						stops: [],
						presentations: [
							...base.presentations,
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
			}
		});
		const entry = entryFor(envelope);
		expect(entry.kind).toBe('presentations');
		if (entry.kind !== 'presentations') return;
		expect(entry.presentations.map((presentation) => presentation.id)).toEqual([
			'presentation-1',
			'presentation-2'
		]);
		expect(entry.unavailable).toEqual([
			{
				presentationId: 'presentation-no-default',
				label: 'Study',
				reason: 'No Default View is set, so this Presentation cannot be entered.'
			}
		]);
	});

	it('adopts a lone Experience but never guesses between several', async () => {
		const envelope = await experienceEnvelope();
		const adopted = previewEntryFor({
			envelope,
			sourceContentId: 'digest-envelope',
			sessionEpoch: 'session-1',
			epoch: 1,
			focus: EMPTY_EXPERIENCE_FOCUS
		});
		expect(adopted.kind).toBe('program');

		const base = EXPERIENCE.experiences[0]!;
		const several = await experienceEnvelope({
			experience: {
				...EXPERIENCE,
				experiences: [base, { ...base, id: 'experience-2', label: 'Evening walk' }]
			}
		});
		const ambiguous = previewEntryFor({
			envelope: several,
			sourceContentId: 'digest-envelope',
			sessionEpoch: 'session-1',
			epoch: 1,
			focus: EMPTY_EXPERIENCE_FOCUS
		});
		expect(ambiguous).toMatchObject({ kind: 'unavailable' });
	});

	it('mints a fresh run epoch for every entry', async () => {
		const envelope = await experienceEnvelope();
		const first = entryFor(envelope, {}, 1);
		const second = entryFor(envelope, {}, 2);
		if (first.kind !== 'program' || second.kind !== 'program') throw new Error('expected programs');
		expect(first.options.runId).not.toBe(second.options.runId);
		expect(second.options.runEpoch).toBe(2);
		// A completion carrying the first entry's identity is stale in the second.
		expect(first.options.sourceContentId).toBe(second.options.sourceContentId);
	});
});

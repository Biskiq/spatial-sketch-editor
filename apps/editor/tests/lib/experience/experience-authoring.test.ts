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
	experienceUpdateIntent,
	guideOrderIntent,
	guideCreateIntent,
	stopCreateIntent,
	presentationUpdateIntent,
	stopUpdateIntent
} from '$lib/authoring/experience/commands';
import {
	EMPTY_EXPERIENCE_FOCUS,
	previewEntryFor,
	type ExperienceFocus
} from '$lib/authoring/experience/preview-entry';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	computeEnvelopeSourceContentId,
	createUnitAcceptanceProfile,
	serializeProjectEnvelope,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

import { EXPERIENCE, VIEWS, experienceEnvelope } from './fixtures';

async function boot(initial?: ProjectEnvelope): Promise<{
	readonly source: ProjectEnvelope;
	readonly coordinator: ReturnType<typeof createAcceptanceCoordinator<ProjectEnvelope>>;
}> {
	const source = initial ?? (await experienceEnvelope());
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
			views: [{ viewId: 'view-new' }],
			explorable: true,
			subject: null,
			text: { kind: 'plain', body: 'Welcome.' }
		});
		const stop = experience.stops.find((entry) => entry.id === 'stop-new');
		expect(stop).toMatchObject({
			presentationId: 'presentation-new',
			transition: 'cut'
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

	it('keeps an imported Travel gap through an unrelated rename when no connection id is captured (G7)', async () => {
		const source = await experienceEnvelope({
			camera: {
				formatVersion: CAMERA_UNIT_FORMAT_VERSION,
				views: VIEWS.map((view) => ({ ...view, connectedViewIds: [] })),
				connections: []
			}
		});
		const { coordinator } = await boot(source);

		const accepted = await coordinator.accept(
			experienceUpdateIntent({
				envelope: source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-rename-gap' },
				experienceId: 'experience-1',
				label: 'Renamed walk'
			})
		);

		expect(accepted.kind).toBe('accepted');
		const after = coordinator.acceptedSnapshot().domain.source;
		expect(experienceOf(after).label).toBe('Renamed walk');
		expect(after.units.camera.data.connections).toEqual([]);
	});

	it('reorders a Guide by stable Stop identity and normalises a Travel that would strand last (D-12)', async () => {
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
		// stop-1 leaves by Travel; putting it last would strand that Travel, so the
		// planner writes the Cut for the caller instead of refusing the reorder.
		expect(accepted.kind).toBe('accepted');
		const experience = experienceOf(coordinator.acceptedSnapshot().domain.source);
		expect(experience.guides[0]!.stopIds).toEqual(['stop-2', 'stop-1']);
		expect(experience.stops.find((entry) => entry.id === 'stop-1')!.transition).toBeUndefined();
		// R27: the Cut the planner wrote is part of the accepted plan.
		if (accepted.kind !== 'accepted') return;
		expect(accepted.changes).toContainEqual({
			kind: 'experience.transition.normalised',
			subjectIds: ['stop-1'],
			fields: ['transition']
		});
	});

	it('surfaces the straight path reconciliation adds as an accepted Camera change (R9)', async () => {
		const source = await experienceEnvelope({
			camera: {
				formatVersion: CAMERA_UNIT_FORMAT_VERSION,
				views: VIEWS.map((view) => ({ ...view, connectedViewIds: [] })),
				connections: []
			},
			experience: {
				...EXPERIENCE,
				experiences: EXPERIENCE.experiences.map((entry) => ({
					...entry,
					stops: entry.stops.map((stop) => stop.id === 'stop-1' ? { ...stop, transition: 'cut' as const } : stop)
				}))
			}
		});
		const { coordinator } = await boot(source);
		const accepted = await coordinator.accept(
			stopUpdateIntent({
				envelope: source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-path-change', connections: ['connection-new'] },
				experienceId: 'experience-1',
				stopId: 'stop-1',
				transition: 'travel'
			})
		);
		expect(accepted.kind).toBe('accepted');
		if (accepted.kind !== 'accepted') return;
		expect(accepted.changes).toContainEqual({
			kind: 'camera.connection.created',
			subjectIds: ['connection-new'],
			fields: ['fromNodeId', 'toNodeId', 'clearance', 'positionPath']
		});
		expect(coordinator.acceptedSnapshot().domain.source.units.camera.data.connections).toHaveLength(1);
	});

	it('R15 — Travel → Cut → Travel keeps the path and reuses it', async () => {
		const { source, coordinator } = await boot();
		const connections = source.units.camera.data.connections.length;

		const cut = await coordinator.accept(
			stopUpdateIntent({
				envelope: source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-r15-cut' },
				experienceId: 'experience-1',
				stopId: 'stop-1',
				transition: 'cut'
			})
		);
		expect(cut.kind).toBe('accepted');

		const travel = await coordinator.accept(
			stopUpdateIntent({
				envelope: coordinator.acceptedSnapshot().domain.source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: 'op-r15-travel' },
				experienceId: 'experience-1',
				stopId: 'stop-1',
				transition: 'travel'
			})
		);
		expect(travel.kind).toBe('accepted');
		const after = coordinator.acceptedSnapshot().domain.source;
		expect(experienceOf(after).stops.find((stop) => stop.id === 'stop-1')!.transition).toBe('travel');
		expect(after.units.camera.data.connections).toHaveLength(connections);
		expect(after.units.camera.data.connections[0]!.id).toBe(source.units.camera.data.connections[0]!.id);
	});


	it.each(['guide-create', 'stop-create', 'stop-update'] as const)(
		'%s preserves an explicitly chosen Default View through reorder and persistence',
		async (operation) => {
			const initial = await experienceEnvelope({ experience: {
				...EXPERIENCE,
				experiences: EXPERIENCE.experiences.map((experience) => ({
					...experience,
					presentations: experience.presentations.map((presentation) => presentation.id === 'presentation-1'
						? { ...presentation, views: [{ viewId: 'view-1' }, { viewId: 'view-2' }] }
						: presentation)
				}))
			} });
			const { source, coordinator } = await boot(initial);
			const common = {
				envelope: source, revision: coordinator.acceptedRevision(), experienceId: 'experience-1',
				entryViewId: 'view-1', transition: 'cut' as const
			};
			const stopId = operation === 'stop-update' ? 'stop-1' : 'stop-pinned';
			const intent = operation === 'guide-create'
				? guideCreateIntent({ ...common, ids: { operation: 'op-pin', guide: 'guide-pinned', stop: stopId }, presentationId: 'presentation-1', label: 'Pinned' })
				: operation === 'stop-create'
					? stopCreateIntent({ ...common, ids: { operation: 'op-pin', stop: stopId }, presentationId: 'presentation-1', guideId: 'guide-1', afterStopId: null })
					: stopUpdateIntent({ ...common, ids: { operation: 'op-pin' }, stopId });
			expect((await coordinator.accept(intent)).kind).toBe('accepted');
			const pinned = coordinator.acceptedSnapshot().domain.source;
			expect(experienceOf(pinned).stops.find((stop) => stop.id === stopId)!.entryViewId).toBe('view-1');
			expect((await coordinator.accept(presentationUpdateIntent({
				envelope: pinned, revision: coordinator.acceptedRevision(), ids: { operation: 'op-reorder' },
				experienceId: 'experience-1', presentationId: 'presentation-1',
				views: [{ viewId: 'view-2' }, { viewId: 'view-1' }]
			}))).kind).toBe('accepted');
			const saved = JSON.parse(serializeProjectEnvelope(coordinator.acceptedSnapshot().domain.source));
			const experience = experienceOf(saved);
			expect(experience.presentations[0]!.views[0]!.viewId).toBe('view-2');
			expect(experience.stops.find((stop) => stop.id === stopId)!.entryViewId).toBe('view-1');
			// Existing Stops that follow the Default keep that authored intent.
			if (operation !== 'stop-update') expect(experience.stops.find((stop) => stop.id === 'stop-1')!.entryViewId).toBeNull();
		}
	);
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

	it('keeps View 1 as the Default: a Views write that drops or adds a View is refused', async () => {
		const { source, coordinator } = await boot();
		for (const views of [[], [{ viewId: 'view-1' }, { viewId: 'view-2', transition: 'cut' as const }]]) {
			const refused = await coordinator.accept(
				presentationUpdateIntent({
					envelope: source,
					revision: coordinator.acceptedRevision(),
					ids: { operation: `op-views-${views.length}` },
					experienceId: 'experience-1',
					presentationId: 'presentation-1',
					views
				})
			);
			expect(refused).toMatchObject({ kind: 'rejected', code: 'planner-rejected', reason: 'invalid-order' });
		}
		expect(experienceOf(coordinator.acceptedSnapshot().domain.source).presentations[0]!.views).toEqual([{ viewId: 'view-1' }]);
		expect(coordinator.history().depth).toBe(1);
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

	it('enters an open Guide at its entry Stop, not the focused Stop (the welcome tour starts at Stop 1)', async () => {
		const envelope = await experienceEnvelope();
		const entry = entryFor(envelope, { guideId: 'guide-1', stopId: 'stop-2' });
		expect(entry.kind).toBe('program');
		if (entry.kind !== 'program') return;
		expect(entry.program.entryStopId).toBe('stop-1');
	});

	it('enters a non-opening Guide Card guide at its own entry, ignoring the open rail focus', async () => {
		const experience = {
			...EXPERIENCE,
			experiences: EXPERIENCE.experiences.map((entry) =>
				entry.id === 'experience-1'
					? {
							...entry,
							stops: entry.stops.map((stop) =>
								stop.id === 'stop-1' ? { ...stop, transition: 'cut' as const } : stop
							),
							guides: [
								{ id: 'guide-1', label: 'Main', stopIds: ['stop-1'], pacing: 'automatic' as const },
								{ id: 'guide-2', label: 'Other', stopIds: ['stop-2'], pacing: 'automatic' as const }
							]
						}
					: entry
			)
		};
		const envelope = await experienceEnvelope({ experience });
		// The rail still has Stop 1 of the opening Guide and its Presentation focused.
		const entry = entryFor(envelope, {
			guideId: 'guide-2',
			stopId: 'stop-1',
			presentationId: 'presentation-1'
		});
		expect(entry.kind).toBe('program');
		if (entry.kind !== 'program') return;
		expect(entry.program.entryStopId).toBe('stop-2');
		expect(entry.title).toContain('Other');
	});

	it('enters a selected Presentation alone when no Guide is open', async () => {
		const envelope = await experienceEnvelope();
		const entry = entryFor(envelope, { presentationId: 'presentation-2' });
		expect(entry.kind).toBe('program');
		if (entry.kind !== 'program') return;
		expect(entry.entryPresentationId).toBe('presentation-2');
		expect(entry.title).toBe('Gallery');
	});

	it('enters a selected Presentation even when the entry Guide carries an unconnected Travel', async () => {
		// The entry Guide's stop-1 → stop-2 Travel has no Camera connection, so the
		// Guide cannot lower. Selecting a Presentation previews that Presentation alone
		// and must not inherit the unrelated Guide's refusal.
		const envelope = await experienceEnvelope({
			camera: {
				formatVersion: 1,
				views: VIEWS.map((view) => ({ ...view, connectedViewIds: [] })),
				connections: []
			}
		});
		expect(entryFor(envelope).kind).toBe('unavailable');
		const entry = entryFor(envelope, { presentationId: 'presentation-2' });
		expect(entry.kind).toBe('program');
		if (entry.kind !== 'program') return;
		expect(entry.entryPresentationId).toBe('presentation-2');
	});

	it('lists enterable Presentations for a Guide-free Experience and explains an unenterable one', async () => {
		const base = EXPERIENCE.experiences[0]!;
		const envelope = await experienceEnvelope({
			experience: {
				...EXPERIENCE,
				experiences: [
					{
						...base,
						welcome: null,
						entryGuideId: null,
						guides: [],
						stops: [],
						presentations: [
							...base.presentations,
							{
								id: 'presentation-no-default',
								label: 'Study',
								views: [],
								explorable: true,
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

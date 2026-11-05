// @vitest-environment jsdom
/**
 * The Experience lens controller (R217.S24, R217.S25, R217.S26).
 *
 * The controller holds the commands, derived reading, message and busy flag that the lens
 * owned before the shared homes. It must keep these properties: each command is the
 * intent commands.ts builds and goes through the one acceptance port; a Stop or
 * Presentation edit sends only the changed field; Capture keeps an existing Default and
 * never binds a subject or a Stop on its own; the one Card subject is the only
 * selection; and the module runs with no DOM at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	EXPERIENCE_CAPTURE_BIND_KIND,
	EXPERIENCE_GUIDE_CREATE_KIND,
	EXPERIENCE_GUIDE_ORDER_KIND,
	EXPERIENCE_GUIDE_UPDATE_KIND,
	EXPERIENCE_STOP_REMOVE_KIND,
	EXPERIENCE_UPDATE_KIND,
	EXPERIENCE_PRESENTATION_UPDATE_KIND,
	EXPERIENCE_STOP_CREATE_KIND,
	EXPERIENCE_STOP_UPDATE_KIND,
	type Experience,
	type ExperiencePresentation,
	type ExperienceUnitPayload,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { experienceFocus } from '$lib/authoring/experience/focus.svelte';
import {
	captureBindIntent,
	capturedFovDegrees,
	capturedViewPose,
	createExperienceIntent,
	guideCreateIntent,
	guideOrderIntent,
	guideUpdateIntent,
	presentationUpdateIntent,
	removeIntent,
	stopCreateIntent,
	stopUpdateIntent,
	viewRenameIntent
} from '$lib/authoring/experience/commands';
import { travelGapMessages } from '$lib/authoring/experience/travel-gap';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { mountExperienceController, snapshotCell } from './__fixtures__/experience-controller-root.svelte';
import { EXPERIENCE, experienceEnvelope } from './fixtures';

type Accept = StageAdapterServices['authoring']['accept'];
type Outcome = Awaited<ReturnType<Accept>>;

function withExperience(changes: Partial<Experience>): ExperienceUnitPayload {
	return {
		...EXPERIENCE,
		experiences: EXPERIENCE.experiences.map((experience) => ({ ...experience, ...changes }))
	};
}

function withPresentationChange(
	presentationId: string,
	changes: Partial<ExperiencePresentation>
): ExperienceUnitPayload {
	return {
		...EXPERIENCE,
		experiences: EXPERIENCE.experiences.map((experience) => ({
			...experience,
			presentations: experience.presentations.map((presentation) =>
				presentation.id === presentationId ? { ...presentation, ...changes } : presentation
			)
		}))
	};
}

const REVISION = { projectId: 'project-1', revisionId: 'revision-1' };

function installed(): Outcome {
	return { kind: 'installed', install: {} as never, selectionClearedReason: null };
}

/** A 3D reading the Stage would evaluate, with the vertical field in degrees. */
function perspectiveReading(fovDegrees = 54) {
	const projection = new Array<number>(16).fill(0);
	projection[5] = 1 / Math.tan((fovDegrees * Math.PI) / 360);
	return {
		projection,
		evaluation: {
			projectionKind: 'perspective-3d',
			projectionMatrix: projection,
			eye: [0, 1.6, 2],
			target: [0, 1.4, 0]
		}
	};
}

/** The Stage and acceptance ports the controller reads, with the accept outcome under test. */
function servicesFor(
	accept: Accept = async () => installed(),
	evaluation: unknown = null,
	stagePrimary: unknown = null
) {
	const submitted = vi.fn<Accept>(accept);
	const services = {
		stage: {
			snapshot: () => ({ acceptedRevision: REVISION }),
			onAdaptersChanged: () => () => {},
			selectionState: () => ({ primary: stagePrimary }),
			evaluation: () => evaluation
		},
		authoring: { accept: submitted }
	} as unknown as StageAdapterServices;
	return { services, submitted };
}

/** The intent the controller submitted, with its operation id read back from the intent. */
function submittedIntent(submitted: ReturnType<typeof servicesFor>['submitted']) {
	expect(submitted).toHaveBeenCalledTimes(1);
	return submitted.mock.calls[0]![0];
}

async function mounted(
	options: { experience?: ExperienceUnitPayload; evaluation?: unknown; accept?: Accept; stagePrimary?: unknown } = {}
) {
	const envelope = await experienceEnvelope(
		options.experience === undefined ? {} : { experience: options.experience }
	);
	const { services, submitted } = servicesFor(options.accept, options.evaluation, options.stagePrimary);
	const mount = mountExperienceController(() => services, () => envelope);
	dispose = mount.dispose;
	return { envelope, services, submitted, ...mount };
}

let dispose: (() => void) | undefined;

beforeEach(() => {
	experienceFocus.reset();
});

afterEach(() => {
	dispose?.();
	dispose = undefined;
	experienceFocus.reset();
	vi.restoreAllMocks();
});

describe('commands route through commands.ts', () => {
	it('creates an Experience with the create intent and focuses the identity the intent allocates', async () => {
		const { controller, submitted } = await mounted();

		await controller.createExperience();

		const intent = submittedIntent(submitted);
		const created = intent.allocatedIds.find((entry) => entry.kind === 'experience')!;
		expect(intent).toEqual(
			createExperienceIntent({
				revision: REVISION,
				ids: { operation: intent.operationId, experience: created.id },
				label: 'Experience 2'
			})
		);
		expect(experienceFocus.experienceId).toBe(created.id);
		expect(controller.feedback).toBeNull();
	});

	it('reorders a Guide with the guide-order intent and nothing else', async () => {
		const { controller, submitted, envelope } = await mounted();
		controller.openGuide('guide-1');

		expect(await controller.moveStop('stop-2', -1)).toBe(true);

		const intent = submittedIntent(submitted);
		expect(intent.kind).toBe(EXPERIENCE_GUIDE_ORDER_KIND);
		expect(intent).toEqual(
			guideOrderIntent({
				envelope,
				revision: REVISION,
				ids: { operation: intent.operationId },
				experienceId: 'experience-1',
				guideId: 'guide-1',
				stopIds: ['stop-2', 'stop-1']
			})
		);
	});

	it('moves a Stop to an index as a permutation, and refuses a move that changes nothing', async () => {
		const three = withExperience({
			stops: [...EXPERIENCE.experiences[0]!.stops, { id: 'stop-3', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'presentation-1' }],
			guides: [{ id: 'guide-1', label: 'Main', stopIds: ['stop-1', 'stop-2', 'stop-3'], entryStopId: 'stop-1', pacing: 'automatic' as const }]
		});
		const { controller, submitted } = await mounted({ experience: three });
		controller.openGuide('guide-1');

		expect(await controller.moveStopTo('stop-1', 2)).toBe(true);
		const intent = submittedIntent(submitted);
		expect((intent.payload as { stopIds: string[] }).stopIds).toEqual(['stop-2', 'stop-3', 'stop-1']);

		submitted.mockClear();
		expect(await controller.moveStopTo('stop-1', 0)).toBe(false);
		expect(await controller.moveStop('stop-1', -1)).toBe(false);
		expect(await controller.moveStop('stop-3', 1)).toBe(false);
		expect(submitted).not.toHaveBeenCalled();
	});

	it('moves nothing when the Experience has no Guide to reorder', async () => {
		const { controller, submitted } = await mounted({
			experience: withExperience({ welcome: null, entryGuideId: null, guides: [], stops: [] })
		});

		expect(await controller.moveStop('stop-2', -1)).toBe(false);
		expect(await controller.moveStopTo('stop-2', 0)).toBe(false);
		expect(submitted).not.toHaveBeenCalled();
	});

	it('with no Guide opened, reorders the entry Guide that the tour reads', async () => {
		const { controller, submitted, envelope } = await mounted();
		expect(controller.currentGuide).toBeNull();

		expect(await controller.moveStopTo('stop-2', 0)).toBe(true);

		const intent = submittedIntent(submitted);
		expect(intent.kind).toBe(EXPERIENCE_GUIDE_ORDER_KIND);
		expect(intent).toEqual(
			guideOrderIntent({
				envelope,
				revision: REVISION,
				ids: { operation: intent.operationId },
				experienceId: 'experience-1',
				guideId: 'guide-1',
				stopIds: ['stop-2', 'stop-1']
			})
		);
	});
});

describe('per-field Stop edits keep the other fields', () => {
	it('Stay writes only the stay, rounded to 0.5 s, and refuses a stay under 1 s', async () => {
		const { controller, submitted, envelope } = await mounted();

		expect(await controller.setStopStay('stop-1', 4.2)).toBe(true);
		const intent = submittedIntent(submitted);
		expect(intent.kind).toBe(EXPERIENCE_STOP_UPDATE_KIND);
		expect(intent.payload).toEqual({ staySeconds: 4 });
		expect(intent).toEqual(
			stopUpdateIntent({
				envelope,
				revision: REVISION,
				ids: { operation: intent.operationId },
				experienceId: 'experience-1',
				stopId: 'stop-1',
				staySeconds: 4
			})
		);

		submitted.mockClear();
		expect(await controller.setStopStay('stop-1', 0.5)).toBe(false);
		expect(await controller.setStopStay('stop-1', Number.NaN)).toBe(false);
		expect(submitted).not.toHaveBeenCalled();
		expect(controller.feedback).toEqual({ kind: 'refusal', text: 'A stay is at least 1 s.' });
	});

	it('Enter at names a View of the Presentation; the Default is written as null', async () => {
		const two = withPresentationChange('presentation-1', { views: [{ viewId: 'view-1' }, { viewId: 'view-2', transition: 'cut' }] });
		const { controller, submitted } = await mounted({ experience: two });
		expect(await controller.setStopEntry('stop-1', 'view-2')).toBe(true);
		expect(submittedIntent(submitted).payload).toEqual({ entryViewId: 'view-2' });
		submitted.mockClear();
		// Already following the Default: no change.
		expect(await controller.setStopEntry('stop-1', 'view-1')).toBe(false);
		expect(await controller.setStopEntry('stop-1', 'view-absent')).toBe(false);
		expect(submitted).not.toHaveBeenCalled();
	});

	it('Invite to explore turns on with the default prompt, and an empty prompt is the default', async () => {
		const { controller, submitted } = await mounted();
		expect(await controller.setStopInvitation('stop-1', { prompt: null })).toBe(true);
		expect(submittedIntent(submitted).payload).toEqual({ invitation: { prompt: null } });
		submitted.mockClear();
		expect(await controller.setStopInvitation('stop-1', null)).toBe(false);
		expect(await controller.setStopInvitation('stop-2', { prompt: '  Look at the keys ' })).toBe(true);
		expect(submittedIntent(submitted).payload).toEqual({ invitation: { prompt: 'Look at the keys' } });
	});

	it('Pacing is written on the Guide, once', async () => {
		const { controller, submitted } = await mounted();
		expect(await controller.setGuidePacing('guide-1', 'manual')).toBe(true);
		expect(submittedIntent(submitted).payload).toEqual({ pacing: 'manual' });
		submitted.mockClear();
		expect(await controller.setGuidePacing('guide-1', 'automatic')).toBe(false);
		expect(submitted).not.toHaveBeenCalled();
	});

	it('types a success as a success and a refusal as a refusal, never by its words (G8)', async () => {
		const { controller } = await mounted();
		expect(controller.feedback).toBeNull();

		expect(await controller.setGuidePacing('guide-1', 'manual')).toBe(true);
		expect(controller.feedback).toEqual({
			kind: 'success',
			text: 'Manual: every Stop now waits for Next. Each Stop keeps its time, unused, for switching back.'
		});

		// A refusal is a different kind, not a different set of words.
		expect(await controller.setStopStay('stop-1', 0.5)).toBe(false);
		expect(controller.feedback).toEqual({ kind: 'refusal', text: 'A stay is at least 1 s.' });

		// A no-op install is refused, and is never mistaken for an accepted change.
		expect(await controller.setGuidePacing('guide-1', 'automatic')).toBe(false);
		expect(controller.feedback?.kind).toBe('refusal');
	});

	it('the View rail sets a step or a range in one change, adding the straight paths a Travel needs', async () => {
		const three = withPresentationChange('presentation-1', {
			views: [{ viewId: 'view-1' }, { viewId: 'view-2', transition: 'cut' }]
		});
		const { controller, submitted } = await mounted({ experience: three });
		expect(await controller.setPresentationStep('presentation-1', 1, 'travel')).toBe(true);
		const intent = submittedIntent(submitted);
		// view-1 and view-2 are joined by connection-1, so no path is added.
		expect(intent.payload).toEqual({ views: [{ viewId: 'view-1' }, { viewId: 'view-2', transition: 'travel' }] });
		submitted.mockClear();
		expect(await controller.setPresentationStep('presentation-1', 1, 'cut', 1)).toBe(false);
	});

	it('moving a View to the top makes it the Default; each View keeps its own step', async () => {
		const two = withPresentationChange('presentation-1', {
			views: [{ viewId: 'view-1' }, { viewId: 'view-2', transition: 'travel' }]
		});
		const { controller, submitted } = await mounted({ experience: two });
		expect(await controller.movePresentationView('presentation-1', 'view-2', 0)).toBe(true);
		expect(submittedIntent(submitted).payload).toEqual({
			views: [{ viewId: 'view-2' }, { viewId: 'view-1', transition: 'cut' }]
		});
	});

	it('changes where Next goes and keeps the transition', async () => {
		const { controller, submitted } = await mounted();

		await controller.setContinuation('stop-1', 'end');
		expect(submittedIntent(submitted).payload).toEqual({ continuation: { kind: 'end' } });

		submitted.mockClear();
		await controller.setContinuation('stop-1', { stopId: 'stop-2' });
		expect(submittedIntent(submitted).payload).toMatchObject({
			continuation: { kind: 'stop', stopId: 'stop-2', transition: 'travel' }
		});

		submitted.mockClear();
		await controller.setContinuation('stop-1', 'next');
		expect(submittedIntent(submitted).payload).toMatchObject({
			continuation: { kind: 'sequence-next', transition: 'travel' }
		});
	});

	it('changes the transition and keeps the target', async () => {
		const jump = withExperience({
			stops: [
				{ id: 'stop-1', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'presentation-1', continuation: { kind: 'stop', stopId: 'stop-2' } },
				{ id: 'stop-2', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'presentation-2', continuation: { kind: 'end' } }
			]
		});
		const { controller, submitted } = await mounted({ experience: jump });

		await controller.setTransition('stop-1', 'travel');

		expect(submittedIntent(submitted).payload).toMatchObject({
			continuation: { kind: 'stop', stopId: 'stop-2', transition: 'travel' }
		});
	});

	it('writes sequence-next for a Stop whose continuation reads as unauthored', async () => {
		// The accepted source normalises a missing continuation, so the controller sees the
		// authored default (a cut sequence-next) and the edit rewrites it.
		const bare = withExperience({
			stops: [
				{ id: 'stop-1', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'presentation-1' },
				{ id: 'stop-2', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'presentation-2' }
			]
		});
		const { controller, submitted } = await mounted({ experience: bare });

		await controller.setTransition('stop-1', 'travel');

		expect(submittedIntent(submitted).payload).toMatchObject({
			continuation: { kind: 'sequence-next', transition: 'travel' }
		});
	});

	it('does nothing for a transition on an End continuation', async () => {
		const { controller, submitted } = await mounted();

		expect(await controller.setTransition('stop-2', 'travel')).toBe(false);
		expect(submitted).not.toHaveBeenCalled();
	});

	it('does nothing for a transition on a Stop that implicitly ends the Guide, and still writes one with a next Stop', async () => {
		// stop-2 has no continuation: as the Guide's last Stop it reads as an implicit End, which has no next Stop.
		const implicit = withExperience({
			stops: [
				{ id: 'stop-1', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'presentation-1', continuation: { kind: 'sequence-next', transition: 'cut' } },
				{ id: 'stop-2', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'presentation-2' }
			]
		});
		const { controller, submitted } = await mounted({ experience: implicit });

		expect(controller.resolveContinuation('stop-2')).toMatchObject({ kind: 'end', explicit: false });
		expect(await controller.setTransition('stop-2', 'travel')).toBe(false);
		expect(submitted).not.toHaveBeenCalled();

		expect(await controller.setTransition('stop-1', 'travel')).toBe(true);
		expect(submittedIntent(submitted).payload).toMatchObject({
			continuation: { kind: 'sequence-next', transition: 'travel' }
		});
	});

	it('names an unknown Stop as no change', async () => {
		const { controller, submitted } = await mounted();

		expect(await controller.setStopStay('missing', 3)).toBe(false);
		expect(await controller.setStopEntry('missing', 'view-1')).toBe(false);
		expect(await controller.setStopInvitation('missing', null)).toBe(false);
		expect(await controller.setContinuation('missing', 'end')).toBe(false);
		expect(await controller.setTransition('missing', 'cut')).toBe(false);
		expect(submitted).not.toHaveBeenCalled();
	});
});

describe('Capture (D1, D2)', () => {
	it('captures into the selected Presentation, appended after its Default', async () => {
		const { controller, submitted, envelope } = await mounted({ evaluation: perspectiveReading().evaluation });
		controller.select({ kind: 'presentation', presentationId: 'presentation-1' });

		expect(await controller.capture()).toBe(true);

		const intent = submittedIntent(submitted);
		expect(intent.kind).toBe(EXPERIENCE_PRESENTATION_UPDATE_KIND);
		const view = intent.allocatedIds.find((entry) => entry.kind === 'view')!.id;
		expect(intent).toEqual(
			presentationUpdateIntent({
				envelope,
				revision: REVISION,
				ids: { operation: intent.operationId, view },
				experienceId: 'experience-1',
				presentationId: 'presentation-1',
				view: capturedViewPose({
					label: 'View 3',
					eye: [0, 1.6, 2],
					target: [0, 1.4, 0],
					fov: capturedFovDegrees(perspectiveReading().projection)!
				})
			})
		);
		expect('views' in (intent.payload as object)).toBe(false);
		expect(controller.feedback).toBeNull();
		// The Card stays on what it showed.
		expect(controller.subject).toEqual({ kind: 'presentation', presentationId: 'presentation-1' });
	});

	it("captures into a selected View's Presentation, keeping that Presentation's Default", async () => {
		const { controller, submitted } = await mounted({ evaluation: perspectiveReading().evaluation });
		controller.select({ kind: 'view', viewId: 'view-2', presentationId: 'presentation-2' });

		expect(await controller.capture()).toBe(true);

		const intent = submittedIntent(submitted);
		expect(intent.kind).toBe(EXPERIENCE_PRESENTATION_UPDATE_KIND);
		expect(intent.targets[0]!.subject).toEqual({ kind: 'presentation', id: 'presentation-2' });
		expect('views' in (intent.payload as object)).toBe(false);
	});

	it('omits the Default when there is none, so the new View fills it, and says so', async () => {
		const unset = withPresentationChange('presentation-2', { views: [] });
		const noStops: ExperienceUnitPayload = {
			...unset,
			experiences: unset.experiences.map((experience) => ({
				...experience,
				stops: experience.stops.filter((stop) => stop.presentationId !== 'presentation-2'),
				guides: [{ id: 'guide-1', label: 'Main', stopIds: ['stop-1'], entryStopId: 'stop-1', pacing: 'automatic' as const }]
			}))
		};
		const { controller, submitted } = await mounted({
			experience: noStops,
			evaluation: perspectiveReading().evaluation
		});
		controller.select({ kind: 'presentation', presentationId: 'presentation-2' });

		expect(await controller.capture()).toBe(true);

		const intent = submittedIntent(submitted);
		expect('views' in (intent.payload as object)).toBe(false);
		expect(controller.feedback).toEqual({
			kind: 'info',
			text: 'Gallery had no Default View, so this View is now its Default.'
		});
	});

	it('with nothing selected binds no subject, no Guide and no Stop, then selects the new Presentation', async () => {
		// A Scene entity is selected on the Stage; Capture must not read it.
		const stagePrimary = { domain: 'scene', subject: { kind: 'entity', id: 'entity-1' } };
		const { controller, submitted, envelope } = await mounted({
			evaluation: perspectiveReading().evaluation,
			stagePrimary
		});
		controller.openGuide('guide-1');
		controller.select({ kind: 'stop', stopId: 'stop-1' });
		controller.select(null);

		expect(await controller.capture()).toBe(true);

		const intent = submittedIntent(submitted);
		expect(intent.kind).toBe(EXPERIENCE_CAPTURE_BIND_KIND);
		const view = intent.allocatedIds.find((entry) => entry.kind === 'view')!.id;
		const presentation = intent.allocatedIds.find((entry) => entry.kind === 'presentation')!.id;
		expect(intent.allocatedIds.some((entry) => entry.kind === 'stop' || entry.kind === 'guide')).toBe(false);
		expect(intent).toEqual(
			captureBindIntent({
				envelope,
				revision: REVISION,
				ids: { operation: intent.operationId, view, presentation },
				experienceId: 'experience-1',
				view: capturedViewPose({
					label: 'View 3',
					eye: [0, 1.6, 2],
					target: [0, 1.4, 0],
					fov: capturedFovDegrees(perspectiveReading().projection)!
				}),
				presentationLabel: 'Presentation 3',
				subjectEntityId: null,
				text: null,
				guideId: null,
				firstGuideLabel: null,
				afterStopId: null
			})
		);
		expect(controller.subject).toEqual({ kind: 'presentation', presentationId: presentation });
	});

	it('does not take a Stop for the capture target: a selected Stop is not a Presentation', async () => {
		const { controller, submitted } = await mounted({ evaluation: perspectiveReading().evaluation });
		controller.select({ kind: 'stop', stopId: 'stop-1' });

		await controller.capture();

		expect(submittedIntent(submitted).kind).toBe(EXPERIENCE_CAPTURE_BIND_KIND);
	});

	it('refuses before acceptance when the Stage shows no 3D reading, leaving the selection alone', async () => {
		const unevaluated = await mounted();
		unevaluated.controller.select({ kind: 'presentation', presentationId: 'presentation-1' });

		expect(await unevaluated.controller.capture()).toBe(false);
		expect(unevaluated.submitted).not.toHaveBeenCalled();
		expect(unevaluated.controller.feedback).toEqual({
			kind: 'refusal',
			text: 'The Stage has not evaluated a reading yet; wait for the reading to settle.'
		});
		expect(unevaluated.controller.subject).toEqual({ kind: 'presentation', presentationId: 'presentation-1' });
		unevaluated.dispose();

		const plan = await mounted({
			evaluation: { projectionKind: 'orthographic', projectionMatrix: [], eye: [], target: [] }
		});
		expect(await plan.controller.capture()).toBe(false);
		expect(plan.submitted).not.toHaveBeenCalled();
		expect(plan.controller.feedback).toEqual({
			kind: 'refusal',
			text: 'Capture needs the 3D reading: switch to 3D, frame the View, then capture.'
		});
	});

	it('leaves the selection as it was when acceptance refuses the capture', async () => {
		const { controller } = await mounted({
			evaluation: perspectiveReading().evaluation,
			accept: async () => ({ kind: 'refused', code: 'stale', message: 'The source changed.' }) as unknown as Outcome
		});
		controller.select({ kind: 'presentation', presentationId: 'presentation-1' });
		expect(await controller.capture()).toBe(false);
		expect(controller.subject).toEqual({ kind: 'presentation', presentationId: 'presentation-1' });

		controller.select(null);
		expect(await controller.capture()).toBe(false);
		expect(controller.subject).toBeNull();
	});

	it('Present this binds the named Scene entity with the given label and no Stop, then selects it', async () => {
		const { controller, submitted, envelope } = await mounted({ evaluation: perspectiveReading().evaluation });

		expect(await controller.presentThis('entity-1', 'Grand piano')).toBe(true);

		const intent = submittedIntent(submitted);
		expect(intent.kind).toBe(EXPERIENCE_CAPTURE_BIND_KIND);
		const view = intent.allocatedIds.find((entry) => entry.kind === 'view')!.id;
		const presentation = intent.allocatedIds.find((entry) => entry.kind === 'presentation')!.id;
		expect(intent.allocatedIds.some((entry) => entry.kind === 'stop')).toBe(false);
		expect(intent).toEqual(
			captureBindIntent({
				envelope,
				revision: REVISION,
				ids: { operation: intent.operationId, view, presentation },
				experienceId: 'experience-1',
				view: capturedViewPose({
					label: 'View 3',
					eye: [0, 1.6, 2],
					target: [0, 1.4, 0],
					fov: capturedFovDegrees(perspectiveReading().projection)!
				}),
				presentationLabel: 'Grand piano',
				subjectEntityId: 'entity-1',
				text: null,
				guideId: null,
				firstGuideLabel: null,
				afterStopId: null
			})
		);
		expect(controller.subject).toEqual({ kind: 'presentation', presentationId: presentation });
	});
});

describe('addStop (D8)', () => {
	const noGuide = withExperience({ welcome: null, entryGuideId: null, stops: [], guides: [] });

	it('needs a trimmed Guide name before it creates the first Guide', async () => {
		const { controller, submitted } = await mounted({ experience: noGuide });
		controller.select({ kind: 'presentation', presentationId: 'presentation-1' });

		expect(await controller.addStop('presentation-1')).toBe(false);
		expect(await controller.addStop('presentation-1', { firstGuideLabel: '   ' })).toBe(false);

		expect(submitted).not.toHaveBeenCalled();
		expect(controller.feedback).toEqual({ kind: 'refusal', text: 'Name the Guide first.' });
		expect(controller.subject).toEqual({ kind: 'presentation', presentationId: 'presentation-1' });
	});

	it('creates the first Guide and its Stop, makes the Guide active and selects the Stop', async () => {
		const { controller, submitted, envelope } = await mounted({ experience: noGuide });

		expect(await controller.addStop('presentation-1', { firstGuideLabel: '  Morning route ' })).toBe(true);

		const intent = submittedIntent(submitted);
		expect(intent.kind).toBe(EXPERIENCE_GUIDE_CREATE_KIND);
		const guide = intent.allocatedIds.find((entry) => entry.kind === 'guide')!.id;
		const stop = intent.allocatedIds.find((entry) => entry.kind === 'stop')!.id;
		expect(intent).toEqual(
			guideCreateIntent({
				envelope,
				revision: REVISION,
				ids: { operation: intent.operationId, guide, stop },
				experienceId: 'experience-1',
				presentationId: 'presentation-1',
				label: 'Morning route',
				entryViewId: null,
				staySeconds: null,
				continuation: { kind: 'sequence-next', transition: 'cut' }
			})
		);
		expect(experienceFocus.guideId).toBe(guide);
		expect(controller.subject).toEqual({ kind: 'stop', stopId: stop });
	});

	it('inserts after the selected Stop when it is in the active Guide', async () => {
		const { controller, submitted, envelope } = await mounted();
		controller.openGuide('guide-1');
		controller.select({ kind: 'stop', stopId: 'stop-1' });

		expect(await controller.addStop('presentation-2')).toBe(true);

		const intent = submittedIntent(submitted);
		expect(intent.kind).toBe(EXPERIENCE_STOP_CREATE_KIND);
		const stop = intent.allocatedIds.find((entry) => entry.kind === 'stop')!.id;
		expect(intent).toEqual(
			stopCreateIntent({
				envelope,
				revision: REVISION,
				ids: { operation: intent.operationId, stop },
				experienceId: 'experience-1',
				presentationId: 'presentation-2',
				guideId: 'guide-1',
				afterStopId: 'stop-1',
				entryViewId: null,
				staySeconds: null,
				continuation: { kind: 'sequence-next', transition: 'cut' }
			})
		);
		expect(controller.subject).toEqual({ kind: 'stop', stopId: stop });
	});

	it('inserts at the end with no Stop selected, and an explicit afterStopId wins', async () => {
		const { controller, submitted } = await mounted();
		controller.openGuide('guide-1');

		await controller.addStop('presentation-2');
		expect((submittedIntent(submitted).payload as { afterStopId: string | null }).afterStopId).toBeNull();

		submitted.mockClear();
		controller.select({ kind: 'stop', stopId: 'stop-1' });
		await controller.addStop('presentation-2', { afterStopId: 'stop-2' });
		expect((submittedIntent(submitted).payload as { afterStopId: string | null }).afterStopId).toBe('stop-2');
	});

	it("uses the entry Guide when none is active, and makes it active", async () => {
		const { controller, submitted } = await mounted();
		expect(controller.currentGuide).toBeNull();

		await controller.addStop('presentation-1');

		expect((submittedIntent(submitted).payload as { guideId: string }).guideId).toBe('guide-1');
		expect(experienceFocus.guideId).toBe('guide-1');
	});

	it('does not insert after a selected Stop that is not in the Guide', async () => {
		const stray = withExperience({
			stops: [...EXPERIENCE.experiences[0]!.stops, { id: 'stop-3', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'presentation-1' }]
		});
		const { controller, submitted } = await mounted({ experience: stray });
		controller.openGuide('guide-1');
		controller.select({ kind: 'stop', stopId: 'stop-3' });

		await controller.addStop('presentation-2');

		expect((submittedIntent(submitted).payload as { afterStopId: string | null }).afterStopId).toBeNull();
	});

	it('selects nothing new when acceptance refuses', async () => {
		const { controller } = await mounted({
			accept: async () => ({ kind: 'refused', code: 'stale', message: 'The source changed.' }) as unknown as Outcome
		});
		controller.openGuide('guide-1');
		controller.select({ kind: 'presentation', presentationId: 'presentation-1' });

		expect(await controller.addStop('presentation-2')).toBe(false);

		expect(controller.subject).toEqual({ kind: 'presentation', presentationId: 'presentation-1' });
	});
});

describe('one Card subject (D10)', () => {
	it('derives the selected Presentation, View and Stop from the subject alone', async () => {
		const { controller, flush } = await mounted();

		controller.select({ kind: 'view', viewId: 'view-2', presentationId: 'presentation-2' });
		flush();
		expect(controller.selectedPresentation?.id).toBe('presentation-2');
		expect(controller.selectedView).toMatchObject({ id: 'view-2', label: 'Gallery', isDefault: true, lensMillimetres: 24 });
		expect(controller.selectedStop).toBeNull();

		controller.select({ kind: 'transition', stopId: 'stop-1' });
		flush();
		expect(controller.selectedStop?.id).toBe('stop-1');
		expect(controller.selectedPresentation).toBeNull();
		expect(controller.selectedView).toBeNull();

		controller.select({ kind: 'guide', guideId: 'guide-1' });
		flush();
		expect(controller.selectedStop).toBeNull();
		expect(controller.selectedPresentation).toBeNull();
	});

	it('feeds the Preview entry rule from the subject: a Stop is never remembered behind a new selection', async () => {
		const { controller } = await mounted();
		controller.openGuide('guide-1');

		controller.select({ kind: 'stop', stopId: 'stop-2' });
		expect(experienceFocus.read()).toMatchObject({ guideId: 'guide-1', stopId: 'stop-2', presentationId: null });

		controller.select({ kind: 'view', viewId: 'view-1', presentationId: 'presentation-1' });
		expect(experienceFocus.read()).toMatchObject({ stopId: null, presentationId: 'presentation-1' });

		controller.select({ kind: 'guide', guideId: 'guide-1' });
		expect(experienceFocus.read()).toMatchObject({ stopId: null, presentationId: null });
	});

	it('opens a Guide without changing the selection, ignores a Guide the source does not carry, and clears on a new Experience', async () => {
		const { controller } = await mounted();
		controller.select({ kind: 'presentation', presentationId: 'presentation-1' });

		controller.openGuide('guide-1');
		expect(controller.currentGuide?.id).toBe('guide-1');
		expect(controller.subject).toEqual({ kind: 'presentation', presentationId: 'presentation-1' });

		controller.openGuide('missing');
		expect(controller.currentGuide?.id).toBe('guide-1');

		controller.openExperience('experience-1');
		expect(controller.currentGuide).toBeNull();
		expect(controller.subject).toBeNull();
	});
});

describe('busy and message', () => {
	it('is busy while a command is in flight and refuses the next one without submitting it', async () => {
		let release: (outcome: Outcome) => void = () => {};
		const { controller, submitted } = await mounted({
			accept: () => new Promise<Outcome>((resolve) => (release = resolve))
		});

		const pending = controller.createExperience();
		expect(controller.busy).toBe(true);
		await controller.setDefaultView('presentation-1', 'view-1');
		expect(submitted).toHaveBeenCalledTimes(1);

		release(installed());
		await pending;
		expect(controller.busy).toBe(false);
		expect(controller.feedback).toBeNull();
	});

	it('names a refusal in its own words, without the code, focuses nothing new and clears busy', async () => {
		const { controller } = await mounted({
			accept: async () => ({
				kind: 'refused',
				code: 'stale-session',
				message: 'the snapshot belongs to another host lifetime'
			}) as unknown as Outcome
		});

		await controller.createExperience();

		expect(controller.feedback).toEqual({
			kind: 'refusal',
			text: 'the snapshot belongs to another host lifetime'
		});
		expect(controller.busy).toBe(false);
		expect(experienceFocus.experienceId).toBe('experience-1');
	});

	it('reports an outcome that changed nothing as no change', async () => {
		const { controller } = await mounted({
			accept: async () => ({ kind: 'no-op', revision: REVISION }) as unknown as Outcome
		});

		await controller.setStopStay('stop-1', 3);
		expect(controller.feedback).toEqual({ kind: 'refusal', text: 'No change to accept.' });
	});
});

describe('derived reading and the route-supplied ports', () => {
	it('adopts the first Experience as focus and reads its Guide, Stops and Presentation filter', async () => {
		const { controller, flush } = await mounted();
		controller.openGuide('guide-1');
		flush();

		expect(experienceFocus.experienceId).toBe('experience-1');
		expect(controller.current?.id).toBe('experience-1');
		expect(controller.guides.map((guide) => guide.id)).toEqual(['guide-1']);
		expect(controller.guideStops.map((stop) => stop.id)).toEqual(['stop-1', 'stop-2']);
		expect(controller.stopUsage.get('presentation-1')).toEqual(['stop-1']);

		controller.query = 'gall';
		expect(controller.filteredPresentations.map((entry) => entry.id)).toEqual(['presentation-2']);
	});

	it('reads the tour through the entry Guide until a Guide is opened, then through the active one (contextGuide)', async () => {
		const { controller, flush } = await mounted();
		flush();

		expect(controller.currentGuide).toBeNull();
		expect(controller.contextGuide?.id).toBe('guide-1');
		expect(controller.guideStops.map((stop) => stop.id)).toEqual(['stop-1', 'stop-2']);
		expect(controller.viewStops('view-2')).toEqual([{ stopId: 'stop-2', position: 2 }]);
		expect(controller.resolveContinuation('stop-1')).toMatchObject({ kind: 'adjacent', stopId: 'stop-2', position: 2 });
		expect(controller.reach()).toEqual({ presentations: 2, views: 2, freePresentations: 2, freeViews: 2, hiddenViews: 0, viewsOnlyFree: 0 });

		controller.openGuide('guide-1');
		flush();
		expect(controller.currentGuide?.id).toBe('guide-1');
		expect(controller.contextGuide?.id).toBe('guide-1');
	});

	it('matches a Presentation by the label of any of its Views, as well as by its own label', async () => {
		// The Presentation is renamed away from its View's label, so only the View carries "Gallery".
		const { controller, flush } = await mounted({
			experience: withPresentationChange('presentation-2', { label: 'Hall' })
		});
		flush();

		controller.query = 'gall';
		expect(controller.filteredPresentations.map((entry) => entry.id)).toEqual(['presentation-2']);

		controller.query = 'HALL';
		expect(controller.filteredPresentations.map((entry) => entry.id)).toEqual(['presentation-2']);

		controller.query = 'piano';
		expect(controller.filteredPresentations.map((entry) => entry.id)).toEqual(['presentation-1']);

		controller.query = 'nothing';
		expect(controller.filteredPresentations).toEqual([]);
	});

	it('has no context Guide when the Experience names no entry Guide, and the reads stay empty', async () => {
		const { controller, flush } = await mounted({
			experience: withExperience({ welcome: null, entryGuideId: null, guides: [], stops: [] })
		});
		flush();

		expect(controller.contextGuide).toBeNull();
		expect(controller.guideStops).toEqual([]);
		expect(controller.viewStops('view-2')).toEqual([]);
		expect(controller.reach()).toEqual({ presentations: 2, views: 2, freePresentations: 2, freeViews: 2, hiddenViews: 0, viewsOnlyFree: 2 });
	});

	it('reads travel gaps for the selected Stop and for every Stop as the travel-gap authority does', async () => {
		const { controller, envelope, flush } = await mounted();
		controller.select({ kind: 'stop', stopId: 'stop-1' });
		flush();

		expect(controller.travelGaps).toEqual(travelGapMessages(envelope, 'experience-1', 'stop-1'));
		for (const stop of ['stop-1', 'stop-2']) {
			expect(controller.travelGapsByStop.get(stop) ?? []).toEqual(
				travelGapMessages(envelope, 'experience-1', stop)
			);
		}
	});

	it('reads the resolved continuation, the Stops at a View, the Presentations about an entity and the reach', async () => {
		const subject = {
			version: 1,
			domain: 'scene',
			revision: { kind: 'exact', contentRevision: 'x' },
			subject: { kind: 'entity', id: 'entity-1' },
			instancePath: [],
			location: { kind: 'project-root' },
			componentId: null,
			capabilityId: null
		} as unknown as ExperiencePresentation['subject'];
		const { controller, flush } = await mounted({
			experience: withPresentationChange('presentation-1', { subject })
		});
		controller.openGuide('guide-1');
		flush();

		expect(controller.resolveContinuation('stop-1')).toEqual({
			kind: 'adjacent',
			stopId: 'stop-2',
			position: 2,
			transition: 'travel',
			explicit: false
		});
		expect(controller.resolveContinuation('stop-2')).toEqual({ kind: 'end', explicit: true });
		expect(controller.resolveContinuation('missing')).toBeNull();
		expect(controller.viewStops('view-2')).toEqual([{ stopId: 'stop-2', position: 2 }]);
		expect(controller.presentationsAbout('entity-1').map((entry) => entry.id)).toEqual(['presentation-1']);
		expect(controller.presentationsAbout('other')).toEqual([]);
		expect(controller.reach()).toEqual({ presentations: 2, views: 2, freePresentations: 2, freeViews: 2, hiddenViews: 0, viewsOnlyFree: 0 });
		expect(controller.viewFacts('view-1')).toMatchObject({
			presentationId: 'presentation-1',
			fovDegrees: 54,
			lensMillimetres: 24,
			eyeHeightMetres: 1.6,
			isDefault: true
		});
		expect(controller.viewFacts('missing')).toBeNull();
	});

	it('follows a replaced snapshot and sends commands through the services the route now supplies', async () => {
		const envelope = await experienceEnvelope();
		const second = {
			...EXPERIENCE,
			experiences: [
				...EXPERIENCE.experiences,
				{ id: 'experience-2', label: 'Second', welcome: null, entryGuideId: null, presentations: [], stops: [], guides: [], detours: [] }
			]
		};
		const replaced: ProjectEnvelope = await experienceEnvelope({ experience: second });
		const first = servicesFor();
		const next = servicesFor();
		let services = first.services;
		const cell = snapshotCell(envelope);
		const mount = mountExperienceController(() => services, () => cell.value);
		dispose = mount.dispose;
		expect(mount.controller.experiences.map((entry) => entry.id)).toEqual(['experience-1']);

		cell.value = replaced;
		services = next.services;
		mount.flush();
		expect(mount.controller.experiences.map((entry) => entry.id)).toEqual(['experience-1', 'experience-2']);

		await mount.controller.createExperience();
		expect(next.submitted).toHaveBeenCalledTimes(1);
		expect(first.submitted).not.toHaveBeenCalled();
	});
});

describe('the controller module has no DOM at runtime', () => {
	it('runs with no DOM: with document and window withdrawn, it still reads, submits and reports', async () => {
		const envelope = await experienceEnvelope();
		const { services, submitted } = servicesFor();
		vi.stubGlobal('document', undefined);
		vi.stubGlobal('window', undefined);
		try {
			const mount = mountExperienceController(() => services, () => envelope);
			dispose = mount.dispose;
			mount.controller.select({ kind: 'stop', stopId: 'stop-1' });
			mount.flush();

			await mount.controller.setStopStay('stop-1', 3);
			await mount.controller.createExperience();

			expect(submitted).toHaveBeenCalledTimes(2);
			expect(mount.controller.feedback).toBeNull();
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe('Presentation edits', () => {
	it('submits a rename as the presentation-update intent, and reports acceptance to the Card', async () => {
		const { controller, submitted, envelope } = await mounted();

		const outcome = await controller.renamePresentation('presentation-1', 'Renamed hall');

		const intent = submittedIntent(submitted);
		expect(intent).toEqual(
			presentationUpdateIntent({
				envelope,
				revision: REVISION,
				ids: { operation: intent.operationId },
				experienceId: envelope.units.experience.data.experiences[0]!.id,
				presentationId: 'presentation-1',
				label: 'Renamed hall'
			})
		);
		expect(outcome).toEqual({ kind: 'accepted' });
	});

	it('reports a refused rename with the refusal, and leaves the Card subject as it was', async () => {
		const { controller } = await mounted({
			accept: async () => ({ kind: 'refused', code: 'stale', message: 'The source changed.' }) as unknown as Outcome
		});
		controller.select({ kind: 'presentation', presentationId: 'presentation-2' });

		const outcome = await controller.renamePresentation('presentation-1', 'Renamed hall');

		expect(outcome).toEqual({ kind: 'refused', message: 'The source changed.' });
		expect(experienceFocus.presentationId).toBe('presentation-2');
	});

	it('writes the information text, and an empty body clears it', async () => {
		const { controller, submitted } = await mounted();

		await controller.updatePresentationText('presentation-1', 'A curator note.');
		expect(submittedIntent(submitted).payload).toEqual({ text: { kind: 'plain', body: 'A curator note.' } });

		submitted.mockClear();
		await controller.updatePresentationText('presentation-1', '');
		expect(submittedIntent(submitted).payload).toEqual({ text: null });
	});

	it('Make default moves the View to the top: View 1 is the Default', async () => {
		const many = withPresentationChange('presentation-1', { views: [{ viewId: 'view-1' }, { viewId: 'view-2', transition: 'travel' }] });
		const { controller, submitted } = await mounted({ experience: many });

		await controller.setDefaultView('presentation-1', 'view-2');

		expect(submittedIntent(submitted).payload).toEqual({ views: [{ viewId: 'view-2' }, { viewId: 'view-1', transition: 'cut' }] });
	});
});

describe('R217.S26 — structure commands', () => {
	it('renames a Guide, a View and the Experience through their own intents; empty and unchanged names submit nothing', async () => {
		const { controller, submitted, envelope } = await mounted();

		expect(await controller.renameGuide('guide-1', '  ')).toEqual({ kind: 'refused', message: 'A name is needed' });
		expect(await controller.renameGuide('guide-1', 'Main')).toEqual({ kind: 'accepted' });
		expect(submitted).not.toHaveBeenCalled();

		expect(await controller.renameGuide('guide-1', ' Evening ')).toEqual({ kind: 'accepted' });
		let intent = submittedIntent(submitted);
		expect(intent).toEqual(
			guideUpdateIntent({ envelope, revision: REVISION, ids: { operation: intent.operationId }, experienceId: 'experience-1', guideId: 'guide-1', label: 'Evening' })
		);

		submitted.mockClear();
		await controller.renameView('view-1', 'Keyboard');
		intent = submittedIntent(submitted);
		expect(intent).toEqual(
			viewRenameIntent({ envelope, revision: REVISION, ids: { operation: intent.operationId }, view: envelope.units.camera.data.views[0]!, label: 'Keyboard' })
		);
		// The pose goes back exactly as authored: only the label changes.
		expect(intent.payload).toEqual({ label: 'Keyboard', eye: [0, 1.6, 2], target: [0, 1.4, 0], fov: 54 });

		submitted.mockClear();
		await controller.renameExperience('Afternoon walk');
		intent = submittedIntent(submitted);
		expect(intent.kind).toBe(EXPERIENCE_UPDATE_KIND);
		expect(intent.payload).toEqual({ label: 'Afternoon walk' });
	});

	it('makes a Guide the Opening Guide and moves a Guide’s start, never when it already is', async () => {
		const two = withExperience({
			guides: [
				{ id: 'guide-1', label: 'Main', stopIds: ['stop-1', 'stop-2'], entryStopId: 'stop-1', pacing: 'automatic' as const },
				{ id: 'guide-2', label: 'Short', stopIds: ['stop-2'], entryStopId: 'stop-2', pacing: 'automatic' as const }
			]
		});
		const { controller, submitted } = await mounted({ experience: two });
		expect(await controller.makeOpeningGuide('guide-1')).toBe(false);
		expect(await controller.setGuideStart('stop-1')).toBe(false);
		expect(submitted).not.toHaveBeenCalled();

		await controller.makeOpeningGuide('guide-2');
		expect(submittedIntent(submitted).payload).toEqual({ entryGuideId: 'guide-2' });

		submitted.mockClear();
		await controller.setGuideStart('stop-2');
		const intent = submittedIntent(submitted);
		expect(intent.kind).toBe(EXPERIENCE_GUIDE_UPDATE_KIND);
		expect(intent.payload).toEqual({ entryStopId: 'stop-2' });
		expect(controller.feedback).toEqual({ kind: 'success', text: 'The tour now starts at Stop 2.' });
	});

	it('adds to a chosen Guide at its end, and New Guide makes a new active Guide with this Presentation as Stop 1', async () => {
		const { controller, submitted } = await mounted();
		await controller.addToGuide('presentation-2', 'guide-1');
		let intent = submittedIntent(submitted);
		expect(intent.kind).toBe(EXPERIENCE_STOP_CREATE_KIND);
		expect(intent.payload).toMatchObject({ presentationId: 'presentation-2', guideId: 'guide-1', afterStopId: null });
		expect(experienceFocus.guideId).toBe('guide-1');

		submitted.mockClear();
		expect(await controller.createGuide('presentation-2', '')).toBe(false);
		expect(submitted).not.toHaveBeenCalled();
		await controller.createGuide('presentation-2', 'Short tour');
		intent = submittedIntent(submitted);
		expect(intent.kind).toBe(EXPERIENCE_GUIDE_CREATE_KIND);
		const guide = intent.allocatedIds.find((entry) => entry.kind === 'guide')!.id;
		const stop = intent.allocatedIds.find((entry) => entry.kind === 'stop')!.id;
		expect(intent.payload).toMatchObject({ label: 'Short tour', presentationId: 'presentation-2' });
		expect(experienceFocus.guideId).toBe(guide);
		expect(experienceFocus.subject).toEqual({ kind: 'stop', stopId: stop });
	});

	it('reorders a Presentation’s Views as a permutation and refuses a move that changes nothing', async () => {
		const many = withPresentationChange('presentation-1', { views: [{ viewId: 'view-1' }, { viewId: 'view-2' }] });
		const { controller, submitted } = await mounted({ experience: many });
		expect(await controller.moveView('presentation-1', 'view-1', -1)).toBe(false);
		expect(await controller.moveViewTo('presentation-1', 'view-1', 0)).toBe(false);
		expect(submitted).not.toHaveBeenCalled();
		await controller.moveView('presentation-1', 'view-1', 1);
		const intent = submittedIntent(submitted);
		expect(intent.kind).toBe(EXPERIENCE_PRESENTATION_UPDATE_KIND);
		expect(intent.payload).toEqual({ views: [{ viewId: 'view-2' }, { viewId: 'view-1', transition: 'cut' }] });
	});
});

describe('R217.S26 — removal reads its plan, then runs it once', () => {
	it('previews a Stop removal with the named fallback, then removes it and selects the Guide', async () => {
		const jumping = withExperience({
			stops: [
				{ id: 'stop-1', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'presentation-1', continuation: { kind: 'stop', stopId: 'stop-2', transition: 'travel' } },
				{ id: 'stop-2', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'presentation-2', continuation: { kind: 'end' } }
			]
		});
		const { controller, submitted, envelope } = await mounted({ experience: jumping });
		controller.select({ kind: 'stop', stopId: 'stop-2' });
		const preview = controller.removalPreview({ kind: 'stop', stopId: 'stop-2' });
		expect(preview).toEqual({
			kind: 'ready',
			lines: ['Removes Stop 2. Gallery stays.', 'Stop 1 no longer continues to Stop 2; it follows the Guide order.'],
			chooseDefault: null,
			runnable: true
		});
		expect(submitted).not.toHaveBeenCalled();

		expect(await controller.remove({ kind: 'stop', stopId: 'stop-2' })).toBe(true);
		const intent = submittedIntent(submitted);
		expect(intent).toEqual(
			removeIntent({ envelope, revision: REVISION, ids: { operation: intent.operationId }, experienceId: 'experience-1', subject: 'stop', id: 'stop-2' })
		);
		expect(intent.kind).toBe(EXPERIENCE_STOP_REMOVE_KIND);
		expect(experienceFocus.subject).toEqual({ kind: 'guide', guideId: 'guide-1' });
		expect(controller.feedback).toEqual({ kind: 'success', text: 'Stop 2 removed. Main has 1 Stop.' });
	});

	it('keeps a refused removal disabled with its reason and submits nothing', async () => {
		const single = withExperience({ guides: [{ id: 'guide-1', label: 'Main', stopIds: ['stop-1'], entryStopId: 'stop-1', pacing: 'automatic' as const }] });
		const { controller, submitted } = await mounted({ experience: single });
		expect(controller.removalPreview({ kind: 'stop', stopId: 'stop-1' })).toEqual({
			kind: 'refused',
			reason: 'A Guide keeps at least one Stop — remove the Guide instead'
		});
		expect(await controller.remove({ kind: 'stop', stopId: 'stop-1' })).toBe(false);
		expect(controller.removalPreview({ kind: 'view', presentationId: 'presentation-1', viewId: 'view-1' })).toMatchObject({
			kind: 'refused'
		});
		expect(submitted).not.toHaveBeenCalled();
	});

	it('removing View 1 makes the next View the Default, and names it', async () => {
		const many = withPresentationChange('presentation-1', { views: [{ viewId: 'view-1' }, { viewId: 'view-2' }] });
		const { controller, submitted } = await mounted({ experience: many });
		controller.select({ kind: 'view', viewId: 'view-1', presentationId: 'presentation-1' });
		const asking = controller.removalPreview({ kind: 'view', presentationId: 'presentation-1', viewId: 'view-1' });
		expect(asking).toMatchObject({ kind: 'ready', chooseDefault: [{ id: 'view-2', label: 'Gallery' }], runnable: true });
		expect(asking.kind === 'ready' && asking.lines).toContain('Gallery becomes the Default View.');
		expect(submitted).not.toHaveBeenCalled();

		const chosen = controller.removalPreview({ kind: 'view', presentationId: 'presentation-1', viewId: 'view-1', newDefaultViewId: 'view-2' });
		expect(chosen).toMatchObject({ kind: 'ready', runnable: true });
		// view-1 is listed only by presentation-1, so its Camera View goes too.
		expect(chosen.kind === 'ready' && chosen.lines).toContain('Gallery becomes the Default View.');
		await controller.remove({ kind: 'view', presentationId: 'presentation-1', viewId: 'view-1', newDefaultViewId: 'view-2' });
		const intent = submittedIntent(submitted);
		expect(intent.payload).toEqual({ viewId: 'view-1', defaultViewId: 'view-2' });
		expect(experienceFocus.subject).toEqual({ kind: 'presentation', presentationId: 'presentation-1' });
	});

	it('names a shared View as still used instead of deleting it', async () => {
		const shared = withPresentationChange('presentation-1', { views: [{ viewId: 'view-1' }, { viewId: 'view-2' }] });
		const { controller } = await mounted({ experience: shared });
		const preview = controller.removalPreview({ kind: 'view', presentationId: 'presentation-1', viewId: 'view-2' });
		expect(preview.kind === 'ready' && preview.lines).toEqual([
			'Removes Gallery from Piano.',
			'Gallery stays: still used by Gallery.'
		]);
	});
});

describe('R217.S26 — Back (E17)', () => {
	it('returns to the previous subject, skips one that no longer resolves, and submits nothing', async () => {
		const { controller, submitted } = await mounted();
		expect(controller.backTarget).toBeNull();
		controller.select({ kind: 'stop', stopId: 'stop-2' });
		controller.select({ kind: 'view', viewId: 'view-1', presentationId: 'presentation-1' });
		expect(controller.backTarget).toEqual({ kind: 'stop', stopId: 'stop-2' });
		expect(controller.subjectName({ kind: 'stop', stopId: 'stop-2' })).toBe('Stop 2');
		expect(controller.back()).toBe(true);
		expect(experienceFocus.subject).toEqual({ kind: 'stop', stopId: 'stop-2' });
		expect(controller.back()).toBe(false);

		// A removed subject is never returned to.
		experienceFocus.select({ kind: 'stop', stopId: 'stop-gone' });
		experienceFocus.select({ kind: 'presentation', presentationId: 'presentation-2' });
		expect(controller.backTarget).toEqual({ kind: 'stop', stopId: 'stop-2' });
		expect(submitted).not.toHaveBeenCalled();
	});

	it('keeps at most 40 earlier subjects', () => {
		experienceFocus.reset();
		for (let index = 0; index < 50; index += 1) experienceFocus.select({ kind: 'stop', stopId: `stop-${index}` });
		expect(experienceFocus.history).toHaveLength(40);
		expect(experienceFocus.history[0]).toEqual({ kind: 'stop', stopId: 'stop-9' });
	});
});

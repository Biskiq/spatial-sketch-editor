// @vitest-environment jsdom
/**
 * The Experience lens controller (R217.S24, R217.S25).
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
	presentationUpdateIntent,
	stopCreateIntent,
	stopUpdateIntent
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
		expect(controller.message).toBe('Accepted.');
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
			stops: [...EXPERIENCE.experiences[0]!.stops, { id: 'stop-3', presentationId: 'presentation-1' }],
			guides: [{ id: 'guide-1', label: 'Main', stopIds: ['stop-1', 'stop-2', 'stop-3'], entryStopId: 'stop-1' }]
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
			experience: withExperience({ entryGuideId: null, guides: [], stops: [] })
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
	it('sends only the hold', async () => {
		const { controller, submitted, envelope } = await mounted();

		expect(await controller.setStopHold('stop-1', 2)).toBe(true);

		const intent = submittedIntent(submitted);
		expect(intent.kind).toBe(EXPERIENCE_STOP_UPDATE_KIND);
		expect(intent.payload).toEqual({ holdSeconds: 2 });
		expect(intent).toEqual(
			stopUpdateIntent({
				envelope,
				revision: REVISION,
				ids: { operation: intent.operationId },
				experienceId: 'experience-1',
				stopId: 'stop-1',
				holdSeconds: 2
			})
		);
	});

	it('clears the hold with null, and refuses a hold that is not a finite non-negative number', async () => {
		const { controller, submitted } = await mounted();

		await controller.setStopHold('stop-1', null);
		expect(submittedIntent(submitted).payload).toEqual({ holdSeconds: null });

		submitted.mockClear();
		expect(await controller.setStopHold('stop-1', -1)).toBe(false);
		expect(await controller.setStopHold('stop-1', Number.NaN)).toBe(false);
		expect(submitted).not.toHaveBeenCalled();
		expect(controller.message).toBe('A hold is a finite number of seconds, or blank for none.');
	});

	it('sends only the entry View, and null to follow the Default', async () => {
		const { controller, submitted } = await mounted();

		await controller.setStopEntry('stop-1', 'view-1');
		expect(submittedIntent(submitted).payload).toEqual({ entryViewId: 'view-1' });

		submitted.mockClear();
		await controller.setStopEntry('stop-1', null);
		expect(submittedIntent(submitted).payload).toEqual({ entryViewId: null });
	});

	it('changes where Next goes and keeps the transition', async () => {
		const { controller, submitted } = await mounted();

		await controller.setContinuation('stop-1', 'end');
		expect(submittedIntent(submitted).payload).toEqual({ continuation: { kind: 'end' } });

		submitted.mockClear();
		await controller.setContinuation('stop-1', { stopId: 'stop-2' });
		expect(submittedIntent(submitted).payload).toEqual({
			continuation: { kind: 'stop', stopId: 'stop-2', transition: 'travel' }
		});

		submitted.mockClear();
		await controller.setContinuation('stop-1', 'next');
		expect(submittedIntent(submitted).payload).toEqual({
			continuation: { kind: 'sequence-next', transition: 'travel' }
		});
	});

	it('changes the transition and keeps the target', async () => {
		const jump = withExperience({
			stops: [
				{ id: 'stop-1', presentationId: 'presentation-1', continuation: { kind: 'stop', stopId: 'stop-2' } },
				{ id: 'stop-2', presentationId: 'presentation-2', continuation: { kind: 'end' } }
			]
		});
		const { controller, submitted } = await mounted({ experience: jump });

		await controller.setTransition('stop-1', 'travel');

		expect(submittedIntent(submitted).payload).toEqual({
			continuation: { kind: 'stop', stopId: 'stop-2', transition: 'travel' }
		});
	});

	it('writes sequence-next for a Stop whose continuation reads as unauthored', async () => {
		// The accepted source normalises a missing continuation, so the controller sees the
		// authored default (a cut sequence-next) and the edit rewrites it.
		const bare = withExperience({
			stops: [
				{ id: 'stop-1', presentationId: 'presentation-1' },
				{ id: 'stop-2', presentationId: 'presentation-2' }
			]
		});
		const { controller, submitted } = await mounted({ experience: bare });

		await controller.setTransition('stop-1', 'travel');

		expect(submittedIntent(submitted).payload).toEqual({
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
				{ id: 'stop-1', presentationId: 'presentation-1', continuation: { kind: 'sequence-next', transition: 'cut' } },
				{ id: 'stop-2', presentationId: 'presentation-2' }
			]
		});
		const { controller, submitted } = await mounted({ experience: implicit });

		expect(controller.resolveContinuation('stop-2')).toMatchObject({ kind: 'end', explicit: false });
		expect(await controller.setTransition('stop-2', 'travel')).toBe(false);
		expect(submitted).not.toHaveBeenCalled();

		expect(await controller.setTransition('stop-1', 'travel')).toBe(true);
		expect(submittedIntent(submitted).payload).toEqual({
			continuation: { kind: 'sequence-next', transition: 'travel' }
		});
	});

	it('names an unknown Stop as no change', async () => {
		const { controller, submitted } = await mounted();

		expect(await controller.setStopHold('missing', 1)).toBe(false);
		expect(await controller.setContinuation('missing', 'end')).toBe(false);
		expect(await controller.setTransition('missing', 'cut')).toBe(false);
		expect(submitted).not.toHaveBeenCalled();
	});
});

describe('Capture (D1, D2)', () => {
	it('captures into the selected Presentation and sends its existing Default so it is kept', async () => {
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
				}),
				defaultViewId: 'view-1'
			})
		);
		expect((intent.payload as { defaultViewId?: string }).defaultViewId).toBe('view-1');
		expect(controller.message).toBe('Accepted.');
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
		expect((intent.payload as { defaultViewId?: string }).defaultViewId).toBe('view-2');
	});

	it('omits the Default when there is none, so the new View fills it, and says so', async () => {
		const unset = withPresentationChange('presentation-2', { defaultViewId: null });
		const noStops: ExperienceUnitPayload = {
			...unset,
			experiences: unset.experiences.map((experience) => ({
				...experience,
				stops: experience.stops.filter((stop) => stop.presentationId !== 'presentation-2'),
				guides: [{ id: 'guide-1', label: 'Main', stopIds: ['stop-1'], entryStopId: 'stop-1' }]
			}))
		};
		const { controller, submitted } = await mounted({
			experience: noStops,
			evaluation: perspectiveReading().evaluation
		});
		controller.select({ kind: 'presentation', presentationId: 'presentation-2' });

		expect(await controller.capture()).toBe(true);

		const intent = submittedIntent(submitted);
		expect('defaultViewId' in (intent.payload as object)).toBe(false);
		expect(controller.message).toBe('Gallery had no Default View, so this View is now its Default.');
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
		expect(unevaluated.controller.message).toBe(
			'The Stage has not evaluated a reading yet; wait for the reading to settle.'
		);
		expect(unevaluated.controller.subject).toEqual({ kind: 'presentation', presentationId: 'presentation-1' });
		unevaluated.dispose();

		const plan = await mounted({
			evaluation: { projectionKind: 'orthographic', projectionMatrix: [], eye: [], target: [] }
		});
		expect(await plan.controller.capture()).toBe(false);
		expect(plan.submitted).not.toHaveBeenCalled();
		expect(plan.controller.message).toBe('Capture needs the 3D reading: switch to 3D, frame the View, then capture.');
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
	const noGuide = withExperience({ entryGuideId: null, stops: [], guides: [] });

	it('needs a trimmed Guide name before it creates the first Guide', async () => {
		const { controller, submitted } = await mounted({ experience: noGuide });
		controller.select({ kind: 'presentation', presentationId: 'presentation-1' });

		expect(await controller.addStop('presentation-1')).toBe(false);
		expect(await controller.addStop('presentation-1', { firstGuideLabel: '   ' })).toBe(false);

		expect(submitted).not.toHaveBeenCalled();
		expect(controller.message).toBe('Name the Guide first.');
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
				holdSeconds: null,
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
				holdSeconds: null,
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
			stops: [...EXPERIENCE.experiences[0]!.stops, { id: 'stop-3', presentationId: 'presentation-1' }]
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
		expect(controller.message).toBe('Accepted.');
	});

	it('names a refusal as its code and message, focuses nothing new and clears busy', async () => {
		const { controller } = await mounted({
			accept: async () => ({
				kind: 'refused',
				code: 'stale-session',
				message: 'the snapshot belongs to another host lifetime'
			}) as unknown as Outcome
		});

		await controller.createExperience();

		expect(controller.message).toBe('stale-session: the snapshot belongs to another host lifetime');
		expect(controller.busy).toBe(false);
		expect(experienceFocus.experienceId).toBe('experience-1');
	});

	it('reports an outcome that changed nothing as no change', async () => {
		const { controller } = await mounted({
			accept: async () => ({ kind: 'no-op', revision: REVISION }) as unknown as Outcome
		});

		await controller.setDefaultView('presentation-1', 'view-1');
		expect(controller.message).toBe('No change to accept.');
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
		expect(controller.reach()).toEqual({ presentations: 2, views: 2, viewsOnlyFree: 0 });

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
			experience: withExperience({ entryGuideId: null, guides: [], stops: [] })
		});
		flush();

		expect(controller.contextGuide).toBeNull();
		expect(controller.guideStops).toEqual([]);
		expect(controller.viewStops('view-2')).toEqual([]);
		expect(controller.reach()).toEqual({ presentations: 2, views: 2, viewsOnlyFree: 2 });
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
		expect(controller.reach()).toEqual({ presentations: 2, views: 2, viewsOnlyFree: 0 });
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
				{ id: 'experience-2', label: 'Second', entryGuideId: null, presentations: [], stops: [], guides: [], gates: [], detours: [] }
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

			await mount.controller.setStopHold('stop-1', 1);
			await mount.controller.createExperience();

			expect(submitted).toHaveBeenCalledTimes(2);
			expect(mount.controller.message).toBe('Accepted.');
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

		expect(outcome).toEqual({ kind: 'refused', message: 'stale: The source changed.' });
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

	it('Make default sends only the Default View', async () => {
		const { controller, submitted } = await mounted();

		await controller.setDefaultView('presentation-1', 'view-1');

		expect(submittedIntent(submitted).payload).toEqual({ defaultViewId: 'view-1' });
	});
});

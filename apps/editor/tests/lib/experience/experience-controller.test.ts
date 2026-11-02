// @vitest-environment jsdom
/**
 * The Experience lens controller (R217.S24).
 *
 * ExperienceSurface.svelte kept its commands, derived reading, message, busy flag and
 * drafts inline. They now live in createExperienceController, which must keep three
 * properties: each command is the intent commands.ts builds and goes through the one
 * acceptance port; busy and message report what that port returned; and the module
 * runs with no DOM at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	EXPERIENCE_CAPTURE_BIND_KIND,
	EXPERIENCE_GUIDE_ORDER_KIND,
	EXPERIENCE_STOP_UPDATE_KIND,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { experienceFocus } from '$lib/authoring/experience/focus.svelte';
import {
	captureBindIntent,
	capturedFovDegrees,
	capturedViewPose,
	createExperienceIntent,
	guideOrderIntent,
	stopUpdateIntent
} from '$lib/authoring/experience/commands';
import { travelGapMessages } from '$lib/authoring/experience/travel-gap';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { mountExperienceController, snapshotCell } from './__fixtures__/experience-controller-root.svelte';
import { EXPERIENCE, experienceEnvelope } from './fixtures';

type Accept = StageAdapterServices['authoring']['accept'];
type Outcome = Awaited<ReturnType<Accept>>;

const REVISION = { projectId: 'project-1', revisionId: 'revision-1' };

function installed(): Outcome {
	return { kind: 'installed', install: {} as never, selectionClearedReason: null };
}

/** The Stage and acceptance ports the controller reads, with the accept outcome under test. */
function servicesFor(accept: Accept = async () => installed(), evaluation: unknown = null) {
	const submitted = vi.fn<Accept>(accept);
	const services = {
		stage: {
			snapshot: () => ({ acceptedRevision: REVISION }),
			onAdaptersChanged: () => () => {},
			selectionState: () => ({ primary: null }),
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
		const envelope = await experienceEnvelope();
		const { services, submitted } = servicesFor();
		const mounted = mountExperienceController(() => services, () => envelope);
		dispose = mounted.dispose;

		await mounted.controller.createExperience();

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
		expect(mounted.controller.message).toBe('Accepted.');
	});

	it('submits a Stop edit as the stop-update intent built from the drafts', async () => {
		const envelope = await experienceEnvelope();
		const { services, submitted } = servicesFor();
		const mounted = mountExperienceController(() => services, () => envelope);
		dispose = mounted.dispose;
		experienceFocus.selectStop('stop-1');
		mounted.flush();
		mounted.controller.drafts.stopTarget = 'end';
		mounted.controller.drafts.stopHold = '2';

		await mounted.controller.saveStop();

		const intent = submittedIntent(submitted);
		expect(intent.kind).toBe(EXPERIENCE_STOP_UPDATE_KIND);
		expect(intent).toEqual(
			stopUpdateIntent({
				envelope,
				revision: REVISION,
				ids: { operation: intent.operationId },
				experienceId: 'experience-1',
				stopId: 'stop-1',
				entryViewId: null,
				holdSeconds: 2,
				continuation: { kind: 'end' }
			})
		);
	});

	it('reorders a Guide with the guide-order intent and nothing else', async () => {
		const envelope = await experienceEnvelope();
		const { services, submitted } = servicesFor();
		const mounted = mountExperienceController(() => services, () => envelope);
		dispose = mounted.dispose;
		experienceFocus.openGuide('guide-1', 'stop-1');
		mounted.flush();

		await mounted.controller.moveStop('stop-2', -1);

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

	it('captures the Stage framing as a View and binds the Presentation through the capture-bind intent', async () => {
		const envelope = await experienceEnvelope();
		const projection = new Array<number>(16).fill(0);
		projection[5] = 1 / Math.tan((54 * Math.PI) / 360);
		const evaluation = {
			projectionKind: 'perspective-3d',
			projectionMatrix: projection,
			eye: [0, 1.6, 2],
			target: [0, 1.4, 0]
		};
		const { services, submitted } = servicesFor(undefined, evaluation);
		const mounted = mountExperienceController(() => services, () => envelope);
		dispose = mounted.dispose;

		await mounted.controller.captureAndBind();

		const intent = submittedIntent(submitted);
		expect(intent.kind).toBe(EXPERIENCE_CAPTURE_BIND_KIND);
		const view = intent.allocatedIds.find((entry) => entry.kind === 'view')!.id;
		const presentation = intent.allocatedIds.find((entry) => entry.kind === 'presentation')!.id;
		const fov = capturedFovDegrees(projection)!;
		expect(intent).toEqual(
			captureBindIntent({
				envelope,
				revision: REVISION,
				ids: { operation: intent.operationId, view, presentation },
				experienceId: 'experience-1',
				view: capturedViewPose({ label: 'View 3', eye: [0, 1.6, 2], target: [0, 1.4, 0], fov }),
				presentationLabel: 'Presentation 3',
				subjectEntityId: null,
				text: null,
				guideId: null,
				firstGuideLabel: null,
				afterStopId: null
			})
		);
	});

	it('focuses a Guide through the one controller action and clears it on None', async () => {
		const envelope = await experienceEnvelope();
		const { services } = servicesFor();
		const mounted = mountExperienceController(() => services, () => envelope);
		dispose = mounted.dispose;

		mounted.controller.chooseGuide('guide-1');
		expect(experienceFocus.guideId).toBe('guide-1');
		expect(experienceFocus.stopId).toBe('stop-1');
		expect(mounted.controller.currentGuide?.id).toBe('guide-1');

		mounted.controller.chooseGuide('');
		expect(experienceFocus.guideId).toBeNull();
		expect(experienceFocus.stopId).toBeNull();
	});
});

describe('busy and message', () => {
	it('is busy while a command is in flight and refuses the next one without submitting it', async () => {
		const envelope = await experienceEnvelope();
		let release: (outcome: Outcome) => void = () => {};
		const { services, submitted } = servicesFor(
			() => new Promise<Outcome>((resolve) => (release = resolve))
		);
		const mounted = mountExperienceController(() => services, () => envelope);
		dispose = mounted.dispose;

		const pending = mounted.controller.createExperience();
		expect(mounted.controller.busy).toBe(true);
		await mounted.controller.setDefaultView('presentation-1', 'view-1');
		expect(submitted).toHaveBeenCalledTimes(1);

		release(installed());
		await pending;
		expect(mounted.controller.busy).toBe(false);
		expect(mounted.controller.message).toBe('Accepted.');
	});

	it('names a refusal as its code and message, focuses nothing new and clears busy', async () => {
		const envelope = await experienceEnvelope();
		const { services } = servicesFor(async () => ({
			kind: 'refused',
			code: 'stale-session',
			message: 'the snapshot belongs to another host lifetime'
		}));
		const mounted = mountExperienceController(() => services, () => envelope);
		dispose = mounted.dispose;

		await mounted.controller.createExperience();

		expect(mounted.controller.message).toBe('stale-session: the snapshot belongs to another host lifetime');
		expect(mounted.controller.busy).toBe(false);
		expect(experienceFocus.experienceId).toBe('experience-1');
	});

	it('reports an outcome that changed nothing as no change', async () => {
		const envelope = await experienceEnvelope();
		const { services } = servicesFor(async () => ({ kind: 'no-op', revision: REVISION }));
		const mounted = mountExperienceController(() => services, () => envelope);
		dispose = mounted.dispose;

		const accepted = await mounted.controller.setDefaultView('presentation-1', 'view-1').then(() => mounted.controller.message);
		expect(accepted).toBe('No change to accept.');
	});

	it('writes nothing for a hold that is not a finite non-negative number, and says why', async () => {
		const envelope = await experienceEnvelope();
		const { services, submitted } = servicesFor();
		const mounted = mountExperienceController(() => services, () => envelope);
		dispose = mounted.dispose;
		experienceFocus.selectStop('stop-1');
		mounted.flush();
		mounted.controller.drafts.stopHold = '-1';

		await mounted.controller.saveStop();

		expect(submitted).not.toHaveBeenCalled();
		expect(mounted.controller.message).toBe('A hold is a finite number of seconds, or blank for none.');
	});

	it('refuses a capture before acceptance when the Stage shows no 3D reading', async () => {
		const envelope = await experienceEnvelope();
		const unevaluated = servicesFor();
		const unevaluatedMount = mountExperienceController(() => unevaluated.services, () => envelope);
		dispose = unevaluatedMount.dispose;

		await unevaluatedMount.controller.captureAndBind();
		expect(unevaluated.submitted).not.toHaveBeenCalled();
		expect(unevaluatedMount.controller.message).toBe(
			'The Stage has not evaluated a reading yet; wait for the reading to settle.'
		);

		const plan = servicesFor(undefined, { projectionKind: 'orthographic', projectionMatrix: [], eye: [], target: [] });
		const planMount = mountExperienceController(() => plan.services, () => envelope);
		dispose = planMount.dispose;
		await planMount.controller.captureAndBind();
		expect(plan.submitted).not.toHaveBeenCalled();
		expect(planMount.controller.message).toBe('Capture needs the 3D reading: switch to 3D, frame the View, then capture.');
	});
});

describe('derived reading and the route-supplied ports', () => {
	it('adopts the first Experience as focus and reads its Guide, Stops and Presentation filter', async () => {
		const envelope = await experienceEnvelope();
		const { services } = servicesFor();
		const mounted = mountExperienceController(() => services, () => envelope);
		dispose = mounted.dispose;
		experienceFocus.openGuide('guide-1', 'stop-1');
		mounted.flush();

		const { controller } = mounted;
		expect(experienceFocus.experienceId).toBe('experience-1');
		expect(controller.current?.id).toBe('experience-1');
		expect(controller.guideStops.map((stop) => stop.id)).toEqual(['stop-1', 'stop-2']);
		expect(controller.stopUsage.get('presentation-1')).toEqual(['stop-1']);

		controller.query = 'gall';
		expect(controller.filteredPresentations.map((entry) => entry.id)).toEqual(['presentation-2']);
	});

	it('reports the travel gaps of the selected Stop as the travel-gap authority does', async () => {
		const envelope = await experienceEnvelope();
		const { services } = servicesFor();
		const mounted = mountExperienceController(() => services, () => envelope);
		dispose = mounted.dispose;
		experienceFocus.selectStop('stop-1');
		mounted.flush();

		expect(mounted.controller.travelGaps).toEqual(travelGapMessages(envelope, 'experience-1', 'stop-1'));
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
		const mounted = mountExperienceController(() => services, () => cell.value);
		dispose = mounted.dispose;
		expect(mounted.controller.experiences.map((entry) => entry.id)).toEqual(['experience-1']);

		cell.value = replaced;
		services = next.services;
		mounted.flush();
		expect(mounted.controller.experiences.map((entry) => entry.id)).toEqual(['experience-1', 'experience-2']);

		await mounted.controller.createExperience();
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
			const mounted = mountExperienceController(() => services, () => envelope);
			dispose = mounted.dispose;
			experienceFocus.selectStop('stop-1');
			mounted.flush();
			mounted.controller.drafts.stopHold = '1';

			await mounted.controller.saveStop();
			await mounted.controller.createExperience();

			expect(submitted).toHaveBeenCalledTimes(2);
			expect(mounted.controller.message).toBe('Accepted.');
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

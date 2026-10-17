/**
 * The session host owns the facts that must not survive a project replacement.
 *
 * The contract is an **order**, not a set of flags: validate first, then cancel
 * writers atomically, then clear the old context, then swap. Three failures this
 * suite exists to catch are the ones a flag-shaped implementation hides:
 *
 * - a replacement that cancels writers *before* the new source is admitted, so a
 *   failed admission has already destroyed live work;
 * - a writer registered before the replacement that stays `isCurrent` afterwards,
 *   so a stale load, ray or Camera completion installs into the new project;
 * - a teardown that runs a disposer twice, or strands the ones after a throw.
 *
 * The content-change transition is pinned beside it, because the difference is the
 * point: the same project with new content keeps its epoch and its live writers,
 * while a replacement moves both.
 */
import { describe, expect, it } from 'vitest';
import { VIEWPORT_READING_TRANSITION_SECONDS } from '@portfolio/camera-core';
import { createEmptyWallFirstLayoutDocument, planWallChain, type LayoutVec2 } from '@portfolio/layout-core';
import { createEmptyWorldLocalSceneDocument, type ProjectDocument } from '@portfolio/project-model';
import {
	admitSource,
	type AdmissionContext,
	type StageReadSnapshot
} from '$lib/authoring/stage/source-admission';
import { createCameraSession } from '$lib/authoring/stage/camera-session';
import {
	createCancellationRegistry,
	createStageSession,
	type StageSession
} from '$lib/authoring/stage/stage-session';

const PROJECT_ID = 'project-session';
const OTHER_PROJECT_ID = 'project-session-other';

function enclosureProject(id: string, scale: number = 1): ProjectDocument {
	const points: LayoutVec2[] = [
		[0, -4 * scale],
		[7 * scale, -4 * scale],
		[7 * scale, 2 * scale],
		[0, 2 * scale]
	];
	const plan = planWallChain({
		baseline: createEmptyWallFirstLayoutDocument(),
		points,
		close: true,
		role: 'boundary'
	});
	if (plan.kind !== 'success') throw new Error(`the enclosure no longer plans: ${plan.rejection.code}`);
	return {
		id,
		name: 'Session project',
		layout: plan.document,
		scene: createEmptyWorldLocalSceneDocument()
	};
}

let revisionCounter = 0;

async function admit(
	document: ProjectDocument,
	projectId: string = document.id,
	sessionEpoch?: string
): Promise<StageReadSnapshot> {
	revisionCounter += 1;
	const context: AdmissionContext = {
		sessionEpoch: sessionEpoch ?? `session-${revisionCounter}`,
		acceptedRevision: { projectId, revisionId: `revision-${revisionCounter}` }
	};
	const admitted = await admitSource(document, context);
	if (admitted.kind !== 'admitted') throw new Error(`the fixture source was not admitted: ${admitted.kind}`);
	return admitted.snapshot;
}

describe('stage session — one replacement epoch and one teardown', () => {
	it('cancels every registered writer exactly once and clears the replaced context', async () => {
		const session = createStageSession({ sessionEpoch: 'session-1' });
		const first = await admit(enclosureProject(PROJECT_ID));
		session.replace(first);
		expect(session.current()).toBe(first);

		const cancelled: string[] = [];
		const token = session.token();
		session.writers().register('load', token, () => cancelled.push('load'));
		session.writers().register('gesture', token, () => cancelled.push('gesture'));
		expect(session.writers().size).toBe(2);

		// A live lease and a generation-bound context exist before the replacement.
		const lease = session.acquireGesture({
			owner: 'stage-pointer',
			evaluationId: 'evaluation-1',
			acceptedRevision: first.acceptedRevision,
			policy: 'continue-after-revalidation'
		});
		expect(lease.kind).toBe('granted');
		session.select({ sourceId: 'wall-1', sourceKind: 'wall', generationId: 'compile:1', ref: null as never });
		session.openTask({ kind: 'subject-membership', label: 'Plan membership', targetRef: null });

		const second = await admit(enclosureProject(OTHER_PROJECT_ID, 0.5), OTHER_PROJECT_ID);
		const result = session.replace(second);

		expect(cancelled.sort()).toEqual(['gesture', 'load']);
		expect(session.writers().size).toBe(0);
		expect(result.cancelledWriters).toBe(2);
		expect(result.clearedSelection).toBe(true);
		expect(result.closedTask).toBe(true);
		expect(result.releasedGestures).toBe(1);
		expect(result.token.epoch).toBeGreaterThan(result.previousToken.epoch);
		expect(result.token.sessionEpoch).not.toBe(result.previousToken.sessionEpoch);
		expect(session.current()).toBe(second);
		expect(session.selection()).toBeNull();
		expect(session.task()).toBeNull();
		expect(session.gesture()).toBeNull();

		// The pre-replacement token is stale, so a completion started under it cannot
		// install; a writer registered after the swap is current.
		expect(session.isCurrent(token)).toBe(false);
		expect(session.isCurrent(session.token())).toBe(true);
	});

	it('keeps the epoch and the live writers across a content change for the same project', async () => {
		const session = createStageSession({ sessionEpoch: 'session-1' });
		const first = await admit(enclosureProject(PROJECT_ID));
		session.replace(first);
		const token = session.token();
		let cancelled = 0;
		session.writers().register('load', token, () => {
			cancelled += 1;
		});
		session.select({ sourceId: 'wall-1', sourceKind: 'wall', generationId: 'compile:1', ref: null as never });

		// A content change is admitted under the session's own epoch: it is the same
		// host lifetime, and the session refuses a snapshot from another one.
		const changed = await admit(enclosureProject(PROJECT_ID, 0.5), PROJECT_ID, session.sessionEpoch);
		const install = session.installAccepted(changed);

		expect(install.kind).toBe('installed');
		if (install.kind !== 'installed') return;
		expect(install.previousSourceContentId).toBe(first.sourceContentId);
		expect(install.sourceContentId).toBe(changed.sourceContentId);
		expect(install.clearedSelection).toBe(true);
		expect(install.closedTask).toBe(false);
		expect(install.releasedGestures).toBe(0);
		// No replacement happened: the same token is still current and the writer
		// that was registered under it was not cancelled.
		expect(session.token()).toEqual(token);
		expect(session.isCurrent(token)).toBe(true);
		expect(cancelled).toBe(0);
		expect(session.writers().size).toBe(1);
		expect(session.current()).toBe(changed);

		// Identical content is not a content change either.
		expect(
			session.installAccepted(
				await admit(enclosureProject(PROJECT_ID, 0.5), PROJECT_ID, session.sessionEpoch)
			)
		).toEqual({ kind: 'unchanged', sourceContentId: changed.sourceContentId });
		// A different project identity is a replacement, and the session refuses to
		// pretend otherwise.
		const other = await admit(enclosureProject(OTHER_PROJECT_ID), OTHER_PROJECT_ID);
		expect(session.installAccepted(other)).toEqual({
			kind: 'refused',
			code: 'different-project',
			message: expect.stringContaining('replacement')
		});
		expect(session.current()).toBe(changed);
	});

	it('runs every disposer exactly once at teardown, even when one throws', async () => {
		const session = createStageSession({ sessionEpoch: 'session-1' });
		session.replace(await admit(enclosureProject(PROJECT_ID)));
		let first = 0;
		let second = 0;
		session.addDisposable(() => {
			first += 1;
			throw new Error('this disposer fails');
		});
		session.addDisposable(() => {
			second += 1;
		});
		const token = session.token();
		session.writers().register('camera', token, () => undefined);

		session.dispose();
		expect(first).toBe(1);
		expect(second).toBe(1);
		expect(session.writers().size).toBe(0);
		expect(session.current()).toBeNull();
		expect(session.selection()).toBeNull();
		expect(session.openTask({ kind: 'subject-membership', label: 'x', targetRef: null })).toBe(false);
		expect(session.acquireGesture({
			owner: 'late',
			evaluationId: 'evaluation-1',
			acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-late' },
			policy: 'suspend-proposal'
		}).kind).toBe('refused');

		// Teardown is idempotent: a second dispose runs no disposer again.
		session.dispose();
		expect(first).toBe(1);
		expect(second).toBe(1);
	});

	it('cancels every writer even when one canceller throws', () => {
		const registry = createCancellationRegistry();
		const token = { sessionEpoch: 'session-1', epoch: 0 };
		const cancelled: string[] = [];
		registry.register('load', token, () => {
			cancelled.push('load');
			throw new Error('this canceller fails');
		});
		registry.register('task', token, () => cancelled.push('task'));

		expect(registry.cancelAll('teardown')).toBe(2);
		expect(cancelled.sort()).toEqual(['load', 'task']);
		expect(registry.size).toBe(0);
	});
});

describe('stage session — the reduced-motion endpoint rule', () => {
	it('settles at the declared reading endpoint when the clock is unbounded', async () => {
		const session = createStageSession({ sessionEpoch: 'session-1' });
		session.replace(await admit(enclosureProject(PROJECT_ID)));
		const snapshot = session.current()!;
		const camera = createCameraSession({ snapshot, viewportId: 'stage', outputId: 'output:test' });
		const rect = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

		// The ordinary transition is genuinely projective: half way through it the
		// output is neither reading, and its own weight says so.
		camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, 1);
		const midflight = camera.evaluate(rect, 1 + VIEWPORT_READING_TRANSITION_SECONDS / 2);
		expect(midflight.kind).toBe('evaluated');
		if (midflight.kind !== 'evaluated') return;
		expect(midflight.evaluation.projectionKind).toBe('projective-transition');
		expect(midflight.evaluation.renderedReading).toBe('transition');
		expect(midflight.evaluation.orthographicWeight).toBeGreaterThan(0);
		expect(midflight.evaluation.orthographicWeight).toBeLessThan(1);

		// Reduced motion cuts to the same declared endpoint through the one settling
		// rule, rather than taking a shortened tween: an unbounded clock is already
		// at the endpoint, and Plan is exactly orthographic there.
		camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, Number.POSITIVE_INFINITY);
		const settled = camera.evaluate(rect, Number.POSITIVE_INFINITY);
		expect(settled.kind).toBe('evaluated');
		if (settled.kind !== 'evaluated') return;
		expect(settled.evaluation.settledReading).toBe('plan');
		expect(settled.evaluation.renderedReading).toBe('plan');
		expect(settled.evaluation.projectionKind).toBe('plan-orthographic');
		expect(settled.evaluation.orthographicWeight).toBe(1);
	});
});

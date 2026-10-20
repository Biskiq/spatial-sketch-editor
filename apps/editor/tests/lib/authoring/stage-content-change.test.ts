/**
 * The post-edit Camera-output path (T1.P01.S02 acceptance).
 *
 * S02 ships before any editing command exists, so the path is exercised here by
 * installing a content-changed source through the host's one accepted-source slot.
 * Four claims are pinned:
 *
 * 1. a **content change** keeps the view exactly where it is: the same pose, and
 *    the host's own inspection claim re-acquired for the new source revision;
 * 2. identical content changes nothing at all — the live claim stays in place;
 * 3. a prior-epoch completion cannot install: the ticket the rebase ended is
 *    `superseded` for every intent, and a retained ticket from a replaced session
 *    is refused by the landed ticket protocol rather than by a field comparison;
 * 4. a content change is not a replacement: the session epoch and the output
 *    identity survive it, while a different project identity is refused and must
 *    be mounted as a replacement.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	type LayoutVec2
} from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import {
	admitSource,
	type AdmissionContext,
	type StageReadSnapshot
} from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';

const PROJECT_ID = 'project-content-change';
const OTHER_PROJECT_ID = 'project-other';
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

const FIRST_ENCLOSURE: readonly LayoutVec2[] = [
	[0, -4],
	[7, -4],
	[7, 2],
	[0, 2]
];
/** The same project with different content: a smaller, shifted enclosure. */
const CHANGED_ENCLOSURE: readonly LayoutVec2[] = [
	[1, -3],
	[5, -3],
	[5, 1],
	[1, 1]
];

async function enclosureProject(points: readonly LayoutVec2[], id: string = PROJECT_ID): Promise<ProjectEnvelope> {
	const plan = planWallChain({
		baseline: createEmptyWallFirstLayoutDocument(),
		points: points.map((point) => [point[0], point[1]] as LayoutVec2),
		close: true,
		role: 'boundary'
	});
	if (plan.kind !== 'success') throw new Error(`the enclosure no longer plans: ${plan.rejection.code}`);
	return createUnitProject({ id, name: 'Content change project', layout: plan.document });
}

let revisionCounter = 0;

function admissionContext(projectId: string): AdmissionContext {
	revisionCounter += 1;
	return {
		sessionEpoch: `session-${revisionCounter}`,
		acceptedRevision: { projectId, revisionId: `revision-${revisionCounter}` }
	};
}

async function admit(
	document: ProjectEnvelope,
	projectId: string = document.id,
	sessionEpoch?: string
): Promise<StageReadSnapshot> {
	const context = admissionContext(projectId);
	const admitted = await admitSource(document, sessionEpoch === undefined ? context : { ...context, sessionEpoch });
	if (admitted.kind !== 'admitted') throw new Error(`the fixture source was not admitted: ${admitted.kind}`);
	return admitted.snapshot;
}

type Mounted = {
	readonly facade: StageFacade;
	readonly session: StageSession;
	readonly snapshot: StageReadSnapshot;
};

/** The host's own mount order for a first (or replacement) mount. */
async function mount(document?: ProjectEnvelope): Promise<Mounted> {
	const snapshot = await admit(document ?? (await enclosureProject(FIRST_ENCLOSURE)));
	const session = createStageSession({ sessionEpoch: snapshot.sessionEpoch });
	session.replace(snapshot);
	const facade = createStageFacade({ snapshot, session });
	facade.acquireInspection('exclusive');
	return { facade, session, snapshot };
}

describe('Stage content change — the post-edit Camera-output path', () => {
	it('keeps the view and re-acquires inspection when the same project gets new content', async () => {
		const { facade, session } = await mount();
		const evaluation = facade.camera.evaluate(RECT, 1);
		expect(evaluation.kind).toBe('evaluated');
		const poseBefore = facade.camera.state().pose;
		const ticketBefore = facade.inspectionTicket();
		expect(ticketBefore).not.toBeNull();
		const generationBefore = facade.snapshot().compileGeneration;

		// Work in progress before the change: one selection and one open task, both
		// bound to the compile generation that is about to end.
		const fragment = facade.eligibleFragments()[0]!;
		facade.select({
			sourceId: fragment.ref.sourceId,
			sourceKind: fragment.ref.sourceKind,
			generationId: fragment.ref.generationId,
			ref: fragment.ref
		});
		facade.openTask({ kind: 'subject-membership', label: 'Plan membership', targetRef: fragment.ref });
		const adapter = facade.registerStageAdapter({
			id: 'probe-adapter',
			overlay: () => [{ id: 'probe-marker', css: [1, 2], label: 'probe' }]
		});
		expect(adapter.kind).toBe('registered');

		// A content change is admitted under the *same* host session epoch: it is the
		// same lifetime, so the output, the snapshot and the session keep one identity.
		const next = await admit(await enclosureProject(CHANGED_ENCLOSURE), PROJECT_ID, facade.snapshot().sessionEpoch);
		expect(next.sourceContentId).not.toBe(facade.snapshot().sourceContentId);
		const lease = facade.acquireGesture({
			owner: 'stage-pointer',
			evaluationId: facade.evaluationId() ?? '',
			policy: 'continue-after-revalidation'
		});
		expect(lease.kind).toBe('granted');
		const install = facade.installAccepted(next);

		expect(install.kind).toBe('installed');
		if (install.kind !== 'installed') return;

		// The view did not move, and the output identity survived the source change.
		expect(install.pose).toEqual(poseBefore);
		expect(facade.camera.state().pose).toEqual(poseBefore);
		expect(install.sourceContentId).toBe(next.sourceContentId);
		expect(install.endedClaim?.ticket.runEpoch).toBe(ticketBefore!.runEpoch);
		expect(install.claim?.ticket.runEpoch).toBeGreaterThan(ticketBefore!.runEpoch);
		expect(install.claim?.ticket.sessionEpoch).toBe(ticketBefore!.sessionEpoch);
		expect(install.claim?.ticket.outputId).toBe(ticketBefore!.outputId);
		expect(install.claim?.ticket.sourceRevision).toBe(next.sourceContentId);

		// The generation-bound context is cleared and reported, never left pointing
		// at fragments of a compile that no longer exists.
		expect(install.clearedSelection).toBe(true);
		expect(install.closedTask).toBe(true);
		expect(facade.selection()).toBeNull();
		expect(session.task()).toBeNull();
		// A gesture lease parameterised on the replaced revision cannot legitimately
		// continue without revalidation, which S02 does not have.
		expect(install.releasedGestures).toBe(1);
		expect(session.gesture()).toBeNull();

		// A domain adapter's registration survives the change: a static adapter is not
		// rebound, so it stays registered for the new snapshot. Its contribution needs a
		// live evaluation, which the rebase ended — asserted below, after re-evaluation.
		expect(install.reboundAdapters).toEqual([]);
		expect(facade.adapters().map((entry) => entry.id)).toEqual(['probe-adapter']);
		expect(facade.overlays()).toEqual([]);
		// Without a host-supplied correspondence the selection cannot be requalified,
		// and the reason is reported rather than silently guessed.
		expect(install.requalification).toEqual({ kind: 'cleared', reason: 'no-correspondence' });

		// The Plan and the read facade now describe the new content, under the new
		// generation, and the output names the new source revision once evaluated.
		expect(facade.snapshot().sourceContentId).toBe(next.sourceContentId);
		expect(facade.snapshot().compileGeneration).not.toBe(generationBefore);
		const plan = facade.plan();
		expect(plan.kind).toBe('evaluated');
		if (plan.kind !== 'evaluated') return;
		expect(plan.plan.generationId).toBe(facade.snapshot().compileGeneration);
		expect(facade.evaluation()).toBeNull();
		const reevaluated = facade.camera.evaluate(RECT, 2);
		expect(reevaluated.kind).toBe('evaluated');
		expect(facade.evaluation()?.token.sourceRevision).toBe(next.sourceContentId);
		// The surviving static adapter contributes again as soon as there is an evaluation.
		expect(facade.overlays()).toEqual([{ id: 'probe-marker', css: [1, 2], label: 'probe' }]);

		// The claim the rebase ended cannot install anything, while the re-acquired
		// one drives the output as before.
		expect(facade.requestViewingIntent({ kind: 'zoom', scale: 2 }, ticketBefore, 3).kind).toBe('superseded');
		expect(
			facade.requestViewingIntent({ kind: 'zoom', scale: 2 }, facade.inspectionTicket(), 3).kind
		).toBe('accepted');
	});

	it('leaves the live claim in place when the installed content is identical', async () => {
		const { facade } = await mount();
		const ticketBefore = facade.inspectionTicket();
		expect(ticketBefore).not.toBeNull();

		// Same canonical content, a fresh acceptance revision: nothing about the
		// view, the claim or the selection changes.
		const sameContent = await admit(
			await enclosureProject(FIRST_ENCLOSURE),
			PROJECT_ID,
			facade.snapshot().sessionEpoch
		);
		expect(sameContent.sourceContentId).toBe(facade.snapshot().sourceContentId);
		const install = facade.installAccepted(sameContent);

		expect(install.kind).toBe('unchanged');
		if (install.kind !== 'unchanged') return;
		expect(install.sourceContentId).toBe(ticketBefore!.sourceRevision);
		expect(install.claim?.ticket.runEpoch).toBe(ticketBefore!.runEpoch);
		expect(facade.inspectionTicket()?.runEpoch).toBe(ticketBefore!.runEpoch);
	});

	it('refuses a different project identity: that is a replacement, not a content change', async () => {
		const { facade } = await mount();
		const ticketBefore = facade.inspectionTicket();
		const contentBefore = facade.snapshot().sourceContentId;

		const other = await admit(
			await enclosureProject(CHANGED_ENCLOSURE, OTHER_PROJECT_ID),
			OTHER_PROJECT_ID,
			facade.snapshot().sessionEpoch
		);
		const install = facade.installAccepted(other);

		expect(install).toEqual({
			kind: 'refused',
			code: 'different-project',
			message: expect.stringContaining('replacement')
		});
		expect(facade.snapshot().sourceContentId).toBe(contentBefore);
		expect(facade.inspectionTicket()?.runEpoch).toBe(ticketBefore?.runEpoch);
	});

	it('refuses a content change on a disposed stage and when nothing is mounted', async () => {
		const { facade } = await mount();
		const epoch = facade.snapshot().sessionEpoch;
		facade.dispose();
		const install = facade.installAccepted(await admit(await enclosureProject(CHANGED_ENCLOSURE), PROJECT_ID, epoch));
		expect(install.kind).toBe('refused');
		if (install.kind !== 'refused') return;
		expect(install.code).toBe('disposed');

		// Nothing mounted: a first install is a replacement, and the session says so.
		const session = createStageSession({ sessionEpoch: 'session-empty' });
		const first = await admit(await enclosureProject(FIRST_ENCLOSURE), PROJECT_ID, 'session-empty');
		const fresh = createStageFacade({ snapshot: first, session });
		const firstInstall = fresh.installAccepted(
			await admit(await enclosureProject(CHANGED_ENCLOSURE), PROJECT_ID, 'session-empty')
		);
		expect(firstInstall.kind).toBe('refused');
		if (firstInstall.kind !== 'refused') return;
		expect(firstInstall.code).toBe('no-current-source');
	});

	it('makes a prior session’s completion unable to install after a replacement', async () => {
		const first = await mount();
		const ticketBefore = first.facade.inspectionTicket();
		expect(ticketBefore).not.toBeNull();

		// A replacement: a new session, a snapshot of a different project, a fresh
		// facade and a fresh output state.
		const replacementSnapshot = await admit(
			await enclosureProject(CHANGED_ENCLOSURE, OTHER_PROJECT_ID),
			OTHER_PROJECT_ID
		);
		const session = createStageSession({ sessionEpoch: replacementSnapshot.sessionEpoch });
		session.replace(replacementSnapshot);
		const replacement = createStageFacade({ snapshot: replacementSnapshot, session });
		replacement.acquireInspection('exclusive');

		// The retained ticket names another output in another session, so the landed
		// protocol refuses it even though the host's own run epoch count restarted.
		const outcome = replacement.requestViewingIntent({ kind: 'zoom', scale: 2 }, ticketBefore, 1);
		expect(outcome.kind).toBe('superseded');
		expect(replacement.inspectionTicket()?.outputId).not.toBe(ticketBefore!.outputId);

		// And the replaced session's own selection/task are gone with it.
		expect(first.session.selection()).toBeNull();
		first.session.dispose();
		expect(first.session.current()).toBeNull();
	});
});

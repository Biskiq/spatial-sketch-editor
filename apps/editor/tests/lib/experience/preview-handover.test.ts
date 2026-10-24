/**
 * T3.P02.S02 — Preview Camera handover and return.
 *
 * The phase laws this proves are ownership laws, not renderer ones: Preview takes
 * the Stage's one Camera output through the landed F3 ticket protocol's ordered
 * handoff, the Stage cannot present an intent while it does not own the output,
 * and only a valid return restores the inspection run. A stale completion or
 * cancel cannot reclaim or clear a newer owner, and a source change ends both
 * claims so no pose is restored across sources.
 */
import { describe, expect, it } from 'vitest';

import { createCameraSession } from '$lib/authoring/stage/camera-session';
import { admitSource, type AdmissionContext, type StageReadSnapshot } from '$lib/authoring/stage/source-admission';
import {
	cancelPreview,
	enterPreview,
	nextPreviewRunEpoch,
	previewReturnToken,
	returnPreview
} from '$lib/authoring/experience/preview-handover';

import { experienceEnvelope } from './fixtures';

async function snapshot(): Promise<StageReadSnapshot> {
	const context: AdmissionContext = {
		sessionEpoch: 'session-handover',
		acceptedRevision: { projectId: 'project-1', revisionId: 'revision-1' }
	};
	const admitted = await admitSource(await experienceEnvelope(), context);
	if (admitted.kind !== 'admitted') throw new Error(`fixture source was not admitted: ${admitted.kind}`);
	return admitted.snapshot;
}

async function stage() {
	const read = await snapshot();
	const camera = createCameraSession({ snapshot: read, viewportId: 'stage', outputId: 'output:stage' });
	const inspection = camera.acquireInspection('exclusive', 1);
	expect(inspection.kind).toBe('acquired');
	const pose = camera.state().pose;
	const ticket = camera.inspectionTicket();
	if (ticket === null) throw new Error('the inspection run did not acquire the output');
	return { read, camera, pose, ticket };
}

function tokenFor(runEpoch: number): string {
	return previewReturnToken('session-handover', runEpoch);
}

describe('Preview Camera handover', () => {
	it('hands the one output to Preview and returns it to the inspection run', async () => {
		const { camera, pose, ticket } = await stage();

		const entered = enterPreview(camera, { runEpoch: nextPreviewRunEpoch(camera.output(), 2), returnToken: tokenFor(2) });
		expect(entered.kind).toBe('entered');
		if (entered.kind !== 'entered') return;
		expect(entered.ticket.ownerId).toBe('stage:preview');
		expect(entered.replacedOwner).toBe('stage:inspection');
		// The Stage holds no ticket while Preview does, so no Stage intent can be
		// presented against an output this run no longer owns.
		expect(camera.inspectionTicket()).toBeNull();
		expect(camera.previewTicket()).toEqual(entered.ticket);
		// The handoff moves ownership only: the inspection framing is untouched and
		// is exactly what the return restores.
		expect(camera.state().pose).toEqual(pose);

		const returned = returnPreview(camera);
		expect(returned.kind).toBe('returned');
		if (returned.kind !== 'returned') return;
		expect(returned.ticket.ownerId).toBe('stage:inspection');
		// Ownership order never moves backwards, so the restored run is newer than
		// the Preview run that replaced it.
		expect(returned.ticket.runEpoch).toBeGreaterThan(entered.ticket.runEpoch);
		expect(camera.inspectionTicket()).toEqual(returned.ticket);
		expect(camera.previewTicket()).toBeNull();
		expect(camera.state().pose).toEqual(pose);
	});

	it('refuses to hand off an output the Stage does not hold', async () => {
		const { camera } = await stage();
		const released = cancelPreview(camera, camera.previewTicket());
		expect(released.kind).toBe('cancelled');
		// Free the output from inspection too: an unowned output cannot be handed
		// over, because the handoff would issue no return context.
		const ticket = camera.inspectionTicket()!;
		camera.cancelInspection(ticket);
		expect(camera.inspectionTicket()).toBeNull();

		const entered = enterPreview(camera, { runEpoch: nextPreviewRunEpoch(camera.output(), 2), returnToken: tokenFor(2) });
		expect(entered).toMatchObject({ kind: 'refused', reason: 'no-inspection-claim' });
		expect(camera.previewTicket()).toBeNull();
	});

	it('supports repeated entry, each return newer than the last', async () => {
		const { camera } = await stage();
		const epochs: number[] = [];
		for (let cycle = 0; cycle < 3; cycle += 1) {
			const entered = enterPreview(camera, {
				runEpoch: nextPreviewRunEpoch(camera.output(), cycle + 2),
				returnToken: tokenFor(cycle + 2)
			});
			expect(entered.kind).toBe('entered');
			if (entered.kind !== 'entered') return;
			const returned = returnPreview(camera);
			expect(returned.kind).toBe('returned');
			if (returned.kind !== 'returned') return;
			epochs.push(returned.ticket.runEpoch);
		}
		expect(epochs[1]!).toBeGreaterThan(epochs[0]!);
		expect(epochs[2]!).toBeGreaterThan(epochs[1]!);
		expect(camera.inspectionTicket()?.ownerId).toBe('stage:inspection');
	});

	it('restores nothing after a source change ended the Preview claim', async () => {
		const { camera } = await stage();
		const entered = enterPreview(camera, { runEpoch: nextPreviewRunEpoch(camera.output(), 2), returnToken: tokenFor(2) });
		expect(entered.kind).toBe('entered');
		if (entered.kind !== 'entered') return;
		const stalePreview = entered.ticket;

		const rebased = camera.rebaseSource('digest-after-edit');
		expect(rebased.output.kind).toBe('rebased');
		expect(camera.previewTicket()).toBeNull();
		expect(camera.inspectionTicket()).toBeNull();

		// The host's exit path finds no Preview claim, so it reinstates nothing.
		expect(returnPreview(camera)).toEqual({ kind: 'abandoned', reason: 'no-preview-claim' });
		// The content change is what mints the next inspection claim, and it is not
		// the stale Preview ticket.
		const reacquired = camera.acquireInspection('exclusive', nextPreviewRunEpoch(camera.output(), 3));
		expect(reacquired.kind).toBe('acquired');
		expect(camera.inspectionTicket()?.ownerId).toBe('stage:inspection');
		// A delayed Preview completion/cancel for the old source/session is refused
		// and cannot clear the newer owner.
		const staleCancel = cancelPreview(camera, stalePreview);
		expect(staleCancel.kind).toBe('ignored');
		expect(camera.inspectionTicket()?.ownerId).toBe('stage:inspection');
	});

	it('refuses a stale Preview ticket after the Stage holds the output again', async () => {
		const { camera } = await stage();
		const entered = enterPreview(camera, { runEpoch: nextPreviewRunEpoch(camera.output(), 2), returnToken: tokenFor(2) });
		expect(entered.kind).toBe('entered');
		if (entered.kind !== 'entered') return;
		const spent = entered.ticket;

		expect(returnPreview(camera).kind).toBe('returned');
		const held = camera.inspectionTicket();

		// A delayed cancel from the ended Preview run cannot clear the restored
		// inspection claim.
		const staleCancel = cancelPreview(camera, spent);
		expect(staleCancel.kind).toBe('ignored');
		expect(camera.inspectionTicket()).toEqual(held);
		// Nor can it return again: the token was spent with the claim.
		const staleReturn = returnPreview(camera, spent);
		expect(staleReturn.kind).toBe('refused');
		expect(camera.inspectionTicket()).toEqual(held);
	});

	it('mints a Preview run epoch strictly newer than the output floor', async () => {
		const { camera } = await stage();
		const floor = camera.output().epochFloor;
		expect(nextPreviewRunEpoch(camera.output(), 1)).toBe(floor + 1);
		expect(nextPreviewRunEpoch(camera.output(), floor + 10)).toBe(floor + 10);
	});
});

/**
 * T3.P01.S02 client Save state conformance.
 *
 * The state machine is framework-free, so these tests drive it with a real
 * `createAcceptanceCoordinator` (the landed F.4 API) and a scripted transport:
 * no Svelte, host, Stage or route is involved, and Save never accepts, undoes or
 * installs anything on its own.
 */
import { describe, expect, it } from 'vitest';

import {
	admitCurrentSource,
	createCurrentSourceAdapter,
	type AcceptedRevision,
	type ProjectDocument
} from '@portfolio/project-model';
import type { SaveRequest } from '@portfolio/project-model/save';

import {
	createAcceptanceCoordinator,
	type AcceptanceCoordinator
} from '$lib/authoring/f4';
import {
	createSaveState,
	type SaveCoordinatorPort,
	type SaveRemoteProject,
	type SaveTransport,
	type SaveTransportResult
} from '$lib/authoring/save';

import {
	HOST_SCENE_OPTIONS,
	PROOF_LAYOUT_TRANSFORM_KIND,
	buildCurrentSourceFixture,
	createProofLayoutPlanner,
	layoutObjectReference,
	proofIntent
} from './__fixtures__/f4-current-source-fixtures';

const TOKEN_ONE = 'saved-base:11111111-1111-4111-8111-111111111111';
const TOKEN_TWO = 'saved-base:22222222-2222-4222-8222-222222222222';

type Deferred<T> = { promise: Promise<T>; resolve(value: T): void };
function deferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

async function boot(overrides: { baselineToken?: string | null; legacyTokenOnly?: boolean } = {}) {
	const fixture = buildCurrentSourceFixture();
	const revision: AcceptedRevision = { projectId: fixture.project.id, revisionId: 'revision-1' };
	const admitted = await admitCurrentSource(fixture.project, {
		acceptedRevision: revision,
		scene: HOST_SCENE_OPTIONS
	});
	if (admitted.kind !== 'admitted') throw new Error('fixture was not admitted');

	const coordinator = createAcceptanceCoordinator<ProjectDocument>({
		adapter: createCurrentSourceAdapter({ scene: HOST_SCENE_OPTIONS }),
		sessionEpoch: 'session-1',
		baseline: {
			revision,
			source: admitted.project,
			canonicalJson: admitted.canonicalJson,
			sourceContentId: admitted.sourceContentId,
			blockingIssues: admitted.blockingIssues
		},
		planners: [createProofLayoutPlanner(fixture.objectId)],
		mintRevisionId: (ordinal) => `revision-${ordinal + 1}`
	});

	const calls: SaveRequest[] = [];
	let behaviour: (request: SaveRequest) => Promise<SaveTransportResult> = async () => {
		throw new Error('no transport behaviour configured');
	};
	const transport: SaveTransport = (request) => {
		calls.push(request);
		return behaviour(request);
	};
	const baselineToken = overrides.baselineToken === undefined ? TOKEN_ONE : overrides.baselineToken;
	const state = createSaveState({
		coordinator,
		save: transport,
		baseline: {
			savedBaseToken: baselineToken,
			savedRevision: baselineToken && !overrides.legacyTokenOnly ? revision : null,
			savedCanonicalJson: baselineToken && !overrides.legacyTokenOnly ? admitted.canonicalJson : null,
			savedSourceContentId: baselineToken && !overrides.legacyTokenOnly ? admitted.sourceContentId : null
		},
		mintOperationId: (() => {
			let counter = 0;
			return () => `operation-${(counter += 1)}`;
		})()
	});

	return {
		fixture,
		revision,
		admitted,
		coordinator,
		calls,
		state,
		setBehaviour(next: (request: SaveRequest) => Promise<SaveTransportResult>) {
			behaviour = next;
		}
	};
}

function acknowledgement(request: SaveRequest, token = TOKEN_TWO): SaveTransportResult {
	return {
		kind: 'saved',
		acknowledgement: {
			projectId: request.capture.projectId,
			name: 'Conformance fixture',
			version: 2,
			updatedAt: '2026-10-16T00:00:00.000Z',
			savedBaseToken: token,
			savedRevision: request.capture.acceptedRevision,
			sourceContentId: request.capture.sourceContentId
		}
	};
}

async function acceptEdit(coordinator: AcceptanceCoordinator<ProjectDocument>, fixture: ReturnType<typeof buildCurrentSourceFixture>) {
	const current = coordinator.current();
	const result = await coordinator.accept(
		proofIntent({
			kind: PROOF_LAYOUT_TRANSFORM_KIND,
			operationId: 'editor-edit-1',
			expectedRevision: current.revision.revisionId,
			projectId: current.revision.projectId,
			contentRevision: current.sourceContentId,
			targets: [layoutObjectReference(current.sourceContentId, fixture.objectId)],
			payload: { objectId: fixture.objectId, position: [2, 0.5, 0] }
		})
	);
	if (result.kind !== 'accepted') {
		throw new Error(`edit was not accepted: ${result.kind === 'rejected' ? result.code : result.kind}`);
	}
	return result;
}

function remoteProject(admitted: { project: ProjectDocument; sourceContentId: string }, revision: AcceptedRevision): SaveRemoteProject {
	return {
		projectId: revision.projectId,
		document: admitted.project,
		savedBaseToken: TOKEN_TWO,
		savedRevision: revision,
		savedSourceContentId: admitted.sourceContentId
	};
}

describe('framework-free Save state', () => {
	it('an edit during an in-flight Save stays dirty and only the captured contents are acknowledged', async () => {
		const { state, coordinator, fixture, admitted, calls, setBehaviour } = await boot();
		const reply = deferred<SaveTransportResult>();
		setBehaviour(() => reply.promise);

		const pending = state.save();
		expect(state.getSnapshot().status).toBe('saving');
		expect(calls).toHaveLength(1);
		expect(calls[0].capture.canonicalJson).toBe(admitted.canonicalJson);
		expect(calls[0].capture.precondition).toEqual({ kind: 'expected-saved-base', token: TOKEN_ONE });

		const edit = await acceptEdit(coordinator, fixture);
		expect(edit.kind).toBe('accepted');
		expect(coordinator.current().canonicalJson).not.toBe(admitted.canonicalJson);

		reply.resolve(acknowledgement(calls[0]));
		await expect(pending).resolves.toMatchObject({ kind: 'dirty' });

		const snapshot = state.getSnapshot();
		expect(snapshot.status).toBe('dirty');
		expect(snapshot.dirty).toBe(true);
		expect(snapshot.savedBaseToken).toBe(TOKEN_TWO);
		// Acknowledgment marked only the captured bytes, not the newer edit.
		expect(snapshot.savedCanonicalJson).toBe(admitted.canonicalJson);
		expect(snapshot.savedCanonicalJson).not.toBe(coordinator.current().canonicalJson);
	});

	it('drops a response from a replaced session epoch', async () => {
		const { state, coordinator, fixture, admitted, calls, setBehaviour } = await boot();
		const reply = deferred<SaveTransportResult>();
		setBehaviour(() => reply.promise);

		const pending = state.save();
		const replaced = await coordinator.replace({
			revision: { projectId: fixture.project.id, revisionId: 'revision-replaced' },
			source: admitted.project,
			sessionEpoch: 'session-2'
		});
		expect(replaced.kind).toBe('replaced');
		expect(coordinator.sessionEpoch()).toBe('session-2');

		reply.resolve(acknowledgement(calls[0]));
		await expect(pending).resolves.toEqual({ kind: 'stale-epoch' });

		const snapshot = state.getSnapshot();
		expect(snapshot.savedBaseToken).toBe(TOKEN_ONE);
		expect(snapshot.savedRevision).toEqual({ projectId: fixture.project.id, revisionId: 'revision-1' });
		expect(snapshot.busy).toBe(false);
	});

	it('a conflict preserves local source and history and offers only an explicit reload', async () => {
		const { coordinator, admitted, revision } = await boot();
		const remote = remoteProject(admitted, revision);
		const stateWithLoad = createSaveState({
			coordinator,
			save: async (request) => {
				void request;
				return { kind: 'conflict' };
			},
			baseline: {
				savedBaseToken: TOKEN_ONE,
				savedRevision: revision,
				savedCanonicalJson: admitted.canonicalJson,
				savedSourceContentId: admitted.sourceContentId
			},
			loadRemote: async () => remote
		});

		const beforeRevision = coordinator.acceptedRevision();
		const beforeDepth = coordinator.history().depth;
		const beforeCanonical = coordinator.current().canonicalJson;
		await expect(stateWithLoad.save()).resolves.toEqual({ kind: 'conflict' });

		const snapshot = stateWithLoad.getSnapshot();
		expect(snapshot.status).toBe('conflict');
		expect(snapshot.conflict?.localJson).toBe(beforeCanonical);
		expect(snapshot.conflict?.remote?.document).toEqual(remote.document);
		expect(coordinator.acceptedRevision()).toEqual(beforeRevision);
		expect(coordinator.current().canonicalJson).toBe(beforeCanonical);
		expect(coordinator.history().depth).toBe(beforeDepth);
		expect(stateWithLoad.reloadRemote()).toMatchObject({
			kind: 'reload',
			projectId: revision.projectId,
			savedBaseToken: TOKEN_TWO
		});
	});

	it('Undo back to saved contents reads saved only on full-source equality', async () => {
		const { state, coordinator, fixture, admitted, setBehaviour } = await boot();
		setBehaviour(async (request) => acknowledgement(request));
		await expect(state.save()).resolves.toMatchObject({ kind: 'saved' });
		expect(state.getSnapshot().status).toBe('saved');

		await acceptEdit(coordinator, fixture);
		expect(state.refresh().status).toBe('dirty');

		const undone = await coordinator.undo();
		expect(undone.kind).toBe('restored');
		const snapshot = state.refresh();
		expect(coordinator.current().canonicalJson).toBe(admitted.canonicalJson);
		expect(snapshot.status).toBe('saved');
		expect(snapshot.dirty).toBe(false);
	});

	it('compares full bytes, so a cursor-only divergence is dirty even with the same digest', async () => {
		const fixture = buildCurrentSourceFixture();
		const revision: AcceptedRevision = { projectId: fixture.project.id, revisionId: 'revision-1' };
		const admitted = await admitCurrentSource(fixture.project, {
			acceptedRevision: revision,
			scene: HOST_SCENE_OPTIONS
		});
		if (admitted.kind !== 'admitted') throw new Error('fixture was not admitted');
		const source = {
			revision,
			source: admitted.project,
			canonicalJson: admitted.canonicalJson,
			sourceContentId: admitted.sourceContentId
		};
		let current = source;
		const coordinator: SaveCoordinatorPort = {
			current: () => current,
			sessionEpoch: () => 'session-1'
		};
		const state = createSaveState({
			coordinator,
			save: async () => {
				throw new Error('not used');
			},
			baseline: {
				savedBaseToken: TOKEN_ONE,
				savedRevision: revision,
				savedCanonicalJson: admitted.canonicalJson,
				savedSourceContentId: admitted.sourceContentId
			}
		});

		expect(state.getSnapshot().status).toBe('saved');
		const divergent = admitted.canonicalJson.replace(/"cursor": \d+/, '"cursor": 9');
		expect(divergent).not.toBe(admitted.canonicalJson);
		current = { ...source, canonicalJson: divergent };
		const snapshot = state.refresh();
		expect(snapshot.dirty).toBe(true);
		expect(snapshot.status).toBe('dirty');
	});

	it('a pre-migration token-only baseline starts dirty and uses the token as its precondition', async () => {
		const { state, calls, setBehaviour } = await boot({ legacyTokenOnly: true });
		expect(state.getSnapshot().status).toBe('dirty');
		expect(state.getSnapshot().savedCanonicalJson).toBeNull();
		setBehaviour(async (request) => acknowledgement(request));
		await state.save();
		expect(calls[0].capture.precondition).toEqual({ kind: 'expected-saved-base', token: TOKEN_ONE });
		expect(state.getSnapshot().status).toBe('saved');
	});

	it('Save adds no history entry and no-op saves are not commands', async () => {
		const { state, coordinator, setBehaviour } = await boot();
		setBehaviour(async (request) => acknowledgement(request));
		const before = coordinator.history().depth;
		await state.save();
		expect(coordinator.history().depth).toBe(before);
		expect(coordinator.canUndo()).toBe(false);
	});

	it('reports an accepted edit as dirty in the snapshot itself, not only after refresh()', async () => {
		const { state, coordinator, fixture, setBehaviour } = await boot();
		setBehaviour(async (request) => acknowledgement(request));
		await expect(state.save()).resolves.toMatchObject({ kind: 'saved' });

		await acceptEdit(coordinator, fixture);
		const snapshot = state.getSnapshot();
		expect(snapshot.dirty).toBe(true);
		// A snapshot may not contradict its own flag while the Head renders it.
		expect(snapshot.status).toBe('dirty');
	});

	it('drops the retained capture when the session epoch is replaced', async () => {
		const { state, coordinator, fixture, admitted, calls, setBehaviour } = await boot();
		const reply = deferred<SaveTransportResult>();
		setBehaviour(() => reply.promise);

		const pending = state.save();
		await coordinator.replace({
			revision: { projectId: fixture.project.id, revisionId: 'revision-replaced' },
			source: admitted.project,
			sessionEpoch: 'session-2'
		});
		reply.resolve(acknowledgement(calls[0]));
		await expect(pending).resolves.toEqual({ kind: 'stale-epoch' });
		expect(state.getSnapshot().pending).toBe(false);

		// The replaced session's capture must not be retried against the project
		// this session now holds.
		setBehaviour(async (request) => acknowledgement(request));
		await state.retry();
		expect(calls).toHaveLength(2);
		expect(calls[1].capture.operationId).not.toBe(calls[0].capture.operationId);
		expect(calls[1].capture.acceptedRevision).toEqual(coordinator.current().revision);
	});

	it('retains the capture across a retryable failure and retries the same operation', async () => {
		const { state, calls, setBehaviour } = await boot();
		setBehaviour(async () => ({ kind: 'error', message: 'Cloud request failed', retryable: true }));

		await expect(state.save()).resolves.toMatchObject({ kind: 'error' });
		expect(state.getSnapshot().pending).toBe(true);
		expect(state.getSnapshot().status).toBe('error');

		// The ambiguous Save resolves through its receipt: same capture, same ID.
		setBehaviour(async (request) => acknowledgement(request));
		await expect(state.retry()).resolves.toMatchObject({ kind: 'saved' });
		expect(calls).toHaveLength(2);
		expect(calls[1].capture.operationId).toBe(calls[0].capture.operationId);
		expect(state.getSnapshot().pending).toBe(false);
		expect(state.getSnapshot().status).toBe('saved');
	});

	it('mints a new operation ID after a refusal so changed bytes never reuse it', async () => {
		const { state, calls, setBehaviour } = await boot();
		setBehaviour(async () => ({ kind: 'refused', code: 'invalid-project', message: 'Rejected' }));
		await state.save();
		expect(state.getSnapshot().pending).toBe(false);

		setBehaviour(async (request) => acknowledgement(request));
		await state.save();
		expect(calls).toHaveLength(2);
		expect(calls[1].capture.operationId).not.toBe(calls[0].capture.operationId);
	});

	it('refuses an acknowledgement that describes other contents than the capture', async () => {
		const { state, admitted, setBehaviour } = await boot();
		setBehaviour(async (request) => ({
			kind: 'saved',
			acknowledgement: {
				projectId: request.capture.projectId,
				name: 'Conformance fixture',
				version: 2,
				updatedAt: '2026-10-16T00:00:00.000Z',
				savedBaseToken: TOKEN_TWO,
				savedRevision: request.capture.acceptedRevision,
				sourceContentId: `sha256-${'0'.repeat(64)}`
			}
		}));

		await expect(state.save()).resolves.toMatchObject({ kind: 'error' });
		const snapshot = state.getSnapshot();
		expect(snapshot.status).toBe('error');
		expect(snapshot.error?.code).toBe('server');
		// Nothing was adopted: the original base and its bytes are untouched.
		expect(snapshot.savedBaseToken).toBe(TOKEN_ONE);
		expect(snapshot.savedCanonicalJson).toBe(admitted.canonicalJson);
		expect(snapshot.pending).toBe(false);
	});

	it('never installs a conflict load into a newer conflict that captured the same bytes', async () => {
		const { coordinator, admitted, revision } = await boot();
		const stale = deferred<SaveRemoteProject>();
		const current = deferred<SaveRemoteProject>();
		let loads = 0;
		const state = createSaveState({
			coordinator,
			save: async () => ({ kind: 'conflict' }),
			baseline: {
				savedBaseToken: TOKEN_ONE,
				savedRevision: revision,
				savedCanonicalJson: admitted.canonicalJson,
				savedSourceContentId: admitted.sourceContentId
			},
			loadRemote: () => ((loads += 1) === 1 ? stale.promise : current.promise)
		});

		const first = state.save();
		// Let the first run reach its outstanding load, where `busy` is already clear.
		await new Promise((resolve) => setTimeout(resolve, 0));
		const second = state.save();

		stale.resolve({ ...remoteProject(admitted, revision), projectId: 'project:foreign' });
		await first;
		// The newer conflict owns the view; the older load is not its answer.
		expect(state.reloadRemote()).toEqual({ kind: 'unavailable' });

		current.resolve(remoteProject(admitted, revision));
		await second;
		expect(state.reloadRemote()).toMatchObject({ kind: 'reload', projectId: revision.projectId });
	});
});

// @vitest-environment jsdom
/**
 * X1 / decomposition contract P — the route project epoch.
 *
 * The mounted route suites prove the production caller's load/save/history
 * behavior. This focused suite replaces only the epoch's collaborators so the
 * ownership order is deterministic and executable:
 *
 * 1. activation/replacement keep the baseline order and release the old
 *    contribution subscription before its facade, while the old acceptance
 *    subscription is released only after the new host exists;
 * 2. a stale acceptance notification or history completion cannot write into a
 *    newer epoch;
 * 3. Undo/Redo remain the existing acceptance commands with their exact words;
 * 4. teardown releases subscriptions, Save, acceptance, facade, project-bound
 *    assets and the Stage session in order, exactly once, and no late activation
 *    mounts a stage.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from '@portfolio/project-model/units';
import type { StageReadSnapshot } from '$lib/authoring/stage/accepted-read';
import type { StageAdapterFactory, StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import type { StageFacade } from '$lib/authoring/stage/stage-facade';
import type {
	StageAcceptanceHost,
	StageHistoryCommandOutcome,
	StageHistoryState
} from '$lib/authoring/stage/host-acceptance';
import { attachUnitStageSource } from '$lib/authoring/stage/unit-stage-source';
import {
	createStageProjectEpoch,
	type StageProjectEpoch
} from '$lib/authoring/stage/route/stage-project-epoch.svelte';

const EMPTY_HISTORY: StageHistoryState = {
	canUndo: false,
	canRedo: false,
	depth: 1,
	position: 0,
	undoUnavailableReason: 'Nothing to undo yet — no change has been accepted.',
	redoUnavailableReason: 'Nothing to redo.'
};

const EMPTY_ENVELOPE = {
	units: { resources: { data: { resources: [] } } }
} as unknown as ProjectEnvelope;

function snapshotWith(contentId: string): StageReadSnapshot {
	return attachUnitStageSource(
		{
			acceptedRevision: { projectId: 'project-1', revisionId: `revision-${contentId}` },
			sourceContentId: contentId,
			canonicalJson: `{"contentId":"${contentId}"}`,
			sessionEpoch: 'session-1',
			sourceKind: UNIT_SOURCE_KIND,
			sourceVersion: UNIT_SOURCE_VERSION,
			compileGeneration: `compile-${contentId}`,
			domain: {} as StageReadSnapshot['domain']
		},
		EMPTY_ENVELOPE
	);
}

type HistoryMock = Mock<() => Promise<StageHistoryCommandOutcome>>;
type MutableHistory = {
	canUndo: boolean;
	canRedo: boolean;
	depth: number;
	position: number;
	undoUnavailableReason: string | null;
	redoUnavailableReason: string | null;
};
type FakeAcceptanceHost = {
	id: number;
	historyValue: MutableHistory;
	disposed: boolean;
	undo: HistoryMock;
	redo: HistoryMock;
	history(): StageHistoryState;
	onChanged(next: () => void): () => void;
	emit(): void;
	rawEmit(): void;
	dispose(): void;
};
type FakeFacade = {
	id: number;
	snapshotValue: StageReadSnapshot;
	disposed: boolean;
	dispose(): void;
	onAdaptersChanged(listener: () => void): () => void;
	acquireInspection(mode: string): void;
	snapshot(): StageReadSnapshot;
	selectionState(): { ordered: never[]; primary: null };
	session: { task: () => null };
	wasSubscribed(): boolean;
};

function harness() {
	const log: string[] = [];
	let nextFacadeId = 0;
	const facades: FakeFacade[] = [];
	const acceptances: FakeAcceptanceHost[] = [];
	const preview = { openState: false, reset: () => log.push('preview.reset'), close: () => log.push('preview.close') };
	const projectSession = {
		headSave: { refresh: () => log.push('ps.save.refresh') },
		unmountSave: () => log.push('ps.unmountSave'),
		mountSave: () => log.push('ps.mountSave'),
		updateSnapshot: () => log.push('ps.updateSnapshot'),
		dispose: () => log.push('ps.dispose')
	};
	const session = {
		replace: (_snapshot: StageReadSnapshot) => log.push(`session.replace:${_snapshot.sourceContentId}`),
		dispose: () => log.push('session.dispose')
	};
	let controller: StageProjectEpoch | null = null;

	function fakeFacade(id: number, snapshot: StageReadSnapshot): FakeFacade {
		let subscribed = false;
		return {
			id,
			snapshotValue: snapshot,
			disposed: false,
			dispose() {
				this.disposed = true;
				log.push(`facade${id}:dispose`);
			},
			onAdaptersChanged(_listener: () => void) {
				subscribed = true;
				log.push(`facade${id}:subscribe`);
				return () => {
					subscribed = false;
					log.push(`facade${id}:unsubscribe`);
				};
			},
			acquireInspection(mode: string) {
				log.push(`facade${id}:inspect:${mode}`);
			},
			snapshot: () => snapshot,
			selectionState: () => ({ ordered: [], primary: null }),
			session: { task: () => null },
			wasSubscribed: () => subscribed
		};
	}

	function fakeAcceptance(id: number): FakeAcceptanceHost {
		let listener: (() => void) | null = null;
		let rawListener: (() => void) | null = null;
		const history: MutableHistory = { ...EMPTY_HISTORY };
		const host: FakeAcceptanceHost = {
			id,
			historyValue: history,
			disposed: false,
			undo: vi.fn<() => Promise<StageHistoryCommandOutcome>>(async () => ({
				kind: 'unavailable',
				direction: 'undo',
				reason: 'empty-stack'
			})),
			redo: vi.fn<() => Promise<StageHistoryCommandOutcome>>(async () => ({
				kind: 'unavailable',
				direction: 'redo',
				reason: 'empty-stack'
			})),
			history: () => history,
			onChanged(next: () => void) {
				rawListener = next;
				listener = next;
				log.push(`acceptance${id}:subscribe`);
				return () => {
					listener = null;
					log.push(`acceptance${id}:unsubscribe`);
				};
			},
			emit() {
				listener?.();
			},
			/** Bypass the unsubscribe to prove the epoch's own stale-epoch guard. */
			rawEmit() {
				rawListener?.();
			},
			dispose() {
				this.disposed = true;
				log.push(`acceptance${id}:dispose`);
			}
		};
		acceptances.push(host);
		return host;
	}

	const assets = {
		resolve: (snapshot: StageReadSnapshot) => {
			log.push(`assets.resolve:${snapshot.sourceContentId}`);
		},
		dispose: () => log.push('assets.dispose')
	};

	controller = createStageProjectEpoch({
		session: session as never,
		assets: assets as never,
		projectSession: () => projectSession,
		preview: () => preview,
		createFacade: (snapshot) => {
			log.push(`facade${nextFacadeId + 1}:create`);
			const facade = fakeFacade(++nextFacadeId, snapshot);
			facades.push(facade);
			return facade as unknown as StageFacade;
		},
		adapterFactories: [(() => ({})) as unknown as StageAdapterFactory],
		interruptInput: () => log.push('interrupt'),
		resetFocus: () => {
			log.push('focus.reset');
			log.push(`services:${controller?.services === null ? 'null' : 'set'}`);
		},
		resetPresentationBeforeSwap: () => log.push('presentation.before'),
		resetPresentation: () => log.push('presentation.reset'),
		onFacadeMounted: () => log.push('facade.bind'),
		onAdaptersChanged: () => log.push('adapters.changed'),
		onAccepted: () => log.push('accepted'),
		onHistoryInstalled: (outcome) => log.push(`history.installed:${outcome.selectionClearedReason}`),
		onNotice: (message) => log.push(`notice:${message}`),
		refresh: () => log.push('refresh'),
		isActiveProject: () => true,
		createAcceptance: (options) => {
			log.push(`acceptance${acceptances.length + 1}:create`);
			return fakeAcceptance(acceptances.length + 1) as unknown as StageAcceptanceHost;
		},
		createServices: () => {
			log.push('services.create');
			return {
				stage: {} as never,
				authoring: {} as never
			} as StageAdapterServices;
		},
		mountAdapter: () => {
			log.push('adapter.mount');
			return {} as never;
		}
	});
	return {
		log,
		controller: controller!,
		preview,
		projectSession,
		acceptances,
		facades
	};
}

function take(log: string[]): string[] {
	return log.splice(0, log.length);
}

describe('project epoch activation and replacement', () => {
	it('mounts one epoch in the baseline order and replaces without a parallel owner', () => {
		const subject = harness();
		const A = snapshotWith('a');
		const B = snapshotWith('b');

		subject.controller.activate(A);
		expect(take(subject.log)).toEqual([
			'interrupt',
			'session.replace:a',
			'preview.reset',
			'focus.reset',
			'services:null',
			'presentation.before',
			'facade1:create',
			'facade.bind',
			'facade1:subscribe',
			'facade1:inspect:exclusive',
			'acceptance1:create',
			'ps.unmountSave',
			'services.create',
			'assets.resolve:a',
			'acceptance1:subscribe',
			'adapter.mount',
			'ps.mountSave',
			'presentation.reset'
		]);
		expect(subject.controller.facade).toBe(subject.facades[0]);
		expect(subject.controller.acceptance).toBe(subject.acceptances[0]);
		expect(subject.controller.history).toEqual(EMPTY_HISTORY);

		subject.controller.activate(B);
		expect(take(subject.log)).toEqual([
			'interrupt',
			'session.replace:b',
			'preview.reset',
			'focus.reset',
			'services:null',
			'presentation.before',
			'facade1:unsubscribe',
			'facade1:dispose',
			'acceptance1:dispose',
			'facade2:create',
			'facade.bind',
			'facade2:subscribe',
			'facade2:inspect:exclusive',
			'acceptance2:create',
			'acceptance1:unsubscribe',
			'ps.unmountSave',
			'services.create',
			'assets.resolve:b',
			'acceptance2:subscribe',
			'adapter.mount',
			'ps.mountSave',
			'presentation.reset'
		]);
		expect(subject.facades[0]!.disposed).toBe(true);
		expect(subject.facades[0]!.wasSubscribed()).toBe(false);
		expect(subject.controller.facade).toBe(subject.facades[1]);
		expect(subject.controller.acceptance).toBe(subject.acceptances[1]);
	});

	it('runs the acceptance notification against the mounted epoch only', () => {
		const subject = harness();
		subject.controller.activate(snapshotWith('a'));
		take(subject.log);
		const first = subject.acceptances[0]!;

		// A stale host notification after the replacement writes nothing.
		subject.controller.activate(snapshotWith('b'));
		take(subject.log);
		first.rawEmit();
		expect(subject.log).toEqual([]);

		// The mounted host publishes through the baseline order.
		subject.preview.openState = true;
		subject.acceptances[1]!.historyValue.canUndo = true;
		subject.acceptances[1]!.historyValue.depth = 2;
		subject.acceptances[1]!.emit();
		expect(take(subject.log)).toEqual([
			'preview.close',
			'ps.save.refresh',
			'ps.updateSnapshot',
			'assets.resolve:b',
			'accepted'
		]);
		expect(subject.controller.history.canUndo).toBe(true);
		expect(subject.controller.history.depth).toBe(2);
	});

	it('drops a stale history completion and keeps the existing commands', async () => {
		const subject = harness();
		subject.controller.activate(snapshotWith('a'));
		take(subject.log);
		const first = subject.acceptances[0]!;
		let release: ((outcome: StageHistoryCommandOutcome) => void) | null = null;
		first.undo.mockImplementation(
			() => new Promise<StageHistoryCommandOutcome>((resolve) => { release = resolve; })
		);

		const attempt = subject.controller.undo();
		subject.controller.activate(snapshotWith('b'));
		take(subject.log);
		release!({
			kind: 'installed',
			direction: 'undo',
			install: {} as never,
			selectionClearedReason: 'subject-retired'
		});
		await attempt;
		expect(subject.log).toEqual([]);

		const second = subject.acceptances[1]!;
		second.historyValue.canUndo = false;
		second.historyValue.depth = 3;
		second.historyValue.position = 2;
		second.undo.mockResolvedValue({ kind: 'unchanged', direction: 'undo', sourceContentId: 'b' });
		await subject.controller.undo();
		expect(take(subject.log)).toEqual(['refresh']);

		second.undo.mockResolvedValue({ kind: 'unavailable', direction: 'undo', reason: 'live-proposal' });
		await subject.controller.undo();
		expect(take(subject.log)).toEqual([
			'notice:A proposal is live; Undo runs once it settles.',
			'refresh'
		]);

		second.redo.mockResolvedValue({ kind: 'unavailable', direction: 'redo', reason: 'empty-stack' });
		await subject.controller.redo();
		expect(take(subject.log)).toEqual(['notice:Nothing to redo.', 'refresh']);

		second.redo.mockResolvedValue({
			kind: 'installed',
			direction: 'redo',
			install: {} as never,
			selectionClearedReason: 'no-correspondence'
		});
		await subject.controller.redo();
		expect(take(subject.log)).toEqual([
			'history.installed:no-correspondence',
			'refresh'
		]);

		second.undo.mockResolvedValue({
			kind: 'refused',
			direction: 'undo',
			code: 'install-refused',
			message: 'The restored source was refused.',
			compensation: 'failed'
		});
		await subject.controller.undo();
		expect(take(subject.log)).toEqual([
			'notice:The restored source was refused. The history could not be rolled back to match what is shown.',
			'refresh'
		]);
	});

	it('tears down in order, exactly once, and refuses late activation', () => {
		const subject = harness();
		subject.controller.activate(snapshotWith('a'));
		take(subject.log);

		subject.controller.markTornDown();
		subject.controller.dispose();
		expect(take(subject.log)).toEqual([
			'facade1:unsubscribe',
			'acceptance1:unsubscribe',
			'ps.dispose',
			'acceptance1:dispose',
			'facade1:dispose',
			'assets.dispose',
			'session.dispose'
		]);
		subject.controller.dispose();
		expect(subject.log).toEqual([]);

		subject.controller.activate(snapshotWith('b'));
		expect(subject.log).toEqual([]);
		expect(subject.facades).toHaveLength(1);
	});
});

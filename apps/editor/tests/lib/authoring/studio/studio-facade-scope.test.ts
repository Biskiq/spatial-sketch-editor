/**
 * Object Studio's scope is enforced where operations and selections are *owned*:
 * the Stage facade. A hidden button, a shortcut and Find all reach the same refusal.
 */
import { describe, expect, it } from 'vitest';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createSubjectScope } from '$lib/authoring/stage/subject-scope';
import { isStudioOperation, studioAdmitsCardAction } from '$lib/authoring/studio/studio-model';
import { FIXTURE_PROJECT_ID, buildCurrentSourceFixture } from '../__fixtures__/f4-current-source-fixtures';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

async function mount() {
	const { project } = await buildCurrentSourceFixture();
	const admitted = await admitSource(project, {
		sessionEpoch: 'studio-scope',
		acceptedRevision: { projectId: FIXTURE_PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error('fixture not admitted');
	const session = createStageSession({ sessionEpoch: admitted.snapshot.sessionEpoch });
	session.replace(admitted.snapshot);
	const subjectScope = createSubjectScope();
	const facade = createStageFacade({ snapshot: admitted.snapshot, session, subjectScope });
	facade.acquireInspection('exclusive');
	const evaluated = facade.camera.evaluate(RECT, 3);
	if (evaluated.kind !== 'evaluated') throw new Error('viewport did not evaluate');
	for (const id of ['a', 'b']) {
		facade.registerStageAdapter({
			id,
			tasks: [{ id: `${id}-task`, taskKind: 'work', label: id }],
			findEntries: [{ id: `${id}-find`, taskKind: 'work', label: id, railFamily: 'place', capability: 'probe' }],
			instrument: () => ({ summary: id })
		});
	}
	facade.overlays();
	facade.tasks();
	return { facade, subjectScope };
}

describe('operation scope at the facade', () => {
	it('opens every operation when unscoped', async () => {
		const { facade } = await mount();
		expect(facade.openContributedTask('a-task', 'a').kind).toBe('opened');
		expect(facade.openFindEntry('b', 'b-find').kind).toBe('opened');
		facade.dispose();
	});

	it('refuses tasks and Find entries the posture does not offer, and admits the rest', async () => {
		const { facade, subjectScope } = await mount();
		subjectScope.set({ entityId: 'root', admitsOperation: (adapter) => adapter === 'a' });
		expect(facade.openContributedTask('b-task', 'b')).toMatchObject({ kind: 'refused' });
		expect(facade.openFindEntry('b', 'b-find')).toMatchObject({ kind: 'refused' });
		expect(facade.session.task()).toBeNull();
		expect(facade.openContributedTask('a-task', 'a').kind).toBe('opened');
		subjectScope.set(null);
		expect(facade.openContributedTask('b-task', 'b').kind).toBe('opened');
		facade.dispose();
	});

	it('does not run a refused Find entry’s own side effect', async () => {
		const { facade, subjectScope } = await mount();
		let invoked = 0;
		facade.registerStageAdapter({
			id: 'c',
			tasks: [{ id: 'c-task', taskKind: 'work-c', label: 'c' }],
			findEntries: [{ id: 'c-find', taskKind: 'work-c', label: 'c', railFamily: 'place', capability: 'probe', onInvoke: () => { invoked += 1; } }],
			instrument: () => ({ summary: 'c' })
		});
		facade.tasks();
		subjectScope.set({ entityId: 'root', admitsOperation: isStudioOperation });
		expect(facade.openFindEntry('c', 'c-find').kind).toBe('refused');
		expect(invoked).toBe(0);
		facade.dispose();
	});

	it('hides refused tasks from the offered list', async () => {
		const { facade, subjectScope } = await mount();
		subjectScope.set({ entityId: 'root', admitsOperation: (adapter) => adapter === 'a' });
		expect(facade.tasks().map((task) => task.id)).toEqual(['a-task']);
		facade.dispose();
	});
});

describe('selection scope at the facade', () => {
	it('refuses a selection of a different Scene entity', async () => {
		const { facade, subjectScope } = await mount();
		subjectScope.set({ entityId: 'root' });
		const result = facade.setSelection({
			ordered: [{ reference: { domain: 'scene', subject: { kind: 'entity', id: 'other' } } }]
		} as never);
		expect(result).toMatchObject({ kind: 'refused', code: 'out-of-scope' });
		facade.dispose();
	});
});

describe('Card action scope at the facade', () => {
	const subject = (sourceId: string) => ({ sourceId, sourceKind: 'entity', ref: null });
	async function withActions() {
		const mounted = await mount();
		const ran: string[] = [];
		mounted.facade.registerStageAdapter({
			id: 'scene',
			cardActions: (s) => [{
				id: 'delete', label: 'Delete', destructive: true, detail: 'x',
				run: async () => { ran.push(s.sourceId); return { kind: 'accepted' as const }; }
			}],
			instrument: () => ({ summary: 'scene' })
		});
		return { ...mounted, ran };
	}

	it('offers the actions unscoped', async () => {
		const { facade, ran } = await withActions();
		const [action] = facade.cardActions(subject('root'));
		expect(action?.id).toBe('delete');
		await action!.run();
		expect(ran).toEqual(['root']);
		facade.dispose();
	});

	it('withholds the protected root’s actions and refuses a record held from before', async () => {
		const { facade, subjectScope, ran } = await withActions();
		const [held] = facade.cardActions(subject('root'));
		subjectScope.set({ entityId: 'root', admitsCardAction: (adapter, id) => studioAdmitsCardAction('root', adapter, id) });
		expect(facade.cardActions(subject('root'))).toEqual([]);
		expect(await held!.run()).toMatchObject({ kind: 'refused' });
		expect(ran).toEqual([]);
		facade.dispose();
	});
});

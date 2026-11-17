/**
 * `studio.profile-revision` — the outline task through the real Scene adapter.
 *
 * The task is opened as Object Studio opens it (the contributed task, selected
 * form as its target), then driven through the session the Card uses: typed
 * anchors, the smooth flag, the physical extent, Apply, Discard. Every assertion
 * is a Stage-visible fact — accepted source, history, ghost, Camera reading and
 * the object Card's fields — never the session's private state.
 */
import { describe, expect, it } from 'vitest';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core';
import type { SceneEntity, Vec3 } from '@portfolio/project-model';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { createAdapter } from '$lib/authoring/adapters/scene.adapter';
import { profileRevisionSession } from '$lib/authoring/adapters/scene/profile-revision';
import { SCENE_PROFILE_REVISION_TASK } from '$lib/authoring/adapters/scene/scene-task-ids';
import { sceneObjectCardController } from '$lib/authoring/adapters/scene/object-card';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
import { createStageAdapterServices, mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const PROJECT_ID = 'project-profile-revision';
const FORM_ID = 'entity-profile-form';
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

function nativeForm(): SceneEntity {
	return {
		kind: 'form',
		id: FORM_ID,
		name: 'Plan form',
		position: [4, 0, 3],
		rotation: [0, 0, 0],
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		form: {
			generator: {
				kind: 'extrude',
				plane: 'plan',
				extent: 1,
				outline: [
					{ key: 1, u: -0.5, v: 0, smooth: false },
					{ key: 2, u: 0.5, v: 0, smooth: false },
					{ key: 3, u: 0.5, v: 1, smooth: false },
					{ key: 4, u: -0.5, v: 1, smooth: false }
				]
			},
			scale: [1.3, 1, 1],
			nextKey: 5
		}
	};
}

async function project(): Promise<ProjectEnvelope> {
	const baseline = createEmptyWallFirstLayoutDocument();
	const planned = planWallChain({
		baseline,
		points: [[0, 0], [7, 0], [7, 6], [0, 6]],
		close: true,
		capture: freshCapture(),
		levelId: baseline.floor.id
	});
	if (planned.kind !== 'success') throw new Error('the room fixture was refused');
	return createUnitProject({
		id: PROJECT_ID,
		name: 'Profile revision',
		layout: planned.document,
		scene: {
			formatVersion: 1,
			textures: [],
			materials: [],
			entities: [nativeForm()],
			navigationNodes: [],
			connections: []
		}
	});
}

async function mounted() {
	const source = await project();
	const admitted = await admitSource(source, {
		sessionEpoch: 'session-profile-revision',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error('the outline fixture was not admitted');
	const stageSession = createStageSession({ sessionEpoch: admitted.snapshot.sessionEpoch });
	stageSession.replace(admitted.snapshot);
	const facade = createStageFacade({ snapshot: admitted.snapshot, session: stageSession });
	if (facade.camera.evaluate(RECT, 1).kind !== 'evaluated') throw new Error('no evaluation');
	facade.acquireInspection('exclusive');
	const host = createStageAcceptanceHost({
		facade,
		sessionEpoch: admitted.snapshot.sessionEpoch,
		baseline: {
			revision: admitted.snapshot.acceptedRevision,
			source,
			canonicalJson: admitted.snapshot.canonicalJson,
			sourceContentId: admitted.snapshot.sourceContentId
		}
	});
	if (mountStageAdapter(facade, host, createAdapter).kind !== 'registered') {
		throw new Error('the Scene adapter did not mount');
	}
	await new Promise((resolve) => setTimeout(resolve, 0));
	return { facade, host, services: createStageAdapterServices(facade, host) };
}

function select(facade: StageFacade, entityId: string): void {
	const reference = sceneEntityReference(entityId, facade.snapshot().domain.unitRevisions.scene);
	facade.setSelection({ ordered: [{ reference }], primary: reference });
}

function formEntity(facade: StageFacade): Extract<SceneEntity, { kind: 'form' }> {
	const entity = stageEnvelope(facade.snapshot()).units.scene.data.entities.find(
		(entry) => entry.id === FORM_ID
	);
	if (entity?.kind !== 'form') throw new Error('the accepted form disappeared');
	return entity;
}

async function openOutline(facade: StageFacade) {
	select(facade, FORM_ID);
	expect(facade.selectionState().primary?.subject.id).toBe(FORM_ID);
	// A source install leaves factory bindings pending until the next live view.
	facade.camera.evaluate(RECT, 10);
	await new Promise((resolve) => setTimeout(resolve, 5));
	const opened = facade.openContributedTask(SCENE_PROFILE_REVISION_TASK, 'scene');
	if (opened.kind !== 'opened') throw new Error(`Edit outline was not opened: ${opened.message}`);
	expect(opened.task.kind).toBe('revise-form-profile');
	expect(opened.instrument?.summary).toBe('Edit outline');
	const session = profileRevisionSession();
	if (session === null) throw new Error('the outline session was not published');
	// The live selection is the target, not a stale contribution targetRef.
	expect(session.state()?.entityId).toBe(FORM_ID);
	return session;
}

function fieldsOf(services: Awaited<ReturnType<typeof mounted>>['services']) {
	return sceneObjectCardController(services, FORM_ID)?.fields().map((field) => field.id) ?? [];
}

describe('studio.profile-revision — outline task', () => {
	it('previews a typed revision, applies one F4 entry and keeps every identity', async () => {
		const { facade, host, services } = await mounted();
		const session = await openOutline(facade);
		const state = session.state();
		if (state === null) throw new Error('the task captured no form');
		expect(state).toMatchObject({ plane: 'plan', extentLabel: 'Height', extent: 1 });
		expect(state.anchors.map((anchor) => anchor.key)).toEqual([1, 2, 3, 4]);
		// The Card keeps exactly one writer for the extent while the task is open.
		expect(fieldsOf(services)).not.toContain('height');
		expect(fieldsOf(services)).toEqual(expect.arrayContaining(['width', 'depth']));

		// A plan profile enters Camera's Plan reading; nothing else moved.
		facade.camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, 2);
		facade.camera.evaluate(RECT, 20);
		expect(facade.camera.evaluation()?.settledReading).toBe('plan');

		const beforeJson = facade.snapshot().canonicalJson;
		const beforeHistory = host.history();
		session.setAnchor(0, { u: -0.7 });
		session.setAnchor(2, { smooth: true });
		session.setExtentPhysical(1.4);
		expect(facade.snapshot().canonicalJson).toBe(beforeJson);
		expect(host.history()).toEqual(beforeHistory);
		expect(profileRevisionSession()?.state()?.refusal).toBeNull();
		expect(facade.ghosts().some((ghost) => ghost.id === 'scene-profile-revision-body')).toBe(true);
		expect(session.candidatePreview()?.segments).toHaveLength(4);

		const outcome = await session.apply();
		expect(outcome).toEqual({ kind: 'installed' });
		facade.closeTask();
		const revised = formEntity(facade);
		expect(revised.form.generator.outline.map((anchor) => anchor.key)).toEqual([1, 2, 3, 4]);
		expect(revised.form.generator.outline[0]).toMatchObject({ key: 1, u: -0.7, v: 0, smooth: false });
		expect(revised.form.generator.outline[2]).toMatchObject({ key: 3, smooth: true });
		expect(revised.form.generator.extent).toBe(1.4);
		expect(revised.form.generator.plane).toBe('plan');
		expect(revised.form.nextKey).toBe(5);
		expect(revised.form.scale).toEqual([1.3, 1, 1]);
		expect(revised.position).toEqual([4, 0, 3]);
		expect(revised.rotation).toEqual([0, 0, 0]);
		expect(host.history()).toMatchObject({ depth: beforeHistory.depth + 1, position: beforeHistory.position + 1 });
		// Closing the task restores the Card's own extent writer.
		expect(fieldsOf(services)).toContain('height');

		const revisedJson = facade.snapshot().canonicalJson;
		await host.undo();
		expect(facade.snapshot().canonicalJson).toBe(beforeJson);
		await host.redo();
		expect(facade.snapshot().canonicalJson).toBe(revisedJson);
	});

	it('applies a repeated revision and discards a draft without writing', async () => {
		const { facade, host } = await mounted();
		const first = await openOutline(facade);
		first.setAnchor(1, { v: 0.2 });
		expect(await first.apply()).toEqual({ kind: 'installed' });
		facade.closeTask();
		const acceptedJson = facade.snapshot().canonicalJson;
		const acceptedHistory = host.history();

		const second = await openOutline(facade);
		second.setAnchor(1, { v: 0.4 });
		second.setExtentPhysical(0.8);
		second.discard();
		facade.closeTask();
		expect(facade.snapshot().canonicalJson).toBe(acceptedJson);
		expect(formEntity(facade).form.generator.outline[1]?.v).toBe(0.2);
		expect(formEntity(facade).form.generator.extent).toBe(1);
		expect(host.history()).toEqual(acceptedHistory);
	});

	it('refuses a crossed outline in the task and writes nothing', async () => {
		const { facade, host } = await mounted();
		const session = await openOutline(facade);
		const before = facade.snapshot().canonicalJson;
		const beforeHistory = host.history();
		// Swap the two top anchors' U values so opposite edges cross.
		session.setAnchor(2, { u: -0.9 });
		session.setAnchor(3, { u: 0.9 });
		const state = session.state();
		expect(state?.refusal).not.toBeNull();
		const outcome = await session.apply();
		expect(outcome.kind).toBe('refused');
		expect(facade.snapshot().canonicalJson).toBe(before);
		expect(host.history()).toEqual(beforeHistory);
		facade.closeTask();
	});

	it('rejects a no-op Apply without adding an entry', async () => {
		const { facade, host } = await mounted();
		const session = await openOutline(facade);
		const before = host.history();
		expect(await session.apply()).toEqual({ kind: 'no-op' });
		expect(host.history()).toEqual(before);
		facade.closeTask();
	});
});

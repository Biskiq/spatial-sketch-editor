/**
 * T2.P01.S03 — the first coherent Scene editing surface.
 *
 * Two halves, both through public seams only:
 *
 * 1. **Session** (`createSceneSession`): arming is session state, preview and
 *    commit run the same planner with the same captured inputs, snap is explicit,
 *    one cancel path restores the accepted baseline, and typed entry is never
 *    coerced (blank is not zero).
 * 2. **Adapter** (`createAdapter`): the ten Scene planners register with the one
 *    F.4 host, and the Place/Compose/Import Find entries, tasks, Card facts and
 *    instrument reach the Stage through AM-5 without any shell edit. R217.S08
 *    adds object marks and retires the Arrange task.
 *
 * No test here writes Layout: every accepted intent is a Scene operation.
 */

import { Mesh, MeshBasicMaterial } from 'three';
import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import { buildFormGeometry } from '$lib/render/entities/form-geometry';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import type { SceneEntity, ScenePrimitiveEntity, Vec3 } from '@portfolio/project-model/scene';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core/wall';
import { planCreateRegion } from '@portfolio/layout-core/room';
import { createSceneSession, publishSceneSurface, sceneEntityReference, sceneReadingKey, type SceneWritePort } from '$lib/authoring/adapters/scene/placement';
import { stageLayout, stageScene } from '$lib/authoring/stage/unit-stage-source';
import { createAdapter } from '$lib/authoring/adapters/scene.adapter';
import { sceneObjectCommands } from '../__fixtures__/scene-object-commands';
import { sceneObjectCardController } from '$lib/authoring/adapters/scene/object-card';
import { SCENE_OBJECT_MARK } from '$lib/authoring/adapters/scene/object-marks';
import { armTile } from '$lib/authoring/adapters/scene/shape/armed-tile';
import { captureUnitSave } from '@portfolio/project-model/units';
import { creatorModelResourceEntry } from '@portfolio/project-model/scene-planning';
import { createStageAdapterServices, mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { buildCurrentSourceFixture, FIXTURE_ENTITY_ID, FIXTURE_PROJECT_ID } from '../__fixtures__/f4-current-source-fixtures';
import { createUnitProject } from '../__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../../../../../../packages/layout-core/tests/__fixtures__/layout-id-capture';
const ENTITY_ID = 'entity-scene-box';
const PROJECT_ID = 'project-scene-editing';
// These pin existing Place; a drawn tile is a separate route (shape-draw-session).
beforeEach(() => {
	armTile(PROJECT_ID, null);
	armTile(FIXTURE_PROJECT_ID, null);
});
const BASELINE: Vec3 = [2, 0.5, 2];
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
async function supportedProject(
	entities: readonly SceneEntity[],
	modelEntry?: NonNullable<ReturnType<typeof creatorModelResourceEntry>>,
	region?: { readonly footprint: [number, number][]; readonly elevation: number }
): Promise<ProjectEnvelope> {
	const planned = planWallChain({
		baseline: createEmptyWallFirstLayoutDocument(),
		points: [
			[0, 0],
			[7, 0],
			[7, 6],
			[0, 6]
		],
		close: true,
		capture: freshCapture(),
		levelId: createEmptyWallFirstLayoutDocument().floor.id
	});
	if (planned.kind !== 'success') throw new Error('the wall fixture was refused');
	let layout = planned.document;
	if (region !== undefined) {
		const created = planCreateRegion({
			baseline: layout,
			capture: freshCapture(),
			intent: {
				role: 'floor',
				footprint: region.footprint,
				elevation: region.elevation,
				thickness: 0.2
			}
		});
		if (created.kind !== 'success') throw new Error('the region fixture was refused');
		layout = created.document;
	}
	const project = await createUnitProject({
		id: PROJECT_ID,
		name: 'Scene editing',
		layout,
		...(modelEntry === undefined
			? {}
			: { resources: { formatVersion: 3 as const, resources: [modelEntry.resource] } }),
		scene: { formatVersion: 1, textures: [], materials: [], entities: [...entities], navigationNodes: [], connections: [] }
	});
	return modelEntry === undefined
		? project
		: { ...project, dependencyLock: { ...project.dependencyLock, entries: [modelEntry.lock] } };
}
function boxEntity(id = ENTITY_ID, position: Vec3 = BASELINE): Extract<ScenePrimitiveEntity, { primitive: 'box' }> {
	return {
		kind: 'primitive',
		primitive: 'box',
		id,
		name: 'Block',
		dimensions: { width: 1, height: 1, depth: 1 },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		position,
		rotation: [0, 0, 0]
	};
}

describe('card and history', () => {
	async function mounted(
		project?: ProjectEnvelope,
		rect: typeof RECT = RECT
	) {
		const source = project ?? (await buildCurrentSourceFixture()).project;
		const admitted = await admitSource(source, {
			sessionEpoch: 'session-scene-adapter',
			acceptedRevision: { projectId: source.id, revisionId: 'revision-boot' }
		});
		if (admitted.kind !== 'admitted') throw new Error('the adapter fixture was not admitted');
		const stageSession = createStageSession({ sessionEpoch: admitted.snapshot.sessionEpoch });
		stageSession.replace(admitted.snapshot);
		const rendered = createScenePickSource();
		rendered.setSource(admitted.snapshot.domain.scene);
		const meshes: Mesh[] = [];
		for (const entity of admitted.snapshot.domain.scene.entities) {
			if (entity.kind !== 'form') continue;
			const mesh = new Mesh(buildFormGeometry(evaluateFormMesh(entity.form)!, entity.form.generator.plane), new MeshBasicMaterial());
			mesh.position.fromArray(entity.position);
			mesh.rotation.set(...entity.rotation);
			rendered.register(entity.id, mesh);
			meshes.push(mesh);
		}
		const facade = createStageFacade({ snapshot: admitted.snapshot, session: stageSession, scenePick: rendered.pick, sceneBounds: rendered.bounds });
		// A factory-bound adapter only binds against a live evaluation.
		const evaluated = facade.camera.evaluate(rect, 1);
		if (evaluated.kind !== 'evaluated') throw new Error('the adapter fixture did not evaluate');
		facade.acquireInspection('exclusive');
		const host = createStageAcceptanceHost({
			facade,
			sessionEpoch: admitted.snapshot.sessionEpoch,
			baseline: {
				revision: admitted.snapshot.acceptedRevision,
				source,
				canonicalJson: admitted.snapshot.canonicalJson,
				sourceContentId: admitted.snapshot.sourceContentId
			},
			planners: []
		});
		return { facade, host, rendered };
	}

	function nativeForm(plane: 'plan' | 'elevation', x: number): SceneEntity {
		return { kind: 'form', id: `form-${plane}`, name: `${plane} form`, position: [x, 0, 3], rotation: [0, 0, 0],
			materialId: 'plaster-warm', castShadow: true, receiveShadow: true,
			form: { generator: { kind: 'extrude', plane, extent: 1, outline: [
				{ key: 1, u: -0.5, v: 0, smooth: false }, { key: 2, u: 0.5, v: 0, smooth: false },
				{ key: 3, u: 0.5, v: 1, smooth: false }, { key: 4, u: -0.5, v: 1, smooth: false }
			] }, scale: [1, 1, 1], nextKey: 5 } };
	}

	// A Scene object is one thing wherever it came from: a primitive, a catalogue
	// model and a drawn form share one Card writer, one action set and one mark
	// vocabulary. Only sizing differs (a uniform Size, or a form's per-axis rays).
	it('gives every Scene object kind the same Card, actions and shared marks', async () => {
		const { facade, host } = await mounted(await supportedProject([boxEntity('box-1', [2, 0.5, 2]), nativeForm('plan', 4)]));
		mountStageAdapter(facade, host, createAdapter);
		try {
			facade.camera.applyIntent({ kind: 'set-reading', reading: '3d' }, 20);
			facade.camera.evaluate(RECT, 30);
			const read = (id: string) => {
				const row = facade.subjects().find((item) => item.reference.subject.id === id)!;
				facade.setSelection({ ordered: [{ reference: row.reference }], primary: row.reference });
				// The chip's open state outlives the selection; open it only once.
				if (facade.marks().find((mark) => mark.id === SCENE_OBJECT_MARK.scalePoint)?.open !== true) {
					facade.activateDisclosure(SCENE_OBJECT_MARK.scalePoint);
				}
				const subject = { sourceId: id, sourceKind: 'entity', reference: row.reference, ref: null };
				const writer = facade.cardWriter(subject);
				return {
					summary: writer?.summary,
					component: writer?.view?.component,
					actions: facade.cardActions(subject).map((action) => action.id),
					marks: new Set(facade.marks().map((mark) => mark.id))
				};
			};
			const box = read('box-1');
			const form = read('form-plan');
			expect(form.summary).toBe(box.summary);
			expect(form.component).toBe(box.component);
			expect(form.component).toBeDefined();
			expect(form.actions).toEqual(box.actions);
			for (const id of [SCENE_OBJECT_MARK.move, SCENE_OBJECT_MARK.turn, SCENE_OBJECT_MARK.scalePoint, SCENE_OBJECT_MARK.lift]) {
				expect(box.marks.has(id)).toBe(true);
				expect(form.marks.has(id)).toBe(true);
			}
			// The one kind-specific capability: per-axis rays on a form only.
			expect(form.marks.has('scene-form-mark-width')).toBe(true);
			expect(box.marks.has('scene-form-mark-width')).toBe(false);
		} finally { facade.dispose(); }
	});

	it('writes a form dimension through the shared Card in one history entry', async () => {
		const { facade, host } = await mounted(await supportedProject([nativeForm('plan', 2)]));
		mountStageAdapter(facade, host, createAdapter);
		const services = createStageAdapterServices(facade, host);
		try {
			const card = sceneObjectCardController(services, 'form-plan')!;
			expect(card.fields().map((field) => field.id)).toEqual(['position-x', 'position-z', 'yaw', 'width', 'height', 'depth', 'elevation']);
			const depth = host.history().depth;
			card.edit('width', '2');
			expect(card.fields().find((field) => field.id === 'width')?.error).toBeNull();
			expect((await card.commit('width')).kind).toBe('accepted');
			const sized = stageScene(facade.snapshot()).entities.find((entity) => entity.id === 'form-plan');
			expect(sized?.kind === 'form' && sized.form.scale[0]).toBeCloseTo(2, 9);
			expect(host.history().depth).toBe(depth + 1);
			card.edit('height', '0');
			expect(card.fields().find((field) => field.id === 'height')?.error).not.toBeNull();
		} finally { facade.dispose(); }
	});

	it('operates a selected form through its Card, shared history and a saved cold reopen', async () => {
		const { facade, host } = await mounted(await supportedProject([nativeForm('plan', 2), nativeForm('elevation', 4)]));
		mountStageAdapter(facade, host, createAdapter);
		const services = createStageAdapterServices(facade, host);
		try {
			const row = facade.subjects().find((item) => item.reference.subject.id === 'form-plan')!;
			facade.setSelection({ ordered: [{ reference: row.reference }], primary: row.reference });
			const card = () => sceneObjectCommands(services, 'form-plan')!;
			const before = JSON.stringify(stageScene(facade.snapshot()).entities);
			expect((await card().move(3, 3)).kind).toBe('installed');
			expect(facade.selectionState().primary?.subject.id).toBe('form-plan');
			expect((await card().turn(0.4)).kind).toBe('installed');
			expect((await card().place(3, 4)).kind).toBe('installed');
			expect((await card().size([2, 1.5, 1])).kind).toBe('installed');
			const sized = stageScene(facade.snapshot()).entities.find((entity) => entity.id === 'form-plan');
			expect(sized?.kind === 'form' && sized.form.scale).toEqual([2, 1.5, 1]);
			const depth = host.history().depth;
			// Save posts the accepted source this Card was built for, adds no history
			// entry and never touches the project.
			const beforeSave = JSON.stringify(stageScene(facade.snapshot()).entities);
			const sent: { form: unknown }[] = [];
			const saveOutcome = await card().save({
				save: async (payload: { form: unknown }) => {
					sent.push(payload);
					return {
						id: '11111111-1111-4111-8111-111111111111',
						name: 'plan form',
						kind: 'form' as const,
						formatVersion: 1,
						contentId: `sha256-${'a'.repeat(64)}`,
						createdAt: '2026-10-28T12:00:00.000Z'
					};
				}
			} as never);
			expect(saveOutcome.kind).toBe('accepted');
			expect(sent).toHaveLength(1);
			expect(sent[0]?.form).toEqual(sized?.kind === 'form' ? sized.form : null);
			expect(host.history().depth).toBe(depth);
			expect(JSON.stringify(stageScene(facade.snapshot()).entities)).toBe(beforeSave);
			expect((await card().size([0, 1, 1])).kind).toBe('refused');
			expect(host.history().depth).toBe(depth);
			expect((await card().duplicate()).kind).toBe('installed');
			const copyId = facade.selectionState().primary!.subject.id;
			expect(copyId).not.toBe('form-plan');
			expect((await sceneObjectCommands(services, copyId)!.delete()).kind).toBe('installed');
			expect(facade.selectionState().primary).toBeNull();
			expect(host.history().depth).toBe(7);
			for (let index = 0; index < 6; index++) expect((await host.undo()).kind).toBe('installed');
			expect(JSON.stringify(stageScene(facade.snapshot()).entities)).toBe(before);
			for (let index = 0; index < 6; index++) expect((await host.redo()).kind).toBe('installed');
			const saved = await captureUnitSave({ snapshot: host.coordinator().acceptedSnapshot(), operationId: 'save-form', precondition: { kind: 'create-only' } });
			expect(saved.kind).toBe('captured');
			if (saved.kind !== 'captured') throw new Error('save capture failed');
			const reopened = await admitSource(JSON.parse(saved.capture.canonicalJson), { sessionEpoch: 'reopen', acceptedRevision: host.acceptedRevision() });
			expect(reopened.kind).toBe('admitted');
			if (reopened.kind === 'admitted') expect(stageScene(reopened.snapshot).entities).toEqual(stageScene(facade.snapshot()).entities);
		} finally { facade.dispose(); }
	});

	it('Save re-reads the live accepted source after an accepted edit', async () => {
		const { facade, host } = await mounted(await supportedProject([nativeForm('plan', 2)]));
		mountStageAdapter(facade, host, createAdapter);
		const services = createStageAdapterServices(facade, host);
		const stale = sceneObjectCommands(services, 'form-plan')!;
		try {
			expect((await sceneObjectCommands(services, 'form-plan')!.size([2, 1, 1])).kind).toBe('installed');
			const live = stageScene(facade.snapshot()).entities.find((entity) => entity.id === 'form-plan');
			expect(live?.kind).toBe('form');
			if (live?.kind !== 'form') return;
			const sent: { form: unknown }[] = [];
			const depth = host.history().depth;
			const outcome = await stale.save({
				save: async (payload: { form: unknown }) => {
					sent.push(payload);
					return {
						id: '11111111-1111-4111-8111-111111111111',
						name: 'plan form',
						kind: 'form' as const,
						formatVersion: 1,
						contentId: `sha256-${'b'.repeat(64)}`,
						createdAt: '2026-10-28T12:00:00.000Z'
					};
				}
			} as never);
			expect(outcome.kind).toBe('accepted');
			expect(sent[0]?.form).toEqual(live.form);
			expect(host.history().depth).toBe(depth);
		} finally {
			facade.dispose();
		}
	});

	/** A mounted adapter with the instrument's one published session for this evaluation. */
	async function withSceneSurface(
		accept?: SceneWritePort['accept'],
		taskId: 'scene-place' | null = null,
		project?: ProjectEnvelope,
		rect: typeof RECT = RECT,
		reading: '3d' | 'plan' = '3d',
		selectedEntityId = FIXTURE_ENTITY_ID
	) {
		const { facade, host, rendered } = await mounted(project, rect);
		if (reading === 'plan') {
			facade.camera.applyIntent({ kind: 'set-reading', reading }, 2);
			facade.camera.evaluate(rect, 3);
		}
		mountStageAdapter(facade, host, createAdapter);
		const evaluationId = facade.evaluationId();
		if (evaluationId === null) throw new Error('the adapter fixture has no evaluation');
		const snapshot = facade.snapshot();
		const intents: AuthoringIntent[] = [];
		const session = createSceneSession({
			snapshot: {
				projectId: snapshot.acceptedRevision.projectId,
				contentRevision: snapshot.domain.unitRevisions.scene,
				source: { layout: stageLayout(snapshot), scene: stageScene(snapshot) },
				compileGeneration: snapshot.compileGeneration,
				evaluationId
			},
			port: {
				accept:
					accept ??
					(async (intent) => {
						intents.push(intent);
						return { kind: 'installed' };
					}),
				acceptedRevision: () => ({ revisionId: snapshot.acceptedRevision.revisionId }),
				acquireGesture: (request) => facade.acquireGesture(request)
			}
		});
		const evaluation = facade.evaluation();
		if (evaluation === null) throw new Error('the adapter fixture has no evaluation');
		publishSceneSurface(snapshot, { reading: sceneReadingKey(evaluation), session });
		const reference = sceneEntityReference(selectedEntityId, snapshot.domain.unitRevisions.scene);
		facade.setSelection({ ordered: [{ reference }], primary: reference });
		if (taskId !== null) facade.openContributedTask(taskId, 'scene');
		return { facade, host, rendered, session, evaluationId, evaluation, intents, snapshot };
	}

	/** The admitted mark a test presses, by role and optional id. */
	function markOf(
		facade: ReturnType<typeof createStageFacade>,
		id: string
	): ReturnType<ReturnType<typeof createStageFacade>['marks']>[number] {
		const mark = facade.marks().find((candidate) => candidate.id === id);
		if (mark === undefined) throw new Error(`the fixture has no mark "${id}"`);
		return mark;
	}

	function stageCssOf(facade: ReturnType<typeof createStageFacade>, point: Vec3): [number, number] {
		const [x, y] = cssOf(facade, point);
		const rect = facade.evaluation()!.rect;
		return [x - rect.left, y - rect.top];
	}

	function cssOf(facade: ReturnType<typeof createStageFacade>, point: Vec3): [number, number] {
		const evaluationId = facade.evaluationId();
		if (evaluationId === null) throw new Error('the adapter fixture has no evaluation');
		const projected = facade.projectWorld(point, evaluationId);
		if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
		return [projected.css[0], projected.css[1]];
	}

	async function eventually(predicate: () => boolean): Promise<void> {
		for (let attempt = 0; attempt < 40; attempt += 1) {
			if (predicate()) return;
			await new Promise((resolve) => setTimeout(resolve, 5));
		}
		throw new Error('the fixture did not settle');
	}

	/** A mounted adapter over a real acceptance host, with the Place task open. */
	async function acceptedPlaceSurface(beforeAccept?: () => Promise<void>) {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const admitted = await admitSource(project, {
			sessionEpoch: 'session-scene-accepted',
			acceptedRevision: { projectId: project.id, revisionId: 'revision-boot' }
		});
		if (admitted.kind !== 'admitted') throw new Error('the accepted fixture was not admitted');
		const stageSession = createStageSession({ sessionEpoch: admitted.snapshot.sessionEpoch });
		stageSession.replace(admitted.snapshot);
		const facade = createStageFacade({ snapshot: admitted.snapshot, session: stageSession });
		const evaluated = facade.camera.evaluate(RECT, 1);
		if (evaluated.kind !== 'evaluated') throw new Error('the accepted fixture did not evaluate');
		facade.acquireInspection('exclusive');
		const host = createStageAcceptanceHost({
			facade,
			sessionEpoch: admitted.snapshot.sessionEpoch,
			baseline: {
				revision: admitted.snapshot.acceptedRevision,
				source: project,
				canonicalJson: admitted.snapshot.canonicalJson,
				sourceContentId: admitted.snapshot.sourceContentId
			},
			planners: []
		});
		// `beforeAccept` lets a test hold the accepted install open, so a close can
		// arrive while the placement's acceptance is still in flight.
		mountStageAdapter(
			facade,
			beforeAccept === undefined
				? host
				: { ...host, accept: async (intent) => { await beforeAccept(); return host.accept(intent); } },
			createAdapter
		);
		// The placement planner is registered once its metadata identity exists.
		await new Promise((resolve) => setTimeout(resolve, 0));
		const opened = facade.openContributedTask('scene-place', 'scene');
		if (opened.kind !== 'opened') throw new Error(`Place was not opened: ${opened.message}`);
		return { facade, host };
	}

	/** A real acceptance host with no task open, so the object marks are live. */
	async function acceptedMarksSurface() {
		const { facade, host } = await acceptedPlaceSurface();
		facade.closeTask();
		const snapshot = facade.snapshot();
		const reference = sceneEntityReference(FIXTURE_ENTITY_ID, snapshot.domain.unitRevisions.scene);
		facade.setSelection({ ordered: [{ reference }], primary: reference });
		return { facade, host };
	}

	it('writes the same Position, Yaw and Size facts through the Card controller', async () => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const { facade, host } = await withSceneSurface(undefined, null, project);
		const services = createStageAdapterServices(facade, host);
		const controller = sceneObjectCardController(services, FIXTURE_ENTITY_ID);
		expect(controller).not.toBeNull();
		expect(controller!.fields().map((field) => field.id)).toEqual([
			'position-x',
			'position-z',
			'yaw',
			'size',
			'elevation'
		]);

		// The Card field set and the mark fact set are the same declaration. The
		// lift fact is published once the chip reveals its knob; uniform scale is
		// the chip's own drag (review pass 2 §6), so it carries no edit fact.
		expect(facade.activateDisclosure('scene-object-scale-point')).toBe(true);
		const fieldFacts = new Set(
			controller!.fields().map((field) =>
				field.id === 'position-x' || field.id === 'position-z'
					? 'position'
					: field.id === 'yaw'
						? 'yaw'
						: field.id === 'elevation'
							? 'lift'
							: 'scale'
			)
		);
		const markFacts = new Set([
			...facade
				.marks()
				.filter((mark) => mark.role === 'edit')
				.map((mark) => mark.fact),
			...(facade.marks().some((mark) => mark.id === 'scene-object-scale-point' && mark.descriptor.role === 'disclose' && mark.descriptor.drags === true)
				? ['scale']
				: [])
		]);
		expect(fieldFacts).toEqual(markFacts);

		controller!.edit('size', '0');
		expect(controller!.fields().find((field) => field.id === 'size')?.error).toBeTruthy();
		const beforeRefusal = host.history().depth;
		const beforeRefusalSource = facade.snapshot().canonicalJson;
		await expect(controller!.commit('size')).resolves.toMatchObject({ kind: 'refused' });
		expect(host.history().depth).toBe(beforeRefusal);
		expect(facade.snapshot().canonicalJson).toBe(beforeRefusalSource);

		// Blur never writes: the accepted value returns and the draft is gone.
		const acceptedX = controller!.fields().find((field) => field.id === 'position-x')!.text;
		controller!.edit('position-x', '9.5');
		controller!.blur('position-x');
		expect(controller!.fields().find((field) => field.id === 'position-x')?.text).toBe(acceptedX);
		controller!.edit('position-x', '9.5');
		expect(controller!.cancel('position-x')).toBe(true);
		expect(controller!.fields().find((field) => field.id === 'position-x')?.text).toBe(acceptedX);

		controller!.edit('yaw', '90');
		expect(controller!.fields().find((field) => field.id === 'yaw')?.error).toBeNull();
		await expect(controller!.commit('yaw')).resolves.toMatchObject({ kind: 'accepted' });
		await eventually(() => Math.abs(facade.snapshot().domain.scene.entities[0]!.rotation[1] - Math.PI / 2) < 1e-9);
		expect(facade.snapshot().domain.scene.entities[0]!.rotation[1]).toBeCloseTo(Math.PI / 2, 9);
	});

	it('removes the Arrange task, its Find entry and instrument posture', async () => {
		const { facade } = await withSceneSurface();
		const tasks = facade.tasks().filter((task) => task.adapterId === 'scene');
		expect(tasks.map((task) => task.taskKind)).toEqual([
			'scene-compose',
			// T5.2: the Studio-only outline revision, opened from the root's Card.
			'revise-form-profile',
			'place-object',
			'import-model'
		]);
		const findEntries = facade.findEntries().filter((entry) => entry.adapterId === 'scene');
		expect(findEntries.some((entry) => entry.taskKind === 'scene-arrange' || entry.id === 'scene-arrange')).toBe(false);
		expect(facade.openContributedTask('scene-arrange', 'scene').kind).not.toBe('opened');
		// Place and Library keep their entries.
		expect(findEntries.some((entry) => entry.taskKind === 'place-object')).toBe(true);
		expect(findEntries.some((entry) => entry.taskKind === 'import-model')).toBe(true);

		const writer = facade.cardWriter({
			sourceId: FIXTURE_ENTITY_ID,
			sourceKind: 'entity',
			ref: null,
			reference: sceneEntityReference(FIXTURE_ENTITY_ID, facade.snapshot().domain.unitRevisions.scene)
		});
		expect(writer?.summary).toBe('Object fields');
	});

	it('keeps Duplicate and Delete as object Card actions on a real host', async () => {
		const { facade } = await acceptedMarksSurface();
		const subject = () => ({
			sourceId: FIXTURE_ENTITY_ID,
			sourceKind: 'entity' as const,
			ref: null,
			reference: sceneEntityReference(
				FIXTURE_ENTITY_ID,
				facade.snapshot().domain.unitRevisions.scene
			)
		});
		const actions = facade.cardActions(subject());
		expect(actions.map((action) => action.id)).toEqual(
			expect.arrayContaining(['scene-object-duplicate', 'scene-object-delete'])
		);
		const duplicate = actions.find((action) => action.id === 'scene-object-duplicate');
		expect(duplicate?.destructive).toBeUndefined();
		// Duplicate is a secondary action (More), not a destructive one.
		expect(duplicate?.group).toBe('secondary');
		expect(actions.find((action) => action.id === 'scene-object-delete')?.group).toBeUndefined();
		// The object writer edits Position, Yaw and Size, so those facts are shown by the
		// writer rather than repeated as rows; the header carries the name and the kind.
		expect(facade.cardWriter(subject())?.fieldIds).toEqual(['position', 'yaw', 'scale', 'lift']);
		expect(facade.cardFacts(subject()).map((fact) => fact.fieldId)).toEqual(
			expect.arrayContaining(['kind', 'name', 'position', 'yaw', 'scale'])
		);
		// The writer edits X and Z only, so the plan position row is X and Z. Y is written
		// by no writer, so the elevation stays stated: a read-only row with no field id.
		const placed = facade.snapshot().domain.scene.entities.find((entity) => entity.id === FIXTURE_ENTITY_ID)!;
		const rows = facade.cardFacts(subject());
		expect(rows.find((fact) => fact.label === 'Position (X · Z)')).toMatchObject({
			value: `${placed.position[0]} m · ${placed.position[2]} m`,
			fieldId: 'position'
		});
		expect(rows.find((fact) => fact.label === 'Elevation')).toMatchObject({
			value: `${placed.position[1]} m`
		});
		expect(rows.find((fact) => fact.label === 'Elevation')?.fieldId).toBeUndefined();
		await expect(duplicate!.run()).resolves.toMatchObject({ kind: 'accepted' });
		await eventually(() => facade.snapshot().domain.scene.entities.length === 2);
		const copy = facade.snapshot().domain.scene.entities.find(
			(entity) => entity.id !== FIXTURE_ENTITY_ID
		);
		expect(copy).toBeDefined();
		expect(facade.selectionState().primary?.subject.id).toBe(copy!.id);
		// The installed source invalidates the live evaluation; the next frame
		// rebuilds the binding against the copy before its Card actions are read.
		facade.camera.evaluate(RECT, 2);

		const deleteSubject = () => ({
			...subject(),
			sourceId: copy!.id,
			reference: sceneEntityReference(
				copy!.id,
				facade.snapshot().domain.unitRevisions.scene
			)
		});
		await eventually(
			() => facade.cardActions(deleteSubject()).some((action) => action.id === 'scene-object-delete')
		);
		const deleteAction = facade
			.cardActions(deleteSubject())
			.find((action) => action.id === 'scene-object-delete');
		expect(deleteAction?.destructive).toBe(true);
		await expect(deleteAction!.run()).resolves.toMatchObject({ kind: 'accepted' });
		await eventually(() => facade.snapshot().domain.scene.entities.length === 1);
	});

	it('installs the same Scene source from a dragged Move and typed Position fields', async () => {
		const dragged = await acceptedMarksSurface();
		dragged.facade.setDrafting({ snap: false });
		const draggedMove = markOf(dragged.facade, 'scene-object-move');
		const draggedTarget = stageCssOf(dragged.facade, [2.6, 0, 2.4]);
		const draggedEvaluation = dragged.facade.evaluationId()!;
		expect(
			dragged.facade.pointerIntent({
				phase: 'down',
				css: draggedMove.anchor,
				evaluationId: draggedEvaluation,
				handleId: draggedMove.id
			}).claimed
		).toBe(true);
		dragged.facade.pointerIntent({ phase: 'move', css: draggedTarget, evaluationId: draggedEvaluation });
		dragged.facade.pointerIntent({ phase: 'up', css: draggedTarget, evaluationId: draggedEvaluation });
		await eventually(
			() => Math.abs(stageScene(dragged.facade.snapshot()).entities[0]!.position[0] - 2.6) < 1e-9
		);

		const typed = await acceptedMarksSurface();
		const typedController = sceneObjectCardController(
			createStageAdapterServices(typed.facade, typed.host),
			FIXTURE_ENTITY_ID
		)!;
		typedController.edit('position-x', '2.6');
		await expect(typedController.commit('position-x')).resolves.toMatchObject({ kind: 'accepted' });
		typedController.edit('position-z', '2.4');
		await expect(typedController.commit('position-z')).resolves.toMatchObject({ kind: 'accepted' });
		await eventually(
			() => Math.abs(stageScene(typed.facade.snapshot()).entities[0]!.position[2] - 2.4) < 1e-9
		);

		expect(JSON.stringify(stageScene(typed.facade.snapshot()))).toBe(
			JSON.stringify(stageScene(dragged.facade.snapshot()))
		);
	});

	it('commits one F4 entry for a mark release on a real acceptance host', async () => {
		const { facade, host } = await acceptedMarksSurface();
		facade.setDrafting({ snap: false });
		const before = host.history().depth;
		const move = markOf(facade, 'scene-object-move');
		const target = stageCssOf(facade, [2.6, 0, 2.4]);
		const evaluationId = facade.evaluationId()!;
		expect(facade.pointerIntent({ phase: 'down', css: move.anchor, evaluationId, handleId: move.id }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: target, evaluationId });
		facade.pointerIntent({ phase: 'up', css: target, evaluationId });
		await eventually(() => Math.abs(facade.snapshot().domain.scene.entities[0]!.position[0] - 2.6) < 1e-9);
		expect(host.history().depth).toBe(before + 1);
	});
});

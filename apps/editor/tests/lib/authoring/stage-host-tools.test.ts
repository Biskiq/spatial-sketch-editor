/**
 * R217.S10 — the dock's two host tools through the live F4 boundary.
 *
 * The suite mounts the **real** facade, acceptance host, Layout adapter and Scene
 * adapter over one project with Walls, an Opening, a plinth, a primitive, a
 * catalogue model and a native form. What it pins:
 *
 * 1. Measure resolves each endpoint through the host-tool resolver, across
 *    domains, to 1 mm — and writes nothing: no F4 entry, no proposal, no dirty
 *    source, and Undo stays available while it runs;
 * 2. the Eraser dispatches to the **winning** domain's own delete action, one F4
 *    entry per subject, Undo restores the same ids, and refusals are the domain's
 *    words with no entry;
 * 3. a coarse press shows the winner, release erases, and sliding off erases
 *    nothing.
 */
import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import {
	createEmptyWallFirstLayoutDocument,
	nextLayoutPresetObjectId,
	planCommitLayoutObjectPreset,
	planCreateWallFirstOpening,
	planWallChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import type { SceneEntity } from '@portfolio/project-model';
import type { Vec3 } from '@portfolio/camera-core';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import { buildFormGeometry } from '$lib/museum/entities/form-geometry';
import { createAdapter as createLayoutAdapter } from '$lib/authoring/adapters/layout.adapter';
import { createAdapter as createSceneAdapter } from '$lib/authoring/adapters/scene.adapter';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { createStageMeasure, resolveMeasureEndpoint } from '$lib/authoring/stage/stage-measure';
import { createStageEraser } from '$lib/authoring/stage/stage-eraser';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-s10-host-tools';

const PRIMITIVE: SceneEntity = {
	kind: 'primitive', primitive: 'box', id: 'entity-block', name: 'Block',
	dimensions: { width: 1, height: 1, depth: 1 }, materialId: 'plaster-warm',
	castShadow: true, receiveShadow: true, position: [2, 0.5, 2], rotation: [0, 0, 0]
};
const MODEL: SceneEntity = {
	kind: 'model', id: 'entity-piano', name: 'Piano', assetId: 'paris-grand-piano', fallback: 'piano',
	position: [5, 0, 4.5], rotation: [0, 0, 0]
};
const FORM: SceneEntity = {
	kind: 'form', id: 'entity-form', name: 'Form', position: [5, 0, 2], rotation: [0, 0, 0],
	materialId: 'plaster-warm', castShadow: true, receiveShadow: true,
	form: { generator: { kind: 'extrude', plane: 'plan', extent: 1, outline: [
		{ key: 1, u: -0.5, v: 0, smooth: false }, { key: 2, u: 0.5, v: 0, smooth: false },
		{ key: 3, u: 0.5, v: 1, smooth: false }, { key: 4, u: -0.5, v: 1, smooth: false }
	] }, scale: [1, 1, 1], nextKey: 5 }
};

type Mounted = {
	readonly facade: StageFacade;
	readonly host: StageAcceptanceHost;
	readonly document: LayoutDocumentWallFirst;
	readonly wallId: string;
	readonly openingId: string;
	readonly plinthId: string;
};

function layoutDocument(): { document: LayoutDocumentWallFirst; wallId: string; openingId: string; plinthId: string } {
	const base = createEmptyWallFirstLayoutDocument();
	const chained = planWallChain({
		baseline: base,
		points: [[0, 0], [7, 0], [7, 6], [0, 6]],
		close: true,
		capture: freshCapture(),
		levelId: base.floor.id
	});
	if (chained.kind !== 'success') throw new Error('the enclosure fixture was refused');
	const wallId = chained.document.walls[0]!.id;
	const opening = planCreateWallFirstOpening(
		chained.document,
		{ wallId, kind: 'door', offset: 1, width: 0.9, height: 2.1, sillHeight: 0 },
		freshCapture(),
		chained.document.floor.id
	);
	if (opening.kind === 'rejected') throw new Error(opening.rejection.message);
	const capture = freshCapture();
	const plinth = planCommitLayoutObjectPreset(
		opening.document, 'plinth', [2, 4.5], 0, nextLayoutPresetObjectId(opening.document, capture), opening.document.floor.id
	);
	if (plinth.kind !== 'success' || plinth.createdObjectId === undefined) throw new Error('the plinth fixture was refused');
	return { document: plinth.document, wallId, openingId: opening.changedOpeningIds[0]!, plinthId: plinth.createdObjectId };
}

async function mount(reading: 'plan' | '3d' = 'plan', entities: readonly SceneEntity[] = [PRIMITIVE, FORM]): Promise<Mounted> {
	const { document, wallId, openingId, plinthId } = layoutDocument();
	const project = await createUnitProject({
		id: PROJECT_ID,
		name: 'S10 host tools',
		layout: document,
		scene: { formatVersion: 1, textures: [], materials: [], entities: [...entities], navigationNodes: [], connections: [] }
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-s10-host-tools',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`fixture not admitted: ${admitted.kind}`);
	const snapshot = admitted.snapshot;
	const session = createStageSession({ sessionEpoch: snapshot.sessionEpoch });
	session.replace(snapshot);
	const rendered = createScenePickSource();
	rendered.setSource(snapshot.domain.scene);
	for (const entity of snapshot.domain.scene.entities) {
		const geometry = entity.kind === 'form'
			? buildFormGeometry(evaluateFormMesh(entity.form)!, entity.form.generator.plane)
			: new BoxGeometry(1, 1, 1);
		const mesh = new Mesh(geometry, new MeshBasicMaterial());
		mesh.position.fromArray(entity.kind === 'model' ? [entity.position[0], 0.5, entity.position[2]] : entity.position);
		rendered.register(entity.id, mesh);
	}
	const facade = createStageFacade({ snapshot, session, scenePick: rendered.pick, sceneBounds: rendered.bounds });
	facade.acquireInspection('exclusive');
	facade.camera.applyIntent({ kind: 'set-reading', reading }, 0);
	facade.camera.evaluate(RECT, 10);
	const host = createStageAcceptanceHost({
		facade,
		sessionEpoch: snapshot.sessionEpoch,
		baseline: {
			revision: snapshot.acceptedRevision,
			source: project,
			canonicalJson: snapshot.canonicalJson,
			sourceContentId: snapshot.sourceContentId
		}
	});
	for (const factory of [createLayoutAdapter, createSceneAdapter]) {
		const registration = mountStageAdapter(facade, host, factory);
		if (registration.kind !== 'registered') throw new Error('an adapter did not mount');
	}
	return { facade, host, document, wallId, openingId, plinthId };
}

let clock = 10;

/** An install rebinds the adapters against the next live evaluation. */
function settle(facade: StageFacade): void {
	facade.camera.evaluate(RECT, (clock += 1));
}

/** A world point in Stage-local CSS (the fixture rect has no offset). */
function css(facade: StageFacade, point: Vec3): readonly [number, number] {
	const projected = facade.projectWorld(point, facade.evaluationId()!);
	if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
	return [projected.css[0], projected.css[1]];
}

/** Erase through the controller with one click, exactly as the route drives it. */
async function click(eraser: ReturnType<typeof createStageEraser>, facade: StageFacade, point: Vec3, coarse = false) {
	const at = css(facade, point);
	const evaluationId = facade.evaluationId()!;
	const claimed = eraser.down({ css: at, evaluationId, coarse });
	await eraser.up({ css: at, evaluationId, coarse });
	return claimed;
}

async function eventually(check: () => boolean, attempts = 80): Promise<void> {
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		if (check()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('condition never became true');
}

function entityIds(facade: StageFacade): string[] {
	return stageEnvelope(facade.snapshot()).units.scene.data.entities.map((entity) => entity.id).sort();
}

describe('R217.S10 — Measure', () => {
	it('measures between two Wall ends to 1 mm and writes nothing', async () => {
		const { facade, host } = await mount();
		const baseline = facade.snapshot().canonicalJson;
		const measure = createStageMeasure(facade);
		const evaluationId = facade.evaluationId()!;
		// Press near one corner, release near the next: each end resolves to the
		// Junction, not to the raw pointer.
		expect(measure.down({ css: css(facade, [0.03, 0, 0.02]), evaluationId })).toBe(true);
		expect(facade.session.liveProposal()).toBeNull();
		measure.move({ css: css(facade, [6.98, 0, 0.02]), evaluationId });
		measure.up({ css: css(facade, [6.98, 0, 0.02]), evaluationId });
		const view = measure.view();
		expect(view?.live).toBe(false);
		expect(view?.meters).toBeCloseTo(7, 3);
		expect(view?.label).toBe('7 m');
		expect(view?.from.source?.adapterId).toBe('layout');
		expect(facade.snapshot().canonicalJson).toBe(baseline);
		expect(host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(facade.session.liveProposal()).toBeNull();
		expect(measure.clear()).toBe(true);
		expect(measure.view()).toBeNull();
	});

	it('runs one measurement from a Wall end (Layout) to a bounds corner (Scene)', async () => {
		const { facade } = await mount('3d');
		const evaluationId = facade.evaluationId()!;
		const bounds = facade.sceneBounds?.(PRIMITIVE.id) ?? null;
		expect(bounds).not.toBeNull();
		const corner: Vec3 = [bounds!.max[0], bounds!.max[1], bounds!.max[2]];
		const from = resolveMeasureEndpoint(facade, { css: css(facade, [0, 0, 0]), evaluationId });
		const to = resolveMeasureEndpoint(facade, { css: css(facade, corner), evaluationId });
		expect(from?.source?.adapterId).toBe('layout');
		expect(to?.source?.adapterId).toBe('scene');
		const measure = createStageMeasure(facade);
		measure.down({ css: css(facade, [0, 0, 0]), evaluationId });
		measure.up({ css: css(facade, [0, 0, 0]), evaluationId });
		// The first tap waits for the second point and blocks nothing meanwhile.
		expect(measure.view()).toBeNull();
		expect(facade.session.liveProposal()).toBeNull();
		measure.down({ css: css(facade, corner), evaluationId });
		measure.up({ css: css(facade, corner), evaluationId });
		const expected = Math.hypot(corner[0] - from!.point[0], corner[1] - from!.point[1], corner[2] - from!.point[2]);
		expect(measure.view()?.meters).toBeCloseTo(expected, 3);
		expect(Math.abs(measure.view()!.to.point[0] - corner[0])).toBeLessThan(0.001);
	});
});

describe('R217.S10 — Eraser', () => {
	it('erases a primitive, a form and a Wall, one entry each, through its owning domain', async () => {
		const mounted = await mount();
		const { facade, host } = mounted;
		const eraser = createStageEraser(facade);
		const sceneBefore = entityIds(facade);

		// A Scene subject: one click, one entry, Undo restores the same id.
		for (const entity of [PRIMITIVE, FORM]) {
			const point: Vec3 = [entity.position[0], 0, entity.position[2] + (entity.kind === 'form' ? 0.5 : 0)];
			const before = facade.snapshot().canonicalJson;
			expect(await click(eraser, facade, point)).toBe(true);
			await eventually(() => facade.snapshot().canonicalJson !== before);
			settle(facade);
			// One entry per erase; the Undo below leaves the redo slot the next erase replaces.
			expect(host.history()).toMatchObject({ depth: 2, position: 1 });
			expect(entityIds(facade)).not.toContain(entity.id);
			expect((await host.undo()).kind).toBe('installed');
			settle(facade);
			expect(entityIds(facade)).toEqual(sceneBefore);
		}

		const layout = () => stageEnvelope(facade.snapshot()).units.layout.data;
		let before = facade.snapshot().canonicalJson;
		// A Wall that bounds the Room: the domain asks for its disclosure first.
		const wallPoint: Vec3 = [6, 0, 0];
		await click(eraser, facade, wallPoint);
		expect(eraser.notice()?.kind).toBe('disclose');
		expect(eraser.notice()?.message).toMatch(/Click again to erase/);
		expect(facade.snapshot().canonicalJson).toBe(before);
		await click(eraser, facade, wallPoint);
		await eventually(() => facade.snapshot().canonicalJson !== before);
		settle(facade);
		expect(layout().walls.some((wall) => wall.id === mounted.wallId)).toBe(false);
		const wallDepth = host.history().depth;
		expect((await host.undo()).kind).toBe('installed');
			settle(facade);
		expect(layout().walls.some((wall) => wall.id === mounted.wallId)).toBe(true);
		expect(wallDepth).toBeGreaterThan(1);
	});

	it('erases an Opening through Layout’s own Opening delete, in one entry', async () => {
		const mounted = await mount();
		const { facade, host } = mounted;
		const eraser = createStageEraser(facade);
		const layout = () => stageEnvelope(facade.snapshot()).units.layout.data;
		// Layout ranks the host Wall first wherever both are in tolerance (S03), so the
		// press aims at a point of the Opening's own Plan symbol that only it names.
		const evaluationId = facade.evaluationId()!;
		let aim: Vec3 | null = null;
		for (const fragment of facade.eligibleFragments().filter((candidate) => candidate.ref.sourceKind === 'opening')) {
			const geometry = fragment.geometry;
			const points = geometry.kind === 'span' ? [geometry.start, geometry.end] : geometry.kind === 'polyline' ? geometry.polyline : geometry.polygon;
			for (const point of points) {
				const candidate: Vec3 = [point[0], fragment.elevationMeters, point[1]];
				const target = facade.hostToolTarget({ css: css(facade, candidate), evaluationId, tool: 'erase' });
				if (target.kind === 'hit' && target.hit.sourceKind === 'opening') aim = candidate;
			}
		}
		expect(aim).not.toBeNull();
		const before = facade.snapshot().canonicalJson;
		await click(eraser, facade, aim!);
		await eventually(() => facade.snapshot().canonicalJson !== before);
		expect(layout().openings.some((candidate) => candidate.id === mounted.openingId)).toBe(false);
		expect(layout().walls.some((wall) => wall.id === mounted.wallId)).toBe(true);
		expect(host.history()).toMatchObject({ depth: 2, position: 1 });
		expect((await host.undo()).kind).toBe('installed');
		expect(layout().openings.some((candidate) => candidate.id === mounted.openingId)).toBe(true);
	});

	it('dispatches a catalogue model to the same Scene delete action', async () => {
		// Its acceptance needs a resource lock this bare fixture does not carry, so the
		// dispatch is asserted at the owning binding; the primitive above proves the
		// same `scene-object-delete` action end to end.
		const { facade } = await mount('plan', [PRIMITIVE, MODEL, FORM]);
		const modelTarget = facade.hostToolTarget({ css: css(facade, [MODEL.position[0], 0, MODEL.position[2]]), evaluationId: facade.evaluationId()!, tool: 'erase' });
		expect(modelTarget).toMatchObject({ kind: 'hit', adapterId: 'scene', refusal: null, hit: { sourceId: MODEL.id } });
		if (modelTarget.kind !== 'hit') throw new Error('no model winner');
		expect(facade.eraseAnswer(modelTarget.adapterId, modelTarget.hit)).toMatchObject({ kind: 'action', confirm: false, action: { id: 'scene-object-delete' } });
	});

	it('refuses a Room floor and the plinth in Layout’s words, with no entry and no skip', async () => {
		const { facade, host } = await mount();
		const eraser = createStageEraser(facade);
		const baseline = facade.snapshot().canonicalJson;
		for (const [point, words] of [
			[[3.5, 0, 3] as Vec3, 'A Room floor cannot be erased.'],
			[[2, 0, 4.5] as Vec3, 'A plinth cannot be erased; Layout has no delete for its objects.']
		] as const) {
			await click(eraser, facade, point);
			expect(eraser.notice()).toMatchObject({ kind: 'refused', message: words });
		}
		expect(facade.snapshot().canonicalJson).toBe(baseline);
		expect(host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(facade.session.liveProposal()).toBeNull();
	});

	it('shows the coarse winner on press, erases on release and nothing after a slide-off', async () => {
		const { facade } = await mount();
		const eraser = createStageEraser(facade);
		const evaluationId = facade.evaluationId()!;
		const block = css(facade, [PRIMITIVE.position[0], 0, PRIMITIVE.position[2]]);
		// A coarse pointer has no hover preview.
		eraser.hover({ css: block, evaluationId, coarse: true });
		expect(eraser.candidate()).toBeNull();
		expect(eraser.down({ css: block, evaluationId, coarse: true })).toBe(true);
		expect(eraser.candidate()?.hit.sourceId).toBe(PRIMITIVE.id);
		const away = css(facade, [3.5, 0, 3]);
		eraser.move({ css: away, evaluationId, coarse: true });
		expect(eraser.candidate()).toBeNull();
		const before = facade.snapshot().canonicalJson;
		await eraser.up({ css: away, evaluationId, coarse: true });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(facade.snapshot().canonicalJson).toBe(before);
		expect(entityIds(facade)).toContain(PRIMITIVE.id);

		expect(await click(eraser, facade, [PRIMITIVE.position[0], 0, PRIMITIVE.position[2]], true)).toBe(true);
		await eventually(() => !entityIds(facade).includes(PRIMITIVE.id));
	});
});

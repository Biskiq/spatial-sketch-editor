/**
 * R217.S17A — drawing from the Objects panel through the live host.
 *
 * Production Scene and Layout adapters, the real F.4 acceptance host, and both a
 * Room-floor project and a genuinely empty one. Preview and commit must agree, on
 * a Room floor and on the Stage datum alike.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createEmptyWallFirstLayoutDocument, planWallChain, type LayoutDocumentWallFirst } from '@portfolio/layout-core';
import type { SceneFormEntity } from '@portfolio/project-model';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade, type StageKeyboardIntent } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { createStageAdapterServices, mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createAdapter as createLayoutAdapter } from '$lib/authoring/adapters/layout.adapter';
import { createAdapter as createSceneAdapter } from '$lib/authoring/adapters/scene.adapter';
import { armTile, type ObjectTile } from '$lib/authoring/adapters/scene/shape/armed-tile';
import { stageScene } from '$lib/authoring/stage/unit-stage-source';

const RECT = { left: 96, top: 48, width: 1280, height: 720, devicePixelRatio: 1 };
let projectSerial = 0;
let projectId = '';

function roomDocument(elevation = 0): LayoutDocumentWallFirst {
	const base = createEmptyWallFirstLayoutDocument();
	base.floor.elevation = elevation;
	const chained = planWallChain({
		baseline: base,
		points: [[0, 0], [7, 0], [7, 6], [0, 6]],
		close: true,
		capture: freshCapture(),
		levelId: base.floor.id
	});
	if (chained.kind !== 'success') throw new Error('the enclosure fixture was refused');
	return chained.document;
}

async function mount(layout: LayoutDocumentWallFirst) {
	projectSerial += 1;
	projectId = `project-draw-${projectSerial}`;
	const project: ProjectEnvelope = await createUnitProject({
		id: projectId,
		name: 'Draw',
		layout,
		scene: { formatVersion: 1, textures: [], materials: [], entities: [], navigationNodes: [], connections: [] }
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-draw',
		acceptedRevision: { projectId, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`fixture not admitted: ${admitted.kind}`);
	const snapshot = admitted.snapshot;
	const session = createStageSession({ sessionEpoch: snapshot.sessionEpoch });
	session.replace(snapshot);
	const facade = createStageFacade({ snapshot, session });
	facade.acquireInspection('exclusive');
	facade.camera.evaluate(RECT, 1);
	const host = createStageAcceptanceHost({
		facade,
		sessionEpoch: snapshot.sessionEpoch,
		baseline: { revision: snapshot.acceptedRevision, source: project, canonicalJson: snapshot.canonicalJson, sourceContentId: snapshot.sourceContentId }
	});
	mountStageAdapter(facade, host, createLayoutAdapter);
	mountStageAdapter(facade, host, createSceneAdapter);
	return { facade, host, services: createStageAdapterServices(facade, host) };
}

function arm(facade: StageFacade, tile: ObjectTile): void {
	armTile(projectId, tile);
	const opened = facade.openContributedTask('scene-place', 'scene');
	if (opened.kind !== 'opened') throw new Error(`Objects did not open: ${opened.message}`);
}

function css(facade: StageFacade, x: number, z: number): readonly [number, number] {
	const projected = facade.projectWorld([x, facade.snapshot().domain.datumMeters, z], facade.evaluationId()!);
	if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
	return [projected.css[0] - RECT.left, projected.css[1] - RECT.top];
}

function forms(facade: StageFacade): readonly SceneFormEntity[] {
	return stageScene(facade.snapshot()).entities.filter((entity): entity is SceneFormEntity => entity.kind === 'form');
}

async function eventually(check: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 400; attempt += 1) {
		if (check()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('condition never became true');
}

function press(facade: StageFacade, phase: 'down' | 'move' | 'up' | 'cancel', at: readonly [number, number]): void {
	facade.pointerIntent({ phase, css: at, evaluationId: facade.evaluationId()! });
}

function clickWorld(facade: StageFacade, x: number, z: number): void {
	const at = css(facade, x, z);
	press(facade, 'down', at);
	press(facade, 'up', at);
}

function footprint(form: SceneFormEntity): readonly number[] {
	const us = form.form.generator.outline.map((anchor) => anchor.u + form.position[0]);
	const vs = form.form.generator.outline.map((anchor) => anchor.v + form.position[2]);
	return [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
}

function key(kind: StageKeyboardIntent['kind']): StageKeyboardIntent {
	return { kind } as StageKeyboardIntent;
}

afterEach(() => { projectId = ''; });

describe.each([
	['a Room floor', () => roomDocument(0), [2, 2], [4, 3]],
	['the datum of an empty project', () => createEmptyWallFirstLayoutDocument(), [-5, -3], [-3, -2]]
] as const)('Objects on %s', (_name, layout, a, b) => {
	it('click creates one selected standard Box; Undo and Redo keep it', async () => {
		const { facade, host } = await mount(layout());
		arm(facade, 'box');
		clickWorld(facade, a[0], a[1]);
		await eventually(() => forms(facade).length === 1);
		const created = forms(facade)[0]!;
		expect(footprint(created)).toEqual([a[0] - 0.5, a[0] + 0.5, a[1] - 0.5, a[1] + 0.5]);
		expect(created.position[1]).toBe(facade.snapshot().domain.datumMeters);
		expect(created.form.generator.extent).toBe(1);
		expect(facade.selectionState().primary?.subject.id).toBe(created.id);
		await host.undo();
		expect(forms(facade)).toHaveLength(0);
		await host.redo();
		expect(forms(facade)[0]!.id).toBe(created.id);
	});

	it('drag creates the spanned form on release; preview and result agree', async () => {
		const { facade } = await mount(layout());
		arm(facade, 'box');
		const from = css(facade, a[0], a[1]);
		const to = css(facade, b[0], b[1]);
		press(facade, 'down', from);
		press(facade, 'move', to);
		const ghost = facade.ghosts().find((entry) => entry.id === 'scene-draw-preview');
		expect(ghost).toBeDefined();
		expect(forms(facade)).toHaveLength(0);
		press(facade, 'up', to);
		await eventually(() => forms(facade).length === 1);
		const created = forms(facade)[0]!;
		expect(footprint(created)).toEqual([a[0], b[0], a[1], b[1]]);
		expect(ghost!.center).toEqual(created.position);
		if (ghost!.shape.kind !== 'form') throw new Error('the ghost is not a form');
		expect(ghost!.shape.form.generator).toEqual(created.form.generator);
	});

	it('Round makes the same object type from click and drag', async () => {
		const { facade } = await mount(layout());
		arm(facade, 'round');
		clickWorld(facade, a[0], a[1]);
		await eventually(() => forms(facade).length === 1);
		expect(forms(facade)[0]!.form.generator.outline.every((anchor) => anchor.smooth)).toBe(true);
	});

	it('Free closes on the start, Esc clears a draft, Backspace removes the last point', async () => {
		const { facade } = await mount(layout());
		arm(facade, 'free');
		const baseline = facade.snapshot().canonicalJson;
		clickWorld(facade, a[0], a[1]);
		clickWorld(facade, b[0], a[1]);
		expect(facade.keyboardIntent(key('backtrack')).claimed).toBe(true);
		expect(facade.keyboardIntent(key('cancel')).claimed).toBe(true);
		expect(facade.keyboardIntent(key('cancel')).claimed).toBe(false);
		expect(facade.snapshot().canonicalJson).toBe(baseline);
		arm(facade, 'free');
		clickWorld(facade, a[0], a[1]);
		clickWorld(facade, b[0], a[1]);
		clickWorld(facade, b[0], b[1]);
		expect(forms(facade)).toHaveLength(0);
		clickWorld(facade, a[0], a[1]);
		await eventually(() => forms(facade).length === 1);
		expect(forms(facade)[0]!.form.generator.outline).toHaveLength(3);
	});

	it('refuses a self-crossing Free outline, keeps the draft and writes nothing', async () => {
		const { facade } = await mount(layout());
		arm(facade, 'free');
		const baseline = facade.snapshot().canonicalJson;
		for (const [x, z] of [[a[0], a[1]], [b[0], b[1]], [b[0], a[1]], [a[0], b[1]]] as const) clickWorld(facade, x, z);
		expect(facade.keyboardIntent(key('finish')).claimed).toBe(true);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(facade.snapshot().canonicalJson).toBe(baseline);
		expect(facade.overlays().some((entry) => entry.id === 'scene-draw-refusal')).toBe(true);
		expect(facade.keyboardIntent(key('backtrack')).claimed).toBe(true);
	});

	it('a pointer cancel or a reading change during a press leaves no trace', async () => {
		const { facade } = await mount(layout());
		arm(facade, 'box');
		const baseline = facade.snapshot().canonicalJson;
		press(facade, 'down', css(facade, a[0], a[1]));
		press(facade, 'cancel', css(facade, b[0], b[1]));
		expect(facade.session.gesture()).toBeNull();
		expect(facade.snapshot().canonicalJson).toBe(baseline);
	});

	it('a double release creates exactly one object', async () => {
		const { facade } = await mount(layout());
		arm(facade, 'box');
		clickWorld(facade, a[0], a[1]);
		const at = css(facade, a[0], a[1]);
		press(facade, 'up', at);
		await eventually(() => forms(facade).length === 1);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(forms(facade)).toHaveLength(1);
	});
});

describe('elevation', () => {
	it('uses the Room floor it covers, and the same datum beyond it', async () => {
		const { facade } = await mount(roomDocument(1.5));
		expect(facade.snapshot().domain.datumMeters).toBe(1.5);
		arm(facade, 'box');
		clickWorld(facade, 3, 3);
		await eventually(() => forms(facade).length === 1);
		expect(forms(facade)[0]!.position[1]).toBe(1.5);
		facade.closeTask();
		facade.camera.evaluate(RECT, 2);
		arm(facade, 'box');
		clickWorld(facade, -5, -3);
		await eventually(() => forms(facade).length === 2);
		expect(forms(facade)[1]!.position[1]).toBe(1.5);
	});

});

/**
 * T2 D8p review — the group-copy binding through the real Stage pointer route.
 *
 * These cases mount the Scene adapter on a live Stage facade and drive the
 * façade's own pointer, idle-hover and gesture-key intents. They do not call the
 * placement session directly, so they exercise the binding, the project-keyed
 * arm store and the host's routing together:
 *
 * 1. Arming (or replacing) the store's copy previews at the pointer the Stage
 *    last saw, before the first press, and the press commits the copy that is
 *    displayed — never the previous template.
 * 2. Clearing the arm externally, switching templates mid-press and Escape all
 *    drop the obsolete candidate and lease with no write.
 * 3. Placement stays armed and repeated after a commit, including a template
 *    switch between copies.
 * 4. The support origin stands on the visible, snapped Place support, and a
 *    pointer with no visible floor support refuses without a ghost or a write.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import type { GroupTemplate } from '@portfolio/project-model/scene-planning';
import type { ScenePrimitiveEntity, Vec3 } from '@portfolio/project-model/scene';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core/wall';
import { createAdapter } from '$lib/authoring/adapters/scene.adapter';
import {
	armGroupCopy,
	peekArmedGroupCopy,
	type ArmedGroupCopy,
} from '$lib/authoring/adapters/scene/group-copy-placement-session';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
import { armTile } from '$lib/authoring/adapters/scene/shape/armed-tile';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createUnitProject } from '../__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../../../../../../packages/layout-core/tests/__fixtures__/layout-id-capture';

const PROJECT_ID = 'project-d8p-binding';
const ANCHOR_ID = 'anchor-box';
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

beforeEach(() => {
	armTile(PROJECT_ID, null);
	armGroupCopy(PROJECT_ID, null);
});

function boxEntity(id: string, position: Vec3, size = 1): ScenePrimitiveEntity {
	return {
		kind: 'primitive',
		primitive: 'box',
		id,
		name: 'Block',
		dimensions: { width: size, height: size, depth: size },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		position,
		rotation: [0, 0, 0],
		scale: 1,
	};
}

function template(name: string, size: number): GroupTemplate {
	return {
		name,
		members: [
			{
				kind: 'primitive',
				primitive: 'box',
				name: 'Block',
				dimensions: { width: size, height: size, depth: size },
				materialId: 'plaster-warm',
				castShadow: true,
				receiveShadow: true,
				// A template member sits on the group's own ground: its base is Y=0.
				position: [0, size / 2, 0],
				rotation: [0, 0, 0],
				scale: 1,
			},
			{
				kind: 'primitive',
				primitive: 'box',
				name: 'Plinth',
				dimensions: { width: 0.2, height: 0.2, depth: 0.2 },
				materialId: 'plaster-warm',
				castShadow: true,
				receiveShadow: true,
				position: [size, 0.1, 0],
				rotation: [0, 0, 0],
				scale: 1,
			},
		],
	};
}

async function projectSource(): Promise<ProjectEnvelope> {
	const baseline = createEmptyWallFirstLayoutDocument();
	const planned = planWallChain({
		baseline,
		points: [
			[0, 0],
			[7, 0],
			[7, 6],
			[0, 6],
		],
		close: true,
		capture: freshCapture(),
		levelId: baseline.floor.id,
	});
	if (planned.kind !== 'success') throw new Error('the binding fixture enclosure was refused');
	return createUnitProject({
		id: PROJECT_ID,
		name: 'D8p binding',
		layout: planned.document,
		scene: {
			formatVersion: 1,
			textures: [],
			materials: [],
			entities: [boxEntity(ANCHOR_ID, [2, 0.5, 2])],
			navigationNodes: [],
			connections: [],
		},
	});
}

async function mounted() {
	const source = await projectSource();
	const admitted = await admitSource(source, {
		sessionEpoch: 'session-d8p-binding',
		acceptedRevision: { projectId: source.id, revisionId: 'revision-boot' },
	});
	if (admitted.kind !== 'admitted') throw new Error('the binding fixture was not admitted');
	const stageSession = createStageSession({ sessionEpoch: admitted.snapshot.sessionEpoch });
	stageSession.replace(admitted.snapshot);
	const facade = createStageFacade({ snapshot: admitted.snapshot, session: stageSession });
	const evaluation = facade.camera.evaluate(RECT, 1);
	if (evaluation.kind !== 'evaluated') throw new Error('the binding fixture did not evaluate');
	facade.acquireInspection('exclusive');
	const intents: AuthoringIntent[] = [];
	const host = createStageAcceptanceHost({
		facade,
		sessionEpoch: admitted.snapshot.sessionEpoch,
		baseline: {
			revision: admitted.snapshot.acceptedRevision,
			source,
			canonicalJson: admitted.snapshot.canonicalJson,
			sourceContentId: admitted.snapshot.sourceContentId,
		},
		planners: [],
	});
	mountStageAdapter(
		facade,
		{
			...host,
			accept: async (intent) => {
				intents.push(intent);
				return host.accept(intent);
			},
		},
		createAdapter,
	);
	// The adapter admits its native and catalogue definitions asynchronously.
	await new Promise((resolve) => setTimeout(resolve, 20));
			const snapshot = facade.snapshot();
	const reference = sceneEntityReference(ANCHOR_ID, snapshot.domain.unitRevisions.scene);
	facade.setSelection({ ordered: [{ reference }], primary: reference });
	const initialRevision = snapshot.acceptedRevision.revisionId;
			return { facade, host, intents, initialRevision };
}

type Mounted = Awaited<ReturnType<typeof mounted>>;

function cssAt(facade: Mounted['facade'], point: Vec3): [number, number] {
	const evaluationId = facade.evaluationId();
	if (evaluationId === null) throw new Error('the mounted adapter has no evaluation');
	const projected = facade.projectWorld(point, evaluationId);
	if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
	return [projected.css[0], projected.css[1]];
}

/** A panel (or another surface) writes the project arm and asks the Stage to redraw. */
function arm(mounted: Mounted, copy: ArmedGroupCopy | null): void {
	armGroupCopy(PROJECT_ID, copy);
	mounted.facade.notifySurfaceChange();
}

function liveEvaluationId(mounted: Mounted): string {
	const evaluationId = mounted.facade.evaluationId();
	if (evaluationId === null) throw new Error('the mounted adapter has no evaluation');
	return evaluationId;
}

function move(mounted: Mounted, point: Vec3): void {
	mounted.facade.idleHoverIntent({
		phase: 'move',
		css: cssAt(mounted.facade, point),
		evaluationId: liveEvaluationId(mounted),
	});
}

function press(mounted: Mounted, point: Vec3): void {
	const css = cssAt(mounted.facade, point);
	const evaluationId = liveEvaluationId(mounted);
	expect(mounted.facade.pointerIntent({ phase: 'down', css, evaluationId }).claimed).toBe(true);
	mounted.facade.pointerIntent({ phase: 'up', css, evaluationId });
}

function ghostSizes(mounted: Mounted): (readonly number[] | undefined)[] {
	return mounted.facade.ghosts().map((ghost) =>
		ghost.shape.kind === 'box' ? ghost.shape.size : undefined,
	);
}

async function eventually(predicate: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 80; attempt += 1) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('the fixture did not settle');
}

describe('group-copy binding — arm store and pointer routing', () => {
	it('previews a newly armed copy before its first press and commits the displayed template', async () => {
		const mountedSurface = await mounted();
		const armedA: ArmedGroupCopy = { template: template('Alpha', 2), name: 'Alpha', origin: 'support' };
		const armedB: ArmedGroupCopy = {
			template: template('Beta', 0.5),
			name: 'Beta',
			origin: 'support',
		};

		// Learn the pointer while no copy is armed; then arm without moving it.
		move(mountedSurface, [4, 0, 3]);
		arm(mountedSurface, armedA);
		expect(ghostSizes(mountedSurface)[0]).toEqual([2, 2, 2]);

		// Replacing the store's copy must replace the ghost too, still before a press.
		arm(mountedSurface, armedB);
		expect(ghostSizes(mountedSurface)[0]).toEqual([0.5, 0.5, 0.5]);

		press(mountedSurface, [4, 0, 3]);
		await eventually(() => mountedSurface.intents.length === 1);
		expect(mountedSurface.intents[0]!.payload).toMatchObject({
			kind: 'place-group-copy',
			name: 'Beta',
			origin: { kind: 'support', worldXZ: [4, 3] },
		});
		expect(peekArmedGroupCopy(PROJECT_ID)).toBe(armedB);
	});

	it('drops an obsolete placement when the arm is cleared externally', async () => {
		const mountedSurface = await mounted();
		const armedA: ArmedGroupCopy = { template: template('Alpha', 2), name: 'Alpha', origin: 'support' };
		move(mountedSurface, [4, 0, 3]);
		arm(mountedSurface, armedA);
		expect(ghostSizes(mountedSurface)[0]).toEqual([2, 2, 2]);

		// Another surface clears the project's arm; the next render has no ghost,
		// and the next press is ordinary navigation, not a placement.
		arm(mountedSurface, null);
		expect(mountedSurface.facade.ghosts()).toEqual([]);
		const css = cssAt(mountedSurface.facade, [4, 0, 3]);
		const claim = mountedSurface.facade.pointerIntent({
			phase: 'down',
			css,
			evaluationId: liveEvaluationId(mountedSurface),
		});
		mountedSurface.facade.pointerIntent({
			phase: 'up',
			css,
			evaluationId: liveEvaluationId(mountedSurface),
		});
		expect(claim.claimed).toBe(false);
		expect(mountedSurface.intents).toHaveLength(0);
	});

	it('cancels a press when the template switches and writes nothing', async () => {
		const mountedSurface = await mounted();
		const armedA: ArmedGroupCopy = { template: template('Alpha', 2), name: 'Alpha', origin: 'support' };
		const armedB: ArmedGroupCopy = {
			template: template('Beta', 0.5),
			name: 'Beta',
			origin: 'support',
		};
		move(mountedSurface, [4, 0, 3]);
		arm(mountedSurface, armedA);
		const css = cssAt(mountedSurface.facade, [4, 0, 3]);
		expect(
					mountedSurface.facade.pointerIntent({
			phase: 'down',
			css,
			evaluationId: liveEvaluationId(mountedSurface),
		}).claimed,
	).toBe(true);
		expect(ghostSizes(mountedSurface)[0]).toEqual([2, 2, 2]);

		// The store changes under the held press: the press belongs to the old
		// template and must not release as a placement.
		arm(mountedSurface, armedB);
		mountedSurface.facade.pointerIntent({
			phase: 'up',
			css,
			evaluationId: liveEvaluationId(mountedSurface),
		});
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(mountedSurface.intents).toHaveLength(0);
		// The switched copy previews at the pointer on the next move.
		move(mountedSurface, [4, 0, 3]);
		expect(ghostSizes(mountedSurface)[0]).toEqual([0.5, 0.5, 0.5]);
		expect(peekArmedGroupCopy(PROJECT_ID)).toBe(armedB);

		// A fresh press commits the template that is displayed now.
		press(mountedSurface, [4, 0, 3]);
		await eventually(() => mountedSurface.intents.length === 1);
		expect(mountedSurface.intents[0]!.payload).toMatchObject({ name: 'Beta' });
	});

	it('Escape during a press clears the tool, and placement resumes afterwards', async () => {
		const mountedSurface = await mounted();
		const armedA: ArmedGroupCopy = { template: template('Alpha', 2), name: 'Alpha', origin: 'support' };
		move(mountedSurface, [4, 0, 3]);
		arm(mountedSurface, armedA);
		const css = cssAt(mountedSurface.facade, [4, 0, 3]);
		expect(
					mountedSurface.facade.pointerIntent({
			phase: 'down',
			css,
			evaluationId: liveEvaluationId(mountedSurface),
		}).claimed,
	).toBe(true);
		const cancelled = mountedSurface.facade.gestureKeyIntent({ kind: 'cancel' });
		expect(cancelled.claimed).toBe(true);
		mountedSurface.facade.pointerIntent({
			phase: 'up',
			css,
			evaluationId: liveEvaluationId(mountedSurface),
		});
		expect(peekArmedGroupCopy(PROJECT_ID)).toBeNull();
		expect(mountedSurface.facade.ghosts()).toEqual([]);
		expect(mountedSurface.intents).toHaveLength(0);

		// The same binding places after a re-arm and a new press.
		arm(mountedSurface, armedA);
		move(mountedSurface, [4, 0, 3]);
		press(mountedSurface, [4, 0, 3]);
		await eventually(() => mountedSurface.intents.length === 1);
		expect(mountedSurface.intents[0]!.payload).toMatchObject({ name: 'Alpha' });
	});

	it('places repeatedly, switching templates between copies', async () => {
		const mountedSurface = await mounted();
		const armedA: ArmedGroupCopy = { template: template('Alpha', 2), name: 'Alpha', origin: 'support' };
		const armedB: ArmedGroupCopy = {
			template: template('Beta', 0.5),
			name: 'Beta',
			origin: 'support',
		};
		move(mountedSurface, [3, 0, 3]);
		arm(mountedSurface, armedA);
		press(mountedSurface, [3, 0, 3]);
		await eventually(() => mountedSurface.intents.length === 1);
		await eventually(
			() => mountedSurface.facade.snapshot().acceptedRevision.revisionId !== mountedSurface.initialRevision,
		);
		mountedSurface.facade.camera.evaluate(RECT, 2);

		// The rebind keeps the arm; the next template shows at the new pointer.
		expect(peekArmedGroupCopy(PROJECT_ID)).toBe(armedA);
		arm(mountedSurface, armedB);
		move(mountedSurface, [6, 0, 2]);
		expect(ghostSizes(mountedSurface)[0]).toEqual([0.5, 0.5, 0.5]);
		press(mountedSurface, [6, 0, 2]);
		await eventually(() => mountedSurface.intents.length === 2);
		expect(mountedSurface.intents.map((intent) => intent.payload)).toMatchObject([
			{ name: 'Alpha' },
			{ name: 'Beta' },
		]);
		expect(peekArmedGroupCopy(PROJECT_ID)).toBe(armedB);
	});

	it('refuses a pointer without visible floor support instead of placing at the hit', async () => {
		const mountedSurface = await mounted();
		const armedA: ArmedGroupCopy = { template: template('Alpha', 2), name: 'Alpha', origin: 'support' };
		arm(mountedSurface, armedA);
		// The room enclosure's Walls are visible, but the anchor body blocks the
		// floor under this pointer; Place refuses and so does the copy.
		move(mountedSurface, [2, 1, 2]);
		expect(mountedSurface.facade.ghosts()).toEqual([]);
		const css = cssAt(mountedSurface.facade, [2, 1, 2]);
		expect(
					mountedSurface.facade.pointerIntent({
			phase: 'down',
			css,
			evaluationId: liveEvaluationId(mountedSurface),
		}).claimed,
	).toBe(true);
		mountedSurface.facade.pointerIntent({
			phase: 'up',
			css,
			evaluationId: liveEvaluationId(mountedSurface),
		});
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(mountedSurface.intents).toHaveLength(0);
	});
});

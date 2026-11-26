/**
 * X7 — Scene adapter gesture and placement lifetimes, through the real adapter.
 *
 * These cases mount the production Scene adapter on the public Stage host with a
 * real acceptance host. They characterize the parts of `scene.adapter` that X7
 * decomposes (placement binding, object-mark session, presentation) from the
 * outside only: every assertion is a Stage-visible fact — claimed pointers,
 * history depth, the one gesture lease, canonical selection, ghosts, overlays.
 * They were recorded against the monolithic adapter before any code moved and
 * must stay green, unmodified, after the extraction.
 *
 * Shared invariants asserted per terminal path:
 *  - exactly one accepted history operation per successful gesture, zero on cancel;
 *  - the gesture lease is released on every termination;
 *  - the canonical selection keeps its identity unless the gesture is a creation.
 */
import { describe, expect, it } from 'vitest';
import { createEmptyWallFirstLayoutDocument, planWallChain, type LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import { planCreateRegion } from '@portfolio/layout-core/room';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import type { SceneEntity, Vec3 } from '@portfolio/project-model/scene';
import {
	creatorModelDefinition,
	creatorModelResourceEntry,
	sceneSupportGenerationId
} from '@portfolio/project-model/scene-planning';
import { canonicalFormLibraryPayload } from '@portfolio/project-model/library';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { createAdapter } from '$lib/authoring/adapters/scene.adapter';
import { armTile } from '$lib/authoring/adapters/scene/shape/armed-tile';
import { rememberCreatorDefinition } from '$lib/authoring/adapters/scene/import/definitions';
import {
	sceneEntityReference,
	sceneSurfaceFor,
	type ArmedFormCopy,
	type ArmedModelPlacement
} from '$lib/authoring/adapters/scene/placement';
import { SCENE_FORM_MARK } from '$lib/authoring/adapters/scene/shape/form-size';
import { createStageAdapterServices, mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { stageEnvelope, stageScene } from '$lib/authoring/stage/unit-stage-source';
import { sceneObjectCommands } from '../__fixtures__/scene-object-commands';
import { createUnitProject } from '../__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../../../../../../packages/layout-core/tests/__fixtures__/layout-id-capture';

const PROJECT_ID = 'project-scene-lifecycle';
const BOX_ID = 'entity-lifecycle-box';
const FORM_ID = 'entity-lifecycle-form';
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

function box(id = BOX_ID, position: Vec3 = [2, 0.5, 2]): SceneEntity {
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
			scale: [1, 1, 1],
			nextKey: 5
		}
	};
}

function enclosedLayout(): LayoutDocumentWallFirst {
	const baseline = createEmptyWallFirstLayoutDocument();
	const planned = planWallChain({
		baseline,
		points: [[0, 0], [7, 0], [7, 6], [0, 6]],
		close: true,
		capture: freshCapture(),
		levelId: baseline.floor.id
	});
	if (planned.kind !== 'success') throw new Error('the wall fixture was refused');
	return planned.document;
}

function terraceLayout(): LayoutDocumentWallFirst {
	const planned = planCreateRegion({
		baseline: enclosedLayout(),
		capture: freshCapture(),
		intent: {
			role: 'floor',
			footprint: [
				[2, 1],
				[5, 1],
				[5, 4],
				[2, 4]
			],
			elevation: 0.6,
			thickness: 0.2
		}
	});
	if (planned.kind !== 'success') throw new Error('the terrace fixture was refused');
	return planned.document;
}

async function project(
	entities: readonly SceneEntity[],
	layout: LayoutDocumentWallFirst = enclosedLayout()
): Promise<ProjectEnvelope> {
	return createUnitProject({
		id: PROJECT_ID,
		name: 'Scene lifecycle',
		layout,
		scene: {
			formatVersion: 1,
			textures: [],
			materials: [],
			entities: [...entities],
			navigationNodes: [],
			connections: []
		}
	});
}

type MountOptions = {
	readonly layout?: LayoutDocumentWallFirst;
	readonly recordAccept?: (intent: AuthoringIntent) => void;
};

async function mounted(entities: readonly SceneEntity[] = [box()], options: MountOptions = {}) {
	armTile(PROJECT_ID, null);
	const source = await project(entities, options.layout);
	const admitted = await admitSource(source, {
		sessionEpoch: 'session-scene-lifecycle',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error('the lifecycle fixture was not admitted');
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
		},
		planners: []
	});
	const baseServices = createStageAdapterServices(facade, host);
	const services = options.recordAccept === undefined
		? baseServices
		: {
				...baseServices,
				authoring: {
					...baseServices.authoring,
					accept: async (intent: AuthoringIntent) => {
						options.recordAccept!(intent);
						return host.accept(intent);
					}
				}
			};
	const registration = mountStageAdapter(facade, host, createAdapter, undefined, services);
	if (registration.kind !== 'registered') throw new Error('the Scene adapter did not mount');
	// The placement planner is registered once its metadata identity exists.
	await new Promise((resolve) => setTimeout(resolve, 0));
	return { facade, host, registration, services };
}

type Mounted = Awaited<ReturnType<typeof mounted>>;

function select(facade: StageFacade, entityId: string): void {
	const reference = sceneEntityReference(entityId, facade.snapshot().domain.unitRevisions.scene);
	facade.setSelection({ ordered: [{ reference }], primary: reference });
}

function selectedId(facade: StageFacade): string | null {
	const primary = facade.selectionState().primary;
	return primary !== null && primary.subject.kind === 'entity' ? primary.subject.id : null;
}

function cssOf(facade: StageFacade, point: Vec3): [number, number] {
	const evaluationId = facade.evaluationId()!;
	const projected = facade.projectWorld(point, evaluationId);
	if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
	const rect = facade.evaluation()!.rect;
	return [projected.css[0] - rect.left, projected.css[1] - rect.top];
}

function markOf(facade: StageFacade, id: string) {
	const mark = facade.marks().find((candidate) => candidate.id === id);
	if (mark === undefined) throw new Error(`the fixture has no mark "${id}"`);
	return mark;
}

async function eventually(predicate: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('the fixture did not settle');
}

async function settle(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 20));
}

function leaseHeld(facade: StageFacade): boolean {
	return facade.session.gesture() !== null;
}

function entityOf(facade: StageFacade, id: string): SceneEntity | undefined {
	return stageScene(facade.snapshot()).entities.find((entry) => entry.id === id);
}

/** Press the named mark on the selected object and drag it to `to`. */
function dragMark(
	{ facade }: Mounted,
	markId: string,
	to: (anchor: readonly [number, number]) => [number, number]
): { readonly evaluationId: string; readonly target: [number, number] } {
	const evaluationId = facade.evaluationId()!;
	const mark = markOf(facade, markId);
	const claim = facade.pointerIntent({ phase: 'down', css: mark.anchor, evaluationId, handleId: mark.id });
	expect(claim).toEqual({ claimed: true, adapterId: 'scene' });
	const target = to(mark.anchor);
	facade.pointerIntent({ phase: 'move', css: target, evaluationId });
	return { evaluationId, target };
}

const MOVE_TO = () => (anchor: readonly [number, number]): [number, number] => [anchor[0] + 40, anchor[1] + 20];

describe('X7 object-mark gesture lifetimes', () => {
	it.each([
		{ name: 'Move', mark: 'scene-object-move', to: MOVE_TO() },
		{ name: 'Turn', mark: 'scene-object-turn', to: (a: readonly [number, number]): [number, number] => [a[0] + 60, a[1]] },
		{ name: 'Size chip', mark: 'scene-object-scale-point', to: (a: readonly [number, number]): [number, number] => [a[0] + 60, a[1] - 30] }
	])('commits exactly one history entry for a $name release and frees the lease', async ({ mark, to }) => {
		const fixture = await mounted();
		select(fixture.facade, BOX_ID);
		const before = fixture.host.history().depth;
		const baseline = entityOf(fixture.facade, BOX_ID)!;
		const { evaluationId, target } = dragMark(fixture, mark, to);
		expect(leaseHeld(fixture.facade)).toBe(true);
		expect(fixture.facade.session.gesture()?.owner).toBe('scene-object-marks');
		expect(fixture.facade.ghosts().length).toBe(1);
		// A second press while the lease is held is not a second gesture.
		fixture.facade.pointerIntent({ phase: 'up', css: target, evaluationId });
		expect(leaseHeld(fixture.facade)).toBe(false);
		await eventually(() => fixture.host.history().depth === before + 1);
		await settle();
		expect(fixture.host.history().depth).toBe(before + 1);
		expect(JSON.stringify(entityOf(fixture.facade, BOX_ID))).not.toBe(JSON.stringify(baseline));
		expect(selectedId(fixture.facade)).toBe(BOX_ID);
		expect(fixture.facade.ghosts()).toEqual([]);
	});

	it('writes nothing for a pointer cancel and keeps the selection', async () => {
		const fixture = await mounted();
		select(fixture.facade, BOX_ID);
		const before = fixture.host.history();
		const canonical = fixture.facade.snapshot().canonicalJson;
		const { evaluationId, target } = dragMark(fixture, 'scene-object-move', MOVE_TO());
		expect(fixture.facade.ghosts().length).toBe(1);
		fixture.facade.pointerIntent({ phase: 'cancel', css: target, evaluationId });
		await settle();
		expect(leaseHeld(fixture.facade)).toBe(false);
		expect(fixture.facade.ghosts()).toEqual([]);
		expect(fixture.host.history()).toEqual(before);
		expect(fixture.facade.snapshot().canonicalJson).toBe(canonical);
		expect(selectedId(fixture.facade)).toBe(BOX_ID);
	});

	it('ends a live mark gesture on Escape without writing', async () => {
		const fixture = await mounted();
		select(fixture.facade, BOX_ID);
		const before = fixture.host.history();
		dragMark(fixture, 'scene-object-move', MOVE_TO());
		expect(fixture.facade.gestureKeyIntent({ kind: 'finish' }).claimed).toBe(false);
		expect(fixture.facade.gestureKeyIntent({ kind: 'cancel' })).toEqual({ claimed: true, adapterId: 'scene' });
		expect(leaseHeld(fixture.facade)).toBe(false);
		expect(fixture.facade.ghosts()).toEqual([]);
		expect(fixture.host.history()).toEqual(before);
		expect(selectedId(fixture.facade)).toBe(BOX_ID);
	});

	it('releases the lease and drops the proposal when the selection changes mid-gesture', async () => {
		const fixture = await mounted([box(), box('entity-other', [5, 0.5, 4])]);
		select(fixture.facade, BOX_ID);
		const before = fixture.host.history();
		const { evaluationId, target } = dragMark(fixture, 'scene-object-move', MOVE_TO());
		select(fixture.facade, 'entity-other');
		expect(leaseHeld(fixture.facade)).toBe(false);
		expect(fixture.facade.ghosts()).toEqual([]);
		fixture.facade.pointerIntent({ phase: 'up', css: target, evaluationId });
		await settle();
		expect(fixture.host.history()).toEqual(before);
		expect(selectedId(fixture.facade)).toBe('entity-other');
	});

	it('releases the lease when the adapter registration is disposed mid-gesture', async () => {
		const fixture = await mounted();
		select(fixture.facade, BOX_ID);
		const before = fixture.host.history();
		dragMark(fixture, 'scene-object-move', MOVE_TO());
		expect(leaseHeld(fixture.facade)).toBe(true);
		fixture.registration.dispose();
		expect(leaseHeld(fixture.facade)).toBe(false);
		expect(fixture.host.history()).toEqual(before);
		expect(fixture.facade.ghosts()).toEqual([]);
	});

	it('installs nothing when a reading change ended the lease under the gesture', async () => {
		const fixture = await mounted();
		select(fixture.facade, BOX_ID);
		const before = fixture.host.history();
		const { evaluationId, target } = dragMark(fixture, 'scene-object-move', MOVE_TO());
		expect(fixture.facade.session.applyReadingChange()).toMatchObject({ cancelled: true });
		fixture.facade.pointerIntent({ phase: 'move', css: [target[0] + 5, target[1]], evaluationId });
		fixture.facade.pointerIntent({ phase: 'up', css: target, evaluationId });
		await settle();
		expect(leaseHeld(fixture.facade)).toBe(false);
		expect(fixture.host.history()).toEqual(before);
		expect(fixture.facade.ghosts()).toEqual([]);
		// The refused gesture left the object markable again.
		expect(fixture.facade.marks().some((mark) => mark.id === 'scene-object-move')).toBe(true);
	});

	it('refuses a second mark gesture while a held lease belongs to another owner', async () => {
		const fixture = await mounted();
		select(fixture.facade, BOX_ID);
		const evaluationId = fixture.facade.evaluationId()!;
		expect(
			fixture.facade.acquireGesture({ owner: 'someone-else', evaluationId, policy: 'cancel-on-reading-change' }).kind
		).toBe('granted');
		const move = markOf(fixture.facade, 'scene-object-move');
		expect(
			fixture.facade.pointerIntent({ phase: 'down', css: move.anchor, evaluationId, handleId: move.id }).claimed
		).toBe(false);
		expect(fixture.facade.session.gesture()?.owner).toBe('someone-else');
	});

	it('ends the gesture when another writer replaces the accepted source', async () => {
		const fixture = await mounted();
		select(fixture.facade, BOX_ID);
		const { evaluationId, target } = dragMark(fixture, 'scene-object-move', MOVE_TO());
		const commands = sceneObjectCommands(fixture.services, BOX_ID)!;
		const before = fixture.host.history().depth;
		const outcome = await commands.move(5, 4);
		expect(outcome.kind).toBe('installed');
		expect(fixture.host.history().depth).toBe(before + 1);
		fixture.facade.pointerIntent({ phase: 'up', css: target, evaluationId });
		await settle();
		// The captured gesture is not replayed over the newer accepted source: only
		// the other writer's single entry exists, and no lease is left behind.
		expect(fixture.host.history().depth).toBe(before + 1);
		expect(leaseHeld(fixture.facade)).toBe(false);
		expect(entityOf(fixture.facade, BOX_ID)?.position[0]).toBeCloseTo(5, 6);
		expect(selectedId(fixture.facade)).toBe(BOX_ID);
	});

	it('commits one set-form-size entry for a form ray drag and none on cancel', async () => {
		const fixture = await mounted([nativeForm()]);
		select(fixture.facade, FORM_ID);
		const before = fixture.host.history().depth;
		// The per-axis rays are disclosed by the Scale point.
		expect(fixture.facade.activateDisclosure('scene-object-scale-point')).toBe(true);
		const ray = fixture.facade.marks().find((mark) => mark.id === SCENE_FORM_MARK.width);
		expect(ray).toBeDefined();
		const evaluationId = fixture.facade.evaluationId()!;
		expect(
			fixture.facade.pointerIntent({ phase: 'down', css: ray!.anchor, evaluationId, handleId: ray!.id }).claimed
		).toBe(true);
		const target: [number, number] = [ray!.anchor[0] + 50, ray!.anchor[1] - 10];
		fixture.facade.pointerIntent({ phase: 'move', css: target, evaluationId });
		fixture.facade.pointerIntent({ phase: 'cancel', css: target, evaluationId });
		await settle();
		expect(leaseHeld(fixture.facade)).toBe(false);
		expect(fixture.host.history().depth).toBe(before);

		const again = fixture.facade.marks().find((mark) => mark.id === ray!.id)!;
		expect(
			fixture.facade.pointerIntent({ phase: 'down', css: again.anchor, evaluationId, handleId: again.id }).claimed
		).toBe(true);
		fixture.facade.pointerIntent({ phase: 'move', css: [again.anchor[0] + 50, again.anchor[1] - 10], evaluationId });
		fixture.facade.pointerIntent({ phase: 'up', css: [again.anchor[0] + 50, again.anchor[1] - 10], evaluationId });
		await eventually(() => fixture.host.history().depth === before + 1);
		await settle();
		expect(fixture.host.history().depth).toBe(before + 1);
		expect(leaseHeld(fixture.facade)).toBe(false);
		expect(selectedId(fixture.facade)).toBe(FORM_ID);
	});

	it('keeps object marks off while a contributed task owns the surface and restores them after', async () => {
		const fixture = await mounted();
		select(fixture.facade, BOX_ID);
		expect(fixture.facade.marks().length).toBeGreaterThan(0);
		expect(fixture.facade.openContributedTask('scene-compose', 'scene').kind).toBe('opened');
		expect(fixture.facade.marks()).toEqual([]);
		expect(fixture.facade.closeTask()).toBe(true);
		expect(fixture.facade.marks().length).toBeGreaterThan(0);
	});
});

	describe('X7 placement lifetimes', () => {
	async function placing(entities: readonly SceneEntity[] = [box()], options: MountOptions = {}) {
		const fixture = await mounted(entities, options);
		const opened = fixture.facade.openContributedTask('scene-place', 'scene');
		if (opened.kind !== 'opened') throw new Error(`Place was not opened: ${opened.message}`);
		return fixture;
	}

	function openPlaceSurface(facade: StageFacade) {
		const evaluation = facade.evaluation();
		if (evaluation === null) throw new Error('the placement fixture has no evaluation');
		const surface = sceneSurfaceFor(facade.snapshot(), evaluation);
		if (surface === null) throw new Error('Place published no surface');
		return surface;
	}

	function clickAt(facade: StageFacade, world: Vec3) {
		const evaluationId = facade.evaluationId()!;
		const at = cssOf(facade, world);
		expect(facade.pointerIntent({ phase: 'down', css: at, evaluationId }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'up', css: at, evaluationId });
	}

	function approval() {
		return {
			derivative: {
				hash: `sha256-${'a'.repeat(64)}`,
				mime: 'model/gltf-binary',
				size: 4096,
				locator: `models/sha256-${'a'.repeat(64)}.glb`
			},
			source: { manifestHash: `sha256-${'b'.repeat(64)}`, size: 8192, fileCount: 2 },
			recipe: { id: 'creator-import@1', version: 1 },
			reportDigest: `sha256-${'c'.repeat(64)}`,
			placement: {
				metresPerSourceUnit: 1,
				pivot: [0, 0, 0] as [number, number, number],
				footprint: { width: 0.8, depth: 0.6 },
				contactMinY: -0.25
			}
		};
	}

	function savedFormCopy(): ArmedFormCopy {
		const item = canonicalFormLibraryPayload({
			formatVersion: 1,
			kind: 'form',
			name: 'Saved terrace plinth',
			form: {
				generator: {
					kind: 'extrude',
					plane: 'plan',
					outline: [
						{ key: 1, u: 0, v: 0, smooth: false },
						{ key: 2, u: 1, v: 0, smooth: false },
						{ key: 3, u: 1, v: 1, smooth: false },
						{ key: 4, u: 0, v: 1, smooth: false }
					],
					extent: 0.8
				},
				scale: [1, 1, 1],
				nextKey: 5
			},
			materialId: 'plaster-warm',
			castShadow: true,
			receiveShadow: true
		});
		return { itemId: 'library-item-terrace', item, contactMinY: 0 };
	}


	it('places one object per press-release, selects it canonically and stays armed', async () => {
		const fixture = await placing();
		const { facade, host } = fixture;
		const evaluationId = facade.evaluationId()!;
		const before = host.history().depth;
		const at = cssOf(facade, [4.5, 0, 1.5]);
		expect(facade.pointerIntent({ phase: 'down', css: at, evaluationId })).toEqual({ claimed: true, adapterId: 'scene' });
		expect(leaseHeld(facade)).toBe(true);
		expect(facade.ghosts().length).toBe(1);
		facade.pointerIntent({ phase: 'up', css: at, evaluationId });
		await eventually(() => facade.snapshot().domain.scene.entities.length === 2);
		expect(host.history().depth).toBe(before + 1);
		const placed = selectedId(facade);
		expect(placed).not.toBeNull();
		expect(placed).not.toBe(BOX_ID);
		expect(leaseHeld(facade)).toBe(false);
		// The persistent tool reopens once the rebuilt binding is invocable.
		facade.camera.evaluate(RECT, 2);
		facade.overlays();
		await eventually(() => facade.session.task()?.kind === 'place-object');
	});

	it('installs a pointer placement on a raised floor region at the shown elevation through F4', async () => {
		const accepted: AuthoringIntent[] = [];
		const fixture = await placing([box()], {
			layout: terraceLayout(),
			recordAccept: (intent) => accepted.push(intent)
		});
		const { facade, host } = fixture;
		const before = facade.snapshot();
		const depth = host.history().depth;

		clickAt(facade, [4.5, 0.6, 1.5]);
		await eventually(() => facade.snapshot().domain.scene.entities.length === 2);

		expect(host.history().depth).toBe(depth + 1);
		const placedId = selectedId(facade);
		expect(placedId).not.toBeNull();
		if (placedId === null) return;
		const placed = entityOf(facade, placedId)!;
		expect(placed.position[1]).toBeCloseTo(1.1, 9);
		expect(placed.position[0]).toBeCloseTo(4.5, 9);
		expect(placed.position[2]).toBeCloseTo(1.5, 9);

		expect(accepted).toHaveLength(1);
		const intent = accepted[0]!;
		expect(intent.kind).toBe('place-object');
		expect(intent.payload).toMatchObject({
			supportChoice: {
				kind: 'elevation',
				elevation: 0.6,
				generationId: sceneSupportGenerationId(before.sourceContentId)
			}
		});
	});

	it('forwards the raised-region choice for an approved model through the same binding and one history entry', async () => {
		const entry = creatorModelResourceEntry('model-terrace', approval());
		if (entry === null) throw new Error('the model fixture was refused');
		// The binding captures approved resources under this label; matching it keeps
		// the admitted definition identity stable.
		const definition = await creatorModelDefinition(entry.resource, 'Imported model');
		if (definition === null) throw new Error('the model definition was not admitted');
		const accepted: AuthoringIntent[] = [];
		const fixture = await placing([box()], {
			layout: terraceLayout(),
			recordAccept: (intent) => accepted.push(intent)
		});
		const { facade, host } = fixture;
		// The import flow captures this definition before arming. Seed the same
		// provisional store the real approved-resource load uses.
		rememberCreatorDefinition(definition);
		// First placement introduces the approved resource and its exact lock in the
		// same accepted result as the entity.
		openPlaceSurface(facade).session.setArmedModel({ definition, resource: entry });
		const depth = host.history().depth;

		clickAt(facade, [4.5, 0.6, 1.5]);
		await eventually(() => facade.snapshot().domain.scene.entities.length === 2);

		expect(host.history().depth).toBe(depth + 1);
		const placedId = selectedId(facade);
		expect(placedId).not.toBeNull();
		if (placedId === null) return;
		const placed = entityOf(facade, placedId)!;
		expect(placed.kind).toBe('model');
		// Approved contact -0.25 m under the 0.6 m terrace top.
		expect(placed.position[1]).toBeCloseTo(0.85, 9);
		expect(accepted).toHaveLength(1);
		expect(accepted[0]!.payload).toMatchObject({
			supportChoice: { kind: 'elevation', elevation: 0.6 },
			modelResource: { id: 'model-terrace' }
		});
		expect(stageEnvelope(facade.snapshot()).units.resources.data.resources.map((resource) => resource.id)).toContain(
			'model-terrace'
		);
	});

	it('forwards the raised-region choice for a saved form copy and installs one history entry', async () => {
		const accepted: AuthoringIntent[] = [];
		const fixture = await placing([box()], {
			layout: terraceLayout(),
			recordAccept: (intent) => accepted.push(intent)
		});
		const { facade, host } = fixture;
		openPlaceSurface(facade).session.setArmedFormCopy(savedFormCopy());
		const depth = host.history().depth;

		clickAt(facade, [4, 0.6, 2.5]);
		await eventually(() => facade.snapshot().domain.scene.entities.length === 2);

		expect(host.history().depth).toBe(depth + 1);
		const placedId = selectedId(facade);
		expect(placedId).not.toBeNull();
		if (placedId === null) return;
		const placed = entityOf(facade, placedId)!;
		expect(placed.kind).toBe('form');
		expect(placed.position[1]).toBeCloseTo(0.6, 9);
		expect(accepted).toHaveLength(1);
		expect(accepted[0]!.kind).toBe('place-form-copy');
		expect(accepted[0]!.payload).toMatchObject({
			supportChoice: { kind: 'elevation', elevation: 0.6 }
		});
	});

	it('writes nothing for a placement press cancelled mid-gesture and stays armed', async () => {
		const fixture = await placing();
		const { facade, host } = fixture;
		const evaluationId = facade.evaluationId()!;
		const before = host.history();
		const at = cssOf(facade, [4.5, 0, 1.5]);
		facade.pointerIntent({ phase: 'down', css: at, evaluationId });
		expect(leaseHeld(facade)).toBe(true);
		facade.pointerIntent({ phase: 'cancel', css: at, evaluationId });
		await settle();
		expect(leaseHeld(facade)).toBe(false);
		expect(facade.ghosts()).toEqual([]);
		expect(host.history()).toEqual(before);
		expect(facade.session.task()?.kind).toBe('place-object');
		// Armed still: the next press previews again.
		expect(facade.pointerIntent({ phase: 'down', css: at, evaluationId }).claimed).toBe(true);
		expect(facade.overlays().map((marker) => marker.label)).toContain('Click to place · Esc cancels');
		facade.pointerIntent({ phase: 'cancel', css: at, evaluationId });
	});

	it('closing the task mid-press releases the lease, writes nothing and disarms', async () => {
		const fixture = await placing();
		const { facade, host } = fixture;
		const evaluationId = facade.evaluationId()!;
		const before = host.history();
		const at = cssOf(facade, [4.5, 0, 1.5]);
		facade.pointerIntent({ phase: 'down', css: at, evaluationId });
		expect(leaseHeld(facade)).toBe(true);
		expect(facade.closeTask()).toBe(true);
		expect(leaseHeld(facade)).toBe(false);
		facade.pointerIntent({ phase: 'up', css: at, evaluationId });
		await settle();
		expect(host.history()).toEqual(before);
		expect(facade.session.task()).toBeNull();
		expect(facade.ghosts()).toEqual([]);
	});

	it('refuses a press on occluded support, installs nothing and frees the lease', async () => {
		const screen: SceneEntity = {
			...(box('entity-screen', [5, 1.5, 3]) as Extract<SceneEntity, { kind: 'primitive'; primitive: 'box' }>),
			name: 'Screen',
			dimensions: { width: 4, height: 3, depth: 4 }
		};
		const fixture = await placing([box(), screen]);
		const { facade, host } = fixture;
		const evaluationId = facade.evaluationId()!;
		const before = host.history();
		const blocked = cssOf(facade, [5, 1.5, 3]);
		expect(facade.pointerIntent({ phase: 'down', css: blocked, evaluationId }).claimed).toBe(true);
		// The refused pose is drawn in refusal ink and is never a committable candidate.
		expect(facade.ghosts().every((ghost) => ghost.treatment === 'refused')).toBe(true);
		expect(facade.overlays().map((marker) => marker.label).join('|')).toMatch(/obscured|reach|floor/i);
		facade.pointerIntent({ phase: 'up', css: blocked, evaluationId });
		await settle();
		expect(host.history()).toEqual(before);
		expect(leaseHeld(facade)).toBe(false);
	});

	it('keeps the placement lease bound to the press when the reading is re-evaluated', async () => {
		const fixture = await placing();
		const { facade, host } = fixture;
		const evaluationId = facade.evaluationId()!;
		const before = host.history().depth;
		const at = cssOf(facade, [4.5, 0, 1.5]);
		facade.pointerIntent({ phase: 'down', css: at, evaluationId });
		facade.camera.applyIntent({ kind: 'pan', deltaCss: [4, 0], rect: RECT }, 2);
		expect(facade.camera.evaluate(RECT, 2).kind).toBe('evaluated');
		facade.pointerIntent({ phase: 'up', css: at, evaluationId });
		await eventually(() => host.history().depth === before + 1);
		expect(host.history().depth).toBe(before + 1);
	});

	it('does not reopen Place when Esc closes the tool while the install is in flight', async () => {
		const fixture = await placing();
		const { facade, host } = fixture;
		const evaluationId = facade.evaluationId()!;
		const at = cssOf(facade, [4.5, 0, 1.5]);
		facade.pointerIntent({ phase: 'down', css: at, evaluationId });
		facade.pointerIntent({ phase: 'up', css: at, evaluationId });
		expect(facade.closeTask()).toBe(true);
		await settle();
		facade.camera.evaluate(RECT, 2);
		facade.overlays();
		await settle();
		expect(facade.session.task()).toBeNull();
		// Whatever the race produced, it produced at most the one install.
		expect(host.history().depth).toBeLessThanOrEqual(2);
	});

	it('rebinding preserves the armed pointer tool and the Compose duplicate completion', async () => {
		const fixture = await mounted();
		select(fixture.facade, BOX_ID);
		const { facade, host, services } = fixture;
		expect(facade.openContributedTask('scene-compose', 'scene').kind).toBe('opened');
		const before = host.history().depth;
		const commands = sceneObjectCommands(services, BOX_ID)!;
		const copy = await commands.duplicate();
		expect(copy.kind).toBe('installed');
		await eventually(() => facade.snapshot().domain.scene.entities.length === 2);
		expect(host.history().depth).toBe(before + 1);
		expect(selectedId(facade)).not.toBeNull();
	});
});

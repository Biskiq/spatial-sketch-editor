import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, Shape, ShapeGeometry } from 'three';
import { createWallRepresentation } from '$lib/render/layout-wall-representation';
import { createObjectRepresentation } from '$lib/render/layout-object-representation';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core';
import type { SceneEntity } from '@portfolio/project-model';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { captureFor } from '../layout/__fixtures__/layout-id-capture';
import { STARTER_ENCLOSURE_POINTS } from '$lib/authoring/stage/starter-gallery';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createAdapter as layoutAdapter } from '$lib/authoring/adapters/layout.adapter';
import { createAdapter as sceneAdapter } from '$lib/authoring/adapters/scene.adapter';
import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import { buildFormGeometry } from '$lib/museum/entities/form-geometry';

const rect = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
// Captured against trusted main 8c2c86e6 with this fixture and the real Layout
// renderers. Plan was re-recorded for R217.S12 (O3 Camera basis); 3D is unchanged.
const baselinePath = resolve('tests/lib/authoring/__fixtures__/stage-pick-baseline.json');
const entities: SceneEntity[] = [
	{ kind: 'model', id: 'catalogue', name: 'Catalogue', assetId: 'paris-grand-piano', fallback: 'piano', position: [2, 1, 4], rotation: [0, 0, 0], scale: 2 },
	{ kind: 'primitive', primitive: 'box', id: 'primitive', name: 'Primitive', dimensions: { width: 1, height: 1, depth: 1 }, materialId: 'plaster-warm', castShadow: true, receiveShadow: true, position: [4, .5, 2], rotation: [0, 0, 0] },
	{ kind: 'form', id: 'form', name: 'Form', position: [5, 0, 3], rotation: [0, 0, 0], materialId: 'plaster-warm', castShadow: true, receiveShadow: true, form: { generator: { kind: 'extrude', plane: 'plan', extent: 1, outline: [ { key: 1, u: -.5, v: 0, smooth: false }, { key: 2, u: .5, v: 0, smooth: false }, { key: 3, u: .5, v: 1, smooth: false }, { key: 4, u: -.5, v: 1, smooth: false } ] }, scale: [1, 1, 1], nextKey: 5 } }
];
const fixtures = [
	{ name: 'starter', points: STARTER_ENCLOSURE_POINTS, entities: [] },
	{ name: 'l-layout', points: [[0, 0], [8, 0], [8, 3], [4, 3], [4, 7], [0, 7]] as const, entities: [] },
	{ name: 'scene', points: [[0, 0], [7, 0], [7, 6], [0, 6]] as const, entities }
];

async function samples(fixture: typeof fixtures[number], registerLayout = true) {
	const empty = createEmptyWallFirstLayoutDocument();
	const plan = planWallChain({ baseline: empty, points: fixture.points.map(p => [p[0], p[1]]), close: true, capture: captureFor(`r217-${fixture.name}`), levelId: empty.floor.id });
	if (plan.kind !== 'success') throw new Error('fixture layout refused');
	const source = await createUnitProject({ id: `r217-${fixture.name}`, name: fixture.name, layout: plan.document,
		scene: { formatVersion: 1, textures: [], materials: [], entities: fixture.entities, navigationNodes: [], connections: [] } });
	const admitted = await admitSource(source, { sessionEpoch: `r217-${fixture.name}`, acceptedRevision: { projectId: source.id, revisionId: 'r217-baseline' } });
	if (admitted.kind !== 'admitted') throw new Error('fixture admission refused');
	const session = createStageSession({ sessionEpoch: admitted.snapshot.sessionEpoch });
	session.replace(admitted.snapshot);
	const rendered = createScenePickSource(); rendered.setSource(admitted.snapshot.domain.scene);
	const meshes: Mesh[] = [];
	// Match VisitorLayoutShell under StageCanvas's registerLayout group: the
	// canonical wall/object renderers and its floor, ceiling and ground meshes.
	const root = new Group();
	const walls = createWallRepresentation(); walls.update(admitted.snapshot.domain.geometry); root.add(walls.object3d);
	const objects = createObjectRepresentation(); objects.update(admitted.snapshot.domain.geometry); root.add(objects.object3d);
	const ground = new Mesh(new CylinderGeometry(22, 22, .05, 96), new MeshBasicMaterial());
	ground.name = 'MuseumGroundPlinth'; ground.position.y = -.08; root.add(ground); meshes.push(ground);
	for (const room of admitted.snapshot.domain.geometry.rooms) {
		for (const [name, points, height, rotation, invert] of [
			['floor', room.floorPolygon, room.floorElevation, -Math.PI / 2, true],
			['ceiling', room.ceilingPolygon, room.ceilingElevation, Math.PI / 2, false]
		] as const) {
			const shape = new Shape();
			points.forEach((point, i) => { const z = invert ? -point[1] : point[1]; if (i === 0) shape.moveTo(point[0], z); else shape.lineTo(point[0], z); });
			shape.closePath();
			const mesh = new Mesh(new ShapeGeometry(shape), new MeshBasicMaterial());
			mesh.name = name === 'floor' ? `VisitorFloor:${room.roomId}` : `VisitorCeiling:${room.roomId}`;
			mesh.position.y = height; mesh.rotation.x = rotation; root.add(mesh); meshes.push(mesh);
		}
	}
	if (registerLayout) rendered.registerLayout(root);
	for (const entity of fixture.entities) {
		const geometry = entity.kind === 'form' ? buildFormGeometry(evaluateFormMesh(entity.form)!, entity.form.generator.plane) : new BoxGeometry(1, 1, 1);
		const mesh = new Mesh(geometry, new MeshBasicMaterial()); mesh.position.fromArray(entity.position); mesh.rotation.set(...entity.rotation); if (entity.kind === 'model') mesh.scale.setScalar(entity.scale ?? 1);
		rendered.register(entity.id, mesh); meshes.push(mesh);
	}
	const facade = createStageFacade({ snapshot: admitted.snapshot, session, scenePick: rendered.pick });
	facade.camera.evaluate(rect, 1); facade.acquireInspection('exclusive');
	const host = createStageAcceptanceHost({ facade, sessionEpoch: admitted.snapshot.sessionEpoch, baseline: { revision: admitted.snapshot.acceptedRevision, source, canonicalJson: admitted.snapshot.canonicalJson, sourceContentId: admitted.snapshot.sourceContentId }, planners: [] });
	mountStageAdapter(facade, host, layoutAdapter); mountStageAdapter(facade, host, sceneAdapter);
	const outputs: Record<string, unknown[]> = {};
	for (const reading of ['3d', 'plan'] as const) {
		facade.camera.applyIntent({ kind: 'set-reading', reading }, 2); facade.camera.evaluate(rect, 4);
		const id = facade.evaluationId()!; const results: unknown[] = [];
		for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
			const css = [(x + .5) * rect.width / 20, (y + .5) * rect.height / 20] as const;
			const hit = facade.resolveSourceHit({ css, evaluationId: id });
			const value = hit.kind === 'resolved' ? hit.hit : { kind: hit.kind };
			results.push(value);
			const hover = facade.resolvePick({ css, evaluationId: id, purpose: 'hover', tool: null });
			expect(hover).toEqual(hit);
		}
		outputs[reading] = results;
	}
	facade.dispose(); host.dispose(); walls.dispose(); objects.dispose(); meshes.forEach(mesh => { mesh.geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose(); });
	return outputs;
}

describe('S03 recorded pre-change selection differential', () => {
	it('preserves winners at 400 samples per fixture and reading', async () => {
		const actual: Record<string, unknown> = {};
		for (const fixture of fixtures) actual[fixture.name] = await samples(fixture);
		const scene = actual.scene as Record<string, Array<{ sourceId?: string; sourceKind?: string }>>;
		expect(scene['3d']![248]).toMatchObject({ sourceKind: 'wall', sourceId: 'wall-chain-3.r217-scene' });
		for (const reading of ['3d', 'plan']) {
			const ids = new Set(scene[reading]!.map((hit) => hit.sourceId));
			for (const id of ['catalogue', 'primitive', 'form']) expect(ids.has(id), `${reading} includes ${id}`).toBe(true);
		}
		{
			const expected = JSON.parse(readFileSync(baselinePath, 'utf8'));
			// The 3D half is the historical pre-S03 capture. Plan was re-recorded for
			// R217.S12: O3's basis fix is exactly Plan's 180° screen roll. Before the
			// re-record, all 1,200 Plan samples matched the old basis at the mirrored
			// sample on every field except worldPoint, which differed by at most 1.8e-15.
			// Exact values are pinned again so later drift fails this test.
			expect(actual).toEqual(expected);
		}
	});
	it('still resolves the nearer Layout surface if its rendered registry is temporarily absent', async () => {
		// At the legacy base this transient state chose catalogue at this sample.
		const result = await samples(fixtures[2]!, false);
		expect(result['3d']![248]).toMatchObject({ sourceKind: 'wall', sourceId: 'wall-chain-3.r217-scene' });
	});

});

/**
 * R217.S06 — host integration for owner-declared ticks and the Paper cut.
 *
 * This contract mounts the production Layout and Scene adapters on one admitted
 * project. It proves the host combines their real contributions, that removing
 * Scene registration removes only its table tick, and that the Sheet's mounted
 * Plan-cut consumer changes the actual Paper drawing set.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	planCommitLayoutObjectPreset,
	planWallChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import type { SceneEntity } from '@portfolio/project-model';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { createAdapter as createLayoutAdapter } from '$lib/authoring/adapters/layout.adapter';
import { createAdapter as createSceneAdapter } from '$lib/authoring/adapters/scene.adapter';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { buildPaperPlan } from '$lib/authoring/stage/paper-plan';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const PROJECT_ID = 'project-height-owner-integration';
const EMPTY_PROJECTION = { footprints: [] } as const;
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

function layoutFixture(): { document: LayoutDocumentWallFirst; lowWallId: string; tallWallId: string } {
	const baseline = createEmptyWallFirstLayoutDocument();
	const chained = planWallChain({
		baseline,
		points: [[0, 0], [6, 0], [6, 4], [0, 4]],
		close: true,
		capture: freshCapture(),
		levelId: baseline.floor.id
	});
	if (chained.kind !== 'success') throw new Error('the enclosure fixture was refused');

	const firstWallId = chained.document.walls[0]!.id;
	const secondWallId = chained.document.walls[1]!.id;
	const withPlinth = planCommitLayoutObjectPreset(
		chained.document,
		'plinth',
		[2, 2],
		chained.document.floor.elevation,
		'layout-plinth-integration',
		chained.document.floor.id
	);
	if (withPlinth.kind !== 'success') throw new Error(`the plinth fixture was refused: ${withPlinth.rejection.message}`);

	const document: LayoutDocumentWallFirst = {
		...withPlinth.document,
		walls: withPlinth.document.walls.map((wall) => ({
			...wall,
			height: wall.id === firstWallId ? 0.9 : wall.id === secondWallId ? 3 : wall.height
		}))
	};
	return { document, lowWallId: firstWallId, tallWallId: secondWallId };
}

async function mountFixture(options: {
	entities?: SceneEntity[];
	sceneBounds?: (id: string) => { min: [number, number, number]; max: [number, number, number] } | null;
} = {}) {
	const layout = layoutFixture();
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'Height owner integration',
		layout: layout.document,
		scene: {
			formatVersion: 1,
			textures: [],
			materials: [],
			entities: options.entities ?? [{
				kind: 'primitive',
				primitive: 'box',
				id: 'scene-table',
				name: 'Table',
				dimensions: { width: 1, height: 0.75, depth: 1 },
				materialId: 'plaster-warm',
				castShadow: true,
				receiveShadow: true,
				position: [4, 0.375, 2],
				rotation: [0, 0, 0]
			}],
			navigationNodes: [],
			connections: []
		}
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-height-owner-integration',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`fixture admission failed: ${admitted.kind}`);
	const snapshot = admitted.snapshot;
	const session = createStageSession({ sessionEpoch: snapshot.sessionEpoch });
	session.replace(snapshot);
	const facade = createStageFacade({ snapshot, session, sceneBounds: options.sceneBounds });
	facade.acquireInspection('exclusive');
	facade.camera.evaluate(RECT, 1);
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
	const layoutRegistration = mountStageAdapter(facade, host, createLayoutAdapter);
	const sceneRegistration = mountStageAdapter(facade, host, createSceneAdapter);
	if (layoutRegistration.kind !== 'registered' || sceneRegistration.kind !== 'registered') {
		throw new Error('production domain adapter failed to register');
	}
	return { facade, snapshot, sceneRegistration, ...layout };
}

function rotatedForm(): SceneEntity {
	return {
		kind: 'form',
		id: 'tilted-native-form',
		name: 'Tilted form',
		position: [8, 0.5, 3],
		rotation: [Math.PI / 2, 0, 0],
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
				extent: 1
			},
			scale: [1, 1, 1],
			nextKey: 5
		},
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true
	};
}

function paperStreams(facade: Awaited<ReturnType<typeof mountFixture>>['facade'], snapshot: Awaited<ReturnType<typeof mountFixture>>['snapshot']) {
	const result = facade.plan();
	if (result.kind !== 'evaluated') throw new Error(`Plan evaluation failed: ${result.issues.map((issue) => issue.message).join('; ')}`);
	const drawing = buildPaperPlan(result.plan, snapshot.domain.geometry, EMPTY_PROJECTION);
	return new Set(drawing.lines.map((line) => `${line.sourceId}::${line.stream}`));
}

describe('R217.S06 — Height Sheet owner integration', () => {
	it('uses mounted evaluated bounds for tilted primitives and native forms', async () => {
		const rotatedPrimitive: SceneEntity = {
			kind: 'primitive',
			primitive: 'box',
			id: 'tilted-primitive',
			name: 'Tilted primitive',
			dimensions: { width: 2, height: 0.75, depth: 1 },
			materialId: 'plaster-warm',
			castShadow: true,
			receiveShadow: true,
			position: [3, 0.5, 3],
			rotation: [Math.PI / 2, 0, 0]
		};
		const mounted = await mountFixture({
			entities: [rotatedPrimitive, rotatedForm()],
			sceneBounds: (id) => {
				if (id === 'tilted-primitive') {
					return { min: [2, 0, 2.625], max: [4, 1.1, 3.375] };
				}
				if (id === 'tilted-native-form') {
					return { min: [7.5, 0, 2.5], max: [8.5, 1.25, 3.5] };
				}
				return null;
			}
		});

		expect(mounted.facade.heightTicks().map((tick) => [tick.label, tick.heightMeters])).toEqual([
			['Floor', 0],
			['Box layout-plinth-integration', 1],
			['Tilted primitive', 1.1],
			['Tilted form', 1.25]
		]);
	});

	it('withholds tilted primitive and form fallback ticks when evaluated bounds are unavailable', async () => {
		const rotatedPrimitive: SceneEntity = {
			kind: 'primitive',
			primitive: 'box',
			id: 'tilted-primitive',
			name: 'Tilted primitive',
			dimensions: { width: 2, height: 0.75, depth: 1 },
			materialId: 'plaster-warm',
			castShadow: true,
			receiveShadow: true,
			position: [3, 0.5, 3],
			rotation: [Math.PI / 2, 0, 0]
		};
		const mounted = await mountFixture({ entities: [rotatedPrimitive, rotatedForm()] });

		expect(mounted.facade.heightTicks().map((tick) => tick.label)).toEqual([
			'Floor',
			'Box layout-plinth-integration'
		]);
	});

	it('combines real Layout and Scene ticks, and drops only the Scene tick when its owner leaves', async () => {
		const mounted = await mountFixture();
		const ticks = mounted.facade.heightTicks();
		expect(ticks.map((tick) => [tick.kind, tick.heightMeters, tick.label])).toEqual([
			['datum', 0, 'Floor'],
			['found', 0.75, 'Table'],
			['found', 1, 'Box layout-plinth-integration']
		]);

		mounted.sceneRegistration.dispose();
		expect(mounted.facade.heightTicks()).toEqual([
			{ kind: 'datum', heightMeters: 0, label: 'Floor' },
			{ kind: 'found', heightMeters: 1, label: 'Box layout-plinth-integration' }
		]);
	});

	it('draws the Height Sheet cut through Paper at 1.2 m → 0.6 m → 1.2 m', async () => {
		const mounted = await mountFixture();
		const low = `${mounted.lowWallId}::`;
		const tall = `${mounted.tallWallId}::`;

		const initial = paperStreams(mounted.facade, mounted.snapshot);
		expect([...initial].filter((entry) => entry.startsWith(low))).toEqual([`${low}hidden`]);
		expect([...initial].filter((entry) => entry.startsWith(tall))).toEqual([`${tall}cut`]);

		mounted.facade.heightSheet().set(0.6, 'key');
		const lowered = paperStreams(mounted.facade, mounted.snapshot);
		expect([...lowered].filter((entry) => entry.startsWith(low))).toEqual([`${low}cut`]);
		expect([...lowered].filter((entry) => entry.startsWith(tall))).toEqual([`${tall}cut`]);

		mounted.facade.heightSheet().set(1.2, 'key');
		const returned = paperStreams(mounted.facade, mounted.snapshot);
		expect([...returned].filter((entry) => entry.startsWith(low))).toEqual([`${low}hidden`]);
		expect([...returned].filter((entry) => entry.startsWith(tall))).toEqual([`${tall}cut`]);
	});
});

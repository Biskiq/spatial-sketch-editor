/**
 * SP1c — the production Plan pick provider on nested Spaces and the Eraser.
 *
 * The unit-level `findPlanHitRoom` test cannot prove the Stage provider's
 * candidate arbitration: the provider must compare nested Room floors rather
 * than stopping at the first one, and an Eraser must reach a Wall whose floor
 * also answers under the pointer. These journeys mount the real facade and the
 * real `createPlanPickProvider`, so the assertion is about the path the editor
 * actually runs.
 */
import { describe, expect, it } from 'vitest';
import { createEmptyWallFirstLayoutDocument, type LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import { findSpaceCreationOutline, planCreateOpenSpace } from '@portfolio/layout-core/room';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { createPlanPickProvider } from '$lib/authoring/layout/plan-pick-provider';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { captureFor } from '../layout/__fixtures__/layout-id-capture';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-sp1c-open-space-pick';
const ELEVATION = 0.5;

function wall(id: string, start: string, end: string): LayoutDocumentWallFirst['walls'][number] {
	return {
		id,
		startJunctionId: start,
		endJunctionId: end,
		thickness: 0.2,
		height: 3,
		centerline: { kind: 'line' }
	};
}

function junction(id: string, point: LayoutVec2): LayoutDocumentWallFirst['junctions'][number] {
	return { id, point };
}

type Mounted = {
	readonly facade: StageFacade;
	readonly evaluationId: string;
};

async function mount(
	document: LayoutDocumentWallFirst,
	hostTools?: readonly ('erase' | 'measure')[]
): Promise<Mounted> {
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'SP1c pick',
		layout: document,
		scene: { formatVersion: 1, textures: [], materials: [], entities: [], navigationNodes: [], connections: [] }
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-sp1c-pick',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`SP1c pick fixture not admitted: ${admitted.kind}`);
	const snapshot = admitted.snapshot;
	const session = createStageSession({ sessionEpoch: snapshot.sessionEpoch });
	session.replace(snapshot);
	const facade = createStageFacade({ snapshot, session });
	facade.acquireInspection('exclusive');
	const result = facade.camera.evaluate(RECT, 1);
	if (result.kind !== 'evaluated') throw new Error(`the viewport did not evaluate: ${result.reason}`);
	const registration = facade.registerStageAdapter({
		id: 'layout',
		pick: createPlanPickProvider(() => facade.plan()),
		...(hostTools === undefined ? {} : { hostTools: [...hostTools] })
	});
	if (registration.kind !== 'registered') throw new Error(`the Layout provider did not mount: ${registration.kind}`);
	const evaluationId = facade.evaluationId();
	if (evaluationId === null) throw new Error('the facade has no live evaluation');
	return { facade, evaluationId };
}

/** A 40×40 Hall containing a 10×10 Booth: two nested closed Rooms. */
function hallAndBooth(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.junctions = [
		junction('hall-a', [0, 0]),
		junction('hall-b', [40, 0]),
		junction('hall-c', [40, 40]),
		junction('hall-d', [0, 40]),
		junction('booth-a', [15, 15]),
		junction('booth-b', [25, 15]),
		junction('booth-c', [25, 25]),
		junction('booth-d', [15, 25])
	];
	document.walls = [
		wall('hall-wall-a', 'hall-a', 'hall-b'),
		wall('hall-wall-b', 'hall-b', 'hall-c'),
		wall('hall-wall-c', 'hall-c', 'hall-d'),
		wall('hall-wall-d', 'hall-d', 'hall-a'),
		wall('booth-wall-a', 'booth-a', 'booth-b'),
		wall('booth-wall-b', 'booth-b', 'booth-c'),
		wall('booth-wall-c', 'booth-c', 'booth-d'),
		wall('booth-wall-d', 'booth-d', 'booth-a')
	];
	document.rooms = [
		{
			id: 'room-hall',
			name: 'Hall',
			boundary: [
				{ wallId: 'hall-wall-a', direction: 'forward' },
				{ wallId: 'hall-wall-b', direction: 'forward' },
				{ wallId: 'hall-wall-c', direction: 'forward' },
				{ wallId: 'hall-wall-d', direction: 'forward' }
			],
			virtualEdges: [],
			overhead: 'closed',
		},
		{
			id: 'room-booth',
			name: 'Booth',
			boundary: [
				{ wallId: 'booth-wall-a', direction: 'forward' },
				{ wallId: 'booth-wall-b', direction: 'forward' },
				{ wallId: 'booth-wall-c', direction: 'forward' },
				{ wallId: 'booth-wall-d', direction: 'forward' }
			],
			virtualEdges: [],
			overhead: 'closed',
		}
	];
	document.floor.elevation = ELEVATION;
	return document;
}

/** A 4×3 Space with one Wall left and three virtual sides. */
function lastWallOpenSpace(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.junctions = [
		junction('j-a', [0, 0]),
		junction('j-b', [4, 0]),
		junction('j-c', [4, 3]),
		junction('j-d', [0, 3])
	];
	document.walls = [wall('wall-a', 'j-a', 'j-b')];
	document.rooms = [
		{
			id: 'room-open',
			name: 'Open',
			boundary: [{ wallId: 'wall-a', direction: 'forward' }],
			virtualEdges: [
				{ startJunctionId: 'j-b', endJunctionId: 'j-c' },
				{ startJunctionId: 'j-c', endJunctionId: 'j-d' },
				{ startJunctionId: 'j-d', endJunctionId: 'j-a' }
			],
			overhead: 'closed',
		}
	];
	document.floor.elevation = ELEVATION;
	return document;
}

function cssAt(mounted: Mounted, world: readonly [number, number, number]): [number, number] {
	const projected = mounted.facade.projectWorld(world, mounted.evaluationId);
	if (projected.kind !== 'projected') throw new Error('the probe did not project');
	return [projected.css[0], projected.css[1]];
}

describe('SP1c — production Plan pick provider', () => {
	it('picks a Room-tool Booth inside the Hall and gives physical Walls priority', async () => {
		const baseline = hallAndBooth();
		baseline.walls.pop();
		baseline.rooms.pop();
		const outline = findSpaceCreationOutline(baseline, baseline.floor.id, [20, 20]);
		if (outline.kind !== 'outline') throw new Error('Expected the Booth outline.');
		const plan = planCreateOpenSpace({
			baseline, levelId: baseline.floor.id, capture: captureFor('nested-booth-pick'), cycle: outline.cycle
		});
		if (plan.kind !== 'planned') throw new Error(plan.message);
		const mounted = await mount(plan.document);
		const booth = mounted.facade.resolvePick({
			css: cssAt(mounted, [20, ELEVATION, 20]),
			evaluationId: mounted.evaluationId,
			purpose: 'select',
			tool: null
		});
		expect(booth).toMatchObject({ kind: 'resolved', hit: { sourceKind: 'room-floor', sourceId: plan.roomId } });

		const hall = mounted.facade.resolvePick({
			css: cssAt(mounted, [5, ELEVATION, 5]),
			evaluationId: mounted.evaluationId,
			purpose: 'select',
			tool: null
		});
		expect(hall).toMatchObject({ kind: 'resolved', hit: { sourceKind: 'room-floor', sourceId: 'room-hall' } });

		const wall = mounted.facade.resolvePick({
			css: cssAt(mounted, [20, ELEVATION + 1.5, 15]),
			evaluationId: mounted.evaluationId,
			purpose: 'select',
			tool: null
		});
		expect(wall).toMatchObject({ kind: 'resolved', hit: { sourceKind: 'wall', sourceId: 'booth-wall-a' } });
	});

	it('lets the Eraser reach a Wall whose Room floor also answers under the pointer', async () => {
		const mounted = await mount(hallAndBooth(), ['erase', 'measure']);
		const erased = mounted.facade.resolvePick({
			css: cssAt(mounted, [20, ELEVATION + 1.5, 15]),
			evaluationId: mounted.evaluationId,
			purpose: 'tool',
			tool: { kind: 'erase', scope: 'host' }
		});
		expect(erased).toMatchObject({ kind: 'resolved', hit: { sourceKind: 'wall', sourceId: 'booth-wall-a' } });
	});

	it('erases the last remaining Wall of an open Space instead of refusing its floor', async () => {
		const mounted = await mount(lastWallOpenSpace(), ['erase', 'measure']);
		const erased = mounted.facade.resolvePick({
			css: cssAt(mounted, [2, ELEVATION + 1.5, 0]),
			evaluationId: mounted.evaluationId,
			purpose: 'tool',
			tool: { kind: 'erase', scope: 'host' }
		});
		expect(erased.kind).not.toBe('refused');
		expect(erased).toMatchObject({ kind: 'resolved', hit: { sourceKind: 'wall', sourceId: 'wall-a' } });
	});
});

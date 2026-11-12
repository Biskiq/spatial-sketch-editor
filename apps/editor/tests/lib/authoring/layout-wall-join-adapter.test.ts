/**
 * T1 A2 — Join Walls, through the production Layout adapter and the real F4 host.
 *
 * The journey pinned here is the slice's acceptance:
 *
 * 1. a degree-2 Joint dragged onto the line between its neighbours' far ends
 *    reads **Remove joint** and previews the joined Wall;
 * 2. release joins the pair as one history entry through `planDissolveJunction`:
 *    the Wall that ends at the Joint survives, every Opening keeps its id and
 *    world position with a rebased station, and every Room keeps its id;
 * 3. a corner, unequal height, unequal thickness and a mixed straight/curved
 *    pair each refuse in words, writing nothing and adding no history;
 * 4. removal arms only after the pointer has left the zone once (hysteresis),
 *    and leaving again restores the ordinary Joint move;
 * 5. a tangent curved pair produced by an exact split joins sample-identically,
 *    with the demoted knot's id derived from the operation's capture;
 * 6. a three-Wall Joint still moves: "delete a junction" has no single meaning
 *    there, so the removal is never offered;
 * 7. an Eraser press on a Joint still resolves its incident Wall — the Stage
 *    contract this slice does not change (see the A2 plan's Stage dependency).
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	planCreateWallFirstOpening,
	planDissolveJunction,
	planWallChain,
	planWallSplit,
	wallFirstWallLength,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type NodingIdAllocator
} from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { captureUnitSave, readUnitEnvelopeForSave } from '@portfolio/project-model/units';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { wallStationFrame } from '$lib/authoring/adapters/layout/precision';
import { wallJoinRefusalWords } from '$lib/authoring/adapters/layout/refusals';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-layout-a2-join';
const ELEVATION = 0.5;
const CORNER_WORDS = 'These Walls meet at a corner.';
const MISMATCH_WORDS = 'These Walls differ in height or thickness.';

type Mounted = {
	readonly facade: StageFacade;
	readonly session: StageSession;
	readonly host: StageAcceptanceHost;
	readonly services: StageAdapterServices;
};

const allocator: NodingIdAllocator = {
	nextWallId: (_document, seed) => `${seed}-frag`,
	nextJunctionId: (_document, seed) => `${seed}-j`
};

function emptyDocument(): LayoutDocumentWallFirst {
	const base = createEmptyWallFirstLayoutDocument();
	base.floor.elevation = ELEVATION;
	return base;
}

function point(x: number, z: number): LayoutVec2 {
	return [x, z];
}

type WallSpec = {
	readonly id: string;
	readonly start: string;
	readonly end: string;
	readonly height?: number;
	readonly thickness?: number;
	readonly centerline?: LayoutDocumentWallFirst['walls'][number]['centerline'];
};

/** One hand-authored document; straight Walls are the canonical `line` form. */
function documentOf(
	junctions: Array<[string, LayoutVec2]>,
	walls: readonly WallSpec[]
): LayoutDocumentWallFirst {
	const base = emptyDocument();
	base.junctions = junctions.map(([id, at]) => ({ id, point: [at[0], at[1]] as LayoutVec2 }));
	base.walls = walls.map((wall) => ({
		id: wall.id,
		startJunctionId: wall.start,
		endJunctionId: wall.end,
		thickness: wall.thickness ?? 0.2,
		height: wall.height ?? 3,
		centerline: wall.centerline ?? { kind: 'line' as const }
	}));
	return base;
}

/** A collinear pair: wa ends at the Joint, wb starts there. */
function collinearPair(overrides: { readonly wa?: Partial<WallSpec>; readonly wb?: Partial<WallSpec> } = {}): LayoutDocumentWallFirst {
	return documentOf(
		[
			['e1', point(0, 0)],
			['j', point(3, 0)],
			['e2', point(6, 0)]
		],
		[
			{ id: 'wa', start: 'e1', end: 'j', ...overrides.wa },
			{ id: 'wb', start: 'j', end: 'e2', ...overrides.wb }
		]
	);
}

/**
 * The A1 enclosure with its bottom Wall split at 3 m and a window on the end
 * fragment: the exact state a join returns to one Wall, one Room and one
 * Opening at a rebased station.
 */
function splitEnclosureFixture(): {
	readonly document: LayoutDocumentWallFirst;
	readonly survivorWallId: string;
	readonly retiredWallId: string;
	readonly junctionId: string;
	readonly openingId: string;
	readonly roomId: string;
} {
	const base = emptyDocument();
	const chained = planWallChain({
		baseline: base,
		points: [
			[0, 0],
			[6, 0],
			[6, 4],
			[0, 4]
		],
		close: true,
		capture: freshCapture(),
		levelId: base.floor.id
	});
	if (chained.kind !== 'success') throw new Error('the A2 enclosure was refused');
	const wallId = chained.document.walls[0]!.id;
	const split = planWallSplit(chained.document, wallId, 3, allocator);
	if (split.kind !== 'success') throw new Error('the A2 split fixture was refused');
	const otherWallId = split.document.walls.find((wall) => wall.id !== wallId)!.id;
	const opening = planCreateWallFirstOpening(
		split.document,
		{ wallId: otherWallId, kind: 'window', offset: 1, width: 1, height: 1.2, sillHeight: 1 },
		freshCapture(),
		split.document.floor.id
	);
	if (opening.kind === 'rejected') throw new Error(`A2 Opening fixture refused: ${opening.rejection.message}`);
	return {
		document: opening.document,
		survivorWallId: wallId,
		retiredWallId: otherWallId,
		junctionId: split.junctionId,
		openingId: opening.changedOpeningIds[0]!,
		roomId: opening.document.rooms[0]!.id
	};
}

/** The A1 enclosure: four Walls, four degree-2 corners and one Room. */
function enclosureDocument(): LayoutDocumentWallFirst {
	const base = emptyDocument();
	const chained = planWallChain({
		baseline: base,
		points: [
			[0, 0],
			[6, 0],
			[6, 4],
			[0, 4]
		],
		close: true,
		capture: freshCapture(),
		levelId: base.floor.id
	});
	if (chained.kind !== 'success') throw new Error('the A2 enclosure was refused');
	return chained.document;
}

/** The same enclosure with a third Wall standing on its bottom-right corner. */
function threeWallJointFixture(): LayoutDocumentWallFirst {
	return documentOf(
		[
			['e1', point(0, 0)],
			['j', point(3, 0)],
			['e2', point(6, 0)],
			['up', point(3, 3)]
		],
		[
			{ id: 'wa', start: 'e1', end: 'j' },
			{ id: 'wb', start: 'j', end: 'e2' },
			{ id: 'wc', start: 'j', end: 'up' }
		]
	);
}

async function mount(document: LayoutDocumentWallFirst, name = 'A2 join walls'): Promise<Mounted> {
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name,
		layout: document,
		scene: {
			formatVersion: 1,
			textures: [],
			materials: [],
			entities: [],
			navigationNodes: [],
			connections: []
		}
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-a2-join',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`A2 fixture not admitted: ${admitted.kind}`);
	const snapshot = admitted.snapshot;
	const session = createStageSession({ sessionEpoch: snapshot.sessionEpoch });
	session.replace(snapshot);
	const facade = createStageFacade({ snapshot, session });
	facade.acquireInspection('exclusive');
	// Exact pointer-to-world mapping: grid snapping is exercised by its own suite,
	// and the removal zone is 0.12 m wide.
	facade.setDrafting({ snapSuspended: true });
	// Joint hover is a Plan-reading affordance: the idle hover only runs there.
	facade.camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, 0);
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
	let services: StageAdapterServices | undefined;
	const registration = mountStageAdapter(facade, host, (port) => {
		services = port;
		return createAdapter(port);
	});
	if (registration.kind !== 'registered' || services === undefined) throw new Error('Layout adapter did not mount');
	return { facade, session, host, services };
}

function settle(facade: StageFacade, clockSeconds = 2): void {
	const result = facade.camera.evaluate(RECT, clockSeconds);
	if (result.kind !== 'evaluated') throw new Error(`the viewport did not evaluate: ${result.reason}`);
	facade.overlays();
	facade.tasks();
}

/** The projection of a world point on the level datum, in Stage-local CSS. */
function stageCss(facade: StageFacade, at: readonly [number, number]): readonly [number, number] {
	const id = facade.evaluationId();
	if (id === null) throw new Error('the mounted fixture has no evaluation');
	const projected = facade.projectWorld([at[0], ELEVATION, at[1]], id);
	if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
	return [projected.css[0] - RECT.left, projected.css[1] - RECT.top];
}

function acceptedLayout(facade: StageFacade): LayoutDocumentWallFirst {
	return stageEnvelope(facade.snapshot()).units.layout.data;
}

/** An Opening's start point on its host Wall's canonical centerline. */
function openingStart(document: LayoutDocumentWallFirst, openingId: string): LayoutVec2 {
	const opening = document.openings.find((candidate) => candidate.id === openingId);
	if (opening === undefined) throw new Error('the fixture Opening is gone');
	const at = wallStationFrame(document, opening.wallId)?.pointAt(opening.offset);
	if (at === null || at === undefined) throw new Error('the fixture Opening has no resolvable point');
	return at.point;
}

/** Whether the Joint's own mark names **Remove joint**. */
function namesRemoveJoint(facade: StageFacade): boolean {
	return facade.marks().find((mark) => mark.id === 'layout-junction-hover')?.tag === 'Remove joint';
}

/** The live refusal on the Joint's mark, when the attempted join was refused. */
function jointRefusal(facade: StageFacade): string {
	return facade.marks().find((mark) => mark.id === 'layout-junction-hover')?.refusal ?? '';
}

/**
 * Hover the Joint first: the adapter's press is a press on the `layout-junction-hover`
 * mark, exactly as a creator's pointer reaches it, so the gesture must own the mark.
 */
function pressJoint(
	facade: StageFacade,
	at: readonly [number, number]
): ReturnType<StageFacade['idleHoverIntent']> {
	const evaluationId = facade.evaluationId()!;
	// The idle hover is its own intent: it is what reveals the Joint's mark.
	const mark = facade.idleHoverIntent({
		phase: 'move',
		css: stageCss(facade, at),
		evaluationId,
		coarse: false
	});
	if (mark === null || mark.id !== 'layout-junction-hover') throw new Error('the Joint did not hover');
	const claimed = facade.pointerIntent({
		phase: 'down',
		css: stageCss(facade, at),
		evaluationId,
		handleId: mark.id,
		handleAdapterId: mark.adapterId
	});
	if (!claimed.claimed) throw new Error('the Joint press was not claimed');
	return mark;
}

/** One held-pointer move. No viewport settle between moves: that is a new
 * evaluation, and the gesture's `cancel-on-reading-change` policy would end it. */
function moveTo(facade: StageFacade, at: readonly [number, number]): void {
	const evaluationId = facade.evaluationId()!;
	facade.pointerIntent({ phase: 'move', css: stageCss(facade, at), evaluationId });
}

function release(facade: StageFacade, at: readonly [number, number]): void {
	const evaluationId = facade.evaluationId()!;
	facade.pointerIntent({ phase: 'up', css: stageCss(facade, at), evaluationId });
}

async function eventually(predicate: () => boolean, label = 'the fixture did not settle'): Promise<void> {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error(label);
}

describe('T1 A2 — Join walls', () => {
	it('[cap:layout.wall-join core] joins a collinear pair by removing its Joint, preserving the survivor, its Opening and the Room through Undo, Redo and Save/Load', async () => {
		const fixture = splitEnclosureFixture();
		const mounted = await mount(fixture.document);
		settle(mounted.facade, 2);
		const before = acceptedLayout(mounted.facade);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();
		const beforeOpeningPoint = openingStart(before, fixture.openingId);
		expect(before.walls).toHaveLength(5);
		// The two far ends the join must leave the survivor spanning.
		const beforeSurvivor = before.walls.find((wall) => wall.id === fixture.survivorWallId)!;
		const beforeRetired = before.walls.find((wall) => wall.id === fixture.retiredWallId)!;
		const expectedEnds = [beforeSurvivor.startJunctionId, beforeRetired.endJunctionId].sort();

		pressJoint(mounted.facade, [3, 0]);
		// Leave the removal zone first: the hysteresis is the gesture's, not the
		// planner's, so a press on an already-collinear joint never arms.
		moveTo(mounted.facade, [3, 1]);
		moveTo(mounted.facade, [4, 0]);
		expect(namesRemoveJoint(mounted.facade)).toBe(true);
		// The candidate is the joined Wall itself, not just the mark's words: its
		// paper spans the full 0–6 m the two halves are about to become.
		const joinCandidate = mounted.facade
			.candidatePreviews()
			.find((candidate) => candidate.id === 'layout-candidate-junction-join');
		expect(joinCandidate).toBeDefined();
		// Candidate previews are projectied into Stage CSS, so the joined Wall's
		// 0–6 m extent is compared in the same space the paper draws it.
		const startX = stageCss(mounted.facade, [0, 0])[0];
		const endX = stageCss(mounted.facade, [6, 0])[0];
		const candidateX = [
			...joinCandidate!.segments.flat().map((point) => point[0]),
			...joinCandidate!.polygons.flat().map((point) => point[0])
		];
		expect(Math.min(...candidateX)).toBeCloseTo(Math.min(startX, endX), 6);
		expect(Math.max(...candidateX)).toBeCloseTo(Math.max(startX, endX), 6);
		release(mounted.facade, [4, 0]);
		await eventually(() => mounted.facade.snapshot().canonicalJson !== beforeBytes, 'the join never committed');

		const after = acceptedLayout(mounted.facade);
		// The Wall that ends at the Joint survives; the other one retires.
		expect(after.walls.map((wall) => wall.id).sort()).toEqual(
			before.walls.map((wall) => wall.id).filter((id) => id !== fixture.retiredWallId).sort()
		);
		expect(after.junctions.some((junction) => junction.id === fixture.junctionId)).toBe(false);
		const joined = after.walls.find((wall) => wall.id === fixture.survivorWallId)!;
		expect([joined.startJunctionId, joined.endJunctionId].sort()).toEqual(expectedEnds);
		expect(joined.centerline.kind).toBe('line');
		// The two 3 m halves are one 6 m Wall again.
		expect(wallFirstWallLength(after, fixture.survivorWallId)).toBeCloseTo(6, 6);
		// The Opening keeps its id and its world position; only its station rebases.
		const opening = after.openings.find((candidate) => candidate.id === fixture.openingId)!;
		expect(opening.wallId).toBe(fixture.survivorWallId);
		const afterOpeningPoint = openingStart(after, fixture.openingId);
		expect(afterOpeningPoint[0]).toBeCloseTo(beforeOpeningPoint[0], 9);
		expect(afterOpeningPoint[1]).toBeCloseTo(beforeOpeningPoint[1], 9);
		// The Room keeps its id and names the joined Wall once.
		expect(after.rooms.map((room) => room.id)).toEqual([fixture.roomId]);
		expect(after.rooms[0]!.boundary.filter((ref) => ref.wallId === fixture.survivorWallId)).toHaveLength(1);
		// One gesture is one history entry.
		expect(mounted.host.history()).toMatchObject({
			depth: beforeHistory.depth + 1,
			position: beforeHistory.position + 1
		});

		// Undo restores the exact pre-join bytes; Redo replays the captured knot.
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect((await mounted.host.redo()).kind).toBe('installed');
		const joinedBytes = mounted.facade.snapshot().canonicalJson;
		expect(joinedBytes).not.toBe(beforeBytes);
		expect(acceptedLayout(mounted.facade).walls.some((wall) => wall.id === fixture.retiredWallId)).toBe(false);

		// The accepted join is an ordinary canonical document: Save/Load admits it unchanged.
		const captured = await captureUnitSave({
			snapshot: mounted.host.coordinator().acceptedSnapshot(),
			operationId: 'a2-join-roundtrip',
			precondition: { kind: 'create-only' }
		});
		expect(captured.kind).toBe('captured');
		if (captured.kind !== 'captured') throw new Error(`Save capture refused: ${captured.message}`);
		const reloaded = await readUnitEnvelopeForSave(captured.capture.canonicalJson);
		expect(reloaded.kind).toBe('read');
		if (reloaded.kind !== 'read') throw new Error(`Save reload refused: ${reloaded.message}`);
		const readmitted = await admitSource(reloaded.envelope, {
			sessionEpoch: 'session-a2-join-roundtrip',
			acceptedRevision: captured.capture.acceptedRevision
		});
		expect(readmitted.kind).toBe('admitted');
		if (readmitted.kind !== 'admitted') throw new Error(`Reload admission refused: ${readmitted.kind}`);
		expect(stageEnvelope(readmitted.snapshot).units).toEqual(stageEnvelope(mounted.facade.snapshot()).units);
	});

	it('[cap:layout.wall-join edge] refuses a corner, unequal height, unequal thickness and a mixed pair in words, writing nothing and adding no history', async () => {
		const cases: Array<{
			readonly label: string;
			readonly document: LayoutDocumentWallFirst;
			readonly joint: readonly [number, number];
			readonly to: readonly [number, number];
			readonly words: string;
		}> = [
			{
				label: 'corner',
				// The A1 enclosure's bottom-right corner: its neighbours' far ends are
				// the other two corners, so the chord runs across the Room.
				document: enclosureDocument(),
				joint: [6, 0],
				to: [3, 2],
				words: CORNER_WORDS
			},
			{
				label: 'unequal height',
				document: collinearPair({ wb: { height: 4 } }),
				joint: [3, 0],
				to: [4, 0],
				words: MISMATCH_WORDS
			},
			{
				label: 'unequal thickness',
				document: collinearPair({ wb: { thickness: 0.35 } }),
				joint: [3, 0],
				to: [4, 0],
				words: MISMATCH_WORDS
			},
			{
				label: 'mixed straight and curved',
				document: collinearPair({
					wa: {
						centerline: {
							kind: 'cubic-chain',
							knots: [],
							spans: [{ handleOut: [1, 0], handleIn: [2, 0] }]
						}
					}
				}),
				joint: [3, 0],
				to: [4, 0],
				words: 'A straight Wall and a curved Wall cannot join.'
			}
		];

		for (const testCase of cases) {
			const mounted = await mount(testCase.document, `A2 refusal ${testCase.label}`);
			settle(mounted.facade, 2);
			const beforeBytes = mounted.facade.snapshot().canonicalJson;
			const beforeHistory = mounted.host.history();
			const beforeWalls = acceptedLayout(mounted.facade).walls.length;

			pressJoint(mounted.facade, testCase.joint);
			moveTo(mounted.facade, [testCase.joint[0], testCase.joint[1] + 1]);
			moveTo(mounted.facade, testCase.to);
			expect(jointRefusal(mounted.facade), testCase.label).toContain(testCase.words);
			release(mounted.facade, testCase.to);
			await new Promise((resolve) => setTimeout(resolve, 25));

			expect(mounted.facade.snapshot().canonicalJson, testCase.label).toBe(beforeBytes);
			expect(mounted.host.history(), testCase.label).toEqual(beforeHistory);
			expect(acceptedLayout(mounted.facade).walls, testCase.label).toHaveLength(beforeWalls);
		}
	});

	it('arms removal only after the pointer has left the zone once, and leaving again restores the Joint move', async () => {
		const mounted = await mount(collinearPair());
		settle(mounted.facade, 2);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();

		pressJoint(mounted.facade, [3, 0]);
		// A press that stays inside the enter zone never arms: removal is an edit,
		// and an already-collinear Joint must be draggable like any other. The
		// pointer drags along the chord, so only the leave-once rule refuses it.
		moveTo(mounted.facade, [4, 0]);
		expect(namesRemoveJoint(mounted.facade)).toBe(false);

		// Leaving the wider zone once arms the next entry.
		moveTo(mounted.facade, [3, 1]);
		moveTo(mounted.facade, [4, 0]);
		expect(namesRemoveJoint(mounted.facade)).toBe(true);

		// Leaving again withdraws it: the ordinary Joint move comes back.
		moveTo(mounted.facade, [3, 1]);
		expect(namesRemoveJoint(mounted.facade)).toBe(false);
		release(mounted.facade, [3, 1]);
		await eventually(() => mounted.facade.snapshot().canonicalJson !== beforeBytes, 'the Joint move never committed');

		const after = acceptedLayout(mounted.facade);
		// A move, not a join: both Walls and the Joint remain, and the Joint moved.
		expect(after.walls).toHaveLength(2);
		const moved = after.junctions.find((junction) => junction.id === 'j')!;
		expect(moved.point[1]).toBeCloseTo(1, 6);
		expect(mounted.host.history()).toMatchObject({
			depth: beforeHistory.depth + 1,
			position: beforeHistory.position + 1
		});
	});

	it('joins a tangent curved pair produced by an exact split, sample-identically, with one captured knot id', async () => {
		const base = emptyDocument();
		base.junctions = [
			{ id: 'c1', point: point(0, 0) },
			{ id: 'c2', point: point(6, 0) }
		];
		base.walls = [
			{
				id: 'curve',
				startJunctionId: 'c1',
				endJunctionId: 'c2',
				thickness: 0.2,
				height: 3,
				centerline: {
					kind: 'cubic-chain',
					knots: [],
					spans: [{ handleOut: [2, 0.8], handleIn: [4, 0.8] }]
				}
			}
		];
		const split = planWallSplit(base, 'curve', 3, allocator);
		if (split.kind !== 'success') throw new Error('the A2 curved split fixture was refused');
		expect(split.document.walls).toHaveLength(2);

		const mounted = await mount(split.document, 'A2 tangent pair');
		settle(mounted.facade, 2);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const splitPoint = split.document.junctions.find((junction) => junction.id === split.junctionId)!;

		// The chord between the far ends: the arming target for the tangent pair.
		pressJoint(mounted.facade, [splitPoint.point[0], splitPoint.point[1]]);
		moveTo(mounted.facade, [splitPoint.point[0], splitPoint.point[1] + 1.5]);
		moveTo(mounted.facade, [3, 0]);
		expect(namesRemoveJoint(mounted.facade)).toBe(true);
		release(mounted.facade, [3, 0]);
		await eventually(() => mounted.facade.snapshot().canonicalJson !== beforeBytes, 'the curved join never committed');

		const after = acceptedLayout(mounted.facade);
		expect(after.walls).toHaveLength(1);
		expect(after.junctions.some((junction) => junction.id === split.junctionId)).toBe(false);
		const joined = after.walls[0]!;
		expect([joined.startJunctionId, joined.endJunctionId]).toEqual(['c1', 'c2']);
		expect(joined.centerline.kind).toBe('cubic-chain');
		if (joined.centerline.kind !== 'cubic-chain') throw new Error('expected a chain');
		// The demoted knot is the split's inverse: the same point, and the two
		// halves' spans concatenated byte-for-byte (the split's spans are exact).
		expect(joined.centerline.knots).toHaveLength(1);
		expect(joined.centerline.knots[0]!.id.startsWith(`${joined.id}:knot.`)).toBe(true);
		expect(joined.centerline.knots[0]!.point).toEqual(splitPoint.point);
		const firstHalf = split.document.walls.find((wall) => wall.id === joined.id)!;
		const secondHalf = split.document.walls.find((wall) => wall.id !== joined.id)!;
		if (firstHalf.centerline.kind !== 'cubic-chain' || secondHalf.centerline.kind !== 'cubic-chain') {
			throw new Error('expected split halves to be chains');
		}
		expect(joined.centerline.spans).toEqual([
			...firstHalf.centerline.spans,
			...secondHalf.centerline.spans
		]);
	});

	it('commits a join when the pointer leaves the Joint and returns to it before release', async () => {
		const mounted = await mount(collinearPair());
		settle(mounted.facade, 2);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();

		pressJoint(mounted.facade, [3, 0]);
		// Out and back: the release lands on the press point, so displacement alone
		// would read this as no drag even though the creator armed the removal.
		moveTo(mounted.facade, [3, 1]);
		moveTo(mounted.facade, [3, 0]);
		expect(namesRemoveJoint(mounted.facade)).toBe(true);
		release(mounted.facade, [3, 0]);
		await eventually(
			() => mounted.facade.snapshot().canonicalJson !== beforeBytes,
			'the out-and-back join never committed'
		);

		const after = acceptedLayout(mounted.facade);
		expect(after.walls).toHaveLength(1);
		expect(after.junctions.some((junction) => junction.id === 'j')).toBe(false);
		expect(mounted.host.history()).toMatchObject({
			depth: beforeHistory.depth + 1,
			position: beforeHistory.position + 1
		});
	});

	it('refuses a three-Wall Joint through the planner its intent calls, in words', async () => {
		const document = threeWallJointFixture();
		const plan = planDissolveJunction(document, 'j', freshCapture(), document.floor.id);
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') throw new Error('unreachable');
		expect(plan.rejection.code).toBe('junction_degree_not_two');
		expect(wallJoinRefusalWords(plan.rejection.code, plan.rejection.message)).toBe(
			'Three or more Walls meet here. A join needs exactly two Walls in a line.'
		);
	});

	it('still moves a three-Wall Joint, because a join needs exactly two Walls', async () => {
		const mounted = await mount(threeWallJointFixture(), 'A2 three-Wall Joint');
		settle(mounted.facade, 2);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;

		pressJoint(mounted.facade, [3, 0]);
		moveTo(mounted.facade, [3, 1]);
		expect(namesRemoveJoint(mounted.facade)).toBe(false);
		release(mounted.facade, [3, 1]);
		await eventually(() => mounted.facade.snapshot().canonicalJson !== beforeBytes, 'the Joint move never committed');

		const after = acceptedLayout(mounted.facade);
		expect(after.walls).toHaveLength(3);
		expect(after.junctions.find((junction) => junction.id === 'j')!.point[1]).toBeCloseTo(1, 6);
	});

	it('[cap:layout.wall-join edge] an Eraser press on a Joint still resolves the incident Wall', async () => {
		// The Stage contract this slice does not change: `PLAN_SOURCE_KINDS` has no
		// junction, and the Eraser dispatches to a subject's own Card delete. So a
		// press on the Joint names the Wall it would erase, exactly as before.
		const mounted = await mount(collinearPair());
		settle(mounted.facade, 2);
		const evaluationId = mounted.facade.evaluationId()!;
		const target = mounted.facade.hostToolTarget({
			css: stageCss(mounted.facade, [3, 0]),
			evaluationId,
			tool: 'erase'
		});
		expect(target.kind).toBe('hit');
		if (target.kind !== 'hit') throw new Error('no Eraser winner on the Joint');
		expect(target.hit.sourceKind).toBe('wall');
		expect(['wa', 'wb']).toContain(target.hit.sourceId);
		expect(mounted.facade.eraseAnswer(target.adapterId, target.hit)).toMatchObject({
			kind: 'action',
			action: { id: 'layout-wall-delete' }
		});
	});
});

import { describe, expect, it } from 'vitest';
import { compileWallFirstLayoutGeometry, hasBlockingLayoutIssues, spaceAtPoint, type LayoutVec2 } from '@portfolio/layout-core/geometry';
import { createEmptyWallFirstLayoutDocument, planDeleteWall, planSpaceOpenSideOffset, planWallChain, validateWallFirstLayoutDocument, type LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import { createSpaceCreationOutlineQuery, findSpaceCreationOutline, findSpaceCreationReturn, planCreateOpenSpace, roomBoundaryPolygon, spaceCreationWallChoices, spaceOutlineSelfIntersects, spaceOutlineSignedArea, type SpaceCreationAnchor, type SpaceCreationCycle } from '@portfolio/layout-core/room';
import { ensureLayoutWorldIndex } from '@portfolio/layout-core/world';

import { captureFor } from './__fixtures__/layout-id-capture';

const capture = captureFor('space-create-tests');
const j = (id: string): SpaceCreationAnchor => ({ kind: 'junction', id });
const corner = (key: string, point: LayoutVec2): SpaceCreationAnchor => ({ kind: 'corner', key, point });
const station = (wallId: string, station: number): SpaceCreationAnchor => ({ kind: 'wall-station', wallId, station });
const w = (wallId: string, from: SpaceCreationAnchor, to: SpaceCreationAnchor) => ({ kind: 'wall' as const, wallId, from, to });
const v = (from: SpaceCreationAnchor, to: SpaceCreationAnchor) => ({ kind: 'virtual' as const, from, to });

function run(prefix: string, points: LayoutVec2[], closed = false): LayoutDocumentWallFirst {
	const junctions = points.map((point, index) => ({ id: `${prefix}j${index}`, point }));
	const walls = junctions.slice(closed ? 0 : 1).map((end) => {
		const i = junctions.indexOf(end);
		return {
			id: `${prefix}w${i}`, startJunctionId: junctions.at(i - 1)!.id, endJunctionId: end.id,
			height: 3, thickness: 0.2, centerline: { kind: 'line' as const }
		};
	});
	return { ...createEmptyWallFirstLayoutDocument(), junctions, walls };
}

function withRuns(...documents: LayoutDocumentWallFirst[]): LayoutDocumentWallFirst {
	return {
		...createEmptyWallFirstLayoutDocument(),
		junctions: documents.flatMap(({ junctions }) => junctions),
		walls: documents.flatMap(({ walls }) => walls),
		rooms: documents.flatMap(({ rooms }) => rooms)
	};
}

function hover(baseline: LayoutDocumentWallFirst, point: LayoutVec2) {
	return findSpaceCreationOutline(baseline, baseline.floor.id, point);
}
function create(baseline: LayoutDocumentWallFirst, cycle: SpaceCreationCycle, nonce = capture) {
	return planCreateOpenSpace({ baseline, levelId: baseline.floor.id, capture: nonce, cycle });
}
function at(baseline: LayoutDocumentWallFirst, point: LayoutVec2, nonce = capture) {
	const outline = hover(baseline, point);
	if (outline.kind !== 'outline') throw new Error(JSON.stringify(outline));
	const plan = create(baseline, outline.cycle, nonce);
	if (plan.kind !== 'planned') throw new Error(JSON.stringify(plan));
	return plan;
}

describe('Room tool outlines and Open Space creation', () => {
	it('uses one perpendicular cap at the farther tip and captures replayable corner identities', () => {
		const baseline = run('u', [[0, 4], [0, 0], [6, 0], [6, 2]]);
		const point: LayoutVec2 = [3, 3];
		const plan = at(baseline, point);
		expect(plan.evidence.virtual).toEqual([[[6, 2], [6, 4]], [[6, 4], [0, 4]]]);
		expect(spaceOutlineSignedArea(plan.evidence.polygon)).toBe(24);
		const room = plan.document.rooms[0]!;
		expect(room).toMatchObject({ name: 'Open Space 1', overhead: 'open-to-sky' });
		expect(at(baseline, point).document).toEqual(plan.document);
		const shuffled = { ...baseline, walls: [...baseline.walls].reverse(), junctions: [...baseline.junctions].reverse() };
		expect(at(shuffled, point).cycleKey).toBe(plan.cycleKey);
		expect(at(shuffled, point).document.rooms[0]!.virtualEdges).toEqual(room.virtualEdges);
		const reversed = { ...baseline, walls: baseline.walls.map((wall) => ({
			...wall, startJunctionId: wall.endJunctionId, endJunctionId: wall.startJunctionId
		})) };
		expect(at(reversed, point).evidence.polygon).toEqual(plan.evidence.polygon);
		for (const edge of [[0, 3], [6, 3], [3, 4], [3, 0], [7, 1]] as LayoutVec2[]) {
			expect(hover(baseline, edge)).toEqual({ kind: 'none' });
		}
	});

	it('refuses ambiguity and cap contact and keeps disconnected runs separate', () => {
		const outer = run('outer', [[0, 4], [0, 0], [6, 0], [6, 4]]);
		const inner = run('inner', [[1, 3], [1, 1], [5, 1], [5, 3]]);
		expect(hover(withRuns(outer, inner), [3, 2])).toMatchObject({ kind: 'ambiguous' });
		for (const points of [
			[[3, 3], [3, 5]], [[3, 4], [3, 5]], [[2, 4], [4, 4]], [[0, 4], [-1, 5]]
		] as LayoutVec2[][]) {
			expect(hover(withRuns(outer, run('blocker', points)), [2, 2])).toMatchObject({ kind: 'refused', code: 'wall-contact' });
		}
		expect(hover(withRuns(run('south', [[0, 0], [6, 0]]), run('north', [[6, 4], [0, 4]])), [3, 2])).toEqual({ kind: 'none' });
		expect(hover(run('ring', [[0, 0], [6, 0], [6, 4], [0, 4]], true), [3, 2])).toEqual({ kind: 'none' });
		expect(hover(createEmptyWallFirstLayoutDocument(), [3, 2])).toEqual({ kind: 'none' });
	});

	it('uses canonical curve samples between the two physical endpoints', () => {
		const baseline = run('arc', [[0, 0], [6, 0]]);
		baseline.walls[0]!.centerline = {
			kind: 'cubic-chain', knots: [], spans: [{ handleOut: [1, 4], handleIn: [5, 4] }]
		};
		const plan = at(baseline, [3, 1]);
		expect(plan.evidence.walls[0]!.length).toBeGreaterThan(2);
		expect(plan.evidence.virtual).toEqual([[[0, 0], [6, 0]]]);
		expect(plan.document.rooms[0]!.boundary).toHaveLength(1);
	});

	it('does not publish partial results on exhaustion or after warming a component walk', () => {
		// A long open run consumes the work budget before the search reaches its second tip.
		const baseline = run('long', Array.from({ length: 2300 }, (_, i) => [i / 4, (i % 2) / 5]));
		const query = createSpaceCreationOutlineQuery(baseline, baseline.floor.id);
		for (const point of [[6, 0.1], [11, 0.1], [6, 0.1]] as LayoutVec2[]) {
			expect(query(point)).toMatchObject({ kind: 'indeterminate' });
			expect(query(point)).toEqual(hover(baseline, point));
		}
		expect(hover(baseline, [2000, 2000])).toEqual({ kind: 'none' });
	});

	it('finds the west remainder of a divided open Space using the opposite divider side', () => {
		const baseline = run('u', [[0, 0], [4, 0], [4, 3], [0, 3]]);
		const original = at(baseline, [1, 1.5]);
		original.document.rooms[0]!.name = 'Gallery';
		const divider = planWallChain({
			baseline: original.document, levelId: baseline.floor.id, capture: captureFor('space-divider'),
			points: [[2, 0], [2, 3]], close: false,
			endpointHostSnaps: [{ pointIndex: 0, wallId: 'uw1' }, { pointIndex: 1, wallId: 'uw3' }]
		});
		expect(divider.kind).toBe('success');
		if (divider.kind !== 'success') throw new Error(JSON.stringify(divider));
		expect(divider.document.rooms[0]).toMatchObject({ id: original.roomId, name: 'Gallery', virtualEdges: [] });
		const west = at(divider.document, [1, 1.5], captureFor('space-west'));
		expect(spaceOutlineSignedArea(west.evidence.polygon)).toBe(6);
		const shared = divider.authoredWallIds[0]!;
		const directions = west.document.rooms.map(({ boundary }) => boundary.find(({ wallId }) => wallId === shared)?.direction);
		expect(new Set(directions)).toEqual(new Set(['forward', 'reverse']));
		expect(west.roomId).not.toBe(original.roomId);
		const merged = planDeleteWall(west.document, shared, captureFor('merge-created-spaces'), baseline.floor.id);
		expect(merged.kind).toBe('success');
		if (merged.kind !== 'success') throw new Error(JSON.stringify(merged));
		expect(merged.document.rooms).toHaveLength(1);
		expect(spaceOutlineSignedArea(roomBoundaryPolygon(merged.document, merged.document.rooms[0]!.id)!)).toBe(12);
	});

	it('keeps the new Space identity through a grip move, partial Wall absorption and closure', () => {
		const baseline = run('u', [[0, 0], [4, 0], [4, 3], [0, 3]]);
		const plan = at(baseline, [2, 2]);
		const moved = planSpaceOpenSideOffset(plan.document, plan.roomId, 'uj3', 'uj0', 0.5);
		if (moved.kind !== 'success') throw new Error(JSON.stringify(moved));
		const partial = planWallChain({
			baseline: moved.document, levelId: baseline.floor.id, capture: captureFor('space-partial'),
			points: [[0.5, 0], [0.5, 1.5]], close: false,
			endpointJunctionSnaps: [{ pointIndex: 0, junctionId: 'uj0' }]
		});
		if (partial.kind !== 'success') throw new Error(JSON.stringify(partial));
		expect(partial.absorbedRoomIds).toEqual([plan.roomId]);
		const edge = partial.document.rooms[0]!.virtualEdges[0]!;
		const final = planWallChain({
			baseline: partial.document, levelId: baseline.floor.id, capture: captureFor('space-closed'),
			points: [[0.5, 3], [0.5, 1.5]], close: false,
			endpointJunctionSnaps: [
				{ pointIndex: 0, junctionId: edge.startJunctionId },
				{ pointIndex: 1, junctionId: edge.endJunctionId }
			]
		});
		expect(final).toMatchObject({
			kind: 'success', document: { rooms: [{ id: plan.roomId, name: 'Open Space 1', virtualEdges: [] }] }
		});
	});

	it('supports free corners, traced Wall branches and two explicitly stated gaps', () => {
		const baseline = withRuns(run('south', [[0, 0], [6, 0]]), run('north', [[6, 4], [0, 4]]));
		const a = j('southj0'), b = j('southj1'), c = j('northj0'), d = j('northj1');
		expect(findSpaceCreationReturn(baseline, capture, [v(b, c)])).toEqual({ kind: 'none' });
		expect(spaceCreationWallChoices(baseline, c, [v(b, c)], b)).toEqual([w('northw1', c, d)]);
		const complete = findSpaceCreationReturn(baseline, capture, [v(b, c), w('northw1', c, d), v(d, a)]);
		expect(complete.kind).toBe('outline');
		if (complete.kind !== 'outline') throw new Error(JSON.stringify(complete));
		expect(create(baseline, complete.cycle)).toMatchObject({ kind: 'planned' });

		const oneWall = run('south', [[0, 0], [6, 0]]);
		const freeC = corner('east', [6, 4]), freeD = corner('west', [0, 4]);
		const plan = create(oneWall, [w('southw1', a, b), v(b, freeC), v(freeC, freeD), v(freeD, a)]);
		expect(plan).toMatchObject({ kind: 'planned', createdJunctionIds: expect.arrayContaining([expect.any(String), expect.any(String)]) });
	});

	it('keeps a manual branch choice open until the creator traces a specific Wall return', () => {
		const baseline = run('fork', [[-2, 0], [0, -2], [2, 0], [0, 2]], true);
		const a = j('forkj0'), b = j('forkj2');
		const gap = v(a, b);
		expect(findSpaceCreationReturn(baseline, capture, [gap])).toMatchObject({ kind: 'ambiguous' });
		const choices = spaceCreationWallChoices(baseline, b, [gap], a);
		expect(choices.map(({ wallId }) => wallId)).toEqual(['forkw2', 'forkw3']);
		const upper = choices[1]!;
		const last = w('forkw0', upper.to, a);
		const closed = findSpaceCreationReturn(baseline, capture, [gap, upper, last]);
		expect(closed).toMatchObject({ kind: 'outline', cycle: [gap, upper, last] });
	});

	it('rejects intersecting accepted Space interiors while allowing a virtual boundary touch', () => {
		const first = at(run('south', [[0, 4], [0, 0], [4, 0], [4, 4]]), [2, 2]);
		// Keep the new virtual spans clear of physical Walls while crossing the
		// accepted Space's virtual north side.
		const baseline = withRuns(first.document, run('north', [[3, 6], [1, 6]]));
		const a = j('northj0'), b = j('northj1');
		const cycleAt = (z: number) => {
			const c = corner('sw', [1, z]), d = corner('se', [3, z]);
			return [w('northw1', a, b), v(b, c), v(c, d), v(d, a)];
		};
		const nonce = captureFor('overlapping-space');
		expect(create(baseline, cycleAt(2), nonce)).toMatchObject({ kind: 'refused', code: 'space_overlap', message: 'Overlaps Open Space 1' });
		expect(create(baseline, cycleAt(4), nonce)).toMatchObject({ kind: 'planned' });
	});

	it('splits two deliberate stations on one original Wall and refuses a protected Opening', () => {
		const baseline = run('south', [[0, 0], [10, 0]]);
		const wallId = 'southw1';
		const a = station(wallId, 2), b = station(wallId, 6), c = corner('east', [6, 3]), d = corner('west', [2, 3]);
		const cycle = [w(wallId, a, b), v(b, c), v(c, d), v(d, a)];
		const opening = { id: 'door', wallId, kind: 'door' as const, profile: 'rectangular' as const, offset: 8, width: 1, height: 2, sillHeight: 0 };
		baseline.openings.push(opening);
		const original = structuredClone(baseline);
		const plan = create(baseline, cycle);
		expect(plan.kind).toBe('planned');
		if (plan.kind !== 'planned') throw new Error(JSON.stringify(plan));
		expect(plan.splitWallIds).toEqual([wallId]);
		expect(plan.createdWallIds).toHaveLength(2);
		expect(plan.document.openings[0]).toMatchObject({ offset: 2, wallId: plan.createdWallIds[0] });
		expect(plan.document.rooms[0]!.boundary[0]!.wallId).toBe(plan.createdWallIds[1]);
		expect(baseline).toEqual(original);
		const blocked = { ...baseline, openings: [{ ...opening, offset: 5.75 }] };
		expect(create(blocked, cycle)).toMatchObject({ kind: 'refused', code: 'split', message: 'The split crosses an Opening' });
		expect(blocked.openings[0]!.wallId).toBe(wallId);
	});

	it('supports independent nesting and refuses use of the Hall’s occupied Wall side', () => {
		const hall = run('hall', [[0, 0], [12, 0], [12, 8], [0, 8]], true);
		hall.rooms.push({
			id: 'hall', name: 'Hall', overhead: 'closed',  			boundary: hall.walls.map(({ id }) => ({ wallId: id, direction: 'forward' })), virtualEdges: []
		});
		const booth = run('booth', [[2, 5], [2, 2], [5, 2], [5, 5]]);
		const plan = at(withRuns(hall, booth), [3, 3]);
		expect(plan.document.rooms[0]).toEqual(hall.rooms[0]);
		expect(spaceOutlineSignedArea(plan.evidence.polygon)).toBe(9);
		expect(roomBoundaryPolygon(plan.document, 'hall')).toHaveLength(4);
		expect(ensureLayoutWorldIndex(plan.document)).toBeDefined();
		expect(spaceAtPoint([3, 3], plan.compiled.geometry.rooms)?.roomId).toBe(plan.roomId);
		expect(spaceAtPoint([6, 3], plan.compiled.geometry.rooms)?.roomId).toBe('hall');

		const a = station('hallw1', 2), b = station('hallw1', 5);
		const c = corner('back-right', [5, 3]), d = corner('back-left', [2, 3]);
		expect(create(hall, [w('hallw1', a, b), v(b, c), v(c, d), v(d, a)])).toMatchObject({
			kind: 'refused', code: 'wall-side-owned', message: 'Hall already uses this Wall side'
		});
		expect(hall.walls).toHaveLength(4);
	});

	it('rejects a virtual vertex pinched into another segment across planner, compiler and index', () => {
		const baseline = run('wall', [[6, 0], [6, 4]]);
		const a = j('wallj0'), b = j('wallj1');
		const corners: LayoutVec2[] = [[0, 4], [0, 3], [3, 0], [0, 1], [0, 0]];
		const loop = [b, ...corners.map((point, i) => corner(`c${i}`, point)), a];
		// The notch touches the bottom virtual span at (3,0), with no proper crossings.
		const cycle = [w('wallw1', a, b), ...loop.slice(1).map((anchor, i) => v(loop[i]!, anchor))];
		expect(spaceOutlineSelfIntersects([[6, 0], [6, 4], ...corners])).toBe(true);
		expect(create(baseline, cycle)).toMatchObject({ kind: 'refused', code: 'self-intersection' });
		const junctions = corners.map((point, i) => ({ id: `c${i}`, point }));
		const keys = [baseline.junctions[1]!.id, ...junctions.map(({ id }) => id), baseline.junctions[0]!.id];
		const forged: LayoutDocumentWallFirst = {
			...baseline, junctions: [...baseline.junctions, ...junctions],
			rooms: [{
				id: 'pinched', name: 'Pinched', overhead: 'open-to-sky',  				boundary: [{ wallId: 'wallw1', direction: 'forward' }],
				virtualEdges: keys.slice(1).map((id, i) => ({ startJunctionId: keys[i]!, endJunctionId: id }))
			}]
		};
		expect(hasBlockingLayoutIssues(compileWallFirstLayoutGeometry(forged).issues)).toBe(true);
		expect(validateWallFirstLayoutDocument(forged).success).toBe(true);
		expect(ensureLayoutWorldIndex(forged)).toBeUndefined();
	});
});

/**
 * C2 foundation — canonical closed-Wall topology and the D6 16-span Bézier
 * representation.
 *
 * These tests prove the contract at the model boundary: one self-connected
 * Wall, exactly 16 symmetric cubic spans, an explicit measured accuracy bound,
 * one Room through the existing face-tracing/birth path, a seam at the authored
 * rim that survives Save/Load, and explicit isolation refusals.
 */
import { describe, expect, it } from 'vitest';

import {
	CLOSED_WALL_CIRCLE_ACCURACY,
	CLOSED_WALL_CIRCLE_KNOT_COUNT,
	CLOSED_WALL_CIRCLE_SPAN_COUNT,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	buildClosedWallCircleCenterline,
	compileWallFirstLayoutGeometry,
	createClosedWallCircleDocument,
	extractBoundaryCandidateFaces,
	hasBlockingLayoutIssues,
	mintLayoutIdCapture,
	parseWallFirstLayoutDocumentJson,
	planDissolveJunction,
	planFirstEnclosureCreation,
	planWallSplit,
	roomBoundaryPolygon,
	serializeWallFirstLayoutDocument,
	validateWallFirstLayoutDocument,
	validateWallFirstTopology,
	wallCurveChainLength,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type NodingIdAllocator
} from '@portfolio/layout-core';

const CENTER: LayoutVec2 = [0, 0];
const RIM: LayoutVec2 = [5, 0];
const RADIUS = 5;

function circleDocument(): Extract<ReturnType<typeof createClosedWallCircleDocument>, { kind: 'success' }> {
	const created = createClosedWallCircleDocument({
		center: CENTER,
		rim: RIM,
		junctionId: 'j-circle',
		wallId: 'wall-circle',
		thickness: 0.2,
		height: 3
	});
	if (created.kind !== 'success') throw new Error(JSON.stringify(created.rejection));
	return created;
}

function chainOf(wall: LayoutWall): Extract<LayoutWall['centerline'], { kind: 'cubic-chain' }> {
	if (wall.centerline.kind !== 'cubic-chain') throw new Error('expected a cubic-chain centerline');
	return wall.centerline;
}

function pointsOf(wall: LayoutWall, seam: LayoutVec2): LayoutVec2[] {
	const chain = chainOf(wall);
	return [[...seam] as LayoutVec2, ...chain.knots.map((knot) => [...knot.point] as LayoutVec2), [...seam] as LayoutVec2];
}

function cubicAt(points: readonly LayoutVec2[], spans: readonly { handleOut: LayoutVec2; handleIn: LayoutVec2 }[], index: number, t: number): LayoutVec2 {
	const p0 = points[index]!;
	const p1 = spans[index]!.handleOut;
	const p2 = spans[index]!.handleIn;
	const p3 = points[index + 1]!;
	const u = 1 - t;
	return [
		u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
		u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
	];
}

function polygonArea(polygon: readonly LayoutVec2[]): number {
	let area = 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const current = polygon[index]!;
		const next = polygon[(index + 1) % polygon.length]!;
		area += current[0] * next[1] - next[0] * current[1];
	}
	return area / 2;
}

function allocator(): NodingIdAllocator {
	return {
		nextWallId(base, seed) {
			let candidate = `${seed}-1`;
			let counter = 1;
			while (base.walls.some((wall) => wall.id === candidate)) {
				counter += 1;
				candidate = `${seed}-${counter}`;
			}
			return candidate;
		},
		nextJunctionId(base, seed) {
			let candidate = `j-${seed}-1`;
			let counter = 1;
			while (base.junctions.some((junction) => junction.id === candidate)) {
				counter += 1;
				candidate = `j-${seed}-${counter}`;
			}
			return candidate;
		}
	};
}

function roomDocument(): LayoutDocumentWallFirst {
	const created = circleDocument();
	const plan = planFirstEnclosureCreation({
		candidateDocument: created.document,
		capture: mintLayoutIdCapture(() => 'closed-wall-test'),
		levelId: created.document.floor.id
	});
	if (plan.kind !== 'success') throw new Error(JSON.stringify(plan.rejection));
	return plan.document;
}

describe('C2 foundation — self-loop topology and D6 closed Bézier Wall', () => {
	it('models a closed Wall as one Wall whose start and end Junction are the same', () => {
		const created = circleDocument();
		const wall = created.wall;
		expect(wall.startJunctionId).toBe('j-circle');
		expect(wall.endJunctionId).toBe('j-circle');
		expect(created.document.junctions).toHaveLength(1);
		expect(created.document.walls).toHaveLength(1);
		expect(validateWallFirstLayoutDocument(created.document).success).toBe(true);
		expect(validateWallFirstTopology(created.document)).toBeUndefined();
	});

	it('constructs exactly 16 symmetric cubic spans and 15 interior knots', () => {
		const created = circleDocument();
		const chain = chainOf(created.wall);
		expect(chain.spans).toHaveLength(CLOSED_WALL_CIRCLE_SPAN_COUNT);
		expect(chain.knots).toHaveLength(CLOSED_WALL_CIRCLE_KNOT_COUNT);
		expect(chain.spans).toHaveLength(chain.knots.length + 1);
		expect(CLOSED_WALL_CIRCLE_SPAN_COUNT).toBe(16);
		const points = pointsOf(created.wall, created.seam);
		const step = (Math.PI * 2) / CLOSED_WALL_CIRCLE_SPAN_COUNT;
		const expectedHandle = (4 / 3) * Math.tan(step / 4) * RADIUS;

		for (let index = 0; index < chain.spans.length; index += 1) {
			const span = chain.spans[index]!;
			const start = points[index]!;
			const end = points[index + 1]!;
			expect(Math.hypot(end[0] - start[0], end[1] - start[1])).toBeCloseTo(
				2 * RADIUS * Math.sin(step / 2),
				12
			);
			expect(Math.hypot(span.handleOut[0] - start[0], span.handleOut[1] - start[1])).toBeCloseTo(
				expectedHandle,
				12
			);
			expect(Math.hypot(span.handleIn[0] - end[0], span.handleIn[1] - end[1])).toBeCloseTo(
				expectedHandle,
				12
			);
			// Each span is the same 22.5° arc rotated by its span index. The radial
			// direction at its start must therefore be the authored angle plus i·step.
			const radialAngle = Math.atan2(start[1] - CENTER[1], start[0] - CENTER[0]);
			const normalized = Math.atan2(Math.sin(radialAngle - index * step), Math.cos(radialAngle - index * step));
			expect(Math.abs(normalized)).toBeLessThan(1e-12);
		}
		// The seam is the authored rim point, not a recomputed approximation.
		expect(created.seam).toEqual(RIM);
		expect(created.document.junctions[0]!.point).toEqual(RIM);
	});

	it('meets the explicit measured circular-accuracy contract', () => {
		const created = circleDocument();
		const chain = chainOf(created.wall);
		const points = pointsOf(created.wall, created.seam);
		let maxRadialError = 0;
		for (let spanIndex = 0; spanIndex < chain.spans.length; spanIndex += 1) {
			for (let sample = 0; sample <= 2000; sample += 1) {
				const point = cubicAt(points, chain.spans, spanIndex, sample / 2000);
				maxRadialError = Math.max(
					maxRadialError,
					Math.abs(Math.hypot(point[0] - CENTER[0], point[1] - CENTER[1]) - RADIUS)
				);
			}
		}
		const lengthError = Math.abs(
			wallCurveChainLength({
				startPoint: created.seam,
				endPoint: created.seam,
				knots: chain.knots,
				spans: chain.spans
			}) -
				2 * Math.PI * RADIUS
		);

		// The tolerances are the shipped contract. They are 3.01× and 1.87× the
		// recorded 16-span measurement, and far below a chord or an 8-span chain.
		expect(maxRadialError).toBeLessThanOrEqual(CLOSED_WALL_CIRCLE_ACCURACY.maxRadialError);
		expect(lengthError).toBeLessThanOrEqual(CLOSED_WALL_CIRCLE_ACCURACY.maxLengthError);
		expect(CLOSED_WALL_CIRCLE_ACCURACY.measured.radialError).toBeLessThanOrEqual(
			CLOSED_WALL_CIRCLE_ACCURACY.maxRadialError
		);
		expect(CLOSED_WALL_CIRCLE_ACCURACY.measured.lengthError).toBeLessThanOrEqual(
			CLOSED_WALL_CIRCLE_ACCURACY.maxLengthError
		);
	});

	it('derives exactly one Room and one bounded face through the existing paths', () => {
		const created = circleDocument();
		const faces = extractBoundaryCandidateFaces(created.document);
		expect(faces.faces).toHaveLength(1);
		expect(faces.faces[0]!.boundary).toEqual([{ wallId: 'wall-circle', direction: 'forward' }]);
		// Face polygons are the sampler's render evidence, not the centerline
		// accuracy contract: the 0.01 m flatness sampler leaves <0.1 m² area error
		// on a 78.54 m² circle while the persisted cubics meet the micrometre bound.
		expect(Math.abs(faces.faces[0]!.signedArea - Math.PI * RADIUS * RADIUS)).toBeLessThan(0.1);
		expect(faces.danglingWallIds).toEqual([]);
		expect(faces.cutEdgeWallIds).toEqual([]);

		const born = roomDocument();
		expect(born.rooms).toHaveLength(1);
		expect(born.rooms[0]!.boundary).toEqual([{ wallId: 'wall-circle', direction: 'forward' }]);
		const polygon = roomBoundaryPolygon(born, born.rooms[0]!.id);
		expect(polygon).not.toBeNull();
		expect(polygon!.length).toBeGreaterThan(3);
		// Room polygons are sampled render evidence. Their 0.01 m flatness leaves
		// <0.1 m² area error on this 78.54 m² circle; the un-sampled cubic contract
		// above is what carries the micrometre accuracy claim.
		expect(Math.abs(polygonArea(polygon!) - Math.PI * RADIUS * RADIUS)).toBeLessThan(0.1);

		const compiled = compileWallFirstLayoutGeometry(born);
		expect(hasBlockingLayoutIssues(compiled.issues)).toBe(false);
		expect(compiled.geometry.rooms).toHaveLength(1);
		expect(compiled.geometry.walls).toHaveLength(1);
		expect(compiled.geometry.walls[0]!.length).toBeCloseTo(2 * Math.PI * RADIUS, 5);
		// Wall-first Rooms carry no duplicate physical Wall records.
		expect(compiled.geometry.rooms[0]!.walls).toHaveLength(0);
	});

	it('keeps the canonical seam at the authored rim through Save/Load and refuses format 6', () => {
		const born = roomDocument();
		const wallBefore = born.walls.find((wall) => wall.id === 'wall-circle')!;
		const seamBefore = born.junctions.find((junction) => junction.id === wallBefore.startJunctionId)!.point;
		expect(seamBefore).toEqual(RIM);

		const json = serializeWallFirstLayoutDocument(born);
		const parsed = parseWallFirstLayoutDocumentJson(json);
		if (!parsed.success) throw new Error(JSON.stringify(parsed.issues));
		expect(parsed.document.formatVersion).toBe(LAYOUT_WALL_FIRST_FORMAT_VERSION);
		expect(JSON.stringify(parsed.document)).toBe(JSON.stringify(born));
		const wallAfter = parsed.document.walls.find((wall) => wall.id === 'wall-circle')!;
		expect(wallAfter.startJunctionId).toBe(wallAfter.endJunctionId);
		const seamAfter = parsed.document.junctions.find(
			(junction) => junction.id === wallAfter.startJunctionId
		)!.point;
		expect(seamAfter).toEqual(RIM);
		expect(wallAfter.centerline).toEqual(wallBefore.centerline);

		const older = JSON.parse(json) as { formatVersion: number };
		older.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION - 1;
		const refused = validateWallFirstLayoutDocument(older);
		expect(refused.success).toBe(false);
		if (refused.success) return;
		expect(refused.issues.map((issue) => issue.code)).toContain('unsupported_format_version');
	});

	it('refuses non-canonical closed shapes at the codec', () => {
		const created = circleDocument();
		const line = structuredClone(created.document);
		line.walls[0]!.centerline = { kind: 'line' };
		expect(validateWallFirstLayoutDocument(line).success).toBe(false);

		const short = structuredClone(created.document) as unknown as {
			walls: { centerline: { kind: string; knots: unknown[]; spans: unknown[] } }[];
		};
		short.walls[0]!.centerline.knots.pop();
		short.walls[0]!.centerline.spans.pop();
		expect(validateWallFirstLayoutDocument(short).success).toBe(false);

		// Span count alone is not canonicality: a 16-span loop with one moved knot
		// or handle is not the approved symmetric circular chain.
		const offCircle = structuredClone(created.document);
		if (offCircle.walls[0]!.centerline.kind !== 'cubic-chain') throw new Error('expected cubic chain');
		offCircle.walls[0]!.centerline.knots[3]!.point[0] += 0.01;
		expect(validateWallFirstLayoutDocument(offCircle).success).toBe(false);

		const offHandle = structuredClone(created.document);
		if (offHandle.walls[0]!.centerline.kind !== 'cubic-chain') throw new Error('expected cubic chain');
		offHandle.walls[0]!.centerline.spans[7]!.handleOut[1] += 0.01;
		expect(validateWallFirstLayoutDocument(offHandle).success).toBe(false);
	});

	it('refuses connections, crossings and attachments on a closed Wall', () => {
		const created = circleDocument();
		const base = created.document;

		const connected = structuredClone(base);
		connected.junctions.push({ id: 'j-out', point: [8, 0] });
		connected.walls.push({
			id: 'wall-out',
			startJunctionId: 'j-circle',
			endJunctionId: 'j-out',
			thickness: 0.2,
			height: 3,
			centerline: { kind: 'line' }
		});
		const connectedIssue = validateWallFirstTopology(connected);
		expect(connectedIssue?.message).toContain('closed_wall_isolated');
		expect(connectedIssue?.message).toContain('seam Junction');

		const crossing = structuredClone(base);
		crossing.junctions.push({ id: 'j-a', point: [-10, 0] }, { id: 'j-b', point: [10, 0] });
		crossing.walls.push({
			id: 'wall-cross',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			thickness: 0.2,
			height: 3,
			centerline: { kind: 'line' }
		});
		const crossingIssue = validateWallFirstTopology(crossing);
		expect(crossingIssue?.message).toContain('closed_wall_isolated');

		const attached = structuredClone(base);
		attached.junctions.push({ id: 'j-touch', point: [5, 0] }, { id: 'j-out', point: [8, 0] });
		attached.walls.push({
			id: 'wall-touch',
			startJunctionId: 'j-touch',
			endJunctionId: 'j-out',
			thickness: 0.2,
			height: 3,
			centerline: { kind: 'line' }
		});
		const attachedIssue = validateWallFirstTopology(attached);
		expect(attachedIssue?.message).toContain('closed_wall_isolated');

		const birth = roomDocument();
		const split = planWallSplit(birth, 'wall-circle', Math.PI * RADIUS, allocator());
		expect(split.kind).toBe('rejected');
		const dissolve = planDissolveJunction(
			birth,
			'j-circle',
			mintLayoutIdCapture(() => 'dissolve-closed'),
			birth.floor.id
		);
		expect(dissolve.kind).toBe('rejected');
		if (dissolve.kind === 'rejected') {
			expect(dissolve.rejection.code).toBe('degenerate_wall_pair');
		}
	});
});

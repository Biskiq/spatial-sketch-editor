/**
 * T1 Wave 4 · C1 — Round Room source fact, seam anchoring, binary64
 * uncertainty-aware certification, and large-coordinate numerical falsifiers.
 */
import { describe, expect, it } from 'vitest';

import {
	CLOSED_WALL_CIRCLE_SPAN_COUNT,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	certifyRoundRoom,
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	hasBlockingLayoutIssues,
	mintLayoutIdCapture,
	parseWallFirstLayoutDocumentJson,
	planCreateCircularRoom,
	planCreateWallFirstOpening,
	planDuplicateIsolatedRoom,
	planDuplicateRoom,
	planResizeClosedWallRadius,
	planResizeRoundRoomRadius,
	planTranslateClosedWall,
	planWallChain,
	planWallFirstRoomMove,
	planWallFirstRoomRotation,
	planWallSplit,
	readClosedWallCircle,
	resolveJunctionGeometry,
	rotateBoundaryToSeam,
	roundRoomSeamJunctionId,
	serializeWallFirstLayoutDocument,
	subdivideWallCubicSpan,
	validateWallFirstLayoutDocument,
	wallCubicChain,
	wallFirstWallLength,
	type CompiledJunctionLeg,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';
import {
	LAYOUT_UNIT_FORMAT_VERSION,
	serializeProjectEnvelope,
	validateProjectEnvelope
} from '@portfolio/project-model/units';
import { createUnitProject } from '../authoring/__fixtures__/unit-envelope-fixtures';

const BIG_SHIFT: LayoutVec2 = [2 ** 32, -(2 ** 32)];

function createCircle(options: {
	center: LayoutVec2;
	rim: LayoutVec2;
	seed?: string;
	thickness?: number;
	height?: number;
}): LayoutDocumentWallFirst {
	const plan = planCreateCircularRoom({
		baseline: createEmptyWallFirstLayoutDocument(),
		center: options.center,
		rim: options.rim,
		thickness: options.thickness ?? 0.2,
		height: options.height ?? 3,
		capture: mintLayoutIdCapture(() => options.seed ?? 'c1-circle'),
		levelId: 'floor',
		roomNamePrefix: 'Rotunda'
	});
	if (plan.kind !== 'success') throw new Error(JSON.stringify(plan.rejection));
	return plan.document;
}

/** Build a valid 2-Wall open cubic ring by splitting an isolated circle at template span 8 t=0.35. */
function createTwoWallRoundRing(center: LayoutVec2, rim: LayoutVec2, reverseSecond = false): LayoutDocumentWallFirst {
	const base = createCircle({ center, rim, seed: 'c1-ring-fixture' });
	const wall = base.walls[0]!;
	if (wall.centerline.kind !== 'cubic-chain') throw new Error('expected cubic-chain');
	const seamPoint = base.junctions[0]!.point;
	const pts: LayoutVec2[] = [seamPoint, ...wall.centerline.knots.map((k) => k.point), seamPoint];
	const cutSpan = 8;
	const t = 0.35;
	const { left, right, point: cutPoint } = subdivideWallCubicSpan(
		wall.centerline.spans[cutSpan]!,
		pts[cutSpan]!,
		pts[cutSpan + 1]!,
		t
	);
	const wall1Knots = wall.centerline.knots.slice(0, cutSpan);
	const wall1Spans = [...wall.centerline.spans.slice(0, cutSpan), left];
	const wall2KnotsFwd = wall.centerline.knots.slice(cutSpan);
	const wall2SpansFwd = [right, ...wall.centerline.spans.slice(cutSpan + 1)];

	const seamId = wall.startJunctionId;
	const cutJunctionId = 'j-cut-1';
	const wall2Id = 'wall-arc-2';

	const wall1 = {
		...wall,
		startJunctionId: seamId,
		endJunctionId: cutJunctionId,
		centerline: wallCubicChain(wall1Knots, wall1Spans)
	};
	const wall2 = reverseSecond
		? {
				...wall,
				id: wall2Id,
				startJunctionId: seamId,
				endJunctionId: cutJunctionId,
				centerline: wallCubicChain(
					[...wall2KnotsFwd].reverse(),
					[...wall2SpansFwd].reverse().map((s) => ({ handleOut: s.handleIn, handleIn: s.handleOut }))
				)
			}
		: {
				...wall,
				id: wall2Id,
				startJunctionId: cutJunctionId,
				endJunctionId: seamId,
				centerline: wallCubicChain(wall2KnotsFwd, wall2SpansFwd)
			};

	return {
		...base,
		junctions: [...base.junctions, { id: cutJunctionId, point: cutPoint }],
		walls: [wall1, wall2],
		rooms: [
			{
				...base.rooms[0]!,
				boundary: [
					{ wallId: wall1.id, direction: 'forward' },
					{ wallId: wall2.id, direction: reverseSecond ? 'reverse' : 'forward' }
				]
			}
		]
	};
}

describe('C1 · Source, codec and seam contract', () => {
	it('round-trips isolated closed circles and open cubic rings (forward and reversed) with exact radius and anchored seam', async () => {
		const exactRadius = 5.123456789012345;
		const base = createCircle({ center: [1.5, -2.25], rim: [1.5 + exactRadius, -2.25] });
		const resized = planResizeClosedWallRadius({
			document: base,
			wallId: base.walls[0]!.id,
			radius: exactRadius
		});
		if (resized.kind !== 'success') throw new Error(JSON.stringify(resized.rejection));

		// Layout-level Save/Load round trip
		const json = serializeWallFirstLayoutDocument(resized.document);
		const parsed = parseWallFirstLayoutDocumentJson(json);
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.document.formatVersion).toBe(10);
		expect(parsed.document.rooms[0]!.round).toEqual({ center: [1.5, -2.25], radius: exactRadius });
		expect(parsed.canonicalJson).toBe(json);

		// F2 ProjectEnvelope Save/Load round trip
		const envelope = await createUnitProject({
			id: 'c1-round-project',
			name: 'C1 Round Project',
			layout: resized.document
		});
		expect(envelope.units.layout.header.formatVersion).toBe(LAYOUT_UNIT_FORMAT_VERSION);
		expect(envelope.units.layout.data.formatVersion).toBe(LAYOUT_WALL_FIRST_FORMAT_VERSION);
		const savedEnvelope = serializeProjectEnvelope(envelope);
		const reloaded = validateProjectEnvelope(JSON.parse(savedEnvelope));
		expect(reloaded.success).toBe(true);
		if (!reloaded.success) return;
		expect(serializeProjectEnvelope(reloaded.envelope)).toBe(savedEnvelope);
		expect(reloaded.envelope.units.layout.data.rooms[0]!.round!.radius).toBe(exactRadius);

		// Open cubic ring (forward and reversed member arcs)
		for (const reversed of [false, true]) {
			const ring = createTwoWallRoundRing([2, -3], [5, 1], reversed);
			const ringValidation = validateWallFirstLayoutDocument(ring);
			expect(ringValidation.success).toBe(true);
			if (!ringValidation.success) continue;
			const cert = certifyRoundRoom(ring, ring.rooms[0]!);
			expect(cert.kind).toBe('certified');
			if (cert.kind === 'certified') {
				expect(cert.certified.isIsolatedClosedWall).toBe(false);
				expect(cert.certified.seamJunctionId).toBe(ring.walls[0]!.startJunctionId);
				expect(cert.certified.radius).toBe(5);
			}
			// Identical released ring without `round` is an ordinary Room.
			const { round: _cleared, ...ordinaryRoom } = ring.rooms[0]!;
			const ordinaryDoc: LayoutDocumentWallFirst = { ...ring, rooms: [ordinaryRoom] };
			expect(validateWallFirstLayoutDocument(ordinaryDoc).success).toBe(true);
			expect(ordinaryDoc.rooms[0]!.round).toBeUndefined();
		}
	});

	it('rejects old format versions, header/data mismatches, missing isolated fact, bad values, virtual-edge Round and noncircular Rooms', async () => {
		const circle = createCircle({ center: [0, 0], rim: [5, 0] });

		// Format 9 and 8 rejected strictly
		for (const oldVersion of [9, 8, 7]) {
			const old = { ...circle, formatVersion: oldVersion };
			const res = validateWallFirstLayoutDocument(old);
			expect(res.success).toBe(false);
			if (!res.success) expect(res.issues[0]!.code).toBe('unsupported_format_version');
		}

		// F2 header/data mismatch rejected
		const project = await createUnitProject({ id: 'c1-mismatch', name: 'Mismatch', layout: circle });
		const headerOld = structuredClone(project) as unknown as {
			units: { layout: { header: { formatVersion: number }; data: { formatVersion: number } } };
		};
		headerOld.units.layout.header.formatVersion = 9;
		expect(validateProjectEnvelope(headerOld).success).toBe(false);

		const dataOld = structuredClone(project) as unknown as {
			units: { layout: { header: { formatVersion: number }; data: { formatVersion: number } } };
		};
		dataOld.units.layout.data.formatVersion = 9;
		expect(validateProjectEnvelope(dataOld).success).toBe(false);

		// Missing round fact on enclosed closed circle
		const { round: _omitted, ...roomWithoutRound } = circle.rooms[0]!;
		const missingFact = validateWallFirstLayoutDocument({ ...circle, rooms: [roomWithoutRound] });
		expect(missingFact.success).toBe(false);
		if (!missingFact.success) {
			expect(missingFact.issues.some((i) => i.code === 'missing_round_fact')).toBe(true);
		}

		// Bad round values
		for (const badRound of [
			{ center: [0, 0], radius: 0 },
			{ center: [0, 0], radius: -5 },
			{ center: [0, 0], radius: 0.05 }, // <= wall.thickness / 2
			{ center: [Number.NaN, 0], radius: 5 },
			{ center: [0, 0], radius: 5, extra: true }
		]) {
			const bad = {
				...circle,
				rooms: [{ ...circle.rooms[0]!, round: badRound }]
			};
			expect(validateWallFirstLayoutDocument(bad).success).toBe(false);
		}

		// False Round on a rectangular Room (non-cubic)
		const rect = planWallChain({
			baseline: createEmptyWallFirstLayoutDocument(),
			points: [[0, 0], [6, 0], [6, 4], [0, 4]],
			close: true,
			capture: mintLayoutIdCapture(() => 'c1-rect-fixture'),
			levelId: 'floor'
		});
		if (rect.kind !== 'success') throw new Error(JSON.stringify(rect.rejection));
		const rectWithRound = validateWallFirstLayoutDocument({
			...rect.document,
			rooms: [{ ...rect.document.rooms[0]!, round: { center: [3, 2], radius: 3 } }]
		});
		expect(rectWithRound.success).toBe(false);
		if (!rectWithRound.success) {
			expect(rectWithRound.issues.some((i) => i.code === 'round_room_non_cubic')).toBe(true);
		}

		// Round on a virtual-edge open Space
		const ring = createTwoWallRoundRing([0, 0], [5, 0]);
		const withVirtual = validateWallFirstLayoutDocument({
			...ring,
			rooms: [
				{
					...ring.rooms[0]!,
					boundary: [ring.rooms[0]!.boundary[0]!],
					virtualEdges: [
						{
							startJunctionId: ring.walls[0]!.endJunctionId,
							endJunctionId: ring.walls[0]!.startJunctionId
						}
					]
				}
			]
		});
		expect(withVirtual.success).toBe(false);
		if (!withVirtual.success) {
			expect(withVirtual.issues.some((i) => i.code === 'round_room_virtual_edges')).toBe(true);
		}
	});

	it('anchors the seam in boundary order and rotates cleanly without changing winding', () => {
		const ring = createTwoWallRoundRing([0, 0], [5, 0]);
		const wallById = new Map(ring.walls.map((w) => [w.id, w] as const));
		const seamId = roundRoomSeamJunctionId(ring.rooms[0]!, wallById);
		expect(seamId).toBe(ring.walls[0]!.startJunctionId);

		// Rotating a shifted boundary back to the captured seam restores exact order.
		const shifted = [ring.rooms[0]!.boundary[1]!, ring.rooms[0]!.boundary[0]!];
		expect(rotateBoundaryToSeam(shifted, seamId!, wallById)).toEqual(ring.rooms[0]!.boundary);
		expect(rotateBoundaryToSeam(shifted, 'j-missing', wallById)).toBeNull();
	});

	it('preserves identity, exact radius and seam through move, rotate, isolated copy and enclosure copy', () => {
		const exactRadius = 4.375;
		const base = createCircle({ center: [1, 2], rim: [1 + exactRadius, 2], seed: 'c1-ops-fixture' });
		const wallId = base.walls[0]!.id;
		const roomId = base.rooms[0]!.id;
		const seamId = base.walls[0]!.startJunctionId;

		// Room move
		const moved = planWallFirstRoomMove(base, roomId, [10, -4]);
		expect(moved.kind).toBe('success');
		if (moved.kind !== 'success') return;
		expect(moved.document.rooms[0]!.id).toBe(roomId);
		expect(moved.document.rooms[0]!.round).toEqual({ center: [11, -2], radius: exactRadius });
		expect(readClosedWallCircle(moved.document, wallId)!.radius).toBe(exactRadius);

		// Room rotate
		const rotated = planWallFirstRoomRotation(moved.document, roomId, [11, -2], Math.PI / 3);
		expect(rotated.kind).toBe('success');
		if (rotated.kind !== 'success') return;
		expect(rotated.document.rooms[0]!.id).toBe(roomId);
		expect(rotated.document.rooms[0]!.round!.radius).toBe(exactRadius);
		expect(rotated.document.walls[0]!.startJunctionId).toBe(seamId);

		// Isolated copy (A4) and enclosure copy (A5)
		for (const copyFn of [planDuplicateIsolatedRoom, planDuplicateRoom]) {
			const copied = copyFn(
				moved.document,
				{ roomId, delta: [15, 0] },
				mintLayoutIdCapture(() => `c1-copy-${copyFn.name}`),
				'floor'
			);
			expect(copied.kind).toBe('success');
			if (copied.kind !== 'success') continue;
			expect(copied.document.rooms).toHaveLength(2);
			const sourceRoom = copied.document.rooms.find((r) => r.id === roomId)!;
			const copyRoom = copied.document.rooms.find((r) => r.id === copied.createdRoomId)!;
			expect(sourceRoom.round).toEqual({ center: [11, -2], radius: exactRadius });
			expect(copyRoom.round).toEqual({ center: [26, -2], radius: exactRadius });
			expect(copyRoom.boundary[0]!.wallId).not.toBe(wallId);
			expect(validateWallFirstLayoutDocument(copied.document).success).toBe(true);
		}
	});
});

describe('C1 · Translation and numerical consistency falsifiers', () => {
	it('passes 20+ repeated radius and origin↔[2**32, -(2**32)] translation cycles with Save/Load and zero drift accumulation', () => {
		// Use a non-axis seam direction (3, 4) so both X and Z coordinates round at 2**32.
		let originDoc = createCircle({ center: [0, 0], rim: [3, 4], seed: 'c1-num-origin' });
		const wallId = originDoc.walls[0]!.id;
		const roomId = originDoc.rooms[0]!.id;
		const seamId = originDoc.walls[0]!.startJunctionId;
		const origLen = wallFirstWallLength(originDoc, wallId)!;
		const openingPlan = planCreateWallFirstOpening(
			originDoc,
			{ wallId, kind: 'window', offset: origLen * 0.25, width: 1.2, height: 1.2, sillHeight: 1 },
			mintLayoutIdCapture(() => 'c1-num-opening'),
			'floor'
		);
		if (openingPlan.kind !== 'success') throw new Error(JSON.stringify(openingPlan.rejection));
		originDoc = openingPlan.document;
		const openingId = originDoc.openings[0]!.id;

		// Translate out to [2**32, -(2**32)] where 1 ULP = 2^-20 ≈ 9.54e-7 m > old 5 nm tolerance.
		let current = originDoc;
		const radii = [5, 7.123456789012345, 4.25, 6.5, 5];

		for (let iter = 0; iter < 20; iter += 1) {
			const nextRadius = radii[iter % radii.length]!;
			// 1. Move out to [2**32, -(2**32)]
			const outMove = planTranslateClosedWall({ document: current, wallId, delta: BIG_SHIFT });
			expect(outMove.kind, `iter ${iter} out move`).toBe('success');
			if (outMove.kind !== 'success') return;

			// Save/Load at large coordinates
			const outJson = serializeWallFirstLayoutDocument(outMove.document);
			const outLoaded = parseWallFirstLayoutDocumentJson(outJson);
			expect(outLoaded.success, `iter ${iter} out reload`).toBe(true);
			if (!outLoaded.success) return;
			expect(outLoaded.canonicalJson).toBe(outJson);
			expect(outLoaded.document.rooms[0]!.round!.center).toEqual(BIG_SHIFT);

			// 2. Resize at large coordinates
			const resized = planResizeClosedWallRadius({
				document: outLoaded.document,
				wallId,
				radius: nextRadius
			});
			expect(resized.kind, `iter ${iter} resize at large coords: ${resized.kind === 'rejected' ? JSON.stringify(resized.rejection) : ''}`).toBe('success');
			if (resized.kind !== 'success') return;
			expect(resized.document.rooms[0]!.round!.radius).toBe(nextRadius);

			// 3. Move high → low back to [0, 0]
			const backMove = planTranslateClosedWall({
				document: resized.document,
				wallId,
				delta: [-BIG_SHIFT[0], -BIG_SHIFT[1]]
			});
			expect(backMove.kind, `iter ${iter} back move`).toBe('success');
			if (backMove.kind !== 'success') return;

			// Save/Load back at origin
			const backJson = serializeWallFirstLayoutDocument(backMove.document);
			const backLoaded = parseWallFirstLayoutDocumentJson(backJson);
			expect(backLoaded.success, `iter ${iter} back reload`).toBe(true);
			if (!backLoaded.success) return;
			expect(backLoaded.canonicalJson).toBe(backJson);

			current = backLoaded.document;
			expect(current.rooms[0]!.id).toBe(roomId);
			expect(current.walls[0]!.startJunctionId).toBe(seamId);
			expect(current.rooms[0]!.round).toEqual({ center: [0, 0], radius: nextRadius });
			expect(current.openings[0]!.id).toBe(openingId);
			const curLen = wallFirstWallLength(current, wallId)!;
			expect(current.openings[0]!.offset / curLen).toBeCloseTo(0.25, 10);
		}

		// Final resize back to 5 and compare compiled geometry and radial error against untranslated counterpart.
		const finalResize = planResizeClosedWallRadius({ document: current, wallId, radius: 5 });
		expect(finalResize.kind).toBe('success');
		if (finalResize.kind !== 'success') return;
		const finalDoc = finalResize.document;
		expect(finalDoc.rooms[0]!.round).toEqual({ center: [0, 0], radius: 5 });
		expect(hasBlockingLayoutIssues(compileWallFirstLayoutGeometry(finalDoc).issues)).toBe(false);

		// Every knot must lie within binary64 origin precision of radius 5 (no carried 2**32 rounding error).
		const chain = finalDoc.walls[0]!.centerline;
		expect(chain.kind).toBe('cubic-chain');
		if (chain.kind !== 'cubic-chain') return;
		expect(chain.spans).toHaveLength(CLOSED_WALL_CIRCLE_SPAN_COUNT);
		for (const knot of chain.knots) {
			const r = Math.hypot(knot.point[0], knot.point[1]);
			expect(Math.abs(r - 5)).toBeLessThan(1e-13);
		}
	});

	it('rejects perturbed controls outside propagated bounds at both origin and [2**32, -(2**32)]', () => {
		const originDoc = createCircle({ center: [0, 0], rim: [5, 0], seed: 'c1-perturb-origin' });
		const bigDocPlan = planTranslateClosedWall({
			document: originDoc,
			wallId: originDoc.walls[0]!.id,
			delta: BIG_SHIFT
		});
		if (bigDocPlan.kind !== 'success') throw new Error(JSON.stringify(bigDocPlan.rejection));
		const bigDoc = bigDocPlan.document;

		// At origin, even a 1e-11 m perturbation is far outside binary64 ULP (~8.88e-16 m).
		const originPerturbed = structuredClone(originDoc);
		if (originPerturbed.walls[0]!.centerline.kind !== 'cubic-chain') throw new Error('expected cubic-chain');
		originPerturbed.walls[0]!.centerline.spans[4]!.handleOut[0] += 1e-11;
		const originRes = validateWallFirstLayoutDocument(originPerturbed);
		expect(originRes.success).toBe(false);
		if (!originRes.success) expect(originRes.issues[0]!.code).toBe('round_geometry_invalid');

		// At [2**32, -(2**32)], ULP ≈ 9.54e-7 m; a 1e-5 m perturbation is outside the propagated bound.
		const bigPerturbed = structuredClone(bigDoc);
		if (bigPerturbed.walls[0]!.centerline.kind !== 'cubic-chain') throw new Error('expected cubic-chain');
		bigPerturbed.walls[0]!.centerline.spans[4]!.handleIn[1] += 1e-5;
		const bigRes = validateWallFirstLayoutDocument(bigPerturbed);
		expect(bigRes.success).toBe(false);
		if (!bigRes.success) expect(bigRes.issues[0]!.code).toBe('round_geometry_invalid');
	});

	it('requires both sides of the seam to agree on one phase', () => {
		const center: LayoutVec2 = [2 ** 32 + 1024, 2 ** 32 + 1024];
		const circle = createCircle({ center, rim: [center[0] + 5, center[1]] });
		const chain = circle.walls[0]!.centerline;
		if (chain.kind !== 'cubic-chain') throw new Error('expected cubic-chain');

		// Each shifted handle fits the loose enclosure on its own. One needs a
		// positive phase and the other needs a negative one for the same seam ray.
		const twoUlps = 2 ** -19;
		chain.spans[0]!.handleOut[1] -= twoUlps;
		chain.spans.at(-1)!.handleIn[1] += twoUlps;
		const result = certifyRoundRoom(circle, circle.rooms[0]!);
		expect(result.kind).toBe('invalid');
	});

	it('requires both cubic subspans to use the station certified by their shared cut', () => {
		const ring = createTwoWallRoundRing([0, 0], [5, 0]);
		expect(certifyRoundRoom(ring, ring.rooms[0]!).kind).toBe('certified');
		const chain = ring.walls[0]!.centerline;
		if (chain.kind !== 'cubic-chain') throw new Error('expected cubic-chain');
		// Smaller than the initial polar inversion bracket, but far larger than
		// the coordinate uncertainty of the measured cut and unchanged controls.
		chain.spans.at(-1)!.handleIn[1] += 2e-13;
		expect(certifyRoundRoom(ring, ring.rooms[0]!).kind).toBe('invalid');
	});

	it('rejects a candidate whose distinct cuts collapse at destination precision without mutating source', () => {
		// Create a ring with two cuts separated by 1e-7 m in span 8: valid at origin,
		// collapses to the same world coordinate at [2**32, -(2**32)] where ULP ≈ 9.54e-7 m.
		const base = createCircle({ center: BIG_SHIFT, rim: [BIG_SHIFT[0] + 5, BIG_SHIFT[1]], seed: 'c1-collapse' });
		const wall = base.walls[0]!;
		if (wall.centerline.kind !== 'cubic-chain') throw new Error('expected cubic-chain');
		const seamPoint = base.junctions[0]!.point;
		const pts: LayoutVec2[] = [seamPoint, ...wall.centerline.knots.map((k) => k.point), seamPoint];
		const cutSpan = 8;
		const firstSplit = subdivideWallCubicSpan(
			wall.centerline.spans[cutSpan]!,
			pts[cutSpan]!,
			pts[cutSpan + 1]!,
			0.5
		);
		const tinySplit = subdivideWallCubicSpan(
			firstSplit.right,
			firstSplit.point,
			pts[cutSpan + 1]!,
			1e-9
		);
		const collapsedRing: LayoutDocumentWallFirst = {
			...base,
			junctions: [
				...base.junctions,
				{ id: 'j-cut-a', point: firstSplit.point },
				{ id: 'j-cut-b', point: tinySplit.point }
			],
			walls: [
				{
					...wall,
					endJunctionId: 'j-cut-a',
					centerline: wallCubicChain(
						wall.centerline.knots.slice(0, cutSpan),
						[...wall.centerline.spans.slice(0, cutSpan), firstSplit.left]
					)
				},
				{
					...wall,
					id: 'wall-tiny',
					startJunctionId: 'j-cut-a',
					endJunctionId: 'j-cut-b',
					centerline: wallCubicChain([], [tinySplit.left])
				},
				{
					...wall,
					id: 'wall-rest',
					startJunctionId: 'j-cut-b',
					endJunctionId: wall.startJunctionId,
					centerline: wallCubicChain(
						wall.centerline.knots.slice(cutSpan),
						[tinySplit.right, ...wall.centerline.spans.slice(cutSpan + 1)]
					)
				}
			],
			rooms: [
				{
					...base.rooms[0]!,
					boundary: [
						{ wallId: wall.id, direction: 'forward' },
						{ wallId: 'wall-tiny', direction: 'forward' },
						{ wallId: 'wall-rest', direction: 'forward' }
					]
				}
			]
		};
		const res = validateWallFirstLayoutDocument(collapsedRing);
		expect(res.success).toBe(false);
		if (!res.success) {
			expect(res.issues[0]!.code).toBe('round_geometry_invalid');
		}
	});

	it('preserves resolvable corner classification under translation and never misclassifies corners as straight continuations at extreme coordinates', () => {
		const buildCornerDoc = (origin: readonly [number, number], interiorDegrees: number): LayoutDocumentWallFirst => {
			const rad = (interiorDegrees * Math.PI) / 180;
			const len = 5;
			const base = createEmptyWallFirstLayoutDocument();
			return {
				...base,
				junctions: [
					{ id: 'j-start', point: [origin[0] - len, origin[1]] },
					{ id: 'j-corner', point: [origin[0], origin[1]] },
					{ id: 'j-end', point: [origin[0] + len * Math.cos(Math.PI - rad), origin[1] + len * Math.sin(Math.PI - rad)] }
				],
				walls: [
					{
						id: 'w-a',
						startJunctionId: 'j-start',
						endJunctionId: 'j-corner',
						thickness: 0.2,
						height: 3,
						centerline: { kind: 'line' }
					},
					{
						id: 'w-b',
						startJunctionId: 'j-corner',
						endJunctionId: 'j-end',
						thickness: 0.2,
						height: 3,
						centerline: { kind: 'line' }
					}
				]
			};
		};

		const positiveShift: LayoutVec2 = [2 ** 32, 2 ** 32];
		const tinyBend = buildCornerDoc(positiveShift, 179.9995);
		expect((tinyBend.junctions[2]!.point[1] - positiveShift[1]) * 2 ** 20).toBe(46);
		for (const angleDeg of [45, 90, 135, 179, 179.9, 179.9995]) {
			const atOrigin = compileWallFirstLayoutGeometry(buildCornerDoc([0, 0], angleDeg));
			expect(hasBlockingLayoutIssues(atOrigin.issues), `origin ${angleDeg}°`).toBe(false);
			const jOrigin = atOrigin.geometry.junctions!.find((j) => j.junctionId === 'j-corner')!;
			expect(jOrigin.resolution.joins.map((j) => j.kind)).toEqual(['miter', 'miter']);
			for (const shift of [[BIG_SHIFT[0], 0], BIG_SHIFT, positiveShift] as const) {
				const translated = compileWallFirstLayoutGeometry(buildCornerDoc(shift, angleDeg));
				expect(hasBlockingLayoutIssues(translated.issues), `${shift} ${angleDeg}°`).toBe(false);
				const junction = translated.geometry.junctions!.find((j) => j.junctionId === 'j-corner')!;
				expect(junction.resolution.joins.map((j) => j.kind), `${shift} ${angleDeg}°`).toEqual(['miter', 'miter']);
				expect(junction.resolution.joins.every((j) => !j.interfaceSuppressed)).toBe(true);
			}
		}
		for (const origin of [[0, 0], BIG_SHIFT] as const) {
			const continuation = buildCornerDoc(origin, 180);
			const [x, z] = origin;
			continuation.junctions[0]!.point = [x - 5 * Math.cos(0.55), z - 5 * Math.sin(0.55)];
			continuation.junctions[2]!.point = [x + 3 * Math.cos(0.55), z + 3 * Math.sin(0.55)];
			const compiled = compileWallFirstLayoutGeometry(continuation);
			expect(compiled.issues, `${origin} true continuation`).toEqual([]);
			const junction = compiled.geometry.junctions!.find((j) => j.junctionId === 'j-corner')!;
			expect(junction.resolution.joins.map((j) => j.kind)).toEqual(['suppressed', 'suppressed']);
		}

		// Direct resolver check at extreme offsets (2**44 and 2**50) and near-origin tiny bend (1e-5 rad):
		// real corners must NEVER be classified as straight continuations.
		const makeLeg = (wallId: string, end: 'start' | 'end', angle: number): CompiledJunctionLeg => {
			const tx = Math.cos(angle);
			const tz = Math.sin(angle);
			return {
				wallId,
				end,
				tangentOut: [tx, tz],
				normalOut: [-tz, tx],
				outwardAngle: angle,
				thickness: 0.2,
				halfThickness: 0.1,
				bottomY: 0,
				topY: 3,
				role: 'free-standing',
				endpointOpen: false,
				endpointSolidBands: [{ bottomY: 0, topY: 3, solid: true }]
			};
		};
		for (const extremePoint of [
			[2 ** 44, -(2 ** 44)] as LayoutVec2,
			[2 ** 50, -(2 ** 50)] as LayoutVec2
		]) {
			for (const turnRad of [Math.PI / 2, (5 * Math.PI) / 180, (0.5 * Math.PI) / 180]) {
				const resolved = resolveJunctionGeometry('j-extreme', extremePoint, [
					makeLeg('w-a', 'end', Math.PI),
					makeLeg('w-b', 'start', turnRad)
				]);
				expect(resolved.resolution.joins.every((j) => j.kind !== 'suppressed')).toBe(true);
				expect(resolved.resolution.joins.every((j) => !j.interfaceSuppressed)).toBe(true);
			}
		}

		// Near-origin preservation: a 1e-5 rad bend at [0, 0] stays a corner, not a continuation.
		const nearOriginTiny = resolveJunctionGeometry('j-origin', [0, 0], [
			makeLeg('w-a', 'end', Math.PI),
			makeLeg('w-b', 'start', 1e-5)
		]);
		expect(nearOriginTiny.resolution.joins.every((j) => j.kind === 'miter')).toBe(true);
		expect(nearOriginTiny.resolution.joins.every((j) => !j.interfaceSuppressed)).toBe(true);
	});
});

describe('C3 · non-axis ring translation and copy', () => {
	it('preserves a non-axis ring through repeated radius and world-translation cycles with reloads', () => {
		let current = createTwoWallRoundRing([0, 0], [3, 4], true);
		const roomId = current.rooms[0]!.id;
		const seam = current.walls[0]!.startJunctionId;
		const wallIds = current.rooms[0]!.boundary.map((ref) => ref.wallId);
		const opening = planCreateWallFirstOpening(current, { wallId: wallIds[0]!, kind: 'window', offset: 1, width: 0.5 }, mintLayoutIdCapture(() => 'c3-phase-window'), current.floor.id);
		if (opening.kind !== 'success') throw new Error(JSON.stringify(opening));
		current = opening.document;
		const reload = (doc: LayoutDocumentWallFirst) => {
			const json = serializeWallFirstLayoutDocument(doc);
			const parsed = parseWallFirstLayoutDocumentJson(json);
			if (!parsed.success) throw new Error(JSON.stringify(parsed.issues));
			expect(parsed.canonicalJson).toBe(json);
			return parsed.document;
		};
		for (let i = 0; i < 20; i++) {
			const radius = i % 2 ? 4.25 : 6.25;
			const resize = planResizeRoundRoomRadius({ document: current, roomId, radius });
			if (resize.kind !== 'success') throw new Error(JSON.stringify(resize));
			current = reload(resize.document);
			const outward = planWallFirstRoomMove(current, roomId, BIG_SHIFT);
			if (outward.kind !== 'success') throw new Error(JSON.stringify(outward));
			const high = reload(outward.document);
			expect(high.rooms[0]!.round).toEqual({ center: BIG_SHIFT, radius });
			const copy = planDuplicateRoom(high, { roomId, delta: [-BIG_SHIFT[0] + 25, -BIG_SHIFT[1]] }, mintLayoutIdCapture(() => `c3-phase-copy-${i}`), high.floor.id);
			if (copy.kind !== 'success') throw new Error(JSON.stringify(copy));
			expect(copy.document.rooms.find((room) => room.id === copy.createdRoomId)!.round).toEqual({ center: [25, 0], radius });
			const back = planWallFirstRoomMove(high, roomId, [-BIG_SHIFT[0], -BIG_SHIFT[1]]);
			if (back.kind !== 'success') throw new Error(JSON.stringify(back));
			current = reload(back.document);
			expect(current.rooms[0]!.round).toEqual({ center: [0, 0], radius });
			expect(current.rooms[0]!.boundary.map((ref) => ref.wallId)).toEqual(wallIds);
			expect(roundRoomSeamJunctionId(current.rooms[0]!, new Map(current.walls.map((wall) => [wall.id, wall])))).toBe(seam);
			expect(current.openings[0]!.offset).toBeCloseTo(radius / 5, 8);
		}
	}, 120000);
});

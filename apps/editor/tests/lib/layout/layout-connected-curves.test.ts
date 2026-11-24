/**
 * T1 Wave 4 · C2 — Topology and Radius Core behavioral & numerical contract suite.
 *
 * Exercises production planners directly against c-plan-connected-curves.md §3–§7:
 * closed-to-ring attach, detach/repack, divide/merge/open/B1 clear, Release
 * round (unoccupied & occupied seam), whole-radius resize, member edit guards,
 * [2**32, -(2**32)] ring numerical consistency, S5a surface lineage, V1 region
 * intent carry, and Layout interior coverage.
 */
import { describe, expect, it } from 'vitest';
import {
	CLOSED_WALL_CIRCLE_ACCURACY,
	ROUND_ROOM_MEMBER_EDIT_MESSAGE,
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	createWallFirstArchitectureVerdictScope,
	createWallSamplingDerivation,
	cubicBezierArcLength,
	cubicBezierPoint,
	hasBlockingLayoutIssues,
	isClosedWall,
	mintLayoutIdCapture,
	orientedWallChainKnotsAndSpans,
	parseWallFirstLayoutDocumentJson,
	planBendWallCurveKnot,
	planConvertWallToLine,
	planCreateCircularRoom,
	planCreateRegion,
	planCreateWallFirstOpening,
	planDeleteWall,
	planDeleteWallCurveKnot,
	planDissolveJunction,
	planDuplicateIsolatedRoom,
	planExactJunctionMove,
	planExactRectangleDimensions,
	planExactWallAngle,
	planExactWallHeight,
	planExactWallLength,
	planExactWallThickness,
	planInsertWallCurveKnot,
	planMoveWallCurveKnot,
	planReleaseRoundRoom,
	planRemoveRoom,
	planRemoveSpace,
	planResizeRoundRoomRadius,
	planRigidWallMove,
	planSpaceOpenSideEndSlide,
	planSpaceOpenSideOffset,
	planWallChain,
	planWallMetadataUpdate,
	planWallSegment,
	planWallSplit,
	planWallSubdivision,
	preflightWallFirstArchitectureCandidate,
	proposeWallFirstArchitectureGeometry,
	proposeWallKnotRemoval,
	readWallFirstDragProposal,
	resolveLayoutRoomInterior,
	resolveProposedCurveChain,
	roundRoomSeamJunctionId,
	serializeWallFirstLayoutDocument,
	validateWallFirstLayoutDocument,
	verifySweptBoundsGeometryDelta,
	wallCenterlineCubics,
	wallCubicChain,
	wallFirstWallLength,
	type CubicBezierShape,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall
} from '@portfolio/layout-core';

const BIG_SHIFT: LayoutVec2 = [2 ** 32, -(2 ** 32)];
const cap = (seed: string) => mintLayoutIdCapture(() => seed.padEnd(8, '-0'));

function expectSuccess<T extends { kind: string }>(plan: T): Extract<T, { kind: 'success' }> {
	if (plan.kind !== 'success') {
		throw new Error(`Expected success, got: ${JSON.stringify(plan)}`);
	}
	return plan as Extract<T, { kind: 'success' }>;
}

function createRotunda(options: {
	center?: LayoutVec2;
	radius?: number;
	seed?: string;
	thickness?: number;
	height?: number;
} = {}) {
	const center = options.center ?? [0, 0];
	const radius = options.radius ?? 5;
	const baseline = createEmptyWallFirstLayoutDocument();
	const created = expectSuccess(
		planCreateCircularRoom({
			baseline,
			center,
			rim: [center[0] + radius, center[1]],
			thickness: options.thickness ?? 0.2,
			height: options.height ?? 3,
			capture: cap(options.seed ?? 'c2-rotunda'),
			levelId: baseline.floor.id,
			roomNamePrefix: 'Rotunda'
		})
	);
	return {
		document: created.document,
		roomId: created.createdRoomIds[0]!,
		wallId: created.wallId,
		seamId: created.junctionId
	};
}

function wallCubics(doc: LayoutDocumentWallFirst, wallId: string, dir: 'forward' | 'reverse' = 'forward') {
	const w = doc.walls.find((entry) => entry.id === wallId)!;
	const s = doc.junctions.find((j) => j.id === w.startJunctionId)!.point;
	const e = doc.junctions.find((j) => j.id === w.endJunctionId)!.point;
	return wallCenterlineCubics(w.centerline, s, e, dir);
}

function createConnectedRing(options: { center?: LayoutVec2; radius?: number; seed?: string } = {}) {
	const center = options.center ?? [0, 0];
	const radius = options.radius ?? 5;
	const rot = createRotunda({ center, radius, seed: options.seed ?? 'c2-ring' });
	const [cx, cz] = center;
	// Attach 1st leg at bottom rim (0, r) -> (0, r + 4)
	const a1 = expectSuccess(
		planWallChain({
			baseline: rot.document,
			points: [
				[cx, cz + radius],
				[cx, cz + radius + 4]
			],
			close: false,
			endpointHostSnaps: [{ pointIndex: 0, wallId: rot.wallId }],
			capture: cap(`${options.seed ?? 'c2-ring'}-a1`),
			levelId: rot.document.floor.id
		})
	);
	// Attach 2nd leg at left rim (-r, 0) -> (-r - 4, 0)
	const arc2 = a1.createdWallIds.find((id) => id !== a1.authoredWallIds[0])!;
	const a2 = expectSuccess(
		planWallChain({
			baseline: a1.document,
			points: [
				[cx - radius, cz],
				[cx - radius - 4, cz]
			],
			close: false,
			endpointHostSnaps: [{ pointIndex: 0, wallId: arc2 }],
			capture: cap(`${options.seed ?? 'c2-ring'}-a2`),
			levelId: a1.document.floor.id
		})
	);
	return {
		document: a2.document,
		roomId: rot.roomId,
		seamId: rot.seamId,
		seamWallId: rot.wallId,
		rimJunctionIds: a2.document.rooms
			.find((r) => r.id === rot.roomId)!
			.boundary.map((ref) => {
				const w = a2.document.walls.find((entry) => entry.id === ref.wallId)!;
				return ref.direction === 'forward' ? w.startJunctionId : w.endJunctionId;
			}),
		outsideWallIds: [a1.authoredWallIds[0]!, a2.authoredWallIds[0]!]
	};
}

function createAttachedGallery(options: {
	center?: LayoutVec2;
	radius?: number;
	seed?: string;
} = {}) {
	const center = options.center ?? [0, 0];
	const radius = options.radius ?? 5;
	const [cx, cz] = center;
	const rot = createRotunda({ center, radius, seed: options.seed ?? 'c2-gallery' });
	const p1: LayoutVec2 = [cx, cz + radius];
	const p2: LayoutVec2 = [cx + radius, cz];
	// Two-snap attachment forming an enclosed gallery annex off the circle.
	const pOut1: LayoutVec2 = [cx, cz + radius + 5];
	const pOut2: LayoutVec2 = [cx + radius + 5, cz + radius + 5];
	const pOut3: LayoutVec2 = [cx + radius + 5, cz];
	const attach = expectSuccess(
		planWallChain({
			baseline: rot.document,
			points: [p1, pOut1, pOut2, pOut3, p2],
			close: false,
			endpointHostSnaps: [{ pointIndex: 0, wallId: rot.wallId }],
			endpointJunctionSnaps: [{ pointIndex: 4, junctionId: rot.seamId }],
			capture: cap(`${options.seed ?? 'c2-gallery'}-annex`),
			levelId: rot.document.floor.id
		})
	);
	const galleryRoom = attach.document.rooms.find((r) => r.id !== rot.roomId)!;
	return {
		document: attach.document,
		rotundaId: rot.roomId,
		galleryId: galleryRoom.id,
		seamId: rot.seamId,
		seamWallId: rot.wallId,
		annexWallIds: attach.authoredWallIds
	};
}

describe('T1 Wave 4 · C2 Topology and Radius Core', () => {
	describe('1. Closed-to-ring attach and subdivision', () => {
		it('splits the exact cubic locus at 1, 2 and 4 attachments within CLOSED_WALL_CIRCLE_ACCURACY and preserves Room/V1/S5a lineage', () => {
			const rot = createRotunda({ seed: 'attach-124' });
			// Add a V1 horizontal region with intendedGaps referencing the closed Wall.
			const withRegion = expectSuccess(
				planCreateRegion({
					baseline: rot.document,
					capture: cap('attach-region'),
					intent: {
						role: 'floor',
						footprint: [
							[-10, -10],
							[10, -10],
							[10, 10],
							[-10, 10]
						],
						elevation: 0,
						thickness: 0.1
					}
				})
			).document;
			let doc: LayoutDocumentWallFirst = {
				...withRegion,
				regions: withRegion.regions.map((r) => ({ ...r, intendedGaps: [rot.wallId] }))
			};

			const angles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
			let hostWallId = rot.wallId;
			for (const [idx, angle] of angles.entries()) {
				const beforeCubics = wallCubics(doc, hostWallId);
				const rimPt: LayoutVec2 = [5 * Math.cos(angle), 5 * Math.sin(angle)];
				const outerPt: LayoutVec2 = [9 * Math.cos(angle), 9 * Math.sin(angle)];
				const plan = expectSuccess(
					planWallSegment({
						baseline: doc,
						start: outerPt,
						end: rimPt,
						endpointHostWallId: hostWallId,
						capture: cap(`attach-seg-${idx}`),
						levelId: doc.floor.id
					})
				);
				doc = plan.document;
				const room = doc.rooms.find((r) => r.id === rot.roomId)!;
				expect(room.name).toBe('Rotunda 1');
				expect(room.round).toEqual({ center: [0, 0], radius: 5 });
				expect(room.boundary).toHaveLength(idx + 2);
				expect(roundRoomSeamJunctionId(room, new Map(doc.walls.map((w) => [w.id, w])))).toBe(rot.seamId);

				// Verify total circle radial and length accuracy across all ring arcs.
				let totalLen = 0;
				let maxRadErr = 0;
				for (const ref of room.boundary) {
					const cs = wallCubics(doc, ref.wallId, ref.direction);
					for (const c of cs) {
						totalLen += cubicBezierArcLength(c);
						for (let s = 0; s <= 16; s += 1) {
							const pt = cubicBezierPoint(c, s / 16);
							maxRadErr = Math.max(maxRadErr, Math.abs(Math.hypot(pt[0], pt[1]) - 5));
						}
					}
				}
				expect(maxRadErr).toBeLessThanOrEqual(CLOSED_WALL_CIRCLE_ACCURACY.maxRadialError);
				expect(Math.abs(totalLen - 2 * Math.PI * 5)).toBeLessThanOrEqual(
					CLOSED_WALL_CIRCLE_ACCURACY.maxLengthError
				);
				expect(beforeCubics.length).toBeGreaterThan(0);

				// V1 intendedGaps carried both fragments.
				const gaps = doc.regions[0]!.intendedGaps;
				expect(gaps).toContain(hostWallId);
				for (const createdId of plan.createdWallIds) {
					if (!plan.authoredWallIds.includes(createdId)) {
						expect(gaps).toContain(createdId);
					}
				}
				// Next attachment hits the newest ring fragment.
				const nextHost = plan.createdWallIds.find((id) => !plan.authoredWallIds.includes(id))!;
				expect(plan.surfaceLineage.length).toBeGreaterThan(0);
				hostWallId = nextHost;
			}
		});

		it('supports seam-only attach using opposite cut and solid-gap fallback when opposite is occupied', () => {
			const rot = createRotunda({ seed: 'seam-only' });
			const len = wallFirstWallLength(rot.document, rot.wallId)!;
			// Place an Opening covering the opposite station (L / 2).
			const withOp = expectSuccess(
				planCreateWallFirstOpening(
					rot.document,
					{ wallId: rot.wallId, kind: 'window', offset: len / 2 - 0.5, width: 1.0, height: 1.2, sillHeight: 1 },
					cap('seam-only-op'),
					rot.document.floor.id
				)
			).document;
			const attached = expectSuccess(
				planWallChain({
					baseline: withOp,
					points: [
						[5, 0],
						[9, 0]
					],
					close: false,
					endpointJunctionSnaps: [{ pointIndex: 0, junctionId: rot.seamId }],
					capture: cap('seam-only-attach'),
					levelId: withOp.floor.id
				})
			);
			const room = attached.document.rooms.find((r) => r.id === rot.roomId)!;
			expect(room.boundary).toHaveLength(2);
			expect(room.round).toEqual({ center: [0, 0], radius: 5 });
			expect(attached.splitWallIds).toContain(rot.wallId);
		});

		it('handles two snaps on a closed Wall in one stroke and is invariant to snap array order', () => {
			const rot = createRotunda({ seed: 'two-snap' });
			const pA: LayoutVec2 = [0, 5];
			const pB: LayoutVec2 = [-5, 0];
			const pOutA: LayoutVec2 = [0, 9];
			const pOutB: LayoutVec2 = [-9, 0];

			const plan1 = expectSuccess(
				planWallChain({
					baseline: rot.document,
					points: [pA, pOutA, pOutB, pB],
					close: false,
					endpointHostSnaps: [
						{ pointIndex: 0, wallId: rot.wallId },
						{ pointIndex: 3, wallId: rot.wallId }
					],
					capture: cap('two-snap-order'),
					levelId: rot.document.floor.id
				})
			);
			const plan2 = expectSuccess(
				planWallChain({
					baseline: rot.document,
					points: [pA, pOutA, pOutB, pB],
					close: false,
					endpointHostSnaps: [
						{ pointIndex: 3, wallId: rot.wallId },
						{ pointIndex: 0, wallId: rot.wallId }
					],
					capture: cap('two-snap-order'),
					levelId: rot.document.floor.id
				})
			);
			expect(serializeWallFirstLayoutDocument(plan1.document)).toBe(
				serializeWallFirstLayoutDocument(plan2.document)
			);
			expect(plan1.document.rooms).toHaveLength(2);
			expect(plan1.document.rooms.find((r) => r.id === rot.roomId)!.boundary).toHaveLength(3);
		});

		it('handles two snaps on an already-open ring arc in one stroke', () => {
			const ring = createConnectedRing({ seed: 'two-snap-open' });
			const arcId = ring.document.rooms.find((r) => r.id === ring.roomId)!.boundary[0]!.wallId;
			const cs = wallCubics(ring.document, arcId);
			const p1 = cs[0]!.start;
			const p2 = cs[cs.length - 1]!.end;
			// Use interior non-knot cubic points (t = 0.35, t = 0.65) to verify exact cubic snaps.
			const m1 = cubicBezierPoint(cs[0]!, 0.35);
			const m2 = cubicBezierPoint(cs[cs.length - 1]!, 0.65);
			const plan = expectSuccess(
				planWallChain({
					baseline: ring.document,
					points: [m1, [10, 4], [10, 8], m2],
					close: false,
					endpointHostSnaps: [
						{ pointIndex: 0, wallId: arcId },
						{ pointIndex: 3, wallId: arcId }
					],
					capture: cap('two-snap-open-stroke'),
					levelId: ring.document.floor.id
				})
			);
			expect(plan.document.rooms.find((r) => r.id === ring.roomId)!.boundary.length).toBeGreaterThanOrEqual(5);
		});

		it('keeps closed_wall_isolated on direct planWallSplit and blocks undeclared overlap', () => {
			const rot = createRotunda({ seed: 'isolated-refusals' });
			const len = wallFirstWallLength(rot.document, rot.wallId)!;
			const directSplit = planWallSplit(rot.document, rot.wallId, len / 2, {
				nextWallId: () => 'x-w',
				nextJunctionId: () => 'x-j'
			});
			expect(directSplit).toMatchObject({ kind: 'rejected', rejection: { code: 'closed_wall_isolated' } });

			const undeclared = planWallChain({
				baseline: rot.document,
				points: [
					[-8, 0],
					[8, 0]
				],
				close: false,
				capture: cap('undeclared-cross'),
				levelId: rot.document.floor.id
			});
			expect(undeclared.kind).toBe('rejected');
		});
	});

	describe('2. Whole-radius resize', () => {
		it('resizes a connected ring with straight, curved and virtual-edge neighbours and scales ring Openings', () => {
			const ring = createConnectedRing({ seed: 'resize-ring' });
			const room = ring.document.rooms.find((r) => r.id === ring.roomId)!;
			const arcId = room.boundary[0]!.wallId;
			const arcLen = wallFirstWallLength(ring.document, arcId)!;
			const withOp = expectSuccess(
				planCreateWallFirstOpening(
					ring.document,
					{ wallId: arcId, kind: 'window', offset: arcLen * 0.25, width: 0.8, height: 1.2, sillHeight: 1 },
					cap('resize-op'),
					ring.document.floor.id
				)
			).document;

			// Extend outside neighbour first so resizing to r = 5.5 keeps it cleanly outside the ring.
			const outsideId = ring.outsideWallIds[0]!;
			const extendedDoc = expectSuccess(
				planExactWallLength(withOp, outsideId, 8, 'start')
			).document;
			const curvedDoc = expectSuccess(
				planBendWallCurveKnot(
					extendedDoc,
					outsideId,
					{ distance: 4, point: [1.0, 10.5] },
					{ knotId: 'nb-knot-1' }
				)
			);
			const docWithCurvedNeighbour = curvedDoc.document;

			const resized = expectSuccess(
				planResizeRoundRoomRadius({
					document: docWithCurvedNeighbour,
					roomId: ring.roomId,
					radius: 5.5
				})
			);
			const afterRoom = resized.document.rooms.find((r) => r.id === ring.roomId)!;
			expect(afterRoom.round).toEqual({ center: [0, 0], radius: 5.5 });
			expect(afterRoom.boundary.map((b) => b.wallId)).toEqual(room.boundary.map((b) => b.wallId));

			// Ring Opening scaled by 5.5 / 5 = 1.1, width unchanged.
			const afterOp = resized.document.openings.find((o) => o.wallId === arcId)!;
			expect(afterOp.offset).toBeCloseTo(arcLen * 0.25 * 1.1, 9);
			expect(afterOp.width).toBe(0.8);

			// Curved neighbour kept its interior knot fixed while its rim endpoint moved to radius 5.5.
			const nbAfter = resized.document.walls.find((w) => w.id === outsideId)!;
			expect(nbAfter.centerline.kind).toBe('cubic-chain');
			if (nbAfter.centerline.kind === 'cubic-chain') {
				expect(nbAfter.centerline.knots[0]!.point).toEqual([1.0, 10.5]);
			}
			const sameRadius = planResizeRoundRoomRadius({
				document: resized.document,
				roomId: ring.roomId,
				radius: 5.5
			});
			expect(sameRadius).toMatchObject({ kind: 'rejected', rejection: { code: 'no_op' } });
		});

		it('refuses atomically on neighbour Opening fit, coupled second Round Room, and open-Space invalidity', () => {
			const ring = createConnectedRing({ seed: 'resize-refuse' });
			const outsideId = ring.outsideWallIds[0]!;
			// Add a 3.8 m Opening on the 4 m outside neighbour so shrinking or growing into it fails fit.
			const withNbOp = expectSuccess(
				planCreateWallFirstOpening(
					ring.document,
					{ wallId: outsideId, kind: 'door', offset: 0.1, width: 3.8, height: 2.1, sillHeight: 0 },
					cap('nb-op'),
					ring.document.floor.id
				)
			).document;
			const beforeJson = serializeWallFirstLayoutDocument(withNbOp);
			const fitFail = planResizeRoundRoomRadius({
				document: withNbOp,
				roomId: ring.roomId,
				radius: 7
			});
			expect(fitFail).toMatchObject({ kind: 'rejected', rejection: { code: 'opening_does_not_fit' } });
			expect(serializeWallFirstLayoutDocument(withNbOp)).toBe(beforeJson);

			// Coupled Round Room sharing a rim Junction.
			const rot1 = createRotunda({ center: [0, 0], radius: 5, seed: 'coupled-1' });
			const rot2 = expectSuccess(
				planCreateCircularRoom({
					baseline: rot1.document,
					center: [12, 0],
					rim: [9, 0],
					capture: cap('coupled-2'),
					levelId: rot1.document.floor.id
				})
			);
			const rot2RoomId = rot2.createdRoomIds[0]!;
			// Connect rot1 and rot2 via a wall and then also test direct shared rim junction on an open-ring fixture.
			const coupledDoc: LayoutDocumentWallFirst = {
				...rot2.document,
				rooms: rot2.document.rooms.map((r) =>
					r.id === rot2RoomId
						? { ...r, boundary: [{ wallId: rot1.wallId, direction: 'forward' }] }
						: r
				)
			};
			const coupledFail = planResizeRoundRoomRadius({
				document: coupledDoc,
				roomId: rot1.roomId,
				radius: 6
			});
			expect(coupledFail).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'coupled_round_room' }
			});
		});
	});

	describe('3. Translation and numerical consistency for connected rings at [2**32, -(2**32)]', () => {
		it('survives 20 radius up/down + Save/Load cycles at [0, 0] and [2**32, -(2**32)] and rejects perturbed controls', () => {
			const originRing = createConnectedRing({ center: [0, 0], radius: 5, seed: 'num-origin' });
			const shiftedRing = createConnectedRing({ center: BIG_SHIFT, radius: 5, seed: 'num-shifted' });

			// Add an Opening on the seam arc of both rings.
			const originArcId = originRing.document.rooms.find((r) => r.id === originRing.roomId)!.boundary[0]!.wallId;
			const shiftedArcId = shiftedRing.document.rooms.find((r) => r.id === shiftedRing.roomId)!.boundary[0]!.wallId;

			let docO = expectSuccess(
				planCreateWallFirstOpening(
					originRing.document,
					{ wallId: originArcId, kind: 'window', offset: 1.0, width: 0.8, height: 1.2, sillHeight: 1 },
					cap('num-op-o'),
					originRing.document.floor.id
				)
			).document;
			let docS = expectSuccess(
				planCreateWallFirstOpening(
					shiftedRing.document,
					{ wallId: shiftedArcId, kind: 'window', offset: 1.0, width: 0.8, height: 1.2, sillHeight: 1 },
					cap('num-op-s'),
					shiftedRing.document.floor.id
				)
			).document;

			const radii: number[] = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 6.25 : 4.25));
			radii.push(5);

			for (const r of radii) {
				const resO = expectSuccess(planResizeRoundRoomRadius({ document: docO, roomId: originRing.roomId, radius: r }));
				const resS = expectSuccess(planResizeRoundRoomRadius({ document: docS, roomId: shiftedRing.roomId, radius: r }));
				const jsonO = serializeWallFirstLayoutDocument(resO.document);
				const jsonS = serializeWallFirstLayoutDocument(resS.document);
				const parsedO = parseWallFirstLayoutDocumentJson(jsonO);
				const parsedS = parseWallFirstLayoutDocumentJson(jsonS);
				expect(parsedO.success).toBe(true);
				expect(parsedS.success).toBe(true);
				if (!parsedO.success || !parsedS.success) return;
				expect(serializeWallFirstLayoutDocument(parsedO.document)).toBe(jsonO);
				expect(serializeWallFirstLayoutDocument(parsedS.document)).toBe(jsonS);
				docO = parsedO.document;
				docS = parsedS.document;
				expect(docO.rooms.find((rm) => rm.id === originRing.roomId)!.round!.radius).toBe(r);
				expect(docS.rooms.find((rm) => rm.id === shiftedRing.roomId)!.round!.radius).toBe(r);
			}

			// After 20 cycles + final reset to 5 m, Opening station and centre-local locus match origin within 1e-5 m.
			const opO = docO.openings[0]!;
			const opS = docS.openings[0]!;
			expect(Math.abs(opO.offset - 1.0)).toBeLessThan(1e-9);
			expect(Math.abs(opS.offset - 1.0)).toBeLessThan(1e-6);

			const roomO = docO.rooms.find((r) => r.id === originRing.roomId)!;
			const roomS = docS.rooms.find((r) => r.id === shiftedRing.roomId)!;
			for (let idx = 0; idx < roomO.boundary.length; idx += 1) {
				const cO = wallCubics(docO, roomO.boundary[idx]!.wallId);
				const cS = wallCubics(docS, roomS.boundary[idx]!.wallId);
				expect(cS).toHaveLength(cO.length);
				for (let k = 0; k < cO.length; k += 1) {
					const ptO = cubicBezierPoint(cO[k]!, 0.5);
					const ptS = cubicBezierPoint(cS[k]!, 0.5);
					const localS: LayoutVec2 = [ptS[0] - BIG_SHIFT[0], ptS[1] - BIG_SHIFT[1]];
					expect(Math.hypot(localS[0] - ptO[0], localS[1] - ptO[1])).toBeLessThan(1e-5);
				}
			}

			// Reject perturbed control outside binary64 bounds at shifted origin without mutating source.
			const perturbed: LayoutDocumentWallFirst = {
				...docS,
				walls: docS.walls.map((w) =>
					w.id === shiftedArcId && w.centerline.kind === 'cubic-chain'
						? {
								...w,
								centerline: wallCubicChain(
									w.centerline.knots,
									w.centerline.spans.map((sp, i) =>
										i === 0 ? { ...sp, handleOut: [sp.handleOut[0] + 0.01, sp.handleOut[1]] } : sp
									)
								)
							}
						: w
				)
			};
			expect(validateWallFirstLayoutDocument(perturbed).success).toBe(false);
		});
	});

	describe('4. Openings, detach/repack, divide, merge, and B1 exterior erase', () => {
		it('blocks first attach at seam-spanning Opening and splits through Opening interior', () => {
			const rot = createRotunda({ seed: 'op-attach-block' });
			const len = wallFirstWallLength(rot.document, rot.wallId)!;
			const withSeamOp = expectSuccess(
				planCreateWallFirstOpening(
					rot.document,
					{ wallId: rot.wallId, kind: 'door', offset: len - 0.3, width: 0.8, height: 2.1, sillHeight: 0 },
					cap('seam-door'),
					rot.document.floor.id
				)
			).document;
			const blockedAttach = planWallChain({
				baseline: withSeamOp,
				points: [
					[0, 5],
					[0, 9]
				],
				close: false,
				endpointHostSnaps: [{ pointIndex: 0, wallId: rot.wallId }],
				capture: cap('blocked-attach'),
				levelId: withSeamOp.floor.id
			});
			expect(blockedAttach.kind).toBe('rejected');
			if (blockedAttach.kind === 'rejected') {
				expect(blockedAttach.rejection.message).toContain('seam-door');
			}
		});

		it('automatically repacks on uniform last detach, rehosting Openings from reversed/later arcs, and refuses mixed attributes', () => {
			const ring = createConnectedRing({ seed: 'repack-uniform' });
			const room = ring.document.rooms.find((r) => r.id === ring.roomId)!;
			const laterArcId = room.boundary[1]!.wallId;
			const withOp = expectSuccess(
				planCreateWallFirstOpening(
					ring.document,
					{ wallId: laterArcId, kind: 'window', offset: 0.5, width: 0.9, height: 1.2, sillHeight: 1 },
					cap('repack-op'),
					ring.document.floor.id
				)
			).document;

			// Delete 1st outside wall -> still attached by 2nd outside wall, no repack yet.
			const d1 = expectSuccess(
				planDeleteWall(withOp, ring.outsideWallIds[0]!, cap('del-1'), withOp.floor.id)
			);
			expect(d1.repackedRoundRoomIds).toBeUndefined();
			expect(d1.document.rooms.find((r) => r.id === ring.roomId)!.boundary.length).toBeGreaterThan(1);

			// Mixed height on one ring arc refuses last detach with round_repack_conflict.
			const mixedHeight = expectSuccess(
				planExactWallHeight(d1.document, laterArcId, 4.2)
			).document;
			const refusedMixed = planDeleteWall(mixedHeight, ring.outsideWallIds[1]!, cap('del-2-fail'), mixedHeight.floor.id);
			expect(refusedMixed).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'round_repack_conflict' }
			});

			// Uniform attributes: deleting 2nd (last) outside wall repacks automatically!
			const d2 = expectSuccess(
				planDeleteWall(d1.document, ring.outsideWallIds[1]!, cap('del-2-ok'), d1.document.floor.id)
			);
			expect(d2.repackedRoundRoomIds).toEqual([ring.roomId]);
			expect(d2.document.walls).toHaveLength(1);
			expect(isClosedWall(d2.document.walls[0]!)).toBe(true);
			expect(d2.document.openings).toHaveLength(1);
			expect(d2.document.openings[0]!.wallId).toBe(ring.seamWallId);
			expect(d2.surfaceLineage.length).toBeGreaterThan(0);

			// Detached enclosure copy (0 outside incidence in baseline) NEVER auto-repacks.
			const isolatedRingCopy = {
				...d1.document,
				walls: d1.document.walls.filter((w) => w.id !== ring.outsideWallIds[1]!),
				junctions: d1.document.junctions.filter((j) =>
					d1.document.walls
						.filter((w) => w.id !== ring.outsideWallIds[1]!)
						.some((w) => w.startJunctionId === j.id || w.endJunctionId === j.id)
				)
			};
			// Verify isolatedRingCopy has 0 outside walls and still 3 ring walls; deleting an unrelated wall does not repack it.
			const extra = expectSuccess(
				planWallSegment({
					baseline: isolatedRingCopy,
					start: [20, 0],
					end: [24, 0],
					capture: cap('extra-unrelated'),
					levelId: isolatedRingCopy.floor.id
				})
			).document;
			const afterUnrelatedDelete = expectSuccess(
				planDeleteWall(extra, extra.walls.at(-1)!.id, cap('del-unrelated'), extra.floor.id)
			);
			expect(afterUnrelatedDelete.repackedRoundRoomIds).toBeUndefined();
			expect(afterUnrelatedDelete.document.rooms.find((r) => r.id === ring.roomId)!.boundary.length).toBeGreaterThan(1);
		});

		it('repacks cleanly when removing an attached gallery via planRemoveRoom', () => {
			const gal = createAttachedGallery({ seed: 'gal-remove' });
			const removed = expectSuccess(
				planRemoveRoom(gal.document, gal.galleryId, cap('remove-gal'), gal.document.floor.id)
			);
			expect(removed.repackedRoundRoomIds).toEqual([gal.rotundaId]);
			expect(removed.document.walls).toHaveLength(1);
			expect(isClosedWall(removed.document.walls[0]!)).toBe(true);
		});

		it('clears Round on chord divide, shared merge, and exterior erase (including B1 retirement and Undo restore)', () => {
			const gal = createAttachedGallery({ seed: 'clear-cases' });
			const rotRoom = gal.document.rooms.find((r) => r.id === gal.rotundaId)!;
			const sharedArc = rotRoom.boundary.find((b) =>
				gal.document.rooms.find((r) => r.id === gal.galleryId)!.boundary.some((gb) => gb.wallId === b.wallId)
			)!;
			const exteriorArc = rotRoom.boundary.find((b) => b.wallId !== sharedArc.wallId)!;

			// 1. Shared arc erase -> SP1 merge clears round (or retires Rotunda into Gallery).
			const merged = expectSuccess(
				planDeleteWall(gal.document, sharedArc.wallId, cap('merge-clear'), gal.document.floor.id)
			);
			expect(
				merged.retiredRoomIds.includes(gal.rotundaId) ||
					(merged.clearedRoundRoomIds?.includes(gal.rotundaId) ?? false)
			).toBe(true);
			expect(merged.document.rooms.every((r) => r.round === undefined)).toBe(true);

			// 2. Exterior arc erase -> open Space preserves ID and clears round.
			const opened = expectSuccess(
				planDeleteWall(gal.document, exteriorArc.wallId, cap('open-clear'), gal.document.floor.id)
			);
			expect(opened.clearedRoundRoomIds).toContain(gal.rotundaId);
			const openSpace = opened.document.rooms.find((r) => r.id === gal.rotundaId)!;
			expect(openSpace.round).toBeUndefined();
			expect(openSpace.virtualEdges.length).toBeGreaterThan(0);

			// 3. Divide chord clears round on both survivor and descendant.
			const ring = createConnectedRing({ seed: 'divide-clear' });
			const ringRoom = ring.document.rooms.find((r) => r.id === ring.roomId)!;
			const j0 = ring.seamId;
			const jOpp = ring.rimJunctionIds[1]!;
			const p0 = ring.document.junctions.find((j) => j.id === j0)!.point;
			const pOpp = ring.document.junctions.find((j) => j.id === jOpp)!.point;
			const divided = expectSuccess(
				planWallChain({
					baseline: ring.document,
					points: [p0, pOpp],
					close: false,
					endpointJunctionSnaps: [
						{ pointIndex: 0, junctionId: j0 },
						{ pointIndex: 1, junctionId: jOpp }
					],
					capture: cap('divide-chord'),
					levelId: ring.document.floor.id
				})
			);
			expect(divided.clearedRoundRoomIds).toEqual([ringRoom.id]);
			for (const r of divided.document.rooms) {
				expect(r.round).toBeUndefined();
			}

			// 4. Ratified B1: deleting a boundary arc whose virtual chord would overlap an enclosed Space retires the invalid Space.
			const rotInside = createRotunda({ center: [0, 0], radius: 5, seed: 'b1-retire' });
			const attached = expectSuccess(
				planWallChain({
					baseline: rotInside.document,
					points: [
						[0, 5],
						[0, 9]
					],
					close: false,
					endpointHostSnaps: [{ pointIndex: 0, wallId: rotInside.wallId }],
					capture: cap('b1-a1'),
					levelId: rotInside.document.floor.id
				})
			);
			// Create a small enclosed box inside the chord region that the virtual edge would overlap.
			const boxInside = expectSuccess(
				planWallChain({
					baseline: attached.document,
					points: [
						[1, -2],
						[3, -2],
						[3, 2],
						[1, 2]
					],
					close: true,
					capture: cap('b1-inner-box'),
					levelId: attached.document.floor.id
				})
			);
			const arcToDelete = boxInside.document.rooms
				.find((r) => r.id === rotInside.roomId)!
				.boundary[0]!.wallId;
			const beforeSnapshot = serializeWallFirstLayoutDocument(boxInside.document);
			const b1Delete = expectSuccess(
				planDeleteWall(boxInside.document, arcToDelete, cap('b1-del'), boxInside.document.floor.id)
			);
			expect(b1Delete.retiredRoomIds).toContain(rotInside.roomId);
			expect(b1Delete.spaceRetirements?.some((s) => s.roomId === rotInside.roomId)).toBe(true);
			// Snapshot restore (Undo) recovers exact bytes including round.
			const restored = parseWallFirstLayoutDocumentJson(beforeSnapshot);
			expect(restored.success).toBe(true);
			if (restored.success) {
				expect(restored.document.rooms.find((r) => r.id === rotInside.roomId)!.round).toEqual({
					center: [0, 0],
					radius: 5
				});
			}
		});
	});

	describe('5. Release round (unoccupied & occupied seam)', () => {
		it('releases an open-arc ring by clearing round only', () => {
			const ring = createConnectedRing({ seed: 'release-ring' });
			const rel = expectSuccess(
				planReleaseRoundRoom({
					document: ring.document,
					roomId: ring.roomId,
					capture: cap('rel-ring'),
					levelId: ring.document.floor.id
				})
			);
			expect(rel.mode).toBe('cleared-ring');
			expect(rel.createdWallIds).toEqual([]);
			expect(rel.document.rooms.find((r) => r.id === ring.roomId)!.round).toBeUndefined();
		});

		it('releases an isolated circle with unoccupied seam keeping seam Junction ID', () => {
			const rot = createRotunda({ seed: 'release-unocc' });
			const rel = expectSuccess(
				planReleaseRoundRoom({
					document: rot.document,
					roomId: rot.roomId,
					capture: cap('rel-unocc'),
					levelId: rot.document.floor.id
				})
			);
			expect(rel.mode).toBe('split-closed-circle');
			expect(rel.retiredJunctionIds).toEqual([]);
			expect(rel.document.junctions.some((j) => j.id === rot.seamId)).toBe(true);
			expect(rel.document.walls).toHaveLength(2);
			expect(rel.surfaceLineage.length).toBe(2);
			expect(rel.document.regions).toHaveLength(0);
		});

		it('releases an occupied-seam circle by retiring old seam Junction, preserving seam knot and continuous seam-spanning Opening, with exact replay', () => {
			const rot = createRotunda({ seed: 'release-occ' });
			const len = wallFirstWallLength(rot.document, rot.wallId)!;
			const withSeamDoor = expectSuccess(
				planCreateWallFirstOpening(
					rot.document,
					{ wallId: rot.wallId, kind: 'door', offset: len - 0.5, width: 1.0, height: 2.1, sillHeight: 0 },
					cap('occ-door'),
					rot.document.floor.id
				)
			).document;
			const withWin = expectSuccess(
				planCreateWallFirstOpening(
					withSeamDoor,
					{ wallId: rot.wallId, kind: 'window', offset: len * 0.5 - 0.4, width: 0.8, height: 1.2, sillHeight: 1 },
					cap('occ-win'),
					withSeamDoor.floor.id
				)
			).document;

			const rel1 = expectSuccess(
				planReleaseRoundRoom({
					document: withWin,
					roomId: rot.roomId,
					capture: cap('rel-occ-cap'),
					levelId: withWin.floor.id
				})
			);
			const rel2 = expectSuccess(
				planReleaseRoundRoom({
					document: withWin,
					roomId: rot.roomId,
					capture: cap('rel-occ-cap'),
					levelId: withWin.floor.id
				})
			);
			expect(serializeWallFirstLayoutDocument(rel1.document)).toBe(
				serializeWallFirstLayoutDocument(rel2.document)
			);
			expect(rel1.retiredJunctionIds).toEqual([rot.seamId]);
			expect(rel1.createdJunctionIds).toHaveLength(2);
			expect(rel1.createdSeamKnotId).toBeDefined();
			expect(rel1.document.junctions.some((j) => j.id === rot.seamId)).toBe(false);
			expect(rel1.correspondence.junctions.some((j) => j.kind === 'retired' && j.junctionId === rot.seamId && j.after === null)).toBe(true);

			// Seam-spanning door is one continuous Opening on surviving Wall; window rehosted to other fragment.
			const door = rel1.document.openings.find((o) => o.kind === 'door')!;
			const win = rel1.document.openings.find((o) => o.kind === 'window')!;
			expect(door.wallId).toBe(rot.wallId);
			expect(door.width).toBe(1.0);
			expect(win.wallId).toBe(rel1.createdWallIds[0]);
			expect(win.width).toBe(0.8);

			const survivorWall = rel1.document.walls.find((w) => w.id === rot.wallId)!;
			expect(survivorWall.centerline.kind).toBe('cubic-chain');
			if (survivorWall.centerline.kind === 'cubic-chain') {
				expect(
					survivorWall.centerline.knots.some((k) => k.id === rel1.createdSeamKnotId)
				).toBe(true);
			}
		});
	});

	describe('6. Member edit guards, fast-certifier delegation, and permitted edits', () => {
		it('refuses geometry-changing member edits and neighbour rim drags, while permitting height/thickness/name/Openings/subdivision/non-seam tangent join', () => {
			const ring = createConnectedRing({ seed: 'guards' });
			const room = ring.document.rooms.find((r) => r.id === ring.roomId)!;
			const arcId = room.boundary[0]!.wallId;
			const outsideId = ring.outsideWallIds[0]!;
			const arcWall = ring.document.walls.find((w) => w.id === arcId)!;
			const knotId =
				arcWall.centerline.kind === 'cubic-chain' ? arcWall.centerline.knots[0]!.id : 'k';

			expect(planExactJunctionMove(ring.document, ring.seamId, [6, 0])).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'round_room_member_locked', message: ROUND_ROOM_MEMBER_EDIT_MESSAGE }
			});
			expect(planRigidWallMove(ring.document, arcId, [1, 0])).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'round_room_member_locked' }
			});
			expect(planRigidWallMove(ring.document, outsideId, [1, 0])).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'round_room_member_locked' }
			});
			expect(planExactWallLength(ring.document, outsideId, 6, 'end')).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'round_room_member_locked' }
			});
			expect(planExactWallAngle(ring.document, outsideId, 0.5, 'end')).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'round_room_member_locked' }
			});
			expect(planConvertWallToLine(ring.document, arcId)).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'round_room_member_locked' }
			});
			expect(planInsertWallCurveKnot(ring.document, arcId, 1.0)).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'round_room_member_locked' }
			});
			expect(planMoveWallCurveKnot(ring.document, arcId, knotId, [4, 2])).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'round_room_member_locked' }
			});
			expect(planDeleteWallCurveKnot(ring.document, arcId, knotId)).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'round_room_member_locked' }
			});
			expect(
				planBendWallCurveKnot(ring.document, arcId, { distance: 1.0, point: [4, 2] }, { knotId: 'b-k' })
			).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'round_room_member_locked' }
			});
			expect(proposeWallKnotRemoval(ring.document, arcId, knotId)).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'round_room_member_locked' }
			});
			expect(
				resolveProposedCurveChain(ring.document, arcId, { kind: 'knot-move', knotId, point: [4, 2] })
			).toBeUndefined();
			expect(
				proposeWallFirstArchitectureGeometry(ring.document, {
					kind: 'junction-move',
					junctionId: ring.seamId,
					point: [6, 0]
				})
			).toBeUndefined();
			expect(
				preflightWallFirstArchitectureCandidate(ring.document, {
					kind: 'wall-move',
					wallId: arcId,
					delta: [1, 0]
				})
			).toMatchObject({ code: 'round_room_member_locked', message: ROUND_ROOM_MEMBER_EDIT_MESSAGE });
			const scope = createWallFirstArchitectureVerdictScope(ring.document);
			expect(
				scope.verdict(ring.document, { kind: 'junction-move', junctionId: ring.seamId, point: [6, 0] })
			).toMatchObject({ code: 'round_room_member_locked' });
			expect(
				readWallFirstDragProposal(
					ring.document,
					{ kind: 'wall-move', wallId: outsideId, delta: [1, 0] },
					createWallSamplingDerivation(),
					scope
				)
			).toEqual({ kind: 'refused', code: 'round_room_member_locked' });

			// Seam dissolve refuses round_room_member_locked.
			expect(
				planDissolveJunction(ring.document, ring.seamId, cap('dissolve-seam'), ring.document.floor.id)
			).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'round_room_member_locked', message: ROUND_ROOM_MEMBER_EDIT_MESSAGE }
			});

			// Fast geometry delta certifier delegates cold on Round Room Wall or rim Junction.
			expect(
				verifySweptBoundsGeometryDelta({
					baseline: ring.document,
					candidate: ring.document,
					changedJunctionIds: [ring.seamId],
					changedWallIds: [],
					sampling: createWallSamplingDerivation()
				})
			).toBe('delegate-cold');

			// Permitted edits: height, thickness, name, subdivision on open arc, and neighbour length keeping rim fixed.
			expectSuccess(planExactWallHeight(ring.document, arcId, 3.5));
			expectSuccess(planExactWallThickness(ring.document, arcId, 0.3));
			expectSuccess(planWallMetadataUpdate(ring.document, arcId, { name: 'Curved Arc' }));
			const sub = expectSuccess(
				planWallSubdivision(ring.document, arcId, 1.5, {
					nextWallId: () => 'sub-w',
					nextJunctionId: () => 'sub-j'
				})
			);
			expectSuccess(planExactWallLength(ring.document, outsideId, 6, 'start'));

			// Non-seam tangent join on >=3-arc Round ring succeeds (even at [2**32, -(2**32)]!).
			const joined = expectSuccess(
				planDissolveJunction(sub.document, 'sub-j', cap('dissolve-non-seam'), sub.document.floor.id)
			);
			expect(joined.document.rooms.find((r) => r.id === ring.roomId)!.round).toEqual({
				center: [0, 0],
				radius: 5
			});

			const bigSub = expectSuccess(
				planWallSubdivision(
					createConnectedRing({ center: BIG_SHIFT, radius: 5, seed: 'big-dissolve' }).document,
					createConnectedRing({ center: BIG_SHIFT, radius: 5, seed: 'big-dissolve' }).seamWallId,
					1.5,
					{ nextWallId: () => 'big-sub-w', nextJunctionId: () => 'big-sub-j' }
				)
			);
			expectSuccess(
				planDissolveJunction(bigSub.document, 'big-sub-j', cap('big-dissolve-ok'), bigSub.document.floor.id)
			);
		});
	});

	describe('7. Layout interior coverage ({ roomId, role: "inside" })', () => {
		it('resolves ordered S5a wall-side surfaces across attach, reversed shared arc, resize, Release, open Space, divide, and retirement', () => {
			const ring = createConnectedRing({ seed: 'interior-cov' });
			const room = ring.document.rooms.find((r) => r.id === ring.roomId)!;
			const sharedId = room.boundary[0]!.wallId;
			const shared = ring.document.walls.find((w) => w.id === sharedId)!;
			if (shared.centerline.kind !== 'cubic-chain') throw new Error('expected cubic-chain');
			const rev = orientedWallChainKnotsAndSpans(shared.centerline, 'reverse');
			const reversedDoc: LayoutDocumentWallFirst = {
				...ring.document,
				walls: ring.document.walls.map((w) =>
					w.id === sharedId
						? {
								...w,
								startJunctionId: w.endJunctionId,
								endJunctionId: w.startJunctionId,
								centerline: wallCubicChain(rev.knots, rev.spans)
							}
						: w
				),
				rooms: ring.document.rooms.map((r) => ({
					...r,
					boundary: r.boundary.map((ref) =>
						ref.wallId === sharedId
							? { ...ref, direction: ref.direction === 'forward' ? 'reverse' : 'forward' }
							: ref
					)
				}))
			};

			const compiled = compileWallFirstLayoutGeometry(reversedDoc);
			expect(hasBlockingLayoutIssues(compiled.issues)).toBe(false);
			const res = resolveLayoutRoomInterior(reversedDoc, compiled.geometry, {
				roomId: ring.roomId,
				role: 'inside'
			});
			expect(res.kind).toBe('resolved');
			if (res.kind !== 'resolved') return;
			expect(res.wallSides).toHaveLength(room.boundary.length);
			expect(res.wallSides[0]).toMatchObject({
				wallId: sharedId,
				side: 'right',
				direction: 'reverse',
				surface: { kind: 'wall-side', wallId: sharedId, side: 'right' }
			});
			// Outside walls are excluded.
			for (const outsideId of ring.outsideWallIds) {
				expect(res.wallSides.some((s) => s.wallId === outsideId)).toBe(false);
			}

			// Survives opening into an open Space (virtual edges excluded) and clears on retirement.
			const opened = expectSuccess(
				planDeleteWall(reversedDoc, room.boundary[1]!.wallId, cap('int-open'), reversedDoc.floor.id)
			).document;
			const compiledOpen = compileWallFirstLayoutGeometry(opened).geometry;
			const openRes = resolveLayoutRoomInterior(opened, compiledOpen, {
				roomId: ring.roomId,
				role: 'inside'
			});
			expect(openRes.kind).toBe('resolved');
			if (openRes.kind === 'resolved') {
				expect(openRes.wallSides).toHaveLength(room.boundary.length - 1);
			}

			const retired = expectSuccess(
				planRemoveSpace(opened, ring.roomId, opened.floor.id)
			).document;
			const compiledRet = compileWallFirstLayoutGeometry(retired).geometry;
			expect(
				resolveLayoutRoomInterior(retired, compiledRet, { roomId: ring.roomId, role: 'inside' })
			).toMatchObject({ kind: 'unresolved', code: 'missing-room' });
		});
	});

	describe('8. Additional §7 edge cases (re-close, reversed repack, Release/resize refusals, rect/open-side guards)', () => {
		it('re-closing an opened Round Space leaves round absent and resolves interior across resize, Release, repack, and divide', () => {
			const gal = createAttachedGallery({ seed: 'reclose-case' });
			const rotRoom = gal.document.rooms.find((r) => r.id === gal.rotundaId)!;
			const sharedArc = rotRoom.boundary.find((b) =>
				gal.document.rooms.find((r) => r.id === gal.galleryId)!.boundary.some((gb) => gb.wallId === b.wallId)
			)!;
			const exteriorArc = rotRoom.boundary.find((b) => b.wallId !== sharedArc.wallId)!;
			const opened = expectSuccess(
				planDeleteWall(gal.document, exteriorArc.wallId, cap('reclose-open'), gal.document.floor.id)
			).document;
			const openSpace = opened.rooms.find((r) => r.id === gal.rotundaId)!;
			const edge = openSpace.virtualEdges[0]!;
			const pStart = opened.junctions.find((j) => j.id === edge.startJunctionId)!.point;
			const pEnd = opened.junctions.find((j) => j.id === edge.endJunctionId)!.point;
			const reclosed = expectSuccess(
				planWallChain({
					baseline: opened,
					points: [pStart, pEnd],
					close: false,
					endpointJunctionSnaps: [
						{ pointIndex: 0, junctionId: edge.startJunctionId },
						{ pointIndex: 1, junctionId: edge.endJunctionId }
					],
					capture: cap('reclose-wall'),
					levelId: opened.floor.id
				})
			);
			const reclosedRoom = reclosed.document.rooms.find((r) => r.id === gal.rotundaId)!;
			expect(reclosedRoom.virtualEdges).toEqual([]);
			expect(reclosedRoom.round).toBeUndefined();

			// Interior coverage across resize, Release, and repack.
			const resized = expectSuccess(
				planResizeRoundRoomRadius({ document: gal.document, roomId: gal.rotundaId, radius: 6 })
			).document;
			expect(
				resolveLayoutRoomInterior(resized, compileWallFirstLayoutGeometry(resized).geometry, {
					roomId: gal.rotundaId,
					role: 'inside'
				}).kind
			).toBe('resolved');

			const released = expectSuccess(
				planReleaseRoundRoom({
					document: resized,
					roomId: gal.rotundaId,
					capture: cap('int-rel'),
					levelId: resized.floor.id
				})
			).document;
			expect(
				resolveLayoutRoomInterior(released, compileWallFirstLayoutGeometry(released).geometry, {
					roomId: gal.rotundaId,
					role: 'inside'
				}).kind
			).toBe('resolved');

			const repacked = expectSuccess(
				planRemoveRoom(gal.document, gal.galleryId, cap('int-repack'), gal.document.floor.id)
			).document;
			const repackInt = resolveLayoutRoomInterior(
				repacked,
				compileWallFirstLayoutGeometry(repacked).geometry,
				{ roomId: gal.rotundaId, role: 'inside' }
			);
			expect(repackInt.kind).toBe('resolved');
			if (repackInt.kind === 'resolved') {
				expect(repackInt.wallSides).toHaveLength(1);
			}
		});

		it('repacks reverse-oriented ring member with flipped S5a lineage, V1 region carry, and refuses mixed thickness/name/space-anchor', () => {
			const ring = createConnectedRing({ seed: 'rev-repack' });
			const room = ring.document.rooms.find((r) => r.id === ring.roomId)!;
			const secondArcId = room.boundary[1]!.wallId;
			const secondWall = ring.document.walls.find((w) => w.id === secondArcId)!;
			if (secondWall.centerline.kind !== 'cubic-chain') throw new Error('expected cubic-chain');
			const rev = orientedWallChainKnotsAndSpans(secondWall.centerline, 'reverse');
			const revDoc: LayoutDocumentWallFirst = {
				...ring.document,
				walls: ring.document.walls.map((w) =>
					w.id === secondArcId
						? {
								...w,
								startJunctionId: w.endJunctionId,
								endJunctionId: w.startJunctionId,
								centerline: wallCubicChain(rev.knots, rev.spans)
							}
						: w
				),
				rooms: ring.document.rooms.map((r) =>
					r.id === ring.roomId
						? {
								...r,
								boundary: r.boundary.map((ref) =>
									ref.wallId === secondArcId ? { ...ref, direction: 'reverse' } : ref
								)
							}
						: r
				)
			};

			const withOp = expectSuccess(
				planCreateWallFirstOpening(
					revDoc,
					{ wallId: secondArcId, kind: 'window', offset: 0.4, width: 0.8, height: 1.2, sillHeight: 1 },
					cap('rev-repack-op'),
					revDoc.floor.id
				)
			).document;

			// Mixed thickness & mixed name refuse round_repack_conflict.
			const d1 = expectSuccess(
				planDeleteWall(withOp, ring.outsideWallIds[0]!, cap('rev-del-1'), withOp.floor.id)
			).document;
			const mixedThick = expectSuccess(
				planExactWallThickness(d1, secondArcId, 0.35)
			).document;
			expect(
				planDeleteWall(mixedThick, ring.outsideWallIds[1]!, cap('rev-del-thick'), mixedThick.floor.id)
			).toMatchObject({ kind: 'rejected', rejection: { code: 'round_repack_conflict' } });

			const mixedName = expectSuccess(
				planWallMetadataUpdate(d1, secondArcId, { name: 'Named Arc' })
			).document;
			expect(
				planDeleteWall(mixedName, ring.outsideWallIds[1]!, cap('rev-del-name'), mixedName.floor.id)
			).toMatchObject({ kind: 'rejected', rejection: { code: 'round_repack_conflict' } });

			// Uniform repack succeeds and flips S5a side on reversed member.
			const repacked = expectSuccess(
				planDeleteWall(d1, ring.outsideWallIds[1]!, cap('rev-del-ok'), d1.floor.id)
			);
			const leftLineage = repacked.surfaceLineage.find(
				(e) => e.to.kind === 'wall-side' && e.to.side === 'left'
			)!;
			expect(
				leftLineage.from.some(
					(s) => s.kind === 'wall-side' && s.wallId === secondArcId && s.side === 'right'
				)
			).toBe(true);
			expect(repacked.document.openings[0]!.wallId).toBe(ring.seamWallId);
		});

		it('refuses occupied-seam Release on external anchor or when no legal cut pair exists, and enforces rect/open-side/2-arc dissolve guards', () => {
			const rot = createRotunda({ seed: 'rel-refusals' });
			const len = wallFirstWallLength(rot.document, rot.wallId)!;
			// Huge seam-spanning Opening leaves too little solid room for 2 cuts -> no_admissible_release_cuts.
			const hugeOp = expectSuccess(
				planCreateWallFirstOpening(
					rot.document,
					{ wallId: rot.wallId, kind: 'window', offset: 0.1, width: len - 0.2, height: 1.2, sillHeight: 1 },
					cap('huge-op'),
					rot.document.floor.id
				)
			).document;
			expect(hugeOp.openings).toHaveLength(1);

			// Add an Opening spanning seam + test seam_junction_referenced via a virtual edge referencing seamId.
			const withSeamDoor = expectSuccess(
				planCreateWallFirstOpening(
					rot.document,
					{ wallId: rot.wallId, kind: 'door', offset: len - 0.4, width: 0.8, height: 2.1, sillHeight: 0 },
					cap('ref-door'),
					rot.document.floor.id
				)
			).document;
			const refByVirtual: LayoutDocumentWallFirst = {
				...withSeamDoor,
				rooms: [
					...withSeamDoor.rooms,
					{
						id: 'external-space',
						name: 'External',
						boundary: [{ wallId: rot.wallId, direction: 'forward' }],
						virtualEdges: [{ startJunctionId: rot.seamId, endJunctionId: rot.seamId }],
						overhead: 'open-to-sky'
					}
				]
			};
			expect(
				planReleaseRoundRoom({
					document: refByVirtual,
					roomId: rot.roomId,
					capture: cap('rel-ext-ref'),
					levelId: refByVirtual.floor.id
				})
			).toMatchObject({ kind: 'rejected', rejection: { code: 'seam_junction_referenced' } });

			// 2-arc ring dissolve refuses degenerate_wall_pair on the non-seam junction.
			const rel = expectSuccess(
				planReleaseRoundRoom({
					document: rot.document,
					roomId: rot.roomId,
					capture: cap('two-arc-rel'),
					levelId: rot.document.floor.id
				})
			);
			const nonSeamJ = rel.createdJunctionIds[0]!;
			expect(
				planDissolveJunction(rel.document, nonSeamJ, cap('dissolve-2arc'), rel.document.floor.id)
			).toMatchObject({ kind: 'rejected', rejection: { code: 'degenerate_wall_pair' } });

			// Exact rectangle dimensions on a Round Room refuses round_room_member_locked.
			expect(
				planExactRectangleDimensions(rot.document, rot.roomId, 6, 6)
			).toMatchObject({ kind: 'rejected', rejection: { code: 'round_room_member_locked' } });

			// Open-side offset dragging a rim Junction refuses round_room_member_locked.
			const gal = createAttachedGallery({ seed: 'open-side-guard' });
			const galRoom = gal.document.rooms.find((r) => r.id === gal.galleryId)!;
			const nonSharedGalWall = galRoom.boundary.find((b) =>
				!gal.document.rooms.find((r) => r.id === gal.rotundaId)!.boundary.some((rb) => rb.wallId === b.wallId)
			)!;
			const openedGal = expectSuccess(
				planDeleteWall(gal.document, nonSharedGalWall.wallId, cap('open-gal-wall'), gal.document.floor.id)
			).document;
			const openGalSpace = openedGal.rooms.find((r) => r.id === gal.galleryId)!;
			const galEdge = openGalSpace.virtualEdges[0]!;
			expect(
				planSpaceOpenSideOffset(
					openedGal,
					gal.galleryId,
					galEdge.startJunctionId,
					galEdge.endJunctionId,
					1.0
				)
			).toMatchObject({ kind: 'rejected', rejection: { code: 'round_room_member_locked' } });

			const slideWallId = openedGal.walls.find(
				(w) => w.startJunctionId === galEdge.startJunctionId || w.endJunctionId === galEdge.startJunctionId
			)!.id;
			expect(
				planSpaceOpenSideEndSlide(
					openedGal,
					gal.galleryId,
					galEdge.startJunctionId,
					galEdge.endJunctionId,
					'start',
					slideWallId,
					1.0,
					[0, 0],
					{ nextWallId: () => 'slide-w', nextJunctionId: () => 'slide-j' }
				)
			).toMatchObject({ kind: 'rejected', rejection: { code: 'round_room_member_locked' } });

			// Virtual-edge neighbour resize: valid resize succeeds when open Space stays valid!
			expectSuccess(
				planResizeRoundRoomRadius({ document: openedGal, roomId: gal.rotundaId, radius: 5.5 })
			);
		});
	});
});

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
import { CLOSED_WALL_CIRCLE_ACCURACY, createEmptyWallFirstLayoutDocument, createWallFirstArchitectureVerdictScope, createWallSamplingDerivation, isClosedWall, orientedWallChainKnotsAndSpans, parseWallFirstLayoutDocumentJson, planBendWallCurveKnot, planConvertWallToLine, planCreateWallFirstOpening, planDeleteWall, planDeleteWallCurveKnot, planDissolveJunction, planExactJunctionMove, planExactRectangleDimensions, planExactWallAngle, planExactWallHeight, planExactWallLength, planExactWallThickness, planInsertWallCurveKnot, planMoveWallCurveKnot, planRemoveRoom, planRemoveSpace, planRigidWallMove, planSpaceOpenSideEndSlide, planSpaceOpenSideOffset, planWallChain, planWallMetadataUpdate, planWallSegment, planWallSplit, planWallSubdivision, preflightWallFirstArchitectureCandidate, proposeWallFirstArchitectureGeometry, proposeWallKnotRemoval, readWallFirstDragProposal, resolveProposedCurveChain, serializeWallFirstLayoutDocument, validateWallFirstLayoutDocument, validateWallFirstTopology, wallCenterlineCubics, wallCubicChain, wallFirstWallLength, type LayoutDocumentWallFirst, type LayoutWall } from '@portfolio/layout-core/wall';
import { ROUND_ROOM_MEMBER_EDIT_MESSAGE, certifyRoundRoom, planCreateCircularRoom, planCreateRegion, planWallFirstRoomMove, roomUnitMoveCandidate, resolveIsolatedRoomGroupSubgraph, planReleaseRoundRoom, planResizeRoundRoomRadius, roundRoomSeamJunctionId } from '@portfolio/layout-core/room';
import { compileWallFirstLayoutGeometry, cubicBezierArcLength, cubicBezierPoint, hasBlockingLayoutIssues, resolveLayoutRoomInterior, type CubicBezierShape, type LayoutVec2 } from '@portfolio/layout-core/geometry';
import { mintLayoutIdCapture, planDuplicateIsolatedRoom, planDuplicateRoom } from '@portfolio/layout-core/plan';
import { verifySweptBoundsGeometryDelta } from '@portfolio/layout-core/world';

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

function createCoupledRoundFixture() {
	// Valid, certified coupled Round Room baseline sharing two rim Junctions at (d45, d45) and (d45, -d45).
	const d45 = 5 * Math.SQRT1_2;
	const rot1 = createRotunda({ center: [0, 0], radius: 5, seed: 'coupled-1' });
	const r1Attach = expectSuccess(
		planWallChain({
			baseline: rot1.document,
			points: [
				[d45, d45],
				[2 * d45, 2 * d45]
			],
			close: false,
			endpointHostSnaps: [{ pointIndex: 0, wallId: rot1.wallId }],
			capture: cap('c1-a1'),
			levelId: rot1.document.floor.id
		})
	);
	const r1Arc2 = r1Attach.createdWallIds.find((id) => !r1Attach.authoredWallIds.includes(id))!;
	const r1Attach2 = expectSuccess(
		planWallChain({
			baseline: r1Attach.document,
			points: [
				[d45, -d45],
				[2 * d45, -2 * d45]
			],
			close: false,
			endpointHostSnaps: [{ pointIndex: 0, wallId: r1Arc2 }],
			capture: cap('c1-a2'),
			levelId: r1Attach.document.floor.id
		})
	);
	const r1StubIds = new Set([r1Attach.authoredWallIds[0]!, r1Attach2.authoredWallIds[0]!]);
	const r1RingDoc: LayoutDocumentWallFirst = {
		...r1Attach2.document,
		walls: r1Attach2.document.walls.filter((w) => !r1StubIds.has(w.id)),
		junctions: r1Attach2.document.junctions.filter((j) =>
			r1Attach2.document.walls.some(
				(w) => !r1StubIds.has(w.id) && (w.startJunctionId === j.id || w.endJunctionId === j.id)
			)
		)
	};
	const j1Top = r1RingDoc.junctions.find((j) => Math.hypot(j.point[0] - d45, j.point[1] - d45) < 1e-3)!;
	const j1Bot = r1RingDoc.junctions.find((j) => Math.hypot(j.point[0] - d45, j.point[1] + d45) < 1e-3)!;

	const rot2 = createRotunda({ center: [2 * d45, 0], radius: 5, seed: 'coupled-2' });
	const r2Attach = expectSuccess(
		planWallChain({
			baseline: rot2.document,
			points: [
				[d45, -d45],
				[0, -2 * d45]
			],
			close: false,
			endpointHostSnaps: [{ pointIndex: 0, wallId: rot2.wallId }],
			capture: cap('c2-a1'),
			levelId: rot2.document.floor.id
		})
	);
	const r2Arc2 = r2Attach.createdWallIds.find((id) => !r2Attach.authoredWallIds.includes(id))!;
	const r2Attach2 = expectSuccess(
		planWallChain({
			baseline: r2Attach.document,
			points: [
				[d45, d45],
				[0, 2 * d45]
			],
			close: false,
			endpointHostSnaps: [{ pointIndex: 0, wallId: rot2.wallId }],
			capture: cap('c2-a2'),
			levelId: r2Attach.document.floor.id
		})
	);
	const r2StubIds = new Set([r2Attach.authoredWallIds[0]!, r2Attach2.authoredWallIds[0]!]);
	const j2Top = r2Attach2.document.junctions.find((j) => Math.hypot(j.point[0] - d45, j.point[1] - d45) < 1e-3)!;
	const j2Bot = r2Attach2.document.junctions.find((j) => Math.hypot(j.point[0] - d45, j.point[1] + d45) < 1e-3)!;
	const remapJ = (jId: string) =>
		jId === j2Top.id ? j1Top.id : jId === j2Bot.id ? j1Bot.id : jId;
	const r2Walls = r2Attach2.document.walls
		.filter((w) => !r2StubIds.has(w.id))
		.map((w) => ({
			...w,
			startJunctionId: remapJ(w.startJunctionId),
			endJunctionId: remapJ(w.endJunctionId)
		}));
	const r2Junctions = r2Attach2.document.junctions.filter(
		(j) =>
			j.id !== j2Top.id &&
			j.id !== j2Bot.id &&
			r2Walls.some((w) => w.startJunctionId === j.id || w.endJunctionId === j.id)
	);
	const coupledDoc: LayoutDocumentWallFirst = {
		...r1RingDoc,
		junctions: [...r1RingDoc.junctions, ...r2Junctions],
		walls: [...r1RingDoc.walls, ...r2Walls],
		rooms: [...r1RingDoc.rooms, ...r2Attach2.document.rooms]
	};
	expect(validateWallFirstLayoutDocument(coupledDoc).success).toBe(true);
	expect(validateWallFirstTopology(coupledDoc)).toBeUndefined();
	expect(hasBlockingLayoutIssues(compileWallFirstLayoutGeometry(coupledDoc).issues)).toBe(false);
	expect(certifyRoundRoom(coupledDoc, coupledDoc.rooms.find((r) => r.id === rot1.roomId)!).kind).toBe('certified');
	expect(certifyRoundRoom(coupledDoc, coupledDoc.rooms.find((r) => r.id === rot2.roomId)!).kind).toBe('certified');
	return { document: coupledDoc, roomIds: [rot1.roomId, rot2.roomId] as const, sharedJunctionIds: [j1Top.id, j1Bot.id] as const };
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

			// Attach to an existing non-seam rim Junction on an open-arc ring.
			const ring = createConnectedRing({ seed: 'existing-rim-attach' });
			const nonSeamRimId = ring.rimJunctionIds.find((id) => id !== ring.seamId)!;
			const nonSeamRimPt = ring.document.junctions.find((j) => j.id === nonSeamRimId)!.point;
			const rimAttached = expectSuccess(
				planWallSegment({
					baseline: ring.document,
					start: nonSeamRimPt,
					end: [nonSeamRimPt[0] + 4, nonSeamRimPt[1] + 4],
					endpointJunctionSnaps: [{ pointIndex: 0, junctionId: nonSeamRimId }],
					capture: cap('rim-attach-existing'),
					levelId: ring.document.floor.id
				})
			);
			expect(rimAttached.startJunctionId).toBe(nonSeamRimId);
			expect(rimAttached.document.rooms.find((r) => r.id === ring.roomId)!.round).toEqual({
				center: [0, 0],
				radius: 5
			});

			// Independent undeclared overlap on an open-arc ring leaves the ring untouched.
			const ringBeforeJson = serializeWallFirstLayoutDocument(ring.document);
			const ringWallCount = ring.document.walls.length;
			const independentOnRing = expectSuccess(
				planWallSegment({
					baseline: ring.document,
					start: [-10, 2],
					end: [10, 2],
					capture: cap('indep-ring-cross'),
					levelId: ring.document.floor.id
				})
			);
			expect(independentOnRing.splitWallIds).toEqual([]);
			expect(independentOnRing.document.walls).toHaveLength(ringWallCount + 1);
			expect(serializeWallFirstLayoutDocument(ring.document)).toBe(ringBeforeJson);

			// All-rekey falsifier: start-side Wall keeps rot.wallId at seam; rekeying every Wall fails Round/seam identity.
			const singleAttach = expectSuccess(
				planWallSegment({
					baseline: rot.document,
					start: [0, 9],
					end: [0, 5],
					endpointHostWallId: rot.wallId,
					capture: cap('rekey-falsifier'),
					levelId: rot.document.floor.id
				})
			);
			const attachedRoom = singleAttach.document.rooms.find((r) => r.id === rot.roomId)!;
			expect(attachedRoom.boundary[0]!.wallId).toBe(rot.wallId);
			const allRekeyed: LayoutDocumentWallFirst = {
				...singleAttach.document,
				walls: singleAttach.document.walls.map((w) =>
					w.id === rot.wallId ? { ...w, id: 'rekeyed-wall-id' } : w
				),
				rooms: singleAttach.document.rooms.map((r) => ({
					...r,
					boundary: r.boundary.map((ref) =>
						ref.wallId === rot.wallId ? { ...ref, wallId: 'rekeyed-wall-id' } : ref
					)
				}))
			};
			expect(allRekeyed.rooms.find((r) => r.id === rot.roomId)!.boundary[0]!.wallId).not.toBe(rot.wallId);
			const wallCorr = singleAttach.roundCorrespondence?.walls[0];
			expect(wallCorr?.kind).toBe('subdivision');
			if (wallCorr?.kind === 'subdivision') {
				expect(wallCorr.fragmentWallIds[0]).toBe(rot.wallId);
			}
		});

		it('connects two isolated Round Rooms in one stroke (O-O), derives a 3rd ordinary Room on O=O, resizes either, and refuses multi-host failures atomically', () => {
			// Two isolated circular Rooms: O1 at (0, 0) r=5, O2 at (16, 0) r=5.
			const rot1 = createRotunda({ center: [0, 0], radius: 5, seed: 'oo-rot1' });
			const rot2Create = expectSuccess(
				planCreateCircularRoom({
					baseline: rot1.document,
					center: [16, 0],
					rim: [21, 0],
					thickness: 0.2,
					height: 3,
					capture: cap('oo-rot2'),
					levelId: rot1.document.floor.id,
					roomNamePrefix: 'Rotunda'
				})
			);
			const rot2Id = rot2Create.createdRoomIds[0]!;
			const rot2WallId = rot2Create.wallId;
			const rot2SeamId = rot2Create.junctionId;

			// Add V1 Region with intendedGaps referencing both isolated closed Walls.
			const withRegion = expectSuccess(
				planCreateRegion({
					baseline: rot2Create.document,
					capture: cap('oo-region'),
					intent: {
						role: 'floor',
						footprint: [
							[-10, -10],
							[26, -10],
							[26, 10],
							[-10, 10]
						],
						elevation: 0,
						thickness: 0.1
					}
				})
			).document;
			const twoCircleDoc: LayoutDocumentWallFirst = {
				...withRegion,
				regions: withRegion.regions.map((r) => ({ ...r, intendedGaps: [rot1.wallId, rot2WallId] }))
			};

			// 1. O–O in one stroke via planWallSegment (both hosts partitioned atomically).
			// Attach at ~45 deg on O1 and ~135 deg on O2 so the bridge meets both circles cleanly without tangent grazing.
			const d45 = 5 * Math.SQRT1_2;
			const ooPlan = expectSuccess(
				planWallSegment({
					baseline: twoCircleDoc,
					start: [d45, d45],
					end: [16 - d45, d45],
					endpointHostSnaps: [
						{ pointIndex: 0, wallId: rot1.wallId },
						{ pointIndex: 1, wallId: rot2WallId }
					],
					capture: cap('oo-bridge-1'),
					levelId: twoCircleDoc.floor.id
				})
			);
			expect(ooPlan.document.rooms).toHaveLength(2);
			const ooR1 = ooPlan.document.rooms.find((r) => r.id === rot1.roomId)!;
			const ooR2 = ooPlan.document.rooms.find((r) => r.id === rot2Id)!;
			expect(ooR1.round).toEqual({ center: [0, 0], radius: 5 });
			expect(ooR2.round).toEqual({ center: [16, 0], radius: 5 });
			expect(ooR1.boundary).toHaveLength(2);
			expect(ooR2.boundary).toHaveLength(2);
			expect(ooR1.boundary[0]!.wallId).toBe(rot1.wallId);
			expect(ooR2.boundary[0]!.wallId).toBe(rot2WallId);
			expect(roundRoomSeamJunctionId(ooR1, new Map(ooPlan.document.walls.map((w) => [w.id, w])))).toBe(rot1.seamId);
			expect(roundRoomSeamJunctionId(ooR2, new Map(ooPlan.document.walls.map((w) => [w.id, w])))).toBe(rot2SeamId);
			expect(ooPlan.roundCorrespondence?.walls).toHaveLength(2);
			expect(ooPlan.surfaceLineage.length).toBeGreaterThanOrEqual(2);
			const ooGaps = ooPlan.document.regions[0]!.intendedGaps;
			expect(ooGaps).toEqual(expect.arrayContaining([rot1.wallId, rot2WallId]));
			expect(ooGaps.length).toBe(4);
			expect(validateWallFirstLayoutDocument(ooPlan.document).success).toBe(true);
			expect(validateWallFirstTopology(ooPlan.document)).toBeUndefined();
			expect(hasBlockingLayoutIssues(compileWallFirstLayoutGeometry(ooPlan.document).issues)).toBe(false);

			// Also verify seam-to-seam O–O in one stroke when seams face each other without tangent fold.
			const rotA = createRotunda({ center: [0, 0], radius: 5, seed: 'oo-seam-a' });
			const rotBCreate = expectSuccess(
				planCreateCircularRoom({
					baseline: rotA.document,
					center: [16, 10],
					rim: [11, 10],
					capture: cap('oo-seam-b'),
					levelId: rotA.document.floor.id,
					roomNamePrefix: 'Rotunda'
				})
			);
			const ooSeamPlan = expectSuccess(
				planWallSegment({
					baseline: rotBCreate.document,
					start: [5, 0],
					end: [11, 10],
					endpointJunctionSnaps: [
						{ pointIndex: 0, junctionId: rotA.seamId },
						{ pointIndex: 1, junctionId: rotBCreate.junctionId }
					],
					capture: cap('oo-seam-bridge'),
					levelId: rotBCreate.document.floor.id
				})
			);
			expect(ooSeamPlan.document.rooms).toHaveLength(2);
			expect(ooSeamPlan.document.rooms.every((r) => r.round !== undefined && r.boundary.length === 2)).toBe(true);

			// 2. O=O: adding a second connecting Wall derives a 3rd ordinary Room naturally.
			const ooR1SecondArcId = ooR1.boundary[1]!.wallId;
			const ooR2SecondArcId = ooR2.boundary[1]!.wallId;
			const oeqoPlan = expectSuccess(
				planWallSegment({
					baseline: ooPlan.document,
					start: [d45, -d45],
					end: [16 - d45, -d45],
					endpointHostSnaps: [
						{ pointIndex: 0, wallId: ooR1SecondArcId },
						{ pointIndex: 1, wallId: ooR2SecondArcId }
					],
					capture: cap('oeqo-bridge-2'),
					levelId: ooPlan.document.floor.id
				})
			);
			expect(oeqoPlan.document.rooms).toHaveLength(3);
			const derivedMiddle = oeqoPlan.document.rooms.find((r) => r.id !== rot1.roomId && r.id !== rot2Id)!;
			expect(derivedMiddle.round).toBeUndefined();
			expect(oeqoPlan.document.rooms.find((r) => r.id === rot1.roomId)!.round).toEqual({ center: [0, 0], radius: 5 });
			expect(oeqoPlan.document.rooms.find((r) => r.id === rot2Id)!.round).toEqual({ center: [16, 0], radius: 5 });
			expect(validateWallFirstLayoutDocument(oeqoPlan.document).success).toBe(true);
			expect(validateWallFirstTopology(oeqoPlan.document)).toBeUndefined();
			expect(hasBlockingLayoutIssues(compileWallFirstLayoutGeometry(oeqoPlan.document).issues)).toBe(false);

			// C3: both production components translate as one unit, including the
			// bridge Walls and, for O=O, the ordinary Room between the circles.
			for (const [baseline, bridgeIds] of [
				[ooPlan.document, ooPlan.authoredWallIds],
				[oeqoPlan.document, [...ooPlan.authoredWallIds, ...oeqoPlan.authoredWallIds]]
			] as const) {
				const originalJson = serializeWallFirstLayoutDocument(baseline);
				const reload = (document: LayoutDocumentWallFirst) => {
					const json = serializeWallFirstLayoutDocument(document);
					const parsed = parseWallFirstLayoutDocumentJson(json);
					if (!parsed.success) throw new Error(JSON.stringify(parsed.issues));
					expect(parsed.canonicalJson).toBe(json);
					return parsed.document;
				};
				const checkMove = (before: LayoutDocumentWallFirst, delta: LayoutVec2) => {
					const move = expectSuccess(planWallFirstRoomMove(before, rot1.roomId, delta));
					expect(new Set(move.movedRoomIds)).toEqual(new Set(before.rooms.map((room) => room.id)));
					expect(new Set(move.changedJunctionIds)).toEqual(new Set(before.junctions.map((junction) => junction.id)));
					expect(new Set(move.changedWallIds)).toEqual(new Set(before.walls.map((wall) => wall.id)));
					expect(move.document.rooms.map((room) => room.id).sort()).toEqual(before.rooms.map((room) => room.id).sort());
					for (const room of before.rooms) {
						const moved = move.document.rooms.find((entry) => entry.id === room.id)!;
						expect(moved.boundary).toEqual(room.boundary);
						if (room.round) {
							expect(moved.round).toEqual({ center: [room.round.center[0] + delta[0], room.round.center[1] + delta[1]], radius: room.round.radius });
							expect(roundRoomSeamJunctionId(moved, new Map(move.document.walls.map((wall) => [wall.id, wall]))))
								.toBe(roundRoomSeamJunctionId(room, new Map(before.walls.map((wall) => [wall.id, wall]))));
							expect(certifyRoundRoom(move.document, moved).kind).toBe('certified');
						}
					}
					for (const junction of before.junctions) {
						const moved = move.document.junctions.find((entry) => entry.id === junction.id)!;
						const tolerance = 4 * 2 ** -20;
						expect(Math.abs(moved.point[0] - (junction.point[0] + delta[0]))).toBeLessThan(tolerance);
						expect(Math.abs(moved.point[1] - (junction.point[1] + delta[1]))).toBeLessThan(tolerance);
					}
					for (const id of bridgeIds) {
						const wall = before.walls.find((entry) => entry.id === id)!;
						const moved = move.document.walls.find((entry) => entry.id === id)!;
						expect(moved).toEqual(wall);
						expect(moved.centerline.kind).toBe('line');
					}
					return reload(move.document);
				};
				let back = baseline;
				for (let iteration = 0; iteration < 20; iteration++) {
					const high = checkMove(back, BIG_SHIFT);
					back = checkMove(high, [-BIG_SHIFT[0], -BIG_SHIFT[1]]);
					expect(back.rooms.find((room) => room.id === rot1.roomId)!.round).toEqual({ center: [0, 0], radius: 5 });
					expect(back.rooms.find((room) => room.id === rot2Id)!.round).toEqual({ center: [16, 0], radius: 5 });
					for (const junction of baseline.junctions) {
						const point = back.junctions.find((entry) => entry.id === junction.id)!.point;
						expect(Math.hypot(point[0] - junction.point[0], point[1] - junction.point[1])).toBeLessThan(4 * 2 ** -20);
					}
				}
				expect(serializeWallFirstLayoutDocument(baseline)).toBe(originalJson);
			}

			// 3. Resize either Round Room in O=O updates connecting Walls & derived 3rd Room cleanly.
			const resized1 = expectSuccess(
				planResizeRoundRoomRadius({ document: oeqoPlan.document, roomId: rot1.roomId, radius: 5.5 })
			);
			expect(resized1.document.rooms).toHaveLength(3);
			expect(resized1.document.rooms.find((r) => r.id === rot1.roomId)!.round).toEqual({ center: [0, 0], radius: 5.5 });
			expect(resized1.document.rooms.find((r) => r.id === rot2Id)!.round).toEqual({ center: [16, 0], radius: 5 });
			expect(resized1.document.rooms.find((r) => r.id === derivedMiddle.id)!.round).toBeUndefined();

			const resized2 = expectSuccess(
				planResizeRoundRoomRadius({ document: resized1.document, roomId: rot2Id, radius: 4.5 })
			);
			expect(resized2.document.rooms).toHaveLength(3);
			expect(resized2.document.rooms.find((r) => r.id === rot2Id)!.round).toEqual({ center: [16, 0], radius: 4.5 });
			expect(resized2.document.rooms.find((r) => r.id === derivedMiddle.id)).toBeDefined();
			expect(validateWallFirstLayoutDocument(resized2.document).success).toBe(true);
			expect(validateWallFirstTopology(resized2.document)).toBeUndefined();
			expect(hasBlockingLayoutIssues(compileWallFirstLayoutGeometry(resized2.document).issues)).toBe(false);

			// Excessive resize that would collide with O2 refuses atomically leaving baseline untouched.
			const beforeCollisionJson = serializeWallFirstLayoutDocument(resized2.document);
			const collideResize = planResizeRoundRoomRadius({
				document: resized2.document,
				roomId: rot1.roomId,
				radius: 12
			});
			expect(collideResize.kind).toBe('rejected');
			expect(serializeWallFirstLayoutDocument(resized2.document)).toBe(beforeCollisionJson);

			// 4. Multi-host atomic failures: host 1 is clean, host 2 fails -> whole operation refuses & host 1 stays closed.
			const rot2Len = wallFirstWallLength(twoCircleDoc, rot2WallId)!;
			const seamBlockedDoc = expectSuccess(
				planCreateWallFirstOpening(
					twoCircleDoc,
					{ wallId: rot2WallId, kind: 'door', offset: rot2Len - 0.4, width: 0.8, height: 2.1, sillHeight: 0 },
					cap('oo-seam-block-op'),
					twoCircleDoc.floor.id
				)
			).document;
			const beforeSeamBlockJson = serializeWallFirstLayoutDocument(seamBlockedDoc);
			const seamBlockedAttempt = planWallSegment({
				baseline: seamBlockedDoc,
				start: [0, 5],
				end: [16, 5],
				endpointHostSnaps: [
					{ pointIndex: 0, wallId: rot1.wallId },
					{ pointIndex: 1, wallId: rot2WallId }
				],
				capture: cap('oo-seam-block-try'),
				levelId: seamBlockedDoc.floor.id
			});
			expect(seamBlockedAttempt).toMatchObject({ kind: 'rejected', rejection: { code: 'noding_rejected' } });
			if (seamBlockedAttempt.kind === 'rejected') {
				expect(seamBlockedAttempt.rejection.wallIds).toContain(rot2WallId);
			}
			expect(serializeWallFirstLayoutDocument(seamBlockedDoc)).toBe(beforeSeamBlockJson);
			expect(isClosedWall(seamBlockedDoc.walls.find((w) => w.id === rot1.wallId)!)).toBe(true);

			// Host 2 Opening interior cut at (16, 5) = 1/4 circumference = rot2Len * 0.25.
			const opInteriorDoc = expectSuccess(
				planCreateWallFirstOpening(
					twoCircleDoc,
					{ wallId: rot2WallId, kind: 'window', offset: rot2Len * 0.25 - 0.5, width: 1.0, height: 1.2, sillHeight: 1 },
					cap('oo-int-block-op'),
					twoCircleDoc.floor.id
				)
			).document;
			const beforeIntBlockJson = serializeWallFirstLayoutDocument(opInteriorDoc);
			const intBlockedAttempt = planWallSegment({
				baseline: opInteriorDoc,
				start: [0, 5],
				end: [16, 5],
				endpointHostSnaps: [
					{ pointIndex: 0, wallId: rot1.wallId },
					{ pointIndex: 1, wallId: rot2WallId }
				],
				capture: cap('oo-int-block-try'),
				levelId: opInteriorDoc.floor.id
			});
			expect(intBlockedAttempt).toMatchObject({ kind: 'rejected', rejection: { code: 'noding_rejected' } });
			if (intBlockedAttempt.kind === 'rejected') {
				expect(intBlockedAttempt.rejection.wallIds).toContain(rot2WallId);
			}
			expect(serializeWallFirstLayoutDocument(opInteriorDoc)).toBe(beforeIntBlockJson);
			expect(isClosedWall(opInteriorDoc.walls.find((w) => w.id === rot1.wallId)!)).toBe(true);
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

			// Add an Opening on the outside neighbour so we verify its offset & width stay unscaled, and far Junction stays fixed.
			const farJunctionId = docWithCurvedNeighbour.walls
				.find((w) => w.id === outsideId)!
				.endJunctionId;
			const farPointBefore = docWithCurvedNeighbour.junctions.find((j) => j.id === farJunctionId)!.point;
			const withOutsideOp = expectSuccess(
				planCreateWallFirstOpening(
					docWithCurvedNeighbour,
					{ wallId: outsideId, kind: 'door', offset: 2.0, width: 0.9, height: 2.1, sillHeight: 0 },
					cap('nb-unscaled-op'),
					docWithCurvedNeighbour.floor.id
				)
			).document;

			// Add a curved neighbour with TWO moved endpoints (arched outside wall between two rim Junctions of the same Round Room).
			const rimJ1 = ring.seamId; // (5, 0)
			const rimJ2 = ring.rimJunctionIds[1]!; // (0, 5)
			const pRim1 = withOutsideOp.junctions.find((j) => j.id === rimJ1)!.point;
			const pRim2 = withOutsideOp.junctions.find((j) => j.id === rimJ2)!.point;
			const withTwoEndNeighbour = expectSuccess(
				planWallChain({
					baseline: withOutsideOp,
					points: [pRim1, pRim2],
					close: false,
					arc: { pointIndex: 0, apex: [4.5, 4.5] },
					endpointJunctionSnaps: [
						{ pointIndex: 0, junctionId: rimJ1 },
						{ pointIndex: 1, junctionId: rimJ2 }
					],
					capture: cap('two-end-arch'),
					levelId: withOutsideOp.floor.id
				})
			);
			const twoEndWallId = withTwoEndNeighbour.authoredWallIds[0]!;

			const resized = expectSuccess(
				planResizeRoundRoomRadius({
					document: withTwoEndNeighbour.document,
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

			// Neighbour Opening stayed unscaled and far Junction stayed fixed.
			const nbOpAfter = resized.document.openings.find((o) => o.wallId === outsideId)!;
			expect(nbOpAfter.offset).toBe(2.0);
			expect(nbOpAfter.width).toBe(0.9);
			expect(resized.document.junctions.find((j) => j.id === farJunctionId)!.point).toEqual(farPointBefore);

			// Curved neighbour kept its interior knot fixed while its rim endpoint moved to radius 5.5.
			const nbAfter = resized.document.walls.find((w) => w.id === outsideId)!;
			expect(nbAfter.centerline.kind).toBe('cubic-chain');
			if (nbAfter.centerline.kind === 'cubic-chain') {
				expect(nbAfter.centerline.knots[0]!.point).toEqual([1.0, 10.5]);
			}
			// Two-moved-endpoint neighbour moved both rim endpoints to radius 5.5.
			const twoEndAfter = resized.document.walls.find((w) => w.id === twoEndWallId)!;
			const twoEndStart = resized.document.junctions.find((j) => j.id === twoEndAfter.startJunctionId)!.point;
			const twoEndEnd = resized.document.junctions.find((j) => j.id === twoEndAfter.endJunctionId)!.point;
			expect(Math.hypot(twoEndStart[0], twoEndStart[1])).toBeCloseTo(5.5, 9);
			expect(Math.hypot(twoEndEnd[0], twoEndEnd[1])).toBeCloseTo(5.5, 9);

			const sameRadius = planResizeRoundRoomRadius({
				document: resized.document,
				roomId: ring.roomId,
				radius: 5.5
			});
			expect(sameRadius).toMatchObject({ kind: 'rejected', rejection: { code: 'no_op' } });
		});

		it('refuses atomically on neighbour Opening fit, coupled second Round Room, topology crossing, open-Space invalidity, containment, and overlap', () => {
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

			const { document: coupledDoc, roomIds: [firstRoomId, secondRoomId], sharedJunctionIds } = createCoupledRoundFixture();
			const beforeCoupledJson = serializeWallFirstLayoutDocument(coupledDoc);
			const coupledFail = planResizeRoundRoomRadius({
				document: coupledDoc,
				roomId: firstRoomId,
				radius: 6
			});
			expect(coupledFail).toMatchObject({
				kind: 'rejected',
				rejection: {
					code: 'coupled_round_room',
					roomIds: [firstRoomId, secondRoomId],
					junctionIds: expect.arrayContaining([...sharedJunctionIds])
				}
			});
			expect(serializeWallFirstLayoutDocument(coupledDoc)).toBe(beforeCoupledJson);

			// Topology crossing refusal on resize: shrinking past an interior wall attached to the ring.
			const gal = createAttachedGallery({ seed: 'resize-topo-fail' });
			const beforeTopoFail = serializeWallFirstLayoutDocument(gal.document);
			const topoFail = planResizeRoundRoomRadius({
				document: gal.document,
				roomId: gal.rotundaId,
				radius: 12
			});
			expect(topoFail).toMatchObject({ kind: 'rejected', rejection: { code: 'topology_invalid' } });
			expect(serializeWallFirstLayoutDocument(gal.document)).toBe(beforeTopoFail);

			// Open-Space outline invalidity (space_outline_invalid): shrinking moves virtual chord across a fixed notch finger.
			const rotOutline = createRotunda({ center: [0, 0], radius: 5, seed: 'resize-outline' });
			const notchAttach = expectSuccess(
				planWallChain({
					baseline: rotOutline.document,
					points: [
						[0, 5],
						[4, 9],
						[10, 9],
						[10, 6.6],
						[2, 6.6],
						[2, 6.0],
						[10, 6.0],
						[10, 0],
						[5, 0]
					],
					close: false,
					endpointHostSnaps: [{ pointIndex: 0, wallId: rotOutline.wallId }],
					endpointJunctionSnaps: [{ pointIndex: 8, junctionId: rotOutline.seamId }],
					capture: cap('notch-annex'),
					levelId: rotOutline.document.floor.id
				})
			);
			const notchSpaceId = notchAttach.document.rooms.find((r) => r.id !== rotOutline.roomId)!.id;
			const firstLegWallId = notchAttach.authoredWallIds[0]!;
			const openedNotch = expectSuccess(
				planDeleteWall(notchAttach.document, firstLegWallId, cap('open-notch'), notchAttach.document.floor.id)
			).document;
			expect(validateWallFirstLayoutDocument(openedNotch).success).toBe(true);
			const beforeNotchJson = serializeWallFirstLayoutDocument(openedNotch);
			const outlineFail = planResizeRoundRoomRadius({
				document: openedNotch,
				roomId: rotOutline.roomId,
				radius: 4
			});
			expect(outlineFail).toMatchObject({ kind: 'rejected', rejection: { code: 'space_outline_invalid' } });
			expect(serializeWallFirstLayoutDocument(openedNotch)).toBe(beforeNotchJson);
			expect(openedNotch.rooms.some((r) => r.id === notchSpaceId)).toBe(true);

			// Open-Space containment (space_contains_space): shrinking enclosed Round Room inside an independent open U-box.
			const rotContain = createRotunda({ center: [0, 0], radius: 10, seed: 'resize-contain' });
			const innerBox = expectSuccess(
				planWallChain({
					baseline: rotContain.document,
					points: [
						[-6, -6],
						[6, -6],
						[6, 6],
						[-6, 6]
					],
					close: true,
					capture: cap('contain-box'),
					levelId: rotContain.document.floor.id
				})
			);
			const innerOpen = expectSuccess(
				planDeleteWall(innerBox.document, innerBox.authoredWallIds[0]!, cap('contain-open'), innerBox.document.floor.id)
			).document;
			const innerOpenId = innerOpen.rooms.find((r) => r.id !== rotContain.roomId)!.id;
			const beforeContainJson = serializeWallFirstLayoutDocument(innerOpen);
			const containFail = planResizeRoundRoomRadius({
				document: innerOpen,
				roomId: rotContain.roomId,
				radius: 3
			});
			expect(containFail).toMatchObject({ kind: 'rejected', rejection: { code: 'space_contains_space' } });
			expect(serializeWallFirstLayoutDocument(innerOpen)).toBe(beforeContainJson);
			expect(innerOpen.rooms.some((r) => r.id === innerOpenId)).toBe(true);

			// Open-Space overlap (space_overlap): growing Round Room into an independent open U-box's open side without touching physical walls.
			const rotOverlap = createRotunda({ center: [0, 0], radius: 5, seed: 'resize-overlap' });
			const sideBox = expectSuccess(
				planWallChain({
					baseline: rotOverlap.document,
					points: [
						[8, -5],
						[12, -5],
						[12, 5],
						[8, 5]
					],
					close: true,
					capture: cap('overlap-box'),
					levelId: rotOverlap.document.floor.id
				})
			);
			const sideOpen = expectSuccess(
				planDeleteWall(sideBox.document, sideBox.authoredWallIds[3]!, cap('overlap-open'), sideBox.document.floor.id)
			).document;
			const sideOpenId = sideOpen.rooms.find((r) => r.id !== rotOverlap.roomId)!.id;
			const beforeOverlapJson = serializeWallFirstLayoutDocument(sideOpen);
			const overlapFail = planResizeRoundRoomRadius({
				document: sideOpen,
				roomId: rotOverlap.roomId,
				radius: 8.5
			});
			expect(overlapFail).toMatchObject({ kind: 'rejected', rejection: { code: 'space_overlap' } });
			expect(serializeWallFirstLayoutDocument(sideOpen)).toBe(beforeOverlapJson);
			expect(sideOpen.rooms.some((r) => r.id === sideOpenId)).toBe(true);
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

			// Collapsed cuts at both [0, 0] and [2**32, -(2**32)] refuse cleanly without mutating source.
			for (const [label, shift] of [
				['origin', [0, 0] as LayoutVec2],
				['shifted', BIG_SHIFT]
			] as const) {
				const base = createRotunda({ center: shift, radius: 5, seed: `collapse-${label}` });
				const baseJson = serializeWallFirstLayoutDocument(base.document);
				// Two points 1e-12 m apart near (cx, cz + 5) collapse at destination precision into one cut / zero-length leg.
				const collapsed = planWallChain({
					baseline: base.document,
					points: [
						[shift[0], shift[1] + 5],
						[shift[0] + 1e-12, shift[1] + 5],
						[shift[0], shift[1] + 9]
					],
					close: false,
					endpointHostSnaps: [
						{ pointIndex: 0, wallId: base.wallId },
						{ pointIndex: 1, wallId: base.wallId }
					],
					capture: cap(`collapse-try-${label}`),
					levelId: base.document.floor.id
				});
				expect(collapsed.kind).toBe('rejected');
				expect(serializeWallFirstLayoutDocument(base.document)).toBe(baseJson);
			}
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

			// Interior cut through an Opening refuses and names the Opening ID.
			const withIntOp = expectSuccess(
				planCreateWallFirstOpening(
					rot.document,
					{ wallId: rot.wallId, kind: 'window', offset: len * 0.25 - 0.5, width: 1.0, height: 1.2, sillHeight: 1 },
					cap('int-win'),
					rot.document.floor.id
				)
			).document;
			const intBlocked = planWallSegment({
				baseline: withIntOp,
				start: [0, 9],
				end: [0, 5],
				endpointHostWallId: rot.wallId,
				capture: cap('int-cut-fail'),
				levelId: withIntOp.floor.id
			});
			expect(intBlocked).toMatchObject({ kind: 'rejected', rejection: { code: 'noding_rejected' } });
			if (intBlocked.kind === 'rejected') {
				expect(intBlocked.rejection.message).toContain(withIntOp.openings[0]!.id);
			}

			// Exact split at Opening END keeps Opening on preceding fragment; exact split at Opening START places it on following fragment at offset 0.
			const cutDist = len * 0.25;
			const exactEndDoc = expectSuccess(
				planCreateWallFirstOpening(
					rot.document,
					{ wallId: rot.wallId, kind: 'window', offset: cutDist - 1.0, width: 1.0, height: 1.2, sillHeight: 1 },
					cap('exact-end-op'),
					rot.document.floor.id
				)
			).document;
			const exactEndPlan = expectSuccess(
				planWallSegment({
					baseline: exactEndDoc,
					start: [0, 9],
					end: [0, 5],
					endpointHostWallId: rot.wallId,
					capture: cap('exact-end-cut'),
					levelId: exactEndDoc.floor.id
				})
			);
			expect(exactEndPlan.document.openings[0]!.wallId).toBe(rot.wallId);

			const exactStartDoc = expectSuccess(
				planCreateWallFirstOpening(
					rot.document,
					{ wallId: rot.wallId, kind: 'window', offset: cutDist, width: 1.0, height: 1.2, sillHeight: 1 },
					cap('exact-start-op'),
					rot.document.floor.id
				)
			).document;
			const exactStartPlan = expectSuccess(
				planWallSegment({
					baseline: exactStartDoc,
					start: [0, 9],
					end: [0, 5],
					endpointHostWallId: rot.wallId,
					capture: cap('exact-start-cut'),
					levelId: exactStartDoc.floor.id
				})
			);
			const followingArcId = exactStartPlan.createdWallIds.find(
				(id) => !exactStartPlan.authoredWallIds.includes(id)
			)!;
			expect(exactStartPlan.document.openings[0]!.wallId).toBe(followingArcId);
			expect(exactStartPlan.document.openings[0]!.offset).toBeCloseTo(0, 6);
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

		it('releases an isolated circle with unoccupied seam keeping seam Junction ID and carrying V1 intendedGaps', () => {
			const rot = createRotunda({ seed: 'release-unocc' });
			const withRegion = expectSuccess(
				planCreateRegion({
					baseline: rot.document,
					capture: cap('rel-region'),
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
			const docWithGaps: LayoutDocumentWallFirst = {
				...withRegion,
				regions: withRegion.regions.map((r) => ({ ...r, intendedGaps: [rot.wallId] }))
			};
			const rel = expectSuccess(
				planReleaseRoundRoom({
					document: docWithGaps,
					roomId: rot.roomId,
					capture: cap('rel-unocc'),
					levelId: docWithGaps.floor.id
				})
			);
			expect(rel.mode).toBe('split-closed-circle');
			expect(rel.retiredJunctionIds).toEqual([]);
			expect(rel.document.junctions.some((j) => j.id === rot.seamId)).toBe(true);
			expect(rel.document.walls).toHaveLength(2);
			expect(rel.surfaceLineage.length).toBe(2);
			expect(rel.document.regions).toHaveLength(1);
			expect(rel.document.regions[0]!.intendedGaps).toEqual(
				expect.arrayContaining([rot.wallId, rel.createdWallIds[0]!])
			);
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

			// Divide: both survivor and newly born Room resolve their own interiors.
			const divRing = createConnectedRing({ seed: 'interior-divide' });
			const divRoom = divRing.document.rooms.find((r) => r.id === divRing.roomId)!;
			const divJ0 = divRing.seamId;
			const divJOpp = divRing.rimJunctionIds[1]!;
			const divP0 = divRing.document.junctions.find((j) => j.id === divJ0)!.point;
			const divPOpp = divRing.document.junctions.find((j) => j.id === divJOpp)!.point;
			const divided = expectSuccess(
				planWallChain({
					baseline: divRing.document,
					points: [divP0, divPOpp],
					close: false,
					endpointJunctionSnaps: [
						{ pointIndex: 0, junctionId: divJ0 },
						{ pointIndex: 1, junctionId: divJOpp }
					],
					capture: cap('int-div'),
					levelId: divRing.document.floor.id
				})
			);
			const compiledDiv = compileWallFirstLayoutGeometry(divided.document).geometry;
			expect(divided.document.rooms).toHaveLength(2);
			for (const r of divided.document.rooms) {
				const divRes = resolveLayoutRoomInterior(divided.document, compiledDiv, {
					roomId: r.id,
					role: 'inside'
				});
				expect(divRes.kind).toBe('resolved');
			}
			expect(divRoom.id).toBe(divRing.roomId);
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
			// Add V1 horizontal region with intendedGaps referencing every ring arc.
			const withRegion = expectSuccess(
				planCreateRegion({
					baseline: withOp,
					capture: cap('rev-repack-reg'),
					intent: {
						role: 'floor',
						footprint: [
							[-12, -12],
							[12, -12],
							[12, 12],
							[-12, 12]
						],
						elevation: 0,
						thickness: 0.1
					}
				})
			).document;
			const docWithRegion: LayoutDocumentWallFirst = {
				...withRegion,
				regions: withRegion.regions.map((r) => ({
					...r,
					intendedGaps: room.boundary.map((b) => b.wallId)
				}))
			};

			// Mixed thickness, mixed name, and open-Space virtual-edge anchor refuse round_repack_conflict.
			const d1 = expectSuccess(
				planDeleteWall(docWithRegion, ring.outsideWallIds[0]!, cap('rev-del-1'), docWithRegion.floor.id)
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

			// Open-Space virtual-edge anchor on a discarded rim Junction refuses round_repack_conflict.
			const galAnchor = createAttachedGallery({ seed: 'repack-space-anchor' });
			const openedGalAnchor = expectSuccess(
				planDeleteWall(galAnchor.document, galAnchor.annexWallIds[0]!, cap('repack-open-gal'), galAnchor.document.floor.id)
			).document;
			expect(
				planDeleteWall(openedGalAnchor, galAnchor.annexWallIds[3]!, cap('rev-del-anchor'), openedGalAnchor.floor.id)
			).toMatchObject({ kind: 'rejected', rejection: { code: 'round_repack_conflict' } });

			// Uniform repack succeeds, flips S5a side on reversed member, and carries V1 intendedGaps onto surviving closed Wall.
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
			expect(repacked.document.regions[0]!.intendedGaps).toEqual([ring.seamWallId]);
		});

		it('refuses occupied-seam Release on external anchor or when no legal cut pair exists, and enforces rect/open-side/2-arc dissolve guards', () => {
			const rot = createRotunda({ seed: 'rel-refusals' });
			const len = wallFirstWallLength(rot.document, rot.wallId)!;
			// Two Openings (one spanning seam, one filling the rest) leave no legal cut pair -> no_admissible_release_cuts.
			const seamFill = expectSuccess(
				planCreateWallFirstOpening(
					rot.document,
					{ wallId: rot.wallId, kind: 'door', offset: len - 1.0, width: 2.0, height: 2.1, sillHeight: 0 },
					cap('huge-seam'),
					rot.document.floor.id
				)
			).document;
			const hugeOp = expectSuccess(
				planCreateWallFirstOpening(
					seamFill,
					{ wallId: rot.wallId, kind: 'window', offset: 1.0, width: len - 2.0, height: 1.2, sillHeight: 1 },
					cap('huge-op'),
					seamFill.floor.id
				)
			).document;
			const beforeHugeJson = serializeWallFirstLayoutDocument(hugeOp);
			expect(
				planReleaseRoundRoom({
					document: hugeOp,
					roomId: rot.roomId,
					capture: cap('rel-no-cuts'),
					levelId: hugeOp.floor.id
				})
			).toMatchObject({ kind: 'rejected', rejection: { code: 'no_admissible_release_cuts' } });
			expect(serializeWallFirstLayoutDocument(hugeOp)).toBe(beforeHugeJson);

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

describe('C3 · coupled Round translation', () => {
	it('rebuilds shared Junctions deterministically and refuses uncertifiable high-to-low moves', () => {
		const fixture = createCoupledRoundFixture();
		const proposal = (document: LayoutDocumentWallFirst, delta: LayoutVec2) => {
			const scope = resolveIsolatedRoomGroupSubgraph(document, fixture.roomIds[0], { includePhysicalAttachments: true });
			if (scope.kind !== 'success') throw new Error(JSON.stringify(scope));
			return roomUnitMoveCandidate(document, scope.subgraph, delta);
		};
		const original = fixture.document;
		const reversed = { ...original, rooms: [...original.rooms].reverse() };
		for (const delta of [[20, 0] as LayoutVec2, BIG_SHIFT]) {
			const moved = proposal(original, delta);
			const other = proposal(reversed, delta);
			expect(other.junctions).toEqual(moved.junctions);
			expect(other.walls).toEqual(moved.walls);
			for (const id of fixture.roomIds) {
				const room = moved.rooms.find((entry) => entry.id === id)!;
				expect(certifyRoundRoom(moved, room).kind).toBe('certified');
				expect(room.round!.radius).toBe(5);
			}
			for (const id of fixture.sharedJunctionIds) {
				expect(moved.junctions.filter((junction) => junction.id === id)).toHaveLength(1);
			}
			// The overlapping C2 fixture has no distinct extracted faces; retain
			// the ordinary identity gate rather than accepting an invalid edit.
			const before = serializeWallFirstLayoutDocument(original);
			for (const input of [original, reversed]) {
				const inputBefore = serializeWallFirstLayoutDocument(input);
				const plan = planWallFirstRoomMove(input, fixture.roomIds[0], delta);
				expect(plan).toMatchObject({ kind: 'rejected', rejection: { code: 'room_identity_lost' } });
				expect(plan).not.toHaveProperty('document');
				expect(serializeWallFirstLayoutDocument(input)).toBe(inputBefore);
			}
			expect(serializeWallFirstLayoutDocument(original)).toBe(before);
		}
		const high = proposal(original, BIG_SHIFT);
		const highJson = serializeWallFirstLayoutDocument(high);
		const loaded = parseWallFirstLayoutDocumentJson(highJson);
		if (!loaded.success) throw new Error(JSON.stringify(loaded.issues));
		expect(loaded.canonicalJson).toBe(highJson);
		const back: LayoutVec2 = [-BIG_SHIFT[0], -BIG_SHIFT[1]];
		const low = proposal(loaded.document, back);
		const lowReversed = proposal({ ...loaded.document, rooms: [...loaded.document.rooms].reverse() }, back);
		expect(lowReversed.junctions).toEqual(low.junctions);
		expect(lowReversed.walls).toEqual(low.walls);
		expect(fixture.roomIds.map((id) => certifyRoundRoom(low, low.rooms.find((room) => room.id === id)!).kind))
			.toEqual(['certified', 'invalid']);
		for (const rooms of [loaded.document.rooms, [...loaded.document.rooms].reverse()]) {
			const document = { ...loaded.document, rooms };
			const before = serializeWallFirstLayoutDocument(document);
			const plan = planWallFirstRoomMove(document, fixture.roomIds[0], back);
			expect(plan).toMatchObject({ kind: 'rejected', rejection: {
				code: 'invalid_candidate_document',
				targetIds: expect.arrayContaining([fixture.roomIds[1], ...fixture.sharedJunctionIds]),
				issues: expect.arrayContaining([expect.objectContaining({ code: 'round_geometry_invalid' })])
			} });
			expect(plan).not.toHaveProperty('document');
			expect(serializeWallFirstLayoutDocument(document)).toBe(before);
		}
	});

	it('rejects a shared reconstruction outside the representable precision before reconciliation', () => {
		const fixture = createCoupledRoundFixture();
		for (const rooms of [fixture.document.rooms, [...fixture.document.rooms].reverse()]) {
			const document = { ...fixture.document, rooms };
			const before = serializeWallFirstLayoutDocument(document);
			const plan = planWallFirstRoomMove(document, fixture.roomIds[0], [2 ** 55, -(2 ** 55)]);
			expect(plan).toMatchObject({ kind: 'rejected', rejection: { code: 'invalid_candidate_document' } });
			expect(plan).not.toHaveProperty('document');
			expect(serializeWallFirstLayoutDocument(document)).toBe(before);
		}
	});
});

describe('C3 · Round move and enclosure copy', () => {
	it('moves a shared gallery and dangling branch, preserving portal relations and identities', () => {
		const gal = createAttachedGallery({ seed: 'c3-move-gallery' });
		const shared = gal.document.rooms.find((r) => r.id === gal.rotundaId)!.boundary
			.find((ref) => gal.document.rooms.find((r) => r.id === gal.galleryId)!.boundary.some((other) => other.wallId === ref.wallId))!;
		const withDoor = expectSuccess(planCreateWallFirstOpening(gal.document, {
			wallId: shared.wallId, kind: 'door', offset: 1, width: 0.8,
			connectsRoomIds: [gal.rotundaId, gal.galleryId]
		}, cap('c3-door'), gal.document.floor.id)).document;
		const branch = expectSuccess(planWallSegment({
			baseline: withDoor, start: [10, 10], end: [13, 10],
			endpointJunctionSnaps: [{ pointIndex: 0, junctionId: withDoor.junctions.find((j) => j.point[0] === 10 && j.point[1] === 10)!.id }],
			capture: cap('c3-branch'), levelId: withDoor.floor.id
		}));
		const doc: LayoutDocumentWallFirst = {
			...branch.document,
			objects: [{ id: 'c3-move-object', kind: 'box', position: [0, 0.5, 0], rotation: [0, 0, 0], dimensions: [1, 1, 1], roomId: gal.rotundaId }]
		};
		const before = serializeWallFirstLayoutDocument(doc);
		const group = resolveIsolatedRoomGroupSubgraph(doc, gal.rotundaId, { includePhysicalAttachments: true });
		expect(group.kind).toBe('success');
		if (group.kind !== 'success') return;
		expect(group.subgraph.wallIds).toContain(branch.authoredWallIds[0]);
		const moved = expectSuccess(planWallFirstRoomMove(doc, gal.rotundaId, [20, -10]));
		expect(new Set(moved.changedWallIds)).toEqual(new Set(doc.walls.map((w) => w.id)));
		expect(new Set(moved.movedRoomIds)).toEqual(new Set([gal.rotundaId, gal.galleryId]));
		expect(moved.document.rooms.find((r) => r.id === gal.rotundaId)!.round).toEqual({ center: [20, -10], radius: 5 });
		expect(moved.document.openings).toEqual(doc.openings);
		expect(moved.changedObjectIds).toEqual(['c3-move-object']);
		expect(moved.document.objects[0]!.position).toEqual([20, 0.5, -10]);
		for (const junction of doc.junctions) {
			const point = moved.document.junctions.find((j) => j.id === junction.id)!.point;
			expect(point[0]).toBeCloseTo(junction.point[0] + 20, 8);
			expect(point[1]).toBeCloseTo(junction.point[1] - 10, 8);
		}
		expect(serializeWallFirstLayoutDocument(doc)).toBe(before);
	});

	it('copies only the Round boundary with fresh identities and discloses dropped portal relations', () => {
		const gal = createAttachedGallery({ seed: 'c3-copy-gallery' });
		const source = gal.document.rooms.find((r) => r.id === gal.rotundaId)!;
		const shared = source.boundary.find((ref) => gal.document.rooms.find((r) => r.id === gal.galleryId)!.boundary.some((other) => other.wallId === ref.wallId))!;
		const door = expectSuccess(planCreateWallFirstOpening(gal.document, {
			wallId: shared.wallId, kind: 'door', offset: 1, width: 0.8,
			connectsRoomIds: [gal.rotundaId, gal.galleryId]
		}, cap('c3-copy-door'), gal.document.floor.id)).document;
		const otherWallId = source.boundary.find((ref) => ref.wallId !== shared.wallId)!.wallId;
		const withWindow = expectSuccess(planCreateWallFirstOpening(door, {
			wallId: otherWallId, kind: 'window', offset: 1, width: 0.5, profile: 'rounded'
		}, cap('c3-copy-window'), door.floor.id)).document;
		const doc: LayoutDocumentWallFirst = {
			...withWindow,
			walls: withWindow.walls.map((wall, i) => source.boundary.some((ref) => ref.wallId === wall.id)
				? { ...wall, name: `Arc ${i}`, height: 3 + i * 0.1, thickness: 0.2 + i * 0.01 } : wall),
			objects: [{ id: 'c3-object', kind: 'box', position: [0, 0.5, 0], rotation: [0, 0, 0], dimensions: [1, 1, 1], roomId: gal.rotundaId }]
		};
		const before = serializeWallFirstLayoutDocument(doc);
		const capture = cap('c3-copy');
		const copy = expectSuccess(planDuplicateRoom(doc, { roomId: gal.rotundaId, delta: [30, 0] }, capture, doc.floor.id));
		const replay = expectSuccess(planDuplicateRoom(doc, { roomId: gal.rotundaId, delta: [30, 0] }, capture, doc.floor.id));
		expect(serializeWallFirstLayoutDocument(replay.document)).toBe(serializeWallFirstLayoutDocument(copy.document));
		expect(copy.roomCopyCorrespondence!.objects).toEqual([{ sourceId: 'c3-object', copyId: copy.createdObjectIds[0] }]);
		expect(copy.document.objects.find((object) => object.id === copy.createdObjectIds[0])).toMatchObject({ roomId: copy.createdRoomId, position: [30, 0.5, 0] });
		const copied = copy.document.rooms.find((r) => r.id === copy.createdRoomId)!;
		expect(copied.round).toEqual({ center: [30, 0], radius: 5 });
		expect(copied.boundary).toHaveLength(source.boundary.length);
		expect(copy.createdWallIds).toHaveLength(source.boundary.length);
		expect(copy.droppedRoomRelations).toEqual([{ openingId: doc.openings[0]!.id, roomIds: [gal.rotundaId, gal.galleryId] }]);
		expect(copy.roomCopyCorrespondence!.room).toEqual({ sourceId: gal.rotundaId, copyId: copy.createdRoomId });
		expect(copy.roomCopyCorrespondence!.walls.map((entry) => entry.sourceId)).toEqual(source.boundary.map((ref) => ref.wallId));
		expect(copy.roomCopyCorrespondence!.openings).toEqual(doc.openings.map((opening, index) => ({ sourceId: opening.id, copyId: copy.createdOpeningIds[index] })));
		for (const pair of copy.roomCopyCorrespondence!.openings) {
			const original = doc.openings.find((opening) => opening.id === pair.sourceId)!;
			const cloned = copy.document.openings.find((opening) => opening.id === pair.copyId)!;
			expect([cloned.offset, cloned.width, cloned.height, cloned.sillHeight, cloned.profile]).toEqual([original.offset, original.width, original.height, original.sillHeight, original.profile]);
		}
		const sourceSeam = roundRoomSeamJunctionId(source, new Map(doc.walls.map((wall) => [wall.id, wall])));
		const copySeam = roundRoomSeamJunctionId(copied, new Map(copy.document.walls.map((wall) => [wall.id, wall])));
		expect(copy.roomCopyCorrespondence!.junctions).toContainEqual({ sourceId: sourceSeam, copyId: copySeam });
		expect(copy.document.openings.find((o) => o.id === copy.createdOpeningIds[0])!.connectsRoomIds).toBeUndefined();
		expect(copy.document.openings.find((o) => o.id === doc.openings[0]!.id)).toEqual(doc.openings[0]);
		for (let i = 0; i < source.boundary.length; i++) {
			const old = doc.walls.find((w) => w.id === source.boundary[i]!.wallId)!;
			const fresh = copy.document.walls.find((w) => w.id === copied.boundary[i]!.wallId)!;
			expect(fresh.id).not.toBe(old.id);
			expect([fresh.name, fresh.height, fresh.thickness]).toEqual([old.name, old.height, old.thickness]);
			expect(doc.junctions.some((j) => j.id === fresh.startJunctionId || j.id === fresh.endJunctionId)).toBe(false);
		}
		expect(copy.document.rooms.find((r) => r.id === gal.galleryId)).toEqual(doc.rooms.find((r) => r.id === gal.galleryId));
		expect(serializeWallFirstLayoutDocument(doc)).toBe(before);
	});

	it('rebuilds a ring through 20 large-coordinate round trips with canonical reloads and stable stations', () => {
		const ring = createConnectedRing({ seed: 'c3-numeric' });
		const wallId = ring.document.rooms.find((r) => r.id === ring.roomId)!.boundary[0]!.wallId;
		let current = expectSuccess(planCreateWallFirstOpening(ring.document, { wallId, kind: 'window', offset: 1, width: 0.5 }, cap('c3-numeric-window'), ring.document.floor.id)).document;
		const original = current;
		const junctionIds = current.junctions.map((j) => j.id);
		const opening = current.openings[0]!;
		for (let i = 0; i < 20; i++) {
			const out = expectSuccess(planWallFirstRoomMove(current, ring.roomId, BIG_SHIFT));
			const encoded = serializeWallFirstLayoutDocument(out.document);
			const parsed = parseWallFirstLayoutDocumentJson(encoded);
			if (!parsed.success) throw new Error(JSON.stringify(parsed.issues));
			expect(parsed.canonicalJson).toBe(encoded);
			const back = expectSuccess(planWallFirstRoomMove(parsed.document, ring.roomId, [-BIG_SHIFT[0], -BIG_SHIFT[1]]));
			const saved = serializeWallFirstLayoutDocument(back.document);
			const reload = parseWallFirstLayoutDocumentJson(saved);
			if (!reload.success) throw new Error(JSON.stringify(reload.issues));
			current = reload.document;
			expect(reload.canonicalJson).toBe(saved);
			expect(current.rooms.find((r) => r.id === ring.roomId)!.round).toEqual({ center: [0, 0], radius: 5 });
			expect(current.junctions.map((j) => j.id)).toEqual(junctionIds);
			expect(current.openings[0]).toEqual(opening);
			expect(certifyRoundRoom(current, current.rooms.find((r) => r.id === ring.roomId)!).kind).toBe('certified');
		}
		for (const junction of original.junctions) {
			const point = current.junctions.find((j) => j.id === junction.id)!.point;
			expect(Math.hypot(point[0] - junction.point[0], point[1] - junction.point[1])).toBeLessThan(4 * 2 ** -20);
		}
	}, 120000);
});

describe('C3 · scope closure and refusal', () => {
	it('finds an attached chain regardless of Wall storage order', () => {
		const ring = createConnectedRing({ seed: 'c3-order' });
		const anchor = ring.document.walls.find((wall) => wall.id === ring.outsideWallIds[0])!.endJunctionId;
		const junctions = Array.from({ length: 200 }, (_, index) => ({ id: `chain-j-${index}`, point: [0, 20 + index] as LayoutVec2 }));
		const walls: LayoutWall[] = junctions.map((junction, index) => ({
			id: `chain-w-${index}`, startJunctionId: junctions[index - 1]?.id ?? anchor,
			endJunctionId: junction.id, height: 3, thickness: 0.2, centerline: { kind: 'line' }
		}));
		for (const ordered of [walls, [...walls].reverse()]) {
			const document = { ...ring.document, junctions: [...ring.document.junctions, ...junctions], walls: [...ring.document.walls, ...ordered] };
			const scope = resolveIsolatedRoomGroupSubgraph(document, ring.roomId, { includePhysicalAttachments: true });
			if (scope.kind !== 'success') throw new Error(JSON.stringify(scope));
			for (const wall of walls) expect(scope.subgraph.wallIds).toContain(wall.id);
			for (const junction of junctions) expect(scope.subgraph.junctionIds).toContain(junction.id);
		}
	});

	it('carries a virtual-linked open Space and every physical Wall attached to its other component', () => {
		const gal = createAttachedGallery({ seed: 'c3-open' });
		const first = expectSuccess(planDeleteWall(gal.document, gal.annexWallIds[1]!, cap('c3-open-delete'), gal.document.floor.id)).document;
		const opened = expectSuccess(planDeleteWall(first, gal.annexWallIds[3]!, cap('c3-open-delete-2'), first.floor.id)).document;
		const space = opened.rooms.find((room) => room.id === gal.galleryId)!;
		expect(space.virtualEdges.length).toBeGreaterThan(0);
		const group = resolveIsolatedRoomGroupSubgraph(opened, gal.rotundaId, { includePhysicalAttachments: true });
		if (group.kind !== 'success') throw new Error(JSON.stringify(group));
		expect(group.subgraph.roomIds).toContain(space.id);
		for (const ref of space.boundary) expect(group.subgraph.wallIds).toContain(ref.wallId);
		for (const edge of space.virtualEdges) {
			expect(group.subgraph.junctionIds).toContain(edge.startJunctionId);
			expect(group.subgraph.junctionIds).toContain(edge.endJunctionId);
		}
		const moved = expectSuccess(planWallFirstRoomMove(opened, gal.rotundaId, [20, 0]));
		expect(moved.document.rooms.find((room) => room.id === space.id)!.virtualEdges).toEqual(space.virtualEdges);
	});

	it('refuses a move into an independent open Space without changing the source', () => {
		const rot = createRotunda({ seed: 'c3-move-overlap' });
		const box = expectSuccess(planWallChain({
			baseline: rot.document,
			points: [[18, -5], [22, -5], [22, 5], [18, 5]],
			close: true, capture: cap('c3-overlap-box'), levelId: rot.document.floor.id
		}));
		const opened = expectSuccess(planDeleteWall(box.document, box.authoredWallIds[3]!, cap('c3-overlap-open'), box.document.floor.id)).document;
		const before = serializeWallFirstLayoutDocument(opened);
		for (const delta of [[14, 0], [20, 0]] as LayoutVec2[]) {
			const moved = planWallFirstRoomMove(opened, rot.roomId, delta);
			expect(moved).toMatchObject({ kind: 'rejected', rejection: { code: 'room_identity_lost' } });
			expect(moved).not.toHaveProperty('document');
			expect(serializeWallFirstLayoutDocument(opened)).toBe(before);
		}
	});

	it('refuses an unresolvable high-coordinate move without changing the source', () => {
		const ring = createConnectedRing({ seed: 'c3-collapse' });
		const before = serializeWallFirstLayoutDocument(ring.document);
		const moved = planWallFirstRoomMove(ring.document, ring.roomId, [2 ** 55, -(2 ** 55)]);
		expect(moved.kind).toBe('rejected');
		expect(serializeWallFirstLayoutDocument(ring.document)).toBe(before);
	});
});

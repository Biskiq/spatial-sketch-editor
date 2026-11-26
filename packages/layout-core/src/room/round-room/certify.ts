import type { Iv } from '../../geometry/binary64-interval';
import { ivAdd, ivEncloseWorld, ivMul, ivSub } from '../../geometry/binary64-interval';
import { TEMPLATE_STEP } from '../round-template';
import type { LayoutVec2 } from '../../geometry/coordinates';
import type { LayoutDocumentIssue } from '../../plan/issue';
import type {
	LayoutDocumentWallFirst,
	LayoutJunction,
	LayoutWall,
	LayoutWallFirstRoom,
	OrientedWallRef,
} from '../../wall/types';
import { CLOSED_WALL_CIRCLE_KNOT_COUNT, CLOSED_WALL_CIRCLE_SPAN_COUNT } from '../../wall/types';
import type { UnitCubicIv } from './interval';
import {
	IV_ONE,
	IV_ZERO,
	MIN_RADIUS_THICKNESS_SLACK,
	TEMPLATE_SPAN_COUNT,
	TWO_PI,
	UNIT_TEMPLATE_INTERVALS,
	invertGlobalPolarAngleLower,
	invertGlobalPolarAngleUpper,
	invertLocalPolarAngle,
	ivClamp,
	ivDiv,
	ivIntersect,
	ivMid,
	ivOverlaps,
	ivPoint,
	ivSqrt,
	phaseDirection,
	polarAngleInterval,
	templateSubspanUnitIv,
	unitToLocalIv,
} from './interval';

type RoundSpanCheck = {
	readonly templateSpan: number;
	readonly startStation: number | null;
	readonly endStation: number | null;
	readonly stored: UnitCubicIv;
};

function spanControlsFit(
	check: RoundSpanCheck,
	radius: Iv,
	direction: readonly [Iv, Iv],
	stations: readonly Iv[],
): boolean {
	const u = check.startStation === null ? IV_ZERO : stations[check.startStation]!;
	const v = check.endStation === null ? IV_ONE : stations[check.endStation]!;
	const expected = templateSubspanUnitIv(check.templateSpan, u, v);
	return expected.every(([x, z], i) => {
		const [expectedX, expectedZ] = unitToLocalIv(x, z, radius, direction[0], direction[1]);
		const [storedX, storedZ] = check.stored[i]!;
		return ivOverlaps(storedX, expectedX) && ivOverlaps(storedZ, expectedZ);
	});
}

/**
 * Find one witness for the whole boundary. Independent interval overlaps only
 * rule out a span; they can otherwise accept controls requiring opposite phases
 * or different parameters on the two sides of one cut.
 */
function findRoundWitness(
	checks: readonly RoundSpanCheck[],
	radius: Iv,
	reference: LayoutVec2,
	bounds: readonly Iv[],
	preferred: readonly number[],
): number[] | null {
	// Dimension 0 is the seam angle; the other dimensions are shared cut
	// parameters. Full template spans introduce no dimensions of their own.
	const stack: Array<readonly Iv[]> = [bounds];
	// Fail closed on ill-conditioned inputs. Each box can only shrink the bounds
	// derived from source precision. The common case checks the preferred ray once.
	for (let budget = 128 + 16 * bounds.length; budget > 0 && stack.length > 0; budget--) {
		const box = stack.pop()!;
		const values = box.map((interval, index) => {
			const value = preferred[index]!;
			return interval.lo <= value && value <= interval.hi ? value : ivMid(interval);
		});
		const candidate = values.map(ivPoint);
		const ray = phaseDirection(candidate[0]!, reference);
		const failures = checks.filter((check) => !spanControlsFit(check, radius, ray, candidate));
		if (failures.length === 0) return values;
		const rayBounds = phaseDirection(box[0]!, reference);
		if (failures.some((check) => !spanControlsFit(check, radius, rayBounds, box))) continue;

		// Refine only dimensions that might explain the failing controls. Compare
		// widths in radians so a cut's parameter and the seam phase are comparable.
		let splitIndex = -1;
		let widest = 0;
		for (const check of failures) {
			for (const index of [0, check.startStation, check.endStation]) {
				if (index === null) continue;
				const { lo, hi } = box[index]!;
				const midpoint = ivMid(box[index]!);
				const width = (hi - lo) * (index === 0 ? 1 : TEMPLATE_STEP);
				if (lo < midpoint && midpoint < hi && width > widest) {
					splitIndex = index;
					widest = width;
				}
			}
		}
		if (splitIndex === -1) continue;
		const { lo, hi } = box[splitIndex]!;
		const midpoint = ivMid(box[splitIndex]!);
		const left = box.slice();
		const right = box.slice();
		left[splitIndex] = { lo, hi: midpoint };
		right[splitIndex] = { lo: midpoint, hi };
		// Keep the initially preferred side on top for deterministic edits.
		if (preferred[splitIndex]! <= midpoint) stack.push(right, left);
		else stack.push(left, right);
	}
	return null;
}

// ---------------------------------------------------------------------------
// Public Round Room helpers and certification contract
// ---------------------------------------------------------------------------

/** One certified subspan of a Round Room boundary in traversal order. */
export type CertifiedRoundSubspan = {
	readonly wallId: string;
	readonly direction: 'forward' | 'reverse';
	/** Index of this span within the Wall's canonical `centerline.spans`. */
	readonly wallSpanIndex: number;
	/** Template span index `0..15`. */
	readonly templateSpanIndex: number;
	/** Deterministic representative start parameter in `[0, 1]` on the template span. */
	readonly tStart: number;
	/** Deterministic representative end parameter in `[0, 1]` on the template span. */
	readonly tEnd: number;
};

/** Certified Round Room geometry and seam metadata derived from one accepted Room. */
export type CertifiedRoundRoom = {
	readonly roomId: string;
	readonly center: LayoutVec2;
	readonly radius: number;
	readonly seamJunctionId: string;
	readonly seamPoint: LayoutVec2;
	/** Deterministic unit seam ray `[cos(theta0), sin(theta0)]`. */
	readonly seamDirection: LayoutVec2;
	readonly seamAngleRadians: number;
	/** True when bounded by one canonical 16-span closed Wall. */
	readonly isIsolatedClosedWall: boolean;
	/** Ordered certified template subspans covering `[0, 16]`. */
	readonly subspans: readonly CertifiedRoundSubspan[];
};

export type RoundCertificationResult =
	| { readonly kind: 'certified'; readonly certified: CertifiedRoundRoom }
	| { readonly kind: 'invalid'; readonly issue: LayoutDocumentIssue };

/**
 * The seam Junction ID of a Room boundary: the first oriented start Junction in
 * `room.boundary` traversal order, or `undefined` if unresolved.
 */
export function roundRoomSeamJunctionId(
	room: Pick<LayoutWallFirstRoom, 'boundary'>,
	wallById: ReadonlyMap<string, Pick<LayoutWall, 'startJunctionId' | 'endJunctionId'>>,
): string | undefined {
	const first = room.boundary[0];
	if (!first) return undefined;
	const wall = wallById.get(first.wallId);
	if (!wall) return undefined;
	return first.direction === 'forward' ? wall.startJunctionId : wall.endJunctionId;
}

/**
 * Rotate a Room's `boundary` array so its first oriented start Junction equals
 * `seamJunctionId`, without changing winding or cyclic face key. Returns `null`
 * if `seamJunctionId` does not appear as any oriented start Junction.
 */
export function rotateBoundaryToSeam(
	boundary: readonly OrientedWallRef[],
	seamJunctionId: string,
	wallById: ReadonlyMap<string, Pick<LayoutWall, 'startJunctionId' | 'endJunctionId'>>,
): OrientedWallRef[] | null {
	for (let index = 0; index < boundary.length; index += 1) {
		const ref = boundary[index]!;
		const wall = wallById.get(ref.wallId);
		if (!wall) return null;
		const startId = ref.direction === 'forward' ? wall.startJunctionId : wall.endJunctionId;
		if (startId === seamJunctionId) {
			return [...boundary.slice(index), ...boundary.slice(0, index)];
		}
	}
	return null;
}

/** Find the enclosing Room (if any) whose boundary references `wallId`. */
export function findEnclosingRoundRoomForWall(
	document: Pick<LayoutDocumentWallFirst, 'rooms'>,
	wallId: string,
): LayoutWallFirstRoom | undefined {
	return document.rooms.find(
		(room) => room.round !== undefined && room.boundary.some((ref) => ref.wallId === wallId),
	);
}

/** True when `room.boundary` is one closed Wall (`startJunctionId === endJunctionId`). */
export function isEnclosedClosedCircleBoundary(
	room: Pick<LayoutWallFirstRoom, 'boundary'>,
	wallById: ReadonlyMap<string, Pick<LayoutWall, 'startJunctionId' | 'endJunctionId'>>,
): boolean {
	if (room.boundary.length !== 1) return false;
	const wall = wallById.get(room.boundary[0]!.wallId);
	return wall !== undefined && wall.startJunctionId === wall.endJunctionId;
}

type OrientedCubicEntry = {
	readonly wallId: string;
	readonly direction: 'forward' | 'reverse';
	readonly wallSpanIndex: number;
	readonly p0: LayoutVec2;
	readonly p1: LayoutVec2;
	readonly p2: LayoutVec2;
	readonly p3: LayoutVec2;
};

/**
 * Certify one Round Room against its stored `round: { center, radius }` and
 * seam-anchored boundary using centre-local binary64 uncertainty bounds.
 */
export function certifyRoundRoom(
	document: Pick<LayoutDocumentWallFirst, 'junctions' | 'walls'>,
	room: LayoutWallFirstRoom,
	roomPath = `$.rooms.${room.id}`,
	maps?: {
		junctionById?: ReadonlyMap<string, LayoutJunction>;
		wallById?: ReadonlyMap<string, LayoutWall>;
	},
): RoundCertificationResult {
	const fail = (path: string, code: string, message: string): RoundCertificationResult => ({
		kind: 'invalid',
		issue: { path, code, message },
	});

	const round = room.round;
	if (!round) {
		return fail(
			`${roomPath}.round`,
			'missing_round_fact',
			`Room '${room.id}' is missing required round metadata`,
		);
	}
	const { center, radius } = round;
	if (
		!Number.isFinite(center[0]) ||
		!Number.isFinite(center[1]) ||
		!Number.isFinite(radius) ||
		!(radius > 0)
	) {
		return fail(
			`${roomPath}.round`,
			'invalid_value',
			`Room '${room.id}' has invalid round centre or radius`,
		);
	}
	if (room.virtualEdges.length > 0) {
		return fail(
			`${roomPath}.round`,
			'round_room_virtual_edges',
			`Round Room '${room.id}' cannot have virtual edges`,
		);
	}
	if (room.boundary.length === 0) {
		return fail(
			`${roomPath}.boundary`,
			'round_room_invalid_boundary',
			`Round Room '${room.id}' must have a closed boundary`,
		);
	}

	const junctionById =
		maps?.junctionById ?? new Map(document.junctions.map((j) => [j.id, j] as const));
	const wallById = maps?.wallById ?? new Map(document.walls.map((w) => [w.id, w] as const));

	const isSingleClosed = isEnclosedClosedCircleBoundary(room, wallById);
	const visitedStartJunctions = new Set<string>();
	let expectedStartId: string | undefined;
	let firstStartId: string | undefined;
	const cubics: OrientedCubicEntry[] = [];

	for (let refIndex = 0; refIndex < room.boundary.length; refIndex += 1) {
		const ref = room.boundary[refIndex]!;
		const wall = wallById.get(ref.wallId);
		if (!wall) {
			return fail(
				`${roomPath}.boundary[${refIndex}].wallId`,
				'missing_reference',
				`Unknown wallId '${ref.wallId}'`,
			);
		}
		if (wall.centerline.kind !== 'cubic-chain') {
			return fail(
				`${roomPath}.round`,
				'round_room_non_cubic',
				`Round Room '${room.id}' boundary Wall '${wall.id}' must use a cubic-chain centerline`,
			);
		}
		if (radius <= wall.thickness / 2 + MIN_RADIUS_THICKNESS_SLACK) {
			return fail(
				`${roomPath}.round.radius`,
				'round_radius_too_small',
				`Round Room '${room.id}' radius ${radius} m must exceed half of Wall '${wall.id}' thickness (${wall.thickness} m)`,
			);
		}
		const wallClosed = wall.startJunctionId === wall.endJunctionId;
		if (isSingleClosed) {
			if (
				wall.centerline.knots.length !== CLOSED_WALL_CIRCLE_KNOT_COUNT ||
				wall.centerline.spans.length !== CLOSED_WALL_CIRCLE_SPAN_COUNT
			) {
				return fail(
					`${roomPath}.round`,
					'round_geometry_invalid',
					`Closed circular Wall '${wall.id}' must carry exactly ${CLOSED_WALL_CIRCLE_SPAN_COUNT} spans`,
				);
			}
		} else if (wallClosed) {
			return fail(
				`${roomPath}.boundary[${refIndex}]`,
				'round_room_invalid_boundary',
				`Multi-Wall Round Room '${room.id}' cannot include closed Wall '${wall.id}'`,
			);
		}

		const startJunctionId = ref.direction === 'forward' ? wall.startJunctionId : wall.endJunctionId;
		const endJunctionId = ref.direction === 'forward' ? wall.endJunctionId : wall.startJunctionId;
		if (firstStartId === undefined) firstStartId = startJunctionId;
		if (expectedStartId !== undefined && expectedStartId !== startJunctionId) {
			return fail(
				`${roomPath}.boundary`,
				'round_room_invalid_boundary',
				`Round Room '${room.id}' boundary does not form a closed cycle`,
			);
		}
		if (visitedStartJunctions.has(startJunctionId)) {
			return fail(
				`${roomPath}.boundary`,
				'round_room_invalid_boundary',
				`Round Room '${room.id}' boundary must be a simple cycle without repeated Junctions`,
			);
		}
		visitedStartJunctions.add(startJunctionId);
		expectedStartId = endJunctionId;

		const startPoint = junctionById.get(wall.startJunctionId)?.point;
		const endPoint = junctionById.get(wall.endJunctionId)?.point;
		if (!startPoint || !endPoint) {
			return fail(
				`${roomPath}.boundary[${refIndex}]`,
				'missing_reference',
				`Wall '${wall.id}' references an unknown Junction`,
			);
		}

		const chainPoints: LayoutVec2[] = [
			startPoint,
			...wall.centerline.knots.map((k) => k.point),
			endPoint,
		];
		const spanCount = wall.centerline.spans.length;
		if (ref.direction === 'forward') {
			for (let s = 0; s < spanCount; s += 1) {
				const span = wall.centerline.spans[s]!;
				cubics.push({
					wallId: wall.id,
					direction: 'forward',
					wallSpanIndex: s,
					p0: chainPoints[s]!,
					p1: span.handleOut,
					p2: span.handleIn,
					p3: chainPoints[s + 1]!,
				});
			}
		} else {
			for (let s = spanCount - 1; s >= 0; s -= 1) {
				const span = wall.centerline.spans[s]!;
				cubics.push({
					wallId: wall.id,
					direction: 'reverse',
					wallSpanIndex: s,
					p0: chainPoints[s + 1]!,
					p1: span.handleIn,
					p2: span.handleOut,
					p3: chainPoints[s]!,
				});
			}
		}
	}

	if (firstStartId === undefined || expectedStartId !== firstStartId) {
		return fail(
			`${roomPath}.boundary`,
			'round_room_invalid_boundary',
			`Round Room '${room.id}' boundary does not close at its seam Junction`,
		);
	}
	if (cubics.length < TEMPLATE_SPAN_COUNT) {
		return fail(
			`${roomPath}.round`,
			'round_geometry_invalid',
			`Round Room '${room.id}' has ${cubics.length} cubic span(s); at least ${TEMPLATE_SPAN_COUNT} are required`,
		);
	}

	const seamJunction = junctionById.get(firstStartId)!;
	const seamPoint: LayoutVec2 = [seamJunction.point[0], seamJunction.point[1]];

	// Step 1: Centre-local coordinates and seam-ray normalization with binary64 uncertainty.
	const cxIv = ivPoint(center[0]);
	const czIv = ivPoint(center[1]);
	const radiusIv = ivPoint(radius);
	const toLocalIv = (pt: LayoutVec2): readonly [Iv, Iv] => [
		ivSub(ivEncloseWorld(pt[0]), cxIv),
		ivSub(ivEncloseWorld(pt[1]), czIv),
	];

	const [seamLx, seamLz] = toLocalIv(seamPoint);
	const seamLenSq = ivAdd(ivMul(seamLx, seamLx), ivMul(seamLz, seamLz));
	const seamLen = ivSqrt(seamLenSq);
	if (!(seamLen.lo > 0)) {
		return fail(
			`${roomPath}.round`,
			'round_geometry_invalid',
			`Round Room '${room.id}' seam point cannot be resolved from centre at current coordinate precision`,
		);
	}
	if (!ivOverlaps(seamLen, radiusIv)) {
		return fail(
			`${roomPath}.round`,
			'round_geometry_invalid',
			`Round Room '${room.id}' seam point does not lie on the stated radius`,
		);
	}
	const uxRaw = ivDiv(seamLx, seamLen);
	const uzRaw = ivDiv(seamLz, seamLen);
	if (!uxRaw || !uzRaw) {
		return fail(
			`${roomPath}.round`,
			'round_geometry_invalid',
			`Round Room '${room.id}' seam ray cannot be normalized`,
		);
	}
	const uxIv = ivClamp(uxRaw, -1, 1);
	const uzIv = ivClamp(uzRaw, -1, 1);

	// Deterministic representative seam ray from the stored seam point minus centre.
	const seamDxRep = seamPoint[0] - center[0];
	const seamDzRep = seamPoint[1] - center[1];
	const seamLenRep = Math.hypot(seamDxRep, seamDzRep);
	if (!(seamLenRep > 0) || !Number.isFinite(seamLenRep)) {
		return fail(
			`${roomPath}.round`,
			'round_geometry_invalid',
			`Round Room '${room.id}' seam ray is degenerate`,
		);
	}
	const seamReference: LayoutVec2 = [seamDxRep / seamLenRep, seamDzRep / seamLenRep];
	const referenceX = ivPoint(seamReference[0]);
	const referenceZ = ivPoint(seamReference[1]);
	const phaseBounds = polarAngleInterval(
		ivAdd(ivMul(seamLx, referenceX), ivMul(seamLz, referenceZ)),
		ivSub(ivMul(seamLz, referenceX), ivMul(seamLx, referenceZ)),
		0,
	);
	if (!phaseBounds) {
		return fail(
			`${roomPath}.round`,
			'round_geometry_invalid',
			`Round Room '${room.id}' seam phase cannot be resolved`,
		);
	}

	// Step 2: Walk the M = cubics.length oriented spans and compute one shared
	// station bracket per endpoint vertex V_0.. V_M.
	const M = cubics.length;
	const vertexLocalIv: Array<readonly [Iv, Iv]> = new Array(M + 1);
	const vertexStationIv: Iv[] = new Array(M + 1);
	vertexLocalIv[0] = [seamLx, seamLz];
	vertexLocalIv[M] = [seamLx, seamLz];
	vertexStationIv[0] = IV_ZERO;
	vertexStationIv[M] = { lo: TEMPLATE_SPAN_COUNT, hi: TEMPLATE_SPAN_COUNT };

	let prevAngleHint = 0;
	for (let k = 1; k < M; k += 1) {
		const [lx, lz] = toLocalIv(cubics[k]!.p0);
		vertexLocalIv[k] = [lx, lz];
		// Rotate into the seam-aligned frame: (ax, az) = R(-theta0) * (lx, lz).
		const ax = ivAdd(ivMul(lx, uxIv), ivMul(lz, uzIv));
		const az = ivSub(ivMul(lz, uxIv), ivMul(lx, uzIv));
		const angleIv = polarAngleInterval(ax, az, prevAngleHint);
		if (!angleIv) {
			return fail(
				`${roomPath}.round`,
				'round_geometry_invalid',
				`Round Room '${room.id}' boundary vertex ${k} cannot be resolved from centre`,
			);
		}
		// Must stay in positive CCW walk (0, 2π) and not regress.
		if (angleIv.hi <= 0 || angleIv.lo >= TWO_PI) {
			return fail(
				`${roomPath}.round`,
				'round_geometry_invalid',
				`Round Room '${room.id}' boundary vertex ${k} falls outside positive circular traversal`,
			);
		}
		const clampedLo = Math.max(0, angleIv.lo);
		const clampedHi = Math.min(TWO_PI, angleIv.hi);
		const sLo = invertGlobalPolarAngleLower(clampedLo);
		const sHi = invertGlobalPolarAngleUpper(clampedHi);
		if (sHi < vertexStationIv[k - 1]!.lo) {
			return fail(
				`${roomPath}.round`,
				'round_geometry_invalid',
				`Round Room '${room.id}' boundary vertices are not ordered along the circular template`,
			);
		}
		vertexStationIv[k] = { lo: sLo, hi: sHi };
		prevAngleHint = Math.max(prevAngleHint, ivMid({ lo: clampedLo, hi: clampedHi }));
	}

	/** Check whether vertex `k` covers template boundary `boundaryIndex` (`0..16`). */
	const vertexCoversTemplateBoundary = (k: number, boundaryIndex: number): boolean => {
		const sIv = vertexStationIv[k]!;
		if (sIv.lo > boundaryIndex || sIv.hi < boundaryIndex) return false;
		const [lx, lz] = vertexLocalIv[k]!;
		const unitBoundary =
			boundaryIndex === TEMPLATE_SPAN_COUNT
				? UNIT_TEMPLATE_INTERVALS[0]![0]
				: UNIT_TEMPLATE_INTERVALS[boundaryIndex]![0];
		const [ex, ez] = unitToLocalIv(unitBoundary[0], unitBoundary[1], radiusIv, uxIv, uzIv);
		return ivOverlaps(lx, ex) && ivOverlaps(lz, ez);
	};

	// Step 2 & 3: Monotone walk through the 16 template spans, certifying all 4
	// de Casteljau control points of every cubic subspan.
	const subspans: CertifiedRoundSubspan[] = [];
	const checks: RoundSpanCheck[] = [];
	const witnessBounds = [phaseBounds];
	const preferred = [0];
	let templateSpan = 0;
	let currentStartT: Iv = IV_ZERO;
	let currentStartRep = 0;
	let currentStartStation: number | null = null;

	for (let k = 0; k < M; k += 1) {
		if (templateSpan >= TEMPLATE_SPAN_COUNT) {
			return fail(
				`${roomPath}.round`,
				'round_geometry_invalid',
				`Round Room '${room.id}' has extra cubic spans beyond the 16-span template`,
			);
		}
		const cubic = cubics[k]!;
		const endCoversNextBoundary =
			k === M - 1
				? templateSpan === TEMPLATE_SPAN_COUNT - 1
				: vertexCoversTemplateBoundary(k + 1, templateSpan + 1);

		let endT: Iv;
		let endRep: number;
		let endStation: number | null = null;
		let advanceTemplateSpan = false;

		if (endCoversNextBoundary) {
			// Guard against collapsed cuts: if we are not at the last cubic, the
			// immediately following vertex must NOT also cover this same template
			// boundary, otherwise placement is ambiguous / cuts collapsed.
			if (k < M - 1 && vertexCoversTemplateBoundary(k + 2, templateSpan + 1)) {
				return fail(
					`${roomPath}.round`,
					'round_geometry_invalid',
					`Round Room '${room.id}' has collapsed or ambiguous cuts at template boundary ${templateSpan + 1}`,
				);
			}
			endT = IV_ONE;
			endRep = 1;
			advanceTemplateSpan = true;
		} else {
			if (k === M - 1) {
				return fail(
					`${roomPath}.round`,
					'round_geometry_invalid',
					`Round Room '${room.id}' does not cover all ${TEMPLATE_SPAN_COUNT} template spans`,
				);
			}
			const nextStation = vertexStationIv[k + 1]!;
			const shifted: Iv = {
				lo: nextStation.lo - templateSpan,
				hi: nextStation.hi - templateSpan,
			};
			const clipped = ivIntersect(shifted, { lo: 0, hi: 1 });
			if (!clipped || clipped.hi <= currentStartT.lo) {
				return fail(
					`${roomPath}.round`,
					'round_geometry_invalid',
					`Round Room '${room.id}' span ${k} cannot be placed monotonically in template span ${templateSpan}`,
				);
			}
			// Require disjoint parameter brackets so distinct cuts cannot collapse at
			// the available coordinate resolution.
			if (ivOverlaps(currentStartT, clipped)) {
				return fail(
					`${roomPath}.round`,
					'round_geometry_invalid',
					`Round Room '${room.id}' cuts collapse within template span ${templateSpan} at current coordinate precision`,
				);
			}
			const rep = ivMid(clipped);
			if (!(rep > currentStartRep && rep < 1)) {
				return fail(
					`${roomPath}.round`,
					'round_geometry_invalid',
					`Round Room '${room.id}' cuts collapse within template span ${templateSpan} at current coordinate precision`,
				);
			}
			endT = clipped;
			endRep = rep;
			endStation = witnessBounds.length;
			witnessBounds.push(clipped);
			const dx = cubic.p3[0] - center[0];
			const dz = cubic.p3[1] - center[1];
			const [ux, uz] = seamReference;
			const angle = Math.atan2(dz * ux - dx * uz, dx * ux + dz * uz);
			const spanStart = templateSpan * TEMPLATE_STEP;
			const localAngle = angle + Math.round((spanStart - angle) / TWO_PI) * TWO_PI - spanStart;
			// Refine the measured angle only to choose a candidate inside the
			// certified bracket. The tolerance above still sets its coverage.
			preferred.push(
				Math.max(clipped.lo, Math.min(clipped.hi, ivMid(invertLocalPolarAngle(localAngle, 0)))),
			);
		}

		// Certify all 4 de Casteljau control points against centre-local bounds.
		const unitExpected = templateSubspanUnitIv(templateSpan, currentStartT, endT);
		const stored: UnitCubicIv = [
			vertexLocalIv[k]!,
			toLocalIv(cubic.p1),
			toLocalIv(cubic.p2),
			vertexLocalIv[k + 1]!,
		];
		for (let c = 0; c < 4; c += 1) {
			const [storedX, storedZ] = stored[c]!;
			const [expX, expZ] = unitToLocalIv(
				unitExpected[c]![0],
				unitExpected[c]![1],
				radiusIv,
				uxIv,
				uzIv,
			);
			if (!ivOverlaps(storedX, expX) || !ivOverlaps(storedZ, expZ)) {
				return fail(
					`${roomPath}.round`,
					'round_geometry_invalid',
					`Round Room '${room.id}' Wall '${cubic.wallId}' span ${cubic.wallSpanIndex} control ${c} deviates from the canonical circular template`,
				);
			}
		}
		checks.push({ templateSpan, startStation: currentStartStation, endStation, stored });

		subspans.push({
			wallId: cubic.wallId,
			direction: cubic.direction,
			wallSpanIndex: cubic.wallSpanIndex,
			templateSpanIndex: templateSpan,
			tStart: currentStartRep,
			tEnd: endRep,
		});

		if (advanceTemplateSpan) {
			templateSpan += 1;
			currentStartT = IV_ZERO;
			currentStartRep = 0;
			currentStartStation = null;
		} else {
			currentStartT = endT;
			currentStartRep = endRep;
			currentStartStation = endStation;
		}
	}
	const witness = findRoundWitness(checks, radiusIv, seamReference, witnessBounds, preferred);
	if (!witness) {
		return fail(
			`${roomPath}.round`,
			'round_geometry_invalid',
			`Round Room '${room.id}' has no certifiable common phase and cut partition`,
		);
	}
	const phase = witness[0]!;
	const cos = Math.cos(phase);
	const sin = Math.sin(phase);
	const [ux, uz] = seamReference;
	const seamDirection: LayoutVec2 = [ux * cos - uz * sin, ux * sin + uz * cos];
	for (let k = 0; k < subspans.length; k++) {
		const { startStation, endStation } = checks[k]!;
		const subspan = subspans[k]!;
		subspans[k] = {
			...subspan,
			tStart: startStation === null ? 0 : witness[startStation]!,
			tEnd: endStation === null ? 1 : witness[endStation]!,
		};
	}

	if (templateSpan !== TEMPLATE_SPAN_COUNT) {
		return fail(
			`${roomPath}.round`,
			'round_geometry_invalid',
			`Round Room '${room.id}' covers ${templateSpan} of ${TEMPLATE_SPAN_COUNT} template spans`,
		);
	}

	return {
		kind: 'certified',
		certified: {
			roomId: room.id,
			center: [center[0], center[1]],
			radius,
			seamJunctionId: firstStartId,
			seamPoint,
			seamDirection,
			seamAngleRadians: Math.atan2(seamDirection[1], seamDirection[0]),
			isIsolatedClosedWall: isSingleClosed,
			subspans,
		},
	};
}

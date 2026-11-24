/**
 * `layout-round-room.ts` — canonical Round Room certification, seam lookup, and
 * centre-local template writers.
 *
 * One checker serves both codec admission and planner validation for isolated
 * closed-circle Walls and multi-Wall cubic rings alike. It works in
 * centre-local coordinates with outward-rounded binary64 interval arithmetic
 * derived from each stored world coordinate's adjacent IEEE-754 values. It
 * never fits or infers Round, centre or radius from Wall controls, and never
 * widens bounds in response to a residual.
 */
import { ivAdd, ivEncloseWorld, ivMul, ivSub, nextDown, nextUp, type Iv } from './layout-binary64-interval';
import { TEMPLATE_HANDLE_K, TEMPLATE_STEP, UNIT_TEMPLATE_SCALARS, unitToWorldPoint, type UnitCubicScalar } from './layout-round-template';
import type { LayoutVec2 } from './layout-coordinates';
import { CURVE_ARC_LENGTH_TOLERANCE } from './layout-geometry-curve';
import type { LayoutDocumentIssue } from './layout-issue';
import { JUNCTION_COINCIDENCE_EPSILON } from './layout-junction-identity';
import {
	subdivideWallCubicSpan,
	WALL_CURVE_SPLIT_PARAMETER_TOLERANCE,
	type ResolvedWallSplitResult
} from './layout-wall-curve-algebra';
import {
	CLOSED_WALL_CIRCLE_KNOT_COUNT,
	CLOSED_WALL_CIRCLE_SPAN_COUNT,
	type LayoutDocumentWallFirst,
	type LayoutJunction,
	type LayoutRoomRound,
	type LayoutWall,
	type LayoutWallCenterline,
	type LayoutWallCubicSpan,
	type LayoutWallCurveKnot,
	type LayoutWallFirstRoom,
	type LayoutWallOpening,
	type OrientedWallRef
} from './layout-wall-first-types';

const TWO_PI = Math.PI * 2;
const TEMPLATE_SPAN_COUNT = CLOSED_WALL_CIRCLE_SPAN_COUNT;
const MIN_RADIUS_THICKNESS_SLACK = 1e-6;

const IV_ZERO: Iv = { lo: 0, hi: 0 };
const IV_ONE: Iv = { lo: 1, hi: 1 };

function ivPoint(x: number): Iv {
	return { lo: x, hi: x };
}

function ivDiv(a: Iv, b: Iv): Iv | null {
	if (b.lo <= 0 && b.hi >= 0) return null;
	const q1 = a.lo / b.lo;
	const q2 = a.lo / b.hi;
	const q3 = a.hi / b.lo;
	const q4 = a.hi / b.hi;
	return {
		lo: nextDown(Math.min(q1, q2, q3, q4)),
		hi: nextUp(Math.max(q1, q2, q3, q4))
	};
}

function ivSqrt(a: Iv): Iv {
	return {
		lo: a.lo <= 0 ? 0 : nextDown(Math.sqrt(a.lo)),
		hi: a.hi <= 0 ? 0 : nextUp(Math.sqrt(a.hi))
	};
}

function ivClamp(a: Iv, min: number, max: number): Iv {
	const lo = Math.max(min, Math.min(max, a.lo));
	const hi = Math.max(min, Math.min(max, a.hi));
	return lo <= hi ? { lo, hi } : { lo: hi, hi: lo };
}

function ivOverlaps(a: Iv, b: Iv): boolean {
	return a.lo <= b.hi && b.lo <= a.hi;
}

function ivIntersect(a: Iv, b: Iv): Iv | null {
	const lo = Math.max(a.lo, b.lo);
	const hi = Math.min(a.hi, b.hi);
	return lo <= hi ? { lo, hi } : null;
}

function ivHull(a: Iv, b: Iv): Iv {
	return { lo: Math.min(a.lo, b.lo), hi: Math.max(a.hi, b.hi) };
}

function ivMid(a: Iv): number {
	return a.lo + (a.hi - a.lo) * 0.5;
}

/**
 * Outward-rounded linear interpolation `(1 - t) * a + t * b` for `t ⊆ [0, 1]`.
 *
 * Evaluating at the two endpoints of `t` and taking their hull avoids the
 * interval-dependency inflation of `t` appearing in both `(1 - t)` and `t`.
 */
function ivLerp(a: Iv, b: Iv, t: Iv): Iv {
	const evalAt = (s: number): Iv => {
		if (s === 0) return a;
		if (s === 1) return b;
		const oneMinus = ivSub(IV_ONE, ivPoint(s));
		return ivAdd(ivMul(oneMinus, a), ivMul(ivPoint(s), b));
	};
	if (t.lo === t.hi) return evalAt(t.lo);
	return ivHull(evalAt(t.lo), evalAt(t.hi));
}

// ---------------------------------------------------------------------------
// Canonical 16-span unit circle template in seam-aligned coordinates
// ---------------------------------------------------------------------------

type UnitCubicIv = readonly [
	readonly [Iv, Iv],
	readonly [Iv, Iv],
	readonly [Iv, Iv],
	readonly [Iv, Iv]
];

function trigIv(fn: (x: number) => number, angle: number): Iv {
	const value = fn(angle);
	// Elementary libm trig in binary64 is accurate to <= 1 ULP; 2 ULPs outward
	// conservatively encloses the exact real trigonometric value.
	return ivClamp({ lo: nextDown(nextDown(value)), hi: nextUp(nextUp(value)) }, -1, 1);
}

const TEMPLATE_HANDLE_K_IV: Iv = {
	lo: nextDown(nextDown(TEMPLATE_HANDLE_K)),
	hi: nextUp(nextUp(TEMPLATE_HANDLE_K))
};

const UNIT_TEMPLATE_INTERVALS: readonly UnitCubicIv[] = Array.from(
	{ length: TEMPLATE_SPAN_COUNT },
	(_, index) => {
		const a0 = index * TEMPLATE_STEP;
		const a1 = (index + 1) * TEMPLATE_STEP;
		const c0 = index === 0 ? IV_ONE : trigIv(Math.cos, a0);
		const s0 = index === 0 ? IV_ZERO : trigIv(Math.sin, a0);
		const c1 = index === TEMPLATE_SPAN_COUNT - 1 ? IV_ONE : trigIv(Math.cos, a1);
		const s1 = index === TEMPLATE_SPAN_COUNT - 1 ? IV_ZERO : trigIv(Math.sin, a1);
		const p0 = [c0, s0] as const;
		const p1 = [
			ivSub(c0, ivMul(TEMPLATE_HANDLE_K_IV, s0)),
			ivAdd(s0, ivMul(TEMPLATE_HANDLE_K_IV, c0))
		] as const;
		const p2 = [
			ivAdd(c1, ivMul(TEMPLATE_HANDLE_K_IV, s1)),
			ivSub(s1, ivMul(TEMPLATE_HANDLE_K_IV, c1))
		] as const;
		const p3 = [c1, s1] as const;
		return [p0, p1, p2, p3] as const;
	}
);

/**
 * Evaluate the polar angle of unit template span 0 at parameter `t ∈ [0, 1]`.
 *
 * Strictly monotonically increasing from `0` at `t = 0` to `TEMPLATE_STEP` at
 * `t = 1`.
 */
function unitSpan0PolarAngle(t: number): number {
	if (t <= 0) return 0;
	if (t >= 1) return TEMPLATE_STEP;
	const [p0, p1, p2, p3] = UNIT_TEMPLATE_SCALARS[0]!;
	const u = 1 - t;
	const u2 = u * u;
	const t2 = t * t;
	const x = u2 * u * p0[0] + 3 * u2 * t * p1[0] + 3 * u * t2 * p2[0] + t2 * t * p3[0];
	const z = u2 * u * p0[1] + 3 * u2 * t * p1[1] + 3 * u * t2 * p2[1] + t2 * t * p3[1];
	return Math.atan2(z, x);
}

/**
 * Invert a local polar angle `deltaPhi ∈ [0, TEMPLATE_STEP]` on unit template
 * span 0 via monotone bisection, stopping at
 * `WALL_CURVE_SPLIT_PARAMETER_TOLERANCE`.
 */
function invertLocalPolarAngle(deltaPhi: number, tolerance = WALL_CURVE_SPLIT_PARAMETER_TOLERANCE): Iv {
	if (deltaPhi <= 0) return IV_ZERO;
	if (deltaPhi >= TEMPLATE_STEP) return IV_ONE;
	let lo = 0;
	let hi = 1;
	for (let iter = 0; iter < 64; iter += 1) {
		if (hi - lo <= tolerance) break;
		const mid = lo + (hi - lo) * 0.5;
		if (mid === lo || mid === hi) break;
		if (unitSpan0PolarAngle(mid) < deltaPhi) lo = mid;
		else hi = mid;
	}
	return { lo, hi };
}

/**
 * Invert a seam-aligned polar angle `phi` (possibly slightly outside `[0, 2π]`
 * due to interval padding) into a global template station in `[0, 16]`.
 */
function invertGlobalPolarAngleLower(phi: number): number {
	if (phi <= 0) return 0;
	if (phi >= TWO_PI) return TEMPLATE_SPAN_COUNT;
	const span = Math.min(TEMPLATE_SPAN_COUNT - 1, Math.floor(phi / TEMPLATE_STEP));
	const local = invertLocalPolarAngle(phi - span * TEMPLATE_STEP);
	return span + local.lo;
}

function invertGlobalPolarAngleUpper(phi: number): number {
	if (phi <= 0) return 0;
	if (phi >= TWO_PI) return TEMPLATE_SPAN_COUNT;
	const span = Math.min(TEMPLATE_SPAN_COUNT - 1, Math.floor(phi / TEMPLATE_STEP));
	const local = invertLocalPolarAngle(phi - span * TEMPLATE_STEP);
	return span + local.hi;
}

/**
 * Compute the exact outward-rounded polar angle interval of a 2D interval box
 * `(ax, az)` that does not contain the origin, unwrapped into `[0, 2π]` around
 * the reference angle `hintAngle`.
 */
function polarAngleInterval(ax: Iv, az: Iv, hintAngle: number): Iv | null {
	if (ax.lo <= 0 && ax.hi >= 0 && az.lo <= 0 && az.hi >= 0) return null;
	const corners: readonly [number, number][] = [
		[ax.lo, az.lo],
		[ax.lo, az.hi],
		[ax.hi, az.lo],
		[ax.hi, az.hi]
	];
	let minAngle = Infinity;
	let maxAngle = -Infinity;
	for (const [x, z] of corners) {
		let angle = Math.atan2(z, x);
		// Unwrap near `hintAngle` so the 4 corners stay in one continuous branch.
		while (angle - hintAngle > Math.PI) angle -= TWO_PI;
		while (angle - hintAngle < -Math.PI) angle += TWO_PI;
		if (angle < minAngle) minAngle = angle;
		if (angle > maxAngle) maxAngle = angle;
	}
	// Pad by 2 ULPs for `atan2` rounding.
	return {
		lo: nextDown(nextDown(minAngle)),
		hi: nextUp(nextUp(maxAngle))
	};
}

/** Blossom `B(a, b, c)` of one coordinate of a cubic Bézier curve (interval). */
function blossom1dIv(q0: Iv, q1: Iv, q2: Iv, q3: Iv, a: Iv, b: Iv, c: Iv): Iv {
	const l10 = ivLerp(q0, q1, a);
	const l11 = ivLerp(q1, q2, a);
	const l12 = ivLerp(q2, q3, a);
	const l20 = ivLerp(l10, l11, b);
	const l21 = ivLerp(l11, l12, b);
	return ivLerp(l20, l21, c);
}

/**
 * Outward-rounded de Casteljau subspan control points of unit template span
 * `spanIndex` over parameter interval `[u, v]` (`0 <= u <= v <= 1`).
 */
function templateSubspanUnitIv(spanIndex: number, u: Iv, v: Iv): UnitCubicIv {
	const [p0, p1, p2, p3] = UNIT_TEMPLATE_INTERVALS[spanIndex]!;
	if (u.lo === 0 && u.hi === 0 && v.lo === 1 && v.hi === 1) {
		return [p0, p1, p2, p3];
	}
	const evalPair = (a: Iv, b: Iv, c: Iv): readonly [Iv, Iv] => [
		blossom1dIv(p0[0], p1[0], p2[0], p3[0], a, b, c),
		blossom1dIv(p0[1], p1[1], p2[1], p3[1], a, b, c)
	];
	return [
		evalPair(u, u, u),
		evalPair(u, u, v),
		evalPair(u, v, v),
		evalPair(v, v, v)
	];
}

/** Scalar blossom `B(a, b, c)` for deterministic template writing. */
function blossom1dScalar(q0: number, q1: number, q2: number, q3: number, a: number, b: number, c: number): number {
	const lerp = (x: number, y: number, t: number) => (1 - t) * x + t * y;
	const l10 = lerp(q0, q1, a);
	const l11 = lerp(q1, q2, a);
	const l12 = lerp(q2, q3, a);
	const l20 = lerp(l10, l11, b);
	const l21 = lerp(l11, l12, b);
	return lerp(l20, l21, c);
}

function templateSubspanUnitScalar(spanIndex: number, u: number, v: number): UnitCubicScalar {
	const [p0, p1, p2, p3] = UNIT_TEMPLATE_SCALARS[spanIndex]!;
	if (u === 0 && v === 1) return [p0, p1, p2, p3];
	const evalPt = (a: number, b: number, c: number): LayoutVec2 => [
		blossom1dScalar(p0[0], p1[0], p2[0], p3[0], a, b, c),
		blossom1dScalar(p0[1], p1[1], p2[1], p3[1], a, b, c)
	];
	return [evalPt(u, u, u), evalPt(u, u, v), evalPt(u, v, v), evalPt(v, v, v)];
}

/** Rotate and scale a seam-aligned unit interval point `(qx, qz)` to centre-local. */
function unitToLocalIv(
	qx: Iv,
	qz: Iv,
	radiusIv: Iv,
	ux: Iv,
	uz: Iv
): readonly [Iv, Iv] {
	const rx = ivSub(ivMul(qx, ux), ivMul(qz, uz));
	const rz = ivAdd(ivMul(qx, uz), ivMul(qz, ux));
	return [ivMul(radiusIv, rx), ivMul(radiusIv, rz)];
}

/** Trig range on an unwrapped phase bracket, including interior extrema. */
function phaseDirection(phase: Iv, reference: LayoutVec2): readonly [Iv, Iv] {
	const range = (fn: (x: number) => number, peak: number): Iv => {
		const ends = ivHull(trigIv(fn, phase.lo), trigIv(fn, phase.hi));
		const includes = (offset: number): boolean => {
			const first = offset + Math.ceil((phase.lo - offset) / TWO_PI) * TWO_PI;
			return first <= phase.hi;
		};
		return { lo: includes(peak + Math.PI) ? -1 : ends.lo, hi: includes(peak) ? 1 : ends.hi };
	};
	if (phase.lo === 0 && phase.hi === 0) return [ivPoint(reference[0]), ivPoint(reference[1])];
	return unitToLocalIv(range(Math.cos, 0), range(Math.sin, Math.PI / 2), IV_ONE, ivPoint(reference[0]), ivPoint(reference[1]));
}

type RoundSpanCheck = {
	readonly templateSpan: number;
	readonly startStation: number | null;
	readonly endStation: number | null;
	readonly stored: UnitCubicIv;
};

function spanControlsFit(check: RoundSpanCheck, radius: Iv, direction: readonly [Iv, Iv], stations: readonly Iv[]): boolean {
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
	checks: readonly RoundSpanCheck[], radius: Iv, reference: LayoutVec2, bounds: readonly Iv[], preferred: readonly number[]
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
	wallById: ReadonlyMap<string, Pick<LayoutWall, 'startJunctionId' | 'endJunctionId'>>
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
	wallById: ReadonlyMap<string, Pick<LayoutWall, 'startJunctionId' | 'endJunctionId'>>
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
	wallId: string
): LayoutWallFirstRoom | undefined {
	return document.rooms.find(
		(room) => room.round !== undefined && room.boundary.some((ref) => ref.wallId === wallId)
	);
}

/** True when `room.boundary` is one closed Wall (`startJunctionId === endJunctionId`). */
export function isEnclosedClosedCircleBoundary(
	room: Pick<LayoutWallFirstRoom, 'boundary'>,
	wallById: ReadonlyMap<string, Pick<LayoutWall, 'startJunctionId' | 'endJunctionId'>>
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
	}
): RoundCertificationResult {
	const fail = (path: string, code: string, message: string): RoundCertificationResult => ({
		kind: 'invalid',
		issue: { path, code, message }
	});

	const round = room.round;
	if (!round) {
		return fail(`${roomPath}.round`, 'missing_round_fact', `Room '${room.id}' is missing required round metadata`);
	}
	const { center, radius } = round;
	if (
		!Number.isFinite(center[0]) ||
		!Number.isFinite(center[1]) ||
		!Number.isFinite(radius) ||
		!(radius > 0)
	) {
		return fail(`${roomPath}.round`, 'invalid_value', `Room '${room.id}' has invalid round centre or radius`);
	}
	if (room.virtualEdges.length > 0) {
		return fail(
			`${roomPath}.round`,
			'round_room_virtual_edges',
			`Round Room '${room.id}' cannot have virtual edges`
		);
	}
	if (room.boundary.length === 0) {
		return fail(
			`${roomPath}.boundary`,
			'round_room_invalid_boundary',
			`Round Room '${room.id}' must have a closed boundary`
		);
	}

	const junctionById =
		maps?.junctionById ?? new Map(document.junctions.map((j) => [j.id, j] as const));
	const wallById =
		maps?.wallById ?? new Map(document.walls.map((w) => [w.id, w] as const));

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
				`Unknown wallId '${ref.wallId}'`
			);
		}
		if (wall.centerline.kind !== 'cubic-chain') {
			return fail(
				`${roomPath}.round`,
				'round_room_non_cubic',
				`Round Room '${room.id}' boundary Wall '${wall.id}' must use a cubic-chain centerline`
			);
		}
		if (radius <= wall.thickness / 2 + MIN_RADIUS_THICKNESS_SLACK) {
			return fail(
				`${roomPath}.round.radius`,
				'round_radius_too_small',
				`Round Room '${room.id}' radius ${radius} m must exceed half of Wall '${wall.id}' thickness (${wall.thickness} m)`
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
					`Closed circular Wall '${wall.id}' must carry exactly ${CLOSED_WALL_CIRCLE_SPAN_COUNT} spans`
				);
			}
		} else if (wallClosed) {
			return fail(
				`${roomPath}.boundary[${refIndex}]`,
				'round_room_invalid_boundary',
				`Multi-Wall Round Room '${room.id}' cannot include closed Wall '${wall.id}'`
			);
		}

		const startJunctionId = ref.direction === 'forward' ? wall.startJunctionId : wall.endJunctionId;
		const endJunctionId = ref.direction === 'forward' ? wall.endJunctionId : wall.startJunctionId;
		if (firstStartId === undefined) firstStartId = startJunctionId;
		if (expectedStartId !== undefined && expectedStartId !== startJunctionId) {
			return fail(
				`${roomPath}.boundary`,
				'round_room_invalid_boundary',
				`Round Room '${room.id}' boundary does not form a closed cycle`
			);
		}
		if (visitedStartJunctions.has(startJunctionId)) {
			return fail(
				`${roomPath}.boundary`,
				'round_room_invalid_boundary',
				`Round Room '${room.id}' boundary must be a simple cycle without repeated Junctions`
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
				`Wall '${wall.id}' references an unknown Junction`
			);
		}

		const chainPoints: LayoutVec2[] = [
			startPoint,
			...wall.centerline.knots.map((k) => k.point),
			endPoint
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
					p3: chainPoints[s + 1]!
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
					p3: chainPoints[s]!
				});
			}
		}
	}

	if (firstStartId === undefined || expectedStartId !== firstStartId) {
		return fail(
			`${roomPath}.boundary`,
			'round_room_invalid_boundary',
			`Round Room '${room.id}' boundary does not close at its seam Junction`
		);
	}
	if (cubics.length < TEMPLATE_SPAN_COUNT) {
		return fail(
			`${roomPath}.round`,
			'round_geometry_invalid',
			`Round Room '${room.id}' has ${cubics.length} cubic span(s); at least ${TEMPLATE_SPAN_COUNT} are required`
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
		ivSub(ivEncloseWorld(pt[1]), czIv)
	];

	const [seamLx, seamLz] = toLocalIv(seamPoint);
	const seamLenSq = ivAdd(ivMul(seamLx, seamLx), ivMul(seamLz, seamLz));
	const seamLen = ivSqrt(seamLenSq);
	if (!(seamLen.lo > 0)) {
		return fail(
			`${roomPath}.round`,
			'round_geometry_invalid',
			`Round Room '${room.id}' seam point cannot be resolved from centre at current coordinate precision`
		);
	}
	if (!ivOverlaps(seamLen, radiusIv)) {
		return fail(
			`${roomPath}.round`,
			'round_geometry_invalid',
			`Round Room '${room.id}' seam point does not lie on the stated radius`
		);
	}
	const uxRaw = ivDiv(seamLx, seamLen);
	const uzRaw = ivDiv(seamLz, seamLen);
	if (!uxRaw || !uzRaw) {
		return fail(
			`${roomPath}.round`,
			'round_geometry_invalid',
			`Round Room '${room.id}' seam ray cannot be normalized`
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
			`Round Room '${room.id}' seam ray is degenerate`
		);
	}
	const seamReference: LayoutVec2 = [seamDxRep / seamLenRep, seamDzRep / seamLenRep];
	const referenceX = ivPoint(seamReference[0]);
	const referenceZ = ivPoint(seamReference[1]);
	const phaseBounds = polarAngleInterval(
		ivAdd(ivMul(seamLx, referenceX), ivMul(seamLz, referenceZ)),
		ivSub(ivMul(seamLz, referenceX), ivMul(seamLx, referenceZ)),
		0
	);
	if (!phaseBounds) {
		return fail(`${roomPath}.round`, 'round_geometry_invalid', `Round Room '${room.id}' seam phase cannot be resolved`);
	}

	// Step 2: Walk the M = cubics.length oriented spans and compute one shared
	// station bracket per endpoint vertex V_0 .. V_M.
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
				`Round Room '${room.id}' boundary vertex ${k} cannot be resolved from centre`
			);
		}
		// Must stay in positive CCW walk (0, 2π) and not regress.
		if (angleIv.hi <= 0 || angleIv.lo >= TWO_PI) {
			return fail(
				`${roomPath}.round`,
				'round_geometry_invalid',
				`Round Room '${room.id}' boundary vertex ${k} falls outside positive circular traversal`
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
				`Round Room '${room.id}' boundary vertices are not ordered along the circular template`
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
				`Round Room '${room.id}' has extra cubic spans beyond the 16-span template`
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
					`Round Room '${room.id}' has collapsed or ambiguous cuts at template boundary ${templateSpan + 1}`
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
					`Round Room '${room.id}' does not cover all ${TEMPLATE_SPAN_COUNT} template spans`
				);
			}
			const nextStation = vertexStationIv[k + 1]!;
			const shifted: Iv = {
				lo: nextStation.lo - templateSpan,
				hi: nextStation.hi - templateSpan
			};
			const clipped = ivIntersect(shifted, { lo: 0, hi: 1 });
			if (!clipped || clipped.hi <= currentStartT.lo) {
				return fail(
					`${roomPath}.round`,
					'round_geometry_invalid',
					`Round Room '${room.id}' span ${k} cannot be placed monotonically in template span ${templateSpan}`
				);
			}
			// Require disjoint parameter brackets so distinct cuts cannot collapse at
			// the available coordinate resolution.
			if (ivOverlaps(currentStartT, clipped)) {
				return fail(
					`${roomPath}.round`,
					'round_geometry_invalid',
					`Round Room '${room.id}' cuts collapse within template span ${templateSpan} at current coordinate precision`
				);
			}
			const rep = ivMid(clipped);
			if (!(rep > currentStartRep && rep < 1)) {
				return fail(
					`${roomPath}.round`,
					'round_geometry_invalid',
					`Round Room '${room.id}' cuts collapse within template span ${templateSpan} at current coordinate precision`
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
			preferred.push(Math.max(clipped.lo, Math.min(clipped.hi, ivMid(invertLocalPolarAngle(localAngle, 0)))));
		}

		// Certify all 4 de Casteljau control points against centre-local bounds.
		const unitExpected = templateSubspanUnitIv(templateSpan, currentStartT, endT);
		const stored: UnitCubicIv = [vertexLocalIv[k]!, toLocalIv(cubic.p1), toLocalIv(cubic.p2), vertexLocalIv[k + 1]!];
		for (let c = 0; c < 4; c += 1) {
			const [storedX, storedZ] = stored[c]!;
			const [expX, expZ] = unitToLocalIv(
				unitExpected[c]![0],
				unitExpected[c]![1],
				radiusIv,
				uxIv,
				uzIv
			);
			if (!ivOverlaps(storedX, expX) || !ivOverlaps(storedZ, expZ)) {
				return fail(
					`${roomPath}.round`,
					'round_geometry_invalid',
					`Round Room '${room.id}' Wall '${cubic.wallId}' span ${cubic.wallSpanIndex} control ${c} deviates from the canonical circular template`
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
			tEnd: endRep
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
		return fail(`${roomPath}.round`, 'round_geometry_invalid', `Round Room '${room.id}' has no certifiable common phase and cut partition`);
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
			tEnd: endStation === null ? 1 : witness[endStation]!
		};
	}

	if (templateSpan !== TEMPLATE_SPAN_COUNT) {
		return fail(
			`${roomPath}.round`,
			'round_geometry_invalid',
			`Round Room '${room.id}' covers ${templateSpan} of ${TEMPLATE_SPAN_COUNT} template spans`
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
			subspans
		}
	};
}

/**
 * Validate all Rooms in a Layout document for Round consistency:
 * - rejects any enclosed closed-circle Room that omits `round`;
 * - certifies every Room carrying `round` (isolated closed Wall or open cubic ring).
 */
export function validateRoundRooms(
	document: Pick<LayoutDocumentWallFirst, 'junctions' | 'walls' | 'rooms'>,
	path = '$'
): LayoutDocumentIssue[] {
	const issues: LayoutDocumentIssue[] = [];
	const junctionById = new Map(document.junctions.map((j) => [j.id, j] as const));
	const wallById = new Map(document.walls.map((w) => [w.id, w] as const));
	for (let index = 0; index < document.rooms.length; index += 1) {
		const room = document.rooms[index]!;
		const roomPath = `${path}.rooms[${index}]`;
		if (room.round === undefined) {
			if (isEnclosedClosedCircleBoundary(room, wallById)) {
				issues.push({
					path: `${roomPath}.round`,
					code: 'missing_round_fact',
					message: `Enclosed closed-circle Room '${room.id}' must state round centre and radius`
				});
			}
			continue;
		}
		const result = certifyRoundRoom(document, room, roomPath, { junctionById, wallById });
		if (result.kind === 'invalid') {
			issues.push(result.issue);
		}
	}
	return issues;
}

/**
 * Rebuild a certified Round Room's Wall centerlines and Junction points at a
 * target `(center, radius, seamDirection)` by applying the local template once
 * and adding `center` once per point at the write boundary.
 *
 * Preserves all Wall IDs, Junction IDs, knot IDs and Wall orientations. Uses
 * one shared Junction coordinate per shared Junction.
 */
export function buildRoundRoomGeometryFromCertified(options: {
	readonly document: Pick<LayoutDocumentWallFirst, 'junctions' | 'walls'>;
	readonly certified: CertifiedRoundRoom;
	readonly center: LayoutVec2;
	readonly radius: number;
	readonly seamDirection: LayoutVec2;
	/** Optional explicit seam point (e.g. exact authored rim on initial creation). */
	readonly explicitSeamPoint?: LayoutVec2;
}): {
	readonly junctionPoints: ReadonlyMap<string, LayoutVec2>;
	readonly wallCenterlines: ReadonlyMap<string, Extract<LayoutWallCenterline, { kind: 'cubic-chain' }>>;
	readonly round: LayoutRoomRound;
} {
	const { document, certified, center, radius, seamDirection, explicitSeamPoint } = options;
	const wallById = new Map(document.walls.map((w) => [w.id, w] as const));
	const junctionPoints = new Map<string, LayoutVec2>();

	const seamWorld: LayoutVec2 = explicitSeamPoint
		? [explicitSeamPoint[0], explicitSeamPoint[1]]
		: unitToWorldPoint(UNIT_TEMPLATE_SCALARS[0]![0], center, radius, seamDirection);
	junctionPoints.set(certified.seamJunctionId, seamWorld);

	// Group subspans by Wall so each Wall's knots and spans are written cleanly.
	const wallSubspans = new Map<string, CertifiedRoundSubspan[]>();
	for (const sub of certified.subspans) {
		const list = wallSubspans.get(sub.wallId) ?? [];
		list.push(sub);
		wallSubspans.set(sub.wallId, list);
	}

	const wallCenterlines = new Map<
		string,
		Extract<LayoutWallCenterline, { kind: 'cubic-chain' }>
	>();

	for (const [wallId, subs] of wallSubspans.entries()) {
		const wall = wallById.get(wallId)!;
		if (wall.centerline.kind !== 'cubic-chain') {
			throw new Error(`Certified Round Wall '${wallId}' must be a cubic-chain`);
		}
		const spanCount = wall.centerline.spans.length;
		const newSpans: LayoutWallCubicSpan[] = new Array(spanCount);
		const newKnotPoints: LayoutVec2[] = new Array(wall.centerline.knots.length);

		for (const sub of subs) {
			const unitPts = templateSubspanUnitScalar(sub.templateSpanIndex, sub.tStart, sub.tEnd);
			const isSeamStart = sub.templateSpanIndex === 0 && sub.tStart === 0;
			const isSeamEnd = sub.templateSpanIndex === TEMPLATE_SPAN_COUNT - 1 && sub.tEnd === 1;
			const p0 = isSeamStart
				? seamWorld
				: unitToWorldPoint(unitPts[0], center, radius, seamDirection);
			const p1 = unitToWorldPoint(unitPts[1], center, radius, seamDirection);
			const p2 = unitToWorldPoint(unitPts[2], center, radius, seamDirection);
			const p3 = isSeamEnd
				? seamWorld
				: unitToWorldPoint(unitPts[3], center, radius, seamDirection);

			const s = sub.wallSpanIndex;
			if (sub.direction === 'forward') {
				newSpans[s] = { handleOut: p1, handleIn: p2 };
				if (s === 0 && !junctionPoints.has(wall.startJunctionId)) {
					junctionPoints.set(wall.startJunctionId, p0);
				}
				if (s === spanCount - 1 && !junctionPoints.has(wall.endJunctionId)) {
					junctionPoints.set(wall.endJunctionId, p3);
				}
				if (s < spanCount - 1) {
					newKnotPoints[s] = p3;
				}
			} else {
				newSpans[s] = { handleOut: p2, handleIn: p1 };
				if (s === spanCount - 1 && !junctionPoints.has(wall.endJunctionId)) {
					junctionPoints.set(wall.endJunctionId, p0);
				}
				if (s === 0 && !junctionPoints.has(wall.startJunctionId)) {
					junctionPoints.set(wall.startJunctionId, p3);
				}
				if (s > 0) {
					newKnotPoints[s - 1] = p3;
				}
			}
		}

		const newKnots: LayoutWallCurveKnot[] = wall.centerline.knots.map((knot, idx) => ({
			id: knot.id,
			point: newKnotPoints[idx]!
		}));
		wallCenterlines.set(wallId, {
			kind: 'cubic-chain',
			knots: newKnots,
			spans: newSpans
		});
	}

	return {
		junctionPoints,
		wallCenterlines,
		round: {
			center: [center[0], center[1]],
			radius
		}
	};
}

// ---------------------------------------------------------------------------
// C2 — Member edit guard, operation correspondence, safe-cut search & split
// ---------------------------------------------------------------------------

export const ROUND_ROOM_MEMBER_EDIT_MESSAGE =
	'This wall is part of a round room. Change Radius, or release round.' as const;

export type RoundRoomMemberGuardHit = {
	readonly code: 'round_room_member_locked';
	readonly message: typeof ROUND_ROOM_MEMBER_EDIT_MESSAGE;
	readonly roomId: string;
	readonly wallIds: readonly string[];
	readonly junctionIds: readonly string[];
};

/**
 * Guard geometry-changing member edits on any Round Room boundary Wall or rim
 * Junction (including neighbour edits that would drag a rim Junction).
 */
export function guardRoundRoomMemberGeometryEdit(
	document: Pick<LayoutDocumentWallFirst, 'walls' | 'rooms'>,
	target: {
		readonly wallIds?: readonly string[];
		readonly junctionIds?: readonly string[];
	}
): RoundRoomMemberGuardHit | null {
	const roundRooms = document.rooms.filter((room) => room.round !== undefined);
	if (roundRooms.length === 0) return null;
	const targetWalls = new Set(target.wallIds ?? []);
	const targetJunctions = new Set(target.junctionIds ?? []);
	if (targetWalls.size === 0 && targetJunctions.size === 0) return null;
	const wallById = new Map(document.walls.map((wall) => [wall.id, wall] as const));

	for (const room of roundRooms) {
		const hitWalls: string[] = [];
		const hitJunctions: string[] = [];
		for (const ref of room.boundary) {
			const wall = wallById.get(ref.wallId);
			if (!wall) continue;
			if (targetWalls.has(wall.id) && !hitWalls.includes(wall.id)) {
				hitWalls.push(wall.id);
			}
			for (const jId of [wall.startJunctionId, wall.endJunctionId]) {
				if (targetJunctions.has(jId) && !hitJunctions.includes(jId)) {
					hitJunctions.push(jId);
				}
			}
		}
		if (hitWalls.length > 0 || hitJunctions.length > 0) {
			return {
				code: 'round_room_member_locked',
				message: ROUND_ROOM_MEMBER_EDIT_MESSAGE,
				roomId: room.id,
				wallIds: hitWalls,
				junctionIds: hitJunctions
			};
		}
	}
	return null;
}

/** Find a Round Room whose canonical seam Junction equals `junctionId`. */
export function findRoundRoomSeamOwner(
	document: Pick<LayoutDocumentWallFirst, 'walls' | 'rooms'>,
	junctionId: string
): { readonly room: LayoutWallFirstRoom; readonly wallIds: readonly string[] } | null {
	const wallById = new Map(document.walls.map((wall) => [wall.id, wall] as const));
	for (const room of document.rooms) {
		if (room.round === undefined) continue;
		const seamId = roundRoomSeamJunctionId(room, wallById);
		if (seamId === junctionId) {
			return {
				room,
				wallIds: room.boundary.map((ref) => ref.wallId)
			};
		}
	}
	return null;
}

/** Operation-local correspondence emitted by C2 Round Room planners. */
export type RoundOperationRoomCorrespondence = {
	readonly roomId: string;
	readonly status: 'preserved' | 'cleared-round' | 'retired';
};

export type RoundOperationWallCorrespondence =
	| {
			readonly kind: 'subdivision';
			readonly sourceWallId: string;
			readonly fragmentWallIds: readonly string[];
	  }
	| {
			readonly kind: 'repack';
			readonly sourceWallIds: readonly string[];
			readonly survivorWallId: string;
	  };

export type RoundOperationJunctionCorrespondence =
	| { readonly kind: 'preserved'; readonly junctionId: string }
	| {
			readonly kind: 'born';
			readonly junctionId: string;
			readonly sourceWallId: string;
			readonly station: number;
	  }
	| { readonly kind: 'retired'; readonly junctionId: string; readonly after: null };

export type RoundOperationOpeningCorrespondence = {
	readonly openingId: string;
	readonly beforeWallId: string;
	readonly afterWallId: string;
};

export type RoundOperationCorrespondence = {
	readonly rooms: readonly RoundOperationRoomCorrespondence[];
	readonly walls: readonly RoundOperationWallCorrespondence[];
	readonly junctions: readonly RoundOperationJunctionCorrespondence[];
	readonly openings: readonly RoundOperationOpeningCorrespondence[];
};

export type ClosedWallSafeCutSearch = {
	readonly seamOccupied: boolean;
	readonly seamBlockingOpeningIds: readonly string[];
	readonly candidates: readonly number[];
};

/**
 * Inspect periodic Opening intervals on a closed Wall and enumerate
 * deterministic solid-gap cut stations ordered by increasing periodic distance
 * from the opposite station `L / 2` (ties broken by lower forward station).
 */
export function enumerateClosedWallSafeCutStations(
	openings: readonly LayoutWallOpening[],
	wallId: string,
	totalLength: number
): ClosedWallSafeCutSearch {
	const occupied: Array<{ start: number; end: number }> = [];
	const seamBlockingOpeningIds: string[] = [];
	let seamOccupied = false;

	for (const opening of openings) {
		if (opening.wallId !== wallId) continue;
		const rawStart = ((opening.offset % totalLength) + totalLength) % totalLength;
		const start = totalLength - rawStart <= CURVE_ARC_LENGTH_TOLERANCE ? 0 : rawStart;
		const end = start + opening.width;
		if (end <= totalLength + CURVE_ARC_LENGTH_TOLERANCE) {
			occupied.push({ start, end: Math.min(totalLength, end) });
		} else {
			occupied.push({ start, end: totalLength });
			occupied.push({ start: 0, end: Math.min(totalLength, end - totalLength) });
			if (start > CURVE_ARC_LENGTH_TOLERANCE) {
				seamOccupied = true;
				seamBlockingOpeningIds.push(opening.id);
			}
		}
	}

	occupied.sort((a, b) => a.start - b.start || a.end - b.end);
	const merged: Array<{ start: number; end: number }> = [];
	for (const interval of occupied) {
		const prev = merged[merged.length - 1];
		if (prev && interval.start <= prev.end + CURVE_ARC_LENGTH_TOLERANCE) {
			prev.end = Math.max(prev.end, interval.end);
		} else {
			merged.push({ ...interval });
		}
	}

	const gaps: Array<{ start: number; length: number }> = [];
	if (merged.length === 0) {
		gaps.push({ start: 0, length: totalLength });
	} else {
		const first = merged[0]!;
		const last = merged[merged.length - 1]!;
		for (let i = 0; i < merged.length - 1; i += 1) {
			const gapStart = merged[i]!.end;
			const gapEnd = merged[i + 1]!.start;
			if (gapEnd - gapStart > 2 * JUNCTION_COINCIDENCE_EPSILON) {
				gaps.push({ start: gapStart, length: gapEnd - gapStart });
			}
		}
		const headLen = first.start;
		const tailLen = totalLength - last.end;
		if (!seamOccupied && headLen > CURVE_ARC_LENGTH_TOLERANCE && tailLen > CURVE_ARC_LENGTH_TOLERANCE) {
			gaps.push({ start: last.end, length: tailLen + headLen });
		} else {
			if (tailLen > 2 * JUNCTION_COINCIDENCE_EPSILON) {
				gaps.push({ start: last.end, length: tailLen });
			}
			if (headLen > 2 * JUNCTION_COINCIDENCE_EPSILON) {
				gaps.push({ start: 0, length: headLen });
			}
		}
	}

	const opposite = totalLength / 2;
	const isStrictlyInsideOccupied = (station: number): boolean =>
		merged.some(
			(interval) =>
				station > interval.start + CURVE_ARC_LENGTH_TOLERANCE &&
				station < interval.end - CURVE_ARC_LENGTH_TOLERANCE
		);

	const rawCandidates: number[] = [];
	if (!isStrictlyInsideOccupied(opposite)) {
		rawCandidates.push(opposite);
	}
	for (const gap of gaps) {
		if (gap.length <= 2 * JUNCTION_COINCIDENCE_EPSILON) continue;
		for (const frac of [1 / 3, 0.5, 2 / 3]) {
			const station = (gap.start + gap.length * frac) % totalLength;
			if (
				station > CURVE_ARC_LENGTH_TOLERANCE &&
				totalLength - station > CURVE_ARC_LENGTH_TOLERANCE &&
				!isStrictlyInsideOccupied(station)
			) {
				rawCandidates.push(station);
			}
		}
	}

	const periodicDist = (s: number): number => {
		const d = Math.abs(s - opposite);
		return Math.min(d, totalLength - d);
	};
	rawCandidates.sort((a, b) => periodicDist(a) - periodicDist(b) || a - b);

	const candidates: number[] = [];
	for (const s of rawCandidates) {
		if (!candidates.some((existing) => Math.abs(existing - s) <= CURVE_ARC_LENGTH_TOLERANCE)) {
			candidates.push(s);
		}
	}
	return { seamOccupied, seamBlockingOpeningIds, candidates };
}

export type ClosedWallPartitionSegment = {
	readonly knots: LayoutWallCurveKnot[];
	readonly spans: LayoutWallCubicSpan[];
	readonly startDistance: number;
	readonly endDistance: number;
	readonly length: number;
};

/**
 * Partition a canonical closed 16-span cubic Wall at strictly ascending
 * resolved stations `0 < d_0 < ... < d_{k-1} < L`, preserving untouched spans
 * byte-identically and keeping unpromoted interior knot IDs.
 */
export function partitionClosedWallChainAtStations(options: {
	readonly closedWall: LayoutWall;
	readonly seamPoint: LayoutVec2;
	readonly totalLength: number;
	readonly stations: readonly ResolvedWallSplitResult[];
}): readonly ClosedWallPartitionSegment[] {
	const { closedWall, seamPoint, totalLength, stations } = options;
	if (closedWall.centerline.kind !== 'cubic-chain') {
		throw new Error(`Closed Wall '${closedWall.id}' must be a cubic-chain`);
	}
	const { knots: origKnots, spans: origSpans } = closedWall.centerline;
	const pts: LayoutVec2[] = [
		[seamPoint[0], seamPoint[1]],
		...origKnots.map((k): LayoutVec2 => [k.point[0], k.point[1]]),
		[seamPoint[0], seamPoint[1]]
	];

	const interiorCutsBySpan = new Map<number, ResolvedWallSplitResult[]>();
	const promotedKnotCuts = new Map<number, ResolvedWallSplitResult>();
	for (const cut of stations) {
		if (cut.promotedKnotId !== undefined) {
			promotedKnotCuts.set(cut.spanIndex, cut);
		} else {
			const list = interiorCutsBySpan.get(cut.spanIndex) ?? [];
			list.push(cut);
			interiorCutsBySpan.set(cut.spanIndex, list);
		}
	}
	for (const list of interiorCutsBySpan.values()) {
		list.sort((a, b) => a.t - b.t || a.distance - b.distance);
	}

	const segments: ClosedWallPartitionSegment[] = [];
	let curKnots: LayoutWallCurveKnot[] = [];
	let curSpans: LayoutWallCubicSpan[] = [];
	let curStartDist = 0;

	const finalizeSegment = (endDist: number) => {
		segments.push({
			knots: curKnots,
			spans: curSpans,
			startDistance: curStartDist,
			endDistance: endDist,
			length: endDist - curStartDist
		});
		curKnots = [];
		curSpans = [];
		curStartDist = endDist;
	};

	for (let s = 0; s < origSpans.length; s += 1) {
		const cuts = interiorCutsBySpan.get(s);
		if (!cuts || cuts.length === 0) {
			const orig = origSpans[s]!;
			curSpans.push({
				handleOut: [orig.handleOut[0], orig.handleOut[1]],
				handleIn: [orig.handleIn[0], orig.handleIn[1]]
			});
		} else {
			let remSpan: LayoutWallCubicSpan = origSpans[s]!;
			let remStart: LayoutVec2 = pts[s]!;
			const remEnd: LayoutVec2 = pts[s + 1]!;
			let prevT = 0;
			for (const cut of cuts) {
				const localT = (cut.t - prevT) / (1 - prevT);
				const { left, right } = subdivideWallCubicSpan(remSpan, remStart, remEnd, localT);
				curSpans.push(left);
				finalizeSegment(cut.distance);
				remSpan = right;
				remStart = [cut.point[0], cut.point[1]];
				prevT = cut.t;
			}
			curSpans.push({
				handleOut: [remSpan.handleOut[0], remSpan.handleOut[1]],
				handleIn: [remSpan.handleIn[0], remSpan.handleIn[1]]
			});
		}

		if (s < origKnots.length) {
			const promoted = promotedKnotCuts.get(s);
			if (promoted) {
				finalizeSegment(promoted.distance);
			} else {
				const k = origKnots[s]!;
				curKnots.push({ id: k.id, point: [k.point[0], k.point[1]] });
			}
		}
	}

	finalizeSegment(totalLength);
	return segments;
}

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
import type { LayoutVec2 } from './layout-coordinates';
import type { LayoutDocumentIssue } from './layout-issue';
import { WALL_CURVE_SPLIT_PARAMETER_TOLERANCE } from './layout-wall-curve-algebra';
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
	type OrientedWallRef
} from './layout-wall-first-types';

const TWO_PI = Math.PI * 2;
const TEMPLATE_SPAN_COUNT = CLOSED_WALL_CIRCLE_SPAN_COUNT;
const TEMPLATE_STEP = TWO_PI / TEMPLATE_SPAN_COUNT;
const TEMPLATE_HANDLE_K = (4 / 3) * Math.tan(TEMPLATE_STEP / 4);
const MIN_RADIUS_THICKNESS_SLACK = 1e-6;

// ---------------------------------------------------------------------------
// Exact binary64 adjacent values and outward-rounded interval arithmetic
// ---------------------------------------------------------------------------

const f64View = new Float64Array(1);
const u64View = new BigUint64Array(f64View.buffer);

/** Smallest IEEE-754 binary64 value strictly greater than `x`. */
export function nextUp(x: number): number {
	if (Number.isNaN(x) || x === Infinity) return x;
	if (x === -Infinity) return -Number.MAX_VALUE;
	if (x === 0) return Number.MIN_VALUE;
	f64View[0] = x;
	u64View[0] = x > 0 ? u64View[0]! + 1n : u64View[0]! - 1n;
	return f64View[0]!;
}

/** Largest IEEE-754 binary64 value strictly less than `x`. */
export function nextDown(x: number): number {
	return -nextUp(-x);
}

/** Closed real interval `[lo, hi]` with outward-rounded operations. */
type Iv = { readonly lo: number; readonly hi: number };

const IV_ZERO: Iv = { lo: 0, hi: 0 };
const IV_ONE: Iv = { lo: 1, hi: 1 };

function ivPoint(x: number): Iv {
	return { lo: x, hi: x };
}

/** Enclose a stored world coordinate by its adjacent binary64 values. */
function ivEncloseWorld(x: number): Iv {
	return { lo: nextDown(x), hi: nextUp(x) };
}

function ivAdd(a: Iv, b: Iv): Iv {
	return { lo: nextDown(a.lo + b.lo), hi: nextUp(a.hi + b.hi) };
}

function ivSub(a: Iv, b: Iv): Iv {
	return { lo: nextDown(a.lo - b.hi), hi: nextUp(a.hi - b.lo) };
}

function ivNeg(a: Iv): Iv {
	return { lo: -a.hi, hi: -a.lo };
}

function ivMul(a: Iv, b: Iv): Iv {
	const p1 = a.lo * b.lo;
	const p2 = a.lo * b.hi;
	const p3 = a.hi * b.lo;
	const p4 = a.hi * b.hi;
	return {
		lo: nextDown(Math.min(p1, p2, p3, p4)),
		hi: nextUp(Math.max(p1, p2, p3, p4))
	};
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

type UnitCubicScalar = readonly [LayoutVec2, LayoutVec2, LayoutVec2, LayoutVec2];

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

const UNIT_TEMPLATE_SCALARS: readonly UnitCubicScalar[] = Array.from(
	{ length: TEMPLATE_SPAN_COUNT },
	(_, index) => {
		const a0 = index * TEMPLATE_STEP;
		const a1 = (index + 1) * TEMPLATE_STEP;
		const c0 = Math.cos(a0);
		const s0 = Math.sin(a0);
		const c1 = index === TEMPLATE_SPAN_COUNT - 1 ? 1 : Math.cos(a1);
		const s1 = index === TEMPLATE_SPAN_COUNT - 1 ? 0 : Math.sin(a1);
		const p0: LayoutVec2 = [c0, s0];
		const p1: LayoutVec2 = [c0 - TEMPLATE_HANDLE_K * s0, s0 + TEMPLATE_HANDLE_K * c0];
		const p2: LayoutVec2 = [c1 + TEMPLATE_HANDLE_K * s1, s1 - TEMPLATE_HANDLE_K * c1];
		const p3: LayoutVec2 = [c1, s1];
		return [p0, p1, p2, p3] as const;
	}
);

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
function invertLocalPolarAngle(deltaPhi: number): Iv {
	if (deltaPhi <= 0) return IV_ZERO;
	if (deltaPhi >= TEMPLATE_STEP) return IV_ONE;
	let lo = 0;
	let hi = 1;
	for (let iter = 0; iter < 64; iter += 1) {
		if (hi - lo <= WALL_CURVE_SPLIT_PARAMETER_TOLERANCE) break;
		const mid = lo + (hi - lo) * 0.5;
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

/** Rotate and scale a seam-aligned unit scalar point to centre-local, then add `center` once. */
function unitToWorldPoint(
	unitPoint: LayoutVec2,
	center: LayoutVec2,
	radius: number,
	seamDirection: LayoutVec2
): LayoutVec2 {
	const [ux, uz] = seamDirection;
	const localX = radius * (unitPoint[0] * ux - unitPoint[1] * uz);
	const localZ = radius * (unitPoint[0] * uz + unitPoint[1] * ux);
	return [center[0] + localX, center[1] + localZ];
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
	const seamDirection: LayoutVec2 = [seamDxRep / seamLenRep, seamDzRep / seamLenRep];
	const seamAngleRadians = Math.atan2(seamDirection[1], seamDirection[0]);

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
	let templateSpan = 0;
	let currentStartT: Iv = IV_ZERO;
	let currentStartRep = 0;

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
		}

		// Certify all 4 de Casteljau control points against centre-local bounds.
		const unitExpected = templateSubspanUnitIv(templateSpan, currentStartT, endT);
		const storedControls: readonly LayoutVec2[] = [cubic.p0, cubic.p1, cubic.p2, cubic.p3];
		for (let c = 0; c < 4; c += 1) {
			const [storedX, storedZ] =
				c === 0
					? vertexLocalIv[k]!
					: c === 3
						? vertexLocalIv[k + 1]!
						: toLocalIv(storedControls[c]!);
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
		} else {
			currentStartT = endT;
			currentStartRep = endRep;
		}
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
			seamAngleRadians,
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

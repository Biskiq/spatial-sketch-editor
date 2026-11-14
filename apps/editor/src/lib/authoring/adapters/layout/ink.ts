/**
 * T1.P02.S02 — the Ink tool's palette surface: what the creator reads, and the
 * deliberate pointer targets the drawing gesture can name.
 *
 * Two responsibilities, both narrow:
 *
 * 1. **The target hit test.** A press names an existing Junction, a Wall's
 *    interior or a free point — and only the first two are *connections*. The
 *    test runs in the CSS pixels the Stage actually drew, so what the creator
 *    aimed at is what they hit; the figure is a tolerance, never a snap radius
 *    that invents a coordinate. Junctions win over Walls at equal aim, because a
 *    Junction is the more specific subject.
 * 2. **The published palette surface.** The instrument is mounted by the shell,
 *    so the binding publishes a snapshot plus the controller it exposes, exactly
 *    as the paused-proposal store does. Nothing here owns document state: the
 *    buffer it reports is the adapter's draft.
 */
import type { LayoutVec2 } from '@portfolio/layout-core';

/** The dock tool's contributed task and Find-entry id. */
export const LAYOUT_INK_TASK = 'layout-ink';
export const LAYOUT_INK_ENTRY = 'layout-ink';

/** How near a press must be to a projected Junction mark, in CSS pixels. */
export const INK_JUNCTION_HIT_CSS_PX = 10;
/** How near a press must be to a Wall's projected centerline, in CSS pixels. */
export const INK_WALL_HIT_CSS_PX = 6;

export type InkTargetHit =
	| { readonly kind: 'junction'; readonly junctionId: string }
	| { readonly kind: 'host'; readonly wallId: string }
	| { readonly kind: 'free' };

export type InkPointerTarget = {
	readonly target: InkTargetHit;
	/**
	 * The exact point the draft names. For a Junction it is the Junction's stored
	 * coordinate; for a host Wall it is the pointer projected onto that Wall's
	 * centerline (the split lands where the creator aimed); otherwise the
	 * working-plane point under the pointer.
	 */
	readonly point: LayoutVec2;
	/** The projected mark the creator aimed at, for the overlay. */
	readonly css: readonly [number, number];
};

/** One projected Junction, as the overlay and the hit test see it. */
export type ProjectedJunction = {
	readonly id: string;
	readonly css: readonly [number, number];
	readonly point: LayoutVec2;
};

/** One projected Wall centerline, as the overlay and the hit test see it. */
export type ProjectedWall = {
	readonly id: string;
	readonly startCss: readonly [number, number];
	readonly endCss: readonly [number, number];
	readonly start: LayoutVec2;
	readonly end: LayoutVec2;
	/**
	 * The compiled sampled centerline in world metres. Present for a curved or
	 * closed Wall; absent for a straight one, whose chord is exact. These are the
	 * same canonical samples every other spatial query consumes, never a second
	 * resolver and never an endpoint chord standing in for a curve.
	 */
	readonly path?: readonly LayoutVec2[];
	/** `path` projected into Stage-local CSS, index-aligned with it. */
	readonly pathCss?: readonly (readonly [number, number])[];
};

/** The closest point on a CSS segment, as `[distance, amount]`. */
function closestOnCssSegment(
	point: readonly [number, number],
	start: readonly [number, number],
	end: readonly [number, number]
): readonly [number, number] {
	const dx = end[0] - start[0];
	const dy = end[1] - start[1];
	const squared = dx * dx + dy * dy;
	if (squared === 0) return [Math.hypot(point[0] - start[0], point[1] - start[1]), 0];
	const raw = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / squared;
	const amount = Math.min(1, Math.max(0, raw));
	return [Math.hypot(point[0] - (start[0] + dx * amount), point[1] - (start[1] + dy * amount)), amount];
}

/** The world-space centerline polyline: compiled samples when curved, chord when straight. */
export function projectedWallPath(wall: ProjectedWall): readonly LayoutVec2[] {
	return wall.path !== undefined && wall.path.length >= 2
		? wall.path
		: [wall.start, wall.end];
}

/** The CSS-space centerline polyline, index-aligned with `projectedWallPath`. */
export function projectedWallPathCss(
	wall: ProjectedWall
): readonly (readonly [number, number])[] {
	return wall.pathCss !== undefined && wall.pathCss.length >= 2
		? wall.pathCss
		: [wall.startCss, wall.endCss];
}

/** Cumulative arc length at each polyline vertex. */
function cumulativeLengths(path: readonly (readonly [number, number])[]): number[] {
	const lengths = new Array<number>(path.length);
	lengths[0] = 0;
	for (let index = 1; index < path.length; index += 1) {
		const previous = path[index - 1]!;
		const current = path[index]!;
		lengths[index] = lengths[index - 1]! + Math.hypot(
			current[0] - previous[0],
			current[1] - previous[1]
		);
	}
	return lengths;
}

/**
 * The nearest point on a polyline, with its segment parameter and its physical
 * arc-length offset. One implementation serves the CSS hit test, the world
 * centerline point and the Opening offset, so they can never disagree.
 */
function closestOnPolyline(input: {
	readonly point: readonly [number, number];
	readonly path: readonly (readonly [number, number])[];
}): {
	readonly distance: number;
	readonly segment: number;
	readonly amount: number;
	readonly offset: number;
	readonly point: readonly [number, number];
} | null {
	const { path } = input;
	if (path.length === 0) return null;
	if (path.length === 1) {
		return {
			distance: Math.hypot(input.point[0] - path[0]![0], input.point[1] - path[0]![1]),
			segment: 0,
			amount: 0,
			offset: 0,
			point: path[0]!
		};
	}
	const lengths = cumulativeLengths(path);
	let best: {
		distance: number; segment: number; amount: number; offset: number;
		point: readonly [number, number];
	} | null = null;
	for (let index = 0; index < path.length - 1; index += 1) {
		const start = path[index]!;
		const end = path[index + 1]!;
		const [distance, amount] = closestOnCssSegment(input.point, start, end);
		if (best !== null && distance >= best.distance) continue;
		best = {
			distance,
			segment: index,
			amount,
			offset: lengths[index]! + (lengths[index + 1]! - lengths[index]!) * amount,
			point: [
				start[0] + (end[0] - start[0]) * amount,
				start[1] + (end[1] - start[1]) * amount
			]
		};
	}
	return best;
}

/** Distance from a Stage-local CSS point to a Wall's drawn centerline. */
function projectedWallDistanceCss(
	wall: ProjectedWall,
	point: readonly [number, number]
): number {
	return closestOnPolyline({ point, path: projectedWallPathCss(wall) })?.distance ?? Number.POSITIVE_INFINITY;
}

/**
 * What a press at `css` deliberately names.
 *
 * A Junction inside the tolerance wins over a Wall; a Wall interior inside its
 * tolerance wins over free placement; an endpoint of a Wall is NOT a host — that
 * is a Junction, and its own mark is what the creator must aim at. The returned
 * point is exact geometry (never the cursor position rounded onto something
 * near it), which is what "nearness never adopts a coordinate" means here.
 */
export function classifyInkPointerTarget(input: {
	readonly css: readonly [number, number];
	readonly junctions: readonly ProjectedJunction[];
	readonly walls: readonly ProjectedWall[];
}): InkTargetHit | null {
	let nearestJunction: { id: string; distance: number } | null = null;
	for (const junction of input.junctions) {
		const distance = Math.hypot(input.css[0] - junction.css[0], input.css[1] - junction.css[1]);
		if (distance > INK_JUNCTION_HIT_CSS_PX) continue;
		if (nearestJunction === null || distance < nearestJunction.distance) {
			nearestJunction = { id: junction.id, distance };
		}
	}
	if (nearestJunction !== null) return { kind: 'junction', junctionId: nearestJunction.id };
	let nearestWall: { id: string; distance: number } | null = null;
	for (const wall of input.walls) {
		const distance = projectedWallDistanceCss(wall, input.css);
		if (distance > INK_WALL_HIT_CSS_PX) continue;
		if (nearestWall === null || distance < nearestWall.distance) {
			nearestWall = { id: wall.id, distance };
		}
	}
	if (nearestWall !== null) return { kind: 'host', wallId: nearestWall.id };
	return null;
}

/** The point on a Wall's centerline a pointer position names (the split point). */
export function pointOnWallCenterline(wall: ProjectedWall, point: LayoutVec2): LayoutVec2 {
	if (wall.path === undefined) {
		const dx = wall.end[0] - wall.start[0];
		const dz = wall.end[1] - wall.start[1];
		const squared = dx * dx + dz * dz;
		if (!(squared > 0)) return [wall.start[0], wall.start[1]];
		const raw = ((point[0] - wall.start[0]) * dx + (point[1] - wall.start[1]) * dz) / squared;
		const amount = Math.min(1, Math.max(0, raw));
		return [wall.start[0] + dx * amount, wall.start[1] + dz * amount];
	}
	const hit = closestOnPolyline({ point, path: projectedWallPath(wall) });
	if (hit === null) return [wall.start[0], wall.start[1]];
	return [hit.point[0], hit.point[1]];
}

/** A Wall's physical centerline length in meters (arc length when curved). */
export function projectedWallLength(wall: Pick<ProjectedWall, 'start' | 'end' | 'path'>): number {
	if (wall.path === undefined || wall.path.length < 2) {
		return Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
	}
	const lengths = cumulativeLengths(wall.path);
	return lengths.at(-1) ?? 0;
}

/**
 * The signed meter offset from a Wall's canonical start that a world point names.
 *
 * This is the same convention as the Card's Offset field: distance along the
 * centerline to the Opening's near edge. The projection is onto the unbounded
 * centerline, so a point before the start is negative and is refused by the
 * planner rather than clamped to zero.
 */
export function offsetAlongWall(wall: ProjectedWall, point: LayoutVec2): number {
	if (wall.path !== undefined && wall.path.length >= 2) {
		return closestOnPolyline({ point, path: projectedWallPath(wall) })?.offset ?? 0;
	}
	const dx = wall.end[0] - wall.start[0];
	const dz = wall.end[1] - wall.start[1];
	const length = Math.hypot(dx, dz);
	if (!(length > 0)) return 0;
	return (((point[0] - wall.start[0]) * dx + (point[1] - wall.start[1]) * dz) / length
	);
}

/** A point at one meter distance from the Wall start, for the opening ghost. */
export function pointAlongWall(wall: ProjectedWall, distance: number): LayoutVec2 {
	if (wall.path !== undefined && wall.path.length >= 2) {
		const path = projectedWallPath(wall);
		const lengths = cumulativeLengths(path);
		const target = Math.min(lengths.at(-1) ?? 0, Math.max(0, distance));
		let segment = 0;
		while (segment < path.length - 2 && lengths[segment + 1]! < target) segment += 1;
		const span = lengths[segment + 1]! - lengths[segment]!;
		const amount = span > 0 ? (target - lengths[segment]!) / span : 0;
		return [
			path[segment]![0] + (path[segment + 1]![0] - path[segment]![0]) * amount,
			path[segment]![1] + (path[segment + 1]![1] - path[segment]![1]) * amount
		];
	}
	const length = projectedWallLength(wall);
	if (!(length > 0)) return [wall.start[0], wall.start[1]];
	const amount = distance / length;
	return [
		wall.start[0] + (wall.end[0] - wall.start[0]) * amount,
		wall.start[1] + (wall.end[1] - wall.start[1]) * amount
	];
}

/**
 * The deliberate host one pointer position names for an Opening.
 *
 * Only a Wall face inside the existing Ink tolerance is a host; the Stage is
 * never a free placement. When a host (or one of its Openings) is selected and
 * is among the candidates, that host wins — task focus, not a new selection.
 * Otherwise the nearest candidate wins. Nothing here picks a coordinate.
 */
export function classifyOpeningHost(input: {
	readonly css: readonly [number, number];
	readonly walls: readonly ProjectedWall[];
	readonly preferredWallId: string | null;
}): { readonly wallId: string; readonly distance: number } | null {
	const candidates: { id: string; distance: number }[] = [];
	for (const wall of input.walls) {
		const distance = projectedWallDistanceCss(wall, input.css);
		if (distance > INK_WALL_HIT_CSS_PX) continue;
		candidates.push({ id: wall.id, distance });
	}
	if (candidates.length === 0) return null;
	const preferred = candidates.find((candidate) => candidate.id === input.preferredWallId);
	if (preferred !== undefined) return { wallId: preferred.id, distance: preferred.distance };
	const nearest = candidates.reduce((best, candidate) =>
		candidate.distance < best.distance ? candidate : best
	);
	return { wallId: nearest.id, distance: nearest.distance };
}

/**
 * One reading the one Pen offers. `wall` and `opening` are Layout's built-ins;
 * any other id is a reading another domain contributed through the Stage host.
 */
export type InkReading = 'wall' | 'opening' | (string & {});

/** One reading row as the palette renders it. */
export type InkPaletteReading = {
	readonly id: InkReading;
	readonly label: string;
	readonly summary: string;
};

export type InkOpeningKind = 'door' | 'window';
export type InkOpeningProfile = 'rectangular' | 'rounded' | 'pointed';

/**
 * R217.S10 — how the Wall reading names a chain: **Line** taps or drags points one
 * at a time; **Arc** takes a start, an end and a bulge and authors one open
 * canonical `cubic-chain` Wall; **Box** takes two opposite corners and closes the
 * four-Wall ring; **Circle** takes a centre then a rim point and authors the
 * canonical closed Wall. Each submits through the same captured intent surface.
 */
export type InkWallMode = 'line' | 'arc' | 'box' | 'circle';

/** The next Opening's palette defaults; a session remembers them. */
export type InkOpeningOptions = {
	readonly kind: InkOpeningKind;
	readonly profile?: InkOpeningProfile;
	readonly width: number;
	readonly height: number;
	readonly sillHeight: number;
};

/** The host-relative candidate and its planner answer, as the palette reads it. */
export type InkOpeningSnapshot = {
	readonly hostId: string | null;
	/** Selected Wall (or selected Opening’s host), used for typed placement. */
	readonly selectedHostId: string | null;
	readonly offset: number | null;
	readonly width: number;
	readonly height: number;
	readonly sillHeight: number;
	readonly kind: InkOpeningKind;
	readonly profile: InkOpeningProfile;
	/** The planner accepted the exact candidate under the pointer. */
	readonly canPlace: boolean;
	/** Planner-derived refusal/repair words while the candidate does not fit. */
	readonly refusal: string | null;
};

/**
 * A3 — the live Arc's measured facts. `belowMinimum` means the next commit is the
 * straight fallback, which the creator reads before accepting it.
 */
export type InkArcSnapshot = {
	readonly chord: number;
	readonly rise: number;
	readonly radius: number;
	readonly belowMinimum: boolean;
};

/** What the Ink palette renders. Everything here is read from the live draft. */
export type InkPaletteSnapshot = {
	readonly options?: {
		readonly thickness: number | null;
		readonly height: number | null;
	};
	readonly reading: InkReading;
	/** The Wall reading's Line, Arc, Box or Circle; meaningless for other readings. */
	readonly wallMode: InkWallMode;
	/** The live Arc's rise and radius, or `null` outside Arc mode. */
	readonly arc: InkArcSnapshot | null;
	/** The live Box's extent on X and Z, in meters, once a corner and a pointer name one. */
	readonly box: { readonly width: number; readonly depth: number } | null;
	/** Every reading this project offers: Layout's built-ins then contributed readings. */
	readonly readings: readonly InkPaletteReading[];
	/** The Opening candidate while that reading is armed; `null` for the Wall reading. */
	readonly opening: InkOpeningSnapshot | null;
	readonly points: readonly LayoutVec2[];
	readonly closed: boolean;
	readonly canFinish: boolean;
	readonly canClose: boolean;
	readonly canBacktrack: boolean;
	/** The planner-derived consequence of finishing now, or `null`. */
	readonly consequence: string | null;
	/** The live length/angle of the pending leg, when a pointer is over the Stage. */
	readonly pending: { readonly length: number; readonly angleDegrees: number;
	} | null;
	/** Refusal or repair words; the live chain stays editable while it is shown. */
	readonly refusal: string | null;
};

/**
 * The Ink controller the palette drives. Every command goes through the adapter's
 * one chain state machine, so the palette is a *reader and caller*, never a second
 * writer of the draft.
 */
export type InkController = {
	/** Switch the one Ink tool between its supported readings. */
	readonly setReading: (reading: InkReading) => void;
	/** Switch the Wall reading between Line, Arc, Box and Circle; refused while a chain is live. */
	readonly setWallMode: (mode: InkWallMode) => void;
	/** Remember the next Opening's kind and exact metrics. */
	readonly setOpeningOptions: (options: InkOpeningOptions | null) => void;
	/**
	 * Place on the preferred/tie-winning host. An empty offset uses the host's
	 * exact center; a typed offset is used exactly (never clamped).
	 */
	readonly placeOpening: (offsetText: string) => void;
	/** Finish the chain as it stands (open chain or explicit ring). */
	readonly finish: () => void;
	/** Close the ring and finish it in one accepted step. */
	readonly close: () => void;
	/** Backtrack one live point. */
	readonly backtrack: () => void;
	/** Discard the whole chain; no source is written. */
	readonly cancel: () => void;
	/** Append the typed working-plane coordinate as the next point. */
	readonly typePoint: (xText: string, zText: string) => void;
	/**
	 * Remembered chain options. `null` means "use the canonical default", never
	 * zero: an unset height is resolved by the planner's own birth rule.
	 */
	readonly setOptions: (options: { readonly thickness: number | null; readonly height: number | null;
	}) => void;
};

export type InkSurface = {
	snapshot(): InkPaletteSnapshot;
	readonly controller: InkController;
};

let published: { surface: InkSurface; revision: number } | null = null;

/** The adapter publishes its surface when Ink arms and clears it when it disarms. */
export function publishInkSurface(surface: InkSurface | null): void {
	published = surface === null ? null : { surface, revision: (published?.revision ?? 0) + 1 };
}

export function inkSurface(): InkSurface | null {
	return published?.surface ?? null;
}

/** Changes whenever a new surface is published; a palette re-reads on change. */
export function inkSurfaceRevision(): number {
	return published?.revision ?? 0;
}

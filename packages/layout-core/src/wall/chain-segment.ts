import type { LayoutDocumentWallFirst } from './types';
import type { LayoutVec2 } from '../geometry/coordinates';
import type { LayoutIdCapture } from '../plan/id-capture';
import { resolveWallBirthHeight } from './heights';
import { coincidesAsJunction } from './junction-identity';
import { planWallChain } from './chain-plan';
import type { WallChainPlan, WallEndpointHostSnap, WallEndpointJunctionSnap } from './chain-types';

/**
 * Segment-first canonical engine: one completed straight segment = one Wall
 * authoring command. Thin wrapper over `planWallChain` with exactly two
 * points and no implicit close. Callers use the returned `startJunctionId` /
 * `endJunctionId` for continuation — never `createdWallIds`.
 *
 * **Wall-birth height lives here, not in the editor.** A headless
 * caller and the human Plan interaction must execute the same semantic
 * operation, so the first-segment rule is resolved from canonical document
 * topology by `resolveWallBirthHeight()`:
 *
 * ```text
 * explicit height                                  → that height
 * start point on a Junction with one unique
 * incident Wall height                             → inherit it
 * isolated/new start, or mixed incident heights    → WALL_AUTHORING_DEFAULT_HEIGHT
 * ```
 *
 * Birth height is a vertical-coherence rule, not a topology rule, so it keeps a
 * coordinate fallback: the Junction `resolveWallBirthHeight` reads is the DECLARED
 * start anchor when the caller names one, else the Junction coinciding with the
 * start. Topology does NOT follow that fallback — adoption happens only through
 * the declared anchors on this signature. Continuation *inside one active draw run* stays an
 * explicit caller decision: the editor holds the run height as transient state
 * and passes it as `height`, which the explicit branch above honours.
 */
export function planWallSegment(options: {
	baseline: LayoutDocumentWallFirst;
	start: LayoutVec2;
	end: LayoutVec2;
	thickness?: number;
	height?: number;
	/** The operation's captured identity; see `planWallChain`. */
	capture: LayoutIdCapture;
	/** Explicit working level; see `planWallChain`. */
	levelId: string;
	/** Existing `wall-span` snap identity for the authored endpoint. */
	endpointHostWallId?: string;
	/**
	 * DECLARED connection anchors (host-Wall form), keyed by point
	 * index exactly like `endpointJunctionSnaps`: a segment that terminates on an
	 * existing Wall's span (a divider landing on the enclosure) says so here, and
	 * that declaration is what authorizes noding inside that host's group.
	 *
	 * The Junction form is the stronger statement (it names the identity the
	 * operation extends); this form names the host span the author attached to and
	 * lets the canonical noding rule split that host, sharing the Junction it
	 * mints. `endpointHostWallId` is the single-end spelling of this same anchor
	 * and both are honoured together.
	 */
	endpointHostSnaps?: readonly WallEndpointHostSnap[];
	/**
	 * DECLARED connection anchors for this segment (junction form),
	 * keyed by point index: `0` is `start`, `1` is `end`. Supplying either one is
	 * the operation declaring that it EXTENDS the group it names (class 3), so
	 * adoption and noding apply inside that group; supplying neither — and no
	 * `endpointHostWallId` — declares INDEPENDENT placement (class 2), where no
	 * coordinate coincidence is adopted and no host Wall is split. A run
	 * continuation passes the run's own canonical Junction; a deliberate node
	 * snap passes the Junction the author snapped to.
	 */
	endpointJunctionSnaps?: readonly WallEndpointJunctionSnap[];
}): WallChainPlan {
	const declaredStartJunctionId = options.endpointJunctionSnaps?.find(
		(snap) => snap.pointIndex === 0,
	)?.junctionId;
	// Birth height is a vertical-coherence rule, not a topology rule, so
	// it keeps its coordinate fallback: a segment whose start sits on a Junction
	// inherits that Junction's height whether or not the operation declared the
	// identity. A declared anchor is authoritative when both are present.
	const coordinateStartJunction = options.baseline.junctions.find((junction) =>
		coincidesAsJunction(junction.point, options.start),
	);
	// S6 — one merged declaration list: the single-end spelling (`endpointHostWallId`,
	// what the editor passes for the endpoint the author snapped to) plus the
	// general per-point form a headless caller uses to declare both ends.
	const declaredHostSnaps: WallEndpointHostSnap[] = [
		...(options.endpointHostWallId ? [{ pointIndex: 1, wallId: options.endpointHostWallId }] : []),
		...(options.endpointHostSnaps ?? []),
	];
	return planWallChain({
		baseline: options.baseline,
		points: [options.start, options.end],
		close: false,
		height: resolveWallBirthHeight(
			options.baseline,
			declaredStartJunctionId ?? coordinateStartJunction?.id ?? null,
			options.height,
		),
		...(options.thickness !== undefined ? { thickness: options.thickness } : {}),
		...(declaredHostSnaps.length > 0 ? { endpointHostSnaps: declaredHostSnaps } : {}),
		...(options.endpointJunctionSnaps && options.endpointJunctionSnaps.length > 0
			? { endpointJunctionSnaps: options.endpointJunctionSnaps }
			: {}),
		capture: options.capture,
		levelId: options.levelId,
	});
}

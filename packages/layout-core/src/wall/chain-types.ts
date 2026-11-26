import type { LayoutDocumentWallFirst } from './types';
import type { LayoutVec2 } from '../geometry/coordinates';
import type { LayoutSurfaceLineage } from '../plan/surface-reference';
import type { WallFirstAcceptanceCompile } from '../precision/types';
import type { TopologyDiagnostic } from '../geometry/face-extraction';
import type { LayoutIdCapture } from '../plan/id-capture';
import { assertCapturedIdUnused, layoutCapturedId } from '../plan/id-capture';
import type { RoundOperationCorrespondence } from '../room/round-room';
import type { LayoutDocumentIssue } from '../plan/issue';
import type { WallChainArc } from './chain-arcs';

/**
 * Chain wall/junction defaults (same as the seed helpers).
 *
 * The Wall-birth height is not in this table: a new Wall's height comes
 * from `resolveWallBirthHeight` (the named `WALL_AUTHORING_DEFAULT_HEIGHT` or a
 * deterministic incident-Wall inheritance), so no runtime Wall-birth path may
 * carry a literal height. Thickness stays a fixed sketch default (it is not a
 * vertical quantity).
 */
export const WALL_CHAIN_DEFAULTS = {
	thickness: 0.2,
} as const;

/**
 * A DECLARED host-Wall connection for one draft point.
 *
 * Relationship acquisition, not geometry: the caller names the host Wall
 * explicitly. `planWallChain` VALIDATES the claim before granting any authority
 * — the point exists, the Wall is in the baseline, at most one host per point,
 * a Junction anchor on the same point agrees about the component, and the named
 * Wall is genuinely part of this operation — and then authorizes noding inside
 * that host's connected component only. Normalizing a snapped endpoint onto the
 * host's centerline stays the curve authority's job; sampler flatness must never
 * become a topology radius by itself.
 */
export type WallEndpointHostSnap = {
	pointIndex: number;
	wallId: string;
};

/**
 * DECLARED CONNECTION ANCHOR, junction form.
 *
 * The operation's explicit statement that draft point `pointIndex` CONNECTS to
 * the existing Junction `junctionId`: operation class 3, extending an already
 * connected group. It is the Junction-form twin of `WallEndpointHostSnap`, which
 * declares the same thing for a host Wall's span.
 *
 * WHY IT EXISTS. Option E separates spatial placement from topological
 * connection, so coordinate coincidence can no longer mean connectivity: the
 * draft-point reuse this planner used to infer from a coincident coordinate is
 * now an EXPLICIT declaration, made by the caller that knows what the gesture
 * meant. `planWallChain` adopts an existing Junction id when — and only when —
 * this anchor declares it. A chain that declares nothing is INDEPENDENT
 * placement: it mints its own Junction records (even at coordinates an existing
 * Junction already occupies), acquires no shared topology, splits no host Wall,
 * and remains its own component to the validity gates.
 *
 * The declaration is the OPERATION's intent, never the geometry (decision
 * record §4.0.1 / M-3a-4): a caller that means "extend this group" says so; a
 * caller that means "place this independently" says nothing and therefore
 * cannot join anything by accident.
 */
export type WallEndpointJunctionSnap = {
	pointIndex: number;
	junctionId: string;
};

/** Why a chain sketch rejected; stable machine codes. */
export type WallChainRejectionCode =
	| 'closed_wall_isolated'
	| 'insufficient_chain'
	| 'non_finite_point'
	| 'zero_length_leg'
	/** A3 — an Arc bulge exceeds the minor arc its two endpoints can carry. */
	| 'arc_rise_out_of_range'
	| 'dimension_out_of_range'
	| 'collinear_overlap'
	| 'self_intersecting_chain'
	| 'noding_rejected'
	| 'room_reconciliation_rejected'
	| 'captured_id_in_use'
	| 'invalid_candidate_document'
	| 'candidate_does_not_compile';

export type WallChainRejection = {
	code: WallChainRejectionCode;
	message: string;
	/** Involved authored IDs where available. */
	wallIds?: string[];
	/** Face-extraction diagnostics that caused the rejection, if any. */
	topology?: readonly TopologyDiagnostic[];
	/** The final canonical gate's issues, when validation rejects. */
	issues?: readonly LayoutDocumentIssue[];
};

export type WallChainPlan =
	| {
			kind: 'success';
			/** Exact committed document — allocated IDs and noded topology included. */
			document: LayoutDocumentWallFirst;
			/** Wall IDs created by the chain (retained split fragments keep their IDs). */
			createdWallIds: string[];
			/**
			 * Authored-segment lineage: the candidate segment's own Walls and
			 * their noding fragments. Pre-existing host fragments split by the
			 * candidate are NOT included (they are host-derived, reported via
			 * `createdWallIds`/`splitWallIds`). Never derive continuation or
			 * status from `createdWallIds` — crossing/noding can turn one
			 * candidate into several fragments.
			 */
			authoredWallIds: string[];
			/** Junction IDs created by the chain or by noding (reused ones excluded). */
			createdJunctionIds: string[];
			/** IDs of pre-existing walls subdivided by T/X noding. */
			splitWallIds: string[];
			/** Canonical resolved start junction of the committed candidate. */
			startJunctionId: string;
			/** Canonical resolved end junction of the committed candidate. */
			endJunctionId: string;
			/** `created` lineage records from the reconciliation. */
			lineage: ReadonlyArray<{
				faceKey: string;
				roomId: string;
				kind: 'created';
			}>;
			surfaceLineage: LayoutSurfaceLineage;
			retiredRoomIds: readonly string[];
			/** Open Spaces whose boundary gained a drawn Wall and lost part of an open side. */
			absorbedRoomIds: readonly string[];
			/** Round Rooms whose `round` fact cleared (e.g., divided by a chord). */
			clearedRoundRoomIds?: readonly string[];
			/** Operation-local Round Room correspondence when a Round Room was partitioned or cleared. */
			roundCorrespondence?: RoundOperationCorrespondence;
			/**
			 * The compile the final canonical gate already produced for
			 * exactly `document` (canonical JSON, geometry and issues). It is the same
			 * payload type the precision path carries, and it is a *result*, never an
			 * authority: an installing caller must re-prove that the document it is about
			 * to install is this one (the editor's canonical-JSON guard) before consuming
			 * a byte of it.
			 */
			acceptance: WallFirstAcceptanceCompile;
	  }
	| {
			kind: 'rejected';
			rejection: WallChainRejection;
	  };

/**
 * Deterministic chain allocator contract. Compatible with the editor's
 * `NodingIdAllocator` shape. Every id derives from the operation's captured
 * nonce plus this allocator's seed; occupancy is only the refusal check.
 */
export type WallChainIdAllocator = {
	nextWallId(taken: ReadonlySet<string>, seed: string): string;
	nextJunctionId(taken: ReadonlySet<string>, seed: string): string;
};

/**
 * One captured operation's chain allocator (capture, never occupancy).
 *
 * The allocator is stateful for its one operation: one operation may request
 * the same seed more than once (a second split landing on the start-side
 * fragment that kept the host id requests `${wallId}-b` again). The first
 * request for a seed derives exactly from that seed; the k-th request (k >= 2)
 * derives from `${seed}-${k}`. Replaying the same capture reproduces the same
 * sequence, so the ids stay deterministic. Occupancy (including ids this
 * operation already issued) is only the refusal check.
 */
export function createCapturedWallChainAllocator(capture: LayoutIdCapture): WallChainIdAllocator {
	const wallSeeds = new Map<string, number>();
	const junctionSeeds = new Map<string, number>();
	const issued = new Set<string>();
	const allocate = (
		seeds: Map<string, number>,
		taken: ReadonlySet<string>,
		seed: string,
	): string => {
		const request = (seeds.get(seed) ?? 0) + 1;
		seeds.set(seed, request);
		const effectiveSeed = request === 1 ? seed : `${seed}-${request}`;
		const id = assertCapturedIdUnused(
			new Set([...taken, ...issued]),
			layoutCapturedId(capture, effectiveSeed),
		);
		issued.add(id);
		return id;
	};
	return {
		nextWallId: (taken, seed) => allocate(wallSeeds, taken, seed),
		nextJunctionId: (taken, seed) => allocate(junctionSeeds, taken, seed),
	};
}

/**
 * Plan a sketched Wall/Partition chain over `baseline`.
 *
 * `points` are the draft vertices in click order; `close` appends the
 * closing leg back to the first vertex. A final point coinciding with the
 * chain's first junction closes the chain implicitly (the duplicate leg is
 * dropped, so clicking the start point to finish is the same operation as
 * pressing Close).
 */
/**
 * The wall-chain plan's own DEV-only mark boundaries.
 *
 * The observer sees plan, topology gate, face extraction, correspondence, Room
 * reconciliation and final canonical gates in Node and the browser.
 * They are inert unless a measurement harness installs a work observer, so
 * they add no telemetry to a product build.
 */
export type WallChainPlanOptions = {
	/** Naming policy for newly allocated Rooms only; existing authored names are retained. */
	roomNamePrefix?: string;
	/** Pre-operation document; never mutated. */
	baseline: LayoutDocumentWallFirst;
	points: readonly LayoutVec2[];
	close: boolean;
	thickness?: number;
	height?: number;
	/**
	 * A3 — the one drawn Arc leg. Omitted for an ordinary straight chain. The
	 * leg still uses the same points, noding, reconciliation and gates; only its
	 * centerline is the canonical cubic-chain (or the straight fallback).
	 */
	arc?: WallChainArc | null;
	/**
	 * The operation's captured identity. Required: the chain
	 * mints Junctions, Walls, noding fragments and (on a closed ring) Rooms, and
	 * every one of those derives from this nonce rather than from occupancy.
	 */
	capture: LayoutIdCapture;
	/**
	 * The explicit working level. Required and refused unless it
	 * names `baseline.floor.id`; the chain never infers its level from the document.
	 */
	levelId: string;
	/**
	 * DECLARED host-Wall connections, keyed by draft point index.
	 *
	 * The annotation names the point that expresses the attachment (the endpoint
	 * the author snapped onto a Wall's face); what it MEANS is that this operation
	 * joins the host Wall's connected group, which is why noding — host splits, X
	 * crossings and Ts — applies inside that group and nowhere else. An endpoint
	 * that lands on the host's span is the ordinary case; a caller may also declare
	 * a group whose geometry the operation CROSSES rather than touches, because the
	 * statement is about the GROUP. Either way it is validated first (see
	 * `validateEndpointHostSnaps`): the named Wall must exist and be genuinely part
	 * of this operation, so an arbitrary remote Wall id is refused rather than
	 * becoming blanket permission to node its group. With no declaration (and none
	 * of `endpointJunctionSnaps`) the chain is INDEPENDENT placement: a crossing is
	 * permitted overlap that creates no shared topology.
	 */
	endpointHostSnaps?: readonly WallEndpointHostSnap[];
	/**
	 * DECLARED Junction connection anchors, keyed by draft point
	 * index. Together with `endpointHostSnaps` this IS the operation's declared
	 * intent: supplying either one makes the chain an EXTENSION of the group(s)
	 * it names (class 3 — adoption and in-group noding apply); supplying neither
	 * declares INDEPENDENT placement (class 2 — no adoption, no noding, no
	 * fragmentation of any pre-existing Wall).
	 */
	endpointJunctionSnaps?: readonly WallEndpointJunctionSnap[];
};

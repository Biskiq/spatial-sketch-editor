import type { LayoutDocumentWallFirst, LayoutWall } from './types';
import type { LayoutVec2 } from '../geometry/coordinates';
import { p2311Measure } from '../kernel/work-observer';
import { LAYOUT_DIMENSION_LIMIT_MESSAGE, exceedsLayoutDimension } from '../geometry/limits';
import { projectPointToSampledSegment } from '../geometry/curve';
import { LayoutIdCollisionError, layoutWorkingLevelIssue } from '../plan/id-capture';
import { classifyWallIntersection } from './topology';
import { WALL_AUTHORING_DEFAULT_HEIGHT } from './heights';
import { wallCenterlineSamples } from './centerline';
import type { ResolvedWallSplitResult } from './curve-algebra';
import { resolveWallCurveSplit, wallCurveChainLength } from './curve-algebra';
import { isClosedWall } from './closed-wall';
import {
	certifyRoundRoom,
	enumerateClosedWallSafeCutStations,
	findEnclosingRoundRoomForWall,
} from '../room/round-room';
import { coincidesAsJunction } from './junction-identity';
import { wallChainArcCenterline } from './chain-arcs';
import type { ClosedToRingSpec } from './chain-execute';
import { executeWallChainCandidate } from './chain-execute';
import { validateEndpointHostSnaps } from './chain-noding';
import type { WallChainPlan, WallChainPlanOptions, WallChainRejection } from './chain-types';
import { WALL_CHAIN_DEFAULTS } from './chain-types';

/**
 * Deep-clone plain layout data for the candidate document.
 *
 * `structuredClone` is NOT usable here: the editor hands this planner a
 * Svelte `$state` proxy, which throws `DataCloneError` (and Node tests with
 * plain objects would never catch it). The wall-first schema is pure JSON
 * data, so a JSON round-trip is lossless apart from `undefined`-valued
 * optional keys, which the codec also omits.
 */
export function cloneWallFirstDocument(document: LayoutDocumentWallFirst): LayoutDocumentWallFirst {
	return JSON.parse(JSON.stringify(document)) as LayoutDocumentWallFirst;
}

/**
 * Plan a sketched Wall/Partition chain over `baseline` (P23B.11 S1 mark boundary:
 * `p2311:wall-chain-plan` encloses the whole planner run, including every early
 * rejection).
 */
export function planWallChain(options: WallChainPlanOptions): WallChainPlan {
	try {
		return p2311Measure('wall-chain-plan', () => planWallChainInternal(options));
	} catch (error) {
		if (error instanceof LayoutIdCollisionError) {
			return {
				kind: 'rejected',
				rejection: { code: 'captured_id_in_use', message: error.message },
			};
		}
		throw error;
	}
}

function planWallChainInternal(options: WallChainPlanOptions): WallChainPlan {
	const thickness = options.thickness ?? WALL_CHAIN_DEFAULTS.thickness;
	const reject = (rejection: WallChainRejection): WallChainPlan => ({
		kind: 'rejected',
		rejection,
	});
	const levelIssue = layoutWorkingLevelIssue(options.baseline, options.levelId);
	if (levelIssue !== null)
		return reject({ code: 'invalid_candidate_document', message: levelIssue });

	// P23.6I birth semantics. `planWallChain` is the **bounded compound** planner
	// (Rectangle/Polygon and explicit multi-point callers): the whole generated
	// chain uses one explicit height or the named authoring default, deliberately
	// with no per-leg or per-vertex inheritance — one gesture must produce one
	// coherent height. Continuous segment-first authoring resolves the birth height
	// from canonical topology in `planWallSegment` (see `resolveWallBirthHeight`)
	// and passes it explicitly, which is why the default lives here rather than a
	// Floor-derived value: the canonical Floor has no vertical extent to inherit.
	const height = options.height ?? WALL_AUTHORING_DEFAULT_HEIGHT;

	// --- draft normalization -------------------------------------------------
	const points = options.points.map((point) => [...point] as LayoutVec2);
	if (points.some((point) => point.some((value) => !Number.isFinite(value)))) {
		return reject({ code: 'non_finite_point', message: 'Chain points must be finite coordinates' });
	}
	// DECLARED CONNECTION ANCHORS, never coordinate coincidence (the
	// D-9 authoring rule, decision record §4.0.1 classes 2 and 3). A draft point
	// adopts an existing Junction id only when the operation DECLARED that
	// identity; the draft point then normalizes onto the stored coordinate, so a
	// tolerant match still yields exactly one spelling of the node. Ordinary
	// spatial placement (class 2) declares no anchor, so a point whose coordinates
	// coincide with an existing Junction mints its own record at those same
	// coordinates: distinct Junction identity, no connectivity, no adoption —
	// which the component-scoped validity gates (S4/S5) permit between independent
	// components.
	//
	// A declared anchor that no longer coincides with its draft point is a stale
	// caller claim, not a hint: the chain REFUSES rather than silently building
	// topology the caller did not ask for.
	const baselineJunctionById = new Map(
		options.baseline.junctions.map((junction) => [junction.id, junction]),
	);
	const declaredAnchorByPointIndex = new Map<number, string>();
	for (const snap of options.endpointJunctionSnaps ?? []) {
		if (declaredAnchorByPointIndex.has(snap.pointIndex)) {
			return reject({
				code: 'invalid_candidate_document',
				message: `Draft point ${snap.pointIndex} declares more than one Junction anchor`,
			});
		}
		declaredAnchorByPointIndex.set(snap.pointIndex, snap.junctionId);
	}
	for (const [pointIndex, junctionId] of declaredAnchorByPointIndex) {
		const declared = baselineJunctionById.get(junctionId);
		const point = points[pointIndex];
		if (!declared || !point) {
			return reject({
				code: 'invalid_candidate_document',
				message: `Declared Junction anchor '${junctionId}' names draft point ${pointIndex}, which this chain does not have`,
			});
		}
		if (!coincidesAsJunction(declared.point, point)) {
			return reject({
				code: 'invalid_candidate_document',
				message: `Declared Junction anchor '${junctionId}' does not coincide with draft point ${pointIndex}`,
			});
		}
	}
	const resolved: Array<{ junctionId: string | null; point: LayoutVec2 }> = points.map(
		(point, pointIndex) => {
			const declaredId = declaredAnchorByPointIndex.get(pointIndex);
			if (declaredId === undefined) return { junctionId: null, point };
			const declared = baselineJunctionById.get(declaredId)!;
			return { junctionId: declared.id, point: [...declared.point] as LayoutVec2 };
		},
	);

	// A final point coinciding with the chain's own first point closes the
	// chain implicitly (the duplicate leg would be zero-length anyway).
	let close = options.close;
	if (!close && resolved.length >= 2) {
		const firstPoint = resolved[0]!.point;
		const lastPoint = resolved.at(-1)!.point;
		if (coincidesAsJunction(firstPoint, lastPoint)) {
			close = true;
			resolved.pop();
		}
	}

	const minPoints = close ? 3 : 2;
	if (resolved.length < minPoints) {
		return reject({
			code: 'insufficient_chain',
			message: close
				? 'A closed chain needs at least three distinct vertices'
				: 'An open chain needs at least two distinct vertices',
		});
	}

	// Chain legs: consecutive resolved points, wrapping when closed.
	const legEndpoints: Array<{
		start: { junctionId: string | null; point: LayoutVec2 };
		end: { junctionId: string | null; point: LayoutVec2 };
	}> = [];
	const legCount = close ? resolved.length : resolved.length - 1;
	for (let index = 0; index < legCount; index += 1) {
		const start = resolved[index]!;
		const end = resolved[(index + 1) % resolved.length]!;
		if (coincidesAsJunction(start.point, end.point)) {
			return reject({ code: 'zero_length_leg', message: 'Chain legs must have non-zero length' });
		}
		// Refuse an oversized leg before noding, Room reconciliation or a compile
		// samples it. 1,000 m is the measured supported span; see
		// layout-geometry-limits.
		if (
			exceedsLayoutDimension(
				Math.hypot(end.point[0] - start.point[0], end.point[1] - start.point[1]),
			)
		) {
			return reject({ code: 'dimension_out_of_range', message: LAYOUT_DIMENSION_LIMIT_MESSAGE });
		}
		legEndpoints.push({ start, end });
	}
	if (exceedsLayoutDimension(height) || exceedsLayoutDimension(thickness)) {
		return reject({ code: 'dimension_out_of_range', message: LAYOUT_DIMENSION_LIMIT_MESSAGE });
	}

	// A3 — validate the one drawn Arc before any Wall is built. The leg keeps
	// the same two resolved points; only its centerline differs, so noding, Room
	// reconciliation and the canonical gates below see ordinary architecture.
	let arcLeg: {
		readonly pointIndex: number;
		readonly centerline: LayoutWall['centerline'];
	} | null = null;
	if (options.arc !== undefined && options.arc !== null) {
		const { pointIndex, apex } = options.arc;
		if (!Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex >= legEndpoints.length) {
			return reject({
				code: 'invalid_candidate_document',
				message: `Arc leg ${pointIndex} is not a leg this chain has`,
			});
		}
		const leg = legEndpoints[pointIndex]!;
		const built = wallChainArcCenterline(leg.start.point, leg.end.point, apex);
		if (built === null) {
			return reject({
				code: 'arc_rise_out_of_range',
				message: 'An Arc bulge must be positive and no more than half its chord',
			});
		}
		arcLeg = { pointIndex, centerline: built.centerline };
	}

	// P23B.3a S6 (review correction) — the DECLARED host-Wall anchors are
	// validated BEFORE any of them grants noding authority. A declaration is a
	// claim about a real relationship, so a malformed one fails closed instead of
	// silently authorizing noding of an unrelated group (the same fail-closed rule
	// the Junction anchors above already follow).
	const hostValidation = validateEndpointHostSnaps({
		baseline: options.baseline,
		resolved,
		legs: legEndpoints.map((leg) => ({ start: leg.start.point, end: leg.end.point })),
		declaredJunctionByPointIndex: declaredAnchorByPointIndex,
		hostSnaps: options.endpointHostSnaps ?? [],
	});
	if ('rejection' in hostValidation) return reject(hostValidation.rejection);
	const declaredHostByPointIndex = hostValidation.declaredHostByPointIndex;

	// --- self-intersection gate (chain against itself) ----------------------
	// Adjacent legs legitimately share the chain vertex; anything else — a
	// crossing, a T, an overlap, or a collinear self-touch — makes the
	// committed topology ambiguous, so the whole chain rejects.
	for (let first = 0; first < legEndpoints.length; first += 1) {
		for (let second = first + 1; second < legEndpoints.length; second += 1) {
			const a = legEndpoints[first]!;
			const b = legEndpoints[second]!;
			const adjacent =
				second === first + 1 || (close && first === 0 && second === legEndpoints.length - 1);
			// Linear adjacency shares a.end/b.start; the closing pair shares
			// a.start/b.end (the chain first vertex). IDs are only set for
			// pre-existing junctions here, so coordinate equality guards the test.
			const isWrapPair = close && first === 0 && second === legEndpoints.length - 1;
			const sharedJunctionId = isWrapPair ? a.start.junctionId : a.end.junctionId;
			const sharedPoint = isWrapPair ? a.start.point : a.end.point;
			const otherEndpointId = isWrapPair ? b.end.junctionId : b.start.junctionId;
			const otherPoint = isWrapPair ? b.end.point : b.start.point;
			const shared =
				adjacent &&
				sharedJunctionId !== null &&
				sharedJunctionId === otherEndpointId &&
				coincidesAsJunction(sharedPoint, otherPoint)
					? [sharedJunctionId]
					: [];
			const classified = classifyWallIntersection(
				{ id: `chain:${first}`, start: a.start.point, end: a.end.point },
				{ id: `chain:${second}`, start: b.start.point, end: b.end.point },
				shared,
			);
			if (
				classified.kind === 'collinear-overlap' ||
				classified.kind === 'collinear-endpoint-touch'
			) {
				return reject({
					code: 'collinear_overlap',
					message: 'Chain legs overlap on one line; trim or redraw the overlapping span',
				});
			}
			if (classified.kind === 'proper-crossing' || classified.kind === 'endpoint-on-interior') {
				return reject({
					code: 'self_intersecting_chain',
					message: 'Chain crosses itself; split the sketch into separate chains',
				});
			}
		}
	}

	// --- closed-to-ring transaction (C2) ------------------------------------
	// If any declared snap targets a closed Wall or its seam Junction, partition
	// the closed 16-span Wall once into open arcs before inserting the new chain
	// legs so no intermediate ring is ever installed.
	const baselineWallsById = new Map(options.baseline.walls.map((w) => [w.id, w] as const));
	const targetedClosedWallIds = new Set<string>();
	for (const wallId of declaredHostByPointIndex.values()) {
		const w = baselineWallsById.get(wallId);
		if (w && isClosedWall(w)) targetedClosedWallIds.add(w.id);
	}
	for (const junctionId of declaredAnchorByPointIndex.values()) {
		for (const w of options.baseline.walls) {
			if (isClosedWall(w) && w.startJunctionId === junctionId) {
				targetedClosedWallIds.add(w.id);
			}
		}
	}

	if (targetedClosedWallIds.size > 0) {
		const sortedClosedWallIds = [...targetedClosedWallIds].sort();
		type SnappedClosedPoint =
			| { readonly pointIndex: number; readonly kind: 'seam' }
			| {
					readonly pointIndex: number;
					readonly kind: 'interior';
					readonly split: ResolvedWallSplitResult;
			  };
		type PreparedClosedHost = {
			readonly closedWall: LayoutWall;
			readonly roundRoomId: string;
			readonly seamPoint: LayoutVec2;
			readonly closedLength: number;
			readonly snappedPoints: readonly SnappedClosedPoint[];
			readonly stationCandidates: readonly (readonly ResolvedWallSplitResult[])[];
		};
		const preparedHosts: PreparedClosedHost[] = [];

		for (const closedWallId of sortedClosedWallIds) {
			const closedWall = baselineWallsById.get(closedWallId)!;
			const roundRoom = findEnclosingRoundRoomForWall(options.baseline, closedWallId);
			if (!roundRoom) {
				return reject({
					code: 'closed_wall_isolated',
					message: `Closed Wall '${closedWallId}' has no enclosing Round Room`,
					wallIds: [closedWallId],
				});
			}
			const cert = certifyRoundRoom(options.baseline, roundRoom);
			if (cert.kind === 'invalid') {
				return reject({
					code: 'invalid_candidate_document',
					message: cert.issue.message,
					wallIds: [closedWallId],
				});
			}
			if (closedWall.centerline.kind !== 'cubic-chain') {
				return reject({
					code: 'invalid_candidate_document',
					message: `Closed Wall '${closedWallId}' must be a cubic-chain`,
					wallIds: [closedWallId],
				});
			}
			const seamPoint = cert.certified.seamPoint;
			const closedChain = {
				startPoint: seamPoint,
				endPoint: seamPoint,
				knots: closedWall.centerline.knots,
				spans: closedWall.centerline.spans,
			};
			const closedLength = wallCurveChainLength(closedChain);
			const safeCuts = enumerateClosedWallSafeCutStations(
				options.baseline.openings,
				closedWallId,
				closedLength,
			);
			if (safeCuts.seamOccupied) {
				return reject({
					code: 'noding_rejected',
					message: `Opening '${safeCuts.seamBlockingOpeningIds.join(', ')}' spans the seam of closed Wall '${closedWallId}'; move it off the seam before attaching`,
					wallIds: [closedWallId],
				});
			}
			const sampledClosed = wallCenterlineSamples(closedWall, seamPoint, seamPoint, 'forward');
			if (!sampledClosed) {
				return reject({
					code: 'noding_rejected',
					message: `Closed Wall '${closedWallId}' cannot be sampled`,
					wallIds: [closedWallId],
				});
			}

			const snappedPoints: SnappedClosedPoint[] = [];
			const closedSnappedIndices = new Set<number>();
			for (const [pointIndex, wallId] of declaredHostByPointIndex) {
				if (wallId === closedWallId) closedSnappedIndices.add(pointIndex);
			}
			for (const [pointIndex, junctionId] of declaredAnchorByPointIndex) {
				if (junctionId === closedWall.startJunctionId) closedSnappedIndices.add(pointIndex);
			}

			for (const pointIndex of [...closedSnappedIndices].sort((a, b) => a - b)) {
				const pt = resolved[pointIndex]!.point;
				if (
					declaredAnchorByPointIndex.get(pointIndex) === closedWall.startJunctionId ||
					coincidesAsJunction(pt, seamPoint)
				) {
					snappedPoints.push({ pointIndex, kind: 'seam' });
					continue;
				}
				const proj = projectPointToSampledSegment(pt, sampledClosed);
				const splitRes = resolveWallCurveSplit(closedChain, proj.distance);
				if (splitRes.kind === 'rejected') {
					if (splitRes.code === 'split_at_endpoint') {
						snappedPoints.push({ pointIndex, kind: 'seam' });
						continue;
					}
					return reject({
						code: 'noding_rejected',
						message: splitRes.message,
						wallIds: [closedWallId],
					});
				}
				snappedPoints.push({ pointIndex, kind: 'interior', split: splitRes.result });
			}

			const uniqueInteriorCuts: ResolvedWallSplitResult[] = [];
			const interiorEntries = snappedPoints
				.filter(
					(entry): entry is Extract<SnappedClosedPoint, { kind: 'interior' }> =>
						entry.kind === 'interior',
				)
				.sort((a, b) => a.split.distance - b.split.distance);
			for (const entry of interiorEntries) {
				if (
					!uniqueInteriorCuts.some((existing) =>
						coincidesAsJunction(existing.point, entry.split.point),
					)
				) {
					uniqueInteriorCuts.push(entry.split);
				}
			}

			let stationCandidates: (readonly ResolvedWallSplitResult[])[];
			if (uniqueInteriorCuts.length > 0) {
				stationCandidates = [uniqueInteriorCuts];
			} else {
				stationCandidates = [];
				for (const candidateStation of safeCuts.candidates) {
					const splitRes = resolveWallCurveSplit(closedChain, candidateStation);
					if (splitRes.kind !== 'resolved') continue;
					if (coincidesAsJunction(splitRes.result.point, seamPoint)) continue;
					stationCandidates.push([splitRes.result]);
				}
				if (stationCandidates.length === 0) {
					return reject({
						code: 'noding_rejected',
						message: `No admissible second cut found to attach at seam of closed Wall '${closedWallId}'`,
						wallIds: [closedWallId],
					});
				}
			}

			preparedHosts.push({
				closedWall,
				roundRoomId: roundRoom.id,
				seamPoint,
				closedLength,
				snappedPoints,
				stationCandidates,
			});
		}

		// Enumerate combinations ordered by increasing index sum so `[0, 0, ...]`
		// (opposite station on each seam-only host) is tried first, capped at 64.
		const MAX_SEAM_CANDIDATE_COMBINATIONS = 64;
		const maxSum = preparedHosts.reduce((sum, host) => sum + host.stationCandidates.length - 1, 0);
		const combinations: number[][] = [];
		const collectWithSum = (hostIndex: number, remainingSum: number, current: number[]): void => {
			if (combinations.length >= MAX_SEAM_CANDIDATE_COMBINATIONS) return;
			if (hostIndex === preparedHosts.length - 1) {
				const maxIdx = preparedHosts[hostIndex]!.stationCandidates.length - 1;
				if (remainingSum >= 0 && remainingSum <= maxIdx) {
					combinations.push([...current, remainingSum]);
				}
				return;
			}
			const maxIdx = Math.min(remainingSum, preparedHosts[hostIndex]!.stationCandidates.length - 1);
			for (let idx = 0; idx <= maxIdx; idx += 1) {
				current.push(idx);
				collectWithSum(hostIndex + 1, remainingSum - idx, current);
				current.pop();
				if (combinations.length >= MAX_SEAM_CANDIDATE_COMBINATIONS) return;
			}
		};
		for (
			let targetSum = 0;
			targetSum <= maxSum && combinations.length < MAX_SEAM_CANDIDATE_COMBINATIONS;
			targetSum += 1
		) {
			collectWithSum(0, targetSum, []);
		}

		let firstRejection: WallChainPlan | null = null;
		for (const combo of combinations) {
			const closedSpecs: ClosedToRingSpec[] = preparedHosts.map((host, hostIdx) => ({
				closedWall: host.closedWall,
				roundRoomId: host.roundRoomId,
				seamPoint: host.seamPoint,
				closedLength: host.closedLength,
				stations: host.stationCandidates[combo[hostIdx]!]!,
				snappedPoints: host.snappedPoints,
			}));
			const attempt = executeWallChainCandidate(
				options,
				thickness,
				height,
				resolved,
				legEndpoints,
				close,
				arcLeg,
				declaredHostByPointIndex,
				closedSpecs,
			);
			if (attempt.kind === 'success') return attempt;
			firstRejection ??= attempt;
		}
		return (
			firstRejection ??
			reject({
				code: 'noding_rejected',
				message: `No admissible second cut found to attach at seam of closed Wall '${sortedClosedWallIds[0]!}'`,
				wallIds: sortedClosedWallIds,
			})
		);
	}

	return executeWallChainCandidate(
		options,
		thickness,
		height,
		resolved,
		legEndpoints,
		close,
		arcLeg,
		declaredHostByPointIndex,
		[],
	);
}

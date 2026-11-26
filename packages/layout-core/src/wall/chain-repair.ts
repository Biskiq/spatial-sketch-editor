import type { LayoutDocumentWallFirst, LayoutWall } from './types';
import type { LayoutVec2 } from '../geometry/coordinates';
import { projectPointToSampledSegment } from '../geometry/curve';
import type { TopologySegment } from './topology';
import { classifyWallIntersection } from './topology';
import { detectWallCurveTopologyCrossings } from '../topology/curve-crossings';
import {
	topologyComponentKeyByJunctionId,
	topologyComponentKeyByWallId,
} from '../room/topology-components';
import { wallCenterlineSamples } from './centerline';
import { resolveWallCurveSplit } from './curve-algebra';
import { JUNCTION_COINCIDENCE_EPSILON, coincidesAsJunction } from './junction-identity';
import type { WallChainRejection } from './chain-types';
import {
	adoptableJunctionAt,
	duplicateJunctionsAt,
	teeThroughJunction,
	wallById,
} from './chain-noding';

export type NodingFix =
	| { kind: 'crossing'; wallIds: [string, string]; point: LayoutVec2 }
	| {
			kind: 'tee';
			interiorWallId: string;
			endpointJunctionId: string;
			splitDistance: number;
			point: LayoutVec2;
			projectOwnedEndpoint?: boolean;
	  }
	| { kind: 'adopt'; keepJunctionId: string; duplicateJunctionIds: string[] }
	| { kind: 'reject'; rejection: WallChainRejection };

/**
 * Find the next un-noded relationship this operation is AUTHORIZED to resolve: a
 * chain wall against a Wall it may acquire topology from — a DECLARED host, or a
 * Wall already in the chain's own connected component. A pair
 * involving an independent, undeclared Wall is skipped outright, so a permitted
 * overlap never becomes a join. Returns `null` when no such relationship remains.
 */
export function nextNodingFix(
	document: LayoutDocumentWallFirst,
	chainDerivedWallIds: readonly string[],
	operationOwnedJunctionIds: ReadonlySet<string>,
	endpointHostWallIds: ReadonlyMap<string, ReadonlySet<string>>,
): NodingFix | null {
	const chainSet = new Set(chainDerivedWallIds);
	// The operation's DECLARED scope. `declaredHostWallIds` are the
	// pre-existing Walls this chain explicitly anchored to; any other pre-existing
	// Wall is authorizable only by CONNECTIVITY (the chain is already in its
	// component, because it adopted one of that group's Junctions or earlier
	// noding joined them). With no anchors the chain is its own component, so no
	// pre-existing Wall is authorizable and this function finds no fix at all:
	// independent placement neither adopts nor splits, and its overlaps stay the
	// permitted geometry S4/S5 admit.
	const declaredHostWallIds = new Set<string>();
	for (const wallIds of endpointHostWallIds.values()) {
		for (const id of wallIds) declaredHostWallIds.add(id);
	}
	const componentKeyByWallId = topologyComponentKeyByWallId(document);
	const junctionComponentKeyById = topologyComponentKeyByJunctionId(document, componentKeyByWallId);
	const segments = new Map<string, TopologySegment>();
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	for (const wall of document.walls) {
		const start = junctionById.get(wall.startJunctionId);
		const end = junctionById.get(wall.endJunctionId);
		if (!start || !end) continue;
		segments.set(wall.id, { id: wall.id, start: start.point, end: end.point });
	}
	const walls = document.walls;
	for (let first = 0; first < walls.length; first += 1) {
		const a = walls[first]!;
		const segmentA = segments.get(a.id)!;
		for (let second = first + 1; second < walls.length; second += 1) {
			const b = walls[second]!;
			const oneIsChain = chainSet.has(a.id) || chainSet.has(b.id);
			if (!oneIsChain) continue; // pre-existing relationships are already noded
			// AUTHORIZATION (above): only a DECLARED host Wall, or a Wall the chain
			// is already connected to, may acquire topology from this operation. A
			// cross-group pair is skipped outright — no adoption, no split — which is
			// what keeps an independent overlap from becoming a join.
			const chainWallId = chainSet.has(a.id) ? a.id : b.id;
			const hostWallId = chainSet.has(a.id) ? b.id : a.id;
			if (
				!declaredHostWallIds.has(hostWallId) &&
				componentKeyByWallId.get(chainWallId) !== componentKeyByWallId.get(hostWallId)
			) {
				continue;
			}
			const segmentB = segments.get(b.id)!;
			const shared =
				a.startJunctionId === b.startJunctionId || a.startJunctionId === b.endJunctionId
					? [a.startJunctionId]
					: a.endJunctionId === b.startJunctionId || a.endJunctionId === b.endJunctionId
						? [a.endJunctionId]
						: [];
			const classified = classifyWallIntersection(segmentA, segmentB, shared);
			if (
				classified.kind === 'collinear-overlap' ||
				classified.kind === 'collinear-endpoint-touch'
			) {
				return {
					kind: 'reject',
					rejection: {
						code: 'collinear_overlap',
						message: `Chain overlaps existing wall '${chainSet.has(a.id) ? b.id : a.id}' on one line; trim or redraw the overlapping span`,
						wallIds: [a.id, b.id],
					},
				};
			}
			// A wall-span snap is an ordinary floating-point projection. On an
			// oblique host its rounded coordinate can sit ~1e-16 m off the exact
			// supporting line, so the robust classifier truthfully returns `none`,
			// `invalid`, or a crossing infinitesimally before the authored endpoint.
			// Recover only an authored endpoint within the canonical Junction-identity
			// tolerance of a pre-existing host interior. This is snap normalization,
			// not a general intersection epsilon: geometry farther away remains
			// disconnected and the exact classifier still owns every other case.
			const projectedTee = projectedAuthoredEndpointTee(
				a,
				segmentA,
				b,
				segmentB,
				chainSet,
				operationOwnedJunctionIds,
				endpointHostWallIds,
				shared,
			);
			if (projectedTee) return projectedTee;
			if (classified.kind === 'proper-crossing') {
				// A crossing that lands on an existing Junction is a node, not an X:
				// splitting a wall that already ends there has a degenerate
				// distance, so node through the Junction instead.
				const existing = adoptableJunctionAt(
					document,
					[a, b],
					classified.point,
					junctionComponentKeyById,
					componentKeyByWallId,
				);
				if (existing) {
					const throughJunction = teeThroughJunction([segmentA, segmentB], existing);
					if (throughJunction) return throughJunction;
					const duplicates = duplicateJunctionsAt(document, [a, b], classified.point, existing.id);
					if (duplicates.length > 0) {
						return { kind: 'adopt', keepJunctionId: existing.id, duplicateJunctionIds: duplicates };
					}
					// `teeThroughJunction` skips a segment the Junction is already an
					// endpoint of, and duplicate records have just been ruled out, so
					// both walls already meet at this node: there is nothing left to
					// node, and a `crossing` fix here would request a zero-distance
					// split. Skip the pair and keep scanning for a real relationship.
					continue;
				}
				return { kind: 'crossing', wallIds: [a.id, b.id], point: classified.point };
			}
			if (classified.kind === 'endpoint-on-interior') {
				// The T junction is the endpoint wall's junction at the touch
				// point; the interior wall splits against it.
				const endpointWall = wallById(document, classified.endpointWallId);
				const endpointJunctionId =
					endpointWall &&
					coincidesAsJunction(segments.get(classified.endpointWallId)!.start, classified.point)
						? endpointWall.startJunctionId
						: endpointWall?.endJunctionId;
				if (!endpointJunctionId) continue;
				const interiorWall = wallById(document, classified.interiorWallId)!;
				// A touch point that coincides with an existing Junction is the same
				// physical node — including the interior wall's *own* endpoint (the
				// near-miss case: the click landed a hair short of the Junction it
				// meant). Adopt that identity instead of planning a split whose
				// distance would be degenerate (`Split distance …`).
				const coincident = adoptableJunctionAt(
					document,
					[a, b],
					classified.point,
					junctionComponentKeyById,
					componentKeyByWallId,
				);
				if (coincident) {
					// `a`/`b` are the endpoint wall and the interior wall of this T.
					const duplicates = duplicateJunctionsAt(
						document,
						[a, b],
						classified.point,
						coincident.id,
					);
					if (duplicates.length > 0) {
						return {
							kind: 'adopt',
							keepJunctionId: coincident.id,
							duplicateJunctionIds: duplicates,
						};
					}
				}
				const interiorStart = junctionById.get(interiorWall.startJunctionId)!.point;
				const splitDistance = Math.hypot(
					classified.point[0] - interiorStart[0],
					classified.point[1] - interiorStart[1],
				);
				return {
					kind: 'tee',
					interiorWallId: classified.interiorWallId,
					endpointJunctionId,
					splitDistance,
					point: classified.point,
				};
			}
		}
	}
	return null;
}

/**
 * Recover the semantic T encoded by an authored endpoint projected onto a
 * host Wall. The recovery is deliberately asymmetric: only Junctions created
 * by this command may move, and only onto a non-chain host. A chain Wall can
 * reuse a baseline Junction, so Wall lineage alone is not sufficient proof of
 * endpoint ownership.
 *
 * Straight hosts retain their existing chord projection. A curved host is a
 * bounded exception to the straight-only noding rule: the endpoint is first
 * projected against the canonical sampled centerline, then that sampled arc
 * distance is resolved once through the exact cubic split authority. The
 * normalized endpoint and the split distance both come from that resolved
 * result, so the subsequent split cannot fall back to chord arithmetic.
 */
function projectedAuthoredEndpointTee(
	a: LayoutWall,
	segmentA: TopologySegment,
	b: LayoutWall,
	segmentB: TopologySegment,
	chainSet: ReadonlySet<string>,
	operationOwnedJunctionIds: ReadonlySet<string>,
	endpointHostWallIds: ReadonlyMap<string, ReadonlySet<string>>,
	sharedJunctionIds: readonly string[],
): NodingFix | undefined {
	if (sharedJunctionIds.length > 0) return undefined;
	const candidates: Array<{
		endpointWall: LayoutWall;
		endpointSegment: TopologySegment;
		hostWall: LayoutWall;
		hostSegment: TopologySegment;
	}> = [];
	if (chainSet.has(a.id) && !chainSet.has(b.id)) {
		candidates.push({
			endpointWall: a,
			endpointSegment: segmentA,
			hostWall: b,
			hostSegment: segmentB,
		});
	}
	if (chainSet.has(b.id) && !chainSet.has(a.id)) {
		candidates.push({
			endpointWall: b,
			endpointSegment: segmentB,
			hostWall: a,
			hostSegment: segmentA,
		});
	}
	for (const { endpointWall, endpointSegment, hostWall, hostSegment } of candidates) {
		const endpoints = [
			{ junctionId: endpointWall.startJunctionId, point: endpointSegment.start },
			{ junctionId: endpointWall.endJunctionId, point: endpointSegment.end },
		];
		for (const endpoint of endpoints) {
			if (!operationOwnedJunctionIds.has(endpoint.junctionId)) continue;
			const snappedHostWallIds = endpointHostWallIds.get(endpoint.junctionId);
			if (snappedHostWallIds !== undefined && !snappedHostWallIds.has(hostWall.id)) continue;
			const hostEndpoints = [
				{ junctionId: hostWall.startJunctionId, point: hostSegment.start },
				{ junctionId: hostWall.endJunctionId, point: hostSegment.end },
			];
			// The editor normally resolves a Junction snap before this planner. Keep
			// the same identity rule here for a direct/headless caller too: a host
			// endpoint is adoption, never a tiny fragment.
			const coincidentHostEndpoint = hostEndpoints.find((hostEndpoint) =>
				coincidesAsJunction(endpoint.point, hostEndpoint.point),
			);
			if (coincidentHostEndpoint) {
				return {
					kind: 'adopt',
					keepJunctionId: coincidentHostEndpoint.junctionId,
					duplicateJunctionIds: [endpoint.junctionId],
				};
			}

			if (hostWall.centerline.kind === 'cubic-chain') {
				const sampled = wallCenterlineSamples(
					hostWall,
					hostSegment.start,
					hostSegment.end,
					'forward',
				);
				if (!sampled) continue;
				const projection = projectPointToSampledSegment(endpoint.point, sampled);
				// A snapped `wall-span` identity already established the host
				// relationship. Without that identity, retain only the existing
				// Junction coincidence tolerance; sampler flatness is normalization
				// error and must not acquire topology by itself.
				const hasExplicitHostIdentity = snappedHostWallIds?.has(hostWall.id) ?? false;
				if (!hasExplicitHostIdentity && projection.distanceToPath > JUNCTION_COINCIDENCE_EPSILON)
					continue;
				const resolution = resolveWallCurveSplit(
					{
						startPoint: hostSegment.start,
						endPoint: hostSegment.end,
						knots: hostWall.centerline.knots,
						spans: hostWall.centerline.spans,
					},
					projection.distance,
				);
				if (resolution.kind === 'rejected') continue;
				const resolved = resolution.result;
				// A projection at an existing host endpoint is identity adoption, not
				// an exact curved split with a near-zero fragment. The direct point
				// check above handles ordinary snapped endpoints; this also catches a
				// clamped sampled projection whose arc distance is at the boundary.
				const hostEndpointAtResolution = hostEndpoints.find((hostEndpoint) =>
					coincidesAsJunction(resolved.point, hostEndpoint.point),
				);
				if (hostEndpointAtResolution) {
					return {
						kind: 'adopt',
						keepJunctionId: hostEndpointAtResolution.junctionId,
						duplicateJunctionIds: [endpoint.junctionId],
					};
				}
				if (
					!hasExplicitHostIdentity &&
					Math.hypot(endpoint.point[0] - resolved.point[0], endpoint.point[1] - resolved.point[1]) >
						JUNCTION_COINCIDENCE_EPSILON
				) {
					continue;
				}
				return {
					kind: 'tee',
					interiorWallId: hostSegment.id,
					endpointJunctionId: endpoint.junctionId,
					splitDistance: resolved.distance,
					point: [resolved.point[0], resolved.point[1]],
					projectOwnedEndpoint: true,
				};
			}

			const dx = hostSegment.end[0] - hostSegment.start[0];
			const dz = hostSegment.end[1] - hostSegment.start[1];
			const lengthSquared = dx * dx + dz * dz;
			if (!(lengthSquared > 0)) continue;
			const t =
				((endpoint.point[0] - hostSegment.start[0]) * dx +
					(endpoint.point[1] - hostSegment.start[1]) * dz) /
				lengthSquared;
			const length = Math.sqrt(lengthSquared);
			const endpointMargin = JUNCTION_COINCIDENCE_EPSILON / length;
			if (!(t > endpointMargin && t < 1 - endpointMargin)) continue;
			const projected: LayoutVec2 = [hostSegment.start[0] + dx * t, hostSegment.start[1] + dz * t];
			if (!coincidesAsJunction(endpoint.point, projected)) continue;
			return {
				kind: 'tee',
				interiorWallId: hostSegment.id,
				endpointJunctionId: endpoint.junctionId,
				splitDistance: t * length,
				point: projected,
				projectOwnedEndpoint: true,
			};
		}
	}
	return undefined;
}

/**
 * Final topology gate over the committed candidate: every wall pair IN ONE
 * CONNECTED COMPONENT must relate only through explicit shared junctions (or be
 * disjoint). This is the same bar `validateWallFirstTopology` holds the
 * precision and P23.6a Room-move candidates to — the plan forbids un-noded
 * visual crossings in committed data — and, since P23B.3a S5, the same SUBJECT:
 * the connected component, not the document.
 *
 * Connectivity is the TRANSITIVE closure of explicit authored Junction identity,
 * never coordinates: two Walls with no Junction id in common can still be one
 * component through a third Wall, and two Walls whose endpoints merely coincide are
 * in different components. Labelling is the S2 general Wall/Junction test.
 */
export function validateChainTopology(
	document: LayoutDocumentWallFirst,
): WallChainRejection | null {
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	const entries: Array<{ wall: LayoutWall; segment: TopologySegment }> = [];
	for (const wall of document.walls) {
		const start = junctionById.get(wall.startJunctionId);
		const end = junctionById.get(wall.endJunctionId);
		if (!start || !end) continue;
		entries.push({ wall, segment: { id: wall.id, start: start.point, end: end.point } });
	}
	// The chord classifier below is exact for straight/straight
	// relationships and stays authoritative there. A curved Wall can bow across
	// a new straight Wall while its endpoint chord never intersects it, so the
	// canonical sampled crossing authority runs on the built candidate before
	// commit. It is the SAME gate `validateWallFirstTopology` runs — never a
	// second crossing algorithm — and any curve crossing that would need
	// automatic curved noding rejects the whole authoring command.
	//
	// SUBJECT: the sampled authority is called with ITS shipped subject
	// (the connected component); the transitional document-subject form S4 left for
	// this caller is gone. The chord loop below is scoped the same way, in the same
	// commit, so the two halves of this gate cannot disagree — and neither can this
	// gate and `validateWallFirstTopology`. NOT changed here: this planner's own
	// AUTHORING behaviour. Adoption and crossing-split still run exactly as they do
	// for an operation that DECLARES the group it extends; withdrawing them from
	// INDEPENDENT placement is the authoring-intent split S6 landed in the draft
	// normalization and `nextNodingFix` above/without touching this verdict.
	const curveCrossing = detectWallCurveTopologyCrossings(
		document,
		new Map(entries.map((entry) => [entry.wall.id, entry.segment] as const)),
	);
	if (curveCrossing) {
		return curveCrossing.kind === 'self'
			? {
					code: 'self_intersecting_chain',
					message: `Wall '${curveCrossing.wallId}' centerline intersects itself`,
					wallIds: [curveCrossing.wallId],
				}
			: {
					code: 'self_intersecting_chain',
					message: `Walls '${curveCrossing.wallIds[0]}' and '${curveCrossing.wallIds[1]}' have unsupported ${
						curveCrossing.sharedJunctionId
							? 'crossing away from their shared Junction'
							: 'centerline crossing'
					}`,
					wallIds: [...curveCrossing.wallIds],
				};
	}
	const segments = entries.map((entry) => entry.segment);
	// The chord half takes the SAME subject as everything above it: a
	// pair from two different components is permitted geometry, so it is skipped
	// before the unchanged classifier sees it. Every pair that shares an explicit
	// Junction is in one component by construction, so the `shared-explicit-junction`
	// branch below is never skipped and no same-component verdict is lost.
	const keyByWallId = topologyComponentKeyByWallId(document);
	for (let first = 0; first < entries.length; first += 1) {
		for (let second = first + 1; second < entries.length; second += 1) {
			const a = entries[first]!.wall;
			const b = entries[second]!.wall;
			if (keyByWallId.get(a.id) !== keyByWallId.get(b.id)) continue;
			const shared =
				a.startJunctionId === b.startJunctionId || a.startJunctionId === b.endJunctionId
					? [a.startJunctionId]
					: a.endJunctionId === b.startJunctionId || a.endJunctionId === b.endJunctionId
						? [a.endJunctionId]
						: [];
			const classified = classifyWallIntersection(segments[first]!, segments[second]!, shared);
			if (classified.kind === 'shared-explicit-junction') {
				const geometric = classifyWallIntersection(segments[first]!, segments[second]!, []);
				const sharesBothJunctions =
					(a.startJunctionId === b.startJunctionId && a.endJunctionId === b.endJunctionId) ||
					(a.startJunctionId === b.endJunctionId && a.endJunctionId === b.startJunctionId);
				const twoWallLens =
					sharesBothJunctions &&
					(a.centerline.kind === 'cubic-chain' || b.centerline.kind === 'cubic-chain');
				if (geometric.kind === 'collinear-overlap' && !twoWallLens) {
					return {
						code: 'collinear_overlap',
						message: `Walls '${a.id}' and '${b.id}' overlap beyond their explicit shared junction`,
						wallIds: [a.id, b.id],
					};
				}
				continue;
			}
			if (classified.kind !== 'none') {
				return {
					code: 'self_intersecting_chain',
					message: `Walls '${a.id}' and '${b.id}' have unsupported ${classified.kind}`,
					wallIds: [a.id, b.id],
				};
			}
		}
	}
	return null;
}

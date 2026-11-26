import type { LayoutVec2 } from './coordinates';
import type { LayoutDocumentWallFirst } from '../wall/types';
import type { LayoutWall } from '../wall/types';
import type {
	CompiledJunction,
	CompiledJunctionLeg,
	CompiledLegJoin,
	CompiledPhysicalWall,
	LayoutGeometryIssue,
} from './types';
import { junctionSeamFailureOf } from '../wall/junction-clearance';
import {
	JUNCTION_BAND_EPSILON,
	compiledJunctionId,
	endpointSolidBands,
	isTangentContinuation,
	resolveJunctionGeometry,
	tangentAnchorsAllowContinuation,
} from '../wall/junction-resolution';
import { cacheKeyOf } from './keys';
import type { LayoutCompileReuse } from './reuse';
import { sameAuthored } from './reuse';
import { floorElevationOf } from './physical-walls';

/**
 *  Task 1/2 — build the compiled Junction records from canonical
 * incidence and resolve each Junction locally. `bottomY`/`topY` on a leg are
 * wall-local (0 = Wall base), matching compiled section coordinates; bounds3
 * adds `floorElevation`.
 */
export function compileWallFirstJunctions(
	document: LayoutDocumentWallFirst,
	walls: readonly CompiledPhysicalWall[],
	floorElevation: number,
	issues: LayoutGeometryIssue[],
	reuse?: LayoutCompileReuse,
	legsByWallId?: ReadonlyMap<string, { start?: CompiledJunctionLeg; end?: CompiledJunctionLeg }>,
): CompiledJunction[] {
	const pointById = new Map(document.junctions.map((junction) => [junction.id, junction.point]));
	const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));
	const legsByJunction = new Map<string, CompiledJunctionLeg[]>();
	const pushLeg = (junctionId: string, leg: CompiledJunctionLeg): void => {
		const list = legsByJunction.get(junctionId);
		if (list) list.push(leg);
		else legsByJunction.set(junctionId, [leg]);
	};
	for (const wall of walls) {
		if (wall.samples.length < 2) continue;
		// A retained Wall already carries its endpoint legs,
		// derived when the Wall was compiled, so the Junction pass never re-derives
		// one per Wall per compile.
		const retainedLegs = legsByWallId?.get(wall.wallId);
		if (retainedLegs) {
			const startId = wall.startJunctionId;
			const endId = wall.endJunctionId;
			if (retainedLegs.start && startId && pointById.has(startId))
				pushLeg(startId, retainedLegs.start);
			if (retainedLegs.end && endId && pointById.has(endId)) pushLeg(endId, retainedLegs.end);
			continue;
		}
		if (wall.startJunctionId && pointById.has(wall.startJunctionId)) {
			pushLeg(wall.startJunctionId, junctionLeg(wall, 'start'));
		}
		if (wall.endJunctionId && pointById.has(wall.endJunctionId)) {
			pushLeg(wall.endJunctionId, junctionLeg(wall, 'end'));
		}
	}
	const junctions: CompiledJunction[] = [];
	for (const [junctionId, legs] of legsByJunction) {
		const point = pointById.get(junctionId);
		if (!point) continue;
		// Cyclic adjacency order only — never physical ownership (Decision 4).
		legs.sort(
			(a, b) =>
				a.outwardAngle - b.outwardAngle ||
				(a.wallId < b.wallId ? -1 : a.wallId > b.wallId ? 1 : 0) ||
				(a.end < b.end ? -1 : a.end > b.end ? 1 : 0),
		);
		const { authored: junctionAuthored, roundedContinuation } = junctionInputs(
			document,
			point,
			legs,
			wallById,
			pointById,
		);
		if (reuse) reuse.counters.signatureVisits += 1;
		const retainedJunction = reuse?.junctions.get(junctionId);
		if (reuse && retainedJunction && sameAuthored(retainedJunction.authored, junctionAuthored)) {
			reuse.counters.junctionsReused += 1;
			junctions.push(retainedJunction.compiled);
			for (const issue of retainedJunction.issues) issues.push(issue);
			continue;
		}
		if (reuse) reuse.counters.junctionsEvaluated += 1;
		const junctionIssues: LayoutGeometryIssue[] = [];
		const resolved = resolveJunctionGeometry(junctionId, point, legs, { roundedContinuation });
		junctionIssues.push(...resolved.issues);
		// Canonical seam acceptance. Validity is decided HERE, from the
		// resolved geometry the renderers consume, so a mesh builder is never the
		// first place a seam failure is discovered. The resolution already reports
		// a fold (it needs that fact for control flow); this de-duplicates by code
		// so one Junction never produces the same issue twice.
		const seam = junctionSeamFailureOf({
			junctionId,
			point,
			legs,
			resolution: resolved.resolution,
		});
		if (seam && !resolved.issues.some((issue) => issue.code === seam.code)) {
			junctionIssues.push({
				path: `junctions.${junctionId}`,
				code: seam.code,
				message: seam.message,
				targetId: junctionId,
			});
		}
		for (const issue of junctionIssues) issues.push(issue);
		const minBand = Math.min(...legs.map((leg) => leg.bottomY));
		const maxBand = Math.max(...legs.map((leg) => leg.topY));
		const resolvedJunction: CompiledJunction = {
			id: compiledJunctionId(document.floor.id, junctionId),
			cacheKey: cacheKeyOf([
				'compiled-junction',
				document.floor.id,
				junctionId,
				point,
				// Every resolution-affecting endpoint fact: thickness, frame, extent,
				// role and the compiled Opening facts (solid bands). A changed endpoint
				// Opening height/sill therefore changes the key even when
				// `endpointOpen` stays `true`, which is exactly when the resolved
				// Junction geometry changes. `legs` is already in deterministic
				// (adjacency-angle, wallId) order, so the serialization is stable.
				legs.map((leg) => ({
					wallId: leg.wallId,
					end: leg.end,
					tangentOut: leg.tangentOut,
					normalOut: leg.normalOut,
					thickness: leg.thickness,
					bottomY: leg.bottomY,
					topY: leg.topY,
					role: leg.role,
					endpointOpen: leg.endpointOpen,
					endpointSolidBands: leg.endpointSolidBands.map((band) => [
						band.bottomY,
						band.topY,
						band.solid,
						band.openingId ?? null,
					]),
				})),
				...(roundedContinuation ? ['rounded-continuation'] : []),
			]),
			junctionId,
			point,
			legs,
			resolution: resolved.resolution,
			bounds3: {
				min: [
					resolved.resolution.bounds2.min[0],
					floorElevation + minBand,
					resolved.resolution.bounds2.min[1],
				],
				max: [
					resolved.resolution.bounds2.max[0],
					floorElevation + maxBand,
					resolved.resolution.bounds2.max[1],
				],
			},
		};
		junctions.push(resolvedJunction);
		if (reuse)
			reuse.junctions.set(junctionId, {
				authored: junctionAuthored,
				compiled: resolvedJunction,
				issues: junctionIssues,
			});
	}
	junctions.sort((a, b) =>
		a.junctionId < b.junctionId ? -1 : a.junctionId > b.junctionId ? 1 : 0,
	);
	return junctions;
}

/** Keep cold compilation, delta compilation and passive cache seeding in agreement. */
export function junctionInputs(
	document: LayoutDocumentWallFirst,
	point: LayoutVec2,
	legs: readonly CompiledJunctionLeg[],
	wallById: ReadonlyMap<string, LayoutWall>,
	pointById: ReadonlyMap<string, LayoutVec2>,
) {
	const tangentAnchors = junctionTangentAnchors(legs, wallById, pointById);
	const roundedContinuation =
		tangentAnchors !== undefined && tangentAnchorsAllowContinuation(point, tangentAnchors);
	return {
		authored: [point, legs, document.floor.id, floorElevationOf(document), roundedContinuation],
		roundedContinuation,
	};
}

/** Resolve the source points that set a degree-two pair's derivatives. */
function junctionTangentAnchors(
	legs: readonly CompiledJunctionLeg[],
	wallById: ReadonlyMap<string, LayoutWall>,
	pointById: ReadonlyMap<string, LayoutVec2>,
): readonly [LayoutVec2, LayoutVec2] | undefined {
	if (legs.length !== 2) return undefined;
	const [a, b] = legs as readonly [CompiledJunctionLeg, CompiledJunctionLeg];
	const [ax, az] = a.tangentOut;
	const [bx, bz] = b.tangentOut;
	if (ax * bx + az * bz >= 0 || isTangentContinuation(a, b)) return undefined;
	const endpointAnchor = (leg: CompiledJunctionLeg): LayoutVec2 | undefined => {
		const wall = wallById.get(leg.wallId);
		if (!wall) return undefined;
		if (wall.centerline.kind === 'line') {
			return pointById.get(leg.end === 'start' ? wall.endJunctionId : wall.startJunctionId);
		}
		return leg.end === 'start'
			? wall.centerline.spans[0]?.handleOut
			: wall.centerline.spans.at(-1)?.handleIn;
	};
	const anchorA = endpointAnchor(a);
	const anchorB = endpointAnchor(b);
	return anchorA && anchorB ? [anchorA, anchorB] : undefined;
}

/** One compiled Junction leg: outward frame + endpoint solid/Opening facts. */
export function junctionLeg(wall: CompiledPhysicalWall, end: 'start' | 'end'): CompiledJunctionLeg {
	const first = wall.samples[0]!;
	const last = wall.samples.at(-1)!;
	const sign = end === 'start' ? 1 : -1;
	const tangent = end === 'start' ? first.tangent : last.tangent;
	const normal = end === 'start' ? first.normal : last.normal;
	const tangentOut: LayoutVec2 = [sign * tangent[0], sign * tangent[1]];
	const normalOut: LayoutVec2 = [sign * normal[0], sign * normal[1]];
	const atDistance = end === 'start' ? 0 : (last.distance ?? 0);
	const length = last.distance ?? 0;
	const endpointOpen =
		end === 'start'
			? wall.openings.some((opening) => opening.offset <= JUNCTION_BAND_EPSILON)
			: wall.openings.some(
					(opening) => opening.offset + opening.width >= length - JUNCTION_BAND_EPSILON,
				);
	return {
		wallId: wall.wallId,
		end,
		tangentOut,
		normalOut,
		outwardAngle: Math.atan2(tangentOut[1], tangentOut[0]),
		thickness: wall.thickness,
		halfThickness: wall.thickness / 2,
		bottomY: 0,
		topY: wall.height,
		role: wall.role,
		endpointOpen,
		endpointSolidBands: endpointSolidBands(wall.sections, atDistance, wall.height),
	};
}

/** Wall id → its resolved Junction joins (at most one per end). */
export function junctionJoinsByWall(
	junctions: readonly CompiledJunction[],
): Map<string, CompiledLegJoin[]> {
	const map = new Map<string, CompiledLegJoin[]>();
	for (const junction of junctions) {
		for (const join of junction.resolution.joins) {
			const list = map.get(join.wallId);
			if (list) list.push(join);
			else map.set(join.wallId, [join]);
		}
	}
	return map;
}

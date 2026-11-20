/**
 * The three reference geometries inspection samples a Finish on.
 *
 * Recipe 1 (frozen): all dimensions are metres, the sample is centred at the
 * origin with +Y up. The plane is 1×1 in XY facing +Z; the sphere has radius 0.5
 * with 48×32 segments; the block is a unit cube with 0.08 m corner radius and a
 * 24×24 grid on each face. UV0 spans one tile on the plane and block; the sphere
 * uses longitude/latitude with π by π/2 metre reference spans. Only UV0 is
 * advertised.
 *
 * The geometry is sent through the same `TargetFacts` contract as a product draw,
 * so an inspection and the product can never disagree about which chart a Finish
 * samples.
 */
import { BoxGeometry, BufferGeometry, PlaneGeometry, SphereGeometry, Vector3 } from 'three';
import type { TargetFacts } from '@portfolio/project-model/materials';

export const INSPECTION_GEOMETRY_VERSION = 1 as const;
export type InspectionGeometryKind = 'sphere' | 'plane' | 'block';

export type InspectionGeometryFacts = {
	readonly version: typeof INSPECTION_GEOMETRY_VERSION;
	readonly kind: InspectionGeometryKind;
	readonly uvMeters: readonly [number, number];
	readonly uvSets: readonly [0];
	readonly surfaceMeters: readonly [number, number];
};

const BLOCK_HALF = 0.5;
const BLOCK_INNER = 0.42;
const BLOCK_RADIUS = 0.08;
const BLOCK_GRID = 24;

/** The rounded unit block: clamp to the inner cube, then push out to the radius. */
function roundedBlockGeometry(): BufferGeometry {
	const geometry = new BoxGeometry(1, 1, 1, BLOCK_GRID, BLOCK_GRID, BLOCK_GRID);
	const position = geometry.getAttribute('position');
	const normal = geometry.getAttribute('normal');
	const point = new Vector3();
	const inner = new Vector3();
	const displacement = new Vector3();
	for (let index = 0; index < position.count; index += 1) {
		point.set(position.getX(index), position.getY(index), position.getZ(index));
		inner.set(
			Math.max(-BLOCK_INNER, Math.min(BLOCK_INNER, point.x)),
			Math.max(-BLOCK_INNER, Math.min(BLOCK_INNER, point.y)),
			Math.max(-BLOCK_INNER, Math.min(BLOCK_INNER, point.z))
		);
		displacement.copy(point).sub(inner).normalize();
		// The corner/edge direction is the rounded surface's normal. A face-centre
		// point's displacement is exactly the face normal.
		normal.setXYZ(index, displacement.x, displacement.y, displacement.z);
		point.copy(inner).addScaledVector(displacement, BLOCK_RADIUS);
		position.setXYZ(index, point.x, point.y, point.z);
	}
	position.needsUpdate = true;
	normal.needsUpdate = true;
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();
	return geometry;
}

/**
 * Build one reference geometry and the facts A binds against.
 *
 * The returned buffer is caller-owned; a consumer that caches it must dispose it
 * with its generation.
 */
/** The facts without allocating a buffer; the geometry and facts cannot drift. */
export function inspectionGeometryFacts(kind: InspectionGeometryKind): InspectionGeometryFacts {
	switch (kind) {
		case 'plane':
			return {
				version: INSPECTION_GEOMETRY_VERSION,
				kind,
				uvMeters: [1, 1],
				uvSets: [0],
				surfaceMeters: [1, 1]
			};
		case 'sphere':
			return {
				version: INSPECTION_GEOMETRY_VERSION,
				kind,
				// Longitude × latitude reference spans (equator and meridian).
				uvMeters: [Math.PI, Math.PI / 2],
				uvSets: [0],
				surfaceMeters: [Math.PI, Math.PI / 2]
			};
		case 'block':
			return {
				version: INSPECTION_GEOMETRY_VERSION,
				kind,
				uvMeters: [1, 1],
				uvSets: [0],
				surfaceMeters: [1, 1]
			};
	}
}

export function createInspectionGeometry(kind: InspectionGeometryKind): {
	readonly geometry: BufferGeometry;
	readonly facts: InspectionGeometryFacts;
} {
	switch (kind) {
		case 'plane':
			// PlaneGeometry's default chart is already 0..1 in XY facing +Z.
			return { geometry: new PlaneGeometry(1, 1, 1, 1), facts: inspectionGeometryFacts(kind) };
		case 'sphere':
			return { geometry: new SphereGeometry(0.5, 48, 32), facts: inspectionGeometryFacts(kind) };
		case 'block':
			return { geometry: roundedBlockGeometry(), facts: inspectionGeometryFacts(kind) };
	}
}

/** The target facts a Finish binding sees for one reference geometry. */
export function inspectionTargetFacts(
	kind: InspectionGeometryKind,
	subject = `inspection:${kind}`,
	revision = `inspection-${INSPECTION_GEOMETRY_VERSION}-${kind}`
): TargetFacts {
	const facts = inspectionGeometryFacts(kind);
	return {
		subject,
		geometryRevision: revision,
		metricBasis: {
			uvMeters: [facts.uvMeters[0], facts.uvMeters[1]],
			surfaceMeters: [facts.surfaceMeters[0], facts.surfaceMeters[1]]
		},
		draws: [{ drawKey: 'reference', uvSets: [0], normalFrameSets: [0] }]
	};
}

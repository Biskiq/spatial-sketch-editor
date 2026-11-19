/**
 * Layout-local surface references and their one resolver.
 *
 * A reference names an **authored identity plus a face**, never a compiled
 * record: `{ regionId, surface }` or `{ roomId, surface }`. That is why a
 * region reference survives move, rotate, footprint, elevation, thickness and
 * every fit, and why deleting the region leaves the reference unresolved rather
 * than silently resolving to whatever now occupies the same place.
 *
 * The resolver is the only place a reference becomes geometry. It states the
 * face polygons, world elevation and outward normal from the canonical compiled
 * output, so a consumer above `layout-core` (finishes, support evidence,
 * presentation) never re-derives a surface from a mesh or a Room shape.
 *
 * An open-to-sky Space has no lid. Its `floor` still resolves; its `lid`
 * refuses. A Space's generated planes are zero-thickness, so a `floor`/`lid`
 * face is one polygon, while a region's `edge` is the whole perimeter and keeps
 * no per-edge identity of its own.
 */
import type { LayoutRegionSurfaceRef } from './layout-wall-first-types';
import type { CompiledLayoutGeometry, CompiledRegion, CompiledRoom } from './layout-geometry-types';
import type { LayoutVec2 } from './layout-coordinates';
import type { Vec3 } from './types';

export type LayoutSpaceSurfaceRef = {
	roomId: string;
	surface: 'floor' | 'lid';
};

export type LayoutSurfaceRef = LayoutRegionSurfaceRef | LayoutSpaceSurfaceRef;

/** One resolved face; `edge` yields one face per perimeter side. */
export type LayoutSurfaceFace = {
	readonly surface: LayoutRegionSurfaceRef['surface'] | LayoutSpaceSurfaceRef['surface'];
	/** World-space closed polygon, copied from compiled output. */
	readonly polygon: readonly Vec3[];
	/** Outward normal of the face. `top`/`floor` point up; `underside`/`lid` down. */
	readonly normal: Vec3;
};

export type LayoutSurfaceResolution =
	| {
			readonly kind: 'resolved';
			readonly reference: LayoutSurfaceRef;
			readonly subject:
				| { readonly kind: 'region'; readonly id: string }
				| { readonly kind: 'room'; readonly id: string };
			readonly faces: readonly LayoutSurfaceFace[];
			/** World Y of a horizontal face; `null` for the whole-perimeter edge. */
			readonly elevation: number | null;
	  }
	| {
			readonly kind: 'unresolved';
			readonly reference: LayoutSurfaceRef;
			readonly code: 'missing-region' | 'missing-space' | 'open-to-sky' | 'missing-face' | 'degenerate';
			readonly message: string;
	  };

/** Resolve one Layout surface reference against one compiled Layout. */
export function resolveLayoutSurfaceReference(
	compiled: CompiledLayoutGeometry,
	reference: LayoutSurfaceRef
): LayoutSurfaceResolution {
	return 'regionId' in reference
		? resolveRegionSurface(compiled, reference)
		: resolveSpaceSurface(compiled, reference);
}

function resolveRegionSurface(
	compiled: CompiledLayoutGeometry,
	reference: LayoutRegionSurfaceRef
): LayoutSurfaceResolution {
	const region = compiled.regions.find((candidate) => candidate.regionId === reference.regionId);
	if (region === undefined) {
		return {
			kind: 'unresolved',
			reference,
			code: 'missing-region',
			message: `Region "${reference.regionId}" is not part of this compiled Layout.`
		};
	}
	const faces = region.faces
		.filter((face) => face.surface === reference.surface)
		.map((face): LayoutSurfaceFace => ({
			surface: face.surface,
			polygon: face.polygon.map((point): Vec3 => [point[0], point[1], point[2]]),
			normal: [face.normal[0], face.normal[1], face.normal[2]]
		}));
	if (faces.length === 0) {
		return {
			kind: 'unresolved',
			reference,
			code: 'missing-face',
			message: `Region "${reference.regionId}" has no compiled ${reference.surface} face.`
		};
	}
	return {
		kind: 'resolved',
		reference,
		subject: { kind: 'region', id: region.regionId },
		faces,
		elevation: regionSurfaceElevation(region, reference.surface)
	};
}

function resolveSpaceSurface(
	compiled: CompiledLayoutGeometry,
	reference: LayoutSpaceSurfaceRef
): LayoutSurfaceResolution {
	const room = compiled.rooms.find((candidate) => candidate.roomId === reference.roomId);
	if (room === undefined) {
		return {
			kind: 'unresolved',
			reference,
			code: 'missing-space',
			message: `Space "${reference.roomId}" is not part of this compiled Layout.`
		};
	}
	if (reference.surface === 'lid') {
		// Intent removes the generated lid and nothing else; an authored region
		// never substitutes for it.
		if (room.overhead === 'open-to-sky') {
			return {
				kind: 'unresolved',
				reference,
				code: 'open-to-sky',
				message: `Space "${reference.roomId}" is open to the sky, so it has no lid.`
			};
		}
		return horizontalSpaceFace(room, reference, 'lid', room.ceilingPolygon, room.ceilingElevation, [0, -1, 0]);
	}
	return horizontalSpaceFace(room, reference, 'floor', room.floorPolygon, room.floorElevation, [0, 1, 0]);
}

function horizontalSpaceFace(
	room: CompiledRoom,
	reference: LayoutSpaceSurfaceRef,
	surface: 'floor' | 'lid',
	polygon: readonly LayoutVec2[],
	elevation: number,
	normal: Vec3
): LayoutSurfaceResolution {
	if (
		polygon.length < 3 ||
		!Number.isFinite(elevation) ||
		polygon.some((point) => !Number.isFinite(point[0]) || !Number.isFinite(point[1]))
	) {
		return {
			kind: 'unresolved',
			reference,
			code: 'degenerate',
			message: `Space "${room.roomId}" has no usable compiled ${surface} polygon.`
		};
	}
	return {
		kind: 'resolved',
		reference,
		subject: { kind: 'room', id: room.roomId },
		faces: [
			{
				surface,
				polygon: polygon.map((point): Vec3 => [point[0], elevation, point[1]]),
				normal: [normal[0], normal[1], normal[2]]
			}
		],
		elevation
	};
}

function regionSurfaceElevation(
	region: CompiledRegion,
	surface: LayoutRegionSurfaceRef['surface']
): number | null {
	if (surface === 'top') return region.topY;
	if (surface === 'underside') return region.bottomY;
	return null;
}

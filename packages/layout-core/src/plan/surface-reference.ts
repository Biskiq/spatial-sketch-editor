/**
 * Canonical Layout surface identities and their resolvers.
 *
 * References name authored identities plus fixed faces. They never contain
 * compiled record ids, face indices, mesh groups, normals or session state.
 * This is the one vocabulary shared by Wall sides, Space planes and region
 * faces. The geometry resolver retains V1d's compiled region/Space behavior;
 * lifecycle and membership queries read the authored Layout document.
 */
import type { LayoutDocumentWallFirst } from '../wall/types';
import type { CompiledLayoutGeometry, CompiledRegion, CompiledRoom } from '../geometry/types';
import type { LayoutVec2 } from '../geometry/coordinates';
import { pointStrictlyInsidePolygon, polygonIntersectionArea } from '../geometry/face-extraction';
import { polygonContainsPolygon } from '../room/space-outline';
import { compileWallFirstLayoutGeometry } from '../geometry/compiler';
import type { Vec3 } from '../kernel/types';

export type LayoutWallSide = 'left' | 'right';
export type LayoutWallSideSurfaceRef = {
	readonly kind: 'wall-side';
	readonly wallId: string;
	readonly side: LayoutWallSide;
};
export type LayoutRoomFloorSurfaceRef = { readonly kind: 'room-floor'; readonly roomId: string };
export type LayoutRoomLidSurfaceRef = { readonly kind: 'room-lid'; readonly roomId: string };
export type LayoutSpaceSurfaceRef = LayoutRoomFloorSurfaceRef | LayoutRoomLidSurfaceRef;
export type LayoutRegionSurfaceRef = {
	readonly kind: 'region-face';
	readonly regionId: string;
	readonly face: 'top' | 'underside' | 'edge';
};

/** One authored identity vocabulary for every Layout surface consumer. */
export type LayoutSurfaceRef =
	| LayoutWallSideSurfaceRef
	| LayoutRoomFloorSurfaceRef
	| LayoutRoomLidSurfaceRef
	| LayoutRegionSurfaceRef;

/** V1d's compiled geometry resolver covers the original Space and region faces. */
export type LayoutGeometrySurfaceRef = Exclude<LayoutSurfaceRef, LayoutWallSideSurfaceRef>;
export type LayoutSurfaceLifecycle = 'present' | 'dormant' | 'retired';

export type LayoutSurfaceLineageEntry = {
	readonly to: LayoutSurfaceRef;
	readonly from: readonly LayoutSurfaceRef[];
};
export type LayoutSurfaceLineage = readonly LayoutSurfaceLineageEntry[];
export type LayoutSurfaceLineageNormalization =
	| { readonly kind: 'ready'; readonly lineage: LayoutSurfaceLineage }
	| { readonly kind: 'rejected'; readonly message: string };

export function wallSideSurfaceRef(wallId: string, side: LayoutWallSide): LayoutWallSideSurfaceRef {
	return { kind: 'wall-side', wallId, side };
}

function oppositeWallSide(side: LayoutWallSide): LayoutWallSide {
	return side === 'left' ? 'right' : 'left';
}

/** Split copies each authored side identity to the new fragment. */
export function splitWallSurfaceLineage(
	wallId: string,
	createdWallId: string,
): LayoutSurfaceLineage {
	return (['left', 'right'] as const).map((side) => ({
		to: wallSideSurfaceRef(createdWallId, side),
		from: [wallSideSurfaceRef(wallId, side)],
	}));
}

/**
 * Join lineage applies each source Wall's orientation mapping before ordering
 * the survivor's Finish ahead of the absorbed Wall's Finish.
 */
export function joinWallSurfaceLineage(input: {
	readonly survivorWallId: string;
	readonly absorbedWallId: string;
	readonly survivorForward: boolean;
	readonly absorbedForward: boolean;
}): LayoutSurfaceLineage {
	return (['left', 'right'] as const).map((side) => ({
		to: wallSideSurfaceRef(input.survivorWallId, side),
		from: [
			wallSideSurfaceRef(
				input.survivorWallId,
				input.survivorForward ? side : oppositeWallSide(side),
			),
			wallSideSurfaceRef(
				input.absorbedWallId,
				input.absorbedForward ? side : oppositeWallSide(side),
			),
		],
	}));
}

/**
 * Repack lineage maps every oriented arc of a Round ring onto the canonical
 * CCW closed Wall, keeping the seam-side survivor first (Q17) and flipping
 * `left`/`right` on any member traversed in `reverse`.
 */
export function repackWallSurfaceLineage(input: {
	readonly survivorWallId: string;
	readonly members: readonly {
		readonly wallId: string;
		readonly direction: 'forward' | 'reverse';
	}[];
}): LayoutSurfaceLineage {
	const ordered = [
		...input.members.filter((member) => member.wallId === input.survivorWallId),
		...input.members.filter((member) => member.wallId !== input.survivorWallId),
	];
	return (['left', 'right'] as const).map((side) => ({
		to: wallSideSurfaceRef(input.survivorWallId, side),
		from: ordered.map((member) =>
			wallSideSurfaceRef(
				member.wallId,
				member.direction === 'forward' ? side : oppositeWallSide(side),
			),
		),
	}));
}

/** Convert Room reconciliation correspondence into deterministic plane lineage. */
export function roomSurfaceLineage(
	records: readonly {
		readonly roomId: string;
		readonly predecessorRoomIds: readonly string[];
		readonly kind: 'preserved' | 'split-survivor' | 'merge-survivor' | 'created';
	}[],
): LayoutSurfaceLineage {
	const result: LayoutSurfaceLineageEntry[] = [];
	for (const record of records) {
		const sources =
			record.kind === 'merge-survivor'
				? [record.roomId, ...record.predecessorRoomIds.filter((id) => id !== record.roomId)]
				: (record.kind === 'created' || record.kind === 'split-survivor') &&
						record.predecessorRoomIds.length === 1
					? [...record.predecessorRoomIds]
					: [];
		if (sources.length === 0) continue;
		for (const makeRef of [
			(roomId: string): LayoutSurfaceRef => ({ kind: 'room-floor', roomId }),
			(roomId: string): LayoutSurfaceRef => ({ kind: 'room-lid', roomId }),
		]) {
			result.push({ to: makeRef(record.roomId), from: sources.map(makeRef) });
		}
	}
	return result;
}

/**
 * Duplicate a Region slab while preserving shared Finish identity. Only the
 * two paintable faces inherit; `edge` is a perimeter strip with no Finish.
 */
export function duplicateRegionSurfaceLineage(
	sourceRegionId: string,
	createdRegionId: string,
): LayoutSurfaceLineage {
	return (['top', 'underside'] as const).map((face) => ({
		to: { kind: 'region-face', regionId: createdRegionId, face },
		from: [{ kind: 'region-face', regionId: sourceRegionId, face }],
	}));
}

/** Duplicate a Room island while preserving shared Finish identity. */
export function duplicateRoomSurfaceLineage(
	wallIdMap: ReadonlyMap<string, string>,
	sourceRoomId: string,
	createdRoomId: string,
): LayoutSurfaceLineage {
	const result: LayoutSurfaceLineageEntry[] = [];
	for (const [sourceWallId, createdWallId] of wallIdMap) {
		result.push(...splitWallSurfaceLineage(sourceWallId, createdWallId));
	}
	result.push(
		{
			to: { kind: 'room-floor', roomId: createdRoomId },
			from: [{ kind: 'room-floor', roomId: sourceRoomId }],
		},
		{
			to: { kind: 'room-lid', roomId: createdRoomId },
			from: [{ kind: 'room-lid', roomId: sourceRoomId }],
		},
	);
	return result;
}

/** One resolved face; `edge` yields one face per perimeter side. */
export type LayoutSurfaceFace = {
	readonly surface: LayoutRegionSurfaceRef['face'] | 'floor' | 'lid';
	/** World-space closed polygon, copied from compiled output. */
	readonly polygon: readonly Vec3[];
	/** Outward normal of the face. `top`/`floor` point up; `underside`/`lid` down. */
	readonly normal: Vec3;
};

export type LayoutSurfaceResolution =
	| {
			readonly kind: 'resolved';
			readonly reference: LayoutGeometrySurfaceRef;
			readonly subject:
				| { readonly kind: 'region'; readonly id: string }
				| { readonly kind: 'room'; readonly id: string };
			readonly faces: readonly LayoutSurfaceFace[];
			/** World Y of a horizontal face; `null` for the whole-perimeter edge. */
			readonly elevation: number | null;
	  }
	| {
			readonly kind: 'unresolved';
			readonly reference: LayoutGeometrySurfaceRef;
			readonly code:
				| 'missing-region'
				| 'missing-space'
				| 'open-to-sky'
				| 'missing-face'
				| 'degenerate';
			readonly message: string;
	  };

/** Resolve V1d Space and region face identities against canonical compiled output. */
export function resolveLayoutSurfaceReference(
	compiled: CompiledLayoutGeometry,
	reference: LayoutGeometrySurfaceRef,
): LayoutSurfaceResolution {
	return reference.kind === 'region-face'
		? resolveRegionSurface(compiled, reference)
		: resolveSpaceSurface(compiled, reference);
}

function resolveRegionSurface(
	compiled: CompiledLayoutGeometry,
	reference: LayoutRegionSurfaceRef,
): LayoutSurfaceResolution {
	const region = compiled.regions.find((candidate) => candidate.regionId === reference.regionId);
	if (!region) {
		return {
			kind: 'unresolved',
			reference,
			code: 'missing-region',
			message: `Region "${reference.regionId}" is not part of this compiled Layout.`,
		};
	}
	const faces = region.faces
		.filter((face) => face.surface === reference.face)
		.map(
			(face): LayoutSurfaceFace => ({
				surface: face.surface,
				polygon: face.polygon.map((point): Vec3 => [point[0], point[1], point[2]]),
				normal: [face.normal[0], face.normal[1], face.normal[2]],
			}),
		);
	if (faces.length === 0) {
		return {
			kind: 'unresolved',
			reference,
			code: 'missing-face',
			message: `Region "${reference.regionId}" has no compiled ${reference.face} face.`,
		};
	}
	return {
		kind: 'resolved',
		reference,
		subject: { kind: 'region', id: region.regionId },
		faces,
		elevation: regionSurfaceElevation(region, reference.face),
	};
}

function resolveSpaceSurface(
	compiled: CompiledLayoutGeometry,
	reference: LayoutSpaceSurfaceRef,
): LayoutSurfaceResolution {
	const room = compiled.rooms.find((candidate) => candidate.roomId === reference.roomId);
	if (!room) {
		return {
			kind: 'unresolved',
			reference,
			code: 'missing-space',
			message: `Space "${reference.roomId}" is not part of this compiled Layout.`,
		};
	}
	if (reference.kind === 'room-lid') {
		if (room.overhead === 'open-to-sky') {
			return {
				kind: 'unresolved',
				reference,
				code: 'open-to-sky',
				message: `Space "${reference.roomId}" is open to the sky, so it has no lid.`,
			};
		}
		return horizontalSpaceFace(
			room,
			reference,
			'lid',
			room.ceilingPolygon,
			room.ceilingElevation,
			[0, -1, 0],
		);
	}
	return horizontalSpaceFace(
		room,
		reference,
		'floor',
		room.floorPolygon,
		room.floorElevation,
		[0, 1, 0],
	);
}

function horizontalSpaceFace(
	room: CompiledRoom,
	reference: LayoutSpaceSurfaceRef,
	surface: 'floor' | 'lid',
	polygon: readonly LayoutVec2[],
	elevation: number,
	normal: Vec3,
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
			message: `Space "${room.roomId}" has no usable compiled ${surface} polygon.`,
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
				normal: [normal[0], normal[1], normal[2]],
			},
		],
		elevation,
	};
}

function regionSurfaceElevation(
	region: CompiledRegion,
	surface: LayoutRegionSurfaceRef['face'],
): number | null {
	if (surface === 'top') return region.topY;
	if (surface === 'underside') return region.bottomY;
	return null;
}

/** Read the identity lifecycle from authored Layout data only. */
export function resolveLayoutSurface(
	document: LayoutDocumentWallFirst,
	reference: LayoutSurfaceRef,
): LayoutSurfaceLifecycle {
	switch (reference.kind) {
		case 'wall-side':
			return document.walls.some((wall) => wall.id === reference.wallId) ? 'present' : 'retired';
		case 'room-floor':
			return document.rooms.some((room) => room.id === reference.roomId) ? 'present' : 'retired';
		case 'room-lid': {
			const room = document.rooms.find((candidate) => candidate.id === reference.roomId);
			return room === undefined
				? 'retired'
				: room.overhead === 'open-to-sky'
					? 'dormant'
					: 'present';
		}
		case 'region-face':
			return document.regions.some((region) => region.id === reference.regionId)
				? 'present'
				: 'retired';
	}
}

/** Stable structural identity string, used only for equality and sorting. */
export function surfaceKey(reference: LayoutSurfaceRef): string {
	switch (reference.kind) {
		case 'wall-side':
			return JSON.stringify(['wall-side', reference.wallId, reference.side]);
		case 'room-floor':
			return JSON.stringify(['room-floor', reference.roomId]);
		case 'room-lid':
			return JSON.stringify(['room-lid', reference.roomId]);
		case 'region-face':
			return JSON.stringify(['region-face', reference.regionId, reference.face]);
	}
}

/**
 * Collapse surfaces born and retired inside one topology operation so every
 * final lineage source names an identity from the accepted Layout. Operation
 * intermediates with no predecessor are new, unpainted geometry and contribute
 * no persisted source. This keeps the Scene applicator independent of
 * operation-local ids while preserving ordered precedence across composed edits.
 */
export function normalizeLayoutSurfaceLineage(input: {
	readonly beforeLayout: LayoutDocumentWallFirst;
	readonly afterLayout: LayoutDocumentWallFirst;
	readonly lineage: LayoutSurfaceLineage;
}): LayoutSurfaceLineageNormalization {
	const byTarget = new Map<string, LayoutSurfaceLineageEntry>();
	const referencedTargets = new Set<string>();
	for (const entry of input.lineage) {
		const key = surfaceKey(entry.to);
		if (byTarget.has(key)) {
			return { kind: 'rejected', message: `Surface lineage has duplicate target "${key}".` };
		}
		byTarget.set(key, entry);
		for (const source of entry.from) referencedTargets.add(surfaceKey(source));
	}

	const finalLineage: LayoutSurfaceLineageEntry[] = [];
	for (const entry of input.lineage) {
		const targetKey = surfaceKey(entry.to);
		if (resolveLayoutSurface(input.afterLayout, entry.to) === 'retired') {
			if (referencedTargets.has(targetKey)) continue;
			return {
				kind: 'rejected',
				message: `Surface lineage target "${targetKey}" is retired in the candidate Layout.`,
			};
		}

		const sources: LayoutSurfaceRef[] = [];
		const seenSources = new Set<string>();
		const expand = (source: LayoutSurfaceRef, path: ReadonlySet<string>): string | null => {
			if (resolveLayoutSurface(input.beforeLayout, source) !== 'retired') {
				const key = surfaceKey(source);
				if (!seenSources.has(key)) {
					seenSources.add(key);
					sources.push(source);
				}
				return null;
			}
			const key = surfaceKey(source);
			const predecessor = byTarget.get(key);
			if (predecessor === undefined) return null;
			if (path.has(key)) return `Surface lineage has a cycle through "${key}".`;
			const nextPath = new Set(path);
			nextPath.add(key);
			for (const prior of predecessor.from) {
				const error = expand(prior, nextPath);
				if (error !== null) return error;
			}
			return null;
		};
		for (const source of entry.from) {
			const error = expand(source, new Set([targetKey]));
			if (error !== null) return { kind: 'rejected', message: error };
		}
		finalLineage.push({ to: entry.to, from: sources });
	}
	return { kind: 'ready', lineage: finalLineage };
}

/**
 * Map an X/Z point to the nearest physical side of a compiled Wall. Positive
 * signed offset is the canonical left side. Centerline points and ambiguous
 * nearest projections intentionally have no side answer.
 */
export function wallSideAt(
	compiled: CompiledLayoutGeometry,
	wallId: string,
	point: LayoutVec2,
): LayoutWallSide | null {
	const wall = compiled.walls.find((candidate) => candidate.wallId === wallId);
	if (!wall || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || wall.samples.length < 2)
		return null;
	let bestDistanceSq = Infinity;
	let bestOffset = 0;
	let ambiguous = false;
	for (let index = 1; index < wall.samples.length; index += 1) {
		const a = wall.samples[index - 1]!;
		const b = wall.samples[index]!;
		const dx = b.point[0] - a.point[0];
		const dz = b.point[1] - a.point[1];
		const lengthSq = dx * dx + dz * dz;
		if (!(lengthSq > 0) || !Number.isFinite(lengthSq)) continue;
		const t = Math.max(
			0,
			Math.min(1, ((point[0] - a.point[0]) * dx + (point[1] - a.point[1]) * dz) / lengthSq),
		);
		const nearestX = a.point[0] + dx * t;
		const nearestZ = a.point[1] + dz * t;
		const offset = (dx * (point[1] - nearestZ) - dz * (point[0] - nearestX)) / Math.sqrt(lengthSq);
		const distanceSq = (point[0] - nearestX) ** 2 + (point[1] - nearestZ) ** 2;
		if (distanceSq < bestDistanceSq - 1e-12) {
			bestDistanceSq = distanceSq;
			bestOffset = offset;
			ambiguous = false;
		} else if (
			Math.abs(distanceSq - bestDistanceSq) <= 1e-12 &&
			Math.sign(offset) !== Math.sign(bestOffset)
		) {
			ambiguous = true;
		}
	}
	if (!Number.isFinite(bestDistanceSq) || ambiguous || Math.abs(bestOffset) <= 1e-8) return null;
	return bestOffset > 0 ? 'left' : 'right';
}

export type SpaceSurfaceExclusion = {
	readonly ref: LayoutRegionSurfaceRef;
	readonly reason: 'spans-spaces';
};
export type SurfacesOfSpace = {
	readonly surfaces: readonly LayoutSurfaceRef[];
	readonly excluded: readonly SpaceSurfaceExclusion[];
};

/** The one containment rule shared by Region membership and Space scope. */
function regionFootprintWhollyInsideSpace(
	outline: readonly LayoutVec2[],
	footprint: readonly LayoutVec2[],
): boolean {
	return (
		footprint.length >= 3 &&
		outline.length >= 3 &&
		polygonContainsPolygon(outline, footprint) &&
		footprint.every((point) => pointStrictlyInsidePolygon(outline, point))
	);
}

/** The same expansion over one accepted compiled reading. */
function surfacesOfSpaceFrom(
	document: LayoutDocumentWallFirst,
	roomId: string,
	compiled: CompiledLayoutGeometry,
): SurfacesOfSpace {
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (!room) return { surfaces: [], excluded: [] };
	const outline =
		compiled.rooms.find((candidate) => candidate.roomId === roomId)?.floorPolygon ?? [];
	const surfaces: LayoutSurfaceRef[] = room.boundary.map((boundary) => ({
		kind: 'wall-side',
		wallId: boundary.wallId,
		side: boundary.direction === 'forward' ? 'left' : 'right',
	}));
	surfaces.push({ kind: 'room-floor', roomId });
	if (resolveLayoutSurface(document, { kind: 'room-lid', roomId }) === 'present') {
		surfaces.push({ kind: 'room-lid', roomId });
	}
	const excluded: SpaceSurfaceExclusion[] = [];
	for (const region of document.regions) {
		const reference: LayoutRegionSurfaceRef = {
			kind: 'region-face',
			regionId: region.id,
			face: region.role === 'floor' ? 'top' : 'underside',
		};
		const footprint = region.footprint.points;
		if (regionFootprintWhollyInsideSpace(outline, footprint)) surfaces.push(reference);
		else if (
			footprint.length >= 3 &&
			outline.length >= 3 &&
			polygonIntersectionArea(outline, footprint) > 1e-9
		) {
			excluded.push({ ref: reference, reason: 'spans-spaces' });
		}
	}
	return { surfaces, excluded };
}

/** Expand the Wall sides and face identities owned by one authored Space. */
export function surfacesOfSpace(
	document: LayoutDocumentWallFirst,
	roomId: string,
): SurfacesOfSpace {
	if (!document.rooms.some((candidate) => candidate.id === roomId))
		return { surfaces: [], excluded: [] };
	return surfacesOfSpaceFrom(document, roomId, compileWallFirstLayoutGeometry(document).geometry);
}

export type SpaceOfSurface =
	| { readonly kind: 'none' }
	| { readonly kind: 'unique'; readonly roomId: string }
	| { readonly kind: 'ambiguous'; readonly roomIds: readonly string[] };

/**
 * Find the one Space whose scope owns this surface: a Wall side by the oriented
 * boundary, a Space plane by its own Space, and a Region face by the same
 * whole-footprint containment rule Space scope uses. Two containing Spaces are
 * reported ambiguous rather than guessed.
 *
 * The compiled reading is supplied by the caller so membership and scope can
 * share it; only a Region face ever asks for it.
 */
function membershipOf(
	document: LayoutDocumentWallFirst,
	reference: LayoutSurfaceRef,
	compiled: () => CompiledLayoutGeometry,
): SpaceOfSurface {
	if (reference.kind === 'room-floor' || reference.kind === 'room-lid') {
		return document.rooms.some((room) => room.id === reference.roomId)
			? { kind: 'unique', roomId: reference.roomId }
			: { kind: 'none' };
	}
	if (reference.kind === 'region-face') {
		const region = document.regions.find((candidate) => candidate.id === reference.regionId);
		if (region === undefined) return { kind: 'none' };
		const roomIds = compiled()
			.rooms.filter((room) =>
				regionFootprintWhollyInsideSpace(room.floorPolygon, region.footprint.points),
			)
			.map((room) => room.roomId);
		if (roomIds.length === 0) return { kind: 'none' };
		if (roomIds.length > 1) return { kind: 'ambiguous', roomIds };
		return { kind: 'unique', roomId: roomIds[0]! };
	}
	const roomIds = document.rooms
		.filter((room) =>
			room.boundary.some(
				(boundary) =>
					boundary.wallId === reference.wallId &&
					reference.side === (boundary.direction === 'forward' ? 'left' : 'right'),
			),
		)
		.map((room) => room.id);
	if (roomIds.length === 0) return { kind: 'none' };
	if (roomIds.length > 1) return { kind: 'ambiguous', roomIds };
	return { kind: 'unique', roomId: roomIds[0]! };
}

/** One pick from one authored surface; compiles only when a Region face asks. */
export function spaceOfSurface(
	document: LayoutDocumentWallFirst,
	reference: LayoutSurfaceRef,
): SpaceOfSurface {
	let reading: CompiledLayoutGeometry | null = null;
	return membershipOf(document, reference, () => {
		if (reading !== null) return reading;
		const next = compileWallFirstLayoutGeometry(document).geometry;
		reading = next;
		return next;
	});
}

/**
 * Paint's one Space reading: the picked surface's membership and, when exactly
 * one Space owns it, that Space's whole scope. Membership and scope expansion
 * both need the compiled outlines, so this holds one reading for both — one
 * compile per hover, not one per query.
 */
export function spacePaintReading(
	document: LayoutDocumentWallFirst,
	reference: LayoutSurfaceRef,
): { readonly membership: SpaceOfSurface; readonly scope: SurfacesOfSpace } {
	let reading: CompiledLayoutGeometry | null = null;
	const compiled = (): CompiledLayoutGeometry => {
		if (reading !== null) return reading;
		const next = compileWallFirstLayoutGeometry(document).geometry;
		reading = next;
		return next;
	};
	const membership = membershipOf(document, reference, compiled);
	return {
		membership,
		scope:
			membership.kind === 'unique'
				? surfacesOfSpaceFrom(document, membership.roomId, compiled())
				: { surfaces: [], excluded: [] },
	};
}

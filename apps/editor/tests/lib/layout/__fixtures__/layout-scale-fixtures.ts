/**
 * Deterministic generated layout fixtures for the G3 performance harness.
 *
 * T1.P02.S05 converted these to canonical format-6 wall-first documents: a fixed
 * seed plus a deterministic PRNG produces a byte-identical layout across runs,
 * now authored as Junctions, Walls, persistent Rooms and Wall-hosted Openings.
 * The random draw order is unchanged, and the pinned mix (curved fraction,
 * opening density and profile distribution, object density and kind
 * distribution) stays comparable per scale.
 *
 * Rooms sit in a grid of isolated cells so boundaries never self-intersect or
 * overlap; openings go on straight Walls only and never collide. Each Room's
 * ceiling is derived by the compiler from its boundary Wall heights, so the
 * generated documents carry no storey height at all.
 *
 * Pre-conversion compiled observations (room/object/opening counts, total
 * samples, bounds) are committed under the T1.P02.S05 slice's `observations/`
 * directory at the trusted base so the re-fixturing is reviewable.
 */
import {
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	wallCubicChain,
	type DraftPath,
	type LayoutDocumentWallFirst,
	type LayoutObject,
	type LayoutVec2,
	type LayoutWallOpening
} from '@portfolio/layout-core';

export type ScaleFixtureTier = 'small' | 'medium' | 'large';

export type ScaleFixtureSpec = {
	seed: number;
	roomCount: number;
	/** Fraction of rooms whose top edge is a curved Wall. */
	bezierFraction: number;
	/** Target openings per room (capped at the number of straight walls). */
	openingsPerRoom: number;
	/** Opening profile distribution; weights need not sum to 1. */
	profileMix: { rectangular: number; rounded: number; pointed: number };
	/** Target layout objects per room. */
	objectsPerRoom: number;
	/** Object kind distribution; weights need not sum to 1. */
	objectKindMix: { box: number; plane: number; cylinder: number; sphere: number; profile: number };
};

export const SCALE_FIXTURE_SEEDS: Record<ScaleFixtureTier, ScaleFixtureSpec> = {
	small: {
		seed: 101,
		roomCount: 10,
		bezierFraction: 0.3,
		openingsPerRoom: 2,
		profileMix: { rectangular: 0.6, rounded: 0.2, pointed: 0.2 },
		objectsPerRoom: 3,
		objectKindMix: { box: 0.3, plane: 0.1, cylinder: 0.2, sphere: 0.3, profile: 0.1 }
	},
	medium: {
		seed: 202,
		roomCount: 100,
		bezierFraction: 0.3,
		openingsPerRoom: 2,
		profileMix: { rectangular: 0.6, rounded: 0.2, pointed: 0.2 },
		objectsPerRoom: 3,
		objectKindMix: { box: 0.3, plane: 0.1, cylinder: 0.2, sphere: 0.3, profile: 0.1 }
	},
	large: {
		seed: 303,
		roomCount: 1000,
		bezierFraction: 0.3,
		openingsPerRoom: 2,
		profileMix: { rectangular: 0.6, rounded: 0.2, pointed: 0.2 },
		objectsPerRoom: 3,
		objectKindMix: { box: 0.3, plane: 0.1, cylinder: 0.2, sphere: 0.3, profile: 0.1 }
	}
};

const CELL_PITCH = 14; // cell center-to-center spacing; rooms are 6–11 m wide so ≥3 m gaps remain
const ROOM_MIN = 6; // minimum room width/depth in meters
const ROOM_SPREAD = 5; // width/depth = ROOM_MIN + random() * ROOM_SPREAD
const BEZIER_BULGE = 1; // outward bump of the curved top Wall, stays inside the inter-room gap
const WALL_THICKNESS = 0.16;
const WALL_HEIGHT = 3;
const FLOOR_THICKNESS = 0.1;
const CEILING_THICKNESS = 0.1;

const PROFILE_KINDS: LayoutWallOpening['profile'][] = ['rectangular', 'rounded', 'pointed'];
const OBJECT_KINDS: LayoutObject['kind'][] = ['box', 'plane', 'cylinder', 'sphere', 'profile'];

/** mulberry32 — small deterministic PRNG returning floats in [0, 1). */
function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function pickWeighted(random: () => number, weights: Record<string, number>, values: readonly string[]): string {
	const total = values.reduce((sum, value) => sum + weights[value]!, 0);
	let remaining = random() * total;
	for (const value of values) {
		remaining -= weights[value]!;
		if (remaining <= 0) return value;
	}
	return values.at(-1)!;
}

export function buildScaleFixture(spec: ScaleFixtureSpec): LayoutDocumentWallFirst {
	const random = mulberry32(spec.seed);
	const columns = Math.ceil(Math.sqrt(spec.roomCount));
	const document = createEmptyWallFirstLayoutDocument();
	document.floor.id = 'floor-ground';
	document.floor.name = 'Ground Floor';
	const objects: LayoutObject[] = [];

	for (let index = 0; index < spec.roomCount; index += 1) {
		const column = index % columns;
		const row = Math.floor(index / columns);
		const originX = column * CELL_PITCH;
		const originZ = row * CELL_PITCH;
		const width = ROOM_MIN + random() * ROOM_SPREAD;
		const depth = ROOM_MIN + random() * ROOM_SPREAD;
		const roomId = `room-${index}`;
		appendRoom(document, roomId, index, originX, originZ, width, depth, random, spec);
		for (let objectIndex = 0; objectIndex < spec.objectsPerRoom; objectIndex += 1) {
			objects.push(buildObject(roomId, objectIndex, originX, originZ, width, depth, random, spec));
		}
	}

	document.objects.push(...objects);
	return document;
}

function appendRoom(
	document: LayoutDocumentWallFirst,
	roomId: string,
	index: number,
	originX: number,
	originZ: number,
	width: number,
	depth: number,
	random: () => number,
	spec: ScaleFixtureSpec
): void {
	const x0 = originX;
	const z0 = originZ;
	const isBezier = random() < spec.bezierFraction;

	const corners: LayoutVec2[] = [
		[x0, z0],
		[x0 + width, z0],
		[x0 + width, z0 + depth],
		[x0, z0 + depth]
	];
	const junctionIds = corners.map((_, corner) => `${roomId}:j${corner}`);
	corners.forEach((point, corner) => {
		document.junctions.push({ id: junctionIds[corner]!, point: [point[0], point[1]] });
	});

	const wallIds = [0, 1, 2, 3].map((edge) => `${roomId}:wall:${edge}`);
	for (let edge = 0; edge < corners.length; edge += 1) {
		const start = corners[edge]!;
		const end = corners[(edge + 1) % corners.length]!;
		const wallId = wallIds[edge]!;
		// Top edge (index 2) is the only curved candidate; openings stay on the
		// three straight edges so their arc-length offsets stay trivial.
		if (edge === 2 && isBezier) {
			const knot: LayoutVec2 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2 + BEZIER_BULGE];
			document.walls.push({
				id: wallId,
				startJunctionId: junctionIds[edge]!,
				endJunctionId: junctionIds[(edge + 1) % corners.length]!,
				thickness: WALL_THICKNESS,
				height: WALL_HEIGHT,
				centerline: wallCubicChain(
					[{ id: `${wallId}:knot:0`, point: knot }],
					deriveChainSpans([start, knot, end])
				)
			});
			continue;
		}
		document.walls.push({
			id: wallId,
			startJunctionId: junctionIds[edge]!,
			endJunctionId: junctionIds[(edge + 1) % corners.length]!,
			thickness: WALL_THICKNESS,
			height: WALL_HEIGHT,
			centerline: { kind: 'line' }
		});
	}

	document.rooms.push({
		id: roomId,
		name: `Room ${index}`,
		boundary: wallIds.map((wallId) => ({ wallId, direction: 'forward' as const })),
		floorThickness: FLOOR_THICKNESS,
		ceilingThickness: CEILING_THICKNESS
	});

	appendOpenings(document, roomId, corners, wallIds, isBezier, random, spec);
}

/** Straight walls available for openings: every edge except a curved top edge. */
function appendOpenings(
	document: LayoutDocumentWallFirst,
	roomId: string,
	corners: readonly LayoutVec2[],
	wallIds: readonly string[],
	isBezier: boolean,
	random: () => number,
	spec: ScaleFixtureSpec
): void {
	const straightEdges = [0, 1, 2, 3].filter((edge) => !(edge === 2 && isBezier));
	const count = Math.min(spec.openingsPerRoom, straightEdges.length);

	for (let index = 0; index < count; index += 1) {
		const edge = straightEdges[index]!;
		const start = corners[edge]!;
		const end = corners[(edge + 1) % corners.length]!;
		const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
		const isDoor = index % 2 === 0;
		const width = isDoor ? 0.9 : 1.2;
		const height = isDoor ? 2.1 : 1.2;
		const sillHeight = isDoor ? 0 : 1;
		// A single opening per wall, placed away from both ends.
		const offset = 0.5 + random() * Math.max(0.1, length - width - 1);
		document.openings.push({
			id: `${roomId}:opening:${index}`,
			wallId: wallIds[edge]!,
			kind: isDoor ? 'door' : 'window',
			offset,
			width,
			height,
			sillHeight,
			profile: pickWeighted(random, spec.profileMix, PROFILE_KINDS) as LayoutWallOpening['profile']
		});
	}
}

function buildObject(
	roomId: string,
	index: number,
	originX: number,
	originZ: number,
	width: number,
	depth: number,
	random: () => number,
	spec: ScaleFixtureSpec
): LayoutObject {
	const kind = pickWeighted(random, spec.objectKindMix, OBJECT_KINDS) as LayoutObject['kind'];
	const fractionX = 0.2 + random() * 0.6;
	const fractionZ = 0.2 + random() * 0.6;
	const dimensions = objectDimensions(kind, random);
	const x = originX + width * fractionX;
	const z = originZ + depth * fractionZ;
	const y = kind === 'plane' ? 0 : dimensions[1] / 2;

	const object: LayoutObject = {
		id: `${roomId}:obj:${index}`,
		kind,
		position: [x, y, z],
		rotation: [0, 0, 0],
		dimensions,
		roomId
	};
	if (kind === 'profile') object.profile = profilePath(`${roomId}:obj:${index}:profile`);
	return object;
}

function objectDimensions(kind: LayoutObject['kind'], random: () => number): [number, number, number] {
	const size = () => 0.4 + random() * 1.1;
	switch (kind) {
		case 'plane':
			return [1 + random() * 2, 0.02, 1 + random() * 2];
		case 'cylinder':
			return [0.3 + random() * 0.6, 0.5 + random(), 0.3 + random() * 0.6];
		case 'sphere':
			return [0.3 + random() * 0.6, 0.3 + random() * 0.6, 0.3 + random() * 0.6];
		case 'profile':
			return [size(), size(), size()];
		case 'box':
		default:
			return [size(), size(), size()];
	}
}

function profilePath(id: string): DraftPath {
	const points: LayoutVec2[] = [
		[0, 0],
		[1, 0],
		[1, 0.5],
		[0, 0.5]
	];
	return {
		closed: true,
		segments: points.map((start, index) => ({
			id: `${id}:wall:${index}`,
			kind: 'line' as const,
			start: [...start] as LayoutVec2,
			end: [...points[(index + 1) % points.length]!] as LayoutVec2
		}))
	};
}

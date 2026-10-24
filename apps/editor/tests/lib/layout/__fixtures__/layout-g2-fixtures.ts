import type { NavigationGraph } from '$lib/content/scene';
import type { RuntimeConnection, NavigationNodeData, Vec3 } from '$lib/types/scene';
import type { LayoutVec2 } from '@portfolio/layout-core';
import {
	compileWallFirstLayoutGeometry,
	findPolygonContaining,
	geometryId,
	projectPointToSpans,
	type CompiledLayoutGeometry,
	type CompiledQuerySpan
} from '@portfolio/layout-core';
import {
	g1AutoBezierDocument,
	g1ElevatedFloorDocument,
	g1InvalidGeometryDocument,
	g1LineRectangleDocument,
	g1LShapedDocument,
	g1MultipleOpeningsDocument,
	g1ObjectMatrixDocument,
	g1ProfileMatrixDocument
} from './layout-g1-fixtures';

/**
 * Frozen G2 back-to-front render order. Committed geometry fills layers 1–5;
 * layer 6 is passive Scene context; layers 7–10 are camera/tour projections;
 * 11–13 are transient interaction overlays. The names and order are the
 * contract `buildPlanRenderModel()` must emit and the SVG adapter must honor.
 */
export const G2_LAYER_ORDER = [
	{ order: 1, name: 'fills' },
	{ order: 2, name: 'strokes' },
	{ order: 3, name: 'walls' },
	{ order: 4, name: 'openings' },
	{ order: 5, name: 'objects' },
	{ order: 6, name: 'scene-footprints' },
	{ order: 7, name: 'camera-paths' },
	{ order: 8, name: 'view-cones-look-targets' },
	{ order: 9, name: 'portal-crossings-collision-warnings' },
	{ order: 10, name: 'timing-labels' },
	{ order: 11, name: 'selection-overlays' },
	{ order: 12, name: 'interaction-handles' },
	{ order: 13, name: 'labels' }
] as const;

/** Layers derivable from `CompiledLayoutGeometry` alone (G2 step 1 freeze). */
export const G2_COMMITTED_LAYERS = [1, 2, 3, 4, 5] as const;

// --- Documents -------------------------------------------------------------

export function g2LineRectangleDocument() {
	return g1LineRectangleDocument();
}
export function g2LShapedDocument() {
	return g1LShapedDocument();
}
export function g2AutoBezierDocument() {
	return g1AutoBezierDocument();
}
export function g2MultipleOpeningsDocument() {
	return g1MultipleOpeningsDocument();
}
export function g2ProfileMatrixDocument() {
	return g1ProfileMatrixDocument();
}
export function g2ObjectMatrixDocument() {
	return g1ObjectMatrixDocument();
}
export function g2ElevatedFloorDocument() {
	return g1ElevatedFloorDocument();
}
export function g2InvalidGeometryDocument() {
	return g1InvalidGeometryDocument();
}

// --- Reference plan model --------------------------------------------------

/**
 * T1.P02.S05 — hit identities follow the canonical wall-first contract: a
 * committed Wall is addressed by its document-global `wallId` and an Opening by
 * `{ wallId, openingId }`. There is no Room context to carry, because a physical
 * Wall is compiled once and owns no Room.
 */
export type G2ReferenceHitIdentity =
	| { kind: 'room'; roomId: string }
	| { kind: 'wall'; wallId: string }
	| { kind: 'opening'; wallId: string; openingId: string }
	| { kind: 'object'; objectId: string };

export type G2ReferencePrimitive = {
	layer: (typeof G2_COMMITTED_LAYERS)[number];
	kind: 'polygon' | 'polyline';
	key: string;
	style: string;
	points: LayoutVec2[];
	hit: G2ReferenceHitIdentity;
};

function floorIdByRoomId(compiled: CompiledLayoutGeometry): Map<string, string> {
	const map = new Map<string, string>();
	for (const floor of compiled.floors) {
		for (const roomId of floor.roomIds) map.set(roomId, floor.floorId);
	}
	return map;
}

/**
 * Test-only reference for the committed render layers. This freezes the exact
 * primitive decomposition `buildPlanRenderModel()` must reproduce: layer order,
 * stable keys, style tokens, hit identities, and world-space points taken
 * verbatim from `CompiledLayoutGeometry`.
 */
export function buildG2ReferencePlanModel(compiled: CompiledLayoutGeometry): G2ReferencePrimitive[] {
	const floorByRoom = floorIdByRoomId(compiled);
	const primitives: G2ReferencePrimitive[] = [];

	// Layer 1 — fills, one polygon per room in document order.
	for (const room of compiled.rooms) {
		const floorId = floorByRoom.get(room.roomId) ?? 'unknown-floor';
		primitives.push({
			layer: 1,
			kind: 'polygon',
			key: geometryId(['plan', 'fill', floorId, room.roomId]),
			style: 'room-fill',
			points: room.floorPolygon.map(([x, z]) => [x, z] as LayoutVec2),
			hit: { kind: 'room', roomId: room.roomId }
		});
	}

	// Layer 2 — strokes, one closed outline per room in document order.
	for (const room of compiled.rooms) {
		const floorId = floorByRoom.get(room.roomId) ?? 'unknown-floor';
		primitives.push({
			layer: 2,
			kind: 'polygon',
			key: geometryId(['plan', 'stroke', floorId, room.roomId]),
			style: 'room-outline',
			points: room.floorPolygon.map(([x, z]) => [x, z] as LayoutVec2),
			hit: { kind: 'room', roomId: room.roomId }
		});
	}

	// Layer 3 — walls, one polyline per opening-free centerline span of each
	// canonical physical Wall (compiled order, never per incident Room).
	for (const wall of compiled.walls) {
		wall.solidCenterlinePolylines.forEach((polyline, index) => {
			primitives.push({
				layer: 3,
				kind: 'polyline',
				key: geometryId(['plan', 'wall', wall.floorId, wall.wallId, String(index)]),
				style: 'wall-line',
				points: polyline.map(([x, z]) => [x, z] as LayoutVec2),
				hit: { kind: 'wall', wallId: wall.wallId }
			});
		});
	}

	// Layer 4 — openings, one polyline per compiled opening centerline.
	for (const wall of compiled.walls) {
		for (const opening of wall.openings) {
			primitives.push({
				layer: 4,
				kind: 'polyline',
				key: geometryId(['plan', 'opening', wall.floorId, opening.openingId]),
				style: 'opening-line',
				points: opening.centerPolyline.map(([x, z]) => [x, z] as LayoutVec2),
				hit: { kind: 'opening', wallId: wall.wallId, openingId: opening.openingId }
			});
		}
	}

	// Layer 5 — objects, one footprint polygon per compiled object.
	for (const object of compiled.objects) {
		primitives.push({
			layer: 5,
			kind: 'polygon',
			key: geometryId(['plan', 'object', object.objectId]),
			style: object.readonly ? 'layout-object-readonly' : 'layout-object',
			points: object.planFootprint.map(([x, z]) => [x, z] as LayoutVec2),
			hit: { kind: 'object', objectId: object.objectId }
		});
	}

	return primitives;
}

// --- Reference hit resolution ---------------------------------------------

export type G2ReferenceHitResult =
	| { kind: 'vertex'; wallId: string; vertexIndex: number; point: LayoutVec2 }
	| { kind: 'opening'; wallId: string; openingId: string }
	| { kind: 'object'; objectId: string }
	| { kind: 'wall'; wallId: string }
	| { kind: 'room'; roomId: string }
	| null;

type PhysicalWallSpans = {
	wallSpans: CompiledQuerySpan[];
	openingSpans: CompiledQuerySpan[];
};

/** Canonical physical Wall spans grouped by `wallId`; room-derived records are skipped. */
function physicalSpansByWall(compiled: CompiledLayoutGeometry): Map<string, PhysicalWallSpans> {
	const byWall = new Map<string, PhysicalWallSpans>();
	for (const span of compiled.queries.spans) {
		if (span.roomId !== undefined) continue;
		if (span.kind !== 'wall' && span.kind !== 'opening') continue;
		const wallId = span.wallKey ?? span.segmentId;
		const group = byWall.get(wallId) ?? { wallSpans: [], openingSpans: [] };
		if (span.kind === 'wall') group.wallSpans.push(span);
		else group.openingSpans.push(span);
		byWall.set(wallId, group);
	}
	return byWall;
}

function nearestVertexHit(
	compiled: CompiledLayoutGeometry,
	point: LayoutVec2,
	tolerance: number
): G2ReferenceHitResult {
	let best: { wallId: string; vertexIndex: number; point: LayoutVec2; distance: number } | null = null;
	for (const record of compiled.queries.points) {
		if (record.kind !== 'vertex') continue;
		const distance = Math.hypot(record.point[0] - point[0], record.point[1] - point[1]);
		if (distance > tolerance) continue;
		if (best && distance >= best.distance) continue;
		best = { wallId: record.segmentId, vertexIndex: record.sourceIndex, point: record.point, distance };
	}
	return best ? { kind: 'vertex', wallId: best.wallId, vertexIndex: best.vertexIndex, point: best.point } : null;
}

function nearestOpeningHit(
	compiled: CompiledLayoutGeometry,
	point: LayoutVec2,
	tolerance: number
): G2ReferenceHitResult {
	for (const [wallId, group] of physicalSpansByWall(compiled)) {
		for (const span of group.openingSpans) {
			const projection = projectPointToSpans(point, [span]);
			if (!projection || projection.distance > tolerance) continue;
			return { kind: 'opening', wallId, openingId: span.openingId! };
		}
	}
	return null;
}

function nearestWallHit(
	compiled: CompiledLayoutGeometry,
	point: LayoutVec2,
	tolerance: number
): G2ReferenceHitResult {
	let best: { wallId: string; distance: number } | null = null;
	for (const [wallId, group] of physicalSpansByWall(compiled)) {
		const projection = projectPointToSpans(point, group.wallSpans);
		if (!projection || projection.distance > tolerance) continue;
		if (best && projection.distance >= best.distance) continue;
		best = { wallId, distance: projection.distance };
	}
	return best ? { kind: 'wall', wallId: best.wallId } : null;
}

/**
 * Test-only reference implementing the locked hit priority:
 * vertex → opening → object → wall → room. Mirrors the viewport's canonical
 * wall-first branch in `findPlanHitTarget` so the real `plan-hit` module can be
 * parity-checked against these goldens. Two tiers of the viewport resolver are
 * outside a compiled-geometry-only reference: the `interior-anchor` point tier
 * (compiled wall-first records carry `vertex` points only — Wall bends are
 * Wall-owned knots, not authored path anchors) and the curve-control candidates
 * (transient editing state owned by the caller, resolved by `resolvePlanHit`
 * directly — see the g2 suite).
 */
export function resolveG2ReferenceHit(
	compiled: CompiledLayoutGeometry,
	point: LayoutVec2,
	tolerance: number
): G2ReferenceHitResult {
	const vertex = nearestVertexHit(compiled, point, tolerance);
	if (vertex) return vertex;
	const opening = nearestOpeningHit(compiled, point, tolerance);
	if (opening) return opening;
	const objectPolygon = findPolygonContaining(
		point,
		compiled.queries.polygons.filter((polygon) => polygon.kind === 'object-footprint')
	);
	if (objectPolygon?.objectId) {
		return { kind: 'object', objectId: objectPolygon.objectId };
	}
	const wall = nearestWallHit(compiled, point, tolerance);
	if (wall) return wall;
	const roomPolygon = findPolygonContaining(
		point,
		compiled.queries.polygons.filter((polygon) => polygon.kind === 'room-floor')
	);
	return roomPolygon?.roomId ? { kind: 'room', roomId: roomPolygon.roomId } : null;
}

// --- Scene navigation fixture ---------------------------------------------

function g2Node(
	id: string,
	roomId: string,
	position: Vec3,
	cameraTarget: Vec3,
	fov: number,
	connectedNodeIds: string[]
): NavigationNodeData {
	return {
		id,
		roomId,
		label: id.toUpperCase(),
		position: [...position] as Vec3,
		cameraTarget: [...cameraTarget] as Vec3,
		fov,
		connectedNodeIds: [...connectedNodeIds]
	};
}

function g2Connection(
	id: string,
	fromNodeId: string,
	toNodeId: string,
	points: readonly Vec3[]
): RuntimeConnection {
	return {
		id,
		fromNodeId,
		toNodeId,
		positionPath: {
			kind: 'rounded-polyline',
			anchors: points.map((position, index) => ({
				id: `${id}:anchor:${index}`,
				position: [...position] as Vec3
			}))
		},
		clearance: 0.35,
		timing: {
			forward: { durationSeconds: 4, easing: 'smoothstep' },
			reverse: { durationSeconds: 4, easing: 'smoothstep' }
		}
	};
}

/**
 * Minimal three-node Camera graph for the G2 projection goldens. Order is not a
 * Camera fact after `T3.P01.S04`: the nodes carry framing and connectivity only,
 * and the Experience unit owns any editorial sequence. Positions share a 1.6 m
 * camera height so dropping Y yields a clean 2D plan polyline.
 */
export function g2SceneNavigationGraph(): NavigationGraph {
	const definitions = [
		{ id: 'n0', roomId: 'room-a', position: [0, 1.6, 0] as Vec3, cameraTarget: [3, 1.2, 0] as Vec3, fov: 54, connected: ['n1'], },
		{ id: 'n1', roomId: 'room-b', position: [6, 1.6, 0] as Vec3, cameraTarget: [6, 1.2, 2] as Vec3, fov: 54, connected: ['n0', 'n2'], },
		{ id: 'n2', roomId: 'room-c', position: [6, 1.6, 4] as Vec3, cameraTarget: [3, 1.2, 4] as Vec3, fov: 60, connected: ['n1'], next: 'n0', previous: 'n1' }
	];
	const navigationNodes = definitions.map((definition) =>
		g2Node(
			definition.id,
			definition.roomId,
			definition.position,
			definition.cameraTarget,
			definition.fov,
			definition.connected
		)
	);
	const nodeById = new Map(navigationNodes.map((node) => [node.id, node]));
	const connections: RuntimeConnection[] = [
		g2Connection('c0', 'n0', 'n1', [navigationNodes[0]!.position, navigationNodes[1]!.position]),
		g2Connection('c1', 'n1', 'n2', [navigationNodes[1]!.position, navigationNodes[2]!.position]),
		g2Connection('c2', 'n2', 'n0', [navigationNodes[2]!.position, navigationNodes[0]!.position])
	];
	return { navigationNodes, connections, nodeById };
}

/** Compile a G2 fixture document into render-neutral geometry plus issues. */
export function compileG2Fixture(document: ReturnType<typeof g2LineRectangleDocument>) {
	return compileWallFirstLayoutGeometry(document);
}

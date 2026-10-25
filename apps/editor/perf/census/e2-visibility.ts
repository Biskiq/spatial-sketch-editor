/**
 * E2 — visibility census (T1.P02.S06 C). "Census, not timing."
 *
 * For each authored Camera View and Stop pose, count the Rooms reachable from
 * the pose's Room through Openings whose plan extent intersects the
 * successively clipped horizontal view frustum. An Opening joins the Rooms
 * adjacent to its host Wall; a door also carries its validated
 * `connectsRoomIds` pair. Plan-only and angle-interval clipping, so it is
 * conservative: it ignores vertical extent and Wall thickness, and may
 * overcount visible Rooms but never undercounts them. It bounds direct
 * visibility only; shadows and light reach beyond it, so it never proves
 * visual irrelevance (that is E5's framebuffer check).
 */
import { compileWallFirstLayoutGeometry, type LayoutDocumentWallFirst, type LayoutVec2 } from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

type Pose = { readonly id: string; readonly label: string; readonly kind: 'view' | 'stop'; readonly eye: readonly number[]; readonly target: readonly number[]; readonly fov: number };

/** The Stage and Preview render at 16:9 in the bench viewport (1920×1080). */
export const ASPECT = 16 / 9;

function horizontalHalfFov(verticalFovDegrees: number): number {
	return Math.atan(Math.tan(((verticalFovDegrees * Math.PI) / 180) / 2) * ASPECT);
}

function insidePolygon(point: LayoutVec2, polygon: readonly LayoutVec2[]): boolean {
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const [xi, zi] = polygon[i]!;
		const [xj, zj] = polygon[j]!;
		if (zi > point[1] !== zj > point[1] && point[0] < ((xj - xi) * (point[1] - zi)) / (zj - zi) + xi) inside = !inside;
	}
	return inside;
}

function wrap(angle: number): number {
	let value = angle;
	while (value > Math.PI) value -= 2 * Math.PI;
	while (value <= -Math.PI) value += 2 * Math.PI;
	return value;
}

type Portal = { readonly id: string; readonly a: LayoutVec2; readonly b: LayoutVec2; readonly rooms: readonly string[] };

function portalsOf(document: LayoutDocumentWallFirst): Portal[] {
	const point = (id: string) => document.junctions.find((junction) => junction.id === id)!.point;
	const roomsByWall = new Map<string, string[]>();
	for (const room of document.rooms) for (const ref of room.boundary) roomsByWall.set(ref.wallId, [...(roomsByWall.get(ref.wallId) ?? []), room.id]);
	return document.openings.map((opening) => {
		const wall = document.walls.find((candidate) => candidate.id === opening.wallId)!;
		const start = point(wall.startJunctionId);
		const end = point(wall.endJunctionId);
		const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
		const dx = (end[0] - start[0]) / length;
		const dz = (end[1] - start[1]) / length;
		const rooms = new Set(roomsByWall.get(opening.wallId) ?? []);
		for (const id of opening.connectsRoomIds ?? []) rooms.add(id);
		return {
			id: opening.id,
			a: [start[0] + dx * opening.offset, start[1] + dz * opening.offset],
			b: [start[0] + dx * (opening.offset + opening.width), start[1] + dz * (opening.offset + opening.width)],
			rooms: [...rooms]
		};
	});
}

export type E2Pose = {
	readonly id: string;
	readonly label: string;
	readonly kind: 'view' | 'stop';
	readonly startRoomId: string | null;
	readonly visibleRooms: readonly string[];
	readonly visibleFraction: number;
	readonly seesExterior: boolean;
};

export type E2Result = {
	readonly workload: string;
	readonly contentDigest: string;
	readonly rooms: number;
	readonly poses: readonly E2Pose[];
	readonly medianFraction: number;
	readonly worstFraction: number;
	readonly worstSightline: string;
};

export function visibleRoomsFrom(
	document: LayoutDocumentWallFirst,
	roomPolygons: ReadonlyMap<string, readonly LayoutVec2[]>,
	pose: Pose
): { startRoomId: string | null; visible: Set<string>; seesExterior: boolean } {
	const eye: LayoutVec2 = [pose.eye[0]!, pose.eye[2]!];
	const heading = Math.atan2(pose.target[2]! - pose.eye[2]!, pose.target[0]! - pose.eye[0]!);
	const half = horizontalHalfFov(pose.fov);
	let startRoomId: string | null = null;
	for (const [roomId, polygon] of roomPolygons) if (insidePolygon(eye, polygon)) startRoomId = roomId;
	const visible = new Set<string>();
	let seesExterior = false;
	if (startRoomId === null) return { startRoomId, visible, seesExterior };
	const portals = portalsOf(document);
	const portalsByRoom = new Map<string, Portal[]>();
	for (const portal of portals) for (const roomId of portal.rooms) portalsByRoom.set(roomId, [...(portalsByRoom.get(roomId) ?? []), portal]);
	const best = new Map<string, [number, number]>();
	const relative = (p: LayoutVec2) => wrap(Math.atan2(p[1] - eye[1], p[0] - eye[0]) - heading);
	const visit = (roomId: string, lo: number, hi: number, path: ReadonlySet<string>) => {
		visible.add(roomId);
		for (const portal of portalsByRoom.get(roomId) ?? []) {
			if (path.has(portal.id)) continue;
			const ra = relative(portal.a);
			const rb = relative(portal.b);
			if (Math.abs(ra - rb) > Math.PI) continue; // the segment lies behind the eye
			const nlo = Math.max(lo, Math.min(ra, rb));
			const nhi = Math.min(hi, Math.max(ra, rb));
			if (!(nlo < nhi)) continue;
			const next = portal.rooms.filter((id) => id !== roomId);
			if (next.length === 0) {
				seesExterior = true;
				continue;
			}
			for (const nextRoom of next) {
				const key = `${nextRoom}|${portal.id}`;
				const seen = best.get(key);
				if (seen !== undefined && seen[0] <= nlo && seen[1] >= nhi) continue;
				best.set(key, [nlo, nhi]);
				visit(nextRoom, nlo, nhi, new Set([...path, portal.id]));
			}
		}
	};
	visit(startRoomId, -half, half, new Set());
	return { startRoomId, visible, seesExterior };
}

export function posesOf(envelope: ProjectEnvelope): Pose[] {
	const views = envelope.units.camera.data.views;
	const viewById = new Map(views.map((view) => [view.id, view]));
	const poses: Pose[] = views.map((view) => ({ id: view.id, label: view.label, kind: 'view', eye: view.eye, target: view.target, fov: view.fov }));
	for (const experience of envelope.units.experience.data.experiences) {
		const presentationById = new Map(experience.presentations.map((presentation) => [presentation.id, presentation]));
		for (const stop of experience.stops) {
			const presentation = presentationById.get(stop.presentationId);
			const viewId = stop.entryViewId ?? presentation?.defaultViewId;
			const view = viewId === undefined || viewId === null ? undefined : viewById.get(viewId);
			if (view === undefined) continue;
			poses.push({ id: stop.id, label: `${stop.id} → ${view.label}`, kind: 'stop', eye: view.eye, target: view.target, fov: view.fov });
		}
	}
	return poses;
}

export function runE2(workload: string, contentDigest: string, envelope: ProjectEnvelope): E2Result {
	const document = envelope.units.layout.data;
	const geometry = compileWallFirstLayoutGeometry(document).geometry;
	const roomPolygons = new Map(geometry.rooms.map((room) => [room.roomId, room.floorPolygon as readonly LayoutVec2[]]));
	const poses = posesOf(envelope).map((pose): E2Pose => {
		const { startRoomId, visible, seesExterior } = visibleRoomsFrom(document, roomPolygons, pose);
		return {
			id: pose.id,
			label: pose.label,
			kind: pose.kind,
			startRoomId,
			visibleRooms: [...visible].sort(),
			visibleFraction: visible.size / document.rooms.length,
			seesExterior
		};
	});
	const fractions = poses.map((pose) => pose.visibleFraction).sort((a, b) => a - b);
	const worst = [...poses].sort((a, b) => b.visibleFraction - a.visibleFraction)[0];
	return {
		workload,
		contentDigest,
		rooms: document.rooms.length,
		poses,
		medianFraction: fractions[Math.floor((fractions.length - 1) / 2)] ?? Number.NaN,
		worstFraction: worst?.visibleFraction ?? Number.NaN,
		worstSightline: worst === undefined ? 'none' : `${worst.label} (${worst.visibleRooms.length} Rooms)`
	};
}

/** Plan C: a median visible fraction above 40 % weakens the cell-and-portal proposal. */
export const E2_PORTAL_LIMIT = 0.4;
